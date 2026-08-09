---
sync_version: 1
translated_from_hash: 0df9b2d0ec4ee6dfa57a0d87c2357919331fce6c18c072cecbd78d23c18e7f64
lang: ko
lang_reason: source-material
---

# co-security

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> Red Team 작업, 위협 모델링, 모의 해킹, 크로스 플랫폼 패치 자동화를 위한 보안 검토 및 엔지니어링 워크플로 변형입니다. 레드팀 리더, 위협 모델링, 모의 해킹, 패치 엔지니어링, 보고서 작성을 다루는 전문 보안 에이전트를 포함합니다.

## 개요

**Co-Security** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI 레드팀 및 위협 모델링 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다. 전체 아키텍처와 표준은 `docs/context.md`를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 stable 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 종합적인 멀티 에이전트 보안 점검 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 범위 설정, 위협 모델링, 모의 해킹, 패치 단계를 처리하는 것을 목표로 합니다.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|----------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 조율, 디스패치, 품질 게이트 | high | inherit |
| **Red Team Lead** | 공격 전략 수립, 취약점 공격 총괄 | high | inherit |
| **Threat Modeler** | STRIDE/PASTA 분석, 공격 트리 구성 | high | inherit |
| **Pentester** | 실무 모의 해킹, PoC(개념 증명) 개발 | medium | inherit |
| **Patch Engineer** | 조치 스크립트 개발, 앤서블(Ansible) 플레이북 작성 | medium | inherit |
| **Report Writer** | 기술 및 요약 보고서 작성, CVSS 점수 산정 | medium | inherit |

## 스킬

- **sarif-exporter**: 보안 스캔 결과, 위협 매트릭스, 취약점 발견 사항을 표준 SARIF v2.1.0(정적 분석 결과 교환 형식) JSON 보고서로 내보냅니다.
- **stride-threat-matrix**: 아키텍처, API 엔드포인트, 데이터 흐름, 인프라 모델을 위한 자동화된 STRIDE 위협 매트릭스 생성 및 DREAD 위험 평가 프레임워크입니다.
- **verify-authorization**: 필수 게이트 — 서명된 승인 문서가 존재하고 모든 필수 필드를 포함하는지 확인한 후에야 Phase 1 이상(정찰, 취약점 공격, 패치) 작업을 진행할 수 있습니다. 승인이 누락되거나 불완전하면 작업을 차단합니다.

## 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이

항상 **PM**과 대화하여 요청을 시작하세요. 전문 에이전트를 직접 호출하지 마십시오. PM이 요청을 분석하고 적절한 전문가를 투입합니다.

### B. 표준 워크플로 단계

1. **승인 게이트:** PM이 모든 작업 전에 `verify-authorization` 스킬을 실행하여 권한을 확인합니다.
2. **위협 모델링:** **Threat Modeler**가 공격 표면을 분석하고 모델링합니다.
3. **취약점 공격:** **Red Team Lead**와 **Pentester**가 승인된 모의 해킹을 수행합니다.
4. **조치 및 보고:** **Patch Engineer**가 패치를 배포하고 **Report Writer**가 결과를 문서화합니다.
5. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

### E. 산출물 위치

- `docs/threat-models/` — STRIDE 표, 공격 트리, MITRE ATT&CK 매핑.
- `docs/findings/` — CVSS 점수가 포함된 취약점 발견 티켓 (`FIND-NNNN.md`).
- `docs/reports/` — 모의 해킹 보고서 및 요약 보고서.
- `PATCH_LOG.md` — 적용된 조치 사항의 감사 로그.

작업 중심의 사용 안내(시나리오 → 에이전트 조회, 단계 구조, 산출물 경로)는 [`docs/user-guide_ko.md`](docs/user-guide_ko.md)를 참고하세요.

## 변형 유형

**유형**: security

이 변형은 보안 검토, 모의 해킹, 위협 모델링, 패치 엔지니어링에 중점을 둡니다.

---

*최근 업데이트: 2026-08-09*
