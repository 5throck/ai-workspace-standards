# Theme & Style Registry

> **Authoritative registry** for all co-deck themes and styles.
> Every new theme or style MUST be registered here before use.
> Follow the SKILLS.md pattern: one row per entry, with version and status.

---

## Themes

A **theme** is a rendering paradigm package of **3 files**: HTML skeleton (`template.html`) + metadata/content-rules (`theme.json`) + PDF layout specification (`pdf_layout_spec.json`).

| Name | Version | Status | Paradigm | Navigation | TOC | Compatible Styles | Folder |
|------|---------|--------|----------|-----------|-----|-------------------|--------|
| `scroll` | 1.0.0 | active | Vertical scroll — all slides in DOM | Scroll + TOC panel | Required | classic, minimal, academic | `themes/scroll/` |
| `slideshow` | 1.0.0 | active | Fullscreen single-slide, animated transitions | Prev/Next + arrow keys | None | classic, minimal | `themes/slideshow/` |

### Theme Package Files

Each theme folder contains:

| File | Required | Purpose |
|------|----------|---------|
| `template.html` | ✅ | HTML skeleton with `<!-- INJECT:CSS -->`, `<!-- INJECT:slideData -->`, `<!-- INJECT:slides -->` placeholders |
| `theme.json` | ✅ | `content_rules`, `compatible_styles`, `recommended_structure`, `toc_required`, `slide_types` |
| `pdf_layout_spec.json` | ✅ | PDF geometry (`page`), calibration (`viewport_px`), layout percentages, font sizes, `slide_types` |

### `pdf_layout_spec.json` Schema

```json
{
  "version": "1.0.0",
  "page": { "width_mm": 338.7, "height_mm": 190.5, "margin_mm": 5.0, "aspect_ratio": "16:9" },
  "calibration": { "viewport_px": 611.4 },
  "layout": { "pad_x_pct": 0.0438, "header_y_pct": 0.091, "..." : "..." },
  "fonts": { "title_pt": 28.0, "bullet_pt": 12.5, "..." : "..." },
  "line_heights": { "title_px": 46.0, "..." : "..." },
  "slide_types": { "title": true, "divider": true, "punchline": false, "standard": true }
}
```

**Mandatory fields**: `page`, `calibration.viewport_px`, `layout.*`, `fonts.title_pt`, `fonts.bullet_pt`
**Optional fields**: other `fonts.*`, `line_heights.*` (script falls back to built-in defaults if absent)
**`slide_types`**: declares which slide types this theme supports — read by Storyline agent at Stage 2

### `theme.json` `slide_types` Field

```json
"slide_types": {
  "title":    true,
  "divider":  true,   // scroll only
  "punchline": false, // slideshow only
  "standard": true
}
```

### Compatibility Matrix

| Style ↓ / Theme → | `scroll` | `slideshow` |
|-------------------|----------|-------------|
| `classic` | ✅ | ✅ |
| `minimal` | ✅ | ✅ |
| `visual-heavy` | ⚠️ partial | ❌ incompatible |
| `academic` | ✅ | ❌ incompatible |

**Legend**: ✅ Fully compatible · ⚠️ Partial (see theme.json notes) · ❌ Incompatible

---

## Styles

A **style** is a rendering appearance package of **2 files**: CSS variable overrides (`style.css`) + PDF color specification (`pdf_color_spec.json`).

A **style** controls color, font, and spacing via `styles/base.css` (shared foundation) + `styles/<name>/style.css` (visual overrides).

| Name | Version | Status | CSS File | PDF Color Spec | Best For | Image Panel |
|------|---------|--------|----------|----------------|---------|-------------|
| `classic` | 1.0.0 | active | `docs/html-themes/overrides/classic.css` | `styles/classic/pdf_color_spec.json` | General purpose (default) | 45% right panel |
| `minimal` | 1.0.0 | active | `docs/html-themes/overrides/minimal.css` | `styles/minimal/pdf_color_spec.json` | Text-heavy lectures | None |
| `visual-heavy` | 1.0.0 | active | `docs/html-themes/overrides/visual-heavy.css` | `styles/visual-heavy/pdf_color_spec.json` | Visual storytelling | Full-bleed background |
| `academic` | 1.0.0 | active | `docs/html-themes/overrides/academic.css` | `styles/academic/pdf_color_spec.json` | Research / thesis | 30% illustration panel |

