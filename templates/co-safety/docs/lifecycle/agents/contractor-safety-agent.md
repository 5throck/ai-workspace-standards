# Governance Record: contractor-safety-agent

Runtime definition: `agents/_shared/contractor-safety-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/contractor-safety-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] TAR surge workflow exists: `workflows/domains/functional/contractor-safety/tar-contractor-surge-management/` carries both `README.md` and `schema.yaml`, with a matching evidence schema at `evidence-models/domains/functional/contractor-safety/contractor-tar-surge-record.json` enforcing `legal_basis` `minItems: 3`
- [x] Owned skill `contractor-onboarding` exists at `skills/daily/contractor-onboarding/SKILL.md` (AGENTS.md skills table, owner contractor-safety-agent)
- [x] PTW escalation path is real: high-risk work without valid PTW escalates to PM, and the referenced permit-to-work workflow exists at `workflows/daily/manufacturing/permit-to-work/`
- [x] Cross-domain handoffs documented: training handoff to `training-agent` (uncertified contractor personnel); inbound TAR coordination with industry agents (e.g. ehschem-agent) via the tar-contractor-surge-management workflow
- [x] Section A regulation metadata references resolve (verified: Section A now cites `regulations/KR/OSHA-KR.yaml` / `regulations/KR/SAPA.yaml` — both exist on disk; stale `osha-kr.json`/`sapa.json` refs corrected, PL-6)
