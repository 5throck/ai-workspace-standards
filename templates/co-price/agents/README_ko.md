# 에이전트 디렉토리

이 디렉토리에는 co-price 가격 관리 및 컨설팅 워크플로우에서 사용되는 에이전트 정의 파일이 포함되어 있습니다.

## 사용 가능한 에이전트

| 에이전트 | 파일 | 역할 | 티어 |
|---------|------|------|------|
| PM (가격 컨설팅 오케스트레이터) | `pm.md` | 이중 라이프사이클 조율, 유일 디스패처 | High |
| Finance Strategy & Channel Lead | `finance-strategy-lead.md` | 다중 산업 가격/P&L LaTeX 사양 작성 | High |
| Cost & Asset Management | `cost-asset-mgmt.md` | OPEX/CAPEX, 감가상각, BOM 비용 롤업, 충격 밴드 | High |
| P&L Engine Auditor (CPA) | `cpa-auditor.md` | 복식부기 정합성, `[Ref:]` 태그 Vitest 하니스 | High |
| Pricing Strategist | `pricing-strategist.md` | 진단/탄성성을 F/T/S 권고안으로 변환, 코리더 | High |
| Market Intelligence Analyst | `market-intelligence-analyst.md` | 벤치마크, VW/GG 조사 분석, 경쟁사 가격 | High |
| Engagement Director | `engagement-director.md` | 진단 → 설계 → 검증 → 전달 오케스트레이션 | High |
| Lead Architect & Data Guard | `lead-architect.md` | Prisma 모델링, 배치 스키마 설계, AI 계약 | High |
| Core Engine Developer | `core-engine-dev.md` | 드리프트 프리 TypeScript 엔진, 온레일 AI 트랜스포트 | High |
| Security Auditor | `security-auditor.md` | Zod 가드레일, API 경계 감사, PRICE_* env | High |
| UX & Visual Specialist | `ux-specialist.md` | Onyx 2.0 컴포넌트, 코파일럿 패널, 사용자 가이드 | High |
| End-to-End QA Engineer | `qa-tester.md` | 컴포넌트 마운팅, 브라우저 단언, 스트리밍 | High |
| DevOps & CI/CD Admin | `devops-admin.md` | Bun 툴체인, Docker 스테이지, git 훅 | High |
| Global Strategy & L10N Auditor | `l10n-auditor.md` | 16로케일 패리티, 용어집 준수, RTL 안전 | Medium |
| Security Monitor | `security-monitor.md` | 취약점/권고 스캔, gitleaks, 의존성 정책 | Medium |

## 에이전트 생성

```bash
bun run agent:create <name> --role "표시 이름" --group <그룹>
```

에이전트 생성 후 `AGENTS.md`와 `docs/co-price.context.md § Agents`를 업데이트하세요.

전체 워크플로우는 `AGENTS.md`를 참고하세요.