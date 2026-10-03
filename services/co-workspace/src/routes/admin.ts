import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sessionTokenFromCookie } from "../users";
import { HttpError, jsonResponse, readJsonBody } from "../http";
import { callerPrincipal, requireTenantAccess } from "../access";
import { deleteTenantData, cachedDirSize } from "../lifecycle";
import type { GatewayState } from "../state";
import type { Ctx } from "./ctx";

export async function handleAdmin(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  // ── Wave B3: admin ──
  if (req.method === "GET" && path === "/admin/stats") {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    const tenants = state.registry.list();
    const turnCounts = state.turns.countsByTenant();
    const perUser = new Map<string, { principal: string; tenantCount: number; diskBytes: number; turns: number }>();
    for (const t of tenants) {
      const principal = t.ownerPrincipal ?? "anonymous";
      const entry = perUser.get(principal) ?? { principal, tenantCount: 0, diskBytes: 0, turns: 0 };
      entry.tenantCount += 1;
      entry.diskBytes += await cachedDirSize(t.tenantId, t.projectDir, t.hermesHome);
      entry.turns += turnCounts.get(t.tenantId) ?? 0;
      perUser.set(principal, entry);
    }
    const byVariant = new Map<string, number>();
    const byStatus = new Map<string, number>();
    for (const t of tenants) {
      byVariant.set(t.variant, (byVariant.get(t.variant) ?? 0) + 1);
      byStatus.set(t.status, (byStatus.get(t.status) ?? 0) + 1);
    }
    const users = state.users.listUsers();
    const totals = state.turns.aggregate();
    return jsonResponse({
      users: { active: users.filter((u) => !u.deletedAt).length, deleted: users.filter((u) => u.deletedAt).length },
      tenants: Object.fromEntries(byStatus),
      diskBytes: [...perUser.values()].reduce((a, b) => a + b.diskBytes, 0),
      turns: { total: totals.totalTurns, inputTokens: totals.totalInputTokens, outputTokens: totals.totalOutputTokens },
      tenantsPerVariant: [...byVariant.entries()].map(([variant, count]) => ({ variant, count })),
      tenantsPerStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      perUser: [...perUser.values()].sort((a, b) => b.diskBytes - a.diskBytes),
    });
  }

  if (req.method === "GET" && path === "/admin/users") {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    return jsonResponse({ users: state.users.listUsers().map((u) => ({
      id: u.id,
      // principal is the trusted ownership label — the admin panel joins /admin/stats
      // perUser (keyed by tenant ownerPrincipal) on it. Omitting it made every row's
      // Tenants/Usage render as 0 (found live, 2026-10-03).
      principal: u.principal,
      loginId: u.principal, name: u.name, role: u.role,
      status: u.deletedAt ? "deleted" : state.users.isVerified(u.id) ? "active" : "pending",
      createdAt: u.createdAt,
    })) });
  }

  const resetRoute = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
  if (req.method === "POST" && resetRoute) {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    const target = state.users.findById(decodeURIComponent(resetRoute[1]));
    if (!target) throw new HttpError(404, "user not found");
    const tempPassword = state.users.createTempPassword(target.id);
    state.audit.record(caller.principal, "user.reset-password", target.principal);
    return jsonResponse({ tempPassword, note: "one-time temp password, 15-minute expiry; forced change at first sign-in" });
  }

  const renameRoute = path.match(/^\/admin\/users\/([^/]+)\/name$/);
  if (req.method === "PATCH" && renameRoute) {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    const target = state.users.findById(decodeURIComponent(renameRoute[1]));
    if (!target) throw new HttpError(404, "user not found");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 80) throw new HttpError(400, "name must be 1-80 characters");
    const updated = state.users.renameUser(target.id, name);
    state.audit.record(caller.principal, "user.rename", target.principal, name);
    return jsonResponse({ user: { loginId: updated!.principal, name: updated!.name, role: updated!.role } });
  }

  const deleteRoute = path.match(/^\/admin\/users\/([^/]+)$/);
  if (req.method === "DELETE" && deleteRoute) {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    const targetId = decodeURIComponent(deleteRoute[1]);
    const target = state.users.findById(targetId);
    if (!target) throw new HttpError(404, "user not found");
    if (target.id === caller.id) throw new HttpError(400, "cannot delete yourself");
    const disposition = new URL(req.url).searchParams.get("tenants") === "delete" ? "delete" : "archive";
    let handled = 0;
    const errors: Array<{ tenantId: string; error: string }> = [];
    for (const t of state.registry.list()) {
      if ((t.ownerPrincipal ?? "anonymous") !== target.principal) continue;
      if (disposition === "delete") {
        try {
          await deleteTenantData(state, t, caller.principal);
        } catch (err) {
          errors.push({ tenantId: t.tenantId, error: err instanceof Error ? err.message : String(err) });
          continue;
        }
      } else {
        t.status = "archived";
        state.registry.upsert(t);
      }
      handled += 1;
    }
    state.users.softDeleteUser(targetId);
    state.audit.record(caller.principal, "user.delete", target.principal, `disposition=${disposition} tenants=${handled}`);
    return jsonResponse({ deletedUser: target.principal, disposition, tenantsHandled: handled, ...(errors.length ? { errors } : {}) });
  }

  // QA-07: cancel a running turn (kills the child process; the turn settles as partial).
  const cancelRoute = path.match(/^\/tenants\/([^/]+)\/cancel$/);
  if (req.method === "POST" && cancelRoute) {
    const tenantId = decodeURIComponent(cancelRoute[1]);
    const rec = state.registry.get(tenantId);
    if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
    requireTenantAccess(state, req, rec);
    const proc = state.activeProcs.get(tenantId);
    if (!proc) return jsonResponse({ cancelled: false, reason: "no active turn" });
    proc.kill();
    state.audit.record(callerPrincipal(state, req) ?? "anonymous", "turn.cancel", tenantId);
    return jsonResponse({ cancelled: true });
  }

  if (req.method === "GET" && path === "/admin/audit") {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    return jsonResponse({ entries: state.audit.list(200) });
  }

  // QA-12: admin outbox viewer — remote signups cannot read a server-local file.
  if (req.method === "GET" && path === "/admin/mail-outbox") {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    const dir = join(state.cfg.dataDir, "mail-outbox");
    const files: Array<{ file: string; content: string }> = [];
    if (existsSync(dir)) {
      for (const name of readdirSync(dir).sort().reverse().slice(0, 20)) {
        try {
          files.push({ file: name, content: readFileSync(join(dir, name), "utf8") });
        } catch {
          /* raced */
        }
      }
    }
    return jsonResponse({ outbox: files });
  }

  return null;
}
