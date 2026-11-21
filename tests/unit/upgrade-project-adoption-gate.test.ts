/**
 * Tests for the upgrade-project adoption-only engine gate (spec
 * docs/designs/2026-11-21-co-utility-dedup-and-adoption-role-design.md §5.3-§5.5/§5.9),
 * run as REAL subprocesses against the repo script (the same discipline as the
 * tenant-guard suite):
 *
 *  - an adoption-only target (variant.json "consumption": "adoption-only") REFUSES by
 *    default — refusal-grade, not --yes-bypassable, with the curated-path pointer;
 *  - --confirm-curated unlocks for THIS invocation and dry-run remains the default until
 *    --confirm is ALSO passed (two explicit tokens);
 *  - --surfaces is validated against the run's upgrade-policy claim inventory (unknown
 *    class = error listing the valid ones) and narrows the claim-classed delivery;
 *  - a non-adoption target ignores --confirm-curated with a WARN (behavior byte-identical).
 *
 * REGISTRY/STATE LIFECYCLE: this file owns NO repo state — fixtures are mkdtemp dirs
 * (T-20261104-003 discipline: nothing under repo Projects/, nothing the hygiene gate
 * sees), the tenant-loop registry seam points at an mkdtemp file so no repo-root
 * registry can interfere, and the fixture target path carries NO gw-shaped segment so
 * the tenant guard performs zero registry IO by construction (v1.98.0).
 *
 * The --confirm-executes apply path is NOT spawned here (a full curated apply runs the
 * whole delivery engine and belongs to the acceptance flow, same ruling as the
 * tenant-guard suite); the forced-dry-run branch pins the two-token ordering.
 *
 * @version 1.0.0
 */
import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const UPGRADE = join(REPO_ROOT, 'scripts', 'upgrade-project.ts');
const SEAM = 'CO_WORKSPACE_TENANT_LOOP_REGISTRY_FILE';

let seamDir = '';
let SEAM_REGISTRY = '';

beforeAll(() => {
  seamDir = mkdtempSync(join(tmpdir(), 'adoption-gate-seam-'));
  SEAM_REGISTRY = join(seamDir, 'tenant-loop-registry.json'); // empty (absent) — zero tenants
  process.env[SEAM] = SEAM_REGISTRY;
});

