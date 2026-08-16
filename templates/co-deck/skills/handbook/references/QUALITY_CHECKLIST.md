# QUALITY_CHECKLIST — Handbook Validation Reference

> Comprehensive validation checklist for handbook HTML files.
> Covers automated checks (scripts) and manual review items.
> For authoring principles (why each rule exists), see `AUTHORING_GUIDELINES.md`.
> For the complete manual pre-ship checklist, see `AUTHORING_GUIDELINES.md §A`.

---

## Automated Checks

### validate-nav (4 checks)

| # | Check | Section | Description |
|---|-------|---------|-------------|
| ① | Broken links | §21-4 | All internal `<a href>` targets resolve to existing files |
| ② | prev/next symmetry | §21-4 | A→next→B implies B→prev→A |
| ③ | Label match | §21-4 | chapter-nav labels match target title/h1 |
| ④ | Search index sync | §23-4 | 3-way validation: `search-manifest.json` ↔ actual HTML files ↔ generated `search-data.js` (v2.0.0) |

**Implementation details**: All 4 checks share `nav-utils.ts` for HTML parsing. Check ④ uses `check-search.ts` (v2.0.0) — a manifest-based 3-way validation that fails on `missing-file` (manifest → dead path), `missing-from-manifest` (primary HTML file not registered), `stale-search-data` (manifest ↔ `search-data.js` drift, both directions), and `missing-search-data` (generated file absent). Locale-variant files (`*_ko/_en/_ja/_es.html`) and `index.html` are exempt by design. Skipped entirely when `search-manifest.json` is absent. See `validation/NAV_VALIDATION.md` for the full specification including shared utilities, error conditions, and CI integration.

**Running**:
```bash
# From handbook root
bun run validate-nav

# With custom docs directory
bun scripts/validate-nav.ts --docs-dir path/to/docs
```

### check-authoring (12 checks)

| # | Check | Section | Description |
|---|-------|---------|-------------|
| 1 | Visual element | §10 | Each section has at least 1 visual (img/svg/table/code) |
| 2 | Copy buttons | §2 | Code blocks have copy buttons |
| 3 | Sidebar nav | §21-1 | All pages have sidebar navigation |
| 4 | Chapter-nav | §21-1 | Content pages have prev/next navigation |
| 5 | min-width: 0 | §11-1 | step-content has flex overflow prevention |
| 6 | No mid-word strong | §11 | No short words wrapped in `<strong>` causing line breaks |
| 7 | Course Overview items | §14 | course-overview.html has all 9 required items |
| 8 | CSS variables | §22 | No hardcoded hex colors in inline styles (the complementary allowlist for intentional inline styles lives in `check-lint.ts`) |
| 9 | Language pairs | §23 | Language variants have base file counterparts |
| 9b | Footer structure | §21-6 | Consistent per-language footer with license + repo link |
| 10 | Instructor Guide | §20 | instructor-guide.html has required sections |
| 11 | No private-repo refs | §4a | No `git clone`/link/citation points at a private repository |

### handbook-doctor (12 checks)

| # | Check | Severity | Description |
|---|-------|----------|-------------|
| 1 | Sidebar nav | error | Missing sidebar navigation |
| 2 | Chapter-nav | warn | Missing prev/next navigation |
| 3 | Broken links | error | Internal links point to non-existent files |
| 4 | Dark palette | error | No `@media (prefers-color-scheme: dark)` in theme CSS |
| 5 | Language pair | warn | Language variant without base file |
| 6 | Visual element | warn | Section without img/svg/table/code |
| 7 | Course Overview | error | Missing required items in course-overview.html |
| 8 | Instructor Guide | warn | Missing required sections in instructor-guide.html |
| 9 | Unused assets | warn | CSS/JS files not referenced in any HTML |
| 10 | Duplicate IDs | warn | Same ID used in multiple files |
| 11 | Hardcoded colors | warn | Hardcoded hex in inline styles |
| 12 | Empty title/h1 | error | Empty `<title>` or `<h1>` tags |

### check-a11y (L2 — accessibility)

