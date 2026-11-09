/**
 * Admin console (design docs/designs/2026-11-09-gw-admin-console-design.md §11): migration v3 on a
 * v2 database, strictest-wins group policy, policy enforcement in access.ts, API-key callers
 * ignoring group policy, suspension, the bulk/CSV/group/tenant admin routes, audit coverage,
 * /auth/me effective budget, and the /admin page gate for a must-change admin.
 * Fixtures live under mkdtemp-style absolute tmpdir roots only.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { deleteTenantData } from "../../services/co-workspace/src/lifecycle";
import { deleteUserWithTenants } from "../../services/co-workspace/src/routes/admin/users";
import type { GatewayConfig } from "../../services/co-workspace/src/config";
import { handleRequest } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";
import { MIGRATION_STEPS, MigrationDowngradeError, runMigrations } from "../../services/co-workspace/src/migrations";
import { UserStore } from "../../services/co-workspace/src/users";
import type { UserRecord } from "../../services/co-workspace/src/users";
import { HttpError } from "../../services/co-workspace/src/http";
import { resolveEffectivePolicy, effectivePolicyFor, validateGroupPolicy } from "../../services/co-workspace/src/policy";
import {
  assertProvisioningAllowed,
  assertQuota,
  assertTenantCap,
  callerPolicyFor,
  callerPrincipal,
  isReservedLoginId,
} from "../../services/co-workspace/src/access";
import { csvCell, guardAdminTargets } from "../../services/co-workspace/src/routes/admin/shared";
import { principalFromEmail } from "../../services/co-workspace/src/users";

const ADMIN_PW = "console-admin-pass-1"; // test fixture credential, local only
const USER_PW = "console-user-pass-1";
const FIXTURE_KEY = "console-test-key";

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

function scratch(name: string): string {
  const dir = join(tmpdir(), `gw-admin-console-${name}-${crypto.randomUUID().slice(0, 8)}`);
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

/** A full gateway state over scratch dirs. Two variants so the allowlist can narrow. */
function makeState(name: string, env: Record<string, string> = {}): GatewayState {
  const state = createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch(name),
      CO_WORKSPACE_WORKSPACE_DIR: scratch(`${name}-ws`),
      CO_WORKSPACE_VARIANTS: "co-consult,co-develop",
      ...env,
    }),
  );
  for (const store of [state.registry, state.turns, state.users, state.audit]) CLOSEABLE.push(store);
  return state;
}

/** Principal = the email local part (principalFromEmail), so `alice` is loginId `alice`. */
function makeUser(state: GatewayState, principal: string, opts: { role?: "user" | "admin"; password?: string } = {}): UserRecord {
  const user = state.users.createUser({
    email: `${principal}@example.test`,
    name: principal,
    password: opts.password ?? USER_PW,
    role: opts.role ?? "user",
  });
  if (!user) throw new Error(`fixture: could not create ${principal}`);
  if (user.principal !== principal) throw new Error(`fixture: expected principal ${principal}, got ${user.principal}`);
  return user;
}

function sessionFor(state: GatewayState, user: UserRecord): string {
  return state.users.createSession(user.id);
}

interface SendOpts {
  method?: string;
  token?: string;
  body?: unknown;
  raw?: string;
  contentType?: string;
  adminPassword?: string;
  apiKey?: string;
  csrf?: boolean;
}

