/**
 * Wave A (P11): tenant files + turn history.
 * - listTenantFiles / readTenantFile: tenant-confined, read-only path resolution with a
 *   denylist (`.env`, `auth.json`, `*-home`, anything outside the project dir) and size caps.
 * - TurnStore: per-turn event summaries persisted in SQLite (turns table), pruned to the
 *   last 100 turns per tenant (C4).
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const MAX_FILE_BYTES = 256 * 1024;
const DENYLIST_NAMES = new Set([".env", "auth.json", "auth.lock", "state.db", "state.db-wal", "state.db-shm"]);

export interface FileEntry {
  name: string;
  type: "file" | "dir";
  size?: number;
  modified?: string;
}

/** Resolve a user-supplied path INSIDE the tenant project dir; null = rejected. */
function safeResolve(projectDir: string, relPath: string): string | null {
  const root = realpathSync(projectDir);
  const target = join(root, relPath);
  const rel = relative(root, target);
  if (rel.startsWith("..") || rel === "" || target.includes(`${sep}.git`)) return null;
  if (!existsSync(target)) return null;
  const real = realpathSync(target);
  if (!real.startsWith(root + sep) && real !== root) return null;
  if (DENYLIST_NAMES.has(target.split(sep).pop() ?? "")) return null;
  return target;
}

export function listTenantFiles(projectDir: string, relPath = ""): FileEntry[] | null {
  let target: string | null;
  try {
    target = safeResolve(projectDir, relPath);
  } catch {
    return null;
  }
  if (!target) return null;
  if (!statSync(target).isDirectory()) return null;
  const out: FileEntry[] = [];
  for (const name of readdirSync(target).sort()) {
    if (DENYLIST_NAMES.has(name) || name === ".git") continue;
    const full = join(target, name);
    const st = statSync(full);
    out.push({
      name,
      type: st.isDirectory() ? "dir" : "file",
      size: st.isFile() ? st.size : undefined,
      modified: st.mtime.toISOString(),
    });
  }
  return out;
}

/** Read a file's text content; null = rejected, { tooLarge: true } = over cap. */
export function readTenantFile(
  projectDir: string,
  relPath: string,
): { content: string } | null | { tooLarge: true } {
  let target: string | null;
  try {
    target = safeResolve(projectDir, relPath);
  } catch {
    return null;
  }
  if (!target) return null;
  if (!statSync(target).isFile()) return null;
  const size = statSync(target).size;
  if (size > MAX_FILE_BYTES) return { tooLarge: true };
  try {
    return { content: readFileSync(target, "utf8") };
  } catch {
    return null;
  }
}

export interface TurnRecord {
  tenantId: string;
  seq: number;
  sessionId: string | null;
  exitCode: number | null;
  finalText: string;
  inputTokens: number;
  outputTokens: number;
  at: string;
}

const MAX_TURNS_PER_TENANT = 100;

/** Wave A/C4: per-turn summaries, pruned to the last 100 per tenant. */
export class TurnStore {
  private readonly db: Database;

  constructor(dataDir: string) {
    const dir = join(dataDir, "tenants");
    mkdirSync(dir, { recursive: true });
    this.db = new Database(join(dir, "turns.db"));
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS turns (
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
  }

  record(tenantId: string, turn: Omit<TurnRecord, "tenantId" | "seq" | "at">): void {
    const row = this.db
      .query("SELECT COALESCE(MAX(seq), 0) AS max FROM turns WHERE tenant_id = ?")
      .get(tenantId) as { max: number };
    const seq = row.max + 1;
    this.db
      .query(
        `INSERT INTO turns (tenant_id, seq, session_id, exit_code, final_text, input_tokens, output_tokens, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tenantId,
        seq,
        turn.sessionId ?? null,
        turn.exitCode ?? null,
        turn.finalText.slice(0, 4000),
        turn.inputTokens,
        turn.outputTokens,
        new Date().toISOString(),
      );
    // C4: prune to the last MAX_TURNS_PER_TENANT per tenant.
    this.db
      .query(
        `DELETE FROM turns WHERE tenant_id = ? AND seq <=
         (SELECT MAX(seq) - ? FROM turns WHERE tenant_id = ?)`,
      )
      .run(tenantId, MAX_TURNS_PER_TENANT, tenantId);
  }

  /** Admin stats: global turn/token totals. */
  aggregate(): { totalTurns: number; totalInputTokens: number; totalOutputTokens: number } {
    const row = this.db
      .query(
        "SELECT COUNT(*) AS n, COALESCE(SUM(input_tokens),0) AS i, COALESCE(SUM(output_tokens),0) AS o FROM turns",
      )
      .get() as { n: number; i: number; o: number };
    return { totalTurns: row.n, totalInputTokens: row.i, totalOutputTokens: row.o };
  }

  /** Turn counts grouped by tenant (for per-user rollups). */
  countsByTenant(): Map<string, number> {
    const rows = this.db
      .query("SELECT tenant_id, COUNT(*) AS n FROM turns GROUP BY tenant_id")
      .all() as { tenant_id: string; n: number }[];
    return new Map(rows.map((r) => [r.tenant_id, r.n]));
  }

  list(tenantId: string, limit = 50): TurnRecord[] {
    const rows = this.db
      .query(
        "SELECT * FROM turns WHERE tenant_id = ? ORDER BY seq DESC LIMIT ?",
      )
      .all(tenantId, limit) as Record<string, unknown>[];
    return rows.map((r) => ({
      tenantId: r.tenant_id as string,
      seq: r.seq as number,
      sessionId: (r.session_id as string | null) ?? null,
      exitCode: (r.exit_code as number | null) ?? null,
      finalText: (r.final_text as string) ?? "",
      inputTokens: (r.input_tokens as number) ?? 0,
      outputTokens: (r.output_tokens as number) ?? 0,
      at: r.at as string,
    }));
  }
}
