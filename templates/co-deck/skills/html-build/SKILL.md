---
name: html-build
version: 1.5.0
description: >
  Generates HTML slides from slide_deck.md and design_spec.md. Applies theme
  (data-theme attribute), binds images from image-manifest.json, inserts speaker
  intro and contact slides, checks balance. Responds to "make HTML", "generate
  slides", "add images", "add speaker intro" (Korean: "HTML 만들어줘", "슬라이드
  생성해줘", "이미지 넣어줘", "강연자 소개 추가해줘"). Stages 5-8 of the lecture
  workflow.
status: active
owner: html-build
last_reviewed: 2026-06-24
prerequisites: design
---

## Context

Generates a single HTML file from `slide_deck.md` + `design_spec.md`, applies theme from `lecture-profile.md`, binds images from `image-manifest.json`, inserts special pages (speaker intro, contact), and checks balance. Slide data is embedded as a **strict-JSON** array (`const slideData = [...]`) inside the HTML. Strict-JSON means: all keys double-quoted, all string values double-quoted, no trailing commas, no JavaScript comments, no single-quoted strings, no template literals. Invoked at Stages 5-8, after Gate 3 (design approval).

## When to Use

- PM Agent dispatches after Gate 3 (design approval)
- User says "make HTML" / "HTML 만들어줘" / "슬라이드 생성해줘"
- User says "add images" / "이미지 넣어줘"
- User wants to edit specific slides

---

## Execution Steps

### Stage 5: HTML Slide Generation

**File Structure:** Single HTML file (`lecture_[topic]_v1.html`) + `assets/images/` folder.

**slideData Structure:** Slide data lives as a **strict-JSON** array embedded as `const slideData = [...]` inside the HTML file. All keys and string values must use double-quotes; no trailing commas, no JS comments. This enables `extract_slidedata.mjs` to parse via `JSON.parse` directly without a transform step.

> Korean example — field keys stay in English; only the content values are Korean.

```javascript
// Cover
{ isTitleSlide: true, section: "", title: "강연 제목", subtitle: "부제목",
  meta: "날짜 | 주최", visualImage: "../assets/images/lecture-hall-professional.jpg",
  backgroundImage: "../assets/images/bg-deck.jpg" }

// Speaker intro (visualImage → portrait avatar on profile slides)
{ isProfileSlide: true, section: "INTRODUCTION", title: "강연자 소개",
  speakerName: "이름", speakerTitle: "직책 / 소속", speakerBio: "약력 (2-3줄)",
  visualImage: "../assets/images/speaker-portrait.jpg" }

// Divider (part break)
{ isDividerSlide: true, section: "섹션명", partNum: "PART 01",
  title: "파트 제목", desc: "이 파트에서 다룰 내용 한 줄 요약",
  visualImage: "../assets/images/ai-transformation-abstract.jpg",
  backgroundImage: "../assets/images/bg-deck.jpg" }

// Standard slide (image)
{ section: "섹션명", title: "슬라이드 제목",
  bullets: ["불릿 1", "불릿 2", "불릿 3"],
  visualImage: "../assets/images/data-analysis-dashboard.jpg" }

// Standard slide (text panel — structured visualDisplay)
// visualDisplay supports structured rendering via renderVisualDisplay():
//   [Box Title]  → .visual-heading (bold, accented)
//   ✓ / → / •    → .visual-item .visual-item-check (list marker)
//   (default)    → .visual-paragraph (normal text)
{ section: "섹션명", title: "슬라이드 제목",
  bullets: ["불릿 1", "불릿 2"],
  visualTitle: "핵심 포인트", visualDisplay: "[현재 상황]\n✓ 항목 1\n✓ 항목 2\n\n[개선 방향]\n→ 방향 1\n→ 방향 2" }

// Contact (last slide)
{ isContactSlide: true, section: "CLOSING", title: "감사합니다",
  contactEmail: "email@example.com", contactLinkedIn: "linkedin.com/in/...",
  contactPhone: "010-XXXX-XXXX" }

// Punchline (impactful closing)
{ isPunchlineSlide: true, section: "", title: "핵심 메시지" }
```

Use `design_spec.md`'s CSS variables directly. Unify slide rendering through a single `renderSlide(data)` function. Do not hardcode color or font values.

**Theme + Style injection** (from `lecture-profile.md` → `presentation.theme` + `presentation.style`):
```html
<html lang="ko" data-theme="scroll" data-style="premium-dark">
<link rel="stylesheet" href="../../docs/html-themes/styles/base.css">
<link rel="stylesheet" href="../../docs/html-themes/styles/premium-dark/style.css">
```
Available themes: `notebook | pitch | pitch-enhanced | scroll | slideshow`. Available styles: `classic | minimal | visual-heavy | academic | premium-dark`. Defaults: `scroll` + `premium-dark`.

