/**
 * ADR-0092 Addendum 17 — co-workspace attach-mode (Phase 3b; design
 * docs/designs/2026-11-01-coworkspace-attach-mode-design.md). Evidence classes per the
 * design's Verification section + the addendum's Verification evidence list:
 *
 *   (a) attach/detach lifecycle — attach → registry row with attached projectDir → detach
 *       drops homes + registry row and leaves the hub working tree byte-identical →
 *       detach-with-delete returns a typed 409 → re-attach idempotent per (principal,
 *       variant); includes the storage-root guard regression (tampered record refuses).
 *   (b) docker-only enforcement — process-isolation attach requests are 409s (never
 *       warnings); volume mode cannot express the ticket-queue bind (fail closed).
 *   (c) mount-denylist refusals — every denylisted class (hub root, .git/, services/,
 *       co-security docs/{findings,evidence,reports,security}, .env*) is a named 409 at
 *       mount construction; the allowlist path mounts exactly scratch + ticket-queue; the
 *       constructed docker-CLI env carries no gateway secret (gateway-side half of the
 *       non-exposure evidence — /proc/1/environ is unreachable under docker isolation).
 *   (d) per-spoke key attribution — expired key 401s; the actor/owner derives ONLY from the
 *       verified key's spoke-id; client-asserted identities are ignored; legacy
 *       `key` / `key:label` lines keep working.
 *   (e) cancel-on-UNAVAILABLE — a hub whose lifecycle state file declares UNAVAILABLE gets
 *       its active attach sessions cancelled at cap-check time and new attach refused;
 *       absent file (probe re-verification flips back) → attach accepted.
 *   (f) cap enforcement — per-hub concurrent-session cap (default 2, config-overridable).
 *
 * Harness: in-process co-workspace server (ephemeral port), stub hermes binary, mkdtemp
 * fixtures — zero new infrastructure (design §6.5).
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { credentialValid, principalFor } from "../../services/co-workspace/src/auth";
import { keyEntryExpired, loadConfig, readKeyEntries } from "../../services/co-workspace/src/config";
import { loadPolicyConfig } from "../../services/co-workspace/src/docker-broker-policy";
import {
  attachDockerEnv,
  attachMountPlan,
  attachScratchDir,
  assertAttachHubAdmittable,
  assertAttachMountAllowed,
  hubStatePath,
  readHubLifecycleState,
  resolveAttachDir,
} from "../../services/co-workspace/src/attach";
import { HttpError } from "../../services/co-workspace/src/http";
import { createServer, createState, deleteTenantData, sweepOrphanedStorage } from "../../services/co-workspace/src/server";
import type { TenantRecord } from "../../services/co-workspace/src/tenant";
import { validateBindsOnDisk, validateCreate } from "../../services/co-workspace/src/docker-broker-policy";

// ── fixtures ────────────────────────────────────────────────────────────────────────────────

const tmpRoot = mkdtempSync(join(tmpdir(), "co-workspace-attach-"));
afterAll(() => {
  try {
    rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
});

const uniq = (label: string) => `${label}-${crypto.randomUUID().slice(0, 8)}`;
const HUB = "co-finance";

/** Open-mode provisioning needs explicit quotas (2026-10-03 review M6 fail-fast). */
const OPEN_MODE_ENV = {
  CO_WORKSPACE_ALLOW_ANON_PROVISIONING: "true",
  CO_WORKSPACE_TENANT_MAX_TURNS: "100",
  CO_WORKSPACE_TENANT_MAX_TOKENS: "1000000",
  CO_WORKSPACE_PRINCIPAL_MAX_TOKENS: "1000000",
};

/** A hub checkout fixture: Projects/co-<name> with tickets/ (the delegation drop zone),
 * a working-tree file, and .git/. Optional .pipeline-state dir for lifecycle-state tests. */
function makeHub(wsDir: string, name: string, opts: { pipelineState?: boolean } = {}): string {
  const hub = join(wsDir, "Projects", name);
  mkdirSync(join(hub, "tickets"), { recursive: true });
  mkdirSync(join(hub, ".git"), { recursive: true });
  writeFileSync(join(hub, "README.md"), "# hub fixture\n");
  writeFileSync(join(hub, "tickets", "seed.yaml"), "id: seed\n");
  if (opts.pipelineState) mkdirSync(join(hub, ".pipeline-state"), { recursive: true });
  return hub;
}

/** Recursive (path → sha256) inventory of a directory tree — the byte-identical assertion. */
function treeDigest(root: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else out.set(p, createHash("sha256").update(readFileSync(p)).digest("hex"));
    }
  };
  walk(root);
  return out;
}

interface SandboxOpts {
  env?: Record<string, string>;
  isolation?: "docker" | "process";
  keyFile?: string;
}

/** One in-process gateway: temp workspace + temp data dir, ephemeral port, stub hermes.
 * Dirs are REALPATH'd so registry rows and the route's realpath-based attach resolution
 * agree on macOS, where tmpdir() sits behind a /var → /private/var symlink. */
