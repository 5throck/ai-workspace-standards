# training (Safety Training) Domain v1 — Scope

> **Domain**: `training` (안전보건교육 관리) | **Tier**: Functional (cross-industry) | **13th active domain**

## 1. Purpose

안전보건교육 프로그램 종합 관리 — 산업안전보건법(제13, 29, 31, 32, 114조) + 중대재해처벌법(제8조)에 근거한 교육 계획, 이수 추적, 준수 관리.

## 2. Matrix Position

```
기능 도메인 (Tier 1) — 모든 산업에 공통 적용
                 제약    화학    가스    발전    건설    의료기기
training (기능)    ✓      ✓      ✓      ✓      ✓      ✓
```

모든 산업 도메인(ehsconst, ehschem, gasterm, powergen, meddevice)이 training 기능 서비스를 참조.

## 3. Training Types (7 + 1 tracking)

| # | Type | 법적 근거 | 주기 | 대상 |
|---|------|-----------|------|------|
| 1 | 정기교육 (regular) | 산안법 §29 | 연 1회 (건설: 월 1회) | 전 근로자 |
| 2 | 특별교육 (special) | 산안법 §31 | 위험작업 배치 시 | 위험작업 근로자 |
| 3 | 관리감독자 (supervisor) | 산안법 §32 | 연 1회 | 관리감독자 |
| 4 | 신규채용 (new_hire) | 산안법 §29 | 채용 후 1개월 이내 | 신규 근로자 |
| 5 | 직무전환 (job_transfer) | 산안법 §29 | 직무 변경 시 | 전환 근로자 |
| 6 | 응급조치 (first_aid) | 산안법 §13 | 연 1회 | 응급조치 담당자 |
| 7 | MSDS (msds) | 산안법 §114 | 배치 시 + 정기 | 화학물질 취급자 |
| 8 | 추적 (tracking) | 종합 | 월/분기/연 | 관리자 |

## 4. Evidence Models (5)

| Model | 용도 |
|-------|------|
| `training-record.json` | 개인별 교육 이수 기록 (핵심) |
| `training-curriculum-record.json` | 교육 과정 정의 (모듈/시수/평가) |
| `training-plan-record.json` | 연간/분기 교육 계획 |
| `training-compliance-record.json` | 준수 현황 (이수율/미이수자/SAPA 리스크) |
| `instructor-qualification-record.json` | 강사 자격 관리 |

## 5. Common Fields (training-record.json)

- `training_type`: regular / special / supervisor / new_hire / job_transfer / first_aid / msds
- `trainee_id` + `trainee_name` + `trainee_role`
- `completion_date` + `hours_completed` + `required_hours`
- `result`: passed / failed / incomplete / in_progress
- `next_training_due` + `retraining_required`
- `training_method`: classroom / online / on_the_job / field / vr_ar

## 6. Korean Legal Requirements Summary

| 법정 시수 | 일반 제조 | 건설 | 비고 |
|-----------|-----------|------|------|
| 정기교육 | 연 8~16시간 | 월 1회 | 50인 이상 16시간 |
| 신규채용 | 8시간 이상 | 추가 시수 | 1개월 이내 |
| 특별교육 | 위험작업별 상이 | | 화기/밀폐/방사선 등 |
| 관리감독자 | 연 16시간 | | KOSHA 지정 과정 |

## 7. Cross-Domain Integration

- **ehsconst**: 건설업 TBM (일일 안전회보) → training-record에 기록
- **msds**: 화학물질 취급자 MSDS 교육 → training-record + msds-record 연동
- **GLP**: 연구원 정기 교육 → glp-personnel-record와 통합
- **GMP**: 제조 인력 위생/GMP 교육
- **SAPA**: 미이수자 존재 시 중대재해처벌법 위반 위험 플래그

## 8. KPIs

- 정기교육 이수율: 목표 100% (법정 의무)
- 특별교육 적기 실시율: 목표 100% (위험작업 배치 전)
- 신규채용자 교육 기한 내 완료: 1개월 이내 100%
- 강사 자격 유효율: 100%
- SAPA 리스크: 미이수자 0건

## 9. Legal Disclaimer

> 본 시스템은 워크플로우 자동화 지원만 제공합니다. 교육 실시 및 준수 여부는 사업주 책임입니다.
