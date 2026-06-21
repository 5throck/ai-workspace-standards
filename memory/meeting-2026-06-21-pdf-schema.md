# Meeting Transcript
**Date**: 2026-06-21
**Topic**: co-deck PDF rendering architecture — pdf_layout_spec.json key schema and slideshow theme PDF rendering strategy
**Participants**: html-build, design, storyline, version (synthesizer)
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Follow-up to meeting-2026-06-21-theme-pdf-layout.md. Two open questions from that synthesis:
1. Exact key schema for `pdf_layout_spec.json` — what fields are mandatory vs optional, how coordinates map to current gen-slides-pdf.ts hardcoded values
2. `slideshow` theme PDF rendering strategy — whether a separate renderer is needed or gen-slides-pdf.ts can be extended

Source code analyzed: `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts`

---

## Transcript

### Round 1

**[html-build]**: (Round 1)

Analyzed the full gen-slides-pdf.ts code. The most critical decision for schema design is how to express the `px2pt`/`px2mm` conversion function as a spec field.

Current code:
```typescript
const px2mm = (px: number) => (px / 611.4) * CH;
```

The `611.4` value is the viewport pixel width measured by Playwright — derived from the HTML theme's viewport size. This number is **theme-dependent**: if slideshow uses a different viewport, this value differs.

Proposed 4-section `pdf_layout_spec.json` schema:
```json
{
  "version": "1.0.0",
  "page": {
    "width_mm": 338.7,
    "height_mm": 190.5,
    "margin_mm": 5.0,
    "aspect_ratio": "16:9"
  },
  "calibration": {
    "viewport_px": 611.4
  },
  "layout": {
    "pad_x_pct":     0.0438,
    "header_y_pct":  0.091,
    "header_h_pct":  0.064,
    "title_y_pct":   0.224,
    "main_y_pct":    0.349,
    "bullet_w_pct":  0.503,
    "vis_x_pct":     0.584,
    "vis_y_pct":     0.390,
    "vis_w_pct":     0.372,
    "vis_h_pct":     0.561,
    "vis_pad_pct":   0.052,
    "ts_title_y_pct":  0.3967,
    "ts_sub_y_pct":    0.5346,
    "ts_meta_y_pct":   0.6676,
    "ts_w_pct":        0.9123,
    "div_img_x_pct":   0.5582,
    "div_img_y_pct":   0.2613,
    "div_img_w_pct":   0.3972,
    "div_img_h_pct":   0.6059,
    "div_txt_w_pct":   0.4766
  },
  "fonts": {
    "title_pt":       28.0,
    "bullet_pt":      12.5,
    "div_title_pt":   28.0,
    "div_desc_pt":    13.0,
    "section_px":     13.6,
    "slide_num_px":   14.4,
    "vis_title_px":   13.6,
    "vis_body_px":    16.0,
    "ts_title_px":    56.0,
    "ts_sub_px":      24.0,
    "ts_meta_px":     16.0,
    "div_part_px":    22.4
  },
  "line_heights": {
    "title_px":      46.0,
    "bullet_px":     29.44,
    "bullet_gap_px": 19.2,
    "ts_title_px":   70.0,
    "div_title_px":  56.0,
    "div_desc_px":   28.16
  }
}
```

Mandatory vs optional:
- `page`, `calibration.viewport_px`, `layout` — all **required**
- `fonts.title_pt`, `fonts.bullet_pt` — **required**
- Other `fonts.*` and `line_heights.*` — **optional** (fallback to script defaults)

Question to design: Is RGB array sufficient for `pdf_color_spec.json` or do we need role names?

---

**[design]**: (Round 1)

Support html-build's 4-section schema. The `calibration.viewport_px` as a separate section is especially good — it makes the theme dependency explicit.

