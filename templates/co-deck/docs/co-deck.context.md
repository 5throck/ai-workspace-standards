---
# co-deck — Variant Configuration
# Last Updated: 2026-07-17
---

> Extends docs/context.md. This file IS the customization layer for this project.
> context.md is IMMUTABLE — all project-specific changes belong here.
>
> Read order for all AI tools:
>   1. docs/context.md              — immutable project identity (architecture, standards)
>   2. docs/co-deck.context.md      — THIS FILE — tech stack, agents, skills, workflow

---

## Tech Stack

<!-- VARIANT-INJECT: tech-stack -->
| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5+ (all scripts via Bun) |
| **Runtime** | Bun (required — replaces Node.js/Python) |
| **PDF Engine** | pdf-lib + @pdf-lib/fontkit |
| **Font Download** | fflate (TTF/woff2 download utility) |
| **HTML Renderer** | Playwright — **deprecated** (optional, for legacy `measure-layout.ts` only; use `estimate-layout.ts` instead) |
| **Image Sources** | Pixabay API (keyless) · Unsplash URL method · Pexels/Unsplash API (optional keys) |
| **Package Manager** | Bun (`bun install`) |
| **Testing** | Manual gate-based workflow (approval gates at stages 2, 3, 5) |
<!-- END VARIANT-INJECT -->

---

## Agents

<!-- VARIANT-INJECT: agents -->
| Agent | File | Stage | Role | Status |
|-------|------|-------|------|--------|
| PM (Orchestrator) | `agents/pm.md` | — | Single entry point; reads project_state.json; dispatches all specialists | active |
| Version | `agents/version.md` | cross-cutting | Snapshots files before every edit; cross-cutting safety net | active |
| Research | `agents/research.md` | 1 | Web research, source collection → research_notes.md; loads lecture-profile.md | active |
| Source Verifier | `agents/source-verifier.md` | 1.5 | URL accessibility check + content cross-validation → source-verification.md | active |
| Storyline | `agents/storyline.md` | 2-3 | storyline.md + slide_deck.md with image_role/image_query fields; cover/divider confirmation | active |
| Design | `agents/design.md` | 4 | design_spec.md (colors, fonts, layout) | active |
| Image Curator | `agents/image-curator.md` | 3.5 | License-clear image search/download → assets/images/ + image-manifest.json | active |
| Diagram Specialist | `agents/diagram-specialist.md` | 3.5 | SVG concept diagrams + data charts from visual_spec → assets/diagrams/ (SVG primary for HTML; PNG optional for PDF) | active |
| Build | `agents/html-build.md` | 5-8 | lecture_vN.html with theme injection, image binding, data-theme attribute | active |
| Measure | `agents/measure.md` | 9-10 | layout_summary.md via estimate-layout.ts (Playwright-free); optional auto-calibrate loop | active |
| Export | `agents/pdf-export.md` | 11 | sample PDF → Gate 5 → full PDF | active |
<!-- END VARIANT-INJECT -->

> **Pipeline order** (variant.json `agent_manifest.pipeline_order`):
> version → research → **source-verifier** → storyline → design → **image-curator** ‖ **diagram-specialist** → html-build → measure → pdf-export
>
> ‖ = parallel at Stage 3.5; image-curator handles photos, diagram-specialist handles SVG diagrams/charts
>
> **Optional agents**: `source-verifier` (skip with `--skip-verify`), `image-curator` (skip if no images needed), `diagram-specialist` (skip if no visual_spec fields in slide_deck.md)
>
> After any agent change: update AGENTS.md and this table.

### Agent Control Flags

Three flags control agent execution in the co-deck pipeline:

| Flag | Location | Meaning |
|------|----------|---------|
| `optional[]` | `agent_manifest.optional` | Agent is **omitted entirely** from the workflow run. Use when the agent's output is not needed for this project type. |
| `skippable[]` | `agent_manifest.skippable` | Agent **runs**, but failure is non-blocking — the `--skip-verify` flag treats it as a soft gate. Use for optional quality checks. |
| `retry_policy` | `agent_manifest.retry_policy` | Agent **fails and loops back** to a named predecessor agent for re-work. Max retries configurable. |

**Example**: `source-verifier` is both `optional` (can be omitted) AND has a `retry_policy` (if it runs and fails trust threshold, it returns to `research` for another pass).

---

## Skills

<!-- VARIANT-INJECT: skills -->
| Skill | File | Used By | Status |
|-------|------|---------|--------|
| version | `skills/version/SKILL.md` | version | active |
| research | `skills/research/SKILL.md` | research | active |
| storyline | `skills/storyline/SKILL.md` | storyline | active |
| design | `skills/design/SKILL.md` | design | active |
| html-build | `skills/html-build/SKILL.md` | html-build | active |
| measure | `skills/measure/SKILL.md` | measure | active |
| prep-pdf | `skills/prep-pdf/SKILL.md` | measure | active |
| pdf-export | `skills/pdf-export/SKILL.md` | pdf-export | active |
| theme-authoring | `skills/theme-authoring/SKILL.md` | PM (T-Stage + Style Workflow entry point) | active |
| handbook | `skills/handbook/SKILL.md` | handbook-writer, handbook-reviewer | active |
<!-- END VARIANT-INJECT -->

> `source-verifier` and `image-curator` agents have no skill trigger files (PM-dispatched only; no user-facing trigger phrases).

> Skill layer: A (engine-agnostic) — platform parity copies in `.claude/skills/` and `.gemini/skills/`

---

## Scripts

