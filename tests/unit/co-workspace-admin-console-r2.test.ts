/**
 * Admin console ROUND 2 (design docs/designs/2026-11-09-gw-admin-console-round2-plan.md,
 * "2026-11-09 unit-model amendment" — review-ratified C requirements): the policies API
 * (CRUD, group-only assignments, reauth matrix, inline-assignment 409, audits with old+new),
 * server-generated group ids (ASCII slug / g-<8hex> fallback / dedupe / reserved-principal
 * guard / field-specific errors), the v4 delete cascades (group-id-reuse inheritance
 * escalation), and the export triggers (enrollment changes, member changes, tenant delete
 * paths). Fixtures live under absolute tmpdir roots only (T-20261104-003 discipline).
 *
 * @version 1.0.0 (2026-11-11): initial suite.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { handleRequest } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";
import type { UserRecord } from "../../services/co-workspace/src/users";
import { slugifyGroupName } from "../../services/co-workspace/src/routes/admin/groups";
import { tenantLoopRegistryPath } from "../../services/co-workspace/src/tenant-loop";
import type { GroupPolicy } from "../../services/co-workspace/src/policy";

const ADMIN_PW = "round2-admin-pass-1"; // test fixture credential, local only

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

function scratch(name: string): string {
  const dir = join(tmpdir(), `gw-admin-r2-${name}-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  ROOTS.push(dir);
  return dir;
}

afterAll(() => {
  for (const handle of CLOSEABLE) {
    try {
      handle.close();
    } catch {
      /* best effort */
    }
  }
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function makeState(name: string): GatewayState {
  const state = createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch(name),
      CO_WORKSPACE_WORKSPACE_DIR: scratch(`${name}-ws`),
      CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
    }),
  );
  for (const store of [state.registry, state.turns, state.users, state.audit]) CLOSEABLE.push(store);
  return state;
}

function makeUser(state: GatewayState, principal: string, opts: { role?: "user" | "admin"; password?: string | null } = {}): UserRecord {
  const user = state.users.createUser({
    email: `${principal}@example.test`,
    name: principal,
    password: opts.password ?? null,
    role: opts.role ?? "user",
  });
  if (!user) throw new Error(`fixture: could not create ${principal}`);
  return user;
}

function adminSession(state: GatewayState): { token: string; principal: string } {
  let admin = state.users.listUsers().find((u) => u.role === "admin" && !u.deletedAt);
  if (!admin) admin = makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
  return { token: state.users.createSession(admin.id), principal: admin.principal };
}

interface SendOpts {
  method?: string;
  token?: string;
  body?: unknown;
  raw?: string;
  adminPassword?: string;
  csrf?: boolean;
}

/** Full request pipeline (handleRequest): every gate, the error mapping, and the routes. */
function send(state: GatewayState, path: string, opts: SendOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.csrf !== false) headers["x-requested-with"] = "co-workspace";
  if (opts.token) headers.cookie = `gw_session=${opts.token}`;
  if (opts.adminPassword !== undefined) headers["x-admin-password"] = opts.adminPassword;
  let body: string | undefined;
  if (opts.raw !== undefined) {
    body = opts.raw;
    headers["content-type"] = "text/csv";
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers["content-type"] = "application/json";
  }
  const method = opts.method ?? (body !== undefined ? "POST" : "GET");
  return handleRequest(state, new Request(`http://x${path}`, { method, headers, body }));
}

async function json(res: Response): Promise<any> {
  return res.json();
}

// ── Policies API (CRUD, group-only assignments, reauth matrix, audits) ───────

