/**
 * Round-3 shared-teams migrations (design docs/designs/2026-11-09-gw-shared-teams-design.md
 * §4 + §6, verification table row 2):
 *  - turns.db: the additive acting_principal column — legacy rows keep NULL, new rows record
 *    the caller, the (tenant_id, seq) PK is unchanged (the store's guarded-ALTER ensure
 *    pattern; there is no versioned runner on this store and none is needed).
 *  - registry.db: migration v5 through the versioned runner (the registry versions SEPARATELY
 *    from users.db but through the same runner — see migrations.ts) — a duplicate-key fixture
 *    DB is REFUSED pre-migration with the keys named (fail-closed boot, design §4 step 1), a
 *    clean DB gets the UNIQUE index plus the team_kind/owner_group columns, and re-runs are
 *    idempotent.
 * Fixtures are mkdtempSync + absolute tmpdir roots only (T-20261104-003 discipline); SQLite
 * handles are closed before rmSync (Windows EBUSY lesson) with the maxRetries pair.
 */

import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  REGISTRY_MIGRATION_HEAD,
  REGISTRY_MIGRATION_STEPS,
  RegistryKeyCollisionError,
  runMigrations,
} from "../../services/co-workspace/src/migrations";
import { TurnStore } from "../../services/co-workspace/src/tenant-files";
import { TenantRegistry } from "../../services/co-workspace/src/registry-db";

function tempRoot(label: string): string {
  return mkdtempSync(join(tmpdir(), `gw-st-migrations-${label}-`));
}