/** Full request pipeline (handleRequest): every gate, the error mapping, and the routes. */
function send(state: GatewayState, path: string, opts: SendOpts = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (opts.csrf !== false) headers["x-requested-with"] = "co-workspace";
  if (opts.token) headers.cookie = `gw_session=${opts.token}`;
  if (opts.adminPassword !== undefined) headers["x-admin-password"] = opts.adminPassword;
  if (opts.apiKey) headers["x-api-key"] = opts.apiKey;
  let body: string | undefined;
  if (opts.raw !== undefined) {
    body = opts.raw;
    headers["content-type"] = opts.contentType ?? "text/csv";
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

function catchOf(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    return err as HttpError;
  }
  throw new Error("expected the call to throw");
}

/** A session-less request carrying an API key (the caller is its label, not a user). */
function apiKeyRequest(): Request {
  return new Request("http://x/sessions", { method: "POST", headers: { "x-api-key": FIXTURE_KEY } });
}

/** Fixture for the API-key tests: the key file maps FIXTURE_KEY to the label `alice`. */
function apiKeyEnv(name: string): Record<string, string> {
  const dir = scratch(`${name}-keys`);
  const file = join(dir, "api.keys");
  writeFileSync(file, `${FIXTURE_KEY}:alice\n`);
  return { CO_WORKSPACE_API_KEYS_FILE: file };
}

const cfgBase: GatewayConfig = loadConfig({ CO_WORKSPACE_VARIANTS: "co-consult,co-develop" });

// ── Migration v3 ──────────────────────────────────────────────────────────────

describe("migration v3 (admin console schema)", () => {
  test("a v2 database keeps its loop groups as kind='loop' with members and data intact", () => {
    const dataDir = scratch("mig-v2");
    const dbDir = join(dataDir, "tenants");
    mkdirSync(dbDir, { recursive: true });
    const dbPath = join(dbDir, "users.db");

    // Build a genuine v2 database: the base tables UserStore creates, then migrations 1..2 only.
    const db = new Database(dbPath);
    db.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
      password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT
    );`);
    db.exec(`CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);`);
    runMigrations(db, MIGRATION_STEPS.filter((s) => s.version <= 2));
    db.exec(`INSERT INTO users (id, email, name, principal, role, created_at) VALUES ('u-alice', 'alice@example.test', 'Alice', 'alice', 'user', '2026-11-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO groups (group_id, name, loop_config) VALUES ('loop-a', 'Loop A', '{"designatedUsers":["alice"]}')`);
    db.exec(`INSERT INTO user_groups (group_id, principal) VALUES ('loop-a', 'alice')`);
    expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(2);
    db.close();

    const store = new UserStore(dataDir);
    CLOSEABLE.push(store);

    const group = store.getGroupRecord("loop-a");
    expect(group?.kind).toBe("loop");
    expect(group?.policy).toBeNull();
    expect(group?.memberCount).toBe(1);
    expect(store.listMembers("loop-a")).toEqual(["alice"]);
    expect(store.getGroup("loop-a")?.designatedUsers).toEqual(["alice"]);
    expect(store.findByPrincipal("alice")?.name).toBe("Alice");
  });

  test("a fresh database reaches v3, and re-opening it is a no-op", () => {
    const dataDir = scratch("mig-fresh");
    const first = new UserStore(dataDir);
    first.close();
    const second = new UserStore(dataDir);
    CLOSEABLE.push(second);
    const raw = new Database(join(dataDir, "tenants", "users.db"));
    expect((raw.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(3);
    raw.close();
    expect(second.listGroupRecords({ kind: "loop" })).toEqual([]);
  });

  test("a database at user_version 4 trips the downgrade guard", () => {
    const dataDir = scratch("mig-downgrade");
    mkdirSync(join(dataDir, "tenants"), { recursive: true });
    const raw = new Database(join(dataDir, "tenants", "users.db"));
    raw.exec("PRAGMA user_version = 4");
    raw.close();
    expect(() => new UserStore(dataDir)).toThrow(MigrationDowngradeError);
  });
});

// ── Strictest-wins policy ─────────────────────────────────────────────────────

describe("strictest-wins group policy (policy.ts)", () => {
  test("with no policy-bearing group, every field equals the cfg value (cfg 0 included)", () => {
    const zero = resolveEffectivePolicy({ ...cfgBase, tenantMaxPerPrincipal: 0, tenantMaxTurns: 0, tenantMaxTokens: 0, principalMaxTokens: 0 }, []);
    expect(zero).toMatchObject({ maxTenants: 0, maxTurns: 0, maxTokens: 0, maxPrincipalTokens: 0, allowedVariants: null });

    const set = resolveEffectivePolicy(
      { ...cfgBase, tenantMaxPerPrincipal: 3, tenantMaxTurns: 10, tenantMaxTokens: 1000, principalMaxTokens: 5000 },
      [],
    );
    expect(set).toMatchObject({ maxTenants: 3, maxTurns: 10, maxTokens: 1000, maxPrincipalTokens: 5000, allowedVariants: null });
  });

  test("a group tightens a cfg limit and reports its source", () => {
    const cfg = { ...cfgBase, tenantMaxTurns: 10 };
    const eff = resolveEffectivePolicy(cfg, [{ groupId: "team-a", policy: { maxTurns: 3 } }]);
    expect(eff.maxTurns).toBe(3);
    expect(eff.sources.maxTurns).toEqual(["team-a"]);
  });

  test("a group cannot loosen a cfg limit", () => {
    const cfg = { ...cfgBase, tenantMaxPerPrincipal: 5 };
    const eff = resolveEffectivePolicy(cfg, [{ groupId: "team-a", policy: { maxTenants: 50 } }]);
    expect(eff.maxTenants).toBe(5);
    expect(eff.sources.maxTenants).toEqual(["cfg"]);
  });

  test("a group sets the limit where cfg is unlimited (0)", () => {
    const eff = resolveEffectivePolicy({ ...cfgBase, tenantMaxTokens: 0 }, [{ groupId: "team-a", policy: { maxTokens: 2 } }]);
    expect(eff.maxTokens).toBe(2);
  });

  test("the minimum across several groups wins", () => {
    const cfg = { ...cfgBase, tenantMaxPerPrincipal: 0 };
    const eff = resolveEffectivePolicy(cfg, [
      { groupId: "g-wide", policy: { maxTenants: 4 } },
      { groupId: "g-tight", policy: { maxTenants: 2 } },
    ]);
    expect(eff.maxTenants).toBe(2);
    expect(eff.sources.maxTenants).toEqual(["g-tight"]);
  });

  test("allowedVariants intersects across groups, and an empty intersection denies every variant", () => {
    const both = resolveEffectivePolicy(cfgBase, [
      { groupId: "g1", policy: { allowedVariants: ["co-consult", "co-develop"] } },
      { groupId: "g2", policy: { allowedVariants: ["co-develop"] } },
    ]);
    expect(both.allowedVariants).toEqual(["co-develop"]);

    const none = resolveEffectivePolicy(cfgBase, [
      { groupId: "g1", policy: { allowedVariants: ["co-develop"] } },
      { groupId: "g2", policy: { allowedVariants: ["co-consult"] } },
    ]);
    expect(none.allowedVariants).toEqual([]);
  });

  test("validateGroupPolicy rejects 0, negatives, non-integers, unknown keys, and unknown variants", () => {
    const rejected: unknown[] = [
      { maxTenants: 0 },
      { maxTurns: -1 },
      { maxTokens: 1.5 },
      { maxTokens: "3" },
      { maxFoo: 1 },
      { allowedVariants: ["co-nope"] },
      { allowedVariants: [] },
    ];
    for (const raw of rejected) {
      expect(catchOf(() => validateGroupPolicy(raw, cfgBase)).message).toBe("invalid_policy");
    }
  });

  test("validateGroupPolicy returns the canonical form (deduplicated variants)", () => {
    expect(validateGroupPolicy({ maxTenants: 2, allowedVariants: ["co-develop", "co-develop"] }, cfgBase)).toEqual({
      maxTenants: 2,
      allowedVariants: ["co-develop"],
    });
  });

  test("effectivePolicyFor: a member gets the tightened limit, a non-member gets cfg exactly", () => {
    const state = makeState("policy-db", { CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL: "5" });
    const alice = makeUser(state, "alice");
    makeUser(state, "bob");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTenants: 1 } });
    state.users.addMembers("team-a", [alice.principal]);
    expect(effectivePolicyFor(state, "alice").maxTenants).toBe(1);
    expect(effectivePolicyFor(state, "bob").maxTenants).toBe(5);
  });
});

// ── Access enforcement ────────────────────────────────────────────────────────

