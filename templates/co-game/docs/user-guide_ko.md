# co-game 사용자 가이드

**Language**: [English](user-guide.md) · **한국어**

co-game 에이전트 팀으로 HTML5 캔버스 게임(Vanilla TypeScript)을 만들기 위한 실용적인 작업 중심 가이드입니다. 팀 개요는 [README_ko.md](../README_ko.md)를, 전체 에이전트/스킬 레지스트리와 거버넌스 규칙은 [AGENTS.md](../AGENTS.md)를 참고하세요.

---

## 1. 빠른 시작

co-game은 워크스페이스 전체의 **PM 게이트웨이** 패턴을 따릅니다. 전문 에이전트를 직접 호출하지 않고, PM에게 요청하면 PM이 계획을 세우고 디스패치합니다.

1. **채팅으로 작업을 설명합니다.** 예: "콤보 스코어링 시스템이 있는 매치-3 퍼즐 게임을 만들고 싶어요."
2. **PM이 요청을 분류**하고(산출물 유형 + 단계, AGENTS.md §3.5 참고) 아무것도 손대기 전에 **실행 계획 표**를 먼저 제시합니다.

   | # | 작업 | 에이전트 | 티어 | 모델 |
   |---|------|---------|------|------|
   | 1 | 핵심 루프, 난이도 곡선, 보상 시스템 | `game-designer` | Medium | sonnet |
   | 2 | 매칭/연결 로직, 난이도 생성 | `puzzle-designer` | Medium | sonnet |
   | 3 | 보드/타일 비주얼 | `visual-artist` | Medium | sonnet |
   | 4 | SFX/BGM 디자인 | `sound-designer` | Medium | sonnet |
   | 5 | 캔버스 엔진 + 게임플레이 구현 | `game-developer` | Medium | sonnet |
   | 6 | 버그 분석 / 수정 검증 | `game-debugger` | Medium | sonnet |
   | 7 | 테스트 작성 + QA 게이트 | `test-runner` | Medium | sonnet |
   | 8 | `/sync "feat(...): ..."` — 라이프사이클 + 감사 + 커밋 + 푸시 + PR | pm | Medium | sonnet |

3. **사용자가 계획을 승인**해야(또는 수정을 요청해야) 전문 에이전트가 디스패치됩니다.
4. **전문 에이전트가 표시된 순서대로 실행**합니다 — 디자인 단계(1-2)는 항상 구현(Phase 4)보다 먼저 진행됩니다.
5. **`/sync`로 마무리**: 이 명령 하나로 메모리 로그, `CHANGELOG.md` 항목, `bun scripts/audit.ts` QA 게이트, 커밋, 푸시, PR 생성이 모두 실행됩니다. `git commit`/`git push`를 직접 실행하지 마세요 — pre-commit 훅이 `/sync`를 통하지 않은 커밋을 차단합니다.

**참고**: PM은 `memory/*.md`와 `CHANGELOG.md`만 직접 작성합니다. 모든 게임 디자인 문서, 코드, 아트 명세, 테스트는 디스패치된 전문 에이전트가 작성하며, PM이 직접 작성하지 않습니다.

---

## 2. "어떤 게임 개발 작업이신가요?"

아래 표를 참고해 PM이 어떤 에이전트를 디스패치할지 짐작할 수 있습니다 — 에이전트 이름을 직접 언급할 필요 없이 작업만 설명하면 됩니다.

