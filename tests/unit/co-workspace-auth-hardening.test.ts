/**
 * Package A auth hardening: CSRF exemption scope (M3), SSO cookie/state/linking (M1/M2/H8),
 * outbox permissions (M7), open-mode warning (M8). google-sso network calls are stubbed by
 * replacing globalThis.fetch (module mocks would leak across the shared bun test process).
 */

import { afterEach, describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createState, handleRequest, openModeWarning } from "../../services/co-workspace/src/server";

const webDir = join(import.meta.dir, "..", "..", "services", "co-workspace", "web");

function makeState(env: Record<string, string> = {}) {
  const dataDir = join(tmpdir(), `co-workspace-hard-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dataDir, { recursive: true });
  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: dataDir,
    ...env,
  });
  return { state: createState(cfg), dataDir };
}

function post(path: string, headers: Record<string, string> = {}, body: unknown = {}): Request {
  return new Request(`http://127.0.0.1${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("csrf exemption scope (M3)", () => {
  test("csrf: session-cookie POST without header -> 403", async () => {
    const { state } = makeState({ CO_WORKSPACE_CSRF_REQUIRED: "true" });
    const user = state.users.createUser({ email: "a@example.com", name: "A", password: "password123" })!;
    const token = state.users.createSession(user.id);
    const res = await handleRequest(state, post("/auth/logout", { cookie: `gw_session=${token}` }));
    expect(res.status).toBe(403);
  });

  test("csrf: valid Bearer POST without header -> not 403", async () => {
    const { state } = makeState({ CO_WORKSPACE_CSRF_REQUIRED: "true", CO_WORKSPACE_API_KEYS: "k-valid" });
    const res = await handleRequest(state, post("/auth/logout", { authorization: "Bearer k-valid" }));
    expect(res.status).not.toBe(403);
  });

  test("csrf: invalid Bearer POST without header -> 403", async () => {
    const { state } = makeState({ CO_WORKSPACE_CSRF_REQUIRED: "true", CO_WORKSPACE_API_KEYS: "k-valid" });
    const res = await handleRequest(state, post("/auth/logout", { authorization: "Bearer bogus" }));
    expect(res.status).toBe(403);
  });

  test("web: every non-GET fetch in index.html/login.html carries x-requested-with", () => {
    for (const file of ["index.html", "login.html"]) {
      const html = readFileSync(join(webDir, file), "utf8");
      const calls = [...html.matchAll(/fetch\(/g)];
      for (const m of calls) {
        // Inspect the call up to its matching close paren.
        let depth = 0;
        let end = m.index! + "fetch".length;
        for (; end < html.length; end++) {
          if (html[end] === "(") depth++;
          else if (html[end] === ")" && --depth === 0) break;
        }
        const call = html.slice(m.index!, end + 1);
        if (/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(call) || /method:\s*\w*[Mm]ethod/.test(call)) {
          expect(call, `${file}: ${call.slice(0, 80)}`).toMatch(/x-requested-with|authHeaders/);
        }
      }
    }
    // authHeaders definitions must themselves carry the header.
    const index = readFileSync(join(webDir, "index.html"), "utf8");
    for (const m of index.matchAll(/const authHeaders = (\{[^}]*\})/g)) {
      expect(m[1]).toContain("x-requested-with");
    }
  });
});

