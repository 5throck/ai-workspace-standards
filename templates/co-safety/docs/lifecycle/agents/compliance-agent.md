# Governance Record: compliance-agent

Runtime definition: `agents/_shared/compliance-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/compliance-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Regulation sources it validates against exist: `regulations/KR/legal-glossary.yaml` (statute SSOT), `regulations/KR/OSHA-KR.yaml`, and `regulations/KR/SAPA.yaml` are present on disk
- [x] `workflows/compliance/` status is accurately documented: directory is reserved-by-design (README.md states gap analysis runs directly against the legal glossary and per-domain `legal_basis` citations, not a dedicated workflow file); any future `schema.yaml` there is audited for `legal_basis` `minItems >= 3` by `scripts/safety-audit.ts`
- [x] Gap-report output target exists: `memory/findings/` directory present; report naming convention `compliance-<date>-<id>.md` documented with Critical/Major/Minor categorization
- [x] Owned skill `compliance-gap` exists at `skills/daily/compliance-gap/SKILL.md` (AGENTS.md skills table, owner compliance-agent)
- [x] KPI hard gate is executable: Audit Pass Rate 100% tied to `bun scripts/safety-audit.ts` reporting 0 errors; live law verification via `kr_safety` MCP tools and the `k-law` skill (법제처 Open API; `legalize_kr` MCP removed 2026-08-26) mandated before article-number claims; boundaries exclude law interpretation (legal-agent), corrective-action ownership (audit-agent), and audit dossiers (audit-agent)
