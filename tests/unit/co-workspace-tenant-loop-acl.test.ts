/**
 * Tenant-loop admin ACL + gateway-side enforcement (design
 * 2026-11-08-gw-tenant-loop-and-hardening-design §4, §7.6): gating matrix (admin /
 * designated member / plain user / unauthenticated — allow AND deny audited), kill switch,
 * per-tenant daily upgrade quota, windows enforcement (gateway refuses out-of-window
 * triggers), registry export (atomic write, schema, written after mutation + at boot),
 * and the dry-run vs confirm upgrade executor with a FAKED subprocess (never spawn real
 * bun/git in tests). Fixtures: mkdtempSync + absolute tmpdir roots only (T-20261104-003).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createState, handleRequest } from "../../services/co-workspace/src/server";
import type { GatewayState } from "../../services/co-workspace/src/state";
import {
  DEFAULT_LOOP_WINDOWS,
  TENANT_LOOP_UPGRADE_DAILY_CAP,
  buildTenantLoopExport,
  evaluateTenantUpgrade,
  exportTenantLoopRegistry,
  loopWindowVerdict,
  snapshotBranchName,
  tenantLoopRegistryPath,
  tenantUpgradeEnv,
  type TenantLoopExecDeps,
  type TenantLoopRegistryExport,
} from "../../services/co-workspace/src/tenant-loop";

// ── Fixture state (one gateway per describe block; dataDir/workspaceDir absolute tmp) ──

function makeState(label: string): { state: GatewayState; dataDir: string; workspaceDir: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), `gw-tenant-loop-${label}-`));
  const dataDir = join(root, "data");
  const workspaceDir = join(root, "workspace");
  mkdirSync(join(workspaceDir, "scripts"), { recursive: true });
  // Present but NEVER executed — executor tests inject a fake spawn.
  writeFileSync(join(workspaceDir, "scripts", "upgrade-project.ts"), "// fixture: fake upgrade engine\n");
  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: "0",
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: workspaceDir,
    CO_WORKSPACE_VARIANTS: "co-consult",
  });
  const state = createState(cfg);
  return {
    state,
    dataDir,
    workspaceDir,
    // closeState FIRST: Windows keeps the SQLite handles (users/registry/audit/turns) locked
    // until the connection is closed, so a bare rmSync over this root fails with EBUSY. The
    // maxRetries pair additionally absorbs the short OS-level release lag after close (the
    // mcp-upstream-tenant-identity pattern). Idempotent: per-block afterAll hooks also call
    // closeState, and its per-store try/catch tolerates the second close.
    cleanup: () => {
      closeState(state);
      rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

function req(state: GatewayState, method: string, path: string, opts: { body?: unknown; token?: string } = {}): Promise<Response> {
  const headers: Record<string, string> = { "content-type": "application/json", "x-requested-with": "co-workspace" };
  if (opts.token) headers.cookie = `gw_session=${opts.token}`;
  return handleRequest(
    state,
    new Request(`http://127.0.0.1${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }),
  );
}

/** Full-day UTC window — always open, so tests can isolate the non-window refusals. */
const ALWAYS_OPEN_WINDOWS = { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" };

function auditActions(state: GatewayState, limit = 100): string[] {
  return state.audit.list(limit).map((e) => e.action);
}

/** Checkpoint + release the SQLite handles so the tmpdir can be removed (Windows CI). */
function closeState(state: GatewayState): void {
  for (const store of [state.registry, state.turns, state.users, state.audit]) {
    try {
      store.close();
    } catch {
      /* best effort */
    }
  }
}

// ── Windows enforcement (gateway mirror of the workspace helper) ──

describe("loopWindowVerdict — tz-aware windows (design §3.2/§6)", () => {
  const businessHours = { tz: "UTC", days: [3], start: "09:00", end: "17:00" }; // Wednesday

  test("in-window", () => {
    expect(loopWindowVerdict(businessHours, new Date("2026-11-11T10:30:00Z")).ok).toBe(true); // Wed 10:30
  });

  test("out-of-window by time", () => {
    const v = loopWindowVerdict(businessHours, new Date("2026-11-11T08:30:00Z"));
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("outside window");
  });

  test("out-of-window by weekday", () => {
    expect(loopWindowVerdict(businessHours, new Date("2026-11-10T10:30:00Z")).ok).toBe(false); // Tuesday
  });

  test("boundaries match the workspace authority (start inclusive, end exclusive)", () => {
    // Same math as scripts/lib/fleet.ts isTenantWithinWindows (design §4.3 mirror).
    expect(loopWindowVerdict(businessHours, new Date("2026-11-11T09:00:00Z")).ok).toBe(true); // start minute in
    expect(loopWindowVerdict(businessHours, new Date("2026-11-11T17:00:00Z")).ok).toBe(false); // end minute out
  });

  test("wrap-midnight tail admits the previous day (22:00-06:00 on Wed covers Thu 01:00)", () => {
    const wedNight = { tz: "UTC", days: [3], start: "22:00", end: "06:00" };
    expect(loopWindowVerdict(wedNight, new Date("2026-11-11T23:30:00Z")).ok).toBe(true); // Wed evening
    expect(loopWindowVerdict(wedNight, new Date("2026-11-12T01:00:00Z")).ok).toBe(true); // Thu tail
    expect(loopWindowVerdict(wedNight, new Date("2026-11-10T23:30:00Z")).ok).toBe(false); // Tue evening — not a window day
    expect(loopWindowVerdict(wedNight, new Date("2026-11-12T12:00:00Z")).ok).toBe(false); // Thu midday
  });

  test("wrap-midnight window (22:00-06:00 KST) true at 23:30 and 01:00, false at 12:00", () => {
    const night = { tz: "Asia/Seoul", days: [0, 1, 2, 3, 4, 5, 6], start: "22:00", end: "06:00" };
    expect(loopWindowVerdict(night, new Date("2026-11-09T14:30:00Z")).ok).toBe(true); // 23:30 KST
    expect(loopWindowVerdict(night, new Date("2026-11-09T16:00:00Z")).ok).toBe(true); // 01:00 KST (next day)
    expect(loopWindowVerdict(night, new Date("2026-11-09T03:00:00Z")).ok).toBe(false); // 12:00 KST
  });

  test("fail-closed: invalid tz, unparseable bounds, empty days, equal bounds", () => {
    expect(loopWindowVerdict({ ...ALWAYS_OPEN_WINDOWS, tz: "Not/AZone" }, new Date()).ok).toBe(false);
    expect(loopWindowVerdict({ ...ALWAYS_OPEN_WINDOWS, start: "24:00" }, new Date()).ok).toBe(false);
    expect(loopWindowVerdict({ ...ALWAYS_OPEN_WINDOWS, end: "22:60" }, new Date()).ok).toBe(false);
    expect(loopWindowVerdict({ ...ALWAYS_OPEN_WINDOWS, days: [] }, new Date()).ok).toBe(false);
    expect(loopWindowVerdict({ ...ALWAYS_OPEN_WINDOWS, start: "10:00", end: "10:00" }, new Date()).ok).toBe(false);
  });

  test("no windows configured = no restriction", () => {
    expect(loopWindowVerdict(undefined, new Date()).ok).toBe(true);
  });

  test("default windows are the unrestricted KST set", () => {
    expect(DEFAULT_LOOP_WINDOWS).toEqual({ tz: "Asia/Seoul", days: [0, 1, 2, 3, 4, 5, 6], start: "00:00", end: "23:59" });
  });
});

// ── Registry export writer ──

describe("tenant-loop registry export (design §3.1/§4.5)", () => {
  test("atomic write: schema fields complete, no temp residue", () => {
    const fx = makeState("export");
    try {
      const rec = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "proj-a" });
      rec.loopStatus = "active";
      fx.state.registry.upsert(rec);
      const result = exportTenantLoopRegistry(fx.state, new Date("2026-11-08T12:00:00.000Z"));
      expect(result.ok).toBe(true);
      const path = tenantLoopRegistryPath(fx.workspaceDir);
      expect(existsSync(path)).toBe(true);
      const parsed = JSON.parse(readFileSync(path, "utf8")) as TenantLoopRegistryExport;
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.writtenAt).toBe("2026-11-08T12:00:00.000Z");
      expect(parsed.tenants.length).toBe(1);
      const row = parsed.tenants[0];
      expect(Object.keys(row).sort()).toEqual(
        ["gitRemote", "id", "principal", "projectDir", "scopes", "status", "variant", "windows"].sort(),
      );
      expect(row.id).toBe(rec.tenantId);
      expect(row.status).toBe("active");
      expect(Object.keys(row.scopes).sort()).toEqual(["backportReview", "nightlyFleet", "upgrade", "upstreamFile"]);
      expect(row.windows.tz).toBe("Asia/Seoul"); // defaults when no group/override
      expect(row.gitRemote).toBe("local-only");
      const residue = readdirSync(join(fx.workspaceDir, ".pipeline-state")).filter((f) => f.endsWith(".tmp"));
      expect(residue).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });

  test("failed write is loud + audited, returns ok:false", () => {
    const fx = makeState("export-fail");
    try {
      // Break the target directory: .pipeline-state exists as a FILE → mkdirSync fails.
      writeFileSync(join(fx.workspaceDir, ".pipeline-state"), "not a dir");
      const result = exportTenantLoopRegistry(fx.state);
      expect(result.ok).toBe(false);
      expect(fx.state.audit.list(10).some((e) => e.action === "tenant.loop.export.failed")).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  test("boot hook: exportTenantLoopRegistry is wired in the server boot path (structural)", () => {
    const source = readFileSync(join(import.meta.dir, "..", "..", "services", "co-workspace", "src", "server.ts"), "utf8");
    const bootIndex = source.indexOf("if (import.meta.main)");
    expect(bootIndex).toBeGreaterThan(0);
    expect(source.slice(bootIndex)).toContain("exportTenantLoopRegistry(state)");
  });

  test("kill switch suspends every row in the export without mutating records", () => {
    const fx = makeState("export-kill");
    try {
      const rec = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "proj-a" });
      rec.loopStatus = "active";
      fx.state.registry.upsert(rec);
      process.env.CO_WORKSPACE_TENANT_LOOP_DISABLED = "1";
      try {
        const built = buildTenantLoopExport(fx.state.registry.list(), fx.state.users.listGroups());
        expect(built.tenants[0]?.status).toBe("suspended");
        expect(fx.state.registry.get(rec.tenantId)?.loopStatus).toBe("active"); // record untouched
      } finally {
        delete process.env.CO_WORKSPACE_TENANT_LOOP_DISABLED;
      }
    } finally {
      fx.cleanup();
    }
  });

  test("QA F2: schema-invalid stored rows are skipped + audited — one hand-edited row cannot make the reader reject the whole file", () => {
    const fx = makeState("export-skip");
    try {
      const good = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "good" });
      good.loopStatus = "active";
      fx.state.registry.upsert(good);
      // Hand-edited row #1: variant outside the co-* namespace the reader requires.
      const badVariant = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "bob", name: "badvariant" });
      badVariant.loopStatus = "active";
      badVariant.variant = "../../evil";
      fx.state.registry.upsert(badVariant);
      // Hand-edited row #2: empty gitRemote (the ?? default only covers null/undefined).
      const badRemote = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "carol", name: "badremote" });
      badRemote.loopStatus = "active";
      badRemote.loopGitRemote = "";
      fx.state.registry.upsert(badRemote);

      const result = exportTenantLoopRegistry(fx.state);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("expected ok export");
      expect(result.tenants).toBe(1);
      expect(result.skipped).toBe(2);
      const onDisk = JSON.parse(readFileSync(tenantLoopRegistryPath(fx.workspaceDir), "utf8")) as TenantLoopRegistryExport;
      expect(onDisk.tenants.map((t) => t.id)).toEqual([good.tenantId]);
      const skips = fx.state.audit.list(20).filter((e) => e.action === "tenant.loop.export.row.skipped");
      expect(skips.map((e) => e.target).sort()).toEqual([badRemote.tenantId, badVariant.tenantId].sort());
      expect(skips.every((e) => typeof e.detail === "string" && e.detail.length > 0)).toBe(true);
    } finally {
      fx.cleanup();
    }
  });

  test("QA H8: the registry export file is written 0600 (principal loginId inside)", () => {
    const fx = makeState("export-mode");
    try {
      const rec = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "proj-a" });
      rec.loopStatus = "active";
      fx.state.registry.upsert(rec);
      const result = exportTenantLoopRegistry(fx.state);
      expect(result.ok).toBe(true);
      const mode = statSync(tenantLoopRegistryPath(fx.workspaceDir)).mode & 0o777;
      expect(mode).toBe(0o600);
    } finally {
      fx.cleanup();
    }
  });
});

