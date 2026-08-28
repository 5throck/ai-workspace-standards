# 조선 산업 — 용접 흄·가스 안전 워크플로우 (Shipbuilding Welding Fume/Gas Safety)

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 확장과 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
선박 건조·수리 중 용접·절단 작업 시 발생하는 **용접 흄(Mn·Cr6+·오존 등) 만성 흡입 노출**, **고압가스 실린더(산소·아세틸렌·아르곤·이산화탄소) 취급·가스 누출**, **용접 아크 감전·화상** 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 조선소는 한국 산업계에서 가장 많은 용접 인구를 보유한 작업장으로, 용접 흄은 IARC Group 1 발암물질로 분류되어 망간(Mn) 신경독증·육가크롬(Cr6+) 폐암·오존 폐손상을 유발한다. 고압가스 실린더 취급 부주의는 가스 누적·폭발로 이어지며, 용접 아크의 고전압은 감전·화상 사고를 유발한다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 조선 산업 전용 용접/절단 흄·가스 안전 절차이다. 크레인 인양(`heavy-crane-subcontractor-safety`), 선박 탱크 밀폐공간(`ship-tank-confined-space`), 도장 화재·독성(`shipbuilding-painting-coating-fire-toxic`)과 구별된다 — 용접 흄은 고체 입자상 물질 + 오존 + 자외선이며, 도장 증기는 액체 용제 + LEL 인화성으로 화학적·물리적 위해 프로파일이 다르다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 조선 (코드: `shipbuilding`, 선박 건조·수리)
- **대상 작업**: 블록 탑재·선체 조립 용접, 아크 용접(SMAW/FCAW/GMAW), 가스 용접·절단(산소·아세틸렌), 플라즈마 절단, 용접부 그라인딩·연마, 용접 가스 실린더 운반·연결·저장, 밀폐구역(탱크·블록 내부) 용접
- **적용 시점**: 용접 작업허가(PTW) 발행 전 환기·가스 검지 점검, 작업환경측정 주기, 신규 용접재·가스 도입, 작업자 교대 인수인계, 특수 건강진단 주기

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 용접 작업 위험성평가 주관, 안전작업허가제(PTW) 운영, 작업환경측정·특수건강진단 결과 검토, 비상 대응 계획 수립 |
| 용접 작업 책임자 (Welding Supervisor) | 환기·가스검지 상태 확인, 작업허가 승인, 진입 전 교차점검, 가스 누출·아크 이상 시 작업 중지 |
| 산업위생 관리자 (Industrial Hygienist) | 용접 흄(Mn·Cr6+)·오존 노출 평가, 작업환경측정, 특수건강진단 주관, 호흡보호구 적격성 판정 |
| 용접작업자 (Welder) | 송기마스크·호흡보호구·용접면 착용, 환기·가스검지 상태 준수, 실린더 고정·접지 이행 |
| 가스 안전 관리자 (Gas Safety Officer) | 고압가스 실린더 저장·운반·연결 통제, 가스 누출 점검, HPGSCA 기반 시설 점검 |
| 전기안전관리자 (Electrical Safety Manager) | 용접기 접지·절상·인터록 점검, 용접 케이블 손상 확인, 감전 보호 장치 가동 상태 점검 |
| 외주 용접업체 안전관리자 (Contractor Safety Officer) | 원청사와의 안전작업허가 연동, 하도급 용접 작업자 교육·보호구 지급 상태 확인 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 용접 사고·근접사고·직업성 폐질환 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 용접재 종류(저수소·고항장·스테인리스), 모재 성분(Cr·Ni 함량), 작업 공간 환기 용량, 밀폐구역 여부, 고압가스 실린더 종류·저장 거리, 용접기 접지 상태를 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 저독성 용접재(Mn 저함량·Cr6+ 저함량)로 대체, 자동화·로봇 용접으로 인적 작업 축소.
   2. **수동 방호 (Passive)**: 국소 배기(local exhaust ventilation·이동식 집진장치), 용접 칸막이·차폐벽, 실린더 보관함·분리 벽, 자동 소화 설비.
   3. **능동 방호 (Active)**: 가스 누출 연속 감지 경보, 환기 설비 고장 인터록, 용접기 누전 차단기.
   4. **관리 조치 (Administrative)**: 안전작업허가서(화기/용접), 작업환경측정, 특수건강진단, 교대 TBM, 밀폐구역 진입 사전 점검.
   5. **PPE**: 송기마스크(supplied-air respirator)·P100 반면마스크, 용접면(auto-darkening helmet), 용접용 보호복·가죽장갑·안전화.
