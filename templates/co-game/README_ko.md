---
sync_version: 1
translated_from_hash: 57b9c9c5107cbe394519f980f89661d285488ee63e69b109ab4a34a422657837
lang: ko
lang_reason: source-material
---

# co-game

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> Vanilla TypeScript 기반 HTML5 Canvas 게임 개발을 위한 variant입니다. 게임 디자인, 아케이드/퍼즐 장르, 시각 아트, 사운드, 엔진 구현, 디버깅, 테스트를 위한 전문 에이전트를 포함합니다.

## 개요

Vanilla TypeScript 기반 HTML5 Canvas 게임 개발을 위한 variant입니다. 게임 디자인, 아케이드/퍼즐 장르, 시각 아트, 사운드, 엔진 구현, 디버깅, 테스트를 위한 전문 에이전트를 포함합니다. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** Vanilla TypeScript 기반 HTML5 Canvas 게임 개발을 위한 variant입니다. 게임 디자인, 아케이드/퍼즐 장르, 시각 아트, 사운드, 엔진 구현, 디버깅, 테스트를 위한 전문 에이전트를 포함합니다.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 오케스트레이션, 디스패치, 품질 게이트 | high | inherit |
| **architect** | 설계 에이전트 — 구현 계획 및 기술 명세 작성 | high | inherit |
| **game-designer** | 범용 게임 디자인 에이전트 — 코어 루프, 난이도 곡선, 보상 시스템 | high | inherit |
| **arcade-designer** | 아케이드 전문가 — 엔티티 AI, 웨이브/스테이지 시스템, 점수, 아이템 | high | inherit |
| **puzzle-designer** | 퍼즐/보드 전문가 — 매칭 로직, 턴 시스템, 난이도 생성 | high | inherit |
| **designer** | UI/UX 디자인 에이전트 — 와이어프레임, 컴포넌트 명세, 디자인 토큰 | medium | inherit |
| **game-developer** | 게임 구현 — 캔버스 엔진, 게임 루프, 충돌 감지, 엔티티 | low | inherit |
| **visual-artist** | 시각 에셋 명세 — 스프라이트, 애니메이션 프레임, 타일/보드 비주얼 | medium | inherit |
| **sound-designer** | 절차적 오디오 디자인 — SFX, BGM 루프, Web Audio 이펙트 체인 | medium | inherit |
| **game-debugger** | 게임 디버거 — 버그 근본 원인 분석, 수정안 제안, 재현 테스트 | medium | inherit |
| **test-runner** | QA 및 검증 — 테스트 실행, 수용 기준 검증 | medium | inherit |
| **security-monitor** | 보안 모니터 — 취약점, 권고, 시크릿 유출 스캔 | medium | inherit |
| **stack-setup** | 스택 설정 — 환경 구성, 빌드 설정, 스택 복구 | low | inherit |

## 스킬

- **code-review**: 정확성, 유지보수성, 보안, 모범 사례에 중점을 둔 철저한 코드 리뷰를 수행합니다.
- **refactoring**: 동작을 보존하면서 체계적인 리팩토링 기법으로 코드 구조와 설계를 개선합니다.
- **test-driven-development**: red-green-refactor 주기를 통한 TDD 방법론으로 소프트웨어를 구현합니다.
- **sound-synth**: Web Audio API 및 jsfxr 파라미터 명세를 사용한 절차적 8비트 레트로 사운드 이펙트 및 오디오 합성 규칙.

## 협업 방법

협업 방식은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 표준 워크플로는 다음과 같습니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **팀 구성:** PM이 필요한 전문 에이전트/스킬을 생성합니다.
2. **분류:** PM이 요청을 분류하고 읽기 전용 에이전트를 병렬로 배치합니다.
3. **분석:** PM이 조사 결과를 요구사항 + 완료 기준으로 종합합니다.
4. **설계:** 아키텍트가 구현 계획 + ADR을 작성합니다.
5. **구현:** 전문가가 구현하고, PM은 실패 시 최대 3회까지 반복합니다.
6. **마무리:** PM이 결정을 기록하고 `/sync`를 실행한 뒤 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

## 변형 유형

**유형**: game

이 변형은 Vanilla TypeScript 기반 HTML5 Canvas 게임 개발과 장르 전문 디자인 에이전트에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/3 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/3개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 업데이트: 2026-08-09*