RGB arrays alone are insufficient for `pdf_color_spec.json` — **role-based naming is required**:
1. gen-slides-pdf.ts references colors by semantic names (`C_BG`, `C_ACCENT`, etc.). Without names, index-based access loses meaning.
2. New style authors need to know "which role gets which color."

Proposed `pdf_color_spec.json` schema:
```json
{
  "version": "1.0.0",
  "colors": {
    "background":    [17,  24,  39],
    "card_dark":     [11,  15,  25],
    "card_dark2":    [20,  28,  42],
    "card_dark3":    [10,  14,  22],
    "card_dark4":    [8,   12,  22],
    "text_primary":  [226, 232, 240],
    "text_body":     [203, 213, 225],
    "text_muted":    [156, 163, 175],
    "text_meta":     [100, 108, 120],
    "accent":        [217, 119, 6],
    "border":        [31,  41,  55],
    "white":         [255, 255, 255]
  }
}
```

Referenced as `spec.colors.background` in gen-slides-pdf.ts. Aligns with 3-layer merge: `lecture-profile.md` `layout_overrides.colors.accent` overrides this value.

On slideshow PDF rendering: current gen-slides-pdf.ts assumes `isTitleSlide`, `isDividerSlide` flags from scroll theme. Are those flags valid in slideshow?

---

**[storyline]**: (Round 1)

Answering design's question on slide type differences:

**Shared slide types** (both themes):
- Title slide (`isTitleSlide: true`) — cover, speaker intro
- Standard slide — title + bullets

**scroll-only types**:
- Divider slide (`isDividerSlide: true`) — part boundary markers; required by scroll's recommended_structure

**slideshow-only types** (not currently in script):
- `punchline` — single large-font impact statement, no bullets; mentioned in slideshow's recommended_structure

Conclusion: `isDividerSlide` is irrelevant for slideshow (absent from theme, no issue); `isPunchline` is slideshow-only and currently has no render function.

Question to html-build: slideshow displays full-bleed per slide. Should `margin_mm` be 0 for slideshow PDF, making page geometry different from scroll?

---

### Round 2

**[html-build]**: (Round 2)

The full-bleed vs card-layout geometry difference is important. Resolution: use `margin_mm` in `pdf_layout_spec.json` directly.

- scroll theme: `margin_mm: 5.0` → card effect
- slideshow theme: `margin_mm: 0.0` → full-bleed PDF

gen-slides-pdf.ts reads `CM = spec.page.margin_mm` — handled automatically.

**Single renderer extension (recommended over separate script)**:
1. `Renderer` class core logic (`fillRect`, `cell`, `multiCell`, `placeImage`) is theme-agnostic
2. Theme differences are only: (a) page geometry, (b) render functions

Add to existing script:
- `renderPunchlineSlide()` function (slideshow only)
- Theme-based dispatch from `lecture-profile.md`'s `presentation.theme`:

```typescript
if (data.isPunchline && theme === 'slideshow') {
  await renderPunchlineSlide(renderer, pdfDoc, data, n, TOTAL);
} else if (data.isDividerSlide && theme === 'scroll') {
  await renderDividerSlide(renderer, pdfDoc, data, n, TOTAL, imgDir);
}
```

No separate script file needed.

Question to design: Does `punchline` slide need additional color roles beyond `text_primary` and `accent`?

---

**[design]**: (Round 2)

Single renderer extension approach confirmed. `margin_mm: 0.0` cleanly handles geometry.

No additional color roles needed for `punchline` slides:
- Background: `background` (or image overlay)
- Main statement: `text_primary` (large, bold)
- Emphasis word/number: `accent`
- Sub-text: `text_muted`

However, `punchline` slide needs font sizes not in the current fonts section. Add to slideshow's `pdf_layout_spec.json`:
```json
"fonts": {
  ...
  "punchline_pt": 48.0,
  "punchline_sub_pt": 20.0
}
```

These are optional fields — not present in scroll theme's spec.

Discussion has converged. Requesting version synthesis.

---

**[storyline]**: (Round 2)

