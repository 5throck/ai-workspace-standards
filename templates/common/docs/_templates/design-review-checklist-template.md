# Design Review Checklist (template) — fill per new screen/feature design

> **Style-neutral by design**: this checklist governs *process conformance*. It does not
> prescribe any visual style, pattern set, icon set, or interaction convention — those are
> declared by the project's own design SSOT (`docs/design.md`) and derived via
> `docs/design-foundation.md`. Replace every `<project-…>` placeholder with the project's
> own declarations.

**Document**: <design document name/link>
**Reviewer**: <project design reviewer> · **Approver**: <project approval owner>
**Status**: [ ] Draft → [ ] Reviewed → [ ] Approved

## A. Screen pattern(s)

- [ ] Pattern(s) used are from the project's declared pattern inventory: <list them, e.g.
      "list, report, decision wizard, execution checklist, monitoring">.
- [ ] If a NEW pattern is required: design-document revision + ADR produced BEFORE implementation.

## B. Tokens & components consumed

- [ ] Tokens referenced from the project token source (`<design-tokens file>`); no
      hard-coded colors/spacing/fonts introduced. New tokens approved in this document.
- [ ] Components used exist in the project component inventory; new components approved here.

## C. Interaction standards conformance

- [ ] Create / add flow matches the project's declared standard (trigger, form container,
      submit & cancel labels).
- [ ] Edit flow matches the declared standard (edit mode, save/cancel placement).
- [ ] Delete flow matches the declared standard (label, confirmation mechanism, placement,
      destructive-action hierarchy).

## D. Iconography

- [ ] Any new icon is registered in the project icon-vocabulary table (one concept = one icon).
- [ ] Icon sizes derive from the project's declared control sizes.

## E. Accessibility (ADR-0065 / ADR-0068 — mandatory)

- [ ] Contrast: every new text/background and UI-component pair meets the WCAG 2.1 AA
      ratios the design foundation declares (4.5:1 body text, 3:1 large text & UI parts);
      the design doc states the semantic token pairs involved.
- [ ] Keyboard operability: all new interactive elements are reachable and operable by
      keyboard with a visible `:focus-visible` state; no focus traps.
- [ ] Accessible names: every icon-only control carries an `aria-label`; label/field
      associations are explicit.
- [ ] Multi-encoded status: state (error, success, warning, selection) is conveyed by at
      least two of color / icon / text — never color alone.
- [ ] Motion: animation respects `prefers-reduced-motion` per the declared motion policy.
- [ ] Target size: interactive targets meet the project's declared minimum (e.g. a
      `--target-size` token) with adequate spacing.
- [ ] Universal Design lens (ADR-0068): the design was walked against the project's
      diversity profiles (aging / cognitive / situational / motor) where user journeys are
      in scope; friction found is logged as design requirements.

## F. Enforcement

- [ ] Project design-lint (if implemented) passes with 0 violations, or violations are
      approved as documented exceptions.
- [ ] Baseline evidence attached (lint output / review notes).
