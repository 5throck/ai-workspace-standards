---
name: html-build
version: 1.0.0
description: >
  Generates HTML slides from slide_deck.md and design_spec.md. Matches/downloads
  images, inserts speaker intro and contact slides, checks balance. Responds to
  "make HTML", "generate slides", "add images", "add speaker intro" (Korean:
  "HTML 만들어줘", "슬라이드 생성해줘", "이미지 넣어줘", "강연자 소개 추가해줘").
  Stages 5-8 of the lecture workflow.
---
# Build Agent — HTML Slide Production

**Stage**: Stages 5-8 (HTML generation + images + review + special pages)  
**Output**: `presentations/<project>/lecture_vN.html`, `images/`  
**Full instructions**: `agents/html-build.md`

## Role

Generates a single HTML file from `slide_deck.md` + `design_spec.md`, matches images, inserts special pages (speaker intro, contact), and checks balance.
Slide data is embedded as a JavaScript array (`const slideData = [...]`) inside the HTML.
Always call Version Agent before editing the HTML file.

## When to Invoke

- PM Agent dispatches after Gate 3 (design approval)
- User says "make HTML" / "HTML 만들어줘" / "슬라이드 생성해줘"
- User says "add images" / "이미지 넣어줘"
- User wants to edit specific slides

## Quick Reference

**Inputs**: `slide_deck.md`, `design_spec.md`

**slideData field reference** (one object per slide):
```javascript
// Cover
{ isTitleSlide: true, section, title, subtitle, meta, visualImage }

// Speaker intro
{ isProfileSlide: true, section, title, speakerName, speakerTitle, speakerBio, visualImage }

// Divider (part break)
{ isDividerSlide: true, section, partNum, title, desc, visualImage }

// Standard slide
{ section, title, bullets: [...], visualImage }   // image panel
{ section, title, bullets: [...], visualTitle, visualDisplay }  // text panel

// Contact (last slide)
{ isContactSlide: true, section, title, contactEmail, contactLinkedIn, contactPhone }
```

**Balance check** (self-review before handing off):
- Total slide count matches plan?
- Chapter counts balanced (±20%)?
- No slide with more than 5 bullets?
- No more than 3 consecutive slides without visuals?

**Local preview**: `python -m http.server 8080` → `http://localhost:8080/presentations/<project>/lecture_vN.html`

**Next step**: Request user review (Gate 4 — optional). Then advance to Measure Agent (`agents/measure.md`).

→ Image matching options, CSS writing guide, special-page rules: see `agents/html-build.md`
