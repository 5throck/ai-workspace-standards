/**
 * Language Guard Library
 *
 * Shared non-English detection for commit messages, PR titles, PR bodies, and
 * CHANGELOG.md entries. CONSTITUTION.md §3 requires these to be English-only —
 * this was previously enforced by independent, Korean-only regexes duplicated
 * across dev-sync.ts, gen-pr-body.ts, and pre-commit.ts, which both drifted from
 * each other and missed non-Korean non-English text (e.g. Japanese, Chinese).
 *
 * v1.1.0 (2026-10-30, T-20261030-006 — spec
 *          docs/designs/2026-10-30-language-gate-parent-verbatim-tolerance-design.md):
 *          filterParentVerbatimLines — parent-commit verbatim tolerance for the
 *          pre-commit ADDITIONS check. The 0.24.0 co-safety canary blocked because
 *          the changelog reorganization (duplicate-category merge, dev-sync v1.35.0
 *          gate fix action) MOVED pre-existing Korean-bearing CHANGELOG lines, which
 *          re-appear as "+ lines" in the staged diff and failed the additions check
 *          (25 Korean-bearing additions). Moved lines are not new content. Extends
 *          the delivery-bookkeeping A2 baseline-tolerance honesty principle
 *          (design 2026-10-29-delivery-bookkeeping-engine-design.md §A2, PR #1722)
 *          to the language gate: an added line whose trimmed content exists verbatim
 *          in the parent commit's blob is moved/reordered, not newly added. The
 *          tolerance self-expires — a genuinely new non-English line has no parent
 *          counterpart and still blocks.
 *
 * @version 1.1.0
 */

// Korean Hangul (syllables + jamo) + Hiragana + Katakana + CJK Unified Ideographs
// (the latter covers Chinese Hanzi, Japanese Kanji, and Korean Hanja under one range).
export const NON_ENGLISH_RANGE = /[가-힯ᄀ-ᇿ㄰-㆏぀-ヿ一-鿿]/;

/** Strip fenced/inline code blocks before checking — code samples may contain non-English values. */
export function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

/** True if `text` (after stripping code blocks) contains non-English (Korean/Japanese/Chinese) characters. */
export function hasNonEnglish(text: string): boolean {
  return NON_ENGLISH_RANGE.test(stripCodeBlocks(text));
}

/**
 * Parent-commit verbatim tolerance (T-20261030-006). Given the ADDED lines of a
 * staged diff and the LINES of the same file at the parent commit, returns only
 * the added lines that are genuinely new — an added line whose trimmed content
 * matches a parent line (verbatim, whitespace-normalized) is moved/reordered
 * history, not new content, and is dropped. Comparison is per-trimmed-line via a
 * Set, so cost is O(added + parent) regardless of reorganization size.
 *
 * Callers fetch the parent blob only when the raw added-line check already hit
 * (hasNonEnglish true), so the git-show cost stays on the failing path only.
 */
export function filterParentVerbatimLines(addedLines: string[], parentLines: string[]): string[] {
  const parentContents = new Set(parentLines.map((l) => l.trim()));
  return addedLines.filter((l) => !parentContents.has(l.trim()));
}