<!-- VARIANT-INJECT: scripts -->
| Script | Location | Purpose | Status |
|--------|----------|---------|--------|
| `snapshot.ts` | `scripts/co-deck/` | File versioning / restore per project | active |
| `measure-layout.ts` | `scripts/co-deck/` | **deprecated** — Playwright layout measurement replaced by `estimate-layout.ts` | deprecated |
| `estimate-layout.ts` | `scripts/co-deck/` | Playwright-free PDF layout preparation: reads lecture-profile.md, resolves 4-layer spec merge, validates fonts, outputs layout_summary.md | active |
| `auto-calibrate.ts` | `scripts/co-deck/` | Iterative auto-calibration loop: sample PDF → PNG → numerical validation → auto-adjust layout_overrides | active |
| `download-font.ts` | `scripts/co-deck/` | Korean font TTF download (MaruBuri, Noto Sans KR, etc.); OS-aware system font detection | active |
| `gen-slides-pdf.ts` | `scripts/co-deck/` | PDF generation from slidedata.json (region-based layout, background images, CJK fallback) | active |
| `diagram-helpers.ts` | `scripts/co-deck/` | Shared SVG utilities library: `svgWrap`, `svgToPng`, `wrapText`, colour palettes | active |
| `gen-visual-images.ts` | `scripts/co-deck/` | Infrastructure-only dispatcher: reads slidedata.json, renders SVG+PNG via diagram-defs.ts | active |
| `validate-theme-styles.ts` | `scripts/co-deck/` | Validate html-themes structure: region schema, shared pool, slide_type↔region cross-check | active |
| `validate-image-manifest.ts` | `scripts/co-deck/` | Gate 3.5 image validation: content-hash dedup, pixel dimensions, aspect-ratio check | active |
| `generate-themes-manifest.ts` | `scripts/co-deck/` | Regenerate preview/themes-manifest.js for preview.html dropdowns | active |
| `scaffold-theme-style.ts` | `scripts/co-deck/` | Scaffold new theme or style with correct file layout | active |
| `extract_slidedata.mjs` | `scripts/co-deck/` | HTML slideData → slidedata.json (bracket-depth state machine, strict-JSON required) | active |
<!-- END VARIANT-INJECT -->

### Bun Dependencies

```bash
bun install          # installs pdf-lib, fflate, @pdf-lib/fontkit, @resvg/resvg-js
                     # playwright is SKIPPED (optionalDependency)

# Only if measure-layout.ts is needed:
bun add playwright
bunx playwright install chromium
```

| Package | Version | Used By |
|---------|---------|---------|
| `pdf-lib` | `^1.17.1` | `gen-slides-pdf.ts` |
| `@pdf-lib/fontkit` | `^1.1.1` | `gen-slides-pdf.ts` |
| `fflate` | `^0.8.2` | `download-font.ts` |
| `@resvg/resvg-js` | `^2.6.2` | `gen-visual-images.ts` |

---

## Theme & Style System

<!-- VARIANT-INJECT: html-themes -->
co-deck uses a **two-layer** presentation appearance system. Authoritative registry: `docs/html-themes/THEMES.md`.

### Layer 1 — Theme (Rendering Paradigm)

A **theme** defines the HTML structure, navigation, and rendering paradigm. Each theme is a package folder containing `template.html` (HTML skeleton), `theme.json` (metadata + content rules + compatibility), `theme.css` (per-theme CSS extension), and `pdf_layout_spec.json` (region-based layout spec).

| Name | Version | Paradigm | Navigation | TOC | Content Rules | Folder |
|------|---------|----------|-----------|-----|---------------|--------|
| `outline` | 3.0.0 | Research Notebook — text-only, no image panel, headline+bullet focused | PPT footer bar (TOC drawer + transitions + script + timer + prev/next) | Drawer | max 6 bullets, 35 char title, 30-60 slides | `docs/html-themes/themes/outline/` |
| `pitch` | 1.0.0 | Floating card (92vw×82vh), scale+translate transition | Bottom footer bar (TOC drawer + script panel + prev/next) | Optional | max 4 bullets, 28 char title, 20-50 slides | `docs/html-themes/themes/pitch/` |
| `pitch-enhanced` | 3.0.0 | PPT Presenter View — pitch floating-card + TOC drawer, transitions, timer | PPT footer bar (TOC drawer + transitions fade/push/zoom + script + timer + prev/next) | Drawer | max 4 bullets, 28 char title | `docs/html-themes/themes/pitch-enhanced/` |
| `vertical` | 3.0.0 | True Vertical Scroll — all slides stacked, sticky top bar, IntersectionObserver | Sticky top bar (TOC drawer + TTS + auto-advance + timer + progress + arrows) | Drawer | max 5 bullets, 28 char title, 30-60 slides | `docs/html-themes/themes/vertical/` |
| `zen` | 3.0.0 | Presentation Zen — full-bleed backgrounds, semi-transparent overlay, centered message | PPT footer bar (TOC drawer + transitions + script + timer + prev/next) | Drawer | max 3 bullets, 28 char title, 10-30 slides | `docs/html-themes/themes/zen/` |

`theme.json` fields: `content_rules` (read by Storyline at Stage 2), `compatible_styles`, `partial_styles` (visual-heavy is partial for all PPT themes), `incompatible_styles` (pitch only: visual-heavy, academic), `recommended_structure`, `slide_types` (declares which slide types the theme supports), `css_base` (→ `styles/base.css`), `css_ppt_engine` (PPT themes only → `themes/_shared/ppt-engine.css`), `css_theme` (→ `themes/<name>/theme.css`).

Each theme folder also includes **`theme.css`** (per-theme CSS extension — card geometry, slide type layouts) and **`pdf_layout_spec.json`** — the **region-based** layout spec: `page` geometry, `calibration.viewport_px`, `regions.*` (named layout rectangles), `slide_types[type].regions` (which regions each slide type uses), `slide_type_overrides`, `fonts`, `line_heights`, `content_constraints`, `toc`, `print`. Read by `gen-slides-pdf.ts` (v1.7.0) as Layer 1 of the 4-layer PDF merge. The renderer is **theme-agnostic**: `buildCoords()` resolves `regions.*` uniformly and dispatches render functions by declared `slide_types`, not by theme name.

