# Theme System Enhancement Phase 2 — Implementation Plan

> **Spec ID**: `theme-enhancement-phase2`
> **Design doc**: [`2026-07-02-theme-enhancement-phase2-design.md`](2026-07-02-theme-enhancement-phase2-design.md)
> **Status**: Implementation plan — approved design, execution pending
> **Date**: 2026-07-02
> **For agentic workers**: execute PR by PR in order (PR-1 → PR-2 → PR-3 → PR-4); each PR ends with `/sync`. Steps use checkbox (`- [ ]`) syntax for tracking.

## Pre-Implementation Audit (verified 2026-07-02)

Contracts verified against the actual codebase before writing this plan:

| # | Contract | Finding | Impact |
|---|----------|---------|--------|
| V1 | audit-variant delegation | `scripts/audit.ts:1277` (workspace + `templates/common`): checks `path.join('scripts', 'audit-variant.ts')` **relative to CWD**, runs `execFileSync('bun', [path], { stdio: 'inherit' })`; any non-zero exit → audit Fail (ADR-0044) | Hook fires automatically only in L2 forks (CWD = project root). Inside `templates/co-deck`, run it directly: `bun scripts/audit-variant.ts` |
| V2 | WS-05 flat-script check | `validate-templates.ts` `checkL0L1ScriptsNotInVariants()` warns only when the flat script's layer is `L0+L1` per the script layer map | `templates/co-deck/scripts/audit-variant.ts` (variant-local, per ADR-0044) is NOT flagged — top-level placement is safe |
| V3 | B-03 manifest check | `validate-templates.ts` verifies every `variant.json` `script_manifest.local` path exists | `audit-variant.ts` must be registered in `variant.json` |
| V4 | Root resolution | Theme scripts resolve root via `resolveWorkspaceRoot(import.meta.path)` assuming `scripts/co-deck/` depth (2 levels up); all accept `--root` | `audit-variant.ts` sits one level up (`scripts/`) — it must compute root = `dirname(dirname(import.meta.path))` and pass `--root <root>` (or `cwd: root`) to child scripts |
| V5 | THEMES.md freshness | `generate-themes-manifest.ts` v2.0.0 `--check` covers only `themes-manifest.js`; `--themes-md` **writes** THEMES.md with no check mode | A1 needs a new `--themes-md-check` mode (refactor table rendering into pure functions, diff against disk) |
| V6 | style.css structure | All styles have a single `:root` block; some (e.g. `visual-heavy`) also have `[data-style]` structural rules after it; `premium-dark` has a leading `@import` | Track B markers wrap the `:root` block only; everything outside markers is preserved verbatim |
| V7 | ppt-engine versioning | `_shared/ppt-engine.js` has no version constant (only "NarrationEngine v2.4" in comments) | Track C introduces `const PPT_ENGINE_VERSION = '<semver>'` + header line; tests assert it |
| V8 | pitch exclusion | `pitch` v1.0.0 is self-contained (no ppt-engine.js) by standing policy | All Track C work applies to outline / pitch-enhanced / vertical / zen only |

---

## PR-1 — Track A: Governance Hardening

**Branch/commit**: `feat(co-deck): add variant audit hook, theme test aggregation, compat report`

### Step 1: `generate-themes-manifest.ts` → v2.1.0

Files: `scripts/co-deck/generate-themes-manifest.ts`, `scripts/co-deck/tests/generate-themes-manifest.test.ts`

- [ ] Refactor: extract `renderThemeTable(themeDirs, themesRoot)` and `renderCompatMatrix(themeDirs, styleDirs, themesRoot)` as exported pure functions (currently inlined in the `--themes-md` branch).
- [ ] Add `--themes-md-check`: regenerate both marker sections in memory, compare with disk content between markers, exit 1 with a labeled diff summary when stale.
- [ ] Add `--report`: emit `docs/html-themes/COMPAT_REPORT.md` — per theme: version, engine family (ppt-engine vs self-contained), slide types, per-style status (✅/⚠️+reason/❌+reason from theme.json), baseline coverage (does `docs/html-themes/baselines/<theme>/<style>/` contain PNGs). Deterministic: no timestamps, sorted keys.
- [ ] Tests: `--report` determinism (two runs byte-identical), `--themes-md-check` detects a seeded marker-section edit, report content for a fixture theme.

