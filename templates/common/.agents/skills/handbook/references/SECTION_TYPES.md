# SECTION_TYPES — Handbook Section Type Reference

> Defines the 6 section types available for handbook content.
> Each type has a corresponding HTML template and specific structural requirements.
> For authoring rules (visual elements, writing style, OS handling, etc.), see `AUTHORING_GUIDELINES.md`.

---

## Type Overview

| Type | Template | Purpose | Key Features |
|------|----------|---------|--------------|
| **Manual** | `manual.html` | 2-column reference documentation | Sticky TOC, wide tables, code-heavy |
| **Chapter** | `chapter.html` | Narrative content | 720px max-width, visual elements, key points |
| **Examples** | `examples.html` | Practice exercises | Difficulty badges, step-lists, A/B platform split |
| **Quiz** | `quiz.html` | Q&A and assessment | Details toggle, model answers, rubrics |
| **CourseOverview** | `course-overview.html` | Course introduction | 9 required items — see `AUTHORING_GUIDELINES.md §14` |
| **InstructorGuide** | `instructor-guide.html` | Instructor operations guide | Per-chapter notes, timing, evaluation — see `AUTHORING_GUIDELINES.md §20` |

---

## Manual

**Purpose**: Reference documentation, API docs, configuration guides.

**Structure**:
- Left column: sticky table of contents
- Right column: content sections with headers
- Width: full content area (2-column layout)

**Required Elements**:
- Sidebar navigation (§21-1)
- Sticky TOC (left column)
- Copy buttons on code blocks (§2)
- All colors via CSS variables (§22)

---

## Chapter

**Purpose**: Narrative content — concepts, explanations, stories.

**Structure**:
- `chapter-eyebrow` span (e.g., `1장`)
- `<h1>` title
- Prose paragraphs with visual elements
- Key points box (tip/note/warning/info)
- chapter-nav at bottom (prev/next)

**Required Elements**:
- At least 1 visual per section (§10)
- chapter-nav (§21-1)
- Sidebar nav (§21-1)
- All colors via CSS variables (§22)

---

## Examples

**Purpose**: Practice exercises and hands-on activities.

**Structure**:
- Difficulty badges (beginner/intermediate/advanced)
- Numbered step lists
- Code blocks with copy buttons
- A/B platform split support (§18)

**Required Elements**:
- Difficulty badge
- Copy buttons (§2)
- `min-width: 0` on step-content (§11-1)
- A/B navigation when platform-specific (§18)

---

## Quiz

**Purpose**: Q&A, self-assessment, and evaluation.

**Structure**:
- Question/answer pairs using `<details>/<summary>`
- Model answer section (initially hidden)
- Rubric/marking criteria
- Score summary area

**Required Elements**:
- `<details>/<summary>` for toggle
- Model answer for each question
- Rubric when applicable

---

## CourseOverview

**Purpose**: Course introduction — the first document participants see.

See `AUTHORING_GUIDELINES.md §14` for the 9 required items (one-line summary, learning objectives, target audience, prerequisites, format, schedule, topics covered, post-completion outcomes, instructor information).

**Structure**: Card-based layout with schedule table.

---

## InstructorGuide

**Purpose**: Instructor operations guide — all information needed to run the course.

See `AUTHORING_GUIDELINES.md §20` for the 6 required sections, per-chapter note format, check question format, and consistency rules with Course Overview.

**Structure**: Per-chapter sections with timing table, demo sequence, and evaluation criteria.
