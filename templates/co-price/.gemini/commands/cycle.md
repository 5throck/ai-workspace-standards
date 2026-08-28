---
description: Commercial Operating Cycle(8단계 폐루프) 실행 — 목표를 인자로 받아 PM이 단계별 게이트를 운영합니다.
lang: ko
lang_reason: source-material
---


# Commercial Operating Cycle — 목표: $ARGUMENTS

PM(Pricing Consulting Orchestrator)으로서 `docs/co-price.context.md → Commercial Operating Cycle`
의 8단계 폐루프를 실행합니다. 게이트 조건은 `AGENTS.md → Commercial Operating Cycle gates`.

## 규칙

- 0단계 목표·예산 한도는 위 인자에서 확정합니다. 예산이 없으면 먼저 사용자에게 묻습니다.
- 각 단계는 게이트 산출물을 `memory/`에 기록하고 한 줄 상태를 보고한 뒤 다음 단계로 진행합니다.
- 디스패치는 PM Gateway 단일 창구(`AGENTS.md → Dispatch Protocol`)만 사용 — 작성 가능 에이전트는 직렬, 조사 에이전트는 읽기 전용.
- 6단계(사전검증) 삼중뷰는 반드시 사용자 승인을 받은 후 통과 처리합니다.
- 8단계 평가 결과는 다음 사이클 0~2단계의 입력으로 요약·전달되어야 합니다.

## 단계 체크리스트

0. 목표·제약 — 목표/KPI/예산 한도 기록.
1. 진단 — `market-intelligence-analyst`: 세그먼트 구조·경쟁 강도(CompetitorPrice)·WTP(van-westendorp-psm/gabor-granger)·GTN 밴드.
2. 선정 — `pricing-strategist`: scorecard 재산정(partner-pnl.scoreTradeLines), 포트폴리오 결정.
3. 배분 — 거래선별 물량·믹스 계획, capacity/mixRatio 제약을 `core-engine-dev`가 검증.
4. Terms 설계 — `finance-strategy-lead`: TradeTerm 초안(quantity_tier/revenue_rebate/promotion_allowance + settlement).
5. Price 경로 설계 — ConsumerPricePlan 초안(EDLP/High-Low/Markdown/Dynamic/Skim/Penetrate…, 채널 스코프).
6. 검증 — baseline·policy 스냅샷 고정 후 compareSnapshotsAction 실행, 삼중뷰 제시 → **사용자 승인 대기**(cpa-auditor 수치 교차검증).
7. 집행 — 승인 정책 활성화(settlement 설정). sell-in과 sell-out을 구분해 기록.
8. 평가 — 합의된 관측창 종료 후(+8주 post-dip 점검): netROI, 결과 분류(True Incremental/Forward Buying/Cannibalization), scorecard 재등급 → 다음 사이클 0~2단계 입력 메모 작성.

지금 0단계부터 시작하고, 게이트 통과마다 한 줄 요약을 남깁니다.
