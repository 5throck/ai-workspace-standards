# Design: co-deck html-themes — Shared Styles + Unified Region-Based Layout

**Date**: 2026-06-21
**Topic**: html-themes ownership model — shared style/color pool + unified region-based layout coordinates
**Status**: REVISED — supersedes the earlier per-theme migration direction (see "Revision History")
**Related**: ADR-0045 (`docs/adr/0045-html-themes-shared-styles-region-layout.md`), review transcript `memory/meeting-2026-06-21-html-themes-design-review.md`

---

## Revision History

1. **Initial proposal (superseded)**: migrate `styles/` into `themes/<name>/styles/<style>/` so each theme owns its style and color files.
2. **Review finding**: that direction (a) duplicates theme-independent color/CSS across themes — the exact duplication raised as a concern — and (b) the PDF layout coordinate system is already broken (`gen-slides-pdf.ts:587 buildCoords()` reads mismatched keys and ignores slideshow's coordinates entirely).
3. **Revised direction (this document)**: keep styles/colors in a **shared pool** (single source, no duplication); unify layout on a **region-based coordinate model** with a shared base + per-theme region values.
4. **Visual-heavy retention correction (2026-06-21)**: the "incompatible with both themes → delete" premise is **withdrawn** after implementation-time verification. `visual-heavy` is `active` (v1.0.0) with real `renderSlide()` logic in `agents/html-build.md` (injects `--slide-bg-image` for `data-style === 'visual-heavy'`) and 10+ structural selectors in `styles/visual-heavy/style.css`. The compatibility matrix (`THEMES.md:93`, `co-deck.context.md:157`) gives scroll = ⚠️ partial, slideshow = ❌ incompatible; `lecture-profile.md:48` notes "visual-heavy: full-bleed images (scroll only)". Decision: **retain** `visual-heavy` in the shared pool (scroll-partial / slideshow-incompatible), not delete it. See ADR-0045 corrigendum.
5. **AC-4 scope clarification (2026-06-22)**: AC-4 is **PDF-only by design**. The unified region-based layout model drives PDF generation (`buildCoords` + render functions consume `regions.*`); it is the single source of truth for **PDF**. The HTML preview layer is **NOT** driven by the region JSON — it follows the CSS load order (`styles/base.css` → `themes/<name>/theme.css` → `styles/<style>/style.css`). Driving HTML on-screen layout from regions (generating CSS variables from the region spec) was considered as a scope expansion and **declined** — it would force a CSS-variable generation layer without altering PDF output. HTML stays CSS-driven. AC-4's earlier "drives both HTML and PDF" wording overstated the scope and is corrected here; AC-1, AC-2, AC-3, AC-5, AC-6, AC-7 are unchanged and met as written. See ADR-0045 Decision #2 Scope + Addendum.

---

## Design Principles (settled in review dialogue)

1. A theme (rendering paradigm: `scroll` / `slideshow`) contains **one or more styles**.
2. Styles and colors are **identical across themes** → share a **single source** (no duplication, no drift). Editing once must reflect in all themes. [Decision "B"]
3. Layout coordinates should be **unified across themes** to maximize reuse and management efficiency.
4. On-screen (HTML) layout must match PDF output — driven by a **single source of truth**.
5. A **preview** feature must support newly created theme/style combinations.
6. **Design first**: this document + ADR are settled before any implementation code.

---

## Revised Artifact Ownership

| Artifact | Location | Sharing | Purpose |
|----------|----------|---------|---------|
| `pdf_layout_spec.json` | `themes/<name>/` + shared `themes/_shared/layout_base.json` | base shared, region values per-theme | geometry, coordinates, fonts |
| `style.css` | `styles/<style>/` | **shared** (single source) | CSS variable overrides (theme-agnostic) |
| `pdf_color_spec.json` | `styles/<style>/` | **shared** (single source) | color palette (pure RGB, theme-independent) |
| `base.css` | `styles/base.css` (foundation) + `themes/<name>/theme.css` (extension) | foundation shared, extension per-theme | shared CSS foundation + paradigm-specific UI |

**Why styles/colors are shared, not per-theme:** the data confirms they are theme-independent — `pdf_color_spec.json` is pure RGB arrays; `style.css` is `:root` CSS variables with only `[data-style="<name>"]` selectors. Because they must stay identical across themes anyway, a single shared source removes duplication and drift by construction.

**Why layout is shared-but-delta'd:** geometry genuinely differs by paradigm (scroll: TOC + component positions; slideshow: centered content + counter). The **model** (named regions) unifies; the **values** differ per theme. A shared base holds defaults; each theme holds its region values + paradigm-specific extras.

---

## Unified Region-Based Layout Schema

Both themes ultimately place rectangles on a fixed 16:9 page (338.7 × 190.5 mm) for PDF. Unify on **named regions** + **slide-type composition**.

### Shared base — `themes/_shared/layout_base.json`

```jsonc
{
  "version": "1.2.0",
  "page":  { "width_mm": 338.7, "height_mm": 190.5, "aspect_ratio": "16:9" },
  "print": { "crop_marks": false, "page_numbers": true, "page_number_position": "bottom-right" },
  "regions": {
    "header": null, "title": null, "content": null,
    "visual": null, "meta": null, "toc": null
  }
}
```

### Per-theme — `themes/<name>/pdf_layout_spec.json`

```jsonc
{
  "regions": {
    "title":   { "x_pct": 0.044, "y_pct": 0.224, "w_pct": 0.50,  "h_pct": 0.10 },
    "content": { "x_pct": 0.044, "y_pct": 0.349, "w_pct": 0.503, "h_pct": 0.55 },
    "visual":  { "x_pct": 0.584, "y_pct": 0.390, "w_pct": 0.372, "h_pct": 0.561 },
    "header":  { "x_pct": 0.044, "y_pct": 0.091, "w_pct": 0.91,  "h_pct": 0.064 },
    "toc":     { "x_pct": 0.0,  "y_pct": 0.091, "w_pct": 0.18,  "h_pct": 0.85 },
    "meta":    { "x_pct": 0.90, "y_pct": 0.05,  "w_pct": 0.08,  "h_pct": 0.04 }
  },
  "slide_types": {
    "standard":  { "regions": ["header", "title", "content", "visual"] },
    "title":     { "regions": ["title", "subtitle"] },
    "divider":   { "regions": ["title", "visual"] },
    "punchline": { "regions": ["title", "subtitle"] }
  },
  "fonts": { "...": "per-theme values (title_pt, bullet_pt, + paradigm-specific)" },
  "line_heights": { "...": "per-theme values" },
  "content_constraints": { "...": "per slide-type" }
}
```

- A region is either `{ x_pct, y_pct, w_pct, h_pct, fit? }` or `null` (absent — e.g., `toc` is null for slideshow).
- Slide types declare which regions they use; the renderer iterates `slide_types[type].regions` instead of branching on `theme`.
- Final spec = `deepMerge(layout_base, theme_spec, style_colors, project_overrides)` — the existing 3-layer merge extends cleanly.

### What this fixes

- **`buildCoords()` becomes theme-agnostic**: resolves `regions.*` uniformly — no `pad_x`/`content_x` vocabulary split.
- **Key-mismatch bug eliminated**: one canonical region schema, no `L.pad_x` vs `pad_x_pct` drift.
- **Slideshow coordinates finally consumed**: slideshow's layout is read instead of falling back to scroll's hardcoded defaults.
- **Single source for HTML ↔ PDF**: the same region model can drive both CSS variables and PDF coordinates.

---

## Target Directory Structure

```
html-themes/
├── styles/                              # STYLE axis — shared, theme-independent
│   ├── base.css                         # shared CSS foundation
│   ├── classic/   { style.css, pdf_color_spec.json }
│   ├── minimal/   { style.css, pdf_color_spec.json }
│   ├── academic/  { style.css, pdf_color_spec.json }
│   ├── visual-heavy/  { style.css, pdf_color_spec.json }   # scroll-partial / slideshow-incompatible (retained)
├── themes/                              # THEME axis — layout/behavior
│   ├── _shared/
│   │   └── layout_base.json             # shared layout defaults
│   ├── scroll/
│   │   ├── template.html
│   │   ├── theme.json
│   │   ├── theme.css                    # scroll-specific CSS extension (TOC, progress)
│   │   └── pdf_layout_spec.json         # scroll region values + slide types
│   └── slideshow/
│       ├── template.html
│       ├── theme.json
│       ├── theme.css                    # slideshow-specific CSS extension (transitions)
│       └── pdf_layout_spec.json         # slideshow region values + slide types
└── preview/
    └── preview.html                     # dynamic theme/style discovery (no hardcoded map)
```

Removed vs the earlier proposal:
- No `themes/<name>/styles/<style>/` nesting (styles stay shared).
- `styles/visual-heavy/` RETAINED — scroll-partial / slideshow-incompatible (not deleted; earlier "incompatible with both" premise was incorrect).
- Stray `themes/scroll/styles/base.css` (half-migration residue) deleted.

---

## 3-Layer PDF Merge (extended)

```
Layer 0 (base)   : themes/_shared/layout_base.json                     → shared defaults
Layer 1 (theme)  : themes/<name>/pdf_layout_spec.json                  → region values + slide types + fonts
Layer 2 (style)  : styles/<style>/pdf_color_spec.json                  → colors (shared pool)
Layer 2 (css)    : styles/base.css → themes/<name>/theme.css → styles/<style>/style.css
Layer 3 (project): presentations/<project>/lecture-profile.md          → overrides
```

---

## Implementation Phases (design-first)

- **Phase 0 — Design reflection** (this doc + ADR-0045). ✅ current
- **Phase 1 — Shared styles pool**: confirm `styles/<style>/` single source; delete stray `themes/scroll/styles/base.css`; **retain** `styles/visual-heavy/` (scroll-partial / slideshow-incompatible); split `base.css` → foundation + `themes/<name>/theme.css`.
- **Phase 2 — Region-based layout**: author `layout_base.json`; convert both specs to region schema; rewrite `buildCoords()` + render functions to region model; verify scroll + slideshow PDFs.
- **Phase 3 — Validation + preview**: rewrite `validate-theme-styles.ts` for region schema + shared pool; `preview.html` dynamic discovery; scaffold helper for new theme/style.
- **Phase 4 — Docs + lifecycle**: sync `THEMES.md`, `co-deck.context.md`, `variant.json`; lifecycle update; `bun scripts/audit.ts`.

---

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-1 | Shared style/color pool is the single source for both themes | edit one style → both themes reflect it |
| AC-2 | Layout uses the unified region schema; `buildCoords()` is theme-agnostic | code review; no `theme === 'scroll'` coordinate branching |
| AC-3 | Slideshow coordinates are consumed in PDF generation | before/after sample PDF comparison |
| AC-4 | Region model drives PDF generation (single source for PDF); HTML preview uses the CSS load order (base→theme→style) | PDF output derived from regions; HTML preview via CSS load order |
| AC-5 | `validate-theme-styles.ts` passes against region schema + shared pool | script exits 0 |
| AC-6 | Preview dynamically discovers a newly scaffolded theme/style | create dir → appears in preview without code change |
| AC-7 | No silent spec fallback; missing region throws | intentional missing region → explicit error |
