# Governance Record: shipbuilding-agent

Runtime definition: `agents/domains/industry/shipbuilding/shipbuilding-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/shipbuilding/shipbuilding-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/shipbuilding/` with `schema.yaml`: ship-tank-confined-space, heavy-crane-subcontractor-safety, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. painting-coating-fire-toxic and welding-fume-gas-safety)
- [x] Domain skill `painting-coating-fire-toxic-planner` exists at `skills/domains/industry/shipbuilding/painting-coating-fire-toxic-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/shipbuilding/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy; confined-space records additionally covered by the shared `evidence-models/_shared/confined-space-record.json` (minItems 3)
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("조선", "해양플랜트", "선박 탱크", "밀폐공간 질식", "골리앗 크레인"); repair/maintenance energy isolation explicitly delegated to the psm-agent `psm-loto` skill per 안전보건기준규칙 제92조
- [x] Section A legal basis cites OSHA-KR Art 38/39/63 + 안전보건기준규칙 Art 618/623 (confined space) + SAPA Art 5 (subcontractor), with OSHA 1915 as international benchmark