describe("policy enforcement in access.ts", () => {
  test("tenant cap: a group member at maxTenants=1 gets 429 for a second tenant", () => {
    const state = makeState("cap");
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTenants: 1 } });
    state.users.addMembers("team-a", [alice.principal]);
    state.registry.create({ variant: "co-consult", key: "k-cap-1", ownerPrincipal: "alice", description: "first" });

    const sessionReq = new Request("http://x/sessions", { method: "POST", headers: { cookie: `gw_session=${sessionFor(state, alice)}` } });
    const err = catchOf(() => assertTenantCap(state, "alice", callerPolicyFor(state, sessionReq)));
    expect(err.status).toBe(429);
  });

  test("variant allowlist: a group member provisioning a variant outside allowedVariants gets 403 and an audit row", () => {
    const state = makeState("variant");
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { allowedVariants: ["co-consult"] } });
    state.users.addMembers("team-a", [alice.principal]);
    const req = new Request("http://x/sessions", { method: "POST", headers: { cookie: `gw_session=${sessionFor(state, alice)}` } });

    const err = catchOf(() => assertProvisioningAllowed(state, req, "co-develop"));
    expect(err.status).toBe(403);
    expect(err.message).toBe("variant_not_allowed");
    expect(state.audit.query({ action: "tenant.provision.denied" }).entries.some((e) => e.actor === "alice")).toBe(true);
    expect(() => assertProvisioningAllowed(state, req, "co-consult")).not.toThrow();
  });

  test("quota: a group maxTurns=2 blocks a tenant at two sessions; no group leaves it open", () => {
    const state = makeState("quota");
    const alice = makeUser(state, "alice");
    const rec = state.registry.create({ variant: "co-consult", key: "k-quota", ownerPrincipal: "alice", description: "q" });
    rec.sessions = 2;
    state.registry.upsert(rec);

    expect(() => assertQuota({ ...cfgBase, quotaWindow: "lifetime" }, rec, undefined, effectivePolicyFor(state, "alice"))).not.toThrow();

    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTurns: 2 } });
    state.users.addMembers("team-a", [alice.principal]);
    const err = catchOf(() => assertQuota({ ...cfgBase, quotaWindow: "lifetime" }, rec, undefined, effectivePolicyFor(state, "alice")));
    expect(err.status).toBe(429);
  });

  test("an archived tenant refuses quota (turn) checks with 409 tenant_archived", () => {
    const state = makeState("archived-quota");
    const rec = state.registry.create({ variant: "co-consult", key: "k-arch", ownerPrincipal: "alice", description: "a" });
    rec.archivedAt = new Date().toISOString();
    state.registry.upsert(rec);
    const err = catchOf(() => assertQuota({ ...cfgBase, quotaWindow: "lifetime" }, rec));
    expect(err.status).toBe(409);
    expect(err.code).toBe("tenant_archived");
  });

  test("loop-group consumers see only kind='loop' groups; general groups stay out of getGroup/listGroups", () => {
    const state = makeState("loop-filter");
    state.users.upsertGroup({ groupId: "loop-a", name: "Loop A", designatedUsers: [] });
    const general = state.users.createGroup({ groupId: "team-a", name: "Team A" });
    expect(general.kind).toBe("general");
    expect(state.users.listGroups().map((g) => g.groupId)).toEqual(["loop-a"]);
    expect(state.users.getGroup("team-a")).toBeUndefined();
  });
});

// ── API-key callers (gap a) ───────────────────────────────────────────────────

describe("API-key callers are bound by their label's group policy (review M3)", () => {
  test("a key labelled like a user principal gets that user's group limits, same as the session user", () => {
    const state = makeState("apikey-policy", { ...apiKeyEnv("apikey-policy"), CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL: "9" });
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTenants: 1, allowedVariants: ["co-consult"] } });
    state.users.addMembers("team-a", [alice.principal]);

    const keyPolicy = callerPolicyFor(state, apiKeyRequest());
    expect(keyPolicy.maxTenants).toBe(1);
    expect(keyPolicy.allowedVariants).toEqual(["co-consult"]);

    const sessionReq = new Request("http://x/sessions", { method: "POST", headers: { cookie: `gw_session=${sessionFor(state, alice)}` } });
    expect(callerPolicyFor(state, sessionReq).maxTenants).toBe(1);
  });

  test("API-key provisioning is narrowed by the label's group, and its tenant cap is tightened", () => {
    const state = makeState("apikey-gate", apiKeyEnv("apikey-gate"));
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTenants: 1, allowedVariants: ["co-consult"] } });
    state.users.addMembers("team-a", [alice.principal]);
    state.registry.create({ variant: "co-consult", key: "k-key-1", ownerPrincipal: "alice", description: "one" });
    state.registry.create({ variant: "co-consult", key: "k-key-2", ownerPrincipal: "alice", description: "two" });

    const denied = catchOf(() => assertProvisioningAllowed(state, apiKeyRequest(), "co-develop"));
    expect(denied.status).toBe(403);
    expect(denied.message).toBe("variant_not_allowed");
    expect(() => assertProvisioningAllowed(state, apiKeyRequest(), "co-consult")).not.toThrow();
    expect(catchOf(() => assertTenantCap(state, "alice", callerPolicyFor(state, apiKeyRequest()))).status).toBe(429);
  });

  test("a request with no credential keeps the cfg limits", () => {
    const state = makeState("anon-policy", { CO_WORKSPACE_TENANT_MAX_PER_PRINCIPAL: "9" });
    makeUser(state, "alice");
    const anon = new Request("http://x/sessions", { method: "POST" });
    expect(callerPolicyFor(state, anon).maxTenants).toBe(9);
  });
});

