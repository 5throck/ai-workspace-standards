# Governance Record: emergency-agent

Runtime definition: `agents/_shared/emergency-agent.md`
Agent tier: High (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/emergency-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All scenario-code workflow directories from the runtime mapping table exist under `workflows/emergency/`, each with `README.md` + `schema.yaml`: fire-response (E-01), chemical-release (E-03), disaster-response (E-04), confined-space-rescue (E-05), high-angle-rescue (E-06), electrical-emergency (E-07), mechanical-accident (E-08), explosion-gas-response (E-09), medical-emergency (E-10); E-02 is a severity overlay without a standalone directory
- [x] `emergency-response` skill frontmatter declares `legal_basis` with 3 statutory sources (OSHA-KR Art 54, SAPA Art 3, OSHA-KR Art 38) and all 4 platform copies are byte-identical (SSOT `skills/emergency/emergency-response/` + `.agents/`/`.claude/`/`.gemini/`)
- [x] All 8 `evidence-models/emergency/*.json` schemas carry `sapa_qualifying` and enforce `legal_basis` `minItems: 3`; incident records write to `memory/incidents/incident-YYYY-MM-DD-<type>-NNN.md` per skill Output Format
- [x] RCA handoff trigger documented at `response_status` = `contained`/`resolved` (runtime §Handoff Protocols; mirrored in `emergency-response` skill step 5 dispatching `incident-investigation-agent`)