// ── Admin ACL: gating matrix + kill switch over HTTP ──

describe("tenant-loop admin ACL (design §4.2/§4.4)", () => {
  const fx = makeState("acl");
  const adminUser = fx.state.users.createUser({ email: "admin@example.com", name: "Admin", password: "admin-password-1", role: "admin" })!;
  const member = fx.state.users.createUser({ email: "member@example.com", name: "Member", password: "member-password-1" })!;
  const outsider = fx.state.users.createUser({ email: "outsider@example.com", name: "Outsider", password: "outsider-password-1" })!;
  const adminSession = fx.state.users.createSession(adminUser.id);
  const memberSession = fx.state.users.createSession(member.id);
  const outsiderSession = fx.state.users.createSession(outsider.id);
  const tenant = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: member.principal, name: "loopproj" });
  afterAll(() => {
    closeState(fx.state);
    fx.cleanup();
  });

  test("admin configures the group; designated member registers the tenant; export written after mutation", async () => {
    const cfgRes = await req(fx.state, "PUT", "/admin/tenant-loop/config", {
      token: adminSession,
      body: {
        group: "loop-team",
        designatedUsers: [member.principal],
        scopes: { upgrade: true, nightlyFleet: true },
        windows: ALWAYS_OPEN_WINDOWS,
      },
    });
    expect(cfgRes.status).toBe(200);

    const regRes = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/register`, {
      token: memberSession,
      body: { group: "loop-team" },
    });
    expect(regRes.status).toBe(200);
    const body = await regRes.json();
    expect(body.loopStatus).toBe("active");
    expect(body.export.ok).toBe(true);
    // Export file on disk reflects the mutation (§4.5).
    const onDisk = JSON.parse(readFileSync(tenantLoopRegistryPath(fx.workspaceDir), "utf8")) as TenantLoopRegistryExport;
    expect(onDisk.tenants.map((t) => t.id)).toContain(tenant.tenantId);
    expect(onDisk.tenants[0].scopes.nightlyFleet).toBe(true); // inherited from the group
  });

  test("plain user → 403 default deny, audited; unauthenticated → 403, audited", async () => {
    const res = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/suspend`, { token: outsiderSession });
    expect(res.status).toBe(403);
    const anon = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/suspend`);
    expect(anon.status).toBe(403);
    const denies = fx.state.audit.list(20).filter((e) => e.action === "tenant.loop.suspend.denied");
    expect(denies.length).toBeGreaterThanOrEqual(2);
    expect(denies.some((e) => e.actor === outsider.principal && e.detail === `not a designated user of group "loop-team"`)).toBe(true);
    expect(denies.some((e) => e.actor === "anonymous" && e.detail === "unauthenticated")).toBe(true);
  });

  test("allow AND deny rows recorded (register matrix)", async () => {
    const actions = auditActions(fx.state);
    expect(actions).toContain("tenant.loop.register.allowed"); // designated member (via=designated)
    expect(actions).toContain("tenant.loop.config.allowed");
    const allows = fx.state.audit.list(50).filter((e) => e.action === "tenant.loop.register.allowed");
    expect(allows.some((e) => e.detail === "via=designated")).toBe(true);
  });

  test("kill switch: every tenant-loop route 403 typed + audited", async () => {
    process.env.CO_WORKSPACE_TENANT_LOOP_DISABLED = "1";
    try {
      for (const attempt of [
        () => req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/register`, { token: adminSession, body: {} }),
        () => req(fx.state, "PUT", "/admin/tenant-loop/config", { token: adminSession, body: { group: "x" } }),
        () => req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/upgrade`, { token: adminSession, body: {} }),
        () => req(fx.state, "GET", "/admin/tenant-loop/registry", { token: adminSession }),
      ]) {
        const res = await attempt();
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.code).toBe("tenant_loop_disabled");
      }
      expect(auditActions(fx.state)).toContain("tenant.loop.denied");
    } finally {
      delete process.env.CO_WORKSPACE_TENANT_LOOP_DISABLED;
    }
  });

  test("suspend → export reads suspended; deregister → tenant leaves the export, record kept", async () => {
    const suspend = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/suspend`, { token: adminSession, body: {} });
    expect(suspend.status).toBe(200);
    let onDisk = JSON.parse(readFileSync(tenantLoopRegistryPath(fx.workspaceDir), "utf8")) as TenantLoopRegistryExport;
    expect(onDisk.tenants.find((t) => t.id === tenant.tenantId)?.status).toBe("suspended");

    const dereg = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/deregister`, { token: adminSession, body: {} });
    expect(dereg.status).toBe(200);
    onDisk = JSON.parse(readFileSync(tenantLoopRegistryPath(fx.workspaceDir), "utf8")) as TenantLoopRegistryExport;
    expect(onDisk.tenants.map((t) => t.id)).not.toContain(tenant.tenantId);
    expect(fx.state.registry.get(tenant.tenantId)).toBeDefined(); // tenant kept
    expect(fx.state.registry.get(tenant.tenantId)?.loopStatus).toBeUndefined();
  });

  test("validation: malformed windows/scope keys rejected with 400", async () => {
    const badWindow = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenant.tenantId}/register`, {
      token: adminSession,
      body: { windows: { tz: "UTC", days: [0], start: "24:00", end: "06:00" } },
    });
    expect(badWindow.status).toBe(400);
    const badScope = await req(fx.state, "PUT", "/admin/tenant-loop/config", {
      token: adminSession,
      body: { group: "g2", scopes: { nope: true } },
    });
    expect(badScope.status).toBe(400);
  });

  test("GET /admin/tenant-loop/registry previews the export", async () => {
    const res = await req(fx.state, "GET", "/admin/tenant-loop/registry", { token: adminSession });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registry.schemaVersion).toBe(1);
    expect(["file", "rebuilt"]).toContain(body.source);
    expect(body.exportPath).toBe(tenantLoopRegistryPath(fx.workspaceDir));
  });
});