> **Layer 0 — shared defaults**: `docs/html-themes/themes/_shared/layout_base.json` holds the region skeleton (all regions `null`) + the 16:9 `page` baseline + `print` defaults. It is the merge base, never filled by the renderer. `_shared/` is excluded from the theme scan (it is not itself a theme).

### PPT Transformed Themes (v3.0.0)

Themes `outline`, `pitch-enhanced`, `zen`, and `vertical` share a common PPT engine layer (`themes/_shared/ppt-engine.css` + `themes/_shared/ppt-engine.js`) providing:

| Feature | Implementation |
|---------|---------------|
| **TOC drawer navigation** | **Slide-out drawer with headline list (TOCBuilder), glass-morphism styling, close button, headline text-overflow ellipsis, `T` key shortcut — replaces thumbnail panel** |
| **Chrome/UI theming** | **All chrome surfaces (TOC drawer, footer, thumbnail panel, script panel, voice dropdowns, topbar) use CSS variables defined in style.css — automatically adapts to dark/light palettes** |
| Transition effects | CSS class toggling: fade (opacity), push (translateX), zoom (scale) |
| Presenter timer | `setInterval`-based clock with start/pause/reset |
| Speaker notes panel | Glass-morphism overlay with per-slide script content |
| **NarrationEngine v2.4 (TTS)** | **Web Speech API — reads `slideData[i].script` aloud; two independent config sections: `narration` (TTS controls, auto_play) and `auto_advance` (timer controls, start_as_auto); each with own `enabled` flag for UI visibility; independent P/A keyboard shortcut guards; configurable via `narrationConfig` + `autoAdvanceConfig`; v2.4: `scriptLanguage` declares primary script field language for correct getScript() routing, per-engine UI hiding** |
| **FullscreenManager** | **Browser Fullscreen API — toggle via F key or footer button (⤢/⤡); all 5 themes supported (PPT themes via ppt-engine.js, pitch via inline code); Escape exits fullscreen first before closing overlays** |
| **@media print** | **Ctrl+P renders one slide per page in landscape orientation; all UI chrome (footer, TOC, script panel, timer, etc.) hidden; slide cards flow as block with page-break-after** |
| Keyboard shortcuts | Arrow keys, Space (navigate), S (script), T (TOC drawer), P (play/pause narration), A (toggle auto-advance), **F (toggle fullscreen)**, Escape (exit fullscreen → close/stop narration). Vertical theme: PageUp/PageDown, Home/End. |
| Footer navigation bar | Progress bar + slide counter + transition mode selector + **narration controls (language dropdown, play, auto-advance, voice selector dropdown)** + **fullscreen button** + nav buttons |

The original `pitch` theme (v1.0.0) is preserved with its native TOC drawer, scale+translateY transition, and its own CSS (not ppt-engine.css). Its chrome/UI colors also use the shared CSS variable system.

> **Chrome/UI variable system**: `ppt-engine.css` and `pitch/theme.css` reference CSS variables (`--toc-drawer-bg`, `--glass-bg`, `--footer-bg`, `--border-subtle`, `--hover-bg`, `--text-dim`, `--scrollbar-thumb`, `--progress-track`, `--nav-btn-bg`, `--nav-btn-hover`) that are defined per-style in `styles/<name>/style.css`. Dark styles (premium-dark, visual-heavy) get dark glass surfaces; light styles (classic, academic, minimal) get light glass surfaces — no theme-level overrides needed.

> **Vertical theme body override**: `ppt-engine.css` sets `body { display: flex; height: 100vh; overflow: hidden }` for PPT themes (slides arranged as flex children). The vertical theme overrides this to `body { display: block; height: auto; overflow-y: auto }` — `position: sticky` does not work on children of a flex container, so the flex layout must be neutralized for the sticky top bar to function.

> **Vertical topbar auto-theming**: The vertical topbar uses `var(--glass-bg)` for its background (same as TOC drawer and footer), so it automatically adapts to dark/light styles. Buttons use `var(--nav-btn-bg)`, `var(--nav-btn-hover)`, and `var(--border-subtle)`.

### Theme Architecture — Two Families

The five themes split into **two architectural families** with intentional design differences:

| Aspect | **Pitch Family** (pitch — native DOM) | **PPT-Engine Family** (outline, pitch-enhanced, zen, vertical) |
|--------|--------------------------------------|---------------------------------------------------------------|
| **Shared engine** | None (self-contained) | ppt-engine.js + ppt-engine.css |
| **DOM vocabulary** | `.slide-content > .slide-left + .right-panel` · `<ul class="slide-bullets"><li>` | `.slide-header + .slide-card` · `<div class="bullets-container"><div class="bullet-item">` |
| **Cover slide type** | `data-type="title"` | `data-type="cover"` |
| **Slide card sizing** | `92vw × 82vh`, max 1300×750px, border-radius 20px | `aspect-ratio: 16/9`, max 1280px, border-radius 4px |
| **Grid layout** | CSS Grid (`1.15fr 0.85fr`) | Flexbox via base.css `.slide-card` |
| **Transitions** | scale+translateY | ppt-engine fade/push/zoom |
| **Navigation** | TOC drawer (`T` key) | TOC drawer + ppt-footer |
| **PDF calibration** | 750px (matches 750px max-height card) | 720px (matches 1280×720 reference) |

> **pitch-enhanced** is a **hybrid**: it uses the ppt-engine runtime (TOC drawer, transitions, NarrationEngine, timer) but preserves the pitch-native DOM vocabulary and floating-card geometry. Its `theme.css` (393 lines) is the most complex override layer, neutralizing base.css defaults that conflict with the pitch aesthetic.

### Layer 2 — Style (CSS Variable Set)

A **style** is a CSS variable override file that controls color, font, and spacing. Styles do NOT change DOM structure. Styles live in the **shared `styles/` pool** (ADR-0045 Decision B) — they are NOT nested under individual themes, so any theme can pair with any compatible style without duplicating CSS.

