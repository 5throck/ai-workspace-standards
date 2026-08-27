# Governance Record: msds-agent

Runtime definition: `agents/domains/functional/msds/msds-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/functional/msds/msds-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/functional/msds/` holds 7 scenario dirs (msds-intake, ghs-classification, chemical-approval, chemical-inventory, kreach-registration, hazard-labeling, chemical-spill-reference), each with `README.md` + `schema.yaml`
- [x] All 3 owned skills exist: `msds-parser` (hybrid rule-based + ML fallback, with `rules/` reference data), `ghs-classifier`, and `chemical-risk-assessment` under `skills/domains/functional/msds/`, each with `SKILL.md`
- [x] All 6 evidence schemas in `evidence-models/domains/functional/msds/` enforce `legal_basis` `minItems: 3`; Section A cites OSHA-KR Arts 104 + 110-115 + 117-118 (2026-08-24 anchor correction — legacy Art 243 removed), K-REACH Art 10-14, and UN GHS Rev 9
- [x] Regulation metadata resolves: `regulations/KR/OSHA-KR-MSDS.yaml` and `regulations/KR/K-REACH.yaml` exist; records require `ghs_version: "rev9"`
- [x] Emergency handoff is workflow-backed: Section 6 spill data flows to emergency-agent via the existing `chemical-spill-reference` workflow; prohibited/permission-substance detections escalate to PM immediately
