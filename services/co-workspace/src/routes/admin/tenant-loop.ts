import { assertTenantLoopAllowed, callerPrincipal, requireAdminReady, tenantLoopSwitchBlocked } from "../../access";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import { GroupConflictError } from "../../users";
import {
  DEFAULT_LOOP_GROUP,
  buildTenantLoopExport,
  exportTenantLoopRegistry,
  readTenantLoopExport,
  tenantLoopRegistryPath,
  validateDesignatedUsers,
  validateGroupId,
  validateLoopScopes,
  validateLoopWindows,
  evaluateTenantUpgrade,
  type LoopGroupConfig,
} from "../../tenant-loop";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";

/** ── Tenant-loop admin (design 2026-11-08-gw-tenant-loop-and-hardening-design §4).
 * Kill switch first: every tenant-loop route answers 403 (typed) + audit while
 * CO_WORKSPACE_TENANT_LOOP_DISABLED is set. Each successful mutation rewrites the
 * registry export (§4.5) and reports the export result to the caller. ── */
export async function handleTenantLoop(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path } = ctx;
  if (!path.startsWith("/admin/tenant-loop")) return null;

  if (tenantLoopSwitchBlocked(state, req, path)) {
    throw new HttpError(403, "tenant-loop is disabled (CO_WORKSPACE_TENANT_LOOP_DISABLED is set)", "tenant_loop_disabled");
  }

  // GET /admin/tenant-loop/registry — preview of the export (live file when fresh, else a rebuild).
  if (req.method === "GET" && path === "/admin/tenant-loop/registry") {
    requireAdminReady(state, req);
    const live = readTenantLoopExport(state.cfg.workspaceDir);
    return jsonResponse({
      exportPath: tenantLoopRegistryPath(state.cfg.workspaceDir),
      registry: live ?? buildTenantLoopExport(state.registry.list(), state.users.listGroups()),
      source: live ? "file" : "rebuilt",
    });
  }

  // PUT /admin/tenant-loop/config — group-level defaults (scopes/windows/designatedUsers).
  if (req.method === "PUT" && path === "/admin/tenant-loop/config") {
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const groupId = validateGroupId(body.group ?? DEFAULT_LOOP_GROUP);
    assertTenantLoopAllowed(state, req, "config", groupId);
    const group: LoopGroupConfig = {
      groupId,
      name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : groupId,
      designatedUsers: body.designatedUsers !== undefined ? validateDesignatedUsers(body.designatedUsers) : [],
      scopes: body.scopes !== undefined ? validateLoopScopes(body.scopes) : undefined,
      windows: body.windows !== undefined ? validateLoopWindows(body.windows) : undefined,
    };
    try {
      state.users.upsertGroup(group);
    } catch (err) {
      // The id names a general (admin console) group: loop config cannot take it over.
      if (err instanceof GroupConflictError) throw new HttpError(409, "conflict");
      throw err;
    }
    state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.loop.config.updated", groupId, `designated=${group.designatedUsers.length}`);
    const exported = exportTenantLoopRegistry(state);
    return jsonResponse({ group, export: exported });
  }

  const loopTenantRoute = path.match(/^\/admin\/tenant-loop\/tenants\/([^/]+)\/(register|suspend|deregister|upgrade)$/);
  if (loopTenantRoute) {
    const tenantId = decodeURIComponent(loopTenantRoute[1]);
    const op = loopTenantRoute[2];
    const rec = state.registry.get(tenantId);
    if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
    const body = req.method === "POST" ? ((await readJsonBody(req).catch(() => ({}))) as Record<string, unknown>) : {};
    // [QA S2] The governing group is the TENANT'S OWN loopGroup for every operation on an
    // existing tenant record. body.group is legitimate ONLY for register (no loop group is
    // recorded yet). Deriving it from body.group for suspend/deregister/upgrade would let a
    // designated member of ANY loop group act on ANY tenant by naming their own group here —
    // a cross-group authorization bypass. body.group on those ops is ignored, never trusted.
    const governingGroup =
      op === "register" && typeof body.group === "string" && body.group.trim()
        ? validateGroupId(body.group)
        : (rec.loopGroup ?? DEFAULT_LOOP_GROUP);

    if (req.method === "POST" && op === "register") {
      assertTenantLoopAllowed(state, req, "register", governingGroup);
      const overrideScopes = body.scopes !== undefined ? validateLoopScopes(body.scopes) : undefined;
      const overrideWindows = body.windows !== undefined ? validateLoopWindows(body.windows) : undefined;
      const gitRemote = typeof body.gitRemote === "string" && body.gitRemote.trim() ? body.gitRemote.trim() : "local-only";
      rec.loopStatus = "active";
      rec.loopGroup = governingGroup;
      rec.loopOverride = {
        ...(overrideScopes ? { scopes: overrideScopes } : {}),
        ...(overrideWindows ? { windows: overrideWindows } : {}),
      };
      if (Object.keys(rec.loopOverride).length === 0) rec.loopOverride = undefined;
      rec.loopGitRemote = gitRemote;
      state.registry.upsert(rec);
      state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.loop.register.allowed", tenantId, `group=${governingGroup}`);
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ tenantId, loopStatus: rec.loopStatus, loopGroup: governingGroup, gitRemote, export: exported });
    }

    if (req.method === "POST" && op === "suspend") {
      assertTenantLoopAllowed(state, req, "suspend", governingGroup);
      if (!rec.loopStatus) throw new HttpError(409, "tenant is not registered in the tenant loop", "tenant_loop_not_registered");
      rec.loopStatus = "suspended";
      state.registry.upsert(rec);
      state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.loop.suspend.allowed", tenantId, `group=${governingGroup}`);
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ tenantId, loopStatus: rec.loopStatus, export: exported });
    }

    if (req.method === "POST" && op === "deregister") {
      assertTenantLoopAllowed(state, req, "deregister", governingGroup);
      if (!rec.loopStatus) throw new HttpError(409, "tenant is not registered in the tenant loop", "tenant_loop_not_registered");
      // The tenant itself is kept; only its loop participation ends (§4.4).
      delete rec.loopStatus;
      delete rec.loopGroup;
      delete rec.loopOverride;
      delete rec.loopGitRemote;
      delete rec.loopState;
      state.registry.upsert(rec);
      state.audit.record(callerPrincipal(state, req) ?? "anonymous", "tenant.loop.deregister.allowed", tenantId, `group=${governingGroup}`);
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ tenantId, deregistered: true, export: exported });
    }

    if (req.method === "POST" && op === "upgrade") {
      // Gating + tenant-loop posture checks run before the dry-run plan is built (§4.4).
      assertTenantLoopAllowed(state, req, "upgrade", governingGroup);
      const result = await evaluateTenantUpgrade(state, rec, { confirm: body.confirm === true });
      return jsonResponse("execution" in result ? result.execution : result.plan);
    }
  }

  throw new HttpError(404, `no route: ${req.method} ${path}`);
}
