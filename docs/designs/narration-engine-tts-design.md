# Auto-Play with TTS Narration — Design Spec

**Date**: 2026-06-23
**Status**: Approved
**Target**: `templates/co-deck/` variant — all PPT themes (slideshow, scroll, notebook, pitch-enhanced)

---

## 1. Overview

Add an Auto-Play feature with Text-to-Speech (TTS) narration to the co-deck presentation engine. When the user presses Play, the speaker script for each slide is read aloud using the browser's built-in Web Speech API, and slides advance automatically (or manually, based on mode toggle).

### Goals

- Presenters can rehearse presentations with voice narration
- Multi-language narration support (Korean, English, Japanese) with optional translated scripts
- Works in all PPT themes via shared `ppt-engine.js`
- Zero external dependencies — browser-native Web Speech API only

### Non-Goals

- Offline audio file generation or pre-rendered voice tracks
- Cloud TTS services (Google Cloud TTS, OpenAI TTS, etc.)
- Voice recording or audio export

---

## 2. Architecture

### 2.1 New Component: `NarrationEngine`

A new object added to `ppt-engine.js`, following the same pattern as existing objects (`TransitionEngine`, `PresenterTools`, `ThumbnailNav`).

```
NarrationEngine {
  // State
  isPlaying: false          // TTS is currently speaking
  isAutoMode: true          // auto-advance on speech end (default ON)
  language: 'ko'           // current narration language
  currentUtterance: null    // SpeechSynthesisUtterance reference

  // Core API
  play()                    // Start/resume narration from current slide
  pause()                   // Pause speech + stop auto-advance
  stop()                    // Full stop, cancel speech
  togglePlay()              // Play/pause toggle (for button)
  toggleAuto()              // Toggle auto-advance mode
  setLanguage(lang)         // Switch narration language (ko/en/ja)
  cycleLanguage()           // Cycle through ko -> en -> ja -> ko
  getScript(index)          // Get script text for slide at index, based on language
  getAvailableVoices(lang)  // Get available voices for a language

  // Internal
  _speak(index)             // Create utterance and speak slideData[index] script
  _onSpeechEnd()            // Handle end of speech (auto-advance or wait)
  _onSlideChanged(index)    // Called when slide changes during playback
  _updateButtonStates()    // Sync play/auto button visual states
}
```

### 2.2 Script Field Resolution

The `NarrationEngine.getScript(index)` function resolves the script text based on the selected language:

| `NarrationEngine.language` | Field read | Fallback |
|----------------------------|------------|----------|
| `'ko'` | `slideData[i].script` | (none — this is the primary field) |
| `'en'` | `slideData[i].scriptEn` | `slideData[i].script` |
| `'ja'` | `slideData[i].scriptJa` | `slideData[i].script` |

If the specific language field doesn't exist, falls back to the base `script` field (Korean). This ensures graceful degradation when translated scripts aren't provided.

### 2.3 Language-to-Voice Mapping

```javascript
var LANG_VOICE_MAP = {
  ko: ['ko-KR', 'ko_KR', 'korean'],
  en: ['en-US', 'en-GB', 'en_AU', 'english'],
  ja: ['ja-JP', 'ja_JP', 'japanese']
};
```

`NarrationEngine.setLanguage(lang)` finds the best matching voice from `speechSynthesis.getVoices()`. If no matching voice is found, it falls back to the default voice.

---

## 3. Behavior Specification

### 3.1 Auto Mode (default ON)

```
User clicks [Play]
  -> NarrationEngine.play()
  -> _speak(currentSlide) -- reads script in selected language
  -> speechSynthesisUtterance.onend fires
  -> _onSpeechEnd()
    -> if isAutoMode && currentSlide < lastSlide
      -> wait 800ms (pause between slides)
      -> changeSlide(1)
      -> _speak(currentSlide) -- read next slide script
    -> if last slide reached
      -> NarrationEngine.stop() -- natural end
```

