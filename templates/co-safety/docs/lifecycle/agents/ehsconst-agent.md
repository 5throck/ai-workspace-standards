# Governance Record: ehsconst-agent

Runtime definition: `agents/domains/industry/ehsconst/ehsconst-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/ehsconst/ehsconst-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/ehsconst/` holds 9 scenario dirs (safety-management-plan, daily-safety-inspection, fall-prevention, collapse-prevention, permit-to-work-construction, safety-supervision, subcontractor-management, sapa-serious-accident-reference, tbm-tool-box-meeting), each with `README.md` + `schema.yaml`
- [x] All 9 evidence schemas in `evidence-models/domains/industry/ehsconst/` enforce `legal_basis` `minItems: 3`; the 5 KPI measurement records named in Section B (safety-plan, inspection, fall-prevention, tbm, safety-budget) all exist among them
- [x] Both owned skills exist under `skills/domains/industry/ehsconst/`: `fall-hazard-assessor` and `safety-inspection-validator`, each with `SKILL.md`
- [x] SAPA compliance mechanics defined: records carry `sapa_article_5_compliance`, `project_id`, `contractor_tier`, `safety_officer_in_charge`; 중대재해 escalation to emergency-agent routes via the existing `sapa-serious-accident-reference` workflow
- [x] Section A legal basis spans OSHA-KR construction provisions (Art 15/17/36/98-103), SAPA Art 3/5/7/12/13, 건설산업기본법 Art 45/83, and 건설기술진흥법 — backed by `regulations/KR/OSHA-KR-Construction.yaml`, `SAPA-Construction.yaml`, and related metadata files on disk
