# Theme System Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current theme assets into a reliable, contract-driven theme system whose registry, HTML output, preview, PDF output, and validation remain synchronized.

**Architecture:** Establish a machine-readable theme package contract as the source of truth, then route both production deck generation and preview rendering through one deterministic builder. Consolidate duplicated presentation runtime code and add contract, browser, and visual-regression tests around every supported theme and style combination.

**Tech Stack:** Bun, TypeScript, HTML/CSS/JavaScript, Playwright, existing co-deck theme packages and PDF tooling.

## Current Codebase Audit Summary

> Findings from a full codebase scan performed before writing this plan. See "Assumptions vs. Reality" below for details.

| Area | Finding |
|------|---------|
| Theme packages | 5 themes (outline, pitch, pitch-enhanced, vertical, zen) × 4 required files each — consistent |
| Style packages | 5 styles (classic, minimal, premium-dark, academic, visual-heavy) × 2 files each — consistent |
| INJECT markers | All 5 templates use exactly 4 markers: `INJECT:title`, `INJECT:CSS`, `INJECT:slides`, `INJECT:slideData` |
| Script lib | No `scripts/co-deck/lib/` exists; utilities are duplicated across 3 scripts |
| Test coverage | Only `extract_slidedata.test.mjs` exists; zero tests for theme scripts |
| Version drift | `outline` and `zen`: theme.json says 1.0.0, THEMES.md says 3.0.0 |
| Preview | Uses its own `buildSlideEl()` renderer — no ppt-engine.js, no `initPPT()`, no navigation runtime |
| Two families | `pitch` = self-contained inline runtime; other 4 = shared ppt-engine.js/css loaded via `<script>` or inlined at build |
| Slide-type vocab | HTML uses `data-type="cover"` for title slides (PPT themes) vs `data-type="title"` (pitch); JSON consistently uses `"title"` |
| Playwright | Deprecated for measurement but still in `optionalDependencies`; needed for browser smoke tests (Task 6) |
| `@resvg/resvg-js` | Documented in SCRIPTS.md but missing from package.json (pre-existing gap, out of scope) |

## Global Constraints

- Keep `docs/html-themes/themes/<name>/` as the theme package boundary.
- Keep styles in the shared `docs/html-themes/styles/<name>/` pool.
- Preserve the CSS load order: base CSS, optional shared engine CSS, theme CSS, style CSS.
- Treat `theme.json` and validated filesystem assets as machine-readable truth; generate human-readable registry content from them.
- Use TypeScript for new automation and validation scripts.
- Preserve strict-JSON `slideData` compatibility with `extract_slidedata.mjs`.
- Do not change presentation visuals while establishing the contract unless a failing compatibility test proves a correction is required.
- All workspace documentation, code comments, commits, and PR content must be in English.
- `partial_styles` field in theme.json is **optional** (may be absent, empty array, or array of objects) — `pitch` omits it entirely; contract must handle all three states.
- `version` and `version_num` may coexist in theme.json; the contract uses `version` as canonical.
- HTML slide-type vocabulary differs from JSON: PPT-engine themes use `data-type="cover"` while JSON and pdf_layout_spec use `"title"`. The contract must define this mapping explicitly.

## Assumptions vs. Reality (Pre-Plan Audit)

The following were verified against the actual codebase on 2026-07-01:

| # | Assumption in Draft | Codebase Reality | Plan Impact |
|---|---|---|---|
| A1 | `scripts/co-deck/lib/` will be created | Does not exist; utilities duplicated in 3 scripts | Task 0 added to extract shared utils first |
| A2 | `outline`/`zen` may not be 3.0.0 | theme.json = 1.0.0, THEMES.md = 3.0.0 — confirmed drift | Task 2 must reconcile; JSON is source of truth |
| A3 | `partial_styles` is an array | `pitch` omits the field entirely | Contract must treat undefined as valid |
| A4 | Templates may have copied ppt-engine.js | No copies exist; runtime is loaded via `<script>` or inlined at build | Task 7 refocused on `renderSlide()` extraction, not copy removal |
| A5 | Preview uses a "generic" renderer | Preview is **completely independent**: own `buildSlideEl()`, no ppt-engine.js, no initPPT(), no navigation, no TOC, no timer | Task 5 scope expanded |
| A6 | Tests run via `bun test` | No `"test"` script in package.json; must invoke directly | Task 0 adds `"test"` script |
| A7 | Playwright is available for browser tests | In optionalDependencies but deprecated for measurement; still functional | Keep in deps for Task 6 browser tests |
| A8 | `outline` punchline type may be intentional | `outline` declares `punchline: true` — same as all other themes | Task 2 flags as explicit decision point |
| A9 | `audit-variant.ts` catches theme drift | File does not exist; `audit.ts` delegates to it but no-op | Task 2 notes gap; theme validator fills role |

---

## Roadmap Summary

| Horizon | Target | Primary outcome | Exit condition |
|---|---|---|---|
| Short term | 1-2 weeks | Make the existing system internally consistent and measurable | Registry drift is removed and CI rejects invalid theme packages |
| Medium term | 3-6 weeks | Establish one deterministic HTML build and preview path | Preview and production HTML use the same template renderer |
| Long term | 2-3 months | Make theme development maintainable and regression-safe | Shared runtime, visual baselines, and authoring automation are operational |

## Short-Term Plan: Stabilize the Contract

### Task 0: Infrastructure prerequisites

**Rationale:** The three existing theme scripts (`validate-theme-styles.ts`, `generate-themes-manifest.ts`, `scaffold-theme-style.ts`) are self-contained and duplicate shared utility functions (`listThemeDirs`, `listStyleDirs`, `normalizeStyleEntry`). No `lib/` directory exists for shared code. There is no `test` script in package.json.

**Files:**
- Create: `scripts/co-deck/lib/theme-utils.ts`
- Create: `scripts/co-deck/tests/setup.ts` (shared test helpers if needed)
- Modify: `package.json`

**Interfaces:**
- Produces: `listThemeDirs(root, exclude?)`, `listStyleDirs(root)`, `normalizeStyleEntry(entry)`, and a `"test"` npm script entry.

- [ ] Create `scripts/co-deck/lib/` directory.
- [ ] Extract `listThemeDirs`, `listStyleDirs`, `normalizeStyleEntry` into `lib/theme-utils.ts` from the three existing scripts.
- [ ] Refactor the three existing scripts to import from `lib/theme-utils.ts` instead of defining these inline.
- [ ] Add `"test": "bun test"` to `package.json` scripts.
- [ ] Run `bun test scripts/co-deck/tests/extract_slidedata.test.mjs` to confirm existing tests still pass after refactoring.
- [ ] Run `bun scripts/co-deck/validate-theme-styles.ts` and `bun scripts/co-deck/generate-themes-manifest.ts` to confirm refactored scripts still work.

**Completion criteria:** Shared theme utilities live in `lib/`; existing scripts import from it; `bun test` works as a command.

### Task 1: Define and validate the theme package contract

**Files:**
- Create: `scripts/co-deck/lib/theme-contract.ts`
- Create: `scripts/co-deck/tests/theme-contract.test.ts`
- Modify: `scripts/co-deck/validate-theme-styles.ts`
- Modify: `scripts/co-deck/SCRIPTS.md`

**Interfaces:**
- Consumes: `theme.json`, `template.html`, `theme.css`, `pdf_layout_spec.json`, shared style directories.
- Produces: `loadThemePackage(root, name)`, `validateThemePackage(pkg)`, and structured errors with file and field paths.

