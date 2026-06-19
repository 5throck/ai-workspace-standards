---
name: pdf-export
version: 1.0.0
description: >
  Generates PDF from measured layout spec and slide data using fpdf2. Extracts
  slidedata.json, runs PDF gen scripts, reviews results. Requires layout_spec.json
  and font TTFs. Responds to "make PDF", "export PDF", "convert to PDF" (Korean:
  "PDF 만들어줘", "PDF 출력해줘", "PDF로 변환해줘"). Stage 11 of the workflow.
---
# Export Agent — PDF Export

**Stage**: Stage 11 (PDF generation)  
**Output**: `presentations/<project>/<project>.pdf`  
**Full instructions**: `agents/pdf-export.md`

## Role

Generates the final PDF from measured layout data and slide content.
Runs sample (5 slides) first for review, then full PDF after user approval.

## When to Invoke

- PM Agent dispatches after Measure Agent completes
- User says "make PDF" / "PDF 만들어줘" / "PDF 출력해줘"
- After HTML or layout changes require PDF regeneration

## Quick Reference

**Required inputs**:
| File | Producer |
|------|---------|
| `layout_spec.json` | Measure Agent |
| `fonts/*.ttf` | Measure Agent (download_font.py) |
| HTML file | Build Agent |

**Step 1 — Extract slide data**:
```bash
bun scripts/extract_slidedata.mjs presentations/<project>/lecture_vN.html
# or: node scripts/extract_slidedata.mjs ...
# → /tmp/slidedata.json
```

**Step 2 — Generate sample (5 slides)**:
```bash
python scripts/gen_sample5.py --project presentations/<project>
```

**Step 3 — Full PDF** (after ★ Gate 5 approval):
```bash
python scripts/gen_full.py --project presentations/<project>
# Custom filename:
python scripts/gen_full.py --project presentations/<project> --out <name>.pdf
```

**Install dependencies**:
```bash
pip install fpdf2 pillow --break-system-packages
```

→ Script customization constants, slide-type rendering logic: see `agents/pdf-export.md`
