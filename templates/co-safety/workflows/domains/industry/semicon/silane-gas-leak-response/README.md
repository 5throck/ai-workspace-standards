# 반도체 팹 산업 — 실란 가스 누출 사고 대응 (Silane Gas Leak Response) 워크플로우

> **상태**: 본 README는 Task 12에서 finalize되었습니다. 다만 `schema.yaml`의 `signature_hazard`와 증거 모델의 `industry_specific_fields`는 전문가 검토 대상 placeholder로 남아 있습니다(`status: draft`). 실사용 전 해당 필드의 전문가 확정이 필요합니다.

## 1. 목적 (Purpose)
반도체 팹(fab) 공정에서 사용하는 실란(SiH₄) 가스의 누출 사고에 대한 신속한 탐지·대피·격리·응급조치·사후 조사 절차를 확립하여, 작업자 안전을 확보하고 자발발화·화재·폭발로 인한 중대재해를 예방한다. 실란은 발화점이 낮아 공기 중에서 자발적으로 발화(자연발화)하며, 고농도 누출 시 즉각적 화재·폭발 위험이 있는 대표적인 발화성(pyrophoric) 가스이다.

본 워크플로우는 **사고 대응(emergency-response) 워크플로우**이며, 산업 고유(industry-unique) 워크플로우로 `workflows/_shared/` 공통 워크플로우와 중복되지 않는다.

## 2. 적용 범위 (Scope)
- **대상 산업**: 반도체 제조 (코드: `semicon`)
- **대상 가스**: 실란(SiH₄) 및 준실란/이실란 등 동급 발화성 규소계 가스. (동일 응급대응 패턴은 인화성/발화성 가스 전반에 확장 가능)
- **적용 시점**: 가스 감지기 알람, 작업자 후각/시각 신고, 공정 안전계통(BMS/GMS) 경보 발생 시

## 3. 역할 및 책임 (Roles & Responsibilities)
| 역할 | 책임 |
|------|------|
| 가스안전관리자 (High-Pressure Gas Safety Manager) | 누출 사고 현장 지휘, 차단·환기·퍼징 결정, 관할기관 통보 |
| 안전보건관리자 (Safety & Health Manager) | 사고 대응 총괄, 작업자 대피·안전 확인, 사후 조사 주관 |
| 현장 감독자 / 작업 책임자 (Supervisor) | 초기 알람 수신·전파, 인원명 파악, 구급 요청 |
| 작업자 (Worker) | 알람 시 즉시 대피, 절대 임의 소화 금지, 누출 위치·상황 보고 |
| 비상대응팀 (Emergency Response Team) | 밸브 차단·환기·불활성 가스 퍼징(전문대원만), 화재 시 밸브 차단 후 연소 허용 |
| 산업보건위원회 (Industrial Health & Safety Committee) | 사고 원인 분석, 재발방지대책 수립 |

## 4. 워크플로우 단계 (Procedure)
1. **탐지 및 알람 (Detection & alarm)**: 가스 감지기 임계치 초과 알람 또는 작업자 신고 접수. 알람을 모든 관련 구역에 전파.
2. **초기 상황 파악 (Initial assessment)**: 누출 위치·규모·자발발화/화재 여부, 풍향·환기 상태 확인. 화재 발생 시 즉시 화재 신고.
3. **대피 및 격리 (Evacuate & isolate)**: 누출 구역 및 하풍 구역 작업자 즉시 대피; 인원명 확인. 통제 구역 설정, 비인가자 접근 금지. 환기 시스템은 가연성 가스 농도가 폭발하한계(LEL)에 도달하지 않도록 최대 가동(단 이미 화재 시는 화재 확대 방지 관점에서 환기 결정은 가스안전관리자가 판단).
4. **통보 (Notification)**: 가스안전관리자·안전보건관리자·소방서·관할 고용노동관서·소속 경영책임자 순 통보. — 중대재해처벌법 Article 4 안전확보 의무와 연계.
5. **누출 차단 및 응급조치 (Isolate & mitigate)**: 전문대원(Emergency Response Team)만 진입. 상류 밸브 차단, 불활성 가스(N₂) 퍼징, 환기 가동. 비전문가의 임의 진입·소화 금지.
6. **화재 시 대응 (Fire response)**: 실란 화재는 **소화하지 말고 밸브를 차단**한다(가스 잔류 중 재발화·증기폭발 위험). 밸브 차단 후 주변 가연물 냉각만 실시. 화재 확대 시 소방서 진압에 인계.
7. **사후 조사 및 보고 (Post-incident)**: 인명 피해·재산 피해 파악, 사고 원인 조사(root-cause), 관할기관 공식 보고. — 산업안전보건법 Article 57 (산업재해 조사·기록)과 연계. 재발방지대책 수립·이행.
8. **기록 및 감사 (Recordkeeping & audit)**: 아래 §6의 증거 기록 생성, 감지기 로그·통보 기록·조사 보고서 보존.