// ── Upgrade: quota, drain, dry-run vs confirm, snapshot best-effort ──

describe("tenant upgrade evaluation (design §4.4, §7.6)", () => {
  const fx = makeState("upgrade");
  const tenant = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "upproj" });
  afterAll(() => {
    closeState(fx.state);
    fx.cleanup();
  });

  function registeredWindows(): void {
    const rec = fx.state.registry.get(tenant.tenantId)!;
    rec.loopStatus = "active";
    rec.loopGroup = "default";
    rec.loopOverride = { scopes: { upgrade: true }, windows: ALWAYS_OPEN_WINDOWS };
    fx.state.registry.upsert(rec);
    // QA H5: the executor containment check realpaths the projectDir — the fixture
    // materializes the storage layout registry.create only computes lazily.
    mkdirSync(rec.projectDir, { recursive: true });
  }

  test("unregistered → 409 typed", async () => {
    let code: string | undefined;
    try {
      await evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!);
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe("tenant_loop_not_registered");
  });

  test("suspended → 409; scopes.upgrade=false → 403", async () => {
    const rec = fx.state.registry.get(tenant.tenantId)!;
    rec.loopStatus = "suspended";
    fx.state.registry.upsert(rec);
    await expect(evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!)).rejects.toMatchObject({ code: "tenant_loop_suspended" });

    const scoped = fx.state.registry.get(tenant.tenantId)!;
    scoped.loopStatus = "active";
    scoped.loopOverride = { scopes: { upgrade: false }, windows: ALWAYS_OPEN_WINDOWS };
    fx.state.registry.upsert(scoped);
    await expect(evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!)).rejects.toMatchObject({ code: "tenant_loop_scope_off" });
    registeredWindows();
  });

  test("out-of-window trigger refused by the gateway (deterministic now)", async () => {
    const rec = fx.state.registry.get(tenant.tenantId)!;
    rec.loopOverride = { scopes: { upgrade: true }, windows: { tz: "UTC", days: [0, 1, 2, 3, 4, 5, 6], start: "09:00", end: "17:00" } };
    fx.state.registry.upsert(rec);
    await expect(
      evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, { now: new Date("2026-11-11T08:00:00Z") }),
    ).rejects.toMatchObject({ code: "tenant_loop_out_of_window" });
    registeredWindows();
  });

  test("active turn → drain refusal", async () => {
    fx.state.activeProcs.set(tenant.tenantId, { kill: () => {} });
    try {
      await expect(evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!)).rejects.toMatchObject({ code: "tenant_busy" });
    } finally {
      fx.state.activeProcs.delete(tenant.tenantId);
    }
  });

  test("dry-run default: plan JSON carries command/env allowlist/quota; nothing executes", async () => {
    process.env.CO_WORKSPACE_LLM_API_KEY = "stub"; // fixture value below the pre-commit secret-regex threshold; gateway secret must NOT pass through
    try {
      const result = await evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, {
        now: new Date("2026-11-08T12:00:00Z"),
      });
      if (!("plan" in result)) throw new Error("expected dry-run plan");
      const plan = result.plan;
      expect(plan.dryRun).toBe(true);
      expect(plan.tenantId).toBe(tenant.tenantId);
      expect(plan.snapshotBranch).toMatch(/^tenant-backup\/\d{8}T\d{6}Z$/);
      expect(plan.localOnlyBackup).toBe(true);
      expect(plan.command.slice(1)).toEqual([
        join(fx.workspaceDir, "scripts", "upgrade-project.ts"),
        fx.state.registry.get(tenant.tenantId)!.projectDir,
        "--confirm",
      ]);
      expect(plan.command[0]).toMatch(/bun|deno|node|exe$/); // process.execPath
      expect(plan.envAllowlistKeys).toContain("PATH");
      expect(plan.envAllowlistKeys.some((k) => k.startsWith("CO_WORKSPACE_"))).toBe(false);
      expect(plan.quota).toEqual({ day: "2026-11-08", used: 0, cap: TENANT_LOOP_UPGRADE_DAILY_CAP });
      expect(fx.state.registry.get(tenant.tenantId)?.loopState).toBeUndefined(); // dry-run consumes nothing
    } finally {
      delete process.env.CO_WORKSPACE_LLM_API_KEY;
    }
  });

  test("confirm executes with the allowlisted env; quota 429 on same-day exceed; rolls with the day key", async () => {
    const spawnCalls: Array<{ argv: string[]; env: Record<string, string | undefined> }> = [];
    const deps: TenantLoopExecDeps = {
      spawn: async (argv, _cwd, env) => {
        spawnCalls.push({ argv, env });
        return { exitCode: 0, stdout: "upgrade ok\n", stderr: "" };
      },
      git: () => ({ exitCode: 0, stdout: "", stderr: "" }),
    };
    const now1 = new Date("2026-11-08T12:00:00Z");
    const ok = await evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, { confirm: true, now: now1, deps });
    if (!("execution" in ok)) throw new Error("expected execution");
    expect(ok.execution.exitCode).toBe(0);
    expect(ok.execution.stdoutTail).toContain("upgrade ok");
    expect(ok.execution.snapshot.ok).toBe(true);
    expect(spawnCalls[0].argv[spawnCalls[0].argv.length - 1]).toBe("--confirm");
    expect(JSON.stringify(spawnCalls[0].env)).not.toContain("stub"); // env allowlist held
    expect(spawnCalls[0].env.PATH).toBeDefined();
    // Quota counter persisted on the record (§4.4 loopState).
    const after = fx.state.registry.get(tenant.tenantId)!;
    expect(after.loopState).toEqual({ upgradesDay: "2026-11-08", upgradesToday: 1 });
    expect(auditActions(fx.state)).toContain("tenant.loop.upgrade.executed");

    // Same UTC day, cap 1 → 429.
    await expect(
      evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, { confirm: true, now: now1, deps }),
    ).rejects.toMatchObject({ status: 429 });

    // Day-key roll resets the counter.
    const nextDay = await evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, {
      confirm: true,
      now: new Date("2026-11-09T12:00:00Z"),
      deps,
    });
    expect("execution" in nextDay).toBe(true);
    expect(fx.state.registry.get(tenant.tenantId)?.loopState?.upgradesToday).toBe(1);
  });

  test("snapshot is best-effort: git failure audited but the upgrade proceeds", async () => {
    const deps: TenantLoopExecDeps = {
      spawn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      git: () => ({ exitCode: 128, stdout: "", stderr: "fatal: not a git repository" }),
    };
    const result = await evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenant.tenantId)!, {
      confirm: true,
      now: new Date("2026-11-10T12:00:00Z"),
      deps,
    });
    if (!("execution" in result)) throw new Error("expected execution");
    expect(result.execution.snapshot.ok).toBe(false);
    expect(result.execution.snapshot.detail).toContain("not a git repository");
    const snapshotRow = fx.state.audit.list(20).find((e) => e.action === "tenant.loop.snapshot");
    expect(snapshotRow?.detail).toContain("git branch failed");
    expect(result.execution.exitCode).toBe(0); // still executed
  });

  test("missing upgrade engine → typed 500, nothing spawned", async () => {
    const lone = makeState("no-script");
    try {
      const rec = lone.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: "ns" });
      rec.loopStatus = "active";
      rec.loopOverride = { scopes: { upgrade: true }, windows: ALWAYS_OPEN_WINDOWS };
      lone.state.registry.upsert(rec);
      mkdirSync(rec.projectDir, { recursive: true }); // QA H5: containment realpaths the dir
      rmSync(join(lone.workspaceDir, "scripts", "upgrade-project.ts"));
      let spawned = false;
      await expect(
        evaluateTenantUpgrade(lone.state, lone.state.registry.get(rec.tenantId)!, {
          confirm: true,
          deps: { spawn: async () => { spawned = true; return { exitCode: 0, stdout: "", stderr: "" }; }, git: () => ({ exitCode: 0, stdout: "", stderr: "" }) },
        }),
      ).rejects.toMatchObject({ code: "upgrade_script_missing" });
      expect(spawned).toBe(false);
    } finally {
      lone.cleanup();
    }
  });

  test("snapshotBranchName produces git-ref-safe names", () => {
    expect(snapshotBranchName(new Date("2026-11-08T12:00:00Z"))).toBe("tenant-backup/20261108T120000Z");
  });
});