3. **용접 흄 노출 통제 (Welding-fume exposure control)**: 국소 배기장치 가동 후 작업, 작업환경측정(Mn·Cr6+·총분진·오존), 송기마스크 착용, 특수건강진단(연 1회 이상). 산업안전보건법 Article 110(MSDS), Article 125(작업환경측정), Article 130(특수건강진단)과 연계.
4. **고압가스 실린더 통제 (High-pressure gas cylinder control)**: 산소·아세틸렌·아르곤·이산화탄소 실린더 분리 저장(산소·가연 가스 6m 이상 또는 방화벽), 체인·클램프 고정, 손상 밸브·조정기 즉시 교체, 가스 누출 비눗물·가스검지기 점검. 고압가스 안전관리 및 사업법 Article 11(안전관리규정), Article 13(시설·용기의 안전유지), Article 15(안전관리자 선임), Article 24(허가관청 등의 조치), Article 26(사고 통보)과 연계.
5. **용접 아크 전기 안전 (Welding-arc electrical safety)**: 용접기 접지·절상, 용접 케이블 손상 점검, 감전 보호 장치(ELB) 가동, 습윤 환경 작업 금지. 산업안전보건법 안전보건기준에관한규칙(감전 위험 방지)과 연계.
6. **밀폐구역 용접 통제 (Confined-space welding)**: 탱크·블록 내부 용접 시 사전 산소농도·가스농도 측정, 환기, 구조 감시자 외부 배치, 외부와의 통신 확보. 산업안전보건법 Article 38(추락·접근 통제), OSHSR 제6장(붕괴·구조물 안전)과 연계.
7. **화재·폭발 비상 대응 (Fire/explosion emergency response)**: 가스 누출·화재 감지 시 즉시 가스 밸브 차단·전원 차단·대피·소화 설비 작동, 외부 소방 통보 절차 사전 정립. 위험물안전관리법 Article 27(응급조치)과 연계.
8. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·작업환경측정 결과·특수건강진단 결과·가스 누출 점검 로그·실린더 관리 대장 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-welding-fume-gas-safety-record.json`](../../../../../evidence-models/domains/industry/shipbuilding/shipbuilding-shipbuilding-welding-fume-gas-safety-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `SHIPBUILDING-WELDING-FUME-GAS-SAFETY-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 용접 공정별(SMAW/FCAW/GMAW) 흄 농도, Mn·Cr6+·오존 노출 측정값, 실린더 종류·저장 상태, 밀폐구역 진입 기록, 특수건강진단 결과 등 산업 고유 필드를 정의.

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
선박 용접·절단 작업을 전속 규율하는 단일 법령(조선 안전법)은 존재하지 않는다. 복합 통제 앵커: 산업안전보건법(OSHA-KR — 용접 근로자 안전, 추락 Article 38, 붕괴 OSHSR 제6장, 감전·화기 Article 101, MSDS Article 110, 작업환경측정 Article 125, 특수건강진단 Article 130), 고압가스 안전 관리 및 사업법(HPGSCA — 산소·아세틸렌·아르곤 가스 실린더, 안전관리규정 Article 11, 시설·용기의 안전유지 Article 13, 안전관리자 선임 Article 15, 허가관청 등의 조치 Article 24, 사고 통보 Article 26), 위험물안전관리법(DSSMA — 위험물 저장·취급 Article 5, 응급조치 Article 27). 중대재해처벌법(SAPA) Article 4~7은 사업주 안전보건 확보 의무의 일반적 근거이다. **HPGSCA 인용 주의**: `schema.yaml`의 HPGSCA 인용(Art 11/13/15/24/26)은 compliance-agent가 실시간 MCP `legalize_kr`(law.go.kr 원문, 권위 있음) 검증을 거친 **remediated 조문**이다 — 기존 앵커가 삭제 조문인 Art 14(1999.2.8 삭제)와 주제 불일치 Art 17/28을 인용하던 것을, `legalize_kr`에서 Art 11/13/15/24/26이 실효 조문임을 확인하여 정정하였다. 참고로 `kr_safety` 카탈로그는 HPGSCA에 대해 stale하여 삭제된 Art 14를 여전히 인덱싱하므로, HPGSCA 검증 시에는 `k-law 스킬(법제처 Open API)을 우선한다. 본 워크플로우의 핵심 차별점은 **고체 입자상 용접 흄(Mn·Cr6+·오존) 만성 노출 + 고압가스 실린터 물리적 위해**라는 복합 위해로, 도장 액체 용제 증기(`shipbuilding-painting-coating-fire-toxic`)와 화학적·물리적 위해 프로파일이 근본적으로 다르다.

## 8. 외주 안전 안내 (Outsourcing Note)
조선소 용접 작업은 외주 용접 전문업체 비중이 압도적으로 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 조선소의 대규모 용접 인구 중 상당수가 외주업체 소속이며, 용접 흄 만성 노출·특수건강진단 누락·고압가스 실린더 관리 소홀이 반복적으로 보고되어 왔다. 원청사(조선소)는 외주 용접업체에 본 워크플로우의 국소 배기·작업환경측정·특수건강진단·실린더 관리·안전작업허가 연동을 하도급 단계까지 적용하도록 해야 하며, 외주업체간 밀폐구역 교차 작업·공용 가스 저장소 사용 시 책임 소재를 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
