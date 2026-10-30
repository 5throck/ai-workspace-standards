/**
 * Unit tests for the language-gate parent-commit verbatim tolerance
 * (T-20261030-006 — spec
 * docs/designs/2026-10-30-language-gate-parent-verbatim-tolerance-design.md).
 *
 * The pre-commit ADDITIONS check (hooks/pre-commit.ts check 2-B) failed the
 * co-safety 0.24.0 canary because a changelog reorganization (duplicate-category
 * merge, dev-sync v1.35.0 gate fix action) MOVED pre-existing Korean-bearing
 * CHANGELOG lines back into the staged add-set. filterParentVerbatimLines drops
 * added lines whose trimmed content exists verbatim in the parent blob; the hook
 * fails only when the filtered lines still contain non-English characters.
 *
 * The added-line arrays below mirror the hook's extraction from a real
 * `git diff --cached -U0` output: lines starting with '+' but not '+++', sliced
 * by one. The reorganization diff in case (d) is byte-for-byte what git emits
 * for that merge (verified in a scratch repo when the fix was authored).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { hasNonEnglish, filterParentVerbatimLines } from '../../scripts/lib/language-guard.ts';

/** Mirror of the hook's added-line extraction from `git diff --cached -U0` output. */
function addedLinesOf(diffText: string): string[] {
  return diffText
    .split('\n')
    .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    .map((l) => l.slice(1));
}

const MOVED_STATUTE_LINE = '- **[2026-08-07]**: statute sweep — 산업안전보건법 renamed';
const MOVED_GAS_LAW_LINE = '- **[2026-08-05]**: statute fix — 고압가스안전관리법 citation';
const NEW_KOREAN_LINE = '- **[2026-10-30]**: 신규 정책 추가 — new policy entry';

describe('filterParentVerbatimLines — parent-commit verbatim tolerance (T-20261030-006)', () => {
  test('(a) added line that exists verbatim in parent → tolerated (filter empties it, check passes)', () => {
    const parent = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Fixed',
      MOVED_STATUTE_LINE,
      '',
    ];
    const added = addedLinesOf(
      ['diff --git a/CHANGELOG.md b/CHANGELOG.md', `+${MOVED_STATUTE_LINE}`].join('\n'),
    );
    expect(hasNonEnglish(added.join('\n'))).toBe(true); // raw check hits — this is the defect
    const genuinelyNew = filterParentVerbatimLines(added, parent);
    expect(genuinelyNew).toHaveLength(0);
    expect(hasNonEnglish(genuinelyNew.join('\n'))).toBe(false); // → hook passes
  });

  test('(b) genuinely new Korean line → still fails (no parent counterpart)', () => {
    const parent = ['### Added', '- old English entry'];
    const added = addedLinesOf(`+${NEW_KOREAN_LINE}`);
    const genuinelyNew = filterParentVerbatimLines(added, parent);
    expect(genuinelyNew).toEqual([NEW_KOREAN_LINE]);
    expect(hasNonEnglish(genuinelyNew.join('\n'))).toBe(true); // → hook fails
  });

  test('(c) mixed case → only the genuinely-new line reported', () => {
    const parent = ['### Fixed', MOVED_STATUTE_LINE, MOVED_GAS_LAW_LINE];
    const added = addedLinesOf([`+${MOVED_STATUTE_LINE}`, `+${NEW_KOREAN_LINE}`, `+${MOVED_GAS_LAW_LINE}`].join('\n'));
    const genuinelyNew = filterParentVerbatimLines(added, parent);
    expect(genuinelyNew).toEqual([NEW_KOREAN_LINE]);
    expect(hasNonEnglish(genuinelyNew.join('\n'))).toBe(true);
    expect(genuinelyNew.join('\n')).not.toContain('산업안전보건법');
    expect(genuinelyNew.join('\n')).not.toContain('고압가스안전관리법');
  });

  test('(d) tolerance holds under reorganization (moved block) — real git diff shape', () => {
    // Parent blob: two `### Fixed` blocks with Korean statute entries.
    const parent = [
      '# Changelog',
      '',
      '## [Unreleased]',
      '',
      '### Fixed',
      MOVED_STATUTE_LINE,
      '- **[2026-08-06]**: older fix',
      '',
      '### Added',
      '- new thing',
      '',
      '### Fixed',
      MOVED_GAS_LAW_LINE,
    ];
    // Staged result of the v1.35.0 fix action: duplicate categories merged into
    // one `### Fixed`, entries chronological — BOTH Korean-bearing entries moved.
    const stagedDiff = [
      'diff --git a/CHANGELOG.md b/CHANGELOG.md',
      'index 4f12025..bc35c7d 100644',
      '--- a/CHANGELOG.md',
      '+++ b/CHANGELOG.md',
      '@@ -5,4 +4,0 @@',
      '-### Fixed',
      `-${MOVED_STATUTE_LINE}`,
      '- **[2026-08-06]**: older fix',
      '',
      '@@ -12,0 +9,2 @@',
      `+${MOVED_STATUTE_LINE}`,
      '+- **[2026-08-06]**: older fix',
    ].join('\n');
    const added = addedLinesOf(stagedDiff);
    // Regression guard: the RAW added set carries Korean — the pre-fix behavior
    // that blocked the co-safety 0.24.0 canary.
    expect(hasNonEnglish(added.join('\n'))).toBe(true);
    const genuinelyNew = filterParentVerbatimLines(added, parent);
    expect(genuinelyNew).toHaveLength(0);
    expect(hasNonEnglish(genuinelyNew.join('\n'))).toBe(false); // → hook passes
  });

  test('parent blob unavailable (initial commit / file new in HEAD) → fail behavior preserved', () => {
    const added = addedLinesOf(`+${NEW_KOREAN_LINE}`);
    const genuinelyNew = filterParentVerbatimLines(added, []);
    expect(genuinelyNew).toEqual([NEW_KOREAN_LINE]);
    expect(hasNonEnglish(genuinelyNew.join('\n'))).toBe(true); // → hook still fails
  });

  test('whitespace-insensitive: added line differing from parent only by surrounding whitespace is tolerated', () => {
    const parent = ['\t' + MOVED_STATUTE_LINE];
    const added = addedLinesOf(`+  ${MOVED_STATUTE_LINE}  `);
    const genuinelyNew = filterParentVerbatimLines(added, parent);
    expect(genuinelyNew).toHaveLength(0);
  });

  test('genuinely-new English additions are never flagged by the composed check', () => {
    const added = addedLinesOf(['+- **[2026-10-30]**: plain English entry', '+### Changed'].join('\n'));
    expect(hasNonEnglish(filterParentVerbatimLines(added, []).join('\n'))).toBe(false);
  });
});
