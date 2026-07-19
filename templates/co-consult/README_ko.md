---
sync_version: 1
translated_from_hash: TBD
---

# {{PROJECT_NAME}}

**Language**: [English](README.md) · **한국어**

> **Status**: ✅ Stable — v1.0.0

**Co-Consult** 워크스페이스에 오신 것을 환영합니다. 이곳은 여러분의 전담 AI 전략 컨설팅 및 분석 에이전트 팀입니다. Claude 및 Gemini AI 어시스턴트와의 협업에 최적화된 이 템플릿은 프로젝트 첫날부터 여러분을 지원할 전문 AI 에이전트 팀을 제공합니다.

## 1. 팀 미션

**미션:** 종합적인 멀티 에이전트 전략 컨설팅 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이도록 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 여러분은 전체 제품 팀과 협업하는 사용자 또는 팀 리더 역할을 수행합니다. 여러분이 비전을 제시하는 동안, 우리는 시장 조사, 솔루션 아키텍처 설계, 산출물 제작 단계를 처리하는 것을 목표로 합니다.

## 2. AI 팀 소개

여러분의 파트너는 각자 고유한 역할을 가진 전문 에이전트들로 구성됩니다. **Project Manager (PM)**는 단일 진입점으로서 팀의 나머지 인원을 조율합니다.

| 에이전트 | 역할 및 역량 |
|----------|--------------|
| **Engagement Leader (PM)** | 컨설팅 단계 조율, 클라이언트 인터페이스 관리 |
| **Strategy Analyst** | 시장 분석, 경쟁사 리서치, 재무 모델링 |
| **Industry Expert** | 산업별 심층 인사이트, 규제 환경 분석 |
| **Change Management Partner** | 조직 변화 관리, 이해관계자 조율 |
| **Communications Lead** | 대고객 커뮤니케이션, 전략적 내러티브 작성 |
| **Solutions Architect** | 기술 솔루션 설계, 구현 로드맵 작성 |
| **Subject Matter Expert (SME)** | 직무 전문성(HR, 재무, 운영 등), 솔루션 설계 |
| **Workstream Lead** | 워크스트림 관리, 팀 조율 |
| **Delivery Manager** | 프로젝트 딜리버리, 운영 조율 |
| **Technology Specialist** | 디지털 트랜스포메이션 지원 |
| **Data Analyst** | 통계 분석, 데이터 모델링, 비즈니스 인사이트, 한국 DART 재무 분석 |

## 3. 핵심 스킬

핵심 컨설팅 프레임워크(`competitive-intelligence`, `financial-modeling`, `solution-design`, `executive-presentation`, `stakeholder-alignment`, `org-readiness-assessment` 등 — 총 13개 스킬) 외에도, 이 팀은 두 가지 한국 시장 리서치 역량을 갖추고 있습니다.

- **`k-dart`** — 한국 금융감독원(FSS) 전자공시시스템(DART) OpenAPI를 조회하여 기업 공시, 기업 개황, 재무제표, 주요사항보고서를 제공합니다.
- **`company-intelligence`** — 종합적인 기업/기업집단 인텔리전스 수집. 5개의 병렬 리서치 에이전트(개요, 재무, 제품/시장, 애널리스트 커버리지, 리더십/거버넌스)를 투입하여 하나의 통합 보고서로 정리합니다.
- **`financial-statement-analysis`** — 한국 재무제표 분석을 위한 전체 파이프라인: DART 수집 → 검증 → 정규화 → KPI 추출 → ROIC 밸류 드라이버 트리 → Markdown 보고서. `bun scripts/co-consult/financial-pipeline.ts`로 실행합니다. 단계별 안내는 [`docs/user-guide_ko.md`](docs/user-guide_ko.md)를 참고하세요.

## 4. 이 팀과의 협업 방법

우리와의 작업은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 다음은 우리의 표준 워크플로입니다:

### A. PM 게이트웨이
항상 **PM**과 대화하여 요청을 시작하세요. 전문 에이전트를 직접 호출하지 마십시오. PM이 요청을 분석하고 적절한 전문가를 투입합니다.

### B. 표준 워크플로 단계
1. **전략 및 기획:** PM과 **Engagement Leader**가 컨설팅 범위를 정의합니다.
2. **리서치 및 아키텍처:** **Strategy Analyst**와 **Solutions Architect**가 접근 방식을 설계합니다.
3. **실행:** 분야별 전문가(**SME**, **Industry Expert**)가 심층적인 인사이트를 제공합니다.
4. **전달:** **Communications Lead**와 **Delivery Manager**가 클라이언트 프레젠테이션을 완성합니다.
5. **리뷰 및 동기화:** `/sync "커밋 메시지"`를 사용하여 안전하게 커밋하고 PR을 엽니다.

### C. 사용 가능한 명령어
우리의 일상 업무는 슬래시 명령어로 진행됩니다 (Claude Code 및 Gemini CLI 스킬로 등록됨):
- `/sync "feat: ..."` — 전체 파이프라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 항목을 추가합니다.
- `/memlog "summary"` — 오늘 세션 로그에 요약을 추가합니다.
- `/meeting` — 구조화된 인라인 멀티 에이전트 토론을 실행합니다.

### D. 실용 가이드

특정 컨설팅 질문에 어떤 에이전트/스킬을 사용해야 하는지, financial-statement-analysis 파이프라인 안내, 인게이지먼트 단계, 산출물 저장 위치 등 작업 중심 안내는 [`docs/user-guide_ko.md`](docs/user-guide_ko.md)를 참고하세요.

함께 훌륭한 결과물을 만들어 봅시다!
