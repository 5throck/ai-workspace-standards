# Governance Record: pm

Runtime definition: `agents/_core/pm.md`
Agent tier: High (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_core/pm.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] PM is the single user-facing entry point: routing table directs Policy/KPI/Profile requests to SGM (strategic layer), workflow execution to SWM (operational layer), and emergency events to the Emergency Agent via documented direct-dispatch override (logged with timestamp and rationale)
- [x] Execution plan requirement defined: any dispatch of 2+ agents requires an execution plan table declaring Task/Agent/Tier/Model, with explicit `Agent(model:)` short-alias mapping rules (High=opus, Medium=sonnet, Low=haiku) to prevent silent model inheritance
- [x] Tier ceiling and platform-column governance principles documented — agent frontmatter declared authoritative over tier tables; no tier elevation permitted
- [x] Tool scope restricted: Write/Edit limited to `memory/*.md`, Bash read-only (`git status/diff/log`, `bun scripts/audit.ts`, `bun scripts/safety-audit.ts`); specialist work is delegated, never substituted
- [x] Section A legal basis cites SAPA safety-assurance duty and OSHA-KR responsible-personnel coordination obligations; disclaimer preserves final safety/legal responsibility with the user organization
