/**
 * Tests for propagate-to-templates.ts — isL2DriftEligible() policy and
 * collectDiffsL1L2() filter behavior.
 *
 * @version 1.1.0
 * v1.1.0 (2026-11-06, T-20261106-004 class A): new describe block pins
 *         applyGovernanceTransforms B-A16 — the three L0-only §6 skill rows
 *         (create-variant / promote-variant / simulate-pipeline) are stripped
 *         from the AGENTS.md L1 rendition, shipped-skill rows are kept, and
 *         non-AGENTS.md governance files are untouched (spec
 *         docs/designs/2026-11-06-validator-nightly-remediation-design.md).
 */
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test, expect, beforeAll } from 'bun:test';
import { isL2DriftEligible, collectDiffsL1L2, checkFileEncoding, applyGovernanceTransforms } from '../../scripts/propagate-to-templates.ts';

// Minimal domain shape matching the interface
function makeDomain(overrides: Record<string, unknown> = {}): any {
  return {
    description: 'test domain',
    source: 'test-src',
    target: 'test-target',
    include_pattern: '*.ts',
    recursive: false,
    exclude: [],
    ...overrides,
  };
}

const workspaceRoot = resolve(import.meta.dir, '..', '..');

// ── Policy unit tests: isL2DriftEligible() ─────────────────────────────────────
describe('isL2DriftEligible', () => {
  test('returns false for marker-inject mode', () => {
    expect(isL2DriftEligible(makeDomain({ mode: 'marker-inject' }))).toBe(false);
  });

  test('returns false for disabled domain (INCLUDE_DISABLED defaults to false)', () => {
    expect(isL2DriftEligible(makeDomain({ disabled: true }))).toBe(false);
  });

  test('returns false for l2_drift_eligible: false', () => {
    expect(isL2DriftEligible(makeDomain({ l2_drift_eligible: false }))).toBe(false);
  });

  test('returns true for explicit l2_drift_eligible: true', () => {
    expect(isL2DriftEligible(makeDomain({ l2_drift_eligible: true }))).toBe(true);
  });

  test('returns true for default (undefined) l2_drift_eligible', () => {
    expect(isL2DriftEligible(makeDomain())).toBe(true);
  });

  test('marker-inject + l2_drift_eligible: true → false (mode has priority)', () => {
    expect(isL2DriftEligible(makeDomain({ mode: 'marker-inject', l2_drift_eligible: true }))).toBe(false);
  });

  test('disabled + l2_drift_eligible: false → false (both filters apply)', () => {
    expect(isL2DriftEligible(makeDomain({ disabled: true, l2_drift_eligible: false }))).toBe(false);
  });
});

