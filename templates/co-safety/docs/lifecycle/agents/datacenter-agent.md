# Governance Record: datacenter-agent

Runtime definition: `agents/domains/industry/datacenter/datacenter-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/datacenter/datacenter-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 4 declared workflows exist under `workflows/domains/industry/datacenter/` with `schema.yaml`: datacenter-ups-fire-safety, high-voltage-facility-safety, datacenter-fuel-tank-safety, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. rack-cabling-fall-protection)
- [x] Domain skill `rack-fall-protection-planner` exists at `skills/domains/industry/datacenter/rack-fall-protection-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/datacenter/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("데이터센터", "UPS", "수전설비", "고전압", "Arc Flash", "BCP")
- [x] Section A legal basis cites 전기안전관리법 Art 16/29 + 전기사업법 Art 65 + OSHA-KR Art 36/101, with SAPA Art 4 and IEEE 1584/NFPA 855 as adjacent anchors; regulation metadata at `regulations/KR/Electrical-Safety-Act.yaml` and `Electric-Utility-Act.yaml`