### Step 2: Create `scripts/audit-variant.ts` (v1.0.0)

Files: `scripts/audit-variant.ts` (new, top level per V1/V2), `scripts/co-deck/SCRIPTS.md`, `variant.json`

- [ ] Root resolution per V4; run each check via `execFileSync('bun', [script, '--root', root], { stdio: 'inherit' })` style invocation.
- [ ] Checks (collect all, exit 1 if any failed):
  1. `scripts/co-deck/validate-theme-styles.ts`
  2. `scripts/co-deck/generate-themes-manifest.ts --check`
  3. `scripts/co-deck/generate-themes-manifest.ts --themes-md-check`
  4. *(activated in PR-2)* `scripts/co-deck/build-style-artifacts.ts --check`
- [ ] Labeled output: `[audit-variant] (n/4) <name> ... PASS|FAIL`.
- [ ] Register in `variant.json` `script_manifest.local` (path `scripts/audit-variant.ts`) and add SCRIPTS.md registry row (note: intentionally top-level per ADR-0044 — the ADR-0033 `scripts/co-deck/` rule yields to the designated hook path).

### Step 3: `package.json` updates

- [ ] Add `"@resvg/resvg-js": "^2.6.2"` to `dependencies` (used by `gen-visual-images.ts`, documented in SCRIPTS.md, currently missing). Run `bun install`.
- [ ] Add scripts: `"test:theme": "bun test scripts/co-deck/tests/"`, `"test:theme:browser": "node scripts/co-deck/tests/theme-browser-smoke.browser.mjs && node scripts/co-deck/tests/ppt-engine-integration.browser.mjs"`, `"audit:variant": "bun scripts/audit-variant.ts"`.

### Step 4: Docs

- [ ] SCRIPTS.md: bump `generate-themes-manifest.ts` to 2.1.0 (new modes), add `audit-variant.ts` row, update Last Updated line.
- [ ] THEMES.md Scripts & Tools table: same two updates.
- [ ] The follow-up root-CI job spec already lives in the design doc §A3 — no root files touched in this PR.

### PR-1 verification

- [ ] `bun scripts/audit-variant.ts` → exit 0 on clean tree.
- [ ] Seed drift (hand-edit one THEMES.md generated row) → exit non-zero with check 3 failing → revert.
- [ ] `bun run test:theme` green; `bun run test:theme:browser` green (local, Playwright).
- [ ] `bun scripts/audit.ts` (from workspace root) passes.
- [ ] `/changelog` + `/sync`.

---

## PR-2 — Track B: Design-Token Single Source

**Branch/commit**: `feat(co-deck): tokens.json single source for style CSS variables and PDF colors`

### Step 1: Token schema + loader

Files: `scripts/co-deck/lib/style-tokens.ts` (new), `scripts/co-deck/tests/style-tokens.test.ts` (new)

- [ ] Types: `StyleTokens { version, style, css: Record<string,string>, pdf: Record<string, string | [number,number,number]> }`.
- [ ] `loadStyleTokens(root, name)` — parse + schema-validate: 12 required pdf roles (`background`, `card_dark`..`card_dark4`, `text_primary`, `text_body`, `text_muted`, `text_meta`, `accent`, `border`, `white`); every `var(--x)` pdf ref must exist in `css` and resolve to a solid `#rrggbb`/`#rgb`/`rgb()` value (gradients, `rgba()` with alpha < 1, shadows → validation error naming the token).
- [ ] `resolvePdfColors(tokens)` → 12 `[R,G,B]` entries; hex/rgb parsing helpers with tests.

### Step 2: Generator `scripts/co-deck/build-style-artifacts.ts` (v1.0.0)

