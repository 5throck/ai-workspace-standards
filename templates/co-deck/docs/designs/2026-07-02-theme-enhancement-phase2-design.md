# Theme System Enhancement — Phase 2 Design (Post Tasks 0-9)

> **Spec ID**: `theme-enhancement-phase2`
> **Status**: Approved plan — pending implementation
> **Date**: 2026-07-02
> **Predecessor**: `co-deck1/docs/designs/2026-07-01-theme-system-roadmap.md` (Tasks 0-9, fully synced into `templates/co-deck` on 2026-07-02)

## Context

The theme system completed the Tasks 0-9 roadmap: contract validation (`scripts/co-deck/lib/theme-contract.ts`), deterministic builder (`build-theme-deck.ts`), production-renderer preview, browser smoke + visual-regression tests, and the `verify-new-theme.ts` registration gate. 5 themes × 5 styles are stable.

Three enhancement tracks were approved (theme/style content expansion explicitly deferred):

- **Track A — Governance hardening**: close roadmap leftovers (audit no-op gap, missing dependency, CI absence, compatibility report).
- **Track B — Design-token single source**: colors live in two manually-synced places (`styles/<s>/style.css` CSS variables vs `styles/<s>/pdf_color_spec.json` RGB arrays); a real drift incident occurred (classic, fixed 2026-06-22). Introduce `tokens.json` that generates both artifacts.
- **Track C — Runtime (ppt-engine) features**: accessibility, slide overview grid, presenter view.

**Boundary policy**: all work stays inside `templates/co-deck/` (workspace CLAUDE.md §9 strict CWD isolation). The workspace-root CI edit is a separate follow-up PR/session. All commits go through `/sync`. Docs/commits in English, UTF-8 no BOM, LF.

---

## PR Slicing & Sequencing

| PR | Scope | Depends on |
|----|-------|-----------|
| PR-1 | Track A (audit-variant, dependency fix, test aggregation, compat report) | — |
| PR-2 | Track B (tokens.json single source + drift check wired into audit-variant) | PR-1 |
| PR-3 | Track C1 accessibility + C2 overview grid (engine v2.5 → v2.6) | PR-1 |
| PR-4 | Track C3 presenter view (engine v3.0) | PR-3 |
| Follow-up (separate session) | Workspace-root `.github/workflows/test.yml` — add co-deck theme suite job | PR-1 |

---

## Track A — Governance Hardening (PR-1)

### A1. Create `scripts/audit-variant.ts`

`scripts/audit.ts` delegates to `scripts/audit-variant.ts` which does not exist (silent no-op — see comment at `scripts/co-deck/validate-theme-styles.ts:3`). Create it as a thin composite runner:

1. `validate-theme-styles.ts` (structural + region model).
2. `generate-themes-manifest.ts --check` (manifest freshness).
3. THEMES.md auto-generated marker freshness (reuse the diff logic from `generate-themes-manifest.ts` `--themes-md` mode; export a `checkThemesMd()` if needed).
4. (After PR-2) `build-style-artifacts.ts --check`.

Non-zero exit on any failure; per-check labeled output. **Before implementing, read `scripts/audit.ts`'s delegation code and match its expected path and exit-code contract exactly.** Register per script-registry rules (`variant.json` `script_manifest.local`).

### A2. Fix dependency gap

Add `"@resvg/resvg-js": "^2.6.2"` to `package.json` dependencies (documented in SCRIPTS.md as required by `gen-visual-images.ts`, currently missing). Run `bun install`; confirm imports resolve.

### A3. Test suite aggregation (CI-ready, in-scope half)

Add npm scripts to `package.json`:

- `"test:theme": "bun test scripts/co-deck/tests/"`
- `"test:theme:browser": "node scripts/co-deck/tests/theme-browser-smoke.browser.mjs && node scripts/co-deck/tests/ppt-engine-integration.browser.mjs"`
- `"audit:variant": "bun scripts/audit-variant.ts"`

The root-CI job that calls these is the out-of-scope follow-up PR (boundary policy). Intended CI job for the follow-up session:

```yaml
co-deck-theme-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install
      working-directory: templates/co-deck
    - run: bunx playwright install --with-deps chromium
      working-directory: templates/co-deck
    - run: bun run test:theme && bun run audit:variant && bun run test:theme:browser
      working-directory: templates/co-deck
```

