# Safety OS — User Guide

> **For**: Safety managers, EHS professionals, compliance officers
> **Architecture**: 2-Tier functional × industry matrix

## 1. Quick Start

```bash
# Install
bun install

# Verify system integrity
bun scripts/safety-audit.ts

# Run domain-specific tests
bun scripts/test-pharma-general-profile.ts          # GMP
bun scripts/test-chemical-handling-profile.ts       # MSDS
bun scripts/test-cross-domain-integration.ts        # Cross-domain
```

## 2. Finding Your Domain

### "I work in pharmaceuticals"
→ Functional domains: `gmp`, `gdp`, `glp`, `gcp`, `gvp` (5 lifecycle stages)

### "I work in a chemical plant"
→ Industry domain: `ehschem` (coordinator) + functional `psm`, `msds` (services)

### "I work in construction"
→ Industry domain: `ehsconst` (coordinator) + emergency services

### "I work at a gas terminal"
→ Industry domain: `gasterm` (coordinator) + functional `psm` (if large-scale), `msds`

### "I work at a power plant"
→ Industry domain: `powergen` (coordinator) + functional `psm` (LNG/boiler)

### "I manufacture medical devices"
→ Industry domain: `meddevice` (coordinator) + functional `msds`, `glp`

### "I work in food manufacturing or processing"
→ Industry domain: `food` (coordinator) + HACCP CCP & LOTO

### "I work in cosmetics manufacturing"
→ Industry domain: `cosmetics` (coordinator) + CGMP & ISO 22716

### "I work in semiconductor / display manufacturing"
→ Industry domain: `semicon` (coordinator) + special gas & cleanroom EHS

### "I work in battery manufacturing or recycling"
→ Industry domain: `battery` (coordinator) + thermal runaway & chemical safety

### "I work in shipbuilding or offshore engineering"
→ Industry domain: `shipbuilding` (coordinator) + tank confined space & Goliath crane

### "I work in steelmaking or metal smelting"
→ Industry domain: `steelmaking` (coordinator) + molten metal LOTO & CO gas safety

### "I operate data centers or IT infrastructure"
→ Industry domain: `datacenter` (coordinator) + UPS fire & high-voltage safety

### "I work in port logistics or warehouse operations"
→ Industry domain: `logistics` (coordinator) + crane lifting, AGV, & cold storage

### "I work in railway or metro transit infrastructure"
→ Industry domain: `railway` (coordinator) + 25kV catenary & track maintenance

### "I work in environmental waste or water treatment"
→ Industry domain: `waste` (coordinator) + sewage H2S asphyxiation & incinerator LOTO

### "I work in defense manufacturing or explosives"
→ Industry domain: `defense` (coordinator) + propellant ESD & missile cryogenic fuel

### "I work in biopharmaceutical CDMO or bio-labs"
→ Industry domain: `biotech` (coordinator) + bioreactor SIP & LMO biohazard

## 3. Dispatch Pattern

**Principle**: Your industry domain agent is your coordinator. It dispatches to functional services as needed.

```
You → Industry Agent → (directly handles OR dispatches to Functional Agent)
                     → (if emergency → Emergency Agent, bypassing SGM — see below)
```

### Emergency Dispatch

`emergency-agent` is dispatched directly by PM, bypassing the normal SGM/SWM chain, for speed. It classifies the report against 10 scenario codes (E-01–E-10) and activates the matching protocol under `workflows/emergency/`:

| Code | Scenario | Code | Scenario |
|------|----------|------|----------|
| E-01 | Fire / Explosion | E-06 | High-Angle Rescue |
| E-02 | Serious Accident (severity overlay, not a standalone protocol) | E-07 | Electrical Emergency |
| E-03 | Hazardous Chemical Release | E-08 | Mechanical Accident |
| E-04 | Natural Disaster (routed to `disaster-response-agent`) | E-09 | Gas Leak / Explosion (gas terminal) |
| E-05 | Confined Space Rescue | E-10 | Medical Emergency |

Once the incident reaches `response_status: contained`/`resolved`, `emergency-agent` hands off to `incident-investigation-agent` for root-cause analysis — see `agents/_shared/emergency-agent.md` §Handoff Protocols.

### Example: Chemical Plant Worker Safety Assessment

1. **You request**: "Perform risk assessment for new chemical handling task"
2. **ehschem-agent** receives request
3. ehschem dispatches to:
   - `functional/msds-agent` for chemical hazard data
   - `daily/risk-assessment` workflow for assessment
4. ehschem provides industry context (plant type, chemicals)
5. Evidence record generated

## 4. Workflow Structure

Each workflow has:
- `schema.yaml` — machine-readable metadata (legal_basis, agent, evidence_model)
- `README.md` — human-readable procedure

```
workflows/domains/industry/ehschem/plant-operation-safety/
├── schema.yaml
└── README.md
```

## 5. Evidence Records

All evidence is stored with ALCOA+ data integrity:
- Attributable (who)
- Legible (permanent)
- Contemporaneous (when)
- Original (first record)
- Accurate (error-free)
- + Complete, Consistent, Enduring, Available

Common fields across all evidence models:
- `e_signature` — electronic signature (v1 schema-only, v2 PKI/HSM)
- `nomenclature` — multilingual terminology (Korean + English)
- `audit_trail` — creation/modification history
- `legal_basis` — multi-source regulatory references (≥3)

## 6. Reference Workflows

Some workflows don't execute directly — they **dispatch** to another agent:

| Reference Workflow | Dispatches To | When |
|--------------------|--------------|------|
| chemical-spill-reference (MSDS) | emergency-agent | Chemical spill detected |
| product-recall-reference (GDP) | emergency-agent | Product recall needed |
| study-inspection-reference (GLP) | compliance-agent | Regulatory inspection |
| sae-reporting-reference (GCP) | emergency-agent | Severe adverse event |
| urgent-safety-action-reference (GVP) | emergency-agent | Urgent safety signal |
| sapa-serious-accident-reference (ehsconst) | emergency-agent | 중대재해 발생 |
| major-gas-incident-reference (gasterm) | emergency-agent | Major gas incident |
| electrical-major-incident-reference (powergen) | emergency-agent | Major electrical incident |
| major-chemical-incident-reference (ehschem) | emergency-agent | Major chemical incident |
| device-recall-reference (meddevice) | emergency-agent | Device recall/FSCA |

## 7. Governance & KPIs

The Safety Governance Manager (SGM) operates at the strategic layer — it defines policy and KPI targets that operational agents (SWM and specialist agents) execute against:

- **`policies/`** — approved safety policy documents (organization-wide standards, industry-profile-linked commitments). See `policies/README.md` for the naming convention and structure.
- **`docs/governance/kpi-definitions.md`** — current KPI set: **LTIFR** (Lost Time Injury Frequency Rate), **Audit Pass Rate** (from `bun scripts/safety-audit.ts` output), and **Corrective Action Closure Rate** (from `memory/corrective-actions/*.json` records). Each KPI definition includes its formula, data source, target threshold, and escalation trigger.
- **Traceability chain**: `memory/findings/FIND-YYYY-NNNN.json` → `memory/corrective-actions/CA-YYYY-NNNN.json`, conforming to `evidence-models/_shared/base/finding.schema.json` and `corrective-action.schema.json`.

## 8. Legal Disclaimer

> Safety OS provides workflow automation assistance only, not legal advice. All regulatory references must be verified by qualified EHS/GxP/legal professionals. The system does NOT make compliance decisions — it supports documentation and process management.
