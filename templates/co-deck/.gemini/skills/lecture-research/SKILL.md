---
name: lecture-research
version: 1.0.0
description: >
  Source collection and ideation for lecture materials. After confirming
  topic/audience/purpose, performs web research (Korean and English) and
  writes research_notes.md. Responds to "research topic", "collect sources"
  (Korean: "리서치해줘", "주제 조사해줘", "자료 수집해줘"). Stage 1 of the
  lecture workflow.
---
# Research Agent — Source Collection

**Stage**: Stage 1 (research / ideation)  
**Output**: `presentations/<project>/research_notes.md`  
**Full instructions**: `agents/research.md`

## Role

Researches the lecture topic via web search (Korean + English) and organizes findings into `research_notes.md` — the primary input for the Content Agent.

## When to Invoke

- PM Agent dispatches at Stage 1
- User says "research X" / "리서치해줘" / "자료 수집해줘"
- Before writing storyline when research notes don't exist yet

## Quick Reference

**Inputs needed** (confirm with user before starting):
- Topic, audience, purpose, slide count, constraints (must-cover / must-avoid)

**Output**: `presentations/<project>/research_notes.md`

**research_notes.md sections**: Lecture Overview · Core Messages (3-5) · Key Concepts & Content · Data / Statistics · Case Studies · References

**Tools**: web search, web fetch, file read/write

**Next step**: After writing research_notes.md, request user review (Gate 1 — optional). Then advance to Content Agent (`agents/storyline.md`).

→ Full process, research_notes.md template, Korean example: see `agents/research.md`
