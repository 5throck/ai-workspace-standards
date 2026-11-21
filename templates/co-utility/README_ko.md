---
sync_version: 1
lang: ko
lang_reason: source-material
---

# co-utility

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.2.0
> Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).
> **소비 방식: adoption-only** — 이 템플릿은 기존 외부 프로젝트(예: QuickDL)를 fleet variant로 전환하는 `project-to-variant` / `adopt-project` 전용 대상입니다. `new-project` 스캐폴드 후보가 아니며, variant.json의 `consumption` 선언으로 스캐폴드 열거에서 제외됩니다.

## 개요

Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

> Adoption 경로 전용: 기존 외부 프로젝트를 이 변형으로 편입하려면 `adopt-project` / `project-to-variant`를 사용하세요 — `new-project`는 이 변형을 거부합니다(위의 소비 방식 참조).

> **설계 게이트 (ADR-0074)**: 코드 변경에는 스펙이 동반되어야 합니다 — `docs/designs/<spec-id>-design.md`를 만들고 등록한(`bun scripts/spec-register.ts --file <설계문서> --source manual`) 뒤 `/sync`하세요. 동기화 시 스펙 검사가 문서 없는 코드 변경을 차단합니다; 사소한 변경은 `--spec-exempt=E1..E5`를 쓸 수 있습니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** Standalone utility/tool application workflow — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits. Doctrine derived from the QuickDL engagement (2026-11).

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **pm** | 프로젝트 매니저 — 팀을 오케스트레이션하고 품질 게이트를 운영하며 PR을 생성 | high | inherit |
| **backend** | 백엔드 개발자 — 코어 서비스, Flask 라우트, CLI/설치기를 구현 | high | inherit |
| **frontend** | 프런트엔드 개발자 — JS 로직, API 연동, 템플릿 i18n을 구현 | medium | inherit |
| **security** | 시큐리티 오퍼서 — 외부 입력 표면 읽기 전용 감사 + 의존성/시크릿 상시 모니터링 | high | inherit |
| **qa** | QA 엔지니어 — 테스트를 작성·유지하고 크로스플랫폼 동작을 검증 | medium | inherit |
| **i18n-specialist** | 로케일 설정, 로케일별 포맷팅, 텍스트 레이아웃 가이던스 담당 | medium | inherit |
| **i18n-specialist** | Owns locale configuration, locale-specific formatting, and text layout guidance | medium | inherit |

## 스킬

- **post-write-check**: 

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
6. **마무리:** PM이 결정을 기록하고 `/sync`를 `automation-engineer`에게 맡기면 커밋과 PR 생성까지 수행하며, PM은 반영 결과를 확인합니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `meeting-facilitation` — 구조화된 인라인 다중 에이전트 토론 진행 (스킬; 기존 `/meeting` 슬래시 명령어는 폐기됨).

## 변형 유형

**유형**: utility

이 변형은 Standalone utility/tool applications — multi-interface (web UI + desktop shell + CLI) apps sharing one core service, with runtime-output isolation, locale-matrix i18n, and external-input security audits에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/2개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 갱신: 2026-11-21*
