# 폐기물 산업 — 매립지 메탄 폭발 및 혐기소화 (Waste Landfill Methane / Anaerobic-Digestion Explosion) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 정제와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
매립지(landfill) 및 혐기소화(anaerobic digestion, AD) 시설에서 발생하는 (a) 메탄(CH₄) 가스 폭발 한계(LEL) 관리, (b) 침출수(leachate) 화학적 위해, (c) 사면(slope) 붕괴, (d) 매립지 화재 소방 대응 위해를 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 한국의 수도권 매립지는 세계 최대 규모(부피 기준)이며, 매립지 내 혐기 분해로 발생하는 메탄은 대기 중 LEL 5% 도달 시 폭발 위해가 있고 지중 이주(subsurface migration)로 인접 구조물 폭발 사고의 원인이 된다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36), 폐기물처리업 허가 의무(폐기물관리법 Article 25)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 폐기물 산업 전용 메탄/혐기소화 대기 위해 관리 절차이다. 소각로·파쇄기 설비 정비 LOTO는 `incinerator-shredder-loto` 워크플로우가, 하수처리장·맨홀 H₂S 질식 예방은 `sewage-confined-h2d-prevent` 워크플로우가 각각 담당한다(본 워크플로우는 CH₄ 대기 위해 관리 — H₂S 질식과는 위해 발생机制이 다름).

## 2. 적용 범위 (Scope)
- **대상 산업**: 폐기물 (코드: `waste`, 매립·혐기소화 처리)
- **대상 작업**: 매립 셀(cell) 운영·일일 복토, 가스 추정·모니터링, 가스 포집·플레어(flare)·활용 설비 운전, 침출수 수집·처리, 사면 안정성 점검, 혐기소화 탱크·발전설비 운전·정비, 매립지 화재 대응
- **적용 시점**: 신규 매립 셀 착공, 가스 추정량 급변, LEL 알람 대응, 침출수 누출, 사면 침하/균열 발생, 지진·집중호우 사후 점검, 혐기소화 탱크 세정·진입 작업

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 매립지·AD 시설 위험성평가 주관, 메탄·침출수 통제 계획 수립, 안전작업허가제 운영, 비상 대응 계획 |
| 환경관리자 (Environmental Manager) | 폐기물관리법 Article 25 허가 조건 준수, 매립가스 발생량 모니터링, 침출수 처리 기준 유지 |
| 시설 엔지니어 (Facility Engineer) | 가스 추정정(well)·플레어·가스 활용 설비 가동 점검, LEL 가스검지기망 점검, 사면 안정·차수막(liner) 상태 점검 |
| 화재/비상 대응 책임자 (Fire/Emergency Coordinator) | 매립지 화재 대응 계획, 소방서 연동 훈련, 소방기본법 Article 16(소방활동) 기반 대응 지휘 |
| 현장 감독자 (Supervisor) | 안전작업허가 승인, 혐기소화 탱크·매립 셀 진입 전 LEL·산소 농도 점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 개인용 가스모니터 착용, 화류·정전기 점화원 통제, 허가 조건 준수, 알람 시 대피·보고 |
| 운반/야적 관리자 (Yard Manager) | 사면 안정성 확보를 위한 적치 기준·복토 준수, 중장비 운행 통제 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 메탄 폭발·사면 붕괴·화재 사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 매립지 구역·AD 탱크별 메탄 발생량·지중 이주 경로, 침출수 화학 성분, 사면 안정성(사면각·지하수위), 점화원(중장비·정전기·화류)을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 공학적 차수막(geomembrane liner)·침출수 수집 시스템으로 지중 이주 원천 차단, 가스 포집·플레어 시스템으로 메탄 농도 사전 저감, 능동 수동 소기 설비.
   2. **엔지니어링 (Engineering)**: 가스 추정정(well)망·플레어·가스-엔진 발전 설비, 지표/지중/건물 내 LEL 가스검지기망, 사면 안정 공법(제방·다단 경사), 침출수 누출 감지 시스템, 방폭 전기 설비.
   3. **관리 조치 (Administrative)**: 폐기물관리법 Article 25 허가 조건 준수, 소방기본법 Article 16 기반 매립지 화재 대응 계획, 화학물질관리법 Article 23(사고대비물질 — 혐기소화 시설 포함) 관리계획서 비치, 안전작업허가서(밀폐/화재/중장비), 교대 TBM, 화류 통제(금연·용접 허가제), 정기 가스 농도 측정.
   4. **PPE**: 개인용 다중 가스모니터(CH₄/LEL/O₂/H₂S), 화류 작업 시 난연복, 호흡보호구(혐기소화 탱크 진입 시), 안전모·안전화(최후 수단).