// ── WP1 contract seam: the gateway export must satisfy the workspace reader's schema (§3.1) ──

describe("export schema contract", () => {
  test("rows validate against the tenant id namespace, not the fleet namespace", () => {
    const fx = makeState("contract");
    try {
      const rec = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "bob", name: "p" });
      rec.loopStatus = "active";
      rec.loopGitRemote = "https://example.com/git/p.git";
      fx.state.registry.upsert(rec);
      const built = buildTenantLoopExport(fx.state.registry.list(), []);
      expect(built.tenants[0].id).toMatch(/^gw-[0-9a-f]{12}$/);
      expect(built.tenants[0].id).not.toMatch(/^co-/);
      expect(built.tenants[0].gitRemote).toBe("https://example.com/git/p.git");
    } finally {
      fx.cleanup();
    }
  });
});

// ── QA S2 regression: the governing group comes from the TENANT'S OWN record ──

describe("cross-group authorization — governing group is the tenant's own loopGroup (QA S2)", () => {
  const fx = makeState("s2");
  const admin = fx.state.users.createUser({ email: "s2-admin@example.com", name: "Admin", password: "s2-admin-pass-1", role: "admin" })!;
  const memberA = fx.state.users.createUser({ email: "member-a@example.com", name: "Member A", password: "member-a-pass-1" })!;
  const memberB = fx.state.users.createUser({ email: "member-b@example.com", name: "Member B", password: "member-b-pass-1" })!;
  const adminSession = fx.state.users.createSession(admin.id);
  const sessionA = fx.state.users.createSession(memberA.id);
  const sessionB = fx.state.users.createSession(memberB.id);
  const tenantB = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: memberB.principal, name: "group-b-proj" });
  afterAll(() => {
    closeState(fx.state);
    fx.cleanup();
  });

  test("setup: two groups, each with one designated member; tenantB registered into group-b", async () => {
    for (const [groupId, member] of [
      ["group-a", memberA],
      ["group-b", memberB],
    ] as const) {
      const res = await req(fx.state, "PUT", "/admin/tenant-loop/config", {
        token: adminSession,
        body: { group: groupId, designatedUsers: [member.principal], scopes: { upgrade: true } },
      });
      expect(res.status).toBe(200);
    }
    const reg = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenantB.tenantId}/register`, {
      token: sessionB,
      body: { group: "group-b" },
    });
    expect(reg.status).toBe(200);
    expect((await reg.json()).loopGroup).toBe("group-b");
    expect(fx.state.registry.get(tenantB.tenantId)?.loopGroup).toBe("group-b");
  });

  test("a group-A designated member cannot suspend a group-B tenant by naming their own group", async () => {
    const res = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenantB.tenantId}/suspend`, {
      token: sessionA,
      body: { group: "group-a" },
    });
    expect(res.status).toBe(403);
    expect(fx.state.registry.get(tenantB.tenantId)?.loopStatus).toBe("active"); // untouched
    const deny = fx.state.audit.list(20).find((e) => e.action === "tenant.loop.suspend.denied" && e.actor === memberA.principal);
    // The denial names the TENANT'S group — body.group was ignored, not trusted.
    expect(deny?.detail).toBe(`not a designated user of group "group-b"`);
  });

  test("a group-A designated member cannot trigger an upgrade on a group-B tenant", async () => {
    const res = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenantB.tenantId}/upgrade`, {
      token: sessionA,
      body: { group: "group-a", confirm: true },
    });
    expect(res.status).toBe(403);
    const deny = fx.state.audit.list(20).find((e) => e.action === "tenant.loop.upgrade.denied" && e.actor === memberA.principal);
    expect(deny?.detail).toBe(`not a designated user of group "group-b"`);
  });

  test("a group-A designated member cannot deregister a group-B tenant", async () => {
    const res = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenantB.tenantId}/deregister`, {
      token: sessionA,
      body: { group: "group-a" },
    });
    expect(res.status).toBe(403);
    expect(fx.state.registry.get(tenantB.tenantId)?.loopStatus).toBe("active");
  });

  test("register with body.group still works for its designated member (the legitimate path)", async () => {
    const tenantA = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: memberA.principal, name: "group-a-proj" });
    const res = await req(fx.state, "POST", `/admin/tenant-loop/tenants/${tenantA.tenantId}/register`, {
      token: sessionA,
      body: { group: "group-a" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.loopStatus).toBe("active");
    expect(body.loopGroup).toBe("group-a");
    expect(fx.state.registry.get(tenantA.tenantId)?.loopGroup).toBe("group-a");
    expect(fx.state.audit.list(20).some((e) => e.action === "tenant.loop.register.allowed" && e.actor === memberA.principal)).toBe(true);
  });
});

