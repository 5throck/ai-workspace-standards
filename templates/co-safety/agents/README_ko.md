# agents/

Safety OS 에이전트 정의 — 전체 로스터와 디스패치 규칙은
[`../AGENTS.md`](../AGENTS.md)에 있습니다(공식 에이전트 인덱스, Claude Code가 자동 로드).

이 변형은 **중첩 로스터 구조**를 사용합니다:

```
agents/
├── pm.md                      # CSO 오버라이드 (templates/common pm.md 확장); CSO 전용
│                               #   Section A/B/C 내용은 docs/co-safety.context.md에 있음
├── safety-governance-manager.md  # SGM — flat, 자체완결형 (공통 템플릿 대응 파일 없음)
├── safety-workflow-manager.md    # SWM — flat, 자체완결형 (공통 템플릿 대응 파일 없음)
├── _shared/                   # 공통 전문 에이전트
└── domains/
    ├── functional/            # psm, msds, training
    └── industry/              # 21개 산업 도메인 에이전트 (ehschem, gasterm, gmp, ...)
```

모든 전문 에이전트 파일은 필수 **3-섹션 구조**를 따릅니다:

1. **섹션 A — 법적 근거(Legal Basis)**: 적용 가능한 한국 EHS/GxP 법령 조항
   (산업안전보건법, 중대재해처벌법, 도메인별 법령)과 시행 기관·티어
2. **섹션 B — 역할 및 책임(Role & Responsibilities)**: 목적, KPI, 범위
3. **섹션 C — 운영 프로토콜 및 에스컬레이션 규칙**: 절차, 에스컬레이션 기준,
   핸드오프 프로토콜

모든 에이전트는 **PM/CSO 게이트웨이를 통해서만** 디스패치됩니다 — 직접 호출할 수
없습니다. 새 에이전트는 `AGENTS.md`에 등록하고 `bun scripts/agent-verify.ts`로
검증하세요.
