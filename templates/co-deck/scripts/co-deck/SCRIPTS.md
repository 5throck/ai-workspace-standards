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
| `playwright` | `^1.45.0` | `measure-layout.ts` | **optional** |

`playwright` is declared as `optionalDependencies` — `bun install` skips it by default.
Install only when using `measure-layout.ts` for layout calibration:

```bash
bun add playwright
bunx playwright install chromium
```

After playwright install, also run: `bunx playwright install chromium`

---

## Registry

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `download-font.ts` | 1.0.0 | active | Download Korean TTF fonts (MaruBuri, NotoSansKR, etc.) for PDF generation | `bun scripts/co-deck/download-font.ts maruburi [fonts/]` |
| `gen-slides-pdf.ts` | 1.1.0 | active | Generate full or sample PDF deck from slidedata.json (use --sample N to limit) | `bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<proj> [--sample 5]` |
| `measure-layout.ts` | 1.0.0 | active | Measure HTML slide layout using Playwright; outputs layout_spec.json + pdf_layout_spec.md | `bun scripts/co-deck/measure-layout.ts <html_file> [output_dir]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/co-deck/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |
| `validate-theme-styles.ts` | 1.0.0 | active | Cross-validate theme.json compatible_styles ↔ styles/ directory; flags missing style.css and orphaned style folders | `bun scripts/co-deck/validate-theme-styles.ts` |

Also available in `scripts/` root (not co-deck specific):

| script | version | status | description |
|--------|---------|--------|-------------|
| `extract_slidedata.mjs` | — | active | Extract slideData array from HTML file to slidedata.json |

---

## Typical Workflow

```bash
# 1. Download fonts
bun scripts/co-deck/download-font.ts maruburi

# 2. Extract slide data from HTML
bun scripts/extract_slidedata.mjs presentations/<project>/lecture.html

# 3. (Optional) Measure layout for calibration
bun scripts/co-deck/measure-layout.ts presentations/<project>/lecture.html

# 4. Generate PDF
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project>

# 5. Generate 5-slide sample
bun scripts/co-deck/gen-slides-pdf.ts --project presentations/<project> --sample 5

# 6. Snapshot before edits
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

*Last Updated: 2026-06-21 — added validate-theme-styles.ts (1.0.0) for compatible_styles ↔ styles/ cross-validation; previous: Design Note updated to ADR-0033 canonical pattern reference*
