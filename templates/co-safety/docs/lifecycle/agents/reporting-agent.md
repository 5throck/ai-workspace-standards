# Governance Record: reporting-agent

Runtime definition: `agents/_shared/reporting-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/reporting-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] KPI formulas defined with explicit constants: TRIR, LTIR, and Near-Miss Rate each documented as (incidents x 200,000) / total hours worked, with the 200,000-hour base explained (100 FTE x 40 h x 50 weeks)
- [x] Data sources specified: incident, training, audit, and near-miss logs ingested from `memory/` (runtime record directories `memory/findings/`, `memory/incidents/`, `memory/training/` exist); boundary excludes generating raw incident data
- [x] Board-reporting legal anchor cited: OSHA-KR Article 14 (safety and health plan board approval), Article 57 (incident recording/reporting), SAPA Article 4 — 3 statutory sources
- [x] Escalation thresholds concrete: LTIR above annual target (default > 1.0, site-configurable) → safety-governance-manager; TRIR exceeding industry average by >= 20% → PM
- [x] Strategic feedback loop closed: quarterly report findings hand off to `safety-governance-manager` for KPI target adjustment (SGM owns the KPI catalog at `docs/governance/kpi-definitions.md`)
