import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// verify gate coverage, component coverage and missed nights (T-20261124-008,
// T-20261123-008 — design docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md
// §4.2, §4.3). The CLI drives exit codes against a fixture manifest in a temp cwd;
// the script runs its CLI at import time, so every rule is pinned through the CLI exit codes.

const SCRIPT = join(import.meta.dir, '..', '..', 'scripts', 'run-manifest.ts');
const DATE = '2026-11-25'; // Wednesday

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'run-manifest-verify-'));
  mkdirSync(join(root, '.pipeline-state'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeManifest(overrides: Record<string, unknown>, date: string = DATE): void {
  const manifest = {
    run: 'unified-2026-11-25',
    started: '2026-11-24T18:14:03.000Z',
    prerunHeads: {},
    mergedPRs: [],
    sanctionedRepairs: [],
    billingWallEvidence: [],
    skippedBudget: [],
    steps: [],
    projectReviews: [],
    gateChecks: [],
    ...overrides,
  };
  writeFileSync(join(root, '.pipeline-state', `run-manifest-${date}.json`), `${JSON.stringify(manifest, null, 1)}\n`);
}

function runVerify(args: string[]): { exit: number; stderr: string } {
  const res = Bun.spawnSync(['bun', SCRIPT, 'verify', '--date', DATE, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exit: res.exitCode, stderr: res.stderr.toString() };
}

const reviews = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    project: `co-p${i}`,
    tier: 'baseline-only',
    outcome: 'pass',
    basis: null,
    at: '2026-11-25T00:00:00.000Z',
  }));
const gateRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    gate: 'STEP_I_PRE_REVIEW',
    project: `co-p${i}`,
    verdict: 'pass',
    detail: 'fresh pass',
    at: '2026-11-25T00:00:00.000Z',
  }));
const stepISkip = { step: 'STEP_I', reason: 'co-p7: gate fail row', at: '2026-11-25T00:00:00.000Z' };

describe('§4.2 gate coverage', () => {
  test('8 review rows and 0 gate rows exits 4', () => {
    writeManifest({ projectReviews: reviews(8), gateChecks: [] });
    const res = runVerify([]);
    expect(res.exit).toBe(4);
    expect(res.stderr).toContain('0 project(s) carry a STEP_I_PRE_REVIEW row, 8 expected');
  });

  test('8 review rows and 8 gate rows exits 0', () => {
    writeManifest({ projectReviews: reviews(8), gateChecks: gateRows(8) });
    expect(runVerify([]).exit).toBe(0);
  });

  test('8 review rows, 1 STEP I skip and 7 gate rows exits 0', () => {
    writeManifest({ projectReviews: reviews(8), gateChecks: gateRows(7), skippedBudget: [stepISkip] });
    expect(runVerify([]).exit).toBe(0);
  });

  test('a battery-only night (zero review rows) does not fire', () => {
    writeManifest({ projectReviews: [], gateChecks: [] });
    expect(runVerify([]).exit).toBe(0);
  });

});

describe('§4.3 change 1 component coverage', () => {
  const all = (profile: 'full' | 'fast') => ({
    full: ['STEP_A', 'STEP_B', 'STEP_C', 'STEP_D', 'STEP_E', 'STEP_F', 'STEP_G', 'STEP_H', 'STEP_I', 'STEP_J'],
    fast: ['STEP_A', 'STEP_E', 'STEP_J'],
  })[profile];

  test('a missing component exits 5', () => {
    const steps = all('fast')
      .filter((step) => step !== 'STEP_E')
      .map((step) => ({ step, status: 'complete', at: 'x', reason: null }));
    writeManifest({ steps });
    const res = runVerify(['--profile', 'fast']);
    expect(res.exit).toBe(5);
    expect(res.stderr).toContain('STEP_E');
  });

  test('a component with only a skip row exits 0', () => {
    const steps = [{ step: 'STEP_A', status: 'complete', at: 'x', reason: null }];
    const skippedBudget = [{ step: 'STEP_E', reason: 'budget', at: 'x' }, { step: 'STEP_J', reason: 'budget', at: 'x' }];
    writeManifest({ steps, skippedBudget });
    expect(runVerify(['--profile', 'fast']).exit).toBe(0);
  });

  test('a failed steps row still covers the component', () => {
    writeManifest({
      steps: all('fast').map((step) => ({ step, status: 'failed', at: 'x', reason: null })),
    });
    expect(runVerify(['--profile', 'fast']).exit).toBe(0);
  });

  test('verify without --profile does not check components', () => {
    writeManifest({});
    expect(runVerify([]).exit).toBe(0);
  });

  test('an unknown profile is a usage error', () => {
    writeManifest({});
    expect(runVerify(['--profile', 'nightly']).exit).toBe(1);
  });

});

describe('§4.3 change 2 missed nights', () => {
  test('a scheduled night without a manifest exits 6', () => {
    writeManifest({});
    const res = runVerify(['--nights', '1']); // 2026-11-24, a Tuesday
    expect(res.exit).toBe(6);
    expect(res.stderr).toContain('2026-11-24');
  });

  test('a present scheduled night exits 0', () => {
    writeManifest({});
    writeManifest({ run: 'unified-2026-11-24' }, '2026-11-24');
    expect(runVerify(['--nights', '1']).exit).toBe(0);
  });

  test('a Saturday night is not scheduled (Friday looks back to Thursday)', () => {
    writeManifest({});
    writeManifest({ run: 'unified-2026-11-19' }, '2026-11-19'); // Thursday
    writeManifest({ run: 'unified-2026-11-20' }, '2026-11-20'); // Friday
    writeManifest({ run: 'unified-2026-11-21' }, '2026-11-21'); // Saturday: verified night
    const res = Bun.spawnSync(['bun', SCRIPT, 'verify', '--date', '2026-11-21', '--nights', '2'], {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    expect(res.exitCode).toBe(0);
  });

  test('--nights 0 inspects nothing', () => {
    writeManifest({});
    expect(runVerify(['--nights', '0']).exit).toBe(0);
  });
});
