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
bun scripts/scaffold-handbook.ts --project . --output handbook --lang ko
```

This copies:
- HTML templates → `handbook/docs/`
- CSS/JS assets → `handbook/docs/assets/`
- Validation scripts → `handbook/scripts/`
- `package.json` with npm scripts
- CI workflow → `handbook/.github/workflows/`

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
3. **Follow AUTHORING_GUIDELINES.md** — all 21 sections + §22 (Dark Mode) + §23 (Multi-Language)

### Section Types
Reference `SECTION_TYPES.md` for the 6 available types:
- **Manual** — 2-column reference documentation
- **Chapter** — narrative content (720px max-width)
- **Examples** — practice exercises with A/B platform split
- **Quiz** — Q&A with model answers and rubrics
- **CourseOverview** — course introduction (§14)
- **InstructorGuide** — instructor operations guide (§24)

### Content Rules
- ALL colors via CSS variables (§22)
- At least 1 visual element per section (§10)
- Sidebar nav + chapter-nav on every page (§21)
- Plain form (`~다`) writing style (§12-1)
- Korean(English) on first use, English only thereafter (§12-2)

---

## §4: Course Overview + Instructor Guide

### Course Overview (§14)
Required for course mode. Must include all 9 items:

| # | Item | Required |
|---|------|----------|
| 1 | One-line summary | ✅ |
| 2 | Learning objectives | ✅ |
| 3 | Target audience | ✅ |
| 4 | Prerequisites | ✅ |
| 5 | Format | ✅ |
| 6 | Schedule | ✅ |
| 7 | Topics covered | ✅ |
| 8 | Post-completion outcomes | ✅ |
| 9 | Instructor information | ✅ |

### Instructor Guide (§24)
Required for course mode. Must include:

| Section | Content |
|---------|---------|
| Pre-course preparation checklist | What participants must prepare before the lecture |
| Time allocation table | Daily/chapter schedule with time allocation |
| Per-chapter instructor notes | Per-chapter: location/role, key points, participant activities, time-shortcut alternatives, irreversible operation warnings |
| Per-chapter check questions | Per-chapter: 2-3 open-ended understanding questions |
| Demo sequence | Demo sequence for live demonstrations |
| Evaluation criteria | Evaluation criteria and rubrics |

---

## §5: Quality Verification

Dispatch `handbook-reviewer` agent to run all validation checks:

```bash
# 12 static analysis checks
bun run handbook-doctor --project .

# 10 authoring compliance checks
bun run check-authoring --project . --lang ko

# 4 navigation integrity checks
bun run validate-nav --docs-dir docs
```

### Fix Cycle
1. Run all 3 tools
2. Auto-fix issues where possible
3. Re-run to verify all checks pass
4. Report unfixable issues to PM

---

## §6: Theme + Search + Meta

**Theme is a domain decision step**, not just an asset operation.

### Step 1: Select Theme
Choose from built-in themes: **azure**, **graphite**, **teal**, **amber**, **indigo**.

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
Update `assets/js/site-search.js` DOCS array to include all HTML files:
```javascript
const DOCS = [
  { path: 'index.html', title: 'Handbook Home' },
  { path: 'chapters/chapter_01.html', title: '1장 Introduction' },
  // ...
];
```

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
bun run handbook-doctor
bun run check-authoring --lang ko
bun run validate-nav

# 4. Apply theme
bun run apply-theme --theme azure

# 5. Update search index (edit docs/assets/js/site-search.js)

# 6. Deploy
cd .. && git add handbook/ && git commit -m "feat: add handbook" && git push
```
