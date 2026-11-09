import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sessionTokenFromCookie } from "../../users";
import { HttpError, NO_STORE_HEADERS, jsonResponse, readJsonBody } from "../../http";
import { callerPrincipal, requireAdminReauth, requireAdminReady, requireTenantAccess } from "../../access";
import { cachedDirSize } from "../../lifecycle";
import { attachScratchDir } from "../../attach";
import {
  applyTurnOverrides,
  maskApiKey,
  persistTurnOverrides,
  readTurnOverrides,
  runtimeProviderKeyGap,
  validateTurnOverridesBody,
} from "../../config";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";
import { deleteUserWithTenants } from "./users";

/** Stats, single-user reset/rename/delete, cancel, audit, turn-config, and mail-outbox: the
 * admin routes that predate the console split, kept with their original behaviour. */
export async function handleLegacy(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  // ── Wave B3: admin ──
  if (req.method === "GET" && path === "/admin/stats") {
    const caller = requireAdminReady(state, req); // T-20261003-027: password-set force (sub-feature 4)
    const tenants = state.registry.list();
    const turnCounts = state.turns.countsByTenant();
    const perUser = new Map<string, { principal: string; tenantCount: number; diskBytes: number; turns: number }>();
    for (const t of tenants) {
      const principal = t.ownerPrincipal ?? "anonymous";
      const entry = perUser.get(principal) ?? { principal, tenantCount: 0, diskBytes: 0, turns: 0 };
      entry.tenantCount += 1;
      // Addendum 17: attached tenants' gateway disk usage is the per-session scratch (the hub
      // checkout is not gateway storage and is never walked by the gateway's report).
      entry.diskBytes += await cachedDirSize(
        t.tenantId,
        t.kind === "attached" ? attachScratchDir(t) : t.projectDir,
        t.hermesHome,
      );
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

  const resetRoute = path.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
  if (req.method === "POST" && resetRoute) {
    const caller = state.users.resolveSession(sessionTokenFromCookie(req));
    if (!caller || caller.role !== "admin") throw new HttpError(403, "admin only");
    await requireAdminReauth(state, req); // session-hardening D4: re-present the password
    const target = state.users.findById(decodeURIComponent(resetRoute[1]));
    if (!target) throw new HttpError(404, "user not found");
    const tempPassword = state.users.createTempPassword(target.id);
    state.audit.record(caller.principal, "user.reset-password", target.principal);
    return jsonResponse({ tempPassword, note: "one-time temp password, 15-minute expiry; forced change at first sign-in" }, 200, NO_STORE_HEADERS);
  }

  const renameRoute = path.match(/^\/admin\/users\/([^/]+)\/name$/);
  if (req.method === "PATCH" && renameRoute) {
    const caller = requireAdminReady(state, req); // T-20261003-027: password-set force (sub-feature 4)
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
    await requireAdminReauth(state, req); // session-hardening D4
    const targetId = decodeURIComponent(deleteRoute[1]);
    const target = state.users.findById(targetId);
    if (!target) throw new HttpError(404, "user not found");
    // Admin console (§10): self-deletion is a lockout, reported with the shared code.
    if (target.id === caller.id) throw new HttpError(422, "self_lockout");
    const disposition = new URL(req.url).searchParams.get("tenants") === "delete" ? "delete" : "archive";
    const { tenantsHandled, errors } = await deleteUserWithTenants(state, target, disposition, caller.principal);
    state.audit.record(caller.principal, "user.delete", target.principal, `disposition=${disposition} tenants=${tenantsHandled}`);
    return jsonResponse({
      deletedUser: target.principal,
      disposition,
      tenantsHandled,
      ...(errors.length ? { errors } : {}),
    });
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
    requireAdminReady(state, req); // T-20261003-027: password-set force (sub-feature 4)
    const params = ctx.url.searchParams;
    // Without filters the response is unchanged; any filter or paging parameter pages the log.
    if (!["actor", "action", "page", "size"].some((k) => params.has(k))) {
      return jsonResponse({ entries: state.audit.list(200) });
    }
    const page = Number(params.get("page") ?? 1);
    const size = Number(params.get("size") ?? 50);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(size) || size < 1 || size > 200) {
      throw new HttpError(400, "invalid_request");
    }
    const { entries, total } = state.audit.query({
      actor: params.get("actor") || undefined,
      action: params.get("action") || undefined,
      page,
      size,
    });
    return jsonResponse({ entries, total, page, size });
  }

  // ── Turn-runtime hot-swap (spec 2026-10-04-turn-runtime-hotswap-design): the
  // runtime + credential selection is hot-applied to the running gateway and
  // persisted to data/turn-config.json (overrides env at next boot). GET masks the key.
  if (req.method === "GET" && path === "/admin/turn-config") {
    const caller = requireAdminReady(state, req);
    const cfg = state.cfg;
    return jsonResponse({
      runtime: cfg.runtime,
      provider: cfg.llmProvider ?? "none",
      apiKeyMasked: maskApiKey(cfg.llmApiKey),
      baseUrl: cfg.llmBaseUrl ?? null,
      model: cfg.hermesModel ?? null,
      extraArgs: cfg.hermesExtraArgs,
      credentialGap: runtimeProviderKeyGap(cfg.runtime, cfg),
      note: "PUT applies immediately (new turns) and persists across restarts; omit apiKey to keep the current one",
    });
  }

  if (req.method === "PUT" && path === "/admin/turn-config") {
    const caller = requireAdminReady(state, req);
    await requireAdminReauth(state, req); // session-hardening D4: credential changes re-present the password
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const patch = validateTurnOverridesBody(body);
    if (Object.keys(patch).length === 0) throw new HttpError(400, "turn-config: no fields to update");
    const merged = { ...readTurnOverrides(state.cfg.dataDir), ...patch };
    const { applied, warnings } = applyTurnOverrides(state.cfg, merged);
    persistTurnOverrides(state.cfg.dataDir, merged);
    state.audit.record(caller.principal, "turn-config.update", applied.join(","), `runtime=${state.cfg.runtime}`);
    return jsonResponse({
      applied,
      warnings,
      runtime: state.cfg.runtime,
      provider: state.cfg.llmProvider ?? "none",
      apiKeyMasked: maskApiKey(state.cfg.llmApiKey),
      baseUrl: state.cfg.llmBaseUrl ?? null,
      model: state.cfg.hermesModel ?? null,
      extraArgs: state.cfg.hermesExtraArgs,
    });
  }

  // QA-12: admin outbox viewer — remote signups cannot read a server-local file.
  if (req.method === "GET" && path === "/admin/mail-outbox") {
    const caller = requireAdminReady(state, req); // T-20261003-027: password-set force (sub-feature 4)
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
