# Agent-Lifecycle-Manager Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for agent lifecycle management | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Agent lifecycle management
- [x] Trigger conditions: When agent status/tier changes
- [x] Examples provided: Agent creation, modification, deprecation workflows
- [x] Successfully tested in agent lifecycle operations

## Dependencies

- lifecycle-manager (owner agent)
- doc/lifecycle/README.md (governance reference)

## Usage Statistics

- **First Used**: 2026-05-15 (estimated)
- **Last Used**: 2026-05-28 (estimated)
- **Total Invocations**: ~15 (estimated)

## Metadata

- **Current Phase**: production
- **Owner**: pm
- **Version**: 1.3.1
- **Last Updated**: 2026-10-27 (v1.3.1 — Tier surfaces reworded to the ADR-0102 scalar form; schema `agent_tiers` references removed (T-20261026-018 PR-1))
- **Last Reviewer**: lifecycle-manager

## Changelog

- **1.3.1** (2026-10-27): tier surfaces reworded to the ADR-0102 scalar declaration form (Step 2 frontmatter example, "Changing an Agent's Tier" order, Check F descriptions) — schema `agent_tiers` removed per DEC-20261026-03 ruling 2 (T-20261026-018 PR-1).
- **1.3.0** (2026-09-21): lifecycle modernization per 2026-09-21-agent-skill-lifecycle-modernization-design — H5 creates the agent lifecycle record + regenerates derived artifacts, F4 schedules removal_review (deprecation + 90 days), F5 prose checks promoted to enforced audit checks (13/14), DEC validator invocation explicit.
