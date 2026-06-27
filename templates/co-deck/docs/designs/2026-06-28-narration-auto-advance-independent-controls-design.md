# Design: Narration & Auto-Advance Independent Config-Driven Controls + Doc Gap Fixes

**Date**: 2026-06-28
**Status**: Approved
**Scope**: co-deck variant template

## Summary

Two workstreams:

1. **Part A — Documentation gap fixes**: 9 inconsistencies between `co-deck.context.md` and the current implementation, identified by comparing design documents against actual code/files.
2. **Part B — NarrationEngine v2.3**: Separate narration (TTS) and auto-advance into two independent top-level config sections in `lecture-profile.md`, each with its own `enabled` flag and config-driven initial state.

---

## Part A: Documentation Gap Fixes

### A.1: co-deck.context.md — 9 Fixes

| # | Section | Current (Incorrect) | Fixed |
|---|---------|---------------------|-------|
| 1 | Agents table — Measure row | "Playwright-based", outputs "layout_spec.json, pdf_layout_spec.md" | Rebrand to "Prep PDF"; `estimate-layout.ts` (Playwright-free), outputs `layout_summary.md`; version bump to prep-pdf skill |
| 2 | Scripts table | Missing 7 scripts | Add `auto-calibrate.ts`, `validate-theme-styles.ts`, `validate-image-manifest.ts`, `generate-themes-manifest.ts`, `scaffold-theme-style.ts`, `gen-visual-images.ts`, `diagram-helpers.ts` |
| 3 | Skills table | Missing `prep-pdf` skill | Add row: `prep-pdf` \| `skills/prep-pdf/SKILL.md` \| measure \| active |
| 4 | Lecture Profile — key fields example | Missing `narration`, `auto_advance`, `background_image`, `instructor.linkedin/phone`, `source_verification`, `layout_overrides` | Add all missing fields to the YAML example block |
| 5 | Agents table header | Says "10 agents", diagram-specialist not in table | Fix to "11 agents", add `Diagram Specialist` row |
| 6 | Pipeline Stages — Stage 9-10 | "Measure → layout_spec.json, pdf_layout_spec.md" | Update to "Prep PDF → layout_summary.md" |
| 7 | "Agents that read this file" list | Missing `pdf-export` | Add row: `pdf-export` reads `background_image`, `layout_overrides` |
| 8 | Domain Rule 5 | "PDF requires layout measurement — always run Measure Agent before Export Agent" | Update to reference the Playwright-free prep-pdf workflow |
| 9 | Tech Stack table | "HTML Renderer: Playwright (Chromium) — optional, for measure-layout.ts only" | Change to "Playwright — **deprecated** (optional, for legacy `measure-layout.ts` only; use `estimate-layout.ts` instead)" |

---

## Part B: Narration & Auto-Advance Independent Controls

### B.1: Problem Statement

Three limitations in the current NarrationEngine v2.2:

1. **Narration and auto-advance are conflated** — Both features are configured under a single `narration:` section in `lecture-profile.md`. This creates conceptual confusion: `narration.enabled: false` hides the auto-advance button too, and there is no way to enable auto-advance without also enabling the narration section.

2. **`autoAdvance` is "informational only"** — `lecture-profile.md` → `narration.autoAdvance` is explicitly ignored by the runtime. Auto-advance always starts as Manual regardless of config. Users want config-driven control.

3. **No auto-play for narration** — There is no way to set narration to auto-start on page load. For self-running kiosk presentations, manual interaction is required on every page load.

### B.2: Design Decision — Two Independent Top-Level Sections

Separate `narration:` and `auto_advance:` into two independent top-level sections in `lecture-profile.md`, each with its own `enabled` flag.

**Rationale:**
- Each feature has a distinct purpose: TTS speech vs. timed slide progression
- Each feature has its own UI controls: TTS play button/language/voice vs. auto-advance toggle
- Each feature has its own keyboard shortcut: 'P' vs. 'A'
- Users may want one without the other (e.g., auto-advance without TTS for a visual kiosk)
- Separation at the config level mirrors the runtime separation already present in `ppt-engine.js`

### B.3: New lecture-profile.md Schema

