---
name: ui-component-design
scope: co-price
description: Onyx 2.0 component design patterns
version: "2.0.0"
last_reviewed: 2026-08-25
status: active
owner: ux-specialist
prerequisites: docs/design.md token sheet; i18n keys prepared for new strings
relates_to:
  - skill: cost-shock-analysis
    type: follows
  - skill: financial-statement-prep
    type: follows
---

# UI Component Design Skill (`ui-component-design`)

## 1. Description
Applies the **Onyx 2.0 Strategic Financial Aesthetics (SFA)** design system to React components. Ensures all UI elements conform to the design tokens, typography, and component standards defined in `docs/design.md`.

## 2. Trigger Criteria
- "Create a new UI component"
- "Style a dashboard card"
- "Apply Onyx theme"
- "Fix typography or spacing"
- "Build input fields or form elements"

## 3. Allowed Tools
- `write_to_file` & `replace_file_content`: To create or edit `.tsx` and `.css` files.
- `view_file`: To read `docs/design.md` for token reference.

## 4. Design Token Reference (`docs/design.md`)

### Color System (HSL)
| Token | Value |
|---|---|
| Background (Onyx) | `hsl(240, 10%, 4%)` |
| Surface (Card base) | `hsl(240, 10%, 8%)` |
| Surface Elevated | `hsl(240, 10%, 12%)` |
| Border | `hsla(0, 0%, 100%, 0.08)` |
| Primary (Strategic Blue) | `hsl(217, 91%, 60%)` |
| Success (Emerald Profit) | `hsl(158, 64%, 52%)` |
| Warning (Amber Risk) | `hsl(45, 93%, 47%)` |
| Danger (Rose Loss) | `hsl(346, 84%, 61%)` |

### Typography
| Target | Font | Weight |
|---|---|---|
| Headings | `Inter` | 900, UPPERCASE |
| Body | `Pretendard`, `Inter` | 400 |
| Financial Figures | `JetBrains Mono` | 700, `tabular-nums` |
| Sub-Labels | `Inter` | 900, UPPERCASE, 0.2em tracking |

## 5. Behavior Rules
- **Glassmorphism**: Use `backdrop-blur(24px)` + `bg-surface/70` for card surfaces.
- **Radius**: Cards use `24px` (--radius-3xl), Inputs use `16px` (--radius-xl).
- **Border Accent**: Left-side 2px accent border matching category (Blue=Sales, Emerald=Profit).
- **Icons**: Lucide-React, 20px, stroke-width `1.5`, monochrome.
- **Layout Target**: `max-width: 1840px`, 40px side padding, optimized for 1920px monitors.
- **Independent Scrolling**: Sidebar fixed/sticky with `overflow-y-auto`; Main content scrolls independently.

## 6. Expected Output
A production-ready `.tsx` component using the Onyx 2.0 design system tokens, with no inline styles and no hardcoded color values.
## Context

See [docs/co-price.context.md](../docs/co-price.context.md) for project context and the consulting engagement lifecycle.

## When to Use

- When a co-price task requires **Onyx 2.0 component design patterns** within the engagement lifecycle.

## Execution Steps

1. **Receive dispatch** from PM with task parameters and document anchors.
2. **Execute** the skill procedure against the artifacts named in the task scope.
3. **Report** results to the dispatching agent with evidence links.

## Output Format

Structured markdown report delivered to the dispatching agent, citing document anchors (for example `[Ref: biz_logic.*]`) where applicable.

## Related Skills

- Owner agent: `ux-specialist`. See `variant.json` skills registry for the full co-price skill set.