Files: generator (new), `scripts/co-deck/tests/build-style-artifacts.test.ts` (new)

- [ ] Per style with `tokens.json`: regenerate the block between `/* AUTO-GENERATED-STYLE-VARS:START */` … `END` in `style.css` (the `:root { … }` declarations in `css`-map order); write `pdf_color_spec.json` fully (`{ "version", "colors": { role: [R,G,B] } }`).
- [ ] Styles without `tokens.json`: skip with a warning (valid only during migration; after PR-2 lands, missing tokens is a validator error).
- [ ] `--check`: regenerate in memory, diff both artifacts against disk, exit 1 on drift.
- [ ] Fail loudly on: missing/duplicate markers, unresolvable `var()` refs.
- [ ] Tests: determinism, marker preservation (content outside markers byte-identical — including `@import` and `[data-style]` rules per V6), var-resolution errors, `--check` drift detection.

### Step 3: Migrate the 5 styles

Files: `docs/html-themes/styles/<name>/{tokens.json (new), style.css, pdf_color_spec.json}` × classic, minimal, premium-dark, academic, visual-heavy

- [ ] For each style: `tokens.json.css` = current `:root` vars verbatim (order preserved); `tokens.json.pdf` = existing RGB values, replaced by `var(--x)` where the RGB matches a css token's solid color, literal `[R,G,B]` otherwise.
- [ ] Insert marker pair around each `:root` block.
- [ ] **Round-trip gate**: run generator, require `git diff --exit-code -- docs/html-themes/styles/` (zero diff proves tokens reproduce current artifacts exactly) before proceeding.

### Step 4: Wire into validation + authoring flow

- [ ] `validate-theme-styles.ts` → v2.1.0: when `tokens.json` exists validate schema + exactly one marker pair in style.css; after migration completes, missing tokens.json = error.
- [ ] `audit-variant.ts`: activate check 4 (`build-style-artifacts.ts --check`).
- [ ] `scaffold-theme-style.ts --style` → emit tokens.json stub + marker-wrapped style.css; update its tests.
- [ ] Docs: THEMES.md Styles section (tokens.json = single source, regeneration command, updated "Adding a New Style" steps), `skills/theme-authoring/SKILL.md` S-2, SCRIPTS.md registry rows.

### PR-2 verification

- [ ] Round-trip zero-diff on all 5 styles (Step 3 gate).
- [ ] `bun run test:theme` green (new + existing suites).
- [ ] **`bun run test:visual` green with unchanged baselines** — proves zero visual change.
- [ ] Sample PDF against a premium-dark fixture → colors unchanged.
- [ ] `bun scripts/audit-variant.ts` exit 0; `/changelog` + `/sync`.

---

## PR-3 — Track C1 + C2: Accessibility + Overview Grid

**Branch/commit**: `feat(co-deck): ppt-engine accessibility (v2.5) and slide overview grid (v2.6)`

### Step 0: Engine version constant (V7)

- [ ] Add `const PPT_ENGINE_VERSION = '2.5.0';` + header version line to `_shared/ppt-engine.js`; assert presence in `ppt-engine-integration.test.ts`.

### Step 1: C1 Accessibility (v2.5.0)

Files: `_shared/ppt-engine.js`, `_shared/ppt-engine.css`, `tests/ppt-engine-integration.test.ts`, `tests/ppt-engine-integration.browser.mjs`

- [ ] TOC drawer: `role="dialog"`, `aria-modal="true"`, focus trap while open, focus restore to trigger on close.
- [ ] `aria-label` on all footer/topbar controls (nav, play, auto-advance, fullscreen, transition selector, voice/language dropdowns, script toggle, timer buttons).
- [ ] Slides: `role="group"`, `aria-roledescription="slide"`, `aria-label="n / N"` (set in `showSlide`); slide counter `aria-live="polite"`.
- [ ] `prefers-reduced-motion: reduce`: `@media` block in ppt-engine.css zeroing transition durations; TransitionEngine checks `matchMedia('(prefers-reduced-motion: reduce)')` and jumps without animation.
- [ ] Browser tests: attributes present, focus lands in drawer on open and restores on close, reduced-motion via Playwright context `reducedMotion: 'reduce'` — across all 4 PPT themes.

