# 철도 산업 — 교량/고가구조물 점검·정비 추락 방지 워크플로우 (Railway Bridge/Viaduct Fall Prevention)

> **상태**: 본 워크플로우는 Phase 2 Group C에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 MCP `kr_safety` + `legalize_kr` 검증 완료). 다만 `schema.yaml`의 `signature_hazard` 확장과 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
철도 교량·고가구조물(viaduct) 점검·정비 작업 중 발생하는 **고소 추락**, **강물/계곡 수난 구조 위험**, **풍속·기상 악화로 인한 작업 중지**, **낙하물(공구·부재)에 의한 타격** 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 철도 교량/고가 작업은 일반 건물 고소 작업과 달리 **강·계곡·철도 선로 위**라는 특수 환경에 위치하므로, 추락 시 수난 구조 대응과 풍속·기상 작업 제한이 핵심 통제 요소가 된다. 한국의 주요 철도 교량(한강철교, 영산강철교)과 산간 고가구조물(중앙선·전라선 산악구간)은 대표적인 고위험 고소 작업 대상이다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 고소 작업 워크플로우와 중복되지 않는 철도 산업 전용 교량/고가 추락 방지 절차이다. 선로/터널 밀폐공간(`rail-track-confined-maintenance`) 및 차량사업소(`railway-rolling-stock-maintenance-loto`)와 구별된다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 철도 (코드: `railway`, 여객·화물 철도 운영 및 선로/구조물 유지보수)
- **대상 작업**: 철도 교량(steel/concrete bridge) 점검·정비, 고가구조물(viaduct) 상판·측면·하부 작업, 교각(pier) 점검, 신호·통신 케이블 고소 작업, 세척·도장·탐상 검사, 강·계곡 상공 세공 작업
- **적용 시점**: 정기 구조물 점검 주기, 비상(지진·홍수·낙뢰) 사후 점검, 교량 보수 공사, 풍속·기상 악화 시 작업 중지 판단

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 고소 작업 위험성평가 주관, 안전작업허가제(PTW) 운영, 기상 감시·작업 중지 기준 설정, 수난 구조 대응 계획 수립 |
| 구조물 정비 책임자 (Bridge Maintenance Supervisor) | 작업 전 교량·고가 구조 안전성 확인, 안전대·추락방호망 설치 지시, 진입 전 교차점검, 기상 악화 시 작업 중지 |
| 고소 작업자 (Height Worker) | 안전대·안전모·추락방호구 착용, 안전대 부착점(anchor point) 적격성 확인, 허가 조건 준수 |
| 구조물 엔지니어 (Structural Engineer) | 교량·고가 구조 안전성 평가, 균열·부식 탐상 결과 판정, 보수 범위 설계 |
| 수난 구조 대응팀 (Water Rescue Team) | 강·계곡 상공 작업 시 대기·구조 장비 준비, 추락 시 즉각 구조 작전 개시 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 고소 작업 사고 및 근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 교량/고가 작업 높이, 강·계곡 수심·유속, 하부 선로 열차 운행 여부, 풍속·기상 전망, 구조물 노후도·균열 상태, 야간 시야 제한을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 설계 단계에서 점검용 영구 설비(점검통로·점검차) 설치, 고소 작업을 지상·차상 작업으로 대체 가능 여부 검토.
   2. **수동 방호 (Passive)**: 추락방호망(safety net), 작업대(scaffold), 강관(handrail), 안전대 부착용 레일·타이밸트.
   3. **능동 방호 (Active)**: 풍속 감시 경보, 낙하물 방지 덮개, 열차 접근 경보 시스템.
   4. **관리 조치 (Administrative)**: 안전작업허가서(고소), 기상 작업 중지 기준(풍속·강수·낙뢰), 교대 TBM, 작업 구역 통제.
   5. **PPE**: 전신안전대(full-body harness), 안전모, 충격흡수 라니야드(double lanyard), 미끄럼 방지화.
