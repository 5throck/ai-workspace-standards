---
name: ai-tell-reduction
scope: co-news
description: >
  Guides style-editor through reducing "AI-tell" patterns in generated prose
  so articles read as naturally human-written. Approach inspired by (not
  copied from) the public epoko77-ai/im-not-ai project's category/severity
  method. Korean is the primary, detailed mode; a lighter general-purpose
  mode applies for non-Korean output. Use when: Phase 4, after the
  financial-journalism-style pass, on every draft before publish — this is
  a mandatory gate, not optional polish.
version: 1.0.0
last_reviewed: 2026-08-10
status: active
owner: style-editor
prerequisites: none
---

## Context

This skill reduces "AI-tell" patterns in generated prose so articles read as naturally human-written. The approach is inspired by (not copied from) the public `epoko77-ai/im-not-ai` project's category/severity method. Korean is the primary, detailed mode; a lighter general-purpose mode applies for non-Korean output, since the detailed pattern taxonomy is Korean-specific.

## When to Use

- Phase 4, after the `financial-journalism-style` pass, on every draft before publish
- This is a mandatory gate, not optional polish

## Execution Steps

1. **Scan Against Taxonomy (Korean mode)**: Scan the draft against this taxonomy, scoring each pattern by severity (cosmetic/distracting/meaning-distorting): translationese (romanized: beonyeoktu), mechanical enumerated transitions (e.g. "first/second/third" overuse), AI-specific stock phrases and excessive hedging language, passive-voice overuse, emoji and bullet-point overuse, uniformly-sized sentences, excessive use of connective/transition words.

2. **Rewrite by Severity**: Rewrite in descending severity order — worst patterns first.

3. **Hard Constraint — Zero Figure Drift**: Proper nouns, numbers, dates, and direct quotes must pass through the rewrite 100% unchanged. Diff the before/after draft against the fact-checker's ledger to confirm zero figure drift.

4. **Lighter Checklist (Non-Korean mode)**: Apply a lighter general checklist instead — repetitive sentence openers, hedge-word overuse ("it's worth noting", "in today's..."), unnaturally uniform sentence rhythm, generic AI clichés. The same hard constraint on proper nouns/numbers/dates/quotes applies.

5. **Output a Diff, Never a Silent Overwrite**: Output a before/after diff so pm/style-editor can review what changed and why.

## Output Format

- A diff-style Before/After block per changed sentence
- A one-line summary: "N patterns found, N fixed, ledger-diff: [CLEAN/DRIFT DETECTED]"

## Related Skills

- financial-journalism-style
- source-verification-ledger
