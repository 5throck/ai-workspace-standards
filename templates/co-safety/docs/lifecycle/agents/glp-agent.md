# Governance Record: glp-agent

Runtime definition: `agents/domains/industry/glp/glp-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/glp/glp-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/glp/` holds 8 scenario dirs (study-protocol, test-article-management, study-conduct, data-management, personnel-qualification, equipment-calibration, qau-inspection, study-inspection-reference), each with `README.md` + `schema.yaml`
- [x] Both owned skills exist under `skills/domains/industry/glp/`: `glp-data-integrity-checker` and `glp-study-protocol-validator`, each with `SKILL.md`
- [x] All 7 evidence schemas in `evidence-models/domains/industry/glp/` enforce `legal_basis` `minItems: 3`; common fields (`glp_certification_authority`, `oecd_mad_applicable`, `study_director_id`, `msds_record_ref`) documented
- [x] Section A legal basis resolves to on-disk metadata: MFDS GLP (`regulations/KR/MFDS-GLP.yaml`), ME/K-REACH GLP (`regulations/KR/ME-KREACH-GLP.yaml`), OECD GLP Principles for MAD (`regulations/international/OECD-GLP.yaml`)
- [x] QAU role note preserves organizational independence (agent supports inspections/audit trail but does not replace the facility QAU per OECD GLP Section 3); data-integrity breaches and QAU critical findings escalate to PM; test-article chemical queries hand off to msds-agent
