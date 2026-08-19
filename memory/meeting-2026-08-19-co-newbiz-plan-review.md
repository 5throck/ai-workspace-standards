# Meeting: co-newbiz 계획 역검토

**Date**: 2026-08-19
**Facilitator**: PM
**Participants** (inline role-play per `skills/meeting-facilitation` v1.4.0): risk-officer, data-architect, compliance-officer, legal-counsel, security-engineer, process-governance-manager, financial-analyst, platform-lead
**Objective**: `docs/designs/2026-08-19-co-newbiz-design_ko.md` 계획 전체를 도메인별 관점에서 역검토하여 누락·보완 영역 도출
**Related**: [2026-08-19-co-newbiz-design_ko.md](../docs/designs/2026-08-19-co-newbiz-design_ko.md)

---

## Agenda

1. 각 도메인 관점에서 계획의 사각지대 식별
2. 심각도 분류 및 반영 위치 확정
3. "나중에 얹을 수 없는 것"과 "미룰 수 있는 것" 구분

---

## Round 1: 도메인별 지적사항

### compliance-officer / legal-counsel — G1 개인정보 처리 체계 부재

> 스키마에 `management_package`(경영진 개인별 보상)와 `comp_benchmark`(급여 수준)가 있는데, 이건 명백한 개인정보보호법 적용 대상입니다. 계획 어디에도 수집 근거·보존기간·접근 통제·국외 이전 검토가 없습니다.
>
> 추가로 DD 자료 상당수는 NDA 대상입니다. **시스템에 적재하는 행위 자체가 NDA 위반인지**를 착수 시점에 판정해야 하는데 그 절차가 없습니다. 딜 무산 시 자료 반환·파기 의무도 마찬가지입니다.

**심각도**: 치명

### security-engineer — G2 프로젝트 단위 접근 통제 부재

> 권한 모델이 역할(`admin`/`analyst`/`viewer`) 하나뿐입니다. M&A 정보는 역할로 격리되지 않습니다 — 같은 `analyst`라도 A딜은 봐도 되고 B딜은 안 됩니다. **need-to-know는 역할이 아니라 멤버십입니다.**
>
> 특히 `admin`이 자동으로 모든 딜을 볼 수 있는 구조는 위험합니다. 시스템 관리 권한과 딜 정보 열람권은 별개여야 합니다.
>
> 그리고 이건 애플리케이션 레벨에서 필터를 거는 방식으로는 반드시 샙니다. 리포지토리 계층에서 강제해야 합니다.

**심각도**: 치명

### legal-counsel — G3 MNPI 관리 부재

> 상장사 관련 딜은 내부자거래 규제 대상입니다. 접근자 명부(insider list)를 유지하고 열람 기록을 남겨야 규제 대응이 됩니다. 지금 계획에는 없습니다.
>
> MCP가 특히 위험합니다 — AI 클라이언트가 MNPI를 아무 제약 없이 조회할 수 있는 구조입니다.

**심각도**: 높음

### financial-analyst — G4 환율 적용 시점 정책 부재

> 스키마에 `currency_id`만 있고 **어느 시점 환율을 쓰는지**가 없습니다. 해외 M&A에서 거래일/기간평균/기말 중 무엇을 쓰느냐가 결과를 크게 바꿉니다. 손익은 기간평균, 자산·부채는 기말, 거래 대금은 계약일이 원칙인데 이게 명시되지 않으면 매번 다른 답이 나옵니다.
>
> 그리고 run에 적용 환율을 스냅샷해야 사후 재현이 됩니다.

**심각도**: 높음

### data-architect — G5 보존·아카이빙 정책 부재

> `simulation_draw`가 1만 iteration × 실행 횟수로 무한 증가합니다. 자동 재분석까지 도입하면 증가 속도가 더 빨라집니다. 원시 draw는 일정 기간 후 아카이빙하고 분위수만 영구 보존해야 합니다. `raw_payload`도 같은 문제입니다.

**심각도**: 중간

