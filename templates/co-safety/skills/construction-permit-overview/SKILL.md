---
name: construction-permit-overview
owner: gasterm-agent
scope: workspace
status: active
description: >
  Orchestrate full construction/permit lifecycle for gas terminal facilities
  (LNG/LPG/수소) under 3-phase KGS Code inspection: pre-construction technical
  review, mid-construction inspection, and completion inspection.
version: 1.0.0
created: 2026-07-09
last_updated: 2026-07-17
metadata:
  type: domain
  triggers:
    - construction permit
    - permit lifecycle
    - gas terminal construction
    - KGS inspection
    - 가스시설 공사
    - 공사허가
    - 검사일정
    - 건설인허가
  legal_basis:
    - 고압가스 안전 관리 및 사업법 제22조의2 (기술검토 등)
    - 고압가스 안전 관리 및 사업법 시행규칙 제7조 (기술검토 신청 절차)
    - 액화석유가스의 안전관리 및 사업법 제27조의2, 제45조 (LPG 충전업 안전관리, 검사기준)
    - 도시가스사업법 제17조의5 (시설·기술·검사 기준 위임)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## construction-permit-overview

### Purpose

Orchestrate the complete construction/permit lifecycle for gas terminal facilities (LNG/LPG/수소) under the 3-phase KGS Code inspection regime, populating `evidence-models/domains/industry/gasterm/gasterm-construction-permit-overview-record.json`. This skill is the sequencing orchestrator — it does not perform the technical review or on-site inspection itself; it dispatches to `pre-construction-technical-review`, `mid-construction-inspection`, and `completion-inspection` in order and tracks phase gating.

### Scope

- Phase 1: Pre-construction technical review (시설·기술 기준 검토) — dispatch to `pre-construction-technical-review`
- Phase 2: Mid-construction on-site inspection (중간검사) — dispatch to `mid-construction-inspection`, gated on Phase 1 `passed`
- Phase 3: Completion inspection and permit issuance (완성검사) — dispatch to `completion-inspection`, gated on Phase 2 `passed`
- Inspection scheduling and cross-phase documentation management
- Overall project status tracking (`overall_status`, `permit_status`)

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 고압가스 안전 관리 및 사업법 | Article 22의2 | 기술검토 (technical review of facility/installation) |
| 고압가스 안전 관리 및 사업법 시행규칙 | Article 7 | 기술검토 신청 절차 |
| 액화석유가스의 안전관리 및 사업법 | Articles 27의2, 45 | LPG 충전업 안전관리, 검사 기준 |
| 도시가스사업법 | Article 17의5 | 시설·기술·검사 기준 위임 |
| KGS Code | — | Comprehensive gas facility safety code (phase-specific KGS AC/FA/FP series) |

### Related Skills

- **`pre-construction-technical-review`** — Phase 1, dispatched first. Result feeds `phases.pre_review`.
- **`mid-construction-inspection`** — Phase 2, dispatched only when `phases.pre_review.status == passed`. Result feeds `phases.mid_inspection`.
- **`completion-inspection`** — Phase 3, dispatched only when `phases.mid_inspection.status == passed`. Result feeds `phases.completion`.

### Workflow

1. **Project Intake** — Assign `record_id` (`GTRM-CPOV-YYYY-####`), `project_id`, `facility_type` (LNG_terminal/LPG_charging/hydrogen_charging/city_gas_storage/pipe_transfer), `gas_type`, and `psm_applicable` (true for large-scale terminals per OSHA-KR Article 44).
2. **Phase 1 Dispatch** — Dispatch `pre-construction-technical-review`. Set `phases.pre_review.status = in_progress`, then update to `passed`/`failed` on result; record `phases.pre_review.result_id` referencing the resulting `gasterm-pre-construction-review-record.json` `record_id`.
3. **Gate Check** — Do not proceed to Phase 2 unless `phases.pre_review.status == passed`. If `failed` or `supplement_required` from the underlying review, halt and set `overall_status = on_hold`.
4. **Phase 2 Dispatch** — Dispatch `mid-construction-inspection`, passing `pre_construction_review_id`. Set `phases.mid_inspection.status`; record `result_id`.
5. **Gate Check** — Do not proceed to Phase 3 unless `phases.mid_inspection.status == passed`.
6. **Phase 3 Dispatch** — Dispatch `completion-inspection`, passing `mid_construction_inspection_id`. Set `phases.completion.status`; record `result_id`.
7. **Permit Tracking** — Track `permit_status` (not_applied/applied/granted/rejected) and `local_government` (관할 지자체) throughout; local government permit issuance is authoritative, KGS technical review/inspection results are the supporting basis.
8. **Closure** — When all three phases are `passed` and `permit_status == granted`, set `overall_status = completed`. Hand off to routine gasterm operational monitoring (`gasterm-inspection-record`, periodic KGS inspection cadence).
9. **Non-conformance** — Any phase `failed` sets `overall_status = failed`; escalate to PM (CSO) per gasterm-agent Escalation Triggers (KGS 검사 불합격 → 시설 운영 중지).

### Inputs

- Facility design documentation
- Construction permit application
- Contractor qualifications
- Phase-level result records (`gasterm-pre-construction-review-record.json`, `gasterm-mid-construction-inspection-record.json`, `gasterm-completion-inspection-record.json`)

### Outputs

`gasterm-construction-permit-overview-record.json`-conformant record including:
- `phases.{pre_review,mid_inspection,completion}` status and cross-referenced `result_id`
- `permit_status`, `local_government`, `overall_status`
- `legal_basis` (>= 3 sources, drawn from the table above)
- Non-conformance escalation record if any phase fails or a required field is missing
