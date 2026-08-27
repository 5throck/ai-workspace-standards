# Governance Record: steelmaking-agent

Runtime definition: `agents/domains/industry/steelmaking/steelmaking-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/steelmaking/steelmaking-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/steelmaking/` with `schema.yaml`: molten-metal-loto, byproduct-gas-leak-prevent, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. coke-oven-pah-heat-stress and hot-rolling-mill-crush-burn)
- [x] Domain skill `coke-oven-pah-heat-stress-planner` exists at `skills/domains/industry/steelmaking/coke-oven-pah-heat-stress-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/steelmaking/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy; LOTO records additionally covered by the shared `evidence-models/_shared/loto-record.json` (minItems 3)
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("철강", "제련", "용광로", "전기로", "용융물", "부생가스", "CO가스")
- [x] Section A legal basis cites OSHA-KR Art 36/38/92 (LOTO 운전정지) + HPGSCA Art 17 (byproduct CO/N2 gas) + SAPA Art 4, with KOSHA GUIDE Z-40-2022 as adjacent anchor
