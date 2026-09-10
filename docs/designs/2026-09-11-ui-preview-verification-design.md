# UI Preview Verification — Workspace-Wide Baseline (ADR-0070)

**Spec ID**: 2026-09-11-ui-preview-verification
**Date**: 2026-09-11
**Author**: PM (user-directed)
**Status**: Draft → Approved
**Related**: ADR-0064 (design system foundation), ADR-0065 (accessibility), ADR-0066 (design process pipeline), ADR-0068 (universal design), ADR-0069 (L1 docs independence)

## 1. Problem

The workspace's primary implementers are agents that write UI code (templates, JSX, CSS)
without ever rendering it. Three recent defects were all of the class a rendered-preview
check catches mechanically, and all were found only by accident or human review:

- `Projects/co-newbiz` WACC input rows overlapped on md–lg viewports (fixed-width grid
  tracks applied from `md` up) — 2026-09-11 fix.
- Greenfield capability-gap / Business Case editor rows clipped real values behind
  fixed 6–12rem widths — 2026-09-10 fix.
- S3/synergy-class layout regressions found post-merge rather than pre-merge.

The Design Foundation contract (§7) covers the **design-system layer** (tokens, contrast
targets, focus states) and the design-review checklist covers **process conformance** —
but nothing in the normative stack requires that a screen was ever **seen rendered**
before being called done.

## 2. Decision (summarized — normative text in ADR-0070)

Adopt a workspace-wide baseline: **user-facing web/app UI work is not complete until the
UI was verified in a rendered preview**, with a minimum defined so agents can comply:

1. Rendered check at **≥ 2 breakpoints** (at minimum the project's declared mobile and
   desktop baselines — the WACC defect was a breakpoint defect).
2. **≥ 1 key interaction** exercised in the preview (state change, navigation, or form flow).
3. **Evidence attached** to the design doc / PR: screenshots, or an automated
   visual-smoke test output (project-chosen tooling — style-neutral per ADR-0064/0066;
   the workspace never prescribes dev-server or test-runner specifics at L0/L1).

Non-UI deliverables are exempt with an explicit statement, mirroring the ADR-0065
exemption convention.

## 3. Where the rule lands (single canonical copies)

| Surface | Change |
|---|---|
| `docs/adr/0070-ui-preview-verification.md` | NEW — the normative decision record |
| `templates/common/docs/design-foundation.md` | §2b rule 6 (process rule) + §7 Required item (validation contract) |
| `templates/common/docs/_templates/design-review-checklist-template.md` | NEW section G — mandatory for web/app UI |
| `CONSTITUTION.md` §8 hub summary | one-clause reference (ADR governance linkage) |
| `docs/constitution/08-coding-guidelines.md` | NEW §8.16 |
| `AGENTS.md` §5.1 execution-plan boilerplate | Preview-verification bullet beside the Accessibility bullet |

Both L1 doc files exist as **single copies** (no variant duplicates — verified), so new
projects scaffolded from `templates/<variant>` inherit the rule via the standard L1 doc
delivery; no variant hand-copying (avoids the ADR-0050 Part 3 commonization-noise class).

## 4. Alternatives considered

- **Blocking machine gate now** (fail audits without preview evidence): rejected for
  this pass — "was the preview actually reviewed" is not machine-verifiable; evidence
  existence could be checked, but wiring a per-project opt-in schema (design-lint
  `designLint`-style) deserves its own design once the practice settles. The ADR notes
  this as the expected Phase 2.
- **Variant-specific rules**: rejected — duplicates content across 13 variants and
  violates L0/L1 style/process neutrality.
- **Checklist item only (no ADR)**: rejected — the user asked for a "must"; the
  workspace pattern for normative design mandates is the ADR series (0064/0065/0066/0068)
  reflected into the foundation docs.

## 5. Verification / rollout

- Gates: `audit.ts`, `validate-templates.ts`, `verify-scripts.ts --verify`, `bun test`,
  workflow-adjacent checks unaffected (no CI change).
- `verify-adr-governance.ts --strict` must pass with ADR-0070 referenced from
  CONSTITUTION.md and `08-coding-guidelines.md` §8.16.
- Rollout to existing projects rides the normal upgrade-project L1-doc delivery
  (VARIANT_DOCS_SYNC); new projects get it at scaffold time.
- Phase 2 (tracked, not in this change): optional per-project machine gate for evidence
  presence, modeled on the `designLint` schema block.
