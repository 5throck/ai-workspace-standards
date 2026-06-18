---
name: measure
phases: [4]
handoff_to: [pdf-export]
handoff_from: [html-build]
required_skills: [lecture-measure]
---

# Measure Agent — Layout Measurement

**Stage**: Stages 9-10 (layout measurement + font download)  
**Output**: `presentations/<project>/layout_spec.json`, `pdf_layout_spec.md`, `screenshots/`, `fonts/`

## Goal

Auto-extract pixel-level coordinates, fonts, and colors from the HTML slides into:
- `layout_spec.json` — numeric data consumed by the PDF generation script
- `pdf_layout_spec.md` — human-reviewable spec document
- `screenshots/` — per-slide-type capture images

---

## Stage 9: Auto Layout Measurement

### Prerequisites
```bash
pip install playwright pillow --break-system-packages
playwright install chromium
```

### Run
```bash
# Pass the HTML file path as an argument
python scripts/measure_layout.py "path/to/lecture_slide.html"
```

`scripts/measure_layout.py` automatically:
1. Starts a local HTTP server (port 18080)
2. Launches Chromium via Playwright
3. Visits the first slide of each type (cover, divider, standard)
4. Runs `getBoundingClientRect()` on key elements via JavaScript
5. Collects fonts/colors via `getComputedStyle()`
6. Saves screenshots
7. Generates `layout_spec.json` and `pdf_layout_spec.md`

### Measured Items

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

## Stage 10: Font Download

Secure TTF files for the web fonts used in the HTML. PDF generation requires local TTFs.

```bash
python scripts/download_font.py <font_name> [output_dir]
```

| Font name arg | Font |
|-----------|------|
| `maruburi` | MaruBuri (Naver, serif family) |
| `notosanskr` | Noto Sans KR (Google) |
| `nanumsquareneo` | NanumSquare Neo (Naver, sans-serif) |
| `pretendard` | Pretendard (open source, sans-serif) |

TTF files are saved to `fonts/`.

---

## Review Output

Once `pdf_layout_spec.md` is generated, share with the user to:
- Confirm measurements match the actual HTML
- Cross-check oddities against screenshots

---

## Core Tools

- `bash` — `measure_layout.py`, `download_font.py`
- `Write` (save output files)
- When HTML changes, layout_spec.json / pdf_layout_spec.md become invalid — snapshot them together via Version Agent

---

## Next Step

After measurement, advance automatically to Export Agent (`agents/pdf-export.md`).

> Reference: `references/measure_layout_guide.md` has the internals of `measure_layout.py` and customization notes.
