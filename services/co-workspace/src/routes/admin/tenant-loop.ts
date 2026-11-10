/** ── Tenant-loop admin, round-2 unit model (design
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md, 2026-11-09 amendment): loop
 * coverage is driven by (group_id, variant) ENROLLMENTS on general groups. Routes:
 *
 *   GET    /admin/tenant-loop/registry                     — export preview (unchanged shape)
 *   GET    /admin/tenant-loop/enrollments                  — enrollment + operator listing (admin)
 *   PUT    /admin/tenant-loop/enrollments/:groupId/:variant — admin + REAUTH; audited old+new
 *   DELETE /admin/tenant-loop/enrollments/:groupId/:variant — admin + REAUTH; audited old
 *   GET    /admin/tenant-loop/preview?groupId=&variant=    — resolved coverage incl. the
 *                                                            window-unrepresentable reasons
 *   POST   /admin/tenant-loop/tenants/:id/upgrade          — dry-run/confirm (unchanged, new
 *                                                            refusal reasons)
 *
 * REMOVED at v4 (410 Gone with a pointer): PUT /admin/tenant-loop/config (kind='loop' groups
 * no longer exist) and the per-tenant register/suspend/deregister routes — the unit model
 * has NO per-tenant loop state to override (the amendment says the exception endpoints "go
 * away"; keeping them as live writes to fields nothing reads would be a silent lie). The
 * kill switch still short-circuits EVERY /admin/tenant-loop/* route. ── */

import { assertTenantLoopAllowed, requireAdminReady, requireAdminReauth, tenantLoopSwitchBlocked } from "../../access";
import { HttpError, jsonResponse, readJsonBody } from "../../http";
import {
  buildTenantLoopExport,
  evaluateTenantUpgrade,
  exportTenantLoopRegistry,
  readTenantLoopExport,
  resolveEnrollment,
  tenantLoopRegistryPath,
  validateEnrollmentVariant,
  validateLoopScopes,
  validateLoopWindows,
  type LoopScopes,
  type LoopWindows,
} from "../../tenant-loop";
import type { GatewayState } from "../../state";
import type { Ctx } from "../ctx";

const REMOVED_ROUTES_410: Record<string, string> = {
  // method:path → pointer at the replacement surface
  "PUT:/admin/tenant-loop/config": "/admin/tenant-loop/enrollments",
  "POST:/admin/tenant-loop/config": "/admin/tenant-loop/enrollments",
};

/** Returns a 410 body when the path is one of the removed per-tenant/config routes. */
function removedRouteResponse(method: string, path: string, tenantAction?: string): Response | null {
  if (tenantAction && tenantAction !== "upgrade") {
    return jsonResponse({ error: "tenant_loop_route_removed", pointer: "/admin/tenant-loop/enrollments" }, 410);
  }
  const pointer = REMOVED_ROUTES_410[`${method}:${path}`];
  if (pointer) return jsonResponse({ error: "config_route_removed", pointer }, 410);
  return null;
}

