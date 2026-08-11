# NAV_VALIDATION — Handbook Validation Toolkit

> Specification for the handbook validation toolkit.
> Canonical source: `scripts/co-deck/handbook/` in co-deck. The two handbook repos
> vendor their copies from here. The unified entry point is `validate-handbook.ts`.
> Navigation checks adapted from Handbooks/multi-agent-harness-handbook/scripts/validate-nav.ts;
> structure checks ported from Handbooks/intro-to-ai-harness/scripts/validate-structure.py.

---

## Unified Entry Point

`validate-handbook.ts` runs every read-only check in one command:

```bash
bun run validate-handbook --docs-dir docs                    # structure + nav + tables
bun run validate-handbook --docs-dir docs --checks all       # + authoring + doctor
```

- **① Structure** — `check-structure.ts` (always)
- **② Navigation** — `validate-nav.ts` 4 checks (always)
- **③ Tables** — `check-tables.ts` (always)
- **authoring** — `check-authoring.ts` (opt-in, co-deck guidelines convention)
- **doctor** — `handbook-doctor.ts` (opt-in, co-deck conventions)

Check ②④ (`check-search.ts`) is skipped automatically when the handbook uses
in-page search (`inpage-search.js`) instead of a global `site-search.js`.

## Structure Checks (check-structure.ts)

| # | Check | Error condition |
|---|-------|-----------------|
| ① | `<pre>` / `</pre>` balance | Unbalanced pre tags |
| ① | `.copy-btn` per `<pre>` | Code block without a copy button |
| ② | Tag nesting (stack-based) | Extra, unmatched, or mis-nested closing tags; unclosed tags at EOF. Count-based checks are NOT sufficient — an extra `</div>` paired with an extra `<div>` balances to zero yet breaks layout |
| ③ | Nested code-block | `<div class="code-block">` inside another `code-block` |
| ④ | Stray chars after closing tag | e.g. `</div>d>` |
| ⑤ | Required scripts | A script referenced by every page (e.g. `dark-mode-toggle.js`, `lang-switcher.js`) missing from a page |
| ⑥ | `lang` attribute | `<html>` without `lang="..."` |
| ⑦ | Language pairs | A `X_<lang>.html` with no base (`X.html`/`X.md`) and no sibling language variant |

## Table Checks (check-tables.ts)

| # | Rule | Violation |
|---|------|-----------|
| 1 | No `<colgroup>` / inline `<col style="width:...">` | Hand-tuned per-table ratios |
| 2 | No `col.col-*` percentage width CSS | Same |
| 3 | No `nowrap` on a table's first `td` column | Starves translatable prose columns |
| 4 | No `max-width` without a paired `width` | Collapses column to min-content |

---

## Overview

The navigation validation system ensures handbook HTML files maintain consistent, correct inter-page navigation. It runs as a CI gate on every PR.

## Checks

### Check ①: Broken Links

Verifies all internal `<a href>` targets resolve to existing files on disk.

- **Scope**: Every `.html` file in `docs/`
- **Skip**: External URLs (`http`), anchors (`#`), mailto links
- **Error condition**: href resolves to a non-existent file

### Check ②: prev/next Symmetry

Ensures bidirectional consistency of chapter navigation.

- **Rule**: If file A's `chapter-nav` has `next → B`, then file B's `chapter-nav` must have `prev → A`
- **Exceptions**: Hub files (branch divs instead of next), no-nav files (index, glossary)
- **Branch navigation**: Accepted without symmetry check (convergence points)

### Check ③: Label ↔ Target Match

Validates chapter-nav link labels match the target file's `<title>` or `<h1>`.

- **Method**: Compare chapter numbers extracted from labels and titles
- **Pattern**: Korean chapter numbers (e.g., `3장`, `8장 §1`)
- **Error condition**: Label says `3장` but target title says `5장`

### Check ④: site-search.js DOCS Sync

Ensures the `DOCS` array in `site-search.js` matches actual HTML files.

- **Bidirectional check**:
  - Every DOCS entry must point to an existing file
  - Every HTML file (except index.html and assets/) must be in DOCS
- **Error condition**: Missing in DOCS or pointing to non-existent file

## Running

```bash
# From handbook root
bun run validate-nav

# With custom docs directory
bun scripts/validate-nav.ts --docs-dir path/to/docs
```

## Implementation

All 4 checks share `nav-utils.ts` for HTML parsing:

| Utility | Purpose |
|---------|---------|
| `findAllHtmlFiles()` | Recursively find all .html files |
| `readFile()` | Read file as UTF-8 |
| `resolveHref()` | Resolve relative href to absolute path |
| `extractChapterNav()` | Extract prev/next/others from chapter-nav div |
| `extractAllLinks()` | Extract all `<a href>` targets |
| `extractTitle()` | Extract `<title>` content |
| `extractH1()` | Extract `<h1>` content |
| `parseDocsArray()` | Parse DOCS array from site-search.js |
| `getDocsDir()` | Return configured docs directory |

## CI Integration

```yaml
validate-nav:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun run validate-nav
```

Exit code 1 on any failure → PR blocked.
