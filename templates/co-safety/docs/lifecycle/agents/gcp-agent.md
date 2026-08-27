# Governance Record: gcp-agent

Runtime definition: `agents/domains/industry/gcp/gcp-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/gcp/gcp-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Full workflow tree exists: `workflows/domains/industry/gcp/` holds 8 scenario dirs (protocol-management, irb-review, informed-consent, participant-enrollment, monitoring-visits, sae-reporting, sae-reporting-reference, source-data-verification), each with `README.md` + `schema.yaml`
- [x] Both owned skills exist under `skills/domains/industry/gcp/`: `protocol-deviation-analyzer` and `sae-causality-assessor`, each with `SKILL.md`
- [x] All 7 evidence schemas in `evidence-models/domains/industry/gcp/` enforce `legal_basis` `minItems: 3`; common fields (`irb_approval_ref`, `ich_e6_compliance`, `protocol_ref`, `site_id`) documented
- [x] Section A legal basis resolves to on-disk metadata: 약사법 Art 69/73의2 + KGCP (`regulations/KR/MFDS-GCP.yaml`), 생명윤리법 (`Bioethics-and-Safety-Act.yaml`), ICH E6(R3) (`regulations/international/ICH-E6.yaml`)
- [x] Escalation and handoff chain defined: fatal SUSAR → MFDS 7-day notification; IRB rejection → enrollment halt; severe SAE dispatch to emergency-agent via existing `sae-reporting-reference` workflow; pre-clinical correlation → glp-agent, IMP quality → gmp-agent
