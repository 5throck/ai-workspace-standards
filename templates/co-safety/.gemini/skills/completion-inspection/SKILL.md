---
name: completion-inspection
owner: gasterm-agent
scope: workspace
status: active
description: >
  Execute KGS on-site completion inspection and permit issuance for gas terminal
  facilities (LNG/LPG/수소). Final verification of all safety systems, pressure
  testing, leak testing, and operational readiness before facility commissioning.
version: 1.0.0
created: 2026-07-09
last_updated: 2026-07-17
metadata:
  type: domain
  triggers:
    - completion inspection
    - final inspection
    - permit issuance
    - 완성검사
    - 최종검사
    - 사용전검사
  legal_basis:
    - 고압가스 안전 관리 및 사업법 제22조의2 (기술검토), 제13조 (시설·용기의 안전유지)
    - 액화석유가스의 안전관리 및 사업법 제37조, 제45조 (검사 기준)
    - 도시가스사업법 제17조의5 (시설·기술·검사 기준)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## completion-inspection

### Purpose

Execute Phase 3 of the KGS Code construction inspection: completion inspection and permit issuance for commissioning, populating `evidence-models/domains/industry/gasterm/gasterm-completion-inspection-record.json`.

### Scope

- Final safety system verification
- Pressure testing and leak testing oversight
- Safety device functional testing (안전밸브, 자동차단밸브 등)
- Operational readiness assessment
- 지자체 허가증 발급 및 운영 개시 절차

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 고압가스 안전 관리 및 사업법 | Articles 22의2, 13 | 기술검토, 시설·용기의 안전유지 |
| 액화석유가스의 안전관리 및 사업법 | Articles 37, 45 | 검사 기준 |
| 도시가스사업법 | Article 17의5 | 시설·기술·검사 기준 |
| KGS Code | Section 5 | Commissioning and Start-up |

### Prerequisites

- Phase 2 (`mid-construction-inspection`) must have `inspection_result == pass`. Record the resulting `record_id` as `mid_construction_inspection_id` on this record.

### Related Skills

- **`construction-permit-overview`** — orchestrates this skill as Phase 3, gated on Phase 2 `passed`; this skill's `inspection_result` and `permit_granted` close out the overall lifecycle record.
- **`mid-construction-inspection`** — upstream Phase 2 dependency.

### Workflow

1. **Completion Inspection Application** — After full construction completion, apply to KGS. Record `mid_construction_inspection_id`.
2. **Pre-Inspection Testing** — Conduct 가스누출 시험, 압력시험, 전기식 안전장치 점검 ahead of KGS attendance. Record `pressure_test_result` (`test_date`, `test_pressure_bar`, `holding_time_min`, `result`) and `leak_test_result` (`test_date`, `test_medium`, `result`).
3. **KGS On-Site Completion Inspection** — Full-facility comprehensive inspection with KGS 입회. Record `kgs_inspector`, `inspection_date`, and `safety_device_test[]` (each device with `test_result`).
4. **Deficiency Recording** — For failed items, populate `deficiencies[]` (`item`, `severity`, `corrective_action`, `reinspection_date`).
5. **Corrective Action / Re-inspection (if needed)** — Remediate and re-inspect critical/major deficiencies before proceeding to permit issuance.
6. **Result Recording** — Set `inspection_result`: `pass` / `supplement_required` / `fail`.
7. **Permit Issuance** — On `pass`, `local_government` issues the 변경허가 completion; record `permit_granted = true`, `permit_granted_date`, `permit_number`.
8. **Operation Start** — Confirm `safety_manager_appointed` (안전관리자 선임), record `operation_start_date` and `next_periodic_inspection_date` (annual KGS periodic inspection cadence — hands off to routine `gasterm-inspection-record` tracking).
9. **Closure** — Return `record_id` to the orchestrating `construction-permit-overview` record's `phases.completion.result_id`; set that record's `overall_status = completed` when `permit_granted == true`.

### Inputs

- Mid-construction inspection clearance (Phase 2 pass record)
- Pressure test reports
- Leak test results
- Safety device test results

### Outputs

`gasterm-completion-inspection-record.json`-conformant record including:
- `pressure_test_result`, `leak_test_result`, `safety_device_test[]`, `deficiencies[]`, `inspection_result`
- `permit_granted`, `permit_granted_date`, `permit_number`, `operation_start_date`, `next_periodic_inspection_date`
- `legal_basis` (>= 3 sources, drawn from the table above)
