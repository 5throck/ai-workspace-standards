---
sync_version: 1
translated_from_hash: PLACEHOLDER
---

# co-game

**Language**: [English](README.md) · **한국어**

> **⚠️ 베타 variant** - 상태: beta (v0.1.0)
> 이 variant는 활발히 개발 중이며 프로덕션 환경에서 사용해서는 안 됩니다.

---

Vanilla TypeScript 기반 HTML5 Canvas 게임 개발을 위한 variant입니다. 게임 디자인, 아케이드/퍼즐 장르, 시각 아트, 사운드, 엔진 구현, 디버깅, 테스트를 위한 전문 에이전트를 포함합니다.

## Quick Start

이 variant는 워크스페이스 템플릿의 베타 버전입니다. `templates/common`을 상속하며 variant 전용 커스터마이징을 포함합니다.

### Claude Code 사용자:

자세한 안내는 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 안내는 `GEMINI.md`를 참고하세요.

## Beta Status

이 variant는 현재 **베타** 상태이며 다음이 필요합니다:

- **클라이언트 인게이지먼트**: 0/3 (variant 거버넌스 규칙 참고)
- **베타 기간**: 0/3개월
- **추가 검증**: 대기 중

승격 기준은 `scripts/helpers/variant-governance-rules.ts`를 참고하세요.

## Variant Type

**유형**: game

이 variant는 Vanilla TypeScript 기반 HTML5 Canvas 게임 개발에 특화되어 있습니다.

## Agent Roster

| 에이전트 | 역할 | 티어 | 모델 |
|-------|------|------|-------|
| **architect** | 설계 에이전트 — 구현 계획 및 기술 명세 작성 | Medium | claude-sonnet-4-6 |
| **game-designer** | 범용 게임 디자인 에이전트 — 핵심 게임 루프, 난이도 곡선, 보상 시스템, 튜토리얼/온보딩 | Medium | claude-sonnet-4-6 |
| **arcade-designer** | 아케이드 게임 디자인 전문가 — 엔티티 AI 패턴, 웨이브/스테이지 시스템, 아이템/파워업 메커닉, 점수 시스템 | Medium | claude-sonnet-4-6 |
| **puzzle-designer** | 퍼즐/보드 게임 디자인 전문가 — 매칭/연결 로직, 턴제 시스템, 난이도 생성 | Medium | claude-sonnet-4-6 |
| **designer** | UI/UX 디자인 에이전트 — 와이어프레임, 컴포넌트 명세, 디자인 토큰 | Medium | claude-sonnet-4-6 |
| **game-developer** | 게임 구현 에이전트 — 캔버스 렌더링 엔진, 게임 루프, 충돌 감지, 엔티티 시스템 | Medium | claude-sonnet-4-6 |
| **visual-artist** | 시각 에셋 명세 에이전트 — 스프라이트 시트 레이아웃, 애니메이션 프레임, 보드/타일 비주얼, 배경 | Medium | claude-sonnet-4-6 |
| **sound-designer** | 절차적 오디오 디자인 전문가 — SFX 명세, BGM 루프 구조, Web Audio API 이펙트 체인 | Medium | claude-sonnet-4-6 |
| **game-debugger** | 게임 디버거 에이전트 — 버그 근본 원인 분석, 수정안 제안, 재현 테스트 작성 | Medium | claude-sonnet-4-6 |
| **test-runner** | QA 및 검증 에이전트 — 테스트 실행, 수락 기준 검증, QA 게이트 | Medium | claude-sonnet-4-6 |
| **security-monitor** | 보안 모니터 — 취약점, 보안 권고, 시크릿 유출 스캔 | Medium | claude-sonnet-4-6 |
| **stack-setup** | 스택 설정 전문가 — 환경 설정, 빌드 구성, 인식되지 않은 스택 복구 | Medium | claude-sonnet-4-6 |

> **PM 게이트웨이**: `agents/pm.md` (High 티어)가 모든 전문 에이전트 디스패치를 오케스트레이션합니다 — 전체 PM 게이트웨이 워크플로와 디스패치 트리거는 [AGENTS.md](AGENTS.md)를 참고하세요.
> **장르 라우팅**: `arcade-designer`는 반응/타이밍 기반 아케이드 게임(미로, 슈팅, 벽돌깨기, 스네이크)을 담당하고, `puzzle-designer`는 턴제/그리드 기반 게임(매치-3, 로직 퍼즐, 보드/카드 게임)을 담당합니다. `designer`와 `stack-setup`은 필요 시에만 사용하는 선택적 에이전트입니다.

## Skills

| 스킬 | 위치 | 목적 |
|-------|----------|---------|
| `code-review` | `skills/code-review/` | 체계적인 PR/코드 품질, 보안, 표준 준수 검토 |
| `refactoring` | `skills/refactoring/` | 테스트로 뒷받침되는 안전한 구조적 코드 개선 |
| `test-driven-development` | `skills/test-driven-development/` | 레드-그린-리팩터 TDD 워크플로 |

에이전트 라이프사이클, 보안 스캔, 미팅 진행, 스크립트/스킬 라이프사이클 관리 등 추가 플랫폼 스킬은 `.claude/skills/` 아래에서 확인할 수 있습니다 — 전체 우선순위와 레지스트리는 [AGENTS.md §6](AGENTS.md#§6-skills)을 참고하세요.

---

**생성일**: 2026-07-08T00:02:24.182Z
**MVP Wave 3** - L2-to-Variant Pipeline
**업데이트**: 2026-07-19 — 에이전트 로스터와 스킬을 variant.json/AGENTS.md 최신 상태에 맞게 수정
