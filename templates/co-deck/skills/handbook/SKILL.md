---
name: handbook
scope: co-deck
version: 0.1.0
description: >-
  Document Production Workflow for co-deck — generates searchable, themed
  handbooks as static sites (GitHub Pages). Three modes: standalone handbook,
  lecture companion (reads co-deck slide_deck.md), full course site.
  Responds to "make handbook", "create handbook", "build course site",
  "companion handbook" (triggered by Korean phrases too).
  H-Stage pipeline (H-0 through H-7). Independent from the 11-Stage slide pipeline.
status: active
owner: pm
last_reviewed: 2026-07-17
prerequisites: research (optional — standalone mode has no prerequisites)
---

## Context

Generates searchable, themed handbooks as static sites deployed to GitHub Pages.
Supports three modes:
- **Standalone**: Topic-based handbook built from scratch
- **Companion**: Reads cached co-deck slide pipeline outputs (Research Package, Images, References, Diagrams, Versions) without re-executing the 11-Stage pipeline
- **Course site**: Full course with Course Overview + Instructor Guide + chapters

Dark mode is automatic (3-layer: `:root` light → `@media prefers-color-scheme: dark` auto-detect → `.dark` class manual toggle). Multi-language support via separate HTML files per language (`chapter.html` / `chapter_ko.html` / `chapter_en.html`).

## When to Use

- PM Agent dispatches for handbook creation (H-Stage)
- User says "make handbook", "create handbook", "build course site"
- User says "companion handbook" (companion mode with co-deck integration)
- User says `교재 만들기`, `핸드북 생성`, `강의 자료 사이트`

---

## Execution Steps

### Subcommands

| Command | Description |
|---------|-------------|
| `new` | Create standalone handbook from topic |
| `companion` | Create companion handbook from existing co-deck project |
| `course` | Create full course site with Course Overview + Instructor Guide |
| `theme` | Apply a built-in theme to existing handbook |
| `verify` | Run all validation checks (validate-nav + check-authoring + handbook-doctor) |
| `deploy` | Deploy to GitHub Pages |
| `doctor` | Run handbook-doctor.ts enhanced static analyzer (12 checks) |

### H-0: Confirm Parameters

PM confirms with the user:
1. **Topic** — handbook subject
2. **Language** — primary content language (default: `ko`)
3. **Output directory** — where to create the handbook (default: `handbook/`)
4. **Companion mode** — whether to reuse co-deck pipeline caches (yes/no)

> **Dark mode**: No preference needed — auto-detect + manual toggle. All themes include 3-layer dark mode by default.

> **Companion mode cache reuse**: If companion, H-1 is skipped. The following cached outputs are reused:
> - `research_notes.md` (Research Package)
> - `assets/images/` from `image-manifest.json` (Image cache)
> - `assets/diagrams/*.svg` (Diagram cache)
> - References from `source-verification.md` (Reference cache)
> - `_versions/` snapshots (Version cache)

### H-1: Research (standalone only)

Dispatch `research` agent for web research. In companion mode, reuse cached research_notes.md.

### H-2: Propose Structure

Dispatch `handbook-writer` agent to propose section types and chapter structure based on SECTION_TYPES.md.

### H-3: Write Content

Dispatch `handbook-writer` agent to write chapter content following AUTHORING_GUIDELINES.md.

### H-4: Generate Course Materials

Dispatch `handbook-writer` agent to generate Course Overview (§14 — 9 required items) and Instructor Guide (§24 — lecture flow, expected questions, timing, frequent mistakes, demo order, evaluation criteria).

### H-5: Quality Verification

Dispatch `handbook-reviewer` agent to run:
1. `bun run handbook-doctor` — 12 static analysis checks
2. `bun run check-authoring` — 10 authoring compliance checks
3. `bun run validate-nav` — 4 navigation integrity checks
4. Apply fixes for any issues found

### H-6: Apply Theme

Theme is a **domain decision step** (not just an asset):
1. Select theme from built-in options (azure, graphite, teal, amber, indigo)
2. Run `bun run apply-theme --theme <name>`
3. Generate CSS with 3-layer dark mode
4. Update `site-search.js` DOCS array
5. Generate/update `<meta>` tags

### H-7: Security Scan + Deploy

PM runs secret scan, then deploys to GitHub Pages.

---

## Output Format

```
handbook/
├── docs/
│   ├── index.html
│   ├── chapters/
│   │   ├── chapter_01.html
│   │   ├── chapter_01_ko.html
│   │   └── ...
│   ├── course-overview.html
│   ├── instructor-guide.html
│   └── assets/
│       ├── css/handbook-theme.css
│       ├── js/site-search.js
│       ├── js/inpage-search.js
│       ├── js/dark-mode-toggle.js
│       ├── js/lang-switcher.js
│       └── images/
├── scripts/
│   ├── validate-nav.ts
│   ├── check-authoring.ts
│   ├── apply-handbook-theme.ts
│   └── handbook-doctor.ts
├── package.json
├── CHANGELOG.md
└── .github/workflows/validate-handbook.yml
```

## Related Skills

- `research` — produces `research_notes.md` (standalone mode, H-1)
- `storyline` — `slide_deck.md` consumed in companion mode (H-2)
- `theme-authoring` — theme structure follows same CSS variable convention
