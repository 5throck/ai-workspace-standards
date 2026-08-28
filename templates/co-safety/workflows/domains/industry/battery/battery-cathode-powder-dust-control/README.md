# 배터리 산업 — 양극활물질 분말 분진 통제 (Cathode Powder Dust Control) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
리튬이온 이차전지 양극활물질(cathode active material) 혼합·분산·코팅 공정에서 발생하는 가연성·유해 분진(코발트·니켈·망간 산화물, NMC/NCA계), 유기 용제 분말 운송 분진의 흡입 중독, 분진폭발(dust explosion) 위해요인을 통제 위계에 따라 체계적으로 예방한다. 양극활물질 분말은 호흡기 독성이 있고, 건식 공정에서는 가연성 분진이 폭발 하한농도(MEC)를 초과할 수 있어 대표적 복합 위해요소이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 배터리 산업 전용 분진 통제 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 배터리 (코드: `battery`, 리튬이온 이차전지 제조)
- **대상 작업**: 양극활물질 분말 투입·믹싱, 슬러리 분산, 코팅·건조, 분맄 운송(이송파이프·싸이로), 집진설비(Bag Filter/스크러버) 운전·청소, 드럼/빅백 충·적재, 설비 내부 청소
- **적용 시점**: 분말 취급 라인 가동, 집진설비 교체·청소, 분진 누출 알람, 신규 양극 조성 도입

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 분진·화학물질 위험성평가 주관, 분진폭발 방호 대책 수립, 작업환경측정 계획 |
| 산업보건관리자 (Industrial Hygienist) | 호기성 분진 농도 측정·평가, 방진마스크 적격성 평가, 국소배기장치 성능 점검 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 작업허가 승인, 방진설비 사전 점검, 정전·비산 억제 조치 확인 |
| 작업자 (Worker) | 방진마스크·보호구 착용, 국소배기장치 정상 가동 확인, 분진 비산 억제 준수 |
| 설비 엔지니어 (Facility Engineer) | 집진설비·이송파이프 기밀 유지, 이낸erting(불활성가스 봉입) 설비 가동 점검 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 분진 노출·분진폭발 사고·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 분진의 화학 조성(코발트·니켈·망간 등), 입경·수분율, 가연성(MIE·Kst·MEC), 비산 구역, 점화원(정전·마찰·화염)을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 습식 슬러리 공정으로 건식 분말 취급 최소화, 밀폐 이송 시스템 도입.
   2. **수동 방호 (Passive)**: 완전 밀폐 설비·글로브박스, 국소배기장치(LEV), 폭발Venting/Suppressing 설비.
   3. **능동 방호 (Active)**: 비산 분진 연속 모니터링, 불활성가스(inerting) 봉입·산소농도 제어.
   4. **관리 조치 (Administrative)**: 분진취급 작업허가서, 청소 절차 표준화(순차 청소·진공), 작업환경측정.
   5. **PPE**: 방진마스크(P3/HEPA)·보호복·보안경(최후 수단).
3. **호기성 노출 통제 (Inhalation exposure control)**: 양극분말(코발트·니켈·망간 산화물) 발암·생식독성 물질에 대한 노출 기준 준수, 산업안전보건법 Article 57(작업환경측정)과 연계. 화학물질의 등록 및 평가 등에 관한 법률(ARECA) Article 23·24(유해성 평가·사고대비) 병행.
4. **분진폭발 방지 (Dust-explosion prevention)**: 가연성 분진의 Kst/MEC 평가 기반 방호설계, 정전기 접지·본딩, 이낸erting(질소 봉입), 방폭 전기 설비 적용. 위험물안전관리법 Article 15(취급 기준), Article 27(시설 기준)과 연계.
5. **집진설비 운영 (Dust-collection operations)**: Bag Filter/스크러버 차압·가동 상태 점검, 교체·청소 시 잔류 분진 위험 통제(화재·발화 방지).
6. **비상 대응 (Emergency response)**: 분진화재(Metal-fire) 시 금속화재용 소화제(D-class) 사용, 물 사용 금지 조건 사전 정립, 분진폭발 시 격리·대피 절차.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 작업환경측정 결과·집진설비 점검표·분진폭발 위험 평가서 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/battery/battery-battery-cathode-powder-dust-control-record.json`](../../../../../evidence-models/domains/industry/battery/battery-battery-cathode-powder-dust-control-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `BATTERY-CATHODE-POWDER-DUST-CONTROL-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 분진 조성·입경, Kst/MEC 값, 집진설비 가동 상태, 작업환경측정 결과, 방진마스크 적격성 등 산업 고유 필드를 정의.

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
리튬이온 전지 양극활물질 취급을 전속 규율하는 단일 법령은 없다. 복합 통제 앵커: 위험물안전관리법(DSSMA — 가연성 분진·유기용제 취급/시설 기준), 화학물질의 등록 및 평가 등에 관한 법률(ARECA — 유해성 평가·화학사고 대비), 전기안전관리법(ESCA — 방폭 전기 설비·정전기 접지). 추가 관련: 산업안전보건법 Article 57(작업환경측정 — 코발트·니켈·망간 노출 모니터링), 분진폭발 방지 기술지침(MOEL 고시). 단, 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
배터리 공장 건설(EPC)과 설비 청소·유지보수(O&M), 특히 집진설비 교체·내부 청소 작업은 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(배터리 메이커)는 청소·설비 협력업체에 본 워크플로우의 통제 조치(잔류 분진 화재·분진폭발 방지 포함)를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