describe("a key whose label is a suspended or deleted principal carries no identity (review M2)", () => {
  test("callerPrincipal is null once the account is suspended, and null again once it is deleted", () => {
    const state = makeState("m2-blocked", apiKeyEnv("m2-blocked"));
    const alice = makeUser(state, "alice");
    expect(callerPrincipal(state, apiKeyRequest())).toBe("alice");
    expect(state.users.isPrincipalBlocked("alice")).toBe(false);

    state.users.setDisabled([alice.id], true);
    expect(state.users.isPrincipalBlocked("alice")).toBe(true);
    expect(callerPrincipal(state, apiKeyRequest())).toBeNull();

    state.users.setDisabled([alice.id], false);
    expect(callerPrincipal(state, apiKeyRequest())).toBe("alice");
    state.users.softDeleteUser(alice.id);
    expect(state.users.isPrincipalBlocked("alice")).toBe(true);
    expect(callerPrincipal(state, apiKeyRequest())).toBeNull();
  });

  test("isPrincipalBlocked is false for an unknown principal", () => {
    const state = makeState("m2-unknown");
    expect(state.users.isPrincipalBlocked("nobody-here")).toBe(false);
  });

  test("a blocked key does not fall through to anonymous provisioning, even when anonymous provisioning is on", () => {
    const state = makeState("m2-provision", {
      ...apiKeyEnv("m2-provision"),
      CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
      CO_WORKSPACE_TENANT_MAX_TURNS: "5",
      CO_WORKSPACE_TENANT_MAX_TOKENS: "5000",
      CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "5000",
    });
    const alice = makeUser(state, "alice");
    expect(() => assertProvisioningAllowed(state, apiKeyRequest(), "co-consult")).not.toThrow();
    state.users.setDisabled([alice.id], true);
    const err = catchOf(() => assertProvisioningAllowed(state, apiKeyRequest(), "co-consult"));
    expect(err.status).toBe(403);
    expect(err.message).toBe("account_disabled");
  });
});

// ── Suspension ────────────────────────────────────────────────────────────────

describe("suspension (admin-suspend)", () => {
  test("suspend revokes the user's sessions, login gives 403 account_disabled, a wrong password gives 401", async () => {
    const state = makeState("suspend");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const admin = state.users.findByPrincipal("root-admin")!;
    const adminTok = sessionFor(state, admin);
    const alice = makeUser(state, "alice");
    const aliceTok = sessionFor(state, alice);
    expect(state.users.resolveSession(aliceTok)?.principal).toBe("alice");

    const res = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [alice.id], action: "suspend" } });
    expect(res.status).toBe(200);
    expect((await json(res)).ok).toBe(1);

    expect(state.users.resolveSession(aliceTok)).toBeNull();
    expect(state.users.findByPrincipal("alice")?.disabledAt).toBeTruthy();

    const correct = await send(state, "/auth/login", { body: { loginId: "alice", password: USER_PW } });
    expect(correct.status).toBe(403);
    expect((await json(correct)).error).toBe("account_disabled");

    const wrong = await send(state, "/auth/login", { body: { loginId: "alice", password: "not-the-password" } });
    expect(wrong.status).toBe(401);
  });

  test("activate re-allows login (review M4: with reauth)", async () => {
    const state = makeState("activate");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    state.users.setDisabled([alice.id], true);

    const res = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [alice.id], action: "activate" } });
    expect(res.status).toBe(200);
    const login = await send(state, "/auth/login", { body: { loginId: "alice", password: USER_PW } });
    expect(login.status).toBe(200);
  });

  test("a suspended admin gets 403 on /admin/* API routes", async () => {
    const state = makeState("suspended-admin");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    makeUser(state, "second-admin", { role: "admin", password: ADMIN_PW });
    const second = state.users.findByPrincipal("second-admin")!;
    const secondTok = sessionFor(state, second);
    state.users.setDisabled([second.id], true);
    const res = await send(state, "/admin/users", { token: secondTok });
    expect(res.status).toBe(403);
  });
});

// ── Bulk operations and guards ────────────────────────────────────────────────

describe("bulk operations and guards (admin-users-api)", () => {
  test("bulk suspend without reauth gives 403 and changes nothing", async () => {
    const state = makeState("bulk-noreauth");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    const res = await send(state, "/admin/users/bulk", { token: adminTok, body: { ids: [alice.id], action: "suspend" } });
    expect(res.status).toBe(403);
    expect(state.users.findByPrincipal("alice")?.disabledAt).toBeNull();
  });

  test("more than 500 ids gives 413 payload_too_large", async () => {
    const state = makeState("bulk-413");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const ids = Array.from({ length: 501 }, (_, i) => `ghost-${i}`);
    const res = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids, action: "suspend" } });
    expect(res.status).toBe(413);
  });

  test("bulk with reauth returns per-item results; an unknown id fails alone", async () => {
    const state = makeState("bulk-items");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    const res = await send(state, "/admin/users/bulk", {
      token: adminTok,
      adminPassword: ADMIN_PW,
      body: { ids: [alice.id, "nobody-here"], action: "suspend" },
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.ok).toBe(1);
    expect(body.failed).toEqual([{ id: "nobody-here", error: "not_found" }]);
  });

  test("self-suspend is refused per item with self_lockout", async () => {
    const state = makeState("self-lockout");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const admin = state.users.findByPrincipal("root-admin")!;
    const res = await send(state, "/admin/users/bulk", {
      token: sessionFor(state, admin),
      adminPassword: ADMIN_PW,
      body: { ids: [admin.id], action: "suspend" },
    });
    const body = await json(res);
    expect(body.ok).toBe(0);
    expect(body.failed).toEqual([{ id: admin.id, error: "self_lockout" }]);
    expect(state.users.findByPrincipal("root-admin")?.disabledAt).toBeNull();
  });

  test("last admin: a batch that would drop the active-admin count to zero is refused with last_admin", () => {
    const state = makeState("last-admin");
    const root = makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const caller = makeUser(state, "alice"); // a non-admin caller leaves the root as the only admin
    const result = guardAdminTargets(state, caller, [{ ref: root.id, user: root }], "suspend");
    expect(result.allowed).toEqual([]);
    expect(result.failed).toEqual([{ id: root.id, error: "last_admin" }]);
  });

  test("set-role changes the role and writes an audit record", async () => {
    const state = makeState("set-role");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const second = makeUser(state, "second-admin", { role: "admin", password: ADMIN_PW });
    const res = await send(state, "/admin/users/bulk", {
      token: adminTok,
      adminPassword: ADMIN_PW,
      body: { ids: [second.id], action: "set-role", role: "user" },
    });
    expect((await json(res)).ok).toBe(1);
    expect(state.users.findByPrincipal("second-admin")?.role).toBe("user");
    expect(state.audit.query({ action: "user.set-role" }).entries.some((e) => e.target === "second-admin")).toBe(true);
  });

  test("adding members to a loop group through the general API gives 409 loop_group_readonly", async () => {
    const state = makeState("loop-readonly");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    state.users.upsertGroup({ groupId: "loop-a", name: "Loop A", designatedUsers: [] });

    const add = await send(state, "/admin/groups/loop-a/members", { token: adminTok, body: { principals: [alice.principal] } });
    expect(add.status).toBe(409);
    expect((await json(add)).error).toBe("loop_group_readonly");

    const bulkAdd = await send(state, "/admin/users/bulk", {
      token: adminTok,
      body: { ids: [alice.id], action: "add-group", groupId: "loop-a" },
    });
    expect(bulkAdd.status).toBe(409);

    const del = await send(state, "/admin/groups/loop-a", { method: "DELETE", token: adminTok, adminPassword: ADMIN_PW });
    expect(del.status).toBe(409);
    expect(state.users.getGroup("loop-a")).toBeDefined();
  });

  test("the list filter by status returns suspended users", async () => {
    const state = makeState("list-filter");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    makeUser(state, "bob");
    state.users.setDisabled([alice.id], true);
    const res = await send(state, "/admin/users?status=suspended", { token: adminTok });
    const body = await json(res);
    expect(body.users.map((u: { principal: string }) => u.principal)).toEqual(["alice"]);
  });
});