### 3.2 Manual Mode (auto OFF)

```
User clicks [Play]
  -> NarrationEngine.play()
  -> _speak(currentSlide) -- reads script
  -> speechSynthesisUtterance.onend fires
  -> _onSpeechEnd()
    -> isAutoMode is false
    -> wait for user to manually advance

User clicks [Next] or uses arrow key
  -> speechSynthesis.cancel() -- interrupt current speech
  -> changeSlide(1)
  -> if NarrationEngine.isPlaying
    -> _speak(currentSlide) -- start reading new slide
```

### 3.3 Navigation During Playback

Any slide navigation during playback (thumbnail click, arrow keys, next/prev button):

```javascript
// Modified showSlide() -- add at the end:
if (NarrationEngine.isPlaying) {
  NarrationEngine._onSlideChanged(currentSlide);
}
```

`_onSlideChanged(index)`:
1. `speechSynthesis.cancel()` — stop current speech immediately
2. If `isPlaying` is still true, start `_speak(index)` for the new slide

### 3.4 Pause/Resume

```
User clicks [Pause]
  -> speechSynthesis.pause()
  -> isPlaying remains true (paused, not stopped)
  -> Auto-advance timer is suspended

User clicks [Play] again
  -> speechSynthesis.resume()
  -> If speech had already ended before pause
    -> _onSpeechEnd() fires naturally
```

### 3.5 Edge Cases

| Case | Behavior |
|------|----------|
| Slide has no script text | Skip to next slide in auto mode (no pause) |
| All slides have no scripts | Play button does nothing, no speech |
| Voice not available for language | Use default voice, show subtle warning |
| Browser doesn't support Speech API | Hide all narration UI elements |
| Presentation ends during playback | Natural stop, button resets to Play |

---

## 4. UI Design

### 4.1 Footer Bar Additions

New buttons added to `.footer-right`, positioned before the timer:

```
[Transition btns] [Notes] | [Language btn] [Play btn] [Auto btn] | [Timer] [Prev Next]
```

### 4.2 New HTML Elements (in template.html)

```html
<!-- Language selector -->
<button class="footer-btn" id="voice-lang-btn" onclick="NarrationEngine.cycleLanguage()" aria-label="Language" title="Language">KR</button>

<!-- Play/Pause button -->
<button class="footer-btn" id="narration-play-btn" onclick="NarrationEngine.togglePlay()" aria-label="Play narration" title="Play narration">Play</button>

<!-- Auto-advance toggle -->
<button class="footer-btn active" id="narration-auto-btn" onclick="NarrationEngine.toggleAuto()" aria-label="Auto advance" title="Auto advance">Auto</button>
```

### 4.3 Button States

| State | Play Button | Auto Button |
|-------|------------|-------------|
| Idle | `Play` (normal) | `Auto` (active by default) |
| Playing (auto) | `Pause` (active + pulse animation) | `Auto` (active) |
| Playing (manual) | `Pause` (active + pulse animation) | `Manual` (normal) |
| Paused | `Play` (normal) | unchanged |
| Speaking | Play button has `.speaking` class (pulse CSS animation) | -- |

### 4.4 Keyboard Shortcuts

| Key | Action | Context |
|-----|--------|---------|
| `P` | Toggle play/pause | Always |
| `A` | Toggle auto/manual mode | Always |

### 4.5 CSS Additions (ppt-engine.css)

```css
/* Speaking pulse animation */
.footer-btn.speaking {
  animation: speak-pulse 1.5s ease-in-out infinite;
}

@keyframes speak-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.4); }
  50% { box-shadow: 0 0 0 4px rgba(217, 119, 6, 0); }
}
```

---

## 5. Data Model Changes

### 5.1 slideData Extended Fields

New optional fields added to `slideData` entries:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `script` | string | Yes (existing) | Primary narration text (Korean) |
| `scriptEn` | string | No (new) | English translation of narration |
| `scriptJa` | string | No (new) | Japanese translation of narration |

