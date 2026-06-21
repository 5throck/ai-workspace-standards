# Meeting Transcript
**Date**: 2026-06-21
**Topic**: co-deck html-themes folder structure reorganization
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

`templates/co-deck/docs/html-themes/` has accumulated structural debt:
- Style CSS files live in `overrides/<name>.css` (legacy path) while `pdf_color_spec.json` files live in `styles/<name>/` (canonical path) — the two halves of a style package are split across separate directories.
- `base/base.css` is isolated in its own folder instead of residing alongside style packages.
- THEMES.md registers `docs/html-themes/styles/base.css` as "Canonical future path" but the file does not exist on disk — registry integrity violation.
- No `styles/<name>/style.css` files exist yet, even though THEMES.md's "Adding a New Style" guide specifies this as the canonical path.

---

## Transcript

### Round 1

**[architect]**: (Round 1)

The core problem is that style assets are split across two directories. `overrides/classic.css` and `styles/classic/pdf_color_spec.json` are logically one "classic style package" but live in separate trees. THEMES.md itself acknowledges the `overrides/` path as "legacy," admitting the current state is incomplete.

Proposed target structure:

```
docs/html-themes/
├── THEMES.md
├── themes/            ← unchanged
│   ├── scroll/
│   └── slideshow/
├── styles/
│   ├── base.css       ← moved from base/base.css
│   ├── classic/
│   │   ├── style.css  ← moved from overrides/classic.css
│   │   └── pdf_color_spec.json
│   ├── minimal/
│   │   ├── style.css
│   │   └── pdf_color_spec.json
│   ├── visual-heavy/
│   │   ├── style.css
│   │   └── pdf_color_spec.json
│   └── academic/
│       ├── style.css
│       └── pdf_color_spec.json
└── preview/           ← unchanged
    └── preview.html
```

Core principle: "a style is a self-contained package." `styles/classic/` alone should contain all classic style assets (CSS + PDF color spec). `base.css` belongs at `styles/` root as the shared foundation. `overrides/` and `base/` folders are deleted.

Question to automation-engineer: how do `template.html` files currently reference `overrides/classic.css` and `base/base.css`, and does `gen-slides-pdf.ts` hardcode these paths?

---

**[automation-engineer]**: (Round 1)

Agree with architect's structure. Analyzed the impact scope:

1. **`template.html` files** (`themes/scroll/template.html`, `themes/slideshow/template.html`) — likely load CSS via `<link>` tags. However, if they use `<!-- INJECT:CSS -->` placeholders, the html-build agent injects paths at build time and template.html itself has no hardcoded references.

2. **`gen-slides-pdf.ts`** — reads `pdf_color_spec.json` at `styles/<name>/pdf_color_spec.json`. Does NOT use CSS files (PDF rendering via Playwright handles CSS). Moving CSS files has zero impact on gen-slides-pdf.ts.

3. **`preview/preview.html`** — local dev preview, likely has direct `<link>` references to `base/base.css` and `overrides/`. Highest manual update risk.

4. **THEMES.md, co-deck.context.md** — path string references, textual updates needed.

5. **`agents/html-build.md`** — if CSS injection logic references paths, update needed.

Recommendation: atomic single PR — file moves + reference updates + folder deletion in one commit to avoid broken intermediate state. Question to auditor: does `validate-templates.ts` or `audit.ts` check these paths? Could migration trigger audit failures?

---

**[auditor]**: (Round 1)

Both analyses are accurate. Audit perspective:

`audit.ts` → `validate-templates.ts` validates only `variant.json` `script_manifest.local`. CSS/HTML internal paths are not audited. Migration will not cause audit failures — but this also means the broken state went undetected.

More important finding: THEMES.md "Shared Base" table registers `docs/html-themes/styles/base.css` as "Canonical future path" but the file does NOT exist on disk. Only `base/base.css` exists. THEMES.md is registering a non-existent file — a registry integrity violation.

Risk matrix:

| Item | Risk | Notes |
|------|------|-------|
| `template.html` CSS link paths | Medium | If INJECT method: html-build handles; if direct link: manual update |
| `preview/preview.html` | High | Likely has direct relative path references |
| `gen-slides-pdf.ts` | None | Does not reference CSS paths |
| THEMES.md / co-deck.context.md | Low | Text substitution |

Agree with proposed structure and atomic PR approach. Critical prerequisite: **verify the CSS loading mechanism in `template.html` before estimating effort** — INJECT vs direct `<link>` creates significant work difference.

---

### Round 2

**[architect]**: (Round 2)

Auditor's `styles/base.css` non-existence finding is important — the migration is an opportunity to resolve this registry vs. reality mismatch.

Pre-designed two scenarios for template.html:

**Scenario A: `<!-- INJECT:CSS -->` placeholder (likely)**
- html-build agent injects CSS at build time
- Only path strings in html-build.md need updating
- template.html untouched

**Scenario B: Direct `<link>` references**
- Relative path updates needed per template: e.g., `../../base/base.css` → `../styles/base.css`
- Requires template.html edits

For `preview/preview.html`: propose keeping `preview/` folder in place (current level). Rationale: clear separation between "development tool" (preview) and "asset files" (themes/styles). Post-migration, preview.html references become cleaner: `overrides/classic.css` → `styles/classic/style.css` (more self-documenting). Asking auditor to confirm no governance issue with `preview/` staying at current level.

---

**[automation-engineer]**: (Round 2)

Architect's two-scenario design is practical. Proposing Phase 0 as a prerequisite investigation step before committing to effort estimates.

Detailed execution plan:

```
Phase 0 (Investigation, ~30 min):
  - Verify CSS loading method in themes/*/template.html
  - Enumerate all path references in preview/preview.html
  - Check gen-slides-pdf.ts for any indirect html-themes path references

Phase 1 (File moves, atomic):
  - base/base.css → styles/base.css
  - overrides/classic.css → styles/classic/style.css
  - overrides/minimal.css → styles/minimal/style.css
  - overrides/visual-heavy.css → styles/visual-heavy/style.css
  - overrides/academic.css → styles/academic/style.css
  - Delete: base/, overrides/

Phase 2 (Reference updates):
  - template.html: update if Scenario B (direct link)
  - preview/preview.html: update paths
  - THEMES.md: update all path strings + resolve styles/base.css registry entry
  - co-deck.context.md: update CSS path references
  - agents/html-build.md: update CSS injection paths

Phase 3 (Verification):
  - bun scripts/audit.ts
  - Visual check: open preview.html in browser
```

Phase 1+2 must be a single PR. Question to auditor: new ADR required, or is THEMES.md + co-deck.context.md update sufficient?

---

**[auditor]**: (Synthesis)

Synthesizing both rounds:

**Points of Agreement:**

1. **Target structure confirmed**: `styles/<name>/` self-contained package model. Each style folder has `style.css` + `pdf_color_spec.json`. `base.css` moves to `styles/base.css`. `overrides/` and `base/` folders deleted.

2. **`preview/` stays in place**: Logical separation between development tooling and asset files. No governance issue — `preview/` is not a registered asset type in THEMES.md, just a developer convenience file.

3. **Atomic single PR**: Phase 1 (file moves) and Phase 2 (reference updates) must be one commit. No broken intermediate state.

4. **Phase 0 investigation mandatory**: CSS loading mechanism in `template.html` must be confirmed before effort can be finalized.

5. **No new ADR needed**: This change completes a migration that THEMES.md already declared as the canonical path. The decision is already documented. Only THEMES.md and co-deck.context.md require updates.

**Open Questions:**
- Does `gen-slides-pdf.ts` indirectly reference CSS paths (e.g., to construct full HTML for Playwright rendering)? Confirm in Phase 0.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| R-01 | automation-engineer | Low | Phase 0 investigation: confirm CSS loading method in `themes/*/template.html` (INJECT vs direct link); enumerate `preview/preview.html` path references; check `gen-slides-pdf.ts` for indirect html-themes path references | L0-only | Next |
| M-01 | automation-engineer | Medium | Atomic migration PR: file moves (`overrides/→styles/<name>/style.css`, `base/base.css→styles/base.css`) + reference updates (THEMES.md, co-deck.context.md, html-build.md, template.html if Scenario B, preview.html) + folder deletions (`base/`, `overrides/`) | L0-only | After R-01 |
| M-02 | docs-writer | Low | THEMES.md registry integrity: resolve `styles/base.css` non-existent entry; update all path references; remove `overrides/` mentions | L0-only | With M-01 |
| N-1 | pm | Medium | Lifecycle Update (no SCRIPTS.md bump needed — template files only) | L0-only | After M-01 |
| N | pm | Medium | Final QA Audit (`bun scripts/audit.ts`) + visual verification of preview.html | L0-only | After M-01 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `overrides/` and `base/` directories no longer exist | `ls docs/html-themes/` |
| 2 | Each style folder contains both `style.css` and `pdf_color_spec.json` | `ls docs/html-themes/styles/*/` |
| 3 | `styles/base.css` exists (resolves registry integrity violation) | File existence check |
| 4 | `preview/preview.html` renders correctly with updated paths | Browser visual check |
| 5 | `bun scripts/audit.ts` passes | Exit code 0 |
| 6 | THEMES.md paths match actual file system structure | Manual diff |
