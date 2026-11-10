/**
 * Versioned SQLite migrations for the gateway stores (design
 * docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md §4.1). Steps are ordered,
 * each idempotent, keyed on `PRAGMA user_version`: a database at version N has every step
 * with version <= N applied. Fresh databases run all steps; live databases migrate at
 * startup (the UserStore constructor calls runMigrations — users.db is the store where the
 * new tables live). A downgrade guard refuses to open a database whose user_version is
 * ABOVE the highest known step — never guess an unknown future schema.
 *
 * ONE-WAY STEPS: migration v4 (admin console round 2, design
 * docs/designs/2026-11-09-gw-admin-console-round2-plan.md — 2026-11-09 unit-model amendment)
 * has NO downgrade path. Rolling the gateway back below v4 loses the v4 data (named
 * policies, policy assignments, loop enrollments, loop operators — the legacy
 * `groups.policy` blobs are NULLed by the data migration and `kind='loop'` groups are
 * merged into general groups). The recovery is the pre-migration backup
 * (`data.bak-<ts>`, taken per the round-2 handoff notes), not a reverse migration.
 *
 * The per-tenant loop override is deliberately NOT a migration: it rides the versionable
 * `tenants.data` JSON column on TenantRecord (§4.1), so no DDL is needed there.
 */

