/**
 * Versioned SQLite migrations for the gateway stores (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §4.1). Steps are ordered,
 * each idempotent, keyed on `PRAGMA user_version`: a database at version N has every step
 * with version <= N applied. Fresh databases run all steps; live databases migrate at
 * startup (the UserStore constructor calls runMigrations — users.db is the store where the
 * new tables live). A downgrade guard refuses to open a database whose user_version is
 * ABOVE the highest known step — never guess an unknown future schema.
 *
 * The per-tenant loop override is deliberately NOT a migration: it rides the versionable
 * `tenants.data` JSON column on TenantRecord (§4.1), so no DDL is needed there.
 */

import { Database } from "bun:sqlite";

export interface MigrationStep {
  version: number;
  name: string;
  up(db: Database): void;
}

export const MIGRATION_STEPS: MigrationStep[] = [
  {
    version: 1,
    name: "tenant-loop groups + user_groups (design 2026-11-08-gw-tenant-loop-and-hardening-design §4.1)",
    up(db: Database): void {
      db.exec(`CREATE TABLE IF NOT EXISTS groups (
        group_id   TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        loop_config TEXT NOT NULL
      );`);
      db.exec(`CREATE TABLE IF NOT EXISTS user_groups (
        group_id  TEXT NOT NULL REFERENCES groups(group_id),
        principal TEXT NOT NULL,
        PRIMARY KEY (group_id, principal)
      );`);
    },
  },
  {
    // Migrated from UserStore's inline ad-hoc block (users.ts, the pre-migration-runner
    // pattern): PII-safe columns for login-by-ID accounts plus the legacy email-NOT-NULL
    // rebuild. End state identical to the inline version; ordering fixed so the rebuild's
    // SELECT never references columns it added itself (the oldest databases lacked
    // login_id/email_hash/verified_at and would have crashed the original block).
    version: 2,
    name: "users PII-safe columns + email-nullable rebuild (ex users.ts ad-hoc ALTERs)",
    up(db: Database): void {
      for (const stmt of [
        "ALTER TABLE users ADD COLUMN login_id TEXT",
        "ALTER TABLE users ADD COLUMN email_hash TEXT",
        "ALTER TABLE users ADD COLUMN verified_at TEXT",
        "ALTER TABLE users ADD COLUMN must_change_password INTEGER",
        "ALTER TABLE users ADD COLUMN temp_password_expires TEXT",
        "ALTER TABLE sessions ADD COLUMN last_seen_at TEXT",
        "ALTER TABLE sessions ADD COLUMN created_at TEXT",
      ]) {
        try {
          db.exec(stmt);
        } catch {
          /* already applied */
        }
      }
      // Pre-PII-safe databases carry `email NOT NULL`, which breaks signups that
      // legitimately store a NULL email (the raw email is discarded after verification).
      // Rebuild the table without the constraint, preserving every row.
      const cols = db.query("PRAGMA table_info(users)").all() as Array<{ name: string; notnull: number }>;
      const emailCol = cols.find((c) => c.name === "email");
      if (emailCol?.notnull) {
        db.exec(`CREATE TABLE users_rebuild (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE,
          name TEXT NOT NULL,
          principal TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          google_sub TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          created_at TEXT NOT NULL,
          deleted_at TEXT,
          login_id TEXT,
          email_hash TEXT,
          verified_at TEXT
        );`);
        db.exec(`INSERT INTO users_rebuild
          (id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at, login_id, email_hash, verified_at)
          SELECT id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at, login_id, email_hash, verified_at FROM users;`);
        db.exec("DROP TABLE users;");
        db.exec("ALTER TABLE users_rebuild RENAME TO users;");
      }
      // After the rebuild (which drops the old table's indexes).
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login_id) WHERE login_id IS NOT NULL");
      db.exec("CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)");
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash_unique ON users(email_hash) WHERE email_hash IS NOT NULL");
    },
  },
];

export const MIGRATION_HEAD = MIGRATION_STEPS[MIGRATION_STEPS.length - 1].version;

/** Refusal signal for a database newer than this code knows (downgrade guard). */
export class MigrationDowngradeError extends Error {}

function currentUserVersion(db: Database): number {
  const row = db.query("PRAGMA user_version").get() as { user_version: number };
  return Number(row.user_version);
}

/** Apply every pending step in order; returns the number of steps applied. Idempotent —
 * re-running a migrated database applies nothing. Throws MigrationDowngradeError when the
 * database's user_version is above MIGRATION_HEAD (a newer binary wrote it; opening would
 * guess at an unknown schema). */
export function runMigrations(db: Database, steps: MigrationStep[] = MIGRATION_STEPS): number {
  const current = currentUserVersion(db);
  const head = steps[steps.length - 1].version;
  if (current > head) {
    throw new MigrationDowngradeError(
      `database user_version ${current} is newer than the highest supported migration (${head}) — ` +
        `refusing to open with an older schema (downgrade guard)`,
    );
  }
  let applied = 0;
  for (const step of steps) {
    if (current >= step.version) continue;
    step.up(db);
    // step.version is an internal integer constant — safe to interpolate (PRAGMA cannot
    // take bound parameters).
    db.exec(`PRAGMA user_version = ${step.version}`);
    applied += 1;
  }
  return applied;
}
