# co-develop 사용자 가이드

> co-develop 에이전트 팀 사용을 위한 실전 중심 가이드입니다. 팀 개요와 구성원 목록은 [README.md](../README.md)를, 거버넌스 및 디스패치 규칙은 [AGENTS.md](../AGENTS.md) 및 [CLAUDE.md](../CLAUDE.md) / [GEMINI.md](../GEMINI.md)를 참고하세요.

---

## 1. 빠른 시작

co-develop은 전적으로 **PM 게이트웨이 패턴**으로 운영됩니다. 사용자는 PM과 대화하고, PM이 계획을 수립하고, PM이 전문 에이전트를 디스패치하며, PM이 `/sync`로 마무리합니다.

1. **작업을 평이한 언어로 설명합니다** — "로그인 엔드포인트를 추가해줘", "결제 흐름의 불안정한 테스트를 고쳐줘", "이 PR을 리뷰해줘". 전문 에이전트를 직접 호출하려고 하지 마세요. 전문 에이전트는 사용자의 직접 요청을 거부하고 PM으로 리다이렉트합니다.
2. **PM이 작업을 분류**(Phase Determination)하고, 다단계 작업(2개 이상 파일 또는 2단계 이상 순차 작업)에 대해서는 다른 어떤 작업보다 먼저 **실행 계획 표**를 출력합니다.

   | # | Task | Agent | Tier | Model |
   |---|------|-------|------|-------|
   | 1 | [작업 설명] | [전문 에이전트] | High/Medium/Low | [모델] |
   | N | `/sync "type(scope): message"` | pm | Medium | [모델] |

3. **사용자가 계획을 승인**합니다(또는 수정을 요청합니다). PM은 멀티 에이전트 작업에서 이 단계 없이는 절대 전문 에이전트 디스패치로 넘어가지 않습니다.
4. **PM이 네이티브 `Agent` 도구로 전문 에이전트를 디스패치**합니다. 표의 각 행마다 하나씩, 순차/병렬 실행 순서를 준수합니다.
5. **PM이 QA 게이트를 실행**(`bun scripts/audit.ts`)하고 인수 기준(acceptance criteria)을 검증합니다.
6. **PM이 `/sync "type(scope): message"`로 마무리**합니다 — 이 단일 명령이 전체 파이프라인을 실행합니다: 메모리 로그 → CHANGELOG 항목 → audit → 커밋 → 푸시 → PR. 사용자는 절대 `git commit`/`git push`를 직접 실행하지 않습니다. pre-commit 훅이 `/sync` 외부에서의 실행을 차단합니다.

**경험칙**: 에이전트 파일(`agents/code-writer.md` 등)에 직접 무언가를 시키려 하고 있다면 멈추고, 대신 PM을 통해 요청을 전달하세요.

---

## 2. 어떤 종류의 개발 작업인가요?

아래 표를 참고하면 PM이 어떤 에이전트/스킬을 디스패치할지 예상할 수 있습니다. 에이전트 이름을 직접 지정할 필요는 없지만—작업을 설명하는 것만으로 충분합니다—이 매핑을 알고 있으면 요청을 더 명확하게 작성하는 데 도움이 됩니다.

