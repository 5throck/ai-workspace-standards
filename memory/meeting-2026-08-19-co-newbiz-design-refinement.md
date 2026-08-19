# Meeting: co-newbiz 설계 고도화 — 과잉설계·구조적 모순·조기 가치전달

**Date**: 2026-08-19
**Facilitator**: PM
**Participants** (inline role-play per `skills/meeting-facilitation` v1.4.0): risk-officer, platform-lead, process-governance-manager, data-architect, quant-methodologist, compliance-officer, security-engineer, financial-analyst, region-lead, brownfield-agent
**Objective**: 설계에 **들어 있는데 잘못됐거나 과한 것**을 찾아 고도화 방안 도출
**Related**: [2026-08-19-co-newbiz-design_ko.md](../docs/designs/2026-08-19-co-newbiz-design_ko.md) · [1차 회의](meeting-2026-08-19-co-newbiz-plan-review.md)

> **1차 회의와의 차이**: 1차(plan-review)는 **누락**을 찾았다(G1~G8). 이번은 **과잉·모순·순서**를 본다. 설계를 방어하는 자리가 아니다.

---

## Agenda

1. 조기 가치전달 부재 — 시스템이 Stage 5에야 나온다
2. 구조적 모순 — 딜을 분석하지 않는다면서 딜 분석 전문가가 19명
3. 권위 충돌 — `procedures/`(YAML)와 `skills/`(MD)가 같은 영역을 다룬다
4. 과잉 분해 — 스킬 93개
5. RAG 신뢰도 캡의 역효과 — 전부 Amber가 되면 신호가 죽는다
6. 미정의 상호작용 — policy pin × 2단계 승인
7. MNPI × MCP 충돌 — 최고가치 용례를 스스로 차단
8. 파일럿 산출물의 행방
9. 프로파일 콘텐츠 공급 주체
10. High tier 12명의 비용

---

## Round 1: 문제 제기

### risk-officer — R1 조기 가치전달이 없다

> 실행 계획을 보면 **동작하는 무언가가 Stage 5에야 나옵니다.** Stage 0~4는 전부 문서입니다. 문서 우선 원칙에는 동의하지만, 조직은 그렇게 오래 기다려주지 않습니다. Stage 3 수기 파일럿이 유일한 중간 증거인데 그건 시스템이 아닙니다.
>
> 더 큰 문제는 **기술적 미지수가 끝까지 검증되지 않는다**는 겁니다. 이 설계의 핵심 주장은 "데이터가 바뀌면 보고서가 재생성된다"인데, 그게 진짜 되는지를 Stage 5 후반에야 압니다. 안 되면 그때 뭘 합니까?

### brownfield-agent — R2 나는 무엇을 하는 에이전트인가

> 설계 §2에 "이 팀은 개별 딜을 분석하지 않는다"고 써 있습니다. 그런데 기능 도메인 19명 중 저를 포함해 `valuation`, `antitrust`, `customer-retention`, `hr-integration`, `commercial-dd`, `technical-dd`, `pmi` — 대부분이 딜 분석 전문가입니다.
>
> 딜을 분석하지 않으면 저는 체크리스트 한 번 쓰고 놀게 됩니다. **에이전트로 존재할 이유가 있습니까, 아니면 스킬이면 충분합니까?**

### platform-lead — R3 절차와 스킬 중 무엇이 권위인가

> `procedures/brownfield-screening/schema.yaml` 에 단계가 정의돼 있고, `skills/brownfield-feasibility/SKILL.md` 에도 워크플로우가 있습니다. **같은 것을 두 곳에 쓰면 반드시 어긋납니다.**
>
> 구현자 입장에서 묻습니다 — 게이트 엔진은 어느 쪽을 읽습니까? 둘이 다르면 어느 쪽이 맞습니까?

### data-architect — R4 스킬 93개는 과잉이다

