# Governance Record: disaster-response-agent

Runtime definition: `agents/_shared/disaster-response-agent.md`
Agent tier: High (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/disaster-response-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Typhoon/flood and earthquake activation triggers defined in `workflows/emergency/disaster-response/README.md` §2 (outdoor work stoppage at wind speed ≥14 m/s; evacuation at seismic intensity ≥4; heavy-snow roof-load protocol)
- [x] MOIS coordination line present: Section C step 1 monitors weather advisories and MOIS alerts; MOIS named as enforcement agency alongside MOEL in Section A
- [x] Post-disaster `asset-integrity-agent` handoff documented in Section C Handoff Protocols (equipment and structural inspection before work resumes)
- [x] Inbound E-04 acceptance from `emergency-agent` documented in Section C Handoff Protocols, with return-handoff expectation back to `emergency-agent` post-stabilization
- [x] Evidence schema `evidence-models/emergency/emergency-disaster-record.json` carries `sapa_qualifying` and enforces `legal_basis` `minItems: 3`; workflow `schema.yaml` legal_basis lists 3 statutes (재난 및 안전관리 기본법, SAPA Art 4, OSHA-KR Art 54)
