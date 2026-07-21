# solid-drawer TOC Style Registration

> **Status:** Fully implemented and integrated on 2026-07-21. Supported across all 6 themes and 5 styles via `presentation.tocStyle: solid-drawer`.

**Goal:** Register a second, selectable table-of-contents (TOC) style — `solid-drawer` — alongside the existing default `glass-drawer`, so that any builder-generated deck can choose between them via the per-presentation option `presentation.tocStyle`. The `solid-drawer` variant reproduces the look of the one-off TOC in `presentations/soosan_group_2026/lecture_soosan_v3.html`: opaque background, no blur, no in-panel header/close button, a side chevron toggle, 260px width, and a `transform`-based slide animation.

**Architecture (Path A+):** Keep the shared TOC runtime (`TOCBuilder` / `toggleTOC` / `closeTOC` in `themes/_shared/ppt-engine.js`) and DOM contract (`#toc-drawer` / `#toc-overlay` / `#toc-list` / the `.open` class) exactly as-is. Express `solid-drawer` purely as (a) a `<html data-toc-style="solid-drawer">` attribute emitted by the builder, (b) additive CSS overrides scoped under `[data-toc-style="solid-drawer"]` in `ppt-engine.css` (+ a parallel block in `pitch/theme.css`), and (c) one extra `.toc-toggle` chevron element per template, hidden in glass mode and revealed/flipped via `:has()`. This honors roadmap Task 7 ("one shared runtime inlined by the builder"), automatically avoids regressing the two known TOC issues (`toc-auto-close-on-item-click`, `toc-empty-drawer-missing-initppt`), and requires no changes to the browser-smoke or ppt-engine-integration tests.

**Tech Stack:** Bun, TypeScript, HTML/CSS (incl. `:has()` selector — Chrome 105+, Safari 15.4+, Firefox 121+), Playwright for verification.

## Context

Today the co-deck theme system ships exactly **one** TOC style — the glass-morphism `toc-drawer` (`width:320px`, translucent `var(--toc-drawer-bg)`, `backdrop-filter: blur(12px)`, in-panel `.toc-header` + `.toc-close-btn`, `left`-position slide). All five themes share it: outline / pitch-enhanced / vertical / zen load `_shared/ppt-engine.css` + `_shared/ppt-engine.js`; pitch is self-contained (`pitch/theme.css` + inline JS) but renders the same glass drawer. There is **no** builder option to choose a TOC *style* — `theme-contract.ts` exposes only `toc_required?: boolean` (on/off, not style). The solid variant exists only as a custom one-off inside `lecture_soosan_v3.html`.

**User request:** Register v3's solid TOC as a named standard (`solid-drawer`) so future builder-generated decks can opt into it, with full v3 visual fidelity.

**Scope note:** `v5` is a user-made copy of the self-contained custom `v3` HTML (not a builder artifact), so it is **unrelated to this feature**. This feature targets the builder pipeline for future decks.

## Approach — Path A+ (shared runtime + additive CSS/DOM)

### 1. Builder option — `scripts/co-deck/lib/theme-builder.ts`
- Add `tocStyle?: 'glass-drawer' | 'solid-drawer';` to the `BuildOptions` interface (lines 14–24).
- In step 12 (the `<html>` attribute emission, lines 223–235): resolve `const tocStyle = options.tocStyle || 'glass-drawer';`, strip any pre-existing `data-toc-style="..."` in the cleanup regex chain (228–230), and emit `data-toc-style="${tocStyle}"` alongside the existing `data-theme` / `data-style`. Same mechanism already used for theme/style.

### 2. Frontmatter → builder wiring — `scripts/co-deck/build-theme-deck.ts`
- After line 109 (`const style = presentation.style;`) add `const tocStyle = presentation.tocStyle;` (optional, no exit guard).
- Add `tocStyle,` to the `buildThemeDeck({...})` call object (lines 138–147).
- Frontmatter key is `presentation.tocStyle` (sibling of `theme`/`style`). `parseYamlFrontmatter`'s regex (line 41) already accepts camelCase keys.

