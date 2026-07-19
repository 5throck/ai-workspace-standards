# SECTION_TYPES — Handbook Section Type Reference

> Defines the 6 section types available for handbook content.
> Each type has a corresponding HTML template and specific structural requirements.

---

## Type Overview

| Type | Template | Purpose | Key Features |
|------|----------|---------|--------------|
| **Manual** | `manual.html` | 2-column reference documentation | Sticky TOC, wide tables, code-heavy |
| **Chapter** | `chapter.html` | Narrative content | 720px max-width, visual elements, key points |
| **Examples** | `examples.html` | Practice exercises | Difficulty badges, step-lists, A/B platform split |
| **Quiz** | `quiz.html` | Q&A and assessment | Details toggle, model answers, rubrics |
| **CourseOverview** | `course-overview.html` | Course introduction | 9 required items (§14), schedule table |
| **InstructorGuide** | `instructor-guide.html` | Instructor operations guide | Per-chapter notes, timing, evaluation criteria |

---

## Manual

**Purpose**: Reference documentation, API docs, configuration guides.

**Structure**:
- Left column: sticky table of contents
- Right column: content sections with headers
- Width: full content area (2-column layout)

**Dark Mode Notes**:
- TOC panel: `var(--bg2)` background
- Active nav item: `var(--accent)` border-left
- Code blocks: `var(--bg3)` background

**Required Elements**:
- ✅ Sidebar navigation
- ✅ Sticky TOC (left column)
- ✅ Copy buttons on code blocks (§2)
- ✅ CSS variables for all colors (§22)

---

## Chapter

**Purpose**: Narrative content — concepts, explanations, stories.

**Structure**:
- `chapter-eyebrow` span (e.g., `1장`)
- `<h1>` title
- Prose paragraphs with visual elements
- Key points box (tip/note/warning/info)
- chapter-nav at bottom (prev/next)

**Dark Mode Notes**:
- Content: `var(--bg)` background
- Key points boxes: semantic `var(--bg-info)`, `var(--bg-note)`, `var(--bg-warn)`
- Blockquotes: `var(--border-left)` accent color

**Required Elements**:
- ✅ At least 1 visual per section (§10)
- ✅ chapter-nav (§21-1)
- ✅ Sidebar nav (§21-1)
- ✅ CSS variables only (§22)

---

## Examples

**Purpose**: Practice exercises and hands-on activities.

**Structure**:
- Difficulty badges (beginner/intermediate/advanced)
- Numbered step lists
- Code blocks with copy buttons
- A/B platform split support (§18)

**Dark Mode Notes**:
- Difficulty badge: `var(--accent)` text on `var(--bg2)`
- Step number: `var(--accent)` circle
- Platform blocks: `var(--bg2)` background with `var(--border)`

**Required Elements**:
- ✅ Difficulty badge
- ✅ Copy buttons (§2)
- ✅ `min-width: 0` on step-content (§11-1)
- ✅ A/B navigation when platform-specific (§18)

---

## Quiz

**Purpose**: Q&A, self-assessment, and evaluation.

**Structure**:
- Question/answer pairs using `<details>/<summary>`
- Model answer section (initially hidden)
- Rubric/marking criteria
- Score summary area

**Dark Mode Notes**:
- Question: `var(--bg2)` background
- Correct answer: `var(--bg-success)` indicator
- Wrong answer: `var(--bg-error)` indicator

**Required Elements**:
- ✅ `<details>/<summary>` for toggle
- ✅ Model answer for each question
- ✅ Rubric when applicable

---

## CourseOverview

**Purpose**: Course introduction — the first document participants see (§14).

**Structure**:
- Card-based layout with 9 required items
- Schedule table with time blocks

**Required Items** (all 9 mandatory per §14):

| # | Item | Description |
|---|------|-------------|
| 1 | One-line summary | 2-3 sentence description of the course |
| 2 | Learning objectives | Bloom's Taxonomy verbs (explain, design, apply, execute...) |
| 3 | Target audience | Role and experience level criteria |
| 4 | Prerequisites | Accounts, installations, knowledge prerequisites |
| 5 | Format | Lecture/practice/discussion/demo ratio |
| 6 | Schedule | Time-block schedule including breaks |
| 7 | Topics covered | Per-block topic with chapter/section mapping |
| 8 | Post-completion outcomes | Practical outputs and skills gained |
| 9 | Instructor information | Name, affiliation, profile (blanks allowed) |

**Dark Mode Notes**:
- Cards: `var(--bg2)` with `var(--border)` border
- Schedule table: alternating `var(--bg)` / `var(--bg2)` rows

---

## InstructorGuide

**Purpose**: Instructor operations guide — all information needed to run the course (§20/§24).

**Structure**:
- Per-chapter sections with instructor notes
- Timing table
- Demo sequence
- Evaluation criteria

**Required Sections**:

| Section | Content |
|---------|---------|
| Pre-course preparation checklist | What participants prepare before the lecture |
| Time allocation table | Daily/chapter schedule (must match Course Overview) |
| Per-chapter instructor notes | Per-chapter: location/role, key points, participant activities, time-shortcut, irreversible warnings |
| Per-chapter check questions | 2-3 open-ended questions per chapter |
| Demo sequence | Demo order for live demonstrations |
| Evaluation criteria | Evaluation criteria and scoring rubrics |

**Dark Mode Notes**:
- Same as chapter type — narrative layout
- Warning boxes for irreversible operations: `var(--bg-warn)`
- Time-shortcut sections: `var(--bg-note)` background

**Consistency Rule**: Instructor Guide timing and content MUST match Course Overview (§20-2). If one is updated, the other must be synchronized.
