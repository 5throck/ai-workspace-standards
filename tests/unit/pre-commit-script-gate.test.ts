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
 * @version 1.1.0
 *
 * v1.1.0 (2026-11-07, U-20261107-001): the non-merge one-sided state now
 * returns 'verify-staged-coverage' (per-script @version coverage against the
 * registry content the commit carries) instead of the unconditional
 * 'proxy-fail'. Adds the regression pin for the incident (HEAD row already at
 * the target version, zero SCRIPTS.md delta, staged script bump — old gate
 * failed with a no-op remedy) plus coverage-based describes for
 * extractFileVersionFromContent, parseScriptsMdRegistryVersions, and
 * evaluateStagedScriptCoverage.
 */
import { describe, test, expect } from 'bun:test';
import {
  evaluateScriptsMdGate,
  evaluateStagedScriptCoverage,
  extractFileVersionFromContent,
  MERGE_GATE_NOTICE,
  parseCheckAErrors,
  parseCheckAErrorsDetailed,
  parseScriptsMdRegistryVersions,
  runScriptsMdContentGate,
  ZERO_DELTA_GATE_NOTICE,
} from '../../scripts/helpers/pre-commit-script-gate.ts';
import type { LifecycleAuditRun } from '../../scripts/helpers/pre-commit-script-gate.ts';

