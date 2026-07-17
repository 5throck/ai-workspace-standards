# Authoring Guidelines

> This document compiles the principles derived from reviewer feedback received during the creation of
> a **multi-agent team engineering handbook**. It was written so that anyone producing similar
> course materials can use it as a set of guidelines. Each principle originated from an actual
> revision request, and includes both the "why" and "how to apply."

---

## 0. How to Use This Guide

- Before writing a new chapter or hands-on scenario, review **§1–§3** (audience, structure, approach) first.
- When planning course materials, **write the Course Overview (§14) first**, then use its learning objectives to structure the main content.
- After completing a draft, run through the **§A checklist** item by item to catch any omissions.
- Technical accuracy (§4), OS handling (§9), markup details (§11), and **writing style consistency (§12)** are the most frequently flagged areas in reviews — apply them from the draft stage.
- Just before finalizing, run **§19 (Proofreading)** — read every sentence from start to finish.
- When planning course materials, refer to **§20 (Lecture Guide Structure)** to prepare instructor-facing resources alongside.

---

## 1. Target Audience and Depth of Explanation

**Principle**: Write for "someone unfamiliar with this field" as the primary audience, and do not skimp on concept explanations.

- **Why**: Reviewer feedback — *"Overall, the explanations of concepts are too weak."*
- **How to apply**:
  - When introducing a technical term for the first time, add a **one-line analogy** (e.g., orchestrator = symphony conductor).
  - Not only explain "what" but also "why it must be done this way" in one sentence.
  - Structure a section as definition → analogy → hands-on in three parts — beginners can follow along more easily.

---

## 2. Specificity of Hands-On Steps

**Principle**: Break hands-on steps down so they are "copy → paste → run immediately."

- **Why**: Reviewer feedback — *"For the hands-on exercises too, break the steps down very specifically so that after copying and pasting, they can run right away."*
- **How to apply**:
  - Add a **"Copy" button** to each code box (`copyCode(this)` pattern).
  - Do not mix two or more independent actions in a single step (① create file / ② invoke — keep them separate).
  - Terminal commands should be meaningful even on a per-line basis — number them in execution order.

---

## 3. Tool-Neutral Approach (AGENTS.md-First)

**Principle**: Do not teach hands-on exercises tailored to a single tool. **Define the common specification first, then show each tool as an "implementation" of that spec.**

- **Why**: Reviewer feedback — *"The entire course should support multiple tools simultaneously. Base it on AGENTS.md so both Claude and Antigravity can use it."*
- **How to apply**:
  - Write role definitions in plain-text **`AGENTS.md`** specification first — without tool-dependent syntax (`.claude/agents/*.md` YAML, `tools:`, etc.) — covering role/input/output/permissions/handoff.
  - Then show how that **same spec** is implemented as a predefined subagent in the Claude family and as a natural-language goal in the Antigravity family, side by side.
  - Core motto: **"One definition; only the execution method differs per tool."**
  - When execution differs significantly across platforms (code · command · UI steps), separate common concepts and tool-specific implementations into **A/B files** (§18). Guide users to both sides with a 3-link branch nav in the common section.

---

## 4. Technical Accuracy (Pre-Research Required)

**Principle**: Content must not contradict official external sources. When in doubt, research first.

- **Why**: Reviewer feedback — *"There aren't just 3 orchestration patterns — there are more. Research and supplement the content."* (Anthropic officially documents **5 patterns**: prompt chaining, routing, parallelization (sectioning/voting), orchestrator-worker, evaluator-optimizer)
- **How to apply**:
  - Cite official documentation (Anthropic, Antigravity, etc.) as primary authority for numbers, classifications, and naming.
  - Verify that core capabilities (e.g., "dynamic team composition is possible", "multiple workflows can be combined") are not missing from concept or hands-on chapters.
  - When covering inter-document relationships (e.g., `AGENTS.md` ↔ `docs/context.md` ↔ `<variant>/docs/context.md`), draw the SSOT/hierarchy accurately.

---

## 5. Generalization of Operational Model Expressions

**Principle**: Do not lock descriptions to a single scale. Express scope in general terms.

- **Why**: Reviewer feedback — *"Saying 'the company operates one multi-agent team' is wrong for large companies — different agent teams could operate per division/team."*
- **How to apply**:
  - Instead of "one team for the whole company," write **"team operations can be organized per organizational unit (division/team)."**
  - In comparisons (service-ticket type vs. variant development-tool type), do not present one side as the correct answer — list pros and cons of both side by side.

---

## 6. Removal of Artificial Constraints

**Principle**: Do not include unnecessary time/scope constraints that burden the learner.

- **Why**: Reviewer feedback — *"The constraint of having to finish within 3 hours is included. Remove the related content."*
- **How to apply**:
  - Exclude time constraints like "within N hours" (time allocation tables are for reference only).
  - After modifying content, **recalculate** the time allocation table so it stays consistent with the body text.

---

## 7. Completing Missing Prerequisites

**Principle**: Do not skip anything assumed to be "obvious." Document all preparation up to the step immediately before the exercise.

- **Why**: Reviewer feedback — *"How to create a GitHub account is missing."*, *"PowerShell must be run as administrator, but the instructions aren't there."*
- **How to apply**:
  - Write step-by-step instructions for: account creation, subscription plans, system requirements, and opening administrator privileges (Win+X → Terminal (Admin), UAC "Yes").
  - Separating into a standalone **pre-installation checklist** document keeps the main text lighter.

---

## 8. GitHub Pages Readability

**Principle**: All materials deployed as a static site must appear consistently in HTML.

