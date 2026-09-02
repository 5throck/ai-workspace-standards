# Design Foundation Framework — Design Document

> **Update 2026-09-01**: process pipeline & design-phase gate (§2b of the template doc) added by [ADR-0066](../adr/0066-design-process-pipeline.md) — style-neutral method adopted from co-newbiz ADR-0087 practice.

- **Spec ID**: design-foundation-2026-08-30
- **Date**: 2026-08-30
- **Status**: Approved
- **Owner**: architect
- **Sources**: `Projects/co-price/docs/design.md` (Onyx 2.0), `Projects/co-newbiz/docs/design-guide.md` (Onyx 3.0), `templates/co-design/` (tokens.json, token-usage-lint, accessibility-audit)

## 1. Problem Statement

co-price and co-newbiz each developed mature design systems independently. Their reusable patterns (token architecture, typography roles, accessibility defaults, enforcement layers) exist only inside those projects. New projects start from zero and tend to either copy a specific style (Onyx) or improvise inconsistently.

The workspace needs a **style-neutral methodology layer** so every new project can derive its own design system through a repeatable procedure — without the workspace prescribing colors, fonts, density, or trends.

## 2. Core Principle

> **Foundation ≠ Design System.**

The Foundation defines *how to build* a design system. The actual design system is each project's `docs/design.md` (project-specific SSOT). L0/L1 contain methodology only; design selection happens at the project level.

### Layer Responsibilities (fixed)

| Artifact | Layer | Role | Nature |
|----------|-------|------|--------|
| `templates/common/docs/design-foundation.md` | L1 | What must be defined | Specification / Reference |
| `templates/common/docs/design-tokens.template.css` | L1 | How tokens are expressed | Implementation Scaffold |
| `skills/design-foundation/SKILL.md` | L0→L1 | How to derive and apply | Procedure / Agent Behavior |
| Project `docs/design.md` + token implementation | Project | What the project actually chose | Project-specific SSOT |

## 3. Normative Design Principles (SHALL statements)

1. **SHALL**: Theme variation SHALL be expressed primarily through semantic-token mapping; primitive tokens SHOULD remain theme-neutral.
2. **SHOULD**: Design decisions SHOULD record domain evidence/principle rationale so that the provenance chain **Domain Evidence → Design Principle → Design Decision → Token → Component** can be reconstructed.

## 4. Architecture

```
                    DESIGN FOUNDATION (L0/L1 — methodology only)
                                  │
              ┌───────────────────┼───────────────────┐
              ↓                   ↓                   ↓
         Philosophy          Token Model        Accessibility
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  ↓
                       Design Procedure (SKILL.md)
                                  │
                                  ↓
                  ┌───────────────────────────────┐
                  │  Project Context / Domain     │
                  │  Evidence                     │
                  └───────────────┬───────────────┘
                                  ↓
                          Design Decisions
              (philosophy / color / typography / spacing /
               radius / motion / iconography + rationale)
                                  ↓
                        Token Architecture
                Primitive → Semantic ← [data-theme] mapping → Component
                                  ↓
                             UI Components
                                  ↓
                          Design Validation
```

### Repository placement and propagation

```
L0 Workspace
├── templates/common/docs/
│   ├── design-foundation.md          # Specification
│   └── design-tokens.template.css    # Scaffold
└── skills/design-foundation/
    └── SKILL.md                      # Procedure
        │
        ↓ propagate (scope: common)   L0 → L1 (Fork Model for L2)
L1 templates/common/skills/design-foundation/
        │
        ↓ l2_propagate = false        (no forced variant distribution)
Project — autonomously derives:
├── docs/design.md                    # Project SSOT
└── design-tokens.css (or tokens.json + compiled forms)
```

## 5. Token Model

Three explicit layers with a strict reference rule:

```
Primitive Tokens    --color-primary-500, --color-neutral-100 …  (theme-neutral)
        ↓
Semantic Tokens     --background, --foreground, --border …      (theme-mapped)
        ↓
Component Tokens    --button-primary-bg …                       (semantic-only refs)
        ↓
UI Components
```

- Semantic tokens reference ONLY primitives; component tokens reference ONLY semantics; components MUST NOT bypass either layer.
- **Theme mechanism**: `[data-theme="<name>"]` attribute selector on the semantic layer (canonical workspace convention, aligned with `templates/co-design/scripts/compile-tokens.ts` and `token-usage-lint`). Not a `.dark` class. This generalizes to any named theme (dark, high-contrast, …).
- Token contract: a project token file MUST provide a default theme (`:root`) plus at least one alternate theme (typically dark), each supplying the full semantic set including bg/fg/border triplets.

```css
/* Primitive (theme-neutral) */
:root { --color-neutral-100: <value>; --color-neutral-900: <value>; }
/* Semantic — default theme */
:root { --background: var(--color-neutral-100); --foreground: var(--color-neutral-900); }
/* Semantic — alternate theme */
[data-theme="dark"] { --background: var(--color-neutral-950); --foreground: var(--color-neutral-100); }
```

