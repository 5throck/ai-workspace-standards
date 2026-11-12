/**
 * Unit tests for the dev-sync step 3b CHANGELOG structural-duplicate gate
 * (v1.35.0, U-20261028-013 — spec
 * docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A4).
 *
 * Detection lives in scripts/helpers/changelog-duplicates.ts (pure, exported):
 * duplicate `### <Category>` headings within one release section, duplicate
 * `[Unreleased]` sections, and (v1.1.0, U-20261112-019) cross-layer duplicate
 * entries are blocking findings; clean files pass.
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import {
  changelogGateFindings,
  normalizeChangelogEntry,
} from '../../scripts/helpers/changelog-duplicates.ts';

const CLEAN = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- new thing',
  '',
  '### Fixed',
  '- fix thing',
  '',
  '## [1.0.0] - 2026-01-01',
  '',
  '### Added',
  '- old thing',
  '',
].join('\n');

describe('changelogGateFindings — duplicate category headings (A4, U-20261028-013)', () => {
  test('duplicate `### Added` in one section → duplicate-category finding naming the merge action', () => {
    const text = [
      '## [Unreleased]',
      '',
      '### Added',
      '- first entry',
      '',
      '### Fixed',
      '- a fix',
      '',
      '### Added',
      '- second entry, later',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('duplicate-category');
    expect(findings[0].section).toBe('## [Unreleased]');
    expect(findings[0].message).toContain('### Added');
    expect(findings[0].message).toContain('merge the duplicate');
    expect(findings[0].message).toContain('U-20261028-013');
  });

  test('distinct categories in one section → pass', () => {
    expect(changelogGateFindings(CLEAN)).toEqual([]);
  });

  test('historical release sections are scanned too (default: all `## [...]` sections)', () => {
    const text = [
      '## [0.9.0] - 2025-06-01',
      '',
      '### Fixed',
      '- old fix',
      '',
      '### Fixed',
      '- older fix',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('duplicate-category');
    expect(findings[0].section).toBe('## [0.9.0] - 2025-06-01');
  });

  test('same category in DIFFERENT sections is not a defect', () => {
    const text = [
      '## [Unreleased]',
      '',
      '### Added',
      '- new',
      '',
      '## [1.0.0] - 2026-01-01',
      '',
      '### Added',
      '- old',
      '',
    ].join('\n');
    expect(changelogGateFindings(text)).toEqual([]);
  });

  test('three duplicate blocks count once per category (one finding, count=3)', () => {
    const text = [
      '## [Unreleased]',
      '',
      '### Changed',
      '- a',
      '',
      '### Changed',
      '- b',
      '',
      '### Changed',
      '- c',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].message).toContain('(3 blocks)');
  });
});

describe('changelogGateFindings — duplicate [Unreleased] sections (A4, live co-work case)', () => {
  test('`## [Unreleased] 2026-09-01` + `## [Unreleased]` → duplicate-unreleased finding', () => {
    // Observed live in Projects/co-work: a dated [Unreleased] snapshot above a
    // fresh [Unreleased] — prefix match, so both count as the same section.
    const text = [
      '## [Unreleased] 2026-09-01',
      '',
      '- stale entry',
      '',
      '## [Unreleased]',
      '',
      '- current entry',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('duplicate-unreleased');
    expect(findings[0].message).toContain('2 [Unreleased] sections');
    expect(findings[0].message).toContain('merge into one');
    expect(findings[0].message).toContain('U-20261028-013');
  });

  test('single [Unreleased] plus dated release headers → pass', () => {
    const text = [
      '## [Unreleased]',
      '',
      '- current',
      '',
      '## [1.2.0] - 2026-02-01',
      '',
      '- released',
      '',
    ].join('\n');
    expect(changelogGateFindings(text)).toEqual([]);
  });

  test('both defect classes in one file → two findings', () => {
    const text = [
      '## [Unreleased] 2026-09-01',
      '',
      '### Added',
      '- stale',
      '',
      '## [Unreleased]',
      '',
      '### Added',
      '- current',
      '',
      '### Added',
      '- current, later',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.kind).sort()).toEqual(['duplicate-category', 'duplicate-unreleased']);
  });
});

describe('changelogGateFindings — robustness', () => {
  test('CRLF line endings parse identically', () => {
    const crlfDup = '## [Unreleased]\r\n\r\n### Fixed\r\n- a\r\n\r\n### Fixed\r\n- b\r\n';
    const findings = changelogGateFindings(crlfDup);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('duplicate-category');
    expect(changelogGateFindings(CLEAN.replace(/\n/g, '\r\n'))).toEqual([]);
  });

  test('preamble before the first `## ` header is never scanned', () => {
    const text = '# Changelog\n\nAll notable changes.\n\n' + CLEAN;
    expect(changelogGateFindings(text)).toEqual([]);
  });

  test('empty body and header-only file pass', () => {
    expect(changelogGateFindings('')).toEqual([]);
    expect(changelogGateFindings('# Changelog\n')).toEqual([]);
  });
});

describe('changelogGateFindings — cross-layer duplicate entries (v1.1.0, U-20261112-019)', () => {
  test('same entry under ### Changed (with PR ref) and bare wave-log bullets → finding (live co-abap case)', () => {
    const text = [
      '## [Unreleased]',
      '',
      '### Changed',
      '- **[2026-10-28]**: retire the L0-only governance doc mirror + template delivery wave (DEC-20261028-05 phase 2). (#225)',
      '',
      '### Wave Log',
      '- **[2026-10-28]**: Retire the L0-only governance doc mirror + template delivery wave (DEC-20261028-05 phase 2).',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('cross-layer-duplicate-entry');
    expect(findings[0].section).toBe('## [Unreleased]');
    expect(findings[0].message).toContain('`Changed`');
    expect(findings[0].message).toContain('`Wave Log`');
    expect(findings[0].message).toContain('U-20261112-019');
    expect(findings[0].message).toContain('PR ref');
  });

  test('entry before any ### heading counts as a distinct layer position', () => {
    const text = [
      '## [Unreleased]',
      '',
      '- wave entry (DEC-1)',
      '',
      '### Changed',
      '- wave entry (DEC-1) (#9)',
      '',
    ].join('\n');
    const findings = changelogGateFindings(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe('cross-layer-duplicate-entry');
    expect(findings[0].message).toContain('before any `###` heading');
  });

  test('same-layer exact repeats are NOT findings (legacy released rollups repeat within one category)', () => {
    const text = [
      '## [2026-09-04]',
      '',
      '### Changed',
      '- docs: improve readme step 4 (tetris game)',
      '',
      '- docs: improve readme step 4 (tetris game)',
      '',
      '### Added',
      '- unrelated',
      '',
    ].join('\n');
    // Both copies sit under the SAME `### Changed` layer — no cross-layer span,
    // so the cross-layer gate stays quiet.
    expect(changelogGateFindings(text)).toEqual([]);
  });

  test('distinct entries never collide (clean file passes)', () => {
    expect(changelogGateFindings(CLEAN)).toEqual([]);
  });

  test('normalization strips PR refs, whitespace and case before comparing', () => {
    expect(normalizeChangelogEntry('Retire the  governance  mirror (#225)')).toBe(
      normalizeChangelogEntry('retire the governance mirror'),
    );
    expect(normalizeChangelogEntry('one thing')).not.toBe(normalizeChangelogEntry('two things'));
  });
});
