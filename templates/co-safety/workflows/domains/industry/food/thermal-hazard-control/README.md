# 식품 제조 산업 — 열 위해요인 통제 (Thermal Hazard Control) 워크플로우

> **상태**: 본 README는 Task 12에서 finalize되었습니다. 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다(`status: draft`). 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
식품 제조·가공 공정의 튀김기(fryer), 건조기(dryer), 증자기(retort/steamer), 가열반(oven/grill), 보일러 배관 등 고온 발생원으로 인한 화상(burn)·스켄(scaled) 위해와 튀김기/건조기 화재·폭발 리스크를 체계적으로 통제하여 작업자 안전을 확보한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 식품 산업 전용 열 위해요인 통제 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 식품 제조·가공 (코드: `food`)
- **대상 공정**: 튀김·볶음, 건조·가열, 증자·삶기, 오븐·구이, 보일러·증배관, 포장 전 예비 냉각
- **적용 시점**: 위험성평가 시, 신규 설비·용량 변경 시, 용제/식용유 변경 시, 정기 점검 주기

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 열 위해요인 위험성평가 주관, 통제 조치 적합성 확인, 화재 대응 계획 수립 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 표준 작업 절차 준수 감독, PPE 지급·점검, 온도설비 이상 시 작업 중지 |
| 작업자 (Worker) | 표준 작업 절차 준수, 내열 PPE 착용, 식용유/증기 누출·이상 징후 즉시 보고 |
| 보건관리자 (Health Manager) | 화상·열사병 등 관련 건강검진 및 응급처치 체계 운영 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 열 위해요인 사고·근접사고 사후 검토 |

## 4. 워크플로우 단계 (Procedure)
1. **위해요인 파악 (Hazard identification)**: 튀김기·건조기·증자기·오븐·보일러 등 고온 발생원과 접촉/방사열/스켄(증기/끓는 액체) 경로 파악. 식용유 발화점, 건조기 분진 폭발 가능성 확인.
2. **위험성평가 (Risk assessment)**: 화상 위험 평가, 튀김기/건조기 화재·폭발 위험 평가. 산업안전보건법 Article 36 위험성평가 의무와 연계.
3. **공학적 관리 (Engineering controls)**: 단열·방호커버, 자동 온도제어·과열 방지 장치, 국소배기(유증기·수증기 제거), 자동 소화설비(튀김기·건조기 특화) — 위계적으로 최우선 적용.
4. **관리적 조치 (Administrative controls)**: 표준 작업 절차, 작업 허가(고온 작업), 화재 대응 절차, 정기 설비 점검·청소(찌꺼기 자연발화 방지).
5. **개인보호구 (PPE)**: 내열장갑·앞치마·소매덮개, 보안경, 안전화(미끄럼 방지) — 위계의 최종 단계.
6. **교육 및 훈련 (Training & drills)**: 화상 예방 교육, 튀김기/건조기 화재 대응(절대 물 사용 금지 등) 훈련, 응급처치 교육.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §6의 증거 기록 생성, 정기 점검·교육·화재 훈련 결과 기록.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/food/food-thermal-hazard-control-record.json`](../../../../../evidence-models/domains/industry/food/food-thermal-hazard-control-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `FOOD-THERMAL-HAZARD-CONTROL-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 온도 측정값, 설비 점검 이력, 화재 훈련 결과 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 식품위생법 Article 48
- 건강기능식품에 관한 법률 Article 13
- 소방기본법 Article 16

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 식품위생법 | FSA | Food Sanitation Act |
| 건강기능식품에 관한 법률 | HSF-Act | Health Functional Food Act |
| 소방기본법 | BFS | Basic Act on Fire Services |

## 7. 규제 참고사항 (Regulatory Notes)
식품 안전은 주로 제품 품질 중심 규제(식품위생법 HACCP)이며, 이 위에 표준적인 산업안전보건법(OSHA-KR) 작업자 안전 통제가 중첩된다. 주요 작업자 위해요인: 식용유 화상, 건조기 화재, 냉장·냉동고 질식, 포장 라인 반복성 긴장(repetitive strain).

## 8. 미검증 인용 (Unverified Citations)
앵커 표에서 [UNVERIFIED]로 표시된 항목이며, 전문가 재검증이 필요하다:

- 식품위생법(FSA) Article 48 [UNVERIFIED-via-legalize-kr-full-text] — kr_safety 카탈로그에 존재는 확인되었으나, 출처는 Food-Sanitation-Act.yaml (mcp-kr-legislation)이다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
