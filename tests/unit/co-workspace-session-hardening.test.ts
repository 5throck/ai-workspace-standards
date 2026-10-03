/**
 * Tests for the 2026-10-03 session-hardening batch (ticket T-20261003-027):
 * operator-configurable session windows (design D1), the route-level session
 * management endpoints (D6), destructive-admin password re-confirmation (D4),
 * and the passwordless-admin one-time password-set force (sub-feature 4).
 * The store-level expiry tests live in co-workspace-review-remediation.test.ts;
 * this file covers the route contracts and the sub-feature-4 gate.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { handleAuth } from "../../services/co-workspace/src/routes/auth";
import { handleAdmin } from "../../services/co-workspace/src/routes/admin";
import { handleTenants } from "../../services/co-workspace/src/routes/tenants";
import { requireTenantAccess } from "../../services/co-workspace/src/access";
import { createState } from "../../services/co-workspace/src/state";
import { hashToken } from "../../services/co-workspace/src/users";
import { HttpError } from "../../services/co-workspace/src/http";
import type { GatewayState } from "../../services/co-workspace/src/state";
import type { Ctx } from "../../services/co-workspace/src/routes/ctx";

const ROOTS: string[] = [];
function scratch(name: string): string {
  const dir = join(tmpdir(), `gw-sesshard-${name}-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  ROOTS.push(dir);
  return dir;
}
const STATES: GatewayState[] = [];
afterAll(() => {
  for (const state of STATES) {
    for (const store of [state.registry, state.turns, state.users, state.audit]) {
      try { store.close(); } catch { /* best effort */ }
    }
  }
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true });
});

function sandboxedState(name: string, env: Record<string, string> = {}): GatewayState {
  const state = createState(loadConfig({
    CO_WORKSPACE_DATA_DIR: scratch(name),
    CO_WORKSPACE_WORKSPACE_DIR: scratch(`${name}-ws`),
    ...env,
  }));
  STATES.push(state);
  return state;
}

function ctxFor(state: GatewayState, token: string | undefined, path: string): Ctx {
  return { url: new URL(`http://x${path}`), path, sessionUser: state.users.resolveSession(token), clientIp: "local" };
}

function authed(path: string, token: string, init: { method?: string; body?: string; adminPassword?: string } = {}): Request {
  return new Request(`http://x${path}`, {
    method: init.method ?? "GET",
    headers: {
      cookie: `gw_session=${token}`,
      "content-type": "application/json",
      ...(init.adminPassword ? { "x-admin-password": init.adminPassword } : {}),
    },
    body: init.body,
  });
}

/** handleAdmin/handleAuth propagate HttpError (the catch lives in handleRequest) —
 * normalize either outcome to { status, message }. */
async function statusOf(promise: Promise<Response | null>): Promise<{ status: number; message: string }> {
  try {
    const res = await promise;
    return { status: res?.status ?? 0, message: res ? JSON.stringify(await res.json()) : "" };
  } catch (err) {
    const e = err as HttpError;
    return { status: e.status, message: e.message };
  }
}

function catchOf(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    return err as HttpError;
  }
  throw new Error("expected fn to throw");
}

// ── D1: the operator-facing env knobs map to the store's ms windows ──
describe("operator-configurable session windows (D1)", () => {
  test("CO_WORKSPACE_SESSION_TTL_HOURS / CO_WORKSPACE_SESSION_IDLE_HOURS map to ms", () => {
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("cfg-hours"),
      CO_WORKSPACE_SESSION_TTL_HOURS: "2",
      CO_WORKSPACE_SESSION_IDLE_HOURS: "1",
    });
    expect(cfg.sessionTtlMs).toBe(2 * 3600 * 1000);
    expect(cfg.sessionIdleMs).toBe(1 * 3600 * 1000);
  });

  test("defaults are 24h absolute / 4h idle", () => {
    const cfg = loadConfig({ CO_WORKSPACE_DATA_DIR: scratch("cfg-defaults") });
    expect(cfg.sessionTtlMs).toBe(24 * 3600 * 1000);
    expect(cfg.sessionIdleMs).toBe(4 * 3600 * 1000);
  });
});

