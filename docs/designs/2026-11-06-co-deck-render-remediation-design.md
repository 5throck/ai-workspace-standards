# Design: co-deck render remediation batch (U-20261105-001/002/003/005)

**Date**: 2026-11-06
**Status**: implemented
**Scope**: `templates/co-deck/scripts/co-deck/**` (2 scripts + 4 new lib modules + 5 test files), `templates/co-deck/scripts/co-deck/SCRIPTS.md`, `templates/co-deck/docs/html-themes/themes/zen/pdf_layout_spec.json`
**Tickets**: U-20261105-001 (layout-gate schema), U-20261105-002 (3 render-path defects), U-20261105-003 (override parser parity), U-20261105-005 (font /W + zen PDF path items)
**Relation to prior spec**: extends the 2026-10-05-co-deck-review-remediation cluster's file ownership (S scripts: `templates/co-deck/scripts/co-deck/**`); this is a separate upstream-defect batch, registered as its own design.

## Context

Four upstream requests from the co-deck project (template_version 0.28.0), all reproduced independently against the template-managed files before fixing (per upstream-request policy). The requesting project carried a LOCAL-PATCH v1.14.x for U-005; this design is the template-side landing and supersedes that local patch.

## Root causes and decisions

### U-20261105-001 — layout-gate false FAILs on boolean-flag decks

**Repro**: synthetic 6-slide deck (isCover/isDivider/isPunchline/isContact/isProfile + 1 standard) against zen — every special slide ran the STANDARD min-content checks and failed (11 false violations).

**Root cause**: `estimate-layout.ts` lintSlideContent resolved the slide type with `s.type ?? 'standard'` (L424 pre-fix). Current slidedata.json uses boolean flags; the zen template's own `slideType()` checks `type` then `isPunchlineSlide/isTitleSlide/isDividerSlide/isProfileSlide/isContactSlide`.

**Decision (D1)**: extract schema detection to `lib/slide-type.ts` `slideTypeOf()` — legacy `type` string wins when present; then boolean flags in zen's precedence order accepting BOTH the long forms (isTitleSlide, isDividerSlide, isPunchlineSlide, isProfileSlide, isContactSlide — the html-build SKILL.md contract) and the short forms current decks emit (isCover, isDivider, isPunchline, isProfile, isContact); else `standard`. estimate-layout imports it. gen-slides-pdf's punchline dispatch also gains the `isPunchlineSlide` alias (see U-002c).

### U-20261105-003 — override parser asymmetry (silent dotted-key drop)

**Repro**: code-read confirmed the dialect split (estimate-layout: flat+dotted, no nested blocks; gen-slides-pdf: nested+flat, dotted keys matched no regex and were skipped silently — a `colors.card_dark: [...]` override passed the gate then never reached the renderer, reproducing the navy-card/illegible-SVG-ink failure mode on white-bubble).

**Decision (D2)**: TRUE PARITY via a shared module — `lib/layout-overrides.ts` exports `parseFrontmatter`, `parseLayoutOverrides`, `parseScalar`, `deepMerge`. The parser accepts the UNION dialect: flat keys, dotted keys (`fonts.title_px: 40`, `colors.card_dark: [R,G,B]`, `content_constraints.standard.max_body_chars: 140`), and nested-indented blocks — dotted and nested forms at the same path MERGE (the mixed-form profiles documented in the ticket keep working). Both scripts import the module; their private parser bodies are deleted. No new WARN path needed since parsing is now identical.

### U-20261105-002 — three gen-slides-pdf render-path defects

**Repro**: 5-slide zen/white-bubble deck with `background_image.enabled=false`, a visualImage slide, footnotes, an isPunchlineSlide slide, and a contact slide — content-stream analysis showed the C_VIS_BG-colored full-page fill AFTER the first text op (overpaint), bulTxtW negative (one word per bullet line), zero footnote text in `pdftotext`, punchline rendering through the standard path.

1. **(a) Visual overpaint** (D3): `renderStandardSlide` selected the visual path purely by `hasRight`, and drew the panel AFTER title/bullets. When the theme's visual region starts at/left of the content region (zen declares visual = full page), that order painted C_VIS_BG over the text and `bulTxtW = visR.x - contentR.x - 6` went negative. Fix: overlap-aware selection (`visualIsBackground = hasRight && visR.x <= contentR.x`). Background mode: visualImage → `placeImageCover` over the visual region + translucent C_DARK scrim behind the text band (zen-overlay parity); image-less visualTitle/visualDisplay → C_VIS_BG surface + centered panel text — both drawn BEFORE title/bullets with full content width. Non-overlapping themes (pitch family) keep the in-card right-panel path unchanged. Works with background_image enabled or disabled (the pre-fix behavior only worked in the bgDrawn=true case).
2. **(b) footnotes never rendered** (D4): per-slide `footnotes: string[]` renders after the slide-type renderer as a small muted bottom-left line, mirroring the shared FootnoteBuilder (ppt-engine.js): joined with `  ·  `, left/right 1.1rem, bottom 3.5rem band, 0.68rem font scaled by `font_px_to_pt`, muted color, wrap-enabled via multiCell.
3. **(c) punchline key mismatch** (D5): dispatch accepts `data.isPunchlineSlide` (html-build contract key) alongside the legacy `data.isPunchline`; same alias in `resolveBgImagePath` divider-cover scoping; `isPunchlineSlide` added to the SlideData interface.

