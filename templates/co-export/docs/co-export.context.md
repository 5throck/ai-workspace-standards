# Co Export — Variant Context

> Variant-specific configuration for **co-export**. See [`docs/context.md`](context.md) for the immutable, workspace-wide project identity — this file holds everything that is specific to this variant (agents, phases, output routing, regulatory scope).

---

## Overview

**Co Export** is a multi-agent consulting team for import/export trade consulting: customs classification & tariff compliance, FTA/origin certification, export control & sanctions screening, trade documentation & logistics coordination, and overseas market entry strategy.

**Type**: consulting
**Status**: beta (Phase A prototype)

## Regulatory Scope

- **Primary jurisdiction**: the home/exporting jurisdiction per the active country profile under `docs/countries/` (KR profile: Republic of Korea — Customs Act, Foreign Trade Act, Strategic Items Trade Control Notice, FTA origin rules). If no profile is active, confirm the home jurisdiction with the client at Phase 0 intake.
- **Secondary jurisdictions monitored in parallel**: United States (HTS, EAR, OFAC sanctions lists), China (customs/import regulations), European Union (TARIC, EU sanctions regime).
- Agents must clearly label findings as **home-jurisdiction-based** vs **destination-country-based** and flag conflicts between jurisdictions rather than silently reconciling them.

---

## Tool Stack

