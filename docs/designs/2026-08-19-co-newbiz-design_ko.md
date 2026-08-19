# 설계: co-newbiz — 신사업 검토 시스템 구축·운영 AI Team

**Date**: 2026-08-19
**Status**: Approved
**Spec ID**: 2026-08-19-co-newbiz
**Scope**: `Projects/co-newbiz/` (신규 L3 variant, 자체 git repo) — 워크스페이스 루트에는 본 설계 문서와 memory/CHANGELOG 항목만 추가
**Language**: 한국어 (`docs/designs/` 는 `scripts/validate-md-language.ts` 의 `isOfficialDocument()` 허용 목록 밖이며, `_ko` 접미사는 `isI18nLocalePath()` i18n 예외에 해당)

> **이 문서의 목적**: 설계 논의가 Claude Code 전용 경로(`~/.claude/plans/`)에만 남으면 Gemini CLI·Antigravity·Codex 및 미래 세션이 참조할 수 없다. 리포지토리에 정식 설계 문서로 고정한다.

---

## 1. 문제 정의

### 1.1 배경

Green Field(신규 설립)와 Brown Field(M&A) 양쪽을 다루는 신사업 검토 역량이 필요하다. 기존 `templates/co-consult`(11 agents / 19 skills)는 일반 전략 컨설팅용이라 본 도메인의 요구를 담지 못한다.

### 1.2 해결할 문제 15가지

| # | 문제 |
|---|---|
| 1 | 보고서가 손으로 쓰인 정적 문서라, 금리·유가·환율이 바뀌면 처음부터 다시 쓴다 |
| 2 | 세부 부품 산업은 직접 데이터가 없다. 크랭크축 → 선박엔진(BHP) → 선박(CGT) 두 단계를 건너뛰어 추정해야 하는데 환산이 애드혹이라 재현성·오차 관리가 안 된다 |
| 3 | 데이터가 파일로 흩어져 정합성이 없다. 단위가 문자열로 떠다녀 잘못된 환산을 막을 수 없다 |
| 4 | 이력이 없다. 3개월 전 검토와 지금 검토가 왜 다른지 설명할 수 없다 |
| 5 | 개인 작업물이라 공유·통제·감사가 안 된다 |
| 6 | 한 번 검토하고 덮어두면 시장이 좋아져도 모른다 |
| 7 | 판단 결과가 장문의 보고서라 의사결정자가 빠르게 파악할 수 없다 |
| 8 | 업계·사내 용어가 난무해 처음 접하는 사람이 이해할 수 없다 |
| 9 | **검토 절차·규정이 문서로만 있고 시스템과 따로 논다. 규정이 바뀌어도 시스템은 그대로다** |
| 10 | 그룹 공통 프로세스와 각사·지역별 고유 프로세스가 뒤섞여 관리가 안 된다 |
| 11 | 신규 진출 사업이 전·후방 산업과 어떻게 얽혀 있는지 정량적으로 보지 않는다. 원가 전가력·수요 파생 강도를 모르면 마진 가정이 근거를 잃는다 |
| 12 | M&A에서 딜 가격 외 비용이 모델에 안 들어간다. 경영진 보상 트리거, 급여 상향 평준화, 우발채무 — 셋 다 클로징 후에야 드러난다 |
| 13 | 각사 검토와 그룹 검토가 구분되지 않는다. 그룹은 다른 질문(포트폴리오 중복, 일감 몰아주기, 자본 배분 우선순위)을 던져야 하는데 같은 서류를 다시 본다 |
| 14 | 공장 부지를 인프라·비용만으로 고르고 지역 인센티브를 뒤늦게 알아본다. 협상 여지가 가장 큰 시점은 부지 확정 전이다 |
| 15 | 협력 파트너 확보가 계획이 아니라 즉흥이다. 파트너 없이는 못 하는 사업인데 확보 실패 시나리오가 모델에 없다 |

**#9가 이 프로젝트의 중심 문제다.** 나머지 대부분은 #9의 파생이거나 #9 없이는 지속되지 않는다.

---

## 2. 팀의 목적

> 신규 사업 추진에 필요한 **규정·절차·가이드라인·체크리스트 등 제반 절차를 소유·운영**하고, 동시에 **이를 시스템으로 구현해 효과적으로 운영되도록 유지보수**한다.

두 축은 **동등하다**. 어느 하나가 다른 하나의 부속이 아니다.

| 축 | 내용 |
|---|---|
| **A. 거버넌스 소유·운영** | 규정·절차·가이드라인·체크리스트·양식의 제정·개정·해석·배포·교육, 그리고 준수 점검·예외 승인·성과 측정까지의 상시 운영 |
| **B. 시스템 구현·유지보수** | A를 시스템으로 구현하고, 서버·DB를 고도화·배포·운영하며, 인프라 자동화와 보안 점검으로 지속 가능하게 유지 |

**이 팀이 하지 않는 일**: 개별 딜을 직접 분석하지 않는다. 실제 검토는 이 팀이 만든 규정·절차와 시스템 위에서 사람 분석가와 AI 클라이언트(MCP 경유)가 수행한다.

---

## 3. 확정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 위치 | 신규 variant Phase A → `Projects/co-newbiz/` (자체 git repo) | `create-variant` 스킬의 문서화된 경로. co-consult(stable) 오염 방지 |
| 스캐폴드 | `bun scripts/create-l3-scaffold.ts co-newbiz --domain consulting` | `create-l3-scaffold.ts:560` `DOMAIN_DOC_DIRS` 에서 consulting만 `deliverables/{reports,drafts,research,presentations}` 레이아웃 제공 |
| 데이터 소스 | FRED + 한국은행 ECOS + World Bank/IMF + DART(k-dart) + 법제처(k-law) | |
| 언어 | 산출물·UI 한국어 / 코드·에이전트·스킬·문서 영어 | CLAUDE.md §4 |
| DB | SQLite (`bun:sqlite`, WAL) — Postgres 이전 가능하도록 벤더 중립 설계 | 사내 서버 5~20명 규모에 충분, 무설치 |
| 버전 관리 | 전수 스냅샷 + 귀인분석, 보고서·시뮬레이션 포함 전면 | |
| 문서 출력 | Python (python-docx / reportlab / python-hwpx) | 외부 바이너리(LibreOffice·MS Word·GTK) 의존 제거 |
| 웹 스택 | Hono(API) + React/Vite + ECharts | Hono는 `package.json` `overrides` 에 이미 고정, Bun 네이티브 |
| 운영 형태 | 사내 서버, 5~20명 동시 | |
| MCP | REST API 경유 + stdio | 권한·감사를 단일 지점에서 집행 |
| 팀 편성 | 4개 도메인(기능·기술·산업·지역) + PM 통괄, 32 agents | `Projects/safety_os` 패턴 차용 |
| 설계 추적 | ADR 체계 (co-newbiz 로컬 시퀀스 0001~0044) | |

### 3.1 전제 조건

`.gitignore:10` 의 `/*/` 규칙으로 **`Projects/` 는 ai_workspace repo에서 추적되지 않는다.** 실제 작업은 `Projects/co-newbiz/` 자체 repo에서 이뤄지고, ai_workspace repo에는 본 설계 문서·memlog·CHANGELOG만 남는다. `/sync`는 두 repo에서 각각 실행한다.

`templates/common/docs/adr/` 는 `.gitkeep`만 있는 빈 디렉터리다 — 스캐폴드는 빈 `docs/adr/`만 만들며 ADR 본문·인덱스는 직접 작성한다.

---

## 4. 재사용할 기존 자산

계획의 상당 부분은 새로 만들지 않는다.

| 자산 | 경로 | 용도 |
|---|---|---|
| **PBKDF2 인증 라이브러리** | `scripts/lib/auth.ts` | PBKDF2-HMAC-SHA256, 210,000 iter, 16B salt, 32B key (OWASP 2023). 단방향이라 관리자도 원문을 못 본다 |
| **SSRF 방어** | `scripts/lib/ssrf.ts` | `safeFetch()` — DNS 리바인딩 차단. 모든 외부 API 호출이 경유 |
| **MCP 서버 패턴** | `Projects/co-architect/mcp/` | `@modelcontextprotocol/sdk` + stdio, `index.ts` + `tools/*.ts` + `shared/{logger,errors,rate-limiter,retry,types}.ts`, `.mcp.json` 등록 형식 |
| **MCP 캐시** | `Projects/co-architect/scripts/lib/mcp-cache.ts` | 외부 API 응답 캐싱 |
| **재무 분석 파이프라인** | `templates/co-consult/skills/financial-statement-analysis/` v1.3.0 + `python/{validate,normalize,kpi,driver_tree}.py` | DART 수집 → 회계 정합성 검증 → IFRS 캐노니컬 정규화 → KPI → **5단계 ROIC 밸류 드라이버 트리** |
| **TS→Python 오케스트레이션** | `templates/co-consult/scripts/co-consult/financial-pipeline.ts:36-60` | Windows `shell:true` + `winQuote()` 인젝션 방어 |
| **IFRS 계정 매핑** | `templates/co-consult/python/mappings/ifrs_general.json` | `md_account` 기준정보로 사용 |
| **거버넌스 구조 패턴** | `Projects/safety_os/` | `agents/{_core,_shared,domains}`, `policies/`·`regulations/`·`workflows/`, `industry-profiles/*.yaml` + `_validate.ts` |
| **워크플로우 참조·오버라이드 스펙** | `Projects/safety_os/workflows/_shared/REFERENCE-SPEC.md` | 공통 절차를 복사하지 않고 `references:` + 차분만 선언 |
| **용어집 툴링 연동 선례** | `Projects/safety_os/regulations/KR/legal-glossary.yaml` | `validate-md-language.ts` 가 키를 allowlist로 소비 → 용어집이 죽지 않는 이유 |
| **컨설팅 스킬 10종** | `templates/co-consult/skills/` | §8 참조 |
| **워크스페이스 스킬 6종** | `skills/` | `security-scan`, `stride-threat-matrix`, `sarif-exporter`, `accessibility-audit`, `zod-contract-gate`, `k-dart` |

---

## 5. 팀 구조

### 5.1 거버넌스 제약

워크스페이스는 **평면적 PM Gateway**를 4단계로 강제한다 (`AGENTS.md §3.1.3`):
① Tool-Level에서 비-PM의 specialist 호출 **거부** ② System Prompt ③ Agent File("PM-ONLY INVOCATION") ④ QA Gate.

safety_os도 동일하다 — `Safety Governance Manager`·`Safety Workflow Manager`가 High tier로 있지만 PM Gateway는 유지된다. 즉 **도메인 리드는 디스패처가 아니라 설계·검토 책임자**다.

**PM 운영 루프**: ① PM이 4개 도메인 리드를 디스패치해 도메인 계획을 받는다 → ② PM이 실행 계획 표로 확정 → ③ PM이 실무 에이전트를 직접 디스패치 → ④ 도메인 리드가 결과를 read-only 검토.

