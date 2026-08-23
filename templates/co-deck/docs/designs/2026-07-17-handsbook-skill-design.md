# Handbook Skill Design

> **Status**: Implemented
> **Date**: 2026-07-17
> **Scope**: `templates/co-deck/skills/handbook/` — co-deck variant only

## 1. Overview

The **handbook** skill is a co-deck-exclusive skill that generates searchable, themed handbooks as static sites (GitHub Pages). It supports three modes:

1. **Standalone handbook** — any topic → full handbook site
2. **Lecture companion** — reads co-deck `slide_deck.md` → companion teaching material (reuses cached pipeline outputs)
3. **Course handbook** — multiple lectures → integrated course site

The skill is inspired by [beret21/teachme v0.3.1](https://github.com/beret21/teachme) but built from scratch to comply with the AUTHORING_GUIDELINES specification (24 sections + appendix checklist).

### Design Principles

- **Separation from slide pipeline**: The handbook system is an independent H-Stage workflow (H-0~H-7), not a stage in the 11-stage slide pipeline. It follows the T-Stage pattern (parallel workflow, separate user intent).
- **3-layer dark mode**: Auto-detect via `@media (prefers-color-scheme: dark)`, manual toggle via `.dark` class + localStorage. No user preference prompt at H-0.
- **CSS variables only**: All colors use `var(--bg)`, `var(--text)`, `var(--accent)`, etc. Zero hardcoded hex values.
- **i18n file convention**: Separate files per language (`chapter.html` / `chapter_ko.html` / `chapter_en.html`). Language switcher uses AI-friendly filename convention.
- **Modular references**: BUILD_GUIDE (pipeline), AUTHORING_GUIDELINES (writing standards), SECTION_TYPES (content templates), QUALITY_CHECKLIST (verification) are separate files with single responsibilities.
- **Shared validation infra**: Navigation validation scripts (`validate-nav.ts`) are referenced from a common location and included in every handbook project.
- **Examples as CI regression fixtures**: `examples/` serve dual purpose — learning reference AND CI regression fixtures validated by `check-authoring.ts --examples-dir`.
- **Manifest-driven search index**: `search-manifest.json` is the SSOT of searchable pages. `build-search-index.ts` generates `search-data.js` consumed by `site-search.js` — no manual DOCS array editing. CI verifies the generated file is never stale.
- **Layered validation toolkit**: Validation is organized as independent check layers (structure, navigation, tables, a11y, spell, lint, external links, authoring, doctor) aggregated by a single entry point (`validate-handbook.ts`).
- **Lifecycle management**: Validation scripts follow the workspace lifecycle model — versioned, tracked, and updated centrally.

## 2. Directory Structure

```
templates/co-deck/skills/handbook/
├── SKILL.md                                      # Entry point: command interface + H-Stage pipeline orchestration
├── references/
│   ├── BUILD_GUIDE.md                           # Core pipeline (§0-§7)
│   ├── AUTHORING_GUIDELINES.md                  # Writing standards (24 sections + appendix, lang: ko)
│   ├── SECTION_TYPES.md                         # Section type definitions (6 types)
│   ├── QUALITY_CHECKLIST.md                     # Pre-shipment auto + manual verification
│   └── validation/
│       └── NAV_VALIDATION.md                   # Common validation script reference guide
├── templates/
│   ├── base.html                                # Common layout (header/footer/nav/search/dark toggle/lang switcher)
│   ├── index.html                               # Landing page (card grid + search)
│   ├── manual.html                              # Reference manual template
│   ├── examples.html                            # Hands-on practice template (A/B platform support)
│   ├── chapter.html                             # Narrative chapter template
│   ├── quiz.html                                 # Quiz/Q&A template
│   ├── course-overview.html                     # Course overview template (§14 compliant — 9 items)
│   ├── instructor-guide.html                    # Instructor operations guide (§20/§24 compliant — 6 sections)
│   ├── .gitignore                               # Security exclusions
│   └── .nojekyll
├── assets/
│   ├── css/
│   │   └── handbook-theme.css                   # Azure palette, 3-layer dark mode CSS variables
│   ├── js/
│   │   ├── site-search.js                       # Ctrl+K site-wide search, debounced
│   │   ├── inpage-search.js                     # Ctrl+F replacement with highlights
│   │   ├── dark-mode-toggle.js                  # Auto-detect + localStorage toggle
│   │   └── lang-switcher.js                     # AI-friendly filename convention
│   └── icons/                                   # Placeholder for future icons
└── examples/
    ├── minimal/                                 # Minimal example (1 chapter + index)
    ├── handbook/                                 # Standard handbook (manual + chapter + examples)
    └── course/                                  # Course handbook (overview + instructor guide + chapters)
```

### Design Decisions

| Decision | Rationale |
|----------|-----------|
| `references/` instead of `guides/` or `specs/` | Consistent with teachme ecosystem — "reference documents used by the skill" |
| `handbook-theme.css` (not `theme.css`) | Avoids collision with 5 existing co-deck `theme.css` files (one per slide theme) |
| 3-layer dark mode (not preference prompt) | Auto-detect eliminates need for H-0 preference question; manual toggle available via localStorage |
| `examples/` as regression fixtures | `check-authoring.ts --examples-dir` validates examples on every PR |
| `instructor-guide.html` template | Course sites require instructor operations guide (lecture flow, expected questions, timing, etc.) |
| CSS variables only (zero hardcoded hex) | Enables theme switching without touching HTML — single `apply-handbook-theme.ts` command |
| `search-manifest.json` + `build-search-index.ts` (not manual DOCS array) | Handbooks scale to 36–124 pages per language; a hand-maintained array drifts. Manifest → generated `search-data.js` separates page data from search UI logic |
| Unified `validate-handbook.ts` entry point | One command validates the whole handbook (`--checks all` = 8 check groups) instead of remembering individual scripts |

## 3. SKILL.md Frontmatter

```yaml
---
name: handbook
description: "Generate a searchable, themed handbook as a static site (GitHub Pages) from any topic or co-deck lecture storyline. Supports standalone handbooks, lecture companions, and full course sites with dark mode (3-layer CSS) and multi-language (i18n)."
version: 0.3.0
status: active
scope: co-deck
owner: pm
prerequisites: "Bun runtime, git, gh (GitHub CLI, logged in)"
metadata:
  type: process
  triggers:
    - handbook
    - /handbook
    - create handbook
    - build handbook
    - make course site
    - companion handbook
    - 강의 교재 만들어줘
    - 핸드북 만들어줘
    - 코스 사이트 만들어줘
    - 교안 만들어줘
---
```

## 4. Command Interface

```
/handbook [subcommand] [options] "<topic>"
```

### Subcommands

| Subcommand | Description |
|-----------|-------------|
| `new` (default) | Create new handbook — topic → structure → template copy → content writing → verification → deploy |
| `companion` | Read co-deck `slide_deck.md` → reuse cached outputs → companion teaching material |
| `course` | Integrate multiple lectures into unified course handbook site |
| `theme` | Switch built-in theme (azure/graphite/teal/amber/indigo) |
| `verify` | Run handbook-doctor + check-authoring + validate-nav |
| `deploy` | Deploy to GitHub Pages (secret scan mandatory gate) |
| `doctor` | Run handbook-doctor.ts — 12 static analysis checks |

### Flags

| Flag | Description |
|------|-------------|
| `--lang <code>` | Override auto-detected language (default: auto from prompt language) |
| `--theme <name>` | Theme name (default: `azure`) |
| `--type <section-type>` | Force section type (manual/examples/chapter/quiz/course-overview/instructor-guide) |
| `--repo <slug>` | GitHub repository slug (default: from project directory name) |
| `--dir <path>` | Output directory (default: `handbook/`) |
| `--owner <user>` | GitHub owner (default: from gh auth) |
| `--deploy` | Auto-deploy after verification |
| `--no-verify` | Skip quality verification (not recommended) |

### Safety

- Only creates/edits/deploy — never deletes user files.
- Secret scan is a mandatory gate before any push.
- `.gitignore` excludes `.env`, credentials, keys, tokens, and `CLAUDE.md`/`**/CLAUDE.md`.

## 5. H-Stage Pipeline

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

### Companion Mode Cache Reuse

| Pipeline Output | Reuse Source |
|-----------------|-------------|
| Research Package | `research_notes.md` from prior slide project |
| Images | `image-manifest.json` entries from shared pool |
| Diagrams | `presentations/assets/diagrams/*.svg` |
| References | `source-verification.md` validated URLs |
| Versions | `presentations/<project>/_versions/` snapshots |

### Theme as Domain Step (H-6)

Theme is a first-class domain step, not just an asset swap:
1. Select built-in theme (azure/graphite/teal/amber/indigo)
2. Run `apply-handbook-theme.ts` — generates `:root` + `@media dark` + `.dark` CSS blocks
3. Generate/update `handbook-theme.css`
4. Update `search-manifest.json` (add/remove pages), then run `build-search-index.ts` to regenerate `search-data.js` — `site-search.js` consumes the generated `SEARCH_DATA` global, so its DOCS array is never edited by hand
5. Update meta tags (description, language)

## 6. Section Types (SECTION_TYPES.md)

| Type | Template | Purpose | Key Features |
|------|----------|---------|-------------|
| **Manual** | `manual.html` | Reference manual | 2-column layout (fixed sidebar + main), version boxes, concept/command trees, comparison tables |
| **Examples** | `examples.html` | Hands-on practice | Difficulty badges (green/blue/purple), A/B platform split support, step-list structure, flow-box/tip-box |
| **Chapter** | `chapter.html` | Narrative/theory chapter | 720px reading width, "Key Points of This Chapter" block, blockquotes, prev/next chapter nav |
| **Quiz** | `quiz.html` | Quiz/Q&A | MCQ, short answer, essay + model answers + rubrics, `<details>` toggle |
| **CourseOverview** | `course-overview.html` | Course introduction | §14 compliant — 9 required items (summary, objectives, audience, prerequisites, format, schedule, topics, outcomes, instructor) |
| **InstructorGuide** | `instructor-guide.html` | Instructor operations | §20/§24 compliant — 6 sections (lecture flow, expected questions, practice timing, frequent mistakes, demo order, evaluation criteria) |

## 7. Quality Verification (QUALITY_CHECKLIST.md)

### Automated (Scripts)

Validation is organized as independent check layers aggregated by a single entry point, `validate-handbook.ts` (v1.1.0). Default `--checks structure,nav,tables`; `--checks all` runs all 8 groups. Exit code 1 on any failure.

| Check Group | Script | Checks | Mode |
|-------------|--------|--------|------|
| ① Structure | `check-structure.ts` | Tag nesting (stack-based), `<pre>`/`.copy-btn` balance, no nested code-blocks, stray chars, required scripts, `<html lang>`, language pairs | in-process |
| ② Navigation | `validate-nav.ts` (4 checks) | Broken links, prev/next symmetry, label↔target match, **search index sync (v2.0.0 manifest 3-way)** | in-process |
| ③ Tables | `check-tables.ts` | Table column-sizing policy (no inline colgroup widths, no nowrap on first td) | in-process |
| a11y | `check-a11y.ts` | Missing `alt`, heading hierarchy (stack-based container reset), empty links, missing `html lang` | in-process |
| spell | `check-spell.ts` | 197 common English misspellings (strips script/style/pre/code/URLs) | in-process |
| lint | `check-lint.ts` | Inline styles (allowlist: CSS custom props, SVG, flexbox), inline event handlers (no exceptions — copy buttons use delegation), deprecated tags, duplicate IDs, empty headings | in-process |
| authoring | `check-authoring.ts` | 12 AUTHORING_GUIDELINES compliance checks + `--examples-dir` regression | subprocess |
| doctor | `handbook-doctor.ts` | 12 static analysis checks (sidebar nav, chapter-nav, broken links, dark palette, language pair, visual element, Course Overview, Instructor Guide, unused assets, duplicate IDs, hardcoded colors, empty title/h1) | subprocess |

**CI Integration**: `check-authoring.ts --examples-dir` validates `examples/` as regression fixtures on every PR. The scaffolded workflow runs `validate-handbook`, `validate-nav`, `check-authoring`, `handbook-doctor`, `check-a11y`, `check-spell`, `check-lint`, and a `build-search-index` job that fails if `search-data.js` is out of sync with `search-manifest.json`.

### Manual (Agent)

- AUTHORING_GUIDELINES Appendix A checklist (40+ items)
- Dark mode visual review (all 3 layers: light, auto-dark, manual-dark)
- i18n completeness (all chapters have language pairs)
- Instructor Guide content quality review

## 8. Validation Scripts (21 files)

The handbook toolkit ships 21 scripts in `scripts/co-deck/handbook/`, registered in `scripts/co-deck/SCRIPTS.md`.

### Navigation Validation (from teachme, modified)
- `nav-utils.ts` — HTML parsing helpers (DOCS_DIR accepts `--docs-dir` CLI arg)
- `validate-nav.ts` — orchestrator (4 checks)
- `check-links.ts` — broken link check
- `check-symmetry.ts` — prev/next reciprocity check
- `check-labels.ts` — label↔target match check
- `check-search.ts` — **v2.0.0** search index sync check (manifest 3-way: `search-manifest.json` ↔ actual HTML files ↔ generated `search-data.js`; stale detection both directions)

### Search Index Pipeline (new)
- `search-manifest.json` — SSOT of searchable pages (`{ path, title, lang }` per entry), created per handbook in `docs/`
- `build-search-index.ts` — reads the manifest, generates `docs/assets/search-data.js` declaring the `SEARCH_DATA` global (`DOCS` + per-language `LABELS`)
- `site-search.js` — consumes `SEARCH_DATA` at runtime; the DOCS array is **never edited by hand**

### Quality Verification Layers (new)
- `check-a11y.ts` — L2 accessibility (missing alt, heading hierarchy with stack-based container reset, empty links, missing lang)
- `check-spell.ts` — L3 English spell check (197 common misspellings; strips script/style/pre/code/URLs)
- `check-lint.ts` — L4 HTML lint (inline styles with allowlist, inline event handlers, deprecated tags, duplicate IDs, empty headings)
- `check-external-links.ts` — L5 external link checker (HTTP HEAD, 5s timeout, 5-request concurrency, safe-domain skips)

### Structure, Authoring & Aggregation
- `check-structure.ts` — HTML well-formedness (stack-based tag nesting, pre/copy-btn balance, language pairs)
- `check-tables.ts` — table column-sizing policy
- `check-authoring.ts` — 12 AUTHORING_GUIDELINES compliance checks + `--examples-dir` regression
- `validate-handbook.ts` — **v1.1.0** unified entry point aggregating every read-only check (`--checks all` = 8 groups; runSubprocess try/catch)

### Scaffolding, Theming, Deploy & Maintenance
- `scaffold-handbook.ts` — generates handbook project scaffold from templates
- `apply-handbook-theme.ts` — 5 built-in theme application (azure/graphite/teal/amber/indigo)
- `handbook-doctor.ts` — 12 static analysis checks
- `deploy-handbook.ts` — GitHub Pages deployment automation
- `update-footers.ts` — localized site footer sync (ko/en/es/ja)
- `extract-copycode.ts` — extracts inline `copyCode()` into shared `docs/assets/copy-code.js`

## 9. Agents (2 new)

| Agent | Phases | Handoff | Role |
|-------|--------|---------|------|
| **handbook-writer** | H-2~H-4 | pm → handbook-writer → handbook-reviewer | Content creation — chapter structure, prose, course materials, AUTHORING_GUIDELINES compliance |
| **handbook-reviewer** | H-5 | handbook-writer → handbook-reviewer → pm | Quality gate — runs handbook-doctor + check-authoring + validate-nav, applies fixes |

Both agents are **only dispatched in H-Stage** — never in the 11-Stage slide pipeline.

## 10. Conflict Resolution with Existing co-deck Documents

| Risk | Area | Conflict | Resolution |
|------|------|----------|------------|
| CRITICAL | Language Policy (AGENTS.md §Language) | Korean AUTHORING_GUIDELINES violates English-only rule | `lang: ko` / `lang_reason: source-material` frontmatter exception |
| HIGH | Theme naming (context.md) | Existing 5 `theme.css` files | Handbook CSS named `handbook-theme.css` — distinct namespace |
| HIGH | CSS Load Order (context.md) | 4-step slide load order | Handbook uses separate load path — single `handbook-theme.css` link |
| HIGH | Build Rules (context.md) | slideData embedding, image path conventions | Handbook has separate build rules documented in BUILD_GUIDE |
| MEDIUM | Pipeline integration (AGENTS.md) | No handbook stage in 11-stage pipeline | **H-Stage pattern** — separate parallel workflow |
| MEDIUM | Content Rules (context.md) | 6 existing slide-specific content rules | Handbook content rules defined in AUTHORING_GUIDELINES — separate scope |
| LOW | Navigation validation | No existing nav-validation in co-deck | No conflict — entirely new subsystem |

## 11. Files Modified for Registration

| File | Updates |
|------|---------|
| `co-deck.context.md` | Added `handbook` to Skills table, Handbook Domain Rules (8 rules), H-Stage Pipeline, `skills/handbook/` to File Organization, agent count 10→13 |
| `AGENTS.md` | Added handbook-writer + handbook-reviewer to Agent Roster, Dispatch Triggers, Phase Gate, Subagent Roster, H-Stage Pipeline section |
| `skills/SKILLS.md` | Added `handbook` row + reconciled missing `prep-pdf` and `theme-authoring` |
| `README.md` | Updated agent count 11→13, Agent Roster, Skills list |
| `agents/README.md` | Updated count 11→13, added agent rows + H-Stage rules |
| `agents/README_ko.md` | Korean translation, fixed count discrepancy 10→13 |
| `scripts/co-deck/SCRIPTS.md` | Added 10 handbook scripts + Handbook Workflow section |

## Version History

- **v0.1.0 (2026-07-17)**: Initial design — approved by user
- **v0.1.0 (2026-07-17) — v4 corrections applied during implementation**:
  - `handsbook` → `handbook` everywhere
  - H-0: removed dark mode preference (auto-detect makes it unnecessary)
  - BUILD_GUIDE: explicit companion cache reuse table
  - H-6: Theme elevated to domain step
  - `examples/` designated as CI regression fixtures
  - `handbook-doctor` expanded to 12 static analysis checks
  - `instructor-guide.html` template added
  - `dark-mode-toggle.js`, `lang-switcher.js` assets added
- **v0.3.0 (2026-08-17) — manifest-driven search + layered validation toolkit**:
  - Search pipeline: `search-manifest.json` → `build-search-index.ts` → `search-data.js` → `site-search.js` (replaces hand-maintained DOCS array; scales to 36–124 pages per language)
  - `check-search.ts` v2.0.0 — manifest 3-way validation (manifest ↔ files ↔ generated data, stale detection both directions)
  - New check layers: `check-a11y.ts` (L2), `check-spell.ts` (L3), `check-lint.ts` (L4), `check-external-links.ts` (L5)
  - `validate-handbook.ts` v1.1.0 — unified entry point; `--checks all` runs 8 groups; runSubprocess try/catch
  - `check-structure.ts` language regex extended to `[a-z]{2,3}(-[A-Z]{2})?`
  - Shared `copy-code.js` asset extracted via `extract-copycode.ts`
  - CI: `build-search-index` job with `git diff --exit-code` staleness verification
