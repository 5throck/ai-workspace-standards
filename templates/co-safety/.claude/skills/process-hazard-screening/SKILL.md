---
name: process-hazard-screening
owner: ehschem-agent
scope: workspace
status: active
description: Initial hazard screening for chemical plant processes. Identifies PSM-applicable processes and dispatches detailed PHA to functional PSM service.
version: "1.0.0"
created: "2026-06-18"
last_updated: "2026-08-26"
metadata:
  triggers:
    - PSM 적용대상
    - process hazard screening
    - 위해물질 보유량
    - 공정안전관리
    - PHA 대상 여부
    - 사고대비물질
    - 화학공장 초기 위해평가
  legal_basis:
    - 산업안전보건법 제44조 (공정안전관리)
    - 산업안전보건법 제36조 (위험성평가 실시)
    - 중대재해처벌법 제4조 (사업주 및 경영책임자 안전보건 확보의무)
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Process Hazard Screening Skill

## Overview
화학공장 공정의 초기 위해 스크리닝. PSM 적용 대상 공정 식별 후 상세 PHA는 functional PSM service로 dispatch.

## Matrix Role
- ehschem (industry): 초기 스크리닝, 화학공장 context
- PSM (functional): 상세 PHA/HAZOP 수행

## Screening Criteria (OSHA-KR Art 44 · 산업안전보건법 시행령 제43조 별표 13)

Applicability is determined by 산업안전보건법 시행령 제43조 (공정안전보고서의 제출 대상): hazardous/dangerous facilities handling substances at or above the 규정량 (specified threshold quantities) listed in 별표 13 of the Decree. Indexed in `regulations/KR/OSHA-KR-Decree.yaml`.

| 기준 | 임계값 |
|------|--------|
| 위해물질 보유량 | 시행령 별표 13 규정량 이상 (43종 사고대비물질 포함) |
| 가연성 물질 | 해당 물질의 별표 13 규정량 이상 |
| 독성 물질 | 해당 물질의 별표 13 규정량 |
| 반응성 물질 | UN Division 1.1-1.3, Class 2/3 reactive |

> Comparative benchmark only: the US OSHA 29 CFR 1910.119(a)(1)(ii) 10,000 lb (4,536 kg) flammable-substance threshold is an international reference and does NOT determine PSM applicability under Korean law.

## Workflow Steps
1. **공정 식별**: unit별 화학물질, 보유량 조사
2. **임계값 평가**: PSM 지정수량 대비 보유량
3. **PSM 적용 결정**: applicable → PSM service dispatch
4. **비PSM 위해 평가**: 간이 위해성 평가 (위험성평가 Article 36 수준)

## Legal Disclaimer
> 초기 스크리닝 보조. PSM 적용 여부 최종 판정은 안전관리자.
