/**
 * Unit tests for scripts/changelog-normalize.ts (T-20261031-003 — spec
 * docs/designs/2026-10-31-changelog-normalize-design.md §7).
 *
 * Test plan (design §7, all against the pure normalizeChangelog core the
 * dev-sync step 3b fail-then-heal loop and the CLI wrapper share):
 *  1. fixture per observed failure class — (a) duplicate category blocks,
 *     (b) multiple [Unreleased] sections including dated variants, (c) the
 *     multi-heading legacy shape combining both (co-deck/co-newbiz 6-hit/3-hit class);
 *  2. idempotency — normalize(normalize(x)) == normalize(x) for every fixture;
 *  3. content preservation — entry lines byte-identical (multiset), frontmatter
 *     (`lang: ko` / `lang_reason: legal`) and preamble byte-identical, delta
 *     touches heading and blank lines only;
 *  4. golden before/after — anonymized Projects/co-news legacy shape (dated
 *     [Unreleased] variant + bare-entry second section + empty category blocks),
 *     both strings pinned;
 *  5. no-findings no-op — clean files pass through byte-identical;
 *  6. detector-healer agreement — changelogGateFindings reports findings before
 *     and zero findings after (the same assertion dev-sync step 3b makes at runtime).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { normalizeChangelog } from '../../scripts/changelog-normalize.ts';
import { changelogGateFindings } from '../../scripts/helpers/changelog-duplicates.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Entry/content lines: neither blank nor `## `/`### ` heading lines. */
function entryLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !/^##\s/.test(l) && !/^###\s/.test(l));
}

