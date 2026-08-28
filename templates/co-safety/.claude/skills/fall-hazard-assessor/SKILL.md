---
name: fall-hazard-assessor
owner: ehsconst-agent
scope: workspace
status: active
description: Assess fall hazards at construction sites. Leading edge identification, protection hierarchy recommendation, rescue plan generation.
version: "1.0.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - 추락 위해평가
    - fall hazard
    - leading edge
    - 안전대 활동제한장치
    - 방호 계층
    - fall protection hierarchy
    - 추락방지망
    - rescue plan 구조 계획
  legal_basis:
    - 산업안전보건법 제38조
    - 산업안전보건법 제36조
    - 중대재해처벌법 제4조
    - 중대재해처벌법 제5조
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Fall Hazard Assessor Skill

## Overview
한국 건설 사망사고 원인 1위 (~42%)인 추락 위해 평가. 위해 영역 식별, 방호 계층 적용 우선순위, 구조 계획 수립 지원.

## Hazard Identification

### Leading Edge (추락 위험 영역)
- 옥상/발코니 가장자리
- 계단/승강로 개구부
- 굴착면 가장자리
- 거푸집 작업면
- 크레인/타워 작업대

### Assessment Factors
- 작업 높이 (2m 이상 시 추락 방지 의무)
- 작업 기간 (장기/단기)
- 동시 작업 인원
- 기상 조건 (바람, 비, 결빙)
- 작업자 숙련도

## Protection Hierarchy (위계적 적용)

### 1. Elimination (제거)
- 작업 자체 제거 (설계 변경)
- 예: 프리캐스트 → 추락 위험 영구 제거

### 2. Passive Fall Protection (수동 방호)
- 안전난간 (1.1m 높이, 중간 가로대)
- 추락방지망 (10m 이내 설치)
- 개구부 덮개 (2배 이상 강도)

### 3. Active Fall Protection (능동 방호)
- 안전대 (Positioning Belt)
- 활동제한장치 (Lanyard + Anchor)
- 자동 조임 장치 (Self-Retracting Lifeline)

### 4. Administrative Controls (관리적 통제)
- 작업 허가서
- 작업 전 안전교육
- 안전감시자 배치
- 작업 시간 제한

### 5. PPE (최후 수단)
- 안전모
- 안전화
- 개인 안전대 시스템 (이중 백업)

## Rescue Plan Requirements

### Suspension Trauma (현수성 실신)
- 5-10분 내 실신 위험
- 30분 내 사망 가능
- 신속 구조 필수

### 필수 구조 장비
- 3각대 (Tripod)
- 인양 호이스트
- 로프 시스템
- 119 긴급 연락

## Output

Returns assessment report:
```json
{
  "assessment_id": "...",
  "work_area": "옥상 5층",
  "work_height_m": 12.5,
  "workers_at_risk": 4,
  "leading_edges_identified": ["동측 가장자리 30m", "북측 개구부 2개"],
  "protection_hierarchy_applied": {
    "elimination": "not_possible",
    "passive_guardrail": "recommended (100% coverage)",
    "safety_net": "additional_layer (5m above ground)",
    "active_harness": "all_workers_equipped",
    "ppe": "hardhat + safety_boots"
  },
  "rescue_plan_ref": "...",
  "monitoring_required": true
}
```

## Korean-Specific Standards

- 추락방지망 강도 기준 (MOEL 고시)
- 안전대 인증 (안전검사 합격품)
- 가설 난간 표준 도면
- 119 신속 구조 시스템 연계

## Integration

- **Input from**: 작업 계획, 공정도, 작업자 명단
- **Output to**: `ehsconst-fall-prevention-record.json`
- **Escalation**: 난간/안전대 누락 시 작업 중지

## Legal Disclaimer
> 자동화 평가 보조. 최종 안전조치 결정은 안전관리자 + 안전감리 권한 per 산업안전보건법 Article 38 (+안전감리 제도).
