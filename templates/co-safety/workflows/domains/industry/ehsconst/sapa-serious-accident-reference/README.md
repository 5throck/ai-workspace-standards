# 중대재해 참조 (SAPA Serious Accident Reference) Workflow

## 워크플로우 유형 (WORKFLOW TYPE): `reference` — 사고 데이터를 제공하고 중대재해 대응을 위해 `emergency-agent`에 dispatch(전달)함.

## 1. 목적
중대재해 발생 시 사고 데이터와 dispatch trigger를 `emergency-agent`에 전달.

## 2. 중대재해 정의 (중대재해처벌법 (SAPA))
- 사망 1명 이상
- 6개월 이상 치료 부상 1명 이상
- 동일 사고로 3명 이상 부상
- 1년 이상 요양 업무상 질병

## 3. 트리거 조건 (Trigger Conditions)
- 현장 사망사고
- 중상자 발생
- 다수 부상자 (3명 이상)
- 구조 활동 필요

## 4. 워크플로우 단계 (Workflow Steps)
1. **사고 인지**: 현장 안전관리자 보고.
2. **사고 현황 파악**: 인명피해, 공사 영향.
3. **데이터 취합**: 사고 장소, 공종, 협력업체, 안전관리계획서.
4. **emergency-agent dispatch**: 구조/구급/신고.
5. **사후 대응**: 고용노동부 (MOEL) 신고, 원도급자/발주처 통보.

## 5. 제공 데이터 (Data Provided)
- 사고 세부 정보
- 건설공사 정보 (`project_id`)
- 협력업체 책임 소재 (`contractor chain`)
- 안전관리계획 참조

## 6. emergency-agent와의 역할 경계 (Boundary)
| 활동 | ehsconst 도메인 | emergency-agent |
|----------|-----------------|-----------------|
| 사고 데이터 취합 | ✓ 제공 | — |
| SAPA 분류 | ✓ 제공 | — |
| 구조/구급 실행 | — | ✓ 조정 |
| MOEL 신고 | — | ✓ 담당 |
| 유가족 통보 | — | ✓ 담당 |

## 7. 법적 면책 고지 (Legal Disclaimer)
> 참조용 워크플로우. 중대재해처벌법 (SAPA) 위반 여부는 법률 전문가 판단 사항. emergency-agent가 현장 대응을 주도.
