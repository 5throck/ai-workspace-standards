# 제철 산업 — 코크스로 PAH 발암물질 노출 및 노정 열스트레스 (Steelmaking Coke-Oven PAH Heat-Stress) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 정제와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
통합제철소 코크스로(coke-oven battery) 작업 — 석탄 충전(charging), 코크스 압출(push), 노정(oven-top) 보온·누출 점검, 레벨링(leveling), 도어(door) 청소 및 내화물 보수 — 에서 발생하는 (a) 코올타르피치 휘발성 유기화합물(PAH, IARC Group 1 발암물질) 흡입 노출, (b) 노정 극고온 복사열 열스트레스, (c) 코크스로 가스(CO·H₂·CH₄) 누출·화재·폭발 위해를 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 코크스로 작업자는 국제적으로 암 발생이 추적되는 집단(IARC 모노그래프)이며, 한국 통합제철소(POSCO 포항·광양, 현대제철 당진 등)의 코크스 배터리 노정은 대표적 고위험 작업면이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 제철 산업 전용 산업보건·화재/폭발 절차이다. 부생가스 배관 누출 설비 점검은 `byproduct-gas-leak-prevent` 워크플로우가, 가열로·용융물 정비 LOTO는 `molten-metal-loto` 워크플로우가 각각 담당한다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 제철 (코드: `steelmaking`, 통합제철소 — 고로·제강·압연 일관공정)
- **대상 작업**: 코크스로 배터리 노정 작업(충전·압출·레벨링·점검), 코크스로 도어 개폐·청소, 내화물 보수·랜스 작업, 코크스로 가스 집배관·밸브 점검, 석탄·코크스 야드 핸들링 중 PAH 비산 구역 작업
- **적용 시점**: 코크스로 가동 중 정기 점검, 교대 인수인계, PAH·가스 알람 대응, 신규 석탄 타입 도입 및 배터리 노후화 평가, 폭염기 열스트레스 위험증가

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 코크스로 위험성평가 주관, PAH·열스트레스 통제 계획 수립, 안전작업허가제 운영, 비상 대응 계획 |
| 산업보건관리자 (Industrial Hygienist) | 코올타르피치·PAH 개인 노출 샘플링, 작업환경측정 결과 해석, 호흡보호구 적격성 판정 |
| 보건관리자 (Occupational Physician) | 코크스로 작업자 특수건강진단(발암물질 노출) 계획·이상 소견자 추적관리 |
| 현장 감독자 (Supervisor) | 안전작업허가 승인, 노정 진입 전 가스농도·열스트레스 지수 점검, 이상 시 작업 중지 |
| 작업자 (Worker) | 호흡보호구·열보호복 착용, 허가 조건 준수, 가스·온도 알람 시 대피·보고 |
| 설비 엔지니어 (Facility Engineer) | 코크스로 가스 포집·환기 설비, 냉각·열차폐 설비, 가스검지 경보 시스템 가동 상태 점검 |
| 산업보건위원회 (Industrial Health & Safety Committee) | PAH 노출 사후 검토, 암 발생 사례 역학 조사 협력, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 코크스로 배터리별 PAH 발생 원천(충전·압출·도어 누출), 노정 복사열 온도·WBGT 지수, 코크스로 가스(CO·H₂·CH₄) 누출 가능 영역을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 신설 배터리 설계 단계에서 무인 밀폐 충전(back-pressure-charged sealed ovens), 기계화 압출·레벨링 채택, 노정 무인화.
   2. **엔지니어링 (Engineering)**: 국소 배기 환기(LEV)·활성탄 흡착, 도어 래핑(lapping)·가스 밀봉, 열차폐 스크린·냉각 송풍, 고정식 가스검지기(CO·LEL) 연속 모니터링, 자동 차단 밸브.
   3. **관리 조치 (Administrative)**: 안전작업허가서(화재/화학/고온), 교대 TBM, 노정 체류시간 최소화(작업·휴식 사이클), 폭염기 열순화 적응 프로그램, 정기 작업환경측정(벤조[a]피렌 등) 및 특수건강진단(발암물질). 본 모니터링은 위험성평가(Art 36)와 안전확보 의무(SAPA Art 4)의 이행 조치.
   4. **PPE**: 유기용제/PAH용 정량밸브 호흡보호구(PAPR) 또는 송기마스크, 내열복·열차폐 복장, 보호장갑·안면보호구(최후 수단).
3. **코크스로 가스 누출 통제 (Coke-oven gas leak control)**: CO/LEL 알람 시 해당 구역 즉시 차단, 환기 풍량 최대 가동, 점화원 제거, 작업자 대피. 고압가스 안전관리 및 사업법 Article 13(시설·용기의 안전유지), Article 26(사고 통보)과 연계. 사후 가스 농도 측정 후 복구 작업 진행.
4. **노정 열스트레스 관리 (Heat-stress management)**: 폭염·고복사열 조건에서 노정 작업 시 WBGT 측정, 작업·휴식 사이클 적용, 시원한 음료·휴식 공간 제공, 열사병 초기 증상 모니터링. 위험성평가(Art 36)의 현장 적용.
5. **PAH 노출 모니터링 (PAH exposure monitoring)**: 개인 시료채취(펌프+필터) 정기 실시, 벤조[a]피렌 등 발암 PAH 정량 분석, 노출 등급 분류, 초과 시 원천(도어 누출·충전 분진) 개선. 특수건강진단(피부·호흡기·방광)과 연계.
6. **비상 대응 (Emergency response)**: 코크스로 화재·가스 폭발·대량 PAH 노출 사고 시 즉시 차단·대피·구조. 코크스로 가스는 점화원 제거 후 희석; 화재 시 밀폐·질소 퍼징 또는 특수 소화 적용.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·가스검지 로그·작업환경측정 결과·특수건강진단 결과·노정 체류시간 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-coke-oven-pah-heat-stress-record.json`](../../../../../evidence-models/domains/industry/steelmaking/steelmaking-steelmaking-coke-oven-pah-heat-stress-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `STEELMAKING-COKE-OVEN-PAH-HEAT-STRESS-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 코크스로 배터리 ID·노정 체류시간·PAH(벤조[a]피렌) 농도·WBGT 지수·가스검지 알람 이력·특수건강진단 결과 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Dangerous Substances Safety Management Act |

## 7. 규제 참고사항 (Regulatory Notes)
단일 전속 제철 안전 법령은 없다. 복합 통제 앵커: 산업안전보건법(OSHA-KR — 위험성평가·안전조치·추락(Art 38 + OSHSR 추락·붕괴·전기기준), 작업환경측정 및 특수건강진단 의무의 일반 근거), 고압가스 안전관리 및 사업법(HPGSCA — 코크스로 가스 집배관·저장 시설의 안전관리규정(Art 11)·시설 안전유지(Art 13)·안전관리자 선임(Art 15)·시정조치(Art 24)·사고 통보(Art 26)), 위험물안전관리법(DSSMA — 석탄·코크스·코올타르류 위험물 저장·취급 기준(Art 5) 및 응급조치·조치명령(Art 27)). 코크스로 PAH 산업보건 통제는 개념적으로 OSHA-KR 작업환경측정(Art 125 계열) 및 특수건강진단(Art 130 계열)이 자연 앵커이나, 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 자동 채움 앵커 조합을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
코크스로 내화물 보수·랜스 작업·도어 정비는 내화물 전문 시공사에 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사(제철소)는 내화물 및 보수 전문 시공사에 본 워크플로우의 통제 조치(PAH 노출 모니터링·열보호구·가스검지 대피 절차)를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