### U-20261105-005 — Pretendard /W + zen PDF path items

1. **(1,2) /W + ToUnicode shaped-glyph gap** (D6) — root cause reproduced empirically: pdf-lib builds /W (computeWidths) and ToUnicode (createCmap) from the UNshaped glyph set (`glyphForCodePoint` over `font.characterSet`), but content-stream CIDs come from fontkit SHAPING (`font.layout`), which applies Pretendard's `calt` contextual alternates: ':' → gid 13147→**13205**, '-' → gid 13241→**13252** in running text. Those CIDs had no /W entry (viewers fall back to /DW (about 1000 units) and over-advance both characters — the reported "3-  Tier" gap and Korean punchline titles spreading space after the full-width colon) and no ToUnicode mapping (extraction garbles ':'). Fix: `lib/pdf-font-patch.ts` patches pdf-lib's CustomFontEmbedder — implementation notes: `allGlyphsInFontSortedById` is an instance arrow-field (prototype patching is a no-op), so the patch wraps the STATIC `for` factory and rebuilds the lazy glyphCache memo per embedder; pdf-lib's cjs and es builds can be distinct class objects, so both reachable copies are patched. The producer unions the base set with glyphs probed through shaping contexts ('A⟨ch⟩B', '2⟨ch⟩2' — full charSet sweep, ~2.2 s one-time). `computeWidths` (a real prototype method) additionally rounds /W entries to integers per PDF 32000-1 §9.7.4.3 (2048-upm fonts yield fractional widths; 0.5/1000 em error is invisible). Verified: embedded /W now contains 13205/13252 with integer entries; ToUnicode covers the alternates.
2. **(4) px→pt factor + HTML-matched sizes** (D7): zen spec `calibration.font_px_to_pt` 0.85 → 0.75 and fonts to the HTML-measured values (fullscreen: title 2rem=32px, cover clamp-max 4rem=64px, punchline 2rem×2=64px, divider clamp-max 3.5rem=56px, body 1rem=16px; line heights = size × 1.2 title / × 1.65 body / 0.6rem bullet gap). This is the ticket author's locally validated calibration (median gap 0.0%) moved upstream, as the ticket requests. Only the zen spec changes — other themes keep their current calibration.
3. **(6b) bold segments** (D8): `lib/markdown.ts` (pure, unit-tested) splits `**bold**` runs and wraps word-by-word with weight-aware measurement; `Renderer.multiCellMarkdown` draws bold words with the bold face + accent color (HTML `appendInline` parity). Wired into renderStandardSlide title + bullets. visualDisplay keeps strip() (the HTML visual panel renders structured lines, out of scope here).
4. **(7) contactPhone**: renderContactSlide renders `contactPhone` (nLines includes it) — the HTML contact renderer emits it (zen template.html) but the PDF renderer dropped it.
5. **(8) bgDrawn surface overpaint**: divider/punchline/profile/contact full-bleed C_BG fills are skipped when a background image was painted on the slide (new `bgDrawn` flag in RenderCtx) — previously the text floated transparent over the photo.

## Explicitly not fixed (documented follow-up)

- **Item 3** (card width fit-content vs fixed wide bar, 32–45% gap) and **item 5** (diagram-slide card margins): geometry parity requires Playwright-vs-PDF visual measurement harness; the numbers are visual-only and cannot be asserted programmatically here. The ticket's local CARD_RECTS_OUT comparison harness remains project-local.
- **Item 6a** (visualCaption / visualSource never rendered): neither field exists in the template's slidedata schema (SlideData, html-build SKILL.md, ppt-engine.js) — no producer emits them. Declared not-reproducible in template scope; if the project wants caption/source parity, the schema change should come through html-build first.
- Cover serif-font width gap (8–9% worst case): font availability issue, not a code defect.

## Test plan

- `tests/lib-layout-overrides.test.ts` (7 tests): dialect union + merge + deepMerge + CRLF.
- `tests/lib-slide-type.test.ts` (4 tests incl. 1 CLI e2e): schema detection + gate exit 0 with boolean-flag deck.
- `tests/lib-markdown.test.ts` (5 tests): run splitting, weight-aware wrap, \n breaks.
- `tests/lib-pdf-font-patch.test.ts` (4 tests): integer rounding, shaped closure (stub), patch idempotence, real-font coverage (skipIf no local font pool).
- `tests/gen-slides-pdf-render.test.ts` (5 e2e tests, font-conditional): full render → no C_VIS_BG fill after first text op; footnotes/punchline/contactPhone extractable; /W covers shaped gids 13205/13252 with integer entries.
- Existing suites stay green (`bun test scripts/co-deck/tests/` → 274 pass; `theme-visual-regression.test.ts` baseline-comparison fails identically on clean origin/main — pre-existing, requires locally generated baselines, out of scope).
- Root gates: `bun run test:unit`, `bun scripts/audit.ts`.

## Versioning

estimate-layout.ts 1.4.0 → **1.5.0**; gen-slides-pdf.ts 1.9.0 → **1.10.0**; new lib modules + tests at 1.0.0; `scripts/co-deck/SCRIPTS.md` rows updated/added. Template-local scripts are not listed in the workspace-root `docs/VERSION_MANIFEST.md` (that manifest has no template co-deck rows) — SCRIPTS.md is the variant-local registry, matching existing convention.
