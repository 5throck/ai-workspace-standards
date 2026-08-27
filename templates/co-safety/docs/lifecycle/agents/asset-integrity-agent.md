# Governance Record: asset-integrity-agent

Runtime definition: `agents/_shared/asset-integrity-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/asset-integrity-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Scenario workflow tree exists: `workflows/domains/functional/asset-integrity/` holds 4 scenario dirs (aging-equipment-assessment, equipment-failure-analysis, preventive-maintenance-plan, statutory-inspection-scheduling), each with `schema.yaml`
- [x] Owned skill `asset-integrity-check` exists at `skills/daily/asset-integrity-check/SKILL.md` (AGENTS.md skills table, owner asset-integrity-agent)
- [x] Both evidence schemas in `evidence-models/domains/functional/asset-integrity/` (equipment-integrity-record.json, preventive-maintenance-record.json) enforce `legal_basis` `minItems: 3`; Section A cites OSHA-KR Art 38, Art 93, SAPA Art 4
- [x] LOTO handoff is schema-backed: `asset_integrity_trigger_ref` field exists in `evidence-models/domains/functional/psm/psm-loto-record.json`, and the reverse TAR "non-PSM equipment list" inbound handoff from industry agents (e.g. ehschem-agent) is documented
- [x] Section A regulation metadata references resolve (verified: Section A now cites `regulations/KR/OSHA-KR.yaml` / `regulations/KR/SAPA.yaml` — both exist on disk; stale `osha-kr.json`/`sapa.json` refs corrected, PL-6)
