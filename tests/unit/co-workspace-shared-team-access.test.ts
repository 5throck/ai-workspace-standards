/**
 * Shared-team ACL matrix + create permission + cap/quota resolution (design
 * docs/designs/2026-11-09-gw-shared-teams-design.md §7-§8, D-S5/D-S6, verification table
 * row 3): live group-membership access (member ✓ / non-member ✗ / password-set admin ✓ /
 * passwordless admin ✗ / removed-member-next-request ✗), self-service creation (member ✓,
 * admin ✓, outsider 403, anonymous 403), idempotent creation on the group key, the
 * per-group team cap resolved through the GOVERNING group's policy (personal caps
 * unaffected), and the /auth/me/groups picker feed. Full request pipeline (handleRequest)
 * over an mkdtemp state — absolute tmpdir roots only (T-20261104-003 discipline).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { handleRequest } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";
import type { UserRecord } from "../../services/co-workspace/src/users";
import { effectivePolicyFor } from "../../services/co-workspace/src/policy";
import { sharedTeamKeyFor } from "../../services/co-workspace/src/lifecycle";

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

function makeState(name: string, env: Record<string, string> = {}): GatewayState {
  const root = mkdtempSync(join(tmpdir(), `gw-st-access-${name}-`));
  ROOTS.push(root);
  const state = createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: join(root, "data"),
      CO_WORKSPACE_WORKSPACE_DIR: join(root, "ws"),
      CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
      ...env,
    }),
  );
  for (const store of [state.registry, state.turns, state.users, state.audit]) CLOSEABLE.push(store);
  return state;
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

function send(state: GatewayState, path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-requested-with": "co-workspace" };
  if (opts.token) headers.cookie = `gw_session=${opts.token}`;
  return handleRequest(state, new Request(`http://127.0.0.1${path}`, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }));
}

/** alice + bob in team-a; oscar outside; a password-set admin and a passwordless admin. */
function seededState(name: string): { state: GatewayState; alice: string; bob: string; oscar: string; admin: string; adminId: string; ssoAdmin: string } {
  const state = makeState(name);
  state.users.createGroup({ groupId: "team-a", name: "Team A" });
  const alice = makeUser(state, "alice");
  const bob = makeUser(state, "bob");
  const oscar = makeUser(state, "oscar");
  const admin = makeUser(state, "root-admin", { role: "admin", password: "admin-password-1" });
  const ssoAdmin = makeUser(state, "sso-admin", { role: "admin", password: null });
  state.users.addMembers("team-a", [alice.principal, bob.principal]);
  const aliceToken = state.users.createSession(alice.id);
  const bobToken = state.users.createSession(bob.id);
  const oscarToken = state.users.createSession(oscar.id);
  const adminToken = state.users.createSession(admin.id);
  const ssoAdminToken = state.users.createSession(ssoAdmin.id);
  return { state, alice: aliceToken, bob: bobToken, oscar: oscarToken, admin: adminToken, adminId: admin.id, ssoAdmin: ssoAdminToken };
}

const GROUP = "team-a";

async function createShared(state: GatewayState, token: string, variant = "co-consult") {
  return send(state, "/sessions", { token, body: { variant, name: `shared-${variant}`, group: GROUP } });
}