- **Why**: Reviewer feedback — *"When viewing on GitHub Pages, other documents are HTML but the setup guide is md, which hurts readability. Is there a way to improve this?"*
- **How to apply**:
  - Provide learner-facing materials (`docs/`) in **`.html`** format, not `.md`.
  - Include a fixed left navigation, "Copy" buttons, and **site-wide search** (`site-search.js`).
  - Internal reference documents for authors (like this file) remain as repository-root Markdown.

---

## 9. OS-Specific Command Handling (Most Frequently Flagged Area)

**Principle**: **Split commands by OS only when they actually do not work due to OS characteristics. Otherwise, show a single example.**

- **Why**: Reviewer feedback — *"There are cases that work on macOS/Linux but not on Windows. Account for each OS situation."* + *"In PowerShell's case, utilities like cat, echo that are primarily used in macOS/Linux are provided."*
- **How to apply**:
  - **Single example is sufficient** (PowerShell supports as alias): `cat`, `echo`, `mkdir`, `cp`, `ls`, `mv`, `cd`, `>`/`>>` redirection — use one example without OS splitting.
  - **Real incompatibilities that require OS splitting**:
    - Bash heredoc syntax `<< 'EOF'` → PowerShell uses here-string `@'...'@` + `Set-Content`/`Add-Content`
    - Process substitution `<(...)` → PowerShell uses `Compare-Object`
    - OS-specific install scripts (`setup-mac.sh` / `setup-linux.sh` / `setup-windows.ps1`)
    - Path notation conventions (`~/git` vs `C:\git`)
  - **Expression accuracy**: Do not write "PowerShell cannot use `cat`" — write **"`cat` works, but `<< 'EOF'` heredoc syntax is not available."** Distinguish between what doesn't work (command vs. syntax).
  - **Path notation**: `~` (home directory) is auto-expanded by shells on macOS/Linux but **not supported in Windows CMD**. The `./` prefix also causes `mkdir` syntax errors in CMD. The safest approach is to use **just the folder name** without any prefix.
    Example: Not `mkdir ~/harness-lab` but `mkdir harness-lab` (works on macOS/Linux, PowerShell, and CMD).
  - **Prefer `mkdir -p`**: `mkdir -p` proceeds without error even if the target folder already exists, making it safe when learners re-run steps. Always use `mkdir -p` for folder creation commands.

---

## 10. Visual Aids

**Principle**: Place sufficient images or diagrams in each section to aid learner comprehension.

- **Why**: Reviewer feedback — *"Having appropriate images or diagrams in the document would greatly help understanding."*

### 10-1. Per-Section Visual Aid Placement Criteria

Every section (§) in every chapter must include at least one visual element. Types of visual elements:

- **Inline SVG diagrams** (architecture, flowcharts, pipelines, comparison structures)
- **CSS-based visual elements** (`.tree-box`, `.flow-box`, `.compare-grid`, `.stat-grid`, `.variant-list`)
- **HTML tables** (comparison tables, classification tables, matrices)
- **Code blocks** (hands-on sections only — code itself serves as visual structure)

| Section Type | Required Visual Element | Optional Visual Element |
|-------------|----------------------|----------------------|
| Concept definition | SVG diagram or comparison table showing the concept at a glance | Analogy image |
| Flow/process | SVG flowchart or step-by-step pipeline diagram | CSS step table |
| Comparison/selection | CSS compare-grid or HTML comparison table | SVG comparison diagram |
| Hands-on exercise | flow-box (auto-performed) + prompt-box (user input) | SVG pipeline |
| Structure/architecture | SVG hierarchy diagram or `.tree-box` | File structure table |
| Summary/checklist | The checklist itself is a visual element | Completeness comparison table |

Exception: Reference/procedure documents such as glossaries, FAQs, and installation checklists are not required to have visual elements.

### 10-2. SVG Diagram Authoring Principles

- **No external image dependencies** — create all visual aids as inline SVG or CSS/HTML.
- **Dark mode compatible** — use CSS custom properties (`var(--text)`, `var(--border)`, etc.) or neutral colors.
- **Responsive** — set `viewBox` on SVG and use `width="100%"` so they scale with the window.
- **Consistent wrapper style** — all SVG containers use the same wrapper:
  `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:20px;margin:20px 0 28px;">`
- **Text size** — use 11–13px (`font-size`) for text inside SVG; make labels bold.
- **Color palette** (maintain consistency):

  | Purpose | Color |
  |---------|-------|
  | Main text | `#1f2328` |
  | Secondary text | `#636c76` |
  | Accent (blue) | `#0969da` |
  | Success (green) | `#1a7f37` |
  | Warning (orange) | `#953800` |
  | Error (red) | `#cf222e` |
  | Secondary (purple) | `#6639ba` |
  | Background | `#f6f8fa` |
  | Border | `#d0d7de` |

### 10-3. Visual Aid Placement Example

Below is an actual applied placement example. For new courses, create a placement table using the same criteria (§10-1) adapted to the chapter structure.

| Chapter | Section | Minimum Visual Element | Form |
|---------|---------|----------------------|------|
| Ch.N §0 | Concept definition | Concept comparison table / analogy diagram | HTML table + SVG |
| Ch.N §1 | Flow/process | Step-by-step pipeline | SVG |
| Ch.N §2 | Hands-on | flow-box (auto-performed) + prompt-box | CSS + code |
| Ch.N §3 | Structure/architecture | Hierarchy diagram or tree-box | SVG + CSS |

---

## 11. Markup Details

**Principle**: Avoid unnecessary line breaks caused by emphasizing a single word in the middle of a sentence, and prevent text boxes from protruding outside parent borders in nested flex layouts.

