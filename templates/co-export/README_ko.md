---
sync_version: 1
translated_from_hash: 7bbe7039fbcd19b54968443b4542854f63dc846f6841c01052fecf00ffb0e1be
lang: ko
lang_reason: source-material
---

# co-export

> **언어**: [English](README.md) · **한국어**
> **상태**: ⚠️ Beta — v0.1.0
> Import/export trade consulting variant

## 개요

구조화된 무역 컨설팅 참여 방법론(4단계交付): (1) 규제 정보 수집 및 HS/FTA 분류, (2) 수출 통제 및 해외 규제 스크리닝을 통한 컴플라이언스 교차 검증, (3) 시장 진입 전략 정교화 및 무역 서류 준비, (4) 물류 조정 및 출하 후 관세 환급 청구. 각 단계는 실행으로 진행하기 전에 클라이언트 승인 게이트를 포함합니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 베타 변형입니다. `templates/common`에서 상속받으며 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참고하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참고하세요.

## 팀 미션

**미션:** 수출입 무역 컨설팅 변형

## AI 팀 소개

당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.

| 에이전트 | 역할 | 티어 | 모델 |
|---------|------|------|------|
| **PM** | Project Manager — workflow orchestration, dispatch, quality gates | high | inherit |
| **customs-duty-drawback-specialist** | Duty drawback specialist for co-export | high | inherit |
| **export-control-compliance-specialist** | Strategic items export control and sanctions screening specialist | high | inherit |
| **foreign-regulatory-intelligence-analyst** | Monitors US/China/EU import regulation, tariff, and trade-defense changes | medium | inherit |
| **fta-origin-analyst** | FTA rules-of-origin analysis and origin certification specialist | high | inherit |
| **hs-classification-specialist** | HS code classification, customs valuation, and tariff rate specialist | high | inherit |
| **logistics-coordinator** | Incoterms selection, freight/forwarding, and bonded warehouse logistics | low | inherit |
| **market-entry-strategist** | Overseas market entry strategy, buyer discovery, and market research | medium | inherit |
| **trade-documentation-specialist** | Trade documentation and customs clearance paperwork specialist | medium | inherit |

## 스킬

- **customs-duty-drawback-workflow**: Guides the Customs Duty Drawback Specialist through refund-eligible raw material determination, individual refund vs. simplified fixed-rate refund method selection, usage-rate calculation support, and refund-application deadline tracking under the Act on Special Cases Concerning the Refund of Customs Duties Levied on Raw Materials for Export. Keeps drawback claims clearly separated from ordinary Customs Act erroneous-payment refunds.
- **export-control-screening**: Guides the Export Control & Sanctions Screening Specialist through strategic-item classification, catch-all end-use/end-user assessment, and denied-party/sanctions screening. The highest-consequence workflow on the team — escalation discipline is mandatory.
- **foreign-regulation-monitoring**: Guides the Foreign Regulatory Intelligence Analyst through tracking US/China/EU import regulation, tariff, and trade-defense changes, with strict source attribution and staleness disclosure so downstream compliance work isn't built on outdated destination-market context.
- **fta-origin-determination**: Guides the FTA/Origin Analyst through determining whether goods qualify for preferential tariff treatment under a specific Free Trade Agreement — origin criterion selection, non-originating material assessment, and origin certification method identification.
- **hs-classification-workflow**: Guides the HS Classification Specialist through GRI-ordered Harmonized System classification, customs valuation basis determination, and tariff rate lookup. Ensures classification reasoning is reproducible and defensible under a customs post-clearance audit.
- **logistics-coordination**: Guides the Logistics Coordinator through Incoterms 2020 term selection, freight mode/forwarder comparison, and bonded-warehouse/customs clearance logistics planning, ending in final engagement delivery handoff.
- **market-entry-strategy**: Guides the Market Entry Strategist through destination-market demand assessment, competitive landscape analysis, entry channel comparison, and buyer/distributor discovery — synthesized with compliance findings into a single go-to-market recommendation.
- **trade-documentation-checklist**: Guides the Trade Documentation Specialist through assembling a complete, internally consistent trade document package (invoice, packing list, B/L, certificate of origin) and reviewing letter-of-credit terms against UCP 600 for discrepancy risk.

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

**유형**: consulting

이 변형은 AI 지원 무역 및 규제 컴플라이언스 컨설팅 참여에 중점을 둡니다.

> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.

- **클라이언트 참여**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간**: 0/2개월
- **추가 검증**: 대기 중

승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.

---

*최근 업데이트: 2026-08-09*