| # | Check | Description |
|---|-------|-------------|
| 1 | Missing alt | `<img>` without an `alt` attribute |
| 2 | Heading hierarchy | Headings skip levels (e.g. `h1` → `h3`); hierarchy resets inside layout containers (`.compare-col`, `.schedule-body`, `.keypoints`, `.faq-item`, `.tip-box`, `.scenario-card`, …) via stack-based div tracking |
| 3 | Empty links | `<a>` with no text content or aria-label |
| 4 | Missing html lang | `<html>` without a `lang` attribute |

### check-spell (L3 — English spell check)

Scans English handbook HTML for 197 hardcoded common misspellings. Strips `<script>`, `<style>`, `<pre>`, `<code>`, and URLs before checking to avoid false positives.

### check-lint (L4 — HTML lint)

| # | Check | Description |
|---|-------|-------------|
| 1 | Inline styles | `style="..."` attributes — **allowlisted** intentional patterns pass: CSS custom properties (`var(...)`), SVG presentation attributes (`fill`/`stroke`/`font-*`/`opacity`), flexbox (`display: flex`), `grid-template-columns`, short margin/padding (< 60 chars) |
| 2 | Inline event handlers | `onclick`/`onerror`/… (XSS risk) — `copyCode(...)` calls are allowlisted |
| 3 | Deprecated tags | `<font>`, `<center>`, `<marquee>`, … |
| 4 | Duplicate IDs | Same `id` used more than once in a file |
| 5 | Empty headings | `<h1>`–`<h6>` with no content |

### check-external-links (L5 — external link checker)

Performs HTTP HEAD requests on all external `<a href>` targets with a 5s timeout and 5-request concurrency. Skips known-safe domains (creativecommons.org, github.com, claude.ai, anthropic.com) to avoid rate-limit flakes.

### validate-handbook (unified entry point)

`validate-handbook.ts` (v1.1.0) aggregates every read-only check in one command:

```bash
bun run validate-handbook --docs-dir docs                 # structure + nav + tables (default)
bun run validate-handbook --docs-dir docs --checks all    # + a11y + spell + lint + authoring + doctor
```

`--checks all` runs all 8 groups (① structure, ② nav, ③ tables, a11y, spell, lint, authoring, doctor). Exit code 1 on any failure. `runSubprocess` wraps the CLI-oriented checks (authoring, doctor) in try/catch so a missing script reports a clear error instead of crashing.

---

## CI Integration

### GitHub Actions Workflow

The scaffolded CI workflow runs on every PR:

```yaml
name: Validate Handbook
on:
  pull_request:
    branches: [main]
    paths:
      - 'handbook/docs/**'
      - 'handbook/scripts/**'

jobs:
  validate-handbook:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run validate-handbook

  validate-nav:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run validate-nav

  check-authoring:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-authoring

  handbook-doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run doctor

  check-a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-a11y

  check-spell:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-spell

  check-lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run check-lint

  build-search-index:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: cd handbook && bun install && bun run build-search-index
      - name: Verify search-data.js is up to date
        run: |
          if ! git diff --exit-code docs/assets/search-data.js; then
            echo "::error::search-data.js is out of sync with search-manifest.json. Run 'bun run build-search-index' and commit the result."
            exit 1
          fi
```

> **If you pin actions to a commit SHA instead of a tag** (common in security-conscious variants of this workflow, e.g. `uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`): **verify the SHA actually resolves before committing.** A SHA that looks plausible but is wrong in even one character fails at "resolve action" before the job runs at all — no useful error beyond `Unable to resolve action`, and (for a deploy workflow) no indication anything is wrong until someone notices the live site is stale. Verify each pin against its tag via the GitHub API rather than trusting a hash from memory or a template:
> ```bash
> gh api repos/<owner>/<action-repo>/git/refs/tags/<tag> --jq .object.sha
> ```
> Compare the result against the SHA in the workflow file — they must match exactly. Do this for every pinned action whenever the workflow file is authored or copied into a new handbook, not just the first time.

### Examples as Regression Fixtures

The `examples/` directory in the skill contains 3 reference handbook implementations:
- `examples/minimal/` — 1 chapter + index (minimum viable handbook)
- `examples/handbook/` — Manual + Chapter + Examples (standalone handbook)
- `examples/course/` — CourseOverview + InstructorGuide + chapters (full course)

