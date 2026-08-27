# Governance Record: ehschem-agent

Runtime definition: `agents/domains/industry/ehschem/ehschem-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/ehschem/ehschem-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Industry-specific workflow tree exists: `workflows/domains/industry/ehschem/` holds 9 scenario dirs (plant-operation-safety, batch-process-safety, continuous-process-safety, chemical-storage-management, loading-unloading-safety, environmental-monitoring, turnaround-shutdown-planning, major-chemical-incident-reference, tbm-pre-work-briefing), 8 of 9 with `README.md`, all with `schema.yaml`
- [x] All 3 owned skills exist under `skills/domains/industry/ehschem/`: `environmental-compliance-checker`, `process-hazard-screening`, `tar-planning`, each with `SKILL.md`
- [x] All 6 evidence schemas in `evidence-models/domains/industry/ehschem/` enforce `legal_basis` `minItems: 3`; common fields (`plant_category`, `psm_applicable`, `environmental_permit_id`, `chemical_category`) documented
- [x] Matrix-model dispatch targets resolve to real artifacts: PSM → `functional/psm/` (15 elements), MSDS → `functional/msds/` (7 scenarios), Emergency → `emergency/` (major-chemical-incident-reference), TAR surge → `functional/contractor-safety/tar-contractor-surge-management/`, TAR health → `functional/occupational-health/tar-health-screening/`
- [x] Section A multi-source policy cites OSHA-KR Art 36/44 + CCA Art 20/23 + SAPA Art 3/4/7 (+ 위험물안전관리법, 대기/수질 환경법, K-REACH); PM-gate trigger list includes "turnaround", "TAR", and TBM triggers