| 작업 / 시나리오 | 에이전트 | 스킬 | 단계 |
|---|---|---|---|
| "핵심 게임 루프 / 난이도 곡선 / 보상 시스템 설계" | `game-designer` | — | 1-2 |
| "미로/슈팅/벽돌깨기/스네이크형 아케이드 게임 설계" (엔티티 AI, 웨이브, 점수) | `arcade-designer` | — | 1-2 |
| "매치-3 / 로직 퍼즐 / 보드 / 카드 게임 설계" (매칭 로직, 턴, 난이도 생성) | `puzzle-designer` | — | 1-2 |
| "기술 아키텍처 계획 / ADR 작성" | `architect` | — | 1-2 |
| "UI/UX, 와이어프레임, HUD, 메뉴 설계" | `designer` | — | 3 |
| "스프라이트 시트, 애니메이션 프레임, 보드/타일 비주얼, 배경 명세" | `visual-artist` | — | 3 |
| "SFX, BGM 루프, Web Audio 효과 체인 설계" | `sound-designer` | — | 3 |
| "캔버스 엔진, 게임 루프, 충돌, 엔티티 시스템 구현" | `game-developer` | `test-driven-development` | 4 |
| "게임플레이/충돌/AI 버그가 있음" | `game-debugger` | — | 4 |
| "PR 전 테스트 실행 / 수락 기준 검증" | `test-runner` | `test-driven-development` | 4 |
| "이 PR 리뷰 / 코드 품질 확인" | (코드를 작성한 전문 에이전트) | `code-review` | 4 |
| "동작 변경 없이 중복 제거 / 구조 개선" | (파일 담당 전문 에이전트) | `refactoring` | 4 |
| "병합 전 취약점 / 시크릿 스캔" | `security-monitor` | `security-scan` | 0, 5 |
| "개발 환경 설정 / 인식되지 않는 기술 스택" | `stack-setup` | — | 0-1 |
| "다중 에이전트 설계 토론 진행" | (PM이 진행) | `meeting-facilitation` (`/meeting`) | 모든 단계 |
| "에이전트나 스킬 추가/수정" | PM + 대상 전문 에이전트 | `agent-lifecycle-manager` / `skill-lifecycle-manager` | 0 |
| "모든 에이전트를 활용한 전체 프로젝트 리뷰" | 전 전문 에이전트 (병렬, 읽기 전용) | `project-review` | 모든 단계 |

**장르 라우팅 규칙**: 반응/타이밍 기반(미로, 슈팅, 벽돌깨기, 스네이크)이면 → `arcade-designer`. 턴제 또는 그리드 기반(매치-3, 로직 퍼즐, 보드/카드)이면 → `puzzle-designer`. 하이브리드 장르(타워 디펜스, 로그라이크, 방치형)는 두 에이전트에 `game-designer`의 범용 레이어까지 함께 사용합니다.

---

## 3. 게임 개발 파이프라인 안내

co-game은 새로운 메카닉이나 게임에 대해 고정된 **에이전트 디스패치 순서**를 가집니다 (`docs/co-game.context.md § Development Workflow` 참고).

```
PM → game-designer         (범용: 핵심 루프 + 난이도 + 보상)
   → arcade-designer 또는 puzzle-designer  (장르별, 키워드 기반)
   → visual-artist         (스프라이트/애니메이션 + 보드/타일 + 배경)
   → sound-designer        (SFX + BGM + 오디오 시스템)
   → game-developer        (엔진 + 엔티티 + 시스템 + 렌더링)
   → game-debugger         (버그 분석 + 수정 제안)
   → test-runner           (QA 게이트)
   → security-monitor      (검토)
```

이는 모든 구현 작업의 Phase 4 실행 루프로 매핑됩니다.

1. **game-developer**가 승인된 디자인 명세에 따라 구현합니다.
2. **game-debugger**가 명세 대비 동작을 검증하고 실패 원인을 분석합니다.
3. **test-runner**가 수락 기준을 검증합니다 (Vitest 3 테스트 스위트).
4. **감사 스크립트** (`bun scripts/audit.ts`)가 워크스페이스/라이프사이클 준수를 검증합니다.

반복하고 수정하되 — 사용자에게 에스컬레이션하기 전 **최대 3회 반복**까지 허용됩니다.

### 주요 명령어

| 명령어 | 동작 |
|---|---|
| `bun --version` | Bun 런타임 사용 가능 여부 확인 (모든 스크립트에 필요) |
| `npm install` | 의존성 설치 (워크스페이스 루트 **및** `projects/<game>/`에서 실행) |
| `bun scripts/audit.ts` | QA 게이트 수동 실행 (CLI에서는 PostToolUse 훅으로 자동 실행됨) |
| `/sync "feat(scope): message"` | 전체 파이프라인: memlog → sync-md → changelog → audit → commit → push → PR |
| `/changelog "..."` | 단독으로 `CHANGELOG.md [Unreleased]` 항목 추가 |
| `/memlog "summary"` | 전체 sync 없이 `memory/YYYY-MM-DD.md`에 세션 항목 추가 |
| `/new-task "name"` | 오늘 메모리 로그에 세션 내 작업 추적 블록 생성 |

