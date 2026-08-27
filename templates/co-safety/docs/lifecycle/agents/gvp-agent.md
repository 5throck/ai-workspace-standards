# Governance Record: gvp-agent

Runtime definition: `agents/domains/industry/gvp/gvp-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/gvp/gvp-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/gvp/` holds 8 scenario dirs (icsr-intake, signal-detection, pbrer-generation, risk-management-plan, pms-study-management, benefit-risk-assessment, labeling-update, urgent-safety-action-reference), each with `README.md` + `schema.yaml`
- [x] Both owned skills exist under `skills/domains/industry/gvp/`: `signal-detector` (PRR/ROR/BCPNN/EBGM disproportionality methods) and `benefit-risk-assessor` (EU GVP Module 12 frameworks), each with `SKILL.md`
- [x] All 7 evidence schemas in `evidence-models/domains/industry/gvp/` enforce `legal_basis` `minItems: 3`; common fields (`ich_e2_compliance`, `pbrer_cycle_ref`, `product_id`, `rmp_version_ref`) documented
- [x] Section A legal basis resolves to on-disk metadata: 약사법 Art 73의2/73의3 + KGVP 고시 (`regulations/KR/MFDS-GVP.yaml`) with ICH E2 series (`regulations/international/ICH-E2.yaml`) and EU GVP as multi-source anchors
- [x] Escalation and handoff chain defined: urgent safety signals / fatal pattern clusters → PM immediately; recall/restriction dispatch to emergency-agent via existing `urgent-safety-action-reference` workflow; cross-domain correlation with gcp/gmp/gdp documented
