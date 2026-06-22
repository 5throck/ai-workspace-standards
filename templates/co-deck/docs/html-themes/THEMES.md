# Theme & Style Registry

> **Authoritative registry** for all co-deck themes and styles.
> Every new theme or style MUST be registered here before use.
> Follow the SKILLS.md pattern: one row per entry, with version and status.

---

## Themes

A **theme** is a rendering paradigm package of **4 files**: HTML skeleton (`template.html`) + metadata/content-rules (`theme.json`) + per-theme CSS extension (`theme.css`) + region-based PDF layout specification (`pdf_layout_spec.json`).

| Name | Version | Status | Paradigm | Navigation | TOC | Compatible Styles | Folder |
|------|---------|--------|----------|-----------|-----|-------------------|--------|
| `notebook` | 1.0.0 | active | Ruled-paper card, centered fullscreen, opacity fade | Prev/Next + chapter tabs (footer) + arrow keys | None | classic, minimal, academic | `themes/notebook/` |
| `pitch` | 1.0.0 | active | Floating card, viewport-relative (92vw×82vh), scale+translate transition | Bottom footer bar (TOC drawer + script panel + prev/next) | Optional | classic, minimal, premium-dark | `themes/pitch/` |
| `scroll` | 1.0.0 | active | Vertical scroll — all slides in DOM | Scroll + TOC panel | Required | premium-dark, classic, minimal, academic, visual-heavy (⚠ partial) | `themes/scroll/` |
| `slideshow` | 1.0.0 | active | Fullscreen single-slide, animated transitions | Prev/Next + arrow keys | None | classic, minimal, premium-dark | `themes/slideshow/` |

### Theme Package Files

Each theme folder contains:

| File | Required | Purpose |
|------|----------|---------|
| `template.html` | ✅ | HTML skeleton with `<!-- INJECT:CSS -->`, `<!-- INJECT:slideData -->`, `<!-- INJECT:slides -->` placeholders. **Authoritative renderer:** `renderSlide(data, index)` + `initSlides()` build the `.slide` DOM at runtime from the injected `slideData` (via `createElement`/`textContent`); html-build injects only `slideData` + CSS links and leaves the slide container empty. |
| `theme.json` | ✅ | `content_rules`, `compatible_styles`, `partial_styles`, `incompatible_styles`, `recommended_structure`, `toc_required`, `slide_types`, `css_base`, `css_theme` |
| `theme.css` | ✅ | Per-theme CSS extension layered between `base.css` and `styles/<style>/style.css` (see CSS Load Order). Defines theme-specific structural rules (e.g. scroll TOC panel, slideshow card geometry). |
| `pdf_layout_spec.json` | ✅ | Region-based PDF layout: `page` geometry, `calibration.viewport_px`, `regions.*`, `slide_types[type].regions`, `slide_type_overrides`, `fonts`, `line_heights`, `content_constraints`, `toc`, `print` |

> **`css_theme` field** (`theme.json`): each theme declares the path to its `theme.css` (e.g. `"css_theme": "docs/html-themes/themes/scroll/theme.css"`). html-build reads this to inject the per-theme CSS in the correct order.

> **Runtime rendering contract (all 4 themes):** `template.html`'s `renderSlide(data, index)` is the single source of truth for slide structure. It maps `slideData` flags → a theme-specific `data-type` (pitch/notebook: `isTitleSlide→"title"`; scroll/slideshow: `isTitleSlide→"cover"`; slideshow: `isPunchlineSlide→"punchline"`; all: `isDividerSlide→"divider"`, `isProfileSlide→"profile"`, `isContactSlide→"contact"`, else `"standard"`) and emits each theme's native structural classes (pitch `divider-left/right`+`slide-content`+`slide-visual`; notebook `cover-rule`+`gutter-num`+`nb-tabs`; scroll/slideshow base.css `slide-card`+`bullets-container`). `initSlides()` runs on `DOMContentLoaded` **before** each theme's TOC/tab/spy hooks. The PDF pipeline is unaffected: `extract_slidedata.mjs` (v1.2.0) parses the inline `const slideData = [...]` array via a bracket-depth state machine (not regex, not DOM), so runtime rendering is invisible to extract/measure/PDF. slideData **MUST be strict JSON** (all keys/values double-quoted, no trailing commas, no JS comments) for `JSON.parse` to succeed.

### `pdf_layout_spec.json` Schema (region model, v1.2.0)