- **Why**: Reviewer feedback — *"Lines are broken unnecessarily."* (A case where a single Korean word in the middle of a sentence was wrapped in `<strong>`, causing the word to appear detached when rendered) / *"Text boxes extend outside the outer border and get clipped by the final border."* (A case where `.flow-box` etc. extended beyond `.platform-block` boundaries and was clipped by `.scenario-card`'s `overflow: hidden`)
- **How to apply**:
  - Group emphasis at **natural phrase-unit boundaries** (e.g., not `heredoc <strong>syntax</strong>` but the entire meaningful phrase, or remove the emphasis altogether).
  - Add `min-width: 0` to comparison boxes/grids so long lines do not push the box outward.

### 11-1. Preventing Text Box Overflow in Flex Layouts

The structure of hands-on pages is deeply nested: `.scenario-card` > `.card-body` > `.platform-block` > `ol.step-list` > `li` > `.step-content` > (`.flow-box` / `.tip-box` / `.warning-box`). Here `.step-list li` is a flex container and `.step-content` is a `flex: 1` child.

In CSS flex, **flex children's default `min-width` is `auto`**, so they cannot shrink below their content's intrinsic width. Long `<code>` inline elements inside text boxes (e.g., `<code>subagent_type="writer"</code>`) push `.step-content` outward, causing it to protrude beyond `.platform-block`'s border, and ultimately get clipped by `.scenario-card`'s `overflow: hidden`.

Additionally, `.platform-block` has its own padding (20px on each side), so text boxes inside it appear 40px narrower than those directly inside `.card-body`. Negative margin compensates for this.

**Required CSS rules** (include whenever a new HTML file uses the `step-list` structure):

| Selector | Property | Effect |
|----------|----------|--------|
| `.step-content` | `min-width: 0` | Allows flex children to shrink below their content's intrinsic width |
| `.flow-box`, `.tip-box`, `.warning-box` | `overflow-wrap: break-word` | Long inline elements wrap at box boundaries |
| `.platform-block .flow-box` etc. | `margin-left/right: -10px` | Compensates for text box narrowing caused by accumulated padding |

Application example:
```css
.step-content { flex: 1; min-width: 0; }
.flow-box {
  /* ... existing properties ... */
  overflow-wrap: break-word;
}
.platform-block .flow-box,
.platform-block .tip-box,
.platform-block .warning-box {
  margin-left: -10px;
  margin-right: -10px;
}
```

### 11-2. Preventing Line Breaks on Fixed Elements Inside Flex Containers

When placing a badge, title, and description side by side inside `.level-header` (`display: flex`), the default `flex-shrink: 1` can cause the badge and title to wrap to two lines when the window narrows.

**Rule**: Apply `flex-shrink: 0` to elements that **must never wrap** inside a flex container, and `flex: 1` to elements that **fill the remaining space**.

```css
.level-header .badge    { flex-shrink: 0; }
.level-header .level-title { flex-shrink: 0; }
.level-header .level-desc  { flex: 1; }
```

---

## 12. Writing Style Consistency

**Principle**: Apply the same style standards across all chapters and sections so readers experience no jarring shifts when moving between chapters.

- **Why**: Different writing styles per chapter undermine consistency as teaching material. In the actual draft, polite form, English terminology notation, chapter reference format, and em-dash usage frequency all varied across files.
- **How to apply**:

### 12-1. Sentence Endings

Use **plain form (`~다`/`~한다`/`~이다`)** uniformly across all body text, subheadings, and descriptions. Polite form (`~습니다`/`~해요`) is only permitted in UI button labels.

```
✗ "이 핸드북은 다르게 구성되어 달라집니다."  (polite form)
✓ "이 핸드북은 다르게 구성되어 달라진다."     (plain form)
```

### 12-2. English Technical Term Notation

When using English technical terms in body text, add a **Korean (English) parenthetical gloss only on first appearance within the document**. On subsequent appearances within the same document, use the English term alone. Code, filenames, and CLI identifiers are marked with `<code>` tags; conceptual terms distinct from code use parenthetical glosses.

```
✗ "hook은 셸 명령 실행 전후에 호출된다."                     (first appearance with English only — no gloss)
✗ "<code>hook</code>은 셸 명령 실행 전후에 호출된다."          (replaced with code tag — conceptual term styled as code)
✓ "훅(hook)은 셸 명령 실행 전후에 호출된다. ... 이후 문단에서
   hook이 실패하면 커밋이 중단된다."                          (gloss only on first appearance, English alone after)
✗ "... 이후 문단에서 훅(hook)이 실패하면 ..."                 (continued glossing from second appearance onward — unnecessary repetition)
```

This rule applies **per document (file)** — in a different document, the first appearance in that document becomes the new baseline (e.g., if a term was glossed in Chapter 4, it must be glossed again on first appearance in Chapter 8).

**Headings are exempt.** Text serving as headings — such as `<title>`, `<h1>`, `chapter-eyebrow`, and nav chapter titles — uses **English words only** without parenthetical glosses (and no Korean-only labels either).

```
✗ <h1>신규 베리언트(variant) 만들기</h1>   (parenthetical gloss in heading)
✗ <h1>신규 베리언트 만들기</h1>            (Korean-only label in heading)
✓ <h1>신규 variant 만들기</h1>             (English only in heading)
```

### 12-3. Chapter/Section Reference Format

When referencing another chapter or section, unify the format as **`N장 §M`**.

```
✗ "5장에서 자세히 다룬다"
✗ "제5장에서 다룸"
✓ "5장 §3에서 다룬다"
```

### 12-4. Minimize em-dash (—) Usage

Use em-dashes **minimally**, only where supplementary explanation is unavoidable. Shortening sentences usually eliminates the need for em-dashes in most cases. Especially avoid them in hands-on chapters.

```
✗ "좋은 하네스는 매번 잘 대답하게 만든다 — 그게 핵심 차이다"
✓ "좋은 하네스는 매번 잘 대답하게 만든다. 이것이 핵심 차이다."
```

---

## 13. Completeness and Balance of Tool Comparisons

**Principle**: Comparison tables must not cause misunderstanding, must not omit items, and must be visually balanced.

- **Why**: Reviewer feedback — (a) *"Writing `/goal`, `/agent`, `/agents` makes it seem like other tools don't have them or they're Antigravity-only."*, (b) *"Message passing during subagent invocation and inter-subagent communication are missing."*, (c) *"Comparison box size balance is off."*
- **How to apply**:
  - Do not write something as if it exists in only one tool (mark common capabilities as "Common").
  - Define comparison dimensions (invocation · parallelization · isolation · messaging · communication) and **fill them in completely for every tool**.
  - Use the same grid rules and padding for columns/boxes to equalize heights.

---

## 14. Mandatory Course Overview

**Principle**: When generating course materials (workshop, course, seminar, etc.), **always include a Course Overview first**. Never create body text or exercises before the overview.

- **Why**: The Course Overview is the starting point for all external communications — participant recruitment, course announcements, operational approvals. Without an overview, every time someone asks "what is this course about?" you must search through the body text. Additionally, writing body text without clearly defined learning objectives leads to arbitrary scope and depth.
- **How to apply**:
  - During the course planning stage (before drafting), **write the Course Overview first**, then use its content as the basis for structuring the body. Verify that the learning objectives in the overview map 1:1 to actual body sections.
  - The Course Overview must include **all** of the following items (none may be omitted):

    | Item | Content | Notes |
    |------|---------|-------|
    | One-line summary | What this course is, in 2–3 sentences | Participant grasps it in 10 seconds |
    | Learning objectives | What participants can do after completion (Bloom's Taxonomy based) | Start with verbs: explain, design, apply, execute, compare, evaluate, implement, synthesize |
    | Target audience | Who this course is suitable for | Specify by role and experience level |
    | Prerequisites | What must be prepared before the course | Subscriptions, accounts, installations, knowledge level |
    | Format | Lecture / hands-on / discussion / demo ratio | Lets participants set expectations |
    | Schedule | Time-block schedule including breaks | State total duration with breaks |
    | Topics covered | Per-block topic with chapter/section mapping | Cross-validate with schedule |
    | Post-completion outcomes | Practical deliverables and skills immediately applicable | Provides participant motivation |
    | Instructor information | Instructor name, affiliation, profile (blanks allowed) | Designed for instructor to fill in |

  - Place the Course Overview file at `docs/lecture-guide/00_Course_Overview.html` (or the path matching the project's conventions), and link it as a card at the top of the instructor materials group on the index page (`docs/index.html`).
  - Whenever modifying body text or the time allocation table, **verify that the Course Overview's schedule, topics, and learning objectives remain consistent** and synchronize.

---

## 15. Chapter Connectivity and Table of Contents Review

**Principle**: Each chapter should flow smoothly into the next, and reviewing the overall table of contents should surface any gaps.

- **Why**: Reviewer feedback — *"Also check whether each chapter is well connected to the next."*, *"Review the table of contents and suggest areas that need supplementing or adding."*
- **How to apply**:
  - Add a transition bridge at the end of each chapter: "The next chapter covers ~."
  - During table of contents review, check that **supplementary materials (glossary, guardrails, FAQ, capstone, lecture guide)** are not missing.

### 15-1. Closing Trajectory of the Last Chapter

**Principle**: The last chapter (capstone, etc.) does not simply end because there is no "next chapter →" link — present **post-completion next steps** as a separate section.

- **Why**: Middle chapters naturally flow into "the next chapter covers ~," but the last chapter lacks that mechanism, so learners can easily finish with the unanswered question "so what do I do now?"
- **How to apply**:
  - Add a `Next Steps` section (`<h2 id="next-steps">`) to the last chapter and present concrete actions in checklist form — e.g., "apply to actual work", "consider promoting to a formal variant", "return to glossary/FAQ if stuck."
  - The `chapter-nav` `next` link has no body chapter to point to, so link to reference materials like the glossary or FAQ instead — but label it `Reference →` rather than `Next chapter →` to indicate the different nature.

---

## 16. Language Policy

- Course body text, hands-on instructions, and UI copy are written in **the course's primary language** (e.g., Korean for Korean-language educational materials).
- However, **code comments, identifiers, commit messages, PR titles/bodies, and branch names** are always in English.
- File names follow English kebab/snake case conventions.

---

## 17. Video References

**Principle**: When official video resources exist that supplement a section's content, provide links in a "Video References" section.

- **Why**: Video content explaining the same concept visually greatly enhances learner comprehension. Especially for dynamic content like orchestration patterns, agent behavior flows, and tool demos, text and diagrams alone may be insufficient.

### 17-1. Video Selection Criteria

- **Official sources preferred**: Anthropic, Google DeepMind, DeepLearning.AI, and other official channels take priority.
- **Language**: Search for videos in the course's primary language first; if unavailable, link English videos and indicate the language.
- **Length**: Prefer videos under 20 minutes. Provide timestamps for longer videos.
- **Recency**: Prefer videos published within the last 2 years.
- **Free access**: Only link videos published on platforms anyone can access (YouTube, etc.).

### 17-2. Video Link Placement

Videos are not embedded directly (`<iframe>`); instead, provide them as links in a "Video References" block at the end of a section or chapter. Reasons: (a) embedding slows page loading, (b) external platform policy changes can break embeds, and (c) learners may prefer watching in their own environment.

HTML pattern:
```html
<div class="video-refs">
  <h3 id="videos">Video References</h3>
  <ul>
    <li>
      <span class="video-badge en">EN</span>
      <a href="YOUTUBE_URL" target="_blank">Video Title</a>
      <span class="video-meta">(MM:SS)</span> — One-line description
    </li>
  </ul>
</div>
```

CSS:
```css
.video-refs {
  margin: 28px 0;
  padding: 16px 20px;
  background: var(--bg-info);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.video-refs h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  margin: 0 0 12px;
}
.video-refs ul { list-style: none; padding: 0; margin: 0; }
.video-refs li { padding: 6px 0; line-height: 1.6; }
.video-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  color: #fff;
  vertical-align: middle;
  margin-right: 6px;
}
.video-badge.en { background: #0969da; }
.video-badge.ko { background: #1a7f37; }
.video-meta { font-size: 12px; color: var(--text-dim); }
```

### 17-3. Sections Where Video References Are Recommended

Below is an applied placement example. For new courses, judge using the same criteria (§17-1) adapted to the chapter structure.

| Chapter/Section | Recommended Video Topic | Expected Source |
|-----------------|----------------------|----------------|
| Introductory chapter | Field overview, historical context | Official education channels |
| Core concept chapter | Orchestration/pipeline visualization, dynamic content | Official documentation channels |
| Guardrails/security chapter | Security, permission control concepts | Security-related official channels |
| Hands-on chapter | Actual tool operation demo | Official tutorial channels |
| Comparison chapter | Tool comparison, per-platform differences | Each platform's official channels |

Verify video URLs at time of writing and reflect them. Do not force-add videos to sections where no official video exists.

---

## 18. Platform-Specific Separation (A/B Branching)

**Principle**: When a section covers the same concept implemented differently by the Claude family and the Antigravity family, separate it into common and tool-specific areas.

- **Why**: Putting both families' implementations in one file means (a) users must skip content irrelevant to their tool, (b) the file becomes excessively long, and (c) updates to one side risk misaligning with the other.
- **How to apply**:

### 18-1. Separation Criteria

| Condition | Split? |
|-----------|--------|
| Code/commands differ per platform | Split |
| UI operation steps differ per platform | Split |
| Supported features themselves differ (supported/unsupported) | Split |
| Concept explanations, specification comparison tables | Keep unified |
| Summaries, reference links | Keep unified |

### 18-2. Naming Conventions

| Element | A (Claude) | B (Antigravity) |
|---------|-----------|----------------|
| Filename | `_Examples.html` (no suffix) | `_Examples_B.html` |
| Section label | `§N-A` | `§N-B` |
| Color | Green `#1a7f37` | Purple `#6639ba` |
| badge class | `badge-claude`, `badge-claudeapp` | `badge-antigravity`, `badge-agy` |

### 18-3. 3-Link Branch Navigation (Common → Tool-Specific)

At the bottom of the common area (reference file), place a `prev | branch(A, B) | next` 3-link pattern navigation that branches to tool-specific files.

HTML template:
```html
<div class="chapter-nav">
  <a href="previous_chapter.html" class="prev">
    <div class="dir">&larr; Prev</div><div class="ttl">Ch.N &middot; Title</div>
  </a>
  <div class="branch">
    <div class="branch-label">Ch.N Exercises</div>
    <a href="Examples.html" style="border-color:#1a7f37;color:#1a7f37;">Claude (A)</a>
    <a href="Examples_B.html" style="border-color:#6639ba;color:#6639ba;">Antigravity (B)</a>
  </div>
  <a href="next_chapter.html" class="next">
    <div class="dir">Next &rarr;</div><div class="ttl">Ch.N &middot; Title</div>
  </a>
</div>
```

CSS (add to file as needed):
```css
.chapter-nav .branch { flex: 0 0 auto; text-align: center; min-width: 120px; }
.chapter-nav .branch a { display: block; font-size: 12px; margin-bottom: 6px; padding: 10px 14px; }
.chapter-nav .branch-label { font-size: 10px; color: var(--text-dim); margin-bottom: 6px; text-transform: uppercase; letter-spacing: .05em; }
```

### 18-4. 2-Link Chain Navigation (A↔B Sequential)

A/B files are linked to each other sequentially via prev/next links.

- **Bottom of A file**: `&larr; §N Common Area` | `§N-B Antigravity Focus &rarr;`
- **Bottom of B file**: `§N-A Claude Focus &rarr;` | `Next Chapter &rarr;`

### 18-5. platform-pair / platform-block Rules

- **`.platform-pair`**: 2-column comparison grid — used only in common reference files. Used when comparing 4 tools side by side (e.g., Chapter 4 §1 reference).
- **`.platform-block`**: Single-platform command block — in A/B split files, show only the relevant platform's block. Remove the opposite platform's block.
- **4-tool classification**: Claude App (Desktop), Claude Code (CLI), Antigravity (Desktop), Antigravity CLI (agy).

### 18-6. A/B Split Checklist

After splitting is complete, verify the following:

- [ ] Does branch navigation connect from the common area to both A and B?
- [ ] Are inter-links between A and B files consistent?
- [ ] Does the A file contain only Claude family content, and the B file only Antigravity family content?
- [ ] Are A and B cards placed side by side on `index.html`?

---

## 19. Proofreading Before Finalization

**Principle**: AI-generated drafts must always be fully re-read by a human to correct typos, awkward phrasing, and number mismatches.

- **Why**: AI-generated drafts may contain spelling errors, contextually inappropriate expressions, and chapter/section number mismatches. No matter how structurally complete the materials are, many typos undermine credibility.
- **How to apply**:
  - After writing chapter/section files, **read the entire chapter from start to finish** checking for:
    - Typos (spelling, spacing)
    - Contextually inappropriate expressions (literal translations, awkward translated phrasing)
    - Chapter/section number mismatches (incorrect numbers when referencing other chapters)
    - Logical disconnection between sentences (causal relationships reversed, etc.)
  - Proofreading is performed as the **final step** of the §A checklist.
  - Instructor-facing resources (lecture guide, course overview) are subject to the same review.

---

## 20. Lecture Guide Structure

**Principle**: The Lecture Guide provides instructors with all the information needed to run the course, consolidated in one place. Together with the Course Overview principle (§14), these form the two pillars of course materials.

- **Why**: Instructors must navigate content across multiple chapters, so per-chapter instructor notes, time allocation tables, and check questions must be gathered in a single document for real-time reference. Additionally, the Course Overview (for participants) and the Lecture Guide (for instructors) must be consistent in content, order, and timing.
- **How to apply**:

### 20-1. Required Sections

The Lecture Guide must include **all** of the following sections.

| Section | Content | Notes |
|---------|---------|-------|
| Pre-course preparation checklist | What participants must prepare before the course | Announce at least one day before the course |
| Time allocation table | Daily/chapter breakdown, format, estimated time | Breaks calculated separately |
| Per-chapter instructor notes | Tips, participant activities, demo notes per chapter | Include time-short alternatives for when time is short |
| Per-chapter check questions | Comprehension questions to ask at the end of each chapter | Designed to elicit explanations, not guess correct answers |
| Demo sequence | Recommended order for live demonstrations | Reflect inter-chapter dependencies |
| Evaluation criteria | Rubrics for participant assessment | Focused on practical application ability |

### 20-2. Consistency with Course Overview

The Lecture Guide must be **consistent** with the Course Overview in §14 for the following items:

- Daily course order (chapter placement)
- Per-chapter estimated time
- Per-chapter content description
- Total duration

When one side is modified, the other must always be synchronized.

### 20-3. Per-Chapter Instructor Notes Format

Each chapter's instructor notes should include:

- **Position and role**: Where this chapter falls in the overall course, and why it is in this order
- **Key delivery points**: Concepts that must be delivered (the rest can be omitted if time is short)
- **Participant activities**: Discussions, polls, pair activities — things participants do directly
- **Time-short alternatives**: Which parts can be replaced with demos when time is insufficient
- **Irreversible operation warnings**: Operations that affect the environment irreversibly — things all participants should not do simultaneously

### 20-4. Check Question Format

- Write **2–3** open-ended questions per chapter.
- Compose questions that invite participants to **"explain in their own words"** rather than "guess the right answer."
- Including questions that connect core concepts from this chapter to other chapters promotes integrated understanding.
- Examples:
  - "How could this concept be applied to our team's work?" (practical application)
  - "What is the difference between ~ covered in Chapter N and ~ in this chapter?" (inter-chapter connection)

---

## 21. Navigation and Index Structure

**Principle**: Apply consistent navigation structure across all HTML files so learners can move between chapters and sections naturally, and design the index page so the overall structure is visible at a glance.

- **Why**: When the number of chapters exceeds 10, learners find it difficult to track "where am I now, and what's next." Without sidebars, inter-chapter links, and index cards, the learning flow is interrupted.
- **How to apply**:

### 21-1. Intra-Chapter Navigation

Every chapter HTML file must include the following navigation elements:

- **Sidebar (nav)**: Fixed on the left. Contains links to sections (`#id`) within the chapter and a "Handbook Home" link.
- **Chapter navigation (chapter-nav)**: Place `&larr; Previous Chapter | Next Chapter &rarr;` links at the bottom of the chapter.
- **Chapters with A/B splits**: Apply the 3-link branch navigation or 2-link chain navigation per §18.

### 21-2. Index Page (index.html)

The index is the entry point for the entire handbook. Include the following structure:

- **Course title and one-line description**: Placed at the top.
- **Grouping by day and type**: Group chapter cards by course day (e.g., Day 1 / Day 2) and type (concept / hands-on).
- **Chapter cards**: Each card includes the chapter title, 1–2 line description, chapter number tag, and link. Concept chapters and hands-on chapters should be visually distinguishable.
- **Instructor materials group**: Course Overview, Lecture Guide, and other instructor-only resources are placed in a separate group.

### 21-3. Consistency

- All chapter files use the same HTML template structure (layout, nav, main, article).
- The "Handbook Home" link in the sidebar points to the same path (`../index.html` or `./index.html`) across all files.
- Chapter numbers, tag colors, and link styles are applied consistently between chapter files and index cards.

### 21-4. Renumbering Integrity Verification

**Principle**: When adding, deleting, or reordering chapters, **do not stop at merely moving files** — update and verify all four of the following without exception. These are the points most frequently missed during renumbering.

- **Why**: During an actual chapter reordering: ① `chapter-nav` prev/next did not reflect the new order, creating links that skip or loop backward; ② links pointed to new files but label text retained old chapter numbers; ③ newly created files were not added to `site-search.js`'s `DOCS` array, causing them to be missed in full-site search.
- **How to apply**:
  1. **prev/next mutual symmetry** — If document A's `next` points to B, then B's `prev` must point to A. Fixing only one side and missing the other creates a link that works in one direction ("next") but not the other ("previous").
  2. **Link label and target consistency** — The label text (chapter number, title) in `<a href="...">label</a>` must always match the current chapter number and title of the file that `href` actually points to. When moving files, a common mistake is to update only `href` while leaving the label text as the copied old text.
  3. **Search index synchronization** — When adding new chapter files or changing paths, add/update entries in the `DOCS` array in `docs/assets/site-search.js`. Do not omit warmup exercises that have no chapter number.
  4. **Sidebar "Other chapters" list** — Also update the "Other chapters" sidebar list in all affected chapters and the card order/tag numbers on `index.html`.
  - **Verification method**: Use the following script to mechanically check for ① broken links and ② prev/next asymmetry (runs against all HTML files under `docs/`).

    ```
    # (1) Broken links: does the file that href points to actually exist?
    # (2) prev/next asymmetry: A→next→B but B→prev is not A
    # Both can be checked with a single script run — recommended on every renumbering PR
    ```

    The `scripts/validate-nav.ts` automated verification script checks all four items in CI (`bun run scripts/validate-nav.ts`).

---

## 22. Dark Mode Authoring

**Principle**: Define all colors as CSS custom properties (CSS variables), and never use hardcoded hex values. Dark mode follows a 3-layer structure.

- **Why**: Users on system dark mode, manual toggle, and light mode must all see the same content consistently. Hardcoded colors compromise readability in dark mode.

### 22-1. 3-Layer Dark Mode Structure

| Layer | Selector | Purpose |
|-------|----------|---------|
| 1 (base) | `:root` | Light mode defaults |
| 2 (auto) | `@media (prefers-color-scheme: dark)` | Auto-detect OS/browser setting |
| 3 (manual) | `.dark` | User toggle (stored in localStorage) |

### 22-2. Required CSS Variables

All colors used in HTML files must be referenced only through these CSS variables.
Variables are defined in `assets/css/handbook-variables.css` (theme file, overwritten by `apply-handbook-theme.ts`);
structural rules live in `assets/css/handbook-components.css` (never overwritten).

**Semantic accent names (preferred):**

```css
:root {
  /* Backgrounds & text */
  --bg: #ffffff;       --bg2: #f6f8fa;     --bg3: #eef1f4;
  --border: #d0d7de;   --text: #1f2328;    --text-dim: #636c76;
  --text-inverse: #fff;

  /* Accent palette */
  --accent: #0969da;
  --accent-green: #1a7f37;  --accent-purple: #6639ba;
  --accent-dark: #0550ae;   --accent-amber: #953800;   --accent-red: #cf222e;

  /* Semantic callout backgrounds & borders */
  --bg-info: #ddf4ff;  --bg-note: #fff8c5;  --bg-warn: #fff1c5;
  --bg-success: #dafbe1; --bg-error: #ffebe9;
  --border-info: #0969da; --border-note: #9a6700;
  --border-warn: #9a6700; --border-success: #1a7f37; --border-error: #cf222e;

  /* Code blocks & tags */
  --code-bg: #f6f8fa;  --code-border: #d0d7de;
  --tag-bg: #ddf4ff;   --tag-text: #0550ae;

  /* Platform colors (Claude, Claude App, AGY, Antigravity) */
  --platform-claude: #d97706;   --platform-claudeapp: #f59e0b;
  --platform-agy: #0550ae;      --platform-antigravity: #6639ba;

  /* Badge palettes (bg/fg/border per color) */
  --badge-green-bg/fg/border;   --badge-blue-bg/fg/border;
  --badge-purple-bg/fg/border;  --badge-amber-bg/fg/border;
  --badge-orange-bg/fg/border;  --badge-indigo-bg/fg/border;
  --badge-violet-bg/fg/border;  --badge-red-bg/fg;
  --badge-lab-bg/fg/border;

  /* Compare boxes & situation/video */
  --compare-without-bg/border;  --compare-with-bg/border;
  --bg-situation;  --border-situation;
  --bg-video;      --border-video;
}
```

**Backward-compatible aliases** (legacy files still work):
- `--accent2` → `var(--accent-green)`
- `--accent3` → `var(--accent-amber)`
- `--accent4` → `var(--accent-purple)`
- `--accent5` → `var(--accent-red)`
- `--accent6` → `var(--accent-dark)`

### 22-3. Prohibitions

- No inline `style="color: #0969da"` — always use CSS variables
- No hardcoded hex in CSS files (except in the variable definition block)
- No hardcoded colors in SVG — use `currentColor` or CSS variables

### 22-4. Transition Effects

Apply smooth transitions to all color changes:
```css
body, header, main, footer, nav, .sidebar {
  transition: background-color 0.2s, color 0.2s;
}
```

---

## 23. Multi-Language File Convention

**Principle**: Multi-language support uses separate HTML files following an AI-friendly filename pattern.

- **Why**: Mixing multiple languages in a single HTML file makes search indexing, translation management, and CMS integration difficult. Separate files allow independent management and search engine optimization per language.

### 23-1. Filename Pattern

| Type | Filename | Example |
|------|----------|---------|
| Default (single language) | `chapter_01.html` | Default file for the handbook's primary language |
| Korean explicit | `chapter_01_ko.html` | Korean version, separated from default |
| English | `chapter_01_en.html` | English translation |
| Japanese | `chapter_01_ja.html` | Japanese translation |

### 23-2. Language Switcher

Place a language switcher dropdown in every page header:
- Detect `_XX` suffix in the current filename to extract the base name
- Navigate to the selected language file on selection
- Save user selection to `localStorage('lang')`

### 23-3. Search Index

The `DOCS` array in `site-search.js` includes all language variants:
```javascript
const DOCS = [
  { path: 'chapters/chapter_01.html', title: 'Chapter 1 Introduction' },
  { path: 'chapters/chapter_01_en.html', title: 'Chapter 1 Introduction (EN)' },
];
```

---

## 24. Instructor Guide Requirements

**Principle**: The Instructor Guide (`instructor-guide.html`) provides instructors with all the information needed to run the course, consolidated in one place.

- **Why**: Instructors must navigate content across multiple chapters, so per-chapter instructor notes, time allocation tables, and check questions must be gathered in a single document for real-time reference.

### 24-1. Required Sections

| Section | Content | Notes |
|---------|---------|-------|
| Pre-course preparation checklist | What participants must prepare before the course | Announce at least one day before |
| Time allocation table | Daily/chapter breakdown, format, estimated time | Breaks calculated separately |
| Per-chapter instructor notes | Tips, participant activities, demo notes per chapter | Include time-short alternatives |
| Per-chapter check questions | Comprehension questions at the end of each chapter | Designed to elicit explanations |
| Demo sequence | Recommended order for live demonstrations | Reflect inter-chapter dependencies |
| Evaluation criteria | Rubrics for participant assessment | Focused on practical application ability |

### 24-2. Per-Chapter Instructor Notes Items

Each chapter's instructor notes should include:
- **Position and role**: Where in the overall course this chapter falls
- **Key delivery points**: Concepts that must be delivered
- **Participant activities**: Discussions, polls, pair activities, etc.
- **Time-short alternatives**: Parts that can be replaced with demos
- **Irreversible operation warnings**: Operations with irreversible environmental impact

### 24-3. Consistency with Course Overview

The Lecture Guide must be consistent with the Course Overview in §14 regarding schedule, order, and timing. When one side is modified, the other must always be synchronized.

---

## A. Pre-Ship Checklist

After completing the draft, verify each item below one by one.

- [ ] §1: Do concept explanations include analogies/reasons?
- [ ] §2: Do all code boxes have "Copy" buttons, and does one step = one action?
- [ ] §3: Are role definitions written first as tool-neutral `AGENTS.md` specs?
- [ ] §4: Do numbers/classifications/names match official sources? (research if necessary)
- [ ] §5: Are there any expressions that lock descriptions to a single organizational scale?
- [ ] §6: Are there any artificial time/scope constraints? Has the time allocation table been recalculated?
- [ ] §7: Are all prerequisites (account creation, admin privileges, subscriptions) included without exception?
- [ ] §8: Are learner materials in `.html` with navigation and search?
- [ ] §9: Is OS splitting applied only to "real incompatibilities"? Are simple commands shown in a single example?
- [ ] §9: Do incompatibility notes accurately distinguish between "command vs. syntax"?
- [ ] §10: Do complex concepts have SVG/diagrams?
- [ ] §10-1: Does each section have at least one visual element? (Reference documents exempt)
- [ ] §10-2: Do SVGs use `viewBox` and are responsive?
- [ ] §10-2: Do SVG colors follow a consistent palette?
- [ ] §11: Are there any lines broken by mid-sentence word emphasis?
- [ ] §11-1: Do flex children `.step-content` have `min-width: 0`, and do text boxes have `overflow-wrap: break-word`?
- [ ] §11-1: Do text boxes inside `.platform-block` have negative margin compensation?
- [ ] §11-2: Do fixed elements (badges, titles) inside flex containers have `flex-shrink: 0`?
- [ ] §12-1: Are sentence endings unified in plain form?
- [ ] §12-2: Are English technical terms glossed with Korean(English) only on first appearance in the document, and English-only thereafter?
- [ ] §12-2: Do `<title>`/`<h1>`/`chapter-eyebrow`/nav heading text use English only, without parenthetical glosses or Korean-only labels?
- [ ] §12-3: Are chapter/section references in `N장 §M` format throughout?
- [ ] §12-4: Are em-dashes minimized?
- [ ] §13: Are tool comparisons free from misunderstanding, with no missing items, and visually balanced?
- [ ] §14: Has the Course Overview been written, and are all 9 items included?
- [ ] §14: Do the Course Overview's learning objectives map 1:1 to body sections?
- [ ] §15: Does each chapter connect to the next, and are all supplementary documents present?
- [ ] §15-1: Does the last chapter have a "Next Steps" section?
- [ ] §16: Is the body in the course's primary language, and code/identifiers/commits in English?
- [ ] §17: Do sections with available official videos have a "Video References" block?
- [ ] §17: Are video links styled consistently with the `.video-refs` pattern?
- [ ] §18: Have A/B splits been applied to sections with platform-specific implementation differences?
- [ ] §18: Does branch navigation connect from the common area to both A and B?
- [ ] §18: Are inter-links between A and B files consistent?
- [ ] §19: Has the entire text been re-read for typos, awkward phrasing, and number mismatches?
- [ ] §20: Has the Lecture Guide been written, and are all required sections included?
- [ ] §20: Is the Lecture Guide consistent with the Course Overview in schedule, order, and timing?
- [ ] §21: Do all chapter files have sidebars and inter-chapter navigation?
- [ ] §21: Is the index page grouped by day and type?
- [ ] §21: Do chapter files and index cards have consistent chapter numbers, titles, and links?
- [ ] §21-4: (On renumbering) Are prev/next of all affected chapters mutually symmetric?
- [ ] §21-4: (On renumbering) Do link label chapter numbers/titles match the actual target files?
- [ ] §21-4: (On renumbering) Have new/moved files been reflected in `site-search.js`'s `DOCS` array?

---

*This guideline was extracted from actual review feedback received during a harness engineering handbook authoring session. It was written to help avoid repeating the same mistakes when creating new courses and to save reviewers' time. When principles are added or modified, update this file.*