### risk-officer — G6 MVP 경계·범위 축소 경로 부재

> 계획이 큽니다. 32 agents, 93 skills, 6 stage. 지금 구조로는 **전부 하거나 아무것도 못 하거나**가 됩니다. 일정이 밀렸을 때 무엇을 먼저 자를지 정해져 있지 않습니다.
>
> 그리고 이 프로젝트 자체의 중단 기준이 없습니다. Stage 3 수기 파일럿이 실패하면 어떻게 합니까?

**심각도**: 높음

### process-governance-manager — G7 전환 계획 부재

> 새 체계를 만드는 것과 기존 방식에서 갈아타는 것은 다릅니다. 각사가 지금 쓰던 방식에서 언제 어떻게 넘어오는지, 진행 중인 검토 건은 신규 규정을 적용할지 기존 방식으로 완주할지가 없습니다. 계열사 도입 순서와 저항 관리도 마찬가지입니다.

**심각도**: 중간

### pm — G8 조직 관점 성공 기준 부재

> 성공 기준이 시스템 관점(검증 통과, 스캔 0 Critical)만 있습니다. **시스템이 돌아가는 것과 조직이 쓰는 것은 다릅니다.** 채택률·효율·품질·지속성 지표가 필요합니다.

**심각도**: 중간

---

## Round 2: 심각도 재검토 — "나중에 얹을 수 있는가"

PM이 분류 기준을 제시: **나중에 얹을 수 있으면 미룰 수 있고, 없으면 지금 해야 한다.**

| 항목 | 나중에 얹을 수 있나 | 판정 |
|---|---|---|
| G1 개인정보 | **불가** — 수집 시점부터 근거가 있어야 하고, 이미 수집한 데이터는 소급 정당화가 안 됨 | **MVP 필수** |
| G2 접근 통제 | **불가** — 스키마·리포지토리·API·UI 전 계층에 걸림. 나중에 넣으면 전면 재작업 | **MVP 필수** |
| G3 MNPI | 부분 가능하나 G2와 같은 계층에 얹히므로 함께 하는 것이 합리적 | **MVP 필수** |
| G4 환율 | 가능하나 잘못된 값이 쌓이면 재계산 필요 | Stage 4 설계 반영 |
| G5 보존 | 가능 — 데이터가 커진 뒤에 넣어도 됨 | Tier 2 |
| G6 MVP 경계 | 지금 정해야 의미 있음 | Stage 1 즉시 |
| G7 전환 계획 | Stage 2에서 규정집과 함께 | Stage 2 |
| G8 성공 기준 | Stage 1에서 확정 | Stage 1 |

**security-engineer 보충**:
> G2를 Stage 5(인증 구현) 때 하려고 하면 이미 5.1~5.4에서 만든 모든 조회 코드를 다시 손봐야 합니다. `db/repositories/` 진입점에 프로젝트 컨텍스트 주입을 **처음부터** 넣어야 합니다.

**data-architect 동의**:
> 스키마에 `project_member`·`project_classification`이 Wave 5.1에 들어가야 합니다. 5.5로 미루면 그 사이 만든 테이블에 FK를 다시 걸어야 합니다.

---

## Round 3: 합의

1. **G1·G2·G3을 하나의 설계 절(§8.10 정보 보호)로 묶는다.** 세 개가 같은 계층에 얹히므로 분리하면 구현이 어긋난다.
2. **MVP 티어에 "정보 보호"를 축소 불가 항목으로 명시한다.** 웹 UI·MCP·알림은 미룰 수 있지만 이건 안 된다.
3. **`project_member`·`project_classification`을 Wave 5.1(DB 코어)에 포함**하고, 통제 로직 구현은 5.5에서 완성한다.
4. **미팅 아젠다에 M7-1(정보 보호)을 신설**한다 — security-engineer 진행, legal-counsel·compliance-officer·hr-integration·data-architect 참여.
5. **이 프로젝트의 중단 기준**: Stage 3 수기 파일럿 2회 연속 완주 실패 시 시스템 개발로 넘어가지 않고 프로세스 설계로 회귀.