> Trade compliance reference sources and databases used across the engagement. These are external references, not workspace scripts — see [Scripts](#scripts) below for automation tooling.

| Category | Tool / Source |
|----------|----------------|
| HS Classification | WCO HS Nomenclature, customs-authority advance rulings (KR: Korea Customs Service / Customs Valuation and Classification Institute) |
| Tariff / Trade Statistics | UN Comtrade, destination-country customs import data |
| FTA / Origin | Home-country FTA texts and Rules of Origin annexes (KR: 20+ FTAs in force) |
| Export Control (home jurisdiction) | Strategic-items control list per the active country profile (KR: Integrated Public Notice on Strategic Items), Wassenaar / NSG / MTCR / Australia Group / CWC regimes |
| Export Control / Sanctions (US) | BIS EAR, OFAC SDN List, BIS Entity/Denied Persons Lists |
| Foreign Regulatory Monitoring | US: Federal Register, USITC AD/CVD orders, CBP HTS updates · China: GACC, MOFCOM · EU: TARIC database, European Commission trade defense investigations |
| Market Entry | KOTRA buyer databases, trade show directories, industry association listings |
| Trade Documentation | UCP 600 (letter of credit terms) |
| Logistics | Incoterms 2020 |

---

## Agent Roster & Phase Mapping

This variant follows the standard 7-phase workflow defined in [`phase-definitions.md`](phase-definitions.md). Full agent definitions live in `agents/`; this table is the phase-assignment source of truth referenced by each agent's frontmatter.

| Agent | File | Tier | Phases | Leads |
|-------|------|------|--------|-------|
| Trade Engagement Leader (PM) | `agents/pm.md` | High | 0, 1-2, 5, 6 | Orchestration & gates |
| HS Classification Specialist | `agents/hs-classification-specialist.md` | High | 1, 2 | Phase 1 (classification) |
| Customs Duty Drawback Specialist | `agents/customs-duty-drawback-specialist.md` | High | 3 | — |
| FTA/Origin Analyst | `agents/fta-origin-analyst.md` | High | 1, 2 | — |
| Halal Certification Specialist | `agents/halal-certification-specialist.md` | Medium | 1, 2 | — |
| Export Control & Sanctions Screening Specialist | `agents/export-control-compliance-specialist.md` | High | 1, 2 | — |
| Foreign Regulatory Intelligence Analyst | `agents/foreign-regulatory-intelligence-analyst.md` | Medium | 1 | — |
| Market Entry Strategist | `agents/market-entry-strategist.md` | Medium | 1, 3, 4 | Phase 3 (strategy synthesis) |
| Trade Documentation Specialist | `agents/trade-documentation-specialist.md` | Medium | 3 | — |
| Logistics Coordinator | `agents/logistics-coordinator.md` | Low | 3, 4 | Phase 4 (delivery) |

---

## Skills

Nine domain skills, one per specialist, defined in `skills/<name>/SKILL.md` and mirrored to
`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`. See [AGENTS.md § Domain Skills](../AGENTS.md#domain-skills)
for the full table. Common skills inherited from `templates/common/skills/` cover research,
documentation, and lifecycle management.

| Skill | Owner |
|-------|-------|
| `hs-classification-workflow` | hs-classification-specialist |
| `customs-duty-drawback-workflow` | customs-duty-drawback-specialist |
| `fta-origin-determination` | fta-origin-analyst |
| `halal-certification-workflow` | halal-certification-specialist |
| `export-control-screening` | export-control-compliance-specialist |
| `foreign-regulation-monitoring` | foreign-regulatory-intelligence-analyst |
| `market-entry-strategy` | market-entry-strategist |
| `trade-documentation-checklist` | trade-documentation-specialist |
| `logistics-coordination` | logistics-coordinator |

---

## Development Workflow

```
Client engagement / task received
  —
/sync "feat: description"
  —
  1. audit.ts — abort on failure
  2. memory/YYYY-MM-DD.md — session log (4-section format)
  3. MEMORY.md index update
  4. git add -A → commit
  5. pr/<date>-<slug> branch created (if on main)
  6. git push + gh pr create
```

### Agent Dispatch Order (Dispatch / Handoff Chain)

```
PM (Phase 0: triage + scope)
 │
 ├─▶ Phase 1 (parallel): hs-classification-specialist, fta-origin-analyst,
 │                        export-control-compliance-specialist,
 │                        foreign-regulatory-intelligence-analyst,
 │                        halal-certification-specialist,
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

### Workflow Phases

| Phase | Name | What Happens | Primary Owner |
|-------|------|--------------|---------------|
| 0 | Engagement Initiation | PM defines scope (target country/product, regulatory jurisdictions in play), assembles the relevant specialists | PM |
| 1 | Research & Compliance Screening | Classification, origin, control, foreign-regulation, halal-certification, and market specialists dispatched in parallel | hs-classification-specialist, fta-origin-analyst, export-control-compliance-specialist, foreign-regulatory-intelligence-analyst, halal-certification-specialist, market-entry-strategist |
| 2 | Design Review & Approval | PM synthesizes compliance + strategy findings into a single recommendation — **USER APPROVAL REQUIRED** before Phase 3 | PM |
| 3 | Execution | Strategy doc, trade documentation, and duty drawback (recurring, once HS is confirmed) produced | market-entry-strategist, trade-documentation-specialist, customs-duty-drawback-specialist |
| 4 | Delivery | Logistics/Incoterms coordination and final handoff | logistics-coordinator |
| 5-6 | Lifecycle Finalization & PR | Audit, `/sync`, PR handoff | PM |

---

<!-- VARIANT-INJECT: guidelines [REQUIRED] -->
## Consulting Guidelines

### Core Principles

1. **Compliance-first** — all trade consulting deliverables must pass regulatory compliance verification before client delivery.
2. **Evidence-based** — HS classifications, FTA origin determinations, and export-control rulings must cite binding regulatory sources.
3. **Client sign-off gates** — no phase transition without explicit client approval; compliance findings carry legal/financial risk.
4. **PR required** — all project changes via `/sync`; never direct push to main.
<!-- END VARIANT-INJECT -->

---

## Computational Integrity

All numeric outputs in deliverables (aggregations, statistics, percentages, metrics) must be computed by executed code (bun/TypeScript scripts) — never by the AI performing arithmetic directly. High-precision or safety-critical domains (Class A: aerospace, precision control, regulated finance) require validated external tools. See `docs/context.md` § Computational Integrity Standards for the full policy; label AI estimates **approximate**.

---


## File Organization Policy

### Recommended Folder Structure (co-export)

| Folder | Purpose |
|--------|---------|
| `deliverables/reports/` | Final classification/compliance/origin/drawback reports, client-ready |
| `deliverables/drafts/` | Work-in-progress strategy docs, trade document templates, logistics plans |
| `deliverables/research/` | Foreign regulation monitoring briefs |
| `deliverables/presentations/` | Client-facing decks |
| `memory/` | Session logs |

> **Note**: The `deliverables/` subdirectories and their README.md files are created automatically during project scaffolding.

### Output Destination Mapping

**Single Source of Truth** for where each agent saves deliverables. Agents MUST read this table before saving any file — do not hard-code output paths.

| Output Type | Destination | Producing Agent(s) |
|--------------|-------------|---------------------|
| HS classification / tariff assessment reports | `deliverables/reports/` | hs-classification-specialist |
| Duty drawback assessment reports | `deliverables/reports/` | customs-duty-drawback-specialist |
| FTA/origin determination reports | `deliverables/reports/` | fta-origin-analyst |
| Halal certification determination reports | `deliverables/reports/` | halal-certification-specialist |
| Export control / sanctions screening reports | `deliverables/reports/` | export-control-compliance-specialist |
| Foreign regulation monitoring briefs | `deliverables/research/` | foreign-regulatory-intelligence-analyst |
| Market entry strategy documents | `deliverables/drafts/` (draft) → `deliverables/reports/` (final) | market-entry-strategist |
| Trade document templates/checklists (L/C, invoice, packing list, B/L) | `deliverables/drafts/` | trade-documentation-specialist |
| Logistics/Incoterms coordination plans | `deliverables/drafts/` | logistics-coordinator |
| Client-facing decks | `deliverables/presentations/` | market-entry-strategist, PM |

---

## Domain Rules

1. Agents must clearly label findings as **home-jurisdiction-based** vs **destination-country-based** per [Regulatory Scope](#regulatory-scope) above; never silently reconcile conflicts between jurisdictions.
2. Compliance-critical determinations (HS classification, FTA/origin, export control) require **High-tier** agents — never downgrade their tier, even for seemingly simple requests; misclassification carries real financial/legal penalty risk.
3. **Phase 2 gate is mandatory**: no Phase 3 execution work begins on unapproved compliance findings, even if the client is in a hurry.
4. Duty drawback claims are a **recurring sub-process** (see [`phase-definitions.md`](phase-definitions.md) § Recurring Sub-Process Pattern): they re-run once per export shipment without re-triggering the Phase 2 gate, unless the output would change a previously approved classification.
5. Denied-party/sanctions screening hits (full-name exact match) must be treated as a hit requiring resolution — never self-cleared; partial-name or ownership-structure matches must be flagged for manual/legal review.
6. All agent-produced deliverables MUST be saved to their designated output folder per the **Output Destination Mapping** table above. Agents MUST read this table before saving any file. Do not hard-code output paths in agent or skill definitions — this table is the single source of truth. Create the destination folder if it does not exist.
7. Regulatory monitoring findings must carry source attribution and a staleness check (flag any source not verified within 30 days of report delivery) per the `foreign-regulation-monitoring` skill.

<!-- COMMON-CONTEXT:START -->
This project follows the workspace coding standards defined in the project's Coding Guidelines section.

Key rules:
- All operational scripts must be TypeScript (`.ts`) — run via `bun scripts/<name>.ts` (ADR-0036; no `.sh`/`.ps1` pairs)
- Git hook scripts in `.githooks/` remain Unix shell (`.sh`) for git compatibility
- All text files saved as **UTF-8 (without BOM)**
- Commit messages and PR artifacts in **English only**
<!-- COMMON-CONTEXT:END -->

---

*Created 2026-08-08 as part of Phase A scaffold. See `_ORIGIN.md` for provenance.*

*co-export.context.md version: 1.1 — added canonical section structure (Tool Stack, Scripts, Git/PR Workflow, File Organization Policy, Domain Rules), closed VARIANT-INJECT tag, removed redundant Variant-Specific PM Configuration block*
