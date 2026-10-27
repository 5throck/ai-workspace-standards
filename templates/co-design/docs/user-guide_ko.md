---
lang: ko
lang_reason: source-material
translated_from_hash: 56f60d6e12b8cfe1dbbf747a60e19ac47ff29a24685ca2ccdb81f43b8a736101
---
# Co-Design 사용자 가이드

**Language**: [English](user-guide.md) · **한국어**

> [README_ko.md](../README_ko.md)를 보완하는 실용적인 작업 중심 가이드입니다. README가 팀을 소개한다면, 이 가이드는 실제로 작업을 진행하는 방법을 보여줍니다: 인게이지먼트를 시작하는 방법, 무엇을 누구에게 요청해야 하는지, 결과물이 어디에 저장되는지.

---

## 1. 빠른 시작

1. **먼저 PM과 대화하세요.** 전문 에이전트를 직접 호출하지 마십시오 — 항상 Project Manager(PM)와 함께 요청을 시작하세요. PM은 전체 팀의 단일 진입점입니다.
2. **PM은 디스패치 전에 실행 계획 테이블을 제시합니다.** 2개 이상의 에이전트 또는 2단계 이상의 순차 작업이 필요한 모든 요청에 대해 다음과 같은 테이블을 볼 수 있습니다:

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | 온보딩 여정 매핑 | `service-designer` | Medium | sonnet |
   | 2 | 디자인 토큰 정의 | `design-lead` | High | opus |
   | N | `/sync "feat: onboarding journey + tokens"` | pm | Medium | sonnet |

   계획을 검토한 후 작업이 시작되기 전에 승인하세요.
3. **전문가들이 작업을 실행합니다.** 일상적인 단계에서는 (예: `design-lead` → `visual-designer`) PM을 매번 거치지 않고 서로 직접 핸드오프합니다.
4. **`/sync`로 마무리합니다.** 모든 인게이지먼트 구간은 `/sync "type(scope): message"`로 종료되며, 전체 파이프라인을 실행합니다: memlog → CHANGELOG 항목 → audit → commit → push → PR. 직접 커밋하거나 푸시하지 마세요 — pre-commit 훅이 이를 차단합니다.

**기타 일상 명령어:**
- `/changelog "..."` — sync 실행 전에 `CHANGELOG.md [Unreleased]` 항목을 추가합니다.
- `/memlog "summary"` — 전체 파이프라인을 실행하지 않고 세션 노트만 기록합니다.
- `/meeting "topic" [--agents a,b] [--rounds N]` — 예를 들어 `design-lead`와 `storyteller` 간의 디자인 이견을 해결하기 위해 구조화된 멀티 에이전트 토론을 즉석에서 실행합니다.

---

## 2. 어떤 종류의 디자인 작업을 갖고 계신가요?

아래 테이블을 사용해 PM에게 누구를(또는 어떤 스킬을) 투입해달라고 요청할지 파악하세요. 에이전트 이름을 직접 지정할 필요는 없습니다 — 문제만 설명하면 PM이 매칭해 줍니다 — 하지만 이 매핑을 알아두면 요청을 구체적으로 표현하고 기대치를 설정하는 데 도움이 됩니다.

| 시나리오 | 에이전트 | 스킬 | 단계 |
|----------|----------|------|------|
| "사용자가 실제로 무엇을 필요로 하는지 / 어디서 어려움을 겪는지 모르겠다" | `ux-researcher` | — | 1 |
| "디자인 시스템 뒤에 있는 스토리 / 철학은 무엇인가?" | `storyteller` | — | 1–2 |
| "디자인 토큰, 컬러 시스템, 컴포넌트 아키텍처를 정의해달라" | `design-lead` | `ui-ux-design-intelligence` | 2–3 |
| "이 화면 / 컴포넌트 / 플로우를 디자인해달라" | `visual-designer` | `ui-ux-design-intelligence` | 3 |
| "서체를 선택하고 타입 스케일을 정의해달라" | `typography-expert` | — | 3 |
| "고객의 엔드투엔드 여정 / 서비스 블루프린트를 매핑해달라" | `service-designer` | `service-design` | 3 |
| "특정 터치포인트를 최적화하거나 프론트스테이지/백스테이지 운영을 정렬해달라" | `service-designer` | `service-design` | 3 |
| "테스트나 이해관계자 데모용 인터랙티브 프로토타입을 만들어달라" | `prototype-engineer` | — | 4 |
| "실제 사용자로 이 디자인을 검증 / 사용성 테스트를 진행해달라" | `ux-researcher` | — | 4 (루프) |
| "엔지니어링팀에 넘길 최종 핸드오프 자료를 준비해달라" | `prototype-engineer`, `visual-designer` | `ui-ux-design-intelligence` | 4 |
| "팀 간 디자인 의사결정을 조율해달라" | PM (via `/meeting`) | — | 모든 단계 |

**참고:**
- `typography-expert`는 선택적입니다 — 브랜드 지침에 의해 폰트 결정이 이미 고정되어 있다면 생략하세요.
- `storyteller`는 내러티브 요소가 없는 순수 기능적/기술적 디자인 작업에서는 선택적입니다.
- 요청이 여러 행에 걸쳐 있는 경우(예: "온보딩 플로우를 조사한 후 디자인해달라"), PM이 여러 에이전트를 순서대로 배치하고 전체 실행 계획을 보여줍니다.

---

## 3. 디자인 파이프라인 둘러보기