describe("shared-team ACL (D-S5: live group membership)", () => {
  test("member ✓ / non-member ✗ / password-set admin ✓ / passwordless admin ✗", async () => {
    const s = seededState("acl-matrix");
    const created = await createShared(s.state, s.alice);
    expect(created.status).toBe(202);
    const { tenantId } = (await created.json()) as { tenantId: string };

    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.alice })).status).toBe(200);
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.bob })).status).toBe(200);
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.oscar })).status).toBe(403);
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.admin })).status).toBe(200);
    // A passwordless (bootstrap/SSO) admin keeps only their own access until a password is set.
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.ssoAdmin })).status).toBe(403);
    // No session at all → denied.
    expect((await send(s.state, `/tenants/${tenantId}`)).status).toBe(403);
    // The denial keeps the owner detail out of the client message but in the audit trail.
    const denied = s.state.audit.query({ action: "tenant.access.denied" }).entries;
    expect(denied.some((e) => e.target === tenantId && e.detail.includes("owner=group:team-a"))).toBe(true);
  });

  test("group removal = immediate loss on the next request (live query, no cached grant)", async () => {
    const s = seededState("acl-removal");
    const { tenantId } = await (await createShared(s.state, s.alice)).json() as { tenantId: string };
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.bob })).status).toBe(200);
    s.state.users.removeMembers(GROUP, ["bob"]);
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.bob })).status).toBe(403);
    // The member who stays keeps access.
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.alice })).status).toBe(200);
  });

  test("the team list shows members their groups' shared teams and hides them from outsiders", async () => {
    const s = seededState("acl-listing");
    const { tenantId } = await (await createShared(s.state, s.alice)).json() as { tenantId: string };
    const aliceList = (await (await send(s.state, "/tenants", { token: s.alice })).json()) as { tenants: Array<{ tenantId: string; teamKind: string; ownerGroup: string | null }> };
    expect(aliceList.tenants.some((t) => t.tenantId === tenantId && t.teamKind === "shared" && t.ownerGroup === GROUP)).toBe(true);
    const bobList = (await (await send(s.state, "/tenants", { token: s.bob })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(bobList.tenants.some((t) => t.tenantId === tenantId)).toBe(true);
    const oscarList = (await (await send(s.state, "/tenants", { token: s.oscar })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(oscarList.tenants.some((t) => t.tenantId === tenantId)).toBe(false);
  });

  test("personal teams are unchanged: another member has no access to alice's personal team", async () => {
    const s = seededState("acl-personal");
    const created = await send(s.state, "/sessions", { token: s.alice, body: { variant: "co-consult", name: "solo" } });
    expect(created.status).toBe(202);
    const { tenantId } = (await created.json()) as { tenantId: string };
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.alice })).status).toBe(200);
    expect((await send(s.state, `/tenants/${tenantId}`, { token: s.bob })).status).toBe(403);
  });
});

describe("shared-team create permission + idempotency (D-S5)", () => {
  test("member self-service ✓, admin ✓, outsider 403, anonymous 403, unknown group 404", async () => {
    const s = seededState("create-perm");
    expect((await createShared(s.state, s.alice)).status).toBe(202);
    expect((await send(s.state, "/sessions", { token: s.admin, body: { variant: "co-develop", group: GROUP } })).status).toBe(202);
    const outsider = await createShared(s.state, s.oscar);
    expect(outsider.status).toBe(403);
    expect(((await outsider.json()) as { error: string }).error).toBe("you are not a member of this group");
    expect(s.state.audit.query({ action: "tenant.create.denied" }).entries.some((e) => e.detail.includes("not a member"))).toBe(true);
    // Unauthenticated caller: the provisioning gate (401) refuses before the shared branch.
    expect((await send(s.state, "/sessions", { body: { variant: "co-consult", group: GROUP } })).status).toBe(401);
    expect((await send(s.state, "/sessions", { token: s.alice, body: { variant: "co-consult", group: "no-such-group" } })).status).toBe(404);
    // Attach + shared are mutually exclusive.
    const attach = await send(s.state, "/sessions", { token: s.alice, body: { variant: "co-consult", group: GROUP, attach_dir: "/tmp/x" } });
    expect(attach.status).toBe(400);
    expect(((await attach.json()) as { code: string }).code).toBe("shared_attach_conflict");
  });

  test("idempotent on the group key: a second create returns the SAME team (existing: true)", async () => {
    const s = seededState("create-idempotent");
    const first = await (await createShared(s.state, s.alice)).json() as { tenantId: string };
    const secondResponse = await createShared(s.state, s.bob); // another member, same (group, variant)
    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()) as { tenantId: string; existing: boolean };
    expect(second.existing).toBe(true);
    expect(second.tenantId).toBe(first.tenantId);
    // The record carries the shared shape and the group key.
    const rec = s.state.registry.get(first.tenantId)!;
    expect(rec.teamKind).toBe("shared");
    expect(rec.ownerGroup).toBe(GROUP);
    expect(rec.ownerPrincipal).toBe(`group:${GROUP}`);
    expect(rec.key).toBe(sharedTeamKeyFor("co-consult", GROUP));
    // The user-provided name survives the shared branch (storage folder = the name).
    expect(rec.name).toBe("shared-co-consult");
    // Exactly one team for the (group, variant) — the unique registry key enforced it.
    expect(s.state.registry.list().filter((r) => r.key === rec.key)).toHaveLength(1);
  });

  test("audit: tenant.create names kind=shared owner=<group>", async () => {
    const s = seededState("create-audit");
    const { tenantId } = await (await createShared(s.state, s.alice)).json() as { tenantId: string };
    const entry = s.state.audit.query({ action: "tenant.create" }).entries.find((e) => e.target === tenantId);
    expect(entry?.detail).toContain("kind=shared");
    expect(entry?.detail).toContain(`owner=${GROUP}`);
    expect(entry?.actor).toBe("alice");
  });
});