// ── CSV import and export ─────────────────────────────────────────────────────

describe("CSV export and import (admin-csv)", () => {
  test("csvCell prefixes formula leads and quotes separators, quotes, and newlines", () => {
    // A CR-leading cell is also quoted (it contains a line break), so the prefix is checked
    // as "'" immediately before the lead character rather than at position zero.
    for (const lead of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\tx", "\rx"]) {
      expect(csvCell(lead)).toContain(`'${lead.charAt(0)}`);
    }
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe("");
  });

  test("export escapes formula-leading names and writes an attachment with an audit row", async () => {
    const state = makeState("csv-export");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    state.users.createUser({ email: "evil@example.test", name: "=HYPERLINK(\"http://evil\")", password: null });
    const res = await send(state, "/admin/users/export.csv", { token: adminTok });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("'=HYPERLINK");
    expect(state.audit.query({ action: "user.export" }).entries.length).toBeGreaterThan(0);
  });

  test("import dry run validates, reports duplicates, and writes nothing", async () => {
    const state = makeState("csv-dry");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    makeUser(state, "alice");
    const csv = "loginId,name,role,groups\nnewbie-one,Newbie One,user,\nalice,Alice Again,user,\n";
    const res = await send(state, "/admin/users/import?dryRun=1", { token: adminTok, raw: csv });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.dryRun).toBe(true);
    expect(body.created.map((c: { loginId: string }) => c.loginId)).toEqual(["newbie-one"]);
    expect(body.created[0].tempPassword).toBeUndefined();
    expect(body.skipped.some((s: { loginId: string; error: string }) => s.loginId === "alice" && s.error === "login_taken")).toBe(true);
    expect(state.users.findByLoginId("newbie-one")).toBeNull();
  });

  test("a real import needs reauth and creates a must-change account with a temp password", async () => {
    const state = makeState("csv-real");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const csv = "loginId,name,role,groups\nnewbie-two,Newbie Two,user,\n";

    const denied = await send(state, "/admin/users/import", { token: adminTok, raw: csv });
    expect(denied.status).toBe(403);

    const res = await send(state, "/admin/users/import", { token: adminTok, adminPassword: ADMIN_PW, raw: csv });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(typeof body.created[0].tempPassword).toBe("string");
    expect(state.users.findByLoginId("newbie-two")?.mustChangePassword).toBe(true);
  });

  test("more than 2000 data rows gives 413", async () => {
    const state = makeState("csv-413");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const rows = Array.from({ length: 2001 }, (_, i) => `row-${i},Row ${i},user,`).join("\n");
    const res = await send(state, "/admin/users/import?dryRun=1", { token: adminTok, raw: `loginId,name,role,groups\n${rows}\n` });
    expect(res.status).toBe(413);
  });
});

// ── Groups and tenants ────────────────────────────────────────────────────────

