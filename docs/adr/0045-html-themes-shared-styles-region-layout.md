# ADR-0045: co-deck html-themes — Shared Style/Color Pool and Unified Region-Based Layout

**Date**: 2026-06-21
**Status**: Accepted
**Corrigendum (2026-06-21)**: visual-heavy is retained (not deleted); it is scroll-partial / slideshow-incompatible. Initial draft incorrectly stated "incompatible with both."
**Deciders**: architect, automation-engineer, docs-writer, auditor
**Supersedes**: the per-theme style migration direction recorded in `memory/meeting-2026-06-21-html-themes-per-theme-style-design.md` (initial proposal)
**Related**: ADR-0036 (TypeScript script migration), ADR-0039 (L0/L1/L2 hierarchy), review transcript `memory/meeting-2026-06-21-html-themes-design-review.md`

---

## Context

The co-deck `html-themes` system separates **themes** (rendering paradigms: `scroll`, `slideshow`) from **styles** (visual appearance: `classic`, `minimal`, `academic`). An earlier design proposed migrating style/color artifacts into per-theme directories (`themes/<name>/styles/<style>/`) so each theme would own its own copy of every style.

Design review surfaced two problems with that direction:

1. **Duplication with no benefit.** Inspection of the actual data shows style and color artifacts are theme-independent:
   - `pdf_color_spec.json` is pure RGB arrays (12 semantic color roles) — no geometry, layout, or theme-specific data.
   - `style.css` is `:root` CSS variables with only `[data-style="<name>"]` selectors — portable across themes.
   Placing these under `themes/<name>/styles/<style>/` would duplicate `classic` and `minimal` (the two styles shared by both themes) across `scroll` and `slideshow` for no functional gain — the exact duplication raised as a concern. Worse, duplicated copies could drift, breaking the requirement that a given style look identical in every theme.

2. **The layout coordinate system is already broken.** `gen-slides-pdf.ts` `buildCoords()` (line 587) is hardcoded to scroll's coordinate vocabulary and reads **mismatched keys** (`L.pad_x` vs the spec's `pad_x_pct`, `L.hdr_y` vs `header_y_pct`, etc.). As a result:
   - Spec values are silently ignored; rendering falls back to hardcoded defaults that merely *mirror* scroll's values.
   - Slideshow's coordinate fields (`content_*`, `counter_*`) are **never read** — slideshow PDFs render with scroll's defaults.

   The two themes also use fundamentally different coordinate vocabularies (scroll: `pad/header/vis/ts/div`; slideshow: `content/counter`), which blocks any shared layout logic and makes adding themes expensive.

The user's settled design principles: (a) styles/colors must stay identical across themes; (b) layout coordinates should be unified across themes for management efficiency; (c) HTML on-screen layout must match PDF output via a single source of truth; (d) a preview feature must support newly created theme/style combinations.

---

## Decision

### 1. Shared style/color pool (single source)

`style.css` and `pdf_color_spec.json` live in a **shared pool** keyed by style name:

```
styles/<style>/{style.css, pdf_color_spec.json}
```

Both themes read from this single source. Editing a style once reflects in all themes. There is **no per-theme copy** and therefore no duplication and no drift. This matches what the runtime code already does (`gen-slides-pdf.ts:728` resolves `styles/${style}/pdf_color_spec.json`; `preview.html:80` resolves `../styles/${style}/style.css`) — the decision is to **not migrate** styles into themes and to remove the half-migrated residue.

`base.css` is split into a **shared foundation** (`styles/base.css`) plus a small **per-theme extension** (`themes/<name>/theme.css`) so paradigm-specific UI (scroll's TOC/progress, slideshow's transitions) lives with the theme without duplicating the foundation.

**`visual-heavy` status**: retained in the shared pool. It is fully incompatible with `slideshow` (full-bleed `background-image` conflicts with slideshow's rounded-card layout) and **partially** compatible with `scroll` (works well for short/visual slides — cover, divider, image-driven content; caveat: scroll's variable-height long content slides may have background-image sizing issues). The earlier "incompatible with both themes → delete" framing (in the initial draft of this ADR and the design doc) was based on an incomplete reading of the compatibility matrix and is **withdrawn**. The shared-pool decision itself is unchanged — `visual-heavy` is simply one more style in the shared pool, exactly like `classic`/`minimal`/`academic`.

### 2. Unified region-based layout coordinate model

Both themes ultimately place rectangles on a fixed 16:9 page (338.7 × 190.5 mm) for PDF generation. Layout is unified on **named regions** + **slide-type composition**:

