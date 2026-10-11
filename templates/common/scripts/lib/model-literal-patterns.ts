/**
 * Model-ID literal patterns — shared by skill-lifecycle-audit Check MM and
 * scripts/sync-model-registry.ts.
 *
 * Workspace directive (2026-10-11): registry model IDs must NOT be hardcoded
 * in skills. Model IDs live ONLY in docs/workspace-schema.json (`models.*`),
 * the CLAUDE.md §6 / AGENTS.md §3.6 managed prose, and historical records
 * (CHANGELOG, docs/adr, docs/designs, registry history lines) — none of which
 * are skill trees.
 *
 * @version 1.0.0
 */

/**
 * Versioned registry model-ID literal patterns (case-insensitive, word-bounded):
 * Claude `claude-opus-5-5`-style, Gemini `gemini-3.1-pro`/`gemini-3.8-flash`,
 * and Codex `gpt-5.6-sol`/`gpt-5.6-terra`/`gpt-5.6-luna`.
 */
export const MODEL_ID_PATTERNS: readonly RegExp[] = [
  /\bclaude-(?:opus|sonnet|haiku)-\d+-\d+\b/i,
  /\bgemini-[\d.]+-(?:pro|flash)\b/i,
  /\bgpt-5\.\d-(?:sol|terra|luna)\b/i,
];

/**
 * Unique model-ID literals found in `content`, in first-seen order.
 * Pure — no filesystem access — so both consumers (and their tests) can call
 * it directly.
 */
export function findModelLiterals(content: string): string[] {
  const found: string[] = [];
  for (const pattern of MODEL_ID_PATTERNS) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    for (const m of content.matchAll(global)) {
      if (!found.includes(m[0])) found.push(m[0]);
    }
  }
  return found;
}