describe("groups and tenants API", () => {
  test("group CRUD, policy validation, and member batches work for a general group", async () => {
    const state = makeState("groups-api");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    makeUser(state, "alice");

    const created = await send(state, "/admin/groups", { token: adminTok, body: { groupId: "ops-team", name: "Ops", policy: { maxTurns: 3 } } });
    expect(created.status).toBe(201);

    const patched = await send(state, "/admin/groups/ops-team", { method: "PATCH", token: adminTok, body: { name: "Operations" } });
    expect((await json(patched)).name).toBe("Operations");

    const badPolicy = await send(state, "/admin/groups/ops-team/policy", { method: "PUT", token: adminTok, adminPassword: ADMIN_PW, body: { maxTenants: 0 } });
    expect(badPolicy.status).toBe(400);
    expect((await json(badPolicy)).error).toBe("invalid_policy");

    const members = await send(state, "/admin/groups/ops-team/members", { token: adminTok, body: { principals: ["alice", "ghost-user"] } });
    expect(await json(members)).toEqual({ added: 1, unknown: ["ghost-user"] });

    const detail = await json(await send(state, "/admin/groups/ops-team", { token: adminTok }));
    expect(detail.members).toEqual(["alice"]);

    const delNoReauth = await send(state, "/admin/groups/ops-team", { method: "DELETE", token: adminTok });
    expect(delNoReauth.status).toBe(403);
    const delOk = await send(state, "/admin/groups/ops-team", { method: "DELETE", token: adminTok, adminPassword: ADMIN_PW });
    expect(delOk.status).toBe(200);
  });

  test("a policy write on a loop group is refused with 409 loop_group_readonly and nothing is stored (review M1)", async () => {
    const state = makeState("loop-policy");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    state.users.upsertGroup({ groupId: "loop-a", name: "Loop A", designatedUsers: [] });
    const res = await send(state, "/admin/groups/loop-a/policy", { method: "PUT", token: adminTok, adminPassword: ADMIN_PW, body: { maxTurns: 4 } });
    expect(res.status).toBe(409);
    expect((await json(res)).error).toBe("loop_group_readonly");
    expect(state.users.getGroupRecord("loop-a")?.policy).toBeNull();
  });

  test("tenant bulk archive and restore need reauth; archive is visible in the list and blocks quota", async () => {
    const state = makeState("tenants-bulk");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const rec = state.registry.create({ variant: "co-consult", key: "k-tenant-bulk", ownerPrincipal: "alice", description: "t" });

    const noReauth = await send(state, "/admin/tenants/bulk", { token: adminTok, body: { ids: [rec.tenantId], action: "archive" } });
    expect(noReauth.status).toBe(403);

    const archived = await send(state, "/admin/tenants/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [rec.tenantId], action: "archive" } });
    expect((await json(archived)).ok).toBe(1);
    expect(state.registry.get(rec.tenantId)?.archivedAt).toBeTruthy();

    const listed = await json(await send(state, "/admin/tenants?owner=alice&status=archived", { token: adminTok }));
    expect(listed.tenants.map((t: { tenantId: string }) => t.tenantId)).toContain(rec.tenantId);

    const restored = await send(state, "/admin/tenants/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [rec.tenantId], action: "restore" } });
    expect((await json(restored)).ok).toBe(1);
    expect(state.registry.get(rec.tenantId)?.archivedAt ?? null).toBeNull();
    expect(state.audit.query({ action: "tenant.archive" }).entries.length).toBeGreaterThan(0);
    expect(state.audit.query({ action: "tenant.restore" }).entries.length).toBeGreaterThan(0);
  });

  test("every mutation writes an audit record", async () => {
    const state = makeState("audit-trail");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");

    await send(state, "/admin/groups", { token: adminTok, body: { groupId: "ops-team", name: "Ops" } });
    await send(state, "/admin/groups/ops-team/members", { token: adminTok, body: { principals: ["alice"] } });
    await send(state, "/admin/groups/ops-team/policy", { method: "PUT", token: adminTok, adminPassword: ADMIN_PW, body: { maxTenants: 2 } });
    await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [alice.id], action: "suspend" } });
    await send(state, "/admin/users/export.csv", { token: adminTok });

    for (const action of ["group.create", "group.member.add", "group.policy.update", "user.suspend", "user.export", "user.bulk.suspend"]) {
      expect(state.audit.query({ action }).entries.length, action).toBeGreaterThan(0);
    }
  });
});

// ── /auth/me and the /admin page (gaps b and c) ───────────────────────────────

describe("/auth/me effective budget", () => {
  test("a group policy tightens the reported principal budget; with no policy it is the cfg value", async () => {
    const state = makeState("auth-me", { CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "5000" });
    const alice = makeUser(state, "alice");
    const tok = sessionFor(state, alice);

    const plain = await json(await send(state, "/auth/me", { token: tok, method: "GET" }));
    expect(plain.budget).toEqual({ maxTokens: 5000 });

    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxPrincipalTokens: 1000 } });
    state.users.addMembers("team-a", [alice.principal]);
    const grouped = await json(await send(state, "/auth/me", { token: tok, method: "GET" }));
    expect(grouped.budget).toEqual({ maxTokens: 1000 });
  });
});

describe("GET /admin page gate for a must-change admin", () => {
  test("a must-change admin is redirected to / (not a JSON 403), and /admin/* stays gated", async () => {
    const state = makeState("must-change");
    const admin = makeUser(state, "temp-admin", { role: "admin", password: ADMIN_PW });
    state.users.createTempPassword(admin.id);
    const tok = sessionFor(state, state.users.findByPrincipal("temp-admin")!);
    expect(state.users.resolveSession(tok)?.mustChangePassword).toBe(true);

    const page = await send(state, "/admin", { token: tok, method: "GET" });
    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/");

    const api = await send(state, "/admin/users", { token: tok, method: "GET" });
    expect(api.status).toBe(403);
    expect((await json(api)).error).toContain("password change required");

    const shell = await send(state, "/", { token: tok, method: "GET" });
    expect(shell.status).toBe(200);
  });

  test("a password-set admin receives the page, and a plain user is redirected to /", async () => {
    const state = makeState("page-access");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const adminPage = await send(state, "/admin", { token: adminTok, method: "GET" });
    expect(adminPage.status).toBe(200);
    expect(adminPage.headers.get("content-type")).toContain("text/html");

    const alice = makeUser(state, "alice");
    const userPage = await send(state, "/admin", { token: sessionFor(state, alice), method: "GET" });
    expect(userPage.status).toBe(302);
    expect(userPage.headers.get("location")).toBe("/");
  });

  test("a non-GET admin request without the SEC-09 header is refused even with an API key", async () => {
    const state = makeState("csrf-admin", apiKeyEnv("csrf-admin"));
    const res = await send(state, "/admin/users/bulk", { apiKey: FIXTURE_KEY, csrf: false, body: { ids: ["x"], action: "suspend" } });
    expect(res.status).toBe(403);
    expect((await json(res)).error).toContain("CSRF guard");
  });
});

// ── 2026-11-09 security review remediation: one regression test per item ──────

describe("review H1: data.bak snapshots are gitignored", () => {
  test("the root .gitignore ignores services/co-workspace/data.bak-*/", () => {
    const gitignore = readFileSync(join(import.meta.dir, "..", "..", ".gitignore"), "utf8");
    expect(gitignore.split(/\r?\n/)).toContain("services/co-workspace/data.bak-*/");
  });
});

describe("review M1: loop groups carry no policy", () => {
  test("effectivePolicyFor ignores a loop group's policy even when one is stored directly", () => {
    const state = makeState("m1-effective");
    makeUser(state, "alice");
    state.users.upsertGroup({ groupId: "loop-a", name: "Loop A", designatedUsers: ["alice"] });
    state.users.setGroupPolicy("loop-a", { maxTurns: 1 });
    const eff = effectivePolicyFor(state, "alice");
    expect(eff.maxTurns).toBe(state.cfg.tenantMaxTurns);
    expect(eff.sources.maxTurns).not.toContain("loop-a");
  });
});