### Step 2: C2 Overview grid (v2.6.0)

Files: same as Step 1 + THEMES.md (hand-written feature table + keyboard shortcut row)

- [ ] New `OverviewGrid` module: `G` key + footer button (⊞) toggle a grid overlay of scaled-down slides; click cell → `showSlide(i)` + close; `Escape` priority: overview → fullscreen → drawer/script → narration stop.
- [ ] Styling in ppt-engine.css using existing chrome vars (`--glass-bg`, `--border-subtle`, `--hover-bg`) — auto-themes across styles; vertical theme: overlay over the scroll document.
- [ ] Browser tests: open grid, cell count == slide count, click cell 3 → active slide 3, Escape order, footer button works.
- [ ] THEMES.md: update PPT feature table + keyboard shortcuts row; bump engine references.

### PR-3 verification

- [ ] `bun run test:theme` + `bun run test:theme:browser` green across 4 PPT themes.
- [ ] `bun run test:smoke` matrix green; `bun run test:visual` green with **unchanged baselines** (overview closed by default; ARIA attributes don't affect pixels).
- [ ] `verify-new-theme.ts --fast` exits 0 for all 5 themes.
- [ ] Manual spot-check: `preview.html?theme=pitch-enhanced&style=premium-dark` (drawer focus, G grid).
- [ ] `bun scripts/audit-variant.ts` exit 0; `/changelog` + `/sync`.

---

## PR-4 — Track C3: Presenter View (engine v3.0.0)

**Branch/commit**: `feat(co-deck): ppt-engine presenter view with dual-window sync (v3.0)`

### Step 0: Spike (before any UI work)

- [ ] Verify `BroadcastChannel` behavior on `file://` in Chromium/Edge using a preview deck; confirm the `localStorage` `storage`-event fallback fires between two windows of the same file. Record findings in this doc; if both fail on `file://`, presenter view degrades to http(s)-only and THEMES.md documents the limitation.

### Step 1: `PresenterBridge` module

- [ ] Message protocol `{ type: 'slide' | 'timer' | 'hello' | 'bye', index?, elapsed? }`; `BroadcastChannel('codeck-presenter')` primary, localStorage fallback guaranteed path; bidirectional navigation.
- [ ] Unit tests for protocol encode/decode + fallback selection.

### Step 2: Presenter mode

- [ ] `initPPT` branches on `?presenter=1`: render presenter layout (current-slide thumb, next-slide thumb, `slideData[i].script` notes pane, elapsed timer) instead of deck chrome. The presenter window is the same single file — the theme's own `renderSlide()` is available for thumbs (single-file portability preserved, no template.html changes).
- [ ] Entry points: `Shift+P` + footer button (⧉) call `window.open(location.href + '?presenter=1')` (append with `&` when a query string exists).
- [ ] Audience ↔ presenter sync both directions; presenter close sends `bye`.

### Step 3: Tests + docs

- [ ] Playwright multi-page context: open deck + presenter, assert index sync both directions, notes content matches `slideData[i].script`, timer ticks.
- [ ] THEMES.md feature table + shortcuts; `PPT_ENGINE_VERSION = '3.0.0'`.

### PR-4 verification

- [ ] Same suite as PR-3 verification, plus presenter multi-page tests.
- [ ] `/changelog` + `/sync`.

---

## Execution Notes

- Session scope: proceed PR by PR; confirm with the user before starting each subsequent PR in the same session.
- All work confined to `templates/co-deck/` (workspace boundary policy). The root CI job (design doc §A3) is a separate follow-up session.
- Desktop App: PostToolUse hooks don't fire — run `bun scripts/audit.ts` manually before each `/sync`.
- Rollback: each PR is independently revertable; PR-2's round-trip gate guarantees `git revert` restores byte-identical style artifacts.
