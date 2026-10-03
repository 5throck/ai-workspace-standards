/**
 * Backlog wave (SEC-05/09/12/14, QA-07/10): rate limiting, CSRF guard, audit log,
 * outbox expiry. Zero new dependencies — in-memory limiter, SQLite audit table.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { hashToken } from "./users";

/** SEC-05: fixed-window in-memory rate limiter (per bucket key). Single-process only —
 * a multi-instance deployment needs a shared store. */
export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly max: number, private readonly windowMs: number) {}

  /** True when the request is allowed; consumes one slot otherwise records the hit. */
  allow(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count < this.max) {
      bucket.count += 1;
      return true;
    }
    return false;
  }

  /** Test/ops helper. */
  reset(key?: string): void {
    if (key) this.buckets.delete(key);
    else this.buckets.clear();
  }
}

/** SEC-12: append-only audit log (SQLite, same data dir as the other stores). */
export class AuditLog {
  private readonly db: Database;

  constructor(dataDir: string) {
    const dir = join(dataDir, "tenants");
    mkdirSync(dir, { recursive: true });
    this.db = new Database(join(dir, "audit.db"));
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT,
      detail TEXT
    );`);
  }

  record(actor: string, action: string, target?: string, detail?: string): void {
    this.db
      .query("INSERT INTO audit (at, actor, action, target, detail) VALUES (?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), actor, action, target ?? null, detail?.slice(0, 500) ?? null);
  }

  list(limit = 100): Array<{ at: string; actor: string; action: string; target: string | null; detail: string | null }> {
    return this.db
      .query("SELECT at, actor, action, target, detail FROM audit ORDER BY id DESC LIMIT ?")
      .all(limit) as Array<{ at: string; actor: string; action: string; target: string | null; detail: string | null }>;
  }

  /** Graceful shutdown (2026-10-03 review H3): checkpoint WAL before process exit. */
  close(): void {
    this.db.close();
  }
}

/** SEC-09: CSRF guard — mutating routes must carry a custom header a cross-site form cannot
 * set without a CORS preflight (the server sends none). Only a valid API-key/Bearer credential
 * is exempt: browsers attach session cookies automatically, so a cookie must not exempt. */
export function csrfRequired(cfg: { csrfRequired: boolean }, hasApiKeyCredential: boolean): boolean {
  if (!cfg.csrfRequired) return false;
  return !hasApiKeyCredential;
}

/** SEC-14: delete outbox files older than `maxAgeMs` (default 24h). Runs at startup. */
export function sweepOutbox(dataDir: string, maxAgeMs = 24 * 3600 * 1000): number {
  const dir = join(dataDir, "mail-outbox");
  if (!existsSync(dir)) return 0;
  let removed = 0;
  const cutoff = Date.now() - maxAgeMs;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      if (statSync(full).mtimeMs < cutoff) {
        unlinkSync(full);
        removed += 1;
      }
    } catch {
      /* raced */
    }
  }
  return removed;
}
