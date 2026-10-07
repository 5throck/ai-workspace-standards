# Design: white-bubble style (zen signature, from the 2008 Corporate Culture Revolution deck)

- **Spec ID**: 2026-10-05-white-bubble-style
- **Date**: 2026-10-05
- **Status**: implemented
- **Scope**: `docs/html-themes/`

## Problem

The user designated their 2008 SlideShare deck "Corporate Culture Revolution" (83 slides) as the reference for co-deck zen work and asked for a new style based on it. Its visual DNA, verified from slide images:

- Vivid full-bleed photos with a faint dark wash (photos stay readable as images, not watermarks)
- ONE sentence per slide inside a **white rounded bubble card** floating over the photo
- 1–2 **keywords highlighted in warm orange** inside the sentence
- Cover: white serif title directly on the photo (no card), date/footer meta below
- Closing: punchline + Creative Commons attribution

None of the four existing zen pairings reproduces this: classic/minimal wash the photo out with light overlays; premium-dark/academic keep dark tones. The bubble-card pattern and keyword highlighting do not exist in any style.

## Decision

Add **`white-bubble`** (v1.0.0) as a new style, **zen-only** by declaration:

1. `styles/white-bubble/style.css` — warm light chrome (page `#ece9e3`, ink-navy text `#1f2a44`, orange accent `#e8590c`), plus a `[data-theme="zen"]` block: faint dark overlay (`rgba(20,20,20,.28→.18)`) keeping photos vivid, white rounded bubble card on `.slide-content` for every slide type except cover, orange `<strong>` keyword highlights (dark warm `#ffc078` on the cover), white serif cover title.
2. `styles/white-bubble/pdf_color_spec.json` — matching light palette (white cards, ink text, orange accent) for the PDF pipeline.
3. `themes/zen/theme.json` — `white-bubble` added to `compatible_styles`. Other themes do not declare it (the signature is expressed through zen-specific selectors/variables).
4. `themes/zen/template.html` — titles now render through a new `inlineTitle()` helper that reuses `appendInline`, so `**keyword**` markup works in titles exactly as it already did in bullets and `visualDisplay`. Rendering without markup is unchanged (plain text node).
5. Registry/docs: THEMES.md (styles table, zen row, compatibility matrix with a zen-only footnote, changelog footer), `docs/lecture-profile.md` style options, `docs/co-deck.context.md` style table.
6. Baselines: `baselines/zen/white-bubble/` added via `UPDATE_BASELINES=1`; other themes' baselines untouched.

## Alternatives considered

- **Extend an existing style** (e.g. classic): rejected — the bubble pattern and vivid-photo overlay contradict classic's watermark-photo look; both would fight over the same variables.
- **All-theme compatibility**: rejected for now — the look is meaningful only with zen's fullscreen-photo structure; declaring compatibility without verified renders would be dishonest in the matrix. Rendering on other themes is a plain light style, so a future widening only needs verified `compatible_styles` entries + baselines.

## Consequences

- `**keyword**` markup now works in every zen slide title (all styles benefit).
- One sentence per slide (0 bullets) is fully supported: `bullets: []` renders the sentence alone in the bubble.
- Zen decks can now reproduce the 2008 signature end-to-end, including the CCL attribution closing slide (contact type).

## Verification

- `bun scripts/co-deck/validate-theme-styles.ts` — PASSED (themes=6, styles=6).
- `bun test scripts/co-deck/tests/theme-browser-smoke.test.ts` — 38 pass (template change covered).
- `UPDATE_BASELINES=1 bun test scripts/co-deck/tests/theme-visual-regression.test.ts` — 26 pairs captured; `zen/white-bubble` baseline added, others byte-identical.
- Playwright screenshots of zen × white-bubble cover + sentence slide confirm: white bubble card over vivid photo, orange keyword highlights, white serif cover title, legible cover meta.