function sandbox(label: string, opts: SandboxOpts = {}) {
  const wsDir = realpathSync(mkdtempSync(join(tmpRoot, `${label}-ws`)));
  mkdirSync(join(wsDir, "Projects"), { recursive: true });
  const dataDir = realpathSync(mkdtempSync(join(tmpRoot, `${label}-data`)));
  const hermesDir = join(tmpRoot, uniq(`${label}-hermes`));
  mkdirSync(hermesDir, { recursive: true });
  const stubBin = join(hermesDir, "stub-hermes.ts");
  writeFileSync(stubBin, "await Bun.stdin.text();\nprocess.exit(0);\n");
  let keyFilePath: string | undefined;
  if (opts.keyFile !== undefined) {
    keyFilePath = join(tmpRoot, uniq(`${label}-keys`));
    writeFileSync(keyFilePath, opts.keyFile);
  }
  const cfg = loadConfig({
    CO_WORKSPACE_HOST: "127.0.0.1",
    CO_WORKSPACE_PORT: "0",
    CO_WORKSPACE_DATA_DIR: dataDir,
    CO_WORKSPACE_WORKSPACE_DIR: wsDir,
    CO_WORKSPACE_VARIANTS: "co-consult",
    HERMES_BIN: stubBin,
    HERMES_BIN_PREFIX: "bun",
    ...(opts.isolation ? { CO_WORKSPACE_ISOLATION: opts.isolation } : {}),
    ...(keyFilePath ? { CO_WORKSPACE_API_KEYS_FILE: keyFilePath } : {}),
    ...opts.env,
  });
  return { cfg, wsDir, dataDir, keyFilePath };
}

function errOf(fn: () => unknown): HttpError {
  try {
    fn();
  } catch (err) {
    return err as HttpError;
  }
  throw new Error("expected fn to throw");
}

const codeOf = (err: HttpError): string => (err as HttpError & { code?: string }).code ?? "";

// ═══ (a) attach/detach lifecycle ═══════════════════════════════════════════════════════════