```yaml
# ── Narration (TTS) settings ──────────────────────────────────────
# Controls the Web Speech API text-to-speech feature in the HTML viewer.
# Independent from auto_advance — both can run simultaneously or separately.
narration:
  # Whether to show TTS narration controls in the HTML viewer
  # false → hides TTS play button, language dropdown, voice selector;
  #          disables 'P' keyboard shortcut
  # true  → shows TTS controls (default)
  enabled: true
  # Whether to auto-start TTS narration on page load
  # true  → begins reading slide 1 script automatically
  # false → narration starts paused; user clicks Play or presses 'P' (default)
  auto_play: false
  # Languages for which to generate translated narration scripts.
  # The primary language (from `language` field) always gets a `script` field.
  # Additional languages generate `scriptEn`, `scriptJa`, etc.
  # Options: empty list (primary only) | [ko, en, ja] (all three)
  languages: []
  # Default narration language in the HTML player
  # Options: ko | en | ja (must be in `languages` or match `language` field)
  default_language: ko

# ── Auto-Advance settings ─────────────────────────────────────────
# Controls automatic slide progression in the HTML viewer.
# Independent from narration — both can run simultaneously or separately.
# When narration IS playing and auto-advance is ON: slides advance after
# narration ends (~800ms delay). When narration is NOT playing: slides
# advance on a timer.
auto_advance:
  # Whether to show auto-advance controls in the HTML viewer
  # false → hides auto-advance toggle button; disables 'A' keyboard shortcut
  # true  → shows auto-advance controls (default)
  enabled: true
  # Whether to start auto-advance as "Auto" on page load (config-driven)
  # true  → auto-advance timer starts immediately on page load
  # false → auto-advance starts as "Manual"; user toggles via button or 'A' key (default)
  start_as_auto: false
  # Interval between auto-advance slides when narration is NOT playing (seconds)
  # When narration IS playing, slides advance after narration ends (~800ms).
  interval: 8
```

### B.4: Independence Model (8 Combinations)

**UI Visibility:**

| narration.enabled | auto_advance.enabled | UI Visible |
|---|---|---|
| true | true | TTS + Auto-advance controls (default) |
| true | false | TTS controls only |
| false | true | Auto-advance controls only |
| false | false | Fully manual (no special UI) |

**On-load behavior:**

| narration.auto_play | auto_advance.start_as_auto | On-load behavior |
|---|---|---|
| false | false | Both paused (default) |
| true | false | TTS starts reading, auto-advance manual |
| false | true | Auto-advance timer starts, TTS paused |
| true | true | Both start automatically (kiosk mode) |

### B.5: NarrationEngine v2.3 Runtime Changes

**File**: `docs/html-themes/themes/_shared/ppt-engine.js`

#### Change 1: Two independent config objects

**Before (v2.2):**
```javascript
var narrationConfig = {
  enabled: true,
  autoAdvance: false,
  autoAdvanceInterval: 8,
  defaultLanguage: 'ko',
  languages: ['ko']
};
initPPT({ transition: 'fade', showTimer: true, showThumbnails: false, narration: narrationConfig });
```

**After (v2.3):**
```javascript
var narrationConfig = {
  enabled: true,
  autoPlay: false,
  defaultLanguage: 'ko',
  languages: ['ko']
};
var autoAdvanceConfig = {
  enabled: true,
  startAsAuto: false,
  interval: 8
};
initPPT({ transition: 'fade', showTimer: true, showThumbnails: false,
          narration: narrationConfig, autoAdvance: autoAdvanceConfig });
```

#### Change 2: Separate init methods

`NarrationEngine.init()` handles TTS-only logic (speechSynthesis, voices, language dropdown, TTS play button).

New `NarrationEngine.initAutoAdvance()` handles auto-advance-only logic (timer interval, start_as_auto, auto-advance button).

#### Change 3: Per-engine UI hiding

- `narration.enabled: false` → hides `narration-play-btn`, `voice-lang-btn`, `voice-select-btn`; sets `this._enabled = false`
- `auto_advance.enabled: false` → hides `narration-auto-advance-btn`; sets `this._autoAdvanceEnabled = false`

#### Change 4: Per-engine keyboard shortcut guards

```javascript
if (e.key === 'p' || e.key === 'P') {
  if (!NarrationEngine._enabled) return;           // TTS guard
  NarrationEngine.togglePlay();
}
if (e.key === 'a' || e.key === 'A') {
  if (!NarrationEngine._autoAdvanceEnabled) return;  // auto-advance guard
  NarrationEngine.toggleAutoAdvance();
}
```

#### Change 5: Config-driven auto_advance initial state

