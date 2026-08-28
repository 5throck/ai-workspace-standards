# 항만 물류 산업 — 위험물 화물 하역·취급 (Dangerous Cargo Handling) 워크플로우

> **상태**: 본 워크플로우는 Phase 2 Group B에서 finalize되어 `status: active`로 전환되었습니다 (규제 인용은 compliance-agent가 실시간 검증 완료). 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다. 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
항만 하역·운송·야적 단계에서 IMDG(해상위험물) 대상 위험물 화물(인화성·가연성·독성·부식성·자발반응성 물질)의 하역·이동·적치 과정에서 발생하는 누출·화재·폭발·흡입 노출·환경 유출 위해요인을 통제 위계에 따라 체계적으로 예방한다. 위험물 화물은 항만이라는 밀집 작업 환경에서 크레인·지게차·컨테이너와 결합하여 복합 사고를 유발하며, 특히 클래스(Class) 간 비양립(incompatible) 혼적은 누출 시 반응·화재로 이어진다. 본 워크플로우는 안전보건관리자의 일반적 안전확보 의무(중대재해처벌법 Article 4)와 위험성평가 의무(산업안전보건법 Article 36)를 뒷받침한다.

본 워크플로우는 **산업 고유(industry-unique) 워크플로우**로, `workflows/_shared/`의 공통 워크플로우와 중복되지 않는 항만 물류 전용 위험물 화물 취급 절차이다. (지게차 충돌 방지는 `logistics-forklift-pedestrian-strike-prevention` 워크플로우와 중복되지 않는다.)

## 2. 적용 범위 (Scope)
- **대상 산업**: 물류 (코드: `logistics`, 항만 및 화물 하역)
- **대상 작업**: 위험물 컨테이너 하역·적선, 탱크컨테이너/IBC·드럼 양하, 야적·분류, 화물 크레인·스트래들 캐리어 운행, 누출 사고 대응, 위험물 적하·인계 인수
- **적용 시점**: 위험물 선석 배정, 하역 전 MSDS·적하목록(Manifest) 확인, 누출·이상 징후 보고, 기상 악화 시 작업 중지 판단

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 안전보건관리자 (Safety & Health Manager) | 위험물 화재·누출 위험성평가 주관, 비상 대응 계획, 항만 안전관리자로서 법적 의무 수행 |
| 위험물 안전관리자 (Dangerous Goods Safety Advisor) | IMDG 분류·비양립성 검토, 적하목록 검증, 양·적재 배치 승인 |
| 현장 감독자 / 하역 책임자 (Stevedore Supervisor) | 하역 작업허가 승인, PPE·소화설비 사전 점검, 이상 시 작업 중지·대피 |
| 하역 작업자 / 크레인 운전자 (Worker / Crane Operator) | PPE 착용, 비양립 혼적 방지, 누출 징후 즉시 보고 |
| 설비 엔지니어 (Facility Engineer) | 소화·누출검지·유수분리·환기 설비 점검·유지, 크레인·양하설비 안전장치 관리 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 누출·화재·근접사고 사후 검토, 방호대책 개선 |

## 4. 워크플로우 단계 (Procedure)
1. **위험성 평가 (Risk assessment)**: 화물의 IMDG Class/UN 번호, 인화점·독성·반응성, 비양립(incompatible) 물질 조합, 하역 설비·양하 경로, 기상·조건, 주변 작업 인원 밀집도를 파악. 산업안전보건법 Article 36 위험성평가와 연계.
2. **통제 위계 적용 (Hierarchy of controls)**:
   1. **제거 (Elimination)**: 대체 물질·포장(격자 강화) 사용, 위험물 취급 최소화(별도 선석).
   2. **수동 방호 (Passive)**: 비양립 화물 물리적 분리·격리 거리, 방류제·유수분리 시설, 누출검지·자동 소화 설비, 전용 야적구역.
   3. **능동 방호 (Active)**: 가스·연기 연속 모니터링, 풍향 풍속 감시, 작업중지 임계값 알람.
   4. **관리 조치 (Administrative)**: 하역 작업허가서, MSDS 사전 교육, 비양립 표·적하목록 검증, TBM·교대 인수.
   5. **PPE**: 화학보호복·호흡보호구(유기용제/산 카트리지)·보안경·보호장갑·안전화(최후 수단).
