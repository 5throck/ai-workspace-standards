# NAV_VALIDATION — Navigation Integrity Validation

> Specification for the 4-check navigation validation system.
> Adapted from Handbooks/multi-agent-harness-handbook/scripts/validate-nav.ts.

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