These examples serve dual purpose:
1. **Learning reference** — developers can study the structure
2. **CI regression fixtures** — `check-authoring.ts --examples-dir <path>` validates that examples pass all checks on every PR

```bash
# Validate examples as regression tests
bun run check-authoring --examples-dir ../templates/co-deck/skills/handbook/examples
```

If examples fail, the check exits with code 1 and blocks the PR.

---

## Manual Review Checklist

> For the complete manual pre-ship checklist (35 items with per-section verification), see **`AUTHORING_GUIDELINES.md §A`**.
> The checklist below is a condensed summary grouped by area for quick scanning during review sessions.

### Content Quality (§1–§7)

- [ ] §1 Concept explanations include analogies and reasoning
- [ ] §2 All code blocks have copy buttons; one step = one action
- [ ] §3 Role definitions use AGENTS.md-first tool-neutral approach
- [ ] §4 Numbers/classifications match official sources
- [ ] §4a No `git clone`/link/citation points at a private repository — every source a reader is told to use must be reachable without special access
- [ ] §5 No organizational scale assumptions
- [ ] §6 No artificial time/scope constraints
- [ ] §7 Prerequisites (accounts, permissions, installations) are complete

### Technical Accuracy (§4, §9, §11)

- [ ] §4 Technical terms verified against official documentation
- [ ] §9 OS-specific commands only for genuine incompatibilities
- [ ] §9 Path expressions safe for macOS, Linux, PowerShell, CMD
- [ ] §11 No mid-word `<strong>` causing line breaks
- [ ] §11-1 flex children have `min-width: 0`
- [ ] §11-2 Fixed elements have `flex-shrink: 0`
- [ ] §11-3 No `<a>` nested inside a card's `<a class="card">`
- [ ] §11-4 `.table-schedule` used only where 3rd+ columns hold short fixed vocabulary

### Writing Style (§12, §16)

- [ ] §12-1 Formal plain register consistently
- [ ] §12-2 Technical terms: `local_term(English)` first use, English only after
- [ ] §12-2 Headings: English technical terms only, no parenthetical glosses
- [ ] §12-3 Cross-references in standard format
- [ ] §12-4 em-dash minimized

### Visual & Navigation (§8, §10, §21)

- [ ] §8 All learner-facing content is HTML (not Markdown)
- [ ] §10 Each section has at least 1 visual element
- [ ] §10-2 SVGs use `viewBox` + `width="100%"` for responsiveness
- [ ] §21 All pages have sidebar nav and chapter-nav
- [ ] §21-4 prev/next mutual symmetry verified (on renumbering)
- [ ] §21-4 New pages (any language variant) registered in `search-manifest.json` and `search-data.js` regenerated via `build-search-index.ts`
- [ ] §21-4 Body-text chapter-number cross-references match the actual current chapter list

### Course Materials (§14, §15, §20)

- [ ] §14 Course Overview has all 9 required items
- [ ] §14 Learning objectives map 1:1 to actual chapter sections
- [ ] §15-1 Last chapter has "Next Steps" section
- [ ] §20 Instructor Guide has all 6 required sections
- [ ] §20-4 Instructor Guide matches Course Overview (schedule, order, timing)

### Dark Mode (§22)

- [ ] §22 All colors use CSS variables — zero hardcoded hex
- [ ] §22 Theme CSS has `:root` (light) + `@media dark` + `.dark` (toggle)
- [ ] §22 SVGs use CSS variables or neutral colors

### Multi-Language (§23)

- [ ] §23 Language variants follow naming convention (base, base_en, base_ja, base_es)
- [ ] §23 No links to untranslated pages (§23-6)
- [ ] §23 Partial translation navigation is consistent (§23-7)

### Video References (§17)

- [ ] §17 Video links styled with `.video-refs` pattern
- [ ] §17-4 Video trust verification (5 stages) applied; all videos TRUSTWORTHY

### Final Proofreading (§19)

- [ ] §19 Read entire document: typos, awkward phrasing, numbering
- [ ] §19 Cross-references point to correct chapter/section
- [ ] §19 Logical flow between sections (no causality reversal)