| Name | File | Best For | Image Panel |
|------|------|---------|-------------|
| `premium-dark` | `docs/html-themes/styles/premium-dark/style.css` | Executive / keynote — dark navy + gold accent + MaruBuri/Noto Serif KR + soft gold title glow (default) | Inherited from theme |
| `classic` | `docs/html-themes/styles/classic/style.css` | General purpose | 45% right panel |
| `minimal` | `docs/html-themes/styles/minimal/style.css` | Text-heavy lectures | None |
| `visual-heavy` | `docs/html-themes/styles/visual-heavy/style.css` | Visual storytelling (partial for all PPT themes) | Full-bleed background |
| `academic` | `docs/html-themes/styles/academic/style.css` | Research / thesis | 30% illustration panel |

> **`premium-dark` is the default style** as of 2026-06-22 (replaces `classic`). Projects whose `lecture-profile.md` does not set `style` now render `premium-dark`. Derived from the `kyobo_ax_2026` executive lecture deck; compatible with all themes.
>
> **`classic` color-spec drift fix** (2026-06-22): `styles/classic/pdf_color_spec.json` previously held a dark palette that mismatched its light CSS — corrected to the matching LIGHT palette. The dark palette now lives under `styles/premium-dark/pdf_color_spec.json`.

**CSS Load Order** (injected by html-build; later layers override earlier ones):

```
1. styles/base.css                    — shared foundation: structural rules + default variables
2. themes/_shared/ppt-engine.css      — PPT common UI (TOC drawer, transitions, footer, timer, narration, fullscreen, @media print) [PPT themes only]
3. themes/<theme>/theme.css           — per-theme extension
4. styles/<style>/style.css           — per-style visual overrides
```

> For the original `pitch` theme (v1.0.0), step 2 is omitted (no `css_ppt_engine`).

Each style folder also includes **`pdf_color_spec.json`** — 12 role-based RGB color keys (`background`, `accent`, `text_primary`, etc.). Read by `gen-slides-pdf.ts` as Layer 2 of the 4-layer PDF merge.

### Compatibility

Not all theme × style combinations are valid. Check `docs/html-themes/THEMES.md` compatibility matrix.

| Style ↓ / Theme → | `outline` | `pitch` | `pitch-enhanced` | `vertical` | `zen` |
|-------------------|-----------|---------|------------------|------------|-------|
| `premium-dark` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `classic` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `minimal` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `visual-heavy` | ⚠️ partial | ❌ incompatible | ⚠️ partial | ✅ | ❌ incompatible |
| `academic` | ✅ | ❌ incompatible | ✅ | ✅ | ❌ incompatible |

> **Legend**: ✅ Fully compatible · ⚠️ Partial (background-image on `.slide` may be clipped by card boundary) · ❌ Incompatible
>
> **`pitch` (v1.0.0)** preserves its original incompatibilities. Use `pitch-enhanced` for full style compatibility with pitch aesthetics.

### Theme/Style Authoring

To create a new theme or style, use the **T-Stage** or **Style Workflow** via the PM agent. See `skills/theme-authoring/SKILL.md`. The `scaffold-theme-style.ts` script stubs the correct file layout (region skeleton for themes, adapted copy for styles) and auto-regenerates the preview manifest.

**`visual-heavy` special behavior** (`⚠️ partial` for outline, pitch-enhanced, zen, vertical): `renderSlide()` must inject `--slide-bg-image` as a CSS custom property on the `.slide` element. Works well for short/visual slides (cover, divider, image-driven content); avoid for text-dense slides. Background image may be partially clipped by card boundary in pitch-enhanced or base.css card layouts. Incompatible with original `pitch` (full-bleed conflicts with floating-card layout).

### 4-Layer PDF Merge

`gen-slides-pdf.ts` (v1.7.0) merges four layers at runtime via `deepMerge` (later layers win):

```
Layer 0 — shared : docs/html-themes/themes/_shared/layout_base.json       → region skeleton (all null) + 16:9 page + print defaults
Layer 1 — theme  : docs/html-themes/themes/<theme>/pdf_layout_spec.json   → regions.*, slide_types[type].regions, slide_type_overrides, fonts, line_heights, content_constraints, toc, print
Layer 2 — style  : docs/html-themes/styles/<style>/pdf_color_spec.json    → color palette
Layer 3 — project: presentations/<project>/lecture-profile.md             → layout_overrides block
```

Region values that are `null` in the theme spec stay `null` (Layer 0 never fills a region the theme intends to leave absent). Required regions referenced by `slide_types[type].regions` that resolve to `null` throw — there is no silent fallback. Per-project overrides (e.g., 4:3 ratio, CI accent color, higher bullet count, **PDF font sizes / line heights** via `layout_overrides.fonts`/`line_heights`) are set in `lecture-profile.md` → `layout_overrides` and take precedence over all theme/style defaults.

### Validation & Preview Workflow

After editing any theme/style/region spec, run:

```bash
bun scripts/co-deck/validate-theme-styles.ts        # v2.0.0 — region schema + shared pool + slide_type↔region cross-check
bun scripts/co-deck/generate-themes-manifest.ts     # v1.0.0 — regenerate preview/themes-manifest.js (after adding/removing themes or styles)
bun scripts/audit.ts                                 # workspace QA gate
```

To scaffold a new theme or style with the correct region-skeleton file layout:

```bash
bun scripts/co-deck/scaffold-theme-style.ts --theme <name>   # v1.0.0 — stubs + auto-regenerates manifest
bun scripts/co-deck/scaffold-theme-style.ts --style <name>
```

`preview/preview.html` populates theme/style dropdowns dynamically from `themes-manifest.js` (no hardcoded list); partial styles are marked `(⚠ partial)`.
<!-- END VARIANT-INJECT -->

