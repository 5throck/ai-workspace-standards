# Governance Record: defense-agent

Runtime definition: `agents/domains/industry/defense/defense-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/defense/defense-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/defense/` with `schema.yaml`: explosive-propellant-handling, missile-cryogenic-high-pressure, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. munitions-storage-magazine-safety and weapons-assembly-composite-solvent)
- [x] Domain skill `munitions-magazine-storage-safety-planner` exists at `skills/domains/industry/defense/munitions-magazine-storage-safety-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/defense/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("방위산업", "화약", "추진제", "유도무기", "explosive", "propellant")
- [x] Section A legal basis cites FSESA Art 4 + 방위사업법 Art 28/53 (with corrected-article notes) + HPGSCA Art 13, with SAPA Art 4 as adjacent anchor; regulation metadata at `regulations/KR/Firearms-Swords-Explosives-Safety.yaml` and `Defense-Acquisition-Act.yaml`
