# TTS ↔ Auto-Advance Separation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix TTS pause not persisting across slide transitions, and visually separate TTS controls from auto-advance controls in the footer bar.

**Architecture:** Modify `NarrationEngine._onSlideChanged()` to respect `isPaused` state. Update `_updateButtonStates()` to show 3 TTS states (Play / Pause / Resume) with distinct icons. Restructure footer HTML into two visually separated groups: TTS group and Slide group. Add corresponding CSS.

**Tech Stack:** Vanilla JavaScript, CSS

**Design doc:** `docs/designs/tts-autoplay-separation-design.md`

---

### Task 1: Fix `_onSlideChanged()` — respect isPaused guard

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js:472-483`

- [ ] **Step 1: Add isPaused guard to _onSlideChanged()**

Replace the existing `_onSlideChanged` method (lines 472-483):

```javascript
  _onSlideChanged: function(index) {
    // Called when slide changes during playback
    speechSynthesis.cancel();
    if (this.isPlaying) {
      var self = this;
      setTimeout(function() { self._speak(index); }, 50);
    }
    // Restart auto-advance timer on slide change
    if (this.isAutoAdvance) {
      this._restartAutoAdvanceTimer();
    }
  },
```

With:

```javascript
  _onSlideChanged: function(index) {
    // Cancel any in-flight utterance for the previous slide
    speechSynthesis.cancel();
    // Only auto-speak on the new slide if TTS is actively playing (not paused).
    // When paused, TTS stays silent across slide transitions until user resumes.
    if (this.isPlaying && !this.isPaused) {
      var self = this;
      setTimeout(function() { self._speak(index); }, 50);
    }
    // Restart auto-advance timer on slide change
    if (this.isAutoAdvance) {
      this._restartAutoAdvanceTimer();
    }
  },
```

- [ ] **Step 2: Verify no other code path bypasses isPaused**

Search `ppt-engine.js` for all calls to `_speak()` — confirm each respects `isPlaying` and `isPaused`. The only call sites should be:
- `play()` at line 499: guarded by `this.isPlaying = true` (resetting state) — OK
- `_speak()` at line 412 (no-script auto-advance fallback): inside `if (this.isAutoAdvance)` block, only runs when TTS is playing (called from `_onSpeechEnd` which checks `isPlaying`) — OK
- `_onSlideChanged()` at line 477: now guarded by `!this.isPaused` — FIXED

- [ ] **Step 3: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js
git commit -m "fix(co-deck): TTS pause now persists across slide transitions"
```

---

### Task 2: Update `_updateButtonStates()` — 3-state TTS button with icons

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js:754-772`

- [ ] **Step 1: Replace _updateButtonStates() with 3-state version**

Replace the existing method (lines 754-772):

```javascript
  _updateButtonStates: function() {
    var playBtn = document.getElementById('narration-play-btn');
    var autoBtn = document.getElementById('narration-auto-advance-btn');

    if (playBtn) {
      if (this.isPlaying && !this.isPaused) {
        playBtn.textContent = 'Pause';
        playBtn.classList.add('active');
      } else {
        playBtn.textContent = 'Play';
        playBtn.classList.remove('active');
      }
    }

    if (autoBtn) {
      autoBtn.textContent = this.isAutoAdvance ? 'Auto' : 'Manual';
      autoBtn.classList.toggle('active', this.isAutoAdvance);
    }
  }
