/**
 * Tenant upgrade guard (design docs/designs/2026-11-08-gw-tenant-loop-and-hardening-design.md
 * §3.4/§7.5) and the backport-diff tenant variant resolution (§3.5), run as REAL
 * subprocesses against the repo scripts.
 *
 * REGISTRY LIFECYCLE — this file is the SINGLE OWNER of the real repo's
 * gitignored runtime registry (.pipeline-state/tenant-loop-registry.json) for
 * the duration of the suite: upgrade-project.ts resolves its workspace root
 * from its own path (no env seam, by the fleet-design convention of injected
 * params at lib level and no production surface for script seams), so the
 * guard can only be exercised with the registry in place. The file is
 * backed up before and restored after; tests within a file run sequentially,
 * so no parallel-file race is possible. No fixture ever lives inside the repo
 * (all targets are absolute mkdtemp roots — the T-20261104-003 / PR #1855
 * lesson; a planted repo-root Projects/ is exactly what the hygiene gate
 * forbids).
 *
 * The `--confirm`-executes apply path is pinned structurally (the guard's
 * dry-run gate ordering plus the prompt-skip condition) — a full tenant apply
 * runs the whole delivery engine and belongs to the gateway-spawn acceptance
 * flow (WP2 runtime), not a unit suite.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { variantName } from '../../scripts/backport-diff.ts';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const REGISTRY = join(REPO_ROOT, '.pipeline-state', 'tenant-loop-registry.json');
const UPGRADE = join(REPO_ROOT, 'scripts', 'upgrade-project.ts');

let backup: string | null = null;
let hadRegistry = false;

beforeAll(() => {
  mkdirSync(join(REPO_ROOT, '.pipeline-state'), { recursive: true });
  hadRegistry = existsSync(REGISTRY);
  if (hadRegistry) backup = readFileSync(REGISTRY, 'utf-8');
});

afterAll(() => {
  if (hadRegistry && backup !== null) writeFileSync(REGISTRY, backup, 'utf-8');
  else rmSync(REGISTRY, { force: true });
});

function writeRegistry(tenants: unknown[]): void {
  mkdirSync(join(REPO_ROOT, '.pipeline-state'), { recursive: true });
  writeFileSync(
    REGISTRY,
    JSON.stringify({ schemaVersion: 1, writtenAt: new Date().toISOString(), tenants }),
    'utf-8',
  );
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

/** A minimal-but-valid tenant fixture: git repo + template-version.txt so the
 * run gets past the guard AND the deterministic post-guard checks. */
function makeTenantProject(opts: { git?: boolean; marker?: boolean } = {}): { dir: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'tenant-guard-'));
  const dir = join(base, 'project');
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

function runUpgrade(target: string, args: string[] = []): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bun', [UPGRADE, target, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 240_000,
    // Sanitized base (hook-context GIT_DIR must not steer the upgrade engine's
    // git snapshot flows), TZ override after.
    env: { ...gitCleanEnv(process.env), TZ: 'UTC' },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

const GUARD_PASS_WINDOW = { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '00:00', end: '23:59' };
const GUARD_FAIL_WINDOW = { tz: 'UTC', days: [0, 1, 2, 3, 4, 5, 6], start: '05:00', end: '05:00' }; // zero-length → never open