/** Lines before the first `## ` release-section header (frontmatter + preamble). */
function preambleOf(text: string): string {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((l) => /^##\s+\S/.test(l));
  const upTo = first === -1 ? lines.length : first;
  return lines.slice(0, upTo).join('\n');
}

/** Multiset delta between two line lists (added = in `after` only, removed = in `before` only). */
function multisetDelta(before: string[], after: string[]): { added: string[]; removed: string[] } {
  const counts = new Map<string, number>();
  for (const l of before) counts.set(l, (counts.get(l) ?? 0) + 1);
  for (const l of after) counts.set(l, (counts.get(l) ?? 0) - 1);
  const added: string[] = [];
  const removed: string[] = [];
  for (const [line, n] of counts) {
    for (let k = 0; k < Math.abs(n); k++) (n > 0 ? removed : added).push(line);
  }
  return { added, removed };
}

/** The §7.3 content-preservation assertions, applied to one before/after pair. */
function expectContentPreserved(before: string, after: string): void {
  // Entry lines byte-identical as a multiset.
  expect([...entryLines(after)].sort()).toEqual([...entryLines(before)].sort());
  // Frontmatter + preamble byte-identical.
  expect(preambleOf(after)).toBe(preambleOf(before));
  // The whole-line delta touches heading and blank lines only.
  const delta = multisetDelta(before.split('\n'), after.split('\n'));
  for (const line of [...delta.added, ...delta.removed]) {
    const isStructural = line.trim() === '' || /^##\s/.test(line) || /^###\s/.test(line);
    expect(isStructural).toBe(true);
  }
}

/** The §7.6 detector-healer agreement assertion (same check dev-sync step 3b makes). */
function expectDetectorAgreement(before: string): string {
  expect(changelogGateFindings(before).length).toBeGreaterThan(0);
  const { text: after } = normalizeChangelog(before);
  expect(changelogGateFindings(after)).toEqual([]);
  return after;
}

// ─────────────────────────────────────────────────────────────────────────────
// §7.1 Fixtures — one per observed failure class
// ─────────────────────────────────────────────────────────────────────────────

// (a) duplicate category blocks within one section.
const FIX_DUP_CATEGORY = [
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

// (b) multiple [Unreleased] sections including a dated variant (detector: same
// logical section — the live co-work class).
const FIX_MULTI_UNRELEASED = [
  '## [Unreleased] 2026-09-01',
  '',
  '- stale entry',
  '',
  '## [Unreleased]',
  '',
  '- current entry',
  '',
].join('\n');

// (c) multi-heading legacy shape combining both classes (co-deck/co-newbiz
// 6-hit/3-hit class): dated variant above a fresh [Unreleased], duplicate
// category blocks across BOTH unreleased sections, released section after.
const FIX_COMBINED = [
  '## [Unreleased] 2026-09-01',
  '',
  '### Added',
  '- stale add',
  '',
  '### Added',
  '- stale add 2',
  '',
  '## [Unreleased]',
  '',
  '- current entry',
  '',
  '### Fixed',
  '- current fix',
  '',
  '### Fixed',
  '- current fix 2',
  '',
  '## [1.0.0] - 2026-01-01',
  '',
  '### Added',
  '- old thing',
  '',
].join('\n');

// Korean legal-exception frontmatter fixture (the `lang:` / `lang_reason:`
// byte-identity surface) — duplicate categories under an unreleased section.
const FIX_FRONTMATTER = [
  '---',
  'lang: ko',
  'lang_reason: legal',
  '---',
  '',
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Fixed',
  '- 한글 항목: 문서 가이드 수정',
  '',
  '### Changed',
  '### Fixed',
  '- 또 다른 한글 항목: 빌드 스크립트 정리',
  '',
].join('\n');

// Historical released section carries the duplicate categories (the gate scans
// ALL `## [...]` sections — the healer must too).
const FIX_RELEASED_DUP = [
  '## [Unreleased]',
  '',
  '- current',
  '',
  '## [0.9.0] - 2025-06-01',
  '',
  '### Fixed',
  '- old fix',
  '',
  '### Fixed',
  '- older fix',
  '',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// §7.4 Golden — anonymized Projects/co-news legacy shape (dated [Unreleased]
// variant above a bare-entry fresh [Unreleased]; empty `### Changed` / `### Removed`
// blocks; Korean legal entries). Both strings pinned.
// ─────────────────────────────────────────────────────────────────────────────

const GOLDEN_BEFORE = [
  '# Changelog',
  '',
  '모든 주요 변경사항이 이 문서에 기록됩니다.',
  '',
  '## [Unreleased] 2026-09-01',
  '',
  '- **[2026-10-07]**: docs: 설계 프로세스 파이프라인 문서 추가 (principles→tokens→style guide→components)',
  '- **[2026-10-07]**: docs/_templates: design-review-checklist-template.md 추가',
  '- **[2026-10-07]**: skills: k-dart 2.0.0 → 2.1.0 — 회사 정보 교차 검증 체인 추가',
  '',
  '## [Unreleased]',
  '- **[2026-10-28]**: chore(upgrade): 거버넌스 문서 미러 정리 및 템플릿 전달 웨이브.',
  '',
  '### Added',
  '- **[2026-10-07]**: k-kosis 스킬 추가 (한국통계진흥원 KOSIS OpenAPI)',
  '',
  '### Changed',
  '### Fixed',
  '- **[2026-10-07]**: agents/pm.md 라이프사이클 프론트매터 블록 제거 (L0 전용 필드)',
  '',
  '### Removed',
  '',
].join('\n');

const GOLDEN_AFTER = [
  '# Changelog',
  '',
  '모든 주요 변경사항이 이 문서에 기록됩니다.',
  '',
  '## [Unreleased]',
  '',
  '- **[2026-10-07]**: docs: 설계 프로세스 파이프라인 문서 추가 (principles→tokens→style guide→components)',
  '- **[2026-10-07]**: docs/_templates: design-review-checklist-template.md 추가',
  '- **[2026-10-07]**: skills: k-dart 2.0.0 → 2.1.0 — 회사 정보 교차 검증 체인 추가',
  '- **[2026-10-28]**: chore(upgrade): 거버넌스 문서 미러 정리 및 템플릿 전달 웨이브.',
  '',
  '### Added',
  '',
  '- **[2026-10-07]**: k-kosis 스킬 추가 (한국통계진흥원 KOSIS OpenAPI)',
  '',
  '### Changed',
  '',
  '### Fixed',
  '',
  '- **[2026-10-07]**: agents/pm.md 라이프사이클 프론트매터 블록 제거 (L0 전용 필드)',
  '',
  '### Removed',
  '',
].join('\n');

const ALL_FIXTURES: Array<{ name: string; text: string }> = [
  { name: 'dup-category', text: FIX_DUP_CATEGORY },
  { name: 'multi-unreleased', text: FIX_MULTI_UNRELEASED },
  { name: 'combined legacy', text: FIX_COMBINED },
  { name: 'frontmatter korean', text: FIX_FRONTMATTER },
  { name: 'released dup', text: FIX_RELEASED_DUP },
  { name: 'golden co-news', text: GOLDEN_BEFORE },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeChangelog — failure-class fixtures (design §7.1)', () => {
  test('(a) duplicate category blocks collapse to the first occurrence, entries appended in order', () => {
    const { text, repaired } = normalizeChangelog(FIX_DUP_CATEGORY);
    expect(repaired).toBe(true);
    expect(text).toBe(
      [
        '## [Unreleased]',
        '',
        '### Added',
        '',
        '- first entry',
        '- second entry, later',
        '',
        '### Fixed',
        '',
        '- a fix',
        '',
      ].join('\n'),
    );
  });

  test('(b) dated [Unreleased] variants merge into ONE canonical `## [Unreleased]` at the first position', () => {
    const { text, repaired } = normalizeChangelog(FIX_MULTI_UNRELEASED);
    expect(repaired).toBe(true);
    expect(text).toBe(
      ['## [Unreleased]', '', '- stale entry', '- current entry', ''].join('\n'),
    );
  });

  test('(c) combined legacy shape: both classes repaired, released section untouched', () => {
    const { text, repaired } = normalizeChangelog(FIX_COMBINED);
    expect(repaired).toBe(true);
    expect(text).toBe(
      [
        '## [Unreleased]',
        '',
        '- current entry',
        '',
        '### Added',
        '',
        '- stale add',
        '- stale add 2',
        '',
        '### Fixed',
        '',
        '- current fix',
        '- current fix 2',
        '',
        '## [1.0.0] - 2026-01-01',
        '',
        '### Added',
        '- old thing',
        '',
      ].join('\n'),
    );
  });

  test('unreleased merge happens at the FIRST unreleased position, released sections never renamed', () => {
    const text = [
      '## [1.0.0] - 2026-01-01',
      '',
      '### Added',
      '- old',
      '',
      '## [Unreleased] 2026-09-01',
      '',
      '- stale',
      '',
      '## [Unreleased]',
      '',
      '- current',
      '',
    ].join('\n');
    const { text: after } = normalizeChangelog(text);
    expect(after).toBe(
      [
        '## [1.0.0] - 2026-01-01',
        '',
        '### Added',
        '- old',
        '',
        '## [Unreleased]',
        '',
        '- stale',
        '- current',
        '',
      ].join('\n'),
    );
  });

  test('duplicate categories in a RELEASED section collapse in place (gate scans all sections)', () => {
    const { text: after } = normalizeChangelog(FIX_RELEASED_DUP);
    expect(after).toBe(
      [
        '## [Unreleased]',
        '',
        '- current',
        '',
        '## [0.9.0] - 2025-06-01',
        '',
        '### Fixed',
        '',
        '- old fix',
        '- older fix',
        '',
      ].join('\n'),
    );
  });

  test('empty duplicate [Unreleased] sections merge to one bare heading', () => {
    const { text: after } = normalizeChangelog('## [Unreleased]\n\n## [Unreleased]\n');
    expect(after).toBe('## [Unreleased]\n');
  });

  test('repaired output keeps `repaired: true` exactly once — re-normalizing reports false', () => {
    const first = normalizeChangelog(FIX_COMBINED);
    expect(first.repaired).toBe(true);
    const second = normalizeChangelog(first.text);
    expect(second.repaired).toBe(false);
  });
});

describe('normalizeChangelog — idempotency (design §7.2)', () => {
  test('normalize(normalize(x)) == normalize(x) for every fixture', () => {
    for (const { name, text } of ALL_FIXTURES) {
      const once = normalizeChangelog(text).text;
      const twice = normalizeChangelog(once).text;
      expect(twice).toBe(once);
      expect(normalizeChangelog(once).repaired).toBe(false);
    }
  });

  test('CRLF fixtures: line endings preserved and idempotent', () => {
    const crlf = FIX_COMBINED.replace(/\n/g, '\r\n');
    const once = normalizeChangelog(crlf).text;
    expect(once).toContain('\r\n');
    expect(once).not.toMatch(/(?<!\r)\n/); // no lone LF
    expect(normalizeChangelog(once).text).toBe(once);
    expect(changelogGateFindings(once)).toEqual([]);
  });
});

describe('normalizeChangelog — content preservation (design §7.3)', () => {
  test('every fixture: entry multiset byte-identical, preamble byte-identical, delta is heading/blank only', () => {
    for (const { name, text } of ALL_FIXTURES) {
      const { text: after } = normalizeChangelog(text);
      expectContentPreserved(text, after);
    }
  });

  test('frontmatter `lang: ko` / `lang_reason: legal` survive byte-identical with Korean entries', () => {
    const { text: after } = normalizeChangelog(FIX_FRONTMATTER);
    expect(after).toContain('lang: ko');
    expect(after).toContain('lang_reason: legal');
    expect(after).toContain('- 한글 항목: 문서 가이드 수정');
    expect(after).toContain('- 또 다른 한글 항목: 빌드 스크립트 정리');
    expect(preambleOf(after)).toBe(preambleOf(FIX_FRONTMATTER));
  });
});

describe('normalizeChangelog — golden pair (design §7.4, anonymized co-news legacy shape)', () => {
  test('before/after pair is pinned and reproduced exactly', () => {
    const { text, repaired } = normalizeChangelog(GOLDEN_BEFORE);
    expect(repaired).toBe(true);
    expect(text).toBe(GOLDEN_AFTER);
    expectContentPreserved(GOLDEN_BEFORE, GOLDEN_AFTER);
  });

  test('golden after-state is a detector-clean fixed point', () => {
    expect(changelogGateFindings(GOLDEN_AFTER)).toEqual([]);
    expect(normalizeChangelog(GOLDEN_AFTER)).toEqual({ text: GOLDEN_AFTER, repaired: false });
  });
});

describe('normalizeChangelog — no-findings no-op (design §7.5, zero-write invariant)', () => {
  test('clean CHANGELOG passes through byte-identical, including unusual blank-line runs', () => {
    const clean = [
      '# Changelog',
      '',
      '',
      '## [Unreleased]',
      '',
      '### Added',
      '- new thing',
      '',
      '',
      '',
      '### Fixed',
      '- fix thing',
      '',
    ].join('\n');
    const result = normalizeChangelog(clean);
    expect(result).toEqual({ text: clean, repaired: false });
  });

  test('clean file with frontmatter and released sections is untouched', () => {
    const clean = [
      '---',
      'lang: ko',
      'lang_reason: legal',
      '---',
      '',
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Added',
      '- 새 항목',
      '',
      '## [1.2.0] - 2026-02-01',
      '',
      '### Fixed',
      '- 수정',
      '',
    ].join('\n');
    expect(normalizeChangelog(clean)).toEqual({ text: clean, repaired: false });
  });
});

describe('detector-healer agreement (design §7.6 — the dev-sync step 3b runtime assertion)', () => {
  test('every fixture: findings before, zero findings after normalization', () => {
    for (const { name, text } of ALL_FIXTURES) {
      expectDetectorAgreement(text);
    }
  });

  test('CRLF variant also converges to zero findings', () => {
    expectDetectorAgreement(FIX_MULTI_UNRELEASED.replace(/\n/g, '\r\n'));
  });

  test('the golden after-state equals the healed golden before-state (pair consistency)', () => {
    expect(expectDetectorAgreement(GOLDEN_BEFORE)).toBe(GOLDEN_AFTER);
  });
});