- [ ] Define typed contracts for theme metadata, CSS asset declarations, supported slide types, content rules, compatibility declarations, and PDF regions.
- [ ] Handle `partial_styles` as optional (undefined/absent = no partials), not just empty — `pitch` omits this field entirely.
- [ ] Define the `version` field as canonical; deprecate or ignore `version_num` if present.
- [ ] Export `SLIDE_TYPE_HTML_TO_JSON` as a typed constant (`{ cover: 'title' } as const`) from `theme-contract.ts` for cross-consumer use (extract_slidedata.mjs, builder). **[A-01]**
- [ ] Add failing tests for a missing template, missing theme CSS, invalid CSS path, missing injection marker, incompatible/compatible overlap, and HTML/PDF slide-type drift.
- [ ] Extend validation to require all four theme package files and the four template injection markers (`INJECT:title`, `INJECT:CSS`, `INJECT:slides`, `INJECT:slideData`).
- [ ] Validate every declared CSS path and require paths to remain inside `docs/html-themes/`.
- [ ] Define the HTML-to-JSON slide-type vocabulary mapping: HTML `data-type="cover"` maps to JSON `"title"`; all other types share the same name (`divider`, `punchline`, `profile`, `contact`, `standard`).
- [ ] Cross-check `theme.json.slide_types` against `pdf_layout_spec.json.slide_types` using the vocabulary mapping above.
- [ ] Run `bun test scripts/co-deck/tests/theme-contract.test.ts` and expect all tests to pass.
- [ ] Run `bun scripts/co-deck/validate-theme-styles.ts` and expect zero errors.

**Completion criteria:** A structurally incomplete theme can no longer pass validation.

### Task 2: Remove registry and metadata drift

**Files:**
- Modify: `docs/html-themes/themes/outline/theme.json`
- Modify: `docs/html-themes/themes/zen/theme.json`
- Modify: other `docs/html-themes/themes/*/theme.json` files only where audit evidence requires it
- Modify: `docs/html-themes/THEMES.md`
- Modify: `docs/co-deck.context.md`
- Modify: `variant.json`

**Interfaces:**
- Consumes: validated theme packages and compatibility declarations.
- Produces: one consistent version and compatibility description for every theme.

- [ ] Decide whether the implemented `outline` and `zen` packages meet 3.0.0 behavior — **theme.json is the source of truth**: either upgrade JSON to 3.0.0 (if behavior matches PPT-engine features) or downgrade THEMES.md to 1.0.0. Current state: theme.json = 1.0.0, THEMES.md = 3.0.0 — a mismatch.
- [ ] Remove `version_num` field from `outline` and `zen` theme.json if present; standardize on `version` only.
- [ ] Reconcile `compatible_styles`, `partial_styles`, and `incompatible_styles` for every theme. `partial_styles` is optional (pitch omits it) — do not add empty arrays where they are intentionally absent.
- [ ] Remove contradictory statements about `zen`, `vertical`, and `visual-heavy` compatibility.
- [ ] Decide whether `outline` declaring `punchline: true` is correct or an artifact — it is a text-focused paradigm but currently shares the same slide_types set as all other themes.
- [ ] Add a validator check that no style is simultaneously compatible and incompatible.
- [ ] Note: `scripts/audit-variant.ts` does not exist despite `audit.ts` delegating to it. The theme validator should fill this role or the delegation should be removed.
- [ ] Run the theme validator and the workspace audit.

**Completion criteria:** The same version and compatibility result is reported by JSON metadata, generated manifest, registry documentation, and validation output.

### Task 3: Generate registry artifacts deterministically

**Files:**
- Modify: `scripts/co-deck/generate-themes-manifest.ts`
- Create: `scripts/co-deck/tests/generate-themes-manifest.test.ts`
- Modify: `docs/html-themes/preview/themes-manifest.js`
- Modify: `docs/html-themes/THEMES.md`

**Interfaces:**
- Consumes: validated `ThemePackage` objects from Task 1.
- Produces: deterministic preview manifest and a generated registry section without timestamps that change on every run.

**Prerequisite (from Meeting A-03):** Add protected Markdown markers to THEMES.md before generating into it: `<!-- AUTO-GENERATED-THEME-TABLE:START/END -->` around the theme table (lines 13-19) and `<!-- AUTO-GENERATED-COMPAT-MATRIX:START/END -->` around the compatibility matrix (lines 153-159). Generator only modifies content between markers.