describe("policies API (round-2 amendment C)", () => {
  test("create (no reauth) → list with assignment counts → get with assignments", async () => {
    const state = makeState("pol-crud");
    const admin = adminSession(state);
    const created = await send(state, "/admin/policies", {
      token: admin.token,
      body: { name: "Team limits", description: "tight", limits: { maxTenants: 2, maxTurns: 5, maxTokens: 1000, maxPrincipalTokens: 5000, allowedVariants: ["co-consult"] } },
    });
    expect(created.status).toBe(201);
    const { policy } = await json(created);
    expect(policy.name).toBe("Team limits");
    expect(policy.limits).toEqual({ maxTenants: 2, maxTurns: 5, maxTokens: 1000, maxPrincipalTokens: 5000, allowedVariants: ["co-consult"] });
    expect(policy.assignmentCount).toBe(0);
    expect(policy.policyId).toMatch(/^p-[0-9a-f]{12}$/);

    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    const assigned = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });
    expect(assigned.status).toBe(200);

    const list = await json(await send(state, "/admin/policies", { token: admin.token }));
    expect(list.policies).toHaveLength(1);
    expect(list.policies[0].assignmentCount).toBe(1);

    const detail = await json(await send(state, `/admin/policies/${policy.policyId}`, { token: admin.token }));
    expect(detail.assignments).toEqual([{ policyId: policy.policyId, targetKind: "group", targetId: "team-a" }]);
  });

  test("inline assignment payloads on create → 409 assignments_not_allowed_on_create (create first, then assign under reauth)", async () => {
    const state = makeState("pol-inline");
    const admin = adminSession(state);
    for (const payload of [
      { name: "P", limits: {}, assignments: [{ kind: "group", id: "g" }] },
      { name: "P", limits: {}, targets: [{ kind: "group", id: "g" }] },
    ]) {
      const res = await send(state, "/admin/policies", { token: admin.token, body: payload });
      expect(res.status).toBe(409);
      const body = await json(res);
      expect(body.error).toBe("assignments_not_allowed_on_create");
      expect(body.pointer).toBe("/admin/policies/:id/assignments");
    }
    expect(state.users.listPolicies()).toEqual([]);
  });

  test("PATCH records old+new limits and needs reauth; name conflicts → 409; DELETE cascades assignments", async () => {
    const state = makeState("pol-mutations");
    const admin = adminSession(state);
    const { policy } = await json(
      await send(state, "/admin/policies", { token: admin.token, body: { name: "Original", limits: { maxTurns: 5 } } }),
    );
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });

    const noReauth = await send(state, `/admin/policies/${policy.policyId}`, { method: "PATCH", token: admin.token, body: { limits: { maxTurns: 2 } } });
    expect(noReauth.status).toBe(403);
    const patched = await send(state, `/admin/policies/${policy.policyId}`, {
      method: "PATCH",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { limits: { maxTurns: 2 }, name: "Renamed" },
    });
    expect(patched.status).toBe(200);
    expect((await json(patched)).policy.limits).toEqual({ maxTurns: 2 });

    const update = state.audit.query({ action: "policy.update" }).entries[0];
    expect(update.detail).toContain("old=");
    expect(update.detail).toContain('"maxTurns":5');
    expect(update.detail).toContain('"maxTurns":2');

    // Duplicate name → 409 conflict.
    const dupe = await send(state, "/admin/policies", { token: admin.token, body: { name: "Renamed", limits: {} } });
    expect(dupe.status).toBe(409);
    const dupePatch = await send(state, `/admin/policies/${policy.policyId}`, {
      method: "PATCH",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { name: "Other" },
    });
    expect(dupePatch.status).toBe(200);

    // DELETE cascades the assignment in one transaction.
    const del = await send(state, `/admin/policies/${policy.policyId}`, { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(del.status).toBe(200);
    expect(state.users.getPolicy(policy.policyId)).toBeUndefined();
    expect(state.users.listAssignments(policy.policyId)).toEqual([]);
    expect(state.audit.query({ action: "policy.delete" }).entries[0].detail).toContain("assignments=1");
  });

  test("assignments are GROUP-ONLY: unknown group → 404, user-shaped bodies rejected, duplicate → 409; unassign audited", async () => {
    const state = makeState("pol-assign");
    const admin = adminSession(state);
    const { policy } = await json(await send(state, "/admin/policies", { token: admin.token, body: { name: "P", limits: {} } }));
    makeUser(state, "alice");

    const unknown = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "ghost" },
    });
    expect(unknown.status).toBe(404);

    const targetsShape = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { targets: [{ kind: "user", id: "alice" }] },
    });
    expect(targetsShape.status).toBe(400);

    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    const ok = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });
    expect(ok.status).toBe(200);
    const dup = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "POST",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });
    expect(dup.status).toBe(409);

    const unassign = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "DELETE",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });
    expect(unassign.status).toBe(200);
    expect(state.audit.query({ action: "policy.unassign" }).entries[0].detail).toBe("group=team-a");
    const unassignMissing = await send(state, `/admin/policies/${policy.policyId}/assignments`, {
      method: "DELETE",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { groupId: "team-a" },
    });
    expect(unassignMissing.status).toBe(404);
  });

  test("the DDL pins group-only targets: a target_kind='user' row is refused by the CHECK constraint", () => {
    const state = makeState("pol-ddl");
    state.users.createPolicy({ name: "P", limits: {} });
    const raw = new Database(join(state.cfg.dataDir, "tenants", "users.db"));
    expect(() =>
      raw.query("INSERT INTO policy_assignments (policy_id, target_kind, target_id) VALUES ((SELECT policy_id FROM policies LIMIT 1), 'user', 'u-alice')").run(),
    ).toThrow(/CHECK/);
    raw.close();
  });

  test("invalid policy bodies → 400 invalid_policy (limits validated at the route with the catalog)", async () => {
    const state = makeState("pol-validate");
    const admin = adminSession(state);
    for (const limits of [{ maxTenants: 0 }, { maxTurns: -1 }, { maxFoo: 1 }, { allowedVariants: ["co-nope"] }, { allowedVariants: [] }]) {
      const res = await send(state, "/admin/policies", { token: admin.token, body: { name: `P-${JSON.stringify(limits)}`, limits } });
      expect(res.status, JSON.stringify(limits)).toBe(400);
      expect((await json(res)).error).toBe("invalid_policy");
    }
    const badName = await send(state, "/admin/policies", { token: admin.token, body: { name: "", limits: {} } });
    expect(badName.status).toBe(400);
    expect((await json(badName)).error).toBe("invalid_name");
  });
});

