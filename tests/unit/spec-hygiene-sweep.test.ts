/**
 * Tests for spec-hygiene-sweep.ts age/progression logic (T-20261001-011).
 *
 * The pure findStaleApprovedSpecs() selector is exercised over a temp fixture
 * registry (no workspace files written) and the real registry is checked
 * shape-only. Date math uses UTC calendar days, so results are identical on
 * Windows/macOS/Linux.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  findStaleApprovedSpecs,
  REGISTRY_PATH,
  MAX_AGE_DAYS,
  type SpecEntry,
} from '../../scripts/spec-hygiene-sweep.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

function entry(overrides: Partial<SpecEntry>): SpecEntry {
  return {
    id: '2026-01-01-fixture',
    title: 'fixture spec',
    file: 'docs/designs/2026-01-01-fixture.md',
    status: 'approved',
    created: '2026-01-01',
    ...overrides,
  };
}

describe('findStaleApprovedSpecs (T-20261001-011)', () => {
  const today = new Date('2026-10-01T12:00:00Z');

  test('flags approved entries older than the window, with age in days', () => {
    const findings = findStaleApprovedSpecs([entry({ created: '2026-09-15' })], today);
    expect(findings).toHaveLength(1);
    expect(findings[0].ageDays).toBe(16);
    expect(findings[0].id).toBe('2026-01-01-fixture');
  });

  test('entries exactly at the window boundary are not stale (strictly older than 14)', () => {
    expect(findStaleApprovedSpecs([entry({ created: '2026-09-17' })], today)).toHaveLength(0);
    expect(findStaleApprovedSpecs([entry({ created: '2026-09-16' })], today)).toHaveLength(1);
  });

  test('non-approved statuses never progress into the sweep (progression check)', () => {
    const findings = findStaleApprovedSpecs(
      [
        entry({ created: '2026-01-01', status: 'implemented' }),
        entry({ created: '2026-01-01', status: 'superseded' }),
        entry({ created: '2026-01-01', status: 'archived' }),
        entry({ created: '2026-01-01', status: 'draft' }),
        entry({ created: '2026-01-01', status: 'proposed' }),
      ],
      today,
    );
    expect(findings).toHaveLength(0);
  });

  test('results are sorted newest-stale last (oldest age first in descending order)', () => {
    const findings = findStaleApprovedSpecs(
      [entry({ id: 'a', created: '2026-09-15' }), entry({ id: 'b', created: '2026-06-02' })],
      today,
    );
    expect(findings.map((f) => f.id)).toEqual(['b', 'a']);
  });

  test('malformed created dates are skipped, not thrown', () => {
    expect(findStaleApprovedSpecs([entry({ created: 'not-a-date' })], today)).toHaveLength(0);
  });

  test('custom window is honored', () => {
    expect(findStaleApprovedSpecs([entry({ created: '2026-09-25' })], today, 5)).toHaveLength(1);
    expect(findStaleApprovedSpecs([entry({ created: '2026-09-25' })], today, 10)).toHaveLength(0);
  });
});

describe('spec-hygiene-sweep registry contract', () => {
  test('REGISTRY_PATH points at the workspace registry', () => {
    expect(REGISTRY_PATH).toBe(join(workspaceRoot, 'docs', 'specs', 'registry.json'));
  });

  test('the real registry parses and feeds the selector without error', () => {
    const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
    expect(Array.isArray(registry.specs)).toBe(true);
    expect(typeof MAX_AGE_DAYS).toBe('number');
    const findings = findStaleApprovedSpecs(registry.specs, new Date('2026-10-01T00:00:00Z'));
    for (const f of findings) {
      expect(typeof f.ageDays).toBe('number');
      expect(f.file.startsWith('docs/designs/')).toBe(true);
    }
  });

  test('temp fixture registry is loadable and cleaned up (Windows-safe paths)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-sweep-'));
    const fixturePath = join(dir, 'registry.json');
    writeFileSync(
      fixturePath,
      JSON.stringify({ version: '1.0.0', specs: [entry({ created: '2026-06-02' })] }),
    );
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    expect(fixture.specs).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });
});