describe("review M4: reauth on membership and policy changes", () => {
  test("bulk remove-group, member removal, and policy writes need the password; adding members does not", async () => {
    const state = makeState("m4-reauth");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    state.users.createGroup({ groupId: "team-a", name: "Team A", policy: { maxTurns: 5 } });

    const addNoReauth = await send(state, "/admin/groups/team-a/members", { token: adminTok, body: { principals: ["alice"] } });
    expect(addNoReauth.status).toBe(200);

    const bulkNo = await send(state, "/admin/users/bulk", { token: adminTok, body: { ids: [alice.id], action: "remove-group", groupId: "team-a" } });
    expect(bulkNo.status).toBe(403);
    const memberNo = await send(state, "/admin/groups/team-a/members", { method: "DELETE", token: adminTok, body: { principals: ["alice"] } });
    expect(memberNo.status).toBe(403);
    const policyNo = await send(state, "/admin/groups/team-a/policy", { method: "PUT", token: adminTok, body: { maxTurns: 2 } });
    expect(policyNo.status).toBe(403);
    expect(state.users.listMembers("team-a")).toEqual(["alice"]);
    expect(state.users.getGroupRecord("team-a")?.policy).toEqual({ maxTurns: 5 });

    const bulkYes = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [alice.id], action: "remove-group", groupId: "team-a" } });
    expect((await json(bulkYes)).ok).toBe(1);
    expect(state.users.listMembers("team-a")).toEqual([]);

    const policyYes = await send(state, "/admin/groups/team-a/policy", { method: "PUT", token: adminTok, adminPassword: ADMIN_PW, body: { maxTurns: 2 } });
    expect(policyYes.status).toBe(200);
    expect(state.users.getGroupRecord("team-a")?.policy).toEqual({ maxTurns: 2 });
  });
});

describe("review M5: CSV import hashing, row cap, and audit", () => {
  test("a real import is capped at 200 rows (413) and creates nothing; a dry run may still validate 201", async () => {
    const state = makeState("m5-cap");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const rows = Array.from({ length: 201 }, (_, i) => `row-${i},Row ${i},user,`).join("\n");
    const csv = `loginId,name,role,groups\n${rows}\n`;

    const real = await send(state, "/admin/users/import", { token: adminTok, adminPassword: ADMIN_PW, raw: csv });
    expect(real.status).toBe(413);
    expect(state.users.findByLoginId("row-0")).toBeNull();

    const dry = await send(state, "/admin/users/import?dryRun=1", { token: adminTok, raw: csv });
    expect(dry.status).toBe(200);
    expect((await json(dry)).created.length).toBe(201);
  });

  test("the real import issues temp passwords through the async path, never the sync hasher", async () => {
    const state = makeState("m5-async");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    state.users.createTempPassword = () => {
      throw new Error("sync hashing must not run on import");
    };
    const res = await send(state, "/admin/users/import", {
      token: adminTok,
      adminPassword: ADMIN_PW,
      raw: "loginId,name,role,groups\nnewbie-d,D,user,\n",
    });
    expect(res.status).toBe(200);
    expect(typeof (await json(res)).created[0].tempPassword).toBe("string");
  });

  test("a failure part-way through still writes the user.import audit row with skipped count and reasons", async () => {
    const state = makeState("m5-audit");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    makeUser(state, "alice");
    let calls = 0;
    const realIssue = state.users.createTempPasswordAsync.bind(state.users);
    state.users.createTempPasswordAsync = async (id: string) => {
      calls += 1;
      if (calls === 2) throw new Error("simulated hash failure");
      return realIssue(id);
    };
    const csv = "loginId,name,role,groups\nnewbie-a,A,user,\nalice,Alice,user,\nnewbie-b,B,user,\nnewbie-c,C,user,\n";
    const res = await send(state, "/admin/users/import", { token: adminTok, adminPassword: ADMIN_PW, raw: csv });
    expect(res.status).toBe(500);
    const row = state.audit.query({ action: "user.import" }).entries[0];
    expect(row).toBeDefined();
    expect(row.detail).toContain("created=1");
    expect(row.detail).toContain("skipped=1");
    expect(row.detail).toContain("reasons=login_taken:1");
    expect(row.detail).toContain("error=Error");
  });
});

describe("review L1: last-admin re-check before the soft delete", () => {
  test("deleting the only active admin is refused before any side effect", async () => {
    const state = makeState("l1-last");
    const root = makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    state.registry.create({ variant: "co-consult", key: "k-l1-last", ownerPrincipal: "root-admin", description: "r" });
    const err = await deleteUserWithTenants(state, root, "archive", "system").then(
      () => null,
      (e: HttpError) => e,
    );
    expect(err?.message).toBe("last_admin");
    expect(state.users.findByPrincipal("root-admin")).not.toBeNull();
    expect(state.registry.list().find((t) => t.ownerPrincipal === "root-admin")?.archivedAt).toBeFalsy();
  });

  test("with a second active admin the same delete goes through", async () => {
    const state = makeState("l1-two");
    const root = makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    makeUser(state, "second-admin", { role: "admin", password: ADMIN_PW });
    const result = await deleteUserWithTenants(state, root, "archive", "system");
    expect(result.errors).toEqual([]);
    expect(state.users.findByPrincipal("root-admin")).toBeNull();
    expect(state.users.countActiveAdmins()).toBe(1);
  });
});

describe("review L3: stored group policy is re-validated on read", () => {
  test("non-positive, non-numeric, and malformed fields are dropped when the row is loaded", () => {
    const state = makeState("l3-policy");
    state.users.createGroup({ groupId: "team-a", name: "Team A" });
    const raw = new Database(join(state.cfg.dataDir, "tenants", "users.db"));
    raw
      .query("UPDATE groups SET policy = ? WHERE group_id = ?")
      .run(JSON.stringify({ maxTurns: 0, maxTenants: -2, maxTokens: "9", maxPrincipalTokens: 5, allowedVariants: "co-consult" }), "team-a");
    raw.close();
    expect(state.users.getGroupRecord("team-a")?.policy).toEqual({ maxPrincipalTokens: 5 });
  });
});