describe('upgrade-project tenant guard — each gate refuses with its reason (design §3.4)', () => {
  test('suspended tenant → exit 1, reason names the tenant id + status + registry', () => {
    const { dir, cleanup } = makeTenantProject();
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
    const { dir, cleanup } = makeTenantProject();
    try {
      writeRegistry([tenantRow('gw-bbbbbbbbbbbb', dir, { scopes: { upgrade: false, upstreamFile: true, backportReview: true, nightlyFleet: true } })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('gw-bbbbbbbbbbbb');
      expect(r.stderr).toContain('scopes.upgrade=false');
    } finally { cleanup(); }
  });

  test('out-of-window (zero-length window) → exit 1 with the out-of-window reason row', () => {
    const { dir, cleanup } = makeTenantProject();
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
    const { dir, cleanup } = makeTenantProject();
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
    const { dir, cleanup } = makeTenantProject();
    try {
      writeRegistry([tenantRow('gw-eeeeeeeeeeee', dir, { windows: GUARD_PASS_WINDOW })]);
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(0);
      expect(r.stderr).not.toContain('defaults to dry-run');
      expect(r.stdout).toContain('[DRY RUN]');
    } finally { cleanup(); }
  });

  test('--confirm --dry-run parses (still dry-run, still no forcing WARN)', () => {
    const { dir, cleanup } = makeTenantProject();
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
    const base = mkdtempSync(join(tmpdir(), 'tenant-guard-nonmember-'));
    const dir = join(base, 'plain-dir');
    mkdirSync(dir, { recursive: true });
    try {
      writeRegistry([tenantRow('gw-aaaaaaaaaaaa', join(base, 'unrelated', 'project'))]); // target matches nothing
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('Outside-Projects target refused');
      expect(r.stderr).not.toContain('tenant-loop-registry.json');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('malformed tenant registry + outside-Projects target → fail-closed refusal naming the registry', () => {
    const base = mkdtempSync(join(tmpdir(), 'tenant-guard-malformed-'));
    const dir = join(base, 'plain-dir');
    mkdirSync(dir, { recursive: true });
    try {
      mkdirSync(join(REPO_ROOT, '.pipeline-state'), { recursive: true });
      writeFileSync(REGISTRY, '{ broken', 'utf-8');
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('tenant-loop registry failed to load');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('--confirm on a non-tenant target is a WARN\u2019d no-op (the --yes consent still applies)', () => {
    const base = mkdtempSync(join(tmpdir(), 'tenant-guard-confirm-'));
    const dir = join(base, 'plain-dir');
    mkdirSync(dir, { recursive: true });
    try {
      writeRegistry([]);
      const r = runUpgrade(dir, ['--confirm', '--dry-run']);
      expect(r.status).toBe(1); // outside-Projects refusal unchanged
      expect(r.stderr).toContain('--confirm only gates a registered tenant-loop target');
      expect(r.stderr).toContain('Outside-Projects target refused');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });

  test('registry ABSENT → zero tenants → guard passes through (non-tenant behavior)', () => {
    const base = mkdtempSync(join(tmpdir(), 'tenant-guard-absent-'));
    const dir = join(base, 'plain-dir');
    mkdirSync(dir, { recursive: true });
    try {
      rmSync(REGISTRY, { force: true });
      const r = runUpgrade(dir, ['--dry-run']);
      expect(r.status).toBe(1); // the unchanged outside-Projects refusal
      expect(r.stderr).toContain('Outside-Projects target refused');
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe('backport-diff variantName — registry variant is authoritative for tenants (design §3.5)', () => {
  test('an absolute tenant path yields the REGISTRY variant, not the basename', () => {
    const { dir, cleanup } = makeTenantProject();
    try {
      writeRegistry([tenantRow('gw-aaaaaaaaaaaa', dir, { variant: 'co-consult' })]);
      // The tenant dir is named 'project' — no templates/project exists — so the
      // old basename heuristic returned null; the registry field must win.
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

  test('a malformed registry makes the tenant lookup THROW (fail-closed) — the fleet-registry contract', () => {
    const { dir, cleanup } = makeTenantProject();
    try {
      mkdirSync(join(REPO_ROOT, '.pipeline-state'), { recursive: true });
      writeFileSync(REGISTRY, '{ broken', 'utf-8');
      expect(() => variantName(dir)).toThrow(/Malformed tenant-loop registry/);
    } finally { cleanup(); }
  });
});

// Keep the fixture utilities referenced for parity/debugging.
void readlinkSync; void statSync; void symlinkSync;
