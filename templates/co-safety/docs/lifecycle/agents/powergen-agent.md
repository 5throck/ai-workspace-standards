# Governance Record: powergen-agent

Runtime definition: `agents/domains/industry/powergen/powergen-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/powergen/powergen-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/powergen/` holds 9 scenario dirs (boiler-steam-system-safety, turbine-generator-maintenance, high-voltage-electrical-safety, electrical-major-incident-reference, fuel-handling-safety, ash-chemical-waste-management, power-plant-inspection, renewable-energy-facility-safety, tbm-pre-work-briefing), 8 of 9 with `README.md`, all with `schema.yaml`
- [x] Both owned skills exist under `skills/domains/industry/powergen/`: `arc-flash-analyzer` (IEEE 1584 incident energy / PPE categories) and `ess-fire-risk-assessor` (lithium-ion thermal runaway), each with `SKILL.md`
- [x] All 8 evidence schemas in `evidence-models/domains/industry/powergen/` enforce `legal_basis` `minItems: 3`; the 5 KPI measurement records named in Section B (turbine, high-voltage, renewable-facility, emergency-power, inspection) all exist among them
- [x] Section A legal basis resolves to on-disk metadata: 전기사업법 (`Electric-Utility-Act.yaml`), 전기안전관리법 (`Electrical-Safety-Act.yaml`), 신재생에너지법 (`Renewable-Energy-Act.yaml`); nuclear explicitly out of scope per 원자력 제외 note
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("발전소", "터빈", "보일러", "고압 전기", "ESS", "에너지저장"); arc-flash and ESS-fire escalations route to emergency-agent via existing `electrical-major-incident-reference` workflow