afterAll(() => {
  delete process.env[SEAM];
  rmSync(seamDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** Fixture target: a git repo carrying the adoption-only marker variant.json and a
 * co-utility template-version marker — the minimal shape that gets past the git +
 * variant-detection post-guard checks. NOT gw-shaped (no TENANT_ID_RE segment), so
 * the tenant guard never consults the registry for it. */
function makeAdoptionTarget(opts: { adoptionOnly?: boolean } = {}): { dir: string; cleanup: () => void } {
  const base = mkdtempSync(join(tmpdir(), 'adoption-gate-'));
  const dir = join(base, 'adopted-target');
  mkdirSync(dir, { recursive: true });
  assertCallerEnvSafeForGitFixtures(dir);
  execFileSync('git', ['init', '-q', dir], { env: gitCleanEnv() });
  assertFixtureGitIdentity(dir);
  writeFileSync(join(dir, 'template-version.txt'), 'variant=co-utility\nversion=0.1.0\nplatform=all\n');
  if (opts.adoptionOnly !== false) {
    writeFileSync(
      join(dir, 'variant.json'),
      JSON.stringify({ name: 'co-utility', consumption: 'adoption-only' }, null, 2) + '\n',
      'utf-8',
    );
  }
  return { dir, cleanup: () => rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }) };
}

function runUpgrade(target: string, args: string[] = []): { status: number; stdout: string; stderr: string } {
  const r = spawnSync('bun', [UPGRADE, target, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 240_000,
    env: { ...gitCleanEnv(process.env), [SEAM]: SEAM_REGISTRY, TZ: 'UTC' },
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('upgrade-project adoption-only engine gate (design §5.3-§5.5)', () => {
  test('adoption-only target REFUSES by default — exit 1, curated-path pointer, not --yes-bypassable', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      // No --yes passed at all: the refusal must fire BEFORE the prompt-grade H14 check.
      const r = runUpgrade(dir, ['--dry-run', '--yes']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('"consumption": "adoption-only"');
      expect(r.stderr).toContain('refusing the template wave');
      expect(r.stderr).toContain('--confirm-curated');
      expect(r.stderr).toContain('--surfaces');
      expect(r.stderr).toContain('Commit manually');
      // refusal fires before variant resolution — no readiness/run output below it
      expect(r.stdout).not.toContain('[DRY RUN]');
    } finally {
      cleanup();
    }
  }, 240_000);

  test('adoption-only refusal fires even under --yes (refusal-grade, not prompt-grade)', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      const r = runUpgrade(dir, ['--dry-run', '--yes', '--allow-non-member']);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain('refusing the template wave');
    } finally {
      cleanup();
    }
  }, 240_000);

  test('--confirm-curated lifts the refusal; dry-run stays the default and writes nothing', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      const marker = join(dir, 'curated-marker.txt');
      writeFileSync(marker, 'untouched\n', 'utf-8');
      const r = runUpgrade(dir, ['--confirm-curated', '--dry-run', '--yes']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('curated unlock active');
      expect(r.stdout).toContain('[DRY RUN] No files were modified.');
      // dry-run performed zero writes — the fixture byte-state is unchanged
      expect(readFileSync(marker, 'utf-8')).toBe('untouched\n');
    } finally {
      cleanup();
    }
  }, 240_000);

  test('curated unlock without --confirm forces dry-run (two explicit tokens, design §5.3)', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      const r = runUpgrade(dir, ['--confirm-curated', '--yes']);
      expect(r.status).toBe(0);
      expect(r.stdout + r.stderr).toContain('defaults to dry-run — pass --confirm to execute');
      expect(r.stdout).toContain('[DRY RUN] No files were modified.');
    } finally {
      cleanup();
    }
  }, 240_000);

  test('--surfaces with an unknown claim class errors and lists the run plan inventory', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      const r = runUpgrade(dir, ['--confirm-curated', '--surfaces', 'NOT A CLASS', '--dry-run', '--yes']);
      expect(r.status).toBe(1);
      expect(r.stdout + r.stderr).toContain("unknown claim class(es): 'NOT A CLASS'");
      expect(r.stdout + r.stderr).toContain('Valid claim classes for this run');
      expect(r.stdout + r.stderr).toContain('TEMPLATE TREE SYNC'); // inventory names real claim classes
    } finally {
      cleanup();
    }
  }, 240_000);

  test('--surfaces with a valid class narrows the plan (selection INFO + pass withholding)', () => {
    const { dir, cleanup } = makeAdoptionTarget();
    try {
      const r = runUpgrade(dir, ['--confirm-curated', '--surfaces', 'TEMPLATE TREE SYNC', '--dry-run', '--yes']);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain('--surfaces selection: TEMPLATE TREE SYNC');
      expect(r.stdout).toContain('claim-classed delivery narrowed to: TEMPLATE TREE SYNC');
      // a claim-classed pass outside the selection is withheld with a visible note
      expect(r.stdout).toContain("withheld — --surfaces selection does not include 'SYNC_IF_NEWER: scripts/'");
    } finally {
      cleanup();
    }
  }, 240_000);

  test('non-adoption target: --confirm-curated is a no-op WARN (behavior byte-identical)', () => {
    const { dir, cleanup } = makeAdoptionTarget({ adoptionOnly: false });
    try {
      const r = runUpgrade(dir, ['--confirm-curated', '--dry-run', '--yes']);
      expect(r.status).toBe(0);
      expect(r.stdout + r.stderr).toContain('only unlocks an adoption-only target');
      expect(r.stdout).not.toContain('curated unlock active');
      expect(r.stdout).toContain('[DRY RUN] No files were modified.');
    } finally {
      cleanup();
    }
  }, 240_000);
});
