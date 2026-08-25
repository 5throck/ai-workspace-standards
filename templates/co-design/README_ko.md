---
sync_version: 1
translated_from_hash: 9a4a25829fe39c45c4a87b70c7a842322d70aba1747b3daa33cec7b5b6b5eef2
lang: ko
lang_reason: source-material
---

# co-design

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> UI/UX 디자인, 디자인 시스템, 프로토타이핑 및 디자인 핸드오프를 위한 디자인/UX 워크플로 변형입니다. 시각 디자인, 서비스 디자인, UX 리서치, 프로토타이핑을 다루는 전문 디자인 에이전트를 포함합니다.

## 개요

**co-design** 워크스페이스에 오신 것을 환영합니다. 여러분의 전담 AI UI/UX 디자인 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다. 전체 아키텍처와 표준은 `docs/co-design.context.md`를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 안정적인 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 종합적인 멀티 에이전트 UI/UX 디자인 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 리서치, 프로토타이핑, 시각 디자인 단계를 처리하는 것을 목표로 합니다.

## AI 팀 소개

여러분의 파트너는 각자 고유한 역할을 가진 전문 에이전트들로 구성됩니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 조율, 디스패치, 품질 게이트 | high | inherit |
| **design-lead** | 디자인 시스템 아키텍트 — 시각 언어, 토큰, 컴포넌트 아키텍처 | high | inherit |
| **prototype-engineer** | 인터랙티브 프로토타이핑 전문가 — 테스트용 기능적 프로토타입 구축 | medium | inherit |
| **service-designer** | 서비스 디자이너 — 엔드투엔드 서비스 경험, 여정, 블루프린트 | medium | inherit |
| **storyteller** | 브랜드 내러티브 리드 — 디자인 원칙, 브랜드 보이스, 패턴 일관성 감사 | medium | inherit |
| **typography-expert** | 타이포그래피 전문가 — 서체 선택, 타입 시스템, 시각적 계층 구조 | medium | inherit |
| **ux-researcher** | 사용자 리서치 전문가 — 인터뷰, 사용성 테스트, 인사이트 종합 | medium | inherit |
| **visual-designer** | 시각 디자인 실행 — UI 디자인, 목업, 명세 | medium | inherit |

## 스킬

- **accessibility-audit**: UI 컴포넌트, 템플릿, 웹 애플리케이션을 위한 자동화된 WCAG 2.1 Level AA 접근성 평가 규칙, DOM 감사 패턴, axe-core 기반 수정 가이드를 정의합니다.
- **service-design**: 고객 여정, 서비스 블루프린트, 운영 프로세스를 포함한 엔드투엔드 서비스 경험을 디자인합니다. 사용 시점: 고객 경험 매핑, 터치포인트 최적화, 프론트스테이지/백스테이지 운영 정렬, 서비스 전달 개선.
- **ui-ux-design-intelligence**: 디자인 시스템 생성, 컴포넌트 디자인, 시각적 계층 구조, 사용자 중심 디자인 원칙을 포함한 종합적인 UI/UX 디자인 역량을 제공합니다. 사용 시점: 디자인 시스템 구축, 시각 디자인 생성, UI 컴포넌트 디자인, 디자인 명세 수립.

각 에이전트와 스킬을 언제 사용해야 하는지, 워크플로 단계, 산출물 저장 위치에 대한 실용적인 작업 중심 안내는 [docs/user-guide_ko.md](docs/user-guide_ko.md)를 참고하세요.

### 디자인 토큰 & 플레이그라운드

- **`tokens.json`** — 디자인 토큰 SSOT(color, typography, spacing, borderRadius, shadow). `scripts/compile-tokens.ts`가 CSS 커스텀 프로퍼티와 타입 지정 TS 상수로 컴파일합니다. 테마 프리셋(`dark`, `high-contrast`)은 예약된 `themes` 키 아래에 두면 `[data-theme="<name>"]` CSS 블록으로 컴파일됩니다 — 사용자는 `data-theme` 속성으로 테마를 전환하며, 레이아웃 토큰은 테마 불변입니다([DESIGN-R2]).
- **`playground/`** — 컴파일된 토큰에 연결된 최소 구성의 Vite 개발 서버로, 디자인 단계에서 라이브 미리보기를 제공합니다. 퀵스타트와 토큰 연결 구조는 [playground/README.md](playground/README.md)(영문)를 참고하세요. 스캐폴딩된 co-design 프로젝트 내부에서 실행됩니다.

## 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **디스커버리 및 리서치:** PM이 **ux-researcher**를 호출하여 인사이트를 도출합니다.
2. **디자인 전략:** **design-lead**가 크리에이티브 방향성과 디자인 시스템을 정의합니다.
3. **제작:** **visual-designer**와 **service-designer**가 컴포넌트와 사용자 여정을 구축합니다.
4. **프로토타이핑:** **prototype-engineer**가 인터랙티브 결과물과 핸드오프 자료를 생성합니다.
5. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목을 추가합니다.
- `/memlog "summary"` — 오늘 세션 로그에 요약을 추가합니다.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론을 실행합니다.

## 변형 유형

**유형**: design

이 변형은 UI/UX 디자인, 디자인 시스템, 프로토타이핑, 디자인 핸드오프에 중점을 두며 시각 디자인, 서비스 디자인, UX 리서치, 프로토타이핑을 위한 전문 에이전트를 포함합니다.

---

*최근 업데이트: 2026-08-09*
