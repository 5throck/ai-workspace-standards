# Governance Record: gasterm-agent

Runtime definition: `agents/domains/industry/gasterm/gasterm-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/gasterm/gasterm-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/gasterm/` holds 13 scenario dirs (tank-storage-management, tank-inspection-maintenance, gas-leak-detection-response, gas-emergency-preparedness, hazardous-zone-management, charging-operation-safety, pipe-transfer-management, major-gas-incident-reference, construction-permit-overview, pre-construction-technical-review, mid-construction-inspection, completion-inspection, tbm-pre-work-briefing), 12 of 13 with `README.md`, all with `schema.yaml`
- [x] All 6 owned skills exist under `skills/domains/industry/gasterm/`: `gas-dispersion-analyzer`, `tank-integrity-validator`, `construction-permit-overview`, `pre-construction-technical-review`, `mid-construction-inspection`, `completion-inspection` — the permit-chain skills matching the documented 3-phase KGS inspection sequence (사전기술검토 → 중간검사 → 완성검사)
- [x] All 11 evidence schemas in `evidence-models/domains/industry/gasterm/` enforce `legal_basis` `minItems: 3`; common fields (`facility_type`, `kgs_inspection_status`, `psm_applicable`, `gas_type`) documented
- [x] Section A legal basis resolves to on-disk metadata: 고압가스안전관리법 (`High-Pressure-Gas-Safety.yaml`), LPG법 (`LPG-Safety-Business.yaml`), 도시가스사업법 (`City-Gas-Business.yaml`), 수소법 (`Hydrogen-Economy-Act.yaml`)
- [x] Escalation and handoff chain defined: LEL >= 25% detection → work stoppage + emergency-agent via `major-gas-incident-reference`; PSM overlap delegated to psm-agent; KGS 검사 불합격 → facility shutdown + PM report
