# Design: zen × style differentiation and overlay stacking fix

- **Spec ID**: 2026-10-05-zen-style-differentiation
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `docs/html-themes/`

## Problem

1. **Overlay paints above slide text.** In `themes/zen/theme.css`, `.zen-overlay` is a positioned element with `z-index: 0` while `.slide-content` is static, so per CSS painting order the overlay renders on top of the text. With the default dark overlay this is barely visible (text is white-on-dark anyway); with any light overlay the text is washed out to illegibility.
2. **Zen pairings are indistinguishable.** All four styles compatible with zen (`classic`, `minimal`, `premium-dark`, `academic`) rendered nearly identically under zen: same dark overlay, same white type — only the footer chrome differed. User review found `minimal` did not read as minimal and `academic` did not read as academic.

## Decision

1. **theme.css fix (structural)**: give `.slide-content` `position: relative; z-index: 2` in `themes/zen/theme.css` so text always paints above the overlay, for every style. This is a theme-level bug, not a style concern.
2. **Per-style zen looks (visual)**: each of the four compatible styles gets a `[data-theme="zen"]`-scoped block in its `style.css`:

| Style | Zen look | Overlay (top → bottom) | Title |
|-------|----------|------------------------|-------|
| classic | Ink & Paper (Garr Reynolds zen) | warm paper `rgba(248,246,241,.90→.84)` | ink `#1a1a2e` sans, red `#B03A2E` bullets |
| minimal | Pure Whitespace | near-opaque white `rgba(255,255,255,.95)` | `#111` weight-300, smaller cover type, dash bullets |
| premium-dark | Noir Gold | near-black `rgba(4,7,14,.84→.68)` | cream serif `#F5E9CE` + gold glow |
| academic | Sepia Manuscript | sepia `rgba(62,48,32,.88→.80)` | cream serif + double frame on non-cover slides |

`[data-theme="zen"]` scoping guarantees zero impact on the other five themes (`outline`, `outlook`, `pitch`, `pitch-enhanced`, `vertical`) that pair with these styles: the CSS variables introduced (`--zen-overlay-color-*`) are only read by zen's `theme.css`, and the text-color overrides are guarded by the same attribute selector.

## Alternatives considered

- **New dedicated styles (`zen-paper`, `zen-sepia`, …)**: rejected — four new registry entries duplicate the existing palette/spec plumbing for what is a per-style refinement of zen, not four new general-purpose palettes.
- **Unscoped edits to `style.css`**: rejected — variables such as `--cover-text` are shared by all themes; unscoped changes would silently re-theme covers in `outline`/`pitch`/etc.

## Consequences

- zen decks remain legible under any overlay tone (bug fix).
- zen × style previews are now visually distinct and match each style's name.
- `baselines/zen/*` screenshots are regenerated in the same change; other themes' baselines are untouched.
- Follow-up (not in this change): `pdf_color_spec.json` entries still carry the pre-differentiation palettes; the PDF pipeline may need matching palette updates for the light-overlay looks.

## Verification

- `bun scripts/co-deck/validate-theme-styles.ts` — region/pool validation.
- `bun scripts/audit.ts` — workspace audit incl. spec-check.
- `bun test scripts/co-deck/tests/theme-visual-regression.test.ts` with `UPDATE_BASELINES=1` — regenerated zen baselines; non-zen baselines unchanged.
- Playwright screenshots of `zen × {classic, minimal, premium-dark, academic}` covers and standard slides confirm four distinct renders with legible text.
