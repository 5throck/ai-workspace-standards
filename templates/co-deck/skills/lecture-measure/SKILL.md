---
name: lecture-measure
version: 1.0.0
description: >
  Auto-measures HTML slides with Playwright to extract coordinates, fonts,
  colors for PDF generation. Runs local server, getBoundingClientRect polling,
  slide capture. Also downloads TTF fonts. Responds to "measure layout",
  "prep for PDF", "extract coordinates" (Korean: "레이아웃 측정해줘", "PDF
  준비해줘", "좌표 추출해줘", "폰트 확인해줘"). Stages 9-10 of the workflow.
---
# Measure Agent — Layout Measurement

**Stage**: Stages 9-10 (layout measurement + font download)  
**Output**: `presentations/<project>/layout_spec.json`, `pdf_layout_spec.md`, `fonts/`  
**Full instructions**: `agents/measure.md`

## Role

Auto-extracts pixel-level coordinates, fonts, and colors from the HTML slides using Playwright.
Produces `layout_spec.json` (consumed by PDF scripts) and `pdf_layout_spec.md` (human-readable spec).
Also downloads TTF font files required for PDF generation.

## When to Invoke

- PM Agent dispatches automatically after Gate 4 (Build → Measure)
- User says "measure layout" / "레이아웃 측정해줘"
- After HTML changes that affect layout (must re-run)

## Quick Reference

**Prerequisites**:
```bash
pip install playwright pillow --break-system-packages
playwright install chromium
```

**Run measurement**:
```bash
python scripts/measure_layout.py presentations/<project>/lecture_vN.html
```

**Download fonts**:
```bash
python scripts/download_font.py maruburi        # MaruBuri (serif, recommended)
python scripts/download_font.py nanumsquareneo  # NanumSquare Neo
python scripts/download_font.py notosanskr      # Noto Sans KR
python scripts/download_font.py pretendard      # Pretendard
```

**Note**: When HTML layout changes, `layout_spec.json` and `pdf_layout_spec.md` become invalid — snapshot both via Version Agent and re-run measurement.

**Next step**: Advance automatically to Export Agent (`agents/pdf-export.md`).

→ Measured items table, script internals, customization notes: see `agents/measure.md`
