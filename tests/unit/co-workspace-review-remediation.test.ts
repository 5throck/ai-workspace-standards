/**
 * Tests for the 2026-10-03 review remediation wave
 * (docs/designs/2026-10-03-coworkspace-review-remediation-design.md, tickets
 * T-20261003-012..022): quota fail-boot, isolation posture warning, admin-promotion
 * invalidation, email-change binding, key-entry cache rotation, the uniform turn
 * watchdog/onSpawn contract, and the delete-vs-queued-turn abort.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, readKeyEntries } from "../../services/co-workspace/src/config";
import { isolationPostureWarning } from "../../services/co-workspace/src/access";
import { UserStore } from "../../services/co-workspace/src/users";
import { runClaudeTurn } from "../../services/co-workspace/src/claude";
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
  });
});

describe("email-change verification binding (2026-10-03 review M4)", () => {
  test("a pending change for user A cannot be consumed under user B's session", async () => {
    const store = new UserStore(scratch("email"));
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
  test("a queued turn whose tenant row vanished aborts without recording history", async () => {
    const cfg = loadConfig({
      CO_WORKSPACE_DATA_DIR: scratch("race"),
      CO_WORKSPACE_WORKSPACE_DIR: scratch("race-ws"),
    });
    const state = createState(cfg);
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
  });
});
