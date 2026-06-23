---
name: pdf-export
version: 2.1.0
description: >
  Generates PDF from slide data using pdf-lib. Extracts slidedata.json, runs sample
  (5-slide) then full PDF generation scripts, reviews results. Uses the 4-layer spec
  merge (base → theme → style → overrides) — no Playwright required. Responds to
  "make PDF", "export PDF", "convert to PDF" (Korean: "PDF 만들어줘", "PDF 출력해줘",
  "PDF로 변환해줘"). Stage 11 of the lecture workflow.
status: active
owner: pdf-export
last_reviewed: 2026-06-23
prerequisites: prep-pdf
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
- User says "make PDF" / "PDF 만들어줘" / "PDF 출력해줘"
- After HTML or layout changes require PDF regeneration

---

## Execution Steps

### Step 1: Confirm Required Inputs

| File | Produced by |
|------|------------|
| `slidedata.json` | `extract_slidedata.mjs` (or prep-pdf --sample) |
| `fonts/<FontName>-Regular.ttf` | `download-font.ts` (or prep-pdf) |
| `fonts/<FontName>-Bold.ttf` | `download-font.ts` (or prep-pdf) |
| HTML file | Build Agent |

### Step 2: Extract slideData

```bash
bun scripts/co-deck/extract_slidedata.mjs "path/to/lecture.html"
```

### Step 3: Generate Sample PDF (5 slides)

```bash
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project> --sample 5
```

Share the sample with the user for review. If approved, proceed to Step 4 (★ Gate 5).

### Step 4: Generate Full PDF

```bash
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project>
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

Or use `--auto-calibrate` for estimated values:

```bash
bun scripts/co-deck/gen-slides-pdf.ts --auto-calibrate --project presentations/<project>
```

**Background image rendering (v1.7.0):**

When `lecture-profile.md` has `background_image.enabled: true`, the PDF renderer applies image backgrounds per the configured scope:

| Scope | Slides affected |
|-------|---------------|
| `all` | Every slide |
| `divider-cover` | Title, divider, and punchline slides only |
| `individual` | Per-slide entries from `image-manifest.json` |

**Rendering pipeline**: full-bleed cover-crop → semi-transparent overlay (configured by `overlay.color` and `overlay.opacity`). Image paths resolved from `image-manifest.json` first, then `slideData.backgroundImage`, then `fallback_color` solid fill.

---

## Output Format

- `presentations/<project>/[project]_v[version].pdf` — full presentation PDF
- `presentations/<project>/sample_5slides.pdf` — sample for Gate 5 review

## Related Skills

- `prep-pdf` — prepares fonts, validates spec merge, generates sample
- `version` — snapshot the HTML and layout files before regenerating the PDF
