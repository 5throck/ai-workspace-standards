---
catalog-parity: skip  # variant-maintained fork — excluded from the root Variant-Exclusive catalog (W5 disposition)
name: pdf-export
scope: co-deck
version: 2.2.2
description: >
  Generates PDF from slide data using pdf-lib. Extracts slidedata.json, runs sample
  (5-slide) then full PDF generation scripts, reviews results. Reads the 4-layer
  spec merge (base → theme → style → overrides) directly — no Playwright measurement
  required. Responds to "make PDF", "export PDF", "convert to PDF". Stage 11 of
  the lecture workflow.
status: active
owner: pdf-export
last_reviewed: "2026-11-28"
prerequisites: prep-pdf
relates_to:
  - skill: research
    type: composes_with
  - skill: storyline
    type: composes_with
inputs: [slide-html]
outputs: [final-pdf]

metadata:
  type: process
  triggers:
    - pdf-export
    - make pdf
    - export pdf
    - convert to pdf
---

## Context

Generates the final lecture PDF from slide content using `pdf-lib`. The PDF renderer
uses a 4-layer spec merge (layout_base.json → theme pdf_layout_spec.json → style
pdf_color_spec.json → lecture-profile.md layout_overrides). No Playwright measurement
is required — the theme JSON files contain all calibrated layout values.

Runs a 5-slide sample first for Gate 5 review, then generates the full PDF after
user approval. Invoked at Stage 11, after the prep-pdf skill completes.

## When to Use

- PM Agent dispatches after prep-pdf skill completes
- User says "make PDF", "export PDF", "convert to PDF"
- After HTML or layout changes require PDF regeneration

---

## Execution Steps

### Step 1: Confirm Required Inputs

All inputs must exist before starting:

| File | Produced by |
|------|------------|
| `slidedata.json` | `extract_slidedata.mjs` (or prep-pdf --sample) |
| `deliverables/assets/fonts/<FontName>-Regular.ttf` | `download-font.ts` (or prep-pdf) |
| `deliverables/assets/fonts/<FontName>-Bold.ttf` | `download-font.ts` (or prep-pdf) |
| HTML file | Build Agent |
| `image-manifest.json` (optional) | Image Curator — `background_image` paths |
| `deliverables/assets/images/bg-*.<ext>` (optional) | Image Curator — background image files |

**Dependencies** (pre-installed via `bun install`):
- `pdf-lib` — PDF generation
- `fflate` — compression
- `@pdf-lib/fontkit` — Korean font embedding

**Font source of truth**: the sample/full PDF embeds fonts from
`deliverables/assets/fonts/` (default Pretendard Regular/Bold). That family is
the deck's typographic reference — the HTML deck must embed the same family
(html-build SKILL, "Font Parity"). Any font change lands in BOTH engines in one
change. Gate 5 sample review includes a font-parity spot-check (DG-DECK-06).

---

### Step 2: Extract slideData

If slidedata.json does not exist yet:

```bash
bun scripts/co-deck/extract_slidedata.mjs "path/to/lecture.html"
```

→ Produces `slidedata.json`

---

### Step 3: Generate Sample PDF (5 slides)

Before the full run, generate a 5-slide sample for layout sanity check.

```bash
bun scripts/co-deck/gen-slides-pdf.ts --project deliverables/<project> --sample 5
```

Share the sample with the user for review. If approved, proceed to Step 4 (★ Gate 5: approval required before full PDF).

---

### Step 4: Generate Full PDF

```bash
bun scripts/co-deck/gen-slides-pdf.ts --project deliverables/<project>

# Custom output filename:
bun scripts/co-deck/gen-slides-pdf.ts --project deliverables/<project> --out <filename>.pdf
```

**Layout customization** — edit `lecture-profile.md` → `layout_overrides`:

```yaml
layout_overrides:
  fonts:
    title_pt: 28
    bullet_pt: 13
  line_heights:
    title_px: 48
    bullet_px: 28
```

The `--auto-calibrate` flag can suggest starting values:

```bash
bun scripts/co-deck/gen-slides-pdf.ts --auto-calibrate --project deliverables/<project>
```

**Punchline override keys (v2.2.0; Amendment A — DEC-20261116-05):**

| Key | Effect |
|-----|--------|
| `fonts.punchline_sub_px` | Punchline sub-line size (zen theme spec default 46; Layer-0 fallback 16) |
| `fonts.punchline_sub_bold` | `true` renders the sub bold in the statement ink (opt-in; default regular/muted) |
| `fonts.punch_tag_px` | The gold "PART" tag size — decoupled from `punchline_sub_px` (Layer-0 default 16.0). Decks that previously moved the tag via `layout_overrides: fonts.punchline_sub_px` must now set this key explicitly. |

> **HTML-parity note**: multi-sentence punchlines are authored as one `\n`-separated title — both engines render each sentence as an equal bold line. The HTML zen punchline branch renders no sub at all (`text`/`sub` are a PDF-only layout aid).

**Background image rendering (v1.7.0):**

When `lecture-profile.md` has `background_image.enabled: true`, the PDF renderer applies image backgrounds per the configured scope:

| Scope | Slides affected |
|-------|---------------|
| `all` | Every slide |
| `divider-cover` | Title, divider, and punchline slides only |
| `individual` | Per-slide entries from `image-manifest.json` |

**Rendering pipeline**: full-bleed cover-crop → semi-transparent overlay (configured by `overlay.color` and `overlay.opacity`). Image paths are resolved from `image-manifest.json` first, then `slideData.backgroundImage`, then `fallback_color` solid fill.

---

### html-to-pdf — pixel-parity PDF from a built deck HTML (v1.3.0+)

`scripts/co-deck/html-to-pdf.ts` renders a built deck HTML straight to PDF (Puppeteer, system Chrome/Edge) — the pixel-parity companion to `gen-slides-pdf.ts` when the comparison target is the built HTML deck itself:

```bash
bun scripts/co-deck/html-to-pdf.ts --html deliverables/<project>/lecture_vN.html [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5] [--pages N]
```

`--pages N` renders only the first N slides (sample/preview runs).

- **Dual-selector slide discovery**: every theme today renders slides client-side as `div.slide` (ppt-engine runtime). The script counts both `div.slide` (runtime-rendered decks) and legacy static `<section>` decks and renders exactly ONE non-empty set — `.slide` wins when present, else `section` (never both, so hand-edited mixed decks cannot double-count). Legacy `<section>` decks render unchanged.
- **Zero-slide loud failure**: a deck containing NEITHER selector (e.g. a plain HTML page) prints an error naming the input and both selectors tried and exits 1 after cleanup — no PDF is written. The pre-v1.3.0 behavior (0-page PDF, exit 0) was the reported failure mode (U-20261116-008).
- **Footnote elements in the rendered DOM** (authored per the storyline contract, R4): the abbreviation pill `.slide-footnote` (slide-level, bottom-left, OUTSIDE the card) and the sources band `.slide-footnote.slide-notes` (in-card, muted line at the end of the content flow).

---

## Output Format

- `deliverables/<project>/[project]_v[version].pdf` — full presentation PDF
- `deliverables/<project>/sample_5slides.pdf` — sample for Gate 5 review
- `deliverables/<project>/speaker-notes_<lang>.txt` — speaker-notes handoff file, produced alongside the full PDF per the convention in [`docs/speaker-notes-export.md`](../../docs/speaker-notes-export.md)

## Related Skills

- `prep-pdf` — prepares fonts, validates spec merge, generates sample
- `version` — snapshot the HTML and layout files before regenerating the PDF