// ── QA hardening wave: executor containment (H5), quota race (H6), env deny (H7) ──

describe("upgrade executor hardening (QA H5/H6/H7)", () => {
  const fx = makeState("hardening");
  afterAll(() => {
    closeState(fx.state);
    fx.cleanup();
  });

  function loopReady(projectDir?: string): { tenantId: string } {
    const rec = fx.state.registry.create({ variant: "co-consult", ownerPrincipal: "alice", name: `hard-${Math.random().toString(16).slice(2, 8)}` });
    if (projectDir) rec.projectDir = projectDir;
    else mkdirSync(rec.projectDir, { recursive: true }); // QA H5: containment realpaths the dir
    rec.loopStatus = "active";
    rec.loopOverride = { scopes: { upgrade: true }, windows: ALWAYS_OPEN_WINDOWS };
    fx.state.registry.upsert(rec);
    return { tenantId: rec.tenantId };
  }

  const okDeps = (): TenantLoopExecDeps => ({
    spawn: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    git: () => ({ exitCode: 0, stdout: "", stderr: "" }),
  });

  test("QA H5: a registry row whose projectDir resolves OUTSIDE gateway storage is refused (dry-run and confirm), spawn never runs", async () => {
    const outside = join(fx.dataDir, "..", "outside-proj");
    mkdirSync(outside, { recursive: true });
    const { tenantId } = loopReady(outside);
    let spawned = false;
    const deps: TenantLoopExecDeps = { spawn: async () => { spawned = true; return { exitCode: 0, stdout: "", stderr: "" }; }, git: () => ({ exitCode: 0, stdout: "", stderr: "" }) };
    await expect(
      evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenantId)!, { deps }),
    ).rejects.toMatchObject({ code: "tenant_dir_outside_storage" });
    await expect(
      evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenantId)!, { confirm: true, deps }),
    ).rejects.toMatchObject({ code: "tenant_dir_outside_storage" });
    expect(spawned).toBe(false);
    const row = fx.state.audit.list(20).find((e) => e.action === "tenant.loop.upgrade.refused");
    expect(row?.target).toBe(tenantId);
    expect(row?.detail).toContain("is not under");
  });

  test("QA H5: an unresolvable projectDir is refused with the same typed error", async () => {
    const { tenantId } = loopReady(join(fx.dataDir, "storage", "ghost", "missing"));
    await expect(
      evaluateTenantUpgrade(fx.state, fx.state.registry.get(tenantId)!, { confirm: true, deps: okDeps() }),
    ).rejects.toMatchObject({ code: "tenant_dir_outside_storage" });
  });

  test("QA H6: quota slot recorded BEFORE the spawn — two sequential confirms within a raised cap stay allowed, cap+1 refused", async () => {
    const { tenantId } = loopReady();
    const rec = () => fx.state.registry.get(tenantId)!;
    const ok = await evaluateTenantUpgrade(fx.state, rec(), { confirm: true, now: new Date("2026-11-08T12:00:00Z"), cap: 2, deps: okDeps() });
    expect("execution" in ok).toBe(true);
    const second = await evaluateTenantUpgrade(fx.state, rec(), { confirm: true, now: new Date("2026-11-08T12:05:00Z"), cap: 2, deps: okDeps() });
    expect("execution" in second).toBe(true);
    expect(rec().loopState).toEqual({ upgradesDay: "2026-11-08", upgradesToday: 2 });
    await expect(
      evaluateTenantUpgrade(fx.state, rec(), { confirm: true, now: new Date("2026-11-08T12:10:00Z"), cap: 2, deps: okDeps() }),
    ).rejects.toMatchObject({ status: 429 });
    expect(rec().loopState?.upgradesToday).toBe(2); // refused confirm consumed nothing
  });

  test("QA H6: a failed spawn still burns the slot (rollback deliberately not implemented)", async () => {
    const { tenantId } = loopReady();
    const rec = () => fx.state.registry.get(tenantId)!;
    const exploding: TenantLoopExecDeps = {
      spawn: async () => {
        throw new Error("spawn boom");
      },
      git: () => ({ exitCode: 0, stdout: "", stderr: "" }),
    };
    await expect(
      evaluateTenantUpgrade(fx.state, rec(), { confirm: true, now: new Date("2026-11-09T12:00:00Z"), deps: exploding }),
    ).rejects.toThrow("spawn boom");
    expect(rec().loopState).toEqual({ upgradesDay: "2026-11-09", upgradesToday: 1 }); // burned, by design
    // The burned slot enforces the cap for the rest of the UTC day.
    await expect(
      evaluateTenantUpgrade(fx.state, rec(), { confirm: true, now: new Date("2026-11-09T12:05:00Z"), deps: okDeps() }),
    ).rejects.toMatchObject({ status: 429 });
  });

  test("QA H7: the executor env builder denies provider-key namespaces (no spawn involved)", () => {
    const env = tenantUpgradeEnv({
      PATH: "/usr/bin",
      HOME: "/home/op",
      HERMES_HOME: "/home/op/.hermes",
      ANTHROPIC_API_KEY: "sk-anthropic",
      OPENAI_API_KEY: "sk-openai",
      GEMINI_API_KEY: "sk-gemini",
      GOOGLE_CLIENT_SECRET: "sso-secret",
      CO_WORKSPACE_API_KEYS: "gateway-secret",
      CO_WORKSPACE_LLM_API_KEY: "llm-secret",
    });
    expect(env.PATH).toBe("/usr/bin");
    expect(env.HERMES_HOME).toBe("/home/op/.hermes");
    expect(env.CI).toBe("1");
    for (const denied of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "GOOGLE_CLIENT_SECRET", "CO_WORKSPACE_API_KEYS", "CO_WORKSPACE_LLM_API_KEY"]) {
      expect(env[denied]).toBeUndefined();
    }
    expect(JSON.stringify(env)).not.toContain("sk-anthropic");
    expect(JSON.stringify(env)).not.toContain("sso-secret");
  });
});
