/**
 * Tenant upgrade guard (design docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 * §3.4/§7.5) and the backport-diff tenant variant resolution (§3.5), run as REAL
 * subprocesses against the repo scripts.
 *
 * REGISTRY LIFECYCLE — v1.1.0: this file owns NO repo state and NEVER touches
 * the real repo's gitignored .pipeline-state. Fixture registries are mkdtemp
 * files selected via the CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE env seam
 * (lib/fleet.ts tenantLoopRegistryPath — an ABSOLUTE path to the registry FILE
 * replaces the repo-root resolution for the subprocess spawns AND the
 * in-process backport-diff imports alike). Rationale: the v1.0.0 strategy
 * (backup/restore of the real repo-root registry) was the direct cause of the
 * PR #1935 CI incident — a malformed leftover repo-root registry made every
 * LATER upgrade-project spawn (upgrade-decision-log, upgrade-instruction-census
 * suites) refuse fail-closed, red on all three runners. The guard itself is now
 * also LAZY and PATH-SCOPED (upgrade-project.ts v1.98.0): only a target whose
 * real path contains a gw-<12hex> segment (tenant projectDirs always sit under
 * .../<principal>/gw-<12hex>/project, design §3.4) consults the registry at all,
 * so these fixtures ALSO keep their targets gw-shaped — a plain dir can never
 * reach the registry by construction (pinned by the CI-regression test below).
 * All fixture targets and registries live under absolute mkdtemp roots — the
 * T-20261104-003 / PR #1855 lesson (no repo-root Projects/, no repo-root
 * .pipeline-state, nothing the hygiene gate cannot see).
 *
 * The `--confirm`-executes apply path is pinned structurally (the guard's
 * dry-run gate ordering plus the prompt-skip condition) — a full tenant apply
 * runs the whole delivery engine and belongs to the gateway-spawn acceptance
 * flow (WP2 runtime), not a unit suite.
 *
 * @version 1.1.0
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { variantName } from '../../scripts/backport-diff.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const UPGRADE = join(REPO_ROOT, 'scripts', 'upgrade-project.ts');
const SEAM = 'CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE';

let registryDir = '';
let REGISTRY = ''; // the seam target — an mkdtemp FILE, never a repo path

beforeAll(() => {
  registryDir = mkdtempSync(join(tmpdir(), 'tenant-guard-reg-'));
  REGISTRY = join(registryDir, 'tenant-loop-registry.json');
  // File-wide seam: every spawn below passes it explicitly AND the in-process
  // variantName() calls resolve their registry through the same seam.
  process.env[SEAM] = REGISTRY;
});

afterAll(() => {
  delete process.env[SEAM];
  rmSync(registryDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function writeRegistry(tenants: unknown[]): void {
  writeFileSync(
    REGISTRY,
    JSON.stringify({ schemaVersion: 1, writtenAt: new Date().toISOString(), tenants }),
    'utf-8',
  );
}

function writeMalformedRegistry(): void {
  writeFileSync(REGISTRY, '{ broken', 'utf-8');
}

function clearRegistry(): void {
  rmSync(REGISTRY, { force: true });
}

function tenantRow(id: string, projectDir: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    principal: 'op@example.com',
    variant: 'co-consult',
    projectDir,
    status: 'active',
    scopes: { upgrade: true, upstreamFile: true, backportReview: true, nightlyFleet: true },
    windows: { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' },
    gitRemote: 'local-only',
    ...overrides,
  };
}

/** A minimal-but-valid gw-SHAPED tenant fixture: the target path carries the
 * gw-<12hex> segment (design §3.4 layout .../<principal>/gw-<12hex>/project) so
 * the v1.98.0 plausibility gate lets it reach the registry, plus git repo +
 * template-version.txt so the run gets past the guard AND the deterministic
 * post-guard checks. */
function makeTenantProject(opts: { id?: string; git?: boolean; marker?: boolean } = {}): { dir: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'tenant-guard-'));
  const dir = join(base, opts.id ?? 'gw-aaaaaaaaaaaa', 'project');
  mkdirSync(dir, { recursive: true });
  // gitCleanEnv: a hook context (`git push` pre-push) exports GIT_DIR aimed at this
  // checkout's private git dir — unsanitized fixture `git init` honors it over the
  // explicit dir arg and the fixture never gets its own .git (and the add/commit
  // variants land commits on the PR branch; 2026-11-07 external-deps incident class,
  // reproduced live 2026-11-09).
  if (opts.git !== false) execFileSync('git', ['init', '-q', dir], { env: gitCleanEnv() });
  if (opts.marker !== false) {
    writeFileSync(join(dir, 'template-version.txt'), 'variant=co-consult\nversion=0.8.1\nplatform=all\n');
  }
  return { dir, cleanup: () => rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) };
}

