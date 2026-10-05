# Design: co-deck template sync — zen text panels (2026-10-05, follow-up)

- **Spec ID**: 2026-10-05-co-deck-template-panel-sync
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `templates/co-deck/`

## Problem

Follow-up to `2026-10-05-co-deck-template-zen-sync`: Projects/co-deck PR #133 landed semi-opaque text panels for zen (classic/minimal/premium-dark/academic + white-bubble opacity bump) after the earlier template sync, so the template was again stale on the readability fix.

## Decision

Same explicit-copy path as the morning sync: `styles/{academic,classic,minimal,premium-dark,white-bubble}/style.css`, regenerated `baselines/zen/*` standard-slide PNGs, the design doc, fleet + root CHANGELOG entries. Includes the follow-up hug fix from Projects/co-deck PR #134 (`flex: 0 0 auto; width: fit-content; margin-inline: auto`) so the panels wrap the text box, not the whole content region.

## Verification

- `bun scripts/co-deck/validate-theme-styles.ts` from `templates/co-deck`: PASSED.
- `diff -rq` html-themes trees: no unintended residuals.
