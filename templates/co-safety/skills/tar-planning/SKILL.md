---
name: tar-planning
owner: ehschem-agent
scope: workspace
status: active
description: >
  Chemical plant turnaround (TAR) shutdown planning — pre-TAR risk assessment,
  PSSR (Pre-Startup Safety Review), contractor surge management, and safe
  work planning for refinery, petrochemical, and fine chemical facilities.
version: 1.1.0
created: 2026-07-09
last_updated: 2026-08-23
metadata:
  type: domain
  triggers:
    - turnaround
    - tar
    - tar planning
    - shutdown planning
    - 정기보수
    - 가동중지
    - 보수정비
    - 대정비
  legal_basis:
    - 산업안전보건법 제34조 (안전보건관리체계의 확립)
    - 산업안전보건법 제44조 (공정안전관리)
    - 화학물질관리법 제20조, 제23조 (유해화학물질, 사고대비물질)
    - 중대재해처벌법 제4조 (사업주 및 경영책임자 안전보건 확보의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## tar-planning

### Purpose

Plan and coordinate turnaround (TAR) shutdown operations for chemical plants, ensuring safe execution of maintenance, inspection, and modification activities during plant shutdown periods, populating `evidence-models/domains/industry/ehschem/ehschem-turnaround-record.json`. `ehschem-agent` owns this workflow as industry coordinator and dispatches to functional/other industry agents for PSM (LOTO), contractor, health, and non-PSM equipment concerns per the Matrix Model.

### Scope

- Pre-TAR risk assessment and hazard identification
- PSSR (Pre-Startup Safety Review) dispatch to `functional/psm-agent` (`pssr-review` workflow)
- Contractor surge handoff (headcount confirmation → bulk prequalification)
- Health screening handoff (contractor roster → special health exam)
- Non-PSM equipment handoff (asset-integrity-agent inspection scheduling)
- LOTO permit tracking per isolation point (via `functional/psm-agent`)
- Turnaround timeline and milestone tracking (`planned_start_date`/`planned_end_date`/`duration_days`)
- Post-TAR startup verification (`post_tar_pssr_completed`)

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 산업안전보건법 (OSHA-KR) | Article 34 | 안전보건관리체계 확립 |
| 산업안전보건법 (OSHA-KR) | Article 44 | 공정안전관리 (Process Safety Management, PSSR) |
| 화학물질관리법 (CCA) | Articles 20, 23 | 유해화학물질, 사고대비물질 관리 |
| 중대재해처벌법 (SAPA) | Article 4 | 사업주 및 경영책임자의 안전·보건 확보의무 |

### Related Skills / Cross-Agent Handoffs

Per the TAR cross-agent handoff sequence (see `workflows/domains/industry/ehschem/turnaround-shutdown-planning/README.md`):

1. **contractor-safety-agent** — once TAR contractor headcount is confirmed, notify to trigger `tar-contractor-surge-management` (bulk prequalification). Reference recorded in `contractor_surge_ref`.
2. **occupational-health-agent** — pass confirmed contractor roster to trigger `tar-health-screening` (특수건강진단, 고열/밀폐공간 노출 확인). Reference recorded in `health_screening_ref`.
3. **asset-integrity-agent** — identify and hand off the non-PSM equipment list so TAR-period inspection scheduling can proceed for those assets. Reference recorded in `non_psm_equipment_handoff_ref`.
4. **functional/psm-agent** (`psm-loto` skill) — issue LOTO permits per isolation point via `loto-lockout-tagout`; each permit's `record_id` is appended to `loto_records_ref[]`.
5. **functional/psm-agent** (`pssr-review` workflow) — before restart, dispatch the Pre-Startup Safety Review; each resulting `psm-pssr-record.json` `record_id` (`PSM-PSSR-YYYY-####`) is appended to `pssr_ref[]`.

### Workflow

1. **TAR Initiation** — Assign `record_id` (`CHEM-TAR-YYYY-####`), `turnaround_id`, `facility_id`, `plant_category` (refining/petrochemical/specialty_chemicals), `chemical_category`, `psm_applicable` (default true), `planned_start_date`, `planned_end_date`, `duration_days`.
2. **Pre-TAR Risk Assessment** — Conduct hazard identification across all units scheduled for shutdown/maintenance; set `pre_tar_risk_assessment = true` on completion.
3. **Contractor Headcount Confirmation** — Once contractor headcount is finalized, dispatch to `contractor-safety-agent`; record `contractors_involved` and `contractor_surge_ref`.
4. **Health Screening Handoff** — Pass the confirmed contractor roster to `occupational-health-agent`; record `health_screening_ref`.
5. **Non-PSM Equipment Handoff** — Identify equipment outside PSM scope and hand off to `asset-integrity-agent`; record `non_psm_equipment_handoff_ref` (free-text reference until a dedicated evidence model exists).
6. **LOTO Permit Tracking** — For each isolation point requiring energy isolation, dispatch `functional/psm-agent`'s `psm-loto` skill; append each resulting `psm-loto-record.json` `record_id` to `loto_records_ref[]`.
7. **Permit-to-Work Tracking** — Track `permit_to_work_count` as PTWs are issued for TAR-period non-routine work (hot work, confined space, elevated work).
8. **PSSR Dispatch** — Dispatch `functional/psm-agent`'s `pssr-review` workflow (evidence model `psm-pssr-record.json`) per OSHA-KR Article 44; set `psm_pssr_required` (default true) and append each resulting `record_id` to `pssr_ref[]`.
9. **Post-TAR Startup Verification** — On completion of all dispatched PSSRs and restart readiness confirmation, set `post_tar_pssr_completed = true`. Closure requires at least one `pssr_ref[]` entry.
10. **Closure** — TAR is considered complete only when `pre_tar_risk_assessment`, `post_tar_pssr_completed` are both true and all `loto_records_ref[]` entries show closure.

> **Forward-looking note**: Day-by-day TAR-period tracking (contractor site access, PTW renewal, daily safety patrol) via `workflows/daily/chemical/` is design intent only and not yet implemented — do not treat it as an active dependency.

### Inputs

- Plant unit list and process documentation
- Previous TAR lessons learned
- Contractor roster
- Maintenance work order backlog

### Outputs

`ehschem-turnaround-record.json`-conformant record including:
- `pre_tar_risk_assessment`, `post_tar_pssr_completed`, `permit_to_work_count`
- `contractor_surge_ref`, `health_screening_ref`, `non_psm_equipment_handoff_ref`, `loto_records_ref[]`, `pssr_ref[]`
- `legal_basis` (>= 3 sources, drawn from the table above)
