# Governance Record: audit-agent

Runtime definition: `agents/_shared/audit-agent.md`
Agent tier: Medium (claude / gemini-cli / antigravity per runtime frontmatter)

## Phase History

| Date | Phase | Notes |
|------|-------|-------|
| 2026-08-19 | production | Governance record created retroactively during recursive agent-scan remediation (validate-agents.ts v1.1.0). |

## Acceptance Criteria

- [x] Runtime definition (`agents/_shared/audit-agent.md`) carries `lifecycle.phase` and `lifecycle.governance` frontmatter fields
- [x] Agent scope and responsibilities are documented in the runtime definition's Section A/B (or equivalent)
- [x] Agent is listed in `AGENTS.md` roster
- [x] Evidence schemas exist and enforce the multi-source policy: `evidence-models/_shared/base/finding.schema.json` (version 2.1.0) and `corrective-action.schema.json` (version 2.1.0) both carry `legal_basis` `minItems: 3`; FIND id pattern `^FIND-[0-9]{4}-[0-9]{4}$` matches the documented `FIND-YYYY-NNNN` convention
- [x] Record write targets exist: `memory/findings/` and `memory/corrective-actions/` directories are present; CA linkage rule (`CA.finding_id` MUST equal linked `FIND.id`) documented in workflow pattern
- [x] Schema-change governance defined: semver bump + migration script at `evidence-models/migrations/v<N>-to-v<N+1>.ts` required before merge; `evidence-models/migrations/` directory exists with README
- [x] Owned skill `audit-preparation` exists at `skills/daily/audit-preparation/SKILL.md` (AGENTS.md skills table, owner audit-agent)
- [x] Validation loop is executable: workflow pattern step 7 mandates `bun scripts/co-safety/safety-audit.ts` after each record batch (script present); severity escalation thresholds (Critical >= 1 → immediate PM; Major >= 3 → 24 h; Minor >= 10 → flagged) are explicit
