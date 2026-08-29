# BUILD_GUIDE — Handbook Production Pipeline

> Step-by-step guide for building handbooks using the H-Stage pipeline.
> This guide covers standalone, companion, and course handbook modes.

---

## §0: Parameters

Before starting the H-Stage pipeline, confirm these parameters with the user:

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| **Topic** | Handbook subject | (required) | "AI Transformation for Securities" |
| **Language** | Primary content language | `ko` | `ko`, `en`, `ja` |
| **Output directory** | Where to create the handbook | `handbook/` | `handbook/`, `docs/` |
| **Companion mode** | Reuse co-deck pipeline caches | `no` | `yes`, `no` |

> **Dark mode**: No preference needed — all themes include 3-layer dark mode by default (auto-detect + manual toggle).

> **Theme selection**: Happens at H-6 (after content is written). Available themes: azure, graphite, teal, amber, indigo.

---

## §1: Research (Standalone Only)

### Standalone Mode
Dispatch the `research` agent for web research:
- Collect authoritative sources on the handbook topic
- Produce `research_notes.md` with key facts, URLs, and summaries
- Run `source-verifier` if available (optional)

### Companion Mode
**Skip this stage entirely.** Reuse cached pipeline outputs from the existing co-deck project:

| Cache | Source | Path |
|-------|--------|------|
| Research Package | `research` agent output | `presentations/<project>/research_notes.md` |
| Image cache | `image-curator` output | `presentations/assets/images/` (from `image-manifest.json`) |
| Diagram cache | `diagram-specialist` output | `presentations/assets/diagrams/*.svg` |
| Reference cache | `source-verifier` output | `presentations/<project>/source-verification.md` |
| Version cache | `version` agent output | `presentations/<project>/_versions/` |

> Companion mode does NOT re-execute any 11-Stage pipeline agents. It only reads their cached outputs.

---

## §2: Asset Copy

