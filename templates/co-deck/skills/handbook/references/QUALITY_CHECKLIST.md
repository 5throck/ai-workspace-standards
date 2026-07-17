# QUALITY_CHECKLIST — Handbook Validation Reference

> Comprehensive validation checklist for handbook HTML files.
> Covers automated checks (scripts) and manual review items.

---

## Automated Checks

### validate-nav (4 checks)

| # | Check | Tool | Description |
|---|-------|------|-------------|
| ① | Broken links | `check-links.ts` | All internal `<a href>` targets resolve to existing files |
| ② | prev/next symmetry | `check-symmetry.ts` | A→next→B implies B→prev→A |
| ③ | Label match | `check-labels.ts` | chapter-nav labels match target title/h1 |
| ④ | DOCS sync | `check-search.ts` | site-search.js DOCS array matches actual HTML files |

### check-authoring (10 checks)

| # | Check | Section | Description |
|---|-------|---------|-------------|
| 1 | Visual element | §10 | Each section has at least 1 visual (img/svg/table/code) |
| 2 | Copy buttons | §2 | Code blocks have copy buttons |
| 3 | Sidebar nav | §21-1 | All pages have sidebar navigation |
| 4 | Chapter-nav | §21-1 | Content pages have prev/next navigation |
| 5 | min-width: 0 | §11-1 | step-content has flex overflow prevention |
| 6 | No mid-word strong | §11 | No short Korean words wrapped in `<strong>` |
| 7 | Course Overview items | §14 | course-overview.html has all 9 required items |
| 8 | CSS variables | §22 | No hardcoded hex colors in inline styles |
| 9 | Language pairs | §23 | Language variants have base file counterparts |
| 10 | Instructor Guide | §24 | instructor-guide.html has required sections |

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
```

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

## Manual Review Checklist (Appendix A)

### Content Quality (§1-§7)

- [ ] §1 Concept explanations include analogies and reasoning
- [ ] §2 All code blocks have copy buttons; one step = one action
- [ ] §3 Role definitions use AGENTS.md-first tool-neutral approach
- [ ] §4 Numbers/classifications match official sources
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

### Writing Style (§12, §16)

- [ ] §12-1 Plain form (`~다`) consistently
- [ ] §12-2 English terms: Korean(English) first use, English only after
- [ ] §12-2 `<title>`, `<h1>`, nav labels: English only (no Korean, no parenthetical)
- [ ] §12-3 Cross-references: `N장 §M` format
- [ ] §12-4 em-dash minimized

### Visual & Navigation (§8, §10, §21)

- [ ] §8 All learner-facing content is HTML (not Markdown)
- [ ] §10 Each section has at least 1 visual element
- [ ] §10-2 SVGs use `viewBox` + `width="100%"` for responsiveness
- [ ] §21-1 All pages have sidebar nav
- [ ] §21-1 Content pages have chapter-nav
- [ ] §21-2 Index page grouped by day/type with instructor materials section
- [ ] §21-4 prev/next mutual symmetry verified

### Course Materials (§14, §15, §20)

- [ ] §14 Course Overview has all 9 required items
- [ ] §14 Learning objectives map 1:1 to actual chapter sections
- [ ] §15-1 Last chapter has "Next Steps" section
- [ ] §20 Instructor Guide has 4 required sections
- [ ] §20-2 Instructor Guide matches Course Overview (schedule, order, timing)

### Dark Mode (§22)

- [ ] §22 All colors use CSS variables — zero hardcoded hex
- [ ] §22 Theme CSS has `:root` (light) + `@media dark` + `.dark` (toggle)
- [ ] §22 Dark toggle JS loaded and functional
- [ ] §22 SVGs use CSS variables or neutral colors

### Multi-Language (§23)

- [ ] §23 Language variants follow naming convention (base, base_ko, base_en)
- [ ] §23 Language switcher dropdown present in header
- [ ] §23 All language variants have matching structure
- [ ] §23 Language preference stored in localStorage

### Final Proofreading (§19)

- [ ] §19 Read entire document checking: typos, awkward phrasing, numbering
- [ ] §19 Check cross-references point to correct chapter/section
- [ ] §19 Verify logical flow between sections (no causality reversal)