- [ ] Add protected Markdown markers to THEMES.md theme table and compatibility matrix sections. **[A-03]**
- [ ] Add a test proving two consecutive generations produce byte-identical output.
- [ ] Remove volatile generation timestamps or isolate them outside tracked output.
- [ ] Generate theme and compatibility tables from package metadata between protected Markdown markers.
- [ ] Add `--check` mode that exits non-zero when tracked artifacts are stale.
- [ ] Run the generator twice and verify `git diff --exit-code` remains clean after the first generation.

**Completion criteria:** Manual registry edits are unnecessary and stale generated files fail CI.

### Short-Term Quality Gate

- [ ] `bun test scripts/co-deck/tests/extract_slidedata.test.mjs` (regression: existing tests still pass after Task 0 refactoring)
- [ ] `bun test scripts/co-deck/tests/theme-contract.test.ts scripts/co-deck/tests/generate-themes-manifest.test.ts`
- [ ] `bun scripts/co-deck/validate-theme-styles.ts`
- [ ] `bun scripts/co-deck/generate-themes-manifest.ts --check`
- [ ] `bun scripts/audit.ts`
- [ ] Confirm all five current themes and five styles are represented accurately.
- [ ] Confirm `outline` and `zen` version is reconciled between theme.json and THEMES.md.

## Medium-Term Plan: Unify Build and Preview

### Task 4: Implement a deterministic theme deck builder

**Files:**
- Create: `scripts/co-deck/lib/theme-builder.ts`
- Create: `scripts/co-deck/build-theme-deck.ts`
- Create: `scripts/co-deck/tests/theme-builder.test.ts`
- Modify: `agents/html-build.md`
- Modify: `skills/html-build/SKILL.md`
- Modify: `scripts/co-deck/SCRIPTS.md`

**Interfaces:**
- Consumes: project path, lecture profile, strict-JSON slide data, theme package, style package.
- Produces: `buildThemeDeck(options): Promise<BuildResult>` and a CLI that writes `lecture_<topic>_vN.html`.

**Builder Boundary (from Meeting A-02, B-02):** The builder handles: (1) theme/style resolution from lecture profile, (2) package validation via contract, (3) INJECT marker replacement (title, CSS, slides, slideData), (4) CSS link generation in correct load order, (5) ppt-engine.js inlining for PPT-engine themes, (6) strict-JSON slideData injection. The builder does NOT handle: `renderSlide()` implementation (template-provided), slide content generation (storyline agent), image downloading (image-curator).

**Rollback Plan (from Meeting B-02):** Update `agents/html-build.md` to invoke the builder as primary method. Keep existing manual assembly instructions as documented fallback wrapped in a conditional: "If the builder exits non-zero, fall back to the following manual process." Specify marker replacement order: CSS links → slideData → ppt-engine.js inlining. Remove manual instructions in long-term cleanup after builder is proven.

- [ ] Write failing tests for theme/style compatibility rejection, marker replacement, CSS load order, strict-JSON preservation, and output path calculation.
- [ ] Implement profile parsing and explicit theme/style resolution.
- [ ] Load and validate the selected package before rendering.
- [ ] Replace injection markers exactly once and fail on missing or duplicate markers.
- [ ] Inline ppt-engine.js for PPT-engine themes; skip for pitch (self-contained runtime).
- [ ] Support `background_image` options from lecture profile (enabled, scope, source, overlay). **[A-02]**
- [ ] Update `agents/html-build.md` to invoke the builder as primary method; keep manual assembly as documented fallback. **[B-02]**
- [ ] Build one fixture deck for every theme and validate extracted slide data.

**Completion criteria:** Identical inputs always produce structurally identical HTML, independent of the executing agent.

### Task 5: Make Preview use the production renderer

