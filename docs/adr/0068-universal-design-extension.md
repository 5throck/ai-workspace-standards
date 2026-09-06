---
status: Accepted
date: 2026-09-06
author: PM + Architect
---

# ADR-0068: Universal Design as the Extension of the Accessibility Standard

## Context

ADR-0065 made accessibility a mandatory feature-development consideration with a
WCAG 2.1 AA baseline. A 3-layer comparison review (2026-09-06: L0 workspace root,
L1 `templates/common`, L2 `templates/co-design`) confirmed the WCAG technical
conformance frame is consistently propagated — but **Universal Design (UD) is
absent at every layer**: the standards address conformance for users with
disabilities, not design-stage coverage of the full diversity of users (aging,
cognitive load, situational impairment, motor variation, equity of use). Greps
across all three layers found zero cognitive-accessibility, elderly, or
situational-impairment content, and the service-design journey methodology does
not examine accessibility constraints at any stage. Related review findings this
ADR builds on: the L1 design-review checklist carries no accessibility section,
and the accessibility-audit / token-usage-lint / ui-ux-design-intelligence
skills referenced by `design-foundation` are not present at L1.

## Decision

**Universal Design is adopted as the design-stage framing that extends ADR-0065's
conformance baseline: designs must be evaluated against the diversity of users,
not only against WCAG criteria.**

1. **UD principle set (normative, style-neutral)** — the 7 classic principles are
   the review vocabulary: (1) equitable use, (2) flexible use, (3) simple and
   intuitive use, (4) perceptible information, (5) tolerance for error,
   (6) low physical effort, (7) appropriate size and space for approach and use.
2. **Principle-derivation criteria extension** — the Design Foundation's
   principle-derivation criteria (density, trust/evidence, clarity, guided
   workflow, accessibility) gain two UD-derived criteria: **cognitive load**
   (minimize working-memory and comprehension burden; progressive disclosure)
   and **error recovery** (prevent, forgive, and explain errors; reversible
   actions with clear feedback).
3. **Diversity-profile review step** — service/journey design MUST include a
   diversity-profile review at the journey-mapping stage: the journey is walked
   once each for aging, cognitive, situational, and motor-constraint profiles,
   and friction found in those walks is logged as design requirements, not
   documented as acceptable.
4. **Scope boundary**: UD governs the *review method and derivation criteria* —
   it never prescribes token values, colors, typefaces, or layout specifics.
   The style-neutral doctrine of ADR-0064 is unchanged.
5. **Relationship to ADR-0065**: WCAG 2.1 AA remains the technical floor
   (ADR-0065); UD adds the design-stage evaluation lens above it. A design can
   pass WCAG and still fail UD; the reverse is not acceptable.
6. **Enforcement**: same ladder as ADR-0065 — v1 documentation-level mandatory
   (design-gate rule, review checklist), automated checks follow later phases
   (screen-pattern inventory, design-lint) per the ADR-0055 playbook.

Distribution policy mirrors ADR-0065: the criteria change propagates via
`templates/common/docs/design-foundation.md` (L1) and the diversity-profile
step via the co-design `service-design` skill (L2), so newly scaffolded projects
inherit both.

## Consequences

**Positive:**

- Design reviews gain a concrete, shared vocabulary for user diversity beyond
  WCAG pass/fail; journeys surface aging/cognitive/situational friction before
  implementation.
- The gap identified in the 3-layer review (checklist a11y items, missing L1
  skills, screen-pattern inventory) is scheduled as the implementation path for
  this ADR.

**Negative / Trade-offs:**

- One more evaluation pass per journey map and two additional derivation
  criteria — a modest tax paid at design time where changes are cheapest.
- UD outcomes are harder to verify mechanically than WCAG; enforcement stays
  review-based for the UD lens (automation covers only the conformance floor).

## Implementation

| Phase | Change |
|-------|--------|
| 1 (this ADR) | `templates/common/docs/design-foundation.md` §3 derivation criteria gain cognitive-load + error-recovery; ADR-0064 backlog annotated |
| 2 | co-design: diversity-profile step in `service-design`; 3-layer tokens with `--target-size`/motion semantics; a11y-evidenced playground; 6-pattern screen library |
| 3 | L1 promotion of the design skills (accessibility-audit SSOT derived from the L2 version), review-checklist Accessibility section, `screen-patterns.template.md`, token template a11y tokens |
| 4 | `design-lint` wired into `audit.ts` (blocking, allowlist-scoped) |
