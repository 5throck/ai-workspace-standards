/**
 * Language Guard Library
 *
 * Shared non-English detection for commit messages, PR titles, PR bodies, and
 * CHANGELOG.md entries. CONSTITUTION.md §3 requires these to be English-only —
 * this was previously enforced by independent, Korean-only regexes duplicated
 * across dev-sync.ts, gen-pr-body.ts, and pre-commit.ts, which both drifted from
 * each other and missed non-Korean non-English text (e.g. Japanese, Chinese).
 *
 * @version 1.0.0
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
