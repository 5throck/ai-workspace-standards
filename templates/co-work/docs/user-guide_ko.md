# Co-Work 사용자 가이드

> 실제로 이 팀을 매일 사용하기 위한 실용적이고 작업 중심의 가이드입니다. 팀 구성과 미션 개요는 [`README.md`](../README.md)를 참고하세요. 전체 거버넌스/에이전트 명세는 [`AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

모든 작업은 동일한 방식으로 시작됩니다: **PM과 대화하세요, 전문 에이전트를 직접 호출하지 마세요.**

1. **작업을 평범한 언어로 설명하세요.** 예: "X에 대한 리서치 요약과 클라이언트용 보고서가 필요합니다."
2. **PM이 요청을 분류합니다.** `AGENTS.md` §3.5의 Phase Determination 표를 기준으로, 어떤 전문가가 어떤 순서로 필요한지 파악합니다.
3. **PM이 실행 계획 표를 먼저 보여줍니다** (2개 이상의 파일 또는 2단계 이상의 순차 작업인 경우):

   | 작업 | 에이전트 | 티어 | 모델 | 플랫폼 |
   |------|----------|------|------|--------|
   | 주제 X 리서치 | analyst | Medium | sonnet | Claude Code |
   | 보고서 초안 작성 | content-writer | Medium | sonnet | Claude Code |

4. **사용자가 계획을 승인(또는 조정)합니다.** 그 후 PM은 전문가를 dispatch합니다 — 파일을 작성하는 작업은 순차적으로, 읽기 전용 리서치/분석 작업만 병렬로 진행합니다.
5. **PM이 원래 요청 대비 산출물을 검증**하고 품질 게이트(`bun scripts/audit.ts`)를 실행합니다.
6. **`/sync "type: description"`로 작업을 마무리합니다** — 커밋 및 PR 오픈의 유일한 지원 경로입니다. 순서대로 memlog → CHANGELOG 항목 → audit → commit → push → PR을 실행합니다. 직접적인 `git commit`/`git push` 호출은 pre-commit hook에 의해 차단됩니다.

**기억할 것:** "analyst씨, ~해줄 수 있어요?"라고 타이핑하고 있다면 — 멈추고 PM에게 요청하세요. PM은 단일 진입점이며, 전문가는 직접 대화 대상이 아니라 dispatch 대상입니다.

## 2. 어떤 종류의 작업인가요?

아래 표를 사용하여 PM이 어떤 전문가를 투입할지 예측하세요 — 직접 에이전트를 호출하기 위해서가 아니라, 작업을 효율적으로 설명하기 위한 참고용입니다.

| 사용자 시나리오 | 예상 에이전트 | 관련 스킬 |
|------------------|----------------|-----------|
| "주제를 조사하고 결과를 종합해야 합니다" | **analyst** | research-analysis |
| "이 리서치를 다듬어진 문서/보고서로 만들어주세요" | **content-writer** | documentation-writing |
| "기술 문서, 사용법 가이드, 레퍼런스 자료를 작성해주세요" | **technical-writer** | documentation-writing, api-documentation |
| "REST/GraphQL API, SDK, 개발자용 스펙을 문서화해주세요" | **technical-writer** | api-documentation |
| "산출물 추적, 일정 조율, 상태 보고를 해주세요" | **project-coordinator** | — |
| "여러 전문가 간 토론을 진행해주세요" | **project-coordinator** (`/meeting` 경유) | — |
| "내러티브, 변화 스토리, 프레젠테이션 구조를 만들어주세요" | **storyteller** | — |
| "Word/Excel/PowerPoint/Teams/SharePoint/Outlook 작업을 해주세요" | **ms365-expert** | — |
| "작업을 커밋하고 PR을 열어주세요" | PM (파이프라인 전용) | `/sync` |
| "오늘 세션을 기록/변경 로그 항목을 추가해주세요" | PM (직접, memory/CHANGELOG만) | `/memlog`, `/changelog` |

작업이 여러 행에 걸쳐 있다면 (예: 리서치 → 초안 → 검토), PM이 자동으로 여러 단계에 걸쳐 전문가를 순서대로 배치합니다 — 사용자가 직접 요청을 쪼갤 필요는 없습니다.

## 3. 표준 다단계 워크플로

Co-Work의 대부분의 실질적 작업은 동일한 4단계 파이프라인을 따릅니다 (전체 단계 모델은 `AGENTS.md` §3.1.4 및 §4.2 참고):

```
사용자 요청
   │
   ▼
PM 분류(Triage)          — PM이 산출물 유형을 분류(AGENTS.md §3.5), 실행 계획 표를 표시
   │
   ▼
설계 승인                — 새로운 구조/스키마/컨벤션에만 해당 (Phase 1-2 게이트); 일반 문서 작업은 생략
   │
   ▼
전문가 Dispatch          — analyst → content-writer / technical-writer → 필요 시 project-coordinator / storyteller / ms365-expert
   │
   ▼
QA 게이트                — PM이 `bun scripts/audit.ts` 실행; 통과해야 마무리 가능
   │
   ▼
마무리                    — `/sync "type: description"`로 커밋, 푸시, PR 오픈
```

**실제로 입력하게 될 명령어:**
- `/sync "feat: add onboarding guide"` — 전체 파이프라인: memlog → sync-md → changelog → audit → commit → PR.
- `/changelog "..."` — 전체 파이프라인 실행 없이 독립적인 `CHANGELOG.md [Unreleased]` 항목만 추가.
- `/memlog "summary"` — CHANGELOG나 git을 건드리지 않고 `memory/YYYY-MM-DD.md`에 세션 노트만 추가.
- `/new-task "name"` — 오늘 메모리 로그에 작업 추적 블록 생성.
- `/meeting` — 구조화된 인라인 멀티 에이전트 토론 실행 (PM이 진행, 트랜스크립트는 `memory/meeting-YYYY-MM-DD-[slug].md`에 저장).

**절대** 직접 `git commit`/`git push`/`--no-verify`로 이 과정을 우회하지 마세요 — pre-commit hook이 `/sync`를 거치지 않은 커밋을 의도적으로 차단합니다.

## 4. 참여(Engagement) / 프로젝트 단계 구조

Co-Work 작업은 `AGENTS.md`(§3.5, §4.2)에 정의된 동일한 단계 모델을 따라 진행됩니다:

| 단계 | 담당 | 진행 내용 |
|------|------|-----------|
| **Phase 0 — 프로젝트 개시** | PM | PM이 요구사항을 평가하고 필요 시 에이전트/스킬을 생성·조정, `AGENTS.md` 업데이트 |
| **Phase 1 — 리서치 및 분석** | analyst, storyteller | 읽기 전용 조사, 데이터 종합, 내러티브 프레이밍 — 독립적인 경우 병렬 dispatch |
| **Phase 2 — 설계 검증** | PM + storyteller | 새로운 구조, 스키마, 컨벤션은 구현 전에 명시적 승인 게이트를 거침 |
| **Phase 3 — 설계 인계 / 초안 작성** | content-writer, technical-writer | 승인된 계획을 실제 문서/가이드로 전환 |
| **Phase 4 — 실행** | project-coordinator, ms365-expert | 배송 로지스틱스, 일정 조율, MS365 관련 작업; 전문가들은 일상적인 단계는 서로 직접 인계 가능 |
| **Phase 5 — 라이프사이클 마무리** | PM | 거버넌스 기록 업데이트, 의사결정을 `memory/YYYY-MM-DD.md`에 기록 |
| **Phase 6 — QA 및 마무리** | PM | `bun scripts/audit.ts` 실행 (에스컬레이션 전 최대 2회 반복), 이후 `/sync`로 PR 오픈 |

쓰기 작업은 항상 **순차적**으로 진행됩니다 (파일 잠금 충돌 방지를 위해 한 번에 하나의 전문가만); 읽기 전용 리서치/분석은 **병렬**로 dispatch할 수 있습니다.

## 5. 산출물 저장 위치

Co-Work는 일반적인 `deliverables/` 폴더가 아니라 `docs/` 하위에 산출물을 정리합니다:

| 위치 | 저장되는 내용 |
|------|----------------|
| `docs/reports/` | 최종, 클라이언트 제공용 산출물 |
| `docs/drafts/` | 검토 대기 중인 작업 진행 중 문서 및 초안 |
| `docs/research/` | 리서치 노트, 소스 자료, 참고 자료 수집 |
| `memory/YYYY-MM-DD.md` | 세션 로그, 회의 트랜스크립트, 의사결정 기록 |
| `CHANGELOG.md` | 주요 변경 사항의 사용자용 요약 (`[Unreleased]` 섹션, `/changelog` 또는 `/sync`로 추가) |

**염두에 둘 도메인 규칙:**
- 모든 리서치 결과는 출처 인용과 함께 `memory/`에 기록해야 합니다.
- 이해관계자 검토 의견은 프로젝트 조율 로그에서 추적해야 합니다.
- 배포 산출물은 배포 전에 `/sync`를 통해 버전 관리되어야 합니다.
