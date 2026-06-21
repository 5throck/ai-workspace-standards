---
name: html-build
version: 1.3.0
description: >
  Generates HTML slides from slide_deck.md and design_spec.md. Applies theme
  (data-theme attribute), binds images from image-manifest.json, inserts speaker
  intro and contact slides, checks balance. Responds to "make HTML", "generate
  slides", "add images", "add speaker intro" (Korean: "HTML 만들어줘", "슬라이드
  생성해줘", "이미지 넣어줘", "강연자 소개 추가해줘"). Stages 5-8 of the lecture
  workflow.
status: active
owner: html-build
last_reviewed: 2026-06-20
prerequisites: design
---

## Context

Generates a single HTML file from `slide_deck.md` + `design_spec.md`, applies theme from `lecture-profile.md`, binds images from `image-manifest.json`, inserts special pages (speaker intro, contact), and checks balance. Slide data is embedded as a JavaScript array (`const slideData = [...]`) inside the HTML. Invoked at Stages 5-8, after Gate 3 (design approval).

## When to Use

- PM Agent dispatches after Gate 3 (design approval)
- User says "make HTML" / "HTML 만들어줘" / "슬라이드 생성해줘"
- User says "add images" / "이미지 넣어줘"
- User wants to edit specific slides

---

## Execution Steps

### Stage 5: HTML Slide Generation

**File Structure:** Single HTML file (`lecture_[topic]_v1.html`) + `assets/images/` folder.

**slideData Structure:** Slide data lives in a JavaScript array embedded as `const slideData = [...]` inside the HTML file.

> Korean example — field keys stay in English; only the content values are Korean.

```javascript
// Cover
{ isTitleSlide: true, section: "", title: "강연 제목", subtitle: "부제목",
  meta: "날짜 | 주최", visualImage: "../assets/images/lecture-hall-professional.jpg" }

// Speaker intro
{ isProfileSlide: true, section: "INTRODUCTION", title: "강연자 소개",
  speakerName: "이름", speakerTitle: "직책 / 소속", speakerBio: "약력 (2-3줄)",
  visualImage: "../assets/images/speaker-portrait.jpg" }

// Divider (part break)
{ isDividerSlide: true, section: "섹션명", partNum: "PART 01",
  title: "파트 제목", desc: "이 파트에서 다룰 내용 한 줄 요약",
  visualImage: "../assets/images/ai-transformation-abstract.jpg" }

// Standard slide
{ section: "섹션명", title: "슬라이드 제목",
  bullets: ["불릿 1", "불릿 2", "불릿 3"],
  visualImage: "../assets/images/data-analysis-dashboard.jpg" }
  // or text panel: visualTitle: "오른쪽 패널 제목", visualDisplay: "패널 본문"

// Contact (last slide)
{ isContactSlide: true, section: "CLOSING", title: "감사합니다",
  contactEmail: "email@example.com", contactLinkedIn: "linkedin.com/in/...",
  contactPhone: "010-XXXX-XXXX" }
```

Use `design_spec.md`'s CSS variables directly. Unify slide rendering through a single `renderSlide(data)` function. Do not hardcode color or font values.

**Theme + Style injection** (from `lecture-profile.md` → `presentation.theme` + `presentation.style`):
```html
<html lang="ko" data-theme="scroll" data-style="classic">
<link rel="stylesheet" href="../../docs/html-themes/base/base.css">
<link rel="stylesheet" href="../../docs/html-themes/styles/classic/style.css">
```
Available themes: `scroll | slideshow`. Available styles: `classic | minimal | visual-heavy | academic`. Defaults: `scroll` + `classic`.

**Image paths:** All images live in the shared pool at `presentations/assets/images/`. Use `../assets/images/<slug>.<ext>` (relative from `presentations/<project>/`). Slug is the `path` field basename from `image-manifest.json`. No slide-number prefix.

---

### Stage 6: Image Binding

Read `image-manifest.json` and bind downloaded images to matching slideData entries by slide index. For slides where no image was found by the Image Curator:
- If slide has `image_role: background` → switch to `visualTitle` / `visualDisplay` text panel fallback
- If slide has `image_role: illustrative` → omit the right panel; switch to full-text layout
- Never use placeholder or generic images — always use manifest paths or text fallback

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

`lecture_[topic]_v1.html` — single self-contained HTML file with embedded `const slideData`, theme `data-theme` attribute, base + override CSS links, and `assets/images/` alongside.

## Related Skills

- `design` — provides `design_spec.md` CSS variables consumed by this skill
- `image-curator` — produces `image-manifest.json` that maps slide indices to image paths
- `measure` — next step; consumes the HTML output to extract pixel coordinates
- `version` — must be called before any HTML file edit
