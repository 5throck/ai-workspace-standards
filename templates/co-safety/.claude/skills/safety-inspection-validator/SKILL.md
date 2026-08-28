---
name: safety-inspection-validator
owner: ehsconst-agent
scope: workspace
status: active
description: Validate construction safety inspections per OSHA-KR construction provisions. Findings classification, severity assessment, action recommendation.
version: "1.0.0"
created: "2026-06-18"
last_updated: "2026-06-18"
metadata:
  triggers:
    - 안전점검 결과 검증
    - safety inspection findings
    - 지적사항 분류
    - CAPA
    - 시정조치
    - Critical Major Minor 분류
    - 건설 안전점검
  legal_basis:
    - "산업안전보건법 제42조 (유해위험방지계획서의 작성·제출)"
    - "산업안전보건법 제38조 (건설공사 안전조치)"
    - "산업안전보건법 제67조 (건설공사 발주자 산업재해 예방 조치)"
    - "중대재해처벌법 제4조 (사업주 안전보건 확보의무)"
---

audit_exception: safety-os-skill-structure — Safety OS skills use the legal_basis-gated SSOT skill format (validated by scripts/skill-lifecycle-audit.ts and scripts/validate-skills.ts), not the generic template 5-section/7-frontmatter schema

# Safety Inspection Validator Skill

## Overview
Validates construction safety inspection findings per OSHA-KR construction provisions and Korean MOEL inspection standards. Classifies findings by severity, identifies systemic issues, recommends CAPA.

## Finding Classification

### Critical (즉시 작업 중지)
- 추락 방지 조치 누락 (2m 이상 작업)
- 붕괴 위험 징후 (균열, 침하, 변형)
- 활선 작업 접근 (허가 없이)
- 화재 위험 (가스 누출, 인화성 물질)
- 밀폐공간 진입 (가스 검사 없이)

### Major (시정 명령)
- PPE 미착용
- 안전난간 미설치
- 정리정돈 미흡
- TBM 불참자 다수
- 안전표지 손상

### Minor (경고)
- 도색 미흹
- 정리정돈 부분 부족
- 도색/표지 일부 손상

## Validation Steps

### Step 1: Finding Verification
- 사진/동영상 확인
- 위치 정확성 검증
- 발생 일시 확인
- 목격자 진술 검토

### Step 2: Legal Basis Mapping
- OSHA-KR construction article 매핑
- SAPA Article 5 도급·하도급 확보의무 적용 여부
- 안전관리계획서 위반 여부

### Step 3: Risk Re-assessment
- 초기 위험 평가와 비교
- 잔류 위험 수용 가능 여부
- 추가 조치 필요성

### Step 4: Corrective Action
- 즉시 조치 (Critical)
- 단기 조치 (Major, 7일 이내)
- 중장기 조치 (Minor, 30일 이내)

### Step 5: Verification Plan
- 재점검 일정
- 효과성 검증 방법
- 서명 승인

## Integration

- **Input from**: `ehsconst-inspection-record.json`
- **Output to**: Updates finding classifications, CAPA tracking
- **Escalation**: Critical findings → 작업 중지 + 즉시 안전관리자 보고

## Legal Disclaimer
> 안전점검 결과 판정은 자동화 보조. 최종 결정은 안전관리자/안전감리 권한.
