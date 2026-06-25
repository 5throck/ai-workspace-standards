# SCRIPTS.md — co-deck Variant Scripts

> Lifecycle registry for co-deck variant-specific scripts in `scripts/co-deck/`.
> These scripts are co-deck only; they do NOT appear in the L1 common `scripts/SCRIPTS.md`.
> Executed via Bun per ADR-0036. Run `bun install` in project root before first use.

---

## Architecture

All scripts are TypeScript executed via `bun`. They live in `scripts/co-deck/` to avoid
the L1 audit's top-level `scripts/*.ts` scan (`verifyScriptRegistryConsistency`).

**Invocation:**
```bash
bun scripts/co-deck/<name>.ts [args]
# or via npm scripts:
bun run <script-name>
```

---

## Package Dependencies

Install with `bun install` at project root:

| Package | Version | Used by | Type |
|---------|---------|---------|------|
| `fflate` | `^0.8.2` | `download-font.ts` | required |
| `pdf-lib` | `^1.17.1` | `gen-slides-pdf.ts` | required |
| `@pdf-lib/fontkit` | `^1.1.1` | `gen-slides-pdf.ts` | required |
| `playwright` | `^1.45.0` | `measure-layout.ts` | **deprecated** |
| `@resvg/resvg-js` | `^2.6.2` | `gen-visual-images.ts` | required |
| `pdf-to-png-converter` | `^4.1.0` | `auto-calibrate.ts` | optional |

`playwright` is declared as `optionalDependencies` — **deprecated**. The `measure-layout.ts` script
that required it is deprecated; use `estimate-layout.ts` instead (no Playwright dependency).
`pdf-to-png-converter` is optional — used by `auto-calibrate.ts` for PDF→image conversion in the
iterative calibration loop. Pre-built native binaries, no build step required.

---

## Registry

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `download-font.ts` | 2.0.0 | active | Download Korean TTF fonts (MaruBuri, NotoSansKR, etc.) for PDF generation; **v2.0.0**: OS-aware default font directory, system font detection skips download if all fonts found | `bun scripts/co-deck/download-font.ts maruburi [fonts/]` |
| `gen-slides-pdf.ts` | 1.7.0 | active | Generate full or sample PDF deck from slidedata.json via the region-based layout model (ADR-0045); supports divider/profile/contact/punchline slide types, header bar, image zones; per-item font sizes aligned to HTML (px×0.75); **v1.7.0**: background image rendering — reads `background_image` from lecture-profile.md, resolves images from image-manifest.json or slideData, renders full-bleed cover-crop + semi-transparent overlay (scope: all/divider-cover/individual); v1.6.0: OS-aware FONT_FAMILIES + sysFontDirs search; v1.5.0: `--auto-calibrate`; v1.4.0: placeImageCover, layout_overrides parser fix; use --sample N to limit | `bun scripts/<variant>/gen-slides-pdf.ts --project presentations/<proj> [--sample 5] [--auto-calibrate]` |
| `diagram-helpers.ts` | 1.1.0 | active | Shared SVG utilities for diagram generation: svgWrap, svgToPng, wrapText, colour palettes (DARK_AMBER, B2B_NAVY); imported by each project's diagram-defs.ts; **v1.1.0**: OS-aware system font candidates (platform()+homedir()) | (library — not invoked directly) |
| `gen-visual-images.ts` | 3.0.1 | active | Infrastructure-only dispatcher: reads slidedata.json, dynamically imports presentations/\<project\>/diagram-defs.ts, renders SVG per slide (primary delivery format for HTML); optionally renders PNG when PDF export is planned; project generators are fully isolated in diagram-defs.ts; **v3.0.1 backport from co-deck2 instance**: target filter honours an absent `visual` field — an `images/`-prefixed visualImage still counts as a diagram target (previously such slides were silently dropped) | `bun scripts/co-deck/gen-visual-images.ts --project presentations/<proj>` |
| `measure-layout.ts` | 1.1.0 | **deprecated** | ~~Measure HTML slide layout using Playwright~~ — replaced by estimate-layout.ts (Playwright-free). Output (layout_spec.json) was never consumed by gen-slides-pdf.ts. | `bun scripts/co-deck/measure-layout.ts <html_file> [output_dir]` |
| `estimate-layout.ts` | 1.1.0 | active | Playwright-free PDF layout preparation: reads lecture-profile.md, resolves 4-layer spec merge (base→theme→style→overrides), validates fonts, outputs layout_summary.md; optional --sample flag generates 5-slide sample PDF; **v1.1.0**: OS-aware font search via getSystemFontDirs() and findFontFile() | `bun scripts/co-deck/estimate-layout.ts --project presentations/<proj> [--sample] [--font-dir fonts/]` |
| `auto-calibrate.ts` | 1.0.0 | active | Iterative auto-calibration loop: generates 5-page sample PDF → converts to images (pdf-to-png-converter v4) → numerically validates layout (font/line_height constraints) → auto-adjusts layout_overrides → repeats up to 3 iterations → prompts user for approval; outputs calibration report | `bun scripts/co-deck/auto-calibrate.ts --project presentations/<proj> [--max-iter 3] [--sample 5]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/co-deck/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |
| `validate-theme-styles.ts` | 2.0.0 | active | Validate html-themes structure for the unified region-based layout model (ADR-0045): shared-pool integrity, theme.json consistency, region schema + slide_type↔region cross-check, Layer-0 layout_base.json skeleton | `bun scripts/co-deck/validate-theme-styles.ts [--root <path>]` |
| `validate-image-manifest.ts` | 1.0.0 | active | Validate image-manifest.json — Gate 3.5 hard gate: recomputes SHA-256 content hash + reads pixel dimensions (inline zero-dep PNG/JPEG/SVG parsers) for every image; ERROR on any duplicate content-hash across slides (blocks image-curator → html-build); WARN on missing extended schema fields (content_hash/width/height/aspect_ratio) and on aspect-ratio deviation > 30% from the theme × image_role target | `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<proj> [--root <path>]` |
| `generate-themes-manifest.ts` | 1.0.0 | active | Scan themes/ + styles/ and emit preview/themes-manifest.js (file://-safe global) so preview.html dropdowns populate without fetch() | `bun scripts/co-deck/generate-themes-manifest.ts [--root <path>]` |
| `scaffold-theme-style.ts` | 1.0.0 | active | Scaffold a new theme (themes/<name>/{template.html,theme.json,theme.css,pdf_layout_spec.json}) or style (styles/<name>/{style.css,pdf_color_spec.json}); refuses to overwrite; regenerates manifest | `bun scripts/co-deck/scaffold-theme-style.ts --theme <name> [--style <name>]` |

Also available in `scripts/` root (not co-deck specific):

| script | version | status | description |
|--------|---------|--------|-------------|
| `extract_slidedata.mjs` | 1.2.0 | active | Extract slideData array from HTML file to slidedata.json (bracket-depth state machine; requires strict-JSON slideData) |

---

## Typical Workflow

```bash
# 1. Download fonts (once)
bun scripts/co-deck/download-font.ts pretendard

