# Ticket-Run Skill — Lifecycle Record

## Metadata
- **Skill**: ticket-run
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-07-16 (Phase A ticket queue processing; record modernized 2026-09-26 from the legacy Phase-History format — no skill behavior change, T-20260926-024c)
- **Last Updated**: 2026-09-26 (record format modernized; retry-budget context added — ticket-store 1.3.0 DEFAULT_ATTEMPTS_CAP)

## Description
Pulls the next waiting service ticket from the Phase A ticket queue
(`bun scripts/ticket.ts next`) and executes its referenced skill or script,
then moves the ticket to `review` (success) or `failed` (retry budget
enforced by the store since helpers/ticket-store.ts 1.3.0). Backs the
`/ticket-run` command and the unattended runner ticket execution.
Workspace-root skill; `l2_propagate: false`. Owner: automation-engineer.

## Changelog
- 2026-09-26: record modernized (legacy Phase-History format → current Metadata format); no skill change
- 2026-07-16: 1.0.0 — created for Phase A ticket queue processing

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-16 | - | active | Created for Phase A ticket queue processing | pm |

## Dependencies
- Drives `scripts/ticket.ts` (next/move); governed by the ticket retry budget (helpers/ticket-store.ts 1.3.0)

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/ticket-run/SKILL.md`
- [x] Frontmatter valid; scope: workspace; l2_propagate: false
- [x] Registered in skills/SKILLS.md and docs/VERSION_MANIFEST.md
- [x] Retry-budget and state-machine transitions encoded (ticket-store 1.3.0+)
