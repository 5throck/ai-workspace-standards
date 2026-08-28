# 철도 산업 — 차량사업소(기지) 차량 정비 LOTO 워크플로우 (Railway Rolling-Stock Depot Maintenance LOTO)

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 확장과 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
차량사업소(기지) 내에서 전동차(EMU)/객차/기관차 정비 시 발생하는 **이동 차량 충돌·협착**, **대차(bogey)·대차 wheels 중량 리프팅 사고**, **지밑(pit) 작업 중 차량 이동**, **차상(rooftop) 추락**, **활선부 감전** 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 차량사업소 정비는 고정 설비(plant) LOTO와 근본적으로 다르다 — 정비 대상이 **이동 차량(moving vehicle)**이므로, 잠금·표지(Lockout/Tagout)의 1차 목적이 설비 에너지 격리가 아니라 **차량의 우발적 이동/운행 방지**와 **인접 선로 진입 통제**에 있다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, 코드베이스에서 유일하게 **이동 차량(rolling-stock vehicle) LOTO**를 다룬다. 고정 설비 LOTO(제철 `molten-metal-loto`, 폐기물 `incinerator-shredder-loto`)와 구별되며, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 철도 산업 전용 차량 정비 안전 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 철도 (코드: `railway`, 여객·화물 철도 운영 및 차량 유지보수)
- **대상 작업**: 차량사업소(기지) 내 EMU/객차/기관차 정비·점검, 대차(bogey) 분해·조립·리프팅, 지밑(pit) 작업, 차상(rooftop) 설비 점검, 유도정비(detection maintenance) 라인 출입, 차량 입·출고 통제
- **적용 시점**: 차량 입고 시 안전점검, 정비 작업허가(PTW) 발행 전 차량 고정·접지, 교대 인수인계, 비정상 알람 대응, 신규 차종 도입

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 차량 정비 위험성평가 주관, 안전작업허가제(PTW) 운영, 차량사업소 비상 대응 계획 수립 |
| 차량 정비 책임자 (Rolling-Stock Maintenance Supervisor) | 차량 고정(wheel chock·hand brake·cut-out) 확인, 작업허가 승인, 진입 전 교차점검, 이상 시 작업 중지 |
| 전기안전관리자 (Electrical Safety Manager) | 차상 집전장치(pantograph)·활선부 차단·접지 확인, 정비 중 무정전 구간 표시, 절연보호구 적격성 판정 |
| 현장 작업자 (Worker) | wheel chock·표지 부착, 허가 조건 준수, pit 진입 전 차량 고정 상태 재확인, 이상 시 대피·보고 |
| 지밑(pit) 작업자 (Undercarriage Worker) | pit 내 돌발 차량 이동 시 대피로 확보, 리프트·잭 안전하중 준수, 밀폐공간 환기 확인 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 차량 정비 사고 및 근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 정비 대상 차량의 형식(EMU/객차/기관차), 인접 선로의 활선 여부, 집전장치(pantograph) 전원 상태, pit 내 환기·조명, 리프트 설비 안전하중을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 해당 선로의 전원을 차단하고, 인접 선로 운행을 통제. 가능 시 유도정비(detection maintenance) 라인으로 이동.
   2. **수동 방호 (Passive)**: wheel chock, hand brake, 차량 cut-out 스위치, pit 덮개, 리프트 안전장치.
   3. **능동 방호 (Active)**: 차량 이동 감지 센서, 접지·방전 확인 인터록, 가스·화재 검지.
   4. **관리 조치 (Administrative)**: 안전작업허가서(전기/기계/차량), 교대 TBM, 정비 중 인접 선로 출입 금지 통제.
   5. **PPE**: 절연장갑·절연화·안면보호구(전기 작업), 추락보호대(차상 작업), 안전모·방진마스크(pit 작업).
