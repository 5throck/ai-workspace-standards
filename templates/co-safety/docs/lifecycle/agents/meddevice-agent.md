# Governance Record: meddevice-agent

Runtime definition: `agents/domains/industry/meddevice/meddevice-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/meddevice/meddevice-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/meddevice/` holds 8 scenario dirs (design-control, kgmp-md-quality, sterilization-validation, device-risk-management, clinical-evaluation, device-labeling, device-pms, device-recall-reference), each with `README.md` + `schema.yaml`
- [x] Owned skill `iso14971-risk-scorer` exists at `skills/domains/industry/meddevice/iso14971-risk-scorer/SKILL.md` (AGENTS.md skills table, owner meddevice-agent); workforce/process risks explicitly routed away to risk-assessment-agent
- [x] All 7 evidence schemas in `evidence-models/domains/industry/meddevice/` enforce `legal_basis` `minItems: 3`; common fields (`device_class`, `kgmp_certification_status`, `iso_13485_compliance`, `iso_14971_risk_management`) documented for Class 1-4 scope
- [x] Section A legal basis anchored on 의료기기법 Art 12/16/20/23 + KGMP-MD 고시 (metadata at `regulations/KR/Medical-Device-Act.yaml`) with ISO 13485 / ISO 14971 / MDR / FDA QSR as multi-source anchors
- [x] Escalation and handoff chain defined: MFDS 위해사항 신고 events and KGMP-MD 부적합 판정 → immediate PM report; recall dispatch to emergency-agent via existing `device-recall-reference` workflow; biocompatibility testing → glp-agent, cleaning/disinfection chemicals → msds-agent
