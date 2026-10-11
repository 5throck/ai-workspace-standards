# Per-Subject Parameter Consumption — Financial-Model Audit Checklist

From co-newbiz S8 (T-20261011-009; source: co-newbiz PR #491,
`docs/designs/2026-10-10-s8-per-target-wacc-consumption-design.md`,
ADR-0156 amendment 2). Companion to the `write-research:audit-xls`
sections 3g/3h — which live in the plugin-owned skill file and therefore
carry this row here.

## The store/consume gap

When a model gains a per-subject parameter (e.g. per-target WACC instead of
a global rate), the SAVE layer can ship complete — storage, resolution API,
UI — while every CALCULATION consumer still flattens to the global rate via
a base-object spread. Comparisons are silently skewed with no error raised.

## Checklist rows (add to every model audit)

- [ ] **Consumer audit**: whenever a parameter grows a subject axis, audit
      every calculation consumer for global-resolution / `...base` object
      spreading that flattens the per-subject value back to the global rate.
- [ ] **Scope labeling**: consumed scope is labeled in outputs and snapshots
      (`wacc_scope`, `discount_rate.scope` / `subject_company_id`) so skew is
      diagnosable after the fact.
- [ ] **Scope-rule table**: a per-subject-class scope-rule table exists with
      an explicit NON-BLOCKING fallback (which classes fall back to the
      global rate, and where that fallback is surfaced).

## Where this row lives

The canonical `write-research:audit-xls` checklist (sections 3g/3h) is a
plugin-owned file outside this workspace; this guide is the workspace-side
carriage of the row. If the plugin updates to include it natively, retire
this guide.