3. **메탄 LEL 통제 (Methane LEL control)**: 지표/지중/인접 구조물 가스 농도 연속 모니터링, LEL 25% 도달 시 인원 대피·환기 강화·점화원 제거, 플레어·가스 추출 시스템 가동으로 농도 저감. 폐기물관리법 Article 13(폐기물 처리 기준), 소방기본법 Article 16(화재/폭발 대응)과 연계.
4. **침출수 통제 (Leachate control)**: 침출수 수집·처리 계통 가동 점검, 누출 감지 시 확산 방지·정화 작업, 침출수 화학 성분 정기 분석. 위험성평가(Art 36)·안전조치(Art 38)의 현장 적용.
5. **사면 안정 통제 (Slope-stability control)**: 매립 셀 사면각·일일 복토 기준 준수, 집중호우·지진 후 침하·균열 점검, 중장비 접근 제한. 안전보건기준에관한규칙 제6장 제2절(붕괴 방지)과 연계.
6. **매립지 화재 대응 (Landfill-fire response)**: 매립지 화재 시 추가 산소 공급 최소화(복토 확대), 플레어 가동 중지(역화 방지), 소화재 선정(물분무·불활성 가스), 소방서 연동. 소방기본법 Article 16(소방활동)에 따른 대응. 심층 화재(deep-seated fire)는 장기 소화·냉각 계획 수립.
7. **비상 대응 (Emergency response)**: 메탄 폭발·사면 붕괴·대량 침출수 누출 사고 시 즉시 대피·구조·관계기관 통보. 혐기소화 탱크 진입 시 밀폐공간 작업 허가(산소·가스 농도 사전 측정).
8. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 가스 농도 측정 로그·침출수 분석 결과·사면 점검 기록·안전작업허가서·화재 대응 훈련 기록·사고·근접사고 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/waste/waste-waste-landfill-methane-anaerobic-explosion-record.json`](../../../../../evidence-models/domains/industry/waste/waste-waste-landfill-methane-anaerobic-explosion-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `WASTE-LANDFILL-METHANE-ANAEROBIC-EXPLOSION-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 매립 셀 ID·가스 발생량·LEL 측정값(지표/지중/인접 구조물)·침출수 화학 성분·사면 안정 점검 결과·플레어/가스 활용 설비 가동 이력·화재 대응 훈련 이력 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 폐기물관리법 Article 13
- 폐기물관리법 Article 25
- 소방기본법 Article 16
- 화학물질관리법 Article 23

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 폐기물관리법 | WCA | Wastes Control Act |
| 소방기본법 | BFS | Basic Fire Services Act |
| 화학물질관리법 | CCA | Chemicals Control Act (사고대비물질 — accident-preparedness substances) |

## 7. 규제 참고사항 (Regulatory Notes)
폐기물 매립·혐기소화는 폐기물관리법(WCA)이 주법으로, 처리 기준(Art 13)과 폐기물처리업 허가·운영(Art 25)을 규율한다. 인접 통제 앵커: 소방기본법(BFS — 매립지 화재/메탄 폭발 소방 대응의 자연 앵커, Art 16), 화학물질관리법(CCA — 사고대비물질 관리계획서·사고 대비 의무, Art 23; 혐기소화 시설이 사고대비물질을 다루는 경우 해당). **주의 — CCA vs ARECA 교정**: 본 워크플로우의 `schema.yaml` legal_basis는 `화학물질관리법 Article 23`(CCA, 사고대비물질)을 인용한다. 이는 `화학물질의 등록 및 평가 등에 관한 법률`(ARECA/K-REACH)과는 다른 별개의 법령이다. 매립지·혐기소화 시설의 메탄·사고대비물질 화학사고 대비·대응 의무는 CCA Art 23이 자연 앵커이며, 이 교정 인용은 compliance-agent가 실시간 MCP 검증으로 확정했다. 산업안전보건법(OSHA-KR)은 위험성평가(Art 36)·사고 기록(Art 57)·붕괴 방지(Art 100) 의무의 일반 근거이다. 기존 `incinerator-shredder-loto`의 "바이포가스 폭발"이 소각로/열분해 설비 내 바이포가스를 다루는 반면, 본 워크플로우는 매립지 대기 중 메탄(지중 이주·심층 화재)이라는 물리적으로 구별되는 위해를 다룬다.

## 8. 외주 안전 안내 (Outsourcing Note)
매립지·혐기소화 시설 운영은 폐기물 운반업자, 침출수 처리 O&M 업체, 가스 추정·플레어 설비 운전사, 중장비 임대·운영 업체 등 다단계 도급 구조를 가지며, 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(매립지 운영사)는 운반·설비 O&M·중장비 하도급 업체에 본 워크플로우의 통제 조치(LEL 모니터링·화류 통제·점화원 관리·밀폐공간 진입 절차·사면 안정 기준)를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