describe("attach lifecycle (a): POST /sessions attach_dir", () => {
  const sb = sandbox("lifecycle", {
    isolation: "docker",
    env: { ...OPEN_MODE_ENV, CO_WORKSPACE_LLM_API_KEY: "sk-deploy" },
  });
  const hub = makeHub(sb.wsDir, HUB);
  const state = createState(sb.cfg);
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));
  const post = (body: Record<string, unknown>) =>
    fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
      body: JSON.stringify(body),
    });

  test("attach: skips scaffold, registry row kind=attached with hub projectDir, scratch+homes seeded under gateway storage", async () => {
    const before = treeDigest(hub);
    const res = await post({ variant: "co-consult", attach_dir: "Projects/co-finance" });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { tenantId: string; attached: string };
    expect(body.attached).toBe(HUB);
    await state.provisioning.get(body.tenantId);

    const rec = state.registry.get(body.tenantId)!;
    expect(rec.kind).toBe("attached");
    expect(rec.attachHub).toBe(resolve(hub));
    expect(rec.projectDir).toBe(resolve(hub));
    expect(rec.ownerPrincipal).toBe("anonymous");
    expect(rec.status).toBe("ready");
    // No scaffold happened: no gw-* dir under Projects/, no relocation of the hub.
    const projects = readdirSync(join(sb.wsDir, "Projects"));
    expect(projects.filter((n) => n.startsWith("gw-"))).toEqual([]);
    expect(treeDigest(hub)).toEqual(before);
    // Gateway-owned artifacts exist under storage, NOT in the hub tree.
    const scratch = attachScratchDir(rec);
    expect(existsSync(scratch)).toBe(true);
    expect(scratch.replace(/\\/g, "/").startsWith(resolve(sb.dataDir, "storage").replace(/\\/g, "/") + "/")).toBe(true);
    expect(existsSync(rec.hermesHome)).toBe(true);
    // The seeded config.yaml carries the DEPLOYMENT provider key (empty attach pool).
    const cfgYaml = readFileSync(join(rec.hermesHome, "config.yaml"), "utf8");
    expect(cfgYaml).toContain("sk-deploy");
  });

  test("existing_project alias works; re-attach idempotent per (principal, variant); other-hub attach conflicts", async () => {
    const first = await post({ variant: "co-consult", existing_project: "Projects/co-finance" });
    expect(first.status).toBe(200);
    const b1 = (await first.json()) as { existing?: boolean; tenantId: string };
    expect(b1.existing).toBe(true); // same (principal, variant) → the row from test 1

    // A second hub for the same principal is a conflict — silently aliasing a request for
    // hub X to a session bound to hub Y must never happen.
    makeHub(sb.wsDir, "co-legal");
    const conflict = await post({ variant: "co-consult", attach_dir: "Projects/co-legal" });
    expect(conflict.status).toBe(409);
    const errBody = (await conflict.json()) as { code?: string };
    expect(errBody.code).toBe("attach_conflict");
  });

  test("DELETE ?purge=1 on an attached tenant → typed 409 (attach_full_delete_refused); row + hub intact", async () => {
    const rec = state.registry.list().find((r) => r.kind === "attached")!;
    const before = treeDigest(hub);
    const res = await fetch(`${base}/tenants/${rec.tenantId}?purge=1`, {
      method: "DELETE",
      headers: { "x-requested-with": "co-workspace" },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("attach_full_delete_refused");
    expect(state.registry.get(rec.tenantId)).toBeTruthy();
    expect(treeDigest(hub)).toEqual(before);
    const audited = state.audit.list(200).some((a) => a.action === "tenant.delete.refused" && a.target === rec.tenantId);
    expect(audited).toBe(true);
  });

  test("detach: drops scratch+homes+registry row, hub byte-identical, re-attach accepted", async () => {
    const rec = state.registry.list().find((r) => r.kind === "attached")!;
    const scratch = attachScratchDir(rec);
    const before = treeDigest(hub);
    writeFileSync(join(scratch, "session-output.md"), "work product");

    const res = await fetch(`${base}/tenants/${rec.tenantId}`, {
      method: "DELETE",
      headers: { "x-requested-with": "co-workspace" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { detached?: boolean };
    expect(body.detached).toBe(true);
    expect(state.registry.get(rec.tenantId)).toBeFalsy();
    expect(existsSync(scratch)).toBe(false);
    expect(existsSync(rec.hermesHome)).toBe(false);
    expect(existsSync(hub)).toBe(true);
    expect(treeDigest(hub)).toEqual(before); // git state untouched — merge-back is the hub PM's act
    const audit = state.audit.list(200).find((a) => a.action === "tenant.detach" && a.target === rec.tenantId);
    expect(audit).toBeTruthy();

    // Re-attach after detach: a fresh row for the (principal, variant) key is created.
    const re = await post({ variant: "co-consult", attach_dir: "Projects/co-finance" });
    expect(re.status).toBe(202);
    const rb = (await re.json()) as { tenantId: string };
    expect(rb.tenantId).not.toBe(rec.tenantId);
    await state.provisioning.get(rb.tenantId);
    expect(state.registry.get(rb.tenantId)?.status).toBe("ready");
  });
});

describe("attach lifecycle (a): path constraints + sweep exemptions", () => {
  const sb = sandbox("paths", { isolation: "docker" });
  const hub = makeHub(sb.wsDir, HUB);

  test("resolveAttachDir: realpath-constrained to <ws>/Projects/co-* immediate children only", () => {
    expect(resolveAttachDir(sb.cfg, "Projects/co-finance")).toBe(resolve(hub));
    expect(resolveAttachDir(sb.cfg, join(sb.wsDir, "Projects/co-finance"))).toBe(resolve(hub));
    // traversal / non-child / wrong-name / gateway dirs / Projects itself
    expect(errOf(() => resolveAttachDir(sb.cfg, "../services")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "services/co-workspace")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects/co-finance/tickets")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects/deep/nest/co-x")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects/notco-1")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects")).status).toBe(400);
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects/.hidden")).status).toBe(400);
    // symlink escape: Projects/co-evil → outside dir; the REALPATH is not a Projects child.
    const outside = join(tmpRoot, uniq("outside"));
    mkdirSync(outside, { recursive: true });
    symlinkSync(outside, join(sb.wsDir, "Projects", "co-evil"));
    expect(errOf(() => resolveAttachDir(sb.cfg, "Projects/co-evil")).status).toBe(400);
  });

  test("sweepOrphanedStorage keeps the attached tenant's storage folder (scratch + homes survive)", () => {
    const state = createState(sb.cfg);
    const rec = state.registry.create({
      variant: "co-consult",
      key: "co-consult::spokeA",
      ownerPrincipal: "spokeA",
      kind: "attached",
      attachHub: hub,
      projectDir: hub,
    });
    mkdirSync(rec.hermesHome, { recursive: true });
    const scratch = attachScratchDir(rec);
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, "out.txt"), "x");
    // The attached row's folder (tenantFolderOf) must be in the sweep's kept set even though
    // its projectDir lives in the hub workspace, outside gateway storage.
    const result = sweepOrphanedStorage(state);
    expect(result.error).toBeUndefined();
    expect(existsSync(scratch)).toBe(true);
    expect(existsSync(rec.hermesHome)).toBe(true);
    expect(state.registry.get(rec.tenantId)).toBeTruthy();
  });
});

