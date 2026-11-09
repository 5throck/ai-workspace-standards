/** Admin console user routes (design §8.2): filtered listing, bulk actions, CSV export and
 * import, and the effective-policy view. Single-user reset/rename/delete live in legacy.ts. */

import { deleteTenantData } from "../../lifecycle";
import { effectivePolicyFor } from "../../policy";
import { isReservedLoginId, requireAdminReady, requireAdminReauth } from "../../access";
import { HttpError, NO_STORE_HEADERS, jsonResponse, readJsonBody } from "../../http";
import type { GatewayState } from "../../state";
import type { UserQuery, UserRecord } from "../../users";
import type { Ctx } from "../ctx";
import {
  BulkFailure,
  CSV_IMPORT_MAX_ROWS,
  CSV_MAX_ROWS,
  PAGE_SIZE_MAX,
  csvCell,
  guardAdminTargets,
  isFormulaLead,
  parseBulkIds,
  parseCsv,
  readBoundedText,
  resolveUserRef,
  type LockoutAction,
  type LockoutItem,
} from "./shared";

const LOGIN_ID_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;
const USER_BULK_ACTIONS = ["suspend", "activate", "delete", "set-role", "add-group", "remove-group"] as const;
type UserBulkAction = (typeof USER_BULK_ACTIONS)[number];
// 2026-11-09 review M4: activate and remove-group now re-confirm the password too.
const REAUTH_ACTIONS = new Set<UserBulkAction>(["suspend", "activate", "delete", "set-role", "remove-group"]);

/** Single-user delete core, shared by the legacy single route and the bulk delete. Archives or
 * deletes the owner's tenants, soft-deletes the account (revoking its sessions), and drops its
 * group memberships. Per-tenant failures are reported, not thrown. Throws `last_admin` (409)
 * before any side effect when the delete would leave no active admin (review L1). */
