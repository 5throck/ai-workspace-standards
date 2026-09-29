/**
 * T-20260929-007: unified tenant deletion (deleteTenantData) for the tenant DELETE route and
 * the admin user delete, plus runChat bookkeeping and the narrowed straggler sweep.
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../services/co-workspace/src/config";
import { createServer, createState, deleteTenantData, runChat } from "../../services/co-workspace/src/server";

const tmp = () => join(tmpdir(), `co-workspace-del-${crypto.randomUUID().slice(0, 8)}`);
const dataDir = tmp();
const hermesDir = tmp();
mkdirSync(hermesDir, { recursive: true });
// Failing fake hermes: exits non-zero with no result envelope (no sessionId).
const failBin = join(hermesDir, "fail-hermes.ts");
writeFileSync(failBin, "await Bun.stdin.text();\nprocess.exit(3);\n");

const cfg = loadConfig({
  CO_WORKSPACE_HOST: "127.0.0.1",
  CO_WORKSPACE_PORT: String(20000 + Math.floor(Math.random() * 20000)),
  CO_WORKSPACE_DATA_DIR: dataDir,
  CO_WORKSPACE_VARIANTS: "co-consult",
  HERMES_BIN: failBin,
  HERMES_BIN_PREFIX: "bun",
});
const state = createState(cfg);
const server = createServer(state);
const base = `http://127.0.0.1:${server.port}`;
afterAll(() => server.stop(true));

function makeTenant(owner: string) {
  const rec = state.registry.create({ dataDir, variant: "co-consult", key: `co-consult::${owner}`, ownerPrincipal: owner });
  mkdirSync(rec.projectDir, { recursive: true });
  mkdirSync(rec.hermesHome, { recursive: true });
  writeFileSync(join(rec.projectDir, "f.txt"), "x");
  state.turns.record(rec.tenantId, { sessionId: "s", exitCode: 0, finalText: "hi", inputTokens: 1, outputTokens: 1 });
  return state.registry.get(rec.tenantId)!;
}

describe("tenant DELETE route — validate before mutating", () => {
  test("tampered record: 500, registry row + history + files intact; corrected delete then works", async () => {
    const rec = makeTenant("anonymous");
    const real = { projectDir: rec.projectDir, hermesHome: rec.hermesHome };
    const outside = join(tmp(), "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "keep.txt"), "k");
    rec.projectDir = join(outside, "project");
    rec.hermesHome = join(outside, "hermes-home");
    state.registry.upsert(rec);

    const res = await fetch(`${base}/tenants/${rec.tenantId}`, { method: "DELETE" });
    expect(res.status).toBe(500);
    expect(state.registry.get(rec.tenantId)).toBeTruthy();
    expect(state.turns.list(rec.tenantId).length).toBe(1);
    expect(existsSync(join(real.projectDir, "f.txt"))).toBe(true);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);

    const fixed = state.registry.get(rec.tenantId)!;
    fixed.projectDir = real.projectDir;
    fixed.hermesHome = real.hermesHome;
    state.registry.upsert(fixed);
    const ok = await fetch(`${base}/tenants/${rec.tenantId}`, { method: "DELETE" });
    expect(ok.status).toBe(200);
    expect(state.registry.get(rec.tenantId)).toBeFalsy();
    expect(existsSync(real.projectDir)).toBe(false);
    expect(state.turns.list(rec.tenantId).length).toBe(0);
  });
});

describe("admin user delete with tenants=delete", () => {
  test("tampered tenant is reported and untouched; valid tenants deleted, audited, history cleared", async () => {
    const admin = state.users.createUser({ email: "adm@test.local", name: "adm", password: "adminpass123", role: "admin" });
    const cookie = `gw_session=${state.users.createSession(admin!.id)}`;
    const victim = state.users.createUser({ email: "vic@test.local", name: "vic", password: "victimpw123", role: "user" });
    const good = makeTenant(victim!.principal);
    const bad = makeTenant(victim!.principal);
    const outside = join(tmp(), "outside");
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, "keep.txt"), "k");
    bad.projectDir = join(outside, "project");
    bad.hermesHome = join(outside, "hermes-home");
    state.registry.upsert(bad);

    const res = await fetch(`${base}/admin/users/${victim!.id}?tenants=delete`, { method: "DELETE", headers: { cookie } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tenantsHandled).toBe(1);
    expect(body.errors.length).toBe(1);
    expect(body.errors[0].tenantId).toBe(bad.tenantId);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
    expect(state.registry.get(bad.tenantId)).toBeTruthy();
    expect(state.registry.get(good.tenantId)).toBeFalsy();
    expect(existsSync(good.projectDir)).toBe(false);
    expect(state.turns.list(good.tenantId).length).toBe(0);
    const audit = state.audit.list(200).find((a) => a.action === "tenant.delete" && a.target === good.tenantId);
    expect(audit?.actor).toBe(admin!.principal);
  });
});

describe("deleteTenantData", () => {
  test("kills an active process and drops lock/proc entries", async () => {
    const rec = makeTenant("someone");
    let killed = false;
    state.activeProcs.set(rec.tenantId, { kill: () => { killed = true; } });
    state.chatLocks.set(rec.tenantId, Promise.resolve());
    await deleteTenantData(state, rec, "tester");
    expect(killed).toBe(true);
    expect(state.activeProcs.has(rec.tenantId)).toBe(false);
    expect(state.chatLocks.has(rec.tenantId)).toBe(false);
  });
});

describe("runChat bookkeeping", () => {
  test("failed turn leaves no activeProcs or chatLocks entry", async () => {
    const rec = makeTenant("failer");
    await runChat(state, rec, "hello").catch(() => undefined);
    expect(state.activeProcs.has(rec.tenantId)).toBe(false);
    expect(state.chatLocks.has(rec.tenantId)).toBe(false);
  });
});

describe("straggler sweep via delete", () => {
  test("removes exact legacy shapes, keeps `<tenantId>-notes`", async () => {
    const rec = makeTenant("sweeper");
    const parent = join(rec.projectDir, "..", "..");
    for (const n of [`${rec.tenantId}project`, `${rec.tenantId}hermes-home`, `${rec.tenantId}-notes`]) {
      mkdirSync(join(parent, n), { recursive: true });
    }
    await deleteTenantData(state, rec, "tester");
    const left = readdirSync(parent);
    expect(left).toContain(`${rec.tenantId}-notes`);
    expect(left).not.toContain(`${rec.tenantId}project`);
    expect(left).not.toContain(`${rec.tenantId}hermes-home`);
  });
});
