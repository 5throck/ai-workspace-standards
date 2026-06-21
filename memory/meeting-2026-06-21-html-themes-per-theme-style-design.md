# Design: co-deck html-themes Per-Theme Style Restructure

**Date**: 2026-06-21
**Topic**: html-themes restructure — move styles/ into themes/<name>/styles/; clarify artifact ownership
**Status**: Approved — implementation in progress

---

## Decision: Artifact Ownership

| Artifact | Location | Unit | Purpose |
|----------|----------|------|---------|
| `pdf_layout_spec.json` | `themes/<name>/` | one per **theme** | geometry, coordinates, fonts |
| `pdf_color_spec.json` | `themes/<name>/styles/<style>/` | one per **style** | color palette |
| `style.css` | `themes/<name>/styles/<style>/` | one per **style** | CSS variable overrides |
| `base.css` | `themes/<name>/styles/` | one per **theme** | shared CSS foundation |

---

## Theme Paradigms

| Theme | Paradigm | Navigation | TOC | Styles |
|-------|----------|-----------|-----|--------|
| `scroll` | All slides in DOM, vertical scroll | Scroll + TOC sidebar | Required | classic, minimal, academic |
| `slideshow` | One slide fullscreen, animated transitions | Prev/Next + arrow keys | None | classic, minimal |

`visual-heavy` style excluded — incompatible with both themes.

---

## Target Directory Structure

```
html-themes/
├── themes/
│   ├── scroll/
│   │   ├── template.html
│   │   ├── theme.json               (css_base → themes/scroll/styles/base.css)
│   │   ├── pdf_layout_spec.json     (one per theme)
│   │   └── styles/
│   │       ├── base.css
│   │       ├── classic/
│   │       │   ├── style.css
│   │       │   └── pdf_color_spec.json
│   │       ├── minimal/
│   │       │   ├── style.css
│   │       │   └── pdf_color_spec.json
│   │       └── academic/
│   │           ├── style.css
│   │           └── pdf_color_spec.json
│   └── slideshow/
│       ├── template.html
│       ├── theme.json               (css_base → themes/slideshow/styles/base.css)
│       ├── pdf_layout_spec.json     (one per theme)
│       └── styles/
│           ├── base.css
│           ├── classic/
│           │   ├── style.css
│           │   └── pdf_color_spec.json
│           └── minimal/
│               ├── style.css
│               └── pdf_color_spec.json
└── preview/
    └── preview.html                 (THEME_STYLES map for dynamic style dropdown)
```

Old `styles/` root directory at `html-themes/styles/` → **fully deleted**.

---

## 3-Layer PDF Merge

```
Layer 1 (theme)  : themes/<name>/pdf_layout_spec.json               → geometry
Layer 2 (style)  : themes/<name>/styles/<style>/pdf_color_spec.json → colors
Layer 3 (project): presentations/<project>/lecture-profile.md       → overrides
```

---

## Code Changes Required

- `gen-slides-pdf.ts` ~line 728: `styles/${style}/pdf_color_spec.json` → `themes/${theme}/styles/${style}/pdf_color_spec.json`
- `validate-theme-styles.ts`: full rewrite for per-theme path logic
- `themes/{scroll,slideshow}/theme.json`: update `css_base` field
- `variant.json` `theme_manifest`: remove `base_css` + `styles_dir` fields
- `agents/html-build.md`: CSS injection paths
- `docs/html-themes/THEMES.md`: all path references
- `docs/co-deck.context.md`: Layer 2 table, File Organization Policy
- `preview/preview.html`: THEME_STYLES dynamic dropdown

---

## Clarification History

1. Initial question: "pdf_color_spec.json는 각 theme별로 하나만 존재해야 해" → misread as theme-level
2. Correction: "pdf_layout_spec.json가 theme별로 하나이고 pdf_color_spec.json는 style 폴더별로 있는게 맞아"
3. Final: pdf_layout_spec.json = per-theme, pdf_color_spec.json = per-style ✅