**Files:**
- Modify: `docs/html-themes/preview/preview.html`
- Create: `docs/html-themes/preview/preview-data.json`
- Create: `scripts/co-deck/build-theme-preview.ts`
- Create: `scripts/co-deck/tests/theme-preview.test.ts`

**Interfaces:**
- Consumes: the builder from Task 4 and representative preview slide data.
- Produces: a preview iframe document built from the selected real theme template.

**Current state (verified 2026-07-01):** The preview is **completely independent** of the production rendering path. It has its own `buildSlideEl()` that creates simple divs with inline styles, does NOT load ppt-engine.js, does NOT call `initPPT()`, does NOT support transitions/narration/timer/TOC-drawer/footer-nav. It only swaps CSS `<link>` hrefs and sets `data-theme`/`data-style` attributes. This is a significant divergence — what users see in Preview is not the same rendering path used in generated lecture HTML.

**Preview Error Handling (from Meeting B-01):** No CSS-only degraded fallback. If the production-rendered iframe fails to initialize, show an error panel with two sections: (1) **Contract errors** — validation failures (missing files, invalid metadata, incompatible combinations), (2) **Runtime errors** — failures during iframe initialization (JS errors, missing assets, timeout). Include a "Copy error details" button for diagnostics. The error panel replaces the preview content entirely.

- [ ] Add tests proving the preview contains theme-native DOM markers and runtime controls (initPPT, transitions, TOC drawer, footer navigation).
- [ ] Replace the generic `buildSlideEl()` preview renderer with an iframe generated through `buildThemeDeck()`.
- [ ] Cover title (cover), divider, standard, punchline, profile, contact, visual, and background-image cases in preview data.
- [ ] Preserve URL-driven theme/style selection and reject incompatible combinations visibly.
- [ ] Implement fail-loudly error panel with contract errors section, runtime errors section, and "Copy error details" button. No CSS-only fallback. **[B-01]**
- [ ] Verify that the preview iframe loads ppt-engine.js for PPT-engine themes and supports the full runtime (keyboard shortcuts, TOC drawer, transitions, fullscreen, narrator, timer).
- [ ] For the `pitch` theme (self-contained runtime), verify the preview iframe uses its inline runtime correctly.

**Completion criteria:** What users approve in Preview is the same rendering path used in generated lecture HTML.

### Task 6: Add browser smoke tests for the compatibility matrix