Agree with html-build and design conclusions. One content-structure addition:

`isPunchline` flag must be added to `SlideData` interface in gen-slides-pdf.ts:
```typescript
interface SlideData {
  ...
  isPunchline?: boolean;  // slideshow theme only
}
```

Storyline agent must also know to output `isPunchline: true` in slide_deck.md when using slideshow theme. Propose managing this via `slide_types` field in `theme.json`:

```json
"slide_types": {
  "title": true,
  "divider": false,
  "punchline": true,
  "standard": true
}
```

This lets Storyline auto-detect available slide types, and gen-slides-pdf.ts can read this to configure render function dispatch.

---

## Synthesis

**[version]**: (Synthesis)

Full consensus on both agenda items.

**Agenda 1 — pdf_layout_spec.json key schema**:

Agreed 4-section structure:
- `page`: `width_mm`, `height_mm`, `margin_mm`, `aspect_ratio` — all **required**
- `calibration`: `viewport_px` — **required** (theme-dependent; different themes have different values)
- `layout`: all 19 `*_pct` fields — **required**
- `fonts`: `title_pt`, `bullet_pt` — **required**; other `*_px` fields — **optional**
- `line_heights`: all — **optional**
- `slide_types`: `title`, `divider`, `punchline`, `standard` (bool) — **theme capability declaration** (storyline proposal, new)

`pdf_color_spec.json`: 12 role-based keys with RGB array values.

**Agenda 2 — slideshow theme PDF rendering strategy**:

- **Single script** (`gen-slides-pdf.ts`): no separate file needed
- `margin_mm: 0.0` → full-bleed geometry for slideshow
- Add `renderPunchlineSlide()` function
- Add `isPunchline?: boolean` to `SlideData` interface
- Theme dispatch via `lecture-profile.md` `presentation.theme`
- slideshow's `pdf_layout_spec.json` adds `fonts.punchline_pt: 48.0`, `fonts.punchline_sub_pt: 20.0`

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| B-01 | html-build | Medium | `docs/html-themes/themes/scroll/pdf_layout_spec.json` — 4-section schema; `margin_mm: 5.0`; `calibration.viewport_px: 611.4`; all `*_pct` and `fonts.*` values extracted from current hardcoding | Both | Next |
| B-02 | html-build | Medium | `docs/html-themes/themes/slideshow/pdf_layout_spec.json` — `margin_mm: 0.0`; `viewport_px: TBD` (Playwright re-measurement needed); `slide_types: {divider: false, punchline: true}`; `fonts.punchline_pt: 48.0` | Both | Next |
| B-03 | design | Low | `docs/html-themes/styles/<name>/pdf_color_spec.json` (4 styles: classic/minimal/visual-heavy/academic) — 12 role-based RGB keys | Both | Next |
| B-04 | html-build | Medium | Refactor `gen-slides-pdf.ts` — (1) 3-layer merge logic, (2) `renderPunchlineSlide()`, (3) `isPunchline?: boolean` in `SlideData`, (4) theme-based dispatch from `presentation.theme` | Both | Next |
| B-05 | design | Low | Add `slide_types` field to `scroll/theme.json` and `slideshow/theme.json`; update `agents/storyline.md` with `isPunchline` generation rule for slideshow theme | Both | Next |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `gen-slides-pdf.ts` reads no hardcoded geometry/color values | grep for `338.7`, `190.5`, `C_BG` literals returns 0 results |
| 2 | scroll theme PDF renders identically to current output | visual comparison of sample PDF before/after refactor |
| 3 | slideshow theme PDF renders with `margin_mm: 0.0` full-bleed | sample PDF inspection |
| 4 | `isPunchline: true` slide renders via `renderPunchlineSlide()` | manual test with slideshow theme project |
| 5 | 3-layer merge: `layout_overrides.colors.accent` overrides `pdf_color_spec.json` accent | unit test or manual verification |