### A4. Compatibility report generator

Extend `generate-themes-manifest.ts` with `--report` mode: emit `docs/html-themes/COMPAT_REPORT.md` — per theme: version, styles (full / partial+reason / incompatible+reason), slide types, engine family (ppt-engine vs self-contained), and test-coverage pointers (baseline presence per pair under `docs/html-themes/baselines/<theme>/<style>/`). Deterministic output (no timestamps); covered by a new case in `tests/generate-themes-manifest.test.ts`.

### Track A verification

- `bun scripts/audit-variant.ts` → exit 0 on a clean tree; seed a deliberate drift (hand-edit the THEMES.md table) → exit non-zero → revert.
- `bun run test:theme` and `bun run test:theme:browser` green.
- `bun scripts/audit.ts` passes and now actually executes the variant checks.

---

## Track B — Design-Token Single Source (PR-2)

### B1. `tokens.json` schema (per style, at `docs/html-themes/styles/<name>/tokens.json`)

```json
{
  "version": "1.0.0",
  "style": "premium-dark",
  "css": {
    "--bg-color": "#0B0F19",
    "--accent": "#D97706",
    "--glass-bg": "rgba(17, 24, 39, 0.92)"
  },
  "pdf": {
    "background": "var(--bg-color)",
    "accent": "var(--accent)",
    "card_dark": [20, 28, 42]
  }
}
```

- `css`: every `:root` variable currently in style.css, declaration order preserved.
- `pdf`: all 12 role keys (`background`, `card_dark`..`card_dark4`, `text_primary`, `text_body`, `text_muted`, `text_meta`, `accent`, `border`, `white`); each is either `var(--x)` (must resolve to a solid hex/rgb in `css`) or a literal `[R, G, B]`.
- A `pdf` role referencing a `var()` whose value is not a solid color (gradient, rgba-with-alpha, shadow) is a validation error — use a literal RGB there.

### B2. Generator `scripts/co-deck/build-style-artifacts.ts` (new, v1.0.0)

- Reads each `styles/<name>/tokens.json`; skips styles without one (migration window only — final state: all 5 have tokens).
- **style.css**: regenerates only the block between `/* AUTO-GENERATED-STYLE-VARS:START */` … `END` markers (same protected-marker pattern as THEMES.md). Hand-written content outside markers (`@import`, `[data-style]` structural exceptions, comments) is preserved.
- **pdf_color_spec.json**: fully generated (resolve `var()` refs → hex → `[R, G, B]`).
- `--check` mode: regenerate in-memory, diff against disk, non-zero exit on drift. Wire as check 4 in `audit-variant.ts` (A1).
- Deterministic output; register in SCRIPTS.md.

### B3. Migration of the 5 existing styles

Reverse-engineer `tokens.json` per style: `css` = current `:root` vars verbatim; `pdf` = map each existing RGB value to a `var()` ref when it matches a css token's hex, else keep the literal. Insert markers into each style.css. Then regenerate and require **zero diff** (`git diff --exit-code` on `styles/`) — proves the round-trip before tokens become authoritative.

### B4. Contract / validator / docs integration

- `lib/theme-utils.ts` (or `theme-contract.ts`): add `loadStyleTokens(root, name)` used by generator and validator.
- `validate-theme-styles.ts`: when `tokens.json` exists, validate schema (12 pdf roles present, `var()` refs resolvable to solid colors, exactly one marker pair in style.css).
- THEMES.md Styles section: document tokens.json as the single source + regeneration command; update "Adding a New Style" steps (author tokens.json → run generator instead of hand-editing two files).
- `skills/theme-authoring/SKILL.md` S-2 updated accordingly; `scaffold-theme-style.ts --style` emits a tokens.json stub + marker-wrapped style.css.

### Track B verification

- Round-trip zero-diff on all 5 styles (B3).
- New `tests/build-style-artifacts.test.ts` (determinism, marker preservation, var-resolution errors, `--check` drift detection) + existing suites green.
- **Visual regression must pass with unchanged baselines** (`bun run test:visual`) — proves zero visual change.
- Sample PDF against a premium-dark fixture project → colors unchanged.

---

