# NAV_VALIDATION — Navigation Integrity Validation

> Specification for the 4-check navigation validation system.
> Adapted from Handbooks/multi-agent-harness-handbook/scripts/validate-nav.ts.

---

## Overview

The navigation validation system ensures handbook HTML files maintain consistent, correct inter-page navigation. Check ④ additionally keeps the manifest-driven search index (`search-manifest.json` → `search-data.js`) in sync with the actual files. It runs as a CI gate on every PR.

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

### Check ④: Search Index Sync (check-search.ts v2.0.0)

Ensures the search index is consistent across all three artifacts of the manifest-driven pipeline:

```
docs/search-manifest.json   (SSOT — { path, title, lang } per page)
        │  build-search-index.ts
        ▼
docs/assets/search-data.js  (generated — declares SEARCH_DATA.DOCS + LABELS)
        ▼
site-search.js              (consumes SEARCH_DATA at runtime — never edited by hand)
```

- **3-way validation** (all directions checked):
  - **Manifest ↔ files**: every manifest entry must resolve to an existing HTML file (`missing-file`); every primary HTML file (except `index.html`, `assets/`, and locale-variant `*_ko/_en/_ja/_es.html` files) must be registered in the manifest (`missing-from-manifest`)
  - **Manifest ↔ generated data**: every manifest entry must exist in `search-data.js` and vice versa (`stale-search-data` — drift in either direction means the index is stale and must be regenerated)
  - **Generated file present**: `search-data.js` must exist (`missing-search-data`)
- **Skipped** when `search-manifest.json` is absent — handbooks using only `inpage-search.js` have no global search index to validate
- **Error condition**: any of the above mismatch types; regenerating via `bun run build-search-index --docs-dir docs` and committing the output resolves them

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
| `parseDocsArray()` | Parse the DOCS entries from generated `search-data.js` (used by Check ④ to detect stale index data) |
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
