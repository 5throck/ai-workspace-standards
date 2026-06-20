---
# co-deck — Variant Configuration
# Last Updated: 2026-06-20
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

## HTML Themes

<!-- VARIANT-INJECT: html-themes -->
CSS variable override themes — DOM structure is immutable across all themes.

| Theme | File | Best For | Image Panel |
|-------|------|----------|-------------|
| `classic` | `html-themes/overrides/classic.css` | General purpose (default) | 45% right panel |
| `minimal` | `html-themes/overrides/minimal.css` | Text-heavy lectures | None |
| `visual-heavy` | `html-themes/overrides/visual-heavy.css` | Visual storytelling | Full-bleed background |
| `academic` | `html-themes/overrides/academic.css` | Research / thesis | 30% illustration panel |

Base styles: `html-themes/base/base.css` (shared CSS variables — do not modify per-theme).

**Theme selection**: set `theme:` in `docs/lecture-profile.md`. Default: `classic`.

**`visual-heavy` special behavior**: `renderSlide()` must inject `--slide-bg-image` as a CSS custom property on the `.slide` element. `<html data-theme="visual-heavy">` must be set for CSS selectors to activate.
<!-- END VARIANT-INJECT -->

---

## Lecture Profile

<!-- VARIANT-INJECT: lecture-profile -->
`docs/lecture-profile.md` is the single source of truth for per-lecture settings.

**Scaffolded automatically** on `bun new-project` — edit before starting Stage 1.

Key fields:
```yaml
title: "강의 제목"
audience: graduate | undergraduate | practitioner | general
level: intro | intermediate | advanced
theme: classic | minimal | visual-heavy | academic
keywords: [키워드1, 키워드2]
instructor:
  name: ""
  title: ""
  organization: ""
image:
  source: auto        # Pixabay keyless → Unsplash URL → API keys
  style_hint: "professional"
  api_keys:
    pixabay: ""       # optional — keyless works without this
    unsplash: ""
    pexels: ""
dividers:
  mode: manual        # manual | auto | none
```

**Agents that read this file**: research (queries), storyline (slide_count, dividers.mode), html-build (theme, instructor), image-curator (source, style_hint, api_keys).
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

**Output**: `presentations/<project>/assets/images/slide-<NNN>-<slug>.<ext>` + `image-manifest.json`

**`image-manifest.json`** records: source URL, license, `commercial_use: true`, `attribution_required: false`, download status. Missing images are logged but do not block the pipeline.
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

# Font download (run once per project before PDF export)
bun run download-font maruburi
```

No `.env` required by default. API keys for image sources are optional and stored in `lecture-profile.md`.
<!-- END VARIANT-INJECT -->

---

## Development Workflow

<!-- VARIANT-INJECT: development-workflow -->
```
User: "make a lecture about X"
  → PM reads lecture-profile.md (or prompts user to fill it)
  → Dispatches Research → Source Verifier → Storyline → Design → Image Curator → Build → Measure → Export
  → Gates 2, 3, 5 require explicit user approval before advancing
  → Gate 1.5 (source-verifier) and Gate 4 (html-build) are optional
```

### Pipeline Stages

| Stage | Agent | Gate | Key Output |
|-------|-------|------|-----------|
| 0 | PM | — | project_state.json initialized; lecture-profile.md confirmed |
| 1 | Research | Gate 1 (optional) | research_notes.md |
| 1.5 | Source Verifier | **Gate 1.5** (optional, `--skip-verify` to bypass) | source-verification.md + Trust Score |
| 2-3 | Storyline | **Gate 2 (required)** | storyline.md, slide_deck.md (with image_role/image_query) |
| 4 | Design | **Gate 3 (required)** | design_spec.md |
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
2. Slide count: 30-60 per lecture (discuss with user before exceeding)
3. Each slide: ≤ 5 bullet points (3 is ideal); `image_role: none` max 3 consecutive slides
4. Speaker intro (slide 2) and contact (last slide) are mandatory
5. Every slide in slide_deck.md must have `image_role`, `image_query`, `image_license` fields

### Design Rules
1. 8-role color palette: defined in design_spec.md CSS variable block
2. Font: Korean-compatible (MaruBuri, NanumSquare Neo, or Noto Sans KR)
3. Layout: determined by theme (classic = two-panel; minimal = text only; visual-heavy = full image)
4. No hardcoded color or font values in HTML — CSS variables only

### Build Rules
1. Always call Version Agent before editing any file
2. HTML must embed `slideData` array for PDF extraction
3. Set `<html data-theme="<theme>">` and inject theme CSS link
4. Images: named `assets/images/slide-<NNN>-<slug>.<ext>` (from image-curator manifest)
5. For slides with no image in manifest: use text-panel fallback — never use placeholder images

### Image Rules
1. Only use commercial-use unlimited sources (Pixabay, Pexels, Unsplash)
2. `image_query` must be in English — even for Korean lectures
3. `visual-heavy` theme requires `image_role: background` on most slides
4. API keys are optional — keyless Pixabay is the default

### Approval Gate Rules
- Gates 2, 3, 5 are **MANDATORY** — PM must NOT advance without user approval
- Gate 1, 1.5, and 4 are optional — PM may ask user or auto-advance
- Gate 5: always generate 5-slide sample first; full PDF only after approval
- Gate 1.5: if Trust Score < 60%, hold for re-research before advancing to storyline
<!-- END VARIANT-INJECT -->

---

## File Organization Policy

<!-- VARIANT-INJECT: file-organization -->
| Folder | Purpose |
|--------|---------|
| `presentations/<project>/` | All outputs for a single lecture project |
| `docs/lecture-profile.md` | Lecture settings SSOT (audience, theme, image prefs, instructor) |
| `presentations/<project>/assets/images/` | Downloaded images (image-curator output) |
| `presentations/<project>/_versions/` | Version snapshots (Version Agent) |
| `agents/` | Agent role definitions (10 agents) |
| `skills/` | Skill trigger descriptors |
| `scripts/co-deck/` | Variant-specific TypeScript scripts |
| `html-themes/base/` | Shared CSS variable foundation |
| `html-themes/overrides/` | Per-theme CSS variable overrides (4 themes) |
| `memory/` | Dev session logs |
| `docs/` | Project context + ADRs |
<!-- END VARIANT-INJECT -->

---

## Domain Rules

<!-- VARIANT-INJECT: domain-rules -->
1. **Version Agent is always called first** — before any file modification by any agent
2. **lecture-profile.md is the single source of truth** for theme, audience, instructor, and image settings
3. **project_state.json tracks pipeline progress** — PM reads this to resume interrupted sessions
4. **`--workspace presentations/<project>`** must always be passed to snapshot.ts to scope backups
5. **PDF requires layout measurement** — always run Measure Agent before Export Agent
6. **Playwright is optional** — only install for `measure-layout.ts`; `bun install` skips it by default
7. **source-verifier is optional but recommended** — Trust Score < 60% should block storyline
8. **image-curator is optional** — skip if all slides use `image_role: none` or images are pre-supplied
9. **CSS DOM structure is immutable** — themes change CSS variables only, never DOM elements
<!-- END VARIANT-INJECT -->

---

*co-deck.context.md version: 2.0 — updated 2026-06-20: TypeScript migration, Phase 1 (lecture-profile, image-curator, storyline image fields, cover/divider flow), Phase 2 (HTML themes 4종, source-verifier, Pixabay keyless image strategy)*
