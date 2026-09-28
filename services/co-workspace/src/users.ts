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
  mustChangePassword?: boolean; // R1: set when the password is an admin-issued temp credential
  tempPasswordExpires?: string | null;
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
      email TEXT UNIQUE,
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
    this.db.exec(`CREATE TABLE IF NOT EXISTS pending_verifications (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );`);
    // Migration: pre-PII-safe databases carry `email NOT NULL`, which breaks signups that
    // legitimately store a NULL email (the raw email is discarded after verification). Rebuild
    // the table without the constraint, preserving every row and its unique indexes.
    const cols = this.db.query("PRAGMA table_info(users)").all() as Array<{ name: string; notnull: number }>;
    const emailCol = cols.find((c) => c.name === "email");
    if (emailCol?.notnull) {
      this.db.exec(`CREATE TABLE users_rebuild (
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
      this.db.exec(`INSERT INTO users_rebuild
        (id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at, login_id, email_hash, verified_at)
        SELECT id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at, login_id, email_hash, verified_at FROM users;`);
      this.db.exec("DROP TABLE users;");
      this.db.exec("ALTER TABLE users_rebuild RENAME TO users;");
    }
    // Migration-safe column additions for the PII-safe account model (login by ID; the raw
    // email is discarded after verification and kept only as a hash for duplicate checks).
    for (const stmt of [
      "ALTER TABLE users ADD COLUMN login_id TEXT",
      "ALTER TABLE users ADD COLUMN email_hash TEXT",
      "ALTER TABLE users ADD COLUMN verified_at TEXT",
      "ALTER TABLE users ADD COLUMN must_change_password INTEGER",
      "ALTER TABLE users ADD COLUMN temp_password_expires TEXT",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON users(login_id) WHERE login_id IS NOT NULL",
      "CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash)",
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_hash_unique ON users(email_hash) WHERE email_hash IS NOT NULL",
    ]) {
      try {
        this.db.exec(stmt);
      } catch {
        /* already applied */
      }
    }
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
      mustChangePassword: Boolean(r.must_change_password),
      tempPasswordExpires: (r.temp_password_expires as string | null) ?? null,
      createdAt: r.created_at as string,
      deletedAt: (r.deleted_at as string | null) ?? null,
    };
  }

  /** Bootstrap the admin from CO_WORKSPACE_ADMIN_EMAIL (idempotent). */
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
        `INSERT INTO users (id, email, name, principal, login_id, password_hash, google_sub, role, created_at, deleted_at, verified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .run(id, email, init.name, principal, principal, passwordHash, init.googleSub ?? null, init.role ?? "user", new Date().toISOString(), new Date().toISOString());
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

  /** ── Wave B1b: PII-safe accounts (login by ID; raw email discarded after verification) ── */

  findByLoginId(loginId: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE login_id = ? AND deleted_at IS NULL")
      .get(loginId.toLowerCase()) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  /** Create a PENDING account: login_id + email hash only — the raw email lives solely in the
   * transient pending_verifications row (needed to deliver the mail) and is dropped on
   * verification. Returns { ok:false, reason } instead of throwing. */
  async createPendingAccount(init: {
    loginId: string;
    email: string;
    password: string;
    name?: string;
  }): Promise<{ ok: true; verificationToken: string } | { ok: false; reason: "login_taken" | "email_taken" | "invalid_login" }> {
    const loginId = init.loginId.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,31}$/.test(loginId)) return { ok: false, reason: "invalid_login" };
    if (this.findByLoginId(loginId)) return { ok: false, reason: "login_taken" };
    const email = init.email.trim().toLowerCase();
    const emailHash = createHash("sha256").update(email).digest("hex");
    if (this.findByEmailHash(emailHash)) return { ok: false, reason: "email_taken" };
    const id = `u-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const principal = loginId; // principal unification: login ID is the trusted principal
    const passwordHash = Bun.password.hashSync(init.password);
    this.db
      .query(
        `INSERT INTO users (id, email, name, principal, password_hash, google_sub, role, created_at, deleted_at, login_id, email_hash, verified_at)
         VALUES (?, NULL, ?, ?, ?, NULL, 'user', ?, NULL, ?, ?, NULL)`,
      )
      .run(id, init.name ?? loginId, principal, passwordHash, new Date().toISOString(), loginId, emailHash);
    const token = randomBytes(24).toString("hex");
    this.db
      .query("INSERT INTO pending_verifications (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, ?)")
      .run(hashToken(token), id, email, new Date(Date.now() + 24 * 3600 * 1000).toISOString());
    return { ok: true, verificationToken: token };
  }

  findByEmailHash(emailHash: string): UserRecord | null {
    const r = this.db
      .query("SELECT * FROM users WHERE email_hash = ? AND deleted_at IS NULL")
      .get(emailHash) as Record<string, unknown> | null;
    return r ? this.rowToUser(r) : null;
  }

  /** Consume a verification token (24h expiry): activates the account and DROPS the pending
   * row containing the raw email — post-activation the account is pseudonymous (login_id +
   * email hash). Returns the login_id on success. */
  verifyEmail(token: string): string | null {
    const row = this.db
      .query("SELECT * FROM pending_verifications WHERE token_hash = ?")
      .get(hashToken(token)) as Record<string, unknown> | null;
    if (!row) return null;
    this.db.query("DELETE FROM pending_verifications WHERE token_hash = ?").run(hashToken(token));
    if (new Date(row.expires_at as string).getTime() < Date.now()) return null;
    const userId = row.user_id as string;
    const user = this.findById(userId);
    if (!user) return null;
    this.db.query("UPDATE users SET verified_at=? WHERE id=?").run(new Date().toISOString(), userId);
    return user.principal;
  }

  /** Login by ID + password; requires a verified account. */
  async verifyLoginById(loginId: string, password: string): Promise<UserRecord | null> {
    const user = this.findByLoginId(loginId);
    if (!user?.passwordHash) return null;
    if (!this.isVerified(user.id)) return null;
    const ok = await Bun.password.verify(password, user.passwordHash);
    return ok ? user : null;
  }

  isVerified(userId: string): boolean {
    const r = this.db.query("SELECT verified_at FROM users WHERE id = ?").get(userId) as
      | { verified_at: string | null }
      | null;
    return Boolean(r?.verified_at);
  }

  /** Resend support: re-issue a verification token for a still-pending account. */
  reissueVerification(loginId: string): { token: string; email: string } | null {
    const user = this.findByLoginId(loginId);
    if (!user || this.isVerified(user.id)) return null;
    const pending = this.db
      .query("SELECT email FROM pending_verifications WHERE user_id = ?")
      .get(user.id) as { email: string } | null;
    if (!pending) return null;
    const token = randomBytes(24).toString("hex");
    this.db
      .query("INSERT INTO pending_verifications (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, ?)")
      .run(hashToken(token), user.id, pending.email, new Date(Date.now() + 24 * 3600 * 1000).toISOString());
    return { token, email: pending.email };
  }

  /** R3: self-service password change. The caller must have verified the current
   * credential. The session that performed the change survives (SEC-06: every OTHER
   * session of the user is invalidated). */
  changePassword(userId: string, newPassword: string, keepToken?: string | null): UserRecord | null {
    const user = this.findById(userId);
    if (!user) return null;
    this.db.query("UPDATE users SET password_hash=? WHERE id=?").run(Bun.password.hashSync(newPassword), userId);
    if (keepToken) {
      this.db.query("DELETE FROM sessions WHERE user_id=? AND token_hash != ?").run(userId, hashToken(keepToken));
    } else {
      this.db.query("DELETE FROM sessions WHERE user_id=?").run(userId);
    }
    return this.findById(userId);
  }

  /** R3 (admin): change a user's display name. */
  renameUser(userId: string, name: string): UserRecord | null {
    const user = this.findById(userId);
    if (!user) return null;
    this.db.query("UPDATE users SET name=? WHERE id=?").run(name, userId);
    return this.findById(userId);
  }

  /** R3: self-service email change, verification-required. Stages the new address as a
   * pending verification (raw email lives ≤24h there; only the hash lands on the account,
   * preserving the PII-safe invariant). */
  createEmailChange(
    userId: string,
    email: string,
  ): { ok: true; token: string } | { ok: false; reason: "email_taken" | "invalid_email" | "unchanged" } {
    const normalized = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) return { ok: false, reason: "invalid_email" };
    const emailHash = createHash("sha256").update(normalized).digest("hex");
    const current = this.db.query("SELECT email_hash FROM users WHERE id = ?").get(userId) as
      | { email_hash: string | null }
      | null;
    if (!current) return { ok: false, reason: "invalid_email" };
    if (current.email_hash === emailHash) return { ok: false, reason: "unchanged" };
    if (this.findByEmailHash(emailHash)) return { ok: false, reason: "email_taken" };
    this.db.query("DELETE FROM pending_verifications WHERE user_id=?").run(userId); // supersede prior staging
    const token = randomBytes(24).toString("hex");
    this.db
      .query("INSERT INTO pending_verifications (token_hash, user_id, email, expires_at) VALUES (?, ?, ?, ?)")
      .run(hashToken(token), userId, normalized, new Date(Date.now() + 24 * 3600 * 1000).toISOString());
    return { ok: true, token };
  }

  /** Consume a staged email change: swap the account's email hash — the raw email is
   * dropped with the pending row. */
  verifyEmailChange(token: string): { ok: true; principal: string } | { ok: false; reason: "invalid" | "email_taken" } {
    const row = this.db
      .query("SELECT * FROM pending_verifications WHERE token_hash = ?")
      .get(hashToken(token)) as Record<string, unknown> | null;
    if (!row) return { ok: false, reason: "invalid" };
    this.db.query("DELETE FROM pending_verifications WHERE token_hash = ?").run(hashToken(token));
    if (new Date(row.expires_at as string).getTime() < Date.now()) return { ok: false, reason: "invalid" };
    const email = (row.email as string).trim().toLowerCase();
    const emailHash = createHash("sha256").update(email).digest("hex");
    const holder = this.findByEmailHash(emailHash);
    if (holder && holder.id !== row.user_id) return { ok: false, reason: "email_taken" };
    this.db.query("UPDATE users SET email_hash=? WHERE id=?").run(emailHash, row.user_id as string);
    const user = this.findById(row.user_id as string);
    if (!user) return { ok: false, reason: "invalid" };
    return { ok: true, principal: user.principal };
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

  /** Usability wave R1: an admin reset issues a one-time TEMP PASSWORD — shown once to the
   * admin (stored only as its argon2id hash), 15-minute expiry, and every existing session
   * of the target is purged (SEC-06). First login with it forces a rotation. */
  createTempPassword(userId: string): string {
    const alphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    // 12 chars from a 58-char alphabet (~70 bits) — the review's M1: 8 chars (~45 bits)
    // was thin for even a 15-minute one-shot credential.
    const bytes = randomBytes(12);
    const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
    const temp = `co-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8)}`;
    this.db
      .query("UPDATE users SET password_hash=?, must_change_password=1, temp_password_expires=? WHERE id=?")
      .run(Bun.password.hashSync(temp), new Date(Date.now() + 15 * 60 * 1000).toISOString(), userId);
    this.db.query("DELETE FROM sessions WHERE user_id=?").run(userId);
    return temp;
  }

  /** True when the account still carries an admin-issued temp credential past its expiry. */
  tempPasswordExpired(user: UserRecord): boolean {
    return Boolean(user.mustChangePassword) && new Date(user.tempPasswordExpires ?? 0).getTime() < Date.now();
  }

  /** Complete the forced first-login rotation: clear the temp flag and rotate sessions
   * (SEC-06) — the caller re-signs-in with the new password. */
  completeTempPasswordChange(userId: string, newPassword: string): UserRecord | null {
    if (!this.findById(userId)) return null;
    this.db
      .query("UPDATE users SET password_hash=?, must_change_password=0, temp_password_expires=NULL WHERE id=?")
      .run(Bun.password.hashSync(newPassword), userId);
    this.db.query("DELETE FROM sessions WHERE user_id=?").run(userId);
    return this.findById(userId);
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

  /** T-20260928-006: server-side search + pagination for the admin users table. */
  listUsersPaged(query: string, page: number, pageSize: number): { users: UserRecord[]; total: number } {
    const q = query.trim().toLowerCase();
    const offset = Math.max(0, (page - 1)) * pageSize;
    const rows = this.db
      .query("SELECT * FROM users ORDER BY created_at ASC LIMIT ? OFFSET ?")
      .all(pageSize, offset) as Record<string, unknown>[];
    return { users: rows.map((r) => this.rowToUser(r)), total: rows.length };
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