/** Real AuditResult wire shape (lifecycle-sync-audit.ts --json). */
function auditJson(
  errors: Array<{ level: string; file: string; message: string; fixData?: unknown }>,
): string {
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
  test('one-sided merge: scripts staged, SCRIPTS.md unstaged, MERGE_HEAD present → merge-verify', () => {
    expect(
      evaluateScriptsMdGate({
        scriptsStagedCount: 1,
        scriptsMdStaged: false,
        mergeInProgress: true,
      }),
    ).toBe('merge-verify');
  });

  test("U-20261107-001: non-merge one-sided commit → verify-staged-coverage (was the unconditional 'proxy-fail' FAIL)", () => {
    // The old decision failed this state unconditionally, even when the
    // SCRIPTS.md delta was legitimately zero (row already at the target
    // version in HEAD) — a state its own remedy could not escape.
    expect(
      evaluateScriptsMdGate({
        scriptsStagedCount: 1,
        scriptsMdStaged: false,
        mergeInProgress: false,
      }),
    ).toBe('verify-staged-coverage');
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

describe('parseCheckAErrorsDetailed (check 6c extraction — T-20261027-010 dead-gate regression)', () => {
  test('REGRESSION: inconsistent rows under the REAL wire shape are extracted (the gate blocks)', () => {
    // Before T-20261027-010, check 6c read `parsed.results` — a key that never
    // exists on AuditResult — so this exact payload produced zero errors and
    // the version-mismatch gate never blocked anything.
    const raw = auditJson([
      {
        level: 'error',
        file: 'scripts/hooks/pre-commit.ts',
        message: 'Check A: scripts/hooks/pre-commit.ts @version 1.10.0 does not match SCRIPTS.md entry 1.11.0',
        fixData: { scriptName: 'pre-commit.ts', fileVersion: '1.10.0', registryVersion: '1.11.0' },
      },
    ]);
    const issues = parseCheckAErrorsDetailed(raw);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toBe('scripts/hooks/pre-commit.ts');
    expect(issues[0].message).toContain('does not match SCRIPTS.md entry 1.11.0');
    expect(issues[0].fixData).toEqual({
      scriptName: 'pre-commit.ts',
      fileVersion: '1.10.0',
      registryVersion: '1.11.0',
    });
  });

  test('THE OLD BUG: a payload carrying only the phantom `results` key yields no Check A findings from `errors`', () => {
    // Pins the root cause: anything 6c could have read from `results` is not
    // part of the wire shape — `errors` is the only source of Check A rows.
    const phantomShape = JSON.stringify({
      passed: false,
      results: [
        {
          level: 'error',
          file: 'scripts/hooks/pre-commit.ts',
          message: 'Check A: scripts/hooks/pre-commit.ts @version 1.10.0 does not match SCRIPTS.md entry 1.11.0',
        },
      ],
      warnings: [],
      registry: [],
    });
    expect(parseCheckAErrorsDetailed(phantomShape)).toEqual([]);
  });

  test('fixData with an unexpected shape degrades to undefined (message-only output)', () => {
    const raw = auditJson([
      {
        level: 'error',
        file: 'scripts/x.ts',
        message: 'Check A: scripts/x.ts @version 1.0.0 does not match SCRIPTS.md entry 2.0.0',
        fixData: { scriptName: 42 },
      },
    ]);
    const issues = parseCheckAErrorsDetailed(raw);
    expect(issues).toHaveLength(1);
    expect(issues[0].fixData).toBeUndefined();
  });

  test('parseCheckAErrors delegates to the detailed extractor (one extraction, two shapes)', () => {
    const raw = auditJson([
      {
        level: 'error',
        file: 'scripts/x.ts',
        message: 'Check A: scripts/x.ts @version 1.0.0 does not match SCRIPTS.md entry 2.0.0',
        fixData: { scriptName: 'x.ts', fileVersion: '1.0.0', registryVersion: '2.0.0' },
      },
    ]);
    expect(parseCheckAErrors(raw)).toEqual([
      {
        file: 'scripts/x.ts',
        message: 'Check A: scripts/x.ts @version 1.0.0 does not match SCRIPTS.md entry 2.0.0',
      },
    ]);
  });

  test('unparseable output throws (6c warns and skips; the merge gate fails closed)', () => {
    expect(() => parseCheckAErrorsDetailed('not json')).toThrow();
  });
});

describe('MERGE_GATE_NOTICE', () => {
  test('is the observable one-line exemption notice', () => {
    expect(MERGE_GATE_NOTICE).toBe(
      'check 6: merge in progress — verified via lifecycle Check A content comparison',
    );
  });
});

describe('extractFileVersionFromContent (U-20261107-001)', () => {
  test('extracts the @version from a script header', () => {
    expect(extractFileVersionFromContent('// @version 1.91.1\n// something else')).toBe('1.91.1');
  });

  test('extracts the LAST @version occurrence (JSDoc block header convention)', () => {
    // lifecycle-sync-audit's extractFileVersion uses the same bare
    // /@version\s+([\d.]+)/ match semantics; first-match wins there too.
    expect(extractFileVersionFromContent('* @version 1.2.0\n * later @version 9.9.9 mention')).toBe(
      '1.2.0',
    );
  });

  test('returns null when no @version header exists', () => {
    expect(extractFileVersionFromContent('export const x = 1;')).toBeNull();
  });
});

describe('parseScriptsMdRegistryVersions (U-20261107-001)', () => {
  const registryMd = `# Script Registry

## Registry

| script | source | version | status | notes | layer |
|--------|--------|---------|--------|-------|-------|
| \`helpers/pre-commit-script-gate.ts\` | L0 | 1.2.0 | active | gate | — |
| \`hooks/pre-commit.ts\` | L0 | 1.13.0 | active | hook | — |
| \`hooks/other.ts\` | L0 | 2.0.0 | deprecated | old | — |

## Other Section
`;

  test('parses filename → version rows including non-active statuses', () => {
    const rows = parseScriptsMdRegistryVersions(registryMd);
    expect(rows.get('helpers/pre-commit-script-gate.ts')).toBe('1.2.0');
    expect(rows.get('hooks/pre-commit.ts')).toBe('1.13.0');
    // Coverage accepts any row status — a deprecated-but-bumped script with a
    // correct row is covered; lifecycle stage is not this gate's invariant.
    expect(rows.get('hooks/other.ts')).toBe('2.0.0');
  });

  test('handles a version column not at the default index (header-name detection)', () => {
    const reordered = `## Registry\n| script | version | source | status |\n|--------|---------|--------|--------|\n| \`x.ts\` | 3.1.4 | L0 | active |\n`;
    expect(parseScriptsMdRegistryVersions(reordered).get('x.ts')).toBe('3.1.4');
  });

  test('returns an empty map for content without a Registry section', () => {
    expect(parseScriptsMdRegistryVersions('# no registry here').size).toBe(0);
  });
});

describe('evaluateStagedScriptCoverage (U-20261107-001 zero-delta coverage invariant)', () => {
  const HEAD_REGISTRY = `## Registry\n| script | version | source | status |\n|--------|---------|--------|--------|\n| \`hooks/pre-commit.ts\` | 1.13.0 | L0 | active |\n| \`helpers/pre-commit-script-gate.ts\` | 1.2.0 | L0 | active |\n`;

  test('THE U-20261107-001 REGRESSION: staged script bump whose row ALREADY exists in HEAD at the target version → covered (old gate: unconditional proxy FAIL)', () => {
    // Incident state: the SCRIPTS.md row for upgrade-project.ts was swept
    // into an earlier pipeline commit at 1.91.1 while the script's @version
    // bump 1.91.0 → 1.91.1 was still unlanded; staging the script with zero
    // SCRIPTS.md delta made the old proxy FAIL inescapably.
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/upgrade-project.ts'],
      scriptsMdContent: '## Registry\n| script | version | source | status |\n|---|---|---|---|\n| `upgrade-project.ts` | 1.91.1 | L0 | active |\n',
      scriptVersions: { 'scripts/upgrade-project.ts': '1.91.1' },
    });
    expect(result.allCovered).toBe(true);
    expect(result.covered).toEqual(['scripts/upgrade-project.ts']);
    expect(result.uncovered).toEqual([]);
  });

  test('script staged with its SCRIPTS.md row bumped in the same commit (staged registry content) → covered', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/hooks/pre-commit.ts'],
      scriptsMdContent: HEAD_REGISTRY,
      scriptVersions: { 'scripts/hooks/pre-commit.ts': '1.13.0' },
    });
    expect(result.allCovered).toBe(true);
  });

  test('version mismatch (row exists at a different version) → uncovered with reason', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/hooks/pre-commit.ts'],
      scriptsMdContent: HEAD_REGISTRY,
      scriptVersions: { 'scripts/hooks/pre-commit.ts': '1.14.0' },
    });
    expect(result.allCovered).toBe(false);
    expect(result.uncovered).toEqual([
      {
        script: 'scripts/hooks/pre-commit.ts',
        fileVersion: '1.14.0',
        registryVersion: '1.13.0',
        covered: false,
        reason: 'version-mismatch',
      },
    ]);
  });

  test('unregistered new script (no row) → uncovered — registration invariant preserved (Check A cannot see it)', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/new-thing.ts'],
      scriptsMdContent: HEAD_REGISTRY,
      scriptVersions: { 'scripts/new-thing.ts': '1.0.0' },
    });
    expect(result.allCovered).toBe(false);
    expect(result.uncovered[0].reason).toBe('no-registry-row');
  });

  test('script without an @version header → uncovered (fail-closed)', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/hooks/pre-commit.ts'],
      scriptsMdContent: HEAD_REGISTRY,
      scriptVersions: { 'scripts/hooks/pre-commit.ts': null },
    });
    expect(result.allCovered).toBe(false);
    expect(result.uncovered[0].reason).toBe('no-version-header');
  });

  test('SCRIPTS.md absent from the compared source (null content) → everything uncovered', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/hooks/pre-commit.ts'],
      scriptsMdContent: null,
      scriptVersions: { 'scripts/hooks/pre-commit.ts': '1.13.0' },
    });
    expect(result.allCovered).toBe(false);
    expect(result.uncovered[0].reason).toBe('no-registry-row');
  });

  test('mixed batch: covered and uncovered scripts are reported separately', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/hooks/pre-commit.ts', 'scripts/hooks/unregistered.ts'],
      scriptsMdContent: HEAD_REGISTRY,
      scriptVersions: { 'scripts/hooks/pre-commit.ts': '1.13.0', 'scripts/hooks/unregistered.ts': '1.0.0' },
    });
    expect(result.covered).toEqual(['scripts/hooks/pre-commit.ts']);
    expect(result.uncovered).toHaveLength(1);
    expect(result.uncovered[0].script).toBe('scripts/hooks/unregistered.ts');
  });

  test('registry keys are SCRIPTS.md-relative (scripts/ prefix stripped before lookup)', () => {
    const result = evaluateStagedScriptCoverage({
      stagedScripts: ['scripts/helpers/nested/dir.ts'],
      scriptsMdContent: '## Registry\n| script | version | source | status |\n|---|---|---|---|\n| `helpers/nested/dir.ts` | 2.5.0 | L0 | active |\n',
      scriptVersions: { 'scripts/helpers/nested/dir.ts': '2.5.0' },
    });
    expect(result.allCovered).toBe(true);
  });
});

describe('ZERO_DELTA_GATE_NOTICE', () => {
  test('is the observable one-line pass notice for the zero-delta path', () => {
    expect(ZERO_DELTA_GATE_NOTICE).toBe(
      'check 6: SCRIPTS.md zero delta — staged script @versions verified against HEAD registry rows',
    );
  });
});
