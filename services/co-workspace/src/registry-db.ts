/**
 * TenantRegistry — SQLite store (bun:sqlite), Phase 3 persistence (user request: "DB로 관리,
 * 향후 postgres 확장"). The class API is deliberately storage-agnostic (get/upsert/create/
 * findByKey/list) so a Postgres implementation can replace the file behind the same interface.
 *
 * Schema (single table, JSON columns for nested fields — Postgres migration maps these to
 * JSONB):
 *   tenants(tenant_id TEXT PK, variant TEXT, status TEXT, name TEXT, owner_principal TEXT,
 *           key TEXT, created_at TEXT, data TEXT)   -- data = full TenantRecord JSON
 * JSON-in-column keeps the record shape versionable; queries that need indexing later
 * (owner_principal, key) are already real columns.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { genId } from "./util";
import type { TenantRecord } from "./tenant";
import { REGISTRY_MIGRATION_STEPS, runMigrations } from "./migrations";

export class TenantRegistry {
  private readonly db: Database;
  private readonly dataDir: string;
  readonly registryPath: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    const dir = join(dataDir, "tenants");
    mkdirSync(dir, { recursive: true });
    this.registryPath = join(dir, "registry.db");
    this.db = new Database(this.registryPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS tenants (
      tenant_id TEXT PRIMARY KEY,
      variant TEXT NOT NULL,
      status TEXT NOT NULL,
      name TEXT,
      owner_principal TEXT,
      key TEXT,
      created_at TEXT NOT NULL,
      data TEXT NOT NULL
    );`);
    // Note: no plain idx_tenants_key is created here any more — registry migration v5
    // replaces it with the UNIQUE idx_tenants_key_unique (shared-teams design §4). Creating
    // the non-unique twin at every boot would resurrect a dropped index on migrated DBs.
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_principal);");
    // Migration: import the legacy registry.json on first run with an empty table.
    this.migrateLegacy(join(dataDir, "tenants", "registry.json"));
    // Registry migrations run through the SAME versioned runner as users.db (PRAGMA
    // user_version, downgrade guard) against this store's own steps — the registry versions
    // separately (see migrations.ts). A duplicate-key database throws RegistryKeyCollisionError
    // out of this constructor: the gateway refuses to boot (fail-closed, design §4).
    // QA S3 (2026-11-11): the refusal must not leak the handle — an object whose constructor
    // threw is unreachable, so nothing could ever close it (the UserStore pattern, users.ts);
    // on Windows the locked registry.db then blocks deletion/repair until process exit.
    try {
      runMigrations(this.db, REGISTRY_MIGRATION_STEPS);
    } catch (err) {
      this.db.close();
      throw err;
    }
  }

  /** Release the SQLite handle (checkpoints WAL); needed before deleting the data dir on Windows. */
  close(): void {
    this.db.close();
  }

  private migrateLegacy(jsonPath: string): void {
    try {
      if (!existsSync(jsonPath)) return;
      const legacy = JSON.parse(readFileSync(jsonPath, "utf8")) as TenantRecord[];
      if (!Array.isArray(legacy) || legacy.length === 0) return;
      const count = this.db.query("SELECT COUNT(*) AS n FROM tenants").get() as { n: number };
      if (count.n > 0) return;
      for (const rec of legacy) this.upsert(rec);
    } catch (err) {
      console.error("[co-workspace] legacy registry.json unreadable, starting fresh:", (err as Error).message);
    }
  }

  list(): TenantRecord[] {
    const rows = this.db
      .query("SELECT data FROM tenants ORDER BY created_at ASC, tenant_id ASC")
      .all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as TenantRecord);
  }

  get(tenantId: string): TenantRecord | undefined {
    const row = this.db.query("SELECT data FROM tenants WHERE tenant_id = ?").get(tenantId) as
      | { data: string }
      | null;
    return row ? (JSON.parse(row.data) as TenantRecord) : undefined;
  }

  findByKey(key: string): TenantRecord | undefined {
    const row = this.db
      .query("SELECT data FROM tenants WHERE key = ? ORDER BY created_at ASC LIMIT 1")
      .get(key) as { data: string } | null;
    return row ? (JSON.parse(row.data) as TenantRecord) : undefined;
  }

  upsert(rec: TenantRecord): void {
    this.db
      .query(
        `INSERT INTO tenants (tenant_id, variant, status, name, owner_principal, key, created_at, data, team_kind, owner_group)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET
           variant=excluded.variant, status=excluded.status, name=excluded.name,
           owner_principal=excluded.owner_principal, key=excluded.key,
           created_at=excluded.created_at, data=excluded.data,
           team_kind=excluded.team_kind, owner_group=excluded.owner_group`,
      )
      .run(
        rec.tenantId,
        rec.variant,
        rec.status,
        rec.name ?? null,
        rec.ownerPrincipal ?? null,
        rec.key ?? null,
        rec.createdAt,
        JSON.stringify(rec),
        rec.teamKind ?? "personal",
        rec.ownerGroup ?? null,
      );
  }

  /** Delete a tenant row; returns the record that was deleted (caller removes its files). */
  delete(tenantId: string): TenantRecord | undefined {
    const rec = this.get(tenantId);
    if (!rec) return undefined;
    this.db.query("DELETE FROM tenants WHERE tenant_id = ?").run(tenantId);
    return rec;
  }

  /** `dataDir` was removed from init (2026-10-03 review M17): the class already knows it
   * from the constructor — callers re-passing `state.cfg.dataDir` invited divergence. */
  create(init: {
    variant: string;
    key?: string;
    name?: string;
    description?: string;
    ownerPrincipal?: string;
    /** Shared teams (round-3 D-S1): the record is owned by a user group — `ownerPrincipal`
     * carries the synthetic `group:<id>` principal and `ownerGroup` the raw group id. */
    teamKind?: "shared";
    ownerGroup?: string;
    /** ADR-0092 Addendum 17 attach-mode: `kind: "attached"` requires `projectDir` (the
     * resolved existing checkout under Projects/co-*) and skips the storage `project` leaf —
     * the per-session scratch is created there by the attach provisioning branch instead. */
    kind?: "attached";
    attachHub?: string;
    attachProviderKey?: string;
    attachToolsets?: string;
    projectDir?: string;
  }): TenantRecord {
    const tenantId = genId("gw");
    // Storage layout (user request): tenants live under <dataDir>/storage/<principal>/<name>/
    // — per-user grouping on disk. The scaffold still runs in the workspace clone's Projects/
    // (engine constraint) and is relocated here immediately after. Shared teams keep the same
    // two-segment shape with the literal `shared` top segment (a `group:<id>` string is not a
    // filesystem-safe principal segment) — tenantFolderOf still resolves their real folder, so
    // sweepOrphanedStorage keeps them.
    const shared = init.teamKind === "shared";
    const principal = shared ? "shared" : (init.ownerPrincipal ?? "shared");
    const folder = init.name || tenantId;
    const storageRoot = join(this.dataDir, "storage", principal, folder);
    const attached = init.kind === "attached";
    const rec: TenantRecord = {
      tenantId,
      key: init.key,
      variant: init.variant,
      status: "provisioning",
      createdAt: new Date().toISOString(),
      // Attach: the existing checkout IS the project dir (no relocate); homes + the scratch
      // stay under gateway storage so detach can drop them without touching the hub tree.
      projectDir: attached ? resolve(init.projectDir!) : join(storageRoot, "project"),
      hermesHome: join(storageRoot, "hermes-home"),
      description: init.description,
      name: init.name,
      ownerPrincipal: init.ownerPrincipal,
      ...(shared ? { teamKind: "shared" as const, ownerGroup: init.ownerGroup } : {}),
      sessions: 0,
      inputTokens: 0,
      outputTokens: 0,
      ...(attached
        ? {
            kind: "attached" as const,
            attachHub: resolve(init.attachHub ?? init.projectDir!),
            ...(init.attachProviderKey ? { attachProviderKey: init.attachProviderKey } : {}),
            ...(init.attachToolsets ? { attachToolsets: init.attachToolsets } : {}),
          }
        : {}),
    };
    this.upsert(rec);
    return rec;
  }
}