- A **shared base** (`themes/_shared/layout_base.json`) holds defaults: page size, print settings, and the region schema skeleton.
- Each theme's `pdf_layout_spec.json` holds **region values** (paradigm-specific positions for `title`, `content`, `visual`, `header`, `meta`, `toc`) plus `slide_types` mapping each slide type to the regions it uses, plus `fonts`/`line_heights`/`content_constraints`.
- A region is `{ x_pct, y_pct, w_pct, h_pct, fit? }` or `null` when absent (e.g., `toc` is null for slideshow).
- Final spec = `deepMerge(layout_base, theme_spec, style_colors, project_overrides)` — extending the existing 3-layer merge.

`buildCoords()` becomes **theme-agnostic**: it resolves `regions.*` uniformly. Slide-type rendering iterates `slide_types[type].regions` instead of branching on `theme === 'scroll'`/`'slideshow'`. This eliminates the key-mismatch bug and finally consumes slideshow's coordinates.

> **Scope (2026-06-22)**: the region model's single-source guarantee applies to **PDF generation** (`buildCoords` + the render functions consume `regions.*`). The **HTML preview** layer is intentionally **NOT** driven by the region JSON — it follows the established CSS load order (`styles/base.css` → `themes/<name>/theme.css` → `styles/<style>/style.css`). Driving HTML on-screen layout from regions (i.e., generating CSS variables from the region spec) was considered and **declined** as out of scope for this decision: it would force a CSS-variable generation layer onto the model without changing the PDF output. Keeping the model focused on PDF rectangles preserves its simplicity. "Single source of truth" therefore means *single source for PDF*; HTML remains CSS-driven.
>
> **Addendum (2026-06-22) — AC-4 scope**: confirmed PDF-only. HTML preview remains CSS-driven; region model does not generate CSS variables.

### 3. Preview supports dynamic discovery + scaffolding

`preview.html` discovers themes/styles by scanning the filesystem rather than a hardcoded `THEME_STYLES` map, so a newly created theme/style directory is immediately previewable. A scaffold helper creates the stub directory structure for a new theme/style and opens it in preview.

---

## Alternatives Considered

### Alt A: Per-theme style migration (the superseded proposal)

Place `style.css` + `pdf_color_spec.json` under `themes/<name>/styles/<style>/`, each theme owning its copies, kept identical by a cross-theme consistency validator.

**Rejected because**: it duplicates theme-independent data, and "kept identical by a validator" is a weaker guarantee than a single shared source. If the content must be identical anyway, sharing one file removes both duplication and drift by construction. It also contradicts the code, which already resolves styles from a shared pool.

### Alt B: Hybrid — shared colors, per-theme style.css

Share only `pdf_color_spec.json`; keep `style.css` per-theme.

**Rejected because**: inspection showed `style.css` is also theme-agnostic (~95% `:root` variables; `classic/style.css` has no theme-specific selectors at all). Splitting color from CSS adds complexity for no real divergence benefit.

### Alt C: Fully unified single layout spec (one file, values parameterized by theme)

Express layout in a paradigm-neutral vocabulary so both themes share one spec file, differing only in values.

**Rejected because**: the two paradigms use genuinely different coordinate systems (component positions vs. content box). Forcing them into one lowest-common-denominator vocabulary would be a leaky abstraction. The region model (Alt = the Decision) unifies the *model* while allowing each theme's region *values* to express its paradigm naturally — the maximum practical sharing.

---

## Consequences

### Positive

- **No style/color duplication or drift**: a single shared source guarantees identical appearance across themes.
- **Slideshow PDF correctness fixed**: slideshow's layout coordinates are finally consumed instead of falling back to scroll's defaults.
- **Theme-agnostic rendering**: `buildCoords()` and the render functions have one code path; adding a theme means providing region values, not a new coordinate vocabulary or new render branches.
- **Single source for PDF**: the region model drives `buildCoords()` + render functions, satisfying PDF layout consistency. (HTML preview remains CSS-driven — see Decision #2 Scope, 2026-06-22.)
- **Lower maintenance**: shared foundation + small per-theme extensions; shared layout base + small per-theme deltas.

### Negative / Risks

- **One-time render-layer migration**: both `pdf_layout_spec.json` files must be converted to the region schema, and `buildCoords()` + the four render functions must be rewritten. This is non-trivial but is a strictly forward investment that also fixes the existing slideshow bug.
- **Region mapping risk**: if a theme's layout cannot be cleanly expressed as region compositions, the abstraction leaks. Mitigation: derive initial region values from the current working coordinates and verify via sample PDF comparison before/after.

---

## References

- Design document (revised): `memory/meeting-2026-06-21-html-themes-per-theme-style-design.md`
- Review transcript: `memory/meeting-2026-06-21-html-themes-design-review.md`
- Implementation plan: `C:\Users\USER\.claude\plans\piped-tumbling-reef.md`