```

With:

```javascript
  _updateButtonStates: function() {
    var playBtn = document.getElementById('narration-play-btn');
    var autoBtn = document.getElementById('narration-auto-advance-btn');

    if (playBtn) {
      if (this.isPlaying && !this.isPaused) {
        // Actively speaking
        playBtn.textContent = '⏸ Pause';
        playBtn.classList.add('speaking');
        playBtn.classList.remove('paused');
      } else if (this.isPlaying && this.isPaused) {
        // Paused — user can resume
        playBtn.textContent = '▶ Resume';
        playBtn.classList.add('paused');
        playBtn.classList.remove('speaking');
      } else {
        // Stopped
        playBtn.textContent = '▶ Play';
        playBtn.classList.remove('speaking', 'paused');
      }
    }

    if (autoBtn) {
      autoBtn.textContent = this.isAutoAdvance ? '⏩ Auto' : '⏸ Manual';
      autoBtn.classList.toggle('active', this.isAutoAdvance);
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.js
git commit -m "refactor(co-deck): 3-state TTS button (Play/Pause/Resume) with icons"
```

---

### Task 3: Add footer group CSS styles

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css`

- [ ] **Step 1: Add TTS paused state style and footer group styles**

After the existing `.footer-btn.speaking` block (around line 355), add:

```css
/* ─── TTS paused state ─────────────────────────────────────────────── */
.footer-btn.paused {
  color: var(--accent-color, #D97706);
  border-color: var(--accent-color, #D97706);
}

/* ─── Footer control groups ─────────────────────────────────────────── */
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

- [ ] **Step 2: Commit**

```bash
git add templates/co-deck/docs/html-themes/themes/_shared/ppt-engine.css
git commit -m "feat(co-deck): add footer group separation CSS for TTS/slide controls"
```

---

### Task 4: Restructure footer HTML in all 4 themes

**Files:**
- Modify: `templates/co-deck/docs/html-themes/themes/slideshow/template.html:69-78`
- Modify: `templates/co-deck/docs/html-themes/themes/scroll/template.html:69-80`
- Modify: `templates/co-deck/docs/html-themes/themes/notebook/template.html:69-78`
- Modify: `templates/co-deck/docs/html-themes/themes/pitch-enhanced/template.html:69-80`

The same transformation applies to all 4 files. The pattern is identical — only the surrounding lines may differ slightly.

- [ ] **Step 1: Restructure slideshow/template.html**

Replace lines 69-78 in `slideshow/template.html`:

```html
      <div class="narration-dropdown-wrap">
        <button class="footer-btn" id="voice-lang-btn" onclick="NarrationEngine._toggleLanguageDropdown()" aria-label="언어 선택" title="언어 선택">KR ▾</button>
        <div class="voice-lang-dropdown" id="voice-lang-dropdown"></div>
      </div>
      <button class="footer-btn" id="narration-play-btn" onclick="NarrationEngine.togglePlay()" aria-label="음성 재생" title="음성 재생 (P)">Play</button>
      <button class="footer-btn" id="narration-auto-advance-btn" onclick="NarrationEngine.toggleAutoAdvance()" aria-label="자동 넘기기" title="자동 넘기기 (A)">Manual</button>
      <div class="narration-dropdown-wrap">
        <button class="footer-btn" id="voice-select-btn" onclick="NarrationEngine._toggleVoiceDropdown()" aria-label="음성 선택" title="음성 선택">🎤 Default</button>
        <div class="voice-select-dropdown" id="voice-select-dropdown"></div>
      </div>
```

With:

```html
      <!-- TTS controls group -->
      <div class="footer-tts-group">
        <div class="narration-dropdown-wrap">
          <button class="footer-btn" id="voice-lang-btn" onclick="NarrationEngine._toggleLanguageDropdown()" aria-label="언어 선택" title="언어 선택">KR ▾</button>
          <div class="voice-lang-dropdown" id="voice-lang-dropdown"></div>
        </div>
        <button class="footer-btn" id="narration-play-btn" onclick="NarrationEngine.togglePlay()" aria-label="음성 재생" title="음성 재생 (P)">▶ Play</button>
        <div class="narration-dropdown-wrap">
          <button class="footer-btn" id="voice-select-btn" onclick="NarrationEngine._toggleVoiceDropdown()" aria-label="음성 선택" title="음성 선택">🎤 Default</button>
          <div class="voice-select-dropdown" id="voice-select-dropdown"></div>
        </div>
      </div>
      <!-- Slide advance controls group -->
      <div class="footer-slide-group">
        <button class="footer-btn" id="narration-auto-advance-btn" onclick="NarrationEngine.toggleAutoAdvance()" aria-label="자동 넘기기" title="자동 넘기기 (A)">⏸ Manual</button>
      </div>
```

- [ ] **Step 2: Apply identical change to scroll/template.html**

Same replacement pattern for lines 72-80 in `scroll/template.html`.

- [ ] **Step 3: Apply identical change to notebook/template.html**

Same replacement pattern for lines 70-78 in `notebook/template.html`.

- [ ] **Step 4: Apply identical change to pitch-enhanced/template.html**

Same replacement pattern for lines 72-80 in `pitch-enhanced/template.html`.

- [ ] **Step 5: Commit all 4 template changes**

```bash
git add templates/co-deck/docs/html-themes/themes/slideshow/template.html
git add templates/co-deck/docs/html-themes/themes/scroll/template.html
git add templates/co-deck/docs/html-themes/themes/notebook/template.html
git add templates/co-deck/docs/html-themes/themes/pitch-enhanced/template.html
git commit -m "feat(co-deck): restructure footer into TTS and Slide control groups"
```

---

### Task 5: Visual verification

- [ ] **Step 1: Open a presentation HTML in browser**

Open any existing co-deck presentation (e.g., `co-deck2/presentations/b2b-enterprise-ax-strategy/lecture_b2b-ax-strategy_v1.html`) and verify:

**TTS pause persistence:**
1. Click `▶ Play` → TTS starts, button shows `⏸ Pause`
2. Click `⏸ Pause` → button shows `▶ Resume` (accent color)
3. Enable `⏩ Auto` → slides advance on timer, but TTS stays paused
4. Click `▶ Resume` → TTS resumes on current slide
5. Click `⏸ Pause` again → navigate slides manually → TTS stays paused

**UI grouping:**
1. TTS controls (language, play, voice) are grouped with a left border separator
2. Slide controls (auto-advance) are in a separate group
3. Icons are visible: `▶ Play`, `⏸ Pause`, `▶ Resume`, `⏩ Auto`, `⏸ Manual`

- [ ] **Step 2: Test with slideshow and scroll themes at minimum**

Confirm the footer layout renders correctly in at least 2 themes (all 4 share the same CSS, so 2 is sufficient).
