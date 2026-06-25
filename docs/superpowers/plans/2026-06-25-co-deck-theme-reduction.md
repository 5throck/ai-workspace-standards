# co-deck Theme Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 3 low-usage HTML themes (notebook, scroll, slideshow) from the co-deck variant, set pitch-enhanced as the new default theme, and update all references.

**Architecture:** Hard delete approach — remove theme directories and batch-update all documentation, agent, skill, script, and config files in a single pass. No deprecation period needed as no existing decks depend on these themes.

**Tech Stack:** Markdown, TypeScript (Bun runtime), CSS, JSON

**Design Spec:** `docs/superpowers/specs/2026-06-25-co-deck-theme-reduction-design.md`

---

### Task 1: Delete Theme Directories

**Files:**
- Delete: `templates/co-deck/docs/html-themes/themes/notebook/` (4 files: template.html, theme.json, theme.css, pdf_layout_spec.json)
- Delete: `templates/co-deck/docs/html-themes/themes/scroll/` (4 files: template.html, theme.json, theme.css, pdf_layout_spec.json)
- Delete: `templates/co-deck/docs/html-themes/themes/slideshow/` (4 files: template.html, theme.json, theme.css, pdf_layout_spec.json)

- [ ] **Step 1: Delete the three theme directories**

```bash
rm -rf templates/co-deck/docs/html-themes/themes/notebook
rm -rf templates/co-deck/docs/html-themes/themes/scroll
rm -rf templates/co-deck/docs/html-themes/themes/slideshow
```

- [ ] **Step 2: Verify deletion**

```bash
ls templates/co-deck/docs/html-themes/themes/
```

Expected: Only `_shared`, `outline`, `pitch`, `pitch-enhanced`, `vertical`, `zen` remain.

- [ ] **Step 3: Commit**

```bash
git add -A templates/co-deck/docs/html-themes/themes/
git commit -m "chore(co-deck): remove notebook, scroll, slideshow theme directories"
```

---

### Task 2: Update Script Default Values

**Files:**
- Modify: `templates/co-deck/scripts/co-deck/auto-calibrate.ts:338`
- Modify: `templates/co-deck/scripts/co-deck/estimate-layout.ts:362`
- Modify: `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts:1108,1111,1270`

- [ ] **Step 1: Update auto-calibrate.ts fallback**

In `templates/co-deck/scripts/co-deck/auto-calibrate.ts`, change:
```typescript
const theme = profile.theme ?? 'scroll';
```
to:
```typescript
const theme = profile.theme ?? 'pitch-enhanced';
```

- [ ] **Step 2: Update estimate-layout.ts fallback**

In `templates/co-deck/scripts/co-deck/estimate-layout.ts`, change:
```typescript
const theme = profile.theme ?? 'scroll';
```
to:
```typescript
const theme = profile.theme ?? 'pitch-enhanced';
```

- [ ] **Step 3: Update gen-slides-pdf.ts fallbacks (3 occurrences)**

In `templates/co-deck/scripts/co-deck/gen-slides-pdf.ts`, change all 3 occurrences:
```typescript
// Occurrence 1 (line ~1108): initial declaration
let theme = 'scroll', style = 'premium-dark';
// →
let theme = 'pitch-enhanced', style = 'premium-dark';

// Occurrence 2 (line ~1111): fallback
theme = profile.theme ?? 'scroll';
// →
theme = profile.theme ?? 'pitch-enhanced';

// Occurrence 3 (line ~1270): main entry fallback
const theme = lectureProfile.theme ?? 'scroll';
// →
const theme = lectureProfile.theme ?? 'pitch-enhanced';
```

- [ ] **Step 4: Generalize scroll-specific comments in gen-slides-pdf.ts**

Two comments reference "scroll" as the pre-rewrite baseline. Generalize them:

Line ~623 comment: Change `"scroll also declares "header"` → `"PPT themes with a header region"`

Line ~1055 comment: Change `"so scroll rendering is preserved bit-for-bit"` → `"so pre-rewrite rendering is preserved bit-for-bit"`

- [ ] **Step 5: Commit**

```bash
git add templates/co-deck/scripts/co-deck/
git commit -m "feat(co-deck): change default theme fallback from scroll to pitch-enhanced"
```

---

### Task 3: Clean Up _shared/ppt-engine.css Comment

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css:496-504`

- [ ] **Step 1: Update the responsive scaling comment**

In `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css`, change the comment block around lines 496-504 from:
```css
/* ── Neutralize base.css responsive scaling for PPT themes ───────────
   base.css applies transform: scale(calc(100vw / 1280)) on .slide at
   ≤1340px for scroll/slideshow/notebook viewport-based layouts.
   PPT themes use percentage-based sizing + position:absolute so this
   scaling double-applies (ppt-engine already positions slides via
   top/left/translate), causing double-scale and broken transitions.  */
