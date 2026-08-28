# Governance Record: safety-governance-manager

Runtime definition: `agents/safety-governance-manager.md`
Agent tier: High (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/safety-governance-manager.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Strategic-layer scope defined: SGM establishes standards (industry profiles, KPI targets, policies) and never executes operational workflows; dispatch restricted to PM-only
- [x] KPI definition catalog ownership verified: `docs/governance/kpi-definitions.md` exists as the declared single source of truth for KPI formulas, annual targets, and escalation thresholds
- [x] Content-accuracy mandate backed by existing artifacts: `policies/` and `industry-profiles/` directories exist as maintained write targets
- [x] Quarterly Regulatory Watch Protocol is concrete: re-validate `regulations/KR/*.yaml` via the `k-law` skill (법제처 Open API; replaced `legalize_kr` MCP, removed 2026-08-26), delegate live verification to compliance-agent's workflow pattern, log drift as FIND records under `memory/findings/`, and review staleness warnings from `scripts/co-safety/safety-audit.ts` (script exists)
- [x] Section A legal basis cites OSHA-KR Article 15 (safety and health management director), OSHA-KR Article 14 (management regulations), and SAPA safety-assurance duty — 3 statutory anchors
