/** Unit tests for Team Gateway Phase 2b: windowed quotas and key-file rotation. */

import { afterAll, describe, expect, test } from "bun:test";
const describe_ = process.platform === "win32" ? describe.skip : describe; // windows cannot exec shebang fake binaries (T-20260927-020 follow-up)
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, parseKeyList, readKeysFile } from "../../services/co-workspace/src/config";
import { assertQuota, windowUsage } from "../../services/co-workspace/src/server";
import { createServer, createState } from "../../services/co-workspace/src/server";
// TenantRegistry now lives in registry-db (SQLite store); tests import server-created state only.
import type { GatewayConfig } from "../../services/co-workspace/src/config";
import type { TenantRecord } from "../../services/co-workspace/src/tenant";

function tenant(overrides: Partial<TenantRecord> = {}): TenantRecord {
  return {
    tenantId: "gw-t",
    variant: "co-consult",
    status: "ready",
    createdAt: "2026-09-27T00:00:00.000Z",
    projectDir: "/tmp/project",
    hermesHome: "/tmp/home",
    sessions: 0,
    inputTokens: 0,
    outputTokens: 0,
    ...overrides,
  };
}

describe_("parseKeyList / readKeysFile — key-file rotation source", () => {
  test("env style: comma-separated", () => {
    expect(parseKeyList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  test("file style: one per line, # comments and blanks skipped", () => {
    const text = "# rotated 2026-09-27\nk1\n\nk2  \n# old\nk3\n";
    expect(readKeysFileText(text)).toEqual(["k1", "k2", "k3"]);
  });

  test("missing file reads empty", () => {
    expect(readKeysFile(join(tmpdir(), `missing-${crypto.randomUUID()}.keys`))).toEqual([]);
  });
});

function readKeysFileText(text: string): string[] {
  const dir = join(tmpdir(), `gw-keys-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "api.keys");
  writeFileSync(file, text);
  return readKeysFile(file);
}

function dailyCfg(): GatewayConfig {
  return { ...loadConfig({}), quotaWindow: "daily", tenantMaxTurns: 2, tenantMaxTokens: 100 };
}

describe_("windowUsage / assertQuota — windowed quotas", () => {
  test("lifetime window reads cumulative counters", () => {
    const cfg = { ...loadConfig({}), quotaWindow: "lifetime" as const, tenantMaxTurns: 2 };
    const rec = tenant({ sessions: 2, inputTokens: 10, outputTokens: 5 });
    const usage = windowUsage(cfg, rec, "2026-09-27");
    expect(usage).toEqual({ turns: 2, tokens: 15 });
    expect(() => assertQuota(cfg, rec, "2026-09-27")).toThrow();
  });

  test("daily window reads only today's bucket — a fresh day resets the quota", () => {
    const cfg = dailyCfg();
    const rec = tenant({
      daily: {
        "2026-09-27": { turns: 2, inputTokens: 90, outputTokens: 5 },
        "2026-09-26": { turns: 5, inputTokens: 500, outputTokens: 50 },
      },
    });
    expect(windowUsage(cfg, rec, "2026-09-27")).toEqual({ turns: 2, tokens: 95 });
    expect(() => assertQuota(cfg, rec, "2026-09-27")).toThrow();
    // New day: same tenant, quota fresh again.
    expect(windowUsage(cfg, rec, "2026-09-28")).toEqual({ turns: 0, tokens: 0 });
    expect(() => assertQuota(cfg, rec, "2026-09-28")).not.toThrow();
  });

  test("token quota trips on the daily bucket", () => {
    const cfg = { ...dailyCfg(), tenantMaxTurns: 0, tenantMaxTokens: 100 };
    const rec = tenant({ daily: { "2026-09-27": { turns: 3, inputTokens: 60, outputTokens: 50 } } });
    expect(() => assertQuota(cfg, rec, "2026-09-27")).toThrow(/token quota/);
  });
});

describe_("server — key-file rotation via /admin/reload", () => {
  const dataDir = join(tmpdir(), `gw-rot-${crypto.randomUUID().slice(0, 8)}`);
  const workspaceDir = join(tmpdir(), `gw-rot-ws-${crypto.randomUUID().slice(0, 8)}`);
  const keyDir = join(tmpdir(), `gw-rot-keys-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  mkdirSync(keyDir, { recursive: true });
  writeFileSync(
    join(workspaceDir, "scripts", "new-project.ts"),
    `import { mkdirSync, writeFileSync } from "node:fs";
const name = process.argv[2];
mkdirSync(\`Projects/\${name}\`, { recursive: true });
writeFileSync(\`Projects/\${name}/AGENTS.md\`, "# fake\\n");
`,
  );
  const keysFile = join(keyDir, "api.keys");
  writeFileSync(keysFile, "sk-old\n");
  const binDir = join(tmpdir(), `gw-rot-bin-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(binDir, { recursive: true });
  const hermesBin = join(binDir, "fake-hermes.sh");
  writeFileSync(
    hermesBin,
    `#!/bin/sh
cat > /dev/null
echo '{"type":"result","session_id":"s1","exit_code":0,"text":"ok","tokens":{"input":1,"output":1,"total":2},"duration_ms":1,"timestamp":1}'
`,
  );
  chmodSync(hermesBin, 0o755);

  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
    HERMES_BIN: hermesBin,
    CO_WORKSPACE_API_KEYS_FILE: keysFile,
  });
  expect(cfg.apiKeys).toEqual(["sk-old"]);
  const state = createState(cfg);
  // SEC-03: /admin/reload is admin-only — create an admin session for the rotation test.
  const admin = state.users.createUser({ email: "admin@test.local", name: "admin", password: "adminpass123", role: "admin" });
  const adminCookie = `gw_session=${state.users.createSession(admin!.id)}`;
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  const models = (key: string) => fetch(`${base}/v1/models`, { headers: { authorization: `Bearer ${key}` } });

  test("boot: file key works, unknown key 401s", async () => {
    expect((await models("sk-old")).status).toBe(200);
    expect((await models("sk-new")).status).toBe(401);
  });

  test("rotation: overwrite file + /admin/reload flips validity without restart", async () => {
    writeFileSync(keysFile, "sk-old\nsk-new\n");
    const reload = await fetch(`${base}/admin/reload`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(((await reload.json()) as any).keyCount).toBe(2);
    expect((await models("sk-new")).status).toBe(200);

    writeFileSync(keysFile, "sk-new\n");
    const reload2 = await fetch(`${base}/admin/reload`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(((await reload2.json()) as any).keyCount).toBe(1);
    expect((await models("sk-old")).status).toBe(401);
    expect((await models("sk-new")).status).toBe(200);
  });

  test("principal token budget: cross-tenant spend trips 429 (SEC-05 remnant)", async () => {
    // budget test server shares state; build a dedicated config-based check instead:
    const cfgB = loadConfig({
      CO_WORKSPACE_HOST: "127.0.0.1",
      CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
      CO_WORKSPACE_DATA_DIR: join(tmpdir(), `gw-budget-${crypto.randomUUID().slice(0, 8)}`),
      CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
      HERMES_BIN: hermesBin,
      CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "4",
    });
    const st = createState(cfgB);
    const srv = createServer(st);
    const b2 = `http://127.0.0.1:${srv.port}`;
    afterAll(() => srv.stop(true));

    // provision a tenant and drive 3 turns (each ~15 tokens) against a 100-token budget
    const prov = await fetch(`${b2}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    const { tenantId } = await prov.json();
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const d = await (await fetch(`${b2}/tenants/${tenantId}`)).json();
      if (d.status !== "provisioning") break;
      await Bun.sleep(50);
    }
    const codes = [];
    for (let i = 0; i < 3; i++) {
      const r = await fetch(`${b2}/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: "hi" }),
      });
      codes.push(r.status);
      await r.text();
    }
    expect(codes).toEqual([200, 200, 429]);
    // Provisioning spawns new-project.ts and polls for up to 10s internally — the bun
    // default 5s timeout flakes on slow CI runners (main went red twice on this).
  }, 30_000);

  test("reload is auth-protected", async () => {
    const res = await fetch(`${base}/admin/reload`, { method: "POST" });
    expect(res.status).toBe(401);
  });
});
