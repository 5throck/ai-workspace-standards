---
# co-deck — Variant Configuration
# Last Updated: 2026-06-21
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
| **HTML Renderer** | Playwright (Chromium) — optional, for `measure-layout.ts` only |
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
| Build | `agents/html-build.md` | 5-8 | lecture_vN.html with theme injection, image binding, data-theme attribute | active |
| Measure | `agents/measure.md` | 9-10 | layout_spec.json + pdf_layout_spec.md (Playwright-based) | active |
| Export | `agents/pdf-export.md` | 11 | sample PDF → Gate 5 → full PDF | active |
<!-- END VARIANT-INJECT -->

> **Pipeline order** (variant.json `agent_manifest.pipeline_order`):
> version → research → **source-verifier** → storyline → design → **image-curator** → html-build → measure → pdf-export
>
> **Optional agents**: `source-verifier` (skip with `--skip-verify`), `image-curator` (skip if no images needed)
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
| pdf-export | `skills/pdf-export/SKILL.md` | pdf-export | active |
| theme-authoring | `skills/theme-authoring/SKILL.md` | PM (T-Stage + Style Workflow entry point) | active |
<!-- END VARIANT-INJECT -->

> `source-verifier` and `image-curator` agents have no skill trigger files (PM-dispatched only; no user-facing trigger phrases).

> Skill layer: A (engine-agnostic) — platform parity copies in `.claude/skills/` and `.gemini/skills/`

---

## Scripts

<!-- VARIANT-INJECT: scripts -->
| Script | Location | Purpose | Status |
|--------|----------|---------|--------|
| `snapshot.ts` | `scripts/co-deck/` | File versioning / restore per project | active |
| `measure-layout.ts` | `scripts/co-deck/` | Playwright layout measurement → layout_spec.json (optional) | active |
| `download-font.ts` | `scripts/co-deck/` | Korean font TTF download (MaruBuri, Noto Sans KR, etc.) | active |
| `gen-slides-pdf.ts` | `scripts/co-deck/` | PDF generation from slidedata.json (`--sample N` flag) | active |
| `gen-visual-images.ts` | `scripts/co-deck/` | CSS concept diagrams → SVG file → PNG file (no browser; `@resvg/resvg-js`) | active |
| `extract_slidedata.mjs` | `scripts/` | HTML slideData → slidedata.json | active |
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

| Name | Paradigm | Navigation | TOC | Content Rules | Folder |
|------|----------|-----------|-----|---------------|--------|
| `scroll` | Vertical scroll, all slides in DOM | Scroll + TOC panel | Required | max 5 bullets, 30 char title, 30-60 slides | `docs/html-themes/themes/scroll/` |
| `slideshow` | Fullscreen single-slide, CSS transitions | Prev/Next + arrow keys | None | max 3 bullets, 20 char title, 20-40 slides | `docs/html-themes/themes/slideshow/` |

`theme.json` fields: `content_rules` (read by Storyline at Stage 2), `compatible_styles`, `partial_styles` (scroll lists `visual-heavy`), `incompatible_styles` (slideshow lists `visual-heavy` + `academic`), `recommended_structure`, `slide_types` (declares which slide types the theme supports), `css_base` (→ `styles/base.css`), `css_theme` (→ `themes/<name>/theme.css`).

Each theme folder also includes **`theme.css`** (per-theme CSS extension — TOC panel, card geometry) and **`pdf_layout_spec.json`** — the **region-based** layout spec: `page` geometry, `calibration.viewport_px`, `regions.*` (named layout rectangles), `slide_types[type].regions` (which regions each slide type uses), `slide_type_overrides`, `fonts`, `line_heights`, `content_constraints`, `toc`, `print`. Read by `gen-slides-pdf.ts` (v1.2.0) as Layer 1 of the 4-layer PDF merge. The renderer is **theme-agnostic**: `buildCoords()` resolves `regions.*` uniformly and dispatches render functions by declared `slide_types`, not by theme name.

> **Layer 0 — shared defaults**: `docs/html-themes/themes/_shared/layout_base.json` holds the region skeleton (all regions `null`) + the 16:9 `page` baseline + `print` defaults. It is the merge base, never filled by the renderer. `_shared/` is excluded from the theme scan (it is not itself a theme).

