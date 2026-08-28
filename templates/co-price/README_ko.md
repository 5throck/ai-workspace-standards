# co-price

> 언어: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v4.1.0
> 가격 관리 및 커설팅 시뮬레이터 변형. 다중 제품 · 다중 채널 가격 관리, 부격 항목 최의화, 시장 조사 분석, 비용 충격 및 유통 트레이드라인 관리를 제공합니다.

## 개요

**Co-Price** 워크스페이스에 오신 것을 환영합니다. Claude 및 Gemini AI 어시스트와의 협업에 최적화된 이 템플릿은 재무 전략, 비용 경인, 상장 조사, 계산 관리, 에이전트 오터, 및 서비스 디라이버리를 교보하는 15개의 전문 AI 에이전트 팀을 제공합니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상송하며 변형별 맞춤 설정을 포함합니다. 작업 중심 안내 — 특정 가격 질문에 사용할 에이전트/스킬, Harness Engineering 워크플로, Commercial Operating Cycle — 은 [`docs/co-price.context.md`](docs/co-price.context.md)를 참고하세요.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 종합적인 멀티 에이전트 가격 관리 및 커설팅 파트너십 제공.

우리는 특정 작업 단계를 전문 에이전트에게 위임하여 컨텍스트 과부하를 줄이는 것을 목표로 설계되었습니다. 전지전능한 단일 AI와 대화하는 대신, 전체 가격 팀과 협업하는 사용자 또는 팀 리더 역할을 수행하세요.

## AI 팀 소개

여러분의 파트너는 5개 그룹의 15개 전문 에이전트로 구성됩니다. **Project Manager (PM)**만 모든 요청의 단일 진입점입니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | 가격 커설팅 오캐스트레이터 — 이중 라이프사이클 조율, 유일 디스패치 | high | inherit |
| **Finance Strategy & Channel Lead** | 다중 산업 가격/P&L LaTeX 사포 작성, 수익 엔진, 워터폴 | high | inherit |
| **Cost & Asset Management** | OPEX/CAPEX, 각각상각, BOM 비용 롤업, 노동력 스케일링, 축격 밴드 | high | inherit |
| **P&L Engine Auditor (CPA)** | 부격 항목 정무성, `[Ref:]` 태그 Vitest 하넨스, 하넨스 통과 증명서 | high | inherit |
| **Pricing Strategist** | 진단/탈성성을 F/T/S 권고사항으로 변환, 할인 사다리, 가격 코리도 | high | inherit |
| **Market Intelligence Analyst** | 벤칸마크, VW/GG 조사 분석, 경쟁사 가격, 출처 관리 | high | inherit |
| **Engagement Director** | 진단 → 설계 → 검증 → 디라이버리 오캐스트레이션, 사면 통과 게이트 | high | inherit |
| **Lead Architect & Data Guard** | Prisma 모델링, v10.1 배치 스키마 설계, AI 인프라 계약 | high | inherit |
| **Core Engine Developer** | 드리프프리 TypeScript 엔진 모듈, 오널레일 AI 트랜스포트 | high | inherit |
| **Security Auditor** | Zod 가드레일, API 경계 감사, PRICE_* env 스키마 | high | inherit |
| **UX & Visual Specialist** | Onyx 2.0 컴포넌트, 코파일트 패널, 이중언어 사용자 가이드 | high | inherit |
| **End-to-End QA Engineer** | 컴포넌트 마운티벅, 브라우저 검증, 스트리밍 상태 체크 | high | inherit |
| **DevOps & CI/CD Admin** | Bun 툼체인, Docker 스테이지, git 훁, 배포 표준 | high | inherit |
| **Global Strategy & L10N Auditor** | 16로케일 페리티, 용어 준수, RTL 안전 | medium | inherit |
| **Security Monitor** | 취약점/권고 사칸, gitleaks, 취약점 듀시, 의존성 폄릴 | medium | inherit |

## 스킬

- **harness-verification**: 5개스편씼c 엔진 인증 — 사포 → 테스트 → 코드 → CPA 감사 → 증명서.
- **double-entry-reconciliation**: 부격 가격 항목 정무성 검증 (A = L + E).
- **i18n-audit**: 16로케일 번역 페리티 및 용어 줄수 검증.
- **excel-export**: 엔진 데이터로부터 구조화된 Excel 워크북 생성.
- **pdf-export**: 클라이언트 사면 전달릴 PDF 보고서 생성.
- **financial-statement-prep**: 재무 제표 준비 및 포맷팅.
- **math-function-plotter**: 가격 공식 시각화를 위한 수학 함수 보견화.
- **sheet-model**: 스프레드시트 스타일 데이터 모델링 및 시나리오 분석.
- **prisma-7**: Prisma 7 ORM 스키마 관리 및 마이거레이션.
- **ui-component-design**: Onyx 2.0 컴포넌트 설계 패턴.
- **van-westendorp-psm**: Van Westendorp 가격 민감도 미터 조사 분석.
- **gabor-granger**: Gabor-Granger 직접 가격 조사 방법론.
- **competitive-intelligence**: 시장 및 경쟁 분석 스키마.
- **scenario-comparison**: 다중 시나리오 가격 비교 및 평가.
- **insight-synthesis**: 다중 전문가 분석을 통합 전략 인사이트로 통합.
- **executive-presentation**: C-레범 프렌즼테이션 및 의사결정 덱 설계.
- **trade-promotion-roi**: 트레이드 프로모션 ROI 평가 netROI(8주) 게이트.
- **pricing-playbook**: 표준화된 가격 방법론 및 프로세스 가이드.
- **price-waterfall-analysis**: 포켓 마진 분석 및 가격 워터폴 진단.
- **pricing-governance**: 가격 거버넌스 프레임워크, 코리도 관리, 권한 행렬 매트릭스.
- **map-channel-enforcement**: MAP 정책 실행 및 채널 축돌 해결.

## 협업 방법

우리와의 협업은 품질 극대화와 충돌 방지를 위해 구조화됩니다.

### A. PM 게이웨이

모든 요청은 **PM**과 대화하는 것으로 시작하세요. 전문 에이전트를 직접 호출하지 마세요. PM이 요청을 분석하고 적절한 전문가를 호출합니다.

### B. 표준 워크플로 스테이지

1. **트라이에일 & 전략:** PM과 **Finance Strategy Lead** + **Cost & Asset Management**이 폙행로 분석.
2. **기술 설계:** **Lead Architect**가 접근 방식 설계 (DB/코어 변경은 사용자 승인 필요).
3. **구현:** **Core Engine Developer** (직렬), 이후 **UX Specialist** (직렬).
4. **검증:** CPA 감사 → 보안 감사 → L10N 감사 → QA 테스트.
5. **리뷰 & 심크:** `/sync "커미트 메시지"`로 안전하게 커미트하고 PR을 여는다.

### C. 사용 가능한 캸럫드

다음 슬래시 캸럫드는 Claude Code 및 Gemini CLI에 등록된 스킬로 신료함:

- `/sync "feat: ..."` — 전 파이플라인: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — `CHANGELOG.md`에 엔트리 추가.
- `/memlog "요약"` — 현재 세션 로그에 요약 추가.

## 변형 유형

**유형**: consulting