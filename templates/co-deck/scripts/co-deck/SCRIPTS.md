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
| `download-font.ts` | 2.0.0 | active | Download Korean TTF fonts (MaruBuri, NotoSansKR, etc.) for PDF generation; **v2.0.0**: OS-aware default font directory, system font detection skips download if all fonts found | `bun scripts/co-deck/download-font.ts maruburi [presentations/assets/fonts/]` |
| `gen-slides-pdf.ts` | 1.9.0 | active | Generate full or sample PDF deck from slidedata.json via the region-based layout model (ADR-0045); supports divider/profile/contact/punchline slide types, header bar, image zones; per-item font sizes aligned to HTML (px×0.75); **v1.9.0**: CJK fallback font system — NotoSansKR fallback for Hanja glyphs (現, 前 etc.) via fontkit pre-computed `missingCps` set + `buildFontRuns()` per-character font run splitting; `renderContactSlide()` reads `contactLinkedIn` field; **v1.8.0**: increased bullet_pt across all 5 themes (pitch/pitch-enhanced 11→14pt, vertical/outline 13→15pt, zen 14→15pt) + proportional bullet_px/bullet_gap_px; auto-calibrate FONT_PT_MULT 0.85→0.94; fallback T_BUL 12.5→14.0; **v1.7.0**: background image rendering — reads `background_image` from lecture-profile.md, resolves images from image-manifest.json or slideData, renders full-bleed cover-crop + semi-transparent overlay (scope: all/divider-cover/individual); v1.6.0: OS-aware FONT_FAMILIES + sysFontDirs search; v1.5.0: `--auto-calibrate`; v1.4.0: placeImageCover, layout_overrides parser fix; use --sample N to limit | `bun scripts/<variant>/gen-slides-pdf.ts --project presentations/<proj> [--sample 5] [--auto-calibrate]` |
| `diagram-helpers.ts` | 1.2.0 | active | Shared SVG utilities for diagram generation: svgWrap, svgToPng, wrapText, colour palettes (DARK_AMBER, B2B_NAVY); imported by each project's diagram-defs.ts; **v1.2.0**: Default canvas matches pitch-enhanced right-panel aspect ratio; OS-aware system font candidates (platform()+homedir()) | (library — not invoked directly) |
| `gen-visual-images.ts` | 3.2.0 | active | Infrastructure-only dispatcher: reads slidedata.json, dynamically imports presentations/\<project\>/diagram-defs.ts, renders SVG + PNG per slide; **slidedata.json `visualImage` always set to SVG path** (HTML primary delivery format); PNG sibling saved to shared pool for PDF use; gen-slides-pdf.ts imgPath() auto-derives PNG from SVG path — no manual path switching; legacy `images/` paths rewritten to `../assets/diagrams/<stem>.svg` | `bun scripts/co-deck/gen-visual-images.ts --project presentations/<proj>` |
| `measure-layout.ts` | 1.1.0 | **deprecated** | ~~Measure HTML slide layout using Playwright~~ — replaced by estimate-layout.ts (Playwright-free). Output (layout_spec.json) was never consumed by gen-slides-pdf.ts. | `bun scripts/co-deck/measure-layout.ts <html_file> [output_dir]` |
| `estimate-layout.ts` | 1.1.0 | active | Playwright-free PDF layout preparation: reads lecture-profile.md, resolves 4-layer spec merge (base→theme→style→overrides), validates fonts, outputs layout_summary.md; optional --sample flag generates 5-slide sample PDF; **v1.1.0**: OS-aware font search via getSystemFontDirs() and findFontFile() | `bun scripts/co-deck/estimate-layout.ts --project presentations/<proj> [--sample] [--font-dir presentations/assets/fonts/]` |
| `auto-calibrate.ts` | 1.0.0 | active | Iterative auto-calibration loop: generates 5-page sample PDF → converts to images (pdf-to-png-converter v4) → numerically validates layout (font/line_height constraints) → auto-adjusts layout_overrides → repeats up to 3 iterations → prompts user for approval; outputs calibration report | `bun scripts/co-deck/auto-calibrate.ts --project presentations/<proj> [--max-iter 3] [--sample 5]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/co-deck/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |
| `validate-theme-styles.ts` | 2.0.0 | active | Validate html-themes structure for the unified region-based layout model (ADR-0045): shared-pool integrity, theme.json consistency, region schema + slide_type↔region cross-check, Layer-0 layout_base.json skeleton; **v2.0.0**: refactored to import from `lib/theme-utils.ts` | `bun scripts/co-deck/validate-theme-styles.ts [--root <path>]` |
| `validate-image-manifest.ts` | 1.0.0 | active | Validate image-manifest.json — Gate 3.5 hard gate: recomputes SHA-256 content hash + reads pixel dimensions (inline zero-dep PNG/JPEG/SVG parsers) for every image; ERROR on any duplicate content-hash across slides (blocks image-curator → html-build); WARN on missing extended schema fields (content_hash/width/height/aspect_ratio) and on aspect-ratio deviation > 30% from the theme × image_role target | `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<proj> [--root <path>]` |
| `generate-themes-manifest.ts` | 2.0.0 | active | Scan themes/ + styles/ and emit preview/themes-manifest.js (file://-safe global); **v2.0.0**: deterministic output (no `generated_at`), `--check` mode, `--themes-md` auto-update THEMES.md table/compat matrix | `bun scripts/co-deck/generate-themes-manifest.ts [--check] [--themes-md] [--root <path>]` |
| `scaffold-theme-style.ts` | 2.0.0 | active | Scaffold a new theme or style; **v2.0.0**: `--from <theme>` flag for intentional derivation with provenance metadata (copies template.html + theme.css, sets `based_on` + `author`); minimally valid stubs (all 4 INJECT markers, full theme.json fields, basic CSS structure, region skeleton) | `bun scripts/co-deck/scaffold-theme-style.ts --theme <name> [--style <name>] [--from <source-theme>]` |
| `lib/theme-utils.ts` | 0.1.0 | active | Shared utilities for theme scripts: `listThemeDirs`, `listStyleDirs`, `normalizeStyleEntry`, `SLIDE_TYPE_HTML_TO_JSON` | `import from './lib/theme-utils'` (library, not CLI) |
| `lib/theme-contract.ts` | 0.1.0 | active | Typed theme package contracts, `loadThemePackage()`, `validateThemePackage()` | `import from './lib/theme-contract'` (library, not CLI) |
| `lib/theme-builder.ts` | 0.2.0 | active | Deterministic HTML deck builder: `buildThemeDeck(options)` — loads theme package, validates compatibility, replaces INJECT markers, inlines ppt-engine.js; **v0.2.0**: sets `data-toc-style` attribute from a new `tocStyle` option (defaults to `glass-drawer`); validates every generated `<script>` block parses as syntactically valid JS (HTML comments stripped first to avoid false positives from doc-comment prose mentioning `<script>`), pushing to `errors[]` on failure instead of shipping a broken runtime silently | `import from './lib/theme-builder'` (library, not CLI) |
| `build-theme-deck.ts` | 0.1.2 | active | CLI wrapper for theme builder: reads lecture-profile.md YAML frontmatter + slidedata.json, generates `lecture_v1.html`; **v0.1.1**: fix missing `join` import from `path` (runtime crash on profile/slide-data path resolution); **v0.1.2**: read `presentation.tocStyle` from lecture-profile.md and pass through to `buildThemeDeck()` | `bun scripts/co-deck/build-theme-deck.ts --project <path> [--slide-data <path>] [--output <path>] [--version vN]` |
| `tests/theme-builder.test.ts` | 0.1.0 | active | Tests for theme-builder: compatibility rejection, partial styles, marker replacement, CSS load order, strict-JSON, determinism, ppt-engine inlining | `bun test scripts/co-deck/tests/theme-builder.test.ts` |
| `tests/ppt-engine-integration.test.ts` | 0.1.0 | active | Builder-side integration tests for ppt-engine.js shared runtime contract: no `<script src>` in output, inlined for PPT themes, not inlined for pitch, initPPT/renderSlide present, documentation header validation | `bun test scripts/co-deck/tests/ppt-engine-integration.test.ts` |
| `tests/ppt-engine-integration.browser.mjs` | 0.1.0 | active | Playwright browser integration tests for PPT-engine runtime: navigation (arrows/buttons/keys), TOC drawer, transitions, narration controls, timer, fullscreen, auto-advance — for each PPT-engine theme (outline, pitch-enhanced, vertical, zen); runs via Node.js | `node scripts/co-deck/tests/ppt-engine-integration.browser.mjs` |
| `tests/theme-browser-smoke.test.ts` | 0.1.0 | active | Builder-side compatibility matrix tests (theme×style pairs: incompatible rejection, compatible/partial HTML generation, matrix summary) | `bun test scripts/co-deck/tests/theme-browser-smoke.test.ts` |
| `tests/theme-browser-smoke.browser.mjs` | 0.1.0 | active | Playwright browser smoke tests for all theme×style pairs: zero JS errors, correct slide count, nav controls, TOC, fullscreen — runs via Node.js | `node scripts/co-deck/tests/theme-browser-smoke.browser.mjs` |
| `tests/verify-new-theme.test.ts` | 0.1.0 | active | Tests for verify-new-theme: fast-mode against all existing themes, timing, non-existent theme error reporting, JSON output format, --style flag | `bun test scripts/co-deck/tests/verify-new-theme.test.ts` |
| `tests/scaffold-theme-style.test.ts` | 0.1.0 | active | Tests for scaffold-theme-style: --from derivation (copies template.html/theme.css, sets based_on/author), minimally valid stubs (4 INJECT markers, required fields, CSS structure, region skeleton), contract validation, error handling | `bun test scripts/co-deck/tests/scaffold-theme-style.test.ts` |
| `build-theme-preview.ts` | 0.1.0 | active | Build preview iframe from production renderer: reads preview-data.json + buildThemeDeck(), outputs per-theme×style HTML decks into preview/decks/ | `bun scripts/co-deck/build-theme-preview.ts [--root <path>] [--all]` |
| `verify-new-theme.ts` | 1.0.0 | active | Composite registration gate: 5 checks (structural validation, manifest freshness, THEMES.md markers, fixture build + extraction round-trip, PDF generation); `--fast` skips checks 4–5; `--json` for CI; target <30s full / <3s fast | `bun scripts/co-deck/verify-new-theme.ts <name> [--style <name>] [--fast] [--json]` |

### Handbook Scripts

Handbook validation and tooling scripts in `scripts/co-deck/handbook/`:

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `handbook/nav-utils.ts` | 1.0.0 | active | Shared HTML parsing utilities for navigation validation — configurable `--docs-dir`; zero external deps | (library — imported by validate-nav checks) |
| `handbook/validate-nav.ts` | 1.0.0 | active | Navigation integrity validator — runs 4 checks (broken links, prev/next symmetry, label match, DOCS sync) and exits code 1 on failure | `bun scripts/co-deck/handbook/validate-nav.ts [--docs-dir docs]` |
| `handbook/check-links.ts` | 1.0.0 | active | Check ①: Verify all internal `<a href>` targets resolve to existing files | (library — imported by validate-nav) |
| `handbook/check-symmetry.ts` | 1.0.0 | active | Check ②: If A's chapter-nav next → B, then B's prev → A | (library — imported by validate-nav) |
| `handbook/check-labels.ts` | 1.0.0 | active | Check ③: chapter-nav link labels match target title/h1 (Korean chapter numbers) | (library — imported by validate-nav) |
| `handbook/check-search.ts` | 1.0.0 | active | Check ④: site-search.js DOCS array must match actual HTML files | (library — imported by validate-nav) |
| `handbook/scaffold-handbook.ts` | 1.0.0 | active | Generate handbook project scaffold — copies templates+assets+scripts, creates package.json and CI workflow | `bun scripts/co-deck/handbook/scaffold-handbook.ts --project <path> [--output handbook/] [--lang ko]` |
| `handbook/check-authoring.ts` | 1.0.0 | active | AUTHORING_GUIDELINES compliance checker — 10 checks (visual elements, copy buttons, sidebar nav, chapter-nav, flex min-width, mid-word strong, course overview, CSS variables, language pairs, instructor guide); supports `--examples-dir` for regression fixture validation | `bun scripts/co-deck/handbook/check-authoring.ts --project <path> [--lang ko] [--examples-dir <path>]` |
| `handbook/apply-handbook-theme.ts` | 1.0.0 | active | CSS theme applicator — 5 built-in themes (azure, graphite, teal, amber, indigo), each with 3-layer dark mode | `bun scripts/co-deck/handbook/apply-handbook-theme.ts --project <path> --theme <name>` |
| `handbook/handbook-doctor.ts` | 1.0.0 | active | Enhanced static analyzer — 12 checks (sidebar nav, chapter-nav, broken links, dark palette, language pair, visual element, course overview, instructor guide, unused assets, duplicate IDs, hardcoded colors, empty title/h1) | `bun scripts/co-deck/handbook/handbook-doctor.ts --project <path> [--severity warn\|error]` |
| `html-to-pdf.ts` | 1.1.0 | active | Generate PDF from self-contained HTML slide deck using Puppeteer (system Chrome/Edge, WebSocket transport) — captures each `<section>` as a full-page PDF | `bun scripts/co-deck/html-to-pdf.ts --html presentations/<project>/lecture_vN.html [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5] [--pages N]` |

```bash
# Handbook workflow
bun scripts/co-deck/handbook/scaffold-handbook.ts --project . --output handbook --lang ko
cd handbook && bun install
bun run handbook-doctor
bun run check-authoring --lang ko
bun run validate-nav
bun run apply-theme --theme azure
```

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

**Canonical placement rule** (per Script Lifecycle §6.5):
- Variant scripts MUST be placed in `scripts/<variant>/` (a subdirectory), NOT in the top-level `scripts/`
- Top-level `.ts` files must be registered in the shared L1 `scripts/SCRIPTS.md`
- Variant scripts in `scripts/<variant>/` are intentionally excluded from that check — they are not shared L1 scripts
- The non-recursive `readdirSync` in `verifyScriptRegistryConsistency()` is a **deliberate design constraint**, not a limitation

**Governance chain:**
- `templates/co-deck/variant.json` → `script_manifest.local` declares each script
- `bun scripts/validate-templates.ts` check B-03 verifies all declared paths exist (L0 workspace check)
- `bun scripts/co-deck/validate-theme-styles.ts` cross-validates `theme.json compatible_styles` ↔ `styles/` filesystem (variant-level check)
- `bun scripts/lifecycle-sync-audit.ts` Check V verifies `@version` consistency within this registry

**Reference:** ADR-0033 · Script Lifecycle §6.5

*Last Updated: 2026-07-21 — handbook scripts (validate-nav + scaffold + check-authoring + apply-theme + handbook-doctor); design doc v4*