function cleanup(root: string, stores: Array<{ close(): void }>): void {
  for (const store of stores) {
    try {
      store.close();
    } catch {
      /* best effort */
    }
  }
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

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

function insertTenant(db: Database, opts: { tenantId: string; key?: string; owner?: string }): void {
  db.query(
    "INSERT INTO tenants (tenant_id, variant, status, name, owner_principal, key, created_at, data) VALUES (?, ?, 'ready', NULL, ?, ?, ?, '{}')",
  ).run(opts.tenantId, "co-consult", opts.owner ?? null, opts.key ?? null, new Date().toISOString());
}

describe("registry migration v5 — tenants.key UNIQUE + team_kind/owner_group", () => {
  test("duplicate-key fixture is REFUSED pre-migration with the keys named (fail-closed)", () => {
    const root = tempRoot("dup");
    const db = new Database(join(root, "registry.db"));
    try {
      createBaseTenants(db);
      insertTenant(db, { tenantId: "gw-aaaaaaaaaaaa", key: "co-consult::alice" });
      insertTenant(db, { tenantId: "gw-bbbbbbbbbbbb", key: "co-consult::alice" });
      insertTenant(db, { tenantId: "gw-cccccccccccc", key: "co-consult::bob" });
      insertTenant(db, { tenantId: "gw-dddddddddddd", key: "co-consult::bob" });
      let message = "";
      try {
        runMigrations(db, REGISTRY_MIGRATION_STEPS);
      } catch (err) {
        expect(err).toBeInstanceOf(RegistryKeyCollisionError);
        message = (err as Error).message;
      }
      expect(message).toContain("co-consult::alice");
      expect(message).toContain("co-consult::bob");
      // Refused mid-transaction (QA S3 comment correction): the rollback — not the statement
      // order — leaves the base columns absent and user_version 0.
      const cols = (db.query("PRAGMA table_info(tenants)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(cols).not.toContain("team_kind");
      expect(cols).not.toContain("owner_group");
      expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(0);
    } finally {
      db.close();
      cleanup(root, []);
    }
  });

  test("clean db: unique index replaces the non-unique one, columns added with defaults, idempotent re-run", () => {
    const root = tempRoot("clean");
    const db = new Database(join(root, "registry.db"));
    try {
      createBaseTenants(db);
      db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_key ON tenants(key);"); // the pre-v5 index
      insertTenant(db, { tenantId: "gw-aaaaaaaaaaaa", key: "co-consult::alice", owner: "alice" });
      expect(runMigrations(db, REGISTRY_MIGRATION_STEPS)).toBe(REGISTRY_MIGRATION_STEPS.length);
      expect((db.query("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(REGISTRY_MIGRATION_HEAD);

      const indexes = db.query("PRAGMA index_list(tenants)").all() as Array<{ name: string; unique: number }>;
      const uniqueIdx = indexes.find((i) => i.name === "idx_tenants_key_unique");
      expect(uniqueIdx?.unique).toBe(1);
      expect(indexes.some((i) => i.name === "idx_tenants_key")).toBe(false);

      const cols = (db.query("PRAGMA table_info(tenants)").all() as Array<{ name: string }>).map((c) => c.name);
      expect(cols).toContain("team_kind");
      expect(cols).toContain("owner_group");
      // Existing rows: kind defaults to personal, owner_group NULL — fully additive.
      const row = db.query("SELECT team_kind, owner_group FROM tenants WHERE tenant_id = 'gw-aaaaaaaaaaaa'").get() as {
        team_kind: string;
        owner_group: string | null;
      };
      expect(row.team_kind).toBe("personal");
      expect(row.owner_group).toBeNull();

      // The unique index actually enforces: a second insert of the same key is rejected.
      expect(() => insertTenant(db, { tenantId: "gw-eeeeeeeeeeee", key: "co-consult::alice" })).toThrow(/UNIQUE/);

      // Idempotent re-run applies nothing.
      expect(runMigrations(db, REGISTRY_MIGRATION_STEPS)).toBe(0);
    } finally {
      db.close();
      cleanup(root, []);
    }
  });

  test("TenantRegistry boot on a duplicate-key registry.db refuses (constructor throws)", () => {
    const root = tempRoot("boot-refusal");
    mkdirSync(join(root, "tenants"), { recursive: true });
    const seed = new Database(join(root, "tenants", "registry.db"));
    createBaseTenants(seed);
    insertTenant(seed, { tenantId: "gw-aaaaaaaaaaaa", key: "co-consult::alice" });
    insertTenant(seed, { tenantId: "gw-bbbbbbbbbbbb", key: "co-consult::alice" });
    seed.close();
    expect(() => new TenantRegistry(root)).toThrow(RegistryKeyCollisionError);
    cleanup(root, []);
  });

  test("TenantRegistry on a clean db migrates at boot and keeps the legacy record personal", () => {
    const root = tempRoot("boot-clean");
    mkdirSync(join(root, "tenants"), { recursive: true });
    const seed = new Database(join(root, "tenants", "registry.db"));
    createBaseTenants(seed);
    insertTenant(seed, { tenantId: "gw-aaaaaaaaaaaa", key: "co-consult::alice", owner: "alice" });
    seed.close();
    const registry = new TenantRegistry(root);
    try {
      const rec = registry.get("gw-aaaaaaaaaaaa");
      expect(rec).toBeTruthy();
      expect(rec?.teamKind ?? "personal").toBe("personal");
      // A shared row survives a re-open (columns persisted through upsert).
      const shared = registry.create({
        variant: "co-consult",
        key: "co-consult::group:team-a",
        ownerPrincipal: "group:team-a",
        teamKind: "shared",
        ownerGroup: "team-a",
        name: "shared-team",
      });
      expect(shared.teamKind).toBe("shared");
      expect(shared.ownerGroup).toBe("team-a");
      // Storage: the shared team's top segment is the literal `shared`, not the owner string.
      expect(shared.projectDir).toContain(join("storage", "shared"));
    } finally {
      cleanup(root, [registry]);
    }
  });
});

describe("turns.db acting_principal migration (D-S4)", () => {
  /** A pre-round-3 turns.db: no acting_principal column, one legacy row. */
  function seedLegacyTurnsDb(dir: string): void {
    mkdirSync(join(dir, "tenants"), { recursive: true });
    const db = new Database(join(dir, "tenants", "turns.db"));
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec(`CREATE TABLE IF NOT EXISTS turns (
      tenant_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      session_id TEXT,
      exit_code INTEGER,
      final_text TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, seq)
    );`);
    db.query(
      "INSERT INTO turns (tenant_id, seq, session_id, exit_code, final_text, input_tokens, output_tokens, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("gw-aaaaaaaaaaaa", 1, "sess-old", 0, "legacy answer", 3, 4, "2026-11-01T00:00:00.000Z");
    db.close();
  }

  test("legacy rows keep acting_principal = NULL; new rows record the caller; PK unchanged", () => {
    const root = tempRoot("turns");
    // Capture every handle (the store AND the shape-probe reader): all must be closed in the
    // shared finally BEFORE cleanup's rmSync, or Windows keeps turns.db locked (EBUSY).
    const handles: Array<{ close(): void }> = [];
    try {
      seedLegacyTurnsDb(root);
      const store = new TurnStore(root);
      handles.push(store);
      // Legacy row: NULL attribution, rendered as before.
      const legacy = store.list("gw-aaaaaaaaaaaa");
      expect(legacy).toHaveLength(1);
      expect(legacy[0].actingPrincipal).toBeNull();
      expect(legacy[0].finalText).toBe("legacy answer");

      // New rows record the acting principal; seq allocation unchanged.
      store.record("gw-aaaaaaaaaaaa", { sessionId: "s2", exitCode: 0, finalText: "by alice", inputTokens: 1, outputTokens: 2, actingPrincipal: "alice" });
      store.record("gw-aaaaaaaaaaaa", { sessionId: "s3", exitCode: 0, finalText: "by bob", inputTokens: 1, outputTokens: 2 });
      const rows = store.list("gw-aaaaaaaaaaaa");
      expect(rows).toHaveLength(3);
      const bySeq = new Map(rows.map((r) => [r.seq, r]));
      expect(bySeq.get(2)?.actingPrincipal).toBe("alice");
      // Omitted actingPrincipal stays NULL (legacy/anonymous semantics).
      expect(bySeq.get(3)?.actingPrincipal).toBeNull();

      // (tenant_id, seq) remains the PK — the same seq is legal across tenants.
      store.record("gw-bbbbbbbbbbbb", { sessionId: "s4", exitCode: 0, finalText: "other tenant", inputTokens: 0, outputTokens: 0, actingPrincipal: "bob" });
      expect(store.list("gw-bbbbbbbbbbbb")[0].seq).toBe(1);
      const dbShape = new Database(join(root, "tenants", "turns.db"));
      handles.push(dbShape);
      const pk = (dbShape.query("PRAGMA table_info(turns)").all() as Array<{ name: string; pk: number }>)
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name);
      expect(pk).toEqual(["tenant_id", "seq"]);
      expect((dbShape.query("PRAGMA table_info(turns)").all() as Array<{ name: string }>).map((c) => c.name)).toContain("acting_principal");
    } finally {
      cleanup(root, handles);
    }
  });

  test("re-opening the store is idempotent (guarded ALTER)", () => {
    const root = tempRoot("turns-reopen");
    // Both instances (incl. the reopened one) captured: the second boot's handle must be
    // closed in the shared finally BEFORE cleanup's rmSync, or Windows EBUSYs the rm.
    const handles: Array<{ close(): void }> = [];
    try {
      seedLegacyTurnsDb(root);
      const first = new TurnStore(root);
      handles.push(first);
      first.close();
      const second = new TurnStore(root); // second boot: ALTER throws duplicate column → swallowed
      handles.push(second);
      expect(second.list("gw-aaaaaaaaaaaa")).toHaveLength(1);
    } finally {
      cleanup(root, handles);
    }
  });
});