| 작업 유형 | 예상 에이전트 | 예상 스킬 | 비고 |
|-----------|--------------|--------------|-------|
| 신규 기능 / 신규 엔드포인트 | `architect` → `code-writer` → `test-runner` | `test-driven-development` | Architect가 먼저 계획/ADR을 작성하며, 계획이 승인된 후에만 code-writer가 구현 |
| 버그 수정 | `code-writer` → `test-runner` | `test-driven-development` | 수정 전에 실패하는 테스트를 작성/확인 (red-green-refactor) |
| 코드 리뷰 / PR 피드백 | `security-monitor` 또는 PM 지정 리뷰어 | `code-review` | 정확성, 유지보수성, 보안, 모범 사례에 초점 |
| 리팩토링 / 기술 부채 정리 | `code-writer` | `refactoring` | 동작을 보존하며, 회귀가 없는지 `test-runner`와 함께 확인 |
| 신규 UI/UX 또는 컴포넌트 설계 | `designer` | — | 구현 전에 와이어프레임, 컴포넌트 스펙, 디자인 토큰을 산출 |
| 미확인 기술 스택 / 환경 설정 | `stack-setup` | — | 조사 및 보안 검토 워크플로우를 실행하며, 설정 명령을 실행하기 전 사용자의 명시적 승인이 필요 |
| 테스트 작성 / QA 게이트 / 인수 기준 확인 | `test-runner` | `test-driven-development` | 테스트 스위트와 audit 스크립트를 실행하고, 각 인수 기준별 통과/실패를 보고 |
| 보안 검토, 시크릿 스캔, 의존성 권고 | `security-monitor` | — | Phase 0(기준선 스캔)과 Phase 5(PR 전 권고 점검)에서 실행 |
| 아키텍처 결정 / 트레이드오프 평가 | `architect` | — | 코드 작성 전에 구현 계획과 ADR을 산출 |
| 커밋, 푸시, PR 오픈 | PM | `sync` | 항상 `/sync "type(scope): message"`를 통해 — 절대 직접 `git commit`/`git push` 금지 |
| 세션 중간에 changelog 항목 추가 | PM | `changelog` | 최종 `/sync` 이전에 `/changelog "..."` |
| 전체 sync 없이 세션 메모 기록 | PM | `memlog` | `/memlog "summary"` |
| 전체 멀티 에이전트 프로젝트 리뷰 | PM | `project-review` | 구성원을 자동 감지하여 모든 전문 에이전트를 병렬 디스패치하고 Critical/High/Medium/Low 우선순위 계획을 산출 |

---

## 3. 개발 파이프라인 단계별 안내

co-develop은 고정된 **파이프라인 순서**를 따릅니다: `architect → designer → stack-setup → code-writer → test-runner → security-monitor` (`variant.json` 기준). `designer`와 `stack-setup`은 선택 사항이며, 각각 UI/UX 요소가 범위에 없거나 프로젝트에 이미 구성된 스택이 있는 경우 건너뜁니다.

### 단계별 설명

1. **Architect (Phase 1-2)** — 구현 계획과 ADR을 산출합니다. 이 계획이 사용자에게 승인되기 전에는 아무것도 구현되지 않습니다.
2. **Designer (Phase 3, 선택)** — 작업이 UI/UX와 관련이 있으면 와이어프레임/컴포넌트 스펙/디자인 토큰을 산출합니다. 순수 백엔드/로직 변경에서는 건너뜁니다.
3. **Stack-setup (Phase 0-1, 선택)** — 프로젝트의 기술 스택이 인식되지 않을 때만 트리거됩니다. 스택을 식별하고, *공식* 설정 문서를 조사하며, 모든 명령에 대해 필수 보안 검토를 실행(`curl | sh` 형태의 pipe-to-shell 패턴을 HIGH 위험으로 표시)하고, 사용자가 명시적 승인 키워드(`APPROVE`, 또는 표시된 단계에 대해서는 `CONFIRM HIGH RISK`)를 입력하기 전까지는 아무것도 실행하지 않습니다.
4. **Code-writer (Phase 4)** — 승인된 계획에 엄격히 따라 구현합니다. 설계를 하지 않고 범위를 결정하지 않습니다 — 외과적(surgical) 변경만 수행합니다.
5. **Test-runner (Phase 4)** — `bun scripts/audit.ts`(문서/라이프사이클 게이트)와 프로젝트의 테스트 명령을 실행한 후, 각 인수 기준을 개별적으로 체크합니다. `READY FOR PR` 또는 `BLOCKED` 판정을 보고합니다. PM에게 에스컬레이션하기 전까지 최대 2회의 QA 반복이 허용됩니다.
6. **Security-monitor (Phase 0, Phase 5)** — 초기에 기준선 스캔을, 후반에 PR 전 권고 점검을 실행하며, 특히 인증, 시크릿, 인프라와 관련된 사항에 집중합니다.
7. **PM 마무리** — 결정 사항을 `memory/YYYY-MM-DD.md`에 기록하고, Phase 5 라이프사이클 트리거(에이전트/스킬/스크립트가 변경되었는가? variant 상태가 변경되었는가?)를 확인한 후 `/sync "type(scope): message"`를 실행합니다.

### 주요 명령어