3. **추락 방지 통제 (Fall prevention)**: 작업 전 안전대 부착점(anchor point — 안전후크·레일) 적격성 확인, 추락방호망 설치, 2m 이상 고소 작업 시 안전대 상시 부착. 산업안전보건법 Article 38(추락 등 위해 방지 안전조치 — 교량/고가)과 연계.
4. **기상·풍속 작업 제한 (Weather/wind work limits)**: 풍속 10m/s 이상, 강우·낙뢰, 시야 제한 시 고소 작업 전면 중지. 기상 감시 체계 운영 및 작업 중지 명령 권한 사전 명확화.
5. **수난 구조 대응 (Water rescue contingency)**: 강·계곡 상공 작업 시 구명조기·구명보트 대기, 수난 구조팀 사전 통보, 추락 시 즉각 구조 작전 절차 사전 정립.
6. **열차 접근 통제 (Train approach control)**: 하부 선로 열차 운행 시 작업 시간대 조정, 열차 접근 경보 시스템 가동, 낙하물 방지 조치. 철도안전법 Article 45(철도보호지구 행위제한 — 교량 구조물)와 연계.
7. **낙하물 방지 (Dropped-object prevention)**: 공구·부재 낙하 방지 스트랩, 작업대 정리정돈, 하부 통제 구역 설정.
8. **비상 대응 (Emergency response)**: 추락·수난·낙뢰·구조물 붕괴 시 즉각 작업 중지·대피, 구조·구급·소방 호출 절차 사전 정립.
9. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 안전작업허가서·기상 감시 로그·점검표·구조물 탐상 결과 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/railway/railway-railway-bridge-viaduct-fall-prevention-record.json`](../../../../../evidence-models/domains/industry/railway/railway-railway-bridge-viaduct-fall-prevention-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `RAILWAY-BRIDGE-VIADUCT-FALL-PREVENTION-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 작업 높이, 안전대 부착점 유형, 풍속·기상 기록, 수난 구조 대기 상태, 구조물 균열·탐상 결과 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 철도안전법 Article 45
- 철도안전법 Article 48
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 (감전 등 전기 재해 방지 기준)

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 철도안전법 | RSA | Railway Safety Act |

## 7. 규제 참고사항 (Regulatory Notes)
철도 교량/고가구조물 점검·정비를 전속 규율하는 단일 법령은 없다. 복합 통제 앵커: 철도안전법(RSA — 철도보호지구 행위제한 Article 45, 교량 구조물 기준; 철도 보호 및 질서유지 Article 48)을 기본으로 하고, 산업안전보건법(OSHA-KR — 추락·감전 등 안전조치 Article 38 + 안전보건기준에관한규칙, 점검작업 안전 Article 57)을 정비 근로자 보호에 적용한다. 중대재해처벌법(SAPA) Article 4~7은 사업주 안전보건 확보 의무의 일반적 근거이다. 본 워크플로우의 핵심 차별점은 **고소 + 수난 구조 + 기상 제한**이라는 복합 위해요인으로, 일반 건물 고소 작업(산업안전보건법 Article 38 공통 적용)과 구별된다. 차량사업소(`railway-rolling-stock-maintenance-loto`)는 차량 정비 LOTO가 핵심이며, 선로/터널(`rail-track-confined-maintenance`)은 밀폐공간·열차 접근이 핵심이다 — 본 워크플로우는 **개방 고소 + 수난**이라는 교량 특유의 위해 프로파일에 특화된다.

## 8. 외주 안전 안내 (Outsourcing Note)
철도 교량·고가구조물 보수 공사와 고소 점검 용역은 외주·하도급 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 운영사(철도공사 또는 시설관리공단)는 교량 보수 외주업체·고소 점검 용역업체에 본 워크플로우의 추락 방지·기상 작업 중지·수난 구조 대응 통제 조치를 하도급 단계까지 적용하도록 해야 한다. 특히 고소 작업 전문 면허와 안전관리자 선임 여부, 수난 구조팀 통보 체계를 원청사가 사전 확인해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