### Layer 2 — Style (CSS Variable Set)

A **style** is a CSS variable override file that controls color, font, and spacing. Styles do NOT change DOM structure. Styles live in the **shared `styles/` pool** (ADR-0045 Decision B) — they are NOT nested under individual themes, so any theme can pair with any compatible style without duplicating CSS.

| Name | File | Best For | Image Panel |
|------|------|---------|-------------|
| `premium-dark` | `docs/html-themes/styles/premium-dark/style.css` | Executive / keynote — dark navy + gold accent + MaruBuri/Noto Serif KR + soft gold title glow (default) | Inherited from theme |
| `classic` | `docs/html-themes/styles/classic/style.css` | General purpose | 45% right panel |
| `minimal` | `docs/html-themes/styles/minimal/style.css` | Text-heavy lectures | None |
| `visual-heavy` | `docs/html-themes/styles/visual-heavy/style.css` | Visual storytelling (scroll-partial / slideshow-incompatible) | Full-bleed background |
| `academic` | `docs/html-themes/styles/academic/style.css` | Research / thesis | 30% illustration panel |

> **`premium-dark` is the default style** as of 2026-06-22 (replaces `classic`). Projects whose `lecture-profile.md` does not set `style` now render `premium-dark`. Derived from the `kyobo_ax_2026` executive lecture deck; optimized for `scroll`, compatible with `slideshow`.
>
> **`classic` color-spec drift fix** (2026-06-22): `styles/classic/pdf_color_spec.json` previously held a dark palette that mismatched its light CSS — corrected to the matching LIGHT palette. The dark palette now lives under `styles/premium-dark/pdf_color_spec.json`.

**CSS Load Order** (injected by html-build; later layers override earlier ones):

```
1. styles/base.css                    — shared foundation: structural rules + default variables
2. themes/<theme>/theme.css           — per-theme extension
3. styles/<style>/style.css           — per-style visual overrides
```

Each style folder also includes **`pdf_color_spec.json`** — 12 role-based RGB color keys (`background`, `accent`, `text_primary`, etc.). Read by `gen-slides-pdf.ts` as Layer 2 of the 4-layer PDF merge.

### Compatibility

Not all theme × style combinations are valid. Check `docs/html-themes/THEMES.md` compatibility matrix.

| Style ↓ / Theme → | `scroll` | `slideshow` |
|-------------------|----------|-------------|
| `premium-dark` | ✅ | ✅ |
| `classic` | ✅ | ✅ |
| `minimal` | ✅ | ✅ |
| `visual-heavy` | ⚠️ partial | ❌ incompatible (full-bleed breaks rounded-card layout) |
| `academic` | ✅ | ❌ incompatible (30% panel collapses in fullscreen) |

### Theme/Style Authoring

To create a new theme or style, use the **T-Stage** or **Style Workflow** via the PM agent. See `skills/theme-authoring/SKILL.md`. The `scaffold-theme-style.ts` script stubs the correct file layout (region skeleton for themes, adapted copy for styles) and auto-regenerates the preview manifest.

**`visual-heavy` special behavior** (RETAINED — scroll-partial / slideshow-incompatible): `renderSlide()` must inject `--slide-bg-image` as a CSS custom property on the `.slide` element. Works well on scroll for short/visual slides (cover, divider, image-driven content); avoid for text-dense scroll slides. Incompatible with slideshow (full-bleed conflicts with rounded-card layout).

### 4-Layer PDF Merge

`gen-slides-pdf.ts` (v1.2.0) merges four layers at runtime via `deepMerge` (later layers win):

```
Layer 0 — shared : docs/html-themes/themes/_shared/layout_base.json       → region skeleton (all null) + 16:9 page + print defaults
Layer 1 — theme  : docs/html-themes/themes/<theme>/pdf_layout_spec.json   → regions.*, slide_types[type].regions, slide_type_overrides, fonts, line_heights, content_constraints, toc, print
Layer 2 — style  : docs/html-themes/styles/<style>/pdf_color_spec.json    → color palette
Layer 3 — project: presentations/<project>/lecture-profile.md             → layout_overrides block
```

