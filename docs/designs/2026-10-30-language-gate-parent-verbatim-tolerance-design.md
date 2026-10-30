# Design: Language-gate parent-commit verbatim tolerance (T-20261030-006)

- **Date**: 2026-10-30
- **Ticket**: T-20261030-006 (wave-blocker, 0.24.0 co-safety canary)
- **Design pattern source**: docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §A2 (PR #1722) — baseline tolerance that self-expires the moment content genuinely changes.
- **Status**: implemented (this document registered with the workspace spec registry)

## Problem

The non-English ADDITIONS check (scripts/hooks/pre-commit.ts check 2-B, detection via
scripts/lib/language-guard.ts) fails any staged CHANGELOG.md whose ADDED diff lines carry
Korean/Japanese/Chinese characters. The 0.24.0 delivery's changelog reorganization (duplicate-category
merge per the new dev-sync v1.35.0 gate's fix action, U-20261028-013) MOVED pre-existing
Korean-bearing CHANGELOG lines in Projects/co-safety (file carries the sanctioned `lang_reason: legal`
exception) — the moved lines re-appear as "newly added" in the staged diff and the check failed with
25 Korean-bearing additions. Moved lines are not new content; the gate punished reorganization.

This is the third gate-vs-legacy-content interaction in two waves (mirror-gate CI 2026-10-29;
changelog duplicate gate + language gate 2026-10-30).

## Decided (design option b — the systemic fix)

A line whose **trimmed content exists verbatim in the parent commit's version of the same file** is
NOT "newly added" — it is moved/reordered — and must not block. This extends the A2 honesty
principle to the language gate: the tolerance proves provenance from the commit graph itself
(HEAD is the baseline `git diff --cached` already compares against), and it self-expires: a
genuinely new non-English line has no parent counterpart and still blocks.

Rejected: (a) scaffold-side fix only (preserve block positions / append-only CHANGELOG inserts,
ticket option a) — helps future deliveries but leaves every other reorganization trigger
(hand-edits, rename-merges, copy-paste reorders) blocking forever, and cannot heal the wave
blocked tonight; (c) exempting files with `lang:`/`lang_reason:` frontmatter — removes the gate's
teeth on exactly the files that legitimately carry historical Korean content; a genuinely new
Korean sentence added to such a file must still fail.

## Mechanism

1. **New pure helper** in scripts/lib/language-guard.ts v1.1.0:
   `filterParentVerbatimLines(addedLines: string[], parentLines: string[]): string[]` —
   returns the subset of `addedLines` whose `trim()` is NOT in the set of `parentLines` trimmed
   contents (moved/reordered lines dropped; only genuinely new lines returned).
2. **Wire-up** in scripts/hooks/pre-commit.ts v1.12.0 (check 2-B): only when `hasNonEnglish(addedLines)`
   is true (performance — parent content fetched only for files with non-English added-line hits),
   fetch the parent blob via `Bun.spawnSync(['git', 'show', 'HEAD:<file>'])` (nothrow; empty set on
   failure — initial commit or file-new-in-HEAD → everything is genuinely new, fail behavior
   preserved), split into lines, filter through the helper, and fail only if the filtered lines
   still contain non-English characters.
3. **Baseline choice**: HEAD (what `git diff --cached` compares the index against). No merge-base
   lookup — the check never had merge-base access, and HEAD is exactly the commit whose content
   was already gate-approved.
4. **Untouched exemptions**: `_ko.md` file skip, added-lines-only scope (never whole-file),
   code-block stripping inside `hasNonEnglish`. Existing per-file loop shape preserved.

## Test plan (tests/unit/language-guard-parent-tolerance.test.ts)

- (a) added line that exists verbatim in parent → tolerated (no fail);
- (b) genuinely new Korean line → still fails;
- (c) mixed case → only the genuinely-new line reported by the filter;
- (d) tolerance holds when the file was also reorganized (moved block: heading + Korean lines
  relocated to a merged category while a genuinely new line joins them).

E2E proof on Projects/co-safety (scratch copy, project tree untouched): merge duplicate
`### Fixed` categories per the v1.35.0 gate's fix action, run the check pre-fix (expect the
25-additions failure) and post-fix (expect pass).

## Publishing surface

scripts/hooks/pre-commit.ts and scripts/lib/language-guard.ts are L0+L1 delivered (physical twins
in templates/common/scripts/) — propagated via `bun scripts/propagate-to-templates.ts --apply` in
the same PR. SCRIPTS.md rows updated (L0 + L1 columns share the row); version history in the
@version headers. Neither script carries a docs/lifecycle/scripts/ record (Check H audits existing
records only), so no lifecycle-record edit is required.