---

## Lecture Profile

<!-- VARIANT-INJECT: lecture-profile -->
`presentations/<project>/lecture-profile.md` is the single source of truth for per-lecture settings. (The master template is located at `docs/lecture-profile.md` and copied to the presentation folder on start).

**Scaffolded automatically** on new project start — edit the copy under your presentation folder before starting Stage 1.

Key fields:
```yaml
title: "Lecture Title"
audience: graduate | undergraduate | practitioner | general
level: intro | intermediate | advanced
presentation:
  theme: pitch-enhanced  # HTML structure: outline | pitch | pitch-enhanced | vertical | zen
  style: premium-dark # CSS variables: premium-dark | classic | minimal | visual-heavy | academic
script_language: ko      # Language of TTS narration script (defaults to `language` if not set)
keywords: [Keyword 1, Keyword 2]
instructor:
  name: ""
  title: ""
  organization: ""
  email: ""
  linkedin: ""
  phone: ""
image:
  source: auto        # Pixabay keyless → Unsplash URL → API keys
  style_hint: "professional"
background_image:
  enabled: false       # enable background images for slides
  scope: divider-cover # all | divider-cover | individual
dividers:
  mode: auto          # auto | manual | none
narration:
  enabled: true       # show/hide TTS controls in HTML viewer
  auto_play: false    # auto-start TTS on page load
  default_language: ko
auto_advance:
  enabled: true       # show/hide auto-advance controls in HTML viewer
  start_as_auto: false # start auto-advance timer on page load
  interval: 8         # seconds between auto-advance slides
source_verification: true
```

**Agents that read this file**: research (audience, level, keywords), storyline (slide_count, chapters, dividers.mode, script_language, narration.languages), html-build (theme, style, instructor, background_image, script_language, narration, auto_advance), image-curator (source, style_hint, background_image), pdf-export (background_image, layout_overrides).
<!-- END VARIANT-INJECT -->

---

## Image Acquisition

<!-- VARIANT-INJECT: image-acquisition -->
Handled by the `image-curator` agent (Stage 3.5). All sources are **commercial-use unlimited, no attribution required**.

| Source | API Key | Rate Limit | License |
|--------|---------|-----------|---------|
| Pixabay | Not required | 100/hr keyless | Pixabay License |
| Unsplash URL | Not required | ~50/hr | Unsplash License |
| Pexels API | Optional | 200/hr | Pexels License |
| Unsplash API | Optional | 50/hr | Unsplash License |
| Wikimedia | Not required | Unlimited | CC0 / CC-BY |

**Shared image pool**: `presentations/assets/images/<slug>.<ext>`

**Naming**: slug-only (`ai-future-professional.jpg`) — no slide-number prefix. The slug is the content identifier, enabling cross-project reuse. image-curator checks the pool before downloading: if `<slug>.<ext>` exists it sets `"reused": true` and skips download.

**Per-project manifest**: `presentations/<project>/image-manifest.json` — maps slide index → slug, records source URL, license, `"reused": true/false`. Missing images are logged but do not block the pipeline. Also contains an optional `background_image` object with a `path` field pointing to a global background image (`slide_index: -1`, `scope: "global"`).

**HTML image path** (from `presentations/<project>/lecture.html`): `../assets/images/<slug>.<ext>`
<!-- END VARIANT-INJECT -->

---

## Source Verification

<!-- VARIANT-INJECT: source-verification -->
Handled by the `source-verifier` agent (Stage 1.5, Gate 1.5). Validates URLs in `research_notes.md`.

**Level 1** — HTTP accessibility check (`curl --head --max-time 5`):
- 200: ✅ Accessible
- 301/302: 🔄 Redirected (final URL recorded)
- 404: ❌ Failed — removal recommended
- 403: ⚠️ Paywall likely — flagged, not failed

**Level 2** — Content cross-check via Web Search (title + author verification, max 10 sources).

**Output**: `presentations/<project>/source-verification.md` with Trust Score.

**Skip flag**: `--skip-verify` skips all checks (for drafts or offline environments).
<!-- END VARIANT-INJECT -->

---

## Environment Setup

<!-- VARIANT-INJECT: environment-setup -->
```bash
# Required
bun install                      # installs pdf-lib, fflate, @pdf-lib/fontkit

# Optional — only for measure-layout.ts (layout calibration)
bun add playwright
bunx playwright install chromium

# Font download — saves to shared pool presentations/assets/fonts/
# Check-before-download: skips if font files already exist
bun scripts/co-deck/download-font.ts maruburi
```

No `.env` required by default. API keys for image sources are optional and stored in `lecture-profile.md`.
<!-- END VARIANT-INJECT -->

---

## Development Workflow

<!-- VARIANT-INJECT: development-workflow -->
```
User: "make a lecture about X"          → PM 11-Stage pipeline (see table below)
User: "create a new theme/style"        → PM T-Stage / Style Workflow (see skills/theme-authoring/SKILL.md)
```

**11-Stage pipeline**:
```
PM reads lecture-profile.md → confirms presentation.theme + presentation.style + source_verification + dividers.mode
→ Research → (Source Verifier) → Storyline → Design → Image Curator → Build → Measure → Export
→ Gates 2, 5: mandatory user approval · Gate 1.5, 3, 4: optional / auto-advance
```

### Pipeline Stages

| Stage | Agent | Gate | Key Output |
|-------|-------|------|-----------|
| 0 | PM | — | project_state.json initialized; lecture-profile.md confirmed (`presentation.theme` + `presentation.style` + `source_verification` + `dividers.mode`) |
| 1 | Research | — | research_notes.md |
| 1.5 | Source Verifier | **Gate 1.5** (optional, skip if source_verification: false) | source-verification.md + Trust Score |
| 2-3 | Storyline | **Gate 2 (required)** | storyline.md, slide_deck.md (with image_role/image_query) |
| 4 | Design | Gate 3 (optional review) | design_spec.md |
| 3.5 | Image Curator | — | assets/images/, image-manifest.json |
| 5-8 | Build | Gate 4 (optional) | lecture_vN.html (theme applied, images bound) |
| 9-10 | Measure | — | layout_summary.md (estimate-layout.ts, Playwright-free) |
| 11 | Export | **Gate 5 (required)** | sample_5slides.pdf → full .pdf |
<!-- END VARIANT-INJECT -->

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Presentation Production Guidelines