> 신규 스킬 77개 + 재사용 16개 = 93개입니다. 목록을 보면 `governance-training-and-notice`, `governance-kpi-reporting`, `glossary-lint`, `site-comparison`, `backup-and-dr` 같은 것들은 **독립 스킬이라기보다 다른 스킬의 한 절**입니다.
>
> 스킬 하나당 파일·버전·검증·전파 비용이 붙습니다. 지금 규칙이 없으면 6개월 뒤 150개가 됩니다.

### quant-methodologist — R5 신뢰도 캡이 신호를 죽일 수 있다

> 제가 만든 규칙이지만 스스로 반박하겠습니다. **데이터 신뢰도가 종합 등급의 상한을 캡한다** — 좋습니다. 그런데 이 사업 영역에서 프록시 체인은 본질적으로 B~C 등급입니다. 크랭크축처럼 2홉을 건너뛰는 게 예외가 아니라 표준입니다.
>
> 그러면 **거의 모든 프로젝트가 영원히 Amber**입니다. 설계 §5.8에 제가 직접 쓴 경고 — "임계값이 틀리면 신호등이 전부 Amber가 되어 아무도 안 본다" — 를 제 규칙이 유발합니다.

### process-governance-manager — R6 policy pin과 2단계 승인이 충돌한다

> 프로젝트가 착수 시점 규정 v1.2로 고정(pin)됩니다. 그 사이 그룹 규정이 v1.3으로 개정됐습니다. 프로젝트가 Entity IC를 통과해 **Group IC에 올라왔을 때 어느 버전으로 심의합니까?**
>
> 설계에 없습니다. 각사는 v1.2로 승인했는데 그룹이 v1.3으로 보면 기준이 다릅니다.

### security-engineer — R7 MNPI를 MCP에서 빼면 MCP의 의미가 없다

> 제가 요구한 조항입니다만 다시 보니 과합니다. **`mnpi_flag` 프로젝트를 MCP 기본 응답에서 제외**한다고 했는데, 상장사 관련 M&A는 대부분 MNPI입니다.
>
> 그러면 이 시스템의 최고가치 용례 — AI 클라이언트가 딜 분석을 돕는 것 — 가 통째로 막힙니다. 규제가 요구하는 건 **금지가 아니라 추적**입니다.

### compliance-officer — R8 파일럿 산출물은 어디로 가나

> Stage 3에서 수기 파일럿을 완주합니다. 엑셀과 문서가 나옵니다. Stage 5.10에서 같은 건을 시스템으로 재실행해 대조합니다.
>
> 그 사이 **파일럿 산출물이 어떻게 보존되고 시스템에 들어가는지**가 없습니다. 버려지면 5.10 대조의 기준선이 사라지고, 사람이 다시 입력하면 그 과정에서 값이 바뀝니다.

### region-lead — R9 프로파일 내용은 누가 공급하나

> 제가 `region-profiles/*.yaml` 을 소유한다고 돼 있습니다. 그런데 **내용은 어디서 옵니까?** HSR 신고 기준액, CFIUS 요건, 세율, works council 임계 인원 — 전부 매년 바뀝니다.
>
> 분기 갱신이 운영 리듬에 있지만 "누가 무엇을 근거로 갱신하는가"가 없습니다. 근거 없는 프로파일은 조용히 썩습니다.

### platform-lead — R10 High tier 12명은 정상 운영에서 과하다

> 설계·방법론 수립 단계에서 High가 필요한 건 동의합니다. 하지만 **가동 이후에도 12명이 High면 비용이 계속 나갑니다.** AGENTS.md §3.6 비용 계층 전략의 취지와 어긋납니다.

---

## Round 2: 반론과 조율

**PM → risk-officer (R1)**: 조기 슬라이스가 "문서 우선" 원칙을 깨는 것 아닙니까?

> **risk-officer**: 깨지 않습니다. Stage 2에서 규정집이 확정된 **뒤에** 그 확정된 프로세스의 **부분집합**만 구현하는 겁니다. 미확정 프로세스를 코딩하는 것과 다릅니다. 오히려 Stage 3 수기 파일럿과 병행하면 서로를 검증합니다.