```javascript
initAutoAdvance: function(config) {
  config = config || {};
  this._autoAdvanceEnabled = config.enabled !== false;

  if (!this._autoAdvanceEnabled) {
    var btn = document.getElementById('narration-auto-advance-btn');
    if (btn) btn.style.display = 'none';
    return;
  }
  if (config.interval) this._autoAdvanceInterval = config.interval * 1000;
  if (config.startAsAuto) {
    this.isAutoAdvance = true;
    this._startAutoAdvanceTimer();
    this._updateButtonStates();
  }
}
```

#### Change 6: Config-driven narration auto-play

```javascript
// In init():
if (config.autoPlay) this._autoPlay = true;

// In initPPT(), after NarrationEngine.init():
if (NarrationEngine._autoPlay && NarrationEngine._enabled) {
  requestAnimationFrame(function() { NarrationEngine.play(); });
}
```

#### Change 7: Version bump

Header comment: `NarrationEngine v2.2` → `NarrationEngine v2.3`

### B.6: html-build SKILL.md Updates (×3 copies)

**Files**:
- `skills/html-build/SKILL.md`
- `.claude/skills/html-build/SKILL.md`
- `.gemini/skills/html-build/SKILL.md`

Update the narrationConfig injection section to show two independent config objects with updated descriptions.

### B.7: co-deck.context.md + THEMES.md Updates

- NarrationEngine v2.2 → v2.3 description: document independent engine model
- Update the "Agents that read this file" table to show `html-build` reads both `narration` and `auto_advance`

## Changed Files

| File | Change Type | Description |
|------|------------|-------------|
| `docs/lecture-profile.md` | Config schema | Split `narration` into two independent sections: `narration:` (TTS) + `auto_advance:` (auto-slide); snake_case fields |
| `docs/html-themes/themes/_shared/ppt-engine.js` | Runtime code | v2.3: independent init methods, per-engine UI guards, config-driven auto_play and start_as_auto |
| `docs/co-deck.context.md` | Doc | 9 gap fixes (Part A) + NarrationEngine v2.3 independent model (Part B) |
| `docs/html-themes/THEMES.md` | Doc | NarrationEngine v2.3 + independent model |
| `skills/html-build/SKILL.md` | Doc | narrationConfig + autoAdvanceConfig split |
| `.claude/skills/html-build/SKILL.md` | Doc | Same (platform copy) |
| `.gemini/skills/html-build/SKILL.md` | Doc | Same (platform copy) |
| `agents/html-build.md` | Doc | Two-section reading instructions |

**No changes to**:
- `gen-slides-pdf.ts` — PDF pipeline does not handle narration/auto-advance (HTML-only)
- `variant.json` — no new scripts or skills
- Theme `template.html` files — no structural changes
- CSS files — no style changes
- `scripts/co-deck/*.ts` — no TypeScript script changes

## Backward Compatibility

- Existing profiles without `auto_advance:` section → defaults to `enabled: true, start_as_auto: false, interval: 8`
- Existing `narration.autoAdvance` field → deprecated, silently ignored (no error)
- Existing `narration.autoAdvanceInterval` field → deprecated, silently ignored
- html-build agent must handle both old (single `narration` section) and new (two-section) formats

## Spec Self-Review

### Placeholder Scan
- ✅ No TODO/FIXME/HACK placeholders
- ✅ No version numbers left as "x.y.z" or "TBD"
- ✅ No "sample" or "example" text that needs replacement

### Internal Consistency
- ✅ All 3 SKILL.md copies receive identical updates
- ✅ ppt-engine.js v2.3 header matches co-deck.context.md and THEMES.md descriptions
- ✅ narrationConfig + autoAdvanceConfig examples in SKILL.md match lecture-profile.md schema
- ✅ `narration.enabled` hides only TTS UI; `auto_advance.enabled` hides only auto-advance UI
- ✅ snake_case field names consistent with existing `background_image`, `source_verification`

### Scope Check
- ✅ No files outside co-deck variant modified
- ✅ No L1 common scripts or templates changed
- ✅ No core audit scripts modified
- ✅ PDF pipeline untouched (narration is HTML-only)

### Ambiguity Check
- ✅ `auto_advance.start_as_auto`: explicit — true = timer starts on load, false = manual start
- ✅ `narration.auto_play`: explicit — true = TTS starts on load, false = paused
- ✅ Each `enabled` flag controls only its own feature's UI
- ✅ Keyboard shortcut guards clearly defined per-feature
- ✅ User can still toggle P/A at runtime regardless of initial config
- ✅ Interaction when both are active is documented (narration drives timing when playing)
