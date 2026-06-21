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
  "version": "1.1.0",
  "page": { "width_mm": 338.7, "height_mm": 190.5, "margin_mm": 5.0, "aspect_ratio": "16:9" },
  "calibration": { "viewport_px": 611.4 },
  "layout": { "pad_x_pct": 0.0438, "header_y_pct": 0.091, "..." : "..." },
  "fonts": { "title_pt": 28.0, "bullet_pt": 12.5, "..." : "..." },
  "line_heights": { "title_px": 46.0, "..." : "..." },
  "slide_types": { "title": true, "divider": true, "punchline": false, "standard": true },
  "image_zones": {
    "standard": { "x_pct": 0.584, "y_pct": 0.390, "w_pct": 0.372, "h_pct": 0.561, "fit": "contain" },
    "divider":  { "x_pct": 0.558, "y_pct": 0.261, "w_pct": 0.397, "h_pct": 0.606, "fit": "cover" }
  },
  "toc": { "width_pct": 0.18, "item_h_px": 32.0, "indent_px": 12.0, "max_visible_items": 20 },
  "content_constraints": {
    "standard": { "max_bullets": 5, "max_title_chars": 30, "max_body_chars": 120 },
    "divider":  { "max_title_chars": 20, "max_desc_chars": 60 },
    "title":    { "max_title_chars": 40, "max_subtitle_chars": 80 }
  },
  "print": { "bleed_mm": 3.0, "crop_marks": false, "page_numbers": true, "page_number_position": "bottom-right" },
  "slide_type_overrides": {
    "title":   { "title_y_pct": 0.3967, "content_w_pct": 0.9123 },
    "divider": { "text_w_pct": 0.4766 }
  }
}
```

**Mandatory fields**: `page`, `calibration.viewport_px`, `layout.*`, `fonts.title_pt`, `fonts.bullet_pt`
**Optional fields**: other `fonts.*`, `line_heights.*` (script falls back to built-in defaults if absent)
**`slide_types`**: declares which slide types this theme supports — read by Storyline agent at Stage 2

#### `image_zones`
Named image placement zones per slide type. `x_pct`, `y_pct`, `w_pct`, `h_pct` are page-relative fractions. `fit`: `"contain"` (preserve aspect ratio) | `"cover"` (fill zone). Omit a slide type key if that type has no image zone (e.g., slideshow standard). `toc: null` for themes that do not use TOC.

#### `toc`
TOC panel layout (scroll theme only). `width_pct`: TOC panel width as fraction of page width. `item_h_px`: height per TOC item. `indent_px`: indentation per nesting level. `max_visible_items`: maximum items visible without scrolling. Set to `null` for themes that do not use TOC.

#### `content_constraints`
Geometry-derived content limits per slide type. Values are derived from `layout` area dimensions divided by `line_heights`. Read by the Storyline agent at Stage 2 to determine slide density. Keep in sync with the geometry-related entries in `theme.json content_rules`.

#### `print`
PDF export and print specifications. `bleed_mm`: bleed area for professional printing (0 = no bleed). `crop_marks`: whether to include crop marks. `page_numbers`: whether to include page numbers in PDF output. `page_number_position`: `"bottom-right"` | `"bottom-center"` | `"bottom-left"`.

#### `slide_type_overrides`
Per-slide-type layout overrides that supersede the global `layout` values for specific slide types only. Slide types not listed here inherit all global `layout` values unchanged.

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
| `classic` | 1.0.0 | active | `docs/html-themes/styles/classic/style.css` | `styles/classic/pdf_color_spec.json` | General purpose (default) | 45% right panel |
| `minimal` | 1.0.0 | active | `docs/html-themes/styles/minimal/style.css` | `styles/minimal/pdf_color_spec.json` | Text-heavy lectures | None |
| `visual-heavy` | 1.0.0 | active | `docs/html-themes/styles/visual-heavy/style.css` | `styles/visual-heavy/pdf_color_spec.json` | Visual storytelling | Full-bleed background |
| `academic` | 1.0.0 | active | `docs/html-themes/styles/academic/style.css` | `styles/academic/pdf_color_spec.json` | Research / thesis | 30% illustration panel |

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
| `docs/html-themes/styles/base.css` | Shared CSS foundation: structural rules + default color/font/spacing variables. Injected before `style.css` by html-build. |

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

1. Create `docs/html-themes/styles/<name>/style.css` — CSS variable overrides only (no structural rules; use `[data-style="<name>"]` selectors for structural exceptions)
2. Create `docs/html-themes/styles/<name>/pdf_color_spec.json` — 12 role-based RGB color keys (see schema above)
3. Update every `theme.json` that is compatible with this style → add to `compatible_styles`
4. Register in this file (THEMES.md) — add row to Styles table and update Compatibility Matrix
5. Update `docs/lecture-profile.md` → style field options comment
6. Update `docs/co-deck.context.md` → HTML Themes section
7. Run `bun scripts/co-deck/validate-theme-styles.ts` to verify `compatible_styles` ↔ `styles/` consistency
8. Run `bun scripts/audit.ts` to verify

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

*Last updated: 2026-06-21 — migrated style CSS to styles/<name>/style.css (removed overrides/ legacy path); base.css moved to styles/base.css; added validate-templates.ts to "Adding a New Style" guide; previous: added image_zones, toc, content_constraints, print, slide_type_overrides sections to pdf_layout_spec.json schema (v1.1.0)*
