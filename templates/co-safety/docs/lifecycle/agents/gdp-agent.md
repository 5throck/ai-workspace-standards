# Governance Record: gdp-agent

Runtime definition: `agents/domains/industry/gdp/gdp-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/gdp/gdp-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/gdp/` holds 8 scenario dirs (goods-receipt, storage-management, temperature-monitoring, transportation, traceability-dts, returned-goods, gdp-self-inspection, product-recall-reference), each with `README.md` + `schema.yaml`
- [x] Both owned skills exist under `skills/domains/industry/gdp/`: `dts-verification` and `temperature-excursion-analyzer`, each with `SKILL.md`; the excursion-analysis step is wired into workflow pattern step 4
- [x] All 7 evidence schemas in `evidence-models/domains/industry/gdp/` enforce `legal_basis` `minItems: 3`; common fields (`gdp_certification_status`, `temperature_condition`, `batch_disposition_approved_ref`) documented
- [x] Section A legal basis resolves to on-disk metadata: 약사법 Art 43의2/43의3 + KGDP (`regulations/KR/MFDS-GDP.yaml`) and DTS tracking (`regulations/KR/DTS.yaml`)
- [x] Escalation and handoff chain defined: recall notification → emergency-agent via existing `product-recall-reference` workflow; DTS mismatch (counterfeit suspicion) → immediate escalation; manufacturing-rooted deviations → gmp-agent (`deviation_source: manufacturing`)
