# Design: Pitch-Enhanced UX Fixes + Diagram Path Unification

**Date**: 2026-06-24
**Status**: Approved
**Scope**: co-deck variant template

## Summary

Five changes to the co-deck variant:

1. Thumbnail panel starts hidden on all PPT themes
2. Auto-advance defaults to Manual (config cannot silently override)
3. Right panel text content vertically centered
4. Right panel image box enlarged (50/50 grid) with `object-fit: contain`
5. SVG/PNG diagram storage unified to `presentations/assets/diagrams/`

---

## Change 1: Thumbnail Panel — Start Hidden

**Problem**: All PPT themes (pitch-enhanced, scroll, notebook, slideshow) start with the thumbnail panel visible. Users must manually close it. Presentations should begin with a clean, full-screen slide view.

**Solution**: Default `showThumbnails` to `false` in `initPPT()` calls across all PPT theme templates.

**Files**:
- `docs/html-themes/themes/_shared/ppt-engine.js` — change default behavior in `initPPT()`
- `docs/html-themes/themes/pitch-enhanced/template.html` — `showThumbnails: false`
- `docs/html-themes/themes/scroll/template.html` — `showThumbnails: false`
- `docs/html-themes/themes/notebook/template.html` — `showThumbnails: false`
- `docs/html-themes/themes/slideshow/template.html` — `showThumbnails: false`

**Behavior**: Panel is hidden on load. User opens via the thumbnail toggle button or `T` key. State persists per session.

---

## Change 2: Auto-Advance — Default Manual

**Problem**: Although `NarrationEngine.isAutoAdvance` defaults to `false`, the `init()` method can enable it via `narrationConfig.autoAdvance` from lecture-profile.md, silently overriding the default.

**Solution**: Remove config-driven auto-enable. Auto-advance can only be activated by explicit user action (clicking the "⏸ Manual" button or pressing `A` key).

**Files**:
- `docs/html-themes/themes/_shared/ppt-engine.js` — remove `autoAdvance` config handling in `NarrationEngine.init()`

**Behavior**: Button always shows "⏸ Manual" on load. Config can no longer silently set auto-advance.

---

## Change 3: Right Panel Text — Vertical Center

**Problem**: When the right panel contains text (`.slide-visual`) instead of an image, the text is top-aligned. For visual balance, text should be vertically centered.

**Solution**: Add `justify-content: center` and `align-items: center` to `.slide-visual`.

**Files**:
- `docs/html-themes/themes/pitch-enhanced/theme.css`

**Before**:
```css
.slide-visual {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 12px;
}
```

**After**:
```css
.slide-visual {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border-radius: 12px;
  padding: 1.5rem;
  box-sizing: border-box;
}
```

---

## Change 4: Right Panel Image Box — Enlarge + Contain

**Problem**: The pitch-enhanced grid uses `1.15fr 0.85fr` (57/43 split), giving insufficient space to images. Images use `object-fit: cover` which crops content. Users report images being partially or fully cut off.

**Solution**:
1. Change grid to `1fr 1fr` (50/50 split)
2. Change `.right-panel img` from `object-fit: cover` to `object-fit: contain`
3. Add padding to `.right-panel` for breathing room
4. Add subtle background so images have a visible boundary when using `contain`

**Files**:
- `docs/html-themes/themes/pitch-enhanced/theme.css`

**Changes**:
```css
/* Grid ratio change */
.slide-content {
  grid-template-columns: 1fr 1fr;  /* was 1.15fr 0.85fr */
}

/* Right panel padding */
.right-panel {
  padding: 1rem;
  box-sizing: border-box;
}

/* Image fit change */
.right-panel img {
  object-fit: contain;  /* was cover */
}
```

---

## Change 5: SVG/PNG Storage — Unified to Shared Pool

**Problem**: Dual-path diagram storage exists:
- `diagram-specialist` agent writes to `presentations/assets/diagrams/` (shared pool)
- `gen-visual-images.ts` writes to `presentations/<project>/images/` (per-project)

This causes confusion and a known integration gap with PDF export.

**Solution**: Modify `gen-visual-images.ts` to output to `presentations/assets/diagrams/` (shared pool), matching the diagram-specialist convention. Update `slideData[i].visualImage` path from `images/<stem>.png` to `../assets/diagrams/<stem>.png`.

**Files to modify**:
| File | Change |
|------|--------|
| `scripts/co-deck/gen-visual-images.ts` | Output dir → `presentations/assets/diagrams/`; SVG path alongside PNG |
| `docs/co-deck.context.md` | Update Visual Diagram Pipeline paths and File Organization table |
| `agents/html-build.md` | Update image reference paths for diagrams |
| `scripts/co-deck/SCRIPTS.md` | Update gen-visual-images.ts description |

**Files verified (no change needed)**:
- `agents/diagram-specialist.md` — already uses `presentations/assets/diagrams/` ✅
- `agents/image-curator.md` — owns `presentations/assets/images/` (photos only, no change) ✅

**Path reference flow after change**:
```
gen-visual-images.ts → presentations/assets/diagrams/<stem>.svg + .png
slideData[i].visualImage = "../assets/diagrams/<stem>.png"
HTML renderSlide() → <img src="../assets/diagrams/<stem>.png">
PDF gen-slides-pdf.ts → resolves from project dir
```

---

## Self-Review Checklist

- [x] No placeholders or TBDs
- [x] Internal consistency — all path references align
- [x] Scope check — focused, single implementation plan
- [x] Ambiguity check — grid ratio confirmed (1fr 1fr), object-fit confirmed (contain)
