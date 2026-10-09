# SCRIPTS.md — co-deck Variant Scripts

> Lifecycle registry for co-deck variant-specific scripts in `scripts/co-deck/`.
> These scripts are co-deck only; they do NOT appear in the L1 common `scripts/SCRIPTS.md`.
> Executed via Bun per ADR-0036. Runtime dependencies are declared in the variant's
> root `package.json` — run `bun install` at project root before first use.

---

## Architecture

All scripts are TypeScript executed via `bun`. They live in `scripts/co-deck/` to avoid
the L1 audit's top-level `scripts/*.ts` scan (`verifyScriptRegistryConsistency`).

**Invocation:**
```bash
bun scripts/co-deck/<name>.ts [args]
# or via the root package.json scripts:
bun run test              # bun test scripts/co-deck/tests/ (offline suites; browser suites self-skip)
bun run test:visual       # visual regression against docs/html-themes/baselines (needs playwright)
bun run test:visual:update  # regenerate visual baselines (UPDATE_BASELINES=1)
bun run test:smoke        # builder-side compatibility tests + Playwright browser smoke (node)
```

---

## Package Dependencies

All required/dev dependencies are declared in the variant's root `package.json`
(scaffolded into projects by the variant overlay). Install with `bun install` at project root:

| Package | Version | Used by | Type |
|---------|---------|---------|------|
| `fflate` | `^0.8.3` | `download-font.ts` | required |
| `pdf-lib` | `^1.17.1` | `gen-slides-pdf.ts` | required |
| `@pdf-lib/fontkit` | `^1.1.1` | `gen-slides-pdf.ts` | required |
| `@resvg/resvg-js` | `^2.6.2` | `gen-visual-images.ts` | required |
| `puppeteer-core` | `^25.12.0` | `html-to-pdf.ts` (system Chrome/Edge via Puppeteer) | required |
| `pdf-to-png-converter` | `^4.2.1` | `auto-calibrate.ts` (PDF→PNG in the calibration loop) | required (only used by `--auto-calibrate`) |
| `playwright` | `^1.63.0` | browser test suites (`*.browser.mjs`) | devDependency |

`playwright` is a devDependency used only by the Playwright browser test suites
(`theme-browser-smoke.browser.mjs`, `theme-visual-regression.browser.mjs`,
`ppt-engine-integration.browser.mjs`); those suites self-skip when it is absent.
The runtime script that required it (`measure-layout.ts`) is deprecated — use
`estimate-layout.ts` instead (no Playwright dependency).
Pre-built native binaries (`pdf-to-png-converter`, `@resvg/resvg-js`) — no build step required.

---