### Content Rules
1. Research must cover both Korean and English sources
2. Slide count and bullet density: governed by `theme.json content_rules` (read from `docs/html-themes/themes/<theme>/theme.json` at Stage 2). Default: pitch-enhanced → max 4 bullets, 28 char title
3. Each slide: ≤ bullets per `content_rules`; `image_role: none` max 3 consecutive slides
4. Speaker intro (slide 2) and contact (last slide) are mandatory
5. Every slide in slide_deck.md must have `image_role`, `image_query`, `image_license` fields
6. **Uniform Layout Principle**: All content slides within a single deck MUST use `standard` type. Special types (`punchline`, `divider`, `profile`) are reserved for their designated structural purpose only. `punchline` is allowed ONLY as the last content slide with a single-statement message (≤1 line, no bullets). Mixing slide types for content slides is prohibited — each type has a distinct CSS layout (2-column vs center-aligned), and mixing breaks visual consistency.

### Design Rules
1. 8-role color palette: defined in design_spec.md CSS variable block
2. Font: Korean-compatible (MaruBuri, NanumSquare Neo, or Noto Sans KR)
3. Layout: determined by `presentation.style` (classic = two-panel; minimal = text only; visual-heavy = full image)
4. No hardcoded color or font values in HTML — CSS variables only
5. Verify `presentation.theme × presentation.style` compatibility in `docs/html-themes/THEMES.md` before generating HTML

### Build Rules
1. Always call Version Agent before editing any file
2. HTML must embed `slideData` array for PDF extraction
3. Set `<html data-theme="<theme>" data-style="<style>">` and inject CSS in Load Order: `styles/base.css` → `themes/<theme>/theme.css` → `styles/<style>/style.css` (paths resolved from `theme.json` `css_base` + `css_theme`)
4. Images: from shared pool `presentations/assets/images/<slug>.<ext>`; reference as `../assets/images/<slug>.<ext>` (path from `image-manifest.json` → `path` field). Diagrams: from shared pool `presentations/assets/diagrams/<stem>.svg`; reference as `../assets/diagrams/<stem>.svg` (SVG path auto-written by gen-visual-images.ts v3.2.0 — HTML renders SVG natively; PDF pipeline auto-derives the `.png` sibling)
5. For slides with no image in manifest: use text-panel fallback — never use placeholder images

### Visual Diagram Pipeline

For slides that use concept diagrams (not stock photos), the pipeline is:

```
presentations/<project>/diagram-defs.ts  ← project-specific generators (authored per project)
        ↓ dynamic import
gen-visual-images.ts (infrastructure dispatcher)
        ↓
presentations/assets/diagrams/<stem>.svg  (primary delivery format — HTML renders SVG natively via <img>)
presentations/assets/diagrams/<stem>.png  (PDF sibling — auto-derived by gen-slides-pdf.ts from the SVG path)
        ↓
slideData[i].visualImage = "../assets/diagrams/<stem>.svg"   ← always SVG (gen-visual-images.ts v3.2.0)
        ↓ HTML: template buildSlideChildren() injects <img src="...svg"> into .right-panel
        ↓ PDF:  gen-slides-pdf.ts imgPath() auto-derives "../assets/diagrams/<stem>.png" from the SVG path
```

**Architecture (v3.2.0)**:
- `gen-visual-images.ts` is **infrastructure-only** — no project-specific SVG code lives here
- `diagram-helpers.ts` provides shared utilities (`svgWrap`, `svgToPng`, `wrapText`) and colour palettes (`DARK_AMBER`, `B2B_NAVY`)
- Each project creates `presentations/<project>/diagram-defs.ts` exporting a `GENERATORS: Record<string, () => string>` map keyed by image stem
- If no `diagram-defs.ts` exists, `gen-visual-images.ts` exits cleanly (nothing to generate)
- **Unified output path**: SVG and PNG are both saved to `presentations/assets/diagrams/` (shared pool). `slidedata.json` `visualImage` always references the SVG path. Legacy per-project `images/` paths are auto-rewritten to `../assets/diagrams/<stem>.svg`.

**Design principle**: SVG is the source of truth and the **primary delivery format for HTML** — browsers render SVG natively via `<img>` tags with no quality loss. PNG is generated alongside as a PDF sibling; the PDF pipeline (`gen-slides-pdf.ts`) auto-derives the `.png` path from the `.svg` path in `imgPath()` — no manual path switching required.

**Rules**:
1. `gen-visual-images.ts` must be run before `html-build` and `pdf-export` stages whenever concept diagrams change
2. Both SVG and PNG artifacts MUST exist in the shared pool — SVG for HTML, PNG for PDF
3. `slidedata.json` `visualImage` field MUST reference the SVG path (e.g. `"../assets/diagrams/slide-03.svg"`); gen-visual-images.ts v3.2.0 enforces this automatically
4. HTML template `buildSlideChildren()` checks `data.visualImage`: if truthy, injects `<img>` into `.right-panel`; if falsy, renders `.slide-visual` text panel (`visualTitle` + `visualDisplay`)
5. Slides without a `.right-panel` (e.g. title, contact) are inherently skipped by the visual-image branch
6. Korean text rendering in SVG requires Malgun Gothic (`C:/Windows/Fonts/malgun.ttf`) loaded explicitly via `@resvg/resvg-js` `font.fontFiles`
7. GENERATOR key = image filename stem (e.g. `"slide-03-nested-layers"` for `../assets/diagrams/slide-03-nested-layers.svg`)
8. **Diagram orientation** (`flow`/`timeline` only): set `orientation: horizontal | vertical | auto` in `visual_spec`. Default is `auto` — diagram-specialist resolves layout direction by element count and label length. Other diagram types (`cycle`, `matrix`, `pyramid`, `comparison`) ignore this field. See `agents/diagram-specialist.md §Orientation Resolution`.

