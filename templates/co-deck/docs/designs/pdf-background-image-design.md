# Background Image Rendering Design

**Variant**: co-deck
**Date**: 2026-06-23
**Status**: Implemented
**Version**: gen-slides-pdf.ts v1.7.0

---

## Problem Statement

The co-deck variant only supported solid RGB colors as slide backgrounds in both HTML and PDF output. There was no mechanism to use images as slide backgrounds for atmospheric or visual storytelling effects. While `--slide-bg-image` CSS variable was consumed by `visual-heavy/style.css`, it was never produced by any `template.html` `renderSlide()` function — a pre-existing design gap.

## Design Decisions

### D1: Configuration Architecture — Approach B (lecture-profile.md independent section)

**Decision**: Background image configuration lives in an independent `background_image` section in `lecture-profile.md`, NOT inside `pdf_color_spec.json`.

**Rationale**:
- Consistent with the existing `layout_overrides` pattern (project-level override, not style-level)
- `pdf_color_spec.json` defines role-based color values — background images are a different concern
- Allows background image config to change per-project without modifying shared style files

### D2: Scope Modes

| Scope | Slides affected | Use case |
|-------|---------------|----------|
| `all` | Every slide | Full atmospheric presentation |
| `divider-cover` | Title, divider, punchline only | Subtle accent on section breaks (default) |
| `individual` | Per-slide from manifest | Maximum control per slide |

### D3: Image Source Priority

```
image-manifest.json background_image entry → slideData.backgroundImage → fallback_color solid fill
```

1. **image-manifest.json**: Image-curator adds global entry (`slide_index: -1`, `scope: "global"`) and optional per-slide entries
2. **slideData.backgroundImage**: Fallback from html-build binding (for individual scope)
3. **fallback_color**: Solid fill if no image available (null = use pdf_color_spec background)

### D4: Rendering Pipeline

**HTML**:
1. `image-curator` downloads background image to `assets/images/bg-deck.<ext>`
2. `html-build` reads `background_image` config from lecture-profile.md
3. `html-build` binds `backgroundImage` path into slideData array per scope logic
4. `template.html` `renderSlide()` sets `--slide-bg-image` CSS variable on `.slide` element
5. `style.css` renders as `background-image: url(...)` with `background-size: cover`

**PDF**:
1. `gen-slides-pdf.ts` reads `background_image` section from lecture-profile.md
2. Resolves image path per slide using `resolveBgImagePath()` (scope-aware)
3. Calls `placeImageCover()` — full-bleed cover-crop via pdf-lib clip operators
4. Calls `fillRectOverlay(color, opacity)` — semi-transparent rectangle using pdf-lib native `opacity` parameter
5. Wrapped in try/catch — missing/corrupt images fall back to solid fill

### D5: Overlay System

- `overlay.color`: RGB array `[R, G, B]` (default: `[0, 0, 0]`)
- `overlay.opacity`: 0.0–1.0 (default: `0.4`)
- PDF: uses pdf-lib's native `opacity` parameter on `drawRectangle()` (v1.17+)
- HTML: uses `rgba()` in the CSS variable or an overlay div layer

### D6: Prompt Timing

Background image preference is asked at **Stage 0** (initial project setup), alongside theme, style, source verification, and divider mode confirmations. This ensures the image-curator agent (Stage 3.5) knows whether to download a background image before html-build and pdf-export.

## Changed Files

| File | Change | Version |
|------|--------|---------|
| `docs/lecture-profile.md` | Added `background_image` section | — |
| `agents/image-curator.md` | Added background_image responsibility | v1.3.0 |
| `docs/html-themes/themes/*/template.html` (×5) | Added `--slide-bg-image` CSS variable injection in `renderSlide()` | — |
| `agents/html-build.md` | Added background_image reading + binding instructions | v1.1.0 |
| `skills/html-build/SKILL.md` (+ `.claude`, `.gemini`) | Added Stage 6 background image binding | v1.4.0 |
| `scripts/co-deck/gen-slides-pdf.ts` | Added `BgImageConfig`, `parseBackgroundImage()`, `resolveBgImagePath()`, `fillRectOverlay()`, render loop integration | v1.7.0 |
| `agents/pdf-export.md` | Added background image rendering docs | v2.1.0 |
| `skills/pdf-export/SKILL.md` (+ `.claude`, `.gemini`) | Added background image rendering section | v2.1.0 |
| `AGENTS.md` | Added background_image to Stage 0 confirmations | — |
| `scripts/co-deck/SCRIPTS.md` | Updated gen-slides-pdf.ts v1.7.0 | — |
| `docs/co-deck.context.md` | Updated rule 14, added rule 17 | v3.4 |

## Spec Self-Review

### Placeholder Scan
- ✅ No TODO/FIXME/HACK placeholders in any changed file
- ✅ No version numbers left as "x.y.z" or "TBD"
- ✅ No "sample" or "example" text that should be replaced

### Internal Consistency
- ✅ All 5 template.html files have identical `--slide-bg-image` injection logic
- ✅ All 3 pdf-export SKILL.md copies (skills/, .claude/, .gemini/) are synced to v2.1.0
- ✅ All 3 html-build SKILL.md copies synced to v1.4.0
- ✅ gen-slides-pdf.ts version (v1.7.0) matches SCRIPTS.md registry entry
- ✅ pdf-export.md version (v2.1.0) matches pdf-export SKILL.md version
- ✅ html-build.md version (v1.1.0) matches html-build SKILL.md version
- ✅ image-curator.md version (v1.3.0) referenced consistently

### Scope Check
- ✅ No files outside co-deck variant were modified
- ✅ No L1 common scripts or templates were changed
- ✅ No core audit scripts (audit.ts, validate-templates.ts) were modified
- ✅ All changes respect the 4-layer spec merge (no hardcoded values in scripts)

### Ambiguity Check
- ✅ Scope modes are explicitly defined with slide type mapping
- ✅ Image source priority chain is documented
- ✅ Overlay defaults are specified (color: [0,0,0], opacity: 0.4)
- ✅ Error handling (try/catch with fallback) is documented
- ✅ Fallback behavior when no image is available is defined
