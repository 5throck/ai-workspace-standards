# Design: co-deck template sync — zen theme work (2026-10-05)

- **Spec ID**: 2026-10-05-co-deck-template-zen-sync
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `templates/co-deck/`

## Problem

Projects/co-deck landed a day of zen theme work (PRs #130/#131/#132) but the L2 template `templates/co-deck/` still carried the pre-change theme files, so newly scaffolded co-deck projects would miss: the overlay-above-text fix, the four zen-scoped style differentiations, the new `white-bubble` style, `**markup**`/newline support in titles, and the 50-char/5-bullet content rules. The generic `propagate-to-templates` L0→L1 step does not cover `docs/html-themes/` (variant-specific content), so an explicit template sync is required.

## Decision

Copy the landed artifacts from `Projects/co-deck` into `templates/co-deck` verbatim:

- `docs/html-themes/themes/zen/{theme.json,template.html,theme.css,pdf_layout_spec.json}`
- `docs/html-themes/styles/{academic,classic,minimal,premium-dark}/style.css` (zen-scoped blocks)
- `docs/html-themes/styles/white-bubble/` (new, zen-only)
- `docs/html-themes/THEMES.md`, `docs/html-themes/preview/themes-manifest.js`
- `docs/html-themes/baselines/zen/` (regenerated pairs + new white-bubble pair) — deliberately excluding the stray non-zen white-bubble baseline dirs that exist only in the project (white-bubble is zen-only by declaration)
- `docs/lecture-profile.md`, `docs/co-deck.context.md` (option notes)
- `docs/designs/2026-10-05-{zen-style-differentiation,white-bubble-style,zen-content-rules-50-5}-design.md`

`templates/CHANGELOG.md` [Unreleased] gains the fleet entry. `templates/co-deck/docs/specs/` is intentionally not seeded — project spec registries are add-if-missing by the upgrade mechanism.

## Alternatives considered

- Leaving the sync to the next `upgrade-project` fleet wave: rejected — upgrade waves deliver L0/common content, and html-themes is variant-local; the template would stay stale indefinitely.
- Re-generating the preview manifest inside the template: unnecessary — the manifest is a committed generated file; copying the project's freshly generated one is byte-identical.

## Verification

- `bun scripts/co-deck/validate-theme-styles.ts` from `templates/co-deck`: PASSED (themes=6, styles=6).
- `diff -rq` of `docs/html-themes/`: only expected residuals are the stray non-zen white-bubble baselines (project-only, deliberately not synced).
- Project-side: theme-browser-smoke 38 pass, visual-regression baselines captured 26/26, workspace audits green (PRs #130/#131/#132).