Co-design은 7단계 파이프라인(Phase 0–6)을 따릅니다. 프로토타이핑(Phase 4)은 엄격한 선형 핸드오프가 아니라 필요할 때 검증 루프로 되돌아갑니다.

```
디자인 브리프 접수
  │
  ▼
Phase 0 — 프로젝트 시작     (PM)
  PM이 디자인 목표를 명확히 하고, 범위를 확정하고, 팀을 구성합니다.
  │
  ▼
Phase 1 — 사용자 리서치 및 내러티브 기반     (ux-researcher, storyteller)
  리서치 결과, 페르소나, 디자인 철학 선언문.
  │
  ▼
Phase 2 — 디자인 방향 확정 및 승인     (design-lead, storyteller; PM 게이트)
  디자인 방향 + 토큰 아키텍처를 종합 — 명시적인 사용자 승인 필요.
  │
  ▼
Phase 3 — 디자인 시스템 및 실행     (design-lead, visual-designer, service-designer, typography-expert)
  승인된 방향에 따라 고해상도 디자인, 사양, 타입 시스템을 산출합니다.
  │
  ▼
Phase 4 — 프로토타이핑 및 핸드오프     (prototype-engineer; i18n-specialist 지원)
  인터랙티브 프로토타입, 인터랙션 사양, 개발자 핸드오프 문서;
  필요 시 ux-researcher가 검증 루프로 다시 투입됩니다.
  │
  ▼
Phase 5 — 라이프사이클 최종화     (PM)
  거버넌스 레코드를 갱신하고, 결정을 memory/에 기록합니다.
  │
  ▼
Phase 6 — 품질 보증 및 최종화     (PM)
  bun scripts/audit.ts 게이트 통과 후 /sync "feat: description" → PR 생성.
```

**관련된 주요 명령어/스크립트:**
- `bun scripts/audit.ts` — QA 게이트. Write/Edit 이후 자동으로 실행되는 것이 아니라, pre-push(`scripts/hooks/pre-push.ts`)와 `/sync` 파이프라인의 audit 게이트 단계에서 실행됩니다.
- `/sync "type(scope): message"` — 커밋, 푸시, PR 생성을 위한 유일하게 승인된 방법입니다. 직접적인 `git commit`/`git push` 호출은 pre-commit 훅에 의해 차단됩니다.
- `/meeting` — 파이프라인 중간에 단계를 벗어나지 않고 이견을 해결하거나 결정을 검토할 때 사용합니다.

---

## 4. 인게이지먼트 / 프로젝트 단계 구조

| 단계 | 이름 | 진행 내용 | 리드 에이전트 |
|------|------|-----------|----------------|
| 0 | 프로젝트 시작 | PM이 디자인 목표를 명확히 하고, 범위를 확정하고, 팀을 구성 | PM |
| 1 | 사용자 리서치 및 내러티브 기반 | 사용자 리서치, 페르소나, 디자인 철학 선언문 | `ux-researcher`, `storyteller` |
| 2 | 디자인 방향 확정 및 승인 | 방향 + 토큰 아키텍처 종합; 명시적 사용자 승인 게이트 | PM + `design-lead`, `storyteller` |
| 3 | 디자인 시스템 및 실행 | 승인된 방향에 따른 고해상도 디자인, 사양, 타입 시스템 | `design-lead`, `visual-designer`, `service-designer`, `typography-expert` |
| 4 | 프로토타이핑 및 핸드오프 | 인터랙티브 프로토타입, 인터랙션 사양, 개발자 핸드오프 문서 | `prototype-engineer` (선택 지원: `i18n-specialist`) |
| 5 | 라이프사이클 최종화 | 거버넌스 레코드 갱신, 결정 기록 | PM |
| 6 | 품질 보증 및 최종화 | 감사 게이트, `/sync`, PR | PM |

> 전체 단계 정의는 [docs/phase-definitions.md](phase-definitions.md)에 있습니다. 프로젝트별 디자인 스택 및 워크플로 커스터마이징은 [docs/co-design.context.md](co-design.context.md)에 있습니다.

---

## 5. 산출물 / 결과물 저장 위치

| 위치 | 내용 |
|------|------|
| `docs/designs/` | 디자인 결정과 근거 (디자인 방향성 작성, ADR 스타일 노트) |
| `docs/specs/` | UI/UX 사양 (컴포넌트 스펙, 디자인 토큰 문서, 접근성 보고서) |
| `memory/YYYY-MM-DD.md` | 세션 로그, 디자인 검토 트랜스크립트, 미팅 결과 |
| `CHANGELOG.md` | 출시된 디자인 변경 사항의 사용자 대상 요약. 릴리스 전까지 `[Unreleased]`에 위치 |

인터랙티브 프로토타입은 `playground/` 데모 앱에 있으며, 프로토타입 및 핸드오프 디자인 문서는 `docs/designs/`에 있습니다.

새 컴포넌트를 만들기 전에 기존 컴포넌트와 토큰을 재사용하세요 — 새 컴포넌트는 `docs/specs/`에 문서화하고 디자인 시스템 검토를 위해 `design-lead`에 등록하세요.

---

*전체 에이전트 구성, 미션 선언문, 워크플로 개요는 [README_ko.md](../README_ko.md)를 참고하세요. 거버넌스, 디스패치 규칙, PM 게이트웨이 사양은 [AGENTS.md](../AGENTS.md)를 참고하세요.*