describe("Google SSO hardening (M1/M2/H8)", () => {
  const realFetch = globalThis.fetch;
  const envKeys = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] as const;
  const savedEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));

  function enableGoogle(profile?: { sub: string; email: string }) {
    process.env.GOOGLE_CLIENT_ID = "cid";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_REDIRECT_URI = "http://127.0.0.1/auth/google/callback";
    globalThis.fetch = (async (input: any) => {
      const u = String(input);
      if (u.includes("oauth2.googleapis.com/token")) return Response.json({ access_token: "at" });
      return Response.json({ sub: profile?.sub, email: profile?.email, email_verified: true, name: "G User" });
    }) as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    for (const k of envKeys) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  function callback(state: string, cookieState = state): Request {
    return new Request(`http://127.0.0.1/auth/google/callback?code=c&state=${state}`, {
      headers: { cookie: `gw_oauth_state=${cookieState}; gw_oauth_verifier=v` },
    });
  }

  test("sso login sets two cookies", async () => {
    enableGoogle();
    for (const secure of [true, false]) {
      const { state } = makeState({ CO_WORKSPACE_COOKIE_SECURE: secure ? "true" : "false" });
      const res = await handleRequest(state, new Request("http://127.0.0.1/auth/google/login"));
      expect(res.status).toBe(302);
      const cookies = res.headers.getSetCookie();
      expect(cookies.length).toBe(2);
      for (const c of cookies) expect(c.includes("Secure")).toBe(secure);
    }
  });

  test("sso callback rejects mismatched state with 400", async () => {
    enableGoogle({ sub: "s1", email: "x@example.com" });
    const { state } = makeState();
    expect((await handleRequest(state, callback("aaaa", "bbbb"))).status).toBe(400);
    expect((await handleRequest(state, callback("aaaa", "aaaaa"))).status).toBe(400);
  });

  test("sso callback success emits three separate cookies", async () => {
    enableGoogle({ sub: "s-new", email: "new@example.com" });
    const { state } = makeState({ CO_WORKSPACE_COOKIE_SECURE: "true" });
    const res = await handleRequest(state, callback("st"));
    expect(res.status).toBe(302);
    const cookies = res.headers.getSetCookie();
    expect(cookies.length).toBe(3);
    for (const c of cookies) expect(c).toContain("Secure");
  });

  test("sso links verified email account", async () => {
    enableGoogle({ sub: "s-link", email: "v@example.com" });
    const { state } = makeState();
    const u = state.users.createUser({ email: "v@example.com", name: "V", password: "password123" })!;
    const res = await handleRequest(state, callback("st"));
    expect(res.status).toBe(302);
    expect(res.headers.getSetCookie().some((c) => c.startsWith("gw_session=") && !c.includes("Max-Age=0"))).toBe(true);
    expect(state.users.findById(u.id)?.googleSub).toBe("s-link");
  });

  test("sso refuses unverified email account (409, no session cookie)", async () => {
    enableGoogle({ sub: "s-unv", email: "u@example.com" });
    const { state, dataDir } = makeState();
    const u = state.users.createUser({ email: "u@example.com", name: "U", password: "password123" })!;
    const db = new Database(join(dataDir, "tenants", "users.db"));
    db.query("UPDATE users SET verified_at = NULL WHERE id = ?").run(u.id);
    db.close();
    const res = await handleRequest(state, callback("st"));
    expect(res.status).toBe(409);
    expect(res.headers.getSetCookie().length).toBe(0);
    expect(state.users.findById(u.id)?.googleSub ?? null).toBeNull();
  });

  test("sso refuses email account bound to other google sub (409)", async () => {
    enableGoogle({ sub: "s-other", email: "b@example.com" });
    const { state } = makeState();
    state.users.createUser({ email: "b@example.com", name: "B", password: "password123", googleSub: "s-original" });
    const res = await handleRequest(state, callback("st"));
    expect(res.status).toBe(409);
    expect(res.headers.getSetCookie().length).toBe(0);
  });
});

describe("outbox and open mode (M7/M8)", () => {
  test.skipIf(process.platform === "win32")("signup outbox file is 0600", async () => {
    const { state, dataDir } = makeState();
    const res = await handleRequest(
      state,
      post("/auth/signup", {}, { loginId: "outbox-user", email: "o@example.com", password: "password123" }),
    );
    expect(res.status).toBe(200);
    const dir = join(dataDir, "mail-outbox");
    expect(statSync(dir).mode & 0o777).toBe(0o700);
    const files = readdirSync(dir);
    expect(files.length).toBe(1);
    expect(statSync(join(dir, files[0])).mode & 0o777).toBe(0o600);
  });

  test("openModeWarning returns text only when keys empty and login off", () => {
    expect(openModeWarning({ apiKeys: [], loginRequired: false })).toContain("OPEN MODE");
    expect(openModeWarning({ apiKeys: ["k"], loginRequired: false })).toBeNull();
    expect(openModeWarning({ apiKeys: [], loginRequired: true })).toBeNull();
  });
});
