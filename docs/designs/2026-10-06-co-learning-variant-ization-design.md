---
schemaVersion: 1.0.0
spec-id: co-learning-variant-ization
---

# co-learning Variant-ization Design

## 1. Overview and Objectives

Promote the harness-assessment learning domain out of Projects/co-develop into a
dedicated variant, **co-learning**, so question-bank quality and exam operations
are managed under their own governance instead of riding on a software-development
variant. Owner decision 2026-10-06 (follow-up to DEC-20261006-01/02 in
Projects/co-develop, which documented the fleet-sync deletion of the L3
exam-bank-steward agent and exam-bank-operations skill).

Objectives:

1. Create `templates/co-learning/` (L2, beta) carrying the domain roster:
   `pm`, `exam-bank-steward` (restored from Projects/co-develop history,
   commit `8bf4855`), and the common `i18n-specialist` extends-stub; plus the
   variant-exclusive `exam-bank-operations` skill and its five platform mirrors.
2. Scaffold `Projects/co-learning` from the new variant and migrate the
   harness-assessment deliverable and its exam-bank tests from Projects/co-develop.
3. Clean Projects/co-develop of the migrated domain: remove the deliverable,
   tests, and skill; mark lifecycle records transferred; supersede the earlier
   decision record.
4. File the three upstream (L1/L2) defect reports identified during the
   2026-10-06 health inspection (fleet-sync L3 deletion, COMMON-CLAUDE L0-agent
   examples, README lifecycle audit localized-literal gap).

## 2. Non-Goals

- No change to the co-develop variant template (L2) — the deletion there was a
  fleet-sync event, and the variant template never carried exam-bank assets.
- No product feature changes to harness-assessment during the move.

## 3. Template Composition (templates/co-learning)

- Derived from `templates/co-develop` (closest structural parent), then reduced
  to the domain roster. Procedures re-namespaced `procedure.co-develop.*` →
  `procedure.co-learning.*`; docs adapted (context, phase table, per-role
  artifacts, domain rules LEARN-R1..R3).
- `variant.json`: `status: beta`, `version: 0.1.0`, `variant_type: learning`,
  pipeline order `[exam-bank-steward]`, skill manifest with
  `exam-bank-operations` (phases 4–5, platform parity required).
- Registration touchpoints: `scripts/propagation-map.json` (L0 + L1 copies,
  domains `governance-agents`/`variant-context`/`hermes-bootstrap`),
  `docs/templates/common.lifecycle.json` `propagatedTo`, workspace
  `skills/SKILLS.md` variant-exclusive catalog row, `.gitignore` whitelist,
  variant index rows in `README.md`, `README_ko.md`, `templates/README.md`,
  `templates/README_ko.md`.
- Verification: `bun scripts/validate-templates.ts --variant co-learning`
  exits 0 errors; `bun scripts/validate-variant-readiness.ts --variant
  co-learning` passes.

## 4. Migration Plan

| Step | Repo | Action |
|------|------|--------|
| 1 | workspace | This design doc + template + registrations (`/sync`) |
| 2 | workspace | Scaffold `Projects/co-learning` via `new-project.ts --variant co-learning` |
| 3 | co-learning | Receive `deliverables/harness-assessment/`, exam-bank tests, remediation fixtures; run audits + `bun test` green |
| 4 | co-develop | On a separate branch (linked worktree, does not disturb the active checkout): remove migrated files, mark lifecycle records `transferred`, supersede DEC-20261006-01 with DEC-20261006-02, update `docs/project.md`, regenerate skill graph; audits + `bun test` green |
| 5 | workspace | File upstream tickets U-20261006-005..007 |

## 5. Risks

- **Concurrent-session interference**: another session is actively committing in
  these repositories. Mitigation: commit early per repo; never touch the other
  session's checked-out branch; the co-develop removal runs in a linked worktree.
- **Fleet sync recurrence**: if the L1 upgrade pipeline again removes
  project-owned agents (upstream ticket U-20261006-005), the new project loses
  exam-bank-steward at the next upgrade. Mitigation: the assets now live in the
  variant template itself (L2), which fleet sync delivers rather than deletes.
