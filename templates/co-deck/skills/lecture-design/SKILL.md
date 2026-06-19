---
name: lecture-design
version: 1.1.0
description: >
  Locks visual design style. Decides layout, color palette, font family and
  saves design_spec.md. Can analyze reference URLs/images. Responds to "lock
  design", "pick colors/fonts", "make design spec" (Korean: "디자인 잡아줘",
  "컬러 정해줘", "폰트 골라줘", "레이아웃 구성해줘"). Stage 4 of the workflow.
---

## Role

Locks the visual design — layout, colors, and fonts — into `design_spec.md`.
This file is the shared reference for HTML generation and PDF export.
Always call Version Agent before editing.

## When to Invoke

- PM Agent dispatches after Gate 2 approval (storyline locked)
- User says "lock design" / "디자인 잡아줘" / "컬러 정해줘"
- User wants to change visual direction mid-project

---

## Step 1: Confirm Design Direction

Confirm with the user (skip anything already mentioned):

- **Overall vibe** — dark/light, professional/friendly, modern/classic
- **References** — URLs, image files, brand guidelines
- **Brand elements** — logo, company colors, mandated fonts
- **Font preference** — sans-serif (clean) / serif (premium)

If a reference URL is provided, open it in Claude in Chrome and analyze colors and fonts.

---

## Step 2: Design Decisions

### Layout

- Aspect ratio: 16:9 (default) / 4:3
- Slide structure: header bar position/height, title position, content area, right visual panel ratio
- Margins: outer card margin, inner padding

### Color Palette

Decide on at least 8 role-based colors:

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

### Fonts

- **One unified Korean+English font** is strongly recommended (mixed fonts cause rendering inconsistency)
- Recommended fonts:
  - Serif: MaruBuri — good for dark backgrounds
  - Sans-serif: NanumSquareNeo, Pretendard
- Record web font URL or local TTF path

### Font Sizes (baseline)

Decide in CSS px (HTML). Auto-converted to pt during PDF export.

| Element | CSS px | Note |
|---------|--------|------|
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

---

## Step 3: Save design_spec.md

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

## Tools

- Browser tool (when analyzing reference URLs)
- `Write` (save design_spec.md)
- Always call Version Agent before editing files

---

## Next Step

After locking `design_spec.md`, request user approval (★ Gate 3 — required).
After approval, advance to Build Agent (`agents/html-build.md`).
