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
| `gen-slides-pdf.ts` | 1.10.0 | active | Generate full or sample PDF deck from slidedata.json via the region-based layout model (ADR-0045); supports divider/profile/contact/punchline slide types, header bar, image zones; per-item font sizes aligned to HTML (px×0.75); **v1.10.0**: render-path parity batch (U-20261105-002/-003/-005) — overlap-aware visual path (zen full-page visual drawn BEFORE text; no C_VIS_BG overpaint, no negative bulTxtW, works with background_image on/off); per-slide `footnotes` render (FootnoteBuilder parity); `isPunchlineSlide` key alias; lecture-profile parsing via shared lib/layout-overrides.ts (dotted-key parity with the layout gate); CustomFontEmbedder patch (lib/pdf-font-patch.ts) covering OpenType shaped (calt) glyphs in /W + ToUnicode (fixes viewer over-advance of ':'/'-') + integer /W entries; bold `**segments**` weight+accent in titles/bullets (lib/markdown.ts); `contactPhone` renders; full-bleed surface fills skipped when a bg image was painted; **v1.9.0**: CJK fallback font system — NotoSansKR fallback for Hanja glyphs (現, 前 etc.) via fontkit pre-computed `missingCps` set + `buildFontRuns()` per-character font run splitting; `renderContactSlide()` reads `contactLinkedIn` field; **v1.8.0**: increased bullet_pt across all 5 themes (pitch/pitch-enhanced 11→14pt, vertical/outline 13→15pt, zen 14→15pt) + proportional bullet_px/bullet_gap_px; auto-calibrate FONT_PT_MULT 0.85→0.94; fallback T_BUL 12.5→14.0; **v1.7.0**: background image rendering — reads `background_image` from lecture-profile.md, resolves images from image-manifest.json or slideData, renders full-bleed cover-crop + semi-transparent overlay (scope: all/divider-cover/individual); v1.6.0: OS-aware FONT_FAMILIES + sysFontDirs search; v1.5.0: `--auto-calibrate`; v1.4.0: placeImageCover, layout_overrides parser fix; use --sample N to limit | `bun scripts/<variant>/gen-slides-pdf.ts --project presentations/<proj> [--sample 5] [--auto-calibrate]` |
| `diagram-helpers.ts` | 1.3.0 | active | Shared SVG utilities for diagram generation: svgWrap, svgToPng, wrapText, colour palettes (DARK_AMBER, B2B_NAVY); imported by each project's diagram-defs.ts; **v1.3.0** (U-20261105-006): caption/source dedup — `stripDiagramFooterText()` removes footer-band caption/takeaway/source `<text>` lines (slidedata visualCaption/visualSource are the single source of truth; html-build + PDF render them) and re-fits the viewBox to remaining content, `svgTextDuplicatesSlide()` audits SVG text for echoes of the slide's caption/source/bullets (unicode-aware normalization; JS `\W` is ASCII-only, Hangul kept via `\p{L}\p{N}`); fixed pre-existing broken `homedir` import (`node:path` → `node:os`) that crashed module load; v1.2.0: default canvas matches pitch-enhanced right-panel aspect ratio; OS-aware system font candidates | (library — not invoked directly) |
| `gen-visual-images.ts` | 3.3.0 | active | Infrastructure-only dispatcher: reads slidedata.json, dynamically imports presentations/\<project\>/diagram-defs.ts, renders SVG + PNG per slide; **slidedata.json `visualImage` always set to SVG path** (HTML primary delivery format); PNG sibling saved to shared pool for PDF use; gen-slides-pdf.ts imgPath() auto-derives PNG from SVG path — no manual path switching; legacy `images/` paths rewritten to `../assets/diagrams/<stem>.svg`; **v3.3.0** (U-20261105-006): every generated SVG passes through `stripDiagramFooterText()` before writing and is audited with `svgTextDuplicatesSlide()` — bullet/caption/source echoes WARN (non-fatal, regenerate rather than hand-strip content labels) | `bun scripts/co-deck/gen-visual-images.ts --project presentations/<proj>` |
| `download-videos.ts` | 1.0.0 | active | Offline video fetch for lecture decks (U-20261105-007): reads slidedata.json `videoId` fields, downloads `yt-<id>.mp4` into the shared pool `presentations/assets/videos/` via the QuickDL CLI (external optional tool; `--quickdl-dir` or `CDK_QUICKDL_DIR`, default `~/git/project/QuickDL`) so inject-video-players.ts can bind the local play-mode fallback; TypeScript port of the 2026-10-ai-industry-research engagement's download_all_videos.py (ADR-0036); idempotent skip-if-exists (size > 100KB), `--check-only` report mode, per-item failure tolerance (exit 0 all present / 1 fatal / 2 some failed — callers WARN and keep YouTube fallbacks) | `bun scripts/co-deck/download-videos.ts --project presentations/<proj> [--slidedata <path>] [--assets-dir <dir>] [--quickdl-dir <dir>] [--check-only] [--force]` |
| `measure-layout.ts` | 1.1.0 | **deprecated** | ~~Measure HTML slide layout using Playwright~~ — replaced by estimate-layout.ts (Playwright-free). Output (layout_spec.json) was never consumed by gen-slides-pdf.ts. | `bun scripts/co-deck/measure-layout.ts <html_file> [output_dir]` |
| `estimate-layout.ts` | 1.5.0 | active | Playwright-free PDF layout preparation: reads lecture-profile.md, resolves 4-layer spec merge (base→theme→style→overrides), validates fonts, outputs layout_summary.md; optional --sample flag generates 5-slide sample PDF; **v1.5.0**: lint slide-type resolution via shared lib/slide-type.ts — recognizes the boolean-flag schema (isCover/isDivider/isPunchline/isContact/isProfile) current decks emit alongside the legacy `type` string; special slides no longer false-FAIL the standard min-content checks (U-20261105-001); frontmatter/overrides parsing via shared lib/layout-overrides.ts (U-20261105-003); **v1.4.0**: `--lint` minimum content checks (U-20261029-006) — `min_bullets`/`min_body_chars` per type from the merged `content_constraints` (standard defaults 3/40 when the theme declares none, explicit 0 disables, `videoId` slides exempt); **v1.2.0**: `--lint` layout gate — checks every slide in slidedata.json against the merged `content_constraints` (exit 1 on violation); v1.1.0: OS-aware font search via getSystemFontDirs() and findFontFile() | `bun scripts/co-deck/estimate-layout.ts --project presentations/<proj> [--sample] [--lint] [--font-dir presentations/assets/fonts/]` |
| `lib/layout-overrides.ts` | 1.0.0 | active | Shared lecture-profile frontmatter + layout_overrides parser (flat + DOTTED + nested-indented key dialect) and deepMerge — single implementation imported by estimate-layout.ts and gen-slides-pdf.ts so the lint gate and the PDF renderer accept the same override dialect (U-20261105-003) | imported by `scripts/co-deck/estimate-layout.ts` + `gen-slides-pdf.ts` |
| `lib/slide-type.ts` | 1.0.0 | active | Shared slide-schema detection (`slideTypeOf`): legacy `type` string + boolean flags (isCover/isTitleSlide, isDivider/isDividerSlide, isPunchline/isPunchlineSlide, isProfile/isProfileSlide, isContact/isContactSlide) → slide_types key (U-20261105-001) | imported by `scripts/co-deck/estimate-layout.ts` |
| `lib/pdf-font-patch.ts` | 1.0.0 | active | pdf-lib CustomFontEmbedder prototype/static patch: /W + ToUnicode cover OpenType shaped (calt-alternate) glyphs (Pretendard substitutes ':'/'-' contextual alternates that the default unshaped glyph cache omits — viewers over-advanced them), /W entries rounded to integers per PDF 32000-1 §9.7.4.3 (U-20261105-005 items 1+2) | imported by `scripts/co-deck/gen-slides-pdf.ts` |
| `lib/markdown.ts` | 1.0.0 | active | Pure markdown inline-run helpers (`splitMarkdownRuns`, `wrapMarkdownWords`) for the PDF renderer — `**bold**` segments keep weight/accent in titles/bullets (U-20261105-005 item 6b) | imported by `scripts/co-deck/gen-slides-pdf.ts` |
| `auto-calibrate.ts` | 1.0.0 | active | Iterative auto-calibration loop: generates 5-page sample PDF → converts to images (pdf-to-png-converter v4) → numerically validates layout (font/line_height constraints) → auto-adjusts layout_overrides → repeats up to 3 iterations → prompts user for approval; outputs calibration report | `bun scripts/co-deck/auto-calibrate.ts --project presentations/<proj> [--max-iter 3] [--sample 5]` |
| `snapshot.ts` | 1.0.0 | active | File version snapshot manager — save/list/restore versioned copies | `bun scripts/co-deck/snapshot.ts <files> --workspace presentations/<proj> --desc "..." --agent "..."` |
| `validate-theme-styles.ts` | 2.0.0 | active | Validate html-themes structure for the unified region-based layout model (ADR-0045): shared-pool integrity, theme.json consistency, region schema + slide_type↔region cross-check, Layer-0 layout_base.json skeleton; **v2.0.0**: refactored to import from `lib/theme-utils.ts` | `bun scripts/co-deck/validate-theme-styles.ts [--root <path>]` |
| `validate-image-manifest.ts` | 1.1.0 | active | Validate image-manifest.json — Gate 3.5 hard gate: recomputes SHA-256 content hash + reads pixel dimensions (inline zero-dep PNG/JPEG/SVG parsers) for every image; ERROR on any duplicate content-hash across slides (blocks image-curator → html-build); **v1.1.0**: background_image section rules (U-20261029-007) — ERROR on family/hero reuse (global background serving ≥2 background-scoped slides under scope all/divider-cover), declared scope with no global path, pathless background entries, unreadable background_image.path; each background slide must carry its own distinct image (compliant flow: scope `individual` + per-slide entries; see agents/image-curator.md); WARN on missing extended schema fields (content_hash/width/height/aspect_ratio), aspect-ratio deviation > 30% from the theme × image_role target, and absent slidedata.json (counting rules skip) | `bun scripts/co-deck/validate-image-manifest.ts --workspace presentations/<proj> [--root <path>]` |
| `generate-themes-manifest.ts` | 2.0.0 | active | Scan themes/ + styles/ and emit preview/themes-manifest.js (file://-safe global); **v2.0.0**: deterministic output (no `generated_at`), `--check` mode, `--themes-md` auto-update THEMES.md table/compat matrix | `bun scripts/co-deck/generate-themes-manifest.ts [--check] [--themes-md] [--root <path>]` |
| `scaffold-theme-style.ts` | 2.0.0 | active | Scaffold a new theme or style; **v2.0.0**: `--from <theme>` flag for intentional derivation with provenance metadata (copies template.html + theme.css, sets `based_on` + `author`); minimally valid stubs (all 4 INJECT markers, full theme.json fields, basic CSS structure, region skeleton) | `bun scripts/co-deck/scaffold-theme-style.ts --theme <name> [--style <name>] [--from <source-theme>]` |
| `lib/theme-utils.ts` | 0.1.0 | active | Shared utilities for theme scripts: `listThemeDirs`, `listStyleDirs`, `normalizeStyleEntry`, `SLIDE_TYPE_HTML_TO_JSON` | `import from './lib/theme-utils'` (library, not CLI) |
| `lib/theme-contract.ts` | 0.1.0 | active | Typed theme package contracts, `loadThemePackage()`, `validateThemePackage()` | `import from './lib/theme-contract'` (library, not CLI) |
| `lib/theme-builder.ts` | 0.2.1 | active | Deterministic HTML deck builder: `buildThemeDeck(options)` — loads theme package, validates compatibility, replaces INJECT markers, inlines ppt-engine.js; **v0.2.0**: sets `data-toc-style` attribute from a new `tocStyle` option (defaults to `glass-drawer`); validates every generated `<script>` block parses as syntactically valid JS (HTML comments stripped first to avoid false positives from doc-comment prose mentioning `<script>`), pushing to `errors[]` on failure instead of shipping a broken runtime silently; **v0.2.1**: anchored the `<html>` attribute-injection regex to line-start (`^...$/m`) — template.html doc-comments describe the injection in prose that reproduces the literal tag syntax (e.g. `` Injects <html data-theme="..." data-style="<style>"> ``), which a non-anchored regex matched first, silently leaving the *real* tag with unreplaced source placeholder values (wrong `data-style`, missing `data-toc-style`) | `import from './lib/theme-builder'` (library, not CLI) |
| `build-theme-deck.ts` | 0.2.1 | active | CLI wrapper for theme builder: reads lecture-profile.md YAML frontmatter + slidedata.json, generates `lecture_v1.html`; **v0.2.1**: CI battery check [p] repair — the injector spawn's `join(scriptDir, ...)` moved to its own line (check [p]'s script-dir-anchored walk joins every quoted segment on a join/resolve line, so a mixed path+args join resolved to a bogus missing target); behavior unchanged; **v0.2.0** (U-20261105-007): post-build video pipeline — after a successful build, `inject-video-players.ts` runs automatically on decks whose slideData carries any `videoId` (idempotent, video-less decks untouched; injector failure WARNs without discarding the build), and `--download-videos` pre-fetches the deck's videos via download-videos.ts BEFORE injection so offline playback binds local files; canonical rebuild order (build → patch → inject) documented in agents/html-build.md + skills/html-build/SKILL.md; v0.1.1: fix missing `join` import from `path` (runtime crash on profile/slide-data path resolution); v0.1.2: read `presentation.tocStyle` from lecture-profile.md and pass through to `buildThemeDeck()` | `bun scripts/co-deck/build-theme-deck.ts --project <path> [--slide-data <path>] [--output <path>] [--version vN] [--download-videos]` |
| `inject-video-players.ts` | 1.1.0 | active | Post-build video player injection (lecture-deck-production procedure, ADR-0002): idempotent marker-based replace (`cdk-video-players` block stripped before re-injection — rebuild+re-run always safe), triple play-mode fallback (local mp4 → inline YouTube iframe over http(s) with `origin` → new-tab watch URL over `file://` dodging embed error 153), MutationObserver stop-on-slide-change cleanup (v4 stale-index defect class); theme-agnostic TS generalization of the 2026-10-ai-industry-research engagement's inject_video_players.py — the engagement copy stays in the project (ADR-0031 backport gate); **v1.1.0** (U-20261029-005): binding loop skips natively rendered video slides (`data-video="1"` from the shared ppt-engine VideoSlide component) so re-running after a rebuild cannot double-stage; **re-run + `node --check` after every build-theme-deck rebuild is the procedure gate** | `bun scripts/co-deck/inject-video-players.ts <deck.html> [--slidedata <path>] [--assets-dir <dir>]` |
| `tests/inject-video-players.test.ts` | 1.1.0 | active | Pin tests for inject-video-players: marker-based idempotency (double injection byte-identical), local/YouTube fallback wiring, MutationObserver presence, no-video-slides hard exit, native `data-video="1"` slide skip (U-20261029-005) | `bun test scripts/co-deck/tests/inject-video-players.test.ts` |
| `tests/diagram-helpers.test.ts` | 1.0.0 | active | Pins for the U-20261105-006 caption/source dedup helpers: `stripDiagramFooterText()` removes footer-band caption/takeaway/source lines + re-fits viewBox + idempotency + entity decoding + content-label preservation, `svgTextDuplicatesSlide()` flags caption/source/bullet echoes with unicode-aware normalization (Hangul kept — JS `\W` is ASCII-only) | `bun test scripts/co-deck/tests/diagram-helpers.test.ts` |
| `tests/download-videos.test.ts` | 1.0.0 | active | Pins for download-videos (U-20261105-007): no-videoId clean no-op, `--check-only` report without QuickDL, skip-if-exists short-circuits (exit 0, no network), missing QuickDL with pending downloads is a clear fatal (exit 1), mixed present/undersized/missing handling; QuickDL isolated to a nonexistent dir so tests never reach the real downloader | `bun test scripts/co-deck/tests/download-videos.test.ts` |
| `tests/build-theme-deck-video.test.ts` | 1.0.0 | active | Pins for the build-theme-deck post-build video pipeline (U-20261105-007): videoId deck is built AND injected in one command (marker + fallback present), video-less deck untouched (no marker), rebuild + re-inject stays idempotent (single marker block) | `bun test scripts/co-deck/tests/build-theme-deck-video.test.ts` |
| `tests/video-slide.test.ts` | 1.0.0 | active | Builder-side render-path pin for the chrome-free video-slide branch (U-20261029-005): all 6 themes build a videoId deck with the shared ppt-engine VideoSlide component + per-theme branch inlined, triple play-mode fallback markers, stop-on-slide-change observer, native `data-video` marker, ppt-engine.css `.video-slide` layout block | `bun test scripts/co-deck/tests/video-slide.test.ts` |
| `watch-deck.ts` | 0.1.0 | active | Live-reload authoring loop for theme deck: runs initial build, watches project directory for changes to .md/.json/.css/.html/.js/.ts files, triggers debounced rebuilds (default 300ms), survives build errors (continues watching), `--once` runs single build and exits | `bun scripts/co-deck/watch-deck.ts --project <path> [--slide-data <path>] [--output <path>] [--interval <ms>] [--once]` |
| `extract_slidedata.mjs` | 1.3.0 | active | Extract slideData array from HTML file to slidedata.json (bracket-depth state machine; requires strict-JSON slideData); dual bun/node `.mjs` utility — snake_case name is intentional (see note below) | `bun scripts/co-deck/extract_slidedata.mjs <html_file> [output_json]` |
| `tests/theme-builder.test.ts` | 0.1.0 | active | Tests for theme-builder: compatibility rejection, partial styles, marker replacement, CSS load order, strict-JSON, determinism, ppt-engine inlining | `bun test scripts/co-deck/tests/theme-builder.test.ts` |
| `tests/ppt-engine-integration.test.ts` | 0.1.0 | active | Builder-side integration tests for ppt-engine.js shared runtime contract: no `<script src>` in output, inlined for PPT themes, not inlined for pitch, initPPT/renderSlide present, documentation header validation | `bun test scripts/co-deck/tests/ppt-engine-integration.test.ts` |
| `tests/ppt-engine-integration.browser.mjs` | 0.2.0 | active | Playwright browser integration tests for PPT-engine runtime: navigation (arrows/buttons/keys), TOC drawer, transitions, narration controls, timer, fullscreen, auto-advance, chrome-free videoId slide render path (U-20261029-005) — for each PPT-engine theme (outline, pitch-enhanced, vertical, zen); runs via Node.js | `node scripts/co-deck/tests/ppt-engine-integration.browser.mjs` |
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
| `tests/estimate-layout-lint.test.ts` | 1.0.0 | active | Pin tests for estimate-layout `--lint` minimum content checks (U-20261029-006): sparse standard deck FAILs with `(min)` rows + exit 1, dense deck passes, `videoId` slides exempt, divider/title types exempt, `layout_overrides` floor raise flips a passing deck | `bun test scripts/co-deck/tests/estimate-layout-lint.test.ts` |
| `tests/lib-layout-overrides.test.ts` | 1.0.0 | active | Pin the shared layout_overrides parser dialect (U-20261105-003): dotted keys build nested objects, nested blocks still parse, dotted+nested forms at the same path MERGE (mixed-form profiles), block termination at column-0 keys, deepMerge scalar/object/null semantics | `bun test scripts/co-deck/tests/lib-layout-overrides.test.ts` |
| `tests/lib-slide-type.test.ts` | 1.0.0 | active | Pin slideTypeOf() schema detection (U-20261105-001): legacy `type` precedence, all boolean flag forms → slide_types keys, standard fallback; CLI e2e — boolean-flag special slides exempt from standard minimums (gate exit 0, WARN rows) | `bun test scripts/co-deck/tests/lib-slide-type.test.ts` |
| `tests/lib-markdown.test.ts` | 1.0.0 | active | Pin markdown inline-run helpers (U-20261105-005 item 6b): run splitting on **bold** markers, word-wrap with weight-aware measurement, explicit \n breaks | `bun test scripts/co-deck/tests/lib-markdown.test.ts` |
| `tests/lib-pdf-font-patch.test.ts` | 1.0.0 | active | Pin the CustomFontEmbedder patch (U-20261105-005 items 1+2): integer /W rounding, shaped-glyph closure over probing stub font, patch idempotence; real-font /W coverage check (skipped when no local font pool) | `bun test scripts/co-deck/tests/lib-pdf-font-patch.test.ts` |
| `tests/gen-slides-pdf-render.test.ts` | 1.0.0 | active | E2E render-path regression pins (U-20261105-002/-005, font-conditional): no C_VIS_BG fill after first text op on visual slides (bg_image disabled), footnotes/punchline/contactPhone text extractable, /W covers shaped ':'/'-' gids with integer entries | `bun test scripts/co-deck/tests/gen-slides-pdf-render.test.ts` |
| `tests/validate-image-manifest.test.ts` | 1.0.0 | active | Pin tests for validate-image-manifest background rules (U-20261029-007): family reuse ERROR, missing global path ERROR, pathless background entry ERROR, unreadable background_image.path ERROR, compliant `individual` flow passes, individual-scope global-path WARN, slidedata-absent WARN-skip, per-slide duplicate-hash still ERRORs | `bun test scripts/co-deck/tests/validate-image-manifest.test.ts` |
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

*Last Updated: 2026-11-06 — U-20261105-004/-006/-007 batch: diagram-helpers 1.3.0 (SVG caption/source strip + dup audit, homedir import fix), gen-visual-images 3.3.0 (strip + audit wired), build-theme-deck 0.2.0 (post-build video inject + --download-videos), new download-videos.ts 1.0.0 (offline video fetch), new diagram-helpers / download-videos / build-theme-deck-video test rows. (2026-10-30 — U-20261029-005/-006/-007 batch: estimate-layout 1.4.0, validate-image-manifest 1.1.0, inject-video-players 1.1.0, new video-slide / estimate-layout-lint / validate-image-manifest test rows, ppt-engine-integration.browser.mjs 0.2.0. 2026-10-29 — added root `package.json` (runtime deps + test/test:visual/test:smoke entries), documented `extract_slidedata.mjs` snake_case rationale, added `puppeteer-core` to the deps table, fixed `build-theme-preview` flags, removed the false vendored-copy claim. 2026-08-29 — handbook scripts promoted to templates/common/scripts/handbook/.)*