> **platform-lead**: 동의합니다. 다만 슬라이스에 UI·인증·MCP를 넣으면 안 됩니다. **DB 코어 + 가정 레지스트리 + 프록시 체인 1개 + NPV + 마크다운 보고서**까지만. 목적은 "데이터 바뀌면 보고서 재생성" 주장을 증명하는 것 하나입니다.

**PM → brownfield-agent (R2)**: 그럼 딜 분석 에이전트를 없앨까요?

> **brownfield-agent**: 아니요. 제가 원한 답은 **역할을 명시하라**는 겁니다. 저는 두 시기에 다른 일을 합니다 — 구축기에는 방법론·체크리스트·모델 사양을 만들고, 가동 후에는 **실제 검토에 온디맨드로 투입되는 자문역**입니다. 이게 안 써 있으면 누군가 "안 쓰는 에이전트"로 판단해 지웁니다.

> **risk-officer**: 다만 가장 얇은 것들은 정리해야 합니다. `customer-retention`·`incentive`·`pmi`는 각각 체크리스트 한두 개 분량입니다. 다만 사용자가 safety_os 수준의 세분화를 명시적으로 요청했으므로 **지금 합치지 말고, 통합 판단 기준만 정하고 M8에서 결정**합시다.

**PM → platform-lead (R3)**: 권위 문제는 어떻게 정리합니까?

> **platform-lead**: 축을 나눠야 합니다. **`procedures/*.yaml` = 무엇을·언제**(단계·순서·게이트·승인자 — 기계 실행 대상, 버전·pin 대상). **`skills/*.md` = 어떻게**(에이전트의 기법·판단·품질 기준). 스킬은 절차의 단계를 **재서술하지 않고 procedure key를 참조**합니다.

> **data-architect**: lint로 강제해야 합니다. 스킬 파일이 게이트 단계를 나열하면 실패시킵니다. 규칙만 쓰고 검사 안 하면 6개월 뒤 다 어긋나 있습니다.

**PM → quant-methodologist (R5)**: 캡을 없앨까요?

> **quant-methodologist**: 절대 아닙니다. 캡은 이 체계에서 가장 중요한 규칙입니다. 문제는 **캡이 막다른 길로 보인다**는 겁니다. 두 가지를 더합니다.
> 1. **Stage 3에서 캘리브레이션 드라이런** — 과거 의사결정 5~10건에 규칙을 돌려 등급 분포를 봅니다. 80% 이상이 Amber면 임계값을 재조정합니다.
> 2. **데이터 신뢰도 차원을 실행 가능하게** — "체인 B등급"으로 끝내지 말고 **"무엇을 확보하면 A로 올라가는가"**를 함께 출력합니다. "크랭크축 직접 출하 데이터 확보 시 A등급" 같은 식으로요. 그러면 캡이 차단이 아니라 **할 일**이 됩니다.

> **financial-analyst**: 그게 맞습니다. Amber가 "판단 불가"가 아니라 "이걸 채우면 결론난다"가 되면 조직이 움직입니다.

**PM → security-engineer (R7)**: MNPI를 열까요?

> **security-engineer**: 조건부로요. 블랭킷 차단 대신 **세션 단위 insider 등록**입니다. MCP 토큰이 (a) `insider_list`에 등재된 사용자에게 귀속되고 (b) `mnpi` 스코프를 명시적으로 보유할 때만 접근을 허용하고, (c) 모든 접근은 `data_access_log`에 남깁니다. 규제가 요구하는 추적성은 이걸로 충족되고 용례는 살아납니다.

> **compliance-officer**: 조건 하나 더. **접근 시점에 insider list 등재를 자동 갱신**해야 합니다. 사후에 명부를 만들면 규제 대응이 안 됩니다.

**PM → region-lead (R9)**: 콘텐츠 공급은?

