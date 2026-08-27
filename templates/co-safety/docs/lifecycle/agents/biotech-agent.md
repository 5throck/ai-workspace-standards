# Governance Record: biotech-agent

Runtime definition: `agents/domains/industry/biotech/biotech-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/biotech/biotech-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/biotech/` with `schema.yaml`: bioreactor-sterilization-safety, lmo-biohazard-containment, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. biological-spill-response and BSL-lab-aerosol-control)
- [x] Domain skill `bsl-lab-aerosol-control-planner` exists at `skills/domains/industry/biotech/bsl-lab-aerosol-control-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/biotech/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("바이오 CDMO", "배양기", "LMO", "생물안전", "bioreactor", "BSL")
- [x] Section A legal basis cites LMO Act Art 22/24 + 약사법 Art 37 (KP-GMP) + OSHA-KR Art 38/39, with SAPA Art 4 as adjacent anchor
