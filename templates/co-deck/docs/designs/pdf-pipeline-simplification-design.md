# PDF Pipeline Simplification: Playwright-Free Layout Preparation

**Status**: ✅ Implemented  
**Date**: 2026-06-23  
**Variant**: co-deck  

---

## Problem

The Measure step (Stage 9-10) in the co-deck PDF pipeline required Playwright installation and manual review every time, yet its output (`layout_spec.json`) was **never consumed** by `gen-slides-pdf.ts`. The renderer reads static theme JSON files via a 4-layer spec merge. Users had to perform comprehensive manual adjustments (fonts, line heights, regions, padding) after every measure run because:

1. **Architectural disconnect**: `measure-layout.ts` outputs `layout_spec.json` but `gen-slides-pdf.ts` reads `pdf_layout_spec.json` from theme directories
2. **Playwright friction**: Installation (`bun add playwright && bunx playwright install chromium`) was problematic on Windows and slow on CI
3. **Calibrated constants**: `fonts` and `line_heights` in theme JSON files were hand-tuned values, not Playwright-derived measurements
4. **Single-slide sampling**: Only the first occurrence of each slide type was measured

## Solution

### Remove Playwright dependency

Replace `measure-layout.ts` (Playwright-based) with `estimate-layout.ts` (pure TypeScript):

- **No external dependencies** — uses only bun stdlib
- Reads `lecture-profile.md` to determine theme + style
- Resolves the full 4-layer spec merge (base → theme → style → overrides)
- Validates font availability (Pretendard / MaruBuri)
- Outputs `layout_summary.md` with regions, fonts, sizes, constraints
- Optionally triggers `--sample 5` PDF generation directly

### Add auto-calibrate utility

New `--auto-calibrate` flag on `gen-slides-pdf.ts`:

- Reads CSS custom properties from `base.css`, `theme.css`, `style.css`
- Extracts `--font-size-title`, `--bullet-gap`, `--line-height-body`, etc.
- Computes estimated `fonts` and `line_heights` using calibrated multipliers
- Validates `line_mm > font_mm` constraint
- Prints copy-pasteable YAML block for `lecture-profile.md`

### Streamline pipeline

**Before** (11 stages):
```
html-build → measure (Playwright) → download-font → extract_slidedata → gen-slides-pdf
```

**After** (9 stages):
```
html-build → prep-pdf (no Playwright) → extract_slidedata → gen-slides-pdf
```

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `scripts/co-deck/estimate-layout.ts` | **CREATE** | New Playwright-free prep script (v1.0.0) |
| `scripts/co-deck/measure-layout.ts` | DEPRECATE | Added deprecation header, file kept |
| `scripts/co-deck/gen-slides-pdf.ts` | UPDATE | Added `--auto-calibrate` flag (v1.4.0 → v1.5.0) |
| `skills/prep-pdf/SKILL.md` | **CREATE** | New skill replacing `measure` (v2.0.0) |
| `skills/pdf-export/SKILL.md` | UPDATE | Removed `layout_spec.json` prerequisite (v1.3.0 → v2.0.0) |
| `.claude/skills/pdf-export/SKILL.md` | UPDATE | Platform-specific sync |
| `.gemini/skills/pdf-export/SKILL.md` | UPDATE | Platform-specific sync |
| `agents/measure.md` | UPDATE | Rebranded as Playwright-free prep agent (v1.0.0 → v2.0.0) |
| `agents/pdf-export.md` | UPDATE | Updated prerequisites, removed Measure Agent refs (v1.1.0 → v2.0.0) |
| `scripts/co-deck/SCRIPTS.md` | UPDATE | Added estimate-layout, deprecated measure-layout |
| `variant.json` | UPDATE | Added `estimate-layout` to script_manifest, `prep-pdf` to skills |

## Files NOT Changed

- `pdf_layout_spec.json` (5 themes) — remain SSOT for layout
- `layout_base.json` — unchanged
- `pdf_color_spec.json` (5 styles) — unchanged
- `extract_slidedata.mjs` — unchanged
- `download-font.ts` — unchanged (still used by prep-pdf)
- `base.css` / `theme.css` / `style.css` — unchanged

## Key Design Decisions

### D1: Keep measure-layout.ts as deprecated (not deleted)

Rationale: Some users may still want Playwright measurement for debugging or new theme development. The deprecation header clearly explains why it's no longer in the workflow and what to use instead.

### D2: estimate-layout.ts does NOT modify JSON spec files

Rationale: Theme `pdf_layout_spec.json` files are the SSOT for layout. The estimate script only reads and summarizes. Per-project tuning goes through `layout_overrides` in `lecture-profile.md` (Layer 3 of the 4-layer merge).

### D3: Auto-calibrate is a flag on gen-slides-pdf.ts, not a separate script

Rationale: It needs access to the same theme/style resolution logic. Keeping it as a flag avoids code duplication. The `--auto-calibrate` mode exits early (no PDF generation) — it's a separate concern within the same entry point.

### D4: Calibrated multipliers for CSS→PDF estimation

The auto-calibrate feature uses:
- `FONT_PT_MULT = 0.85` (CSS px → PDF pt): accounts for the fact that PDF-optimized font sizes are intentionally different from CSS
- `LINE_H_MULT = 1.85` (CSS px → viewport_px): accounts for the viewport-scaled line height system used by `buildCoords().px2mm()`

These multipliers produce estimates that are close enough to get a usable first draft without manual adjustment, while acknowledging that per-theme tuning in the JSON specs remains the precise source of truth.

## Usage Examples

### Basic prep (replaces measure)
```bash
bun scripts/co-deck/estimate-layout.ts --project presentations/my-deck
```

