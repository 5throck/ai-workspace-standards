# 방위 산업 — 탄약 저장 탄약고 안전 (Munitions Storage Magazine Safety) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
방위산업 제조시설의 탄약·화약류 저장 탄약고(magazine)에서 발생하는 폭발·화재·자발 반응 위해요인을 통제 위계에 따라 체계적으로 예방한다. 저장 단계에서는 양·거리(QD: Quantity-Distance) 기준, 호환성 그룹(Compatibility Group) 혼적 금지, 정전·낙뢰·충격 마찰 점화원 통제, 환기·온습도 관리가 핵심이며, 일탈 시 대형 인명·시설 피해로 이어진다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 방위 산업 전용 탄약고 안전 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 방위 (코드: `defense`, 방위산업 제조)
- **대상 작업**: 탄약·화약류·추진제·폭발물 수입·이동·저장, 탄약고(지상/반지하/이격식) 운영, 호환성 그룹별 분류 저장, 재고 순환점검, 불량탄·폐기탄 격리 보관, 출입 통제·재고 실사
- **적용 시점**: 신규 탄종 도입, 탄약고 증축·변경, 정기 QD 재평가, 불량/노후 탄약 발견, 낙뢰·화재 알람

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 폭발·화재 위험성평가 주관, QD·호환성 기준 준수 확인, 비상 대응 계획 |
| 폭발안전 담당 (Explosives Safety Officer) | 탄약 분류·호환성 그룹 지정, 저장 배치 승인, 불량탄 격리 판정 |
| 현장 감독자 / 탄약고 관리자 (Magazine Supervisor) | 출입 통제, 재고 실사, 환기·온습도·낙뢰 접지 점검, 이상 시 작업 중지·대피 |
| 작업자 (Worker) | 정전·충격 마찰 억제 절차 준수, PPE 착용, 이상 징후(이상 발열·가스·변색) 보고 |
| 설비 엔지니어 (Facility Engineer) | 탄약고 벽체·환기·소화·낙뢰 접지·정전기 접지 설비 점검·유지 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 폭발·화재 사고·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 저장 탄약의 NET/explosive weight, 분류(1.1~1.6), 호환성 그룹, 인화점/자발발화 온도, 점화원(정전·낙뢰·마찰·충격), 주변 시설과의 거리를 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 불량/불안정 탄약 즉시 폐기·격리, 과잉 재고 최소화.
   2. **수동 방호 (Passive)**: 벽체(방호벽/토공)에 의한 QD 확보, 이격식 탄약고, 호환성 그룹별 물리적 분리, 낙뢰·정전 접지.
   3. **능동 방호 (Active)**: 온습도·가스 연속 모니터링, 화재감지·자동 소화(단, 탄약 화재 시 소화 방법은 탄종별 제한), 접지 이상 알람.
   4. **관리 조치 (Administrative)**: 출입 통제·실사 체계, 호환성·저장 한도 기준(SOP), 작업허가제, 정기 QD 재평가.
   5. **PPE**: 난연복·정전기 방지복·안전화·보안경·청력보호구(최후 수단).
3. **저장 배치·호환성 통제 (Storage layout & compatibility)**: 총포·도검·화약류 등 단속법(FSESA) Article 9(화약류 저장 허가·기준), Article 23(취급 기준)에 따른 저장 한도·호환성 그룹별 분리 적치, 바닥·벽면 이격 거리 준수.
4. **점화원 통제 (Ignition-source control)**: 낙뢰 접지·정전기 접지(Bonding/Grounding) 점검, 비점화 공구 사용, 전자기기 제한 구역 지정, 화기 엄격 통제.
5. **환경 관리 (Environmental control)**: 온습도 기준(탄종별 규정) 준수, 환기로 가스 축적 방지, 침수·누수 점검.
6. **비상 대응 (Emergency response)**: 폭발·화재 시 즉시 대피(거리·방호벽 활용), 소화는 탄종별 기준에 따라 제한적으로 수행, 불가 판단 시 대피 후 격리 소화, 외부 기관(소방·군 경찰) 통보 절차 사전 정립.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 저장 실사 대장·점화원 점검표·불량탄 격리 기록·QD 평가서 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/defense/defense-defense-munitions-storage-magazine-safety-record.json`](../../../../../evidence-models/domains/industry/defense/defense-defense-munitions-storage-magazine-safety-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `DEFENSE-MUNITIONS-STORAGE-MAGAZINE-SAFETY-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 탄약 분류·NET, 호환성 그룹, 저장 한도·QD 거리, 점화원 점검 결과, 온습도 로그 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 방위사업법 Article 28
- 방위사업법 Article 53
- 총포·도검·화약류 등 단속법 Article 9
- 총포·도검·화약류 등 단속법 Article 23

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 방위사업법 | DAA | Defense Acquisition Act |
| 총포·도검·화약류 등 단속법 | FSESA | Act on the Safety Control of Firearms, Swords, Explosives, etc. |

## 7. 규제 참고사항 (Regulatory Notes)
방위산업 탄약 저장은 폭발물·화약류 안전(총포·도검·화약류 등 단속법/FSESA)과 방위산업 전문 안전관리(방위사업법/DAA)의 이중 규율을 받는다. FSESA Article 9(화약류 저장 허가·기준), Article 23(취급 기준)이 직접 적용되는 저장 기준 조문이며, DAA Article 28(방위산업 시설 안전), Article 53(안전관리 체계)이 산업 안전관리 상위 의무를 정한다. 참고: DAA Article 18은 2020.3.31 폐지되었으며(사전 compliance 보정에서 확인), 현재 안전관리 앵커는 Article 53이다. 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
방위산업은 원청사(메이커)와 다수 하도급 업체(탄약 수리·이동·저장 위탁, 시설 유지보수, 폐기물 처리)가 협업하므로 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사는 저장·이동·유지보수 협력업체에 본 워크플로우의 통제 조치(점화원 통제·호환성 분리·QD 준수 포함)를 하도급 단계까지 적용하고, 군수·보안 관련 출입 통제 요건과 안전 요건을 계약서에 명시해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