describe("attach lifecycle (a): storage-root guard regression on detach", () => {
  test("tampered attached record (hermesHome outside storage) refuses; nothing removed; corrected record detaches", async () => {
    const sb = sandbox("guard", { isolation: "docker" });
    const hub = makeHub(sb.wsDir, HUB);
    const state = createState(sb.cfg);
    const rec = state.registry.create({
      variant: "co-consult",
      key: "co-consult::spokeG",
      ownerPrincipal: "spokeG",
      kind: "attached",
      attachHub: hub,
      projectDir: hub,
    });
    mkdirSync(rec.hermesHome, { recursive: true });
    const outside = join(tmpRoot, uniq("guard-outside"));
    mkdirSync(join(outside, "hermes-home"), { recursive: true });
    writeFileSync(join(outside, "keep.txt"), "k");
    rec.hermesHome = join(outside, "hermes-home");
    state.registry.upsert(rec);

    // A tampered/legacy record must never point any rmSync outside the tenant storage root
    // (lifecycle.ts storage-root guard — regression class from the design Verification §3).
    const err = await deleteTenantData(state, state.registry.get(rec.tenantId)!, "tester").then(
      () => null,
      (e) => e as HttpError,
    );
    expect(err?.status).toBe(500);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
    expect(existsSync(join(outside, "hermes-home"))).toBe(true);
    expect(state.registry.get(rec.tenantId)).toBeTruthy();

    // Corrected record detaches cleanly — the hub tree stays.
    const fixed = state.registry.get(rec.tenantId)!;
    const folder = join(resolve(sb.dataDir, "storage"), "spokeG", "fixed");
    mkdirSync(folder, { recursive: true });
    fixed.hermesHome = join(folder, "hermes-home");
    state.registry.upsert(fixed);
    await deleteTenantData(state, state.registry.get(fixed.tenantId)!, "tester");
    expect(state.registry.get(fixed.tenantId)).toBeFalsy();
    expect(existsSync(hub)).toBe(true);
    expect(existsSync(join(outside, "keep.txt"))).toBe(true);
  });
});

// ═══ (b) docker-only enforcement ════════════════════════════════════════════════════════════

