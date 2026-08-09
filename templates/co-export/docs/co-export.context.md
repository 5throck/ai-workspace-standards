# Co Export — Variant Context

> Variant-specific configuration for **co-export**. See [`docs/context.md`](context.md) for the immutable, workspace-wide project identity — this file holds everything that is specific to this variant (agents, phases, output routing, regulatory scope).

---

## Overview

**Co Export** is a multi-agent consulting team for import/export trade consulting: customs classification & tariff compliance, FTA/origin certification, export control & sanctions screening, trade documentation & logistics coordination, and overseas market entry strategy.

**Type**: consulting
**Status**: beta (Phase A prototype)

## Regulatory Scope

- **Primary jurisdiction**: Republic of Korea — Customs Act, Foreign Trade Act, Strategic Items Trade Control Notice, FTA origin rules.
- **Secondary jurisdictions monitored in parallel**: United States (HTS, EAR, OFAC sanctions lists), China (customs/import regulations), European Union (TARIC, EU sanctions regime).
- Agents must clearly label findings as **Korea-based** vs **destination-country-based** and flag conflicts between jurisdictions rather than silently reconciling them.

## Agent Roster & Phase Mapping

This variant follows the standard 7-phase workflow defined in [`phase-definitions.md`](phase-definitions.md). Full agent definitions live in `agents/`; this table is the phase-assignment source of truth referenced by each agent's frontmatter.

| Agent | File | Tier | Phases | Leads |
|-------|------|------|--------|-------|
| Trade Engagement Leader (PM) | `agents/pm.md` | High | 0, 1-2, 5, 6 | Orchestration & gates |
| HS Classification Specialist | `agents/hs-classification-specialist.md` | High | 1, 2 | Phase 1 (classification) |
| Customs Duty Drawback Specialist | `agents/customs-duty-drawback-specialist.md` | High | 3 | — |
| FTA/Origin Analyst | `agents/fta-origin-analyst.md` | High | 1, 2 | — |
| Export Control & Sanctions Screening Specialist | `agents/export-control-compliance-specialist.md` | High | 1, 2 | — |
| Foreign Regulatory Intelligence Analyst | `agents/foreign-regulatory-intelligence-analyst.md` | Medium | 1 | — |
| Market Entry Strategist | `agents/market-entry-strategist.md` | Medium | 1, 3, 4 | Phase 3 (strategy synthesis) |
| Trade Documentation Specialist | `agents/trade-documentation-specialist.md` | Medium | 3 | — |
| Logistics Coordinator | `agents/logistics-coordinator.md` | Low | 3, 4 | Phase 4 (delivery) |

## Dispatch / Handoff Chain

```
PM (Phase 0: triage + scope)
 │
 ├─▶ Phase 1 (parallel): hs-classification-specialist, fta-origin-analyst,
 │                        export-control-compliance-specialist,
 │                        foreign-regulatory-intelligence-analyst,
 │                        market-entry-strategist
 │
 ├─▶ Phase 2 (gate): PM synthesizes compliance + strategy findings → USER APPROVAL
 │
 ├─▶ Phase 3: market-entry-strategist (strategy doc) → trade-documentation-specialist
 │             (trade docs); customs-duty-drawback-specialist (requires confirmed HS code from
 │             Phase 1-2) → trade-documentation-specialist — may run in parallel once Phase 2
 │             gate clears. Drawback is a RECURRING sub-process (see
 │             docs/phase-definitions.md § Recurring Sub-Process Pattern): it re-runs once per
 │             export shipment without re-triggering the Phase 2 gate, unless its output would
 │             change a previously approved classification.
 │
 ├─▶ Phase 4: logistics-coordinator (delivery/handoff coordination)
 │
 └─▶ Phase 5-6 (PM-owned): audit → /sync → PR
```

## Output Destination Mapping

**Single Source of Truth** for where each agent saves deliverables. Agents MUST read this table before saving any file — do not hard-code output paths.

