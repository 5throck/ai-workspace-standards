---
name: handbook
scope: common
version: 0.6.0
description: >-
  Document Production Workflow — generates searchable, themed handbooks as
  static sites (GitHub Pages). Three modes: standalone handbook, lecture
  companion (reads a slide pipeline's slide_deck.md — co-deck integration),
  full course site. Responds to "make handbook", "create handbook",
  "build course site", "companion handbook" (triggered by Korean phrases too).
  H-Stage pipeline (H-0 through H-7) for creation. M-Stage maintenance mode
  (M-1 through M-5) upgrades existing handbooks: upstream sync, chapter
  add/rename/renumber, schedule consistency. Fielded references
  (intro-to-ai-harness, multi-agent-harness-handbook) ship four languages
  (ko canonical + en/ja/es). Korean-language authoring characteristics
  (register, spacing, proofreading pass, check interplay) are first-class —
  see references/KOREAN_LANGUAGE.md. Independent from slide pipelines.
  Promoted from co-deck to common (2026-08-30) — usable by any variant.
status: active
owner: pm
last_reviewed: 2026-09-20
prerequisites: research (optional — standalone mode has no prerequisites)
metadata:
  triggers:
    - make handbook
    - create handbook
    - build course site
    - companion handbook
    - update handbook
    - handbook sync
    - handbook maintenance
attribution:
  source: https://github.com/beret21/teachme
  license: MIT
  note: "Inspired by beret21/teachme. Built from scratch — no original code copied. 2026-09-20: `add` command, strictest-Korean-proofreading, and add-only-edit safety adopted from the teachme v0.3.1 feature comparison."
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
| `add` | Extend an existing handbook in place — new chapter / quiz / appendix (routes through M-2a checklist) |
| `companion` | Create companion handbook from an existing co-deck (slide pipeline) project |
| `course` | Create full course site with Course Overview + Instructor Guide |
| `theme` | Apply a built-in theme to existing handbook |
| `verify` | Run the full validation chain — `bun run ci` (validate-handbook, symmetry, links, labels, authoring, doctor, a11y, spell, lint, external-links, search) |
| `sync-upstream` | Maintenance mode (M-Stage) — reflect upstream source changes into an existing handbook (see M-1) |
| `deploy` | Deploy to GitHub Pages |
| `doctor` | Run handbook-doctor.ts enhanced static analyzer (12 checks) |

### H-0: Confirm Parameters

PM confirms with the user:
1. **Topic** — handbook subject
2. **Language** — primary content language (default: `ko`)
3. **Output directory** — where to create the handbook (default: `handbook/`)
4. **Companion mode** — whether to reuse slide-pipeline caches (yes/no; co-deck only)

> **Dark mode**: No preference needed — auto-detect + manual toggle. All themes include 3-layer dark mode by default.

> **Korean canonical (default `ko`)**: apply references/KOREAN_LANGUAGE.md — plain declarative register (`평서체`), `순우리말`-first preference, Korean proofreading pass before ship (script checks are English-only), and the Korean structural labels that nav/search rely on.

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
1. `bun run ci` — the exact CI check chain in one command: validate-handbook (① structure, ② nav 4 checks, ③ tables), check-symmetry, check-links, check-labels, check-authoring, handbook-doctor, check-a11y, check-spell, check-lint, check-external-links, check-search. Prevents the doctor-green-but-CI-red failure mode.
2. `bun run check-i18n` — cross-language content parity (heading/code-block counts, wrong-language links); for multilingual handbooks follow I18N_PARITY_PLAYBOOK.md (canonical-first regeneration workflow)
3. Apply fixes for any issues found

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

## Maintenance Mode (M-Stage) — Existing Handbooks

For fielded handbooks (e.g. `Handbooks/intro-to-ai-harness`, `Handbooks/multi-agent-harness-handbook`).
Triggered by "update handbook", "handbook sync", `교재 업데이트`, or an upstream standards change.
Full checklists: `references/MAINTENANCE_PLAYBOOK.md`. Ground rule (adopted from teachme): maintenance is **add-and-amend only** — never delete participant-facing content or user files; supersede instead. Each M-stage ends in `bun run ci` +
`bun run check-i18n` (all 4 languages green), a CHANGELOG entry, and a PR — handbooks are
independent git repositories and land PR-only, in English.

### M-1: Upstream Sync

Reflect source-of-truth changes (e.g. `ai-workspace-standards`) into the handbook:
1. **Impact scan first** — grep the docs for every touched identifier (flag names, category counts, script names, chapter/section references) and diff against the upstream source before writing anything.
2. **Korean canonical first**, then `_en/_ja/_es` in the same commit (I18N_PARITY_PLAYBOOK rule 2).
3. Verify claimed staleness against the chapter source — update handbook facts, never copy upstream prose blindly.

### M-2: Structural Changes — Add / Rename / Renumber a Chapter

Mechanical sweep that must land together with the content (see playbook for the full list):
chapter-nav chains (prev/next symmetry), nav sidebars, `index.html` cards ×4 languages,
`search-manifest.json` + `build-search-index`, lecture guide (schedule row, instructor note,
quiz), course overview (schedule block, topics row), README curriculum, and — on renumber — a
localized number-variant sweep (`13장`/`Chapter 13`/`第13章`/`Capítulo 13`/`Ch.13`/`Ch. 13`/`13章`/`Cap.13`/`Cap. 13`, lowercase included) across hrefs, titles, SVG `<text>` labels, READMEs, and the manifest.

### M-3: Schedule Consistency

Lecture guide and course overview are two views of one schedule — keep them in lockstep
(blocks, times, totals, instructor-note order = teaching order). Recompute day/both-days totals
programmatically from the table cells; never hand-sum. Update note strings that cite times
(they drift when rows change).

### M-4: Footer Baseline

The baseline date ("ai-workspace-standards main (YYYY-MM-DD)") lives in the `FOOTERS` constant
of `scripts/update-footers.ts` — bump the constant, run the script site-wide. Never hand-edit
per-page footers; version-row values (e.g. `문서 수집일`) are page content and stay untouched.

### M-5: Verification Triage

Run `bun run ci` + `bun run check-i18n`. Before attributing a warning/failure to your change,
reproduce it on a clean tree (`git stash` → rerun → `git stash pop`) — numeric-token warns and
transient external-link timeouts (e.g. YouTube) are usually pre-existing or flaky; retry once
before diagnosing.

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
│   ├── nav-utils.ts                        # Shared HTML-parsing helpers (vendored toolkit)
│   ├── validate-handbook.ts                # Unified validator (--checks all = 8 groups)
│   ├── build-search-index.ts               # Manifest → search-data.js generator
│   ├── validate-nav.ts                     # Runs broken-links + symmetry + labels + search checks
│   ├── check-structure.ts / check-symmetry.ts / check-links.ts / check-labels.ts / check-search.ts
│   ├── check-i18n-parity.ts                # Cross-language parity gate (Check 13 of doctor)
│   ├── check-authoring.ts
│   ├── check-a11y.ts / check-spell.ts / check-lint.ts / check-external-links.ts
│   ├── apply-handbook-theme.ts
│   ├── update-footers.ts                   # FOOTERS constant = per-language site footer SSOT
│   └── handbook-doctor.ts
├── package.json                            # `bun run ci` = exact CI check chain
├── CHANGELOG.md
└── .github/workflows/validate-handbook.yml
```

> **Toolkit vendoring**: `scripts/nav-utils.ts` and the check scripts are a vendored
> toolkit shared by the fielded handbooks — fix bugs in the canonical copy
> (`Handbooks/multi-agent-harness-handbook/scripts/`) and re-vendor, never patch one
> copy only.

## Related Skills

- `research` — produces `research_notes.md` (standalone mode, H-1)
- `storyline` — `slide_deck.md` consumed in companion mode (H-2)
- `theme-authoring` — theme structure follows same CSS variable convention
- `handbook-sync-audit` — audits a handbook against its upstream source for drift

## References

- `references/MAINTENANCE_PLAYBOOK.md` — M-Stage checklists: upstream sync, add/renumber chapter sweep, schedule consistency, verification triage (2026-09-20 field incidents)
- `references/KOREAN_LANGUAGE.md` — Korean-canonical authoring: register, `순우리말`-first, spacing/typography, SVG labels, check interplay, proofreading pass, ko→out translation mappings
- `references/I18N_PARITY_PLAYBOOK.md` — canonical-first multilingual maintenance rules
- `references/AUTHORING_GUIDELINES.md`, `references/SECTION_TYPES.md`, `references/QUALITY_CHECKLIST.md`, `references/BUILD_GUIDE.md`
