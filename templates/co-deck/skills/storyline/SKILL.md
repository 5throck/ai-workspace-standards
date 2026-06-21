---
name: storyline
version: 1.2.0
description: >
  Designs lecture storyline and slide deck composition. Given research_notes.md
  (or direct topic input), produces storyline.md and slide_deck.md. Responds
  to "make storyline", "compose slide deck", "structure chapters" (Korean:
  "make storyline", "compose slide deck", "restructure chapters"). Stages 2-3
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
- User says "make storyline"
- User says "compose slide deck"
- User says "restructure chapters"

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
> ## 5. divider — The Arrival of the AX Era
>
> **Section**: PART 01
> **Type**: divider
>
> ### Content
> - Paradigm shift in the securities industry
> - Definition of AX (AI Transformation)
> ```

---

### Step 4: Balance Check

Self-review after writing both files:

- Are slide counts balanced across chapters (within ±20%)?
- Any slides with too many bullets? (4 max recommended, 5 is hard limit)
- No more than 3 consecutive slides without visuals?

---

## Output Format

- `presentations/<project>/storyline.md` — narrative flow with chapter structure table
- `presentations/<project>/slide_deck.md` — per-slide content with type, content bullets, and right-panel spec

## Related Skills

- `research` — produces `research_notes.md` consumed by this skill
- `design` — consumes `slide_deck.md` output from this skill
