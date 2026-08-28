# 데이터센터 산업 — 랙 설치·케이블 작업 추락 방지 (Rack & Cabling Fall Protection) 워크플로우

> **상태**: 본 README는 Task 12에서 finalize되었습니다. 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다(`status: draft`). 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
데이터센터 서버 랙(rack) 설치, 상부 케이블 트레이(cable tray) 배선, 고소 작업대 접근 작업에서 발생하는 추락 위해요인을 통제 위계(hierarchy of controls)에 따라 체계적으로 예방한다. 데이터센터 건설·증설·유지보수 단계에서 추락은 대표적 중대재해 원인이며, 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 데이터센터 산업 전용 추락 방지 절차이다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 데이터센터 (코드: `datacenter`)
- **대상 작업**: 랙(rack) 세팅·이동, 상부 케이블 배선·재배선, 사다리/고소 작업대 작업, 천장 작업, 조명·UPS 상부 점검
- **적용 시점**: 신규 증설(Move-in/Build-out), 장비 변경(cutover), 정기 유지보수

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 추락 위험성평가 주관, 방호조치 적합성 확인, 고소작업 허가제 운영 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 작업허가 승인, 안전장비 사전 점검, 작업자 적격성 확인, 이상 시 작업 중지 |
| 작업자 (Worker) | 추락방호장치 사용, 허가 조건 준수, 사전 점검 실시, 이상 징후 보고 |
| 전기안전관리자 (Electrical Safety Manager) | 랙 인접 활선부 차단/절연 조치 확인 (추락+감전 복합 리스크 통제) |
| 산업보건위원회 (Industrial Health & Safety Committee) | 추락 사고·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **추락 위험 평가 (Fall risk assessment)**: 작업 높이, 작업 빈도, 작업자 수, 작업대/접근 방식, 하부 장애물을 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **추락 방지 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 설계 변경으로 고소 작업 자체를 제거(사전 조립, 모듈화).
   2. **수동 방호 (Passive)**: 작업대 난간, 견고한 발판, 추락방지망.
   3. **능동 방호 (Active)**: 안전대(harness), 활동제한장치(lanyard/retractable).
   4. **관리 조치 (Administrative)**: 고소작업 허가서, 작업 전 TBM.
   5. **PPE**: 안전모, 안전화(최후 수단).
3. **장비 사전 점검 (Equipment inspection)**: 안전대/라인/앵커리지/작업대 사전 점검, 결함 시 즉시 사용 중지.
4. **작업허가 및 교육 (Permit & training)**: 고소작업 허가서 발행, 추락방호장치 사용법 교육, 구조 훈련.
5. **전기 위험 통제 (Electrical hazard control)**: 랙 내/인접 활선부 사전 차단·절연·Lockout/Tagout — 추락 사고 시 감전 복합 리스크 통제.
6. **구조 계획 (Rescue plan)**: 추락 시 신속 구조 절차(목조( harness) 증후군 방지).
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §6의 증거 기록 생성, 작업허가서·점검표·근접사고 기록.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/datacenter/datacenter-rack-cabling-fall-protection-record.json`](../../../../../evidence-models/domains/industry/datacenter/datacenter-rack-cabling-fall-protection-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `DATACENTER-RACK-CABLING-FALL-PROTECTION-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 작업 높이, 방호 단계, 허가서 번호, 사전 점검 결과 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 전기안전관리법 Article 16
- 전기안전관리법 Article 22
- 위험물안전관리법 Article 5
- 위험물안전관리법 Article 27
- 소방기본법 Article 16

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 전기안전관리법 | ESCA | Electrical Safety Control Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |
| 소방기본법 | BFS | Basic Act on Fire Services |

## 7. 규제 참고사항 (Regulatory Notes)
데이터센터 전용 안전 법령은 없다. 복합 통제 앵커: 전기안전관리법(ESCA — UPS·스위치기어·변압기 고전압 안전), 위험물안전관리법(DSSMA — 예비발전용 경유, 납축/리튬 UPS 배터리), 소방기본법(BFS — 소화 설비·연기 통제). 추가 관련: 산업안전보건법 Article 38(감전·추락 등 위해 방지 안전조치) + 안전보건기준에관한규칙 — 단, 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
데이터센터 건설·증설은 외주 비중이 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 특히 중요하다. 원청사는 협력업체에 본 워크플로우의 통제 조치를 하도급 단계까지 적용하도록 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