```
to:
```css
/* ── Neutralize base.css responsive scaling for PPT themes ───────────
   base.css applies transform: scale(calc(100vw / 1280)) on .slide at
   ≤1340px for viewport-based layouts.
   PPT themes (outline, pitch-enhanced, zen, vertical) use
   percentage-based sizing + position:absolute so this scaling
   double-applies (ppt-engine already positions slides via
   top/left/translate), causing double-scale and broken transitions.  */
```

- [ ] **Step 2: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css
git commit -m "docs(co-deck): update ppt-engine.css comment to reflect remaining PPT themes"
```

---

### Task 4: Update THEMES.md (Authoritative Theme Registry)

**Files:**
- Modify: `templates/co-deck/docs/html-themes/THEMES.md`

- [ ] **Step 1: Remove 3 theme rows from the Themes table (lines ~15, 19-20)**

Remove the rows for `notebook`, `scroll`, and `slideshow` from the Themes table. The table should contain only 5 themes:
```
| `outline` | 3.0.0 | active | Research Notebook |
| `pitch` | 1.0.0 | active | Floating card — preserved unchanged |
| `pitch-enhanced` | 3.0.0 | active | PPT Presenter View (hybrid) |
| `vertical` | 3.0.0 | active | True Vertical Scroll |
| `zen` | 3.0.0 | active | Presentation Zen |
```

- [ ] **Step 2: Update the css_theme example (line ~35)**

Change any example path referencing `scroll/theme.css` to reference `pitch-enhanced/theme.css`:
```markdown
"css_theme": "themes/pitch-enhanced/theme.css"
```

- [ ] **Step 3: Update "PPT Transformed Themes (v3.0.0)" section (lines ~41-55)**

Remove `notebook`, `scroll`, `slideshow` from the list. The section should describe that `pitch-enhanced`, `outline`, `zen`, and `vertical` share `ppt-engine.css`/`ppt-engine.js`. Rewrite to reflect that the PPT-engine family now consists of `outline`, `pitch-enhanced`, `zen`, and `vertical`.

- [ ] **Step 4: Remove 3 columns from the Compatibility Matrix (lines ~145-153)**

Remove the `notebook`, `scroll`, and `slideshow` columns from the Compatibility Matrix table.

- [ ] **Step 5: Update `visual-heavy` partial comment (line ~155)**

Change from listing `notebook, scroll, slideshow, pitch-enhanced` to listing `outline, pitch-enhanced, zen, vertical`.

- [ ] **Step 6: Update `image_zones` and `toc` doc sections (lines ~114, 117)**

Remove any specific references to `scroll` or `slideshow` behavior in `image_zones` and `toc` documentation sections.

- [ ] **Step 7: Update Directory Structure section (lines ~276-284)**

Remove `notebook/`, `scroll/`, `slideshow/` from the directory tree listing.

- [ ] **Step 8: Commit**

```bash
git add templates/co-deck/docs/html-themes/THEMES.md
git commit -m "docs(co-deck): update THEMES.md — remove notebook/scroll/slideshow, 5 themes remaining"
```

---

### Task 5: Update co-deck.context.md (Variant Context)

**Files:**
- Modify: `templates/co-deck/docs/co-deck.context.md`

- [ ] **Step 1: Remove 3 theme rows from the Theme table**

Remove `notebook`, `scroll`, `slideshow` rows from the Theme table.

- [ ] **Step 2: Update "PPT Transformed Themes (v3.0.0)" section**

Rewrite to list `outline`, `pitch-enhanced`, `zen`, `vertical` as the PPT-engine family.

- [ ] **Step 3: Rewrite "Theme Architecture — Two Families" table**

The PPT-Engine Family row currently lists `scroll, notebook, slideshow`. Update to list `outline, pitch-enhanced, zen, vertical`. Note: The "Pitch Family" (pitch, pitch-enhanced) description may need updating since `pitch-enhanced` is now the only PPT hybrid — clarify that `pitch` is native DOM vocabulary while `pitch-enhanced` uses ppt-engine runtime.

- [ ] **Step 4: Remove 3 columns from Compatibility Matrix**

Remove `notebook`, `scroll`, `slideshow` columns.

- [ ] **Step 5: Update `visual-heavy` partial note**

Change the theme list from `notebook, scroll, slideshow, pitch-enhanced` to `outline, pitch-enhanced, zen, vertical`.

- [ ] **Step 6: Update Content Rules references (line ~407)**