## Registry

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `download-font.ts` | 2.1.0 | active | Download Korean TTF fonts (MaruBuri, NotoSansKR, etc.) for PDF generation; **v2.1.0**: supply-chain hardening — Pretendard pinned to release v1.3.9 (no releases/latest), optional `expected_sha256` archive verification, hard failure on partial extraction, project-local default font dir (`--os-font-dir` opts into the OS font dir), English console output; v2.0.0: OS-aware default font directory, system font detection skips download if all fonts found | `bun scripts/co-deck/download-font.ts maruburi [output_dir] [--os-font-dir]` |
| `gen-slides-pdf.ts` | 1.9.0 | active | Generate full or sample PDF deck from slidedata.json via the region-based layout model (ADR-0045); supports divider/profile/contact/punchline slide types, header bar, image zones; per-item font sizes aligned to HTML (px×0.75); **v1.9.0**: CJK fallback font system — NotoSansKR fallback for Hanja glyphs (現, 前 etc.) via fontkit pre-computed `missingCps` set + `buildFontRuns()` per-character font run splitting; `renderContactSlide()` reads `contactLinkedIn` field; **v1.8.0**: increased bullet_pt across all 5 themes (pitch/pitch-enhanced 11→14pt, vertical/outline 13→15pt, zen 14→15pt) + proportional bullet_px/bullet_gap_px; auto-calibrate FONT_PT_MULT 0.85→0.94; fallback T_BUL 12.5→14.0; **v1.7.0**: background image rendering — reads `background_image` from lecture-profile.md, resolves images from image-manifest.json or slideData, renders full-bleed cover-crop + semi-transparent overlay (scope: all/divider-cover/individual); v1.6.0: OS-aware FONT_FAMILIES + sysFontDirs search; v1.5.0: `--auto-calibrate`; v1.4.0: placeImageCover, layout_overrides parser fix; use --sample N to limit | `bun scripts/<variant>/gen-slides-pdf.ts --project presentations/<proj> [--sample 5] [--auto-calibrate]` |
| `diagram-helpers.ts` | 1.2.0 | active | Shared SVG utilities for diagram generation: svgWrap, svgToPng, wrapText, colour palettes (DARK_AMBER, B2B_NAVY); imported by each project's diagram-defs.ts; **v1.2.0**: Default canvas matches pitch-enhanced right-panel aspect ratio; OS-aware system font candidates (platform()+homedir()) | (library — not invoked directly) |
| `gen-visual-images.ts` | 3.2.0 | active | Infrastructure-only dispatcher: reads slidedata.json, dynamically imports presentations/\<project\>/diagram-defs.ts, renders SVG + PNG per slide; **slidedata.json `visualImage` always set to SVG path** (HTML primary delivery format); PNG sibling saved to shared pool for PDF use; gen-slides-pdf.ts imgPath() auto-derives PNG from SVG path — no manual path switching; legacy `images/` paths rewritten to `../assets/diagrams/<stem>.svg` | `bun scripts/co-deck/gen-visual-images.ts --project presentations/<proj>` |
| `measure-layout.ts` | 1.1.0 | **deprecated** | ~~Measure HTML slide layout using Playwright~~ — replaced by estimate-layout.ts (Playwright-free). Output (layout_spec.json) was never consumed by gen-slides-pdf.ts. | `bun scripts/co-deck/measure-layout.ts <html_file> [output_dir]` |
| `estimate-layout.ts` | 1.2.0 | active | Playwright-free PDF layout preparation: reads lecture-profile.md, resolves 4-layer spec merge (base→theme→style→overrides), validates fonts, outputs layout_summary.md; optional --sample flag generates 5-slide sample PDF; **v1.2.0**: `--lint` layout gate — checks every slide in slidedata.json against the merged `content_constraints` (exit 1 on violation); v1.1.0: OS-aware font search via getSystemFontDirs() and findFontFile() | `bun scripts/co-deck/estimate-layout.ts --project presentations/<proj> [--sample] [--lint] [--font-dir presentations/assets/fonts/]` |
| `auto-calibrate.ts` | 1.0.0 | active | Iterative auto-calibration loop: generates 5-page sample PDF → converts to images (pdf-to-png-converter v4) → numerically validates layout (font/line_height constraints) → auto-adjusts layout_overrides → repeats up to 3 iterations → prompts user for approval; outputs calibration report | `bun scripts/co-deck/auto-calibrate.ts --project presentations/<proj> [--max-iter 3] [--sample 5]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/co-deck/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |
| `validate-theme-styles.ts` | 2.0.0 | active | Validate html-themes structure for the unified region-based layout model (ADR-0045): shared-pool integrity, theme.json consistency, region schema + slide_type↔region cross-check, Layer-0 layout_base.json skeleton; **v2.0.0**: refactored to import from `lib/theme-utils.ts` | `bun scripts/co-deck/validate-theme-styles.ts [--root <path>]` |
| `validate-image-manifest.ts` | 1.0.0 | active | Validate image-manifest.json — Gate 3.5 hard gate: recomputes SHA-256 content hash + reads pixel dimensions (inline zero-dep PNG/JPEG/SVG parsers) for every image; ERROR on any duplicate content-hash across slides (blocks image-curator → html-build); WARN on missing extended schema fields (content_hash/width/height/aspect_ratio) and on aspect-ratio deviation > 30% from the theme × image_role target | `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<proj> [--root <path>]` |
| `generate-themes-manifest.ts` | 2.0.0 | active | Scan themes/ + styles/ and emit preview/themes-manifest.js (file://-safe global); **v2.0.0**: deterministic output (no `generated_at`), `--check` mode, `--themes-md` auto-update THEMES.md table/compat matrix | `bun scripts/co-deck/generate-themes-manifest.ts [--check] [--themes-md] [--root <path>]` |
| `scaffold-theme-style.ts` | 2.0.0 | active | Scaffold a new theme or style; **v2.0.0**: `--from <theme>` flag for intentional derivation with provenance metadata (copies template.html + theme.css, sets `based_on` + `author`); minimally valid stubs (all 4 INJECT markers, full theme.json fields, basic CSS structure, region skeleton) | `bun scripts/co-deck/scaffold-theme-style.ts --theme <name> [--style <name>] [--from <source-theme>]` |
| `lib/theme-utils.ts` | 0.1.0 | active | Shared utilities for theme scripts: `listThemeDirs`, `listStyleDirs`, `normalizeStyleEntry`, `SLIDE_TYPE_HTML_TO_JSON` | `import from './lib/theme-utils'` (library, not CLI) |
| `lib/theme-contract.ts` | 0.1.0 | active | Typed theme package contracts, `loadThemePackage()`, `validateThemePackage()` | `import from './lib/theme-contract'` (library, not CLI) |
| `lib/theme-builder.ts` | 0.2.1 | active | Deterministic HTML deck builder: `buildThemeDeck(options)` — loads theme package, validates compatibility, replaces INJECT markers, inlines ppt-engine.js; **v0.2.0**: sets `data-toc-style` attribute from a new `tocStyle` option (defaults to `glass-drawer`); validates every generated `<script>` block parses as syntactically valid JS (HTML comments stripped first to avoid false positives from doc-comment prose mentioning `<script>`), pushing to `errors[]` on failure instead of shipping a broken runtime silently; **v0.2.1**: anchored the `<html>` attribute-injection regex to line-start (`^...$/m`) — template.html doc-comments describe the injection in prose that reproduces the literal tag syntax (e.g. `` Injects <html data-theme="..." data-style="<style>"> ``), which a non-anchored regex matched first, silently leaving the *real* tag with unreplaced source placeholder values (wrong `data-style`, missing `data-toc-style`) | `import from './lib/theme-builder'` (library, not CLI) |
| `build-theme-deck.ts` | 0.1.2 | active | CLI wrapper for theme builder: reads lecture-profile.md YAML frontmatter + slidedata.json, generates `lecture_v1.html`; **v0.1.1**: fix missing `join` import from `path` (runtime crash on profile/slide-data path resolution); **v0.1.2**: read `presentation.tocStyle` from lecture-profile.md and pass through to `buildThemeDeck()` | `bun scripts/co-deck/build-theme-deck.ts --project <path> [--slide-data <path>] [--output <path>] [--version vN]` |
| `inject-video-players.ts` | 1.0.0 | active | Post-build video player injection (lecture-deck-production procedure, ADR-0002): idempotent marker-based replace (`cdk-video-players` block stripped before re-injection — rebuild+re-run always safe), triple play-mode fallback (local mp4 → inline YouTube iframe over http(s) with `origin` → new-tab watch URL over `file://` dodging embed error 153), MutationObserver stop-on-slide-change cleanup (v4 stale-index defect class); theme-agnostic TS generalization of the 2026-10-ai-industry-research engagement's inject_video_players.py — the engagement copy stays in the project (ADR-0031 backport gate); **re-run + `node --check` after every build-theme-deck rebuild is the procedure gate** | `bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]` |
| `tests/inject-video-players.test.ts` | 1.0.0 | active | Pin tests for inject-video-players: marker-based idempotency (double injection byte-identical), local/YouTube fallback wiring, MutationObserver presence, no-video-slides hard exit | `bun test scripts/co-deck/tests/inject-video-players.test.ts` |
| `watch-deck.ts` | 0.1.0 | active | Live-reload authoring loop for theme deck: runs initial build, watches project directory for changes to .md/.json/.css/.html/.js/.ts files, triggers debounced rebuilds (default 300ms), survives build errors (continues watching), `--once` runs single build and exits | `bun scripts/co-deck/watch-deck.ts --project <path> [--slide-data <path>] [--output <path>] [--interval <ms>] [--once]` |
| `extract_slidedata.mjs` | 1.2.0 | active | Extract slideData array from HTML file to slidedata.json (bracket-depth state machine; requires strict-JSON slideData); dual bun/node `.mjs` utility — snake_case name is intentional (see note below) | `bun scripts/co-deck/extract_slidedata.mjs <html_file> [output_json]` |
| `tests/theme-builder.test.ts` | 0.1.0 | active | Tests for theme-builder: compatibility rejection, partial styles, marker replacement, CSS load order, strict-JSON, determinism, ppt-engine inlining | `bun test scripts/co-deck/tests/theme-builder.test.ts` |
| `tests/ppt-engine-integration.test.ts` | 0.1.0 | active | Builder-side integration tests for ppt-engine.js shared runtime contract: no `<script src>` in output, inlined for PPT themes, not inlined for pitch, initPPT/renderSlide present, documentation header validation | `bun test scripts/co-deck/tests/ppt-engine-integration.test.ts` |
| `tests/ppt-engine-integration.browser.mjs` | 0.1.0 | active | Playwright browser integration tests for PPT-engine runtime: navigation (arrows/buttons/keys), TOC drawer, transitions, narration controls, timer, fullscreen, auto-advance — for each PPT-engine theme (outline, pitch-enhanced, vertical, zen); runs via Node.js | `node scripts/co-deck/tests/ppt-engine-integration.browser.mjs` |
| `tests/theme-browser-smoke.test.ts` | 0.1.0 | active | Builder-side compatibility matrix tests (theme×style pairs: incompatible rejection, compatible/partial HTML generation, matrix summary) | `bun test scripts/co-deck/tests/theme-browser-smoke.test.ts` |
| `tests/theme-browser-smoke.browser.mjs` | 0.1.0 | active | Playwright browser smoke tests for all theme×style pairs: zero JS errors, correct slide count, nav controls, TOC, fullscreen — runs via Node.js | `node scripts/co-deck/tests/theme-browser-smoke.browser.mjs` |
| `tests/verify-new-theme.test.ts` | 0.1.0 | active | Tests for verify-new-theme: fast-mode against all existing themes, timing, non-existent theme error reporting, JSON output format, --style flag | `bun test scripts/co-deck/tests/verify-new-theme.test.ts` |
| `tests/scaffold-theme-style.test.ts` | 0.1.0 | active | Tests for scaffold-theme-style: --from derivation (copies template.html/theme.css, sets based_on/author), minimally valid stubs (4 INJECT markers, required fields, CSS structure, region skeleton), contract validation, error handling | `bun test scripts/co-deck/tests/scaffold-theme-style.test.ts` |
| `tests/theme-contract.test.ts` | 0.1.0 | active | Tests for theme-contract: loadThemePackage(), validateThemePackage(), SLIDE_TYPE_HTML_TO_JSON mapping | `bun test scripts/co-deck/tests/theme-contract.test.ts` |
| `tests/theme-preview.test.ts` | 0.1.0 | active | Tests for preview system (preview.html + build-theme-preview.ts): preview-data.json parsing, theme-native DOM, iframe src pattern, incompatible pairs error, error panel structure | `bun test scripts/co-deck/tests/theme-preview.test.ts` |
| `tests/theme-visual-regression.test.ts` | 0.2.0 | active | Visual regression tests for theme×style pairs: generates deck via buildThemeDeck(), takes Playwright screenshots (1280x720), compares against baselines; **v0.2.0**: compat matrix derived from theme.json compatible_styles via loadThemePackage(), browser subprocess via execFileSync (space-safe paths) | `bun test scripts/co-deck/tests/theme-visual-regression.test.ts` |
| `tests/theme-visual-regression.browser.mjs` | 0.1.0 | active | Playwright screenshot capture & comparison helper for theme-visual-regression.test.ts; runs via Node.js (bun has Playwright subprocess issues on Windows); modes: capture, compare | `node scripts/co-deck/tests/theme-visual-regression.browser.mjs` |
| `tests/generate-themes-manifest.test.ts` | 0.1.0 | active | Tests for generate-themes-manifest: deterministic output, --check mode, --themes-md auto-update | `bun test scripts/co-deck/tests/generate-themes-manifest.test.ts` |
| `tests/extract_slidedata.test.mjs` | 0.1.0 | active | Tests for extract_slidedata.mjs: slideData extraction from HTML, fixture-based | `bun test scripts/co-deck/tests/extract_slidedata.test.mjs` |
| `build-theme-preview.ts` | 0.1.0 | active | Build preview iframe from production renderer: reads preview-data.json + buildThemeDeck(), outputs per-theme×style HTML decks into preview/decks/; exits non-zero when any deck build errors | `bun scripts/co-deck/build-theme-preview.ts [--root <path>] [--theme <name>] [--style <name>]` |
| `verify-new-theme.ts` | 1.0.0 | active | Composite registration gate: 5 checks (structural validation, manifest freshness, THEMES.md markers, fixture build + extraction round-trip, PDF generation); `--fast` skips checks 4–5; `--json` for CI; target <30s full / <3s fast | `bun scripts/co-deck/verify-new-theme.ts <name> [--style <name>] [--fast] [--json]` |

