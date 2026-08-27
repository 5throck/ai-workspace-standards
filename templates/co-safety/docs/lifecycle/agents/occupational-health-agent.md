# Governance Record: occupational-health-agent

Runtime definition: `agents/_shared/occupational-health-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/occupational-health-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] TAR health-screening workflow exists: `workflows/domains/functional/occupational-health/tar-health-screening/` carries both `README.md` and `schema.yaml`, with matching evidence schema `evidence-models/domains/functional/occupational-health/oh-tar-health-record.json` enforcing `legal_basis` `minItems: 3`
- [x] Cross-referenced TAR trigger is schema-backed: `pre_tar_risk_assessment` field exists in `evidence-models/domains/industry/ehschem/ehschem-turnaround-record.json`, and the declared MSDS data dependency (`evidence-models/domains/functional/msds/msds-record.json`) resolves
- [x] Section A legal basis cites OSHA-KR Article 125 (work environment measurement), Article 129/130 (general/special health examinations), and SAPA Article 4 — statutory anchors for every record's `legal_basis`
- [x] Role separation documented: substance data (OEL/toxicology) sourced from msds-agent; monitoring execution stays here; general safety hazards route to risk-assessment-agent; medical diagnosis excluded
- [x] Escalation and reporting handoffs defined: occupational disease (D1/D2) → PM + emergency-agent immediately; OEL exceedance → SWM for controls; compliance metrics forwarded to `reporting-agent` for the monthly EHS dashboard
