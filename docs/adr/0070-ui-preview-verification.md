---
status: Accepted
date: 2026-09-11
author: PM
---

# ADR-0070: UI Preview Verification — User-Facing Web/App UI Requires a Rendered Preview Before Completion

## Context

The workspace's primary implementers are agents that author UI code (templates, JSX,
CSS) without rendering it. The normative design stack covered the design-system layer
(ADR-0064 token contract, §7 validation contract) and process conformance (ADR-0066
pipeline, review checklist), and mandated accessibility review (ADR-0065/0068) — but
nothing required that a screen was ever **seen rendered** before being called done.
Three recent defects were all of the class a rendered-preview check catches:

- WACC input rows overlapped on md–lg viewports (fixed-width grid tracks applied from
  `md` up) — Projects/co-newbiz, fixed 2026-09-11.
- Greenfield capability-gap / Business Case editor rows clipped real values behind
  fixed widths — fixed 2026-09-10.
- Comparable layout regressions found post-merge rather than pre-merge.

## Decision

**User-facing web/app UI work is not complete until the UI was verified in a rendered
preview.** The minimum verification (satisfiable by agent or human):

1. **Rendered check at ≥ 2 breakpoints** — at minimum the project's declared mobile and
   desktop viewport baselines.
2. **≥ 1 key interaction exercised** in the preview (a state change, navigation, or
   form flow — pick the screen's primary one).
3. **Evidence attached** to the design document or PR: screenshots, or an automated
   visual-smoke test output.

Rules:

- **Style- and tool-neutral** (ADR-0064/0066): the workspace prescribes no preview
  tooling (dev server, static preview, headless capture) and no visual expectations —
  tooling and the "key interaction" choice are declared by the project.
- **Exemption**: pure backend/non-UI deliverables are exempt when the design doc or
  ADR states the exemption explicitly (same convention as ADR-0065).
- **Placement**: the rule is expressed in `templates/common/docs/design-foundation.md`
  (§2b process rule, §7 validation contract) and as a mandatory section in
  `templates/common/docs/_templates/design-review-checklist-template.md` — single L1
  copies, inherited by every project scaffolded from `templates/<variant>` (no variant
  hand-copies; ADR-0050 Part 3 / ADR-0069 conventions).
- **Enforcement tier**: checklist + design-doc statement today (review-enforced).
  A blocking machine gate for evidence presence is the expected Phase 2, modeled on
  the `designLint` schema block (per-project opt-in) — tracked in
  `docs/designs/2026-09-11-ui-preview-verification-design.md` §5.

## Consequences

- Design docs for user-facing web/app UI gain one mandatory statement (preview
  verification method + evidence link), beside the ADR-0065 Accessibility section.
- Agents implementing UI must produce preview evidence or explicitly route the ticket
  as blocked on environment (e.g., no runnable preview) rather than silently skipping.
- Projects choose their own preview tooling; the workspace adds no dependency.
- Existing projects receive the rule via the normal L1-doc delivery
  (upgrade-project / VARIANT_DOCS_SYNC); new projects at scaffold time.

## References

- `docs/designs/2026-09-11-ui-preview-verification-design.md` (design record)
- ADR-0064 / ADR-0066 (style neutrality, process pipeline), ADR-0065 / ADR-0068
  (accessibility, universal design), ADR-0069 (L1 docs independence)
