---
sync_version: 1
translated_from_hash: 0395ad739b73ba55cb839d9e428f27c0f9c3932c7ee10f10ad4300b5a170557c
lang: ko
lang_reason: source-material
---

# co-learning

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> 학습·평가 워크플로 — 답안 길이 편향 검사가 포함된 문항 은행 저작, 개선 대장 검수, 시험 운영(기수·창·활성화·통계 모니터링)

## 개요

학습·평가 워크플로 — 답안 길이 편향 검사가 포함된 문항 은행 저작, 개선 대장 검수, 시험 운영(기수·창·활성화·통계 모니터링). 에이전트 생태계와 거버넌스는 `AGENTS.md`를 참고하세요. `docs/context.md`(아키텍처 및 표준)는 프로젝트 생성 시 `templates/common`에서 상속됩니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 안정적인 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### 제공되는 지침 파일:

- `AGENTS.md` — 에이전트 생태계, PM 게이트웨이 워크플로, 디스패치 규칙 (모든 플랫폼).
- `HERMES.md` — Hermes Agents 지침 맵.

(`CLAUDE.md` / `GEMINI.md`는 프로젝트 생성 시 `templates/common`에서 전달됩니다.)

## 팀 미션

**미션:** 학습·평가 워크플로 — 답안 길이 편향 검사가 포함된 문항 은행 저작, 개선 대장 검수, 시험 운영(기수·창·활성화·통계 모니터링)

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|----------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 조율, 디스패치, 품질 게이트 | medium | inherit |
| **exam-bank-steward** | 시험 문항 은행 큐레이션, 편향 검토, 시험 운영 전담 | medium | inherit |
| **i18n-specialist** | 로케일 문서화 — 번역 존 운영, 언어 정책 준수, 한국어 평이문 출력 (필요 시 호출) | medium | inherit |


## 스킬

- **exam-bank-operations**: 문항 은행 품질·시험 운영 워크플로 — 답안 길이 편향 검사가 포함된 문항 저작, 개선 대장 검수, 시험 창 준비와 통계 모니터링.

> 플랫폼 미러에는 common 제공 스킬 3개 — `finishing-a-development-branch`, `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager` — 가 추가로 포함되며, `templates/common`에서 상속되고 워크스페이스 `VERSION_MANIFEST.md`에 등록됩니다.

## 협업 방법

협업 방식은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 표준 워크플로는 다음과 같습니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

표준 7단계 모델 (`docs/phase-definitions.md` 참고):

0. **팀 구성 및 환경 기준선:** PM이 팀을 구성하고 범위를 확정합니다. `stack-setup`(선택)과 `security-monitor`가 환경 기준선을 확립합니다.
1. **분석 및 스택 설정:** `architect`가 요구사항과 완료 기준을 구현 준비가 된 개요로 분석합니다.
2. **설계 검토 및 승인:** 아키텍트의 구현 계획 + ADR이 명시적 사용자 승인을 위해 제출됩니다.
3. **UI/UX 설계:** UI/UX 요소가 범위에 있을 때 `designer`(선택)가 와이어프레임, 컴포넌트 스펙, 디자인 토큰을 산출합니다.
4. **구현 및 QA 게이트:** `code-writer`가 구현하고 `test-runner`가 검증하며, 실패 시 PM이 최대 3회까지 반복합니다.
5. **보안 검토 및 라이프사이클 마무리:** `security-monitor`가 PR 전 권고 점검을 실행하고, PM이 결정을 기록하며 거버넌스 기록을 갱신합니다.
6. **품질 보증 및 최종 마무리:** PM이 audit과 `/sync`를 실행하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/security-check [--pr]` — 보안 권고 스캔(일일) 또는 PR 전 권고 점검.

## 변형 유형

**유형**: learning

이 변형은 학습·평가 워크플로 — 문항 은행 품질, 시험 운영, 통계 모니터링에 중점을 둡니다.

---

*최근 갱신: 2026-10-05*
