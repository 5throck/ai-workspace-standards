# 배터리 산업 — 셀 화성공정 전기 안전 (Battery Cell Formation Electrical Safety) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
리튬이온 이차전지 셀 화성(formation)·에이징(aging)·검사 공정에서 발생하는 고전압·대전류 감전, 아크 플래시, 가연성 전해액 증기에 의한 화재·폭발, 열폭주(thermal runaway) 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 화성공정은 셀당 수 볼트~수십 볼트의 직류 전압을 인가하며, STRING 적측 시 고전압이 형성되어 감전·아크 사고의 대표적 고위험 공정이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 배터리 산업 전용 전기 안전 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 배터리 (코드: `battery`, 리튬이온 이차전지 제조)
- **대상 작업**: 셀 화성(formation) 충·방전, 에이징(aging) 랙 운전, OC/IR 검사, STRING 모듈 적층·시험, 고전압 챔버 출입, 화공정 설비 유지보수
- **적용 시점**: 화성 설비 가동 전 안전점검, 교대 인수인계, 비정상 전압/온도 알람 대응, 신규 셀 타입 도입

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 전기·화재 위험성평가 주관, 화공정 안전작업허가제 운영, 비상 대응 계획 수립 |
| 전기안전관리자 (Electrical Safety Manager) | 화성 설비 전기적 안전성 확인, 활선부 차단·접지·Lockout/Tagout 적용, 절연보호구 적격성 판정 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 안전작업허가 승인, 화공정 진입 전 교차점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 절연보호구 착용, 허가 조건 준수, 가스·온도 알람 시 대피·보고 |
| 설비 엔지니어 (Facility Engineer) | 화공정 챔버 환기·가스검지·소화 설비 가동 상태 점검 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 전기·화재 사고 및 근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 화공정 전압·전류 레벨, 적측 STRING 수, 전해액 증기 발생 가능성, 열폭주 전파 경로를 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 설계 단계에서 저전압 분산 배치, 열전파 차단벽 적용.
   2. **수동 방호 (Passive)**: 화공정 챔버 간 격벽, 환기·가스검지·자동 소화 설비, 절연 매트.
   3. **능동 방호 (Active)**: 과전압·과전류·온도 이상 감시 인터록, 자동 차단기.
   4. **관리 조치 (Administrative)**: 안전작업허가서(전기/화재), 교대 TBM, 충전 중 무접근 통제.
   5. **PPE**: 절연장갑·절연화·안면보호구·내전아크복(최후 수단).
3. **전기 안전 통제 (Electrical safety control)**: 화공정 랙 진입 전 전원 차단·접지·방전·Lockout/Tagout, 잔류 전압 확인(Zero-Energy Verification). 전기안전관리법 Article 16(전기안전관리자), Article 22(안전점검)과 연계.
4. **가연성 가스·화재 통제 (Flammable vapor & fire control)**: 전해액 증기(에틸메틸카보네이트 등) 누출 시 환기·가스검지 경계 작동, 화재 시 화공정 챔버 격리·소화 설비 작동. 위험물안전관리법 Article 15(취급 기준), Article 27(시설 기준)과 연계.
5. **열폭주 방지 (Thermal runaway prevention)**: 셀 온도 이상 알람 시 즉시 해당 랙 차단·격리, 인접 셀로의 열전파 방지 조치.
6. **비상 대응 (Emergency response)**: 감전·아크 화상·화재 시 즉시 전원 차단, 대피, 구조·소화 호출 절차 사전 정립.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·점검표·알람 로그 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/battery/battery-battery-cell-formation-electrical-safety-record.json`](../../../../../evidence-models/domains/industry/battery/battery-battery-cell-formation-electrical-safety-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `BATTERY-CELL-FORMATION-ELECTRICAL-SAFETY-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 화공정 전압·전류 레벨, STRING 적측 수, 접지·방전 확인 결과, 가스검지 알람 이력 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 15
- 위험물안전관리법 Article 27
- 화학물질의 등록 및 평가 등에 관한 법률 Article 23
- 화학물질의 등록 및 평가 등에 관한 법률 Article 24
- 전기안전관리법 Article 16
- 전기안전관리법 Article 22

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 화학물질의 등록 및 평가 등에 관한 법률 | ARECA | Act on the Registration and Evaluation of Chemicals (K-REACH) |
| 전기안전관리법 | ESCA | Electrical Safety Control Act |

## 7. 규제 참고사항 (Regulatory Notes)
리튬이온 전지 제조를 전속 규율하는 단일 법령은 없다. 복합 통제 앵커: 위험물안전관리법(DSSMA — 가연성 전해액 용제, 양극활물질 취급 기준), 화학물질의 등록 및 평가 등에 관한 법률(ARECA — 화학사고 예방 및 유해성 평가), 전기안전관리법(ESCA — 고전압 화성·충전·시험 설비). 추가 관련: 산업안전보건법 Article 38(감전·추락 등 위해 방지 안전조치 — 셀 적측 랙 상부 작업 포함) + 안전보건기준에관한규칙. 단, 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
배터리 공장 EPC 건설과 화공정 설비 유지보수(O&M)는 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(배터리 메이커)는 EPC 시공사 및 O&M 협력업체에 본 워크플로우의 통제 조치를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