### 3. Template chevron element — 5 templates
- In `docs/html-themes/themes/{outline,pitch-enhanced,vertical,zen,pitch}/template.html`, insert the following element adjacent to the `toc-overlay` / `toc-drawer` block (hidden by default, so glass mode is unaffected):
  ```html
  <button class="toc-toggle" onclick="toggleTOC()" aria-label="목차 열기/닫기"><span class="chev">›</span></button>
  ```
  Pitch's inline `toggleTOC()` resolves to its own implementation, so the same `onclick` works. The 5 templates are hand-maintained copies, so the same markup is inserted in each.

### 4. Shared CSS override — `docs/html-themes/themes/_shared/ppt-engine.css`
- Add `.toc-toggle { display: none; }` in the TOC rules area (line ~47–179) as the glass default.
- After that TOC section, add the solid-drawer block:
  - `[data-toc-style="solid-drawer"] .toc-drawer` → `width:260px; left:0; transform:translateX(-100%); background:var(--toc-drawer-bg-solid, #0F1420); backdrop-filter:none; -webkit-backdrop-filter:none; border-right:1px solid var(--border-color,#2A3548); box-shadow:8px 0 24px rgba(0,0,0,.35); transition:transform .25s ease;`
  - `[data-toc-style="solid-drawer"] .toc-drawer.open { transform:translateX(0); }` (reuses the shared `.open` toggle)
  - `[data-toc-style="solid-drawer"] .toc-header { display:none; }` (v3 has no in-panel header/close)
  - `[data-toc-style="solid-drawer"] .toc-toggle` → `display:inline-flex; position:fixed; top:50%; left:0; transform:translateY(-50%); width:22px; height:48px; border-radius:0 8px 8px 0; background:rgba(20,27,41,.92); border:1px solid var(--border-color,#2A3548); border-left:none; color:var(--accent-color); z-index:71; transition:left .25s ease;`
  - `[data-toc-style="solid-drawer"] .toc-toggle .chev { display:inline-block; transition:transform .25s ease; }`
  - `:has()` ties chevron position/direction to the open state (no JS change):
    - `[data-toc-style="solid-drawer"]:has(.toc-drawer.open) .toc-toggle { left:260px; }`
    - `[data-toc-style="solid-drawer"]:has(.toc-drawer.open) .toc-toggle .chev { transform:rotate(180deg); }` (base `›` → `‹` when open)
- Because the shared `toggleTOC` only toggles `.toc-drawer.open`, the chevron's position and glyph rotation follow automatically.

### 5. Per-style solid background variable — `docs/html-themes/styles/base.css` + each `styles/{classic,minimal,premium-dark,visual-heavy,academic}/style.css`
- Alongside the existing `--toc-drawer-bg` (`base.css:93` + each `style.css` ~lines 55–72), define `--toc-drawer-bg-solid`.
  - premium-dark → `#0F1420` (v3 value); classic/minimal/academic (light) → the style's opaque panel color (e.g. `#ffffff` / `var(--bg)`); visual-heavy → a tone-appropriate opaque value.

### 6. Pitch parallel override — `docs/html-themes/themes/pitch/theme.css`
- Pitch does not load `_shared/ppt-engine.css` (it has its own TOC CSS at lines 523–590, using the same `.toc-drawer` / `.toc-overlay` / `.open` classes). Add the **same** `[data-toc-style="solid-drawer"]` override block from step 4 to `pitch/theme.css`. The chevron element is already added to the pitch template in step 3.

### 7. Documentation
- `docs/lecture-profile.md` — add `tocStyle: glass-drawer | solid-drawer (default glass-drawer)` to the `presentation:` options comment (lines 46–60).
- `agents/html-build.md` — append the same to the allowed-list line (~115).
- `docs/html-themes/THEMES.md` — add a one-line `tocStyle` note in a manual (non-auto-generated) section.

