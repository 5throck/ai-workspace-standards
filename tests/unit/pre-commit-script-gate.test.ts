/**
 * Tests for scripts/helpers/pre-commit-script-gate.ts — the merge-aware
 * SCRIPTS.md gate behind pre-commit check 6 (T-20261027-009).
 *
 * Check 6's staged-file-set proxy ("scripts/*.ts staged AND SCRIPTS.md not
 * staged → FAIL") false-positives on merge commits where the merged-in side
 * carries script changes whose SCRIPTS.md rows pre-exist on the receiving
 * branch (zero delta) — observed 2026-10-27 concluding main→PR #1643 after
 * #1644 landed while content-based lifecycle-sync-audit Check A passed.
 *
 * pre-commit.ts itself runs main() at import and is not import-safe, so tests
 * target this module directly (same pattern as merge-state.test.ts for
 * dev-sync). The one-sided-merge fixture shapes below mirror the incident:
 * scripts staged, SCRIPTS.md unstaged, merge in progress.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  evaluateScriptsMdGate,
  MERGE_GATE_NOTICE,
  parseCheckAErrors,
  runScriptsMdContentGate,
} from '../../scripts/helpers/pre-commit-script-gate.ts';
import type { LifecycleAuditRun } from '../../scripts/helpers/pre-commit-script-gate.ts';

/** Real AuditResult wire shape (lifecycle-sync-audit.ts --json). */
function auditJson(errors: Array<{ level: string; file: string; message: string }>): string {
  return JSON.stringify({
    checksRun: ['A', 'B', 'C', 'E', 'F', 'G', 'H'],
    errors,
    warnings: [],
    registry: [],
    passed: errors.length === 0,
  });
}

function runOf(exitCode: number, stdout: string): () => Promise<LifecycleAuditRun> {
  return async () => ({ exitCode, stdout });
}

describe('evaluateScriptsMdGate (check 6 decision)', () => {
  test('one-sided merge: scripts staged, SCRIPTS.md unstaged, MERGE_HEAD present → merge-verify (not proxy-fail)', () => {
    expect(
      evaluateScriptsMdGate({
        scriptsStagedCount: 1,
        scriptsMdStaged: false,
        mergeInProgress: true,
      }),
    ).toBe('merge-verify');
  });

  test('non-merge one-sided commit keeps today\'s proxy-fail behavior', () => {
    expect(
      evaluateScriptsMdGate({
        scriptsStagedCount: 1,
        scriptsMdStaged: false,
        mergeInProgress: false,
      }),
    ).toBe('proxy-fail');
  });

  test('SCRIPTS.md staged → pass regardless of merge state', () => {
    expect(
      evaluateScriptsMdGate({ scriptsStagedCount: 2, scriptsMdStaged: true, mergeInProgress: false }),
    ).toBe('pass');
    expect(
      evaluateScriptsMdGate({ scriptsStagedCount: 2, scriptsMdStaged: true, mergeInProgress: true }),
    ).toBe('pass');
  });

  test('no scripts staged → pass (gate never arms)', () => {
    expect(
      evaluateScriptsMdGate({ scriptsStagedCount: 0, scriptsMdStaged: false, mergeInProgress: false }),
    ).toBe('pass');
    expect(
      evaluateScriptsMdGate({ scriptsStagedCount: 0, scriptsMdStaged: false, mergeInProgress: true }),
    ).toBe('pass');
  });
});

describe('parseCheckAErrors (real AuditResult wire shape)', () => {
  test('extracts Check A errors from the errors field', () => {
    const raw = auditJson([
      {
        level: 'error',
        file: 'scripts/hooks/pre-commit.ts',
        message: 'Check A: scripts/hooks/pre-commit.ts @version 1.9.0 does not match SCRIPTS.md entry 1.10.0',
      },
    ]);
    expect(parseCheckAErrors(raw)).toEqual([
      {
        file: 'scripts/hooks/pre-commit.ts',
        message: 'Check A: scripts/hooks/pre-commit.ts @version 1.9.0 does not match SCRIPTS.md entry 1.10.0',
      },
    ]);
  });

  test('non-Check-A errors are not surfaced as Check A findings', () => {
    const raw = auditJson([
      { level: 'error', file: 'scripts/x.ts', message: 'Check H: record Version drift' },
      { level: 'warning', file: 'scripts/y.ts', message: 'Check A: @version header missing in y.ts' },
    ]);
    expect(parseCheckAErrors(raw)).toEqual([]);
  });

  test('missing/empty errors field yields an empty list', () => {
    expect(parseCheckAErrors(JSON.stringify({ passed: true, warnings: [], registry: [] }))).toEqual([]);
    expect(parseCheckAErrors(auditJson([]))).toEqual([]);
  });

  test('unparseable output throws (caller decides fail-closed)', () => {
    expect(() => parseCheckAErrors('not json at all')).toThrow();
  });
});

describe('runScriptsMdContentGate (merge-path content invariant)', () => {
  test('rows consistent under MERGE_HEAD (audit exit 0) → PASS', async () => {
    const result = await runScriptsMdContentGate(runOf(0, auditJson([])));
    expect(result.pass).toBe(true);
    expect(result.checkAErrors).toEqual([]);
  });

  test('rows INCONSISTENT under MERGE_HEAD (audit exit 1 + Check A error) → FAIL with the offending row surfaced', async () => {
    const raw = auditJson([
      {
        level: 'error',
        file: 'scripts/hooks/sim-fixture.ts',
        message: 'Check A: scripts/hooks/sim-fixture.ts @version 1.1.0 does not match SCRIPTS.md entry 1.0.0',
      },
    ]);
    const result = await runScriptsMdContentGate(runOf(1, raw));
    expect(result.pass).toBe(false);
    expect(result.checkAErrors).toHaveLength(1);
    expect(result.checkAErrors[0].message).toContain('does not match SCRIPTS.md entry 1.0.0');
  });

  test('audit exit 1 with unparseable output still FAILS (fail-closed)', async () => {
    const result = await runScriptsMdContentGate(runOf(1, 'bun: command blew up'));
    expect(result.pass).toBe(false);
    expect(result.checkAErrors).toEqual([]);
  });

  test('audit failure via thrown runner propagates (harness bug, not a gate verdict)', async () => {
    await expect(
      runScriptsMdContentGate(async () => {
        throw new Error('spawn failed');
      }),
    ).rejects.toThrow('spawn failed');
  });
});

describe('MERGE_GATE_NOTICE', () => {
  test('is the observable one-line exemption notice', () => {
    expect(MERGE_GATE_NOTICE).toBe(
      'check 6: merge in progress — verified via lifecycle Check A content comparison',
    );
  });
});
