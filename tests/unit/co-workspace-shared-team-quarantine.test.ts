/**
 * Shared-team QA fixes (2026-11-11 fix wave):
 *  - S2 group-id-reuse quarantine: deleting a general group ARCHIVES its shared teams
 *    (status=archived + archivedAt, audit `tenant.archived.group_deleted`) — a recreated
 *    group with the same id can neither see, list, nor resurrect the old team, and the
 *    create attempt gets a typed 409. Defense in depth: requireTenantAccess denies archived
 *    rows and the member listing (the composer/sidebar source) excludes them.
 *  - S2 shared-branch kind assertion: a registry key held by a non-shared row (hand-seeded
 *    collision) is refused with 409 shared_team_conflict, never silently reused.
 *  - S3 reserved `group:`-prefixed API-key labels: dropped at key-file parse (the key can
 *    never authenticate) with a warn-once; env keys and ordinary labels unaffected.
 *  - S3 registry boot refusal closes the SQLite handle (no leaked -wal/-shm after the
 *    RegistryKeyCollisionError constructor throw — the UserStore pattern).
 * Fixtures: mkdtemp absolute tmpdir roots only (T-20261104-003); handles closed before
 * rmSync. Provisioning is awaited before quarantining so background failure cannot race
 * the status assertion.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, readKeyEntries, isReservedPrincipalLabel } from "../../services/co-workspace/src/config";
import { credentialValid, principalFor } from "../../services/co-workspace/src/auth";
import { handleRequest } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";
import { quarantineGroupSharedTeams } from "../../services/co-workspace/src/lifecycle";
import { TenantRegistry } from "../../services/co-workspace/src/registry-db";
import { REGISTRY_MIGRATION_STEPS, RegistryKeyCollisionError, runMigrations } from "../../services/co-workspace/src/migrations";
import type { UserRecord } from "../../services/co-workspace/src/users";

const ADMIN_PW = "quarantine-admin-pass-1"; // test fixture credential, local only

const ROOTS: string[] = [];
const CLOSEABLE: Array<{ close(): void }> = [];

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

function makeState(name: string, env: Record<string, string> = {}): GatewayState {
  const root = mkdtempSync(join(tmpdir(), `gw-st-quarantine-${name}-`));
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

function send(state: GatewayState, path: string, opts: { method?: string; token?: string; body?: unknown; adminPassword?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-requested-with": "co-workspace" };
  if (opts.token) headers.cookie = `gw_session=${opts.token}`;
  if (opts.adminPassword !== undefined) headers["x-admin-password"] = opts.adminPassword;
  return handleRequest(state, new Request(`http://127.0.0.1${path}`, { method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"), headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }));
}

/** A password-set admin (full admin powers incl. reauth-confirmed deletes). */
function seededAdmin(state: GatewayState): { token: string } {
  const admin = makeUser(state, "root-admin", { role: "admin", password: ADMIN_PW });
  return { token: state.users.createSession(admin.id) };
}

/** Wait out the background provisioning promise so a later archive is not overwritten by a
 * late `status = "failed"` write (the create route returns 202 while provisioning runs). */
async function settleProvisioning(state: GatewayState, tenantId: string): Promise<void> {
  await state.provisioning.get(tenantId);
}