describe("per-group team cap (D-S6) + quota resolution", () => {
  test("the GOVERNING group's maxTenants caps the group's teams; the member's personal cap is untouched", async () => {
    const s = seededState("cap-group");
    const policy = s.state.users.createPolicy({ name: "Team A limits", limits: { maxTenants: 1 } });
    s.state.users.assignPolicy(policy.policyId, GROUP);

    expect((await createShared(s.state, s.alice, "co-consult")).status).toBe(202);
    // Second shared team for the SAME group (other variant) → 429 against the group cap.
    const second = await createShared(s.state, s.alice, "co-develop");
    expect(second.status).toBe(429);
    expect(((await second.json()) as { error: string }).error).toContain("tenant cap reached (1/1");

    // Personal creation is capped by the member's own (group-inherited) policy counting
    // PERSONAL teams only — the group-owned shared team does not consume alice's budget.
    const personal = await send(s.state, "/sessions", { token: s.alice, body: { variant: "co-consult", name: "solo" } });
    expect(personal.status).toBe(202);

    // Another group with the same policy id-space is unaffected (cap is per owning group).
    s.state.users.createGroup({ groupId: "team-b", name: "Team B" });
    const carol = makeUser(s.state, "carol");
    s.state.users.addMembers("team-b", [carol.principal]);
    const carolToken = state_session(s.state, carol);
    const otherGroup = await send(s.state, "/sessions", { token: carolToken, body: { variant: "co-consult", group: "team-b" } });
    expect(otherGroup.status).toBe(202);
  });

  test("effectivePolicyFor(group:<id>) resolves the group's own policies (D-S6 quota path)", () => {
    const s = seededState("quota-group");
    const tight = s.state.users.createPolicy({ name: "Tight", limits: { maxTurns: 3, maxTokens: 1000 } });
    s.state.users.assignPolicy(tight.policyId, GROUP);
    // The synthetic owner resolves through the owning group's DIRECT assignments.
    const groupPolicy = effectivePolicyFor(s.state, `group:${GROUP}`);
    expect(groupPolicy.maxTurns).toBe(3);
    expect(groupPolicy.maxTokens).toBe(1000);
    expect(groupPolicy.sources).toEqual([{ policyId: tight.policyId, policyName: "Tight", via: GROUP }]);
    // policyAssignmentsForGroup is the store-level source of that resolution.
    expect(s.state.users.policyAssignmentsForGroup(GROUP)).toHaveLength(1);
    expect(s.state.users.policyAssignmentsForGroup("no-such")).toEqual([]);
    // Members not in any policy-bearing group still resolve to the cfg baseline.
    const oscarPolicy = effectivePolicyFor(s.state, "oscar");
    expect(oscarPolicy.maxTurns).toBe(s.state.cfg.tenantMaxTurns);
    expect(oscarPolicy.sources).toEqual([]);
  });
});

describe("GET /auth/me/groups (D-S10 picker feed)", () => {
  test("returns the caller's groups with member rosters; 401 signed out", async () => {
    const s = seededState("me-groups");
    const res = await send(s.state, "/auth/me/groups", { token: s.alice });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { groups: Array<{ groupId: string; name: string; members: string[] }> };
    expect(body.groups).toHaveLength(1);
    expect(body.groups[0].groupId).toBe(GROUP);
    expect(body.groups[0].members).toEqual(["alice", "bob"]);
    // Oscar (no membership) gets an empty list, not an error.
    const oscarRes = await send(s.state, "/auth/me/groups", { token: s.oscar });
    expect(((await oscarRes.json()) as { groups: unknown[] }).groups).toEqual([]);
    expect((await send(s.state, "/auth/me/groups")).status).toBe(401);
  });
});

function state_session(state: GatewayState, user: UserRecord): string {
  return state.users.createSession(user.id);
}
