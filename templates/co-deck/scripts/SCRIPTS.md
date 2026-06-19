# SCRIPTS.md — co-deck Script Registry

> Lifecycle registry for `scripts/` in co-deck variant projects.
> Follows ADR-0036: TypeScript-only, executed via Bun.

---

## Architecture

All scripts are TypeScript executed via `bun`. Run `bun install` in the project root before first use.

**Invocation:**
```bash
bun scripts/<name>.ts [args]
```

---

## Package Dependencies

Install with `bun install` at project root:

| Package | Version | Used by |
|---------|---------|---------|
| `fflate` | `^0.8.2` | `download-font.ts` |
| `playwright` | `^1.45.0` | `measure-layout.ts` |
| `pdf-lib` | `^1.17.1` | `gen-slides-pdf.ts` |
| `@pdf-lib/fontkit` | `^1.1.1` | `gen-slides-pdf.ts` |

After playwright install, also run: `bunx playwright install chromium`

---

## Registry

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `download-font.ts` | 1.0.0 | active | Download Korean TTF fonts (MaruBuri, NotoSansKR, etc.) for PDF generation | `bun scripts/download-font.ts maruburi [fonts/]` |
| `extract_slidedata.mjs` | — | active | Extract slideData array from HTML file to slidedata.json | `bun scripts/extract_slidedata.mjs <html> [out.json]` |
| `gen-slides-pdf.ts` | 1.0.0 | active | Generate full or sample PDF deck from slidedata.json (use --sample N to limit) | `bun scripts/gen-slides-pdf.ts --project presentations/<proj> [--sample 5]` |
| `measure-layout.ts` | 1.0.0 | active | Measure HTML slide layout using Playwright; outputs layout_spec.json + pdf_layout_spec.md | `bun scripts/measure-layout.ts <html_file> [output_dir]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |

---

## Typical Workflow

```bash
# 1. Download fonts
bun scripts/download-font.ts maruburi

# 2. Extract slide data from HTML
bun scripts/extract_slidedata.mjs presentations/<project>/lecture.html

# 3. (Optional) Measure layout for calibration
bun scripts/measure-layout.ts presentations/<project>/lecture.html

# 4. Generate PDF
bun scripts/gen-slides-pdf.ts --project presentations/<project>

# 5. Generate 5-slide sample
bun scripts/gen-slides-pdf.ts --project presentations/<project> --sample 5

# 6. Snapshot before edits
bun scripts/snapshot.ts lecture.html --workspace presentations/<project> --desc "before chapter 3 edits" --agent content
```

*Last Updated: 2026-06-19 — Initial registry: converted 4 Python scripts to TypeScript (snapshot, download-font, measure-layout, gen-slides-pdf)*
