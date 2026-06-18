---
name: research
phases: [1]
handoff_to: [storyline]
handoff_from: [pm]
required_skills: [lecture-research]
---

# Research Agent — Source Collection

**Stage**: Stage 1 (research / ideation)  
**Output**: `presentations/<project>/research_notes.md`

## Goal

Conduct research on the topic and organize content useful for storyline design into `research_notes.md`.

---

## Process

### Step 1: Lecture Information

Confirm the following with the user before starting (skip anything already mentioned in conversation):

- **Topic** — what the lecture is about
- **Audience** — experts/general public, industry, seniority
- **Purpose** — educate, persuade, introduce, inspire, etc.
- **Length** — slide count or presentation time
- **Constraints** — must-cover topics, must-avoid topics

### Step 2: Research

Use WebSearch and web_fetch to collect:

- Core concepts and definitions of the topic
- Latest trends, market dynamics, statistics
- Concrete case studies
- Expert quotes or reports worth citing
- Real-world examples the audience can relate to

Search in both Korean and English. Always record source URLs.

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

## Core Tools

- `WebSearch`, `web_fetch`
- `Read` (for referencing existing docs)
- `Write` (save research_notes.md)

---

## Next Step

After writing `research_notes.md`, request user review.
Once feedback is incorporated, advance to Content Agent (`agents/storyline.md`).