### 8. Tests — `scripts/co-deck/tests/theme-builder.test.ts`
- Assert that setting `tocStyle:'solid-drawer'` emits `data-toc-style="solid-drawer"` in the output HTML, and that omitting it emits the default. Follow the existing `data-theme`/`data-style` assertion pattern (lines 259–269).
- `theme-browser-smoke.browser.mjs` (`#toc-drawer` assertion, line 289) and `ppt-engine-integration.test.ts` (`TOCBuilder` / `toggleTOC` / `closeTOC` assertions) need **no change** — the DOM contract is unchanged.
- `theme-contract.test.ts` / `validate-theme-styles.ts` need **no change** — `tocStyle` lives on `BuildOptions`, not on theme-package metadata.

## Critical Files
- `scripts/co-deck/lib/theme-builder.ts` — `BuildOptions` + step 12 emission (core, shared by all decks — guard against regression)
- `scripts/co-deck/build-theme-deck.ts` — frontmatter → builder pass-through
- `docs/html-themes/themes/_shared/ppt-engine.css` — solid overrides + `.toc-toggle` default-hide (auto-applies to 4 themes)
- `docs/html-themes/themes/{outline,pitch-enhanced,vertical,zen,pitch}/template.html` — one chevron element each
- `docs/html-themes/themes/pitch/theme.css` — pitch parallel override
- `docs/html-themes/styles/base.css` + `styles/{classic,minimal,premium-dark,visual-heavy,academic}/style.css` — `--toc-drawer-bg-solid`
- `docs/lecture-profile.md`, `agents/html-build.md`, `docs/html-themes/THEMES.md` — documentation
- `scripts/co-deck/tests/theme-builder.test.ts` — new assertions

## PM Execution Plan (for when implementation is approved)
| # | Task | Agent | Tier | Model |
|---|------|-------|------|-------|
| 1 | Implement builder + frontmatter + CSS (shared + pitch) + templates (5) + style vars + docs + tests | automation-engineer | Low | haiku |
| 2 | `bun scripts/audit.ts` + Playwright render verification (glass default unchanged / solid-drawer reproduces v3 / no console errors / tests pass) | pm | Medium | sonnet |
| 3 | `/sync "feat(co-deck): register solid-drawer tocStyle option"` | pm | Medium | sonnet |

## Verification (end-to-end)
1. Set `presentation.tocStyle: solid-drawer` in a temporary `lecture-profile.md` and run `bun scripts/co-deck/build-theme-deck.ts --project presentations/soosan_group_2026` → confirm `<html data-toc-style="solid-drawer">` in the output.
2. Serve via `python -m http.server` + Playwright and assert:
   - solid-drawer deck: opaque drawer / no blur / 260px width / `transform` slide / `.toc-header` hidden / side chevron shown → on open, shifts to `left:260px` and rotates `›`→`‹`.
   - glass default deck (`tocStyle` unset): unchanged (320px, `blur(12px)`, header + × shown, chevron hidden).
   - No console errors.
3. `bun test scripts/co-deck/tests/theme-builder.test.ts` passes.
4. (Optional) Regenerate pitch preview via `bun scripts/co-deck/build-theme-preview.ts --theme pitch --style premium-dark` and confirm identical behavior.
5. `bun scripts/audit.ts` passes.

## Out of Scope
- Applying the feature to `v3` / `v5` (custom self-contained HTML) — this feature is for the builder pipeline. `v5` is a copy of `v3` and already has the solid TOC inline.
- Adding a `tocStyle` axis to visual-regression baselines — the TOC is closed during baseline capture, so this is currently greenfield; a separate follow-up if needed.
- A `supported_toc_styles` declaration field on `theme.json` — unnecessary for the MVP (all themes support both styles).