### Image Rules
1. Only use commercial-use unlimited sources (Pixabay, Pexels, Unsplash)
2. `image_query` must be in English — even for Korean lectures
3. `visual-heavy` style requires `image_role: background` on most slides
4. image-curator checks shared pool before downloading — reuse existing slugs when possible
5. API keys are optional — keyless Pixabay is the default

### Approval Gate Rules
- Gates 2, 5 are **MANDATORY** — PM must NOT advance without user approval
- Gate 1.5, 3, and 4 are optional — PM may ask user or auto-advance (Gate 1 is retired)
- Gate 5: always generate 5-slide sample first; full PDF only after approval
- Gate 1.5: if Trust Score < 70% (derived from `trust_score_thresholds.escalate` in `variant.json`), hold for re-research before advancing to storyline
<!-- END VARIANT-INJECT -->

---

## File Organization Policy

<!-- VARIANT-INJECT: file-organization -->
| Folder | Purpose |
|--------|---------|
| `presentations/<project>/` | All outputs for a single lecture project |
| `docs/lecture-profile.md` | Master template for lecture profile (copied on project start) |
| `presentations/<project>/lecture-profile.md` | Lecture settings SSOT (audience, theme, image prefs, instructor) |
| `presentations/<project>/image-manifest.json` | Per-project map: slide index → shared asset slug + reused flag |
| `presentations/<project>/_versions/` | Version snapshots (Version Agent) |
| `presentations/<project>/images/` | **Project-local images** — deprecated; diagram assets moved to shared pool `presentations/assets/diagrams/` |
| `presentations/assets/fonts/` | **Shared font pool** — downloaded once, reused across all projects |
| `presentations/assets/icons/` | **Shared icon pool** |
| `presentations/assets/images/` | **Shared image pool** — stock photos (Pixabay/Pexels/Unsplash), slug-named, cross-project reuse |
| `presentations/assets/diagrams/` | **Shared diagram pool** — SVG source + PNG render (diagram-specialist + gen-visual-images.ts), cross-project reuse |
| `agents/` | Agent role definitions (13 agents) |
| `skills/` | Skill trigger descriptors |
| `scripts/co-deck/` | Variant-specific TypeScript scripts |
| `skills/handbook/` | Handbook skill — H-Stage pipeline, templates, assets, examples |
| `docs/html-themes/styles/base.css` | Shared CSS structural foundation + default variables (Layer 1 of CSS Load Order) |
| `docs/html-themes/styles/<name>/style.css` | Per-style CSS variable overrides (shared style/color pool — `style.css` + `pdf_color_spec.json` per folder; NOT nested under themes) |
| `docs/html-themes/themes/_shared/layout_base.json` | Layer 0 — region skeleton (all null) + 16:9 page + print defaults |
| `docs/html-themes/themes/<name>/` | Theme packages: `template.html` + `theme.json` (with `css_base`/`css_theme`) + `theme.css` (per-theme extension) + `pdf_layout_spec.json` (region schema) |
| `docs/html-themes/preview/` | `preview.html` (theme × style previewer; dropdowns populated from manifest) + `themes-manifest.js` (AUTO-GENERATED, `file://`-safe) |
| `docs/html-themes/THEMES.md` | Authoritative theme + style registry |
| `memory/` | Dev session logs |
| `docs/` | Project context + ADRs |
<!-- END VARIANT-INJECT -->

---

## Domain Rules