# 2. Estimate layout and validate setup
bun scripts/co-deck/estimate-layout.ts --project presentations/<project>

# 3. (Optional) Auto-calibrate for new themes
bun scripts/co-deck/gen-slides-pdf.ts --auto-calibrate --project presentations/<project>

# 4. (Optional) Iterative calibration loop (numerical validation)
bun scripts/co-deck/auto-calibrate.ts --project presentations/<project> --max-iter 3 --sample 5

# 5. Extract slide data from HTML
bun scripts/co-deck/extract_slidedata.mjs presentations/<project>/lecture.html

# 6. Generate 5-slide sample for review
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project> --sample 5

# 7. Generate full PDF
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project>

# 8. (Optional) Prep + sample in one step
bun scripts/co-deck/estimate-layout.ts --project presentations/<project> --sample

# 9. Snapshot before edits
bun scripts/co-deck/snapshot.ts lecture.html --workspace presentations/<project> --desc "before chapter 3 edits" --agent content
```

## Design Note

These scripts reside in `scripts/co-deck/` per **ADR-0033: Variant-Specific Skills & Scripts Blueprint** (Accepted).

**Canonical placement rule** (per [Script Lifecycle §6.5](../../../../docs/constitution/06.5-script-lifecycle.md)):
- Variant scripts MUST be placed in `scripts/<variant>/` (a subdirectory), NOT in the top-level `scripts/`
- Top-level `.ts` files must be registered in the shared L1 `scripts/SCRIPTS.md`
- Variant scripts in `scripts/<variant>/` are intentionally excluded from that check — they are not shared L1 scripts
- The non-recursive `readdirSync` in `verifyScriptRegistryConsistency()` is a **deliberate design constraint**, not a limitation

**Governance chain:**
- `templates/co-deck/variant.json` → `script_manifest.local` declares each script
- `bun scripts/validate-templates.ts` check B-03 verifies all declared paths exist (L0 workspace check)
- `bun scripts/co-deck/validate-theme-styles.ts` cross-validates `theme.json compatible_styles` ↔ `styles/` filesystem (variant-level check)
- `bun scripts/lifecycle-sync-audit.ts` Check V verifies `@version` consistency within this registry

**Reference:** [ADR-0033](../../../../docs/adr/0033-variant-specific-skills-scripts-blueprint.md) · [Script Lifecycle §6.5](../../../../docs/constitution/06.5-script-lifecycle.md)

*Last Updated: 2026-06-25 — Phase 2+3: gen-slides-pdf.ts v1.7.0 (background image rendering with overlay); previous: auto-calibrate.ts v1.0.0, download-font.ts v2.0.0, diagram-helpers.ts v1.1.0, estimate-layout.ts v1.1.0, gen-slides-pdf.ts v1.6.0 (OS FONT_FAMILIES)*
