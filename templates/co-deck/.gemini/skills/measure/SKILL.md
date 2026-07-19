---
name: measure
scope: co-deck
version: 1.3.0
description: >
  Auto-measures HTML slides with Playwright to extract pixel coordinates, fonts,
  and colors for PDF generation. Downloads required TTF fonts. Responds to
  "measure layout", "prep for PDF", "extract coordinates" . Stages 9-10
  of the lecture workflow.
status: active
owner: measure
last_reviewed: 2026-06-20
prerequisites: html-build
---

## Context

Auto-extracts pixel-level coordinates, fonts, and colors from the HTML slides using Playwright, producing `layout_spec.json` and `pdf_layout_spec.md` consumed by the PDF export scripts. Also downloads TTF font files required for PDF generation. Invoked at Stages 9-10, after Gate 4 (Build → Measure).

## When to Use

- PM Agent dispatches after Gate 4 (Build approval)
- User says "measure layout"
- After HTML changes that affect layout (must re-run before re-exporting PDF)

---

## Execution Steps

### Stage 9: Auto Layout Measurement

**Prerequisites:**

```bash
# Playwright is an optionalDependency — install separately if not present:
bun add playwright
bunx playwright install chromium
```

**Run:**

```bash
bun scripts/co-deck/measure-layout.ts "path/to/lecture_slide.html"
```

`measure-layout.ts` automatically:
1. Starts a local HTTP server (port 18080)
2. Launches Chromium via Playwright
3. Visits the first slide of each type (cover, divider, standard)
4. Runs `getBoundingClientRect()` on key elements via JavaScript
5. Collects fonts/colors via `getComputedStyle()`
6. Saves screenshots
7. Generates `layout_spec.json` and `pdf_layout_spec.md`

**Measured items:**

| Item | Method |
|------|---------|
| Slide total size | `.slide` element rect |
| Card area | `.slide-card` or `.slide-content` rect |
| Header bar | `.slide-header` rect |
| Section label | `.section-label` rect + fontSize |
| Slide title | `.slide-title` rect + fontSize + color |
| Bullet area | `.bullets-container` rect |
| Right visual panel | `.visual-panel` rect |
| Divider part number | `.part-number` rect + fontSize |
| Divider title | `.divider-title` rect + fontSize |

Baseline slides measured:
- **Cover**: first slide with `isTitleSlide: true`
- **Divider**: first slide with `isDividerSlide: true`
- **Standard**: first standard slide with a visual panel

---

### Stage 10: Font Download

Secure TTF files for the web fonts used in the HTML. PDF generation requires local TTFs.

```bash
bun scripts/co-deck/download-font.ts <font_name> [output_dir]
```

| Font name arg | Font |
|---------------|------|
| `maruburi` | MaruBuri (Naver, serif) |
| `notosanskr` | Noto Sans KR (Google) |
| `nanumsquareneo` | NanumSquare Neo (Naver, sans-serif) |
| `pretendard` | Pretendard (open source, sans-serif) |

TTF files are saved to `fonts/`.

**After measurement:** share `pdf_layout_spec.md` with the user to confirm measurements match the actual HTML. Cross-check any oddities against the saved screenshots.

---

## Output Format

- `presentations/<project>/layout_spec.json` — machine-readable pixel coordinates for PDF scripts
- `presentations/<project>/pdf_layout_spec.md` — human-readable measurement report with screenshots
- `fonts/<FontName>-Regular.ttf` / `fonts/<FontName>-Bold.ttf` — downloaded font files

## Related Skills

- `html-build` — produces the HTML file measured by this skill
- `pdf-export` — consumes `layout_spec.json` and the TTF fonts
- `version` — snapshot `layout_spec.json` + `pdf_layout_spec.md` together when HTML layout changes
