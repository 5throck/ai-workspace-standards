/**
 * Wave B1 (P12): local user accounts — users + sessions tables, signup, login, profile.
 * Security invariants (second meeting): `Bun.password` argon2id hashing; session tokens stored
 * hashed with HttpOnly cookies; principal unification — `user.principal` is the trusted label
 * (default: email local-part) and key-file labels must match it or fall to "default".
 * Google SSO links by verified email (Wave B2) into the same users table.
 */

import { Database } from "bun:sqlite";
import { randomBytes, createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  principal: string;
  passwordHash: string | null; // null for SSO-only accounts
  googleSub: string | null;
  role: "user" | "admin";
  createdAt: string;
  deletedAt: string | null;
}

export interface SessionInfo {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function principalFromEmail(email: string): string {
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-");
}

export class UserStore {
  private readonly db: Database;

  constructor(dataDir: string) {
    const dir = join(dataDir, "tenants");
    mkdirSync(dir, { recursive: true });
    this.db = new Database(join(dir, "users.db"));
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS users (
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );`);
  }

  private rowToUser(r: Record<string, unknown>): UserRecord {
    return {
      id: r.id as string,
      email: r.email as string,
      name: r.name as string,
      principal: r.principal as string,
      passwordHash: (r.password_hash as string | null) ?? null,
      googleSub: (r.google_sub as string | null) ?? null,
      role: (r.role as "user" | "admin") ?? "user",
      createdAt: r.created_at as string,
      deletedAt: (r.deleted_at as string | null) ?? null,
    };
  }

  /** Bootstrap the admin from TEAM_GATEWAY_ADMIN_EMAIL (idempotent). */
  bootstrapAdmin(email: string): UserRecord | null {
    const existing = this.findByEmail(email);
    if (existing) {
      if (existing.role !== "admin") {
        this.db.query("UPDATE users SET role='admin' WHERE id=?").run(existing.id);
        return { ...existing, role: "admin" };
      }
      return existing;
    }
    return this.createUser({
      email,
      name: email.split("@")[0],
      password: null,
      role: "admin",
    });
  }

  createUser(init: {
    email: string;
    name: string;
    password: string | null;
    role?: "user" | "admin";
    googleSub?: string;
  }): UserRecord | null {
    const email = init.email.trim().toLowerCase();
    if (this.findByEmail(email)) return null; // already exists
    let principal = principalFromEmail(email);
    if (this.findByPrincipal(principal)) principal = `${principal}-${randomBytes(2).toString("hex")}`;
    const id = `u-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const passwordHash = init.password ? Bun.password.hashSync(init.password) : null;
    this.db
      .query(
        `INSERT INTO users (id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .run(id, email, init.name, principal, passwordHash, init.googleSub ?? null, init.role ?? "user", new Date().toISOString());
    return this.findByEmail(email);
  }

  findByEmail(email: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE email = ? AND deleted_at IS NULL")
      .get(email.trim().toLowerCase()) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  findById(id: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE id = ? AND deleted_at IS NULL")
      .get(id) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  findByPrincipal(principal: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE principal = ? AND deleted_at IS NULL")
      .get(principal) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  findByGoogleSub(googleSub: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE google_sub = ? AND deleted_at IS NULL")
      .get(googleSub) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  /** Verify credentials for local login; null = invalid. */
  async verifyLogin(email: string, password: string): Promise<UserRecord | null> {
    const user = this.findByEmail(email);
    if (!user?.passwordHash) return null;
    const ok = await Bun.password.verify(password, user.passwordHash);
    return ok ? user : null;
  }

  updateProfile(userId: string, patch: { name?: string; password?: string }): UserRecord | null {
    const user = this.findById(userId);
    if (!user) return null;
    if (patch.name) {
      this.db.query("UPDATE users SET name=? WHERE id=?").run(patch.name, userId);
    }
    if (patch.password) {
      this.db
        .query("UPDATE users SET password_hash=? WHERE id=?")
        .run(Bun.password.hashSync(patch.password), userId);
    }
    return this.findById(userId);
  }

  /** Create a login session; returns the raw token (cookie value). Stored hashed. */
  createSession(userId: string): string {
    const token = randomBytes(32).toString("hex");
    this.db
      .query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), userId, new Date(Date.now() + SESSION_TTL_MS).toISOString());
    return token;
  }

  resolveSession(token: string | undefined): UserRecord | null {
    if (!token) return null;
    const row = this.db
      .query("SELECT * FROM sessions WHERE token_hash = ?")
      .get(hashToken(token)) as Record<string, unknown> | null;
    if (!row) return null;
    if (new Date(row.expires_at as string).getTime() < Date.now()) {
      this.db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
      return null;
    }
    return this.findById(row.user_id as string);
  }

  destroySession(token: string | undefined): void {
    if (token) this.db.query("DELETE FROM sessions WHERE token_hash = ?").run(hashToken(token));
  }

  /** Wave B3: one-time password-reset token (returned raw, stored hashed, 15-min expiry). */
  createResetToken(userId: string): string {
    const token = randomBytes(24).toString("hex");
    this.db
      .query("INSERT INTO reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
      .run(hashToken(token), userId, new Date(Date.now() + 15 * 60 * 1000).toISOString());
    return token;
  }

  consumeResetToken(token: string): string | null {
    const row = this.db
      .query("SELECT * FROM reset_tokens WHERE token_hash = ?")
      .get(hashToken(token)) as Record<string, unknown> | null;
    if (!row) return null;
    this.db.query("DELETE FROM reset_tokens WHERE token_hash = ?").run(hashToken(token));
    if (new Date(row.expires_at as string).getTime() < Date.now()) return null;
    return row.user_id as string;
  }

  /** Wave B2: record the Google subject on an account linked by verified email. */
  linkGoogleSub(userId: string, googleSub: string): void {
    this.db.query("UPDATE users SET google_sub=? WHERE id=?").run(googleSub, userId);
  }

  /** Wave B3: user listing for admins (includes soft-deleted). */
  listUsers(): UserRecord[] {
    const rows = this.db.query("SELECT * FROM users ORDER BY created_at ASC").all() as Record<string, unknown>[];
    return rows.map((r) => this.rowToUser(r));
  }

  /** Wave B3: soft delete a user (archive). Tenants are handled by the caller. */
  softDeleteUser(userId: string): boolean {
    const user = this.findById(userId);
    if (!user) return false;
    this.db
      .query("UPDATE users SET deleted_at=? WHERE id=?")
      .run(new Date().toISOString(), userId);
    this.db.query("DELETE FROM sessions WHERE user_id=?").run(userId);
    return true;
  }
}

/** Extract the session token from the cookie header. */
export function sessionTokenFromCookie(req: Request): string | undefined {
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  const match = cookie.match(/(?:^|;\s*)gw_session=([^;]+)/);
  return match?.[1];
}

export function sessionCookieHeader(token: string, secure = false): string {
  const flags = `HttpOnly; Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}${secure ? "; Secure" : ""}`;
  return `gw_session=${token}; ${flags}`;
}

export function clearCookieHeader(): string {
  return "gw_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}
