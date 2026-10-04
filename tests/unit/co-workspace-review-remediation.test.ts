/**
 * Tests for the 2026-10-03 review remediation wave
 * (docs/designs/2026-10-03-coworkspace-review-remediation-design.md, tickets
 * T-20261003-012..022): quota fail-boot, isolation posture warning, admin-promotion
 * invalidation, email-change binding, key-entry cache rotation, the uniform turn
 * watchdog/onSpawn contract, and the delete-vs-queued-turn abort.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, readKeyEntries, runtimeProviderKeyEnv, runtimeProviderKeyGap } from "../../services/co-workspace/src/config";
import { isolationPostureWarning, runtimeProviderKeyWarning } from "../../services/co-workspace/src/access";
import { UserStore } from "../../services/co-workspace/src/users";
import { runClaudeTurn } from "../../services/co-workspace/src/claude";
import { turnSpawnArgv } from "../../services/co-workspace/src/hermes";
import { seedHermesHome } from "../../services/co-workspace/src/tenant";
import { runCodexTurn } from "../../services/co-workspace/src/codex";
import { runChat } from "../../services/co-workspace/src/server";
import { createState } from "../../services/co-workspace/src/state";
import type { TenantRecord } from "../../services/co-workspace/src/tenant";

const ROOTS: string[] = [];
function scratch(name: string): string {
  const dir = join(tmpdir(), `gw-remediation-${name}-${crypto.randomUUID().slice(0, 8)}`);
  mkdirSync(dir, { recursive: true });
  ROOTS.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of ROOTS) rmSync(dir, { recursive: true, force: true });
});

describe("quota fail-boot (2026-10-03 review M6)", () => {
  const base = {
    CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
    CO_WORKSPACE_DATA_DIR: scratch("quota"),
  };
  test("anon provisioning with unset quotas fails boot with remediation", () => {
    expect(() => loadConfig(base)).toThrow(/requires explicit quotas/);
  });
  test("anon provisioning with all three quotas set boots", () => {
    const cfg = loadConfig({
      ...base,
      CO_WORKSPACE_TENANT_MAX_TURNS: "50",
      CO_WORKSPACE_TENANT_MAX_TOKENS: "1000",
      CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "5000",
    });
    expect(cfg.allowAnonProvisioning).toBe(true);
  });
  test("anon provisioning off keeps the quota-free default", () => {
    const cfg = loadConfig({ CO_WORKSPACE_DATA_DIR: scratch("quota-off") });
    expect(cfg.allowAnonProvisioning).toBe(false);
    expect(cfg.tenantMaxTurns).toBe(0);
  });
});

describe("isolation posture warning (2026-10-03 review H1)", () => {
  test("fires for credential-protected process mode and names /proc/1/environ", () => {
    const warning = isolationPostureWarning({ isolation: "process", loginRequired: true, apiKeys: [] });
    expect(warning).toBeTruthy();
    expect(warning).toContain("/proc/1/environ");
  });
  test("null for docker isolation", () => {
    expect(isolationPostureWarning({ isolation: "docker", loginRequired: true, apiKeys: [] })).toBeNull();
  });
  test("null for open mode (the open-mode warning already covers it)", () => {
    expect(isolationPostureWarning({ isolation: "process", loginRequired: false, apiKeys: [] })).toBeNull();
  });
});

describe("bootstrapAdmin promotion (2026-10-03 review M5)", () => {
  test("promoting an existing user invalidates their live sessions and reports promoted", async () => {
    const store = new UserStore(scratch("admin"));
    try {
      const created = store.createUser({ email: "op@example.com", name: "op", password: "longenough1" });
      expect(created).toBeTruthy();
      const token = store.createSession(created!.id);
      expect(store.resolveSession(token)?.id).toBe(created!.id);

      const { user, promoted } = store.bootstrapAdmin("op@example.com");
      expect(promoted).toBe(true);
      expect(user?.role).toBe("admin");
      // the in-flight session was purged — the grant lands on a fresh sign-in
      expect(store.resolveSession(token)).toBeNull();

      const second = store.bootstrapAdmin("op@example.com");
      expect(second.promoted).toBe(false); // idempotent
    } finally {
      store.close(); // Windows cannot delete an open SQLite file
    }
  });
});

describe("email-change verification binding (2026-10-03 review M4)", () => {
  test("a pending change for user A cannot be consumed under user B's session", async () => {
    const store = new UserStore(scratch("email"));
    try {
      const a = store.createUser({ email: "a@example.com", name: "a", password: "longenough1" })!;
      store.createUser({ email: "b@example.com", name: "b", password: "longenough1" });
      const staged = store.createEmailChange(a.id, "new-a@example.com");
      expect(staged.ok).toBe(true);
      if (!staged.ok) return;
      // bound to the WRONG user → invalid (the token is consumed, nothing applied)
      const wrong = store.verifyEmailChange(staged.token, "u-not-the-owner");
      expect(wrong.ok).toBe(false);
      // still bound to the right user → applies
      const restaged = store.createEmailChange(a.id, "new-a@example.com");
      expect(restaged.ok).toBe(true);
      if (!restaged.ok) return;
      const right = store.verifyEmailChange(restaged.token, a.id);
      expect(right.ok).toBe(true);
    } finally {
      store.close(); // Windows cannot delete an open SQLite file
    }
  });
});

describe("readKeyEntries mtime cache (2026-10-03 review, T-20261003-022)", () => {
  test("a rewritten key file (new mtime) is re-read without an explicit invalidation", async () => {
    const path = join(scratch("keys"), ".env.keys");
    writeFileSync(path, "key-one:alice\n");
    expect(readKeyEntries(path).map((e) => e.label)).toEqual(["alice"]);
    // bump the mtime well past cache granularity, then rotate the file
    await new Promise((r) => setTimeout(r, 20));
    writeFileSync(path, "key-two:bob\n");
    const entries = readKeyEntries(path);
    expect(entries.map((e) => e.key)).toEqual(["key-two"]);
    expect(entries[0]?.label).toBe("bob");
  });
});

describe("uniform turn watchdog + onSpawn contract (2026-10-03 review H1)", () => {
  const binDir = scratch("fakes");
  beforeAll(() => {
    // Fake CLIs: print nothing (no result event) and sleep past any short watchdog.
    for (const name of ["fake-claude.ts", "fake-codex.ts"]) {
      const p = join(binDir, name);
      writeFileSync(p, 'await Bun.stdin.text?.().catch(() => {});\nawait Bun.sleep(10_000);\n');
      chmodSync(p, 0o755);
    }
  });

  test("runClaudeTurn kills an over-budget turn (exit 124) and registers onSpawn", async () => {
    let spawned = false;
    const result = await runClaudeTurn(
      {
        claudeBin: join(binDir, "fake-claude.ts"),
        binPrefix: ["bun"],
        projectDir: binDir,
        message: "hi",
        timeoutMs: 300,
        onSpawn: () => {
          spawned = true;
        },
      },
      () => {},
    );
    expect(spawned).toBe(true);
    expect(result.exitCode).toBe(124);
  }, 15_000);

  test("runCodexTurn kills an over-budget turn (exit 124) and registers onSpawn", async () => {
    let spawned = false;
    const result = await runCodexTurn(
      {
        codexBin: join(binDir, "fake-codex.ts"),
        binPrefix: ["bun"],
        projectDir: binDir,
        message: "hi",
        timeoutMs: 300,
        onSpawn: () => {
          spawned = true;
        },
      },
      () => {},
    );
    expect(spawned).toBe(true);
    expect(result.exitCode).toBe(124);
  }, 15_000);
});

describe("delete-vs-queued-turn abort (2026-10-03 review M10)", () => {
  // createState bootstraps the argon2id admin hash — CPU-bound and slow on
  // windows runners, so the default 5s test timeout flakes (PR #1379 run
  // 37143647801: 5133ms). Same treatment as the watchdog tests above.
  test("a queued turn whose tenant row vanished aborts without recording history", async () => {
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("race"),
      CO_WORKSPACE_WORKSPACE_DIR: scratch("race-ws"),
    });
    const state = createState(cfg);
    try {
      const rec = {
        tenantId: "gw-deadbeef1234",
        variant: "co-consult",
        status: "ready",
        createdAt: new Date().toISOString(),
        projectDir: join(cfg.dataDir, "storage", "p", "n", "project"),
        hermesHome: join(cfg.dataDir, "storage", "p", "n", "hermes-home"),
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
      } as TenantRecord;
      // No registry row on purpose: the queued task must abort against the deleted tenant.
      const result = await runChat(state, rec, "hello");
      expect(result.exitCode).toBeNull();
      expect(result.stderrTail).toContain("tenant deleted");
      expect(state.turns.list(rec.tenantId)).toEqual([]);
    } finally {
      // Windows cannot delete an open SQLite file — release the handles before cleanup.
      for (const store of [state.registry, state.turns, state.users, state.audit]) {
        try {
          store.close();
        } catch {
          /* best effort */
        }
      }
    }
  }, 15_000);
});

