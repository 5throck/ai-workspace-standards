---
sync_version: 1
translated_from_hash: 1fbfe4537ac4be94c4a9bb8542ba33328d841cc92c8360417089cf35ac3f516c
lang: ko
lang_reason: source-material
---

# co-deck

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.2.0
> Lecture and presentation material production variant — 11-stage AI workflow from research to print-ready PDF, plus an independent H-Stage handbook pipeline. Includes 13 agents (1 PM orchestrator + 10 slide-pipeline specialists + 2 handbook specialists) covering research, source verification, content, design, image curation, diagram/chart generation, HTML build (5 themes), layout measurement, PDF export, and handbook authoring/review.

## 개요

강연 및 발표 자료 제작 변형 — 리서치부터 인쇄용 PDF까지 이어지는 11단계 AI 워크플로우, 그리고 핸드북을 위한 독립적인 H-Stage 파이프라인. 리서치, 출처 검증, 콘텐츠, 디자인, 이미지 큐레이션, 다이어그램/차트 생성, HTML 빌드(5개 테마), 레이아웃 측정, PDF 출력, 핸드북 저작/검토를 아우르는 13개 에이전트(1 PM 오케스트레이터 + 슬라이드 파이프라인 전문가 10개 + 핸드북 전문가 2개)를 포함합니다. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 베타 변형입니다. `templates/common`을 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 강연 및 발표 자료 제작 변형 — 리서치부터 인쇄용 PDF까지 이어지는 11단계 AI 워크플로우, 그리고 핸드북을 위한 독립적인 H-Stage 파이프라인. 리서치, 출처 검증, 콘텐츠, 디자인, 이미지 큐레이션, 다이어그램/차트 생성, HTML 빌드(5개 테마), 레이아웃 측정, PDF 출력, 핸드북 저작/검토를 아우르는 13개 에이전트(1 PM 오케스트레이터 + 슬라이드 파이프라인 전문가 10개 + 핸드북 전문가 2개)를 포함합니다.

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 프로젝트 매니저 — 워크플로 오케스트레이션, 디스패치, 품질 게이트 | high | inherit |
| **version** | 수정 전 버전 스냅샷 생성; 요청 시 이전 상태 복원 | low | inherit |
| **research** | 웹 소스 수집 및 스토리라인 설계용 콘텐츠 정리 | medium | inherit |
| **source-verifier** | 리서치 URL 검증; source-verification.md + Trust Score 생성 | medium | inherit |
| **storyline** | storyline.md 및 slide_deck.md 작성 | medium | inherit |
| **design** | 색상 팔레트, 폰트, 레이아웃을 design_spec.md로 확정 | medium | inherit |
| **image-curator** | 각 슬라이드용 라이선스 명확 이미지 검색·다운로드 | medium | inherit |
| **diagram-specialist** | visual_spec에서 SVG 컨셉 다이어그램과 데이터 차트 생성 | medium | inherit |
| **html-build** | slide_deck.md와 design_spec.md에서 강의 HTML 생성 | medium | inherit |
| **measure** | 4계층 스펙 병합 검증 및 PDF 레이아웃 준비(Playwright 불필요) | medium | inherit |
| **pdf-export** | slidedata에서 샘플 및 전체 PDF 생성(pdf-lib) | medium | inherit |
| **handbook-writer** | 핸드북 챕터, 코스 개요, 강사 가이드 작성 | medium | inherit |
| **handbook-reviewer** | 품질 게이트 — 검증 스크립트 실행 및 수정 적용 | medium | inherit |

## 스킬

- **version**: 강연 파일의 버전 스냅샷을 관리합니다. 수정 전 자동 백업 및 요청 시 이전 버전 복원.
- **research**: 강연 자료의 소스 수집 및 아이디어 발굴. 주제/청중 확인, 웹 리서치, research_notes.md 작성.
- **storyline**: 강연 스토리라인 및 슬라이드 덱 구성 설계. storyline.md와 slide_deck.md 생성.
- **design**: 시각 디자인 스타일 확정. 레이아웃, 색상 팔레트, 폰트 패밀리를 결정하고 design_spec.md에 저장.
- **html-build**: slide_deck.md와 design_spec.md에서 HTML 슬라이드 생성. 테마 적용, 이미지 바인딩, 특수 페이지 삽입.
- **measure**: Playwright로 HTML 슬라이드를 자동 측정하여 PDF 생성용 좌표 추출. deprecated — prep-pdf로 대체됨.
- **prep-pdf**: Playwright 불필요 PDF 준비. 4계층 스펙 병합 해석, 폰트 검증, 레이아웃 요약 출력.
- **pdf-export**: slide 데이터에서 pdf-lib로 PDF 생성. slidedata 추출, 샘플 후 전체 PDF 생성 스크립트 실행.
- **theme-authoring**: 새 co-deck 테마 또는 스타일 생성 진입점. Style Workflow 또는 T-Stage를 디스패치.
- **handbook**: 문서 제작 워크플로 — 정적 사이트 형태의 검색 가능한 테마 핸드북 생성. H-Stage 파이프라인(H-0 ~ H-7).
- **presenter-mode**: 브라우저 BroadcastChannel API를 사용한 듀얼 윈도우 발표자 상태 동기화.

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

**유형**: lecture

이 변형은 강연 및 발표 자료 제작 — 리서치부터 인쇄용 PDF까지, 그리고 정적 사이트 형태의 테마 핸드북에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/2개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 업데이트: 2026-08-09*
