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

  test("admin reset issues a copyable temp password: forced rotation, session purge, expiry", async () => {
    const target = state.users.createUser({ email: "resetme@test.local", name: "resetme", password: "oldpass123", role: "user" });
    const targetSession = state.users.createSession(target!.id);

    const reset = await fetch(`${base}/admin/users/${target!.id}/reset-password`, {
      method: "POST",
      headers: { cookie: adminCookie },
    });
    expect(reset.status).toBe(200);
    const { tempPassword, resetToken } = await reset.json();
    expect(typeof tempPassword).toBe("string");
    expect(tempPassword.startsWith("co-")).toBe(true);
    expect(resetToken).toBeUndefined();

    // the old session was purged at reset time (SEC-06)
    const purged = await fetch(`${base}/auth/me`, { headers: { cookie: `gw_session=${targetSession}` } });
    expect(purged.status).toBe(401);

    // login with the temp password works and flags the forced change
    const login = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: "resetme", password: tempPassword }),
    });
    expect(login.status).toBe(200);
    const loginBody = await login.json();
    expect(loginBody.user.mustChangePassword).toBe(true);

    // completing the rotation clears the flag and purges sessions again
    const me = await fetch(`${base}/auth/me`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace", cookie: login.headers.get("set-cookie")!.split(";")[0] },
      body: JSON.stringify({ password: "brandnew123" }),
    });
    expect(me.status).toBe(200);

    const relogin = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: "resetme", password: "brandnew123" }),
    });
    expect(relogin.status).toBe(200);
    expect((await relogin.json()).user.mustChangePassword).toBe(false);

    // non-admin cannot issue resets
    const denied = await fetch(`${base}/admin/users/${target!.id}/reset-password`, { method: "POST" });
    expect(denied.status).toBe(401);
  });

  test("account self-service: password change needs current credential; email change verifies; admin renames", async () => {
    const { createHash } = await import("node:crypto");
    const sha = (v: string) => createHash("sha256").update(v).digest("hex");
    const u = state.users.createUser({ email: "selfsvc@test.local", name: "selfsvc", password: "startpass123", role: "user" });
    const cookie = `gw_session=${state.users.createSession(u!.id)}`;
    const patchHeaders = { "content-type": "application/json", cookie, "x-requested-with": "co-workspace" };

    const bad = await fetch(`${base}/auth/me`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ currentPassword: "wrong", password: "newpass123" }) });
    expect(bad.status).toBe(403);

    const ok = await fetch(`${base}/auth/me`, { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ currentPassword: "startpass123", password: "newpass123" }) });
    expect(ok.status).toBe(200);
    // the performing session survives (SEC-06 scope: other sessions invalidated)
    expect((await fetch(`${base}/auth/me`, { headers: { cookie } })).status).toBe(200);

    // email change: stage via the store (token only travels by mail), verify via the route
    const staged = state.users.createEmailChange(u!.id, "newaddr@test.local");
    expect(staged.ok).toBe(true);
    const stagedToken = staged.ok ? staged.token : "";
    const verify = await fetch(`${base}/auth/email/verify`, { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ token: stagedToken }) });
    expect(verify.status).toBe(200);
    expect(state.users.findByEmailHash(sha("newaddr@test.local"))?.id).toBe(u!.id);

    // colliding email change is rejected at staging time (unique email hash across accounts)
    const u2 = state.users.createUser({ email: "other@test.local", name: "other", password: "otherpass123", role: "user" });
    const collide = state.users.createEmailChange(u2!.id, "newaddr@test.local");
    expect(collide.ok).toBe(false);
    expect(!collide.ok && collide.reason).toBe("email_taken");
    // unchanged email is a no-op rejection
    const same = state.users.createEmailChange(u!.id, "newaddr@test.local");
    expect(!same.ok && same.reason).toBe("unchanged");

    // admin rename works; unauthenticated rename is denied
    const rename = await fetch(`${base}/admin/users/${u!.id}/name`, { method: "PATCH", headers: { "content-type": "application/json", cookie: adminCookie, "x-requested-with": "co-workspace" }, body: JSON.stringify({ name: "Renamed By Admin" }) });
    expect(rename.status).toBe(200);
    expect((await rename.json()).user.name).toBe("Renamed By Admin");
    const denied = await fetch(`${base}/admin/users/${u!.id}/name`, { method: "PATCH", headers: { "content-type": "application/json", "x-requested-with": "co-workspace" }, body: JSON.stringify({ name: "Nope" }) });
    expect(denied.status).toBe(401);
  });

  test("native chat streams provisioning progress while the team prepares", async () => {
    // slow scaffold ⇒ the chat must surface `: provisioning:` frames instead of hanging silent
    const ws = join(tmpdir(), `gw-slow-ws-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(join(ws, "scripts"), { recursive: true });
    writeFileSync(
      join(ws, "scripts", "new-project.ts"),
      `const end = Date.now() + 1500; while (Date.now() < end);\n` +
        `const { mkdirSync } = require("node:fs"); mkdirSync(\`Projects/\${process.argv[2]}\`, { recursive: true });\n`,
    );
    const binDir = join(tmpdir(), `gw-slow-bin-${crypto.randomUUID().slice(0, 8)}`);
    mkdirSync(binDir, { recursive: true });
    const hermesBin = join(binDir, "fake-hermes.sh");
    writeFileSync(
      hermesBin,
      `#!/bin/sh\ncat > /dev/null\necho '{"type":"result","session_id":"s9","exit_code":0,"text":"ok","tokens":{"input":1,"output":1,"total":2},"duration_ms":1}'\n`,
    );
    chmodSync(hermesBin, 0o755);
    const cfgS = loadConfig({
      CO_WORKSPACE_HOST: "127.0.0.1",
      CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
      CO_WORKSPACE_DATA_DIR: join(tmpdir(), `gw-slow-data-${crypto.randomUUID().slice(0, 8)}`),
      CO_WORKSPACE_WORKSPACE_DIR: ws,
      HERMES_BIN: hermesBin,
    });
    const st = createState(cfgS);
    const srv = createServer(st);
    afterAll(() => srv.stop(true));
    const b2 = `http://127.0.0.1:${srv.port}`;
    const prov = await fetch(`${b2}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    expect(prov.status).toBe(202);
    const { tenantId } = await prov.json();
    const chat = await fetch(`${b2}/tenants/${tenantId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "hi" }),
    });
    expect(chat.status).toBe(200);
    const text = await chat.text();
    expect(text).toContain(": provisioning:");
    expect(text).toContain('"type":"done"');
    expect(text).toContain('"exitCode":0');
  }, 20_000);

  test("reload with an emptied key file is rejected and leaves keys unchanged (T-20260928-009)", async () => {
    const before = state.cfg.apiKeys.slice();
    writeFileSync(keysFile, "# emptied\n");
    const res = await fetch(`${base}/admin/reload`, { method: "POST", headers: { cookie: adminCookie } });
    expect(res.status).toBe(400);
    expect(state.cfg.apiKeys).toEqual(before);
    // restore for the suites that follow
    writeFileSync(keysFile, "sk-new\n");
    const ok = await fetch(`${base}/admin/reload`, { method: "POST", headers: { cookie: adminCookie } });
    expect(ok.status).toBe(200);
  });

  test("admin rename: PATCH /admin/users/:id/name renames; unauthenticated rename denied (T-20260928-011)", async () => {
    const u = state.users.createUser({ email: "rename-me@test.local", name: "Original Name", password: "renamepass123", role: "user" });
    const denied = await fetch(`${base}/admin/users/${u!.id}/name`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
      body: JSON.stringify({ name: "Nope" }),
    });
    expect(denied.status).toBe(401);
    const ok = await fetch(`${base}/admin/users/${u!.id}/name`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie: adminCookie, "x-requested-with": "co-workspace" },
      body: JSON.stringify({ name: "Renamed Person" }),
    });
    expect(ok.status).toBe(200);
    expect((await ok.json()).user.name).toBe("Renamed Person");
  });

  test("auth hardening: /auth/resend is uniform + rate-limited; admin delete stops leaking raw email (review D)", async () => {
    // uniform response for a non-pending ID (no enumeration)
    const r1 = await fetch(`${base}/auth/resend`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ loginId: "no-such-user" }),
    });
    expect(r1.status).toBe(200);
    expect((await r1.json()).ok).toBe(true);
    // admin delete no longer returns the raw email
    const victim = state.users.createUser({ email: "victim@test.local", name: "victim", password: "victimpw123", role: "user" });
    const del = await fetch(`${base}/admin/users/${victim!.id}?tenants=delete`, { method: "DELETE", headers: { cookie: adminCookie } });
    expect(del.status).toBe(200);
    const body = await del.json();
    expect(body.deletedUser).toBe(victim!.principal);
    expect(body.deletedUser).not.toContain("@");
  });

  test("GET /tenants?mine=1 matches the cookie-session principal, not header credentials", async () => {
    const user = state.users.createUser({ email: "mine@test.local", name: "mine", password: "minepass123", role: "user" });
    const cookie = `gw_session=${state.users.createSession(user!.id)}`;
    const principal = user!.principal;
    state.registry.create({ dataDir: cfg.dataDir, variant: "co-consult", key: `co-consult::${principal}`, ownerPrincipal: principal });
    state.registry.create({ dataDir: cfg.dataDir, variant: "co-develop", key: "co-develop::someoneelse", ownerPrincipal: "someoneelse" });

    const mine = (await (await fetch(`${base}/tenants?mine=1`, { headers: { cookie } })).json()).tenants;
    expect(mine.length).toBe(1);
    expect(mine[0].ownerPrincipal).toBe(principal);
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
