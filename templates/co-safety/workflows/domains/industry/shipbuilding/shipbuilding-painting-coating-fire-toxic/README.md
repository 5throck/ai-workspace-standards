# 조선 산업 — 도장/코팅 작업 화재·독성 워크플로우 (Shipbuilding Painting/Coating Fire & Toxic)

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 확장과 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
선박 도장·코팅 작업 시 발생하는 **가연성 도료 증기 폭발(LEL 인화 폭발)**, **유기용제(solvent vapor) 흡입 노출**, **밀폐구역 도장 산소결핍**, **도장베이(paint bay) 화재** 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 도장 작업은 한국 조선업 치명 사고의 대표적 원인으로, 2015년 삼성중동 해양 4만t급 드릴십 도장반 화재, 2019년 현대중공업 도장 작업 중 화재 등 대형 참사가 반복되어 왔다. 도장 작업은 가연성 용제(자일렌·톨루엔·메틸에틸케톤 등) 증기가 폭발 하한선(LEL)에 도달하면 정전기·불꽃 점화원 하나로 대형 폭발·화재로 이어지며, 만성적으로는 유기용제 증후증·신경독 노출을 유발한다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 조선 산업 전용 도장/코팅 안전 절차이다. 크레인 인양(`heavy-crane-subcontractor-safety`), 선박 탱크 밀폐공간 진입(`ship-tank-confined-space`), 용접 흄(`shipbuilding-welding-fume-gas-safety`)과 구별되며, 특히 **도장베이/도장 샵(paint bay/shop)** 시설 내 도장 작업에 특화되어 탱크 내부 도장과 범위를 명확히 구분한다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 조선 (코드: `shipbuilding`, 선박 건조·수리)
- **대상 작업**: 도장베이·도장 샵(paint bay/shop) 내 블록·선체 도장, 코팅 작업(spray/roller/brush), 표면처리(샌드블라스트·그릿), 도료·신너 배합·운반, 도장 설비 세척·정비, 건조실·경화실 운전
- **적용 범위 제외**: 화물·밸러스트 탱크 내부 도장은 `ship-tank-confined-space`의 밀폐공간 진입 절차와 본 워크플로우의 화재·화학 통제가 중첩 적용된다. 본 워크플로우는 도장베이/샵 시설 내 작업을 1차 범위로 한다.
- **적용 시점**: 도장 작업허가(PTW) 발행 전 환기·가스검지 점검, 비정상 가스농도 알람 대응, 신규 도료·신너 도입, 작업자 교대 인수인계

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 도장 작업 위험성평가 주관, 안전작업허가제(PTW·화기취급) 운영, 비상 대응 계획 수립, 작업환경측정 결과 검토 |
| 도장 작업 책임자 (Painting Supervisor) | 환기·가스검지 상태 확인, 작업허가 승인, 진입 전 교차점검, 가스 농도 이상 시 작업 중지 |
| 산업위생 관리자 (Industrial Hygienist) | 유기용제 노출 평가, 작업환경측정, MSDS 확인, 호흡보호구 적격성 판정 |
| 도장 작업자 (Painter) | 송기마스크·호흡보호구 착용, 환기·가스검지 상태 준수, 정전기 제거 조치 이행 |
| 설비 엔지니어 (Facility Engineer) | 도장베이 환기·가스검지·소화 설비·폭발방전 전기 설비 가동 상태 점검 |
| 외주 도장업체 안전관리자 (Contractor Safety Officer) | 원청사와의 안전작업허가 연동, 하도급 작업자 교육·보호구 지급 상태 확인 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 도장 작업 사고·근접사고·직업성 질환 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 취급 도료·신너의 인화점·증기압·허용농도(TWA/STEL), 작업 공간 환기 용량, 점화원(정전기·전기·화기) 존재, MSDS 성분 프로파일을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 수성 도료·저VOC 도료로 대체, 도장 영역을 화기 작업(용접/절단) 영역과 물리적 분리.
   2. **수동 방호 (Passive)**: 도장베이 격벽·방화문, 국소 배기(local exhaust ventilation), 자동 소화 설비(sprinkler/inert gas), 폭발방전 전기 설비.
   3. **능동 방호 (Active)**: 가스농도(LEL) 연속 감시 경보, 환기 설비 고장 인터록, 정전기 제거 장치.
   4. **관리 조치 (Administrative)**: 안전작업허가서(화기/도장), 교대 TBM, 환기 가동 후 작업 개시, 화기 작업 동시 병행 금지.
   5. **PPE**: 송기마스크(supplied-air respirator)·유기가스용 반면마스크, 화학보호복, 안면보호구, 정전기 제거화(최후 수단).
