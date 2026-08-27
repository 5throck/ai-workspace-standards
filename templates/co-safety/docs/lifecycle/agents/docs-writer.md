# Governance Record: docs-writer

Runtime definition: `agents/_shared/docs-writer.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/docs-writer.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Language-policy enforcement role is anchored in project governance: the Language Policy (Layer A English / translation zones `ko/`, `locales/<lang-code>/`, bilingual `docs/_shared/`) is codified in AGENTS.md and matches this agent's formatting mandate
- [x] Documentation-only boundary explicit: no modification of application logic, workflows, or scripts; no law interpretation or risk assessment — only faithful formatting of specialist output
- [x] `legal_basis` fidelity rule defined: must preserve specialist-provided legal citations unaltered; missing mandatory `legal_basis` (e.g. incident reports) escalates to PM (CSO)
- [x] Hand-off protocol routes completed documentation to `audit-agent` for final evidence traceability verification (audit-agent runtime definition exists)
- [x] KPIs are checkable: zero broken links in `docs/`, 100% language-policy adherence, zero altered/hallucinated citations