```
bun scripts/audit.ts              # QA / 문서화 게이트 (반드시 exit 0)
/changelog "..."                  # CHANGELOG.md [Unreleased] 항목 추가
/memlog "summary"                 # 세션 로그 항목만 추가
/new-task "name"                  # 세션 내 태스크 추적 블록 생성
/sync "feat: description"         # 전체 파이프라인: memlog -> sync-md -> changelog -> audit -> commit -> PR
```

`/sync`는 내부적으로 다음을 순서대로 수행합니다: audit.ts(실패 시 중단) → 메모리 로그 항목(4개 섹션 형식) → MEMORY.md 인덱스 업데이트 → `git add -A` + 커밋 → 브랜치 생성(`main`인 경우 `pr/<date>-<slug>`) → 푸시 → `gh pr create`. 이 파이프라인 외부에서의 직접적인 `git commit`/`git push` 호출 및 `--no-verify`는 pre-commit 훅에 의해 차단됩니다.

---

## 4. 참여(Engagement) / 프로젝트 단계 구조

co-develop은 선형적이고 게이트가 있는 단계 모델을 사용합니다 (`AGENTS.md` §3.5 및 `docs/co-develop.context.md` 참고):

| 단계 | 이름 | 진행 내용 | 게이트 기준 |
|-------|------|---------------|---------------|
| 0 | 팀 구성 / 착수 | PM이 요구사항을 평가하고 필요시 에이전트/스킬을 생성; 프로젝트 스캐폴딩 및 개발 환경 검증 | 프로젝트 스캐폴딩 완료, 개발 환경 검증 완료, CI 파이프라인 구성 완료 |
| 1 | 분류(Triage) | PM이 요청을 분류하고 리서치/분석을 위해 읽기 전용 에이전트를 병렬로 디스패치 | — |
| 2 | 분석 / 계획 | PM이 조사 결과를 요구사항과 인수 기준으로 종합; 아키텍처 및 기술 스택 확정 | 아키텍처 리뷰 승인, 기술 스택 확정, 스프린트 계획 정의 |
| 3 | 설계 | Architect가 구현 계획과 ADR을 산출; 범위에 있으면 Designer가 UI/UX 스펙 산출 | — |
| 4 | 구현 / 실행 | Code Writer가 구현; Test Runner가 검증; 실패 시 최대 3회 반복 | 코드 리뷰 통과, 테스트 그린, 심각한 린트 오류 없음 |
| 5 | 마무리 | PM이 결정 사항을 기록하고 `/sync`를 실행하여 PR을 오픈; 배포 검증; 문서 업데이트 | 배포 검증 완료, 문서 업데이트 완료, 회고 완료 |

**티어 상한 규칙**: 에이전트의 티어는 간단한 작업에 대해 낮출 수 있지만, 정의된 기준선보다 절대 높일 수 없습니다 (architect: High, designer/security-monitor/test-runner: Medium, code-writer/stack-setup: Low).

---

## 5. 산출물 위치

| 산출물 | 위치 |
|----------|----------|
| 아키텍처 결정 기록(ADR) | `docs/adr/` |
| 기술 스펙 | `docs/specs/` |
| API 문서 | `docs/api/` |
| 세션 로그, 회의록 | `memory/YYYY-MM-DD.md` |
| 메모리 인덱스 | `memory/MEMORY.md` |
| Changelog 항목 | `CHANGELOG.md` (`[Unreleased]` 섹션, 릴리스 시 이동) |
| 에이전트 간 핸드오프 페이로드 | `docs/handoff-spec.md`에 따른 세션 내 JSON (기본적으로 디스크에 영구 저장되지 않음) |
| Pull Request | `pr/<date>-<slug>` 브랜치, `/sync` 마지막 단계에서 `gh pr create`로 오픈 |
| 프로젝트/기술 스택 설정 | `docs/co-develop.context.md` (불변인 `docs/context.md` 위의 가변 커스터마이징 레이어) |

이 variant에는 전용 `deliverables/` 디렉터리가 없습니다 — 구현 코드는 승인된 아키텍처 계획에 따라 프로젝트의 일반 소스 트리에 바로 위치하며, 프로세스 산출물(ADR, 스펙, 로그)은 위에 나열된 대로 `docs/`와 `memory/`에 위치합니다.
