# Governance Record: safety-workflow-manager

Runtime definition: `agents/safety-workflow-manager.md`
Agent tier: High (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/safety-workflow-manager.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Operational orchestrator scope defined: SWM selects workflows from the `workflows/` library, assembles agent teams dynamically, and routes completed outputs to the Audit Agent — dispatch restricted to PM-only with a structured context block (`industry`, `task_type`, `site_id`, `urgency`, `legal_basis`)
- [x] Workflow library it selects from exists: scenario trees under `workflows/domains/functional/`, `workflows/domains/industry/`, `workflows/daily/`, `workflows/emergency/`, and `workflows/_shared/tbm` are populated with README/schema artifacts
- [x] Harness prompt pattern is concrete: read workflow definition → identify required agents → parallel dispatch where dependency-safe → route outputs to Audit Agent for evidence filing
- [x] Completion-record target designated as `memory/workflows/YYYY-MM-DD-<workflow-id>.md` — verified: directory exists on disk with `.gitkeep` scaffold
- [x] Section A legal basis cites OSHA-KR Article 24 (safety and health committee), Article 36 (risk assessment), and Article 29 (worker training) — 3 statutory anchors