describe("docker-only enforcement (b)", () => {
  test("process-isolation attach request → typed 409 (attach_requires_docker), no registry row", async () => {
    const sb = sandbox("proc", { isolation: "process", env: OPEN_MODE_ENV });
    makeHub(sb.wsDir, HUB);
    const state = createState(sb.cfg);
    const server = createServer(state);
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
        body: JSON.stringify({ variant: "co-consult", attach_dir: "Projects/co-finance" }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("attach_requires_docker");
      expect(state.registry.list().filter((r) => r.kind === "attached")).toHaveLength(0);
    } finally {
      server.stop(true);
    }
  });

  test("volume-mode attach request → typed 409 (attach_requires_bind_mode)", async () => {
    const sb = sandbox("vol", { isolation: "docker", env: { ...OPEN_MODE_ENV, CO_WORKSPACE_DATA_VOLUME: "cw-attach-vol" } });
    makeHub(sb.wsDir, HUB);
    const state = createState(sb.cfg);
    const server = createServer(state);
    try {
      const res = await fetch(`http://127.0.0.1:${server.port}/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
        body: JSON.stringify({ variant: "co-consult", attach_dir: "Projects/co-finance" }),
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe("attach_requires_bind_mode");
    } finally {
      server.stop(true);
    }
  });
});

// ═══ (c) mount policy: denylist + allowlist + constructed env ═══════════════════════════════

describe("mount-denylist refusals (c): each denylisted path class is a named 409", () => {
  const sb = sandbox("mounts", { isolation: "docker" });
  const hub = makeHub(sb.wsDir, HUB);
  const cfg = sb.cfg;
  const state = createState(cfg);

  function attachedRec(principal: string): TenantRecord {
    const rec = state.registry.create({
      variant: "co-consult",
      key: `co-consult::${principal}`,
      ownerPrincipal: principal,
      kind: "attached",
      attachHub: hub,
      projectDir: hub,
    });
    mkdirSync(attachScratchDir(rec), { recursive: true });
    return rec;
  }

  test("hub repo root as a (writable) mount", () => {
    const err = errOf(() => assertAttachMountAllowed(hub, hub, sb.wsDir));
    expect(err.status).toBe(409);
    expect(codeOf(err)).toBe("attach_mount_denied");
    expect(err.message).toContain("hub repo root");
  });

  test(".git/ directory", () => {
    expect(errOf(() => assertAttachMountAllowed(join(hub, ".git"), hub, sb.wsDir)).message).toContain(".git");
    expect(errOf(() => assertAttachMountAllowed(join(hub, ".git", "objects"), hub, sb.wsDir)).message).toContain(".git");
  });

  test("services/ directory (the gateway's own code)", () => {
    expect(errOf(() => assertAttachMountAllowed(join(sb.wsDir, "services", "co-workspace"), hub, sb.wsDir)).message).toContain("services");
  });

  test.each(["findings", "evidence", "reports", "security"])(
    "Projects/co-security/docs/%s (2026-10-31 data-handling rule)",
    (leaf) => {
      const err = errOf(() => assertAttachMountAllowed(join(sb.wsDir, "Projects", "co-security", "docs", leaf), hub, sb.wsDir));
      expect(err.message).toContain(`co-security/docs/${leaf}`);
    },
  );

  test(".env* files", () => {
    expect(errOf(() => assertAttachMountAllowed(join(hub, ".env"), hub, sb.wsDir)).message).toContain(".env");
    expect(errOf(() => assertAttachMountAllowed(join(hub, ".env.local"), hub, sb.wsDir)).message).toContain(".env");
  });

  test("allowlist path mounts exactly scratch + ticket-queue; missing tickets/ dir fails closed", () => {
    const plan = attachMountPlan(cfg, attachedRec("spokeAllow"));
    expect(plan.scratch).toBe(attachScratchDir(state.registry.list().find((r) => r.ownerPrincipal === "spokeAllow")!));
    expect(plan.ticketQueueSource).toBe(resolve(hub, "tickets"));
    expect(plan.ticketQueueBind).toBe(`${resolve(hub, "tickets")}:/work/ticket-queue:rw`);
    expect(resolve(plan.scratch).startsWith(hub)).toBe(false); // scratch is gateway storage

    const hub2 = join(sb.wsDir, "Projects", "co-noqueue");
    mkdirSync(hub2, { recursive: true }); // no tickets/ dir
    const rec2 = state.registry.create({
      variant: "co-consult",
      key: "co-consult::noqueue",
      ownerPrincipal: "noqueue",
      kind: "attached",
      attachHub: hub2,
      projectDir: hub2,
    });
    mkdirSync(attachScratchDir(rec2), { recursive: true });
    const err = errOf(() => attachMountPlan(cfg, rec2));
    expect(err.status).toBe(409);
    expect(codeOf(err)).toBe("attach_ticket_queue_missing");
  });

  test("constructed docker-CLI env: zero ambient inheritance — gateway secrets never pass through", () => {
    const base: Record<string, string> = {
      PATH: "/usr/bin",
      HOME: "/home/x",
      // gateway secrets that /proc/1/environ exposes under process isolation:
      CO_WORKSPACE_LLM_API_KEY: "sk-gateway",
      CO_WORKSPACE_API_KEYS: "k1,k2",
      GOOGLE_CLIENT_SECRET: "g-secret",
      // ambient credential families dropped by the attach exact-list:
      HERMES_API_KEY: "ambient-hermes",
      ANTHROPIC_API_KEY: "ambient-anthropic",
      OPENAI_API_KEY: "ambient-openai",
      XDG_CONFIG_HOME: "/ambient",
      // broker reach + allowed basics:
      DOCKER_HOST: "unix:///run/docker.sock",
      LANG: "en_US.UTF-8",
    };
    const env = attachDockerEnv({ name: "ANTHROPIC_API_KEY", value: "sk-session" }, base);
    expect(env.PATH).toBe("/usr/bin");
    expect(env.DOCKER_HOST).toBe("unix:///run/docker.sock");
    expect(env.ANTHROPIC_API_KEY).toBe("sk-session"); // the PER-SESSION key, explicitly injected
    for (const secret of ["CO_WORKSPACE_LLM_API_KEY", "CO_WORKSPACE_API_KEYS", "GOOGLE_CLIENT_SECRET", "HERMES_API_KEY", "OPENAI_API_KEY", "XDG_CONFIG_HOME"]) {
      expect(env[secret]).toBeUndefined();
    }
  });
});

describe("broker policy: attach ticket-queue bind shape (c, defense-in-depth)", () => {
  // Real docker-CLI capture of the gateway's hermes spawn (same fixture as the broker
  // policy suite) so the entrypoint/profile validation passes and ONLY the bind shape varies.
  const DATA = "/srv/co-data";
  const WS = "/srv/ws";
  const FIXTURE = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/docker-cli/create-request.json"), "utf8"));
  const NAME = new URLSearchParams(FIXTURE.query).get("name") as string;
  const CFG = { ...loadPolicyConfig({}), dataDirHost: DATA, workspaceDirHost: WS };
  const NO_WS = { ...loadPolicyConfig({}), dataDirHost: DATA };

  const bodyWithBinds = (binds: string[]): string => {
    const b = JSON.parse((FIXTURE.body as string).split("<DATA>").join(DATA)) as { HostConfig: { Binds: string[] } };
    b.HostConfig.Binds = binds;
    return JSON.stringify(b);
  };
  const fixtureBinds = (): string[] => {
    const b = JSON.parse((FIXTURE.body as string).split("<DATA>").join(DATA)) as { HostConfig: { Binds: string[] } };
    return b.HostConfig.Binds;
  };
  const expectReject = (res: ReturnType<typeof validateCreate>, reason: string) => {
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toContain(reason);
  };

  test("3rd bind = exact <ws>/Projects/co-<hub>/tickets:/work/ticket-queue:rw is accepted", () => {
    const res = validateCreate(
      bodyWithBinds([...fixtureBinds(), `${WS}/Projects/co-finance/tickets:/work/ticket-queue:rw`]),
      CFG,
      NAME,
    );
    expect(res.ok).toBe(true);
  });

  test("any other 3rd bind keeps the exactly-2 rejection; attach shape rejected without workspaceDirHost", () => {
    expectReject(
      validateCreate(bodyWithBinds([...fixtureBinds(), `${WS}/Projects/co-finance/.git:/work/ticket-queue:rw`]), CFG, NAME),
      "exactly 2",
    );
    expectReject(
      validateCreate(bodyWithBinds([...fixtureBinds(), `${WS}/Projects/co-finance/tickets:/work/ticket-queue:ro`]), CFG, NAME),
      "exactly 2",
    );
    expectReject(
      validateCreate(bodyWithBinds([...fixtureBinds(), `${WS}/Projects/co-finance/tickets:/work/ticket-queue:rw`]), NO_WS, NAME),
      "exactly 2",
    );
  });

  test("validateBindsOnDisk (real temp dirs): only the exact tickets leaf is an allowed workspace source", () => {
    const root = realpathSync(mkdtempSync(join(tmpRoot, "attach-broker-")));
    const data = `${root}/data`;
    const ws = `${root}/ws`;
    mkdirSync(`${data}/storage/p/n/project`, { recursive: true });
    mkdirSync(`${data}/storage/p/n/hermes-home`, { recursive: true });
    mkdirSync(`${ws}/Projects/co-finance/tickets`, { recursive: true });
    mkdirSync(`${ws}/Projects/co-finance/secrets`, { recursive: true });
    const pair = [
      `${data}/storage/p/n/project:/work/project:rw`,
      `${data}/storage/p/n/hermes-home:/work/hermes-home:rw`,
    ];
    expect(validateBindsOnDisk([...pair, `${ws}/Projects/co-finance/tickets:/work/ticket-queue:rw`], data, undefined, ws)).toEqual({ ok: true });
    const bad = validateBindsOnDisk([...pair, `${ws}/Projects/co-finance/secrets:/work/ticket-queue:rw`], data, undefined, ws);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toContain("bind source outside data dir");
    const outside = validateBindsOnDisk([...pair, `${ws}/Projects/co-finance/.git:/work/ticket-queue:rw`], data, undefined, ws);
    expect(outside.ok).toBe(false);
    if (!outside.ok) expect(outside.reason).toContain("bind source outside data dir");
  });
});

// ═══ (d) per-spoke key identity ═════════════════════════════════════════════════════════════

describe("per-spoke key identity (d): key:label,expires,spoke-id schema", () => {
  const KEY_FILE = [
    "# legacy lines keep working",
    "plainkey123",
    "labeledkey456:team-alpha",
    "livekey789:legacy-label,2099-01-01,spoke-live",
    "expiredkey000:old-spoke,2020-01-01,spoke-old",
    "brokenexp111:x,not-a-date,spoke-broken",
    "",
  ].join("\n");

  const sb = sandbox("keys", {
    isolation: "docker",
    keyFile: KEY_FILE,
    env: { CO_WORKSPACE_ATTACH_LLM_API_KEYS: "sk-attach-1,sk-attach-2" },
  });
  const hub = makeHub(sb.wsDir, HUB);
  const state = createState(sb.cfg);
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  const postAs = (key: string, body: Record<string, unknown>) =>
    fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace", authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });

  test("schema parsing: expires + spoke-id parsed; legacy lines backward compatible", () => {
    const entries = readKeyEntries(sb.keyFilePath);
    const byKey = new Map(entries.map((e) => [e.key, e]));
    expect(byKey.get("plainkey123")).toMatchObject({ key: "plainkey123", label: "default" });
    expect(byKey.get("labeledkey456")).toMatchObject({ key: "labeledkey456", label: "team-alpha" });
    expect(byKey.get("livekey789")).toMatchObject({
      key: "livekey789",
      label: "legacy-label",
      expires: "2099-01-01",
      spokeId: "spoke-live",
    });
    expect(keyEntryExpired(byKey.get("livekey789")!)).toBe(false);
    expect(keyEntryExpired(byKey.get("expiredkey000")!)).toBe(true);
    // Unparseable expiry fails CLOSED — a typo can never silently extend a key's life.
    expect(keyEntryExpired(byKey.get("brokenexp111")!)).toBe(true);
  });

  test("expired key → 401 at the gate; principal maps dropped", async () => {
    const cfg = sb.cfg;
    expect(credentialValid(cfg, "expiredkey000")).toBe(false);
    expect(principalFor(cfg, "expiredkey000")).toBe("anonymous");
    // A revoked key cannot even list tenants — the gate 401s it.
    const res = await fetch(`${base}/tenants`, { headers: { authorization: "Bearer expiredkey000" } });
    expect(res.status).toBe(401);
  });

  test("spoke-id becomes the gateway-derived principal; client-asserted identity ignored", async () => {
    const res = await postAs("livekey789", {
      variant: "co-consult",
      attach_dir: "Projects/co-finance",
      // A body claiming a different identity than the presented key's spoke-id is IGNORED.
      principal: "someone-else",
      ownerPrincipal: "someone-else",
      spoke_id: "fake-spoke",
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { tenantId: string; attached: string };
    expect(body.attached).toBe(HUB);
    await state.provisioning.get(body.tenantId);

    const rec = state.registry.get(body.tenantId)!;
    expect(rec.ownerPrincipal).toBe("spoke-live"); // from the VERIFIED key only
    expect(rec.kind).toBe("attached");
    // Per-session provider key allocated from the pool and stamped into THIS tenant's config.
    expect(rec.attachProviderKey).toBe("sk-attach-1");
    const cfgYaml = readFileSync(join(rec.hermesHome, "config.yaml"), "utf8");
    expect(cfgYaml).toContain("sk-attach-1");

    const audit = state.audit.list(200).find((a) => a.action === "tenant.attach" && a.target === rec.tenantId);
    expect(audit?.actor).toBe("spoke-live");
    // Ownership follows the spoke principal: the key can access its own tenant.
    const files = await fetch(`${base}/tenants/${rec.tenantId}/files`, {
      headers: { authorization: "Bearer livekey789" },
    });
    expect(files.status).toBe(200);
  });

  test("per-session provider key never echoes through public API surfaces", async () => {
    const rec = state.registry.list().find((r) => r.attachProviderKey === "sk-attach-1")!;
    const res = await fetch(`${base}/tenants/${rec.tenantId}`, { headers: { authorization: "Bearer livekey789" } });
    expect(res.status).toBe(200);
    expect((await res.text()).includes("sk-attach-1")).toBe(false);
    const listRes = await fetch(`${base}/tenants`, { headers: { authorization: "Bearer livekey789" } });
    expect((await listRes.text()).includes("sk-attach-1")).toBe(false);
  });

  test("pool exhaustion → typed 409; detach releases the key for reuse", async () => {
    // spoke-live already holds sk-attach-1. Another principal takes sk-attach-2 on a second
    // hub, and a third hits pool exhaustion.
    const hub2 = makeHub(sb.wsDir, "co-ops");
    const res2 = await postAs("labeledkey456", { variant: "co-consult", attach_dir: "Projects/co-ops" });
    expect(res2.status).toBe(202);
    const b2 = (await res2.json()) as { tenantId: string };
    await state.provisioning.get(b2.tenantId);
    expect(state.registry.get(b2.tenantId)?.attachProviderKey).toBe("sk-attach-2");

    const hub3 = makeHub(sb.wsDir, "co-sec2");
    const res3 = await postAs("plainkey123", { variant: "co-consult", attach_dir: "Projects/co-sec2" });
    expect(res3.status).toBe(409);
    const e3 = (await res3.json()) as { code?: string };
    expect(e3.code).toBe("attach_provider_key_pool_exhausted");

    // Detach releases the per-session key (gateway-side); it can be allocated again.
    const del = await fetch(`${base}/tenants/${b2.tenantId}`, {
      method: "DELETE",
      headers: { "x-requested-with": "co-workspace", authorization: "Bearer labeledkey456" },
    });
    expect(del.status).toBe(200);
    const released = state.audit.list(200).find((a) => a.action === "attach.providerKey.released" && a.target === b2.tenantId);
    expect(released).toBeTruthy();
    const re = await postAs("labeledkey456", { variant: "co-consult", attach_dir: "Projects/co-ops" });
    expect(re.status).toBe(202);
    const rb = (await re.json()) as { tenantId: string };
    expect(rb.tenantId).not.toBe(b2.tenantId);
    await state.provisioning.get(rb.tenantId);
    expect(state.registry.get(rb.tenantId)?.attachProviderKey).toBe("sk-attach-2");
    expect(existsSync(hub2)).toBe(true);
    expect(existsSync(hub3)).toBe(true);
  });
});

// ═══ (e) cancel-on-UNAVAILABLE + (f) per-hub cap ════════════════════════════════════════════

describe("hub UNAVAILABLE (e): cap-check cancels active sessions, refuses new attach", () => {
  const sb = sandbox("hubstate", { isolation: "docker", env: OPEN_MODE_ENV });
  const hub = makeHub(sb.wsDir, HUB, { pipelineState: true });
  const state = createState(sb.cfg);
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  function makeAttachRow(principal: string) {
    const rec = state.registry.create({
      variant: "co-consult",
      key: `co-consult::${principal}`,
      ownerPrincipal: principal,
      kind: "attached",
      attachHub: hub,
      projectDir: hub,
    });
    mkdirSync(attachScratchDir(rec), { recursive: true });
    return rec;
  }

  const postAttach = () =>
    fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
      body: JSON.stringify({ variant: "co-consult", attach_dir: "Projects/co-finance" }),
    });

  test("state file reader: UNAVAILABLE flagged; declared alias accepted; absent/other/corrupt allowed", () => {
    writeFileSync(hubStatePath(hub), JSON.stringify({ operational_state: "UNAVAILABLE" }));
    expect(readHubLifecycleState(hub)).toMatchObject({ present: true, unavailable: true });
    writeFileSync(hubStatePath(hub), JSON.stringify({ lifecycle_state: "UNAVAILABLE" }));
    expect(readHubLifecycleState(hub).unavailable).toBe(true);
    writeFileSync(hubStatePath(hub), JSON.stringify({ operational_state: "AVAILABLE" }));
    expect(readHubLifecycleState(hub).unavailable).toBe(false);
    writeFileSync(hubStatePath(hub), "{corrupt");
    expect(readHubLifecycleState(hub).unavailable).toBe(false);
    rmSync(hubStatePath(hub));
    expect(readHubLifecycleState(hub)).toMatchObject({ present: false, unavailable: false });
  });

  test("UNAVAILABLE flip: cap-check kills the hub's active attach sessions, then the POST 409s", async () => {
    const r1 = makeAttachRow("spokeU1");
    const r2 = makeAttachRow("spokeU2");
    const kills: string[] = [];
    state.activeProcs.set(r1.tenantId, { kill: () => kills.push(r1.tenantId) });
    state.activeProcs.set(r2.tenantId, { kill: () => kills.push(r2.tenantId) });
    writeFileSync(hubStatePath(hub), JSON.stringify({ operational_state: "UNAVAILABLE" }));

    const err = errOf(() => assertAttachHubAdmittable(state, hub, "tester"));
    expect(err.status).toBe(409);
    expect(codeOf(err)).toBe("hub_unavailable");
    expect([...kills].sort()).toEqual([r1.tenantId, r2.tenantId].sort());
    const cancelled = state.audit.list(200).filter((a) => a.action === "attach.session.cancelled");
    expect(cancelled.map((a) => a.target).sort()).toEqual([r1.tenantId, r2.tenantId].sort());

    const res = await postAttach();
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("hub_unavailable");
    expect(body.error).toContain("cancelled");

    // Cleanup so the next test's re-attach starts from a clean registry.
    state.registry.delete(r1.tenantId);
    state.registry.delete(r2.tenantId);
    state.activeProcs.delete(r1.tenantId);
    state.activeProcs.delete(r2.tenantId);
  });

  test("probe re-verification (state file removed) → attach accepted again", async () => {
    rmSync(hubStatePath(hub));
    const res = await postAttach();
    expect(res.status).toBe(202);
    const b = (await res.json()) as { tenantId: string };
    await state.provisioning.get(b.tenantId);
    expect(state.registry.get(b.tenantId)?.kind).toBe("attached");
  });
});

describe("per-hub cap (f): 3rd session on the same hub is a typed 409", () => {
  const sb = sandbox("cap", {
    isolation: "docker",
    env: { ...OPEN_MODE_ENV, CO_WORKSPACE_ATTACH_HUB_MAX_SESSIONS: "2" },
  });
  const hub = makeHub(sb.wsDir, HUB);
  const otherHub = makeHub(sb.wsDir, "co-other");
  const state = createState(sb.cfg);
  const server = createServer(state);
  const base = `http://127.0.0.1:${server.port}`;
  afterAll(() => server.stop(true));

  function makeAttachRow(principal: string, hubDir: string) {
    const rec = state.registry.create({
      variant: "co-consult",
      key: `co-consult::${principal}`,
      ownerPrincipal: principal,
      kind: "attached",
      attachHub: hubDir,
      projectDir: hubDir,
    });
    mkdirSync(attachScratchDir(rec), { recursive: true });
    return rec;
  }

  const onHub = () => state.registry.list().filter((r) => r.kind === "attached" && resolve(r.attachHub ?? "") === resolve(hub));

  test("cap=2: two attached rows fill the hub; the third POST attach 409s (attach_hub_cap_reached)", async () => {
    makeAttachRow("spokeC1", hub);
    makeAttachRow("spokeC2", hub);
    expect(onHub().length).toBe(2);

    const third = await fetch(`${base}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-requested-with": "co-workspace" },
      body: JSON.stringify({ variant: "co-consult", attach_dir: "Projects/co-finance" }),
    });
    expect(third.status).toBe(409);
    const tb = (await third.json()) as { code?: string; error?: string };
    expect(tb.code).toBe("attach_hub_cap_reached");
    expect(tb.error).toContain("2/2");
    expect(onHub().length).toBe(2); // no partial row
  });

  test("other hubs are not capped by co-finance's occupancy", () => {
    const elsewhere = makeAttachRow("spokeElsewhere", otherHub);
    expect(elsewhere.attachHub).toBe(resolve(otherHub));
  });

  test("default cap is 2 when CO_WORKSPACE_ATTACH_HUB_MAX_SESSIONS is unset; 0 = off", () => {
    expect(loadConfig({}).attachHubMaxSessions).toBe(2);
    expect(loadConfig({ CO_WORKSPACE_ATTACH_HUB_MAX_SESSIONS: "0" }).attachHubMaxSessions).toBe(0);
    expect(loadConfig({ CO_WORKSPACE_ATTACH_HUB_MAX_SESSIONS: "junk" }).attachHubMaxSessions).toBe(2);
  });
});