/** A plain (non-gw-shaped) outside-Projects target — must NEVER reach the
 * registry (zero registry IO by construction, upgrade-project.ts v1.98.0). */
function makePlainDir(label: string): { dir: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), `tenant-guard-${label}-`));
  const dir = join(base, 'plain-dir');
  mkdirSync(dir, { recursive: true });
  return { dir, cleanup: () => rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) };
}

function runUpgrade(target: string, args: string[] = []): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bun', [UPGRADE, target, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 240_000,
    // Sanitized base (hook-context GIT_DIR must not steer the upgrade engine's
    // git snapshot flows), seam registry path pinned explicitly, TZ after.
    env: { ...gitCleanEnv(process.env), [SEAM]: REGISTRY, TZ: 'UTC' },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const GUARD_PASS_WINDOW = { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' };
const GUARD_FAIL_WINDOW = { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '05:00', end: '05:00' }; // zero-length → never open

describe('upgrade-project tenant guard — each gate refuses with its reason (design §3.4)', () => {
  test('suspended tenant → exit 1, reason names the tenant id + status + registry', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa' });
    try {
      writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir, { status: 'suspended' })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('gw-aaaaaaaaaaaa');
      expect(r.stderr).toContain('status=suspended');
      expect(r.stderr).toContain('tenant-loop-registry.json');
      expect(r.stdout).not.toContain('[DRY RUN]');
    } finally { cleanup(); }
  });

  test('scopes.upgrade=false → exit 1 with the scope reason', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-bbbbbbbbbbbb' });
    try {
      writeRegistry([tenantRow('gw-bbbbbbbbbbbb', dir, { scopes: { upgrade: false, upstreamFile: true, backportReview: true, nightlyFleet: true } })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('gw-bbbbbbbbbbbb');
      expect(r.stderr).toContain('scopes.upgrade=false');
    } finally { cleanup(); }
  });

  test('out-of-window (zero-length window) → exit 1 with the out-of-window reason row', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-cccccccccccc' });
    try {
      writeRegistry([tenantRow('gw-cccccccccccc', dir, { windows: GUARD_FAIL_WINDOW })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('gw-cccccccccccc');
      expect(r.stderr).toContain('outside gateway windows');
    } finally { cleanup(); }
  });
});

describe('tenant mode defaults to dry-run; --confirm is the execute consent (design §3.4)', () => {
  test('no flags → forced dry-run (WARN + [DRY RUN] report, exit 0)', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-dddddddddddd' });
    try {
      writeRegistry([tenantRow('gw-dddddddddddd', dir, { windows: GUARD_PASS_WINDOW })]);
      const r = runUpgrade(dir);
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('defaults to dry-run');
      expect(r.stderr).toContain('--confirm');
      expect(r.stdout).toContain('[DRY RUN]');
    } finally { cleanup(); }
  });

  test('explicit --dry-run stays dry-run with NO default-forcing WARN', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-eeeeeeeeeeee' });
    try {
      writeRegistry([tenantRow('gw-eeeeeeeeeeee', dir, { windows: GUARD_PASS_WINDOW })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('defaults to dry-run');
      expect(r.stdout).toContain('[DRY RUN]');
    } finally { cleanup(); }
  });

  test('--confirm --dry-run parses (still dry-run, still no forcing WARN)', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-ffffffffffff' });
    try {
      writeRegistry([tenantRow('gw-ffffffffffff', dir, { windows: GUARD_PASS_WINDOW })]);
      const r = runUpgrade(dir, ['--confirm', '--dry-run']);
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('defaults to dry-run');
      expect(r.stdout).toContain('[DRY RUN]');
    } finally { cleanup(); }
  });

  test('STRUCTURAL PIN: the execute gate is exactly !dryRun && !confirmFlag, and a guard-passing tenant skips the outside-Projects --yes prompt', () => {
    const src = readFileSync(UPGRADE, 'utf-8');
    expect(src).toContain('if (!dryRun && !confirmFlag)');
    expect(src).toContain('if (!targetInsideProjects && !tenantTarget)');
    expect(src).toContain("args[i] === '--confirm'");
  });
});

describe('non-tenant invocations are unchanged (regression pins)', () => {
  test('outside-Projects non-tenant target still prompts (stdin closed → refusal, exit 1)', () => {
    const { dir, cleanup } = makePlainDir('nonmember');
    try {
      writeRegistry([tenantRow('gw-aaaaaaaaaaaa', join(registryDir, 'unrelated', 'project'))]); // target matches nothing
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Outside-Projects target refused');
      expect(r.stderr).not.toContain('tenant-loop-registry.json');
    } finally { cleanup(); }
  });

  test('--confirm on a non-tenant target is a WARN\u2019d no-op (the --yes consent still applies)', () => {
    const { dir, cleanup } = makePlainDir('confirm');
    try {
      writeRegistry([]);
      const r = runUpgrade(dir, ['--confirm', '--dry-run']);
      expect(r.status).toBe(1); // outside-Projects refusal unchanged
      expect(r.stderr).toContain('--confirm only gates a registered tenant-loop target');
      expect(r.stderr).toContain('Outside-Projects target refused');
    } finally { cleanup(); }
  });
});