> **region-lead**: 프로파일 필드마다 `source`·`verified_on`·`maintainer`를 필수로 둡니다. maintainer는 사내 법무 / 외부 자문 / 공개 출처 URL 중 하나입니다. 분기 갱신 때 `verified_on` 경과분을 자동으로 플래그합니다. **출처 없는 필드는 `_validate.ts`가 거부**합니다.

**PM → platform-lead (R10)**: 티어는?

> **platform-lead**: **단계 의존 티어링**을 제안합니다. Stage 1~4(설계·방법론)에서는 High, 가동 후 정상 운영에서는 상당수가 Medium으로 내려갑니다. 에이전트 프론트매터에 `tier_by_phase`를 두거나, 최소한 문서에 "정상 운영 시 권장 티어"를 병기합니다.

---

## Round 3: 합의 사항

| # | 문제 | 결정 |
|---|---|---|
| **R1** | 조기 가치전달 부재 | **Stage 2.5 — Thin Vertical Slice 신설.** Stage 2(규정집) 확정 후, Stage 3 수기 파일럿과 **병행**. 범위: DB 코어 + 가정 레지스트리 + 프록시 체인 1개 + NPV + 마크다운 보고서. **UI·인증·MCP·알림 제외.** 목적은 "데이터 변경 → 보고서 재생성" 단일 주장의 증명 |
| **R2** | 딜 분석 에이전트의 존재 이유 | **이중 역할을 명시한다** — 구축기: 방법론·체크리스트·모델 사양 산출 / 가동 후: 실제 검토에 온디맨드 투입되는 자문역. 통합 후보(`customer-retention`·`incentive`·`pmi`)는 **판단 기준만 정하고 M8에서 결정** |
| **R3** | 절차 vs 스킬 권위 | **`procedures/*.yaml` = 무엇을·언제(기계 실행·버전·pin 대상, 권위) / `skills/*.md` = 어떻게(기법·판단·품질기준)**. 스킬은 단계를 재서술하지 않고 procedure key 참조. **lint로 강제** |
| **R4** | 스킬 93개 과잉 | **스킬 성립 요건 3개 도입** — (a) 고유 트리거 (b) 고유 소유자 (c) 비자명한 산출물 1개 이상. 미달이면 절(section). 즉시 병합: `governance-training-and-notice`+`governance-kpi-reporting`→`compliance-monitoring`, `glossary-lint`→`glossary-management`, `site-comparison`→`regional-incentive-sourcing`, `backup-and-dr`→`database-operations` (**93 → 88**) |
| **R5** | RAG 캡의 역효과 | 캡은 유지. 두 가지 추가 — ① **Stage 3 캘리브레이션 드라이런**(과거 의사결정 5~10건, Amber 80% 초과 시 재조정) ② **신뢰도 차원을 실행 가능하게**(등급과 함께 "무엇을 확보하면 상향되는가" 출력) |
| **R6** | policy pin × 2단계 승인 | **Group IC는 프로젝트에 pin된 동일 버전으로 심의**한다. 예외: 그룹 규정 변경이 중대(안전·법규·규제)하면 Group IC가 신규 버전 재평가를 요구할 수 있으며, 이는 `policy_change` 결정으로 **기록**한다(묵시적 적용 금지) |
| **R7** | MNPI × MCP | 블랭킷 차단 철회. **세션 단위 insider 등록** — (a) `insider_list` 등재 사용자에게 귀속된 토큰 (b) 명시적 `mnpi` 스코프 (c) 전 접근 `data_access_log` 기록 (d) **접근 시점 명부 자동 갱신** |
| **R8** | 파일럿 산출물 | 파일럿 산출물은 **시스템의 시드/기준 데이터**가 된다. 가정값·프록시 체인·체크리스트 결과는 Stage 5에서 첫 `run`으로 적재하고, 파일럿 보고서는 5.10 대조의 **골든 레퍼런스**다. 따라서 **파일럿 양식을 기계 적재 가능하게**(자유서식 문서 아닌 구조화 시트) 설계한다 |
| **R9** | 프로파일 콘텐츠 공급 | 프로파일 필드마다 `source`·`verified_on`·`maintainer`(사내 법무/외부 자문/공개 출처 URL) **필수**. `_validate.ts`가 출처 없는 필드를 **거부**. 분기 갱신 시 `verified_on` 경과분 자동 플래그 |
| **R10** | High tier 비용 | **단계 의존 티어링** — Stage 1~4는 High, 정상 운영은 상당수 Medium. 에이전트 문서에 "정상 운영 권장 티어" 병기 |