### 파이프라인에 영향을 주는 기술 스택 유의사항

- **고정 타임스텝**: 게임 루프는 `FIXED_DT = 1000/60 ms`와 누산기(100ms 상한)를 사용합니다 — 게임플레이 로직에는 가변 타임스텝을 절대 사용하지 않습니다.
- **60fps 예산**: 프레임당 로직은 약 16ms 이내여야 하며, 새 시스템을 병합하기 전 프로파일링해야 합니다.
- **외부 게임 의존성 없음**: 렌더링은 순수 Canvas API — 스프라이트 이미지, 프레임워크, 에셋 파일이 없습니다.
- **모든 게임플레이 변경에는 테스트가 필요합니다** — `game-developer`와 `test-runner` 모두 이를 게이트로 삼습니다.

---

## 4. 참여(Engagement) / 프로젝트 단계 구조

co-game은 워크스페이스의 6단계 모델을 재사용하며 ([AGENTS.md §4.2](../AGENTS.md#§42-harness-engineering-workflow) 참고), `docs/co-game.context.md`에서 게임 개발에 특화되어 있습니다.

| 단계 | 이름 | 진행 내용 |
|---|---|---|
| **0** | 팀 구성 | PM이 요구사항을 평가; 격차가 있으면 전문 에이전트/스킬을 생성 |
| **1** | 분류 | PM이 요청 + 장르를 분류; 읽기 전용 에이전트를 병렬로 디스패치 |
| **2** | 분석 / 설계 검증 | PM이 결과를 종합해 요구사항 + 수락 기준으로 정리; **사용자 승인 게이트** |
| **3** | 설계 핸드오프 | `game-designer`가 범용 명세를, 장르 디자이너가 장르별 명세를 작성; `visual-artist` + `sound-designer`가 에셋 명세 작성 |
| **4** | 구현 | `game-developer` → `test-runner` → `game-debugger` 실행 루프 (실패 시 최대 3회 반복) |
| **5** | 마무리 | PM이 `memory/YYYY-MM-DD.md`에 결정 사항을 기록; `/sync` 실행; PR 오픈 |

**베타 변형 상태**: co-game은 현재 **베타** 변형(v0.1.0)이며, 정식(stable) 승격 전에 3건의 고객 참여와 3개월의 베타 기간이 필요합니다. 정확한 승격 기준은 `scripts/helpers/variant-governance-rules.ts`를 참고하세요.

---

## 5. 산출물 / 결과물 위치

| 항목 | 위치 |
|---|---|
| 게임 소스 코드 | `projects/<game-name>/src/` |
| 게임 테스트 (Vitest) | `projects/<game-name>/tests/` |
| 게임 디자인 명세 (메카닉, AI, 레벨, 에셋) | `projects/<game-name>/docs/` |
| 아키텍처 결정 기록 (ADR) | `docs/adr/` |
| 기술 명세 | `docs/specs/` |
| 최종 보고서 / 산출물 | `docs/` |
| 세션 로그, 미팅 기록 | `memory/YYYY-MM-DD.md`, `memory/meeting-YYYY-MM-DD-<slug>.md` |
| 체인지로그 항목 | `CHANGELOG.md`의 `[Unreleased]` 아래 |
| 에이전트 핸드오프 페이로드 (JSON, 처리 중에만 존재) | 스키마는 `docs/handoff-spec.md` 참고 — 기본적으로 디스크에 저장되지 않음 |

빌드 도구: 번들링에는 **Vite 6**, 테스트에는 **Vitest 3**, 패키지 매니저는 **npm**을 사용하며 런타임 의존성은 0개입니다 (절차적 Canvas + Web Audio만 사용, 스프라이트/에셋 파일 없음).

---

*사용자 가이드 버전: 1.0 — 2026-07-19*
