# Governance Record: incident-investigation-agent

Runtime definition: `agents/_shared/incident-investigation-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/incident-investigation-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] RCA workflow library exists: `workflows/domains/functional/incident-investigation/` holds 5 scenario dirs (five-why-rca, bow-tie-analysis, capa-management, incident-initial-report, lessons-learned-dissemination), each with `schema.yaml`
- [x] Evidence schemas exist and enforce the multi-source policy: all 3 schemas in `evidence-models/domains/functional/incident-investigation/` (incident-report-record, rca-record, capa-record) enforce `legal_basis` `minItems: 3`; Section A cites OSHA-KR Art 57, Art 155, SAPA Art 4
- [x] Owned skill `root-cause-analysis` exists at `skills/investigation/root-cause-analysis/SKILL.md` (AGENTS.md skills table, owner incident-investigation-agent)
- [x] Escalation/handoff chain documented: SAPA serious-accident classification escalates to legal-agent; completed RCA reports hand off to `audit-agent` for evidence validation; emergency response itself stays out of scope (emergency-agent boundary)
- [x] Section A regulation metadata references resolve (verified: Section A now cites `regulations/KR/OSHA-KR.yaml` / `regulations/KR/SAPA.yaml` — both exist on disk; stale `osha-kr.json`/`sapa.json` refs corrected, PL-6)
