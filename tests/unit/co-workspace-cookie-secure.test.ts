/** M4: tri-state session-cookie Secure (true | false | auto). */

import { describe, expect, test } from "bun:test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { cookieSecureFor } from "../../services/co-workspace/src/http";
import { createState, handleRequest } from "../../services/co-workspace/src/server";

const req = (url: string, xfp?: string) => new Request(url, xfp === undefined ? {} : { headers: { "x-forwarded-proto": xfp } });

describe("cookieSecureFor", () => {
  test("forced true/false ignore the scheme", () => {
    expect(cookieSecureFor({ cookieSecure: true }, req("http://h/"))).toBe(true);
    expect(cookieSecureFor({ cookieSecure: false }, req("https://h/"))).toBe(false);
  });
  test("auto: http false, https true", () => {
    expect(cookieSecureFor({ cookieSecure: "auto" }, req("http://h/"))).toBe(false);
    expect(cookieSecureFor({}, req("http://h/"))).toBe(false);
    expect(cookieSecureFor({ cookieSecure: "auto" }, req("https://h/"))).toBe(true);
  });
  test("auto + trustProxy honours x-forwarded-proto", () => {
    const cfg = { cookieSecure: "auto" as const, trustProxy: true };
    expect(cookieSecureFor(cfg, req("http://h/", "https"))).toBe(true);
    expect(cookieSecureFor(cfg, req("http://h/", "http"))).toBe(false);
  });
  test("auto without trustProxy ignores x-forwarded-proto", () => {
    expect(cookieSecureFor({ cookieSecure: "auto" }, req("http://h/", "https"))).toBe(false);
  });
  test("right-most x-forwarded-proto entry wins", () => {
    const cfg = { cookieSecure: "auto" as const, trustProxy: true };
    expect(cookieSecureFor(cfg, req("http://h/", "http, https"))).toBe(true);
    expect(cookieSecureFor(cfg, req("http://h/", "https, http"))).toBe(false);
  });
});

describe("cookieSecure config parse", () => {
  test("env values map to tri-state", () => {
    const parse = (v?: string) => loadConfig(v === undefined ? {} : { CO_WORKSPACE_COOKIE_SECURE: v }).cookieSecure;
    expect(["true", "1", "false", "0", "", undefined, "banana"].map(parse)).toEqual([true, true, false, false, "auto", "auto", "auto"]);
  });
});

describe("login Set-Cookie Secure", () => {
  async function loginCookie(env: Record<string, string>, url: string, headers: Record<string, string> = {}): Promise<string> {
    const dataDir = join(tmpdir(), `co-workspace-cs-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(dataDir, { recursive: true });
    const cfg = loadConfig({ CO_WORKSPACE_HOST: "127.0.0.1", CO_WORKSPACE_DATA_DIR: dataDir, CO_WORKSPACE_WORKSPACE_DIR: dataDir, ...env });
    const state = createState(cfg);
    const user = state.users.createUser({ email: "a@example.com", name: "A", password: "password123" })!;
    const res = await handleRequest(state, new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ loginId: user.principal, password: "password123" }),
    }));
    expect(res.status).toBe(200);
    return res.headers.get("set-cookie") ?? "";
  }
  const L = "/auth/login";

  test("auto over https -> Secure", async () => {
    expect(await loginCookie({}, `https://127.0.0.1${L}`)).toContain("Secure");
  }, 20000);
  test("auto over http -> no Secure", async () => {
    expect(await loginCookie({}, `http://127.0.0.1${L}`)).not.toContain("Secure");
  }, 20000);
  test("forced false over https -> no Secure", async () => {
    expect(await loginCookie({ CO_WORKSPACE_COOKIE_SECURE: "false" }, `https://127.0.0.1${L}`)).not.toContain("Secure");
  }, 20000);
  test("forced true over http -> Secure", async () => {
    expect(await loginCookie({ CO_WORKSPACE_COOKIE_SECURE: "true" }, `http://127.0.0.1${L}`)).toContain("Secure");
  }, 20000);
  test("auto + trustProxy + XFP https over http -> Secure", async () => {
    expect(await loginCookie({ CO_WORKSPACE_TRUST_PROXY: "true" }, `http://127.0.0.1${L}`, { "x-forwarded-proto": "https" })).toContain("Secure");
  }, 20000);
});
