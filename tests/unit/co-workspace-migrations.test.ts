/**
 * Gateway migration runner (design 2026-11-08-gw-tenant-loop-and-hardening-design §4.1):
 * fresh install applies every step; re-runs are no-ops; a database newer than the code
 * refuses to open (downgrade guard); the legacy users.ts ad-hoc schema block (PII-safe
 * columns + email-NOT-NULL rebuild) migrates with identical end state. Fixtures are
 * mkdtempSync + absolute tmpdir roots only (T-20261104-003 discipline).
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
      expect(groupsCols).toEqual(["group_id", "name", "loop_config"]);
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
