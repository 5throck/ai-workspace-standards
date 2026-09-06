---
schemaVersion: 1.0.0
spec-id: universal-design-extension
---

# Universal Design Extension — Design

## 1. Overview and Objectives

Implements the design analysis behind ADR-0068. The 3-layer comparison review
(L0/L1/L2, 2026-09-06) established that accessibility is uniformly propagated as
WCAG 2.1 AA conformance, but Universal Design — design-stage evaluation across
the full diversity of users — is absent everywhere, and several conformance
artifacts themselves have gaps (checklist, skill dependencies, pattern
inventory). Objective: adopt UD as the review-method layer above the WCAG floor
and schedule the artifact gaps as its implementation path.

## 2. Problem Statement

- WCAG conformance ≠ good design for aging, cognitively loaded, or
  situationally impaired users; no artifact in any layer evaluates those axes.
- L1 review checklist has no Accessibility section despite the ADR-0065/design-
  foundation §7 mandates.
- `design-foundation` skill declares `enables`/`composes_with` on skills absent
  at L1 (broken dependency for scaffolded projects).
- No screen-pattern inventory exists although the ADR-0066 7-phase pipeline and
  the review checklist require a declared one.
- Tokens lack `--target-size` and motion/reduced-motion semantics; the L2
  high-contrast theme overrides colors only.

## 3. Design Decisions (user-confirmed)

1. **[DESIGN-R2] unchanged**: `--target-size` and `--motion-*` are semantic-layer,
   theme-invariant tokens; theme presets continue to override color/shadow only.
2. **accessibility-audit SSOT**: the L2 (co-design) version is the more complete
   artifact — promote it as the basis, refresh L0 from it, propagate L0→L1.
3. **design-lint enforcement**: blocking from day one in `audit.ts`, scoped to
   UI source directories with an explicit allowlist (escape hatch) so projects
   without UI sources or with grandfathered literals are not false-failed.
4. **Screen-pattern scope**: 6 patterns — list, form, detail, dashboard, modal,
   table — built in the co-design playground with a11y evidence, then promoted
   to an L1 inventory template.

## 4. UD Principle Mapping (normative content of ADR-0068)

| UD principle | Concretized as |
|---|---|
| Equitable use | Same experience path for assistive-tech users; no separate "accessible mode" |
| Flexible use | Keyboard + pointer + touch parity; adjustable timing |
| Simple & intuitive | Progressive disclosure; consistent interaction grammar (patterns inventory) |
| Perceptible information | Multi-encoded status (color+icon+text); AA+ contrast |
| Tolerance for error | Reversible actions; forgiving forms; explicit error recovery (new derivation criterion) |
| Low physical effort | `--target-size` 44px; minimized repetition |
| Size & space for approach | Responsive touch spacing; pattern-level spacing tokens |

New derivation criteria for design principles: **cognitive load**, **error
recovery** (added to density, trust/evidence, clarity, guided workflow,
accessibility).

## 5. Phased Implementation

Phases 1–4 per the approved unified plan: L0 governance (this doc + ADR-0068) →
L2 co-design self-consistency (tokens, lint, playground, 6 patterns) → L1
promotion (skills, checklist a11y section, screen-patterns.template.md, token
template) → enforcement wiring in `audit.ts`.

## 6. Success Criteria

- ADR-0068 accepted and linked from governance docs (verify-adr-governance).
- L1 scaffold receives a dependency-closed design skill set (validate-skills
  relation targets resolve).
- Review checklist carries a passing-gate Accessibility section.
- `design-lint.ts` runs blocking in audit with zero repo-wide violations.
- 6 screen patterns exist with demonstrable a11y evidence (focus-visible,
  aria, reduced-motion).