---

## Decisions

| # | 결정 | 반영 위치 |
|---|---|---|
| D-1 | 정보 보호(개인정보·need-to-know·MNPI)를 독립 설계 절로 신설 | 설계문서 §8.10 |
| D-2 | 개인정보는 **최소 수집·집계 우선** — 경영진은 직위 기반 대체키, 급여는 직무군·직급 집계값만 | §8.10(b) |
| D-3 | **`admin`도 멤버십 없이는 딜 정보 접근 불가** | §8.10(a) |
| D-4 | 프로젝트 필터를 **리포지토리 계층에서 강제** | §8.10(a) |
| D-5 | MNPI 프로젝트는 **MCP 기본 응답에서 제외** | §8.10(c) |
| D-6 | 환율 정책 `fx_policy` 도입 + run 스냅샷 | §8.1 |
| D-7 | `retention_policy` 테이블 + 월간 배치 | §8.1 |
| D-8 | MVP 3티어 경계 정의, 정보 보호는 축소 불가 | §10.2 |
| D-9 | 전환 계획을 Stage 2 작업(2.7)으로 추가 | §10.5 |
| D-10 | 조직 관점 성공 기준 신설 | §13 |

---

## Action Items

| # | 액션 | 담당 | 반영 위치 | 상태 |
|---|---|---|---|---|
| A-1 | ADR-0038 프로젝트 단위 need-to-know 접근 통제 기안 | security-engineer | `docs/adr/0038-*.md` | 대기 (Stage 2) |
| A-2 | ADR-0039 개인정보 최소수집·집계우선 원칙 기안 | legal-counsel | `docs/adr/0039-*.md` | 대기 (Stage 2) |
| A-3 | ADR-0040 MNPI insider list·열람로그·MCP 제한 기안 | legal-counsel | `docs/adr/0040-*.md` | 대기 (Stage 2) |
| A-4 | ADR-0041 환율 적용 시점 정책 기안 | financial-analyst | `docs/adr/0041-*.md` | 대기 (Stage 2) |
| A-5 | ADR-0042 MVP 경계·축소 순서 기안 | risk-officer | `docs/adr/0042-*.md` | 대기 (Stage 2) |
| A-6 | 미팅 M7-1(정보 보호) 아젠다 편성 | pm | 설계문서 §10.4 | **완료** |
| A-7 | `project_member`·`project_classification`을 Wave 5.1 스키마에 포함 | data-architect | 설계문서 §10.8 | **완료** |
| A-8 | 전환 계획 작성 | process-governance-manager | `docs/transition-plan.md` | 대기 (Stage 2) |

---

## Open Issues (미해결 — 수용 리스크)

| # | 쟁점 | 사유 | 재논의 시점 |
|---|---|---|---|
| O-7 | **전체 일정·리소스 추정이 없다** | 32 agents / 93 skills / 6 stage의 소요 기간이 미산정. 사용자가 "언제 끝나냐"를 물으면 답할 수 없다 | Stage 1 M8 |
| O-1 | 각사(entity) 목록·코드 체계 미확정 | `md_entity` 시드를 만들 수 없음 | Stage 2 착수 전 |
| O-3 | 수기 파일럿 대상 건 미선정 | 실제 검토 건이 있어야 파일럿이 의미 있음 | Stage 3 착수 전 |
| O-5 | 기존 과거 검토 건의 초기 적재 여부 미결 | 넣는다면 기준정보 매핑 공수가 큼 | Stage 4 |

---

## Notes

- 본 회의는 `skills/meeting-facilitation` v1.4.0의 인라인 역할극 방식으로 진행됨 (에이전트 파일이 아직 생성되기 전 단계이므로 실제 `Agent` 디스패치는 불가)
- Stage 0.2에서 에이전트 로스터가 만들어진 뒤, Stage 1의 M0~M8은 실제 에이전트를 참여시켜 재실행한다
- 본 회의 결과는 그 재실행의 입력이지 대체가 아니다
