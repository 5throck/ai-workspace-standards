/**
 * Tests for propagate-to-templates.ts — isL2DriftEligible() policy and
 * collectDiffsL1L2() filter behavior.
 *
 * @version 1.0.0
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, test, expect, beforeAll } from 'bun:test';
import { isL2DriftEligible, collectDiffsL1L2 } from '../../scripts/propagate-to-templates.ts';

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
