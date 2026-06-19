---
name: lecture-research
version: 1.2.0
description: >
  Source collection and ideation for lecture materials. After confirming
  topic/audience/purpose, performs web research (Korean and English) and
  writes research_notes.md. Responds to "research topic", "collect sources"
  (Korean: "리서치해줘", "주제 조사해줘", "자료 수집해줘"). Stage 1 of the
  lecture workflow.
status: active
owner: research
last_reviewed: 2026-06-19
prerequisites: none
---

## Context

Researches the lecture topic via web search (Korean + English) and organizes findings into `research_notes.md` — the primary input for the Storyline Agent. Invoked at Stage 1, after the lecture topic and audience are confirmed.

## When to Use

- PM Agent dispatches at Stage 1
- User says "research X" / "리서치해줘" / "자료 수집해줘"
- Before writing storyline when `research_notes.md` does not yet exist

---

## Execution Steps

### Step 1: Confirm Lecture Information

Confirm the following with the user before starting (skip anything already mentioned):

- **Topic** — what the lecture is about
- **Audience** — experts/general public, industry, seniority level
- **Purpose** — educate, persuade, introduce, inspire, etc.
- **Length** — slide count or presentation time
- **Constraints** — must-cover topics, must-avoid topics

---

### Step 2: Research

Use WebSearch and web_fetch to collect:

- Core concepts and definitions of the topic
- Latest trends, market dynamics, statistics
- Concrete case studies
- Expert quotes or reports worth citing
- Real-world examples the audience can relate to

Search in both Korean and English. Always record source URLs.

---

### Step 3: Write research_notes.md

Organize collected content into the structure below and save to the workspace.

```markdown
# Research Notes: [Topic]

## Lecture Overview
- Topic:
- Audience:
- Purpose:
- Length (slide count):

## Core Messages (3-5)
Key points the audience must take away.
1.
2.
3.

## Key Concepts & Content
### [Concept/Section 1]
[Summary]

### [Concept/Section 2]
[Summary]

## Data / Statistics
- [Figure] — Source: [URL]
- [Figure] — Source: [URL]

## Case Studies
### [Case 1]
[Description]

## References
- [Title](URL)
- [Title](URL)
```

> Korean example (when the lecture targets a Korean audience, write actual content in Korean):
>
> ```markdown
> # 리서치 노트: AX 시대의 증권 산업
>
> ## 강연 개요
> - 주제: AX(AI Transformation) 시대의 증권 산업 변화
> - 청중: 증권사 임원 및 실무진
> - 목적: 인사이트 제공 및 전략 방향 제시
> - 분량 (슬라이드 수): 60
> ```

---

## Output Format

`presentations/<project>/research_notes.md` with sections: Lecture Overview, Core Messages, Key Concepts & Content, Data / Statistics, Case Studies, References. See Step 3 template above for full structure.

## Related Skills

- `lecture-storyline` — consumes `research_notes.md` output from this skill