병렬이 필요하면 Agent Teams(`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, `.claude/settings.json` 활성)로 teammate 실행.

### 5.2 4개 도메인

| 도메인 | 관심사 | 리드 | 인원 |
|---|---|---|---|
| **기능 (functional)** | 신사업 추진 관련 **규정·절차·운영** — 거버넌스와 검토 방법론 | `process-governance-manager` | 19 |
| **기술 (technical)** | **시스템 구성 및 운영** — DB·API·UI·배포·운영·보안 | `platform-lead` | 9 |
| **산업 (industry)** | 해당 **산업의 특성** 반영 | `industry-lead` | 1 |
| **지역 (region)** | **국내 포함 지역적 특성** 반영 | `region-lead` | 1 |

```
agents/
  _core/
    pm.md                              # 전체 통괄 (PM override)
  domains/
    functional/                        # ① 기능 — 규정·절차·운영
      _lead/process-governance-manager.md
      governance/   compliance-officer, glossary-curator, legal-counsel, risk-officer
      analysis/     market-intelligence, financial-analyst, quant-methodologist, valuation
      greenfield/   greenfield-agent
      brownfield/   brownfield-agent, antitrust, customer-retention, incentive,
                    hr-integration, pmi
      dd/           commercial-dd, technical-dd
      partnership/  partnership-agent
      group/        group-review-agent
    technical/                         # ② 기술 — 시스템 구성·운영
      _lead/platform-lead.md
      data/         data-architect, dba
      app/          backend-engineer, frontend-engineer
      ops/          release-engineer, sre, infra-automation-engineer
      security/     security-engineer
    industry/                          # ③ 산업 특성 (프로파일 구동)
      _lead/industry-lead.md
      _template/
    region/                            # ④ 지역 특성 (프로파일 구동)
      _lead/region-lead.md
      _template/
  _shared/
    docs-writer.md                     # 4개 도메인 어디에도 속하지 않는 진짜 공통
```

> **4축 분리의 이유**: 이전 설계는 `_shared`에 `compliance-officer`(거버넌스)와 `dba`(시스템 운영)를 같이 두었다. 관심사가 완전히 다른데 한 묶음이라 PM이 누구와 무엇을 논의할지 흐려진다. 4축 분리로 **PM ↔ 도메인 리드 4명**의 대화 구조가 명확해진다.
>
> **하위 그룹(`governance/`, `analysis/` 등)은 디렉터리·문서상의 정리이지 디스패치 계층이 아니다.** 평면 PM Gateway 제약은 그대로다.

### 5.3 기능 도메인 (19)

| Agent | Tier | 역할 |
|---|---|---|
| **`_lead/process-governance-manager`** | High | **도메인 리드.** 규정·절차·가이드라인·체크리스트 제정·개정 소유, 문서 5계층 관리, RAG 판정체계, 규정 변경의 시스템 반영 통제 |
| `governance/compliance-officer` | High | **거버넌스 운영** — 준수 점검, waiver 심사, 해석례 축적, 교육·공지, 운영 KPI |
| `governance/legal-counsel` | High | 국내외 법령·계약·규제 자문, 인허가 경로, NDA·정보관리 판정 |
| `governance/risk-officer` | High | Red team — 낙관편향 감사, base rate 검증, Kill Criteria 집행 |
| `governance/glossary-curator` | Medium | 용어집 소유 — 등록·검수·중복 병합·툴링 연동 |
| `analysis/market-intelligence-agent` | High | TAM/SAM/SOM, 수요 예측, 경쟁사 증설, **전·후방 산업 연관성 분석** |
| `analysis/financial-analyst` | High | 과거 재무 분석·피어 벤치마크·QoE·성장성 예측 방법론 |
| `analysis/quant-methodologist` | High | 프록시 체인·단위환산·회귀보정·lead-lag·오차전파·귀인분석 |
| `analysis/valuation-agent` | High | DCF/NPV/IRR/Payback/DSCR, WACC 조립, 시나리오·몬테카를로, **부채·우발채무 시뮬레이션**, 밸류에이션 브리지 |
| `greenfield/greenfield-agent` | High | 신규 설립 — 부지·인프라·인재 확보·지역 상생·인허가·ramp-up |
| `brownfield/brownfield-agent` | High | M&A — 타겟 스크리닝, 딜 구조, 카브아웃 |
| `brownfield/antitrust-agent` | High | 독과점·기업결합신고 — 시장획정, HHI, 관할별 신고, 시정조치 |
| `brownfield/hr-integration-agent` | High | 경영진 보상 조건·임직원 급여·복지 정합성·노사·인력 통합 |
| `brownfield/customer-retention-agent` | Medium | 인수 후 고객 이탈 — change of control 조항, 집중도, 경쟁중복 |
| `brownfield/incentive-agent` | Medium | 정책 혜택 획득·환수 양방향 |
| `brownfield/pmi-agent` | Medium | PMI 계획, 시너지 실현, 통합 리스크 |
| `dd/commercial-dd-agent` | Medium | CDD — 고객·가격결정력·채널체크·전문가 인터뷰 |
| `dd/technical-dd-agent` | Medium | TDD — 현장실사, 설비 잔존수명, TRL, 인증, EHS, capex 검증 |
| `partnership/partnership-agent` | Medium | 협력 파트너 확보 — 소싱 전략, 파트너 실사, JV 구조화 |
| `group/group-review-agent` | High | 그룹 차원 검토 — 포트폴리오 정합성, 내부거래 규제, 자본 배분 우선순위 |

### 5.4 기술 도메인 (9)

| Agent | Tier | 역할 |
|---|---|---|
| **`_lead/platform-lead`** | High | **도메인 리드.** 아키텍처 결정, 기술 ADR 기안, 릴리스 범위, 기능 도메인 요구의 기술 번역 |
| `data/data-architect` | High | ERD·기준정보·정규화·인덱스·마이그레이션·이식성 |
| `data/dba` | Medium | DB 운영, 백업·복원·복구훈련, 성능 튜닝, 용량 관리 |
| `app/backend-engineer` | Medium | Hono API, 인증, MCP 서버, 분석 엔진 CLI, 감시·알림 |
| `app/frontend-engineer` | Medium | React/Vite UI, ECharts, RAG 대시보드, 관리자 콘솔, 접근성 |
| `ops/release-engineer` | Medium | 빌드·배포, 마이그레이션 실행 순서, 롤백 |
| `ops/sre` | Medium | 모니터링·알림, 로그 파이프라인, 인시던트 대응·사후분석 |
| `ops/infra-automation-engineer` | Medium | OS 구성, 서비스 등록, 정기 수집 스케줄러, 헬스체크·정리 |
| `security/security-engineer` | High | 위협 모델, 보안 기준선, 취약점·시크릿, **접근통제·개인정보·MNPI 구현** |

### 5.5 산업·지역 도메인 (각 1 + 프로파일)

| Agent | Tier | 역할 |
|---|---|---|
| **`industry/_lead/industry-lead`** | High | `industry-profiles/*.yaml` 체계 소유. 산업별 밸류체인 구조, 사이클 특성, 규제 지형, 기술 전환(예: IMO 탈탄소), 원단위·벤치마크 기준 정의 |
| **`region/_lead/region-lead`** | High | `region-profiles/*.yaml` 체계 소유. **국내 포함** 지역별 기업결합신고·외국인투자심사·노동·세제·송금·제재·데이터이전·환경책임·인센티브 제도 정의 |

**프로파일 우선 원칙**: safety_os는 산업마다 에이전트를 두지만(`semicon-agent`, `battery-agent`…) 동시에 `industry-profiles/*.yaml` + `_validate.ts` 로 데이터를 분리한다. 이 프로젝트는 프로파일을 먼저 쓴다 — **산업·지역은 판단보다 데이터가 본질**이므로 로스터 크기가 아니라 프로파일 개수로 확장된다.

**승격 규칙** (safety_os Tier-1/Tier-2 성숙도 바 차용): 특정 산업·지역의 고유 절차가 **5개를 넘고** 프로파일로 표현하기 어려운 판단이 필요해지면 전용 에이전트(`domains/region/us/us-agent.md`)로 승격한다.

### 5.6 총계

**32 agents** — `_core` 1 + 기능 19 + 기술 9 + 산업 1 + 지역 1 + `_shared` 1.

축 A(거버넌스·검토)가 19명, 축 B(시스템)가 9명. 산업·지역은 두 축 모두에 입력을 제공하는 횡단 도메인이다. **거버넌스가 시스템의 부속이 아니라는 팀 목적이 로스터 구성에 그대로 드러난다.**

### 5.7 교차 검증 (Phase 1.5)

**원칙: 검증자는 반드시 다른 도메인에서 온다.** 같은 도메인 안에서만 검토하면 공통 사각지대가 남는다.

| 산출물 | 1차 작성 | 교차 검증자 (read-only) |
|---|---|---|
| 방법론·모델 사양 | 기능 | **기술** `data-architect`(스키마 표현 가능성) · 기능 내 `quant-methodologist` ↔ `financial-analyst` |
| RAG 판정 규칙 | 기능 `process-governance-manager` | 기능 `financial-analyst`(임계값) · `quant-methodologist`(신뢰도 캡) |
| 규정·절차 변경 | 기능 `process-governance-manager` | 기능 `legal-counsel`·`risk-officer` + **기술** `platform-lead`(시스템 반영 가능성) |
| M&A 검토 | 기능 `brownfield-agent` | 기능 `antitrust`·`customer-retention`·`incentive`·`hr-integration` + **지역** `region-lead` — 5개 동시 필수 |
| 부채·우발채무 | 기능 `valuation-agent` | 기능 `legal-counsel`(소송·보증·환경책임)·`financial-analyst`(미적립 퇴직급여) |
| 경영진·임직원 보상 | 기능 `hr-integration-agent` | 기능 `legal-counsel`·`valuation-agent` + **지역** `region-lead`(TUPE·works council) |
| 전·후방 연관성 | 기능 `market-intelligence-agent` | 기능 `quant-methodologist` + **산업** `industry-lead` |
| 신규 설립 검토 | 기능 `greenfield-agent` | 기능 `legal-counsel`·`technical-dd` + **지역** `region-lead`(인센티브 제도) |
| **정보 보호 설계** | 기술 `security-engineer` | **기능** `legal-counsel`(개인정보·MNPI 법적 요건)·`compliance-officer`(운영 실현성) |
| DB 스키마·API | 기술 `data-architect` | 기술 `security-engineer`·`dba` + **기능** `process-governance-manager`(규정 표현 충실성) |
| 배포·인프라 자동화 | 기술 `release-engineer`·`infra-automation-engineer` | 기술 `sre`·`security-engineer` |
| 프로파일 스키마 | 산업/지역 `*-lead` | **기술** `data-architect` + **기능** `process-governance-manager` |

### 5.8 정기 운영 리듬 (`docs/ops-cadence.md`)

| 주기 | 작업 | 담당 |
|---|---|---|
| **일간** | 헬스체크, 백업 확인, 수집 배치 결과·실패, 오류 로그 트리아지, 알림 발송 큐 | `sre` |
| **주간** | 의존성 취약점 스캔, 감사 로그 리뷰, 용량 추이, staleness 리포트, 오탐 알림 리뷰, 미정의 용어 리포트, **준수 점검 리포트·만료 임박 waiver** | `security-engineer`, `dba`, `glossary-curator`, `compliance-officer` |
| **월간** | **복구 훈련**, 접근권한 재검토, 쿼리 성능 리뷰, **RAG 임계값 캘리브레이션**, 거버넌스 KPI 집계, 해석례 검수·공표 | `dba`, `security-engineer`, `process-governance-manager`, `compliance-officer` |
| **분기** | 위협 모델 갱신, DR 훈련, 기준정보 정합성 감사, **프록시 체인 재보정**, **규정·절차 정기 검토**(waiver 집중 조항·해석 질의 주제를 개정 우선순위로), 지역 프로파일 갱신, 온보딩 자료 갱신 | `security-engineer`, `platform-lead`, `process-governance-manager`, `compliance-officer`, `region-lead` |
| **연간** | 전 거버넌스 문서 정기 재검토(`governance_doc.review_cycle_months` 기준 만료 문서 강제 재승인), 규정 체계 전면 회고 | `process-governance-manager`, `compliance-officer` |

> **복구 훈련 월간**: 백업 성공 로그와 실제 복원되는 사실은 다르다. 훈련 없는 백업은 백업이 아니다.
> **RAG 임계값 캘리브레이션 월간**: 임계값이 틀리면 신호등이 전부 Amber가 되어 아무도 안 본다.

---

## 6. 거버넌스 체계

### 6.1 문서 5계층 — 강제력이 다르면 관리도 달라야 한다

"이건 꼭 해야 하나요?"에 답할 수 없으면 거버넌스가 아니다.

| 계층 | 성격 | 강제력 | 개정 권한 | 승인 |
|---|---|---|---|---|
| **규정 (Policy)** | 무엇을 지켜야 하는가 | **의무** — 위반 시 제재, 예외는 waiver 필요 | process-governance-manager | 그룹 심의 |
| **절차 (Procedure)** | 어떤 순서로 하는가 | **의무** — 단계 생략 시 게이트 차단 | 도메인 리드 | process-governance-manager |
| **가이드라인 (Guideline)** | 어떻게 하면 좋은가 | **권고** — 미준수 시 사유 설명 | 도메인 에이전트 | 도메인 리드 |
| **체크리스트 (Checklist)** | 무엇을 빠뜨리지 말아야 하는가 | 항목별 `mandatory: true\|false` | 도메인 에이전트 | 도메인 리드 |
| **양식 (Template)** | 어떤 형태로 산출하는가 | 권고 | docs-writer | 도메인 리드 |

> **규정과 가이드라인을 섞지 않는 것이 핵심.** 전부 "의무"로 만들면 현장이 형식적으로 우회하고, 전부 "권고"로 만들면 아무도 안 지킨다.

```sql
governance_doc(id, layer, key, title, scope, entity_id, region_code, level,
               version, enforceability, owner_agent, approver_role,
               effective_from, superseded_by, doc_path, review_cycle_months)
   -- layer: policy | procedure | guideline | checklist | template
   -- enforceability: mandatory | recommended | mixed
```

### 6.2 디렉터리 구조

```
policies/
  group/neb-policy.md                 # 그룹 신사업 검토 규정 (최상위)
  entities/<company>/addendum.md       # 각사 추가 규정
regulations/
  KR/<framework>.yaml                  # 국내 법령 (k-law/MCP 소스)
  <ISO2>/<framework>.yaml              # 해외 법령
procedures/
  _shared/<proc>/{README.md,schema.yaml}      # 그룹 공통 절차 (scope=shared)
  entities/<company>/<proc>/schema.yaml       # 각사 절차 — references: + overrides
  regions/<ISO2>/<proc>/schema.yaml           # 지역 특이 절차
  group/<proc>/schema.yaml                    # 그룹 심의 전용 절차 (level=group)
  _template/
guidelines/ · checklists/ · templates/deliverables/
region-profiles/{_schema.yaml,_validate.ts,KR.yaml,US.yaml,EU.yaml,CN.yaml,SEA.yaml,…}
industry-profiles/{_schema.yaml,_validate.ts,…}
glossary/{_schema.yaml,_validate.ts,business,financial,legal,technical,industry}.yaml
```

### 6.3 그룹 공통 + 각사 고유 — `references:` 오버라이드

**safety_os `workflows/_shared/REFERENCE-SPEC.md` 의 검증된 메커니즘을 채택.** 공통 절차를 **복사하지 않고** 참조 + 차분만 선언한다.

```yaml
# procedures/entities/kr-ops/brownfield-screening/schema.yaml
schema_version: "1.0"
procedure_id: kr-ops-brownfield-screening
scope: entity
entity: kr-ops
references:
  - shared: ../../../_shared/brownfield-screening
overrides:
  add_steps:
    - after: 3
      step: { action: internal_board_prescreen, owner: 전략기획실 }
  replace_steps:
    - id: 5
      step: { action: valuation_review, approver: CFO }
  thresholds:
    min_deal_size_krw: 30_000_000_000
legal_basis: [...]      # safety_os 규칙 차용 — 최소 3개, 감사 스크립트가 검증
```

**중복 금지 원칙**: 공통 절차는 단 한 곳에만 존재한다. **그룹 규정이 바뀌면 모든 각사·지역 절차가 자동으로 따라간다.** 각사가 복사본을 들면 이 성질이 깨지므로 감사 스크립트가 복사본을 탐지해 차단한다.

**병합 우선순위**: `_shared` → `regions/<code>` → `entities/<company>` (뒤가 앞을 덮음). 충돌 시 명시적 선언만 허용하고 암묵적 병합은 금지 — 어느 규정이 적용됐는지 항상 추적 가능해야 한다.

### 6.4 각사 → 그룹 2단계 승인 체인

`scope`(누구의 절차인가)와 `level`(어느 단계 심의인가)은 **직교한다**.

```
procedure.scope ∈ { shared, entity, region }
procedure.level ∈ { entity, group }
```

**스테이지 게이트**: `Screening → Pre-FS → FS → DD → Entity IC → Group IC`

**시스템이 강제한다**: Entity IC 승인 없이 Group 레벨 절차에 진입할 수 없다.

**그룹 검토는 각사 검토의 반복이 아니다** — 각사가 구조적으로 볼 수 없는 것을 본다:

| 검토 축 | 왜 각사가 못 보나 |
|---|---|
| 포트폴리오 정합성 | 다른 계열사 사업과 중복·잠식인지는 그룹만 안다 |
| **내부거래·공정거래** | 일감 몰아주기 규제(공정거래법 §47 특수관계인 부당이익제공) |
| **자본 배분 우선순위** | 여러 계열사 안건이 한정된 자본을 두고 경쟁. 각사 IRR만으로는 순위를 못 매긴다 |
| 그룹 신용도·차입 여력 | 계열 전체 부채비율·신용등급 영향 |
| 지주회사 규제 | 독점규제법상 지주회사 행위제한 |
| 브랜드·평판 리스크 | 한 계열사 문제가 그룹 전체로 번진다 |

> **자본 배분 우선순위가 실무에서 가장 중요하다.** 각사 기준 전부 Green인 안건 다섯 개가 올라와도 그룹이 다 할 수는 없다. **그룹 IC는 승인/부결이 아니라 순위 결정**인 경우가 많다.

```sql
approval_chain(id, project_id, level, gate, sequence, required_procedure_id,
               approver_role, entity_id, status, decision, decided_at,
               conditions, blocked_reason)
group_agenda(id, cycle, project_id, entity_id, submitted_at, capital_request,
             priority_rank, decision, rationale)
```

### 6.5 규정 변경 → 시스템 반영 파이프라인

```
[1] 규정 개정  policies/group/neb-policy.md v1.2 → v1.3
       ↓  ADR 필수
[2] 영향 분석  procedure-impact-analysis
       바뀐 조항 → 영향받는 procedure / rag_rule / assumption / 체크리스트 / 용어 식별
       ↓
[3] 변경 계획  process-governance-manager 수립 → PM 승인
       ↓
[4] 시스템 반영  procedure schema · rag_rule · 체크리스트 · 글로서리 갱신
       ↓
[5] 소급 적용 판정  project_policy_pin 으로 착수 시점 규정 고정
       신규 규정 적용은 명시적 마이그레이션으로만
       ↓
[6] 통지  영향받는 프로젝트 담당자에게 알림
```

**`project_policy_pin`이 핵심이다.** 이게 없으면 규정이 바뀐 날 아침 어제 Green이던 프로젝트가 이유 없이 Red가 되고 아무도 왜인지 모른다.

**법령 개정 자동 감지**: `regulations/**.yaml` 은 `k-law` MCP로 주기 재조회되어 시행일·개정을 감지하고 [1]을 자동 발화시킨다.

```sql
policy(id, scope, entity_id, region_code, name, version, effective_from, superseded_by, doc_path)
procedure(id, procedure_key, scope, entity_id, region_code, version, references_id,
          spec_json, effective_from)
project_policy_pin(project_id, policy_id, policy_version, pinned_at, pinned_by, migration_note)
policy_change(id, policy_id, from_version, to_version, summary, adr_ref, detected_at, applied_at)
policy_impact(policy_change_id, target_type, target_id, impact, action, status)
```

### 6.6 거버넌스 운영 — 만드는 것과 굴리는 것은 다르다

규정 제정은 축 A의 절반이다. 나머지 절반은 **상시 운영**이며, 이게 빠지면 규정집은 서랍 속 문서가 된다. `compliance-officer` 소관.

**(a) 준수 점검** — 게이트 통과 시 필수 산출물 누락 검사(시스템 자동 차단), 체크리스트 필수 항목 미완료·절차 단계 생략 탐지, 주기 리포트

**(b) 예외·면제 (Waiver)** — 실무에서 반드시 발생한다. 없는 척하면 **음성적으로 우회**한다.
- 승인 권한: 규정=그룹 심의 / 절차=process-governance-manager / 체크리스트 항목=도메인 리드
- **만료일 필수** — 무기한 waiver는 사실상 규정 폐지
- **누적 모니터링: 같은 조항에 waiver가 반복되면 규정 자체가 현실과 안 맞는 것 → 개정 트리거**

**(c) 해석례 (Interpretation Registry)** — "이 조항이 우리 케이스에 적용되나요?" 질의·답변 축적. 법제처 법령해석례와 같은 구조. 쌓이면 지식자산이 되고, 같은 질문에 다른 답이 나가는 것을 막는다.

**(d) 교육·공지** — 신규 담당자 온보딩, 규정 개정 시 영향 대상자 자동 공지, 개정 이력 요약

**(e) 운영 KPI**

| 지표 | 의미 |
|---|---|
| 게이트별 소요 기간(중위값) | 절차가 병목인가 |
| 게이트 반려율 | 상류 품질이 낮은가, 기준이 과한가 |
| 체크리스트 완료율 | 형식적 통과가 있는가 |
| **waiver 발생 건수·집중 조항** | 규정이 현실과 안 맞는 지점 |
| 재작업률 | 어느 단계에서 되돌아가는가 |
| 해석 질의 건수·주제 | 어느 조항이 모호한가 |

> **waiver 집중 조항과 해석 질의 주제가 다음 개정의 우선순위를 정한다.** 개정을 감이 아니라 데이터로 한다.

```sql
compliance_check(id, project_id, gate, rule_key, layer, result, detected_at, resolved_at)
waiver(id, project_id, governance_doc_id, clause_ref, reason, requested_by,
       approver_role, approved_by, approved_at, expires_at, status)
interpretation(id, governance_doc_id, clause_ref, question, answer, asked_by,
               answered_by, answered_at, supersedes, published)
governance_kpi(id, period_id, entity_id, metric_key, value, note)
```

**게이트 차단 규칙**: 필수 산출물 누락 또는 미완료 필수 체크리스트 항목이 있으면 **유효한 waiver 없이는 게이트를 통과할 수 없다.** 이것이 규정을 문서에서 시스템으로 끌어내리는 지점이다.

### 6.7 해외 지역 프로파일

`region-profiles/<ISO2>.yaml` — 지역별 필수 항목:

```yaml
code: US
name_ko: 미국
merger_control:
  regime: HSR (Hart-Scott-Rodino)
  authority: FTC / DOJ
  waiting_period_days: 30
  gun_jumping_prohibited: true
foreign_investment_screening:
  regime: CFIUS
  mandatory_filing_triggers: [...]
labor:
  works_council_consultation: false     # EU는 true — 누락 시 딜 지연
  collective_notice_days: 60            # WARN Act
tax: { withholding, transfer_pricing, exit_tax, treaty }
fx_and_repatriation: {...}
anti_corruption: [FCPA]
sanctions_screening: [OFAC]
data_transfer: {...}
environmental_liability_succession: {...}
incentives: {...}
typical_closing_weeks: 16
```

**필수 검토 축**: 기업결합신고 / 외국인투자심사(CFIUS·EU FSR·산업기술보호법) / **노동(EU 근로자대표 협의 의무 — 빠뜨리면 클로징 지연)** / 세제·이전가격 / 송금·외환 / 부패방지(FCPA·UK Bribery Act) / 제재(OFAC) / 데이터 이전(GDPR) / 환경책임 승계 / 인센티브·환수.

`_validate.ts`가 필수 필드 누락을 차단한다.

---

## 7. 용어집

### 7.1 설계 원칙 — 툴링이 소비해야 죽지 않는다

safety_os의 `regulations/KR/legal-glossary.yaml` 이 살아 있는 이유는 **`validate-md-language.ts` 가 그 키를 allowlist로 소비**하기 때문이다. 아무도 안 보는 용어집은 6개월 뒤 폐기된다. **처음부터 4곳에 물린다.**

### 7.2 항목 형식

```yaml
version: 1.0.0
last_updated: 2026-08-19
terms:
  CGT:
    ko: 표준화물선환산톤수
    en: Compensated Gross Tonnage
    definition_ko: 선박의 건조 난이도를 반영해 총톤수(GT)를 보정한 조선업 표준 생산량 단위.
    why_it_matters_ko: 선박 시장 규모를 척수나 GT가 아닌 CGT로 봐야 건조 물량을 비교할 수 있다.
    category: unit
    aliases: [보정총톤수]
    related: [GT, DWT, BHP]
    used_in: [proxy-industry-chain, unit-conversion-calibration]
    source: OECD 조선작업부회(WP6)
    owner: quant-methodologist
```

`definition_ko` 외에 **`why_it_matters_ko`를 필수로 둔다** — 정의만 있으면 "그래서 뭐?"가 남는다. 처음 접하는 사람에게 필요한 건 정의가 아니라 맥락이다.

### 7.3 툴링 연동 4곳

| 연동 지점 | 동작 |
|---|---|
| **웹 UI** | 본문의 등록 용어에 점선 밑줄 → 호버/클릭 시 정의 팝오버. `/api/glossary/:term` |
| **보고서 생성** | 문서에 등장한 용어만 추려 **말미에 용어 부록 자동 생성** |
| **검증(`glossary-lint`)** | 스킬·문서·UI 문자열에서 정의되지 않은 약어·전문용어 탐지 → 주간 리포트 |
| **MCP** | `lookup_term` 도구 — AI 클라이언트가 사내 용어를 정확히 해석 |

---

## 8. 시스템 설계

### 8.1 데이터 아키텍처

**3계층**: `raw_payload`(원문 보존 — 정규화 버그 시 API 재호출 없이 재처리) → `md_*`/`fact_*`(정규화 ERD) → `v_*`(조회 최적화).

**기준정보(Master Data)** — 무엇을 기준으로 삼는가:

| 마스터 | 기준 코드 체계 | 지정 이유 |
|---|---|---|
| `md_industry` | **KSIC**, NAICS·ISIC 매핑 보유 | **전방·전전방 연결의 축.** 없으면 프록시 체인 불가 |
| `md_company` | **DART `corp_code`**, 사업자번호·LEI | 피어그룹(β·벤치마크)·타겟·경쟁사 식별 |
| `md_unit` | 단위코드 + **차원(dimension)** + SI 계수 | **차원이 다른 환산은 `proxy_link` 경유를 DB가 강제** |
| `md_currency`/`md_country` | ISO 4217 / ISO 3166-1 alpha-3 | 통화·지역 혼입 차단 |
| `md_period` | date/year/quarter/month + `fiscal_year` | **회계연도 불일치 처리** |
| `md_source` | 소스코드 + 신뢰도 등급 | provenance 앵커 |
| `md_statute` | 법제처 법령ID + 해외 framework 키 | 규제 요건 앵커 |
| `md_account` | IFRS 캐노니컬 — co-consult `ifrs_general.json` 재사용 | 재무 정규화 |
| `md_entity` | 그룹 계열사 코드 | **각사 고유 절차의 앵커** |
| `md_project` | 내부 채번 | 모든 run·finding·document의 소유자 |

**정규화 규칙(3NF)**: 모든 수치는 `fact_*`에 `(마스터 FK + period_id + value + unit_id + source_id + revision_no)`. **단위는 문자열 금지, `md_unit` FK만.** 마스터 미등록 값은 **적재 실패** + `staging_unmapped` 격리 — 조용한 자동 생성 금지.

**외부 데이터 재활용·변경 이력** — `ensure_fresh(series_id)`:
1. `last_checked_at + check_interval_hours > now` → **네트워크 호출 없이 캐시 재사용**
2. 아니면 조건부 요청(`If-None-Match`/`If-Modified-Since`, 미지원 API는 `content_hash`) → **304면 `last_checked_at`만 갱신**
3. 200이면 관측치 단위 대조:
   - 신규 기간 → `revision_no=1` INSERT, `change_type='new'`
   - **기존 값 변경(소급개정)** → **덮어쓰지 않고** `revision_no+1` INSERT, `change_type='revised'`
   - 사라진 기간 → `change_type='deleted'` (물리 삭제 안 함)

모든 호출은 **`scripts/lib/ssrf.ts`의 `safeFetch()` 경유**.

> 통계기관은 과거 수치를 소급 개정한다. 덮어쓰면 3개월 전 분석을 재현할 수 없다. run은 `(series_id, period_id, revision_no)`를 고정 참조한다.

**가정 레지스트리**: `assumption.kind ∈ {live, user, derived, assumed}`. `assumed`는 **`rationale` NOT NULL 제약**. `as_of + ttl_days` 초과 시 **보고서 최종화 차단(Staleness Gate)**.

**환율 적용 시점 정책**: `currency_id`만으로는 부족하다. `fx_policy(scope, rate_type, source_series_id)` — 손익 항목은 기간평균, 자산·부채는 기말, 거래 대금은 계약일 환율. **run에 적용 환율과 근거 series를 스냅샷**해 사후 재현이 가능해야 한다.

**보존·아카이빙**: `simulation_draw`는 1만 iteration × 실행 횟수로 무한 증가 → **원시 draw는 N개월 후 아카이빙하고 `simulation_result`의 분위수만 영구 보존**. `raw_payload`도 동일.

**버전 관리**: `run`(+`run_input` 불변 스냅샷 +`input_hash`), `simulation`(+**`seed`**), `document`(+`superseded_by`, `document_section` 해시). 산출물 표지에 **run id / as_of / input_hash / version / policy_version 자동 인쇄**.

**인덱스** — 쿼리 패턴에서 도출, 근거를 `docs/db-schema.md`에 기록:

| 인덱스 | 대상 쿼리 |
|---|---|
| `fact_market_observation` PK `(series_id, period_id, revision_no)` | 최신 리비전 조회 — 커버링 |
| `idx_obs_latest (series_id, period_id DESC)` | 시계열 구간 스캔 |
| `idx_fact_fin (company_id, period_id)` | 피어그룹 재무 비교 |
| `idx_fact_ind (industry_id, period_id)` | 산업 지표 — 프록시 체인 주 경로 |
| `run_input` PK `(run_id, assumption_key)` | 스냅샷 전량 로드 |
| **`idx_sim_draw (simulation_id, metric)`** | **1만 iteration × 다지표 — 없으면 조회 붕괴** |
| `idx_change_log (series_id, detected_at DESC)` | 변경 이력 리포트 |
| `idx_audit (actor_user_id, created_at DESC)` | 감사 로그 |
| `idx_rag (project_id, assessed_at DESC)` | RAG 히스토리 |
| `idx_procedure (procedure_key, scope, entity_id)` | 절차 병합 조회 |

법령 전문검색 FTS5는 **`db/engine/sqlite/`로 격리**(Postgres 이전 시 `tsvector` 교체).

**이식성 (ADR-0002)**: 순수 SQL 마이그레이션 + `schema_migrations`. **금지**: `AUTOINCREMENT`, 암묵적 `ROWID` 의존, 동적 타입 의존, `INSERT OR REPLACE`. **이식 가능 타입만**(`INTEGER/TEXT/REAL/NUMERIC`), 날짜는 ISO-8601 `TEXT`, **부동소수 금액 금지**. `PRAGMA foreign_keys=ON`. 접근은 `db/repositories/*.ts` 경유. `db:export --dialect postgres`로 **주장만 하지 않고 검증**.

### 8.2 RAG 신호등 체계

**6개 차원 + 종합** — 재무성 / 시장 / **데이터 신뢰도** / 규제·인허가 / 기술·실행 / 리스크.

**가중평균 점수가 아니라 규칙 기반:**
```
IF  kill_criteria 저촉 OR 필수 인허가 취득 불가 OR 어느 차원이든 Red
THEN 종합 = RED                     ← 평균내지 않는다
ELIF 모든 차원 Green AND 데이터신뢰도 Green
THEN 종합 = GREEN
ELSE 종합 = AMBER
```

**★ 데이터 신뢰도가 종합 등급의 상한을 캡한다**

| 데이터 신뢰도 | 종합 등급 상한 |
|---|---|
| Green (직접 데이터 또는 A등급 체인) | GREEN 가능 |
| Amber (B등급 체인, 1홉 통계 환산) | **최대 AMBER** |
| Red (C등급 체인, staleness 초과, `assumed` 비율 과다) | **최대 AMBER + "판단 보류"** |

크랭크축처럼 **2홉 프록시로 추정한 시장에서 재무 지표만 보고 Green을 줄 수는 없다.** 이 체계에서 가장 중요한 규칙이다.

**스테이지 게이트별 임계값 분리**(`rag_rule.stage_gate`) · **히스테리시스**(승격 hurdle+2.0%p / 강등 hurdle+0.5%p, 최소 유지 7일) · **등급에 근거 문장과 발동 규칙 필수 첨부**.

> 예: `AMBER — IRR 13.2%로 hurdle 12.0% 대비 +1.2%p이나 승격 임계(+2.0%p) 미달. 데이터 신뢰도 B등급(선박→엔진 회귀 R²=0.71)으로 종합 등급 상한 AMBER.`

**표시**: 신호등 카드(종합+차원별 배지), RAG 히스토리 스파크라인, 전환 이벤트 로그. **색상 단독 구분 금지** — 아이콘·라벨 병기.

```sql
rag_rule(id, stage_gate, dimension, grade, condition_expr, priority, enabled, policy_id)
rag_assessment(id, run_id, project_id, dimension, grade, triggered_rules, rationale, assessed_at)
rag_transition(id, project_id, from_grade, to_grade, run_id, at, reason, notified)
```

### 8.3 주기 수집 · 자동 재분석 · 알림

```
[스케줄러: OS 레벨]  → newbiz.ts watch:run
  [1] fetch (캐시 우선) → data_change_log
  [2] 영향 판정: 변경 series → 참조 assumption → 대상 project   (변경 없으면 종료)
  [3] 자동 재실행: model → 새 run ("auto-YYYYMMDD")
  [4] RAG 재평가 → rag_transition 감지
  [5] 알림 규칙 평가 → [6] 인앱 + 이메일 + Webhook
```

**OS 스케줄러를 쓰는 이유**: 앱 인프로세스 타이머는 앱이 죽으면 같이 죽는다.

**알림은 양방향이다.** "좋아질 때"만 알리면 위험하다 — 진행 중 건이 나빠지는 걸 모르는 손실이 기회를 놓치는 손실보다 크다.

| 트리거 | 등급 | 채널 |
|---|---|---|
| RAG 등급 상승 | 기회 | 인앱+이메일 |
| RAG 등급 하락 | 경고 | 인앱+이메일+Webhook |
| **Kill Criteria 저촉** | 긴급 | 전 채널 |
| 관련 법령·규정 개정 시행 | 경고 | 인앱+이메일 |
| IRR/NPV 변동폭 임계 초과 / staleness | 정보 | 인앱 |
| 수집 배치 실패 | 운영 | `sre` Webhook |

**알림 피로 방지**: 쿨다운 · 히스테리시스 · 묶음(일일 다이제스트, 즉시 발송은 긴급만) · 등급 전환 후 7일 재전환 억제 · 사용자별 Watchlist·채널·임계값 개인 설정.

```sql
watch / watch_rule / notification / schedule_job / job_run
```

### 8.4 전·후방 산업 연관성 분석

> **프록시 체인과 혼동하지 말 것.** 프록시 체인은 *"데이터가 없으니 대체 지표로 규모를 추정한다"*이고, 연관성 분석은 *"우리 사업이 전·후방과 어떻게 얽혀 있고 그 관계가 얼마나 강한가"*다. **β를 서로 빌려 쓰면 안 된다** — 별도 테이블에 저장한다.

| 축 | 질문 | 산출 지표 |
|---|---|---|
| **수요 파생 강도** | 전방 수요가 1% 변하면 우리 매출은 몇 % 변하나 | 탄력성, **시차(lag)**, R² |
| **원가 전가력** | 원자재 상승분을 판가로 얼마나 넘길 수 있나 | **pass-through rate**, 전가 지연 개월 |
| **교섭력** | 공급자·구매자 중 누가 세나 | 집중도(HHI), 상위 N사 비중, 전환비용 |
| **사이클 동조성** | 전방과 같이 움직이나, 늦게 움직이나 | 상관계수, 선·후행 관계 |
| **수직통합 압력** | 전방이 우리 영역으로 내려올 위험 | 통합 사례, 마진 격차 |
| **대체·전환 위협** | 기술 전환이 수요 구조를 바꾸나 | 대체 기술 성숙도, 규제 전환 일정 |

크랭크축 예시에서 마지막 축이 결정적이다 — **IMO 탈탄소 규제로 메탄올·암모니아 엔진으로 전환되면 크랭크축 사양과 수요 구조 자체가 바뀐다.**

```sql
value_chain_link(id, project_id, from_industry_id, to_industry_id, direction,
                 linkage_type, elasticity, lag_months, correlation, r2,
                 pass_through_rate, pass_through_lag_months,
                 concentration_hhi, switching_cost_grade,
                 substitution_threat, evidence_ref, assessed_at)
```

**모델 연결**: pass-through rate → 마진 가정의 근거 · 탄력성·시차 → 매출 예측의 전방 연동 · 집중도·전환비용 → RAG "시장" 차원 · **대체 위협 → Kill Criteria 후보**.

### 8.5 프록시 체인 & 단위 환산

```sql
proxy_chain(id, name, target_industry_id, tier_depth, description)
proxy_link(id, chain_id, seq, from_unit_id, to_unit_id, method,
           coef, r2, lag_months, ci_low, ci_high,
           sample_from, sample_to, calibrated_at, reliability_grade)
```

`method`: `engineering`(고정 계수 — 선박당 엔진 수, 엔진당 크랭크축 중량) | `regression`(통계 보정 — β, R², **lead-lag 시차**, 신뢰구간).

**각 홉 오차가 곱해지므로 체인 신뢰도 점수를 산출**해 최종 숫자에 오차 밴드를 강제한다. 이 점수가 §8.2의 데이터 신뢰도 캡으로 직결된다.

**수주 / 수주잔고 / 인도 시계열 혼동 금지** — 조선업에서 이걸 틀리면 예측 전체가 무너진다.

### 8.6 재무 분석 — 과거 실적 + 성장성

**co-consult 파이프라인을 그대로 얹는다** (§4 재사용 자산). 신규로 채울 공백:

- **과거 실적**: CAGR(3/5/10년), 마진 추이 + **변동성**(평균만 보면 사이클 산업 오판), 운전자본 회전일수, capex 원단위, **사이클 위치**(조선·기자재는 피크 실적을 베이스라인으로 잡으면 전부 틀린다), OCF vs 순이익 괴리
- **피어 벤치마크**: `peer_group`/`peer_member`, **선정 근거 필수 기록**(자의적 피어 선정이 벤치마크를 무력화). GF에서 특히 중요 — 신규 사업은 피어의 과거가 유일한 앵커다
- **성장성 예측**: 산업성장률(프록시 체인)×점유율→매출 / 과거 마진추세+규모경제→원가 / 피어 원단위→capex. 결과는 전부 `assumption(kind='derived')`로 들어가고 **`anchor_ref`가 근거 데이터를 가리킨다**. **base rate 검증** — 예측이 과거·피어 분포 상위 10% 밖이면 자동 경고
- **QoE**(BF 전용): 정상화 EBITDA → 밸류에이션 브리지 → `dd_finding.value_impact`

```sql
financial_kpi(company_id, period_id, kpi_code, value, unit_id)
peer_group(id, project_id, name, rationale) / peer_member(peer_group_id, company_id, weight)
projection(run_id, period_id, line_item, value, method, anchor_ref)
```

### 8.7 M&A 특수 검토 5종

모든 결과는 **`dd_finding.value_impact` 와 `assumption` 을 거쳐 모델로 흘러든다.** 문서에만 남으면 검토한 적 없는 것과 같다.

**(a) 독과점** — 관련시장 획정, **HHI 및 델타**, 관할별 신고 요건·임계값(KR 공정거래법·US HSR·EU EUMR·CN SAMR — `region-profiles`에서 로드), **gun-jumping 금지**(신고 전 통합 행위 차단), 시정조치 시나리오와 재무 영향. 신고 지연 → 클로징 지연 → IRR 하락.

**(b) 고객 이탈** — **change of control 조항 스캔**(실무 최대 리스크인데 가장 자주 누락), 고객 집중도, **경쟁 중복 고객**, **다중 소싱 정책 고객**(한 공급사로 통합되면 의도적으로 물량을 뺀다).

**(c) 정책 혜택 환수** — 혜택 인벤토리, 각 혜택의 의무 유지 조건(최소 운영기간·고용유지·**소재지 유지**), 이전 시 환수 규모 + 가산금·이자, 사전 협의 가능성.

**(d) 경영진 보상** — **CoC 트리거 보상(golden parachute)**(딜 클로징과 동시에 나가는 현금인데 자주 누락), 잔류 인센티브·earn-out(단기 실적 몰아주기 유발 검토), 가속 가득, **경업금지 조항의 관할별 유효성**(미국 일부 주·EU에서 집행 제한 — 무효인 조항에 기대면 핵심 인력이 경쟁사로 간다), 키맨 의존도.

**(e) 임직원 급여·복지 정합성** — 직무군·직급별 기본급 중위값 격차, 복리후생 1인당 환산, **퇴직급여 미적립 부채**, 노조·단체협약 승계, 해외는 **EU works council·영국 TUPE**.

> **★ 격차는 거의 항상 상향 조정 비용으로 나타난다.** 근로기준법 §94상 취업규칙 불이익 변경에 근로자 과반 동의가 필요해 **통합 후 급여를 낮출 수 없다.** 우리가 높으면 올려야 하고 상대가 높으면 못 내리므로 어느 쪽이든 인건비는 올라간다. "평균으로 수렴"은 실무에서 일어나지 않는다.

**(f) 부채·우발채무 시뮬레이션**
- 확정 부채: 만기 구조, 고정/변동 금리, **재무약정(covenant)**, **CoC 조항에 의한 기한이익상실(acceleration)**, 리스부채(IFRS 16), 리파이낸싱 리스크
- 우발채무: 소송·분쟁, 보증·담보, **환경 정화 의무**, 제품 하자·리콜, 세무 조사, 퇴직급여 미적립, 파생상품 평가손, 노무 소송
- **시뮬레이션**: 각 우발채무에 발생확률 × 금액 분포 × 발생 시점을 부여해 몬테카를로에 편입 → "우발채무 있음"이라는 정성 서술이 아니라 **P50/P95 금액**으로 산출
- **covenant breach 시뮬레이션**: 하방 시나리오에서 DSCR이 약정을 깨는지 → 깨면 기한이익상실 → 유동성 위기. **Kill Criteria 후보**

```sql
antitrust_assessment / customer_risk / incentive / management_package /
comp_benchmark / benefit_item / labor_agreement /
debt_instrument / contingent_liability / covenant_test
```

### 8.8 신규 설립 지역 검토

**(a) 인프라** — **전력**(수전용량·인입 리드타임·계약전력·정전 이력) / **용수** / **하수·폐수**(처리장 여유용량 — **없으면 증설 자체가 불가능하다. 전력보다 먼저 확인**) / **도로·물류**(대형차 진입, 항만·철도 접근, 중량물 운송 경로) / 가스 / 통신 / 폐기물.
각 항목에 **확보 리드타임과 비용**을 붙여 **capex와 일정에 직접 반영**. 인프라는 "있다/없다"가 아니라 "언제, 얼마에"의 문제다.

**(b) 인재** — 지역 **대학·마이스터고·특성화고·폴리텍** 연계, 계약학과·주문식 교육, 채용 가능 인력풀(지역 인구 구조 × 경쟁사 채용 경쟁), **숙련공 확보 난이도**, 사택·통근 지원 → 인건비 가정과 ramp-up 곡선에 반영.

**(c) 지역 인센티브 확보** — **협상 여지가 가장 큰 시점은 부지 확정 전이므로, 이 검토는 부지 선정의 입력이지 사후 확인이 아니다.**

| 범주 | 국내 주요 제도 |
|---|---|
| 조세 감면 | 지방투자촉진보조금, 외국인투자 조세감면(조특법), **지방세 감면**(취득세·재산세), 창업중소기업 세액감면, 통합투자세액공제 |
| 입지·설비 보조금 | 지방투자촉진보조금, 산단 분양가 할인, **임대전용산단** |
| 고용 지원 | 고용창출장려금, 지역 고용 보조, 훈련비 지원 |
| 인프라 지원 | **진입도로·용수·전력 인입 지자체 분담**, 폐수처리 연계 |
| 규제 특례 | 규제자유특구, **기회발전특구**(조특법), 경제자유구역, 외국인투자지역 |

설계 원칙 3가지:
1. **후보 부지를 동일 기준으로 비교** — 인센티브 패키지를 **NPV로 환산**해 인프라 비용·물류비·인건비와 한 표에
2. **혜택과 의무를 같은 레코드에** — 받는 순간 생기는 의무가 **곧 미래의 환수 리스크**. 분리하면 연결이 끊긴다
3. **혜택 수령 조건은 일정과 얽힌다** — 착공·투자 완료 시한을 놓치면 감면 소멸. **인허가 크리티컬 패스와 함께 봐야 한다**

**(d) 상생** — 지역 협력사 육성·지역 구매 비율, **주민 수용성**(민원·환경 갈등 이력), 지자체 협약, 사회공헌. **주민 반대로 인한 인허가 지연 리스크를 일정에 반영한다** — 법적 요건을 다 갖추고도 여기서 멈추는 프로젝트가 많다.

```sql
site_candidate(id, project_id, name, region_code, infra_score, infra_capex,
               incentive_npv, logistics_cost, labor_availability,
               permit_lead_time_days, total_score, rank)
```

### 8.9 협력 파트너 확보

**유형**: 기술(라이선스·공동개발) / 공급 / 판매·채널 / **JV** / 재무 / 지역
**프로세스**: 역량 갭 정의 → 롱리스트 → 평가·숏리스트 → 접촉·NDA → 조건 협의 → 계약 구조
**평가 축**: 기술력·생산능력·재무 안정성·고객 기반·지역 접근성·**컴플라이언스 리스크(제재·부패 이력)**

> **파트너 리스크는 우리 리스크가 된다.** FCPA·OFAC 관점에서 파트너의 과거 이력은 우리 책임으로 전이될 수 있다.

**JV 특유**: 지분 구조, 지배구조(**거부권 사항**), 출자 방식, **기술 기여의 가치 평가**, exit 조항(put/call, drag/tag), **교착(deadlock) 해소 장치**, 경업금지 범위

**의존 리스크**: 단일 파트너 의존도, 전환 비용, **파트너가 경쟁자로 전환될 가능성**

**모델 연결**: **파트너 확보 실패는 지연이 아니라 사업 중단**이다. Kill Criteria 후보이며 RAG "기술·실행" 차원에 입력.

```sql
partner_candidate / jv_term
```

### 8.10 정보 보호 — 개인정보 · need-to-know · MNPI

**이 절은 나중에 얹을 수 없다.** 스키마·API·UI 전 계층에 걸리므로 설계 시점에 확정한다. (회의 G1·G2·G3 — §11 참조)

**(a) 프로젝트 단위 접근 통제**

역할(`admin`/`analyst`/`viewer`)만으로는 M&A 정보를 격리할 수 없다. **역할 × 프로젝트 멤버십**의 2중 통제.

```sql
project_member(project_id, user_id, project_role, granted_by, granted_at,
               revoked_at, need_to_know_basis)
project_classification(project_id, sensitivity, mnpi_flag, wall_group,
                       classified_by, classified_at)
```

- **기본은 비공개(deny by default)** — 멤버가 아니면 프로젝트 존재조차 보이지 않는다. 목록 API도 필터링된다
- **`admin`도 자동 접근권을 갖지 않는다.** 시스템 관리 권한과 딜 정보 열람권은 별개 — 접근하려면 명시적 멤버십 + 감사 기록
- 리포지토리 계층에서 **모든 조회에 프로젝트 필터를 강제**한다 (애플리케이션 레벨 누락 방지)
- **정보차단벽(`wall_group`)** — 이해상충 구성원을 그룹 단위로 배제

**(b) 개인정보·민감정보**

`management_package`(경영진 개인별 보상), `comp_benchmark`(급여 수준), `partner_candidate`(개인 연락처)는 **개인정보보호법 적용 대상**이다.

| 원칙 | 적용 |
|---|---|
| **최소 수집** | 개인 식별자를 저장하지 않는다. `executive_ref`는 **직위 기반 대체키**(`TARGET-CEO-01`), 실명은 시스템 밖 |
| **집계 우선** | `comp_benchmark`는 **직무군·직급 단위 집계값만**. 개인별 급여는 저장하지 않는다 |
| **보존기간** | 딜 무산·종결 + N개월 후 자동 파기 (`retention_policy`) |
| **접근 로그** | 개인정보 포함 테이블은 **읽기도 감사 로그**에 남긴다 |
| **국외 이전** | 해외 M&A 시 이전 근거 필요 — `region-profiles`에 요건 필드 |
| **가명처리** | 분석·통계 목적은 가명처리 뷰(`v_comp_anonymized`)로만 |

> **NDA 검토 선행**: DD 자료 상당수는 NDA 대상이다. **시스템에 적재하는 행위 자체가 NDA 위반인지**를 `legal-counsel`이 착수 시 판정하고 `project_classification`에 반영한다.

**(c) MNPI — 미공개중요정보**

상장사 관련 딜은 **내부자거래 규제 대상**이다.
- `mnpi_flag=true` 프로젝트는 **접근자 명부(insider list) 자동 생성·유지** — 규제 대응 시 즉시 제출 가능해야 한다
- 열람 기록 보존, **접근 시 MNPI 고지 배너**
- **MCP 노출 제한**: MCP 도구 응답에서 기본 제외. 명시적 스코프 토큰만 접근 가능하며 그 접근도 감사 대상

```sql
insider_list(project_id, user_id, added_at, removed_at, reason, acknowledged_at)
data_access_log(id, user_id, table_key, record_ref, project_id, action, at, ip)
retention_policy(table_key, basis, retention_months, action, last_run_at)
```

### 8.11 인증·계정

**`scripts/lib/auth.ts` 재사용** — PBKDF2-HMAC-SHA256 / 210,000 iter / 16B salt / 32B key (OWASP 2023). **단방향이라 DB를 직접 열어도, 관리자 콘솔에서도 원문 복원 불가.** 평문은 로그·감사로그 어디에도 기록하지 않는다.

**비밀번호 초기화 흐름:**
```
[사용자] "비밀번호 초기화 요청"  → password_reset_request(status='pending')
[관리자] 콘솔에서 승인 → 임시 비밀번호 설정
         → password_hash 갱신 + must_change_password=1 + 기존 세션 전량 revoke
[사용자] 임시 비밀번호로 로그인
         → ★ 모든 화면 접근 차단, 비밀번호 변경 화면으로 강제 리디렉션
         → 새 비밀번호 (password_history 대조로 재사용 차단)
         → must_change_password=0, 세션 재발급
```
관리자는 임시 비밀번호만 알고, 사용자가 변경한 이후에는 알 수 없다. 전 단계가 `audit_log`에 남는다.

**계정·권한**: 자가 가입 → `pending` → 관리자 승인 → `active`. 역할 `admin`/`analyst`/`viewer`. 실패 N회 잠금, 세션 DB 저장(강제 종료 가능), `httpOnly`+`secure`+`SameSite=Lax`, CSRF.

### 8.12 분석 엔진 CLI

```bash
bun scripts/co-newbiz/newbiz.ts <command>
```

`db:migrate`·`db:analyze`·`db:export --dialect postgres` · `md:sync` · `fetch [--check-only]` · `changes` · `law:sync` · `policy:sync`·**`policy:impact`** · `proc:resolve`(참조·오버라이드 병합 결과) · `glossary:lint` · `fin:analyze`·`fin:project` · `assume`(대화형 WACC/hurdle IRR) · `calibrate`·`convert` · `model` · `simulate` · `rag` · `diff` · **`watch:run`** · `report`·`export` · `adr:new` · `user:*` · `status`

**Python** (`python/`): `validate/normalize/kpi/driver_tree`(**co-consult 재사용**) + `correlation`(회귀+lead-lag+CI) + `monte_carlo`(시드 고정) + `attribution`(NPV 기여도) + `projection` + `mappings/{unit_conversions,proxy_chains,ksic_naics_map,regulatory_catalog,ifrs_general}.json`

**문서 렌더러** `python/report/`: `ast.py`(Markdown→공통 AST) + `render_docx.py`(python-docx) + `render_pdf.py`(reportlab) + `render_hwpx.py`(python-hwpx) + `theme.py` + `glossary_appendix.py`

> 공통 AST를 거치는 이유: Word와 PDF를 각각 만들면 레이아웃이 갈라진다. **외부 바이너리 의존 전무** — 전부 pip 설치 가능한 순수 Python이라 Windows에서 바로 돈다.
> **난점**: reportlab은 한글 폰트를 직접 등록해야 한다(`pdfmetrics.registerFont(TTFont(...))`). 폰트 경로 해석·라이선스(Pretendard·나눔 = OFL)가 실제 구현 난이도다.

**`.env.sample`**: `FRED_API_KEY`, `ECOS_API_KEY`, `DART_API_KEY`, `LAW_API_OC`, `SESSION_SECRET`, `NEWBIZ_API_TOKEN` (World Bank/IMF는 키 불필요)

### 8.13 웹 UI

`app/server/`(Hono) + `app/web/`(React SPA). 한국어, 3-depth 이내, **모든 숫자에 출처 툴팁**(assumption key·as_of·source·anchor_ref), **용어 자동 툴팁**, 색맹 안전(색+아이콘+라벨), 다크모드, `accessibility-audit` WCAG 2.1 AA.

**분석가 화면**: 대시보드(**RAG 신호등 카드**·staleness·알림 센터) · 감시 설정 · **절차 뷰어**(공통/각사/지역 병합 결과와 출처 표시) · 데이터 · 재무 분석(**ROIC 드라이버 트리 워터폴**·피어 박스플롯·예측 앵커) · **프록시 체인 다이어그램** · 가정 · 모델(**워터폴**·**토네이도**) · 시뮬레이션(**히스토그램+CDF**) · **버전 비교(워터폴 브리지)** · 법령·인허가(**DAG 크리티컬 패스**) · **M&A 검토**(독과점 HHI·고객 이탈·환수·보상·부채) · DD · **용어집** · 보고서

**관리자 콘솔**: 사용자 관리 · 데이터베이스 관리 · **배치·스케줄 관리** · **알림 관리**(RAG 규칙·임계값 편집) · **규정·절차 관리**(버전·pin 현황·영향 분석) · **용어집 관리** · 시스템 사용 정보 · 로그 관리 · 데이터 소스 관리(**API 키는 존재 여부·마지막 성공 시각만**) · 기준정보 관리 · 거버넌스(ADR·Stage Gate)

> 감사 로그는 **append-only** — 관리자도 삭제 불가, 보존기간 만료 시 아카이빙만.

### 8.14 REST API & MCP

**인증**: 세션 쿠키(웹) + Bearer API 토큰(MCP/CLI), 토큰 해시 저장·스코프 제한. **OpenAPI 3.1이 MCP 도구 정의의 SSOT.**

**MCP** `mcp/co-newbiz/` — `Projects/co-architect/mcp/` 패턴 그대로. **DB에 직접 붙지 않고 REST API 경유** — 권한·감사가 한 곳에서만 집행되어 AI 클라이언트가 우회할 수 없다.

도구(✱ = 쓰기, 스코프+감사로그): `list_projects`·`get_project_status`·`get_rag_assessment`·`list_notifications`·`manage_watch`✱·`lookup_term`·`get_procedure`·`get_compliance_status`·`list_waivers`·`search_interpretations`·`get_approval_chain`·`search_series`·`get_observations`·`list_data_changes`·`get_financial_analysis`·`get_peer_benchmark`·`get_projection`·`get_assumptions`·`set_assumption`✱·`get_value_chain_linkage`·`get_proxy_chain`·`calibrate_chain`✱·`run_model`✱·`compare_runs`·`run_simulation`✱·`get_antitrust_assessment`·`get_customer_risk`·`get_incentive_exposure`·`get_compensation_gap`·`get_liability_exposure`·`compare_sites`·`list_partner_candidates`·`list_regulatory_requirements`·`get_permit_path`·`list_dd_findings`·`add_dd_finding`✱·`generate_report`✱·`export_report`

**사용자·DB·배치·규정 관리는 MCP 미노출** — 관리자 콘솔 전용.

| 클라이언트 | 등록 위치 |
|---|---|
| Claude Code | 프로젝트 `.mcp.json` |
| Claude Desktop App | `claude_desktop_config.json` → `mcpServers` |
| Antigravity / CLI | `.gemini/settings.json` |
| Codex App / CLI | `~/.codex/config.toml` → `[mcp_servers.*]` |

공통: `{"command":"bun","args":["run","--env-file",".env","./mcp/co-newbiz/index.ts"],"timeout":300000}` — 전 클라이언트가 stdio를 지원하므로 **서버 하나로 커버**된다.

### 8.15 배포·운영·보안

**배포**: 빌드 → **선행 백업** → 마이그레이션 → 헬스체크 → 롤백. Windows Service/systemd 등록, 리버스 프록시 HTTPS, 로그 로테이션. **되돌릴 수 있는 마이그레이션과 없는 것을 분리 표기.**
**운영**: 백업 스케줄·보존, **복구 훈련**, 성능 튜닝, 용량, 모니터링·알림, SLO, 인시던트·사후분석, 배치 실패 대응.
**보안**: 기준선, 정기 스캔(`security-scan`·`stride-threat-matrix`·`sarif-exporter` 재사용), CVE 추적·패치, 시크릿(API 키 DB 미저장·`.env`), 접근권한 재검토, **Webhook 정보 노출 범위 검토**, `safeFetch()` 강제 검증.

---

## 9. Skills

### 9.1 재사용 (16)

**co-consult (10)**: `financial-statement-analysis`(과거 재무 분석 기반), `insight-synthesis`, `mece-logic-auditor`, `competitive-intelligence`, `company-intelligence`, `executive-presentation`, `sample-driven-report-writing`, `hwp-document-processing`, `k-law`(법제처 조회 계층), `org-readiness-assessment`

**workspace/common (6)**: `k-dart`, `security-scan`, `stride-threat-matrix`, `sarif-exporter`, `accessibility-audit`, `zod-contract-gate`

### 9.2 신규 (77)

| 그룹 | 스킬 |
|---|---|
| **거버넌스 제정 (7)** | `governance-document-hierarchy` · `policy-and-procedure-governance` · **`procedure-reference-override`** · **`two-tier-approval-chain`** · **`policy-change-impact-analysis`** · `regulation-monitoring` · `adr-governance` |
| **거버넌스 운영 (6)** | **`compliance-monitoring`** · **`waiver-management`** · **`interpretation-registry`** · `governance-training-and-notice` · `governance-kpi-reporting` · `checklist-authoring` |
| **그룹 심의 (3)** | `group-level-review` · `portfolio-fit-assessment` · **`intra-group-transaction-compliance`** |
| **용어 (2)** | `glossary-management` · `glossary-lint` |
| **GF/BF·게이트 (8)** | `greenfield-feasibility` · `brownfield-feasibility` · `stage-gate-governance` · **`site-infrastructure-assessment`** · **`regional-incentive-sourcing`** · `site-comparison` · `talent-pipeline-planning` · `community-partnership-planning` |
| **M&A 특수 (7)** | **`antitrust-screening`** · **`customer-attrition-risk`** · `incentive-clawback-assessment` · **`management-incentive-review`** · **`compensation-harmonization-analysis`** · **`debt-and-contingent-liability-simulation`** · `pmi-planning` |
| **파트너십 (3)** | `partner-sourcing-strategy` · `partner-due-diligence` · `jv-structuring` |
| **지역·산업 (2)** | `region-profile-application` · `industry-profile-application` |
| **시장·프록시 (4)** | **`value-chain-linkage-analysis`** · **`proxy-industry-chain`** · **`unit-conversion-calibration`** · `market-data-pipeline` |
| **재무·시뮬레이션 (8)** | `historical-financial-analysis` · `peer-benchmarking` · **`growth-projection-modeling`** · `quality-of-earnings` · `investment-feasibility-modeling` · `wacc-input-session` · `scenario-planning` · `monte-carlo-simulation` |
| **법령·DD (9)** | `regulatory-screening` · **`permit-pathway-mapping`** · `statute-change-monitoring` · `legal-risk-register` · `commercial-due-diligence` · `technical-due-diligence` · `site-visit-protocol` · `expert-interview` · `dd-to-valuation-bridge` |
| **판정·품질 (3)** | **`rag-scoring-framework`** · `run-versioning-and-attribution` · `assumption-audit` |
| **플랫폼 (11)** | `master-data-governance` · `data-normalization` · **`data-freshness-and-revision-control`** · `db-migration-governance` · `query-performance-tuning` · `rest-api-design` · `mcp-server-integration` · `ui-information-architecture` · `auth-and-account-management` · `continuous-monitoring-and-alerting` · `notification-channel-management` |
| **운영·보안 (11)** | `deployment-and-release` · `database-operations` · `backup-and-dr` · `observability-and-alerting` · `incident-response` · `infrastructure-automation` · `batch-scheduling-operations` · `security-baseline-review` · `vulnerability-management` · `access-control-review` · `admin-console-operations` |

---

## 10. 실행 계획

### 10.1 원칙 — 문서가 먼저, 시스템은 나중

프로세스와 규정이 확정되기 전에 코드를 쓰면 규정과 시스템이 또 따로 논다(문제 #9).

```
Stage 0  프로젝트·에이전트 생성
Stage 1  ★ 미팅을 통한 계획 고도화          ← 여기서 계획이 확정된다
Stage 2  프로세스·규정집·운영 매뉴얼
Stage 3  디테일 프로세스·운영체계 + ★수기 파일럿
Stage 4  시스템 구현 계획 (SRS + 추적성 매트릭스)
Stage 5  시스템 개발 → 배포·운영 이관
```

각 Stage 종료 시 **PM이 사용자 승인 게이트**를 건다.

### 10.2 MVP 경계와 범위 축소 경로

일정이 밀리면 **뒤에서부터** 잘라낸다.

| 티어 | 범위 | 잘라낼 수 있나 |
|---|---|---|
| **MVP** | 문서 5계층 · 그룹 공통 절차 + 1개 각사 · 스테이지 게이트 + 2단계 승인 · 용어집 · **정보 보호(§8.10)** · DB 코어 · CLI · 재무·프록시 체인 · RAG · 보고서 출력 | **불가** |
| **Tier 2** | 웹 UI + 관리자 콘솔 · 인증 · 자동 감시·알림 · MCP · 지역 프로파일 3개 | 미룰 수 있음 (CLI로 대체 운영) |
| **Tier 3** | 지역·산업 프로파일 확장 · 시뮬레이션 고도화 · 거버넌스 KPI 대시보드 · 다국어 | 후속 릴리스 |

> **정보 보호를 MVP에 넣은 이유**: 나중에 얹을 수 없는 유일한 항목이다.

**이 프로젝트 자체의 중단 기준**: Stage 3 수기 파일럿이 **2회 연속 완주 실패**하면 시스템 개발로 넘어가지 않고 프로세스 설계로 되돌아간다. 작동하지 않는 프로세스를 코드로 굳히는 것이 최악이다.

### 10.3 Stage 0 — 프로젝트·에이전트 생성

| # | 작업 | 담당 | 산출물 |
|---|---|---|---|
| 0.0 | **설계 문서 작성·등록** (본 문서) | architect, docs-writer | `docs/designs/2026-08-19-co-newbiz-design_ko.md` + `spec-register.ts` |
| 0.1 | Scaffold + CLAUDE/GEMINI Context + Antigravity parity | scaffolding-expert | `Projects/co-newbiz/` |
| 0.2 | **Agents 32개** + AGENTS.md 로스터 | agent-lifecycle-manager | `agents/**` |
| 0.3 | 용어집 초기 골격(스키마 + 핵심 50개) | glossary-curator | `glossary/**` |

### 10.4 Stage 1 — 미팅을 통한 계획 고도화

`meeting-facilitation` 스킬(v1.4.0, Priority 1)로 실행. 전사는 `memory/meeting-YYYY-MM-DD-[slug].md`에 자동 기록.

| # | 주제 | 참여 | 결정 사항 |
|---|---|---|---|
| **M0** | **도메인 경계 정합** | pm(진행) + 4개 도메인 리드 전원 | 기능↔기술↔산업↔지역 책임 경계, 인터페이스 계약, 교차 검증 매트릭스 |
| **M1** | 신사업 검토 프로세스 전체 골격 | process-governance-manager(진행), greenfield, brownfield, group-review, valuation, risk-officer | 스테이지 게이트, 산출물·통과 조건, **Kill Criteria 초안** |
| **M2** | 각사 ↔ 그룹 심의 경계 | group-review(진행), process-governance-manager, legal-counsel, valuation | 각사/그룹 판단 경계, 그룹 IC 고유 질문, **자본 배분 순위 결정 방식** |
| **M3** | RAG 판정 기준 확정 | process-governance-manager(진행), financial-analyst, quant-methodologist, risk-officer | 6차원 정의, 게이트별 임계값, **데이터 신뢰도 캡**, 히스테리시스 폭 |
| **M4** | 데이터 신뢰도와 프록시 체인 방법론 | quant-methodologist(진행), market-intelligence, financial-analyst, data-architect | 체인 등급 기준, 오차 전파식, **연관성 계수와 프록시 계수의 분리 원칙** |
| **M5** | M&A 특수 검토의 모델 연결 | brownfield(진행), antitrust, customer-retention, incentive, hr-integration, valuation | 각 결과를 **어떤 assumption 키로** 모델에 넣을지 |
| **M6** | 신규 설립 부지 선정 기준 | greenfield(진행), incentive, technical-dd, legal-counsel, partnership | 다기준 가중치, **인센티브 NPV 환산 방식**, 인허가 리드타임 반영 |
| **M7** | 시스템 아키텍처와 운영 모델 | platform-lead(진행), backend/frontend-engineer, dba, sre, security-engineer | DB·API·MCP 경계, 운영 리듬, 보안 기준선, 배포·롤백 |
| **M7-1** | **정보 보호 — 개인정보·need-to-know·MNPI** | security-engineer(진행), legal-counsel, compliance-officer, hr-integration, data-architect | 최소수집 범위, 프로젝트 멤버십 모델, MNPI 취급 기준, 보존·파기 |
| **M8** | 통합 리뷰 — 계획 최종 고도화 | pm(진행) + 전 리드 | M0~M7 통합, 상충 해소, **미해결 쟁점의 수용 리스크 확정** |

**미팅 산출물의 반영 경로** — 미팅이 잡담으로 끝나지 않으려면 출구가 정해져 있어야 한다:

| 결론 유형 | 반영 위치 |
|---|---|
| 설계 결정 | **ADR 기안**(`adr:new`) |
| 프로세스·게이트 정의 | Stage 2 규정집 초안 입력 |
| 판정 규칙·임계값 | `rag_rule` 시드 데이터 사양 |
| 미해결 쟁점 | `memory/YYYY-MM-DD.md` 수용 리스크 + 재논의 시점 |
| 신규 용어 | 용어집 등록 큐 |

**규칙: 액션 아이템에 담당 에이전트와 반영 위치가 없으면 미팅을 닫지 않는다.**

### 10.5 Stage 2 — 프로세스·규정집·운영 매뉴얼

| # | 작업 | 담당 |
|---|---|---|
| 2.1 | 전체 워크플로우 도출 (게이트별 절차·입출력·승인자·RACI) | process-governance-manager |
| 2.2 | **규정집** — 그룹 규정 + 각사 부칙 | process-governance-manager, legal-counsel, docs-writer |
| 2.3 | 절차 정의 (`procedures/` + `references:` 오버라이드 + `_validate.ts`) | process-governance-manager, group-review |
| 2.4 | 가이드라인·체크리스트·양식 (문서 5계층 강제력 표기) | 각 도메인 에이전트 |
| 2.4b | **거버넌스 운영 체계 정의** (준수 점검·waiver·해석례·KPI) | compliance-officer |
| 2.4c | **매뉴얼 3종** | docs-writer + 각 도메인 |
| 2.5 | 지역 프로파일 초판 (KR/US/EU/CN/SEA) | region-lead, legal-counsel |
| 2.6 | 용어집 완성 (5종) | glossary-curator |
| 2.7 | **전환 계획** — 기존 방식 → 새 체계, 진행 중 건 처리, 계열사별 도입 순서 | process-governance-manager, compliance-officer |
| 2.8 | ADR 0001~0044 확정 | pm, architect |

**매뉴얼 3종 — 섞으면 아무도 안 읽는다**

| 매뉴얼 | 독자 | 내용 |
|---|---|---|
| **업무 매뉴얼** | 분석가·심의위원 | 게이트별 해야 할 일, 체크리스트, 산출물 양식, 판정 기준 해석 |
| **운영 매뉴얼** | 시스템 운영자 | 배치·백업·복구·장애 대응·권한 관리 |
| **관리자 매뉴얼** | 관리자 | 계정·규정 버전·기준정보·알림 규칙 관리 |

### 10.6 Stage 3 — 디테일 프로세스 + 수기 파일럿

| # | 작업 |
|---|---|
| 3.1 | 체크리스트 상세화 (GF/BF·CDD/TDD·법령·M&A 5종·부지·파트너) |
| 3.2 | 판정 규칙 상세 — `rag_rule` 시드 정의 |
| 3.3 | 산출물 양식 — IC 메모·심의 보고서 템플릿(한국어) |
| 3.4 | 운영체계 — 역할·권한 매트릭스, 운영 리듬, SLO 초안 |
| 3.5 | **★ 수기 파일럿 — 실제 검토 건 1개를 시스템 없이 규정집·매뉴얼·체크리스트만으로 완주** |
| 3.6 | 파일럿 피드백 반영 — 규정·절차·체크리스트 개정 |

> **★ 수기 파일럿의 이유**: 프로세스 결함은 **코드를 쓰기 전에** 드러나야 한다. 엑셀과 문서만으로 Screening→Group IC까지 한 번 굴려보면 "이 단계는 실행 불가", "이 산출물은 아무도 안 본다", "이 판정 기준은 데이터가 없다"가 즉시 나온다. 시스템 개발 후에 발견하면 스키마부터 다시 판다. **파일럿 1회 비용이 재작업 비용보다 압도적으로 싸다.**

### 10.7 Stage 4 — 시스템 구현 계획

| # | 작업 | 산출물 |
|---|---|---|
| 4.1 | **요구사항 명세(SRS)** — 규정·절차에서 기능 요구 도출, MoSCoW | `docs/srs.md` |
| 4.2 | **★ 추적성 매트릭스** — 규정 조항 → 절차 단계 → 시스템 요구 → 구현 → 테스트 | `docs/traceability-matrix.md` |
| 4.3 | ERD·기준정보·인덱스 설계 | `docs/db-schema.md`, `docs/master-data-catalog.md` |
| 4.4 | API·UI·MCP 설계 | `docs/api-spec.md`, `docs/ui-spec.md`, `docs/mcp-integration.md` |
| 4.5 | 보안 모델·위협 모델 | `docs/security-model.md`, `docs/security-baseline.md` |
| 4.6 | 개발 계획 — 스프린트 분할, PR 경계, 검증 기준 | `docs/dev-plan.md` |

> **★ 추적성 매트릭스가 문제 #9를 푸는 장치다.** 규정 조항이 어느 시스템 기능으로 구현됐는지 매핑돼 있어야, 규정 개정 시 `policy:impact`가 정확히 무엇을 고쳐야 하는지 알려줄 수 있다.

### 10.8 Stage 5 — 시스템 개발

| Wave | 작업 |
|---|---|
| 5.1 | DB — 마이그레이션 + 기준정보 + 리포지토리 계층 |
| 5.2 | CLI + fetcher(변경감지·SSRF) + 법령·규정 수집 + `proc:resolve` + `glossary:lint` / 재무 파이프라인 이식 + 피어·성장성 / 프록시·연관성·시뮬레이션·귀인분석 / 문서 렌더러 **(4개 병렬)** |
| 5.3 | RAG 판정 엔진 + 승인 체인 엔진 + 준수 점검·waiver·해석례 엔진 |
| 5.4 | 감시·자동 재분석·알림 + 스케줄러 |
| 5.5 | 인증·계정·세션·감사 + **프로젝트 멤버십·MNPI·개인정보 통제(§8.10)** |
| 5.6 | Hono API + React SPA + RAG 대시보드·절차 뷰어·용어 툴팁 + 관리자 콘솔 |
| 5.7 | OpenAPI + MCP 서버 + 클라이언트 등록 |
| 5.8 | Skills 최종 — 재사용 16 + 신규 77 |
| 5.9 | 배포 파이프라인·런북·보안 기준선 실행 |
| 5.10 | **★ 시스템 파일럿** — Stage 3에서 수기로 돌린 그 건을 시스템으로 재실행해 결과 대조 |

> **5.10의 의미**: 수기 결과와 시스템 결과가 다르면 **둘 중 하나가 틀린 것**이다. 어느 쪽이 틀렸는지 밝히는 과정에서 규정 해석의 모호함이 드러난다. 단순 회귀 테스트보다 강력하다.

**5.1이 5.2~5.7의 선행 조건**이므로 직렬. **Wave당 최소 1 PR** — 순차 브랜치 의존 규칙(CONSTITUTION.md §3.3)상 병렬 브랜치는 충돌한다.

---

## 11. ADR 인덱스

`Projects/co-newbiz/docs/adr/` — 워크스페이스 포맷 준용(`# ADR-NNNN` / Status / Date / Deciders / Context / Decision / Consequences). **co-newbiz 로컬 시퀀스(0001~)**.

| ADR | 제목 |
|---|---|
| 0001–0002 | SQLite 채택 / **DB 이식성 규약** |
| 0003–0004 | **기준정보 범위·코드 체계** / **캐시 우선 정책과 소급개정 보존** |
| 0005–0006 | run 기반 전면 버전 관리·귀인분석 / 프록시 체인 환산 방법론 |
| 0007–0008 | 문서 렌더링 Python 스택 / Stage Gate·Kill Criteria |
| 0009–0012 | 인증(PBKDF2) / 웹 스택 / **MCP는 REST 경유** / 감사 로그 append-only |
| 0013–0015 | 팀 편성과 PM 통괄 / 배포·롤백 / 운영 리듬·SLO |
| 0016–0019 | **RAG 판정 체계(데이터 신뢰도 캡)** / 자동 재분석·알림 정책 / 성장성 앵커링 / OS 레벨 스케줄러 |
| 0020–0022 | **절차 `references:` 오버라이드 모델** / **`project_policy_pin` 소급 정책** / 용어집 툴링 연동 |
| 0023–0024 | 지역 프로파일 스키마 / 프로파일 우선 원칙과 에이전트 승격 기준 |
| 0025–0027 | 가치사슬 연관성과 프록시 체인의 분리 / 우발채무 확률·분포 모델링 / **보상 정합성의 상향 편향 가정** |
| 0028–0029 | **`scope` × `level` 직교 축과 Entity IC → Group IC 강제** / 그룹 IC는 순위 결정 |
| 0030–0031 | 인센티브 획득·환수 단일 테이블 / 파트너 확보 실패를 중단 시나리오로 |
| 0032–0034 | **문서 우선 실행 순서** / **추적성 매트릭스 의무화** / **수기 파일럿 선행 원칙** |
| 0035–0037 | **문서 5계층과 강제력 구분** / **waiver 만료일·개정 트리거** / **게이트 차단 규칙** |
| 0038–0040 | **★ 프로젝트 단위 need-to-know 접근 통제** / **★ 개인정보 최소수집·집계우선** / MNPI insider list |
| 0041–0042 | 환율 적용 시점 정책 / MVP 경계와 축소 순서 |
| 0043–0044 | **★ 4개 도메인 구조와 PM ↔ 도메인 리드 조정 모델** / 산업·지역 프로파일 구동 |

**ADR 트리거** — ADR 없이 진행 불가: DB 스키마 파괴적 변경 / 기준정보 코드 체계 변경 / 환산 방법론 변경 / RAG 판정 규칙·임계값 변경 / Stage Gate·Kill Criteria 변경 / **규정·절차 개정** / 지역 프로파일 필수 축 변경 / 알림 정책 변경 / 외부 데이터 소스 변경 / DB 엔진·이식성 예외 / **인증·권한·정보보호 모델 변경** / MCP 도구 권한 확대 / **팀 편성·에이전트 승격** / 배포·롤백 전략 변경

---

## 12. 사전 검토 회의 결과 (2026-08-19)

`meeting-facilitation` 방식으로 계획 전체를 8개 관점에서 역검토했다. 전사: `memory/meeting-2026-08-19-co-newbiz-plan-review.md`

| # | 제기자 | 누락 | 심각도 | 반영 |
|---|---|---|---|---|
| **G1** | compliance-officer, legal-counsel | **개인정보·민감정보 처리 체계 부재** | **치명** | §8.10(b) |
| **G2** | security-engineer | **프로젝트 단위 need-to-know 접근 통제 부재** | **치명** | §8.10(a) |
| **G3** | legal-counsel | **MNPI 관리 부재** | 높음 | §8.10(c) |
| **G4** | financial-analyst | 환율 적용 시점 정책 부재 | 높음 | §8.1 |
| **G5** | data-architect | 데이터 보존·아카이빙 정책 부재 | 중간 | §8.1 |
| **G6** | risk-officer | MVP 경계·범위 축소 경로 부재 | 높음 | §10.2 |
| **G7** | process-governance-manager | 기존 방식 → 새 체계 전환 계획 부재 | 중간 | §10.5 (2.7) |
| **G8** | pm | 조직 관점 성공 기준 부재 | 중간 | §13 |

**G1·G2가 치명인 이유**: 이 둘은 나중에 얹을 수 없다. 접근 통제는 스키마와 API 전 계층에 걸리고, 개인정보는 수집 시점부터 근거가 있어야 한다. **Stage 4 이후에 발견하면 전면 재작업이다.**

---

## 13. 성공 기준

"시스템이 돌아간다"와 "조직이 쓴다"는 다르다.

| 축 | 기준 | 측정 시점 |
|---|---|---|
| **시스템** | §14 검증 전 항목 통과, `security-scan` 0 Critical, 수기↔시스템 파일럿 결과 일치 | Stage 5 종료 |
| **거버넌스 채택** | 신규 검토 건의 **100%가 시스템 게이트를 경유**, 우회 건 0 | 가동 후 3개월 |
| **효율** | 게이트별 소요 기간 중위값 단축, 재작업률 감소 | 가동 후 6개월 |
| **품질** | 체크리스트 완료율, **waiver 발생률 안정화**(초기 급증 후 하락) | 가동 후 6개월 |
| **지속성** | 규정 개정 1회가 **`policy:impact` → 시스템 반영까지 완주** | 첫 개정 시 |

> **마지막 항목이 이 프로젝트의 진짜 시험대다.** 규정 개정 한 번을 시스템 반영까지 끊김 없이 통과시키지 못하면 문제 #9를 풀지 못한 것이다.

---

## 14. 검증

### 14.1 구조
```bash
cd Projects/co-newbiz && bun scripts/audit.ts
cd Projects/co-newbiz && bun scripts/agent-verify.ts && bun scripts/skill-lifecycle-audit.ts
```
플랫폼 parity(`.claude/` ↔ `.gemini/`), 모든 agent에 Section C. **AGENTS.md 로스터가 `agents/**` 실제 구조와 일치**.

### 14.2 규정·절차
```bash
bun scripts/co-newbiz/newbiz.ts proc:resolve --entity kr-ops --region US --procedure brownfield-screening
```
1. 병합 결과에 **공통 + 지역(US) + 각사 단계가 모두 반영**되고 **각 단계 출처가 표시**되는지
2. **공통 절차 복사본을 일부러 만들어 → 감사에서 차단**되는지 (안 걸리면 실패)
3. `policy:impact --from v1.2 --to v1.3` → 영향 목록 산출
4. **`project_policy_pin`**: 진행 중 프로젝트가 개정 후에도 **착수 시점 규정으로 평가**되는지
5. `region-profiles/_validate.ts` — 필수 축 누락 시 **실패**

### 14.3 거버넌스 운영
① 필수 체크리스트 미완 상태로 게이트 통과 시도 → **차단** ② waiver 발급 후 재시도 → 통과 + 기록 ③ **만료된 waiver로 시도 → 다시 차단** ④ 동일 조항 waiver 임계 누적 → **개정 트리거 발화** ⑤ 가이드라인(권고) 미준수 → 차단이 아니라 **사유 입력 요구**(차단하면 계층 구분 미구현) ⑥ 해석례 등록 후 검색

### 14.4 2단계 승인 체인
① Entity IC 미승인 상태에서 Group 진입 → **차단 + `blocked_reason`** ② 승인 후 진입 → Group 전용 절차만 노출 ③ 계열사 안건 3건 → **`group_agenda` 순위 비교 뷰** ④ 계열사 간 거래 → **일감 몰아주기 체크 자동 발화**

### 14.5 기능 E2E — 크랭크축 시나리오
```bash
bun scripts/co-newbiz/newbiz.ts db:migrate && bun scripts/co-newbiz/newbiz.ts md:sync
```
1. `fetch --all` → 적재 정상 · 2. 즉시 재실행 → **네트워크 호출 0건** · 3. 과거 값 변조 후 `fetch --check-only` → `revised` 기록 + **기존 관측치 보존 + `revision_no` 증가** · 4. 미등록 산업코드 → **적재 실패 + `staging_unmapped` 격리**
5. `fin:analyze` → KPI + **ROIC 드라이버 트리** · 6. `fin:project` → `anchor_ref` 확인 · 7. 성장률 상위 5% 강제 → **base rate 자동 경고**
8. `law:sync` · 9. `assume` → `kind='user'` · 10. `calibrate` → β/R²/lag/CI · 11. `convert` → **오차 밴드 부착**
12. `model --label "v1 Pre-FS"` · 13. `simulate --seed 42` → 재실행 시 **동일 결과**
14. **RAG**: 체인 등급 C 강제 → **재무 Green이어도 종합 AMBER 캡** (캡 미작동 시 실패)
15. **히스테리시스**: IRR hurdle+1.0%p → Amber 유지, +2.5%p → Green 승격
16. **회귀 테스트(가장 중요)**: 유가 신규 관측치 → `model v2` → `diff v1 v2` → **보고서 재작성 없이** NPV 델타가 변수별 금액으로 분해
17. **자동 감시**: Watchlist 등록 → 유가 개선 → `watch:run` → 자동 run → RAG 상승 → **알림 발송**. 즉시 재실행 시 **쿨다운으로 중복 미발송**
18. Staleness gate → `report` **차단** · 19. `export --format docx,pdf,hwpx` → **PDF 한글 깨짐 육안 확인**, 표지 run id·version·policy_version 인쇄

### 14.6 전·후방 연관성
① pass-through rate 0 강제 → 원자재 상승 시나리오에서 **마진 직격** ② `proxy_link`와 `value_chain_link`가 **서로의 계수를 참조하지 않는지** 코드 검사 ③ 대체 위협 최고 등급 → **Kill Criteria 후보로 표면화**

### 14.7 M&A 특수 5종
- 독과점: HHI 델타 + 관할별 신고 판정 + **시정조치 시나리오가 IRR에 반영**
- 고객 이탈: **CoC 조항 계약이 `dd_finding`으로 등록되고 밸류에이션 브리지에 연결**
- 환수: 혜택 인벤토리 → **이전 시 환수 예상액이 시나리오에 반영**
- **경영진 보상**: CoC 트리거 보상이 **클로징 시점 현금 유출로 계상** · 경업금지 무효 관할에서 **키맨 이탈 리스크 상향**
- **임직원 보상**: 피인수 급여가 낮은 케이스와 높은 케이스 각각 투입 → **양쪽 모두 인건비 가정 상승**(한쪽만 오르면 불이익변경 금지 로직 미구현)
- **부채·우발채무**: 확률·분포 투입 후 `simulate` → **NPV 분포 하방 꼬리 증가** · 금리 +200bp → **DSCR covenant 위반 시 `covenant_test.breached=1` + Kill Criteria 발동** · CoC 기한이익상실 차입금은 **클로징 시 상환 소요로 계상**

### 14.8 신규 설립
인프라 항목별 **리드타임·비용이 capex/일정에 반영** · 하수 여유용량 부족 시 **기술·실행 차원 Red** · `compare_sites` 후보 3곳 비교 시 **인센티브 NPV가 인프라 capex·물류비와 같은 표에서 합산** · 착공 시한이 인허가 크리티컬 패스보다 짧으면 **감면 소멸 리스크 경고**

### 14.9 파트너십
롱리스트→숏리스트 평가 축 완비 · **제재 이력 후보가 컴플라이언스 리스크 High로 자동 분류** · 파트너 확보 실패가 **지연이 아닌 중단(Kill Criteria)으로 처리**

### 14.10 인증·권한
초기화 전체 흐름(요청→관리자 임시→로그인 시 **전 화면 차단·변경 강제**→정상) · **DB 직접 열어 `password_hash` 원문 복원 불가** · `viewer`로 모델 실행 → **403** · 실패 N회 잠금 · 세션 강제 종료 후 401

### 14.11 ★ 정보 보호 — 한 군데라도 새면 실패
1. 프로젝트 **비멤버**로 로그인 → 해당 프로젝트가 **목록·검색·상세 API·보고서·MCP 어디에서도 보이지 않는지** 전수 확인
2. **`admin` 계정으로도** 멤버십 없이 딜 정보 접근 불가 (접근되면 실패)
3. 리포지토리 계층에서 프로젝트 필터 우회 경로가 있는지 코드 검사
4. `mnpi_flag=true` → **insider_list 자동 생성**, 열람 시 `data_access_log` 기록, **MCP 기본 응답에서 제외**
5. `comp_benchmark`에 **개인별 급여 행이 하나라도 있으면 실패**
6. `management_package.executive_ref`에 **실명·식별자가 들어가면 실패**
7. 보존기간 경과 데이터에 `retention_policy` 배치 작동
8. `wall_group` 배제 대상자 접근 차단

### 14.12 용어집 / 웹 UI / MCP / 운영
- **용어집**: `glossary:lint` 미정의 약어 탐지 · UI 툴팁 · **보고서 말미 용어 부록 자동 생성** · MCP `lookup_term`
- **웹 UI**: RAG 신호등·히스토리, 알림 센터, **절차 뷰어(출처 표시)**, **용어 툴팁**, ROIC 워터폴, 프록시 체인 다이어그램, 토네이도, 버전 브리지, 인허가 DAG · 다크모드·반응형 · 콘솔 에러 0건 · `accessibility-audit` 통과(**색상 단독 구분 없음**)
- **MCP**: 도구 노출 · 호출이 **REST 경유** + `audit_log` 기록 · 스코프 없는 토큰의 쓰기 거부 · Claude Desktop/Antigravity/Codex CLI 각각 최소 1개 호출 성공
- **배치·운영·보안**: 스케줄러 **실제 트리거 1회 성공**, `job_run` 기록 · 배치 실패 시 `sre` 알림 · 백업 후 **실제 복원 훈련 1회 성공** · `security-scan` 0 Critical · **배포 후 롤백 1회 실전 검증** · **Webhook 페이로드에 민감 수치 미포함**

### 14.13 성능·이식성·언어
```bash
bun scripts/co-newbiz/newbiz.ts db:explain --queries docs/db-schema.md
bun scripts/co-newbiz/newbiz.ts db:export --dialect postgres --out /tmp/pg.sql
```
주요 쿼리 **full table scan 부재**, 1만 iteration 조회 지연 측정 · 생성 DDL을 SQLite 전용 구문 금지 목록과 대조 · `deliverables/`·UI는 한국어, `agents/`·`skills/`·`docs/`·코드 주석은 영어(CLAUDE.md §4)

---

## 15. 미해결 사항

| # | 항목 | 결정 필요 시점 |
|---|---|---|
| O-1 | 각사(entity) 목록과 코드 체계 — `md_entity` 시드 | Stage 2 착수 전 |
| O-2 | 첫 대상 산업·지역 프로파일 우선순위 | Stage 2 (M6 이후) |
| O-3 | Stage 3 수기 파일럿에 쓸 실제 검토 건 선정 | Stage 3 착수 전 |
| O-4 | 사내 서버 사양·네트워크 구성·HTTPS 인증서 | Stage 4 |
| O-5 | 기존 과거 검토 건의 시스템 초기 적재 여부·범위 | Stage 4 |
| O-6 | 알림 채널(사내 메일 서버 / Slack / Teams) 확정 | Stage 5 (5.4) |
| O-7 | 전체 일정·리소스 추정 — 현재 계획에 없음 | Stage 1 (M8) |

---

## 16. 참고

- 원본 계획: `~/.claude/plans/fuzzy-mapping-forest.md` (Claude Code 세션 산출물)
- 구조 참조: `Projects/safety_os/` — `agents/{_core,_shared,domains}`, `workflows/_shared/REFERENCE-SPEC.md`, `regulations/KR/legal-glossary.yaml`, `industry-profiles/_validate.ts`
- 재무 파이프라인: `templates/co-consult/skills/financial-statement-analysis/SKILL.md` v1.3.0, `templates/co-consult/python/`
- MCP 패턴: `Projects/co-architect/mcp/`, `Projects/co-architect/.mcp.json`
- 공통 라이브러리: `scripts/lib/auth.ts`, `scripts/lib/ssrf.ts`
- 거버넌스: `AGENTS.md §3`(PM Gateway), `CONSTITUTION.md §3.3`(순차 브랜치), `CLAUDE.md §4`(언어 정책), `docs/adr/0055-spec-registry-enforcement.md`