describe("CLI provider-key injection (2026-10-03 cli-provider-key design, T-20261003-024)", () => {
  const key = { llmApiKey: "sk-test-123", llmProvider: undefined, llmBaseUrl: undefined };

  test("claude + anthropic: ANTHROPIC_API_KEY, no BASE_URL without llmBaseUrl", () => {
    const env = runtimeProviderKeyEnv("claude", { ...key, llmProvider: "anthropic" });
    expect(env).toEqual({ ANTHROPIC_API_KEY: "sk-test-123" });
  });
  test("claude + zai/custom with base URL: ANTHROPIC_API_KEY + ANTHROPIC_BASE_URL", () => {
    const env = runtimeProviderKeyEnv("claude", { ...key, llmProvider: "zai", llmBaseUrl: "https://api.z.ai/api/anthropic" });
    expect(env).toEqual({ ANTHROPIC_API_KEY: "sk-test-123", ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic" });
    expect(runtimeProviderKeyEnv("claude", { ...key, llmProvider: "custom", llmBaseUrl: "https://proxy.example/v1" })?.ANTHROPIC_BASE_URL).toBe("https://proxy.example/v1");
  });
  test("codex + openai/custom: OPENAI_API_KEY (base URL is config.toml-side, not injected)", () => {
    expect(runtimeProviderKeyEnv("codex", { ...key, llmProvider: "openai" })).toEqual({ OPENAI_API_KEY: "sk-test-123" });
    expect(runtimeProviderKeyEnv("codex", { ...key, llmProvider: "custom" })).toEqual({ OPENAI_API_KEY: "sk-test-123" });
  });
  test("family mismatch injects nothing", () => {
    expect(runtimeProviderKeyEnv("codex", { ...key, llmProvider: "anthropic" })).toBeNull();
    expect(runtimeProviderKeyEnv("claude", { ...key, llmProvider: "gemini" })).toBeNull();
    expect(runtimeProviderKeyEnv("codex", { ...key, llmProvider: "zai" })).toBeNull();
  });
  test("antigravity and hermes never inject (hermes owns its own path)", () => {
    expect(runtimeProviderKeyEnv("antigravity", { ...key, llmProvider: "gemini" })).toBeNull();
    expect(runtimeProviderKeyEnv("hermes", { ...key, llmProvider: "anthropic" })).toBeNull();
  });
  test("keyless → null (operator logins keep working)", () => {
    expect(runtimeProviderKeyEnv("claude", { llmApiKey: undefined, llmProvider: "anthropic" })).toBeNull();
    expect(runtimeProviderKeyEnv("codex", { llmApiKey: "", llmProvider: "openai" })).toBeNull();
  });
  test("runtimeProviderKeyGap explains antigravity and mismatches; silent when matched", () => {
    expect(runtimeProviderKeyGap("antigravity", { ...key, llmProvider: "gemini" })).toContain("login-only");
    expect(runtimeProviderKeyGap("codex", { ...key, llmProvider: "anthropic" })).toContain("does not speak the codex protocol");
    expect(runtimeProviderKeyGap("claude", { ...key, llmProvider: "anthropic" })).toBeNull();
    expect(runtimeProviderKeyGap("claude", { llmApiKey: undefined, llmProvider: "anthropic" })).toBeNull();
  });
  test("runtimeProviderKeyWarning wraps the gap with the boot prefix", () => {
    expect(runtimeProviderKeyWarning({ runtime: "antigravity", ...key, llmProvider: "gemini" })).toContain("[co-workspace] PROVIDER KEY NOT APPLICABLE");
    expect(runtimeProviderKeyWarning({ runtime: "claude", ...key, llmProvider: "anthropic" })).toBeNull();
  });
});

describe("docker-isolated sibling turns for claude/codex (2026-10-03 sibling-turns design, T-20261003-025)", () => {
  const container = {
    image: "co-workspace-runtime:latest",
    dockerBin: "docker",
    name: "co-workspace-turn-gw-abc123-abcd1234",
    tenantId: "gw-abc123",
    instance: "default",
    hostProjectDir: "/host/data/storage/p/n/project",
    hostRuntimeHome: "/host/data/storage/p/n/claude-home",
    memory: "2g",
    cpus: "2",
    pidsLimit: 256,
  };
  const claudeInner = ["claude", "-p", "hi", "--output-format", "stream-json", "--verbose"];

  test("claude container argv: entrypoint claude, project+claude-home binds, CLAUDE_CONFIG_DIR, bare -e key", () => {
    const argv = turnSpawnArgv({
      entrypointBin: "claude",
      innerArgs: claudeInner,
      container,
      projectSource: container.hostProjectDir,
      homeLeaf: "claude-home",
      homeSource: container.hostRuntimeHome,
      envPairs: ["CLAUDE_CONFIG_DIR=/work/claude-home"],
      providerKeyEnv: { name: "ANTHROPIC_API_KEY", value: "sk-secret" },
    });
    expect(argv[0]).toBe("docker");
    expect(argv[argv.indexOf("--entrypoint") + 1]).toBe("claude");
    expect(argv).toContain("-v");
    expect(argv.join("\n")).toContain("/host/data/storage/p/n/project:/work/project");
    expect(argv.join("\n")).toContain("/host/data/storage/p/n/claude-home:/work/claude-home");
    expect(argv.join("\n")).toContain("CLAUDE_CONFIG_DIR=/work/claude-home");
    // the secret key rides as a bare -e NAME; the VALUE never appears in argv
    const i = argv.indexOf("ANTHROPIC_API_KEY");
    expect(argv[i - 1]).toBe("-e");
    expect(argv.join("\n")).not.toContain("sk-secret");
    // resource caps + user + labels shared with the hermes contract
    expect(argv).toContain("--user"); expect(argv[argv.indexOf("--user") + 1]).toBe("10000:10000");
    expect(argv).toContain("--cap-drop"); expect(argv).toContain("ALL");
    const imgIdx = argv.indexOf("co-workspace-runtime:latest");
    expect(imgIdx).toBeGreaterThan(argv.indexOf("--entrypoint"));
    expect(argv.slice(imgIdx + 1)).toEqual(["-p", "hi", "--output-format", "stream-json", "--verbose"]);
  });

  test("volume mode: subpath mounts use the runtime home leaf", () => {
    const argv = turnSpawnArgv({
      entrypointBin: "codex",
      innerArgs: ["codex", "exec", "--json", "hi"],
      container: { ...container, dataVolume: "cow-vol", subpathBase: "storage/p/n", hostRuntimeHome: undefined },
      projectSource: "/host/data/storage/p/n/project",
      homeLeaf: "codex-home",
      homeSource: "",
      envPairs: ["CODEX_HOME=/work/codex-home"],
    });
    const j = argv.join("\n");
    expect(j).toContain("type=volume,src=cow-vol,dst=/work/project,volume-subpath=storage/p/n/project");
    expect(j).toContain("type=volume,src=cow-vol,dst=/work/codex-home,volume-subpath=storage/p/n/codex-home");
    expect(j).not.toContain("hermes-home");
  });

  test("hermesSpawnArgv delegates byte-identically (volume + bind fixtures)", () => {
    // the pinned hermes spawn tests prove this too; here we assert the shape directly
    const argv = turnSpawnArgv({
      entrypointBin: "hermes",
      innerArgs: ["hermes", "chat", "--format", "stream-json"],
      container: { ...container, hostRuntimeHome: undefined },
      projectSource: container.hostProjectDir,
      homeLeaf: "hermes-home",
      homeSource: "/host/data/storage/p/n/hermes-home",
      envPairs: ["HERMES_HOME=/work/hermes-home", "HERMES_ACCEPT_HOOKS=1"],
    });
    expect(argv[argv.indexOf("--entrypoint") + 1]).toBe("hermes");
    expect(argv.join("\n")).toContain("/host/data/storage/p/n/hermes-home:/work/hermes-home");
  });

  test("provisioning creates the claude/codex runtime homes beside hermes-home", () => {
    const dir = scratch("homes");
    const rec = {
      tenantId: "gw-abc123",
      variant: "co-consult",
      status: "provisioning",
      createdAt: new Date().toISOString(),
      projectDir: join(dir, "project"),
      hermesHome: join(dir, "hermes-home"),
      sessions: 0,
      inputTokens: 0,
      outputTokens: 0,
    } as TenantRecord;
    seedHermesHome(rec, undefined, "test-model", undefined, undefined);
    expect(existsSync(join(dir, "claude-home"))).toBe(true);
    expect(existsSync(join(dir, "codex-home"))).toBe(true);
  });
});

describe("CSP header allows the app's own scripts (2026-10-03 CSP correction)", () => {
  test("script-src includes both 'self' (app-helpers.js module) and 'unsafe-inline' (inline module scripts)", async () => {
    const { htmlHeaders } = await import("../../services/co-workspace/src/http");
    const csp = htmlHeaders()["content-security-policy"];
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

describe("admin users table per-user rollup (live bug found 2026-10-03)", () => {
  test("/admin/users carries principal — the /admin/stats perUser join key", async () => {
    const { handleAdmin } = await import("../../services/co-workspace/src/routes/admin");
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("adminusers"),
      CO_WORKSPACE_WORKSPACE_DIR: scratch("adminusers-ws"),
    });
    const state = createState(cfg);
    try {
      const owner = state.users.createUser({ email: "owner@example.com", name: "owner", password: "longenough1" })!;
      state.users.createUser({ email: "other@example.com", name: "other", password: "longenough1" });
      state.users.bootstrapAdmin(owner.email); // promotes (and invalidates sessions)
      const rec = state.registry.create({ variant: "co-consult", key: `co-consult::${owner.principal}`, ownerPrincipal: owner.principal });
      mkdirSync(rec.projectDir, { recursive: true });
      const token = state.users.createSession(owner.id);
      const ctx = (path: string) => ({ url: new URL(`http://x${path}`), path, sessionUser: state.users.resolveSession(token), clientIp: "local" });
      const get = (path: string) =>
        handleAdmin(state, new Request(`http://x${path}`, { headers: { cookie: `gw_session=${token}` } }), ctx(path));

      const usersBody = await (await get("/admin/users")).json();
      const ownerRow = usersBody.users.find((u: { id: string }) => u.id === owner.id);
      // the bug: the response omitted principal, so the panel's join on u.principal matched nothing
      expect(ownerRow.principal).toBe(owner.principal);

      const statsBody = await (await get("/admin/stats")).json();
      const pu = statsBody.perUser.find((p: { principal: string }) => p.principal === ownerRow.principal);
      expect(pu).toBeTruthy();
      expect(pu.tenantCount).toBe(1);
    } finally {
      for (const store of [state.registry, state.turns, state.users, state.audit]) {
        try { store.close(); } catch { /* best effort */ }
      }
    }
  });
});

describe("session hardening (2026-10-03 session-hardening design, T-20261003-027)", () => {
  test("idle expiry: a session idle past the idle window is rejected; fresh activity recovers", async () => {
    const { loadConfig } = await import("../../services/co-workspace/src/config");
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("sess-idle"),
      CO_WORKSPACE_SESSION_TTL_HOURS: "24",
      CO_WORKSPACE_SESSION_IDLE_HOURS: "4",
    });
    const store = new UserStore(cfg.dataDir, cfg.sessionTtlMs, cfg.sessionIdleMs);
    try {
      const u = store.createUser({ email: "s@example.com", name: "s", password: "longenough1" })!;
      const token = store.createSession(u.id);
      expect(store.resolveSession(token)?.id).toBe(u.id);
      // simulate idleness: backdate last_seen past the 4h idle window
      store.db.query("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
        .run(new Date(Date.now() - 5 * 3600 * 1000).toISOString(), (await import("../../services/co-workspace/src/users")).hashToken(token));
      expect(store.resolveSession(token)).toBeNull(); // idle-expired and purged
    } finally {
      store.close();
    }
  });

  test("absolute TTL still caps a continuously-active session", async () => {
    const { loadConfig } = await import("../../services/co-workspace/src/config");
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("sess-ttl"),
      CO_WORKSPACE_SESSION_TTL_HOURS: "24",
      CO_WORKSPACE_SESSION_IDLE_HOURS: "4",
    });
    const store = new UserStore(cfg.dataDir, cfg.sessionTtlMs, cfg.sessionIdleMs);
    try {
      const u = store.createUser({ email: "t@example.com", name: "t", password: "longenough1" })!;
      const token = store.createSession(u.id);
      const h = (await import("../../services/co-workspace/src/users")).hashToken(token);
      // keep last_seen fresh (active use) but backdate expires_at past the absolute cap
      store.db.query("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
        .run(new Date(Date.now() - 1000).toISOString(), h);
      expect(store.resolveSession(token)).toBeNull();
    } finally {
      store.close();
    }
  });

  test("revoke-others keeps the current session; revoke-all purges everything", async () => {
    const { loadConfig } = await import("../../services/co-workspace/src/config");
    const cfg = loadConfig({ CO_WORKSPACE_DATA_DIR: scratch("sess-revoke") });
    const store = new UserStore(cfg.dataDir, cfg.sessionTtlMs, cfg.sessionIdleMs);
    try {
      const u = store.createUser({ email: "r@example.com", name: "r", password: "longenough1" })!;
      const keep = store.createSession(u.id);
      const other1 = store.createSession(u.id);
      const other2 = store.createSession(u.id);
      const list = store.listSessions(keep);
      expect(list.length).toBe(3);
      expect(list.filter((x) => x.current).length).toBe(1);
      const revoked = store.revokeOtherSessions(keep);
      expect(revoked).toBe(2);
      expect(store.resolveSession(keep)?.id).toBe(u.id);
      expect(store.resolveSession(other1)).toBeNull();
      expect(store.resolveSession(other2)).toBeNull();
      const all = store.revokeAllSessions(keep);
      expect(all).toBe(1);
      expect(store.resolveSession(keep)).toBeNull();
    } finally {
      store.close();
    }
  });

  test("destructive admin ops require password re-confirmation (D4)", async () => {
    const { handleAdmin } = await import("../../services/co-workspace/src/routes/admin");
    const { loadConfig } = await import("../../services/co-workspace/src/config");
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("reauth"),
      CO_WORKSPACE_WORKSPACE_DIR: scratch("reauth-ws"),
    });
    const state = createState(cfg);
    try {
      const admin = state.users.createUser({ email: "ad@example.com", name: "ad", password: "longenough1" })!;
      state.users.bootstrapAdmin("ad@example.com"); // promote to admin
      const token = state.users.createSession(admin.id); // created AFTER promotion — survives the purge
      const ctx = { url: new URL("http://x/admin/users/x/reset-password"), path: "/admin/users/x/reset-password", sessionUser: state.users.resolveSession(token), clientIp: "local" };
      // handleAdmin propagates HttpError (the catch lives in handleRequest) — assert the throws
      const call = (pw?: string) => handleAdmin(
        state,
        new Request("http://x/admin/users/x/reset-password", { method: "POST", headers: { cookie: `gw_session=${token}`, "content-type": "application/json", ...(pw ? { "x-admin-password": pw } : {}) }, body: "{}" }),
        ctx,
      );
      const noHeader = await call().then((r) => r.status, (e) => ({ status: e.status, message: e.message }));
      expect(noHeader.status ?? noHeader).toBe(403);
      expect(String(noHeader.message ?? noHeader)).toContain("re-confirmation");
      const wrong = await call("wrong-password").then((r) => r.status, (e) => ({ status: e.status, message: e.message }));
      expect(wrong.status ?? wrong).toBe(403);
      // correct password → past re-auth (404: the fixture user id does not exist)
      const good = await call("longenough1").then((r) => r.status, (e) => ({ status: e.status, message: e.message }));
      expect(good.status ?? good).toBe(404);
    } finally {
      for (const store of [state.registry, state.turns, state.users, state.audit]) {
        try { store.close(); } catch { /* best effort */ }
      }
    }
  });
});
