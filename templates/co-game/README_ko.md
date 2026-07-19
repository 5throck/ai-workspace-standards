---
sync_version: 1
translated_from_hash: PLACEHOLDER
---

# co-game

> **Status**: 🔶 Beta — v0.1.0

## 1. 팀 미션

**미션:** Game development variant for HTML5 Canvas games using Vanilla TypeScript. Specialized agents for game design, arcade/puzzle genres, visual art, sound, engine implementation, debugging, and testing.

## 2. AI 팀 소개

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| **architect** | `agents/architect.md` | 설계 에이전트 — 구현 계획 및 기술 명세 작성 |
| **game-designer** | `agents/game-designer.md` | 범용 게임 디자인 에이전트 — 핵심 게임 루프, 난이도 곡선, 보상 시스템, 튜토리얼/온보딩 |
| **arcade-designer** | `agents/arcade-designer.md` | 아케이드 게임 디자인 전문가 — 엔티티 AI 패턴, 웨이브/스테이지 시스템, 아이템/파워업, 점수 시스템 |
| **puzzle-designer** | `agents/puzzle-designer.md` | 퍼즐/보드 게임 디자인 전문가 — 매칭/연결 로직, 턴제 시스템, 난이도 생성 알고리즘 |
| **designer** | `agents/designer.md` | UI/UX 디자인 에이전트 — 와이어프레임, 컴포넌트 명세, 디자인 토큰 |
| **game-developer** | `agents/game-developer.md` | 게임 구현 에이전트 — 캔버스 렌더링 엔진, 게임 루프, 충돌 감지, 엔티티 시스템 |
| **visual-artist** | `agents/visual-artist.md` | 시각 에셋 명세 에이전트 — 스프라이트 시트, 애니메이션 프레임, 보드/타일 비주얼, 배경 |
| **sound-designer** | `agents/sound-designer.md` | 절차적 오디오 디자인 전문가 — SFX 명세, BGM 루프 구조, Web Audio API 효과 체인 |
| **game-debugger** | `agents/game-debugger.md` | 게임 디버거 에이전트 — 버그 근본 원인 분석, 수정안 제안, 재현 테스트 작성 |
| **test-runner** | `agents/test-runner.md` | QA 및 검증 에이전트 — 테스트 실행, 수락 기준 검증, QA 게이트 |
| **security-monitor** | `agents/security-monitor.md` | 보안 모니터 — 취약점, 권고, 시크릿 유출 스캔 |
| **stack-setup** | `agents/stack-setup.md` | 스택 설정 전문가 — 환경 설정, 빌드 구성, 인식되지 않은 스택 복구 |

> **PM 게이트웨이**: `agents/pm.md`(High 티어)가 모든 전문 에이전트 디스패치를 오케스트레이션합니다 — 전체 PM 게이트웨이 워크플로우와 디스패치 트리거는 [AGENTS.md](AGENTS.md)를 참고하세요.
> **장르 라우팅**: `arcade-designer`는 반응/타이밍 기반 아케이드 게임(미로, 슈팅, 벽돌깨기, 스네이크)을 담당하고, `puzzle-designer`는 턴제/그리드 기반 게임(매치-3, 로직 퍼즐, 보드/카드 게임)을 담당합니다. `designer`와 `stack-setup`은 선택적(불필요 시 건너뜀) 에이전트입니다.

## 3. 스킬

| 스킬 | 위치 | 목적 |
|------|------|------|
| `code-review` | `skills/code-review/` | 체계적인 PR/코드 품질, 보안, 표준 준수 검토 |
| `refactoring` | `skills/refactoring/` | 테스트 안전망을 갖춘 안전한 구조적 코드 개선 |
| `test-driven-development` | `skills/test-driven-development/` | 레드-그린-리팩터 TDD 워크플로우 |

에이전트 라이프사이클, 보안 스캔, 미팅 진행, 스크립트/스킬 라이프사이클 관리 등 추가 플랫폼 스킬은 `.claude/skills/`에서 확인할 수 있습니다 — 전체 우선순위 및 레지스트리는 [AGENTS.md §6](AGENTS.md#§6-skills)을 참고하세요.

## 4. 의존성 설치

```bash
bun --version   # audit.ts, dev-sync.ts 실행에 필요
```

*Last Updated: 2026-07-19 — 에이전트 로스터 및 스킬을 variant.json/AGENTS.md 최신 상태에 맞게 수정*
