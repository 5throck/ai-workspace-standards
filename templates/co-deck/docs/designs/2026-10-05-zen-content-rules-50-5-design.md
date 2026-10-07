# Design: zen content rules — 50-char titles, 5 bullets

- **Spec ID**: 2026-10-05-zen-content-rules-50-5
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `docs/html-themes/themes/zen/` + option lists

## Problem

zen's content rules capped titles at 30 chars and bullets at 3. With the white-bubble direction (sentence-flow decks derived from the 2008 reference) this is too tight: full Korean sentences commonly run 40–50 chars, and a section's key points often number 4–5.

## Decision

Raise the zen limits uniformly, keeping the rule consistent across every surface that declares it:

| Surface | Before | After |
|---|---|---|
| `theme.json` `content_rules` | max_title_chars 30 / max_bullets_per_slide 3 | 50 / 5 |
| `pdf_layout_spec.json` `content_constraints` (standard + punchline) | 30 / 3 | 50 / 5 |
| `template.html` `buildBullets_zen` hard cap | `slice(0, 3)` | `slice(0, 5)` |
| `docs/lecture-profile.md`, `docs/co-deck.context.md` option notes | "max 3 bullets, 28 char title" | "max 5 bullets, 50 char title" |

## Decision (addendum: two-line titles)

A 50-char title rarely fits one line. Titles therefore break into two lines:

- **Natural wrap**: `theme.css` `.slide-title` gains `line-height: 1.25; overflow-wrap: break-word;` so long titles wrap cleanly.
- **Author-chosen break**: `inlineTitle()` in `template.html` renders `\n` in a slideData title as `<br>` (composed with `**markup**` parsing), letting the author pick the break point.
- **PDF**: no change needed — `renderStandardSlide` already sizes the title block via `estimateTextHeight` (wrap-aware) and draws with `multiCell`, so two-line titles center correctly.

## Consequences

- Storyline Stage 2 density guidance and PDF rendering constraints stay in sync (no drift between the three declarers).
- 5-bullet slides are denser in the white-bubble card; verified by sample render (card auto-heights, no overflow at 1600×900).
- Baselines unchanged: existing captured slides carry ≤3 bullets, so DOM/PDF output for them is identical.

## Verification

- `bun test scripts/co-deck/tests/theme-browser-smoke.test.ts`
- `bun scripts/co-deck/validate-theme-styles.ts`
- Playwright sample: zen × white-bubble slide with a 50-char title and 5 bullets renders inside the bubble card without overflow.