## Track C — Runtime Features (PR-3: C1+C2, PR-4: C3)

Discipline (per roadmap Task 7): extend `ppt-engine-integration.test.ts` / `.browser.mjs` alongside each feature, bump the engine version header in `_shared/ppt-engine.js`, update the hand-written "PPT Transformed Themes" feature table in THEMES.md. None of C1-C3 are builder-facing (the builder inlines the engine as-is). `pitch` (legacy, self-contained) is excluded by standing policy.

### C1. Accessibility (engine v2.5)

Files: `themes/_shared/ppt-engine.js`, `themes/_shared/ppt-engine.css`.

- TOC drawer: `role="dialog"`, `aria-modal="true"`, focus trap while open, focus restore on close; `aria-label`s on all footer/topbar controls (play, auto-advance, fullscreen, nav, transition selector, voice/language dropdowns).
- Slides: `role="group"`, `aria-roledescription="slide"`, `aria-label="n / N"`; slide counter gets `aria-live="polite"`.
- `prefers-reduced-motion: reduce`: ppt-engine.css disables transition animations; TransitionEngine checks `matchMedia` and jumps instantly.
- Tests: browser integration asserts attributes and drawer focus behavior; reduced-motion via Playwright context option `reducedMotion: 'reduce'`.

### C2. Slide overview grid (engine v2.6)

- New `OverviewGrid` module in ppt-engine.js: `G` key (and a footer button) toggles a grid of scaled-down slides; click → jump; `Escape` closes overview before its existing behaviors. Styling in ppt-engine.css using existing chrome vars (`--glass-bg`, `--border-subtle`, `--hover-bg`) so it auto-themes across styles.
- Vertical theme: overview overlays the scroll document.
- Tests: browser integration — open grid, cell count == slide count, click cell 3 → active slide 3, keyboard shortcuts. Update the keyboard-shortcut row in THEMES.md.
- Visual baselines unaffected (overview closed by default).

### C3. Presenter view (engine v3.0, own PR)

- Keep single-file portability: presenter window = `window.open(location.href + '?presenter=1')`. In presenter mode the engine renders a presenter layout (current slide thumb, next slide thumb, `slideData[i].script` notes pane, elapsed timer) instead of normal deck chrome.
- Sync: `BroadcastChannel('codeck-presenter')` for slide index + timer control; **localStorage `storage`-event fallback is the guaranteed path** (`file://` contexts have per-browser BroadcastChannel quirks — spike this first before building UI). Bidirectional navigation.
- Entry points: `Shift+P` (plain `P` is taken by narration play) + a footer button (⧉). Update shortcut docs.
- Tests: Playwright multi-page context asserting index sync both directions and notes content; unit tests for the message protocol.

### Track C verification (each PR)

- `bun run test:theme` + `node scripts/co-deck/tests/ppt-engine-integration.browser.mjs` green across all 4 PPT themes.
- `bun run test:smoke` (matrix) green; `bun run test:visual` green with unchanged baselines.
- `verify-new-theme.ts --fast` for each of the 5 themes exits 0.
- Manual spot-check via `preview.html?theme=pitch-enhanced&style=premium-dark` (drawer focus, G-grid, presenter window).

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Marker insertion into style.css breaks CSS load-order assumptions | Markers only wrap the existing `:root` block; round-trip zero-diff gate (B3) before tokens become authoritative |
| `var()` → RGB resolution wrong for non-hex values | Validator rejects non-solid refs; literals allowed as escape hatch |
| Engine changes regress navigation/narration | Existing ppt-engine-integration suites run before/after; version bump per feature; PR-3/PR-4 separated |
| BroadcastChannel unreliable on `file://` | localStorage fallback is the guaranteed path; spike first in PR-4 before building UI |
| audit-variant path mismatch with audit.ts delegation | Read `scripts/audit.ts` delegation code first; match its expected path/exit-code contract exactly |
| Root CI cannot be touched in these sessions | Explicit follow-up PR; job spec pre-written in §A3 above |

## Execution & Delivery

Per workspace governance each PR session runs: PM execution plan table → implement → `bun scripts/audit.ts` → `/changelog` → `/sync "feat(co-deck): …"`. Desktop App note: PostToolUse hooks do not fire — run `bun scripts/audit.ts` manually before `/sync`.
