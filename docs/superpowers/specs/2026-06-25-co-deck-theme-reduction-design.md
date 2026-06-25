# Design Spec: co-deck Theme Reduction

**Date**: 2026-06-25
**Status**: Approved
**Author**: PM Agent
**Variant**: co-deck
**Scope**: templates/co-deck/

---

## 1. Objective

Remove 3 low-usage HTML themes (`notebook`, `scroll`, `slideshow`) from the co-deck variant to simplify the theme ecosystem, reduce maintenance burden, and consolidate rendering paradigms.

## 2. Background

The co-deck variant currently ships 8 HTML themes, all marked `active`. Analysis revealed no existing presentation decks use these themes, and several themes overlap in rendering paradigm:

- `notebook` (PPT Outline View) overlaps with `outline` (Research Notebook)
- `scroll` (PPT Reading View) overlaps with `vertical` (True Vertical Scroll)
- `slideshow` (PPT Presentation View) overlaps with `zen` (Presentation Zen)

The `scroll` theme is currently the global default across all scripts, agents, and documentation.

## 3. Decision

### 3.1 Themes to Remove

| Theme | Version | Removal Rationale |
|-------|---------|-------------------|
| `notebook` | 3.0.0 | `outline` provides equivalent PPT-Engine rendering paradigm |
| `scroll` | 3.0.0 | `vertical` provides equivalent scroll-based paradigm |
| `slideshow` | 3.0.0 | `zen` provides equivalent fullscreen stacked paradigm |

### 3.2 Remaining Themes (5)

| Theme | Version | Role |
|-------|---------|------|
| `outline` | 3.0.0 | Research Notebook (PPT Outline View) |
| `pitch` | 1.0.0 | Floating card (preserved unchanged) |
| `pitch-enhanced` | 3.0.0 | PPT Presenter View (hybrid) |
| `vertical` | 3.0.0 | True Vertical Scroll |
| `zen` | 3.0.0 | Presentation Zen |

### 3.3 New Default Theme

**`pitch-enhanced`** replaces `scroll` as the global default.

Rationale:
- Most feature-rich PPT-engine hybrid theme
- Combines pitch UI aesthetics with ppt-engine runtime
- Already included in `STACKED_THEMES` set in preview.html
- Active development (v3.0.0, unlike `pitch` at v1.0.0)

## 4. Approach: Hard Delete + Batch Update

Single-pass removal of theme directories and all references. No deprecation intermediate step — no existing decks depend on these themes.

## 5. Change Specification

### 5.1 Delete Theme Directories (3 directories, 12 files)

```
templates/co-deck/docs/html-themes/themes/notebook/
  ├── template.html
  ├── theme.json
  ├── theme.css
  └── pdf_layout_spec.json

templates/co-deck/docs/html-themes/themes/scroll/
  ├── template.html
  ├── theme.json
  ├── theme.css
  └── pdf_layout_spec.json

templates/co-deck/docs/html-themes/themes/slideshow/
  ├── template.html
  ├── theme.json
  ├── theme.css
  └── pdf_layout_spec.json
```

### 5.2 Shared Infrastructure — No Removal

All `_shared/` files are retained. Remaining 5 themes (`outline`, `pitch-enhanced`, `zen`, `vertical`) plus `pitch` (which uses its own rendering) continue to depend on:

| File | Retained Because |
|------|-----------------|
| `_shared/layout_base.json` | Universal Layer 0 merge base for all themes |
| `_shared/ppt-engine.css` | Used by all PPT-engine themes (outline, pitch-enhanced, zen, vertical) |
| `_shared/ppt-engine.js` | Used by all PPT-engine themes |

`ppt-engine.css` line 500-501 comment mentioning "scroll/slideshow/notebook" should be updated to reflect remaining themes.

### 5.3 Script Default Value Changes (3 files)

| File | Change |
|------|--------|
| `scripts/co-deck/auto-calibrate.ts` | `profile.theme || 'scroll'` → `profile.theme || 'pitch-enhanced'` |
| `scripts/co-deck/estimate-layout.ts` | `profile.theme || 'scroll'` → `profile.theme || 'pitch-enhanced'` |
| `scripts/co-deck/gen-slides-pdf.ts` | 4 occurrences of `'scroll'` fallback → `'pitch-enhanced'` |

### 5.4 Documentation & Config Updates (10 files)

| File | Updates Required |
|------|-----------------|
| `docs/html-themes/THEMES.md` | Remove 3 rows from Themes table; remove 3 columns from Compatibility Matrix; update "PPT Transformed Themes (v3.0.0)" section; update `image_zones`/`toc` docs; update Directory Structure section |
| `docs/co-deck.context.md` | Remove 3 rows from Theme table; remove 3 columns from Compatibility Matrix; rewrite "Theme Architecture — Two Families" section (PPT-Engine Family reduced to pitch-enhanced only); update Domain Rule #12; update Content Rules; update version note |
| `docs/lecture-profile.md` | Remove `notebook`, `scroll`, `slideshow` from theme options; change default from `scroll` to `pitch-enhanced`; update layout_overrides comment |
| `agents/html-build.md` | Update CSS injection example theme; update PPT-engine theme lists; update data-type vocabulary references; change default theme to `pitch-enhanced`; update bullet density rules |
| `skills/html-build/SKILL.md` | Update available themes list; update defaults to `pitch-enhanced`; update theme capabilities section |
| `skills/theme-authoring/SKILL.md` | Remove "add slideshow theme" trigger example; change preview link from `?theme=scroll`; update reference themes |
| `docs/designs/2026-06-24-pitch-enhanced-ux-diagram-path-unification-design.md` | Remove scroll/notebook/slideshow template file references (historical design doc) |
| `README.md` | Update theme count and list in description |
| `AGENTS.md` | Update preview link example |
| `variant.json` | Update description theme count/list; update `theme_manifest.notes` |

### 5.5 Auto-Regeneration (1 file)

| File | Action |
|------|--------|
| `docs/html-themes/preview/themes-manifest.js` | Regenerate via `bun scripts/co-deck/generate-themes-manifest.ts` |

## 6. Execution Order

1. Delete 3 theme directories
2. Update script default values (3 files)
3. Clean up `_shared/ppt-engine.css` comment (1 file)
4. Update documentation, agents, skills, config (10 files)
5. Regenerate `themes-manifest.js`
6. Run audit (`bun scripts/audit.ts`) to verify consistency
7. Commit changes

## 7. Non-Goals

- No deprecation period (no existing decks depend on these themes)
- No style changes (styles are independent of themes)
- No `_shared/` infrastructure changes (beyond comment cleanup)
- No changes to `templates/common/` (themes are co-deck-specific)
- No changes to workspace root scripts or docs

## 8. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing user decks specifying removed themes | Low | No decks found in workspace; build scripts fall back to new default |
| Documentation inconsistencies after update | Medium | Audit script catches stale references |
| Preview tool regression | Low | `themes-manifest.js` auto-regeneration handles discovery |