## 6. Design Decision Record Schema

Each project's `docs/design.md` MUST include a `design_decisions` record. Every selection carries a `rationale` tracing back to domain evidence/principles:

```yaml
design_decisions:
  philosophy:
    - principle: "<principle>"
      rationale: "<domain evidence>"
  color:
    selected: "<system>"
    rationale: "<...>"
  typography:
    body:    { selected: "<font>", rationale: "<...>" }
    heading: { selected: "<font>", rationale: "<...>" }
    numeric: { selected: "<font>", rationale: "<...>" }
  spacing:   { scale: "<scale>",  rationale: "<...>" }
  radius:    { scale: "<scale>",  rationale: "<...>" }
  motion:    { policy: "<policy>", rationale: "<...>" }
  iconography: { library: "<library>", rationale: "<...>" }
```

This prevents agents from making arbitrary aesthetic choices: every decision must be traceable to a domain rationale.

## 7. Design Validation Contract

This phase defines the **contract only**. Automated lint implementation is deferred to a follow-up backlog item.

### [Required]
- ✓ design.md exists (project SSOT)
- ✓ token implementation exists (CSS custom properties, tokens.json, or equivalent)
- ✓ default theme + at least one alternate theme of semantic tokens exist
- ✓ bg / fg / border semantic triplets exist
- ✓ typography roles defined (body / heading / numeric)
- ✓ icon library defined
- ✓ WCAG AA target declared
- ✓ focus state defined
- ✓ non-color state encoding defined (icon + text + color)

### [Consistency]
- ✓ component tokens do not bypass semantic tokens
- ✓ icon-only buttons have accessible labels
- ✓ numeric UI uses tabular numerals where appropriate
- ✓ no hard-coded design values in governed components

### Relationship to existing skills (no duplication)
- Hardcoded-value detection: extends **`token-usage-lint`** (co-design) — same rule family, generalized beyond co-design.
- Accessibility verification: references **`accessibility-audit`** (axe-core, `l2_propagate: true`) rather than redefining WCAG rules.

## 8. co-design Coherence Decisions

| # | Decision |
|---|----------|
| 1 | Theme mechanism is `[data-theme]` (co-design canon via compile-tokens.ts), not `.dark` class |
| 2 | Token scaffold follows co-design naming (`--color-*`) and `[data-theme]` block structure; co-design `tokens.json` + `compile-tokens.ts` referenced as reference implementation. Existing flat tokens.json is NOT changed — 3-layer migration recorded as backlog only |
| 3 | Lint contract reuses token-usage-lint and accessibility-audit; no new overlapping skills |
| 4 | `design-foundation` skill triggers avoid "design system" (owned by co-design `ui-ux-design-intelligence`); `relates_to: ui-ux-design-intelligence (precedes)` — foundation runs first, ui-ux-design-intelligence takes over implementation |
| 5 | co-design `docs/co-design.context.md` phantom `docs/design-system/` reference and DOMAIN_DOC_DIRS misalignment cleaned up in this change |

## 9. Extracted Reusable Patterns (from co-price / co-newbiz)

1. HSL/CSS-custom-property token architecture with semantic bg/fg/border triplets and multi-theme support (Onyx 2.0 → 3.0 evolution: dark-only → light-default with equal dark).
2. Role-based 3-font stack principle (body — Korean-optimized; heading — Latin/display; numeric/code — mono with `tabular-nums`). Actual fonts are per-project decisions.
3. Philosophy derivation procedure: principles derived from the project's domain (density, trust, clarity…), plus operating rules (P1–P6 style).
4. Iconography rules: single library, consistent size/stroke, aria-label for icon-only buttons, never color-only signals.
5. Three-layer enforcement: prose spec (design.md) + token file + skill/agent review; optional mechanical lint.
6. Accessibility defaults: WCAG AA, visible focus, multi-encoded status.

All of the above are encoded in the Foundation as *selection criteria and procedures*, never as fixed values.

## 10. Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| Copy Onyx 2.0/3.0 into the template | Prescribes a specific style — violates the requirement |
| Put 3-layer tokens into co-design `tokens.json` now | Breaks co-design's working compiler/lint contract; deferred to backlog |
| Documentation only (no skill) | Projects would not reliably follow the derivation procedure; a SKILL.md is the workspace's mechanism for agent-executable procedures |
| `l2_propagate: true` for the skill | Would force the methodology onto every variant; design decisions are per-project, autonomous application is the architectural property |

## 11. Success Criteria

- New projects scaffolded from `templates/common` receive the Foundation spec + scaffold + skill.
- A project following the skill produces `docs/design.md` with a complete `design_decisions` record and a validated token file.
- No conflict with co-design skills (trigger, naming, or mechanism level).
- Automated lint implementation tracked as backlog, contract already testable by review.
