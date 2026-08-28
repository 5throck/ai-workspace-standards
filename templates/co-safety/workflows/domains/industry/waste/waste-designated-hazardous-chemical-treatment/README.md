# 폐기물 산업 — 지정폐기물 유해화학물질 처리 (Waste Designated-Hazardous-Chemical Treatment) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 정제와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
지정폐기물(지정폐기물/지폐) 처리시설 — 중화(neutralization)·고화(solidification)·소각(incineration)·안정화(stabilization)·용제 회수 등 — 운영 시 발생하는 (a) 유해화학물질(중금속·유기용제·산알칼리) 흡입·접촉 노출, (b) 누출 사고 대응, (c) 화재/폭발 위해, (d) 처리시설 허가·운영 기준 준수를 통제 위계(hierarchy of controls)에 따라 체계적으로 관리한다. 한국은 연간 약 500만 톤의 지정폐기물을 발생시키며, 처리시설 작업자는 만성 화학 노출과 급성 누출 사고의 양쪽 위해에 동시 노출되는 대표적 고위험 집단이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36), 그리고 폐기물처리업 허가 의무(폐기물관리법 Article 25)와 사고대비물질 관리 의무(화학물질관리법 Article 23)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 폐기물 산업 전용 화학물질 처리·허가 절차이다. 소각로·파쇄기 설비 정비 LOTO는 `incinerator-shredder-loto` 워크플로우가, 하수처리장·맨홀 H₂S 질식 예방은 `sewage-confined-h2d-prevent` 워크플로우가 각각 담당한다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 폐기물 (코드: `waste`, 폐기물 처리·재활용·소각)
- **대상 작업**: 지정폐기물 반입 검수·시료 채취, 중화·고화·안정화 반응조 운전, 여과·탈수·건조 공정, 용제 회수·정제, 반응조·저장탱크 청소·정비, 누출 사고 대응·정화작업
- **적용 시점**: 신규 폐기물 스트림 반입, 처리 공정 변경, 반응조·저장탱크 진입 작업, 누출 경보 대응, 허가 갱신·관계기관 정기 점검

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 처리시설 위험성평가 주관, 화학물질 통제 계획 수립, 안전작업허가제 운영, 비상 대응 계획 |
| 산업보건관리자 (Industrial Hygienist) | 유해화학물질 개인 노출 샘플링, 작업환경측정, MSDS 적격성·보호구 선정 |
| 환경관리자 (Environmental Manager) | 폐기물관리법 Article 25 허가 조건 준수, 반입 폐기물 검수·성분 확인, 매니페스트 관리 |
| 화학안전관리자 (Chemical Safety Manager) | 화학물질관리법 Article 23 사고대비물질 관리계획서 작성·비치, 사고 대비 시나리오 수립 |
| 현장 감독자 (Supervisor) | 안전작업허가 승인, 반응조·탱크 진입 전 가스농도·PPE 점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 화학보호복·호흡보호구 착용, 허가 조건 준수, 누출·이상 시 대피·보고 |
| 설비 엔지니어 (Facility Engineer) | 국소배기환기(LEV)·스크러버·2차 방제 시설 가동 점검, 누출 감지 경보 시스템 점검 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 화학 노출·누출 사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 반입 폐기물 성분(중금속·유기용제·산알칼리·사고대비물질)별 노출 경로(흡입·접촉·삼킴), 반응조·저장탱크 화학 반응 위해, 누출 확산 경로를 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 폐쇄회로(Closed-loop) 자동 중화·고화 공정, 원격 조작 반응조 운전, 반입 폐기물 사전 성분 검수로 부적합 폐기물 거부.
   2. **엔지니어링 (Engineering)**: 밀폐형 반응조·저장탱크, 국소배기환기(LEV)·스크러버·활성탄 흡착, 자동 계량·투약 시스템, 2차 방제벽·유출 방지턱, 고정식 가스검지기(산·알칼리 증기·유기용제·LEL).
   3. **관리 조치 (Administrative)**: 폐기물관리법 Article 25 허가 조건 준수, 화학물질관리법 Article 23 사고대비물질 관리계획서 비치, MSDS 작성·제출(산업안전보건법 Article 110) 및 게시(Article 114), 안전작업허가서(화학/밀폐/화재), 반입 폐기물 성분 검수·매니페스트, 정기 작업환경측정·특수건강진단, 누출 대응 훈련.
   4. **PPE**: 화학보호복(산·알칼리용/유기용제용 구분), 정량밸브 호흡보호구(PAPR) 또는 송기마스크, 화학저항 장갑·보안경·안면보호구(최후 수단).
