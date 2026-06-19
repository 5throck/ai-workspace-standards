---
name: measure
version: 1.2.0
description: >
  Auto-measures HTML slides with Playwright to extract pixel coordinates, fonts,
  and colors for PDF generation. Downloads required TTF fonts. Responds to
  "measure layout", "prep for PDF", "extract coordinates" (Korean: "레이아웃
  측정해줘", "PDF 준비해줘", "좌표 추출해줘", "폰트 확인해줘"). Stages 9-10
  of the lecture workflow.
status: active
owner: measure
last_reviewed: 2026-06-19
prerequisites: html-build
---

## Context

Auto-extracts pixel-level coordinates, fonts, and colors from the HTML slides using Playwright, producing `layout_spec.json` and `pdf_layout_spec.md` consumed by the PDF export scripts. Also downloads TTF font files required for PDF generation. Invoked at Stages 9-10, after Gate 4 (Build → Measure).

## When to Use

- PM Agent dispatches after Gate 4 (Build approval)
- User says "measure layout" / "레이아웃 측정해줘"
- After HTML changes that affect layout (must re-run before re-exporting PDF)

---

## Execution Steps

### Stage 9: Auto Layout Measurement

**Prerequisites:**

```bash
pip install playwright pillow --break-system-packages
playwright install chromium
```

**Run:**

```bash
python scripts/measure_layout.py "path/to/lecture_slide.html"
```

`measure_layout.py` automatically:
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
python scripts/download_font.py <font_name> [output_dir]
```

| Font name arg | Font |
|---------------|------|
| `maruburi` | MaruBuri (Naver, serif) |
| `notosanskr` | Noto Sans KR (Google) |
| `nanumsquareneo` | NanumSquare Neo (Naver, sans-serif) |
| `pretendard` | Pretendard (open source, sans-serif) |

TTF files are saved to `fonts/`.

**After measurement:** share `pdf_layout_spec.md` with the user to confirm measurements match the actual HTML. Cross-check any oddities against the saved screenshots.

> Reference: `references/measure_layout_guide.md` has `measure_layout.py` internals and customization notes.

---

## Output Format

- `presentations/<project>/layout_spec.json` — machine-readable pixel coordinates for PDF scripts
- `presentations/<project>/pdf_layout_spec.md` — human-readable measurement report with screenshots
- `fonts/<FontName>-Regular.ttf` / `fonts/<FontName>-Bold.ttf` — downloaded font files

## Related Skills

- `html-build` — produces the HTML file measured by this skill
- `pdf-export` — consumes `layout_spec.json` and the TTF fonts
- `version` — snapshot `layout_spec.json` + `pdf_layout_spec.md` together when HTML layout changes
