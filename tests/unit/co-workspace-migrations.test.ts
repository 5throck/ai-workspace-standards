/**
 * Gateway migration runner (design 2026-11-08-gw-tenant-loop-and-hardening-design §4.1):
 * fresh install applies every step; re-runs are no-ops; a database newer than the code
 * refuses to open (downgrade guard); the legacy users.ts ad-hoc schema block (PII-safe
 * columns + email-NOT-NULL rebuild) migrates with identical end state. Fixtures are
 * mkdtempSync + absolute tmpdir roots only (T-20261104-003 discipline).
 *
 * v4 (2026-11-11, round-2 unit model — docs/designs/2026-11-09-gw-admin-console-round2-plan.md):
 * the v3-slice fixture seeds loop groups with designatedUsers + groups.policy rows, the full
 * runner lifts them into named policies (group-only assignments), (group_id, '*') loop
 * enrollments and loop operators, and NULLs the deprecated blob column. v4 is ONE-WAY: the
 * step runs inside one transaction and there is no downgrade path (recovery = backup).
 */

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MIGRATION_HEAD, MIGRATION_STEPS, MigrationDowngradeError, runMigrations } from "../../services/co-workspace/src/migrations";
import { UserStore } from "../../services/co-workspace/src/users";

function tempRoot(label: string): string {
  return mkdtempSync(join(tmpdir(), `gw-migrations-${label}-`));
}