3. **사고대비물질 관리 (Accident-preparedness substance control)**: 처리시설이 화학물질관리법 Article 23의 사고대비물질을 취급하는 경우 관리계획서 작성·비치, 사고 대비 시나리오 수립, 관계기관 정기 보고. 폐기물관리법 Article 13(폐기물 처리 기준)과 연계.
4. **반입 검수 및 공정 운전 (Inbound assay and process control)**: 반입 폐기물 성분 사전 확인(시료 분석)으로 부적합·미확인 물질 거부, 반응조 투입 시 발열 반응·가스 발생 모니터링, 공정 변수(온도·pH·압력) 자동 감시.
5. **누출 사고 대응 (Leak-incident response)**: 누출 경보 시 해당 구역 차단, 2차 방제 시설 가동, 오염 구역 제한, 흡착제·중화제 투입, 작업자 대피. 대형 누출 시 소방기본법 Article 16(소방활동)에 따른 소방 출동 및 관계기관 통보. 사후 정화·폐기물 처리는 폐기물관리법 기준에 따름.
6. **비상 대응 (Emergency response)**: 화학 화재·폭발·대량 노출 사고 시 즉시 차단·대피·구조. 산화제·반응성 물질 화재 시 적용 소화제 한정(물 금지 등) — MSDS 기준 준수.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 매니페스트·안전작업허가서·가스검지 로그·작업환경측정 결과·사고대비물질 관리계획서·누출 사고 대응 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/waste/waste-waste-designated-hazardous-chemical-treatment-record.json`](../../../../../evidence-models/domains/industry/waste/waste-waste-designated-hazardous-chemical-treatment-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `WASTE-DESIGNATED-HAZARDOUS-CHEMICAL-TREATMENT-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 처리시설 허가 번호·반입 폐기물 성분(중금속·용제·산알칼리·사고대비물질) 분석 결과·반응조 ID·누출 사고 이력·가스검지 알람 이력·MSDS 참조 등 산업 고유 필드를 정의.

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
폐기물 처리는 폐기물관리법(WCA)이 주법으로, 처리 기준(Art 13)과 폐기물처리업 허가·운영(Art 25)을 규율한다. 인접 통제 앵커: 소방기본법(BFS — 화학 화재/폭발 대응 시 소방 활동의 근거, Art 16), 화학물질관리법(CCA — 사고대비물질 관리계획서·사고 대비 의무, Art 23). **주의 — CCA vs ARECA 교정**: 본 워크플로우의 `schema.yaml` legal_basis는 `화학물질관리법 Article 23`(CCA, 사고대비물질)을 인용한다. 이는 `화학물질의 등록 및 평가 등에 관한 법률`(ARECA/K-REACH)과는 다른 별개의 법령이다. 지정폐기물 처리시설이 다루는 사고대비물질(중금속 슬러지·산폐액 등)의 화학사고 대비·대응 의무는 CCA Art 23이 자연 앵커이며, 이 교정 인용은 compliance-agent가 실시간 MCP 검증으로 확정했다. 산업안전보건법(OSHA-KR)은 위험성평가(Art 36)·사고 기록(Art 57)·MSDS(Art 110 계열)·작업환경측정·특수건강진단 의무의 일반 근거이다.

## 8. 외주 안전 안내 (Outsourcing Note)
지정폐기물 수집·운반·처리 위탁은 다단계 도급 구조(배출사업장 → 운수업자 → 처리시설)로, 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(배출사업장 또는 처리시설 운영사)는 운수업자 및 하도급 처리업체에 폐기물관리법 Article 25 허가 조건 준수·사고대비물질 취급 안전조치·MSDS 비치·누출 대응 절차를 하도급 단계까지 적용하도록 해야 한다. 운수 중 사고는 운수업자, 처리 중 사고는 처리시설이 각각 안전보건 확보 의무를 부담한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
