# Governance Record: semicon-agent

Runtime definition: `agents/domains/industry/semicon/semicon-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/semicon/semicon-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 4 declared workflows exist under `workflows/domains/industry/semicon/` with `schema.yaml`: special-gas-handling, cleanroom-chemical-safety, semicon-scrubber-maintenance, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. silane-gas-leak-response)
- [x] Domain skill `pyrophoric-gas-emergency-responder` exists at `skills/domains/industry/semicon/pyrophoric-gas-emergency-responder/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/semicon/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("반도체", "디스플레이", "클린룸", "특수가스", "불산", "SiH4", "NF3")
- [x] Section A legal basis cites HPGSCA Art 13/17 (special gas) + CCA Art 20/23 (HF acid, 사고대비물질) + OSHA-KR Art 36/110, with SAPA Art 4 and SEMI S2/S8 as adjacent anchors; regulation metadata at `regulations/KR/High-Pressure-Gas-Safety.yaml` and `CCA-Chemical-Control.yaml`
