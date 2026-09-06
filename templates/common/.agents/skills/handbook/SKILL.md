---
name: handbook
scope: common
version: 0.4.0
description: >-
  Document Production Workflow — generates searchable, themed handbooks as
  static sites (GitHub Pages). Three modes: standalone handbook, lecture
  companion (reads a slide pipeline's slide_deck.md — co-deck integration),
  full course site. Responds to "make handbook", "create handbook",
  "build course site", "companion handbook" (triggered by Korean phrases too).
  H-Stage pipeline (H-0 through H-7). Independent from slide pipelines.
  Promoted from co-deck to common (2026-08-30) — usable by any variant.
status: active
owner: pm
last_reviewed: 2026-08-17
prerequisites: research (optional — standalone mode has no prerequisites)
attribution:
  source: https://github.com/beret21/teachme
  license: MIT
  note: "Inspired by beret21/teachme. Built from scratch — no original code copied."
---

## Context

Generates searchable, themed handbooks as static sites deployed to GitHub Pages.
Supports three modes:
- **Standalone**: Topic-based handbook built from scratch
- **Companion**: Reads cached slide-pipeline outputs (co-deck integration) (Research Package, Images, References, Diagrams, Versions) without re-executing the 11-Stage pipeline
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
| `companion` | Create companion handbook from an existing co-deck (slide pipeline) project |
| `course` | Create full course site with Course Overview + Instructor Guide |
| `theme` | Apply a built-in theme to existing handbook |
| `verify` | Run all validation checks (validate-handbook `--checks all` — structure, nav, tables, a11y, spell, lint, authoring, doctor) |
| `deploy` | Deploy to GitHub Pages |
| `doctor` | Run handbook-doctor.ts enhanced static analyzer (12 checks) |

### H-0: Confirm Parameters

PM confirms with the user:
1. **Topic** — handbook subject
2. **Language** — primary content language (default: `ko`)
3. **Output directory** — where to create the handbook (default: `handbook/`)
4. **Companion mode** — whether to reuse slide-pipeline caches (yes/no; co-deck only)

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

Dispatch the `handbook-writer` agent (co-deck; in other variants, dispatch docs-writer or the PM's authoring specialist) to propose section types and chapter structure based on SECTION_TYPES.md.

### H-3: Write Content

Dispatch the `handbook-writer` agent (co-deck; in other variants, dispatch docs-writer or the PM's authoring specialist) to write chapter content following AUTHORING_GUIDELINES.md.

### H-4: Generate Course Materials

Dispatch the `handbook-writer` agent (co-deck; in other variants, dispatch docs-writer or the PM's authoring specialist) to generate Course Overview (§14 — 9 required items) and Instructor Guide (§20 — lecture flow, expected questions, timing, frequent mistakes, demo order, evaluation criteria).

### H-5: Quality Verification

Dispatch the `handbook-reviewer` agent (co-deck; in other variants, dispatch docs-writer or the PM's review specialist) to run:
1. `bun run validate-handbook --checks all` — unified entry point: ① structure, ② nav (4 checks), ③ tables, a11y, spell, lint, authoring, doctor
2. `bun run check-authoring` — 12 authoring compliance checks (incl. §21-6 footer structure) — already included in `--checks all`, run standalone for `--examples-dir` regression
3. `bun run validate-nav` — 4 navigation integrity checks — already included in `--checks all`
4. `bun run check-i18n` — cross-language content parity (heading/code-block counts, wrong-language links); for multilingual handbooks follow I18N_PARITY_PLAYBOOK.md (canonical-first regeneration workflow)
5. Apply fixes for any issues found

### H-6: Apply Theme

Theme is a **domain decision step** (not just an asset):
1. Select theme from built-in options (azure, graphite, teal, amber, indigo, native)
2. Run `bun run apply-theme --theme <name>`
3. Generate CSS with 3-layer dark mode
4. Update `search-manifest.json` (register new pages), then run `bun run build-search-index --docs-dir docs` to regenerate `search-data.js` — `site-search.js` consumes the generated `SEARCH_DATA` global and is **never edited by hand**
5. Generate/update `<meta>` tags

### H-7: Security Scan + Deploy

PM runs secret scan, then deploys to GitHub Pages.

---

## Output Format

```
handbook/
├── docs/
│   ├── index.html
│   ├── search-manifest.json                # Search index SSOT ({ path, title, lang } per page)
│   ├── chapters/
│   │   ├── chapter_01.html
│   │   ├── chapter_01_ko.html
│   │   └── ...
│   ├── course-overview.html
│   ├── instructor-guide.html
│   └── assets/
│       ├── css/handbook-variables.css
│       ├── css/handbook-components.css
│       ├── js/site-search.js               # Consumes SEARCH_DATA — never edited by hand
│       ├── js/search-data.js               # AUTO-GENERATED by build-search-index.ts
│       ├── js/copy-code.js                 # Shared copy-button impl (extract-copycode.ts)
│       ├── js/inpage-search.js
│       ├── js/dark-mode-toggle.js
│       ├── js/lang-switcher.js
│       └── images/
├── scripts/
│   ├── validate-handbook.ts                # Unified validator (--checks all = 8 groups)
│   ├── build-search-index.ts               # Manifest → search-data.js generator
│   ├── validate-nav.ts
│   ├── check-authoring.ts
│   ├── check-a11y.ts / check-spell.ts / check-lint.ts / check-external-links.ts
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