**Files:**
- Create: `scripts/co-deck/tests/theme-browser-smoke.test.ts`
- Create: `scripts/co-deck/tests/fixtures/theme-deck/slide-data.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: every compatible and partial theme/style pair from the contract.
- Produces: console-error, DOM, navigation, and overflow test results.

- [ ] Ensure Playwright remains in `optionalDependencies` for browser tests — do not remove.
- [ ] Generate a test deck for every declared compatible pair.
- [ ] Assert zero uncaught JavaScript errors and zero missing local assets.
- [ ] Verify slide count, navigation, TOC, fullscreen control presence, and theme-specific runtime initialization.
- [ ] Check gross horizontal and vertical overflow for each slide type at the canonical viewport.
- [ ] Mark partial combinations explicitly and test their documented limitation rather than treating them as fully compatible.

**Completion criteria:** Every declared compatible combination has an executable browser-level proof.

### Medium-Term Quality Gate

- [ ] Generate production and preview fixtures through the same builder.
- [ ] Run extraction tests against all generated decks.
- [ ] Run the full Playwright compatibility matrix without console or asset errors.
- [ ] Export sample PDFs for all themes and compare slide counts and declared slide types.
- [ ] Run `bun scripts/audit.ts`.

## Long-Term Plan: Consolidate Runtime and Authoring

### Task 7: Consolidate the shared presentation runtime

**Files:**
- Modify: `docs/html-themes/themes/_shared/ppt-engine.js`
- Modify: `docs/html-themes/themes/outline/template.html`
- Modify: `docs/html-themes/themes/pitch-enhanced/template.html`
- Modify: `docs/html-themes/themes/vertical/template.html`
- Modify: `docs/html-themes/themes/zen/template.html`
- Modify: `scripts/co-deck/lib/theme-builder.ts`
- Create: `scripts/co-deck/tests/ppt-engine-integration.test.ts`

**Interfaces:**
- Consumes: a versioned shared runtime and small per-theme initialization options.
- Produces: one runtime implementation inlined by the builder into standalone HTML.

**Current state (verified 2026-07-01):** No theme has a copied ppt-engine.js — there is exactly one copy in `_shared/`. The duplication issue is different: each PPT-engine theme defines its own `renderSlide()` function inline in template.html (not shared), and the html-build agent must manually inline ppt-engine.js at build time. The `pitch` theme has its own completely self-contained runtime (own `escapeText`, `el`, `showSlide`, `changeSlide`, TOC, presenter tools — no ppt-engine dependency).

- [ ] Capture current navigation, narration, auto-advance, presenter tools, and fullscreen behavior with integration tests.
- [ ] Define a versioned `initPPT(slideData, containerId, options)` contract with the existing function signature as baseline.
- [ ] Formalize the ppt-engine.js inline-at-build-time contract: the builder must inject the full shared runtime into the output HTML, making generated decks portable single-file HTML.
- [ ] Extract per-theme `renderSlide()` patterns into a shared per-family module: one for PPT-engine family (outline, pitch-enhanced, zen, vertical) and one for pitch family — or decide `renderSlide()` must remain per-theme due to DOM vocabulary differences (`cover` vs `title`, `.slide-header + .slide-card` vs `.slide-content > .slide-left + .right-panel`).
- [ ] Keep theme-specific behavior in small adapters rather than branching on theme names inside the engine.

**Completion criteria:** A shared runtime change is made once and verified across all PPT-engine themes.

### Task 8: Add visual-regression baselines

**Files:**
- Create: `scripts/co-deck/tests/theme-visual-regression.test.ts`
- Create: `docs/html-themes/baselines/README.md`
- Create: baseline images under `docs/html-themes/baselines/<theme>/<style>/`
- Modify: `package.json`

**Interfaces:**
- Consumes: deterministic preview fixtures and canonical browser/font configuration.
- Produces: screenshot diffs with explicit review and baseline-update commands.

- [ ] Define the canonical viewport, font set, animation-disabled mode, and screenshot timing.
- [ ] Capture representative slide-type baselines for fully compatible combinations.
- [ ] Use focused baseline coverage for partial combinations.
- [ ] Set an initial pixel-difference threshold and document how to approve intentional changes.
- [ ] Store failure diff images as CI artifacts.

**Completion criteria:** Unintended visual changes are detected before merge.

### Task 9: Complete theme authoring automation

**Files:**
- Modify: `scripts/co-deck/scaffold-theme-style.ts`
- Create: `scripts/co-deck/verify-new-theme.ts`
- Create: `scripts/co-deck/tests/scaffold-theme-style.test.ts`
- Create: `scripts/co-deck/tests/verify-new-theme.test.ts`
- Modify: `skills/theme-authoring/SKILL.md`
- Modify: `docs/html-themes/THEMES.md`

**Interfaces:**
- Consumes: new theme or style name plus declared compatibility and rendering paradigm.
- Produces: contract-valid scaffolding, generated preview, smoke-test fixture, and registration changes.

**Registration Gate (from Meeting B-03, B-04):** Create `verify-new-theme.ts` as a single composite command that blocks registration if any step fails. Five checks: (1) `validate-theme-styles.ts` — structural validation, (2) `generate-themes-manifest.ts --check` — manifest current, (3) THEMES.md marker check — generated sections match package metadata, (4) fixture build — `build-theme-deck.ts` with new theme produces valid HTML, `extract_slidedata.mjs` matches input, (5) PDF generation test — `gen-slides-pdf.ts` against fixture deck produces valid PDF. Include `--fast` flag to skip checks 4-5 for iterative development. Target: <30s full, <3s fast.

- [ ] Make scaffolding emit a minimally valid package rather than unchecked placeholders.
- [ ] Add `--from <theme>` for intentional theme derivation with provenance metadata.
- [ ] Implement `verify-new-theme.ts` with 5 checks + `--fast` flag. **[B-03]**
- [ ] Add PDF generation test as check 5 in `verify-new-theme.ts`. **[B-04]**
- [ ] Prevent registration until `verify-new-theme.ts` exits 0.
- [ ] Document deprecation and migration rules for renamed or removed themes.

**Completion criteria:** A new theme follows one repeatable, gated workflow from scaffold to registry.

### Long-Term Quality Gate

- [ ] Run unit, contract, browser, extraction, PDF, and visual-regression suites in CI.
- [ ] Require generated-artifact cleanliness with `--check` commands.
- [ ] Publish a compatibility report for each theme release.
- [ ] Confirm ppt-engine.js inline-at-build-time contract is enforced by the builder (no `<script src>` references to shared runtime in generated output).
- [ ] Confirm a newly scaffolded fixture theme passes the complete authoring workflow.

## Sequencing and Dependencies

```text
Infrastructure prerequisites (shared lib, test script)
  -> contract validation
  -> metadata and registry reconciliation
  -> deterministic registry generation
  -> deterministic deck builder
  -> production-renderer preview
  -> compatibility browser tests
  -> shared runtime consolidation
  -> visual regression
  -> end-to-end authoring automation
