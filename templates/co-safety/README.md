---
sync_version: 1
content_hash: 2032822a73550ce082b02fc1848ef873caef2a5b009282a1b8bed359290eae0f
---

# co-safety

> **Language**: **English** · [한국어](README_ko.md)
> **Status**: ⚠️ Beta — v0.1.0
> EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance

## Overview

EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance. See docs/context.md for full architecture and standards.

## Quick Start

This is a beta variant of the workspace template. It inherits from `templates/common` and includes variant-specific customizations.

### For Claude Code users:

See `CLAUDE.md` for detailed instructions.

### For Gemini CLI users:

See `GEMINI.md` for detailed instructions.

## Team Mission

**Mission:** EHS (Environmental Health & Safety) AI Agent platform for South Korea regulatory compliance

## Meet the AI Team

Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.

| Agent | Role | Tier | Model |
|-------|------|------|-------|
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

## Skills

- **compliance-gap**: 
- **permit-to-work**: 
- **risk-assessment**: 
- **emergency-response**: 

## How to Collaborate

Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:

### A. The PM Gateway

Always start your requests by talking to the **PM**. Do not invoke specialist agents directly. The PM will analyze your request and bring in the right experts.

### B. Standard Workflow Phases

1. **Team Assembly:** The PM creates specialized agents/skills if required.
2. **Triage:** The PM classifies the request; dispatches read-only agents in parallel.
3. **Analysis:** The PM synthesizes findings into requirements + acceptance criteria.
4. **Design:** An architect produces an implementation plan + ADR.
5. **Implementation:** Specialists implement; the PM loops up to 3× on failures.
6. **Finalization:** The PM logs decisions; runs `/sync`; opens a PR.

### C. Available Commands

Our daily operations are driven by slash commands (registered as Skills by Claude Code and Gemini CLI):

- `/sync "feat: ..."` — Full pipeline: memlog → changelog → audit → commit → PR.
- `/changelog "..."` — Add an entry to `CHANGELOG.md`.
- `/memlog "summary"` — Append a summary to today's session log.
- `/meeting` — Run a structured, inline multi-agent discussion.

## Variant Type

**Type**: safety

This variant focuses on EHS / industrial-safety compliance — legal_basis-gated workflows, risk assessment, permit-to-work, emergency response, and regulatory audit trails.

> **⚠️ Beta variant** — not for production use.

- **Client Engagements**: 0/2 (see variant governance rules)
- **Beta Duration**: 0/3 months
- **Additional Checks**: Pending

See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.

---

*Last Updated: 2026-08-27*
