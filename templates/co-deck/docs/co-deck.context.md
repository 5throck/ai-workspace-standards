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
| `extract_slidedata.mjs` | `scripts/` | HTML slideData → slidedata.json | active |
<!-- END VARIANT-INJECT -->

### Bun Dependencies

```bash
bun install          # installs pdf-lib, fflate, @pdf-lib/fontkit
                     # playwright is SKIPPED (optionalDependency)

# Only if measure-layout.ts is needed:
bun add playwright
bunx playwright install chromium
```

---

## Theme & Style System

<!-- VARIANT-INJECT: html-themes -->
co-deck uses a **two-layer** presentation appearance system. Authoritative registry: `docs/html-themes/THEMES.md`.

### Layer 1 — Theme (Rendering Paradigm)

A **theme** defines the HTML structure, navigation, and rendering paradigm. Each theme is a package folder containing `template.html` (HTML skeleton) and `theme.json` (metadata + content rules + compatibility).

| Name | Paradigm | Navigation | TOC | Content Rules | Folder |
|------|----------|-----------|-----|---------------|--------|
| `scroll` | Vertical scroll, all slides in DOM | Scroll + TOC panel | Required | max 5 bullets, 30 char title, 30-60 slides | `docs/html-themes/themes/scroll/` |
| `slideshow` | Fullscreen single-slide, CSS transitions | Prev/Next + arrow keys | None | max 3 bullets, 20 char title, 20-40 slides | `docs/html-themes/themes/slideshow/` |

`theme.json` fields: `content_rules` (read by Storyline at Stage 2), `compatible_styles`, `incompatible_styles`, `recommended_structure`, `slide_types` (declares which slide types the theme supports).

Each theme folder also includes **`pdf_layout_spec.json`** — page geometry (`width_mm`, `height_mm`, `margin_mm`), `calibration.viewport_px`, layout percentages, font sizes, and `slide_types`. Read by `gen-slides-pdf.ts` as Layer 1 of the 3-layer PDF merge.

### Layer 2 — Style (CSS Variable Set)

A **style** is a CSS variable override file that controls color, font, and spacing. Styles do NOT change DOM structure.

| Name | File | Best For | Image Panel |
|------|------|---------|-------------|
| `classic` | `docs/html-themes/styles/classic/style.css` | General purpose (default) | 45% right panel |
| `minimal` | `docs/html-themes/styles/minimal/style.css` | Text-heavy lectures | None |
| `visual-heavy` | `docs/html-themes/styles/visual-heavy/style.css` | Visual storytelling | Full-bleed background |
| `academic` | `docs/html-themes/styles/academic/style.css` | Research / thesis | 30% illustration panel |

Base: `docs/html-themes/styles/base.css` (shared structural CSS rules + default variables; injected before style.css by html-build).

Each style folder also includes **`pdf_color_spec.json`** — 12 role-based RGB color keys (`background`, `accent`, `text_primary`, etc.). Read by `gen-slides-pdf.ts` as Layer 2 of the 3-layer PDF merge.

### Compatibility

Not all theme × style combinations are valid. Check `docs/html-themes/THEMES.md` compatibility matrix.

| Style ↓ / Theme → | `scroll` | `slideshow` |
|-------------------|----------|-------------|
| `classic` | ✅ | ✅ |
| `minimal` | ✅ | ✅ |
| `visual-heavy` | ⚠️ partial | ❌ incompatible (full-bleed breaks rounded-card layout) |
| `academic` | ✅ | ❌ incompatible (30% panel collapses in fullscreen) |

### Theme/Style Authoring

To create a new theme or style, use the **T-Stage** or **Style Workflow** via the PM agent. See `skills/theme-authoring/SKILL.md`.

**`visual-heavy` special behavior**: `renderSlide()` must inject `--slide-bg-image` as a CSS custom property on the `.slide` element.

### 3-Layer PDF Merge

`gen-slides-pdf.ts` merges three layers at runtime (later layers win):

```
Layer 1 — theme  : docs/html-themes/themes/<theme>/pdf_layout_spec.json   → geometry, coordinates, fonts
Layer 2 — style  : docs/html-themes/styles/<style>/pdf_color_spec.json    → color palette
Layer 3 — project: presentations/<project>/lecture-profile.md             → layout_overrides block
```

Per-project overrides (e.g., 4:3 ratio, CI accent color, higher bullet count) are set in `lecture-profile.md` → `layout_overrides` and take precedence over both theme and style defaults.
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
  style: classic      # CSS variables: classic | minimal | visual-heavy | academic
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
3. Set `<html data-theme="<theme>" data-style="<style>">` and inject `base.css` + style CSS links
4. Images: from shared pool `presentations/assets/images/<slug>.<ext>`; reference as `../assets/images/<slug>.<ext>` (path from `image-manifest.json` → `path` field)
5. For slides with no image in manifest: use text-panel fallback — never use placeholder images
6. **TOC sidebar is MANDATORY for scroll theme**: wrap slides in `<div id="viewer"><aside id="toc-panel">…</aside><main id="slide-container">…</main></div>`. Each `.slide` must carry `id="slide-${index}"`.

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
| `docs/html-themes/styles/base.css` | Shared CSS structural foundation + default variables |
| `docs/html-themes/styles/<name>/style.css` | Per-style CSS variable overrides (`style.css` + `pdf_color_spec.json` per folder) |
| `docs/html-themes/themes/<name>/` | Theme packages: `template.html` + `theme.json` |
| `docs/html-themes/preview/` | `preview.html` — URL-param CSS swap for theme × style validation |
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
9. **Theme vs Style boundary**: Themes own DOM structure (template.html); styles own CSS variables only (style.css). Never modify DOM in a style file.
10. **Shared asset pool**: Fonts and images live in `presentations/assets/` — not in per-project folders. Check existence before downloading; set `"reused": true` in manifest when reusing.
11. **theme.json is read at Stage 2**: Storyline must receive the path `docs/html-themes/themes/<theme>/theme.json` to apply `content_rules` (max bullets, title length, slide count range) during slide_deck.md generation.
12. **Theme × Style compatibility gated at Stage 0**: PM checks THEMES.md compatibility matrix before confirming `presentation.theme` + `presentation.style`. Incompatible combinations are rejected with explanation.
13. **TypeScript-first**: Use TypeScript scripts (`bun scripts/co-deck/`) for all automated operations. Python is only permitted when the task cannot be accomplished in TypeScript. When a TS script already exists for a task, use it — never default to Python.
14. **3-layer PDF merge**: `gen-slides-pdf.ts` always loads `pdf_layout_spec.json` (theme) → `pdf_color_spec.json` (style) → `layout_overrides` (project) in order. Never hardcode geometry or color values in the script.
<!-- END VARIANT-INJECT -->

---

*co-deck.context.md version: 2.4 — updated 2026-06-21: html-themes restructure — styles migrated from overrides/ to styles/<name>/style.css; base.css moved to styles/base.css; File Organization Policy updated; previous: 3-layer PDF merge section, domain rule 14, slide_types field*
