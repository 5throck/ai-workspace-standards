---
sync_version: 1
translated_from_hash: PLACEHOLDER
lang: ko
lang_reason: source-material
---

# co-hr

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> HR/노무 Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting

## 개요

HR/노무 Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** HR/노무 Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **career-succession-consultant** | Career and succession consultant - designs career pathing, leadership pipelines, | medium | inherit |
| **change-management-partner** | Change management partner - manages change for org restructuring or new HR syste | medium | inherit |
| **compensation-benefits-analyst** | Compensation and benefits analyst - designs wage structures, incentive schemes,  | medium | inherit |
| **data-analyst** | HR data analyst - analyzes workforce statistics, turnover, hiring conversion, an | medium | inherit |
| **labor-compliance-analyst** | Labor compliance analyst - reviews compliance with Korean labor law (`근로기준법` and | medium | inherit |
| **labor-relations-specialist** | Labor relations specialist - supports responses to `노동위원회` proceedings (unfair d | medium | inherit |
| **learning-development-specialist** | Learning and development specialist - designs training systems, competency model | medium | inherit |
| **org-design-consultant** | Org design consultant - designs organizational structure, job architecture, work | medium | inherit |
| **performance-management-consultant** | Performance management consultant - designs performance evaluation systems, KPI/ | medium | inherit |
| **safety-health-officer** | Safety and health officer - reviews compliance with `산업안전보건법` and `중대재해처벌법`, and | medium | inherit |
| **talent-acquisition-specialist** | Talent acquisition specialist - designs recruiting strategy, sourcing channels,  | medium | inherit |

## 스킬

- **career-path-succession-planning**: 
- **compensation-benchmarking**: 
- **consulting-report-writing**: 
- **hr-metrics-analysis**: 
- **learning-curriculum-design**: 
- **org-design-framework**: 
- **org-readiness-assessment**: 
- **performance-system-design**: 
- **stakeholder-alignment**: 
- **talent-acquisition-strategy**: 

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

**유형**: consulting

이 변형은 Strategy consulting for AI-assisted business consulting engagements에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/2개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 업데이트: 2026-08-22*
