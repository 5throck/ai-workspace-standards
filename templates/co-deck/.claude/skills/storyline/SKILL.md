---
name: storyline
version: 1.2.0
description: >
  Designs lecture storyline and slide deck composition. Given research_notes.md
  (or direct topic input), produces storyline.md and slide_deck.md. Responds
  to "make storyline", "compose slide deck", "structure chapters" (Korean:
  "스토리라인 만들어줘", "슬라이드 구성 잡아줘", "챕터 구성해줘"). Stages 2-3
  of the lecture workflow.
status: active
owner: storyline
last_reviewed: 2026-06-19
prerequisites: research
---

## Context

Designs the lecture narrative flow (`storyline.md`) and per-slide content (`slide_deck.md`). `slide_deck.md` is the direct input consumed by the Build Agent for HTML generation. Invoked at Stages 2-3, after research and optional source verification.

## When to Use

- PM Agent dispatches after Stage 1 (research)
- User says "make storyline" / "스토리라인 만들어줘"
- User says "compose slide deck" / "슬라이드 구성 잡아줘"
- User says "restructure chapters" / "챕터 구성 바꿔줘"

---

## Execution Steps

### Step 1: Confirm Inputs

- If `research_notes.md` exists, read it first
- Confirm with the user:
  - Total slide count (e.g., 40, 60)
  - Chapter (part) count and rough proportions
  - Whether to include cover / speaker intro / contact slides (default: include all)

---

### Step 2: Write storyline.md

Construct the lecture's high-level flow narratively. Not just a table of contents — encode the logic of "why this order" so the audience journey is clear.

```markdown
# Storyline: [Topic]

## Lecture Overview
- Total slide count:
- Presentation time:
- Core message:

## Overall Narrative Flow
[3-5 paragraphs describing where the audience starts, what journey they take, and what they leave with]

## Chapter Structure
| # | Type | Title | Slide count | Key role |
|---|------|------|------------|---------|
| - | Cover | | 1 | Topic and speaker intro |
| - | Speaker intro | | 1 | Build credibility |
| 1 | PART | | N | |
| 2 | PART | | N | |
| - | Contact | | 1 | Closing and follow-up |

## Key Takeaways
What the audience should remember after the lecture:
1.
2.
3.
```

---

### Step 3: Write slide_deck.md

Write per-slide content. This file becomes the direct input for HTML generation.

```markdown
# Slide Deck: [Topic]

---
## [Slide number]. [Slide type] — [Title]

**Section**: [section name shown in header]
**Type**: cover / speaker intro / divider / standard / contact

### Content
- Bullet 1
- Bullet 2
- Bullet 3

### Right Panel
- Type: image / text box
- Image: [search keyword or filename]
- Text title: [if any]
- Text body: [if any]

---
```

Repeat this structure for every slide. Dividers include part number and description.

> Korean example (actual slide content for a Korean lecture is written in Korean):
>
> ```markdown
> ## 5. divider — AX 시대의 도래
>
> **섹션**: PART 01
> **유형**: 간지(divider)
>
> ### 내용
> - 증권 산업의 패러다임 전환
> - AX(AI Transformation)의 정의
> ```

> ⚠️ **Uniform Layout Principle**: All content slides within a single deck MUST use `standard` type. Special types (`punchline`, `divider`, `profile`) are reserved for their designated structural purpose only. `punchline` is allowed ONLY as the last content slide with a single-statement message (≤1 line, no bullets). Mixing slide types for content slides is prohibited — each type has a distinct CSS layout (2-column vs center-aligned), and mixing breaks visual consistency.

---

### Step 4: Balance Check

Self-review after writing both files:

- Are slide counts balanced across chapters (within ±20%)?
- Any slides with too many bullets? (4 max recommended, 5 is hard limit)
- No more than 3 consecutive slides without visuals?
- Does every slide have a `script` field with narration text?
- If multi-language narration is requested, do translated script fields exist?
- **Uniform Layout check**: Do ALL content slides (between cover and closing) use `type: standard`? If any content slide uses `punchline` or another non-standard type, convert it to `standard`.

## Output Format

- `presentations/<project>/storyline.md` — narrative flow with chapter structure table
- `presentations/<project>/slide_deck.md` — per-slide content with type, content bullets, and right-panel spec

## Related Skills

- `research` — produces `research_notes.md` consumed by this skill
- `design` — consumes `slide_deck.md` output from this skill