3. **가연성 증기 통제 (Flammable vapor LEL control)**: 환기 가동 후 작업 전·중 LEL 가스농도 측정, LEL 25% 도달 시 작업 중지, 점화원(전기·화기·정전기) 통제. 위험물안전관리법 Article 5(위험물 저장·취급)과 연계.
4. **유기용제 노출 통제 (Solvent vapor exposure control)**: 국소 배기장치 가동, 작업환경측정, 송기마스크 착용, MSDS 기반 허용농도 준수. 산업안전보건법 Article 110(물질안전보건자료 작성·제출)과 연계.
5. **밀폐구역 산소결핍 통제 (Confined-area O2 deficiency)**: 탱크·블록 내부 도장 시 사전 산소농도(19.5~23.5%)·가스농도 측정, 환기, 구조 감시자 외부 배치. 산업안전보건법 Article 38(추락·접근 통제) 및 산업안전보건법 OSHSR 제6장(붕괴·구조물 안전)과 연계.
6. **정전기·점화원 통제 (Static/ignition-source control)**: 도장베이 내 모든 전기 설비 폭발방전 등급(Ex), 작업자 정전기 제거 매트·접지, 화기 작업 동시 금지. 산업안전보건법 안전보건기준에관한규칙(감전·화기 위험)과 연계.
7. **화재·폭발 비상 대응 (Fire/explosion emergency response)**: 가스 알람·화재 감지 시 즉시 작업 중지·전원 차단·대피·소화 설비 작동, 외부 소방 통보 절차 사전 정립. 위험물안전관리법 Article 27(응급조치)과 연계.
8. **고압가스 설비 통제 (High-pressure gas facility control)**: 무기 질소·이산화탄소 불활성 가스(inert gas) 사용 시 고압가스 안전관리 및 사업법 Article 11(안전관리규정), Article 13(시설·용기의 안전유지), Article 15(안전관리자 선임), Article 24(허가관청 등의 조치), Article 26(사고 통보)과 연계.
9. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·가스농도 측정 로그·작업환경측정 결과·MSDS 비치 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-painting-coating-fire-toxic-record.json`](../../../../../evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-painting-coating-fire-toxic-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `SHIPBUILDING-PAINTING-COATING-FIRE-TOXIC-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 취급 도료 종류·인화점·허용농도, LEL 측정값, 환기 용량, 가스검지 알람 이력, 송기마스크 착용 상태, inert gas 사용 여부 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다. HPGSCA 인용은 remediated 조문(Article 11/13/15/24/26)을 사용한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27
- 고압가스 안전관리 및 사업법 Article 11
- 고압가스 안전관리 및 사업법 Article 13
- 고압가스 안전관리 및 사업법 Article 15
- 고압가스 안전관리 및 사업법 Article 24
- 고압가스 안전관리 및 사업법 Article 26

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 고압가스 안전 관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |

## 7. 규제 참고사항 (Regulatory Notes)
선박 도장/코팅 작업을 전속 규율하는 단일 법령(조선 안전법)은 존재하지 않는다. 복합 통제 앵커: 위험물안전관리법(DSSMA — 가연성 도료·신너 등 위험물 저장·취급 Article 5, 응급조치 Article 27), 고압가스 안전 관리 및 사업법(HPGSCA — inert gas·분사 가스 설비, 안전관리규정 Article 11, 시설·용기의 안전유지 Article 13, 안전관리자 선임 Article 15, 허가관청 등의 조치 Article 24, 사고 통보 Article 26), 산업안전보건법(OSHA-KR — 도장 근로자 안전, 추락 Article 38, 붕괴 OSHSR 제6장, 감전·화기 안전조치 Article 38 + 규칙, MSDS 작성·제출 Article 110 + 게시·교육 Article 114). 중대재해처벌법(SAPA) Article 4~7은 사업주 안전보건 확보 의무의 일반적 근거이다. **HPGSCA 인용 주의**: `schema.yaml`의 HPGSCA 인용(Art 11/13/15/24/26)은 compliance-agent가 실시간 MCP `legalize_kr`(law.go.kr 원문, 권위 있음) 검증을 거친 **remediated 조문**이다 — 기존 앵커가 삭제 조문인 Art 14(1999.2.8 삭제)와 주제 불일치 Art 17/28을 인용하던 것을, `legalize_kr`에서 Art 11/13/15/24/26이 실효 조문임을 확인하여 정정하였다. 참고로 `kr_safety` 카탈로그는 HPGSCA에 대해 stale하여 삭제된 Art 14를 여전히 인덱싱하므로, HPGSCA 검증 시에는 `k-law 스킬(법제처 Open API)을 우선한다. 본 워크플로우의 핵심 차별점은 **도장베이/샵 시설의 LEL 인화 폭발 + 만성 용제 노출**이라는 복합 위해로, 탱크 내부 진입 질식(`ship-tank-confined-space`)과 범위가 구별된다.

## 8. 외주 안전 안내 (Outsourcing Note)
조선소 도장·코팅 작업은 외주 도장 전문업체 비중이 압도적으로 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 한국 조선업의 대형 도장 화재 참사 다수가 외주 도장반 작업 중 발생했다. 원청사(조선소)는 외주 도장업체에 본 워크플로우의 환기·가스검지·정전기 통제·송기마스크 지급·안전작업허가 연동을 하도급 단계까지 적용하도록 해야 하며, 다수 외주업체가 동일 도장베이를 교차 사용할 때 작업 범위 중첩·화기 작업 동시 금지 책임 소재를 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