> **Note on CSS file paths**: Current style CSS files live in `overrides/` (legacy path). New styles should be created under `styles/<name>/style.css`. Migration of existing styles is deferred until all HTML file references are updated.

### `pdf_color_spec.json` Schema

```json
{
  "version": "1.0.0",
  "colors": {
    "background": [R, G, B],
    "card_dark": [R, G, B], "card_dark2": [R, G, B], "card_dark3": [R, G, B], "card_dark4": [R, G, B],
    "text_primary": [R, G, B], "text_body": [R, G, B], "text_muted": [R, G, B], "text_meta": [R, G, B],
    "accent": [R, G, B],
    "border": [R, G, B],
    "white": [255, 255, 255]
  }
}
```

Referenced by `gen-slides-pdf.ts` as `spec.colors.<role>`. Per-project accent override via `lecture-profile.md` → `layout_overrides.colors.accent`.

---

## Shared Base

| File | Purpose |
|------|---------|
| `docs/html-themes/base/base.css` | Shared CSS variables: colors, fonts, spacing, TOC, progress bar |
| `docs/html-themes/styles/base.css` | Canonical future path (same content — migration in progress) |

---

## Adding a New Theme

1. Create `docs/html-themes/themes/<name>/` folder
2. Write `template.html` — HTML skeleton with `<!-- INJECT:CSS -->`, `<!-- INJECT:slideData -->`, `<!-- INJECT:slides -->` placeholders
3. Write `theme.json` — include `name`, `version`, `content_rules`, `compatible_styles`, `incompatible_styles`, `toc_required`, `slide_types`
4. Write `pdf_layout_spec.json` — page geometry, `calibration.viewport_px` (measure via Playwright on `template.html`), layout percentages, font sizes, `slide_types`
5. Register in this file (THEMES.md) — add row to Themes table and update Compatibility Matrix
6. Update `agents/html-build.md` → Available themes list
7. Update `docs/co-deck.context.md` → HTML Themes section
8. Run `bun scripts/audit.ts` to verify

> Use the **T-Stage pipeline** (`skills/theme-authoring/SKILL.md`) — T-0 through T-4 — for step-by-step guidance.

## Adding a New Style

1. Create `docs/html-themes/styles/<name>/style.css` — CSS variable overrides only (no structural rules)
2. Create `docs/html-themes/styles/<name>/pdf_color_spec.json` — 12 role-based RGB color keys (see schema above)
3. Update every `theme.json` that is compatible with this style → add to `compatible_styles`
4. Register in this file (THEMES.md) — add row to Styles table and update Compatibility Matrix
5. Update `docs/lecture-profile.md` → style field options comment
6. Update `docs/co-deck.context.md` → HTML Themes section
7. Run `bun scripts/audit.ts` to verify

> Use the **Style Workflow** (`skills/theme-authoring/SKILL.md` → S-1 through S-3) for step-by-step guidance.

---

---

## 3-Layer PDF Merge

`gen-slides-pdf.ts` builds the final PDF spec at runtime by merging 3 layers:

```
Layer 1 (theme)  : docs/html-themes/themes/<theme>/pdf_layout_spec.json  → geometry, coordinates, fonts
Layer 2 (style)  : docs/html-themes/styles/<style>/pdf_color_spec.json   → color palette
Layer 3 (project): presentations/<project>/lecture-profile.md            → layout_overrides block
```

Later layers win on specific keys. Missing keys fall back to the previous layer or built-in defaults.

*Last updated: 2026-06-21 — added pdf_layout_spec.json + pdf_color_spec.json per theme/style; slide_types field; 3-layer merge documentation; updated adding checklists*
