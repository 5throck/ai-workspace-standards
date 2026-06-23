# Design: Thumbnail Panel → Headline Navigation

**Date**: 2026-06-23
**Status**: ✅ Implemented
**Variant**: co-deck
**Scope**: ppt-engine.js, ppt-engine.css (all 4 PPT themes)

## Problem

The current thumbnail panel uses DOM cloning (`cloneNode(true)`) + CSS `transform: scale(0.14)` to show miniature slide previews. At 14% scale, text is unreadable and layout structure is indistinguishable — rendering the thumbnails ineffective for their primary use case: **slide navigation** (finding and jumping to a specific slide).

## Decision

Replace DOM-clone thumbnails with a **headline-based text navigation list**.

Each thumbnail item displays the slide number and headline text extracted from `slideData[i]`, providing instant content identification without visual scaling artifacts.

## Design

### UI Layout

```
┌────────────────────────┐
│ 1  Introduction        │  ← active (accent color badge, bold text)
│ 2  Problem Statement   │
│ 3  Solution Overview   │
│ 4  Architecture        │
│ 5  Demo                │
│ 6  Q&A                 │
│ 7  Thank You           │
└────────────────────────┘
```

### Headline Extraction

Priority order for extracting the display text from each slide:
1. `slideData[i].title` — primary source (all slide types have this)
2. `slideData[i].subtitle` — fallback (cover slides)
3. `"Slide " + (i + 1)` — last resort

### Behavior (unchanged)

- **Click**: calls `showSlide(i)` to navigate
- **Highlight**: `ThumbnailRenderer.highlight(index)` updates active styling + `scrollIntoView()`
- **Toggle**: `T` key and footer button via `ThumbnailNav.toggle()` — panel width transitions to 0
- **Keyboard**: all existing keyboard shortcuts remain

## Implementation (as-built)

### `ppt-engine.js` — ThumbnailRenderer.init()

DOM clone logic replaced with headline text extraction. Unused `tempContainer`/`slideW`/`slideH` variables removed.

```javascript
// After (headline text — IMPLEMENTED):
slideData.forEach(function(data, i) {
  var item = el('div', 'thumbnail-item' + (i === 0 ? ' active' : ''));
  item.dataset.index = i;
  item.onclick = function() { showSlide(i); };

  // Slide number badge
  item.appendChild(el('div', 'thumb-label', String(i + 1)));

  // Headline text extracted from slideData
  var headline = data.title || data.subtitle || ('Slide ' + (i + 1));
  item.appendChild(el('div', 'thumb-headline', headline));

  panel.appendChild(item);
});
```

### `ppt-engine.css` — thumbnail styles (as-built)

`.thumb-slide` styles removed. `.thumbnail-item` changed from fixed-aspect-ratio container to flex row layout. `.thumb-label` changed from absolute-positioned overlay to flex badge. `.thumb-headline` added as text label with ellipsis truncation.

```css
/* Individual thumbnail item */
.thumbnail-item {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  border-radius: 4px;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
  flex-shrink: 0;
  padding: 4px 6px;
}

/* Slide number badge */
.thumbnail-item .thumb-label {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  min-width: 20px;
  text-align: center;
  line-height: 1.4;
}

.thumbnail-item.active .thumb-label {
  color: var(--accent-color, #D97706);
}

/* Headline text */
.thumbnail-item .thumb-headline {
  font-size: 11px;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.thumbnail-item.active .thumb-headline {
  color: #fff;
  font-weight: 600;
}
```

### Out of Scope

- Template HTML changes — the `<aside class="thumbnail-panel">` container structure remains identical
- Scroll theme TOC sidebar (`#toc-panel` in preview tool) — separate feature, untouched
- `measure-layout.ts` — screenshot-based validation, not affected
- `gen-visual-images.ts` — SVG diagram generation, not affected

## Trade-offs

| Aspect | Headline Nav | Previous (DOM Clone) |
|--------|-------------|---------------------|
| Navigation speed | Fast — read title, click | Slow — visually scan blobs |
| Performance | Light — text nodes only | Heavy — N full DOM clones |
| Visual fidelity | N/A (text-only) | High scale = unreadable |
| Accessibility | Screen reader friendly | Clone content duplicated |

## Files Modified

| File | Change |
|------|--------|
| `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js` | ThumbnailRenderer.init(): replace clone with text extraction; remove unused tempContainer variables |
| `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css` | Replace `.thumb-slide` + `.thumbnail-item` with flex-row layout; add `.thumb-headline` styles |
