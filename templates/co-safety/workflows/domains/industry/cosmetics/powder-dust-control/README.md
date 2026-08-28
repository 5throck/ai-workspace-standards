# 화장품 산업 — 분체·분진 통제 (Powder & Dust Control) 워크플로우

> **상태**: 본 README는 Task 12에서 finalize되었습니다. 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다(`status: draft`). 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
화장품 제조 공정 중 분체 혼합(powder mixing), 에어로솔 충전(aerosol filling), 분말 포장, 청소·집진 공정에서 발생하는 호흡성 분진(respirable dust) 및 가연성 분진(combustible dust) 위해요인을 체계적으로 통제하여, 작업자 건강을 보호하고 분진 화재·폭발 리스크를 예방한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 화장품 산업 전용 통제 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 화장품 제조·수입업 (코드: `cosmetics`)
- **대상 공정**: 분체 원료 취급, 혼합·교반, 에어로솔 충전, 분말 포장, 청소·집진
- **적용 시점**: 위험성평가 수행 시, 신규 분체 원료 도입 시, 공정 변경 시, 정기 모니터링 주기

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 위험성평가 주관, 통제 조치 적합성 확인, 교육 계획 수립 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 작업 절차 준수 감독, PPE 지급·점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 표준 작업 절차 준수, PPE 착용, 이상 징후 보고 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 통제 조치 및 노출 모니터링 결과 사후 검토 |

## 4. 워크플로우 단계 (Procedure)
1. **위해요인 파악 (Hazard identification)**: 분체 취급 공정(혼합·충전·포장·청소)별 발생원과 분진 특성(입도, 가연성, 독성) 파악. 관련 MSDS 확보.
2. **위험성평가 (Risk assessment)**: 호흡기 노출 평가, 가연성 분진 폭발 가능성 평가. 산업안전보건법 Article 36 위험성평가 의무와 연계.
3. **공학적 관리 (Engineering controls)**: 국소배기장치(LEV), 밀폐 이송, 자동화, 폭발 방지 설계(제전·불활성 가스) — 통제 위계에서 최우선 적용.
4. **관리적 조치 (Administrative controls)**: 표준 작업 절차, 작업 허가, 노출 모니터링, 교육. 산업안전보건법 MSDS 규정 Article 110 비치 의무와 연계.
5. **개인보호구 (PPE)**: 호흡기보호구, 보안경, 보호복 — 통제 위계의 최종 단계.
6. **교육 및 특수건강검진 (Training & medical surveillance)**: 취급 물질 기반 특수건강검진 항목 선정, 정기 교육.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §6의 증거 기록 생성, 정기 모니터링·감사 결과 기록.

## 5. 공통 TBM 참조 안내 (Shared TBM Reference)
화장품 산업은 공통 **작업전 안전점검회의(TBM, Tool Box Meeting)** 워크플로우(`workflows/_shared/tbm/`)의 참조 산업(consumer)으로 선언되어 있다. 본 `powder-dust-control` 워크플로우는 산업 고유 워크플로우이며, TBM은 별도의 `references:` 블록으로 선언된다. 공통 워크플로우 참조 방식은 [`workflows/_shared/REFERENCE-APPLICATION-GUIDE.md`](../../../../_shared/REFERENCE-APPLICATION-GUIDE.md)를 참조하십시오.

## 6. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/cosmetics/cosmetics-powder-dust-control-record.json`](../../../../../evidence-models/domains/industry/cosmetics/cosmetics-powder-dust-control-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `COSMETICS-POWDER-DUST-CONTROL-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 분진 농도 측정값, 통제 조치 이력, 교육 이수 등 산업 고유 필드를 정의.

## 7. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 화장품법 Article 5
- 화학물질의 등록 및 평가 등에 관한 법률 Article 10
- 산업안전보건법 MSDS 규정 Article 110

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 화장품법 | CA | Cosmetics Act |
| 화학물질의 등록 및 평가 등에 관한 법률 | K-REACH | Act on Registration and Evaluation of Chemicals |

## 8. 규제 참고사항 (Regulatory Notes)
화장품 제조는 용제 취급, 에어로솔 충전, 분체 혼합을 수반하며, 이들은 모두 화장품 전용 안전 법령이 아닌 산업안전보건법(OSHA-KR) 및 위험물안전관리법(DSSMA) 유형의 통제로 다루어진다. 화장품법 자체는 주로 제품 품질 등록 규제(MFDS 집행)이며, Article 5의 시설 기준에 안전 중복 영역이 있다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