// ── Group creation: server-generated slugs + field-specific errors ───────────

describe("group create: ASCII slugs, fallbacks, dedupe, reserved guard (round-2 §1)", () => {
  test("slugifyGroupName: transliteration, collapsing, trimming, length clamp", () => {
    expect(slugifyGroupName("Ops Team")).toBe("ops-team");
    expect(slugifyGroupName("Café Reviewers")).toBe("cafe-reviewers"); // NFKD: é → e + combining mark dropped
    expect(slugifyGroupName("  --Weird__Name!!--  ")).toBe("weird-name");
    expect(slugifyGroupName("서울 팀")).toBe(""); // fully non-ASCII → empty → caller falls back
    expect(slugifyGroupName("A".repeat(60))).toBe("a".repeat(40));
  });

  test("a Korean name falls back to g-<8hex>; an ASCII name becomes its slug; both dedupe with numeric suffixes", async () => {
    const state = makeState("group-slug");
    const admin = adminSession(state);

    const korean = await send(state, "/admin/groups", { token: admin.token, body: { name: "서울 팀", description: "Seoul" } });
    expect(korean.status).toBe(201);
    const koreanBody = await json(korean);
    expect(koreanBody.groupId).toMatch(/^g-[0-9a-f]{8}$/);

    const ascii = await send(state, "/admin/groups", { token: admin.token, body: { name: "Ops Team" } });
    expect(ascii.status).toBe(201);
    expect((await json(ascii)).groupId).toBe("ops-team");

    // Same name again → the slug collides → numeric suffix (and so does the hex fallback).
    const ascii2 = await send(state, "/admin/groups", { token: admin.token, body: { name: "Ops Team" } });
    expect(ascii2.status).toBe(201);
    expect((await json(ascii2)).groupId).toBe("ops-team-2");
    const korean2 = await send(state, "/admin/groups", { token: admin.token, body: { name: "서울 팀" } });
    expect(korean2.status).toBe(201);
    const korean2Body = await json(korean2);
    expect(korean2Body.groupId).toMatch(/^g-[0-9a-f]{8}$/);
    expect(korean2Body.groupId).not.toBe(koreanBody.groupId);
  });

  test("the reserved-principal guard suffixes a slug that would claim a reserved word or key label", async () => {
    const state = makeState("group-reserved");
    const admin = adminSession(state);
    const res = await send(state, "/admin/groups", { token: admin.token, body: { name: "System" } });
    expect(res.status).toBe(201);
    expect((await json(res)).groupId).toBe("system-2"); // "system" reserved → suffixed
  });

  test("explicit groupId stays accepted for API callers; conflicts and bad shapes are field-specific", async () => {
    const state = makeState("group-explicit");
    const admin = adminSession(state);
    const created = await send(state, "/admin/groups", { token: admin.token, body: { groupId: "ops-team", name: "Ops" } });
    expect(created.status).toBe(201);
    expect((await json(created)).groupId).toBe("ops-team");

    const conflict = await send(state, "/admin/groups", { token: admin.token, body: { groupId: "ops-team", name: "Ops again" } });
    expect(conflict.status).toBe(409);
    expect(await json(conflict)).toEqual({ error: "conflict", field: "groupId" });

    const badId = await send(state, "/admin/groups", { token: admin.token, body: { groupId: "Not A Slug", name: "Ops" } });
    expect(badId.status).toBe(400);
    expect(await json(badId)).toEqual({ error: "invalid_group_id", field: "groupId" });

    const noName = await send(state, "/admin/groups", { token: admin.token, body: { groupId: "ops-2" } });
    expect(noName.status).toBe(400);
    expect(await json(noName)).toEqual({ error: "invalid_name", field: "name" });

    const inlinePolicy = await send(state, "/admin/groups", { token: admin.token, body: { name: "Ops3", policy: { maxTurns: 3 } } });
    expect(inlinePolicy.status).toBe(400);
    const inlineBody = await json(inlinePolicy);
    expect(inlineBody.error).toBe("policy_not_allowed_on_create");
    expect(inlineBody.pointer).toBe("/admin/policies");
  });

  test("group-id reuse is clean: the recreated id inherits nothing (cascade proof)", async () => {
    const state = makeState("group-reuse");
    const admin = adminSession(state);
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "*", { status: "active", scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false }, windows: { tz: "UTC", days: [1], start: "09:00", end: "17:00" }, gitRemote: null });
    state.users.setLoopOperators("team-a", ["alice"]);
    const { policy } = await json(await send(state, "/admin/policies", { token: admin.token, body: { name: "Old limits", limits: { maxTenants: 1 } } }));
    state.users.assignPolicy(policy.policyId, "team-a");

    const del = await send(state, "/admin/groups/team-a", { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(del.status).toBe(200);
    // Everything keyed on the group id is gone.
    expect(state.users.listEnrollments("team-a")).toEqual([]);
    expect(state.users.listLoopOperators("team-a")).toEqual([]);
    expect(state.users.listAssignments(policy.policyId)).toEqual([]);

    // Recreate the same id: no inherited enrollment, operators, or policy.
    state.users.createGroup({ groupId: "team-a", name: "Team A anew" });
    expect(state.users.listEnrollments("team-a")).toEqual([]);
    expect(state.users.listLoopOperators("team-a")).toEqual([]);
    expect(state.users.policyAssignmentsFor("alice")).toEqual([]);
  });

  test("user delete (both dispositions) drops the principal's loop_operator rows (cascade)", async () => {
    const state = makeState("user-cascade");
    const admin = adminSession(state);
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.addMembers("team-a", [alice.principal]);
    state.users.setLoopOperators("team-a", [alice.principal]);

    const del = await send(state, `/admin/users/${alice.id}`, { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(del.status).toBe(200);
    expect(state.users.listLoopOperators()).toEqual([]); // the reused principal inherits no grants
  });
});

// ── Export triggers (round-2 amendment C) ────────────────────────────────────

describe("export triggers", () => {
  function exportTenantIds(state: GatewayState): string[] {
    const path = tenantLoopRegistryPath(state.cfg.workspaceDir);
    if (!existsSync(path)) return [];
    return ((JSON.parse(readFileSync(path, "utf8")) as { tenants: Array<{ id: string }> }).tenants ?? []).map((t) => t.id);
  }

  test("enrollment PUT/DELETE, member add/remove, and tenant deletes rewrite the registry", async () => {
    const state = makeState("export-triggers");
    const admin = adminSession(state);
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });

    // Member add on an enrolled group pulls the member's tenant into the export.
    state.users.setEnrollment("team-a", "*", {
      status: "active",
      scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
      windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
      gitRemote: null,
    });
    const rec = state.registry.create({ variant: "co-consult", ownerPrincipal: alice.principal, name: "proj" });
    expect(exportTenantIds(state)).toEqual([]); // alice not yet a member
    await send(state, "/admin/groups/team-a/members", { token: admin.token, body: { principals: [alice.principal] } });
    expect(exportTenantIds(state)).toEqual([rec.tenantId]); // member-add trigger

    await send(state, "/admin/groups/team-a/members", { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW, body: { principals: [alice.principal] } });
    expect(exportTenantIds(state)).toEqual([]); // member-remove trigger

    // Enrollment PUT re-covers; DELETE uncovers.
    await send(state, "/admin/tenant-loop/enrollments/team-a/*", {
      method: "PUT",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: {
        scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
        windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
        operators: [alice.principal],
      },
    });
    // Member add through the ROUTE (the route is the trigger; store-level adds do not write).
    await send(state, "/admin/groups/team-a/members", { token: admin.token, body: { principals: [alice.principal] } });
    expect(exportTenantIds(state)).toEqual([rec.tenantId]); // enrollment PUT + member-add triggers
    await send(state, "/admin/tenant-loop/enrollments/team-a/*", { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(exportTenantIds(state)).toEqual([]); // enrollment DELETE trigger

    // Tenant bulk delete + archive rewrite the export.
    state.users.setEnrollment("team-a", "*", {
      status: "active",
      scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
      windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
      gitRemote: null,
    });
    const rec2 = state.registry.create({ variant: "co-consult", ownerPrincipal: alice.principal, name: "proj2" });
    mkdirSync(rec2.projectDir, { recursive: true }); // deleteTenantData removes the tree
    const bulkDelete = await send(state, "/admin/tenants/bulk", {
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { ids: [rec2.tenantId], action: "delete" },
    });
    expect(bulkDelete.status).toBe(200);
    // The delete path trigger rewrote the export: rec2 is gone, rec (still covered) remains.
    expect(exportTenantIds(state)).toEqual([rec.tenantId]);

    const rec3 = state.registry.create({ variant: "co-consult", ownerPrincipal: alice.principal, name: "proj3" });
    const bulkArchive = await send(state, "/admin/tenants/bulk", {
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { ids: [rec3.tenantId], action: "archive" },
    });
    expect(bulkArchive.status).toBe(200);
    // The archive trigger rewrote the export (archived tenants are still covered — archive is
    // a quota/turns concept, not a loop one; the write is the asserted effect).
    expect(exportTenantIds(state).sort()).toEqual([rec.tenantId, rec3.tenantId].sort());
  });

  test("the group-delete route also refreshes the export (a deleted group covers nothing)", async () => {
    const state = makeState("export-group-delete");
    const admin = adminSession(state);
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "*", {
      status: "active",
      scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
      windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
      gitRemote: null,
    });
    const rec = state.registry.create({ variant: "co-consult", ownerPrincipal: alice.principal, name: "proj" });
    // Member add via the route — the trigger that first writes the export.
    await send(state, "/admin/groups/team-a/members", { token: admin.token, body: { principals: [alice.principal] } });
    expect(exportTenantIds(state)).toEqual([rec.tenantId]);
    await send(state, "/admin/groups/team-a", { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(exportTenantIds(state)).toEqual([]);
  });

  test("the CSV import's member adds trigger the export (re-onboarding re-covers a tenant)", async () => {
    const state = makeState("export-csv-import");
    const admin = adminSession(state);
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "*", {
      status: "active",
      scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
      windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
      gitRemote: null,
    });
    // A tenant whose owner principal has no account yet: the CSV import is the re-onboarding
    // path that restores the group membership — and with it the coverage. Before the import
    // the tenant is uncovered, so no export row exists (QA round-2 S2: the import's
    // member-add loop previously never called the export writer).
    const rec = state.registry.create({ variant: "co-consult", ownerPrincipal: "rejoin", name: "rejoin-proj" });
    expect(exportTenantIds(state)).toEqual([]);
    const csv = "loginId,name,role,groups\nrejoin,Rejoin,user,team-a\n";
    const res = await send(state, "/admin/users/import", { token: admin.token, adminPassword: ADMIN_PW, raw: csv });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.created.map((c: { loginId: string }) => c.loginId)).toEqual(["rejoin"]);
    expect(exportTenantIds(state)).toEqual([rec.tenantId]); // the import's member-add trigger
  });

  test("the owner's own tenant DELETE triggers the export (the covered row leaves)", async () => {
    const state = makeState("export-owner-delete");
    const admin = adminSession(state);
    const alice = makeUser(state, "alice", { password: "alice-pass-1" });
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.setEnrollment("team-a", "*", {
      status: "active",
      scopes: { upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false },
      windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" },
      gitRemote: null,
    });
    const rec = state.registry.create({ variant: "co-consult", ownerPrincipal: alice.principal, name: "selfdel-proj" });
    mkdirSync(rec.projectDir, { recursive: true }); // deleteTenantData removes the tree
    // Cover the tenant through the member-add route (its own trigger writes the export).
    await send(state, "/admin/groups/team-a/members", { token: admin.token, body: { principals: [alice.principal] } });
    expect(exportTenantIds(state)).toEqual([rec.tenantId]);
    // The owner self-deletes: DELETE /tenants/:id → deleteTenantData, which had NO trigger
    // (only the admin bulk-delete and user-delete paths did). The export is now emitted
    // inside the shared delete implementation, so the covered row leaves.
    const res = await send(state, `/tenants/${rec.tenantId}`, { method: "DELETE", token: state.users.createSession(alice.id) });
    expect(res.status).toBe(200);
    expect(exportTenantIds(state)).toEqual([]); // owner self-delete trigger
  });
});

// ── Reauth matrix residuals (policies + enrollment operator surface) ─────────

describe("reauth matrix residuals", () => {
  test("enrollment operator PUT needs reauth; GET surfaces need none; a GET policy needs none", async () => {
    const state = makeState("r2-reauth");
    const admin = adminSession(state);
    state.users.createGroup({ groupId: "team-a", name: "Team A" });

    const listNoAuth = await send(state, "/admin/tenant-loop/enrollments", { token: admin.token });
    expect(listNoAuth.status).toBe(200);
    const policiesNoAuth = await send(state, "/admin/policies", { token: admin.token });
    expect(policiesNoAuth.status).toBe(200);

    const opsNo = await send(state, "/admin/tenant-loop/enrollments/team-a/operators", {
      method: "PUT",
      token: admin.token,
      body: { principals: ["alice"] },
    });
    expect(opsNo.status).toBe(403);
    const opsYes = await send(state, "/admin/tenant-loop/enrollments/team-a/operators", {
      method: "PUT",
      token: admin.token,
      adminPassword: ADMIN_PW,
      body: { principals: ["alice"] },
    });
    expect(opsYes.status).toBe(200);
    expect(state.users.listLoopOperators("team-a")).toEqual([{ groupId: "team-a", principal: "alice" }]);
    expect(state.audit.query({ action: "tenant.loop.operators.set" }).entries.length).toBe(1);
  });

  test("a named policy assigned to the principal's group drives the effective policy (store-level end-to-end)", () => {
    const state = makeState("r2-e2e");
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    state.users.addMembers("team-a", [alice.principal]);
    const limits: GroupPolicy = { maxTenants: 1, maxTurns: 2, maxTokens: 3000, maxPrincipalTokens: 4000, allowedVariants: ["co-consult"] };
    const policy = state.users.createPolicy({ name: "Team A limits", limits });
    state.users.assignPolicy(policy.policyId, "team-a");
    const assignments = state.users.policyAssignmentsFor(alice.principal);
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ policyId: policy.policyId, policyName: "Team A limits", via: "team-a" });
    // The same policy via a second group yields two sources with distinct via values.
    state.users.createGroup({ groupId: "team-b", name: "Team B" });
    state.users.addMembers("team-b", [alice.principal]);
    state.users.assignPolicy(policy.policyId, "team-b");
    expect(state.users.policyAssignmentsFor(alice.principal).map((a) => a.via).sort()).toEqual(["team-a", "team-b"]);
  });
});