### Prep + sample in one command
```bash
bun scripts/co-deck/estimate-layout.ts --project presentations/my-deck --sample
```

### Auto-calibrate for a new project
```bash
bun scripts/co-deck/gen-slides-pdf.ts --auto-calibrate --project presentations/my-deck
```

### Full PDF workflow (measure-free)
```bash
bun scripts/co-deck/estimate-layout.ts --project presentations/my-deck
bun scripts/co-deck/extract_slidedata.mjs presentations/my-deck/lecture.html
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/my-deck --sample 5
# Review sample, then:
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/my-deck
```

### Iterative calibration loop
```bash
bun scripts/co-deck/auto-calibrate.ts --project presentations/my-deck --max-iter 3 --sample 5
```

---

## Phase 2: Auto-Calibration Loop & OS-Aware Font Handling

**Status**: ✅ Implemented
**Date**: 2026-06-23

### Problem

Phase 1 replaced Playwright with static CSS estimation (`--auto-calibrate`), but two gaps remained:

1. **No visual validation**: The CSS estimation produces approximate `layout_overrides`, but there was no automated way to verify the result actually looks correct in a rendered PDF. Users had to manually review each sample PDF.

2. **Hardcoded font paths**: Multiple scripts (`diagram-helpers.ts`, `download-font.ts`, `gen-slides-pdf.ts`, `estimate-layout.ts`) contained hardcoded font candidate lists with Unix-style paths that didn't work on Windows or macOS.

### Solution

#### Auto-calibration loop (`auto-calibrate.ts`)

New standalone script that iteratively refines `layout_overrides`:

1. **Generate sample PDF**: Calls `gen-slides-pdf.ts --sample 5` to produce a 5-page PDF
2. **Convert to images**: Uses `pdf-to-png-converter` v4 (pre-built native binaries, no build step) to render each page as a PNG
3. **Numerical validation**: Checks font sizes (8pt–60pt bounds) and `line_mm > font_mm` constraint
4. **Auto-adjust**: If issues found — increases line_height by 15%, decreases font by 5% (or sets font to 10pt if too small)
5. **Repeat**: Up to 3 iterations (configurable via `--max-iter`)
6. **User approval**: Prompts for acceptance of the final calibrated values

Graceful degradation: if `pdf-to-png-converter` is not installed, the script still validates the spec merge and generates the sample PDF, but skips image-based numerical validation.

#### OS-aware font handling

Consistent pattern applied across all font-consuming scripts:

| Platform | Font directories searched |
|----------|--------------------------|
| **Windows** (`win32`) | `presentations/assets/fonts/` (project), `C:/Windows/Fonts/` |
| **macOS** (`darwin`) | `presentations/assets/fonts/` (project), `~/Library/Fonts/`, `/Library/Fonts/` |
| **Linux** | `presentations/assets/fonts/` (project), `~/.local/share/fonts/`, `/usr/share/fonts/` |

Each script searches the project `presentations/assets/fonts/` directory first, then OS-specific system directories. Font family candidates vary by platform (e.g., Windows includes malgun/HANDotum, macOS includes system Noto/PingFang).

### Files Changed (Phase 2)

| File | Action | Description |
|------|--------|-------------|
| `scripts/co-deck/auto-calibrate.ts` | **CREATE** | Iterative calibration loop (v1.0.0) |
| `scripts/co-deck/download-font.ts` | UPDATE | OS-aware defaults + system font detection (v1.0.0 → v2.0.0) |
| `scripts/co-deck/diagram-helpers.ts` | UPDATE | OS-aware font candidates via `systemFontCandidates` IIFE (v1.0.0 → v1.1.0) |
| `scripts/co-deck/estimate-layout.ts` | UPDATE | OS-aware font search (v1.0.0 → v1.1.0) |
| `scripts/co-deck/gen-slides-pdf.ts` | UPDATE | OS-aware FONT_FAMILIES + sysFontDirs (v1.5.0 → v1.6.0) |
| `package.json` | UPDATE | Added `pdf-to-png-converter` to optionalDependencies, `auto-calibrate` npm script |
| `scripts/co-deck/SCRIPTS.md` | UPDATE | Added auto-calibrate.ts to registry, updated versions, updated workflow |
| `variant.json` | UPDATE | Added `auto-calibrate` to script_manifest.local |
| `skills/prep-pdf/SKILL.md` | UPDATE | Added Step 4: Iterative Calibration Loop |

### Key Design Decisions (Phase 2)

#### D5: Separate script for calibration loop (not a flag)

Rationale: The calibration loop is a multi-iteration workflow with its own state management (iteration tracking, adjustment history, report generation). Embedding it in `gen-slides-pdf.ts` would bloat the main PDF generation path. A separate script keeps concerns isolated.

#### D6: pdf-to-png-converter v4 over resvg

Rationale: `@resvg/resvg-js` only supports SVG→PNG conversion, not PDF→PNG. `pdf-to-png-converter` v4 provides pre-built native binaries for all platforms (win32, darwin, linux) with no compilation step. Placed in `optionalDependencies` to avoid breaking installations that don't need calibration.

#### D7: OS font paths from process.platform (not config file)

Rationale: The OS font directories are well-known and platform-standard. A config file would add maintenance burden for information that doesn't change. The `platform()` + `homedir()` approach is idiomatic Node.js and covers the vast majority of installations. Custom font directories can still be specified via CLI flags (`--font-dir`).

#### D8: Graceful degradation when pdf-to-png-converter is missing

Rationale: The calibration loop's core value (sample PDF generation + spec validation) doesn't require image conversion. Image-based validation is an enhancement, not a requirement. Making the dependency optional ensures the script works in minimal installations.
