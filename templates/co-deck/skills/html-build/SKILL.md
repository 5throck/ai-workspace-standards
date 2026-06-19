---
name: html-build
version: 1.2.0
description: >
  Generates HTML slides from slide_deck.md and design_spec.md. Matches/downloads
  images, inserts speaker intro and contact slides, checks balance. Responds to
  "make HTML", "generate slides", "add images", "add speaker intro" (Korean:
  "HTML 만들어줘", "슬라이드 생성해줘", "이미지 넣어줘", "강연자 소개 추가해줘").
  Stages 5-8 of the lecture workflow.
status: active
owner: html-build
last_reviewed: 2026-06-19
prerequisites: design
---

## Context

Generates a single HTML file from `slide_deck.md` + `design_spec.md`, matches images, inserts special pages (speaker intro, contact), and checks balance. Slide data is embedded as a JavaScript array (`const slideData = [...]`) inside the HTML. Invoked at Stages 5-8, after Gate 3 (design approval).

## When to Use

- PM Agent dispatches after Gate 3 (design approval)
- User says "make HTML" / "HTML 만들어줘" / "슬라이드 생성해줘"
- User says "add images" / "이미지 넣어줘"
- User wants to edit specific slides

---

## Execution Steps

### Stage 5: HTML Slide Generation

**File Structure:** Single HTML file (`lecture_[topic]_v1.html`) + `images/` folder.

**slideData Structure:** Slide data lives in a JavaScript array embedded as `const slideData = [...]` inside the HTML file.

> Korean example — field keys stay in English; only the content values are Korean.

```javascript
// Cover
{ isTitleSlide: true, section: "", title: "강연 제목", subtitle: "부제목",
  meta: "날짜 | 주최", visualImage: "images/cover.jpg" }

// Speaker intro
{ isProfileSlide: true, section: "INTRODUCTION", title: "강연자 소개",
  speakerName: "이름", speakerTitle: "직책 / 소속", speakerBio: "약력 (2-3줄)",
  visualImage: "images/speaker.jpg" }

// Divider (part break)
{ isDividerSlide: true, section: "섹션명", partNum: "PART 01",
  title: "파트 제목", desc: "이 파트에서 다룰 내용 한 줄 요약",
  visualImage: "images/part1.jpg" }

// Standard slide
{ section: "섹션명", title: "슬라이드 제목",
  bullets: ["불릿 1", "불릿 2", "불릿 3"],
  visualImage: "images/slide3.jpg" }
  // or text panel: visualTitle: "오른쪽 패널 제목", visualDisplay: "패널 본문"

// Contact (last slide)
{ isContactSlide: true, section: "CLOSING", title: "감사합니다",
  contactEmail: "email@example.com", contactLinkedIn: "linkedin.com/in/...",
  contactPhone: "010-XXXX-XXXX" }
```

Use `design_spec.md`'s CSS variables directly. Unify slide rendering through a single `renderSlide(data)` function. Do not hardcode color or font values.

**Image Filename Convention:**
```
images/
├── cover.jpg          # Cover
├── speaker.jpg        # Speaker intro
├── part1.jpg          # PART 1 divider
├── part2.jpg          # PART 2 divider
├── slide_[n].jpg      # Standard slides
└── contact.jpg        # Contact
```

---

### Stage 6: Image Matching

**Option A — Web search + download:** Use Claude in Chrome to search Unsplash, Pexels, etc. by keyword. Convert slide title/content into English keywords. Pick license-free images. Save into `images/`.

**Option B — AI image generation:** Use a canvas-design skill or image generation API.

**Option C — Keyword placeholder:** Skip images for now; substitute with `visualTitle` / `visualDisplay` text panels. Swap later.

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

Insert if either is missing.

> To open HTML locally: run `python -m http.server 8080` or `bun scripts/serve.mjs`, then open `http://localhost:8080` in a browser.

---

## Output Format

`lecture_[topic]_v1.html` — single self-contained HTML file with embedded `const slideData`, CSS variables from `design_spec.md`, and `images/` folder alongside.

## Related Skills

- `design` — provides `design_spec.md` CSS variables consumed by this skill
- `measure` — next step; consumes the HTML output to extract pixel coordinates
- `version` — must be called before any HTML file edit