/** The legacy (pre-PII-safe) users shape users.ts carried before the column migrations. */
function createLegacyUsersDb(db: Database): void {
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    principal TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_sub TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL,
    deleted_at TEXT
  );`);
  db.exec(`CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );`);
  db.exec(`CREATE TABLE reset_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);`);
  db.exec(`CREATE TABLE pending_verifications (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, email TEXT NOT NULL, expires_at TEXT NOT NULL);`);
}

describe("runMigrations — versioned runner", () => {
  test("fresh db: all steps applied, user_version at head, groups tables exist", () => {
    const root = tempRoot("fresh");
    try {
      const db = new Database(join(root, "users.db"));
      db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
        password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT);`);
      db.exec("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);");
      const applied = runMigrations(db);
      expect(applied).toBe(MIGRATION_STEPS.length);
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD);
      const groupsCols = (db.query("PRAGMA table_info(groups)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(groupsCols).toEqual(["group_id", "name", "loop_config", "kind", "policy", "description", "created_at"]);
      const joinCols = (db.query("PRAGMA table_info(user_groups)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(joinCols).toEqual(["group_id", "principal"]);
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("re-run is an idempotent no-op", () => {
    const root = tempRoot("idempotent");
    try {
      const db = new Database(join(root, "users.db"));
      // The runner is applied to users.db AFTER UserStore's base CREATE TABLEs —
      // mirror that contract here.
      db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
        password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT);`);
      db.exec("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);");
      expect(runMigrations(db)).toBe(MIGRATION_STEPS.length);
      expect(runMigrations(db)).toBe(0);
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("downgrade guard: user_version above head refuses to open", () => {
    const root = tempRoot("downgrade");
    try {
      const db = new Database(join(root, "users.db"));
      db.exec(`PRAGMA user_version = ${MIGRATION_HEAD + 1}`);
      db.close();
      // Capture the handle: the runner throws before taking ownership, so the suite must
      // close it or Windows keeps users.db locked and the rmSync below dies with EBUSY.
      const probe = new Database(join(root, "users.db"));
      try {
        expect(() => runMigrations(probe)).toThrow(MigrationDowngradeError);
      } finally {
        probe.close();
      }
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});

describe("migration v4 — round-2 unit model (named policies + enrollments, ONE-WAY)", () => {
  /** Build a genuine v3 database and seed the pre-v4 shapes: general groups carrying
   * policy blobs, loop groups with designatedUsers (some with scopes/windows, some bare),
   * the defensive loop-group-with-policy case, and a policy-name collision pair. */
  function v3Fixture(db: Database): void {
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
      password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT);`);
    db.exec("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);");
    db.exec("CREATE TABLE groups (group_id TEXT PRIMARY KEY, name TEXT NOT NULL, loop_config TEXT NOT NULL);");
    db.exec("CREATE TABLE user_groups (group_id TEXT NOT NULL, principal TEXT NOT NULL, PRIMARY KEY (group_id, principal));");
    runMigrations(db, MIGRATION_STEPS.filter((s) => s.version <= 3));
    // A general group with a policy blob (the round-1 shape).
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('team-a', 'Team A', '{"designatedUsers":[]}', 'general', '{"maxTurns":3}', '2026-11-01T00:00:00.000Z')`);
    // A SECOND group with the SAME name → the migrated policy names must collide and suffix.
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('team-a2', 'Team A', '{"designatedUsers":[]}', 'general', '{"maxTenants":2}', '2026-11-01T00:00:00.000Z')`);
    // A loop group with scopes/windows and designatedUsers.
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('loop-a', 'Loop A', '{"designatedUsers":["alice","bob"],"scopes":{"upgrade":true},"windows":{"tz":"UTC","days":[1],"start":"09:00","end":"17:00"}}', 'loop', NULL, '2026-11-01T00:00:00.000Z')`);
    db.exec(`INSERT INTO user_groups (group_id, principal) VALUES ('loop-a', 'alice')`);
    // A loop group with a BARE loop_config (no scopes/windows → the defaults materialize).
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('loop-b', 'Loop B', '{"designatedUsers":["carol"]}', 'loop', NULL, '2026-11-01T00:00:00.000Z')`);
    // Defensive case: a loop group that (against round-1 M1) carries a policy blob.
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('loop-c', 'Loop C', '{"designatedUsers":["dave"]}', 'loop', '{"maxTokens":9}', '2026-11-01T00:00:00.000Z')`);
    // A corrupt policy blob → degrades to its valid subset, never loses the row.
    db.exec(`INSERT INTO groups (group_id, name, loop_config, kind, policy, created_at)
      VALUES ('team-x', 'Team X', '{"designatedUsers":[]}', 'general', 'not-json{', '2026-11-01T00:00:00.000Z')`);
  }

  test("v3 slice → v4: policies created+assigned, enrollments with '*', operators mapped, blob NULLed, kind general", () => {
    const root = tempRoot("v4-data");
    try {
      const db = new Database(join(root, "users.db"));
      v3Fixture(db);
      expect(runMigrations(db)).toBe(1); // only v4 remains
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD);

      // New tables exist with the declared columns.
      const policyCols = (db.query("PRAGMA table_info(policies)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(policyCols).toEqual(["policy_id", "name", "description", "limits", "created_at", "updated_at"]);
      const assignCols = (db.query("PRAGMA table_info(policy_assignments)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(assignCols).toEqual(["policy_id", "target_kind", "target_id"]);
      const enrollCols = (db.query("PRAGMA table_info(loop_enrollments)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(enrollCols).toEqual(["group_id", "variant", "status", "scopes", "windows", "git_remote", "enrolled_at"]);
      const opCols = (db.query("PRAGMA table_info(loop_operators)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(opCols).toEqual(["group_id", "principal"]);

      // Policies: named "<group name> limits" with numeric suffixes on collision; the
      // defensive loop-c policy migrated too; the corrupt blob degraded to {} (no opinions).
      const policies = db.query("SELECT name, limits FROM policies ORDER BY name ASC").all() as Array<{ name: string; limits: string }>;
      expect(policies.map((p) => p.name)).toEqual(["Loop C limits", "Team A limits", "Team A limits 2", "Team X limits"]);
      expect(JSON.parse(policies[0].limits)).toEqual({ maxTokens: 9 });
      expect(JSON.parse(policies[1].limits)).toEqual({ maxTurns: 3 });
      expect(JSON.parse(policies[2].limits)).toEqual({ maxTenants: 2 });
      expect(JSON.parse(policies[3].limits)).toEqual({});

      // Assignments: group-only, one per migrated blob.
      const assignments = db
        .query("SELECT pa.target_kind, pa.target_id, p.name FROM policy_assignments pa JOIN policies p ON p.policy_id = pa.policy_id ORDER BY pa.target_id")
        .all() as Array<{ target_kind: string; target_id: string; name: string }>;
      expect(assignments).toEqual([
        { target_kind: "group", target_id: "loop-c", name: "Loop C limits" },
        { target_kind: "group", target_id: "team-a", name: "Team A limits" },
        { target_kind: "group", target_id: "team-a2", name: "Team A limits 2" },
        { target_kind: "group", target_id: "team-x", name: "Team X limits" },
      ]);

      // Enrollments: every loop group → ACTIVE (group_id, '*') with its scopes/windows; the
      // bare loop-b materializes the pre-v4 defaults; git_remote defaults to local-only.
      const enrollments = db
        .query("SELECT group_id, variant, status, scopes, windows, git_remote FROM loop_enrollments ORDER BY group_id")
        .all() as Array<{ group_id: string; variant: string; status: string; scopes: string; windows: string; git_remote: string }>;
      expect(enrollments.map((e) => [e.group_id, e.variant, e.status, e.git_remote])).toEqual([
        ["loop-a", "*", "active", "local-only"],
        ["loop-b", "*", "active", "local-only"],
        ["loop-c", "*", "active", "local-only"],
      ]);
      expect(JSON.parse(enrollments[0].scopes)).toEqual({ upgrade: true, upstreamFile: false, backportReview: false, nightlyFleet: false });
      expect(JSON.parse(enrollments[0].windows)).toEqual({ tz: "UTC", days: [1], start: "09:00", end: "17:00" });
      expect(JSON.parse(enrollments[1].scopes)).toEqual({ upgrade: false, upstreamFile: false, backportReview: false, nightlyFleet: false });
      expect(JSON.parse(enrollments[1].windows)).toEqual({ tz: "Asia/Seoul", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" });

      // Operators: designatedUsers → loop_operators.
      const operators = db.query("SELECT group_id, principal FROM loop_operators ORDER BY group_id, principal").all();
      expect(operators).toEqual([
        { group_id: "loop-a", principal: "alice" },
        { group_id: "loop-a", principal: "bob" },
        { group_id: "loop-b", principal: "carol" },
        { group_id: "loop-c", principal: "dave" },
      ]);

      // The deprecated column is NULLed and every group is kind='general'.
      const groups = db.query("SELECT group_id, kind, policy FROM groups ORDER BY group_id").all();
      expect(groups).toEqual([
        { group_id: "loop-a", kind: "general", policy: null },
        { group_id: "loop-b", kind: "general", policy: null },
        { group_id: "loop-c", kind: "general", policy: null },
        { group_id: "team-a", kind: "general", policy: null },
        { group_id: "team-a2", kind: "general", policy: null },
        { group_id: "team-x", kind: "general", policy: null },
      ]);
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("v4 is transactional: a mid-step failure leaves the database at v3 with no half-applied tables", () => {
    const root = tempRoot("v4-atomic");
    try {
      const db = new Database(join(root, "users.db"));
      v3Fixture(db);
      // Sabotage: a policies table already exists WITHOUT the expected shape, so v4's first
      // CREATE TABLE IF NOT EXISTS is a no-op and the INSERT hits missing columns → the
      // transaction (and only it) rolls back.
      db.exec("CREATE TABLE policies (bogus TEXT)");
      expect(() => runMigrations(db)).toThrow();
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(3); // version stamp not written
      const leftovers = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('loop_enrollments','loop_operators','policy_assignments')").all();
      expect(leftovers).toEqual([]); // the transactional DDL rolled back
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("one-way guard message: downgrading below v4 loses data (recovery = backup restore)", () => {
    const root = tempRoot("v4-oneway");
    try {
      const db = new Database(join(root, "users.db"));
      v3Fixture(db);
      let error: MigrationDowngradeError | null = null;
      db.exec(`PRAGMA user_version = ${MIGRATION_HEAD + 1}`);
      db.close();
      const probe = new Database(join(root, "users.db"));
      try {
        runMigrations(probe);
      } catch (err) {
        error = err as MigrationDowngradeError;
      } finally {
        probe.close();
      }
      expect(error).toBeInstanceOf(MigrationDowngradeError);
      expect(error?.message).toContain("ONE-WAY");
      expect(error?.message).toContain("pre-migration backup");
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("a fresh database runs v1→v4 (head) in one pass", () => {
    const root = tempRoot("v4-fresh");
    try {
      const db = new Database(join(root, "users.db"));
      db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT NOT NULL, principal TEXT UNIQUE NOT NULL,
        password_hash TEXT, google_sub TEXT, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL, deleted_at TEXT);`);
      db.exec("CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);");
      expect(runMigrations(db)).toBe(MIGRATION_STEPS.length);
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD);
      for (const table of ["policies", "policy_assignments", "loop_enrollments", "loop_operators"]) {
        expect(db.query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table)).toBeDefined();
      }
      db.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});