// ── D6: the user-facing session routes ──
describe("user-facing session routes (D6)", () => {
  const state = sandboxedState("routes");
  const user = state.users.createUser({ email: "sess@test.local", name: "sess", password: "longenough1" })!;
  const keep = state.users.createSession(user.id);
  state.users.createSession(user.id);

  test("GET /auth/sessions lists own sessions with metadata, never token values", async () => {
    const res = await handleAuth(state, authed("/auth/sessions", keep), ctxFor(state, keep, "/auth/sessions"));
    expect(res?.status).toBe(200);
    const body = (await res!.json()) as { sessions: Array<Record<string, unknown>> };
    expect(body.sessions.length).toBe(2);
    expect(body.sessions.filter((s) => s.current === true).length).toBe(1);
    for (const s of body.sessions) {
      expect(typeof s.createdAt).toBe("string");
      expect(typeof s.lastActive).toBe("string");
      expect(typeof s.expiresAt).toBe("string");
    }
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(keep); // no raw token
    expect(raw).not.toContain(hashToken(keep)); // no token hash
  });

  test("GET /auth/sessions without a session is 401", async () => {
    const out = await statusOf(handleAuth(state, new Request("http://x/auth/sessions"), ctxFor(state, undefined, "/auth/sessions")));
    expect(out.status).toBe(401);
  });

  test("POST /auth/sessions/revoke-others keeps the current session", async () => {
    const res = await handleAuth(state, authed("/auth/sessions/revoke-others", keep, { method: "POST" }), ctxFor(state, keep, "/auth/sessions/revoke-others"));
    expect(res?.status).toBe(200);
    expect(((await res!.json()) as { revoked: number }).revoked).toBe(1);
    expect(state.users.resolveSession(keep)?.id).toBe(user.id);
  });

  test("POST /auth/sessions/revoke-all signs out everywhere and clears the cookie", async () => {
    const t2 = state.users.createSession(user.id); // sessions now: keep + t2
    const res = await handleAuth(state, authed("/auth/sessions/revoke-all", t2, { method: "POST" }), ctxFor(state, t2, "/auth/sessions/revoke-all"));
    expect(res?.status).toBe(200);
    expect(((await res!.json()) as { revoked: number }).revoked).toBe(2);
    expect(res?.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(state.users.resolveSession(t2)).toBeNull();
    expect(state.users.resolveSession(keep)).toBeNull();
  });
});

// ── Sub-feature 4: the passwordless-admin one-time password-set force ──
describe("passwordless-admin one-time password set (sub-feature 4)", () => {
  const state = sandboxedState("pwless");
  // The CO_WORKSPACE_ADMIN_EMAIL bootstrap path: an admin provisioned WITHOUT a password.
  const bootstrapped = state.users.bootstrapAdmin("boot@test.local");
  const admin = bootstrapped.user!;
  const token = state.users.createSession(admin.id);
  // Another principal owns a tenant — admin-wide reach must stay locked until the set.
  state.registry.create({ variant: "co-consult", key: "co-consult::pwless-other", ownerPrincipal: "someone" });

  test("admin routes refuse a passwordless admin until the one-time set", async () => {
    for (const p of ["/admin/users", "/admin/stats", "/admin/audit", "/admin/mail-outbox"]) {
      const out = await statusOf(handleAdmin(state, authed(p, token), ctxFor(state, token, p)));
      expect(out.status).toBe(403);
      expect(out.message).toMatch(/set a password first/);
    }
    const rename = await statusOf(handleAdmin(state, authed("/admin/users/x/name", token, { method: "PATCH", body: JSON.stringify({ name: "n" }) }), ctxFor(state, token, "/admin/users/x/name")));
    expect(rename.status).toBe(403);
  });

  test("admin-wide tenant access is withheld until the password is set", () => {
    const others = state.registry.list().find((r) => r.ownerPrincipal === "someone")!;
    const err = catchOf(() => requireTenantAccess(state, authed(`/tenants/${others.tenantId}`, token), others));
    expect(err.status).toBe(403);
  });

  test("first-time set needs no current password; then /auth/me reports the flags", async () => {
    const res = await handleAuth(state, authed("/auth/me", token, { method: "PATCH", body: JSON.stringify({ password: "newadminpass1" }) }), ctxFor(state, token, "/auth/me"));
    expect(res?.status).toBe(200);
    const me = await handleAuth(state, authed("/auth/me", token), ctxFor(state, token, "/auth/me"));
    const body = (await me!.json()) as { user: { hasPassword: boolean; passwordSetRequired: boolean; role: string } };
    expect(body.user.hasPassword).toBe(true);
    expect(body.user.passwordSetRequired).toBe(false);
    expect(body.user.role).toBe("admin");
  });

  test("after the set, admin routes unlock and destructive ops demand the password (D4)", async () => {
    const users = await statusOf(handleAdmin(state, authed("/admin/users", token), ctxFor(state, token, "/admin/users")));
    expect(users.status).toBe(200);
    const tenantWide = await statusOf(handleTenants(state, authed("/tenants", token), ctxFor(state, token, "/tenants")));
    expect(tenantWide.status).toBe(200);
    const listed = (await (await handleTenants(state, authed("/tenants", token), ctxFor(state, token, "/tenants")))!.json()) as { tenants: Array<{ ownerPrincipal?: string }> };
    expect(listed.tenants.some((t) => t.ownerPrincipal === "someone")).toBe(true);

    const noHeader = await statusOf(handleAdmin(state, authed("/admin/users/x/reset-password", token, { method: "POST", body: "{}" }), ctxFor(state, token, "/admin/users/x/reset-password")));
    expect(noHeader.status).toBe(403);
    const wrong = await statusOf(handleAdmin(state, authed("/admin/users/x/reset-password", token, { method: "POST", body: "{}", adminPassword: "wrongpass" }), ctxFor(state, token, "/admin/users/x/reset-password")));
    expect(wrong.status).toBe(403);
    const del = await statusOf(handleAdmin(state, authed("/admin/users/x", token, { method: "DELETE", adminPassword: "newadminpass1" }), ctxFor(state, token, "/admin/users/x")));
    expect(del.status).toBe(404); // past re-auth: the fixture target does not exist
  });

  test("a passwordless REGULAR user keeps normal access (SSO-only accounts)", async () => {
    const sso = state.users.createUser({ email: "sso@test.local", name: "sso", password: null })!;
    const t = state.users.createSession(sso.id);
    const adminGate = await statusOf(handleAdmin(state, authed("/admin/users", t), ctxFor(state, t, "/admin/users")));
    expect(adminGate.status).toBe(403);
    expect(adminGate.message).toBe("admin only"); // role gate, not the password-set force
    const me = await handleAuth(state, authed("/auth/me", t), ctxFor(state, t, "/auth/me"));
    expect(((await me!.json()) as { user: { passwordSetRequired: boolean } }).user.passwordSetRequired).toBe(false);
    const listed = await handleTenants(state, authed("/tenants", t), ctxFor(state, t, "/tenants"));
    expect(listed?.status).toBe(200);
    const set = await statusOf(handleAuth(state, authed("/auth/me", t, { method: "PATCH", body: JSON.stringify({ password: "ssopassword1" }) }), ctxFor(state, t, "/auth/me")));
    expect(set.status).toBe(200); // D5 first-set: no current password required
  });
});
