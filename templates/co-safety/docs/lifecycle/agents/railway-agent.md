# Governance Record: railway-agent

Runtime definition: `agents/domains/industry/railway/railway-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/railway/railway-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/railway/` with `schema.yaml`: catenary-high-voltage-safety, rail-track-confined-maintenance, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. rolling-stock-maintenance-loto and bridge-viaduct-fall-prevention)
- [x] Domain skill `rolling-stock-maintenance-loto-planner` exists at `skills/domains/industry/railway/rolling-stock-maintenance-loto-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/railway/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("철도", "전차선", "25kV", "선로 정비", "catenary")
- [x] Section A legal basis cites 철도안전법 Art 45/48 + OSHA-KR Art 38/39 + 전기안전관리법 Art 16 (25kV electrification), with SAPA Art 4 as adjacent anchor; regulation metadata at `regulations/KR/Rail-Safety-Act.yaml` and `Electrical-Safety-Act.yaml`
