import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// gate-step-i (T-20261119-010 / DEC-20261120-03 — design
// docs/designs/2026-11-20-runner-hardening-integrity-design.md §3.1 + §8 tests
// a–g). The gate is the run LEDGER's verdict, so the tests drive the real CLI
// (exit codes + manifest writes are the contract) against fixture manifests in
// a temp cwd: .pipeline-state/run-manifest-<date>.json is resolved from CWD,
// and --date pins the fixture name deterministically.

const SCRIPT = join(import.meta.dir, '..', '..', 'scripts', 'run-manifest.ts');
const FIXTURE_DATE = '2026-11-20';
const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SHA_C = 'cccccccccccccccccccccccccccccccccccccccc';

interface FixtureReview {
  project: string;
  tier: string;
  outcome: string;
  basis: string | null;
  at: string;
}

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gate-step-i-test-'));
  mkdirSync(join(root, '.pipeline-state'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Fixture manifest. `withGateChecks: false` emits the pre-PR-3 schema
 * (no gateChecks key) for the schema-verify regression case. */
function writeManifest(projectReviews: FixtureReview[], opts?: { withGateChecks?: boolean }): void {
  const manifest: Record<string, unknown> = {
    run: 'unified-2026-11-20',
    started: '2026-11-20T03:00:00.000Z',
    prerunHeads: {},
    mergedPRs: [],
    sanctionedRepairs: [],
    billingWallEvidence: [],
    skippedBudget: [],
    steps: [],
    projectReviews,
  };
  if (opts?.withGateChecks !== false) manifest.gateChecks = [];
  writeFileSync(
    join(root, '.pipeline-state', `run-manifest-${FIXTURE_DATE}.json`),
    `${JSON.stringify(manifest, null, 1)}\n`,
  );
}

function runGate(args: string[]): { exit: number; stdout: string; stderr: string } {
  const res = Bun.spawnSync(['bun', SCRIPT, 'gate-step-i', '--date', FIXTURE_DATE, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exit: res.exitCode, stdout: res.stdout.toString(), stderr: res.stderr.toString() };
}

function runVerify(args: string[] = []): { exit: number; stdout: string; stderr: string } {
  const res = Bun.spawnSync(['bun', SCRIPT, 'verify', '--date', FIXTURE_DATE, ...args], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exit: res.exitCode, stdout: res.stdout.toString(), stderr: res.stderr.toString() };
}

function readBack(): { gateChecks: Array<{ gate: string; project: string; verdict: string; detail: string }> } {
  return JSON.parse(readFileSync(join(root, '.pipeline-state', `run-manifest-${FIXTURE_DATE}.json`), 'utf8'));
}

function review(project: string, outcome: string, basis: string | null, ageHours: number): FixtureReview {
  return { project, tier: 'full', outcome, basis, at: new Date(Date.now() - ageHours * 3600_000).toISOString() };
}

describe('gate-step-i (T-20261119-010 / DEC-20261120-03, design §8 tests a-g)', () => {
  test('(a) fresh same-HEAD pass → verdict pass + one gateChecks row, exit 0', () => {
    writeManifest([review('co-x', 'pass', SHA_A, 0.5)]);
    const res = runGate(['--project', 'co-x', '--basis', SHA_A]);
    expect(res.exit).toBe(0);
    const rows = readBack().gateChecks;
    expect(rows).toHaveLength(1);
    expect(rows[0].gate).toBe('STEP_I_PRE_REVIEW');
    expect(rows[0].project).toBe('co-x');
    expect(rows[0].verdict).toBe('pass');
    expect(rows[0].detail).toContain('basis matches');
  });

  test('(b) 2-night-old pass + same HEAD → pass (same HEAD stays fresh regardless of row age)', () => {
    writeManifest([review('co-x', 'pass', SHA_A, 47)]); // 2 nights minus an hour
    const res = runGate(['--project', 'co-x', '--basis', SHA_A]);
    expect(res.exit).toBe(0);
    expect(readBack().gateChecks[0].verdict).toBe('pass');
  });

  test('(b2) basis mismatch + row within window → pass (the DEC-03 ≤2-nights freshness arm)', () => {
    // The nightly baseline-only flow: the pass predates the current dry-run
    // basis but is young enough — freshness, not same-HEAD, admits it.
    writeManifest([review('co-x', 'pass', SHA_B, 20)]);
    const res = runGate(['--project', 'co-x', '--basis', SHA_C, '--window-days', '2']);
    expect(res.exit).toBe(0);
    const row = readBack().gateChecks[0];
    expect(row.verdict).toBe('pass');
    expect(row.detail).toContain('within window 2d');
  });

  test('(c) basis mismatch + 3-night-old row → fail, exit 1, runner-skip guidance on stderr', () => {
    writeManifest([review('co-x', 'pass', SHA_B, 72)]); // 3 nights
    const res = runGate(['--project', 'co-x', '--basis', SHA_C]);
    expect(res.exit).toBe(1);
    const row = readBack().gateChecks[0];
    expect(row.verdict).toBe('fail');
    expect(row.detail).toContain('stale');
    expect(res.stderr).toContain('1/1');
    expect(res.stderr).toContain('STEP_I');
  });

  test('(d) latest review outcome fail → fail even when the basis matches', () => {
    writeManifest([review('co-x', 'fail', SHA_A, 0.5)]);
    const res = runGate(['--project', 'co-x', '--basis', SHA_A]);
    expect(res.exit).toBe(1);
    const row = readBack().gateChecks[0];
    expect(row.verdict).toBe('fail');
    expect(row.detail).toContain("outcome 'fail' is not 'pass'");
  });

  test('(e) missing review row → fail (no ledger evidence, no admission)', () => {
    writeManifest([]);
    const res = runGate(['--project', 'co-x', '--basis', SHA_A]);
    expect(res.exit).toBe(1);
    const row = readBack().gateChecks[0];
    expect(row.verdict).toBe('fail');
    expect(row.detail).toContain('no projectReviews row');
  });

  test('(f) gateChecks[] schema-verified: present passes verify; absent fails with exit 2', () => {
    // after a gate run the manifest carries gateChecks[] → verify passes and
    // the summary line counts the rows
    writeManifest([review('co-x', 'pass', SHA_A, 0.5)]);
    expect(runGate(['--project', 'co-x', '--basis', SHA_A]).exit).toBe(0);
    const v = runVerify();
    expect(v.exit).toBe(0);
    expect(v.stdout).toContain('1 gate check(s)');
    // a pre-PR-3 manifest without the key now fails the schema verify (the
    // required-array contract is the AC-13-style falsifiability floor)
    writeManifest([], { withGateChecks: false });
    const v2 = runVerify();
    expect(v2.exit).toBe(2);
    expect(v2.stderr).toContain("missing required array 'gateChecks'");
  });

  test('(g) zero projects → exit 0 with one explicit not-applicable row (gate evaluated, nothing to admit)', () => {
    writeManifest([]);
    const res = runGate([]);
    expect(res.exit).toBe(0);
    const rows = readBack().gateChecks;
    expect(rows).toHaveLength(1);
    expect(rows[0].project).toBe('(none)');
    expect(rows[0].verdict).toBe('pass');
    expect(rows[0].detail).toContain('not-applicable');
    expect(readBack().projectReviews).toEqual([]);
  });
});