<!-- VARIANT-INJECT: domain-rules -->
1. **Version Agent is always called first** — before any file modification by any agent
2. **presentations/<project>/lecture-profile.md is the single source of truth** for theme, audience, instructor, and image settings
3. **project_state.json tracks pipeline progress** — PM reads this to resume interrupted sessions
4. **`--workspace presentations/<project>`** must always be passed to snapshot.ts to scope backups
5. **PDF requires layout preparation** — run Prep PDF (estimate-layout.ts) before Export Agent; optional auto-calibrate loop for iterative refinement
6. **Playwright is optional** — only install for `measure-layout.ts`; `bun install` skips it by default
7. **source-verifier is optional but recommended** — Trust Score < 70% (derived from `variant.json` `trust_score_thresholds.escalate`) should block storyline
8. **image-curator is optional** — skip if all slides use `image_role: none` or images are pre-supplied
9. **Theme vs Style boundary**: Themes own DOM structure (`template.html`) and per-theme CSS extension (`theme.css`); styles own CSS variables only (`style.css`). Styles live in the shared `styles/` pool — never nest a style under a theme folder. Never modify DOM in a style file.
10. **Shared asset pool**: Fonts and images live in `presentations/assets/` — not in per-project folders. Check existence before downloading; set `"reused": true` in manifest when reusing.
11. **theme.json is read at Stage 2**: Storyline must receive the path `docs/html-themes/themes/<theme>/theme.json` to apply `content_rules` (max bullets, title length, slide count range) during slide_deck.md generation.
12. **Theme × Style compatibility gated at Stage 0**: PM checks THEMES.md compatibility matrix before confirming `presentation.theme` + `presentation.style`. Incompatible combinations are rejected with explanation. `visual-heavy` is partial for outline, pitch-enhanced, zen, vertical; incompatible with pitch.
13. **TypeScript-first**: Use TypeScript scripts (`bun scripts/co-deck/`) for all automated operations. Python is only permitted when the task cannot be accomplished in TypeScript. When a TS script already exists for a task, use it — never default to Python.
14. **4-layer PDF merge + region model**: `gen-slides-pdf.ts` (v1.7.0) always `deepMerge`-loads `_shared/layout_base.json` (Layer 0, region skeleton) → `pdf_layout_spec.json` (theme, `regions.*` + `slide_types[type].regions`) → `pdf_color_spec.json` (style) → `layout_overrides` (project) in order. The renderer is theme-agnostic — dispatch is by declared `slide_types`, not by theme name. Required regions that resolve to `null` throw (no silent fallback). Never hardcode geometry or color values in the script. Typography is tuned via `layout_overrides.fonts`/`line_heights` (calibrated pitch reference in `docs/lecture-profile.md`); divider images render **cover-crop** (`placeImageCover`, object-fit:cover); font selection prefers **Pretendard** then falls back to **MaruBuri**. **Background images** (v1.7.0): when `background_image.enabled: true` in lecture-profile.md, the renderer applies full-bleed background images via `placeImageCover()` + semi-transparent overlay via `fillRectOverlay()` per scope (`all`/`divider-cover`/`individual`). Image paths resolved from `image-manifest.json` first, then `slideData.backgroundImage`, then `fallback_color`.
15. **Validate after every theme/style edit**: run `bun scripts/co-deck/validate-theme-styles.ts` (region schema + shared pool + slide_type↔region cross-check). Regenerate `bun scripts/co-deck/generate-themes-manifest.ts` after adding/removing any theme or style. Use `scaffold-theme-style.ts` to stub new entries (auto-regenerates the manifest).
16. **UTF-8 without BOM (LF)**: All co-deck files — source templates, generated HTML, scripts, markdown, JSON — MUST use UTF-8 encoding without BOM and LF line endings. html-build agent must verify `<meta charset="UTF-8">` in generated HTML. On Windows (Korean locale), ensure `chcp 65001` is set before any file write to prevent CP949 corruption. See `docs/html-themes/THEMES.md → File Encoding Standard` for enforcement details.
17. **Background image system (v1.7.0)**: `lecture-profile.md` has an independent `background_image` section (not inside pdf_color_spec.json) with fields: `enabled`, `scope` (all/divider-cover/individual), `source` (download/svg), `overlay` (color + opacity), `keywords`, `fallback_color`. Stage 0 prompts the user for background image preference. Image-curator downloads `bg-deck.<ext>` (atmospheric landscape, ~1920×1080) and adds a global entry (`slide_index: -1`, `scope: "global"`) to `image-manifest.json`. Html-build binds `backgroundImage` into slideData. Template.html sets `--slide-bg-image` CSS variable for HTML rendering. Pdf-export reads config and renders full-bleed + overlay. <!-- END VARIANT-INJECT -->

### H-Stage Pipeline (Handbook — Document Production)

When user requests **"create a handbook"**, **"create a course site"**, or **"create a companion handbook"**, enter the H-Stage pipeline (independent from the 11-Stage slide pipeline):

```
H-0: PM — Confirm: topic, language, output dir, companion mode
H-1: research — Web research (reuse existing agent)
     [Companion: Skip — reuse research_notes.md + images + diagrams + references + versions]
H-2: handbook-writer — Propose section types + chapter structure
H-3: handbook-writer — Write chapter content (SECTION_TYPES + AUTHORING_GUIDELINES)
H-4: handbook-writer — Generate Course Overview + Instructor Guide
H-5: handbook-reviewer — handbook-doctor.ts + check-authoring.ts → fix
H-6: PM/automation — Apply Theme (domain step) → Generate CSS → Search index → Meta
H-7: PM — Secret scan + deploy + verify
```

**Companion Mode Cache Reuse**:
| Pipeline Output | Reuse Source |
|-----------------|-------------|
| Research Package | `research_notes.md` from prior slide project |
| Images | `image-manifest.json` entries from shared pool |
| Diagrams | `presentations/assets/diagrams/*.svg` |
| References | `source-verification.md` validated URLs |
| Versions | `presentations/<project>/_versions/` snapshots |

### Handbook Domain Rules

1. **Dark mode is auto** — 3-layer CSS: `:root` (light) → `@media (prefers-color-scheme: dark)` (auto) → `.dark` class (manual toggle via localStorage). No H-0 preference prompt needed.
2. **CSS variables only** — ALL colors must use `var(--bg)`, `var(--text)`, `var(--accent)`, etc. Zero hardcoded hex values in HTML files.
3. **Multi-language file convention** — Separate files per language: `chapter.html` (default), `chapter_ko.html`, `chapter_en.html`. Language switcher uses AI-friendly filename convention.
4. **6 section types**: Manual, Chapter, Examples, Quiz, CourseOverview, InstructorGuide — each with prescribed HTML structure per SECTION_TYPES.md.
5. **Companion mode skips H-1** — When building a companion handbook from an existing slide project, reuse all cached pipeline outputs (research, images, diagrams, references, versions) instead of re-researching.
6. **Theme is a domain step** (H-6) — Select built-in theme (azure/graphite/teal/amber/indigo) → run `apply-handbook-theme.ts` → generate CSS → update `site-search.js` DOCS array → update meta tags.
7. **examples/ are CI regression fixtures** — `check-authoring.ts --examples-dir` validates all examples/ files on every PR. Examples must pass all authoring checks.
8. **handbook-doctor runs 12 static analysis checks** — sidebar nav, chapter-nav, broken links, dark palette, language pair, visual element, Course Overview, Instructor Guide, unused assets, duplicate IDs, hardcoded colors, empty title/h1.

---

*co-deck.context.md version: 4.2 — updated 2026-06-28: FullscreenManager (F key + footer button) + @media print (Ctrl+P one slide per page) for all 5 themes; G1+G2 Tier 1 preview enhancements.*

## Template Provenance

- **Template-Version**: 0.5.3
- **Template-Variant**: co-deck
