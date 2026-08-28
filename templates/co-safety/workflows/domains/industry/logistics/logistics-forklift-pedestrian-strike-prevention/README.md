# 항만 물류 산업 — 지게차·보행자 충돌 방지 (Forklift Pedestrian Strike Prevention) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
항만 야적장·터미널·창고에서 지게차(forklift)·동력운반차(power truck)·스트래들 캐리어와 보행자 작업자의 충돌·압사·전도 위해요인을 통제 위계에 따라 체계적으로 예방한다. 항만은 차량과 보행자가 동일 동선에서 혼재하는 대표적 고위험 작업장이며, 차량 전도·적하물 낙하·사각지대 충돌은 중대재해의 주요 유형이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 항만 물류 전용 차량-보행자 분리 절차이다. (위험물 누출·화재는 `logistics-dangerous-cargo-handling` 워크플로우와 중복되지 않는다.)

## 2. 적용 범위 (Scope)
- **대상 산업**: 물류 (코드: `logistics`, 항만 및 화물 하역)
- **대상 작업**: 지게차·동력운반차·스트래들 캐리어 운행, 컨테이너 야적·이동, 보행자 작업(피킹·검수·계량·유도), 야적장 통행·횡단, 야간·제한 시계 작업, 장비 충전·점검
- **적용 시점**: 차량 도입·개조, 작동 구역 변경, 보행자 동선 변경, 근접사고 발생, 시계 제한 환경(야간·악기상)

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 차량-보행자 위험성평가 주관, 동선 분리 기획, 안전교육·면허 관리 |
| 현장 감독자 / 터미널 운영 책임자 (Supervisor) | 작업 구역 통제, 보행자 전용 동선 유지, 이상 시 작업 중지 |
| 차량 운전자 (Forklift Operator) | 적법 면허·사전 점검, 안전속도·제한구역 준수, 보행자 발견 시 즉시 정지 |
| 보행자 작업자 (Pedestrian Worker) | 지정 보행동선 준수, 고가시성 조끼(HVVA) 착용, 차량 접근 시 안전거리 확보 |
| 설비 엔지니어 (Facility Engineer) | 차량 프로ximity 센서·카메라·경광등·후방 카메라 점검, 동선 표지·난간 유지 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 충돌·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 차량 통행 동선·속도, 보행자 동선, 교차 구간, 사각지대, 적하물 시계 차폐, 작업자 밀집, 시계 제한(야간·야드 조명)을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 보행자의 야드 진입 자체 최소화(자동화 안내·원격 검수), 차량-보행자 시간대 분리.
   2. **수동 방호 (Passive)**: 물리적 동선 분리(난간·차단벽·보도), 보행자 전용 통로·횡단구, 차량 속도 완충장치(sleeping police).
   3. **능동 방호 (Active)**: 차량-보행자 프로ximity 감지·충돌경고 시스템(Pedestrian Detection), 자동 제동, 경광등·후방 카메라.
   4. **관리 조치 (Administrative)**: 보행자-차량 격리 SOP, 면허·안전교육, 신호수(Spotter) 배치, 속도 제한·일방통제.
   5. **PPE**: 고가시성 조끼(HVVA Class 2/3)·안전모·안전화(최후 수단).
3. **차량 안전 통제 (Vehicle safety control)**: 산업안전보건법 Article 38(추락·낙하 등 안전조치), 안전보건기준에관한규칙(차량·기계 안전장치 기준)에 따른 사전 점검(브레이크·경광등·혼·후방 카메라), 정격 적재량 준수, 포크 하향 운행.
4. **동선 분리 (Traffic-pedestrian separation)**: 차량 동선과 보행 동선의 물리적 분리, 교차구에서는 신호수 배치·일시정지, 횡단 금지구역 표지.
5. **시계 제한 통제 (Visibility-limited operations)**: 야간·악기상 작업 시 조도 확보, 회전등·작업등 점검, 고가시성 조끼 의무화, 후방 접근 알람.
6. **비상 대응 (Emergency response)**: 충돌·전도 사고 시 즉시 구조·응급처치·119 신고, 차량 전도 시 추가 낙하 방지 조치, 사고 현장 보존·조사 절차 사전 정립.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 차량 점검표·면허·교육 이수 대장·근접사고 보고서 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/logistics/logistics-logistics-forklift-pedestrian-strike-prevention-record.json`](../../../../../evidence-models/domains/industry/logistics/logistics-logistics-forklift-pedestrian-strike-prevention-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `LOGISTICS-FORKLIFT-PEDESTRIAN-STRIKE-PREVENTION-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 차량 종류·정격, 동선 분리 등급, 프로ximity 감지 설비 상태, 사각지대 평가, 근접사고 이력 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 항만안전특별법 Article 4
- 항만안전특별법 Article 5
- 항만안전특별법 Article 6
- 항만안전특별법 Article 8
- 항만안전특별법 Article 9
- 산업안전보건법 Article 38 (추락·낙하 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 위험물안전관리법 Article 20

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 항만안전특별법 | PSSA | Port Safety Special Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |

## 7. 규제 참고사항 (Regulatory Notes)
항만 차량-보행자 안전은 항만안전특별법(PSSA)과 산업안전보건법(OSHA-KR)이 이중으로 규율한다. **PSSA Article 6(항만운송 참여자의 안전확보 의무 등)이 항만 작업자 안전확보의 실질적(substantive) 의무 조문**이며, **PSSA Article 4(다른 법률과의 관계)는 타 법률과의 적용 우선순위를 정하는 절차적(priority-of-application) 조문**이다. 차량·기계 안전장치와 추락·낙하 방지의 직접 조문은 **산업안전보건법(OSHA-KR) Article 99(추락·낙하 방지)·Article 100(차량·기계 안전장치)** 이다. 위험물안전관리법 Article 20은 차량이 취급하는 위험물 운반 기준에 해당한다. 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
항만 하역·야적 작업은 하역업체(stevedore)·3PL·장비 리스사 등 외주 인력이 차량 운전자와 보행자 양측을 모두 담당하는 경우가 많아, 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 핵심적이다. 항만 운영사(terminal operator)는 외주 차량 운전자·보행 작업자 모두에게 본 워크플로우의 통제 조치(동선 분리·프로ximity 감지·고가시성 조끼 의무화·면허 확인 포함)를 하도급 단계까지 동일 적용하고, 다수 외주업체가 동일 야드에서 혼재 작업할 때는 통합 안전관리 주체와 책임 경계를 계약서에 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
