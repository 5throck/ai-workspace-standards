---
name: design-foundation
description: >
  Style-neutral procedure for deriving a project's own design system. Walks a
  project from domain evidence to design principles, recorded design decisions,
  and a 3-layer token architecture (Primitive → Semantic ← [data-theme] →
  Component). Use when: establishing design principles for a new project,
  creating a project design guide (docs/design.md), setting up a design token
  system, or reviewing a project's design foundation completeness. Does NOT
  prescribe colors, fonts, spacing, or trends — those are project decisions.
version: 1.0.0
last_reviewed: 2026-08-30
status: active
scope: common
l2_propagate: false
owner: architect
prerequisites: none
relates_to:
  - skill: ui-ux-design-intelligence
    type: enables
  - skill: token-usage-lint
    type: composes_with
  - skill: accessibility-audit
    type: composes_with
metadata:
  type: process
  triggers:
    - design foundation
    - design principles
    - design guide
    - design tokens setup
    - design decision record
---

# 🎨 Skill: design-foundation

## Purpose

Derive a **project-specific design system** through a traceable procedure. This skill is the
*Procedure* layer of the Design Foundation framework:

| Layer | Artifact |
|-------|----------|
| Specification (what to define) | `docs/design-foundation.md` (in this template's `docs/`) |
| Scaffold (how tokens are expressed) | `docs/design-tokens.template.css` |
| **Procedure (this skill)** | How to derive and apply |
| Project SSOT (what was chosen) | Project `docs/design.md` + token implementation |

> **Foundation ≠ Design System.** Never copy values from another project (e.g. an existing
> design system) unless the project explicitly decides to — and then record that as a decision
> with rationale.

## Procedure

### Stage 1 — Domain Evidence

Read the project's PRD/SRS/context docs and user profiles. Produce an evidence list:

- Information density needs (expert console vs consumer app)
- Data criticality: are numbers/figures core? Do they need provenance?
- Audience and accessibility constraints (regulatory, language)
- Workflow shape: freeform vs staged processes
- Baseline viewport / device context

### Stage 2 — Design Principles

From the evidence, derive **3–6 numbered principles**, each with its rationale
(e.g. "Expert Density — the domain requires dense but legible consoles").
Optionally add operating rules (P1–P6 style) for machine-checkable constraints.

### Stage 3 — Design Decision Record

Create `docs/design.md` containing the `design_decisions` YAML block
(see `docs/design-foundation.md` §4). Every selection — philosophy, color system,
typography (body/heading/numeric), spacing, radius, motion, iconography — MUST carry a
`rationale` tracing back to a principle. No arbitrary aesthetic choices.

Provenance chain to preserve:

```
Domain Evidence → Design Principle → Design Decision → Token → Component
```

### Stage 4 — Token Architecture

Copy `docs/design-tokens.template.css` into the project (e.g. `styles/design-tokens.css`) and fill
every `<value>` placeholder according to the decisions. Enforce the architecture:

- Primitive (`--color-*`, fonts, spacing) — theme-neutral
- Semantic (`--background`, `--border`, status bg/fg/border triplets) — themed via
  **`[data-theme="<name>"]`** (default theme on `:root` + at least one alternate, typically dark)
- Component (`--button-*`, `--card-*`, …) — reference semantics only; no layer bypass
- If figures are domain-critical: numeric font role with `font-variant-numeric: tabular-nums`

### Stage 5 — Components

Build UI consuming component tokens only. Multi-encode status signals (color + icon + text);
`aria-label` on every icon-only control; visible `:focus-visible` state.

### Stage 6 — Validation

Run the Design Validation Contract (`docs/design-foundation.md` §7):

- **[Required]** design.md with complete `design_decisions`; token implementation; default +
  alternate theme; bg/fg/border triplets; typography roles; icon library; WCAG AA declared;
  focus state; non-color state encoding
- **[Consistency]** no semantic-layer bypass; accessible labels on icon-only buttons;
  tabular numerals in numeric UI; no hard-coded values in governed components

Use `token-usage-lint` where available for hardcoded-value detection, and `accessibility-audit`
(axe-core, WCAG 2.1 AA) for accessibility verification.

Report the validation result in the project `docs/design.md` (or a linked validation section)
before the design foundation is considered complete.

## Boundaries

- This skill does NOT select visual values for the project — it structures how the project decides.
- For component-level design and implementation after tokens exist, hand off to
  `ui-ux-design-intelligence` (this skill `precedes` it).
- Projects are autonomous: they may diverge from the reference implementation as long as the
  architecture (3 layers, `[data-theme]`, decision record) and validation contract hold.
