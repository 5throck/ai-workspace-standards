---
name: mid-construction-inspection
owner: gasterm-agent
scope: workspace
status: active
description: >
  Execute KGS on-site mid-construction inspection for gas terminal facilities
  (LNG/LPG/수소). Verifies construction progress against approved design,
  checks welding quality, material traceability, and safety system installation.
version: 1.0.0
created: 2026-07-09
last_updated: 2026-07-17
metadata:
  type: domain
  triggers:
    - mid-construction inspection
    - construction inspection
    - 중간검사
    - 공사검사
    - 현장검사
  legal_basis:
    - 고압가스 안전 관리 및 사업법 제22조의2 (기술검토 연계 중간검사)
    - 액화석유가스의 안전관리 및 사업법 제45조 (검사 기준)
    - 도시가스사업법 제17조의5 (시설·기술·검사 기준)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

## mid-construction-inspection

### Purpose

Execute Phase 2 of the KGS Code construction inspection: mid-construction on-site inspection verifying construction quality and compliance, populating `evidence-models/domains/industry/gasterm/gasterm-mid-construction-inspection-record.json`.

### Scope

- Construction progress verification against approved design (공사 진도 50~70% 시점)
- Welding quality inspection (WPS/PQR verification)
- Material traceability verification
- Safety system installation checks
- Foundation and tank installation inspection
- Documentation completeness review

### Legal Basis

| Law | Article | Requirement |
|-----|---------|-------------|
| 고압가스 안전 관리 및 사업법 | Article 22의2 | 기술검토 연계 중간검사 |
| 액화석유가스의 안전관리 및 사업법 | Article 45 | 검사 기준 |
| 도시가스사업법 | Article 17의5 | 시설·기술·검사 기준 |
| KGS Code | Section 4 | Inspection and Testing |

### Prerequisites

- Phase 1 (`pre-construction-technical-review`) must have `review_result == pass`. Record the resulting `record_id` as `pre_construction_review_id` on this record.

### Related Skills

- **`construction-permit-overview`** — orchestrates this skill as Phase 2, gated on Phase 1 `passed`; this skill's `inspection_result` gates dispatch of `completion-inspection`.
- **`pre-construction-technical-review`** — upstream Phase 1 dependency.

### Workflow

1. **Inspection Application** — At construction progress ~50-70% (`construction_progress_pct`), apply to KGS for on-site inspection scheduling. Record `pre_construction_review_id`.
2. **Pre-Inspection Site Readiness Check** — Confirm site state and required documentation are ready before the KGS inspector arrives.
3. **KGS On-Site Inspection** — KGS 입회 하에 핵심 공정 확인: 배관 용접, 토목 기초, 탱크 설치 등. Record `kgs_inspector`, `inspection_date`, and populate `inspected_items[]` (each with `item`, `result`: pass/fail/na, `notes`).
4. **Deficiency Recording** — For any failed item, populate `deficiencies[]` with `item`, `severity` (critical/major/minor), `corrective_action`, and `due_date`.
5. **Corrective Action (if needed)** — Track remediation of deficiencies; re-inspect critical/major items before proceeding.
6. **Result Recording** — Set `inspection_result`: `pass` / `supplement_required` / `fail`. Only `pass` permits dispatch of Phase 3 (`completion-inspection`).
7. **Closure** — Return `record_id` to the orchestrating `construction-permit-overview` record's `phases.mid_inspection.result_id`.

### Inputs

- Approved design documentation (Phase 1 pass record)
- Construction progress reports
- Welding procedure specifications (WPS/PQR)
- Material certificates

### Outputs

`gasterm-mid-construction-inspection-record.json`-conformant record including:
- `inspected_items[]`, `deficiencies[]`, `inspection_result`
- `legal_basis` (>= 3 sources, drawn from the table above)
- Non-conformance notice and remediation requirements for any `fail`/`supplement_required` item
