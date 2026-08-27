# Governance Record: food-agent

Runtime definition: `agents/domains/industry/food/food-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/food/food-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 4 declared workflows exist under `workflows/domains/industry/food/` with `schema.yaml`: haccp-ccp-monitoring, food-mixer-loto, food-allergen-control, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. thermal-hazard-control)
- [x] Domain skill `thermal-burn-prevention-planner` exists at `skills/domains/industry/food/thermal-burn-prevention-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/food/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy; mixer LOTO records additionally covered by the shared `evidence-models/_shared/loto-record.json` (minItems 3)
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("식품", "HACCP", "CCP", "mixer LOTO", "식품위생법")
- [x] Section A legal basis cites 식품위생법 Art 48 + MFDS HACCP 고시 + OSHA-KR Art 36/92, with SAPA Art 4 and Codex HACCP Annex as adjacent anchors; regulation metadata at `regulations/KR/Food-Sanitation-Act.yaml`