Region values that are `null` in the theme spec stay `null` (Layer 0 never fills a region the theme intends to leave absent). Required regions referenced by `slide_types[type].regions` that resolve to `null` throw — there is no silent fallback. Per-project overrides (e.g., 4:3 ratio, CI accent color, higher bullet count) are set in `lecture-profile.md` → `layout_overrides` and take precedence over all theme/style defaults.

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
  theme: scroll       # HTML structure: scroll | slideshow
  style: premium-dark # CSS variables: premium-dark | classic | minimal | visual-heavy | academic
keywords: [Keyword 1, Keyword 2]
instructor:
  name: ""
  title: ""
  organization: ""
image:
  source: auto        # Pixabay keyless → Unsplash URL → API keys
  style_hint: "professional"
dividers:
  mode: auto          # auto | manual | none
```

**Agents that read this file**: research (queries), storyline (slide_count, dividers.mode + reads `theme.json content_rules` for slide density constraints), html-build (`presentation.theme` + `presentation.style`, instructor), image-curator (source, style_hint).
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

**Per-project manifest**: `presentations/<project>/image-manifest.json` — maps slide index → slug, records source URL, license, `"reused": true/false`. Missing images are logged but do not block the pipeline.

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
| 9-10 | Measure | — | layout_spec.json, pdf_layout_spec.md |
| 11 | Export | **Gate 5 (required)** | sample_5slides.pdf → full .pdf |
<!-- END VARIANT-INJECT -->

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Presentation Production Guidelines

### Content Rules
1. Research must cover both Korean and English sources
2. Slide count and bullet density: governed by `theme.json content_rules` (read from `docs/html-themes/themes/<theme>/theme.json` at Stage 2). Default: scroll theme → max 5 bullets, 30-60 slides; slideshow → max 3 bullets, 20-40 slides
3. Each slide: ≤ bullets per `content_rules`; `image_role: none` max 3 consecutive slides
4. Speaker intro (slide 2) and contact (last slide) are mandatory
5. Every slide in slide_deck.md must have `image_role`, `image_query`, `image_license` fields

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
4. Images: from shared pool `presentations/assets/images/<slug>.<ext>`; reference as `../assets/images/<slug>.<ext>` (path from `image-manifest.json` → `path` field)
5. For slides with no image in manifest: use text-panel fallback — never use placeholder images
6. **TOC sidebar is MANDATORY for scroll theme**: wrap slides in `<div id="viewer"><aside id="toc-panel">…</aside><main id="slide-container">…</main></div>`. Each `.slide` must carry `id="slide-${index}"`.

### Visual Diagram Pipeline

For slides that use concept diagrams (not stock photos), the pipeline is:

```
CSS-defined concept → gen-visual-images.ts → images/<stem>.svg (source artifact)
                                           → images/<stem>.png (rendered output)
                                           → slideData[i].visualImage = "images/<stem>.png"
                                           → HTML: applyVisualImages() injects <img> into .right-panel
                                           → PDF:  gen-slides-pdf.ts reads visualImage from slidedata.json
