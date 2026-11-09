/**
 * GET /admin page route (design 2026-11-09-gw-admin-console-design §9.2, §11 admin-csrf-page):
 * only a password-set admin session receives the console shell; every other caller is
 * redirected to the chat page. /admin.js is a static asset, and admin mutations keep the
 * SEC-09 header requirement.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AUTH_EXEMPT_ROUTES } from "../../services/co-workspace/src/auth";
import { loadConfig } from "../../services/co-workspace/src/config";
import { handleRequest } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { GatewayState } from "../../services/co-workspace/src/state";

const ROOTS: string[] = [];
const STATES: GatewayState[] = [];
afterAll(() => {
  for (const state of STATES) {
    for (const store of [state.registry, state.turns, state.users, state.audit]) {
      try { store.close(); } catch { /* best effort */ }
    }
  }
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function makeState(env: Record<string, string> = {}): GatewayState {
  const dataDir = join(tmpdir(), `gw-admin-page-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dataDir, { recursive: true });
  ROOTS.push(dataDir);
  const state = createState(loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: dataDir,
    ...env,
  }));
  STATES.push(state);
  return state;
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`http://127.0.0.1${path}`, { method: "GET", headers });
}

describe("GET /admin page route", () => {
  test("anonymous caller is redirected to /", async () => {
    const state = makeState();
    const res = await handleRequest(state, get("/admin"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  test("signed-in regular user is redirected to /", async () => {
    const state = makeState();
    const user = state.users.createUser({ email: "reg@example.com", name: "Reg", password: "password123" })!;
    const token = state.users.createSession(user.id);
    const res = await handleRequest(state, get("/admin", { cookie: `gw_session=${token}` }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  test("admin without a password set is redirected to /", async () => {
    const state = makeState();
    const admin = state.users.createUser({ email: "boot@example.com", name: "Boot", password: null, role: "admin" })!;
    const token = state.users.createSession(admin.id);
    const res = await handleRequest(state, get("/admin", { cookie: `gw_session=${token}` }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  });

  test("password-set admin receives the console shell", async () => {
    const state = makeState();
    const admin = state.users.createUser({ email: "root@example.com", name: "Root", password: "password123", role: "admin" })!;
    const token = state.users.createSession(admin.id);
    const res = await handleRequest(state, get("/admin", { cookie: `gw_session=${token}` }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(await res.text()).toContain('<script type="module" src="/admin.js"></script>');
  });

  test("/admin.js is served as a script", async () => {
    const state = makeState();
    const res = await handleRequest(state, get("/admin.js"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("javascript");
  });

  test("admin mutations without the SEC-09 header are refused even with a session", async () => {
    const state = makeState();
    const admin = state.users.createUser({ email: "csrf@example.com", name: "Csrf", password: "password123", role: "admin" })!;
    const token = state.users.createSession(admin.id);
    const res = await handleRequest(
      state,
      new Request("http://127.0.0.1/admin/users/bulk", {
        method: "POST",
        headers: { cookie: `gw_session=${token}`, "content-type": "application/json" },
        body: JSON.stringify({ ids: ["x"], action: "activate" }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("GET /admin under API keys + loginRequired (signed-out browser regression)", () => {
  const KEY_MODE = { CO_WORKSPACE_API_KEYS: "k-valid", CO_WORKSPACE_LOGIN_REQUIRED: "true" };

  function get(path: string, headers: Record<string, string> = {}): Request {
    return new Request(`http://127.0.0.1${path}`, { method: "GET", headers });
  }

  test("exempt set matches the exact route keys only", () => {
    expect(AUTH_EXEMPT_ROUTES.has("GET /admin")).toBe(true);
    expect(AUTH_EXEMPT_ROUTES.has("GET /admin.js")).toBe(true);
    expect(AUTH_EXEMPT_ROUTES.has("GET /admin/users")).toBe(false);
    expect(AUTH_EXEMPT_ROUTES.has("POST /admin")).toBe(false);
  });

  test("signed-out GET /admin is 302 to /login, not a JSON 401", async () => {
    const state = makeState(KEY_MODE);
    const res = await handleRequest(state, get("/admin"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/login");
  }, 15000);

  test("signed-out GET /admin.js is not 401", async () => {
    const state = makeState(KEY_MODE);
    const res = await handleRequest(state, get("/admin.js"));
    expect(res.status).not.toBe(401);
  }, 15000);

  test("signed-out GET /admin/users stays refused at the key gate", async () => {
    const state = makeState(KEY_MODE);
    const res = await handleRequest(state, get("/admin/users"));
    expect(res.status).toBe(401);
  }, 15000);

  test("signed-in non-admin GET /admin is 302 to /", async () => {
    const state = makeState(KEY_MODE);
    const user = state.users.createUser({ email: "keyreg@example.com", name: "Reg", password: "password123" })!;
    const token = state.users.createSession(user.id);
    const res = await handleRequest(state, get("/admin", { cookie: `gw_session=${token}` }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");
  }, 15000);
});
