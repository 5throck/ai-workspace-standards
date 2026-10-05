---
sync_version: 1
translated_from_hash: e58a04a72c3426cfbc1086a81f4ee6e820a21723843ddc7f4abca59af4ea58b9
lang: ko
lang_reason: source-material
---

# co-develop

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## 개요

Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization). 에이전트 생태계와 거버넌스는 `AGENTS.md`를 참고하세요. `docs/context.md`(아키텍처 및 표준)는 프로젝트 생성 시 `templates/common`에서 상속됩니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 안정적인 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### 제공되는 지침 파일:

- `AGENTS.md` — 에이전트 생태계, PM 게이트웨이 워크플로, 디스패치 규칙 (모든 플랫폼).
- `HERMES.md` — Hermes Agents 지침 맵.

(`CLAUDE.md` / `GEMINI.md`는 프로젝트 생성 시 `templates/common`에서 전달됩니다.)

## 팀 미션

**미션:** Software development workflow — full agent team with PM, Architect, Designer, Code Writer, Test Runner, Security Monitor, and Stack Setup Specialist (tech stack detection and environment initialization)

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | Medium | inherit |
| **architect** | Design agent - produces implementation plans and technical specs | high | inherit |
| **code-writer** | Implementation agent - writes code from an approved plan | low | inherit |
| **designer** | UI/UX design agent - produces wireframes, component specs, and design tokens | medium | inherit |
| **i18n-specialist** | 로캘 문서 검토, 로캘 구성, 로캘 미러 번역 동기화 (common extends-stub; 필요 시 투입 — 순차 파이프라인에 속하지 않음) | medium | inherit |
| **security-monitor** | Security monitor - scans for vulnerabilities, advisories, and secret leaks | medium | inherit |
| **stack-setup** | Stack Setup Specialist | low | inherit |
| **test-runner** | QA and verification agent - runs tests and validates acceptance criteria | medium | inherit |

## 스킬

- **code-review**: Conducts thorough code reviews focusing on correctness, maintainability, security, and best practices. Use when: reviewing pull requests, evaluating code quality, providing constructive feedback, or ensuring code standards compliance.
- **refactoring**: Improves code structure and design while preserving behavior using systematic refactoring techniques. Use when: cleaning up code, reducing duplication, improving maintainability, or paying down technical debt.
- **swe-solve**: Autonomous 5-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation and pull-request synthesis.
- **test-driven-development**: Implements software using Test-Driven Development (TDD) methodology with red-green-refactor cycle. Use when: developing new features, fixing bugs with tests, or ensuring code reliability through test-first approach.

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

**유형**: development

이 변형은 소프트웨어 개발 워크플로, 기능 구현, 통합 테스트에 중점을 둡니다.

---

*최근 갱신: 2026-10-05*