### Template Copy
Run `scaffold-handbook.ts` to create the project structure:
```bash
bun scripts/scaffold-handbook.ts --project . --output handbook --lang ko \
  --title "My Handbook" --description "One-line summary" \
  --repo owner/name --chapters "Ch1,Ch2,Ch3"
```
`--title`, `--description`, `--repo`, and `--chapters` are optional — each has a sane fallback if omitted (`--repo` only affects the generated "Read the Handbook Live" link; `--chapters` only seeds the README's curriculum list).

This copies:
- HTML templates → `handbook/docs/`
- CSS/JS assets → `handbook/docs/assets/`
- Validation scripts → `handbook/scripts/` (including `deploy-handbook.ts`)
- `package.json` with npm scripts (including `deploy`, wired to `deploy-handbook.ts`)
- CI workflow → `handbook/.github/workflows/`
- `README.md` + `README_ko.md` + `LICENSE` (CC BY-NC-SA 4.0), auto-generated from `--title`/`--description`/`--repo`/`--chapters`

### Companion Mode Asset Reuse
Copy cached assets from the co-deck project:
```bash
# Images
cp -r presentations/assets/images/ handbook/docs/assets/images/

# Diagrams
cp presentations/assets/diagrams/*.svg handbook/docs/assets/images/

# References (if any)
cp presentations/<project>/source-verification.md handbook/docs/references.md
```

---

## §3: Content Writing

Dispatch `handbook-writer` agent to:
1. **Propose chapter structure** — section types per SECTION_TYPES.md, chapter count, section distribution
2. **Write chapter HTML** — each chapter as a separate HTML file following the chapter template
3. **Follow AUTHORING_GUIDELINES.md** — all sections including §22 (Dark Mode) and §23 (Multi-Language)

### Section Types
Reference `SECTION_TYPES.md` for the 6 available types:
- **Manual** — 2-column reference documentation
- **Chapter** — narrative content (720px max-width)
- **Examples** — practice exercises with A/B platform split
- **Quiz** — Q&A with model answers and rubrics
- **CourseOverview** — course introduction (§14)
- **InstructorGuide** — instructor operations guide (§20)

### Content Rules
All content rules are defined in `AUTHORING_GUIDELINES.md`. Key references:
- §10: At least 1 visual element per section
- §12: Writing style consistency (formal plain register, term glossing)
- §18: A/B platform split when implementation differs
- §21: Sidebar nav + chapter-nav on every page
- §22: ALL colors via CSS variables (no hardcoded hex)

---

## §4: Course Overview + Instructor Guide

### Course Overview (§14)
Required for course mode. See `AUTHORING_GUIDELINES.md §14` for the 9 required items (one-line summary, learning objectives, target audience, prerequisites, format, schedule, topics covered, post-completion outcomes, instructor information).

### Instructor Guide (§20)
Required for course mode. See `AUTHORING_GUIDELINES.md §20` for the 6 required sections and per-chapter note format.

---

## §5: Quality Verification

Dispatch `handbook-reviewer` agent to run all validation checks:

```bash
# Unified entry point — runs structure + navigation + tables (default)
bun run validate-handbook --docs-dir docs

# Full verification — all 8 check groups (structure, nav, tables, a11y, spell, lint, authoring, doctor)
bun run validate-handbook --docs-dir docs --checks all

# Individual check layers (each also runs standalone)
bun run check-a11y --docs-dir docs        # L2 — missing alt, heading hierarchy, empty links, html lang
bun run check-spell --docs-dir docs       # L3 — common English misspellings
bun run check-lint --docs-dir docs        # L4 — inline styles (allowlist), event handlers, deprecated tags, IDs
bun run check-external-links --docs-dir docs  # L5 — external URL reachability

# Legacy single-purpose tools (still available)
bun run handbook-doctor --project .       # 12 static analysis checks
bun run check-authoring --project . --lang ko  # 12 authoring compliance checks
bun run validate-nav --docs-dir docs      # 4 navigation integrity checks
```

### Fix Cycle
1. Run `validate-handbook --checks all` first — it aggregates every read-only check in one pass
2. Auto-fix issues where possible
3. Re-run to verify all checks pass
4. Report unfixable issues to PM

---

## §6: Theme + Search + Meta

**Theme is a domain decision step**, not just an asset operation.

### Step 1: Select Theme
Choose from built-in themes: **azure**, **graphite**, **teal**, **amber**, **indigo**, **native**.

### Step 2: Apply Theme
```bash
bun run apply-theme --project . --theme azure
```

This generates `assets/css/handbook-variables.css` with:
- `:root` — light mode variables
- `@media (prefers-color-scheme: dark)` — auto-detect dark
- `.dark` — manual toggle dark

> **CSS Architecture**: The theme system uses a 2-file split:
> - `handbook-variables.css` — Theme variables only (overwritten by `apply-handbook-theme.ts`)
> - `handbook-components.css` — Structural CSS rules (never overwritten)
>
> Both files are linked in every HTML template.

### Step 3: Generate Search Index

The search index is **manifest-driven** — `site-search.js` never holds a hand-maintained page list. The pipeline is:

```
docs/search-manifest.json   (SSOT — { path, title, lang } per page)
        │  bun run build-search-index --docs-dir docs
        ▼
docs/assets/search-data.js  (auto-generated — declares the SEARCH_DATA global)
        ▼
docs/assets/site-search.js  (consumes SEARCH_DATA at runtime)
```

**To register a new page**, edit `docs/search-manifest.json` and regenerate:

```jsonc
// docs/search-manifest.json — one entry per searchable page
{
  "pages": [
    { "path": "index.html", "title": "Handbook Home", "lang": "ko" },
    { "path": "chapters/chapter_01.html", "title": "1장 Introduction", "lang": "ko" }
    // ...
  ]
}
```

```bash
bun run build-search-index --docs-dir docs
```

- `search-data.js` is auto-generated — **never edit it by hand** (CI fails if it drifts from the manifest).
- Locale-variant files (`chapter_en.html`, `chapter_ja.html`, …) are reached via the language switcher and do **not** need manifest entries.
- If your handbook uses `inpage-search.js` instead of `site-search.js`, no manifest is required — `check-search` skips validation when the manifest is absent.

### Step 3b: Extract Shared Copy-Button Script (optional)

Handbooks that inline `copyCode()` per page can extract the shared implementation into `docs/assets/copy-code.js`:

```bash
bun run extract-copycode --docs-dir docs
```

This replaces inline `copyCode()` definitions with a `<script src="assets/copy-code.js">` reference, keeping one canonical implementation across the site.

### Step 4: Meta Tags
Ensure each HTML file has:
- `<title>` matching chapter title
- `<meta name="description">` with chapter summary
- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- `<link rel="canonical">` for language variants

---

## §7: Security Scan + Deploy

### Security Scan
Run secret detection:
```bash
# Check for accidental secrets in HTML/JS
grep -r "api_key\|password\|token\|secret" handbook/docs/
```

### Deploy to GitHub Pages
1. Push handbook/ to main branch
2. Enable GitHub Pages on the repository
3. Set source to `handbook/docs/` directory
4. Verify deployment at `https://<username>.github.io/<repo>/`

---

## Typical Workflow

```bash
# 1. Scaffold project
bun scripts/scaffold-handbook.ts --project . --output handbook --lang ko

# 2. Write content (via handbook-writer agent)

# 3. Run validation
cd handbook
bun run validate-handbook --checks all

# 4. Apply theme
bun run apply-theme --theme azure

# 5. Update search index (edit docs/search-manifest.json, then regenerate)
bun run build-search-index --docs-dir docs

# 6. Deploy
cd .. && git add handbook/ && git commit -m "feat: add handbook" && git push
```
