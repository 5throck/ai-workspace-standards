---
name: pre-construction-technical-review
owner: gasterm-agent
scope: workspace
status: active
description: >
  Execute KGS Code pre-construction technical review (시설·기술 기준) for
  gas terminal facilities (LNG/LPG/수소). Reviews design documentation,
  material specifications, and construction plans against KGS safety requirements.
version: 1.0.0
created: 2026-07-09
last_updated: 2026-07-17
metadata:
  type: domain
  triggers:
    - pre-construction review
    - technical review
    - design review
    - 시설기준 검토
    - 기술검토
    - 설계검토
    - 사전기술검토
  legal_basis:
    - 고압가스 안전 관리 및 사업법 제22조의2 (기술검토)
    - 고압가스 안전 관리 및 사업법 시행규칙 제7조 (기술검토 신청 절차)
    - 액화석유가스의 안전관리 및 사업법 제27조의2 (LPG 시설·기술기준 위임)
    - 도시가스사업법 제17조의5 (시설·기술 기준)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## pre-construction-technical-review

### Purpose

Execute Phase 1 of the KGS Code construction inspection: pre-construction technical review of facility design and construction plans, populating `evidence-models/domains/industry/gasterm/gasterm-pre-construction-review-record.json`.

### Scope

- Design documentation review against KGS standards (시설계획서, 배치도, 안전관리계획서)
- Material specification verification
- Safety system design adequacy
- Technical deviation identification and supplement tracking
- KGS 기술검토 신청서 (별지 제8호서식) processing

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 고압가스 안전 관리 및 사업법 | Article 22의2 | 기술검토 |
| 고압가스 안전 관리 및 사업법 시행규칙 | Article 7 | 기술검토 신청 절차 (별지 제8호서식) |
| 액화석유가스의 안전관리 및 사업법 | Article 27의2 | LPG 시설·기술기준 위임 |
| 도시가스사업법 | Article 17의5 | 시설·기술 기준 |
| KGS Code | Section 3 | Design and Construction Standards |

### Related Skills

- **`construction-permit-overview`** — orchestrates this skill as Phase 1; this skill's `review_result` gates dispatch of `mid-construction-inspection`.

### Workflow

1. **Application Preparation** — Assemble 시설계획서, 배치도, 안전관리계획서, and KGS Code reference materials. Determine `review_type` (new_construction/modification/expansion) and `facility_type`/`gas_type`.
2. **KGS Technical Review Application** — Submit KGS 기술검토 신청 (별지 제8호서식) per 고압가스 안전 관리 및 사업법 시행규칙 제7조. Record `application_date` and `kgs_review_id`.
3. **Review Pending** — KGS 기술기준위원회 reviews (typically 2-4 weeks in practice). Record applicable `kgs_code_references` (e.g., KGS AC211, KGS FA121).
4. **Result Receipt** — Record `review_result`: `pass` / `supplement_required` / `fail`. If `supplement_required`, populate `supplement_items[]` with the specific deficiencies requiring correction before resubmission.
5. **Local Government Submission** — On `pass`, submit results to `local_government` (관할 지자체) as supporting documentation for the 변경허가 application; record `local_gov_submission_date`.
6. **Closure** — Set `kgs_inspection_status` (certified/pending/failed/expired) reflecting the review outcome. Return `record_id` to the orchestrating `construction-permit-overview` record's `phases.pre_review.result_id`.

### Inputs

- P&ID and process documentation
- Equipment specifications
- Material certificates
- Safety design basis

### Outputs

`gasterm-pre-construction-review-record.json`-conformant record including:
- `review_result`, `supplement_items[]` (if applicable), `kgs_review_id`, `kgs_code_references[]`
- `legal_basis` (>= 3 sources, drawn from the table above)
- Deviation report and conditional approval documentation for supplement-required outcomes