import { Database } from "bun:sqlite";
import { DEFAULT_LOOP_SCOPES, DEFAULT_LOOP_WINDOWS, validateLoopScopes, validateLoopWindows, type LoopScopes, type LoopWindows } from "./tenant-loop";
import { sanitizeGroupPolicyShape, type GroupPolicy } from "./policy";

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
  {
    // Admin console (design docs/designs/2026-11-09-gw-admin-console-design.md §3): general
    // groups share the tenant-loop groups/user_groups tables, distinguished by `kind`.
    version: 3,
    name: "admin console: general groups (kind/policy/description) + users.disabled_at + user_groups(principal) index",
    up(db: Database): void {
      for (const stmt of [
        "ALTER TABLE groups ADD COLUMN kind TEXT NOT NULL DEFAULT 'loop'",
        "ALTER TABLE groups ADD COLUMN policy TEXT",
        "ALTER TABLE groups ADD COLUMN description TEXT",
        "ALTER TABLE groups ADD COLUMN created_at TEXT",
        "ALTER TABLE users ADD COLUMN disabled_at TEXT",
      ]) {
        try {
          db.exec(stmt);
        } catch (err) {
          // Only "already applied" is benign (2026-11-09 review L4); any other failure is a
          // real schema problem and must stop the migration, not be swallowed.
          if (!(err instanceof Error && err.message.includes("duplicate column name"))) throw err;
        }
      }
      // Existing rows are tenant-loop groups (the DEFAULT already sets this; explicit for clarity).
      db.exec("UPDATE groups SET kind='loop' WHERE kind IS NULL OR kind=''");
      db.exec("CREATE INDEX IF NOT EXISTS idx_user_groups_principal ON user_groups(principal)");
      db.exec("CREATE INDEX IF NOT EXISTS idx_groups_kind ON groups(kind)");
    },
  },
  {
    // Admin console round 2 (design docs/designs/2026-11-09-gw-admin-console-round2-plan.md,
    // "2026-11-09 unit-model amendment"): NAMED policies assigned to GROUPS ONLY (no
    // per-user targets), and loop enrollments keyed (group_id, variant) with the '*'
    // wildcard replacing both the kind='loop' group kind and the per-tenant exceptions.
    //
    // ONE-WAY: no downgrade path exists for this step. A rollback below v4 loses the v4
    // data (policies, assignments, enrollments, operators — see the module docstring);
    // recovery is the pre-migration backup restore, not a reverse migration.
    //
    // TRANSACTION: runMigrations applies step.up(db) with NO per-step transaction
    // (autocommit per statement), so this whole body is wrapped in one db.transaction — a
    // mid-step crash rolls back to a clean v3 instead of stranding a half-applied v4.
    version: 4,
    name: "admin console r2: named policies (group-only) + (group, variant) loop enrollments + loop operators [ONE-WAY]",
    up(db: Database): void {
      db.transaction(() => {
        db.exec(`CREATE TABLE IF NOT EXISTS policies (
          policy_id   TEXT PRIMARY KEY,
          name        TEXT NOT NULL UNIQUE,
          description TEXT,
          limits      TEXT NOT NULL,
          created_at  TEXT,
          updated_at  TEXT
        );`);
        db.exec(`CREATE TABLE IF NOT EXISTS policy_assignments (
          policy_id   TEXT NOT NULL REFERENCES policies(policy_id),
          target_kind TEXT NOT NULL CHECK (target_kind = 'group'),
          target_id   TEXT NOT NULL,
          PRIMARY KEY (policy_id, target_kind, target_id)
        );`);
        db.exec("CREATE INDEX IF NOT EXISTS idx_policy_assignments_target ON policy_assignments(target_id)");
        db.exec(`CREATE TABLE IF NOT EXISTS loop_enrollments (
          group_id    TEXT NOT NULL,
          variant     TEXT NOT NULL,
          status      TEXT NOT NULL CHECK (status IN ('active', 'suspended')),
          scopes      TEXT,
          windows     TEXT,
          git_remote  TEXT,
          enrolled_at TEXT,
          PRIMARY KEY (group_id, variant)
        );`);
        db.exec(`CREATE TABLE IF NOT EXISTS loop_operators (
          group_id  TEXT NOT NULL,
          principal TEXT NOT NULL,
          PRIMARY KEY (group_id, principal)
        );`);

        // ── Data migration 1: legacy `groups.policy` blobs → named policies (group-only
        // assignment), then the column is NULLed — column retained (deprecated; v4 is
        // one-way), never read again by the resolver. The limits are parsed and validated
        // through the shared
        // policy canonicalizer; a hand-corrupted blob degrades to its valid subset (review
        // L3 semantics), never to a lost row. Name = "<group name> limits", suffixed on
        // collision ("<...> limits 2", ...) — policies.name is UNIQUE. A loop group carrying
        // a policy (round-1 M1 said this cannot exist) still migrates cleanly: BOTH data
        // migrations apply to it (defensive case).
        type GroupPolicyRow = { group_id: string; name: string; policy: string | null };
        const policyRows = db.query("SELECT group_id, name, policy FROM groups WHERE policy IS NOT NULL").all() as GroupPolicyRow[];
        const now = new Date().toISOString();
        for (const row of policyRows) {
          let limits: GroupPolicy;
          try {
            limits = sanitizeGroupPolicyShape(JSON.parse(row.policy ?? "null"));
          } catch {
            limits = {}; // unreadable JSON → a named policy with no opinions; nothing is lost
          }
          const policyId = `p-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
          const baseName = `${row.name} limits`;
          let name = baseName;
          for (let n = 2; db.query("SELECT 1 FROM policies WHERE name = ?").get(name); n += 1) {
            name = `${baseName} ${n}`;
          }
          db.query("INSERT INTO policies (policy_id, name, description, limits, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)").run(
            policyId,
            name,
            JSON.stringify(limits),
            now,
            now,
          );
          db.query("INSERT OR IGNORE INTO policy_assignments (policy_id, target_kind, target_id) VALUES (?, 'group', ?)").run(policyId, row.group_id);
        }
        db.exec("UPDATE groups SET policy = NULL");

        // ── Data migration 2: every kind='loop' group becomes kind='general' and gains an
        // ACTIVE (group_id, '*') enrollment carrying its loop_config scopes/windows (the
        // pre-v4 effective config materialized these same defaults at export time, so the
        // migrated rows keep the old behavior byte-identical) and 'local-only' as the git
        // remote (the pre-v4 per-tenant default). Its designatedUsers become loop
        // operators, preserving the delegate ACL under the new co-governance rule.
        type LoopGroupRow = { group_id: string; name: string; loop_config: string };
        const loopRows = db.query("SELECT group_id, name, loop_config FROM groups WHERE kind = 'loop'").all() as LoopGroupRow[];
        for (const row of loopRows) {
          let parsed: Record<string, unknown> = {};
          try {
            const candidate: unknown = JSON.parse(row.loop_config);
            if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) parsed = candidate as Record<string, unknown>;
          } catch {
            /* unreadable config → defaults below (same fallback the old rowToGroup used) */
          }
          let scopes: LoopScopes;
          try {
            scopes = { ...DEFAULT_LOOP_SCOPES, ...validateLoopScopes(parsed.scopes ?? {}) };
          } catch {
            scopes = { ...DEFAULT_LOOP_SCOPES }; // invalid stored scopes → the pre-v4 defaults
          }
          let windows: LoopWindows;
          try {
            windows = validateLoopWindows(parsed.windows ?? DEFAULT_LOOP_WINDOWS);
          } catch {
            windows = { ...DEFAULT_LOOP_WINDOWS }; // invalid stored windows → the pre-v4 defaults
          }
          db.query(
            "INSERT OR IGNORE INTO loop_enrollments (group_id, variant, status, scopes, windows, git_remote, enrolled_at) VALUES (?, '*', 'active', ?, ?, 'local-only', ?)",
          ).run(row.group_id, JSON.stringify(scopes), JSON.stringify(windows), now);
          const designated = Array.isArray(parsed.designatedUsers) ? parsed.designatedUsers.filter((u): u is string => typeof u === "string") : [];
          for (const principal of new Set(designated)) {
            db.query("INSERT OR IGNORE INTO loop_operators (group_id, principal) VALUES (?, ?)").run(row.group_id, principal);
          }
          db.query("UPDATE groups SET kind = 'general' WHERE group_id = ?").run(row.group_id);
        }
      })();
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
        `refusing to open with an older schema (downgrade guard). Note: migration v4 is ONE-WAY — ` +
        `there is no downgrade below it, and rolling the gateway back loses the v4 data (policies, ` +
        `assignments, enrollments, operators); the recovery is restoring the pre-migration backup.`,
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