**Theme capabilities:**
- All 5 themes support `visualImage`, `visualTitle`/`visualDisplay` text panels, profile avatars, `contactPhone`, and `isPunchlineSlide`.
- `pitch` and `pitch-enhanced` use `slide-content` grid (left text + right visual panel) for standard slides.
- `notebook`, `scroll`, `slideshow` use `slide-card` (content + right-panel) for standard slides.
- `pitch-enhanced`, `notebook`, `scroll`, `slideshow` support PPT features (thumbnails, transitions, timer, speaker notes, TTS).
- `pitch` uses its own layout (TOC drawer, no thumbnails, no transitions).
- `visual-heavy` style uses `--slide-bg-image` CSS variable for full-bleed background images.

**Narration config injection** (from `lecture-profile.md` → `narration` section):
Read the `narration` block from `lecture-profile.md` and inject a `narrationConfig` object into the `initPPT()` call. This bridges lecture profile settings to the runtime NarrationEngine:
```javascript
// Inject before the DOMContentLoaded listener or alongside initPPT call
var narrationConfig = {
  enabled: true,
  autoAdvance: false,
  autoAdvanceInterval: 5,
  defaultLanguage: 'ko',
  languages: ['ko']
};
initPPT({ transition: 'fade', showTimer: true, showThumbnails: true, narration: narrationConfig });
```
- `enabled: false` → hides all narration/auto-advance buttons in the HTML viewer
- `autoAdvance: true` → enables auto-advance timer (independent of narration)
- `languages` → populates the language dropdown (only languages with scripts in slideData are clickable)
- If `narration` section is absent or `enabled: false`, set `enabled: false`

**Image paths:** All images live in the shared pool at `presentations/assets/images/`. Use `../assets/images/<slug>.<ext>` (relative from `presentations/<project>/`). Slug is the `path` field basename from `image-manifest.json`. No slide-number prefix.

---

### Stage 6: Image Binding

Read `image-manifest.json` and bind downloaded images to matching slideData entries by slide index. For slides where no image was found by the Image Curator:
- If slide has `image_role: background` → switch to `visualTitle` / `visualDisplay` text panel fallback
- If slide has `image_role: illustrative` → omit the right panel; switch to full-text layout
- Never use placeholder or generic images — always use manifest paths or text fallback

**Background image binding** (when `lecture-profile.md` → `background_image.enabled` is true):

1. Read `background_image` config from `lecture-profile.md`
2. Read the global background image path from `image-manifest.json` → `background_image.path`
3. Convert to relative path: `../assets/images/<slug>.<ext>`
4. Inject `backgroundImage` field into `slideData` entries based on scope:
   - `all` → every slide gets `"backgroundImage": "../assets/images/bg-deck.jpg"`
   - `divider-cover` → only slides where `isTitleSlide`, `isDividerSlide`, or `isPunchline` is true
   - `individual` → only slides with `image_role: "background"` in the manifest
5. The template's `renderSlide()` reads `data.backgroundImage` and sets `--slide-bg-image` CSS variable (consumed by `visual-heavy/style.css` for full-bleed backgrounds)

---

### Stage 7: Balance Check

Self-check after generating the HTML:

- [ ] Total slide count matches the plan
- [ ] Slide counts per chapter are balanced (within ±20%)
- [ ] No slides with more than 5 bullets
- [ ] No more than 3 consecutive slides without visuals
- [ ] No overly long bullets (recommend under 40 chars/line)

If any issue, split or merge slides.

---

### Stage 8: Special Pages

- **Speaker intro**: right after the cover (slide 2)
- **Contact**: last slide

Insert if either is missing. Populate with `instructor` fields from `lecture-profile.md`.

> To open HTML locally: `bunx serve .` → `http://localhost:3000`

---

## Output Format

`lecture_[topic]_v1.html` — single self-contained HTML file with embedded `const slideData` (strict JSON), theme `data-theme` attribute, base + override CSS links, and `assets/images/` alongside.

> PDF pipeline note: `scripts/co-deck/extract_slidedata.mjs` parses the inline `const slideData = [...]` array via a bracket-depth state machine (not regex, not DOM). The slideData array **MUST be strict JSON** — all keys double-quoted, string values double-quoted, no trailing commas, no JS comments, no single quotes. Non-JSON syntax will break the PDF pipeline.
>
> **Encoding**: All output HTML files MUST be UTF-8 without BOM. Verify `<meta charset="UTF-8">` is present in `<head>`. On Korean Windows systems, ensure `chcp 65001` is active before writing files to prevent CP949 corruption of Korean text content.

## Related Skills

- `design` — provides `design_spec.md` CSS variables consumed by this skill
- `image-curator` — produces `image-manifest.json` that maps slide indices to image paths
- `measure` — next step; consumes the HTML output to extract pixel coordinates
- `version` — must be called before any HTML file edit