describe("S2: group-delete quarantine of shared teams (group-id reuse)", () => {
  test("deleting a group archives its shared team; the recreated id inherits nothing", async () => {
    const state = makeState("quarantine-flow");
    const admin = seededAdmin(state);
    state.users.createGroup({ groupId: "acme", name: "Acme" });
    const alice = makeUser(state, "alice", { password: "alice-pass-1" });
    state.users.addMembers("acme", [alice.principal]);
    const aliceToken = state.users.createSession(alice.id);

    const created = await send(state, "/sessions", { token: aliceToken, body: { variant: "co-consult", name: "acme-consult", group: "acme" } });
    expect(created.status).toBe(202);
    const { tenantId } = (await created.json()) as { tenantId: string };
    await settleProvisioning(state, tenantId);

    // Admin deletes the group (reauth-confirmed console route).
    const del = await send(state, "/admin/groups/acme", { method: "DELETE", token: admin.token, adminPassword: ADMIN_PW });
    expect(del.status).toBe(200);

    // The team is QUARANTINED, not deleted: archived shape + the audit row.
    const rec = state.registry.get(tenantId)!;
    expect(rec.archivedAt).toBeTruthy();
    expect(rec.status).toBe("archived");
    expect(rec.teamKind).toBe("shared");
    expect(rec.ownerGroup).toBe("acme");
    const audit = state.audit.query({ action: "tenant.archived.group_deleted" }).entries;
    expect(audit.some((e) => e.target === tenantId && e.detail?.includes("group=acme"))).toBe(true);

    // No member path reaches the old team any more — the archived gate precedes both the
    // admin bypass and the membership check (typed 409, the quota-refusal code).
    const detail = await send(state, `/tenants/${tenantId}`, { token: aliceToken });
    expect(detail.status).toBe(409);
    expect(((await detail.json()) as { code: string }).code).toBe("tenant_archived");
    expect((await send(state, `/tenants/${tenantId}`, { token: admin.token })).status).toBe(409);
    expect((await send(state, `/tenants/${tenantId}/chat`, { token: aliceToken, body: { message: "hello" } })).status).toBe(409);

    // Recreate the SAME group id with a NEW member: the old team is invisible in the
    // member listing (the composer/sidebar source) and unreachable by id.
    state.users.createGroup({ groupId: "acme", name: "Acme anew" });
    const carol = makeUser(state, "carol", { password: "carol-pass-1" });
    state.users.addMembers("acme", [carol.principal]);
    const carolToken = state.users.createSession(carol.id);
    const carolList = (await (await send(state, "/tenants", { token: carolToken })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(carolList.tenants.some((t) => t.tenantId === tenantId)).toBe(false);
    expect((await send(state, `/tenants/${tenantId}`, { token: carolToken })).status).toBe(409);

    // The create attempt for the reused id cannot resurrect the old team either: the key is
    // still held by the archived row → typed 409, no access to old data, no fresh aliasing.
    const resurrect = await send(state, "/sessions", { token: carolToken, body: { variant: "co-consult", group: "acme" } });
    expect(resurrect.status).toBe(409);
    expect(((await resurrect.json()) as { code: string }).code).toBe("tenant_archived");
    // The registry still holds exactly one row for the group key — the archived one.
    expect(state.registry.list().filter((r) => r.teamKind === "shared" && r.ownerGroup === "acme")).toHaveLength(1);
  });

  test("quarantine helper is idempotent and audits only newly archived rows", () => {
    const state = makeState("quarantine-idempotent");
    state.users.createGroup({ groupId: "team-q", name: "Team Q" });
    const a = state.registry.create({ variant: "co-consult", key: "co-consult::group:team-q", ownerPrincipal: "group:team-q", teamKind: "shared", ownerGroup: "team-q", name: "q-a" });
    const b = state.registry.create({ variant: "co-develop", key: "co-develop::group:team-q", ownerPrincipal: "group:team-q", teamKind: "shared", ownerGroup: "team-q", name: "q-b" });
    b.status = "archived";
    b.archivedAt = new Date().toISOString();
    state.registry.upsert(b);

    const first = quarantineGroupSharedTeams(state, "team-q", "root-admin");
    expect(first.map((r) => r.tenantId)).toEqual([a.tenantId]);
    expect(state.registry.get(a.tenantId)?.archivedAt).toBeTruthy();
    expect(state.registry.get(a.tenantId)?.status).toBe("archived");
    expect(state.audit.query({ action: "tenant.archived.group_deleted" }).entries).toHaveLength(1);

    // Second pass: nothing left to archive, no duplicate audit rows.
    expect(quarantineGroupSharedTeams(state, "team-q", "root-admin")).toEqual([]);
    expect(state.audit.query({ action: "tenant.archived.group_deleted" }).entries).toHaveLength(1);
    // Other groups' teams and personal rows are untouched.
    expect(quarantineGroupSharedTeams(state, "no-such-group", "root-admin")).toEqual([]);
  });
});

describe("S2: shared-branch kind assertion in getOrStartTenant", () => {
  test("a personal row holding the group key is refused with 409 shared_team_conflict (no reuse)", async () => {
    const state = makeState("kind-collision");
    state.users.createGroup({ groupId: "team-b", name: "Team B" });
    const member = makeUser(state, "dana", { password: "dana-pass-1" });
    state.users.addMembers("team-b", [member.principal]);
    const token = state.users.createSession(member.id);
    // Hand-seeded collision: a PERSONAL (legacy/corrupted) row occupies the group key.
    state.registry.create({ variant: "co-consult", key: "co-consult::group:team-b", ownerPrincipal: "mallory", name: "squatter" });

    const res = await send(state, "/sessions", { token, body: { variant: "co-consult", group: "team-b" } });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { code: string }).code).toBe("shared_team_conflict");
    // The squatter row is untouched and no shared row was created over it.
    const rows = state.registry.list().filter((r) => r.key === "co-consult::group:team-b");
    expect(rows).toHaveLength(1);
    expect(rows[0].teamKind ?? "personal").not.toBe("shared");
    expect(rows[0].ownerPrincipal).toBe("mallory");
  });
});