Replace "scroll theme" and "slideshow" defaults with "pitch-enhanced" references.

- [ ] **Step 7: Update Domain Rule #12 (line ~522)**

Remove `scroll`, `slideshow`, `notebook` from the rule text.

- [ ] **Step 8: Commit**

```bash
git add templates/co-deck/docs/co-deck.context.md
git commit -m "docs(co-deck): update co-deck.context.md — remove 3 themes, update two-families architecture"
```

---

### Task 6: Update lecture-profile.md (Template)

**Files:**
- Modify: `templates/co-deck/docs/lecture-profile.md`

- [ ] **Step 1: Update theme options list (lines ~41)**

Change from:
```
#   notebook | outline | pitch | pitch-enhanced | scroll | slideshow | vertical | zen
```
to:
```
#   outline | pitch | pitch-enhanced | vertical | zen
```

- [ ] **Step 2: Remove comments for deleted themes (lines ~42, 46, 47)**

Remove descriptive comments for `notebook`, `scroll`, `slideshow`.

- [ ] **Step 3: Change default theme (line ~59)**

Change from:
```
theme: scroll
```
to:
```
theme: pitch-enhanced
```

- [ ] **Step 4: Update layout_overrides comment (line ~176)**

Remove any `scroll`/`slideshow`/`notebook` references in the layout_overrides section.

- [ ] **Step 5: Commit**

```bash
git add templates/co-deck/docs/lecture-profile.md
git commit -m "docs(co-deck): update lecture-profile.md — 5 themes, pitch-enhanced default"
```

---

### Task 7: Update agents/html-build.md

**Files:**
- Modify: `templates/co-deck/agents/html-build.md`

- [ ] **Step 1: Update CSS injection example (line ~77)**

Change `data-theme="scroll"` to `data-theme="pitch-enhanced"` in the example HTML.

- [ ] **Step 2: Update PPT-engine theme lists (lines ~83, 85, 88, 92)**

Remove `notebook`, `scroll`, `slideshow` from all PPT-engine theme lists. Update to: `outline, pitch-enhanced, zen, vertical`.

- [ ] **Step 3: Update example path (line ~85)**

Change `themes/scroll/theme.css` to `themes/pitch-enhanced/theme.css`.

- [ ] **Step 4: Update data-type vocabulary (lines ~103)**

Remove notebook/scroll/slideshow-specific data-type notes. Generalize for remaining themes.

- [ ] **Step 5: Update default theme (line ~116)**

Change from `scroll` to `pitch-enhanced`.

- [ ] **Step 6: Update bullet density rules (line ~117)**

Remove `scroll <= 5, slideshow <= 4` specific rules. Apply general density guideline.

- [ ] **Step 7: Update available themes list (line ~107)**

Change from `notebook | outline | pitch | pitch-enhanced | scroll | slideshow | vertical | zen` to `outline | pitch | pitch-enhanced | vertical | zen`.

- [ ] **Step 8: Commit**

```bash
git add templates/co-deck/agents/html-build.md
git commit -m "docs(co-deck): update html-build agent — 5 themes, pitch-enhanced default"
```

---

### Task 8: Update skills/html-build/SKILL.md

**Files:**
- Modify: `templates/co-deck/skills/html-build/SKILL.md`

- [ ] **Step 1: Update example HTML (line ~84)**

Change `data-theme="scroll"` to `data-theme="pitch-enhanced"`.

- [ ] **Step 2: Update available themes list (line ~88)**

Change from `notebook | pitch | pitch-enhanced | scroll | slideshow` to `outline | pitch | pitch-enhanced | vertical | zen`. Also fix the existing omission of `outline`, `vertical`, `zen`.

- [ ] **Step 3: Update theme capabilities section (lines ~93-94)**

Remove references to `notebook`, `scroll`, `slideshow` capabilities. Update PPT-engine theme list.

- [ ] **Step 4: Update defaults**

Change default from `scroll + premium-dark` to `pitch-enhanced + premium-dark`.

- [ ] **Step 5: Commit**

```bash
git add templates/co-deck/skills/html-build/SKILL.md
git commit -m "docs(co-deck): update html-build skill — 5 themes, pitch-enhanced default"
```

---

### Task 9: Update skills/theme-authoring/SKILL.md

**Files:**
- Modify: `templates/co-deck/skills/theme-authoring/SKILL.md`

- [ ] **Step 1: Remove "add slideshow theme" trigger example (line ~8)**

Remove or replace the "add slideshow theme" trigger phrase example with a more generic example (e.g., "add zen theme").

- [ ] **Step 2: Update preview link example (line ~59)**

Change from `?theme=scroll&style=<name>` to `?theme=pitch-enhanced&style=<name>`.

