# Governance Record: gmp-agent

Runtime definition: `agents/domains/industry/gmp/gmp-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/gmp/gmp-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/gmp/` holds 10 scenario dirs (batch-mfg, change-control, cleaning-validation, csv-validation, deviation-capa, equipment-qualification, pqr, self-inspection, stability, supplier-qualification), each with `README.md` + `schema.yaml`
- [x] All 3 owned skills exist under `skills/domains/industry/gmp/`: `change-control`, `deviation-capa`, and `qrm` (ICH Q9 methodology applied across all GMP workflows), each with `SKILL.md`
- [x] All 11 evidence schemas in `evidence-models/domains/industry/gmp/` enforce `legal_basis` `minItems: 3`; required common fields (`e_signature`, `qrm_assessment`, `nomenclature`) documented; ALCOA+ data integrity mandated
- [x] Section A legal basis resolves to on-disk metadata: 약사법 Art 37 + 총리령 「의약품 등의 안전에 관한 규칙」 별표 1 (`regulations/KR/MFDS-GMP.yaml`) with ICH Q7/Q9/Q10 and PIC/S PE 009 as multi-source anchors
- [x] Role separation explicit: product quality/patient-safety risks only — EHS risk routes to risk-assessment-agent, process safety to psm-agent, worker-safety-imminent deviations to emergency-agent; critical deviations and missing legal_basis escalate to PM (CSO)
