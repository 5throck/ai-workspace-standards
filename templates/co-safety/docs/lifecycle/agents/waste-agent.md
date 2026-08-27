# Governance Record: waste-agent

Runtime definition: `agents/domains/industry/waste/waste-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/waste/waste-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/waste/` with `schema.yaml`: sewage-confined-h2s-prevent, incinerator-shredder-loto, tbm-pre-work-briefing (tree holds 5 scenario dirs incl. landfill-methane-anaerobic-explosion and designated-hazardous-chemical-treatment)
- [x] Domain skill `landfill-methane-anaerobic-explosion-planner` exists at `skills/domains/industry/waste/landfill-methane-anaerobic-explosion-planner/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/waste/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy; LOTO records additionally covered by the shared `evidence-models/_shared/loto-record.json` (minItems 3)
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("폐기물", "하수처리장", "황화수소", "소각로", "H2S asphyxiation")
- [x] Section A legal basis cites 폐기물관리법 Art 13/25 + 하수도법 Art 19/20 + a confined-space gas-measurement provision, with SAPA Art 4 as adjacent anchor; regulation metadata at `regulations/KR/Wastes-Control-Act.yaml` and `Sewerage-Act.yaml`
- [x] Confined-space citation attributed to 산업안전보건기준에 관한 규칙 (OSHSR) Article 618 in the runtime definition (verified: legal-glossary.yaml maps 제618조 to confined-space definitions under 안전보건기준에관한규칙; `.cache/legalize-kr/kr/산업안전보건기준에관한규칙/고용노동부령.md` L5471 confirms 제618조(정의) 밀폐공간 — citation now matches sibling shipbuilding-agent.md pattern; PL-6)
