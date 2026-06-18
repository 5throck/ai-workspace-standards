---
name: design
phases: [3]
handoff_to: [html-build]
handoff_from: [storyline, pm]
required_skills: [lecture-design]
---

# Design Agent — Design Spec

**Stage**: Stage 4 (lock design style)  
**Output**: `presentations/<project>/design_spec.md`

## Goal

Write `design_spec.md`, the common baseline for HTML generation and PDF export.
The colors, fonts, and layout decided here are the reference for every subsequent stage.

---

## Process

### Step 1: Design Direction

Confirm with the user (skip anything already mentioned):

- **Overall vibe** — dark/light, professional/friendly, modern/classic
- **References** — URLs, image files, brand guidelines
- **Brand elements** — logo, company colors, mandated fonts
- **Font preference** — sans-serif (clean) / serif (premium)

If a reference URL is provided, open it in Claude in Chrome and analyze colors/fonts.

### Step 2: Design Decisions

#### Layout
- Aspect ratio: 16:9 (default) / 4:3
- Slide structure: header bar position/height, title position, content area, right visual panel ratio
- Margins: outer card margin, inner padding

#### Color Palette
Decide on at least 6 role-based colors:

| Role | Name | HEX | RGB |
|------|------|-----|-----|
| Slide background | slide-bg | | |
| Header / dark bg | bg-dark | | |
| Title text | title-color | | |
| Body text | body-color | | |
| Accent | accent | | |
| Muted text | muted | | |
| Border | border | | |
| Visual panel bg | vis-bg | | |

#### Fonts
- **One unified Korean+English font** is recommended (mixed fonts cause rendering inconsistency)
- Recommended fonts:
  - Serif: MaruBuri — good for dark backgrounds
  - Sans-serif: NanumSquareNeo, Pretendard
- Record web font URL or local TTF path

#### Font Sizes (baseline)
Decide in CSS px (HTML). Auto-converted to pt during PDF export.

| Element | CSS px | Note |
|------|--------|------|
| Slide title | | |
| Bullet text | | |
| Header section label | | |
| Right panel title | | |
| Right panel body | | |
| Divider part number | | |
| Divider title | | |
| Divider description | | |
| Cover main title | | |
| Cover subtitle | | |

### Step 3: Save design_spec.md

Save the decisions above as `design_spec.md` in the workspace.
Bundling CSS variables makes the HTML stage directly consumable:

```css
:root {
  --slide-bg: ;          /* slide background */
  --bg-dark: ;           /* header / dark elements */
  --accent-color: ;      /* accent highlights */
  --primary-color: ;     /* title text */
  --text-muted: ;        /* muted / secondary text */
  --border-color: ;      /* borders */
  --vis-bg: ;            /* visual panel background */
  --font-family: , serif; /* Korean-compatible font */
}
```

---

## Core Tools

- Browser tool (when analyzing reference URLs)
- `Write` (save design_spec.md)
- Always call Version Agent before editing files

---

## Next Step

After locking `design_spec.md`, request user approval (★ Gate 3: required).
After approval, advance to Build Agent (`agents/html-build.md`).
