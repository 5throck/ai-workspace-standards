# Governance Record: battery-agent

Runtime definition: `agents/domains/industry/battery/battery-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/battery/battery-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/battery/` with `schema.yaml`: battery-thermal-runaway-prevent, battery-recycling-hazard-control, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. battery-cathode-powder-dust-control and battery-cell-formation-electrical-safety)
- [x] Domain skill `hv-cell-formation-electrical-safety-planner` exists at `skills/domains/industry/battery/hv-cell-formation-electrical-safety-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/battery/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("이차전지", "배터리", "열폭주", "NMP", "thermal runaway", "recycling")
- [x] Section A legal basis cites DSSMA Art 5/27 + CCA Art 20/23 + OSHA-KR Art 36/110, with SAPA Art 4 and NFPA 855 as adjacent anchors