## 5. 증거 기록 (Evidence Record)
생성 증거 모델: [`evidence-models/domains/industry/semicon/semicon-silane-gas-leak-response-record.json`](../../../../../evidence-models/domains/industry/semicon/semicon-silane-gas-leak-response-record.json) (스켈레톤, `status: draft`)

- **레코드 ID 형식**: `SEMICON-SILANE-GAS-LEAK-RESPONSE-YYYY-NNNN` (전문가 확인 대상)
- **필수 필드**: `record_id`, `legal_basis`(minItems 3), `audit_trail`
- **확장 포인트**: `industry_specific_fields` — 전문가가 누출 발생 시각·위치·규모, 대피 인원, 통보 연계, 조사 결과 등 산업 고유 필드를 정의.

## 6. 법적 근거 (Legal Basis)
출처: `regulations/KR/industry-regulatory-anchors.yaml` (Task A-03). 아래 인용 문자열은 `schema.yaml`의 `legal_basis`와 정확히 일치(VERBATIM)한다. HPGSCA 인용은 remediated 조문(Article 11/13/15/24/26)을 사용한다.

- 산업안전보건법 Article 36
- 산업안전보건법 Article 57
- 중대재해처벌법 Article 4
- 중대재해처벌법 Article 5
- 중대재해처벌법 Article 6
- 중대재해처벌법 Article 7
- 화학물질의 등록 및 평가 등에 관한 법률 Article 23
- 화학물질의 등록 및 평가 등에 관한 법률 Article 24
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
| 화학물질의 등록 및 평가 등에 관한 법률 (화학물질관리법) | CCA | Act on the Registration and Evaluation of Chemicals (Chemical Control Act) |
| 고압가스 안전관리 및 사업법 | HPGSCA | High-Pressure Gas Safety Control and Business Act |
| 위험물안전관리법 | DSSMA | Act on the Safety Control of Dangerous Goods |

## 7. 규제 참고사항 (Regulatory Notes)
반도체 팹은 화학물질 다량 사용(CCA), 가스 다량 사용(HPGSCA — 실란·아르신·포스핀·수소), 위험물 다량 사용(DSSMA — 발화성 액체·가연성 금속)이 결합된 환경이다. 전용 법령은 없으며 복합 통제 앵커가 필요하다. 추가 관련: 산업안전보건법 Article 38(감전·추락 등 위해 방지 안전조치 — 도구 설치·유지보수 포함). **HPGSCA 인용 주의**: `schema.yaml`의 HPGSCA 인용(Art 11/13/15/24/26)은 compliance-agent가 실시간 MCP `legalize_kr`(law.go.kr 원문, 권위 있음) 검증을 거친 **remediated 조문**이다 — 기존 앵커가 삭제 조문인 Art 14(1999.2.8 삭제)와 주제 불일치 Art 17(용기등의 검사, NOT 안전관리자)/Art 28(한국가스안전공사의 설립, NOT 응급조치)을 인용하던 것을, `legalize_kr`에서 Art 11/13/15/24/26이 실효 조문임을 확인하여 정정하였다(MST 283919, lawIdCode 001850). 참고로 `kr_safety` 카탈로그는 HPGSCA에 대해 stale하여 삭제된 Art 14를 여전히 인덱싱하므로, HPGSCA 검증 시에는 `k-law 스킬(법제처 Open API)을 우선한다.

## 8. 검증 이력 (Verification History)
이전 버전의 본 README는 §6에서 HPGSCA Article 14/17/28을 `[UNVERIFIED — 전문가 재검증 필요]`로 표기하고, 본 절에 `legalize_kr.parse_law_structure`이 `[]`를 반환했다는 미검증 노트를 게시하고 있었다. 해당 플래그는 **STALE**이다.

- **해결일**: 2026-08-07 (semicon HPGSCA remediation, Group A 후속 조치)
- **관할 법령 색인 상태**: `legalize_kr.get_law_metadata("고압가스안전관리법")` 성공 (MST 283919, lawIdCode 001850, last-commit 2026-03-10)
- **정정 내용**: Art 14(1999.2.8 삭제), Art 17(용기등의 검사), Art 28(한국가스안전공사의 설립) → 실효 조문 Art 11/13/15/24/26으로 전면 교체
- **검증 출처**: `legalize_kr.parse_law_structure` 원문 + `regulations/KR/High-Pressure-Gas-Safety.yaml` (등록된 statute YAML)
- **상세 내역**: `memory/findings/compliance-2026-08-07-semicon-hpgsca-remediation.md` 참조

---
_법적 고지: 규제 해석은 사용자 책임입니다. 본 워크플로우는 자동화 보조만 제공하며, 법률 자문이 아닙니다._