3. **적하·운송 기준 준수 (Loading & transport standards)**: 위험물안전관리법 Article 20(위험물의 운반)의 포장·적재·표시 기준 준수, IMDG Code segregation table에 따른 Class별 격리 거리·분리 적치.
4. **하역 작업 통제 (Cargo-handling control)**: 적하목록(Manifest)·MSDS 사전 확인, 하역 전 컨테이너 외관 손상·누출 점검, 크레인·양하설비 정격 하중 준수, 강풍·악기상 시 작업 중지.
5. **비양립 혼적 방지 (Incompatibility control)**: 산화성 물질과 가연성 물질, 산과 염기 등 반응성 조합의 근접 적치 금지, 격리 거리·차단벽 적용.
6. **비상 대응 (Emergency response)**: 누출 시 즉시 작업 중지·격리·오염 통제(흡수제·둑), 화재 시 적합 소화제(Class별 — 포·분말·CO2·물 사용 제한) 사용, 해경·소방·항만관청 통보 절차 사전 정립, 대피·풍하측 대피 동선 수립.
7. **기록 및 감사 (Recordkeeping & audit)**: 아래 §5의 증거 기록 생성, 적하목록·하역 허가서·누출 점검표·비상 대응 기록 보관.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/logistics/logistics-logistics-dangerous-cargo-handling-record.json`](../../../../../evidence-models/domains/industry/logistics/logistics-logistics-dangerous-cargo-handling-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `LOGISTICS-DANGEROUS-CARGO-HANDLING-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 IMDG Class·UN 번호, 비양립 조합, 격리 거리, 누출 점검 결과, 소화설비 가동 상태 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 항만안전특별법 Article 4
- 항만안전특별법 Article 5
- 항만안전특별법 Article 6
- 항만안전특별법 Article 8
- 항만안전특별법 Article 9
- 산업안전보건법 Article 38 (추락 등 위해 방지 안전조치)
- 안전보건기준에관한규칙 제6장 제2절 (붕괴 등에 의한 위험 방지)
- 위험물안전관리법 Article 20

### 법령 용어 정리 (Gloss)
| 한국어 | 약자 | 영문 |
|--------|------|------|
| 산업안전보건법 | OSHA-KR | Occupational Safety and Health Act |
| 중대재해처벌법 | SAPA | Serious Accidents Punishment Act |
| 항만안전특별법 | PSSA | Port Safety Special Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |

## 7. 규제 참고사항 (Regulatory Notes)
항만 위험물 화물 취급은 항만안전특별법(PSSA)과 위험물안전관리법(DSSMA)이 이중으로 규율한다. **PSSA Article 6(항만운송 참여자의 안전확보 의무 등)이 항만 작업자 안전확보의 실질적(substantive) 의무 조문**이며, **PSSA Article 4(다른 법률과의 관계)는 타 법률과의 적용 우선순위를 정하는 절차적(priority-of-application) 조문**이다(위험물 운반 등은 DSSMA가 우선 적용됨). **위험물안전관리법 Article 20(위험물의 운반)이 위험물의 포장·적재·표시·운반 기준을 직접 정하는 조문**이다. 국제 기준으로 IMDG Code의 Class(1~9)별 segregation table이 비양립 혼적 방지·격리 거리의 운용 기준이 된다. 본 워크플로우의 `schema.yaml` legal_basis는 위 복합 앵커 조합(자동 채움)을 사용한다.

## 8. 외주 안전 안내 (Outsourcing Note)
항만 하역은 협력 하역업체(stevedore)·3PL 운송사·장비 리스사 등 외주 의존도가 극히 높아 중대재해처벌법 Article 5(도급·하도급 사업주 안전보건 확보 의무)가 핵심적이다. 항만 운영사(terminal operator)는 하역·운송·야적 협력업체에 본 워크플로우의 통제 조치(MSDS 사전 교육·비양립 분리·누출 대응 포함)를 하도급 단계까지 동일 적용하고, 혼재되는 작업 영역에 대해서는 협력업체 간 안전 책임 경계를 계약서에 명확히 해야 한다.

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