```

**Design principle**: SVG is the source of truth; PNG is the delivery format. Both are saved to disk so HTML and PDF consume identical pixel-level images, guaranteeing visual consistency.

**Rules**:
1. `gen-visual-images.ts` must be run before `html-build` and `pdf-export` stages whenever concept diagrams change
2. SVG source files (`images/<stem>.svg`) MUST be saved alongside PNG — they are source artifacts, not intermediate files
3. `slidedata.json` `visualImage` field must reference the PNG path (relative to project dir, e.g. `"images/slide-03.png"`)
4. HTML `applyVisualImages()` replaces `.right-panel` CSS diagrams with `<img>` at runtime using `slideData[i].visualImage`
5. Slides that use `.cards-3` layout (no `.right-panel`) are intentionally skipped by `applyVisualImages()`
6. Korean text rendering in SVG requires Malgun Gothic (`C:/Windows/Fonts/malgun.ttf`) loaded explicitly via `@resvg/resvg-js` `font.fontFiles`

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
| `presentations/assets/fonts/` | **Shared font pool** — downloaded once, reused across all projects |
| `presentations/assets/icons/` | **Shared icon pool** |
| `presentations/assets/images/` | **Shared image pool** — slug-named, cross-project reuse |
| `agents/` | Agent role definitions (10 agents) |
| `skills/` | Skill trigger descriptors |
| `scripts/co-deck/` | Variant-specific TypeScript scripts |
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
5. **PDF requires layout measurement** — always run Measure Agent before Export Agent
6. **Playwright is optional** — only install for `measure-layout.ts`; `bun install` skips it by default
7. **source-verifier is optional but recommended** — Trust Score < 70% (derived from `variant.json` `trust_score_thresholds.escalate`) should block storyline
8. **image-curator is optional** — skip if all slides use `image_role: none` or images are pre-supplied
9. **Theme vs Style boundary**: Themes own DOM structure (`template.html`) and per-theme CSS extension (`theme.css`); styles own CSS variables only (`style.css`). Styles live in the shared `styles/` pool — never nest a style under a theme folder. Never modify DOM in a style file.
10. **Shared asset pool**: Fonts and images live in `presentations/assets/` — not in per-project folders. Check existence before downloading; set `"reused": true` in manifest when reusing.
11. **theme.json is read at Stage 2**: Storyline must receive the path `docs/html-themes/themes/<theme>/theme.json` to apply `content_rules` (max bullets, title length, slide count range) during slide_deck.md generation.
12. **Theme × Style compatibility gated at Stage 0**: PM checks THEMES.md compatibility matrix before confirming `presentation.theme` + `presentation.style`. Incompatible combinations are rejected with explanation. `visual-heavy` is RETAINED — scroll-partial, slideshow-incompatible.
13. **TypeScript-first**: Use TypeScript scripts (`bun scripts/co-deck/`) for all automated operations. Python is only permitted when the task cannot be accomplished in TypeScript. When a TS script already exists for a task, use it — never default to Python.
14. **4-layer PDF merge + region model**: `gen-slides-pdf.ts` (v1.2.0) always `deepMerge`-loads `_shared/layout_base.json` (Layer 0, region skeleton) → `pdf_layout_spec.json` (theme, `regions.*` + `slide_types[type].regions`) → `pdf_color_spec.json` (style) → `layout_overrides` (project) in order. The renderer is theme-agnostic — dispatch is by declared `slide_types`, not by theme name. Required regions that resolve to `null` throw (no silent fallback). Never hardcode geometry or color values in the script.
15. **Validate after every theme/style edit**: run `bun scripts/co-deck/validate-theme-styles.ts` (region schema + shared pool + slide_type↔region cross-check). Regenerate `bun scripts/co-deck/generate-themes-manifest.ts` after adding/removing any theme or style. Use `scaffold-theme-style.ts` to stub new entries (auto-regenerates the manifest).
<!-- END VARIANT-INJECT -->

---

*co-deck.context.md version: 2.6 — updated 2026-06-22: `premium-dark` style added as DEFAULT (dark navy + gold accent + MaruBuri/Noto Serif KR + soft gold title glow; scroll-compatible primary + slideshow-compatible; derived from the `kyobo_ax_2026` executive deck); `classic/pdf_color_spec.json` corrected to a LIGHT palette (drift fix); `base.css` neutral `--title-text-shadow` hook; `variant.json` `theme_manifest.default` = `premium-dark`. Previous: v2.5 2026-06-21 region-based layout model (ADR-0045 Decision #2) — `pdf_layout_spec.json` v1.2.0 declares `regions.*` + `slide_types[type].regions` + `slide_type_overrides`; Layer 0 `themes/_shared/layout_base.json`; per-theme `theme.css` + `theme.json` `css_theme` field; CSS Load Order (base → theme.css → style.css); 3-layer → 4-layer PDF merge; validation/preview workflow (`validate-theme-styles.ts` v2.0.0, `generate-themes-manifest.ts` v1.0.0, `scaffold-theme-style.ts` v1.0.0); visual-heavy RETAINED (scroll-partial / slideshow-incompatible). Prior: v2.4 html-themes restructure (styles migrated to styles/<name>/style.css; base.css moved to styles/base.css).*
