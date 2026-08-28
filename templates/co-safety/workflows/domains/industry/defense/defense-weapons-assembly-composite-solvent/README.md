# 방위 산업 — 무기 체계 조립 복합재·유기용제 (Weapons Assembly Composite Solvent) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
방위산업 무기 체계(미사일·항공기·발사체 등)의 복합재(composite) 부품 조립·접착·코팅 공정에서 사용되는 유기용제(메틸렌클로라이드·스티렌·MEK·아세톤 등)와 프리프레그(prepreg) 수지의 흡입 노출·화재·폭발·피부 흡수 위해요인을 통제 위계에 따라 체계적으로 예방한다. 밀폐 조립구역·오토클레이브 인근에서의 용제 증기는 인화성·독성(발암·신경독성)을 동시에 지니며, 복합재 분진은 가연성 분진으로 거동한다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 방위 산업 전용 복합재·유기용제 안전 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 방위 (코드: `defense`, 방위산업 제조)
- **대상 작업**: 복합재 부품 적층·성형(오토클레이브·프리프레그 취급), 접착·코팅·도장, 용제 혼합·세정, 밀폐구역(탱크·동체 내부) 작업, 분쇄·가공·엣지 트리밍, 폐용제 회수·저장
- **적용 시점**: 신규 용제·수지 도입, 밀폐구역 진입, 국소배기장치(LEV)·방폭 설비 점검, 용제 누출·분진 비산 알람

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 화학물질·화재·밀폐공간 위험성평가 주관, 안전작업허가제 운영 |
| 산업보건관리자 (Industrial Hygienist) | 용제 증기·복합재 분진 농도 측정, 호흡보호구·보호장갑 적격성 평가, 국소배기장치 성능 점검 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 밀폐공간 진입 허가 승인, 환기·방폭 설비 사전 점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 호흡보호구·보호장갑 착용, LEV 정상 가동 확인, 용제 취급·정전기 통제 절차 준수 |
| 설비 엔지니어 (Facility Engineer) | LEV·방폭 전기·정전기 접지·폭발Venting 설비 점검·유지, 오토클레이브 안전장치 관리 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 화학 노출·화재·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 사용 용제의 인화점·폭발한계(LEL/UEL)·독성(발암·신경독성)·피부흡수성, 복합재 분진의 가연성(MIE·Kst), 밀폐구역 여부, 점화원(정전·마찰·화염)을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 저독성·불연성 대체 용제, 수성 도료 전환, 밀폐 자동화 공정.
   2. **수동 방호 (Passive)**: 밀폐 혼식·이송, 국소배기장치(LEV), 방폭 전기·폭발Venting, 절연 매트.
   3. **능동 방호 (Active)**: 가스검지(LEL 25% 경계·10% 작업중지)·연속 모니터링, 자동 차단.
   4. **관리 조치 (Administrative)**: 밀폐공간 작업허가서, 작업환경측정, 교대 TBM, 호흡보호구 프로그램.
   5. **PPE**: 유기용제용 호흡보호구(유기용제 카트리지/PAPR)·화학보호장갑·보안경·내화복(최후 수단).
3. **밀폐공간 통제 (Confined-space control)**: 동체·탱크 내부 진입 전 가스농도 측정(산소·LEL·독성가스), 환기·구조 대기조 설정, 출입 통제, 책임자-작업자-감시자 3인 체계 운영.
4. **가연성 증기·분진 통제 (Flammable vapor & dust control)**: 용제는 LEV 하에서 취급, 정전기 접지·본딩, 방폭 전기 설비, 복합재 분진은 집진(HEPA)·비산 억제. 위험물안전관리법과 산업안전보건법 유해화학물질 기준 병행.
5. **독성 노출 통제 (Toxic exposure control)**: 메틸렌클로라이드(발암 추정)·스티렌·MEK 등에 대한 노출 기준 준수, 산업안전보건법 Article 57(작업환경측정), 보호장갑(화학물질 투과 시간 고려) 적격성 평가.
6. **비상 대응 (Emergency response)**: 용제 화재 시 적합 소화제(포·분말·이산화탄소, 물 사용 제한) 사용, 밀폐구간 내 작업자 이상 시 구조·대피 절차, 피부·안구 노출 시 세척·의료 처치 절차 사전 정립.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 작업환경측정 결과·밀폐공간 허가서·용제 사용량 대장·집진설비 점검표 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/defense/defense-defense-weapons-assembly-composite-solvent-record.json`](../../../../../evidence-models/domains/industry/defense/defense-defense-weapons-assembly-composite-solvent-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `DEFENSE-WEAPONS-ASSEMBLY-COMPOSITE-SOLVENT-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 사용 용제 종류·사용량, 밀폐공간 가스측정 결과, LEV 성능, 작업환경측정 결과, 호흡보호구·장갑 적합성 등 산업 고유 필드를 정의.

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
무기 체계 조립·복합재·유기용제 작업은 화약류 안전(총포·도검·화약류 등 단속법/FSESA)과 방위산업 안전관리(방위사업법/DAA) 상위 의무 하에 규율된다. 단, 유기용제·가연성 분진 그 자체의 노출·화재 통제는 산업안전보건법(OSHA-KR)의 유해화학물질·밀폐공간·작업환경측정 기준이 직접적으로 밀접하다. 참고: DAA Article 18은 2020.3.31 폐지되었으며(사전 compliance 보정에서 확인), 현재 안전관리 앵커는 Article 53이다. 본 워크플로우의 `schema.yaml` legal_basis는 방위 산업 복합 앵커 조합(자동 채움)을 사용하며, 용제 화학물질 상세 기준은 OSHA-KR 하위 규정이 보완한다.

## 8. 외주 안전 안내 (Outsourcing Note)
방위산업 무기 체계는 원청사(시스템 통합업체)가 수많은 하도급(복합재 부품·도장·조립·설비 유지보수)과 협력하므로 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사는 복합재·도장·설비 청소(밀폐공간 진입) 하도급 업체에 본 워크플로우의 통제 조치(밀폐공간 진입·정전기 통제·유해용제 노출 통제 포함)를 하도급 단계까지 적용하고, 군수 보안 요건과 안전 요건을 계약서에 명시해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
