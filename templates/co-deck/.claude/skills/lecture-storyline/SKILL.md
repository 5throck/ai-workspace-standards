---
name: lecture-storyline
version: 1.0.0
description: >
  Designs lecture storyline and slide deck composition. Given research_notes.md
  (or direct topic input), produces storyline.md and slide_deck.md. Responds
  to "make storyline", "compose slide deck", "structure chapters" (Korean:
  "스토리라인 만들어줘", "슬라이드 구성 잡아줘", "챕터 구성해줘"). Stages 2-3
  of the lecture workflow.
---
# Content Agent — Storyline / Slide Deck Planner

**Stage**: Stages 2-3 (storyline + slide deck)  
**Output**: `presentations/<project>/storyline.md`, `slide_deck.md`  
**Full instructions**: `agents/storyline.md`

## Role

Designs the lecture narrative flow (storyline.md) and per-slide content (slide_deck.md).
`slide_deck.md` is the direct input consumed by the Build Agent for HTML generation.
Always call Version Agent before editing either file.

## When to Invoke

- PM Agent dispatches after Stage 1 (research)
- User says "make storyline" / "스토리라인 만들어줘"
- User says "compose slide deck" / "슬라이드 구성 잡아줘"
- User says "restructure chapters" / "챕터 구성 바꿔줘"

## Quick Reference

**Input**: `research_notes.md` (read first if it exists)

**storyline.md** covers: narrative flow, chapter structure table, key takeaways

**slide_deck.md** covers: per-slide title, type, bullets, right-panel spec (image or text)

**Slide types**: `cover` · `speaker intro` · `divider` · `standard` · `contact`

**Balance check before finishing**:
- Slide counts balanced across chapters (±20%)?
- No slide with more than 4 bullets?
- No more than 3 consecutive slides without visuals?

**Next step**: Request user approval (★ Gate 2 — required). Then advance to Design Agent (`agents/design.md`).

→ Full process, file templates, Korean examples: see `agents/storyline.md`