### 5.2 slide_deck.md Format Update

New optional fields in the slide markdown format:

```markdown
---
## Slide 01 -- Title

- **section**: Intro
- **type**: cover
- **script**: Korean script text...
- **scriptEn**: English narration text...     # Optional
- **scriptJa**: Japanese narration text...     # Optional
---
```

### 5.3 Storyline Agent Updates

The storyline agent (`agents/storyline.md`) and skill (`skills/storyline/SKILL.md`) will be updated to:

1. **Mandate** the `script` field for every slide (currently ad hoc)
2. **Optionally generate** `scriptEn` and `scriptJa` when the lecture profile requests multi-language support
3. Add a new optional field to `lecture-profile.md`: `narrationLanguages: [ko, en]` or `narrationLanguages: [ko, en, ja]`

### 5.4 Lecture Profile Extension

New optional configuration in `lecture-profile.md`:

```yaml
narration:
  enabled: true              # Enable TTS narration in the HTML output
  languages: [ko, en, ja]   # Which languages to generate scripts for (ko is always included)
  defaultLanguage: ko        # Default narration language in the player
```

---

## 6. Files to Modify

| File | Change | Scope |
|------|--------|-------|
| `docs/html-themes/themes/_shared/ppt-engine.js` | Add `NarrationEngine` object, modify `showSlide()` for TTS integration, add keyboard shortcuts (P, A), add `speechSynthesis` feature detection | Core feature |
| `docs/html-themes/themes/_shared/ppt-engine.css` | Add `.speaking` animation styles | UI styles |
| `docs/html-themes/themes/slideshow/template.html` | Add narration buttons to footer, add `NarrationEngine.init()` call | Template |
| `docs/html-themes/themes/scroll/template.html` | Same as slideshow | Template |
| `docs/html-themes/themes/notebook/template.html` | Same as slideshow | Template |
| `docs/html-themes/themes/pitch-enhanced/template.html` | Same as slideshow | Template |
| `agents/storyline.md` | Add `script` as required field, add optional `scriptEn`/`scriptJa` | Agent definition |
| `skills/storyline/SKILL.md` | Same as storyline agent | Skill definition |
| `docs/lecture-profile.md` | Add `narration` config section | Template |
| `docs/html-themes/THEMES.md` | Document NarrationEngine in theme engine docs | Documentation |

---

## 7. Browser Compatibility

| Browser | Web Speech API | Korean Voice | Notes |
|---------|---------------|-------------|-------|
| Chrome 33+ | Full support | Google Korean (high quality) | Best experience |
| Safari 7+ | Full support | macOS Korean voice | Good quality |
| Edge 14+ | Full support | Same as Chrome | Chromium-based |
| Firefox | Partial | May need user gesture | Limited on some platforms |

### Feature Detection

```javascript
var SpeechAPISupported = 'speechSynthesis' in window;
// If false, hide all narration buttons in initPPT()
```

---

## 8. Implementation Order

### Phase 1: Core TTS Engine (ppt-engine.js + ppt-engine.css)
1. Add `NarrationEngine` object to `ppt-engine.js`
2. Modify `showSlide()` for TTS integration
3. Add keyboard shortcuts (P, A)
4. Add CSS for speaking animation
5. Add feature detection to `initPPT()`

### Phase 2: Template UI (all 4 PPT themes)
1. Add narration buttons to footer in all template.html files
2. Add `NarrationEngine.init()` call in DOMContentLoaded

### Phase 3: Pipeline Integration
1. Update `agents/storyline.md` -- mandate `script` field
2. Update `skills/storyline/SKILL.md` -- same
3. Add multi-language script fields (optional)
4. Update `docs/lecture-profile.md` -- narration config

### Phase 4: Documentation
1. Update `docs/html-themes/THEMES.md`
2. Update `docs/co-deck.context.md`
