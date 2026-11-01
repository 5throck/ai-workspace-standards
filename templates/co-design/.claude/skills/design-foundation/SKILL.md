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
version: 1.2.0
last_reviewed: 2026-11-02
status: active
scope: common
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

## Context

Derive a **project-specific design system** through a traceable procedure. This skill is the
*Procedure* layer of the Design Foundation framework:

| Layer | Artifact |
|-------|----------|
| Specification (what to define) | `docs/design-foundation.md` (shipped inside a generated variant project's `docs/`; does not exist at workspace root) |
| Scaffold (how tokens are expressed) | `docs/design-tokens.template.css` |
| **Procedure (this skill)** | How to derive and apply |
| Project SSOT (what was chosen) | Project `docs/design.md` + token implementation |

> **Foundation ≠ Design System.** Never copy values from another project (e.g. an existing
> design system) unless the project explicitly decides to — and then record that as a decision
> with rationale.

## When to Use

**Use when:**
- Establishing design principles for a new project
- Creating a project design guide (`docs/design.md`)
- Setting up a design token system (Primitive → Semantic ← `[data-theme]` → Component)
- Reviewing a project's design foundation completeness

**Do NOT use when:**
- The task is selecting visual values for the project — this skill structures *how the project decides*; it does not decide (see Boundaries)
- Component-level design and implementation after tokens exist → `ui-ux-design-intelligence`

## Execution Steps

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

Create the project design SSOT in one of the two governed shapes
(`docs/design-foundation.md` §4b): the default **single-file** `docs/design.md`
containing the `design_decisions` YAML block (§4), or — for projects whose
design record has outgrown one file — a **governed suite** (e.g.
`docs/design-system/`) with one doc declared the design policy of record,
valid only under the §4b conditions (rationale in each home doc, Source
Mapping tables, governance frontmatter, bilingual twins under the i18n
policy, registry cross-references, review fold-back annotations). Every
selection — philosophy, color system, typography (body/heading/numeric, each
value carrying the fallback stack contract), spacing, radius, motion,
iconography (backed by a registered vocabulary) — MUST carry a `rationale`
tracing back to a principle. No arbitrary aesthetic choices.

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
- If iconography is decided: activate the commented icon tokens
  (`--icon-size`/`--icon-stroke`/`--icon-color`) and maintain the project's
  machine-readable icon vocabulary registration

### Stage 5 — Components

Build UI consuming component tokens only. Multi-encode status signals (color + icon + text);
`aria-label` on every icon-only control; visible `:focus-visible` state. Reference
components only from the declared component inventory (`components.template.md`);
new components enter via the design-phase gate.

### Stage 6 — Validation

Run the Design Validation Contract (`docs/design-foundation.md` §7):

- **[Required]** project SSOT in a declared shape — single-file design.md with complete
  `design_decisions`, or a governed suite per §4b with every checklist item locatable
  to its home artifact; token implementation; default +
  alternate theme; bg/fg/border triplets; typography roles; icon library; icon vocabulary
  declared; component inventory declared; WCAG AA declared; focus state; non-color state
  encoding
- **[Consistency]** no semantic-layer bypass; accessible labels on icon-only buttons;
  tabular numerals in numeric UI; no hard-coded values in governed components;
  icon tokens, where activated, resolve from the registered icon vocabulary

Use `token-usage-lint` where available for hardcoded-value detection, and `accessibility-audit`
(axe-core, WCAG 2.1 AA) for accessibility verification.

Report the validation result in the project `docs/design.md` (or a linked validation section)
before the design foundation is considered complete.

## Output Format

The procedure produces, per project:

- **Design decision record (project SSOT)**: `docs/design.md` with the complete
  `design_decisions` YAML block — or a governed suite declared per §4b —
  every selection carrying a `rationale` traced to a numbered principle
- **Token implementation**: the project token file filled from
  `docs/design-tokens.template.css` (e.g. `styles/design-tokens.css`) with a
  default theme on `:root` plus at least one alternate `[data-theme]` block
- **Component inventory reference**: `components.template.md` as the declared
  gate for new components
- **Validation report**: the Design Validation Contract result recorded in the
  project `docs/design.md` (or a linked validation section)
- **Provenance chain**: Domain Evidence → Design Principle → Design Decision
  → Token → Component, preserved end-to-end

## Boundaries

- This skill does NOT select visual values for the project — it structures how the project decides.
- For component-level design and implementation after tokens exist, hand off to
  `ui-ux-design-intelligence` (this skill `precedes` it).
- Projects are autonomous: they may diverge from the reference implementation as long as the
  architecture (3 layers, `[data-theme]`, decision record) and validation contract hold.

## Related Skills

- **ui-ux-design-intelligence** — this skill enables it; hand off for component-level
  design and implementation after tokens exist (this skill precedes it)
- **token-usage-lint** — composes during Stage 6 validation: machine check for
  hard-coded values in governed components
- **accessibility-audit** — composes during Stage 6 validation: axe-core,
  WCAG 2.1 AA accessibility verification