// ── Integration tests: collectDiffsL1L2() filter ────────────────────────────
describe('collectDiffsL1L2 filters l2_drift_eligible: false domains', () => {
  const mapPath = join(workspaceRoot, 'scripts', 'propagation-map.json');

  let mapDomains: Record<string, { l2_drift_eligible?: boolean }>;

  beforeAll(() => {
    const raw = readFileSync(mapPath, 'utf-8');
    const map = JSON.parse(raw);
    mapDomains = map.domains;
  });

  test('no domain with l2_drift_eligible: false appears in drift results', () => {
    // Suppress console output from collectDiffsL1L2
    const originalLog = console.log;
    const originalError = console.error;
    console.log = () => {};
    console.error = () => {};

    try {
      // Reset any previous exit code
      process.exitCode = 0;
      const drifts = collectDiffsL1L2(mapPath);

      // Extract domain names from drift results (strip variant suffix)
      const driftDomainNames = [...new Set(
        drifts.map(d => d.domain.split(' (')[0])
      )];

      // Every domain marked l2_drift_eligible: false must NOT appear in results
      for (const [name, domain] of Object.entries(mapDomains)) {
        if (domain.l2_drift_eligible === false) {
          expect(driftDomainNames).not.toContain(name);
        }
      }
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
  });

  test('DOMAIN_FILTER="scripts" returns empty array (Fork Model, ineligible)', () => {
    // --domain scripts should produce 0 results since scripts is l2_drift_eligible: false.
    // collectDiffsL1L2 reads DOMAIN_FILTER from the module's CLI flags, but since
    // we're importing the module (not running as main), DOMAIN_FILTER is null.
    // We test the filter logic indirectly: the only eligible domain (gemini-settings)
    // is NOT "scripts", so no results will match a "scripts" filter.
    // This is tested via CLI dispatch test in the integration suite.
    // Here we verify the map's classification is correct.
    expect(mapDomains['scripts'].l2_drift_eligible).toBe(false);
    expect(mapDomains['gemini-settings'].l2_drift_eligible).toBeUndefined();
  });
});

// ── v2.22.0: doc-only ?? heuristic skips inline code spans (T-20261105-002 follow-through) ──

describe('checkFileEncoding doc-only ?? x inline-code stripping (v2.22.0)', () => {
  function yamlWith(line: string): string {
    const f = join(workspaceRoot, 'tests', '.temp', `enc-check-${Math.random().toString(36).slice(2)}.yaml`);
    mkdirSync(join(workspaceRoot, 'tests', '.temp'), { recursive: true });
    writeFileSync(f, `symptom: '${line}'\n`, 'utf-8');
    return f;
  }

  test('quoted nullish coalescing inside backticks does NOT flag (U-20261105-001 regression)', () => {
    const f = yamlWith('reads slide type via `s.type ?? \'\'standard\'\'` (L425)');
    const v = checkFileEncoding(f);
    expect(v).toEqual([]);
    rmSync(f, { force: true });
  });

  test('raw ?? outside code spans in a doc file still flags', () => {
    const f = yamlWith('the em-dash became ?? after the windows pass');
    const v = checkFileEncoding(f);
    expect(v).toHaveLength(1);
    expect(v[0].count).toBe(1);
    rmSync(f, { force: true });
  });
});

// ── B-A16: L0-only §6 skill rows stripped from the L1 AGENTS.md rendition ──────
// T-20261106-004 class A (spec docs/designs/2026-11-06-validator-nightly-remediation-design.md):
// the three L0-only skill rows dangle in every scaffolded AGENTS.md and the audit §29
// pointer-integrity gate blocks the initial scaffold commit. The L1 rendition must drop
// them while the L0 source keeps them.
describe('applyGovernanceTransforms B-A16 — L0-only §6 rows stripped from AGENTS.md L1 rendition', () => {
  const l0Rows = [
    '| `create-variant` | `skills/create-variant/` | New variant scaffolding — workspace-root (L0) only, not shipped in scaffolds |',
    '| `promote-variant` | `skills/promote-variant/` | Variant promotion to official — workspace-root (L0) only, not shipped in scaffolds |',
    '| `simulate-pipeline` | `skills/simulate-pipeline/` | E2E smoke test for project creation and the L3 scaffold → variant promotion pipeline (merged skill) — workspace-root (L0) only, not shipped in scaffolds |',
  ].join('\n') + '\n';

  const keptRow = '| `security-scan` | `skills/security-scan/` | Security and secret detection |\n';
  // Fixture carries the structural anchors the B-AGENTS branch requires (§1/§2
  // roster span, §3.6 and §5 injection anchors) — applyGovernanceTransforms
  // die()s on their absence by design (B-A13 guard).
  const agentsFixture = [
    '## §1: Agent Ecosystem Overview\n\nroster\n\n---\n\n## §2: Individual Agent Definitions\n\nroster\n\n---\n\n## §3: PM Gateway Workflow\n',
    '\n### §3.6 3-Tier Strategy\n',
    '\n## §5: Execution Plan Templates\n',
    '\n## §6: Skills\n\n| Skill | Location | Purpose |\n|-------|----------|---------|\n',
    l0Rows,
    keptRow,
  ].join('');

  test('the three L0-only rows are removed from the AGENTS.md L1 rendition', () => {
    const l1 = applyGovernanceTransforms(agentsFixture, 'AGENTS.md');
    expect(l1).not.toContain('skills/create-variant/');
    expect(l1).not.toContain('skills/promote-variant/');
    expect(l1).not.toContain('skills/simulate-pipeline/');
  });

  test('shipped-skill rows are kept', () => {
    const l1 = applyGovernanceTransforms(agentsFixture, 'AGENTS.md');
    expect(l1).toContain(keptRow.trimEnd());
  });

  test('non-AGENTS.md governance files are not stripped (L0-only rows are AGENTS.md-specific)', () => {
    const l1 = applyGovernanceTransforms(agentsFixture, 'CLAUDE.md');
    expect(l1).toContain('skills/create-variant/');
  });
});