describe("review L4: migration v3 tolerates only duplicate-column errors", () => {
  test("a v2 database whose v3 columns already exist migrates cleanly", () => {
    const db = new Database(":memory:");
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
      password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT,
      login_id TEXT, email_hash TEXT, verified_at TEXT, must_change_password INTEGER, temp_password_expires TEXT, disabled_at TEXT);`);
    db.exec(`CREATE TABLE groups (group_id TEXT PRIMARY KEY, name TEXT NOT NULL, loop_config TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'loop', policy TEXT, description TEXT, created_at TEXT);`);
    db.exec("CREATE TABLE user_groups (group_id TEXT NOT NULL, principal TEXT NOT NULL, PRIMARY KEY (group_id, principal));");
    db.exec("PRAGMA user_version = 2");
    expect(runMigrations(db)).toBe(1);
    expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(3);
    db.close();
  });

  test("any other ALTER failure is rethrown", () => {
    const db = new Database(":memory:");
    db.exec("PRAGMA user_version = 2");
    expect(() => runMigrations(db)).toThrow(/no such table/);
    db.close();
  });
});

describe("review L6: no-store on credential responses, export headers, reauth rate limit", () => {
  test("the CSV export sends nosniff and no-store", async () => {
    const state = makeState("l6-export");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const res = await send(state, "/admin/users/export.csv", { token: adminTok });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("a temp-password reset response sends no-store", async () => {
    const state = makeState("l6-reset");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    const res = await send(state, `/admin/users/${alice.id}/reset-password`, { method: "POST", token: adminTok, adminPassword: ADMIN_PW });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  test("repeated wrong re-confirmations exhaust the per-account budget, which then refuses even the right password", async () => {
    const state = makeState("l6-ratelimit");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    for (let i = 0; i < 10; i += 1) {
      const wrong = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: "wrong-guess-1", body: { ids: [alice.id], action: "suspend" } });
      expect(wrong.status).toBe(403);
    }
    const locked = await send(state, "/admin/users/bulk", { token: adminTok, adminPassword: ADMIN_PW, body: { ids: [alice.id], action: "suspend" } });
    expect(locked.status).toBe(429);
    expect(state.users.findByPrincipal("alice")?.disabledAt).toBeNull();
  });
});

describe("review L8: user archive sets archivedAt", () => {
  test("a user delete with the archive disposition marks the owned tenant archived with archivedAt", async () => {
    const state = makeState("l8-archive");
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const alice = makeUser(state, "alice");
    const rec = state.registry.create({ variant: "co-consult", key: "k-l8", ownerPrincipal: "alice", description: "a" });
    const res = await send(state, `/admin/users/${alice.id}`, { method: "DELETE", token: adminTok, adminPassword: ADMIN_PW });
    expect(res.status).toBe(200);
    const stored = state.registry.get(rec.tenantId);
    expect(stored?.status).toBe("archived");
    expect(stored?.archivedAt).toBeTruthy();
  });
});

describe("review L9: project directory must sit inside the tenant folder", () => {
  test("a tampered projectDir is refused before any removal and the outside directory survives", async () => {
    const state = makeState("l9-projectdir");
    const outside = scratch("l9-outside");
    writeFileSync(join(outside, "keep.txt"), "keep");
    const rec = state.registry.create({ variant: "co-consult", key: "k-l9", ownerPrincipal: "alice", description: "t" });
    rec.projectDir = outside;
    state.registry.upsert(rec);
    const err = await deleteTenantData(state, state.registry.get(rec.tenantId)!, "root-admin").then(
      () => null,
      (e: HttpError) => e,
    );
    expect(err?.status).toBe(500);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
    expect(state.registry.get(rec.tenantId)).toBeTruthy();
  });
});

describe("namespace reservation: login IDs and key labels share one principal namespace", () => {
  test("isReservedLoginId covers reserved words, the account-ID shape, and configured key labels", () => {
    const state = makeState("ns-helper", apiKeyEnv("ns-helper"));
    for (const value of ["anonymous", "Default", "SYSTEM", "u-0123456789ab", "U-0123456789AB", "alice"]) {
      expect(isReservedLoginId(state.cfg, value), value).toBe(true);
    }
    for (const value of ["newbie", "u-0123456789a", "u-0123456789abc", "alicia"]) {
      expect(isReservedLoginId(state.cfg, value), value).toBe(false);
    }
    expect(isReservedLoginId(state.cfg, principalFromEmail("Anonymous@example.test"))).toBe(true);
  });

  test("signup refuses a reserved login ID with 409 and creates no account", async () => {
    const state = makeState("ns-signup");
    const res = await send(state, "/auth/signup", { body: { loginId: "anonymous", email: "anon@example.test", password: "long-enough-pass" } });
    expect(res.status).toBe(409);
    expect(state.users.findByLoginId("anonymous")).toBeNull();
  });

  test("CSV import skips reserved names in a dry run, and a real import creates none of them", async () => {
    const state = makeState("ns-csv", apiKeyEnv("ns-csv"));
    makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
    const adminTok = sessionFor(state, state.users.findByPrincipal("root-admin")!);
    const csv = "loginId,name,role,groups\nsystem,S,user,\nanonymous,A,user,\nu-0123456789ab,U,user,\nalice,Al,user,\n";
    const dry = await json(await send(state, "/admin/users/import?dryRun=1", { token: adminTok, raw: csv }));
    expect(dry.created).toEqual([]);
    expect(dry.skipped.map((s: { error: string }) => s.error)).toEqual(["reserved_login", "reserved_login", "reserved_login", "reserved_login"]);

    const real = await json(await send(state, "/admin/users/import", { token: adminTok, adminPassword: ADMIN_PW, raw: csv }));
    expect(real.created).toEqual([]);
    expect(state.users.findByLoginId("system")).toBeNull();
  });
});
