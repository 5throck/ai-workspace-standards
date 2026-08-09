---
sync_version: 1
translated_from_hash: PLACEHOLDER
lang: ko
lang_reason: source-material
---

# {{VARIANT_NAME}}

> **언어**: [English](README.md) · **한국어**
> **상태**: {{STATUS_LINE}}
> {{TAGLINE}}

## 개요

{{NARRATIVE_OVERVIEW}}

## 빠른 시작

{{QUICK_START_BODY}}

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

{{NARRATIVE_MISSION}}

## AI 팀 소개

{{TEAM_INTRO_PROSE}}

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
{{AGENT_ROSTER_ROWS}}

## 스킬

{{SKILLS_BLOCK}}

## 협업 방법

{{NARRATIVE_HOWTO_INTRO}}

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

{{NARRATIVE_WORKFLOW_PHASES}}

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

## 변형 유형

**유형**: {{VARIANT_TYPE}}

이 변형은 {{VARIANT_TYPE_DESCRIPTION}}에 중점을 둡니다.

{{BETA_STATUS_BLOCK}}

---

*최근 업데이트: {{LAST_UPDATED}}*
