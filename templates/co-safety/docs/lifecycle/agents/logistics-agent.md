# Governance Record: logistics-agent

Runtime definition: `agents/domains/industry/logistics/logistics-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/logistics/logistics-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/logistics/` with `schema.yaml`: port-crane-agv-safety, cold-storage-refrigerant-safety, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. dangerous-cargo-handling and forklift-pedestrian-strike-prevention)
- [x] Domain skill `dangerous-cargo-handling-planner` exists at `skills/domains/industry/logistics/dangerous-cargo-handling-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/logistics/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("항만물류", "물류센터", "gantry crane", "AGV", "냉동창고", "항만안전특별법")
- [x] Section A legal basis cites 항만안전특별법 Art 4/8 + OSHA-KR Art 38/63 + HPGSCA Art 13 (ammonia/freon refrigerant), with SAPA Art 5 as adjacent anchor; regulation metadata at `regulations/KR/Port-Safety-Special-Act.yaml` and `High-Pressure-Gas-Safety.yaml`
