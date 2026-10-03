// T-20260929-009 (H5 env allowlist + H7 rate-limit client IP) / T-20260929-012 (test half).
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { allowlistedEnv, dockerCliEnv, hermesEnv, type HermesSpawnOptions } from "../../services/co-workspace/src/hermes";
import { createState, handleRequest, resolveClientIp } from "../../services/co-workspace/src/server";

const SECRETS = {
  GOOGLE_CLIENT_SECRET: "gcs-secret",
  GOOGLE_CLIENT_ID: "gcid",
  GOOGLE_REDIRECT_URI: "https://x/cb",
  CO_WORKSPACE_API_KEYS: "k1,k2",
  CO_WORKSPACE_LLM_API_KEY: "llm-secret",
  CO_WORKSPACE_ADMIN_EMAIL: "a@b.c",
};
const KEPT = { PATH: "/usr/bin", HOME: "/home/x", GOOGLE_API_KEY: "gk", GEMINI_API_KEY: "gem" };
const base = { ...SECRETS, ...KEPT };
const spawnOpts = { hermesBin: "hermes", projectDir: "/p", hermesHome: "/h", message: "m" } as HermesSpawnOptions;

describe("H5 — spawned-agent env never carries gateway secrets", () => {
  const builders: Array<[string, () => Record<string, string | undefined>]> = [
    ["allowlistedEnv", () => allowlistedEnv(base)],
    ["hermesEnv", () => hermesEnv(spawnOpts, base)],
    ["dockerCliEnv", () => dockerCliEnv(spawnOpts, base)],
  ];
  for (const [name, build] of builders) {
    test(`${name}: secrets dropped, PATH/HOME/GOOGLE_API_KEY kept`, () => {
      const env = build();
      for (const k of Object.keys(SECRETS)) expect(env[k]).toBeUndefined();
      expect(Object.values(env)).not.toContain("gcs-secret");
      expect(env.PATH).toBe("/usr/bin");
      expect(env.HOME).toBe("/home/x");
      expect(env.GOOGLE_API_KEY).toBe("gk");
      expect(env.GEMINI_API_KEY).toBe("gem");
    });
  }

  test("every CO_WORKSPACE_* / GOOGLE_CLIENT_* name in compose is denied (derived from compose)", async () => {
    const compose = await Bun.file(join(import.meta.dir, "../../services/co-workspace/docker/docker-compose.yml")).text();
    const names = [...compose.matchAll(/^\s+((?:CO_WORKSPACE_|GOOGLE_)[A-Z0-9_]+):/gm)].map((m) => m[1]);
    expect(names.length).toBeGreaterThan(10);
    const env = allowlistedEnv(Object.fromEntries(names.map((n) => [n, "v"])));
    expect(Object.keys(env)).toEqual([]);
  });

  test("explicit providerKeyEnv is still injected", () => {
    const o = { ...spawnOpts, providerKeyEnv: { name: "GOOGLE_API_KEY", value: "explicit" } } as HermesSpawnOptions;
    expect(hermesEnv(o, base).GOOGLE_API_KEY).toBe("explicit");
    expect(dockerCliEnv(o.providerKeyEnv, {}).GOOGLE_API_KEY).toBe("explicit");
  });
});

function freshState(extra: Record<string, string> = {}) {
  const d = mkdtempSync(join(tmpdir(), "cw-h7-"));
  const ws = join(d, "ws");
  mkdirSync(ws, { recursive: true });
  return createState(
    loadConfig({
      CO_WORKSPACE_DATA_DIR: join(d, "data"),
      CO_WORKSPACE_WORKSPACE_DIR: ws,
      CO_WORKSPACE_VARIANTS: "co-consult",
      ...extra,
    }),
  );
}
const login = (state: ReturnType<typeof freshState>, loginId: string, headers: Record<string, string> = {}, peer?: string) =>
  handleRequest(
    state,
    new Request("http://x/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ loginId, password: "wrong" }),
    }),
    peer,
  );

describe("H7 — client IP resolution and login limiter", () => {
  test("resolveClientIp", () => {
    const r = new Request("http://x/", { headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" } });
    expect(resolveClientIp(false, r, "9.9.9.9")).toBe("9.9.9.9");
    expect(resolveClientIp(false, r)).toBe("local");
    expect(resolveClientIp(true, r, "9.9.9.9")).toBe("3.3.3.3");
    expect(resolveClientIp(true, new Request("http://x/"), "9.9.9.9")).toBe("9.9.9.9");
  });

  test("trustProxy=false: rotating X-Forwarded-For cannot bypass the per-IP limit", async () => {
    const state = freshState();
    expect(state.cfg.trustProxy).toBe(false);
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await login(state, `user${i}`, { "x-forwarded-for": `10.0.0.${i}` }, "5.5.5.5")).status);
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  }, 30_000);

  test("trustProxy=true: right-most hop keys the limiter (left-most is spoofable)", async () => {
    const state = freshState({ CO_WORKSPACE_TRUST_PROXY: "true" });
    expect(state.cfg.trustProxy).toBe(true);
    for (let i = 0; i < 10; i++) {
      const res = await login(state, `u${i}`, { "x-forwarded-for": `spoof${i}, 7.7.7.7` }, "5.5.5.5");
      expect(res.status).toBe(401);
    }
    expect((await login(state, "u99", { "x-forwarded-for": "spoofX, 7.7.7.7" }, "5.5.5.5")).status).toBe(429);
    // a different real client (different right-most hop) is unaffected
    expect((await login(state, "u100", { "x-forwarded-for": "spoofX, 8.8.8.8" }, "5.5.5.5")).status).toBe(401);
  }, 30_000);

  test("per-loginId limit triggers across different IPs without locking other accounts", async () => {
    const state = freshState();
    for (let i = 0; i < 10; i++) expect((await login(state, "Victim", {}, `6.6.6.${i}`)).status).toBe(401);
    expect((await login(state, "victim", {}, "6.6.6.200")).status).toBe(429);
    expect((await login(state, "bystander", {}, "6.6.6.201")).status).toBe(401);
  }, 30_000);
});
