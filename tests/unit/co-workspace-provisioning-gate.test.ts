/**
 * 2026-10-02 gate-anonymous-tenant-provisioning design: unauthenticated callers cannot
 * provision tenants by default (D1), the per-principal tenant cap covers the lazy path
 * (G4), provisioning attempts are audited (G3), failed pre-relocation scaffolds roll
 * back and the boot sweep removes registry-absent gw-* dirs (G5), and open-mode warning
 * states the provisioning posture (D2).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { HttpError } from "../../services/co-workspace/src/http";
import {
  createServer,
  createState,
  getOrStartTenant,
  openModeWarning,
  removeUnrelocatedScaffold,
  resolveLazyTenant,
  sweepOrphanedScaffolds,
  sweepOrphanedStorage,
} from "../../services/co-workspace/src/server";

const tmp = (label: string) => join(tmpdir(), `co-workspace-gate-${label}-${crypto.randomUUID().slice(0, 8)}`);

function sandbox(label: string, env: Record<string, string> = {}) {
  const wsDir = tmp(`${label}-ws`);
  mkdirSync(join(wsDir, "Projects"), { recursive: true });
  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
    CO_WORKSPACE_DATA_DIR: tmp(`${label}-data`),
    CO_WORKSPACE_WORKSPACE_DIR: wsDir,
    CO_WORKSPACE_VARIANTS: "co-consult",
    ...env,
  });
  return { cfg, state: createState(cfg), wsDir };
}

const anonReq = () => new Request("http://x/v1/chat/completions");

function catchOf(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    return err as HttpError;
  }
  throw new Error("expected fn to throw");
}

// ── Default posture: the gate denies unauthenticated provisioning on both paths ──
const gate = sandbox("gate");
const gateServer = createServer(gate.state);
const gateBase = `http://127.0.0.1:${gateServer.port}`;
afterAll(() => gateServer.stop(true));

describe("provisioning gate — default deny (D1)", () => {
  test("resolveLazyTenant: 401 before any registry row or Projects/ dir exists", () => {
    const before = gate.state.registry.list().length;
    const err = catchOf(() => resolveLazyTenant(gate.state, anonReq(), "co-consult"));
    expect(err instanceof HttpError).toBe(true);
    expect(err.status).toBe(401);
    expect(gate.state.registry.list().length).toBe(before);
    const orphans = readdirSafe(join(gate.wsDir, "Projects")).filter((n) => n.startsWith("gw-"));
    expect(orphans).toEqual([]);
  });

  test("denial is audited (G3)", () => {
    const denied = gate.state.audit.list(50).find((a) => a.action === "tenant.provision.denied");
    expect(denied?.actor).toBe("anonymous");
    expect(denied?.target).toBe("co-consult");
    expect(denied?.detail).toBe("unauthenticated");
  });

  test("POST /sessions: 401 before create", async () => {
    const before = gate.state.registry.list().length;
    const res = await fetch(`${gateBase}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    expect(res.status).toBe(401);
    expect(gate.state.registry.list().length).toBe(before);
  });

  test("credentialed caller provisions without opt-in (session cookie)", async () => {
    const user = gate.state.users.createUser({ email: "gate@test.local", name: "gate", password: "gatepass123", role: "user" })!;
    const cookie = `gw_session=${gate.state.users.createSession(user.id)}`;
    const before = gate.state.registry.list().length;
    const res = await fetch(`${gateBase}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ variant: "co-consult" }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { tenantId: string };
    expect(gate.state.registry.get(body.tenantId)?.ownerPrincipal).toBe(user.principal);
    expect(gate.state.registry.list().length).toBe(before + 1);
    const created = gate.state.audit.list(50).find((a) => a.action === "tenant.create" && a.target === body.tenantId);
    expect(created?.actor).toBe(user.principal);
  });

  test("open-mode warning states the provisioning posture (D2)", () => {
    expect(openModeWarning({ apiKeys: [], loginRequired: false })).toContain("GATED");
    expect(openModeWarning({ apiKeys: [], loginRequired: false, allowAnonProvisioning: true })).toContain("ENABLED");
    expect(openModeWarning({ apiKeys: ["sk-x"], loginRequired: false })).toBeNull();
    expect(openModeWarning({ apiKeys: [], loginRequired: true })).toBeNull();
  });
});

// ── Opt-in posture: anonymous provisioning allowed, cap enforced on the lazy path ──
describe("provisioning gate — opt-in and cap (D4, G4)", () => {
  const optin = sandbox("optin", {
    CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
    // 2026-10-03 review M6: anon provisioning with unset quotas fails boot.
    CO_WORKSPACE_TENANT_MAX_TURNS: "100",
    CO_WORKSPACE_TENANT_MAX_TOKENS: "100000",
    CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "200000",
  });
  optin.cfg.tenantMaxPerPrincipal = 1;

  test("anonymous create proceeds and is audited as tenant.create.lazy", async () => {
    const found = getOrStartTenant(optin.state, "co-consult", "anonymous", "anonymous");
    if (found.promise) await found.promise; // scaffold fails fast in the sandbox; row persists
    expect(optin.state.registry.get(found.rec.tenantId)).toBeTruthy();
    const audited = optin.state.audit.list(50).find((a) => a.action === "tenant.create.lazy" && a.target === found.rec.tenantId);
    expect(audited?.actor).toBe("anonymous");
  });

  test("lazy path enforces tenantMaxPerPrincipal (429 at cap)", () => {
    const err = catchOf(() => getOrStartTenant(optin.state, "co-consult", "someoneelse", "anonymous"));
    expect(err instanceof HttpError).toBe(true);
    expect(err.status).toBe(429);
  });

  test("existing key short-circuits even at cap", () => {
    const again = getOrStartTenant(optin.state, "co-consult", "anonymous", "anonymous");
    expect(optin.state.registry.findByKey("co-consult::anonymous")?.tenantId).toBe(again.rec.tenantId);
  });
});

// ── G5: pre-relocation rollback and the boot sweep ──
describe("failed-scaffold rollback and boot sweep (G5)", () => {
  const life = sandbox("life");

  test("removeUnrelocatedScaffold removes only the tenant's own Projects/ dir", () => {
    const dir = join(life.wsDir, "Projects", "gw-abcdef123456");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "x.txt"), "x");
    removeUnrelocatedScaffold(life.state, { tenantId: "gw-abcdef123456" } as never);
    expect(existsSync(dir)).toBe(false);
  });

  test("rollback is path-guarded against tampered tenant ids", () => {
    const keep = join(life.wsDir, "Projects", "co-keepme");
    mkdirSync(keep, { recursive: true });
    writeFileSync(join(keep, "x.txt"), "x");
    removeUnrelocatedScaffold(life.state, { tenantId: ".." } as never);
    expect(existsSync(keep)).toBe(true);
  });

  test("sweep removes registry-absent gw-* dirs, keeps registered and co-* dirs", () => {
    const rec = life.state.registry.create({
      dataDir: life.state.cfg.dataDir,
      variant: "co-consult",
      key: "co-consult::sweeptest",
      ownerPrincipal: "techcross",
    });
    mkdirSync(join(life.wsDir, "Projects", rec.tenantId), { recursive: true });
    const orphan = "gw-000000000000";
    mkdirSync(join(life.wsDir, "Projects", orphan), { recursive: true });
    const human = join(life.wsDir, "Projects", "co-demo");
    mkdirSync(human, { recursive: true });

    const result = sweepOrphanedScaffolds(life.state);
    expect(result.removed).toContain(orphan);
    expect(existsSync(join(life.wsDir, "Projects", orphan))).toBe(false);
    expect(existsSync(join(life.wsDir, "Projects", rec.tenantId))).toBe(true);
    expect(existsSync(human)).toBe(true);
    const swept = life.state.audit.list(50).find((a) => a.action === "scaffold.sweep" && a.target === orphan);
    expect(swept?.actor).toBe("system");
  });
});

// ── T-20261003-026: the same reconcile for the storage tree ──
describe("storage-tree boot sweep (T-20261003-026)", () => {
  const sweep = sandbox("storagesweep");
  const storageRoot = () => join(sweep.state.cfg.dataDir, "storage");

  test("removes storage/<principal>/<name> with no registry row, keeps every registered folder", () => {
    const rec = sweep.state.registry.create({
      variant: "co-consult",
      key: "co-consult::storagesweep",
      ownerPrincipal: "techcross",
      name: "provider-test",
    });
    mkdirSync(join(storageRoot(), "techcross", "provider-test", "project"), { recursive: true });
    const stale = join(storageRoot(), "techcross", "provider-stale");
    mkdirSync(join(stale, "hermes-home"), { recursive: true });
    writeFileSync(join(stale, "hermes-home", "auth.json"), "{}");

    const result = sweepOrphanedStorage(sweep.state);
    expect(result.removed).toContain("techcross/provider-stale");
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(join(storageRoot(), "techcross", "provider-test"))).toBe(true);
    expect(sweep.state.registry.get(rec.tenantId)).toBeTruthy();
    const audited = sweep.state.audit.list(50).find((a) => a.action === "storage.sweep" && a.target === "techcross/provider-stale");
    expect(audited?.actor).toBe("system");
  });

  test("guards: stray files, symlinks and a missing storage dir are tolerated, never followed", () => {
    writeFileSync(join(storageRoot(), "stray-file.txt"), "x");
    // symlink inside a principal dir: the sweep removes real dirs around it, never the link
    mkdirSync(join(storageRoot(), "techcross"), { recursive: true });
    symlinkSync(join(storageRoot(), "techcross", "provider-test"), join(storageRoot(), "techcross", "provider-link"));

    const result = sweepOrphanedStorage(sweep.state);
    expect(existsSync(join(storageRoot(), "stray-file.txt"))).toBe(true);
    expect(existsSync(join(storageRoot(), "techcross", "provider-link"))).toBe(true);
    expect(result.error).toBeUndefined();

    const empty = sandbox("storagesweep-empty");
    const fresh = sweepOrphanedStorage(empty.state);
    expect(fresh.removed).toEqual([]);
    expect(fresh.error).toBeTruthy(); // missing storage dir (volume mode / fresh install) reports, never throws
  });
});

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
