---
name: lecture-design
version: 1.0.0
description: >
  Locks visual design style. Decides layout, color palette, font family and
  saves design_spec.md. Can analyze reference URLs/images. Responds to "lock
  design", "pick colors/fonts", "make design spec" (Korean: "디자인 잡아줘",
  "컬러 정해줘", "폰트 골라줘", "레이아웃 구성해줘"). Stage 4 of the workflow.
---
# Design Agent — Design Spec

**Stage**: Stage 4 (lock design style)  
**Output**: `presentations/<project>/design_spec.md`  
**Full instructions**: `agents/design.md`

## Role

Locks the visual design — layout, colors, and fonts — into `design_spec.md`.
This file is the shared reference for HTML generation and PDF export.
Always call Version Agent before editing.

## When to Invoke

- PM Agent dispatches after Gate 3 approval
- User says "lock design" / "디자인 잡아줘" / "컬러 정해줘"
- User wants to change visual direction mid-project

## Quick Reference

**Inputs**: user design preferences, reference URLs/images, brand guidelines

**design_spec.md** covers: layout proportions, color palette (8 roles), font family + sizes

**Recommended fonts** (Korean-compatible):
- Serif (dark bg): MaruBuri
- Sans-serif: NanumSquareNeo, Pretendard

**CSS variable schema** (include in design_spec.md; fill values per project):
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

**Next step**: Request user approval (★ Gate 3 — required). Then advance to Build Agent (`agents/html-build.md`).

→ Full color-palette table, font-size table, reference URL analysis guide: see `agents/design.md`
