---
sync_version: 1
translated_from_hash: PLACEHOLDER
---

# co-export

> **Status**: 🔶 Beta — v0.1.0
> 이 변형은 활발히 개발 중이며, 프로덕션 환경에서 사용해서는 안 됩니다.

## 빠른 시작

이것은 워크스페이스 템플릿의 베타 변형(variant)입니다. `templates/common`에서 상속받으며, 변형별 맞춤 설정을 포함합니다.

### Claude Code 사용자:

자세한 지침은 `CLAUDE.md`를 참조하세요.

### Gemini CLI 사용자:

자세한 지침은 `GEMINI.md`를 참조하세요.

## 베타 상태

이 변형은 현재 **베타** 상태이며 다음 조건이 필요합니다:

- **클라이언트 인게이지먼트(Client Engagements)**: 0/2 (변형 거버넌스 규칙 참조)
- **베타 기간(Beta Duration)**: 0/2개월
- **추가 검사(Additional Checks)**: 대기 중(Pending)

프로모션 기준은 워크스페이스의 L2-to-variant 파이프라인이 관리합니다. 전체 정책은 워크스페이스 루트의 `scripts/helpers/variant-governance-rules.ts`(이 템플릿에는 포함되지 않음)를 참조하세요.

## 1. 팀 미션

**미션:** Import/export trade consulting variant

## 2. AI 팀 소개

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| **customs-duty-drawback-specialist** | `agents/customs-duty-drawback-specialist.md` | Duty drawback specialist for co-export. Determines whether raw materials used in an export are eligible for duty refund under the Act on Special Cases Concerning the Refund of Customs Duties Levied on Raw Materials for Export (the Duty Drawback Act), selects the applicable refund method (individual refund vs. simplified fixed-rate refund), and supports usage-rate calculation and refund-application deadline tracking. Distinct from ordinary Customs Act erroneous-payment refunds and from HS classification. Use when: duty drawback, customs duty refund, individual refund method, simplified fixed-rate refund method, usage-rate statement, or raw-material refund eligibility is required. |
| **export-control-compliance-specialist** | `agents/export-control-compliance-specialist.md` | Strategic items export control and sanctions/denied-party screening specialist for co-export. Determines whether goods, technology, or destinations trigger Korean export control licensing requirements, and screens counterparties against US OFAC / EAR and equivalent restricted-party lists for parallel exposure when the transaction touches US-origin technology or a sanctioned destination. Use when: strategic items classification, export license requirement determination, or sanctions/denied-party screening is required. |
| **foreign-regulatory-intelligence-analyst** | `agents/foreign-regulatory-intelligence-analyst.md` | Monitors and reports on US, China, and EU import regulation, tariff, and trade-defense (anti-dumping/countervailing) changes affecting client shipments for co-export. Provides destination-market regulatory context that Korea-based compliance agents (HS classification, FTA/origin, export control) use as an input, but does not itself issue compliance determinations. Use when: destination-country import regulation research, tariff-change monitoring, or trade-defense measure screening is required. |
| **fta-origin-analyst** | `agents/fta-origin-analyst.md` | FTA (Free Trade Agreement) rules-of-origin analysis and origin certification specialist for co-export. Determines whether goods qualify for preferential tariff treatment under a specific FTA, identifies the applicable origin criterion (wholly obtained / CTC / RVC / specific process), and defines the origin certificate/declaration requirements per the Foreign Trade Act and the relevant FTA text. Use when: FTA preferential eligibility, rules-of-origin qualification, or origin certificate requirements need to be determined. |
| **hs-classification-specialist** | `agents/hs-classification-specialist.md` | HS code classification, customs valuation, and tariff rate determination specialist for co-export. Classifies goods under the Harmonized System per the Korea Customs Act and the WCO HS nomenclature, determines applicable tariff rates, and flags classification ambiguity requiring a formal customs ruling from the Customs Valuation and Classification Institute. Use when: HS code classification, tariff rate lookup, customs valuation, or classification dispute/ambiguity is required. |
| **logistics-coordinator** | `agents/logistics-coordinator.md` | Incoterms selection, freight/forwarding, and bonded warehouse logistics coordinator for co-export. Advises on Incoterms 2020 term selection, coordinates freight mode and forwarder selection trade-offs, and plans bonded-warehouse/customs clearance logistics. Finalizes delivery handoff at the end of the engagement. Use when: Incoterms selection, freight/forwarding coordination, or bonded warehouse logistics planning is required. |
| **market-entry-strategist** | `agents/market-entry-strategist.md` | Overseas market entry strategy, buyer discovery, and market research lead for co-export. Assesses target-market demand, competitive landscape, and entry channel options (direct export, local distributor/agent, e-commerce, local incorporation), and synthesizes compliance findings from other specialists into a client-facing go-to-market recommendation. Use when: overseas market entry strategy, buyer/distributor discovery, or destination-market demand and competitive research is required. |
| **trade-documentation-specialist** | `agents/trade-documentation-specialist.md` | Trade documentation and customs clearance paperwork specialist for co-export. Prepares templates and checklists for letters of credit (L/C), commercial invoices, packing lists, bills of lading, certificates of origin, and customs declaration documents, consistent with the classification, origin, and control findings produced by the compliance specialists. Use when: trade document preparation, L/C terms review, or customs clearance paperwork checklist is required. |

## 3. 스킬

- **customs-duty-drawback-workflow**: customs-duty-drawback-workflow 스킬
- **export-control-screening**: export-control-screening 스킬
- **foreign-regulation-monitoring**: foreign-regulation-monitoring 스킬
- **fta-origin-determination**: fta-origin-determination 스킬
- **hs-classification-workflow**: hs-classification-workflow 스킬
- **logistics-coordination**: logistics-coordination 스킬
- **market-entry-strategy**: market-entry-strategy 스킬
- **trade-documentation-checklist**: trade-documentation-checklist 스킬

## 4. 스크립트 안내

`templates/co-export/scripts/` 디렉터리는 별도로 존재하지 않습니다. 워크스페이스 자동화 스크립트(`dev-sync.ts`, `test-runner.ts` 등)는 스캐폴딩 시점에 `templates/common/scripts/`에서 상속받아 사용됩니다. 프로모션 기준은 워크스페이스 루트의 `scripts/helpers/variant-governance-rules.ts`(이 템플릿에는 포함되지 않음)가 관리합니다.

## 5. 의존성 설치

```bash
bun --version   # audit.ts, dev-sync.ts 실행에 필요
```

*Last Updated: 2026-08-09 — co-export variant template*
