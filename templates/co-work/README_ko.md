---
sync_version: 1
translated_from_hash: b4544c21a73694d38bf8db048d2ace3e1acf314cfef6b174864f7e2d0030ccce
lang: ko
lang_reason: source-material
---

# co-work

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> General work and task execution workflow variant for research, documentation, and project coordination. Includes specialized collaboration agents covering analysis, content writing, technical writing, project coordination, and MS365 integration.

## 개요

**Co-Work** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI 일반 협업 및 문서화 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 stable 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 종합적인 멀티 에이전트 협업 및 문서화 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 리서치, 초안 작성, 부서 간 조율를 처리하는 것을 목표로 합니다.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **analyst** | Research analyst — investigation, data synthesis, and evidence gathering | medium | inherit |
| **content-writer** | Content writer — research-to-documentation transformation and communications | medium | inherit |
| **ms365-expert** | Microsoft 365 expert — guidance on Outlook, Word, Excel, PowerPoint, Teams | low | inherit |
| **project-coordinator** | Project coordinator — schedules, stakeholder communication, delivery logistics | low | inherit |
| **storyteller** | Organizational storyteller — culture, change narratives, institutional knowledge | medium | inherit |
| **technical-writer** | Technical writer — API documentation, technical guides, developer resources | medium | inherit |

## 스킬

- **api-documentation**: Creates comprehensive API documentation including endpoints, parameters, authentication, request/response schemas, and code examples. Use when: documenting REST APIs, GraphQL interfaces, SDKs, or developer-facing technical specifications.
- **documentation-writing**: Creates clear, accessible documentation and communications for diverse audiences. Use when: writing guides, creating documentation, drafting communications, or synthesizing complex information for technical and non-technical audiences.
- **research-analysis**: Conducts systematic research, data synthesis, and evidence-based analysis to support decision-making and documentation. Use when: analyzing topics, synthesizing research, gathering evidence, or investigating questions for documentation or strategy.
- **standup-synthesizer**: Automated daily standup digest synthesizer aggregating git commit logs, issue status updates, pull request reviews, and ticket queue events over a 24-hour window.

## 협업 방법

협업 방식은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 표준 워크플로는 다음과 같습니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **기획 및 조율:** PM과 **Project Coordinator**가 작업 일정을 구성합니다.
2. **리서치 및 분석:** **Analyst**가 데이터를 수집하고 정보를 종합합니다.
3. **문서 작성:** **Content Writer**와 **Technical Writer**가 문서를 작성합니다.
4. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

## 변형 유형

**유형**: collaboration

이 변형은 분석, 콘텐츠 작성, 기술 문서, MS365 통합을 위한 전문 에이전트와 함께 일반 작업, 리서치, 문서화, 프로젝트 조율에 중점을 둡니다.

---

*최근 업데이트: 2026-08-09*