| Output Type | Destination | Producing Agent(s) |
|--------------|-------------|---------------------|
| HS classification / tariff assessment reports | `deliverables/reports/` | hs-classification-specialist |
| Duty drawback assessment reports | `deliverables/reports/` | customs-duty-drawback-specialist |
| FTA/origin determination reports | `deliverables/reports/` | fta-origin-analyst |
| Export control / sanctions screening reports | `deliverables/reports/` | export-control-compliance-specialist |
| Foreign regulation monitoring briefs | `deliverables/research/` | foreign-regulatory-intelligence-analyst |
| Market entry strategy documents | `deliverables/drafts/` (draft) → `deliverables/reports/` (final) | market-entry-strategist |
| Trade document templates/checklists (L/C, invoice, packing list, B/L) | `deliverables/drafts/` | trade-documentation-specialist |
| Logistics/Incoterms coordination plans | `deliverables/drafts/` | logistics-coordinator |
| Client-facing decks | `deliverables/presentations/` | market-entry-strategist, PM |

## Skills

Seven domain skills, one per specialist, defined in `skills/<name>/SKILL.md` and mirrored to
`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`. See [AGENTS.md § Domain Skills](../AGENTS.md#domain-skills)
for the full table. Common skills inherited from `templates/common/skills/` cover research,
documentation, and lifecycle management.

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Consulting Guidelines

### Core Principles

1. **Compliance-first** — all trade consulting deliverables must pass regulatory compliance verification before client delivery.
2. **Evidence-based** — HS classifications, FTA origin determinations, and export-control rulings must cite binding regulatory sources.
3. **Client sign-off gates** — no phase transition without explicit client approval; compliance findings carry legal/financial risk.
4. **PR required** — all project changes via `/sync`; never direct push to main.

---

*Created 2026-08-08 as part of Phase A scaffold. See `_ORIGIN.md` for provenance.*

---

## Variant-Specific PM Configuration

### Governance Workflow

<!-- VARIANT-SECTION: governance-workflow -->
## Governance Workflow

PM owns phases **0, 1-2, 5, and 6** for the Co Export trade consulting engagement,
per the standard phase schema in `docs/phase-definitions.md`:

- **Phase 0** — Project Initiation: clarify engagement scope (target country/product, regulatory
  jurisdictions in play), assemble the relevant specialists from the 8-agent roster.
- **Phase 1** — Research/Analysis: dispatch classification, compliance, and market specialists
  in parallel (they do not depend on each other's output at this stage).
- **Phase 2** — Design Review & Approval: PM synthesizes compliance findings (HS classification,
  origin determination, export control screening) and strategy findings into a single
  recommendation. **USER APPROVAL REQUIRED** before Phase 3 — compliance findings carry legal
  risk and must not be acted on without explicit client sign-off.
- **Phase 3** — Execution: market-entry-strategist and trade-documentation-specialist produce
  deliverables per the approved plan; customs-duty-drawback-specialist runs once the Phase 1-2
  HS classification is confirmed.
- **Phase 4** — Delivery: logistics-coordinator finalizes handoff.
- **Phase 5-6** — Lifecycle Finalization & PR: PM runs audit, `/sync`, and hands off.

This section replaces the workspace PM's governance workflow with variant-specific logic.
<!-- END VARIANT-SECTION -->

### Agent Roster

<!-- VARIANT-SECTION: agent-roster -->
## Agent Roster

See [AGENTS.md § Agent Roster](../AGENTS.md) for the canonical table (8 specialists + PM) and
[`docs/co-export.context.md`](../docs/co-export.context.md) for phase mapping and the output
destination table. This section replaces the workspace PM's agent roster with variant-specific
agents.
<!-- END VARIANT-SECTION -->

### Dispatch Protocol

<!-- VARIANT-SECTION: dispatch-protocol -->
## Dispatch Protocol

- **Phase 1 dispatch is parallel**: hs-classification-specialist, fta-origin-analyst,
  export-control-compliance-specialist, foreign-regulatory-intelligence-analyst, and
  market-entry-strategist have no interdependencies and should be dispatched in a single
  message.
- **Compliance-critical agents (HS classification, FTA/origin, export control) are High-tier**
  — do not downgrade their tier even for seemingly simple requests; misclassification carries
  real financial/legal penalty risk for the client.
- **Phase 2 gate is mandatory**: PM must not let Phase 3 work start on unapproved compliance
  findings, even if the client is in a hurry.
- Full dispatch triggers: see [AGENTS.md § Dispatch Triggers](../AGENTS.md#dispatch-triggers-pm-only-invocation).

This section replaces the workspace PM's dispatch protocol with variant-specific logic.
<!-- END VARIANT-SECTION -->