export async function handleTenantLoop(state: GatewayState, req: Request, ctx: Ctx): Promise<Response | null> {
  const { path, url } = ctx;
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
      registry: live ??
        buildTenantLoopExport(state.registry.list(), {
          enrollments: state.users.listEnrollments(),
          groupMemberships: groupMembershipsOf(state),
        }),
      source: live ? "file" : "rebuilt",
    });
  }

  // GET /admin/tenant-loop/enrollments — admin listing (enrollments + operators).
  if (req.method === "GET" && path === "/admin/tenant-loop/enrollments") {
    requireAdminReady(state, req);
    return jsonResponse({
      enrollments: state.users.listEnrollments(),
      operators: state.users.listLoopOperators(),
    });
  }

  // Operator management on an enrolled group (co-governance pool; admin + reauth). Matched
  // BEFORE the (groupId, variant) route — "operators" would otherwise parse as a variant.
  const operatorsRoute = path.match(/^\/admin\/tenant-loop\/enrollments\/([^/]+)\/operators$/);
  if (operatorsRoute && req.method === "PUT") {
    const caller = requireAdminReady(state, req);
    await requireAdminReauth(state, req);
    const groupId = decodeURIComponent(operatorsRoute[1]);
    if (!state.users.getGroupRecord(groupId)) throw new HttpError(404, "not_found");
    const body = (await readJsonBody(req)) as Record<string, unknown>;
    const principals = Array.isArray(body.principals) ? (body.principals as string[]) : [];
    const old = state.users.listLoopOperators(groupId).map((o) => o.principal);
    state.users.setLoopOperators(groupId, principals);
    state.audit.record(
      caller.principal,
      "tenant.loop.operators.set",
      groupId,
      `old=${JSON.stringify(old)} new=${JSON.stringify(state.users.listLoopOperators(groupId).map((o) => o.principal))}`,
    );
    return jsonResponse({ operators: state.users.listLoopOperators(groupId) });
  }

  const enrollmentRoute = path.match(/^\/admin\/tenant-loop\/enrollments\/([^/]+)\/([^/]+)$/);
  if (enrollmentRoute && (req.method === "PUT" || req.method === "DELETE")) {
    const caller = requireAdminReady(state, req);
    await requireAdminReauth(state, req); // amendment C: enrollment PUT/DELETE = admin + reauth only
    const groupId = decodeURIComponent(enrollmentRoute[1]);
    const variant = validateEnrollmentVariant(decodeURIComponent(enrollmentRoute[2]));
    const old = state.users.getEnrollment(groupId, variant);

    if (req.method === "PUT") {
      const body = (await readJsonBody(req)) as Record<string, unknown>;
      const status = body.status === "suspended" ? "suspended" : "active";
      if (body.status !== undefined && body.status !== "active" && body.status !== "suspended") {
        throw new HttpError(400, "status must be 'active' or 'suspended'");
      }
      // Catalog membership is checked here (routes have the cfg catalog); the store checks
      // shape — INCLUDING the complete four-key scopes and full windows object: a partial
      // body is a 400, never a silent default fill (the export is fail-closed; its inputs
      // must not be improvised either).
      if (variant !== "*" && !state.cfg.variants.includes(variant)) throw new HttpError(400, "invalid_variant");
      const scopes: LoopScopes = validateLoopScopes(body.scopes ?? {}) as LoopScopes;
      const windows: LoopWindows = validateLoopWindows(body.windows);
      const gitRemote = typeof body.gitRemote === "string" && body.gitRemote.trim() ? body.gitRemote.trim() : null;
      // Operators are optionally seeded on enrollment (full replace); the dedicated surface
      // is PUT .../operators.
      const enrollment = state.users.setEnrollment(groupId, variant, { status, scopes, windows, gitRemote });
      if (Array.isArray(body.operators)) state.users.setLoopOperators(groupId, body.operators as string[]);
      state.audit.record(
        caller.principal,
        "tenant.loop.enrollment.set",
        `${groupId}/${variant}`,
        `old=${old ? JSON.stringify({ status: old.status, scopes: old.scopes, windows: old.windows, gitRemote: old.gitRemote }) : "null"} ` +
          `new=${JSON.stringify({ status: enrollment.status, scopes: enrollment.scopes, windows: enrollment.windows, gitRemote: enrollment.gitRemote })}`,
      );
      // Export trigger: enrollment changes rewrite the registry (round-2 amendment C).
      const exported = exportTenantLoopRegistry(state);
      return jsonResponse({ enrollment, export: exported });
    }

    // DELETE
    if (!old) throw new HttpError(404, "not_found");
    state.users.deleteEnrollment(groupId, variant);
    state.audit.record(
      caller.principal,
      "tenant.loop.enrollment.removed",
      `${groupId}/${variant}`,
      `old=${JSON.stringify({ status: old.status, scopes: old.scopes, windows: old.windows, gitRemote: old.gitRemote })}`,
    );
    const exported = exportTenantLoopRegistry(state);
    return jsonResponse({ removed: true, export: exported });
  }

  // GET /admin/tenant-loop/preview?groupId=&variant= — resolved coverage for ONE enrollment
  // (requireAdminReady, the same posture as the other admin reads). Tenants are listed when
  // the named (groupId, variant) is among the covering enrollments; the resolution runs
  // against ALL active enrollments so the scopes/windows shown are the true strictest-wins
  // result. Window-unrepresentable intersections surface their explicit reason here.
  if (req.method === "GET" && path === "/admin/tenant-loop/preview") {
    requireAdminReady(state, req);
    const groupId = url.searchParams.get("groupId");
    const variant = url.searchParams.get("variant");
    if (!groupId || variant === null) throw new HttpError(400, "groupId and variant are required");
    if (!state.users.getGroupRecord(groupId)) throw new HttpError(404, "not_found");
    validateEnrollmentVariant(variant);
    const enrollments = state.users.listEnrollments();
    const groupMemberships = groupMembershipsOf(state);
    const tenants = state.registry
      .list()
      .map((rec) => {
        const resolution = resolveEnrollment(rec, enrollments, groupMemberships);
        const base = { tenantId: rec.tenantId, owner: rec.ownerPrincipal ?? "anonymous", variant: rec.variant };
        if (!resolution.covered) {
          return { ...base, covered: false, reason: resolution.reason, detail: resolution.detail };
        }
        if (!resolution.coveringGroups.includes(groupId)) return null; // not this enrollment's business
        return {
          ...base,
          covered: true,
          scopes: resolution.scopes,
          windows: resolution.windows,
          gitRemote: resolution.gitRemote,
          coveringGroups: resolution.coveringGroups,
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
    return jsonResponse({ groupId, variant, tenants });
  }

  const loopTenantRoute = path.match(/^\/admin\/tenant-loop\/tenants\/([^/]+)\/(register|suspend|deregister|upgrade)$/);
  if (loopTenantRoute) {
    const tenantId = decodeURIComponent(loopTenantRoute[1]);
    const op = loopTenantRoute[2];
    const removed = removedRouteResponse(req.method, path, op);
    if (removed) return removed; // register/suspend/deregister: no per-tenant loop state exists post-v4

    if (req.method === "POST" && op === "upgrade") {
      const rec = state.registry.get(tenantId);
      if (!rec) throw new HttpError(404, `tenant ${tenantId} not found`);
      // Coverage first: an uncovered tenant is refused (409) BEFORE any ACL decision, so the
      // co-governance gate below only ever sees a real covering-group set (QA-S2 shape: a
      // caller can never widen the governing set by naming groups — the set is derived from
      // the store, not from the body).
      const resolution = resolveEnrollment(rec, state.users.listEnrollments(), groupMembershipsOf(state));
      if (!resolution.covered) {
        throw new HttpError(409, `tenant-loop ${op} refused: ${resolution.detail}`, resolution.reason);
      }
      const body = (await readJsonBody(req).catch(() => ({}))) as Record<string, unknown>;
      assertTenantLoopAllowed(state, req, "upgrade", resolution.coveringGroups);
      const result = await evaluateTenantUpgrade(state, rec, { confirm: body.confirm === true });
      return jsonResponse("execution" in result ? result.execution : result.plan);
    }
  }

  const removed = removedRouteResponse(req.method, path);
  if (removed) return removed;

  throw new HttpError(404, `no route: ${req.method} ${path}`);
}

function groupMembershipsOf(state: GatewayState): Array<{ groupId: string; principals: string[] }> {
  const grouped = new Map<string, string[]>();
  for (const m of state.users.groupMembershipList()) {
    const list = grouped.get(m.groupId);
    if (list) list.push(m.principal);
    else grouped.set(m.groupId, [m.principal]);
  }
  return [...grouped.entries()].map(([groupId, principals]) => ({ groupId, principals }));
}