describe("S2: archived teams leave the member listing (composer/sidebar source)", () => {
  test("GET /tenants excludes archived rows for members and admins alike", async () => {
    const state = makeState("listing-exclude");
    state.users.createGroup({ groupId: "team-c", name: "Team C" });
    const member = makeUser(state, "erin", { password: "erin-pass-1" });
    state.users.addMembers("team-c", [member.principal]);
    const token = state.users.createSession(member.id);
    const created = await send(state, "/sessions", { token, body: { variant: "co-consult", group: "team-c" } });
    expect(created.status).toBe(202);
    const { tenantId } = (await created.json()) as { tenantId: string };

    const before = (await (await send(state, "/tenants", { token })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(before.tenants.some((t) => t.tenantId === tenantId)).toBe(true);

    // Admin archives it (console bulk archive shape) — it now vanishes from every listing.
    const rec = state.registry.get(tenantId)!;
    rec.archivedAt = new Date().toISOString();
    state.registry.upsert(rec);
    const after = (await (await send(state, "/tenants", { token })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(after.tenants.some((t) => t.tenantId === tenantId)).toBe(false);
    const admin = seededAdmin(state);
    const adminList = (await (await send(state, "/tenants", { token: admin.token })).json()) as { tenants: Array<{ tenantId: string }> };
    expect(adminList.tenants.some((t) => t.tenantId === tenantId)).toBe(false);
  });
});

describe("S3: `group:`-prefixed API-key labels are reserved", () => {
  test("isReservedPrincipalLabel: the group-owner namespace is refused, ordinary labels pass", () => {
    expect(isReservedPrincipalLabel("group:x")).toBe(true);
    expect(isReservedPrincipalLabel("Group:x")).toBe(true); // case-insensitive namespace
    expect(isReservedPrincipalLabel("group:")).toBe(true);
    expect(isReservedPrincipalLabel("alice")).toBe(false);
    expect(isReservedPrincipalLabel("groupie")).toBe(false); // prefix, not the reserved token
    expect(isReservedPrincipalLabel(undefined)).toBe(false);
  });

  test("a key-file entry with a group:-prefixed label or spoke-id is dropped; other keys unaffected", () => {
    const root = mkdtempSync(join(tmpdir(), "gw-st-quarantine-keys-"));
    ROOTS.push(root);
    const keyFile = join(root, "keys.txt");
    writeFileSync(keyFile, [
      "# comment",
      "sk-reserved:group:x",
      "sk-good:alice",
      "sk-spoked:carol,,group:y",
      "sk-plain",
    ].join("\n"));

    // Parse level: the reserved entries never surface (label AND spoke-id both checked).
    const entries = readKeyEntries(keyFile);
    expect(entries.map((e) => e.key).sort()).toEqual(["sk-good", "sk-plain"]);

    // Boot/config level (the operator's key path): the refused keys cannot authenticate.
    const cfg = loadConfig({ CO_WORKSPACE_API_KEYS_FILE: keyFile, CO_WORKSPACE_VARIANTS: "co-consult" });
    expect(cfg.apiKeys).toContain("sk-good");
    expect(cfg.apiKeys).toContain("sk-plain");
    expect(cfg.apiKeys).not.toContain("sk-reserved");
    expect(cfg.apiKeys).not.toContain("sk-spoked");
    expect(credentialValid(cfg, "sk-reserved")).toBe(false);
    expect(credentialValid(cfg, "sk-spoked")).toBe(false);
    expect(credentialValid(cfg, "sk-good")).toBe(true);
    // Principal resolution: the surviving label resolves normally; the refused key maps no
    // principal (and could never mint the synthetic group-owner principal).
    expect(principalFor(cfg, "sk-good")).toBe("alice");
    expect(principalFor(cfg, "sk-reserved")).toBe("anonymous");
  });
});

describe("S3: registry boot refusal closes the SQLite handle", () => {
  /** The pre-v5 tenants shape (registry-db.ts constructor DDL, minus the non-unique index). */
  function createBaseTenants(db: Database): void {
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(`CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      variant TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT,
      owner_principal TEXT,
      key TEXT,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );`);
  }

  test("a duplicate-key registry.db refuses the constructor AND leaves no leaked WAL/SHM", () => {
    const root = mkdtempSync(join(tmpdir(), "gw-st-quarantine-bootref-"));
    ROOTS.push(root);
    const dir = join(root, "tenants");
    mkdirSync(dir, { recursive: true });
    // Also verify the runner-level refusal rolls back the guarded ALTERs (the corrected
    // v5 ordering comment: rollback, not statement order, leaves the schema untouched).
    const db = new Database(join(dir, "registry.db"));
    createBaseTenants(db);
    db.query("INSERT INTO tenants (tenant_id, variant, status, name, owner_principal, key, created_at, data) VALUES ('gw-aaaaaaaaaaaa', 'co-consult', 'ready', NULL, NULL, 'co-consult::alice', ?, '{}')").run(new Date().toISOString());
    db.query("INSERT INTO tenants (tenant_id, variant, status, name, owner_principal, key, created_at, data) VALUES ('gw-bbbbbbbbbbbb', 'co-consult', 'ready', NULL, NULL, 'co-consult::alice', ?, '{}')").run(new Date().toISOString());
    let runnerError: unknown;
    try {
      runMigrations(db, REGISTRY_MIGRATION_STEPS);
    } catch (err) {
      runnerError = err;
    }
    expect(runnerError).toBeInstanceOf(RegistryKeyCollisionError);
    const cols = (db.query("PRAGMA table_info(tenants)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).not.toContain("team_kind");
    db.close();

    // Constructor-level: the throw must close the handle (the UserStore pattern). Proof:
    // switching journal_mode off WAL needs exclusive access — with a leaked handle open the
    // probe throws "database is locked" (and on Windows the leaked handle would block the
    // data-dir deletion until process exit).
    expect(() => new TenantRegistry(root)).toThrow(RegistryKeyCollisionError);
    const probe = new Database(join(dir, "registry.db"));
    try {
      const mode = probe.query("PRAGMA journal_mode = DELETE").get() as { journal_mode: string };
      expect(mode.journal_mode).toBe("delete");
    } finally {
      probe.close();
    }
  });
});
