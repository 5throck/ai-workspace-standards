---
name: html-build
phases: [4]
handoff_to: [measure]
handoff_from: [design, pm]
required_skills: [lecture-html-build]
---

# Build Agent — HTML Slide Production

**Stage**: Stages 5-8 (HTML generation + images + review + special pages)  
**Output**: `presentations/<project>/lecture_vN.html`, `images/`

## Goal

- Generate a single HTML file from `slide_deck.md` + `design_spec.md`
- Match each slide with an image
- Insert speaker intro and contact slides
- Self-check overall balance and adjust

---

## Stage 5: HTML Slide Generation

### File Structure
Single HTML file (`lecture_[topic]_v1.html`) + `images/` folder.

### slideData Structure
Slide data lives in a JavaScript array, embedded as `const slideData = [...]` inside the HTML file.

> Korean example — the actual lecture content is Korean because the audience is Korean. Field keys stay in English; only the content values are Korean.

```javascript
// Cover
{
  isTitleSlide: true,
  section: "",
  title: "강연 제목",          // Korean content example
  subtitle: "부제목",          // Korean content example
  meta: "날짜 | 주최",         // Korean content example
  visualImage: "images/cover.jpg"
}

// Speaker intro
{
  isProfileSlide: true,
  section: "INTRODUCTION",
  title: "강연자 소개",        // Korean content example
  speakerName: "이름",         // Korean content example
  speakerTitle: "직책 / 소속", // Korean content example
  speakerBio: "약력 (2-3줄)",  // Korean content example
  visualImage: "images/speaker.jpg"
}

// Divider (part break)
{
  isDividerSlide: true,
  section: "섹션명",
  partNum: "PART 01",
  title: "파트 제목",
  desc: "이 파트에서 다룰 내용 한 줄 요약",
  visualImage: "images/part1.jpg"
}

// Standard slide
{
  section: "섹션명",
  title: "슬라이드 제목",
  bullets: [
    "불릿 포인트 1",
    "불릿 포인트 2",
    "불릿 포인트 3"
  ],
  visualImage: "images/slide3.jpg",   // optional, when image is available
  // or text panel
  visualTitle: "오른쪽 패널 제목",
  visualDisplay: "패널 본문 내용"
}

// Contact (last slide)
{
  isContactSlide: true,
  section: "CLOSING",
  title: "감사합니다",
  contactEmail: "email@example.com",
  contactLinkedIn: "linkedin.com/in/...",
  contactPhone: "010-XXXX-XXXX"
}
```

### CSS Writing
Use `design_spec.md`'s CSS variables directly. Unify slide rendering through a single `renderSlide(data)` function.

---

## Stage 6: Image Matching

### Image Preparation Options

**Option A — Web search + download**
Use Claude in Chrome to search Unsplash, Pexels, etc. by keyword:
- Convert slide title/content into English keywords
- Pick license-free images
- Save into `images/`

**Option B — AI image generation**
Use a canvas-design skill or image generation API.

**Option C — Keyword placeholder**
Skip images for now; substitute with `visualTitle` / `visualDisplay` text panels. Swap later.

### Image Filename Convention
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

## Stage 7: Balance Check

Self-check after generating the HTML:

- [ ] Total slide count matches the plan
- [ ] Slide counts per chapter are balanced (within ±20%)
- [ ] No slides with more than 5 bullets
- [ ] No more than 3 consecutive slides without visuals
- [ ] No overly long bullets (recommend under 40 chars/line)

If any issue, split or merge slides.

---

## Stage 8: Special Pages

- **Speaker intro**: right after the cover (slide 2)
- **Contact**: last slide

Insert if either is missing.

---

## Core Tools

- `Write` (generate HTML)
- Browser tool (image search/download)
- `bash` (local server, image processing)
- Always call Version Agent before editing files

---

## Next Step

Share the completed HTML with the user and request review (Gate 4: optional review).
After approval, advance to Measure Agent (`agents/measure.md`).

> To open HTML locally: run `python -m http.server 8080` or `bun scripts/serve.mjs`, then open `http://localhost:8080` in a browser.
