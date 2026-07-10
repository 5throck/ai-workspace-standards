---
lang: ko
lang_reason: source-material
---

# Design: TTS ↔ Auto-Advance Separation

**Date**: 2026-06-23
**Status**: ✅ Implemented
**Variant**: co-deck
**Scope**: ppt-engine.js, ppt-engine.css (all 4 PPT themes), template.html (all 4 themes)

## Problem

Two issues with the current NarrationEngine:

1. **TTS/Auto-advance coupling bug**: When TTS is paused but auto-advance is ON, auto-advance fires `changeSlide(1)`, which calls `_onSlideChanged()`, which calls `_speak()` because `isPlaying=true` — effectively resuming TTS on the next slide despite the user having paused it.

2. **UI ambiguity**: TTS controls (`Play`/`Pause`) and auto-advance controls (`Manual`/`Auto`) appear adjacent in the footer bar with no visual grouping. Users cannot distinguish which button controls what.

## Decision

**Behavior**: TTS pause/resume is fully independent from auto-advance. Pausing TTS means TTS stays paused across slide transitions until the user explicitly resumes.

**UI**: Separate TTS and auto-advance controls into two visually distinct groups with icons and labels.

## Behavior Matrix

| TTS State | Auto-Advance | Slide Transition Behavior |
|-----------|-------------|--------------------------|
| Playing | ON | TTS drives timing: speech end → 800ms → next slide. Timer suppressed while speaking. |
| Playing | OFF | TTS ends → stop. User manually advances. |
| **Paused** | ON | **TTS stays paused.** Auto-advance timer drives slide transitions without speech. |
| Paused | OFF | Everything stopped. User manually controls both. |
| Stopped | ON | Auto-advance drives slides. No speech. |
| Stopped | OFF | Fully manual. |

## Implementation (as-built)

### ppt-engine.js — NarrationEngine

#### Fix 1: `_onSlideChanged()` — isPaused guard

Added `!this.isPaused` condition to prevent TTS auto-resume on slide change:

```javascript
_onSlideChanged: function(index) {
  speechSynthesis.cancel();
  if (this.isPlaying && !this.isPaused) {  // ← added isPaused guard
    var self = this;
    setTimeout(function() { self._speak(index); }, 50);
  }
  if (this.isAutoAdvance) {
    this._restartAutoAdvanceTimer();
  }
},
```

#### Fix 2: `_updateButtonStates()` — 3-state TTS button

Replaced 2-state (`Play`/`Pause` with `.active` class) with 3-state button using distinct icons and CSS classes:

| State | Text | CSS Class |
|-------|------|-----------|
| Stopped | `▶ Play` | (none) |
| Speaking | `⏸ Pause` | `.speaking` (pulse animation) |
| Paused | `▶ Resume` | `.paused` (accent color) |

Auto-advance button also updated with icons:
- ON: `⏩ Auto` + `.active`
- OFF: `⏸ Manual`

#### Fix 3: Centralized `.speaking` class management

Removed redundant `.speaking` class manipulation from 4 locations — now centralized in `_updateButtonStates()`:
- `utterance.onstart` callback
- `utterance.onend` callback
- `utterance.onerror` callback
- `stop()` method

### ppt-engine.css — Footer group separation

Added visual grouping and paused state styles:

```css
.footer-btn.paused {
  color: var(--accent-color, #D97706);
  border-color: var(--accent-color, #D97706);
}

.footer-tts-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  border-left: 1px solid var(--border-subtle);
}

.footer-slide-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}
```

### template.html — Footer restructure (all 4 themes)

Restructured footer buttons into two visually separated groups:

**Before** (flat row, no grouping):
```
[📝 노트] [KR▾] [Play] [Manual] [🎤 Default] [00:00 ⏱] [◀ ▶]
```

**After** (grouped with separator):
```
[📝 노트] | [KR▾] [▶ Play] [🎤 Default] | [⏸ Manual] | [00:00 ⏱] [◀ ▶]
            ── TTS ──                    ── Slide ──
```

Applied identically to: `slideshow`, `scroll`, `notebook`, `pitch-enhanced` templates.
(`pitch` v1.0.0 excluded — does not use NarrationEngine.)

## Files Modified

| File | Change |
|------|--------|
| `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js` | `_onSlideChanged()`: isPaused guard; `_updateButtonStates()`: 3-state + icons; removed 4 stale `.speaking` management sites |
| `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css` | Added `.footer-btn.paused`, `.footer-tts-group`, `.footer-slide-group` |
| `templates/co-deck/docs/html-themes/themes/slideshow/template.html` | Footer regrouped into TTS/Slide groups |
| `templates/co-deck/docs/html-themes/themes/scroll/template.html` | Footer regrouped into TTS/Slide groups |
| `templates/co-deck/docs/html-themes/themes/notebook/template.html` | Footer regrouped into TTS/Slide groups |
| `templates/co-deck/docs/html-themes/themes/pitch-enhanced/template.html` | Footer regrouped into TTS/Slide groups |

## Out of Scope

- NarrationEngine language/voice selection logic — unchanged
- Timer (PresenterTools) — unchanged
- Transition engine — unchanged
- Keyboard shortcuts — `P` for TTS toggle, `A` for auto-advance toggle remain as-is
