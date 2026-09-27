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
import { join } from "node:path";
import { genId } from "./util";
import type { TenantRecord } from "./tenant";

export class TenantRegistry {
  private readonly db: Database;
  readonly registryPath: string;

  constructor(dataDir: string) {
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
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_key ON tenants(key);");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_principal);");
    // Migration: import the legacy registry.json on first run with an empty table.
    this.migrateLegacy(join(dataDir, "tenants", "registry.json"));
  }

  private migrateLegacy(jsonPath: string): void {
    try {
      if (!existsSync(jsonPath)) return;
      const legacy = JSON.parse(readFileSync(jsonPath, "utf8")) as TenantRecord[];
      if (!Array.isArray(legacy) || legacy.length === 0) return;
      const count = this.db.query("SELECT COUNT(*) AS n FROM tenants").get() as { n: number };
      if (count.n > 0) return;
      for (const rec of legacy) this.upsert(rec);
    } catch {
      /* unreadable legacy file — start fresh */
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
        `INSERT INTO tenants (tenant_id, variant, status, name, owner_principal, key, created_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(tenant_id) DO UPDATE SET
           variant=excluded.variant, status=excluded.status, name=excluded.name,
           owner_principal=excluded.owner_principal, key=excluded.key,
           created_at=excluded.created_at, data=excluded.data`,
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
      );
  }

  /** Delete a tenant row; returns the record that was deleted (caller removes its files). */
  delete(tenantId: string): TenantRecord | undefined {
    const rec = this.get(tenantId);
    if (!rec) return undefined;
    this.db.query("DELETE FROM tenants WHERE tenant_id = ?").run(tenantId);
    return rec;
  }

  create(init: {
    dataDir: string;
    variant: string;
    key?: string;
    name?: string;
    description?: string;
    ownerPrincipal?: string;
  }): TenantRecord {
    const tenantId = genId("gw");
    const rec: TenantRecord = {
      tenantId,
      key: init.key,
      variant: init.variant,
      status: "provisioning",
      createdAt: new Date().toISOString(),
      projectDir: join(init.dataDir, "tenants", tenantId, "project"),
      hermesHome: join(init.dataDir, "tenants", tenantId, "hermes-home"),
      description: init.description,
      name: init.name,
      ownerPrincipal: init.ownerPrincipal,
      sessions: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    this.upsert(rec);
    return rec;
  }
}