describe("UserStore — migrated legacy databases", () => {
  test("fresh UserStore: migrations applied; PII-safe columns present; group store works", () => {
    const root = tempRoot("userstore-fresh");
    try {
      const users = new UserStore(root);
      const db = new Database(join(root, "tenants", "users.db"), { readonly: true });
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD);
      const colNames = (db.query("PRAGMA table_info(users)").all() as Array<{ name: string }>).map((c) => c.name);
      for (const col of ["login_id", "email_hash", "verified_at", "must_change_password", "temp_password_expires"]) {
        expect(colNames).toContain(col);
      }
      db.close();
      // Group store round-trip (design §4.1 tables).
      users.upsertGroup({
        groupId: "loop-team",
        name: "Loop Team",
        designatedUsers: ["alice", "bob"],
        scopes: { upgrade: true, nightlyFleet: true },
        windows: { tz: "Asia/Seoul", days: [1, 3], start: "22:00", end: "06:00" },
      });
      const g = users.getGroup("loop-team");
      expect(g?.name).toBe("Loop Team");
      expect(g?.designatedUsers).toEqual(["alice", "bob"]);
      expect(g?.scopes?.upgrade).toBe(true);
      expect(g?.windows?.start).toBe("22:00");
      // Join mirror stays in sync with designatedUsers (single input, no divergence).
      // Handle captured (not chained) so it is closed — an open reader locks users.db on Windows.
      const mirrorDb = new Database(join(root, "tenants", "users.db"), { readonly: true });
      const mirror = mirrorDb
        .query("SELECT principal FROM user_groups WHERE group_id=? ORDER BY principal")
        .all("loop-team") as Array<{ principal: string }>;
      mirrorDb.close();
      expect(mirror.map((r) => r.principal)).toEqual(["alice", "bob"]);
      expect(users.listGroups().map((x) => x.groupId)).toContain("loop-team");
      expect(users.deleteGroup("loop-team")).toBe(true);
      expect(users.getGroup("loop-team")).toBeUndefined();
      users.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("legacy upgrade path: email-NOT-NULL table rebuilt nullable, rows preserved, columns added", () => {
    const root = tempRoot("legacy-upgrade");
    try {
      const dir = join(root, "tenants");
      mkdirSync(dir, { recursive: true });
      const dbPath = join(dir, "users.db");
      const legacy = new Database(dbPath);
      createLegacyUsersDb(legacy);
      legacy
        .query("INSERT INTO users (id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at) VALUES (?, ?, ?, ?, NULL, NULL, 'user', ?, NULL)")
        .run("u-legacy1", "old@example.com", "Old User", "old-user", new Date().toISOString());
      legacy.close();

      const users = new UserStore(root);
      const preserved = users.findByPrincipal("old-user");
      expect(preserved?.id).toBe("u-legacy1");
      expect(preserved?.email).toBe("old@example.com");
      // The constraint is gone: a NULL email now stores cleanly.
      const db = new Database(dbPath, { readonly: true });
      const emailCol = (db.query("PRAGMA table_info(users)").all() as Array<{ name: string; notnull: number }>).find((c) => c.name === "email");
      expect(emailCol?.notnull).toBe(0);
      const v = db.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD);
      db.close();
      users.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("downgrade guard via UserStore: pre-seeded newer users.db refuses the constructor", () => {
    const root = tempRoot("userstore-downgrade");
    try {
      const dir = join(root, "tenants");
      mkdirSync(dir, { recursive: true });
      const db = new Database(join(dir, "users.db"));
      db.exec(`PRAGMA user_version = ${MIGRATION_HEAD + 5}`);
      db.close();
      let error: unknown;
      try {
        new UserStore(root);
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(MigrationDowngradeError);
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });

  test("downgrade guard never mutates the offending database", () => {
    const root = tempRoot("downgrade-no-write");
    try {
      const dir = join(root, "tenants");
      mkdirSync(dir, { recursive: true });
      const dbPath = join(dir, "users.db");
      const db = new Database(dbPath);
      db.exec(`PRAGMA user_version = ${MIGRATION_HEAD + 1}`);
      db.close();
      const doomed = new Database(dbPath);
      try {
        runMigrations(doomed);
      } catch {
        /* expected */
      } finally {
        doomed.close(); // runner throws before taking ownership — close it or Windows EBUSYs the rm
      }
      const check = new Database(dbPath, { readonly: true });
      const v = check.query("PRAGMA user_version").get() as { user_version: number };
      expect(v.user_version).toBe(MIGRATION_HEAD + 1);
      check.close();
    } finally {
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  });
});