3. **차량 고정 및 이동 통제 (Vehicle immobilization and movement control)**: 입고 후 wheel chock 전후轮 양측 설치, hand brake 체결, 마스터 컨트롤러 cut-out, 정비 중 "정비 중 — 출입 금지" 표지부(Lockout/Tagout) 부착. 철도안전법 Article 48(철도 보호 및 질서유지)과 연계.
4. **활선부·전기 안전 (Catenary/energized parts control)**: 차상 작업 시 해당 선로 전원 차단·접지·Lockout/Tagout, 집전장치(pantograph) 강하 확인, 잔류 전압 확인(Zero-Energy Verification). 산업안전보건법 안전보건기준에관한규칙(감전 위험 방지)과 연계.
5. **대차·중량 리프팅 안전 (Bogey / heavy-lift safety)**: 크레인·리프트 안전하중 표시 준수, 리프팅 sling 적격성 점검, 리프트 하부 인원 통제, 불균형 적재 방지.
6. **지밑(pit) 작업 안전 (Undercarriage pit work)**: pit 진입 전 차량 고정 상태 재확인, pit 내 환기·조명·비상 대피로 확보, 리프트 지지 불안정 시 즉시 대피. 산업안전보건법 Article 38(추락 등 안전조치 — pit/차상)과 연계.
7. **비상 대응 (Emergency response)**: 차량 이상 이동·충돌·감전·추락 시 즉시 작업 중지·대피, 구조·구급 호출 절차 사전 정립.
8. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·점검표·차량 고정 확인 로그 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/railway/railway-railway-rolling-stock-maintenance-loto-record.json`](../../../../../evidence-models/domains/industry/railway/railway-railway-rolling-stock-maintenance-loto-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `RAILWAY-ROLLING-STOCK-MAINTENANCE-LOTO-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 차량 형식(EMU/객차/기관차), wheel chock·hand brake 확인 결과, 집전장치 접지 상태, pit 환기·조명 상태, 리프트 안전하중 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 철도안전법 Article 45
- 철도안전법 Article 48
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 철도안전법 | RSA | Railway Safety Act |

## 7. 규제 참고사항 (Regulatory Notes)
철도 차량사업소 정비를 전속 규율하는 단일 법령은 없다. 복합 통제 앵커: 철도안전법(RSA — 선로·차량사업소 운영 기준, 철도보호지구 행위제한 Article 45, 철도 보호 및 질서유지 Article 48)을 기본으로 하고, 산업안전보건법(OSHA-KR — 정비 작업자 안전, 추락·감전 등 안전조치 Article 38 + 안전보건기준에관한규칙)을 정비 근로자 보호에 적용한다. 중대재해처벌법(SAPA) Article 4~7은 사업주 안전보건 확보 의무의 일반적 근거이다. 본 워크플로우의 핵심 차별점은 **이동 차량(rolling-stock vehicle) LOTO**로, 고정 설비 LOTO(제철 용융물·가열로, 폐기물 소각로·파쇄기)와 구별된다 — 차량 LOTO의 1차 목적은 설비 에너지 격리가 아니라 차량 우발 이동 방지와 인접 선로 진입 통제이다. 철도 교량/고가 작업(RSA Art 45)과 선로/터널 작업(RSA Art 48)은 별도 워크플로우(`railway-bridge-viaduct-fall-prevention`, `rail-track-confined-maintenance`)에서 다룬다.

## 8. 외주 안전 안내 (Outsourcing Note)
철도 차량 정비·중정비(중수선)와 차량사업소 시설 유지보수는 외주·하도급 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 운영사(철도공사 또는 민간 운영사)는 차량 정비 외주업체 및 시설 유지보수 협력업체에 본 워크플로우의 차량 고정·Lockout/Tagout 통제 조치를 하도급 단계까지 적용하도록 해야 한다. 특히 다수 업체가 동일 차량사업소 내에서 동시 정비하는 환경에서는 작업 범위 중첩·인접 선로 통제 책임 소재를 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