The spec uses a **region-based layout model** (ADR-0045 Decision #2). Coordinates are declared once per region name; slide renderers iterate the regions declared for each slide type. `gen-slides-pdf.ts` v1.2.0 `buildCoords()` is **theme-agnostic** — it resolves `regions.*` uniformly for every theme and dispatches render functions by declared `slide_types`, not by theme name.

```json
{
  "version": "1.2.0",
  "page": { "width_mm": 338.7, "height_mm": 190.5, "margin_mm": 5.0, "aspect_ratio": "16:9" },
  "calibration": { "viewport_px": 611.4 },
  "regions": {
    "header":  { "x_pct": 0.0,    "y_pct": 0.091,  "w_pct": 1.0,    "h_pct": 0.064 },
    "title":   { "x_pct": 0.0438, "y_pct": 0.224,  "w_pct": 0.9124, "h_pct": 0.10  },
    "content": { "x_pct": 0.0438, "y_pct": 0.349,  "w_pct": 0.503,  "h_pct": 0.651 },
    "visual":  { "x_pct": 0.584,  "y_pct": 0.390,  "w_pct": 0.372,  "h_pct": 0.561, "fit": "contain" },
    "meta":    null,
    "toc":     null
  },
  "slide_types": {
    "title":    { "regions": ["header", "title", "subtitle", "meta"] },
    "divider":  { "regions": ["header", "title", "visual"] },
    "standard": { "regions": ["header", "title", "content", "visual"] }
  },
  "slide_type_overrides": {
    "title":   { "title": { "x_pct": 0.0438, "y_pct": 0.3967, "w_pct": 0.9123, "h_pct": 0.10 } },
    "divider": { "visual": { "x_pct": 0.5582, "y_pct": 0.2613, "w_pct": 0.3972, "h_pct": 0.6059, "fit": "cover" } }
  },
  "fonts": { "title_pt": 28.0, "bullet_pt": 12.5 },
  "line_heights": { "title_px": 46.0, "bullet_px": 29.44 },
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
  "print": { "bleed_mm": 3.0, "crop_marks": false, "page_numbers": true, "page_number_position": "bottom-right" }
}
```

**Mandatory fields**: `page`, `calibration.viewport_px`, `regions.*`, `slide_types[type].regions`, `fonts.title_pt`, `fonts.bullet_pt`
**Optional fields**: other `fonts.*`, `line_heights.*` (script falls back to built-in defaults if absent)
**`slide_types`** (top-level object): also appears in `theme.json` as the boolean "which slide types this theme supports" declaration — read by Storyline agent at Stage 2.

#### Region model

- **`regions.*`**: page-relative layout rectangles. Each value is either `null` (region not used by this theme) or an object `{ x_pct, y_pct, w_pct, h_pct, fit? }` where all `*_pct` are fractions of page width/height in `[0, 1]` and `fit` ∈ `"contain"` | `"cover"` | `"fill"` (optional, image-fitting hint for the `visual` region).
- **`slide_types[type].regions`**: array of region names that the given slide type uses. The PDF renderer iterates exactly these regions; theme name is irrelevant to dispatch. A region referenced here that resolves to `null` (and is not overridden) is treated as "absent for this slide" — renderers skip it via the optional-region resolver.
- **`slide_type_overrides[type]`**: per-slide-type region value overrides that supersede the theme-wide `regions.*` value for that slide type only. Used for title/divider slides whose geometry differs from standard.

#### Layer 0 — `_shared/layout_base.json`

`themes/_shared/layout_base.json` holds the **Layer 0 defaults** for the region model: the 16:9 `page` baseline, `print` defaults, and a region skeleton whose values are all `null` (`header`, `title`, `content`, `visual`, `meta`, `toc`). It is the merge base — it never fills a region a theme intends to leave null. `_shared/` is excluded from the theme scan (it is not itself a theme).

#### `image_zones`
Named image placement zones per slide type (legacy companion to the `visual` region; kept for backwards compatibility and for styles that key image geometry by slide type). `x_pct`, `y_pct`, `w_pct`, `h_pct` are page-relative fractions. `fit`: `"contain"` (preserve aspect ratio) | `"cover"` (fill zone). Omit a slide type key if that type has no image zone (e.g., slideshow standard). Set `toc: null` for themes that do not use TOC.

#### `toc`
TOC panel layout (scroll theme only). `width_pct`: TOC panel width as fraction of page width. `item_h_px`: height per TOC item. `indent_px`: indentation per nesting level. `max_visible_items`: maximum items visible without scrolling. Set to `null` for themes that do not use TOC.

#### `content_constraints`
Geometry-derived content limits per slide type. Values are derived from region area dimensions divided by `line_heights`. Read by the Storyline agent at Stage 2 to determine slide density. Keep in sync with the geometry-related entries in `theme.json content_rules`.

#### `print`
PDF export and print specifications. `bleed_mm`: bleed area for professional printing (0 = no bleed). `crop_marks`: whether to include crop marks. `page_numbers`: whether to include page numbers in PDF output. `page_number_position`: `"bottom-right"` | `"bottom-center"` | `"bottom-left"`.

### `theme.json` `slide_types` + `css_theme` Fields

```json
"slide_types": {
  "title":    true,
  "divider":  true,   // scroll only
  "punchline": false, // slideshow only
  "standard": true
},
"css_base":  "docs/html-themes/styles/base.css",
"css_theme": "docs/html-themes/themes/<theme>/theme.css"
```

`css_base` points at the shared foundation; `css_theme` points at this theme's per-theme CSS extension. html-build reads both and injects them in CSS Load Order (see below).

### Compatibility Matrix

| Style ↓ / Theme → | `notebook` | `pitch` | `scroll` | `slideshow` |
|-------------------|------------|---------|----------|-------------|
| `premium-dark` | ❌ incompatible | ✅ | ✅ | ✅ |
| `classic` | ✅ | ✅ | ✅ | ✅ |
| `minimal` | ✅ | ✅ | ✅ | ✅ |
| `visual-heavy` | ❌ incompatible | ❌ incompatible | ⚠️ partial | ❌ incompatible |
| `academic` | ✅ | ❌ incompatible | ✅ | ❌ incompatible |

**Legend**: ✅ Fully compatible · ⚠️ Partial (see theme.json `partial_styles`) · ❌ Incompatible (see theme.json `incompatible_styles`)

> **`visual-heavy` is RETAINED** as an active style. It is **scroll-partial** (works well for short/visual slides — cover, divider, image-driven content; avoid for text-dense scroll slides) and **slideshow-incompatible** (full-bleed background-image conflicts with slideshow's rounded-card layout). Listed in `scroll/theme.json` under both `compatible_styles` and `partial_styles`; listed in `slideshow/theme.json` under `incompatible_styles`.

---

## CSS Load Order

The shared style/color pool (ADR-0045 Decision B) is the single source for all themes. CSS is injected by html-build in this fixed order (later layers override earlier ones):

```
1. styles/base.css                       — shared foundation: structural rules + default variables
2. themes/<theme>/theme.css              — per-theme extension (TOC panel, card geometry, etc.)
3. styles/<style>/style.css              — per-style visual overrides (colors, fonts, spacing)
```

`theme.json` declares `css_base` (→ `styles/base.css`) and `css_theme` (→ `themes/<theme>/theme.css`) so html-build can resolve both paths without hardcoding. Styles live in the **shared `styles/` pool**, NOT under individual themes — any theme can pair with any compatible style without duplicating CSS.

---

## Styles

A **style** is a rendering appearance package of **2 files**: CSS variable overrides (`style.css`) + PDF color specification (`pdf_color_spec.json`).

A **style** controls color, font, and spacing via `styles/base.css` (shared foundation) + `styles/<name>/style.css` (visual overrides).

| Name | Version | Status | CSS File | PDF Color Spec | Best For | Image Panel |
|------|---------|--------|----------|----------------|---------|-------------|
| `premium-dark` | 1.0.0 | active | `docs/html-themes/styles/premium-dark/style.css` | `styles/premium-dark/pdf_color_spec.json` | Executive / keynote — dark navy + gold accent, serif typography, soft gold title glow (default) | Inherited from theme |
| `classic` | 1.0.0 | active | `docs/html-themes/styles/classic/style.css` | `styles/classic/pdf_color_spec.json` | General purpose | 45% right panel |
| `minimal` | 1.0.0 | active | `docs/html-themes/styles/minimal/style.css` | `styles/minimal/pdf_color_spec.json` | Text-heavy lectures | None |
| `visual-heavy` | 1.0.0 | active | `docs/html-themes/styles/visual-heavy/style.css` | `styles/visual-heavy/pdf_color_spec.json` | Visual storytelling | Full-bleed background |
| `academic` | 1.0.0 | active | `docs/html-themes/styles/academic/style.css` | `styles/academic/pdf_color_spec.json` | Research / thesis | 30% illustration panel |

> **`premium-dark` is the default style** as of 2026-06-22. Projects whose `lecture-profile.md` does not set `style` now render `premium-dark` (dark navy surfaces `#111827`/`#0B0F19` + gold accent `#D97706` + MaruBuri/Noto Serif KR typography + soft gold title glow via `--title-text-shadow`). Derived from the `kyobo_ax_2026` executive lecture deck; optimized for the `scroll` theme and compatible with `slideshow`.
>
> **`classic` color-spec drift fix** (2026-06-22): `styles/classic/pdf_color_spec.json` previously held a dark palette (mismatched against `classic/style.css`'s light CSS). Corrected to the matching LIGHT palette so HTML (light) and PDF (light) are consistent. The displaced dark palette now lives under `styles/premium-dark/pdf_color_spec.json` where it belongs.

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
| `docs/html-themes/styles/base.css` | Shared CSS foundation: structural rules + default color/font/spacing variables. Injected first in the CSS Load Order by html-build. |

---

## Directory Structure

```
docs/html-themes/
├── THEMES.md                              # THIS FILE — authoritative theme + style registry
├── styles/                                # SHARED style/color pool (ADR-0045 Decision B)
│   ├── base.css                           # shared foundation (Layer 1 of CSS Load Order)
│   ├── premium-dark/ { style.css, pdf_color_spec.json }   # DEFAULT — dark navy + gold + serif + glow
│   ├── classic/      { style.css, pdf_color_spec.json }
│   ├── minimal/      { style.css, pdf_color_spec.json }
│   ├── visual-heavy/ { style.css, pdf_color_spec.json }   # RETAINED — scroll-partial / slideshow-incompatible
│   └── academic/     { style.css, pdf_color_spec.json }
├── themes/
│   ├── _shared/
│   │   └── layout_base.json               # Layer 0 — region skeleton (all null) + 16:9 page + print defaults
│   ├── scroll/
│   │   ├── template.html
│   │   ├── theme.json                     # css_base + css_theme + compatible_styles + partial_styles[]
│   │   ├── theme.css                      # per-theme extension (Layer 2 of CSS Load Order)
│   │   └── pdf_layout_spec.json           # region schema (regions.*, slide_types[type].regions, ...)
│   └── slideshow/
│       ├── template.html
│       ├── theme.json
│       ├── theme.css
│       └── pdf_layout_spec.json
└── preview/
    ├── preview.html                       # theme × style previewer (dropdowns populated from manifest)
    └── themes-manifest.js                 # AUTO-GENERATED — file://-safe manifest for dropdown population
```

> Styles stay in the shared `styles/` pool — they are NOT nested under individual themes. Any theme can pair with any compatible style. `themes/_shared/` is the Layer 0 base, not a theme itself (excluded from the theme scan).

---

## Scripts & Tools

All scripts live under `templates/co-deck/scripts/co-deck/`. Run from the workspace root via `bun`.

| Script | Version | Purpose |
|--------|---------|---------|
| `validate-theme-styles.ts` | 2.0.0 | Validates the unified region-based layout model: shared-pool integrity (each `styles/<name>/` has `style.css` + `pdf_color_spec.json`), `theme.json` `compatible_styles`/`partial_styles`/`incompatible_styles` consistency, region schema (each region is `null` or `{x_pct,y_pct,w_pct,h_pct,fit?}` with `*_pct ∈ [0,1]`), `slide_types[type].regions` ↔ region cross-check, and Layer 0 `_shared/layout_base.json` skeleton. Run after any theme/style edit. |
| `generate-themes-manifest.ts` | 1.0.0 | Scans `themes/` (excluding `_shared`) and `styles/` → emits `preview/themes-manifest.js` (a `file://`-safe `<script>`-loadable global, since `fetch()` of local JSON is blocked on `file://`). **Regenerate after adding or removing any theme or style.** |
| `scaffold-theme-style.ts` | 1.0.0 | Scaffolds a new theme (`--theme <name>`) or style (`--style <name>`) with the correct file layout — region-skeleton stubs for themes, adapted style copies for styles. Auto-regenerates the manifest. Never overwrites existing directories. |

```bash
# Validate after editing any theme/style/region spec
bun scripts/co-deck/validate-theme-styles.ts

# Regenerate the preview manifest (also run automatically by scaffold-theme-style.ts)
bun scripts/co-deck/generate-themes-manifest.ts

# Scaffold a new theme or style (stubs region-skeleton files + regenerates manifest)
bun scripts/co-deck/scaffold-theme-style.ts --theme <name>
bun scripts/co-deck/scaffold-theme-style.ts --style <name>
```

---

## Adding a New Theme

1. Run `bun scripts/co-deck/scaffold-theme-style.ts --theme <name>` — stubs `themes/<name>/{template.html, theme.json, theme.css, pdf_layout_spec.json}` with region-skeleton placeholders and auto-regenerates the manifest.
2. Edit `template.html` — HTML skeleton with `<!-- INJECT:CSS -->`, `<!-- INJECT:slideData -->`, `<!-- INJECT:slides -->` placeholders.
3. Edit `theme.json` — include `name`, `version`, `content_rules`, `compatible_styles`, `partial_styles` (if any), `incompatible_styles` (with `reason`), `toc_required`, `slide_types`, `css_base`, `css_theme`.
4. Edit `theme.css` — per-theme structural extension (keep visual overrides in styles).
5. Edit `pdf_layout_spec.json` — fill `regions.*`, `slide_types[type].regions`, `slide_type_overrides` (if needed), `fonts`, `line_heights`, `content_constraints`, `toc`, `print`, `page`, `calibration.viewport_px` (measure via Playwright on `template.html`).
6. Register in this file (THEMES.md) — add row to Themes table and update Compatibility Matrix.
7. Update `agents/html-build.md` → Available themes list.
8. Update `docs/co-deck.context.md` → Theme & Style System section.
9. Run `bun scripts/co-deck/validate-theme-styles.ts` (region schema + shared pool).
10. Run `bun scripts/audit.ts` to verify.

> Use the **T-Stage pipeline** (`skills/theme-authoring/SKILL.md`) — T-0 through T-4 — for step-by-step guidance.

## Adding a New Style

1. Run `bun scripts/co-deck/scaffold-theme-style.ts --style <name>` — stubs `styles/<name>/{style.css, pdf_color_spec.json}` as adapted copies and auto-regenerates the manifest.
2. Edit `styles/<name>/style.css` — CSS variable overrides only (no structural rules; use `[data-style="<name>"]` selectors for structural exceptions).
3. Edit `styles/<name>/pdf_color_spec.json` — 12 role-based RGB color keys (see schema above).
4. Update every `theme.json` that is compatible with this style → add to `compatible_styles` (or `partial_styles` with a `reason` if partial).
5. Register in this file (THEMES.md) — add row to Styles table and update Compatibility Matrix.
6. Update `docs/lecture-profile.md` → style field options comment.
7. Update `docs/co-deck.context.md` → Theme & Style System section.
8. Run `bun scripts/co-deck/validate-theme-styles.ts` to verify `compatible_styles` ↔ `styles/` consistency and region schema.
9. Run `bun scripts/audit.ts` to verify.

> Use the **Style Workflow** (`skills/theme-authoring/SKILL.md` → S-1 through S-3) for step-by-step guidance.

---

---

## 4-Layer PDF Merge

`gen-slides-pdf.ts` (v1.2.0) builds the final PDF spec at runtime by `deepMerge`-ing 4 layers (later layers win on specific keys):

```
Layer 0 (shared) : docs/html-themes/themes/_shared/layout_base.json      → region skeleton (all null) + 16:9 page + print defaults
Layer 1 (theme)  : docs/html-themes/themes/<theme>/pdf_layout_spec.json  → regions.*, slide_types[type].regions, slide_type_overrides, fonts, line_heights, content_constraints, toc, print
Layer 2 (style)  : docs/html-themes/styles/<style>/pdf_color_spec.json   → color palette (colors.<role>)
Layer 3 (project): presentations/<project>/lecture-profile.md            → layout_overrides block
```

Region values that are `null` in the theme spec **stay null** — Layer 0 never fills a region the theme intends to leave absent. Missing keys fall back to the previous layer or built-in defaults. Required regions referenced by `slide_types[type].regions` that resolve to `null` (and are not overridden) throw — there is **no silent fallback** to a default geometry.

*Last updated: 2026-06-22 — `premium-dark` style added as DEFAULT (dark navy + gold accent + MaruBuri/Noto Serif KR + soft gold title glow; scroll-compatible primary + slideshow-compatible; derived from the `kyobo_ax_2026` executive deck); `classic/pdf_color_spec.json` corrected to a LIGHT palette (previously held a dark palette — drift fix); `base.css` gains a neutral `--title-text-shadow` hook for opt-in title glow; `variant.json` `theme_manifest.default` = `premium-dark`. Previous: 2026-06-21 — region-based layout model (ADR-0045 Decision #2): `pdf_layout_spec.json` v1.2.0 declares `regions.*` + `slide_types[type].regions` + `slide_type_overrides`; `themes/_shared/layout_base.json` (Layer 0); per-theme `theme.css` + `theme.json` `css_theme` field; 4-layer PDF merge; `preview/themes-manifest.js` (auto-generated); `validate-theme-styles.ts` v2.0.0 / `generate-themes-manifest.ts` v1.0.0 / `scaffold-theme-style.ts` v1.0.0; visual-heavy RETAINED (scroll-partial / slideshow-incompatible). Prior: migrated style CSS to `styles/<name>/style.css`; `base.css` moved to `styles/base.css`.*