- [ ] **Step 3: Update reference themes (lines ~76, 191-192)**

Replace `themes/scroll/` and `themes/slideshow/` references with `themes/pitch-enhanced/` and `themes/zen/` as reference implementations.

- [ ] **Step 4: Generalize paradigm examples (line ~76)**

Update rendering paradigm description to reference remaining themes.

- [ ] **Step 5: Commit**

```bash
git add templates/co-deck/skills/theme-authoring/SKILL.md
git commit -m "docs(co-deck): update theme-authoring skill — remove slideshow/scroll references"
```

---

### Task 10: Update Historical Design Doc

**Files:**
- Modify: `templates/co-deck/docs/designs/2026-06-24-pitch-enhanced-ux-diagram-path-unification-design.md`

- [ ] **Step 1: Remove scroll/notebook/slideshow template file references (lines ~21, 28-30)**

Remove or generalize references to `themes/scroll/template.html`, `themes/notebook/template.html`, and `themes/slideshow/template.html` in the UX design document. Since this is a historical design doc describing changes to pitch-enhanced, the references to other PPT themes for context can be generalized to "other PPT-engine themes" or removed entirely.

- [ ] **Step 2: Commit**

```bash
git add templates/co-deck/docs/designs/2026-06-24-pitch-enhanced-ux-diagram-path-unification-design.md
git commit -m "docs(co-deck): update historical design doc — remove deleted theme references"
```

---

### Task 11: Update README.md, AGENTS.md, variant.json

**Files:**
- Modify: `templates/co-deck/README.md:67`
- Modify: `templates/co-deck/AGENTS.md:495`
- Modify: `templates/co-deck/variant.json:3,77`

- [ ] **Step 1: Update README.md theme count and list**

Change from `"4 themes (notebook, pitch, scroll, slideshow)"` to `"5 themes (outline, pitch, pitch-enhanced, vertical, zen)"`.

- [ ] **Step 2: Update AGENTS.md preview link**

Change the preview link example from `?theme=scroll` to `?theme=pitch-enhanced`.

- [ ] **Step 3: Update variant.json description**

Change `"4 themes (notebook, pitch, scroll, slideshow)"` to `"5 themes (outline, pitch, pitch-enhanced, vertical, zen)"`.

- [ ] **Step 4: Update variant.json theme_manifest.notes**

Change `"PPT-transformed themes (notebook/scroll/slideshow/pitch-enhanced v2.0.0)"` to reflect current state: `"PPT-engine themes (outline/pitch-enhanced/zen/vertical v3.0.0)"`.

- [ ] **Step 5: Commit**

```bash
git add templates/co-deck/README.md templates/co-deck/AGENTS.md templates/co-deck/variant.json
git commit -m "docs(co-deck): update README, AGENTS, variant.json — 5 themes, correct counts"
```

---

### Task 12: Regenerate themes-manifest.js

**Files:**
- Regenerate: `templates/co-deck/docs/html-themes/preview/themes-manifest.js`

- [ ] **Step 1: Run manifest generator**

```bash
bun templates/co-deck/scripts/co-deck/generate-themes-manifest.ts
```

- [ ] **Step 2: Verify the manifest no longer contains notebook/scroll/slideshow entries**

Read the generated file and confirm only 5 themes (outline, pitch, pitch-enhanced, vertical, zen) are listed.

- [ ] **Step 3: Commit**

```bash
git add templates/co-deck/docs/html-themes/preview/themes-manifest.js
git commit -m "chore(co-deck): regenerate themes-manifest.js for 5 remaining themes"
```

---

### Task 13: Final QA Audit

- [ ] **Step 1: Run workspace audit**

```bash
bun scripts/audit.ts
```

Expected: Pass without errors related to deleted themes.

- [ ] **Step 2: Search for stale references**

```bash
rg -i "notebook|scroll|slideshow" templates/co-deck/ --type md --type ts --type css --type json
```

Expected: Zero results (excluding the design spec file itself and any git history). Fix any remaining references.

- [ ] **Step 3: Verify remaining theme directories**

```bash
ls templates/co-deck/docs/html-themes/themes/
```

Expected: `_shared`, `outline`, `pitch`, `pitch-enhanced`, `vertical`, `zen`

---

### Task N-1: Lifecycle Update

- [ ] **Step 1: Run lifecycle finalization**

Update version timestamp in `variant.json` and any affected governance docs.

---

### Task N: Create PR via /sync

- [ ] **Step 1: Invoke /sync to create PR**

Use the `/sync` skill to create a PR with the following type description:
```
refactor(co-deck): remove notebook, scroll, slideshow themes; pitch-enhanced new default
```
