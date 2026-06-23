---
name: prep-pdf
version: 2.0.0
description: >
  Playwright-free PDF preparation. Reads lecture-profile.md, resolves the 4-layer
  spec merge, validates fonts, outputs a layout summary, and optionally generates
  a sample PDF. Replaces the deprecated measure skill (Playwright-dependent).
  Responds to "prep for PDF", "estimate layout", "check PDF layout".
  Stages 9-10 of the lecture workflow (simplified).
status: active
owner: pdf-export
last_reviewed: 2026-06-23
prerequisites: html-build
---

## Context

Prepares the project for PDF generation without requiring Playwright. The previous
`measure` skill used Playwright to measure rendered HTML, but its output was never
consumed by `gen-slides-pdf.ts`. The PDF renderer reads static theme JSON files via
a 4-layer merge (base → theme → style → overrides). This skill validates that all
pieces are in place and produces a summary of what the PDF will look like.

## When to Use

- PM Agent dispatches after Gate 4 (Build approval)
- User says "prep for PDF", "estimate layout", "check PDF layout"
- Before PDF export to verify fonts and spec merge

---

## Execution Steps

### Step 1: Estimate Layout

```bash
bun scripts/co-deck/estimate-layout.ts --project presentations/<project>
```

This automatically:
1. Reads `lecture-profile.md` (theme + style + layout_overrides)
2. Loads the 4-layer spec merge (base → theme → style → overrides)
3. Validates the merged spec has regions and slide types
4. Checks font availability (Pretendard or MaruBuri)
5. Outputs `layout_summary.md` to the project folder

No Playwright installation required.

### Step 2: Font Download (if needed)

If the font check reports missing fonts:

```bash
bun scripts/co-deck/download-font.ts pretendard
```

### Step 3: (Optional) Auto-Calibrate (CSS Estimation)

For new themes or when tuning layout, generate estimated overrides from CSS:

```bash
bun scripts/co-deck/gen-slides-pdf.ts --auto-calibrate --project presentations/<project>
```

This reads CSS custom properties and computes estimated `layout_overrides` values.
Copy the printed YAML block into `lecture-profile.md`.

### Step 4: (Optional) Iterative Calibration Loop

For precise layout tuning, run the numerical calibration loop:

```bash
bun scripts/co-deck/auto-calibrate.ts --project presentations/<project> --max-iter 3 --sample 5
```

This generates a 5-page sample PDF, converts it to images (requires `pdf-to-png-converter` v4),
numerically validates font sizes and line heights, auto-adjusts `layout_overrides`, and repeats
up to 3 iterations. After the loop, it prompts for user approval of the final values.

If `pdf-to-png-converter` is not installed, the step degrades gracefully — it still generates
the sample PDF and validates the spec merge, but skips image-based numerical validation.

### Step 5: Generate Sample PDF

```bash
bun scripts/co-deck/estimate-layout.ts --project presentations/<project> --sample
```

Or directly:
```bash
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project> --sample 5
```

---

## Output Format

- `presentations/<project>/layout_summary.md` — spec merge summary (regions, fonts, sizes)
- `presentations/<project>/sample_5slides.pdf` — sample for Gate 5 review (with --sample)
- `presentations/<project>/calibration_report.md` — iterative calibration results (with auto-calibrate.ts)

## Key Differences from Deprecated `measure` Skill

| Aspect | measure (deprecated) | prep-pdf (current) |
|--------|---------------------|-------------------|
| Playwright | Required | Not required |
| Output | layout_spec.json (unused) | layout_summary.md (review reference) |
| Screenshots | Yes (via Playwright) | No |
| Spec merge | No | Yes (4-layer preview) |
| Font check | Manual | Automatic |
| Sample PDF | Separate step | Integrated (--sample flag) |

## Related Skills

- `html-build` — produces the HTML file
- `pdf-export` — generates the final PDF (consumes the same 4-layer spec)
- `version` — snapshot files before PDF regeneration