```

Do not begin runtime consolidation before browser tests capture current behavior. Do not build visual baselines before Preview and production generation share the same renderer.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Existing decks depend on undocumented template behavior | Builder migration may break older presentations | Add fixture decks from current outputs and preserve a temporary legacy build mode during medium-term migration |
| Fonts make screenshots unstable across machines | False visual-regression failures | Pin downloaded fonts and canonical browser configuration before recording baselines |
| Compatibility declarations are aspirational | Matrix tests may expose many failures | Treat failures as evidence; downgrade combinations to partial or incompatible until corrected |
| Shared runtime extraction changes behavior | Navigation or narration regressions | Capture behavior with integration tests before modifying runtime code |
| Registry generation overwrites useful prose | Documentation becomes less useful | Generate only bounded tables and facts; retain explanatory prose outside generated markers |
| `partial_styles` field absence breaks consumers | Scripts that assume array type get TypeError on undefined | Contract must normalize absent/undefined to empty array before downstream use |
| `outline`/`zen` version mismatch confuses agents | PM and specialist agents may pick wrong version for decisions | Resolve in Task 2 before any agent-dependent work begins |
| `audit-variant.ts` delegation is a no-op | Theme drift goes undetected by `bun scripts/audit.ts` | Either create audit-variant.ts or add theme-check delegation directly to audit.ts |

## Success Metrics

- Shared theme utilities extracted into `scripts/co-deck/lib/` with zero duplication across scripts.
- Zero drift between `theme.json`, preview manifest, registry tables, and compatibility checks.
- `theme.json version` is the single source of truth; THEMES.md generated sections always match.
- One deterministic builder used by both production HTML generation and Preview.
- One shared PPT runtime implementation for all PPT-engine themes, with a formalized inline-at-build-time contract.
- One automated browser smoke result for every declared compatible pair.
- Visual regression coverage for all fully compatible theme/style combinations.
- A new contract-valid theme can be scaffolded, previewed, tested, and registered through documented commands.
- `bun test` runs the full test suite; `bun scripts/audit.ts` catches theme drift via audit-variant delegation.

## Recommended Delivery Strategy

Deliver each horizon as a separate reviewable initiative. The short-term initiative is mandatory stabilization work and should land first. The medium-term initiative changes the generation architecture and should include a compatibility migration note. The long-term initiative should be split into runtime consolidation, visual regression, and authoring automation so each can be reviewed and rolled back independently.