---

## Action Items

| # | 액션 | 담당 | 반영 위치 | 상태 |
|---|---|---|---|---|
| B-1 | Stage 2.5 Thin Vertical Slice 정의 | platform-lead, risk-officer | 설계문서 §10 | **완료** |
| B-2 | 딜 분석 에이전트 이중 역할 명시 | pm | 설계문서 §5.3 | **완료** |
| B-3 | 절차/스킬 권위 분리 규약 + lint 사양 | platform-lead, process-governance-manager | 설계문서 §6.8 | **완료** |
| B-4 | 스킬 성립 요건 3개 + 5건 병합 | data-architect | 설계문서 §9.2 | **완료** |
| B-5 | RAG 캘리브레이션 드라이런 + 신뢰도 실행가능화 | quant-methodologist | 설계문서 §8.2 | **완료** |
| B-6 | policy pin × Group IC 규칙 | process-governance-manager | 설계문서 §6.4 | **완료** |
| B-7 | MNPI 세션 단위 insider 등록 | security-engineer | 설계문서 §8.10 | **완료** |
| B-8 | 파일럿 산출물 시드화 + 양식 구조화 | compliance-officer | 설계문서 §10.6 | **완료** |
| B-9 | 프로파일 출처 필드 필수화 | region-lead | 설계문서 §6.7 | **완료** |
| B-10 | 단계 의존 티어링 표기 | platform-lead | 설계문서 §5.6 | **완료** |
| B-11 | ADR-0045~0051 기안 | 각 담당 | `docs/adr/` | 대기 (Stage 2) |

---

## Open Issues (미해결 — 수용 리스크)

| # | 쟁점 | 사유 | 재논의 |
|---|---|---|---|
| O-8 | 얇은 에이전트 3종(`customer-retention`·`incentive`·`pmi`) 통합 여부 | 사용자가 safety_os 수준 세분화를 명시 요청했으므로 임의 축소 부적절. 통합 기준만 합의 | Stage 1 M8 |
| O-9 | Thin Slice가 Stage 3 파일럿과 병행 시 인력 충돌 가능성 | 일정·리소스 추정(O-7)이 없어 판단 불가 | Stage 1 M8 (O-7 해소 후) |
| O-10 | RAG 캘리브레이션에 쓸 과거 의사결정 데이터 확보 여부 | 과거 검토 건이 문서로만 남아 등급 재현이 어려울 수 있음 | Stage 3 착수 전 |
| O-7 | (1차 회의 이월) 전체 일정·리소스 추정 부재 | 미해소 | Stage 1 M8 |

---

## Notes

- 본 회의는 설계를 **방어**하지 않고 **공격**하는 자리로 운영했다. 규칙 제안자 본인이 자기 규칙을 반박하도록 했다(quant-methodologist의 R5, security-engineer의 R7).
- R5와 R7은 **1차 회의에서 채택한 결정을 스스로 수정한 것**이다. 1차 결정이 틀렸다기보다, 강하게 걸어둔 안전장치가 부작용을 낳는 지점을 찾은 것이다.
- Stage 0.2에서 에이전트 로스터가 생성된 뒤 Stage 1 M0~M8을 실제 에이전트로 재실행한다. 1·2차 회의 결과는 그 입력이지 대체가 아니다.