> **Handbook Scripts**: handbook validation and tooling scripts moved to `templates/common/scripts/handbook/` (2026-08-30 promotion to common). Update the example below to `bun scripts/handbook/...` when the common scripts are present.

| script | version | status | description | cli-usage |
|--------|---------|--------|-------------|-----------|
| `html-to-pdf.ts` | 1.1.0 | active | Generate PDF from self-contained HTML slide deck using Puppeteer (system Chrome/Edge, WebSocket transport) — captures each `<section>` as a full-page PDF | `bun scripts/co-deck/html-to-pdf.ts --html presentations/<project>/lecture_vN.html [--out output.pdf] [--width 1920] [--height 1080] [--scale 1.5] [--pages N]` |

```bash
# Handbook workflow
bun scripts/handbook/scaffold-handbook.ts --project . --output handbook --lang ko
cd handbook && bun install
bun run handbook-doctor
bun run check-authoring --lang ko
bun run validate-nav
bun run validate-handbook --docs-dir docs --checks all
bun run apply-theme --theme azure
```

### `extract_slidedata.mjs` — why snake_case

`extract_slidedata.mjs` is the only snake_case script here (17 kebab-case siblings).
The name is intentional and kept: it is a dual bun/node vendored utility — the `.mjs`
extension with bare `fs`/`path` ESM imports lets the same file run under both
`bun scripts/co-deck/extract_slidedata.mjs` and `node scripts/co-deck/extract_slidedata.mjs`,
and downstream docs/tooling reference it by this exact filename. Do not rename it;
there is no vendored copy at the `scripts/` root — this directory holds the only copy.

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

# 9. Layout gate — lint slide content before full export (exit 1 blocks PDF)
bun scripts/co-deck/estimate-layout.ts --project presentations/<project> --lint

# 10. Snapshot before edits
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

*Last Updated: 2026-10-09 — added root `package.json` (runtime deps + test/test:visual/test:smoke entries), documented `extract_slidedata.mjs` snake_case rationale, added `puppeteer-core` to the deps table, fixed `build-theme-preview` flags, removed the false vendored-copy claim. (2026-08-29 — handbook scripts promoted to templates/common/scripts/handbook/.)*
