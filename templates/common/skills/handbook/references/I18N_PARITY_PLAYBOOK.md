# I18N Parity Playbook — Multilingual Handbook Maintenance

> Audience: `handbook-writer` / `handbook-reviewer` agents and human maintainers
> of multilingual handbook projects (base = Korean, `_en`, `_ja`, `_es`).
> Source of this playbook: the 2026-08-24 four-language drift incident in
> `intro-to-ai-harness` + `multi-agent-harness-handbook` (root causes verified
> via git archaeology).

## 1. Why this exists

A full-content audit found 15 HIGH-severity divergences in one handbook
(empty practice sections in 3 languages, contradictory FAQ sets, wrong
numbers) and metadata-level drift in the other — none of which any existing
link/nav/footer checker could catch, because **they all validated single
files, never compared languages**.

Verified root causes (in order of impact):

| # | Root cause | Typical signature |
|---|------------|-------------------|
| 1 | Independent pre-repo authorship of ko/en | Import-time line-count gaps (ko 944 vs en 749) |
| 2 | One-shot translation snapshots, never refreshed | ja/es frozen at creation commit; missing later ko sections |
| 3 | Partial-sync commits ("all languages" message, one file changed) | `git show --stat` lists only `X_en.html` |
| 4 | One-side improvements never backported | es-only glossary terms, ja-only diagram labels |
| 5 | No cross-language gate in tooling | checkers pass while ch09 practice is empty in 3 languages |

## 2. The checker

`scripts/check-i18n-parity.ts` (also wired as Check 13 of `handbook-doctor`):

```bash
bun run scripts/check-i18n-parity.ts --docs-dir docs   # standalone
bun run handbook-doctor --project .                    # includes it as Check 13
```

- **FAIL** (exit 1): heading (`h1/h2/h3`) or code-block (`<pre>`) count mismatch vs base;
  a language variant missing while siblings exist; internal links from `_en/_ja/_es`
  pages to pages that have a same-suffix variant on disk (wrong-language link).
- **WARN**: `<li>`/`<tr>` deviation >15%; numeric-token (`$`, `%`) multiset divergence.

## 3. Operating rules

1. **Korean canonical-first.** The no-suffix file is the source of truth.
   When content diverges semantically, fix ko first, then regenerate
   translations from it — never "fix" translations independently.
2. **Four-language same-commit rule.** Any content change to `X.html` must
   land together with its `_en/_ja/_es` equivalents in the same PR. If truly
   impossible, open a follow-up issue before merge and reference it in the PR body.
3. **Regeneration beats patching** when drift is structural (missing sections,
   different heading sets). Patch only for isolated typos/numbers.
4. **Split large regeneration work per language file.** Wholesale rewrites of
   60KB+ pages fail silently (timeout/token limits) when batched 3-at-once;
   per-file tasks complete reliably and are easier to review.
5. **Run the FULL CI suite locally before pushing** — not just `doctor`.
   Minimum: `validate-handbook`, `check-symmetry`, `check-links`,
   `check-labels`, `check-authoring`, `handbook-doctor`, `check-a11y`,
   `check-spell`, `check-lint`, `check-external-links`, `check-search`,
   then `build-search-index`. Real incident: doctor passed while CI failed on
   tag balance + footer consistency.
6. **After bulk edits, run `update-footers`.** Regenerated pages inherit the
   target file's stale footer; §21-6 requires byte-identical footers per
   language across the whole site.
7. **Rebuild the search index** after any content change
   (`build-search-index`); stale indexes ship wrong text to site search.
8. **Validate the checker against a known-good group** before trusting new
   regex/heuristics (incident: `$0.27,` captured trailing punctuation and
   flagged phantom drift).

## 4. Recovery workflow (when parity is already broken)

1. Audit: extract h2/h3/li/tr/pre counts per language per group; classify each
   group ko-richer / translation-richer / divergent-both-ways.
2. Enrich the canonical first: port valuable translation-only blocks INTO ko
   (translated), so nothing authored is lost.
3. Regenerate translations wholesale from the enriched canonical, preserving
   page shell (head/CSP/css/js links, lang-switcher hrefs, chapter-nav, footer)
   from each target file and translating visible SVG labels.
4. Self-check each output: heading set == ko; counts within ±5% (target 0%);
   numeric multiset == ko; zero untranslated prose; nav/footer intact.
5. Run rules 5–8 above, then ship everything in one PR.
