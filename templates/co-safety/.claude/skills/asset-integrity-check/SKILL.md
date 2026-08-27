---
name: asset-integrity-check
version: 1.0.0
owner: asset-integrity-agent
scope: workspace
status: active
description: Coordinate mechanical integrity and preventative maintenance checks
metadata:
  triggers:
    - 설비무결성
    - asset integrity
    - 정기점검 일정
    - preventive maintenance
    - 압력용기 검사
    - NDT 검사
    - 배관 건전성
    - mechanical integrity
  legal_basis:
    - 산업안전보건법 제93조 (기계·기구 점검)
    - 산업안전보건법 제44조 (설비 완전성)
    - 산업안전보건법 제38조
    - 중대재해처벌법 제4조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema
# Asset Integrity Check Skill

## Overview
This skill manages the scheduling, execution, and documentation of asset integrity and mechanical reliability checks to prevent catastrophic equipment failures.

## Operational Steps
1. **Schedule Review**: Identify upcoming mandatory inspections for critical equipment (e.g., pressure vessels, piping, relief valves).
2. **Work Order Generation**: Create inspection work orders specifying the required testing methods (e.g., NDT, visual).
3. **Coordinate with Maintenance**: Interface with maintenance teams or external contractors to execute the checks.
4. **Data Entry & Analysis**: Record inspection results and compare against established acceptance criteria.
5. **Deficiency Management**: Trigger immediate corrective actions or risk assessments if assets fall outside safe operating limits.
6. **Record Retention**: Archive inspection reports for PSM and regulatory audit traceability.

