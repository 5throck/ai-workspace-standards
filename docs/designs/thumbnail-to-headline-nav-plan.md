# Thumbnail → Headline Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the DOM-clone thumbnail panel in co-deck PPT themes with a headline-based text navigation list for better slide navigation.

**Architecture:** Modify `ThumbnailRenderer.init()` in `ppt-engine.js` to extract `title` from each `slideData[i]` entry and render a text-based list item instead of cloning the slide DOM. Update CSS in `ppt-engine.css` to style text items instead of scaled slide clones.

**Tech Stack:** Vanilla JavaScript (no dependencies), CSS

**Design doc:** `docs/designs/thumbnail-to-headline-nav-design.md`

---

### Task 1: Modify ThumbnailRenderer.init() in ppt-engine.js

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js:49-95`

- [ ] **Step 1: Replace DOM clone logic with headline text extraction**

In `ThumbnailRenderer.init()`, replace lines 55-77 (the temporary container measurement + DOM clone block) with headline extraction from `slideData[i]`:

Replace the `forEach` body (lines 60-80):

```javascript
    slideData.forEach(function(data, i) {
      // Create thumbnail item wrapper
      var item = el('div', 'thumbnail-item' + (i === 0 ? ' active' : ''));
      item.dataset.index = i;
      item.onclick = function() { showSlide(i); };

      // Slide number badge
      item.appendChild(el('div', 'thumb-label', String(i + 1)));

      // Headline text extracted from slideData
      var headline = data.title || data.subtitle || ('Slide ' + (i + 1));
      var headlineEl = el('div', 'thumb-headline', headline);
      item.appendChild(headlineEl);

      panel.appendChild(item);
    });
```

Also remove the now-unused temporary container variables (lines 55-58):

```javascript
      // REMOVE these lines:
      // var tempContainer = document.getElementById('presentation');
      // var slideW = 1280; // default reference
      // var slideH = 720;
```

- [ ] **Step 2: Verify no other references to removed variables**

Search `ppt-engine.js` for `slideW`, `slideH`, `tempContainer` — confirm they are only used within the removed block and nowhere else in the file.

- [ ] **Step 3: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js
git commit -m "refactor(co-deck): replace DOM-clone thumbnails with headline text navigation"
```

---

### Task 2: Update CSS for headline-based navigation in ppt-engine.css

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css:79-122`

- [ ] **Step 1: Replace thumbnail item styles**

Replace the `.thumbnail-item` block (lines 80-90) — remove `aspect-ratio: 16 / 9` since we no longer need fixed-proportion containers for slide clones:

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

.thumbnail-item:hover {
  border-color: var(--thumb-hover-border, rgba(255,255,255,0.3));
  background-color: rgba(255, 255, 255, 0.05);
}

.thumbnail-item.active {
  border-color: var(--accent-color, #D97706);
  box-shadow: 0 0 0 1px var(--accent-color, #D97706);
  background-color: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 2: Remove .thumb-slide styles and replace .thumb-label**

Remove the `.thumb-slide` block (lines 101-108) entirely — no longer needed.

Replace `.thumb-label` (lines 110-122) with a compact slide-number badge:

```css
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
```

- [ ] **Step 3: Add .thumb-headline styles**

Add after `.thumb-label`:

```css
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

- [ ] **Step 4: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css
git commit -m "refactor(co-deck): update thumbnail panel CSS for headline navigation layout"
```

---

### Task 3: Visual verification

- [ ] **Step 1: Open an existing presentation HTML in a browser**

Use any existing co-deck presentation HTML (e.g., `co-deck2/presentations/b2b-enterprise-ax-strategy/lecture_b2b-ax-strategy_v1.html`) and verify:
- Thumbnail panel shows slide numbers + titles as a text list
- Active slide is highlighted with accent color
- Clicking a headline navigates to that slide
- `T` key toggles the panel
- Panel scrolls to keep active item visible
- Text truncation works for long titles (`text-overflow: ellipsis`)

- [ ] **Step 2: Test with all 4 themes**

Verify the headline nav works correctly in:
1. slideshow
2. scroll
3. notebook
4. pitch-enhanced

(Each theme uses the shared `ppt-engine.js`/`ppt-engine.css`, so the change applies uniformly.)

---

### Task 4: Update design doc

- [ ] **Step 1: Fix field name in design doc**

In `docs/designs/thumbnail-to-headline-nav-design.md`, update the "Headline Extraction" section to reflect the actual `slideData` field names found in the codebase:

```markdown
### Headline Extraction

Priority order for extracting the display text from each slide:
1. `slideData[i].title` — primary source (all slide types have this)
2. `slideData[i].subtitle` — fallback (cover slides)
3. `"Slide " + (i + 1)` — last resort
```

- [ ] **Step 2: Commit design doc update**

```bash
git add docs/designs/thumbnail-to-headline-nav-design.md
git commit -m "docs: fix slideData field names in thumbnail-to-headline design doc"
```