describe('registry path seam — lazy, path-scoped guard (v1.98.0, PR #1935 CI incident)', () => {
  // The seam (CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE) is set suite-wide; all
  // fixture registries live at the mkdtemp file it names. A refusal naming a
  // tenant id can ONLY come from loading THAT file, so the refusals above are
  // themselves the "seam honored" proof; the tests below pin the scoping and
  // the fail-closed boundaries.

  test('CI REGRESSION: malformed registry + NON-gw-shaped target → ZERO registry IO → ordinary outside-Projects refusal (never the fail-closed error)', () => {
    const { dir, cleanup } = makePlainDir('malformed-nonmember');
    try {
      // The exact PR #1935 CI scenario, without writing the repo root: had the
      // guard consulted the (malformed) registry for this plain target, it
      // would refuse with 'tenant-loop registry failed to load' — asserting
      // that message is ABSENT proves the registry was never read.
      writeMalformedRegistry();
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Outside-Projects target refused');
      expect(r.stderr).not.toContain('tenant-loop registry failed to load');
    } finally { cleanup(); }
  });

  test('gw-plausible target + malformed registry → refused fail-closed (contract preserved)', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa', git: false, marker: false });
    try {
      writeMalformedRegistry();
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('tenant-loop registry failed to load');
    } finally { cleanup(); }
  });

  test('gw-shaped target + registry ABSENT at the seam → zero tenants → passes through to the outside-Projects refusal', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa', git: false, marker: false });
    try {
      clearRegistry();
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1); // the unchanged outside-Projects refusal
      expect(r.stderr).toContain('Outside-Projects target refused');
      expect(r.stderr).not.toContain('tenant-loop registry failed to load');
    } finally { cleanup(); }
  });

  test('gw-shaped target + VALID registry with NO matching row → passes through to the outside-Projects refusal', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa', git: false, marker: false });
    const { dir: other, cleanup: cleanupOther } = makeTenantProject({ id: 'gw-bbbbbbbbbbbb', git: false, marker: false });
    try {
      writeRegistry([tenantRow('gw-bbbbbbbbbbbb', other)]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Outside-Projects target refused');
      expect(r.stderr).not.toContain('tenant-loop registry failed to load');
    } finally { cleanup(); cleanupOther(); }
  });

  test('seam honored (positive path): a registry at the CUSTOM path is loaded and its guard+tenant behavior applies — dry-run default fires', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-dddddddddddd' });
    try {
      // Only a successful load of the custom-path registry can produce
      // tenant-mode behavior (the forcing WARN + [DRY RUN] report).
      writeRegistry([tenantRow('gw-dddddddddddd', dir, { windows: GUARD_PASS_WINDOW })]);
      const r = runUpgrade(dir);
      expect(r.status).toBe(0);
      expect(r.stderr).toContain('defaults to dry-run');
      expect(r.stdout).toContain('[DRY RUN]');
    } finally { cleanup(); }
  });
});

describe('backport-diff variantName — registry variant is authoritative for tenants (design §3.5)', () => {
  test('an absolute tenant path yields the REGISTRY variant, not the basename', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa' });
    try {
      writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir, { variant: 'co-consult' })]);
      // The tenant dir is named 'project' — no templates/project exists — so the
      // old basename heuristic returned null; the registry field must win.
      // In-process call: resolves its registry through the same seam.
      expect(variantName(dir)).toBe('co-consult');
      expect(variantName(join(dir, 'skills'))).toBe('co-consult');
    } finally { cleanup(); }
  });

  test('a fleet path keeps the basename heuristic', () => {
    writeRegistry([]);
    // templates/co-develop exists in this repo, so the fallback resolves.
    expect(variantName(join('Projects', 'co-develop'))).toBe('co-develop');
  });

  test('an unknown path with no matching variant still yields null', () => {
    writeRegistry([]);
    expect(variantName('/definitely/not/a/variant/dir')).toBeNull();
  });

  test('a malformed registry makes the tenant lookup THROW (fail-closed) — the fleet-registry contract, honored at the seam path', () => {
    const { dir, cleanup } = makeTenantProject({ id: 'gw-aaaaaaaaaaaa' });
    try {
      writeMalformedRegistry();
      expect(() => variantName(dir)).toThrow(/Malformed tenant-loop registry/);
    } finally { cleanup(); }
  });
});
