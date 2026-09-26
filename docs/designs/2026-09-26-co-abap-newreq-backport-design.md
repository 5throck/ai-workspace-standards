# co-abap new-requirement.ts 1.1.0 Template Backport

| Field | Value |
|-------|-------|
| Date | 2026-09-26 |
| Status | implemented |
| Spec ID | `co-abap-newreq-backport` |
| Governing anchor | ADR-0031 (L1/L2 fork model); ADR-0085 D3 (same-version drift) |
| Related | project-side design `Projects/co-abap/docs/designs/2026-09-26-new-requirement-scaffolding-design.md` (spec-registered there); resync cycle Step 2 backport review |

## Problem

The fresh-scaffold comparison (`Projects/e2e-co-abap` vs `Projects/co-abap`, 2026-09-26) measured
`templates/co-abap/scripts/co-abap/new-requirement.ts` at `@version 1.0.1` while the live project
runs `@version 1.1.0` — a genuine project-ahead divergence (backport candidate per the 5-surface
triage: version headers prove the project copy is newer, not merely divergent).

## Change

Copy the project's 1.1.0 into `templates/co-abap/scripts/co-abap/new-requirement.ts` verbatim.

The 1.0.1 → 1.1.0 delta (authored and verified in the project, see the linked project design doc):
fixes `projectRoot` resolution (`scripts/` was treated as the repo root, so REQ folders landed
under `scripts/deliverables/` and RTM insertion failed), adds `--help`/`-h` handling, and extends
scaffolding to the standard deliverable set (`01_srs.md` + `05_unit_test_plan.md` +
`06_release_report.md`, missing templates skip with a warning).

Future scaffolds from `templates/co-abap` inherit the fixed behavior; existing projects receive it
through their next resync Step 4 (the upgrade engine keeps variant scripts project-owned, so the
1.0.1 holdouts — if any — are reported by the fleet echo check, not force-synced).

## Out of Scope

- Governance-doc backports: dropped — the 2026-09-26 root W4 landing superseded the project's
  copies (root versions are newer; the project received them via tree-sync in PR 5throck/co-abap#157).
- Delivery-row policy for scaffold-only variant configs (`atc-rulepack.json`, `tsconfig.json`):
  filed for workspace-level follow-up, not changed here.

## Registrations

| File | Change |
|------|--------|
| `templates/co-abap/scripts/co-abap/new-requirement.ts` | 1.0.1 → 1.1.0 (verbatim from `Projects/co-abap` @ main) |
| `templates/co-abap/scripts/co-abap/SCRIPTS.md` | registry row 1.0.1 → 1.1.0 (lifecycle-sync Check V consistency) |
| `docs/designs/2026-09-26-co-abap-newreq-backport-design.md` | added (this document) |
| `CHANGELOG.md` | entry appended |

## Verification

| Check | Expected |
|-------|----------|
| `bun scripts/validate-templates.ts` | 0 errors |
| `diff` project vs template copy | byte-identical |
| `/sync` pipeline | commit + PR created |
