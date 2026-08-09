---
sync_version: 1
translated_from_hash: 2004d1d0f82c1ae1a66737d2e615fe3e2a539ab551ac50267716adad27e6d6eb
lang: ko
lang_reason: source-material
---

# co-consult

> **언어**: [English](README.md) · **한국어**
> **상태**: ✅ Stable — v1.0.0
> AI 지원 비즈니스 컨설팅 참여를 위한 전략 컨설팅 변형. 리서치, 전략, 변화 관리, 커뮤니케이션, 솔루션 설계, 딜리버리를 아우르는 전문 컨설팅 에이전트를 포함합니다.

## 개요

**Co-Consult** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI 전략 컨설팅 및 분석 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 stable 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다. 작업 중심 안내 — 특정 컨설팅 질문에 사용할 에이전트/스킬, financial-statement-analysis 파이프라인 안내, 참여 단계, 산출물 저장 위치 — 는 [`docs/user-guide_ko.md`](docs/user-guide_ko.md)를 참고하세요.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 종합적인 멀티 에이전트 전략 컨설팅 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 시장 조사, 솔루션 아키텍처 설계, 산출물 제작 단계를 처리하는 것을 목표로 합니다.

## AI 팀 소개

여러분의 파트너는 각자 고유한 역할을 가진 전문 에이전트들로 구성됩니다. **Project Manager (PM)**는 단일 진입점으로서 팀의 나머지 인원을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 조율, 디스패치, 품질 게이트 | high | inherit |
| **change-management-partner** | 조직 변화 관리, 문화 변화, 이해관계자 조율 주도 | medium | inherit |
| **communications-lead** | 대고객 커뮤니케이션, 프레젠테이션, 전략적 내러티브 작성 | medium | inherit |
| **data-analyst** | 데이터 분석, 통계 모델링, 시각화 지원 제공 | low | inherit |
| **delivery-manager** | 프로젝트 딜리버리, 운영 조율, 실행 품질 관리 | low | inherit |
| **industry-expert** | 산업별 심층 인사이트 및 경쟁 역학 분석 제공 | high | inherit |
| **sme** | HR, 재무, 운영 등 직무 전문성 제공 | medium | inherit |
| **solutions-architect** | 기술 솔루션, 시스템 아키텍처, 구현 로드맵 설계 | medium | inherit |
| **strategy-analyst** | 시장 분석, 경쟁 리서치, 전략 평가 주도 | medium | inherit |
| **technology-specialist** | 협업 플랫폼 구현 및 디지털 워크플로 자동화 주도 | low | inherit |
| **workstream-lead** | 프로젝트 워크스트림, 팀 조율, 딜리버리 품질 관리 | medium | inherit |

## 스킬

- **change-impact-assessment**: 제안된 변화가 조직 계층, 프로세스, 역할, 개인에게 미치는 영향을 매핑합니다.
- **competitive-intelligence**: 컨설팅 참여를 위한 체계적인 시장 및 경쟁 분석 (시장 진입 모듈 포함).
- **consulting-report-writing**: McKinsey/BCG 스타일 컨설팅 보고서 — 이슈 트리, MECE, 슬라이드 논리, 권고안 프레이밍.
- **executive-presentation**: 피라미드 원칙을 활용한 C-레벨 전략 프레젠테이션 및 의사결정 덱 설계.
- **financial-modeling**: 사업 사례 구축 — ROI, NPV/IRR/페이백, 시나리오 민감도, 변화 관리 비용.
- **insight-synthesis**: 여러 전문가 분석을 문화적 필터링과 함께 하나의 전략 인사이트로 통합.
- **narrative-framework**: 분석 결과를 매력적인 스토리로 변환하는 설득력 있는 내러티브 구조 구성.
- **org-readiness-assessment**: 조직의 변화 흡수 및 유지 역량 진단; 준비도 점수 산출.
- **project-delivery**: 참여 딜리버리 계획 및 관리 — 마일스톤, 이슈 로그, 리스크 등록부, 상태 보고.
- **solution-design**: 비즈니스 요구사항을 의존성 맵이 포함된 완전한 기술 솔루션 설계로 변환.
- **stakeholder-alignment**: 체계적인 이해관계자 매핑, 저항 분석, 영향력-관심 우선순위화.
- **stakeholder-review-management**: 이해관계자 리뷰 주기 관리 — 리뷰어 선정, 피드백, 충돌 해결, 변경 추적.
- **technical-feasibility**: 제안된 솔루션의 기술적 구현 가능성 평가; 복잡도 등급 및 리스크 산출.
- **company-intelligence**: 종합적인 기업/기업집단 인텔리전스; 5개 병렬 리서치 에이전트를 하나의 보고서로 통합.
- **financial-statement-analysis**: 한국 재무제표 분석 전체 파이프라인 — DART → 검증 → 정규화 → KPI → ROIC 트리 → 보고서.
- **mece-logic-auditor**: 컨설팅 문제 해결 프레임워크를 위한 MECE 이슈 트리 감사 및 전략적 추론 평가.

## 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이

항상 요청을 시작할 때 **PM**과 먼저 대화하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 불러옵니다.

### B. 표준 워크플로 단계

1. **전략 및 기획:** PM과 **Engagement Leader**가 컨설팅 범위를 정의합니다.
2. **리서치 및 아키텍처:** **Strategy Analyst**와 **Solutions Architect**가 접근 방식을 설계합니다.
3. **실행:** 분야별 전문가(**SME**, **Industry Expert**)가 심층적인 인사이트를 제공합니다.
4. **전달:** **Communications Lead**와 **Delivery Manager**가 클라이언트 프레젠테이션을 완성합니다.
5. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어

일상적인 작업은 슬래시 명령어(Claude Code 및 Gemini CLI에서 Skill로 등록됨)로 구동됩니다:

- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목 추가.
- `/memlog "summary"` — 오늘 세션 로그에 요약 추가.
- `/meeting` — 구조화된 인라인 다중 에이전트 토론 진행.

## 변형 유형

**유형**: consulting

이 변형은 AI 지원 비즈니스 컨설팅 참여를 위한 전략 컨설팅에 중점을 둡니다.

---

*최근 업데이트: 2026-08-09*
