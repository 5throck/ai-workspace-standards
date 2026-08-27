# Governance Record: cosmetics-agent

Runtime definition: `agents/domains/industry/cosmetics/cosmetics-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/domains/industry/cosmetics/cosmetics-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] All 3 declared workflows exist under `workflows/domains/industry/cosmetics/` with `schema.yaml`: cgmp-batch-release, cosmetics-safety-assessment, cosmetics-stability-testing (tree holds 6 scenario dirs incl. solvent-exposure-control and powder-dust-control)
- [x] Domain skill `cosmetics-solvent-exposure-monitor` exists at `skills/domains/industry/cosmetics/cosmetics-solvent-exposure-monitor/SKILL.md`
- [x] All 5 evidence schemas in `evidence-models/domains/industry/cosmetics/` enforce `legal_basis` `minItems: 3` per the Section A multi-source policy
- [x] PM Gateway Enforcement banner present in Section C with dispatch trigger list ("화장품", "CGMP", "ISO 22716", "batch release", "cosmetic ingredient")
- [x] Section A legal basis cites 화장품법 Art 5 + MFDS CGMP 고시 + ISO 22716, with OSHA-KR Art 36/110 and CCA Art 20 as adjacent anchors; regulation metadata at `regulations/KR/Cosmetics-Act.yaml`
