# Co-News 사용자 가이드

**언어**: [English](user-guide.md) · **한국어**

> 이 가이드는 co-news 프로젝트를 *사용하는* 방법 — 기사 과제를 뉴스룸 에이전트
> 팀에 맡기는 방법, 각 단계에서 무슨 일이 벌어지는지, 산출물이 어디에 남는지를
> 설명합니다. 전체 로스터와 저장소 구조는 [`../README.md`](../README.md), 거버넌스
> 규칙은 [`../AGENTS.md`](../AGENTS.md)를 참고하세요.

## 1. 빠른 시작

1. 과제는 **PM(편집국장)**에게 가져가세요 — PM이 유일한 진입점입니다. 일상 언어로
   설명하면 됩니다: *"현대차 2분기 실적 기사, 세데일 톤, 1,200자 정도로 써줘."*
2. Phase 1 브리프는 **병렬**로 실행됩니다: financial-analyst(DART 기반 수치)와
> legal-researcher(규제 맥락) — 브리프 없는 전제로 기사를 쓰는 일은 없습니다.
3. 멀티 에이전트 작업의 경우 PM은 **실행 계획 표**를 보여주고 승인을 기다린 뒤
   디스패치합니다:

   | 작업 | 에이전트 | 티어 | 모델 | 플랫폼 |
   |------|----------|------|------|--------|
   | 재무 내러티브 브리프 | financial-analyst | High | claude-opus-5-0 | Claude Code |
   | 법률 맥락 브리프 | legal-researcher | High | claude-opus-5-0 | Claude Code |
   | 기사 초고 | reporter | Medium | claude-sonnet-5-0 | Claude Code |

4. **출처 검증 게이트**는 절대 규칙입니다: 인용 원장(ledger)에 `UNVERIFIED` 주장이
   하나라도 남아 있으면 reporter는 디스패치되지 않습니다 (주장당 2개 이상의 독립
   출처).
5. 초고, 스타일 편집, 표제작 이후 **편집 심사 게이트**(Phase 6)에서
   fact-checker와 style-editor **양쪽 모두의** 서명이 필요합니다 — 실패는 담당
   에이전트에게 되돌아가고, 절대 다음 단계로 넘어가지 않습니다.
6. `/sync`로 마감합니다 — 편집 심사 게이트 통과 **이후에만** 가능하고, 팩트체크·
   스타일 미해결 항목이 있는 초고는 절대 커밋되지 않습니다.

> **경험칙**: 기사에 넣고 싶은 모든 사실적 주장은 먼저 원장에 들어가야 합니다 —
> 출처를 댈 수 없으면 싣지 않습니다.

## 2. 어떤 작업인가요?

| 시나리오 | 담당 에이전트 | 관련 스킬 |
|----------|--------------|-----------|
| 실적 / 공시 기반 기사 | financial-analyst → reporter | `financial-narrative-brief`, `k-dart`, `financial-journalism-style` |
| 규제 / 법률 주도 기사 | legal-researcher → reporter | `k-law`, `financial-journalism-style` |
| 기사 작성 / 재작성 | reporter, style-editor | `financial-journalism-style`, `ai-tell-reduction` |
| 주장 검증 / 인용 원장 | fact-checker | `source-verification-ledger` |
| 자연스러운 문체 다듬기 (AI-tell 제거) | style-editor | `ai-tell-reduction` |
| 차트 / 인포그래픽 | visual-editor | `financial-infographic-svg` |

## 3. 표준 뉴스룸 워크플로우

```
과제 접수 (PM / 편집국장)
        │
        ▼
Phase 1 — 병렬 브리프 (financial-analyst + legal-researcher)
        │
        ▼
Phase 2 — 출처 검증 게이트 (원장: UNVERIFIED 0건)
        │
        ▼
Phase 3 — reporter 초고
        │
        ▼
Phase 4 — 스타일 편집 (톤 맞춤 + AI-tell 제거, 수치 재검증)
        │
        ▼
Phase 5 — 표제작 (visual-editor: 표당 1개 SVG + manifest)
        │
        ▼
Phase 6 — 편집 심사 게이트 (fact-checker AND style-editor)
        │
        ▼
/sync (커밋 + PR) — 게시 가능한 final.md
```

핵심 커맨드 (공통 템플릿에서 상속):

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR
- `/memlog "summary"` / `/new-task "name"` — 세션 로깅 및 태스크 블록
- `/meeting "topic"` — 커버리지 결정이 충돌할 때 구조화된 뉴스룸 토론

게이트를 우회해 전문가에게 직접 요청하지 말고, 원시 `git commit` / `git push`도
실행하지 마세요 — 훅이 거부합니다.

## 4. 기사 단계 구조

| 단계 | 소유자 | 진행 내용 |
|------|--------|-----------|
| 1 — 브리프 | financial-analyst + legal-researcher (병렬) | DART 기반 수치 브리프 + 규제 맥락 브리프 |
| 2 — 출처 검증 게이트 | fact-checker | 인용 원장 구축; `UNVERIFIED` 0건 필수 |
| 3 — 초고 | reporter | 원장 엄수하에 기사 작성 |
| 4 — 스타일 편집 | style-editor | 톤 적합성 + AI-tell 제거; 모든 수치를 원장과 재대조 |
| 5 — 표제작 | visual-editor | 표당 1개 SVG + `figures/manifest.md` |
| 6 — 편집 심사 게이트 | pm (게이트키핍) | fact-checker AND style-editor 서명; 실패는 뒤로, 절대 앞으로 안 감 |

병렬 단계는 Phase 1뿐이며, 이후 파이프라인은 **엄격하게 순차**입니다 — 각 단계의
산출물이 다음 단계의 입력입니다.

## 5. 산출물 위치

| 산출물 | 위치 |
|--------|------|
| 단계별 브리프 | `deliverables/drafts/<article>/brief/` |
| 인용 원장 | `deliverables/drafts/<article>/ledger.md` |
| 초고 / 게시 가능 기사 | `deliverables/drafts/<article>/draft.md` → `final.md` |
| 표 + manifest | `deliverables/drafts/<article>/figures/` |
| 세션 로그 | `memory/YYYY-MM-DD.md` (`memory/MEMORY.md`가 인덱싱) |

유의할 도메인 규칙:

- 한 기사 = 하나의 `<article>` 디렉토리; 두 과제의 파일을 섞지 않습니다.
- 원장에서 독립 출처 2개 이상을 확보하지 못한 주장은 싣지 않으며, 재무 수치는
  특정 DART 공시(접수번호 기록)로 추적 가능해야 하고 추정치를 쓰지 않습니다.
- 필수 고지문: DART 기반 수치에는 "금융감독원 전자공시시스템(DART) 공시 자료
  기반", k-law 기반 법률 맥락에는 "국가법령정보센터 공동 데이터 기반 / 법률
  자문이 아님"을 붙입니다.
- 언어 분리: 기사 본문은 한국어(또는 과제 지정 언어)가 기본, git 산출물(커밋,
  PR 제목, 브랜치)은 항상 영어만.
- 한국식 수치 단위(조/억/만)는 한국어 기사에만 사용하며, 한 수치 안에 단위
  표기를 혼용하지 않습니다.
- 표 SVG는 `final.md` 전까지 마크다운에 인라인하지 않습니다 — 초고는 경로로
  참조하여 재작성 중 하나가 조용히 빠지는 일을 막습니다.