export async function deleteUserWithTenants(
  state: GatewayState,
  target: UserRecord,
  disposition: "delete" | "archive",
  actor: string,
): Promise<{ tenantsHandled: number; errors: Array<{ tenantId: string; error: string }> }> {
  // Re-checked immediately before the soft delete: the batch guard ran earlier, and tenant
  // work below awaits, so the admin count can move in between. The account goes first so a
  // refusal leaves no tenant side effects behind.
  if (target.role === "admin" && !target.disabledAt && state.users.countActiveAdmins() <= 1) {
    throw new HttpError(409, "last_admin");
  }
  state.users.softDeleteUser(target.id);
  state.users.removePrincipalFromAllGroups(target.principal);
  let handled = 0;
  const errors: Array<{ tenantId: string; error: string }> = [];
  for (const t of state.registry.list()) {
    if ((t.ownerPrincipal ?? "anonymous") !== target.principal) continue;
    if (disposition === "delete") {
      try {
        await deleteTenantData(state, t, actor);
      } catch (err) {
        errors.push({ tenantId: t.tenantId, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
    } else {
      // Same archive shape as the tenant bulk archive (routes/admin/tenants.ts): archivedAt is
      // what the console and quota checks read (2026-11-09 review L8).
      t.status = "archived";
      t.archivedAt = new Date().toISOString();
      state.registry.upsert(t);
    }
    handled += 1;
  }
  return { tenantsHandled: handled, errors };
}

/** Skip reasons as `reason:count` pairs for the import audit row (review M5). */
function skipReasonSummary(skipped: Array<{ error: string }>): string {
  const counts = new Map<string, number>();
  for (const s of skipped) counts.set(s.error, (counts.get(s.error) ?? 0) + 1);
  return [...counts.entries()].map(([reason, n]) => `${reason}:${n}`).join(",") || "none";
}

function intParam(params: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const raw = params.get(name);
  if (raw === null || raw === "") return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new HttpError(400, "invalid_request");
  return value;
}

/** Shared filter parsing for the list and the CSV export (the export ignores paging). */
function parseUserQuery(params: URLSearchParams, forExport = false): UserQuery {
  const status = params.get("status");
  const role = params.get("role");
  if (status !== null && !["active", "pending", "suspended", "deleted"].includes(status)) throw new HttpError(400, "invalid_request");
  if (role !== null && role !== "user" && role !== "admin") throw new HttpError(400, "invalid_request");
  const q = params.get("q")?.trim() ?? "";
  if (q.length > 80) throw new HttpError(400, "invalid_request");
  return {
    q: q || undefined,
    group: params.get("group") || undefined,
    status: (status ?? undefined) as UserQuery["status"],
    role: (role ?? undefined) as UserQuery["role"],
    page: forExport ? 1 : intParam(params, "page", 1, Number.MAX_SAFE_INTEGER) ?? 1,
    size: forExport ? PAGE_SIZE_MAX : intParam(params, "size", 1, PAGE_SIZE_MAX) ?? 50,
  };
}

/** Every user matching the filters (the export walks pages of the store's capped query). */
function allMatchingUsers(state: GatewayState, q: UserQuery): UserRecord[] {
  const out: UserRecord[] = [];
  for (let page = 1; ; page += 1) {
    const { users, total } = state.users.queryUsers({ ...q, page, size: PAGE_SIZE_MAX });
    out.push(...users);
    if (users.length === 0 || out.length >= total) return out;
  }
}

function userStatus(state: GatewayState, u: UserRecord): "deleted" | "suspended" | "pending" | "active" {
  if (u.deletedAt) return "deleted";
  if (u.disabledAt) return "suspended";
  return state.users.isVerified(u.id) ? "active" : "pending";
}

/** Tenant count and token usage per owning principal, from one registry pass. */
function usageByPrincipal(state: GatewayState): Map<string, { tenantCount: number; input: number; output: number }> {
  const map = new Map<string, { tenantCount: number; input: number; output: number }>();
  for (const t of state.registry.list()) {
    const key = t.ownerPrincipal ?? "anonymous";
    const entry = map.get(key) ?? { tenantCount: 0, input: 0, output: 0 };
    entry.tenantCount += 1;
    entry.input += t.inputTokens;
    entry.output += t.outputTokens;
    map.set(key, entry);
  }
  return map;
}

export async function handleUsers(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path, url } = ctx;

  if (req.method === "GET" && path === "/admin/users") {
    requireAdminReady(state, req);
    const query = parseUserQuery(url.searchParams);
    const { users, total } = state.users.queryUsers(query);
    const usage = usageByPrincipal(state);
    return jsonResponse({
      users: users.map((u) => {
        const stats = usage.get(u.principal) ?? { tenantCount: 0, input: 0, output: 0 };
        return {
          id: u.id,
          // principal is the trusted ownership label; the console joins tenant stats on it.
          principal: u.principal,
          loginId: u.principal,
          name: u.name,
          role: u.role,
          status: userStatus(state, u),
          groups: state.users.groupsOf(u.principal).map((g) => g.groupId),
          tenantCount: stats.tenantCount,
          usage: { input: stats.input, output: stats.output },
          createdAt: u.createdAt,
          disabledAt: u.disabledAt,
        };
      }),
      total,
      page: query.page,
      size: query.size,
    });
  }

  if (req.method === "GET" && path === "/admin/users/export.csv") {
    const caller = requireAdminReady(state, req);
    const users = allMatchingUsers(state, parseUserQuery(url.searchParams, true));
    const usage = usageByPrincipal(state);
    const header = ["loginId", "name", "role", "status", "groups", "tenantCount", "createdAt"];
    const lines = [header.join(",")];
    for (const u of users) {
      lines.push(
        [
          csvCell(u.principal),
          csvCell(u.name),
          csvCell(u.role),
          csvCell(userStatus(state, u)),
          csvCell(state.users.groupsOf(u.principal).map((g) => g.groupId).join(";")),
          csvCell(usage.get(u.principal)?.tenantCount ?? 0),
          csvCell(u.createdAt),
        ].join(","),
      );
    }
    state.audit.record(caller.principal, "user.export", undefined, `rows=${users.length}`);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new Response(lines.join("\r\n") + "\r\n", {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="users-${stamp}.csv"`,
        "x-content-type-options": "nosniff",
        ...NO_STORE_HEADERS,
      },
    });
  }

  if (req.method === "POST" && path === "/admin/users/bulk") {
    const caller = requireAdminReady(state, req);
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const action = body.action;
    if (typeof action !== "string" || !(USER_BULK_ACTIONS as readonly string[]).includes(action)) {
      throw new HttpError(400, "invalid_request");
    }
    const bulkAction = action as UserBulkAction;
    if (REAUTH_ACTIONS.has(bulkAction)) await requireAdminReauth(state, req);
    const refs = parseBulkIds(body.ids);

    const failed: BulkFailure[] = [];
    const live: LockoutItem[] = [];
    for (const ref of refs) {
      const user = resolveUserRef(state, ref);
      if (user) live.push({ ref, user });
      else failed.push({ id: ref, error: "not_found" });
    }

    let allowed: LockoutItem[] = live;
    const guard = (lockout: LockoutAction): void => {
      const result = guardAdminTargets(state, caller, live, lockout);
      failed.push(...result.failed);
      allowed = result.allowed;
    };
    let deleted = 0;

    if (bulkAction === "suspend") {
      guard("suspend");
      state.users.setDisabled(allowed.map((i) => i.user.id), true);
      for (const item of allowed) state.audit.record(caller.principal, "user.suspend", item.user.principal);
    } else if (bulkAction === "activate") {
      state.users.setDisabled(allowed.map((i) => i.user.id), false);
      for (const item of allowed) state.audit.record(caller.principal, "user.activate", item.user.principal);
    } else if (bulkAction === "delete") {
      guard("delete");
      const disposition = body.disposition === "delete" ? "delete" : "archive";
      for (const item of allowed) {
        try {
          const result = await deleteUserWithTenants(state, item.user, disposition, caller.principal);
          state.audit.record(
            caller.principal,
            "user.delete",
            item.user.principal,
            `disposition=${disposition} tenants=${result.tenantsHandled}`,
          );
          deleted += 1;
        } catch (err) {
          // Per-item refusal (the L1 re-check): reported in `failed`, the rest of the batch goes on.
          if (err instanceof HttpError && err.message === "last_admin") {
            failed.push({ id: item.ref, error: "last_admin" });
            continue;
          }
          throw err;
        }
      }
    } else if (bulkAction === "set-role") {
      const role = body.role;
      if (role !== "user" && role !== "admin") throw new HttpError(400, "invalid_request");
      if (role === "user") guard("demote");
      state.users.setRole(allowed.map((i) => i.user.id), role);
      for (const item of allowed) state.audit.record(caller.principal, "user.set-role", item.user.principal, `role=${role}`);
    } else {
      // add-group / remove-group: general groups only; loop membership is edited via tenant-loop.
      const groupId = typeof body.groupId === "string" ? body.groupId : "";
      const group = state.users.getGroupRecord(groupId);
      if (!group) throw new HttpError(404, "not_found");
      if (group.kind !== "general") throw new HttpError(409, "loop_group_readonly");
      const principals = allowed.map((i) => i.user.principal);
      if (bulkAction === "add-group") {
        state.users.addMembers(groupId, principals);
        for (const p of principals) state.audit.record(caller.principal, "group.member.add", p, groupId);
      } else {
        state.users.removeMembers(groupId, principals);
        for (const p of principals) state.audit.record(caller.principal, "group.member.remove", p, groupId);
      }
    }

    const ok = bulkAction === "delete" ? deleted : allowed.length;
    state.audit.record(caller.principal, `user.bulk.${bulkAction}`, undefined, `ok=${ok} failed=${failed.length}`);
    return jsonResponse({ ok, failed });
  }

  if (req.method === "POST" && path === "/admin/users/import") {
    const caller = requireAdminReady(state, req);
    const dryRun = url.searchParams.get("dryRun") === "1";
    if (!dryRun) await requireAdminReauth(state, req);
    const text = await readBoundedText(req);
    const rows = parseCsv(text);
    if (rows.length === 0) throw new HttpError(400, "invalid_request");
    const header = rows[0].map((h) => h.trim());
    const col = (name: string): number => header.indexOf(name);
    if (col("loginId") < 0) throw new HttpError(400, "invalid_request");
    const dataRows = rows.slice(1);
    if (dataRows.length > (dryRun ? CSV_MAX_ROWS : CSV_IMPORT_MAX_ROWS)) throw new HttpError(413, "payload_too_large");

    const skipped: Array<{ row: number; loginId: string; error: string }> = [];
    const accepted: Array<{ row: number; loginId: string; name: string; role: "user" | "admin"; groups: string[] }> = [];
    const seen = new Set<string>();
    dataRows.forEach((cells, index) => {
      const row = index + 2; // file line number: the header is line 1
      const field = (name: string): string => (col(name) >= 0 ? (cells[col(name)] ?? "").trim() : "");
      const loginId = field("loginId").toLowerCase();
      const skip = (error: string): void => {
        skipped.push({ row, loginId, error });
      };
      if (!LOGIN_ID_RE.test(loginId)) return skip("invalid_login");
      if (isReservedLoginId(state.cfg, loginId)) return skip("reserved_login");
      if (seen.has(loginId) || state.users.loginIdTaken(loginId)) return skip("login_taken");
      const name = field("name") || loginId;
      if (name.length > 80 || isFormulaLead(name)) return skip("invalid_name");
      const roleRaw = field("role") || "user";
      if (roleRaw !== "user" && roleRaw !== "admin") return skip("invalid_role");
      const groups = field("groups")
        .split(";")
        .map((g) => g.trim())
        .filter(Boolean);
      for (const groupId of groups) {
        const group = state.users.getGroupRecord(groupId);
        if (!group || group.kind !== "general") return skip("unknown_group");
      }
      seen.add(loginId);
      accepted.push({ row, loginId, name, role: roleRaw, groups });
    });

    if (dryRun) {
      return jsonResponse({ dryRun: true, created: accepted.map((a) => ({ loginId: a.loginId })), skipped });
    }

    // Temp passwords are hashed off the event loop in small batches (review M5). The audit row is
    // written in `finally`, so a failure part-way still records what was created and skipped.
    const IMPORT_BATCH = 20;
    const created: Array<{ loginId: string; tempPassword: string }> = [];
    let failure: string | null = null;
    try {
      for (let start = 0; start < accepted.length; start += IMPORT_BATCH) {
        for (const a of accepted.slice(start, start + IMPORT_BATCH)) {
          const user = state.users.createImportedAccount({ loginId: a.loginId, name: a.name, role: a.role });
          for (const groupId of a.groups) state.users.addMembers(groupId, [a.loginId]);
          const tempPassword = await state.users.createTempPasswordAsync(user.id);
          state.audit.record(caller.principal, "user.create", a.loginId, `role=${a.role}`);
          created.push({ loginId: a.loginId, tempPassword });
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } catch (err) {
      failure = err instanceof Error ? err.name : "error";
      throw err;
    } finally {
      const reasons = skipReasonSummary(skipped);
      state.audit.record(
        caller.principal,
        "user.import",
        undefined,
        `created=${created.length} skipped=${skipped.length} reasons=${reasons}${failure ? ` error=${failure}` : ""}`,
      );
    }
    return jsonResponse({ dryRun: false, created, skipped }, 200, NO_STORE_HEADERS);
  }

  const policyRoute = path.match(/^\/admin\/users\/([^/]+)\/effective-policy$/);
  if (req.method === "GET" && policyRoute) {
    requireAdminReady(state, req);
    const target = resolveUserRef(state, decodeURIComponent(policyRoute[1]));
    if (!target) throw new HttpError(404, "not_found");
    const effective = effectivePolicyFor(state, target.principal);
    const groups = state.users.groupsOf(target.principal).map((g) => ({ groupId: g.groupId, name: g.name, policy: g.policy }));
    return jsonResponse({ ...effective, groups });
  }

  return null;
}
