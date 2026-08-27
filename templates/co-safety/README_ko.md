---
sync_version: 1
lang: ko
lang_reason: source-material
---

# co-safety

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance

## 개요

EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.

## 빠른 시작

이것은 워크스페이스 템플릿의 beta 변형입니다. `templates/common`에서 상속하며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **msds-agent** | MSDS / Chemical Safety specialist — manages chemical substance data, GHS classif | medium | sonnet |
| **psm-agent** | Process Safety Management specialist — manages PHA, MOC, PSSR, and LOTO for high | medium | sonnet |
| **training-agent** | Safety and health education specialist — manages worker training plans, curricul | medium | sonnet |
| **battery-agent** | Secondary Battery Safety specialist — manages battery cell manufacturing safety, | medium | sonnet |
| **biotech-agent** | Biopharmaceutical CDMO & Bio-Lab Safety specialist — manages bioreactor SIP stea | medium | sonnet |
| **cosmetics-agent** | Cosmetics Safety specialist — manages cosmetics quality systems, CGMP batch rele | medium | sonnet |
| **datacenter-agent** | Data Center Safety specialist — manages hyperscale IT infrastructure safety, lit | medium | sonnet |
| **defense-agent** | Defense & Explosives Safety specialist — manages ammunition propellant mixing ES | medium | sonnet |
| **ehschem-agent** | Chemical Plant Safety specialist (화학공장 안전) — 정유/석유화학/정밀화학 plant operations | medium | sonnet |
| **ehsconst-agent** | Construction Safety specialist (건설안전) — Korean construction industry safety mana | medium | sonnet |
| **food-agent** | Food & Beverage Safety specialist — manages food safety systems, HACCP CCP monit | medium | sonnet |
| **gasterm-agent** | Gas Terminal Safety specialist (가스터미널 안전) — LNG/LPG/수소 기지 및 충전소 안전 관리 per 고압가스안전 | medium | sonnet |
| **gcp-agent** | Good Clinical Practice specialist — clinical trial management, IRB, informed con | medium | sonnet |
| **gdp-agent** | Good Distribution Practice specialist — pharmaceutical supply chain, storage, tr | medium | sonnet |
| **glp-agent** | Good Laboratory Practice specialist — non-clinical safety studies, MFDS + ME + O | medium | sonnet |
| **gmp-agent** | Good Manufacturing Practice (GMP) specialist — manages pharmaceutical quality sy | medium | sonnet |
| **gvp-agent** | Good Pharmacovigilance Practice specialist — post-market drug safety surveillanc | medium | sonnet |
| **logistics-agent** | Port Logistics & Automated Warehouse Safety specialist — manages port crane lift | medium | sonnet |
| **meddevice-agent** | Medical Device Safety specialist — KGMP-MD + ISO 13485 + ISO 14971 | medium | sonnet |
| **powergen-agent** | Power Generation Safety specialist (발전설비 안전) — 화력/신재생 발전소 안전 관리 per 전기사업법 + 전기안전 | medium | sonnet |
| **railway-agent** | Railway & Transit Infrastructure Safety specialist — manages 25kV catenary high- | medium | sonnet |
| **semicon-agent** | Semiconductor & Display Safety specialist — manages cleanroom EHS, special gas h | medium | sonnet |
| **shipbuilding-agent** | Shipbuilding & Offshore Safety specialist — manages ship tank confined space asp | medium | sonnet |
| **steelmaking-agent** | Steelmaking & Heavy Metals Safety specialist — manages molten metal furnace expl | medium | sonnet |
| **waste-agent** | Environmental Waste & Water Treatment Safety specialist — manages sewage H2S asp | medium | sonnet |
| **safety-governance-manager** | Strategic safety governance —selects industry profiles, defines KPIs, approves p | high | opus |
| **safety-workflow-manager** | Harness Prompt agent —operational safety workflow execution, dynamic agent team  | high | opus |
| **asset-integrity-agent** | Asset integrity specialist; preventative maintenance and aging equipment managem | medium | sonnet |
| **audit-agent** | Safety audit and evidence traceability —finding documentation, corrective action | medium | sonnet |
| **compliance-agent** | Regulatory compliance validation —gap analysis, compliance checklists, and regul | medium | sonnet |
| **contractor-safety-agent** | Contractor safety management; onboarding and monitoring of external workers | medium | sonnet |
| **disaster-response-agent** | Disaster response specialist; handles natural disasters like typhoons and earthq | high | opus |
| **docs-writer** | Formats official documentation; enforces English-only policy and specific transl | medium | sonnet |
| **emergency-agent** | Emergency response —scenario classification, immediate protocol activation, CSO  | high | opus |
| **incident-investigation-agent** | Incident investigation and root cause analysis (RCA) specialist | medium | sonnet |
| **legal-agent** | Real-time legal interpretation and compliance advisory based on South Korean EHS | medium | sonnet |
| **occupational-health-agent** | Occupational health specialist; worker health examinations and environment monit | medium | sonnet |
| **reporting-agent** | Safety KPI reporting specialist; tracks TRIR, LTIR, and near-misses | medium | sonnet |
| **risk-assessment-agent** | Workplace risk assessment specialist —hazard identification, risk scoring, contr | medium | sonnet |

## 스킬

- **compliance-gap**: 
- **permit-to-work**: 
- **risk-assessment**: 
- **emergency-response**: 

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

**유형**: safety

이 변형은 EHS / industrial-safety compliance — legal_basis-gated workflows, risk assessment, permit-to-work, emergency response, and regulatory audit trails에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/3개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 업데이트: 2026-08-26*
