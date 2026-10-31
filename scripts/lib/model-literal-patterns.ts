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
 * @version 1.1.0
 * v1.1.0 (2026-10-31, T-20261031-005 — spec
 *          docs/designs/2026-10-31-registry-platform-vocabulary-design.md
 *          §R2.2): the Codex family pattern generalizes from
 *          `gpt-5\.\d-` to `gpt-\d+(?:\.\d+)?-` so the GPT-6.x rebase
 *          (gpt-6.1-sol / gpt-6.1-terra / gpt-6-luna) stays under Check MM
 *          detection while delivered-side gpt-5.6 stragglers keep matching
 *          through the L3 convergence window.
 */

/**
 * Versioned registry model-ID literal patterns (case-insensitive, word-bounded):
 * Claude `claude-opus-5-5`-style, Gemini `gemini-3.1-pro`/`gemini-3.8-flash`,
 * and the Codex sol/terra/luna tier family (`gpt-5.6-*` through the GPT-6.x
 * generation — `gpt-6.1-*` / `gpt-6-*`).
 */
export const MODEL_ID_PATTERNS: readonly RegExp[] = [
  /\bclaude-(?:opus|sonnet|haiku)-\d+-\d+\b/i,
  /\bgemini-[\d.]+-(?:pro|flash)\b/i,
  /\bgpt-\d+(?:\.\d+)?-(?:sol|terra|luna)\b/i,
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
