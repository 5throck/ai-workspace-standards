# Meeting Skill — Lifecycle Record

## Metadata
- **Skill**: meeting
- **Status**: retired
- **Version**: 1.4.0
- **Created**: 2026-09-04
- **Last Updated**: 2026-11-10
- **Successor**: `meeting-facilitation` (canonical meeting skill; `meeting` remains a trigger alias, not a skill directory)

## Description
Shortcut skill for `/meeting` — multi-agent meeting orchestration entry point
registered in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`.
Delegates to `meeting-facilitation`; back-synced from `.agents/skills/` per
the platform skills distribution policy.

## Changelog
- 2026-09-04: 1.4.0 — current version at lifecycle-record creation (history kept in `meeting-facilitation` record and CHANGELOG)
- 2026-11-10: Retirement cascade completed (T-20261109-003; Design Gate ruling DEC-20261110-01, spec `2026-11-10-meeting-lineage-hygiene-design`) — the 38 stale v1.4.3 `/meeting` command stubs (hash 893c8ca0) are deleted: the 3 `templates/co-architect` copies in the main PR (template-side absence is upstream truth; no template ships `meeting.md` anymore), and the 35 project copies across 12 repos via the enumerated per-repo sweep. Recurrence prevention is mechanical, with zero delivery-machinery change: structural pin `tests/unit/meeting-command-retirement.test.ts` fails any future sync that re-introduces a `meeting.md` command outside the whitelisted co-safety lineage. The co-safety lineage (`templates/co-safety` + `Projects/co-safety`, 329-line v1.5.0 command, hash 04b1ac07) is a DECLARED variant-maintained fork, not drift — evidence: co-safety `skills/SKILLS.md` row "inherited from common — customized fork (variant-maintained)", the `audit_exception: safety-os-skill-structure` stamp on its SKILL.md registration stubs, and co-safety AGENTS.md §6 command registration; its divergence from root v1.5.0 (the `docs/skill-graph.md` `version-drift` row) is adjudicated as the mechanical signature of that declared fork, not an unadjudicated reconciliation candidate.

## Dependencies
- Delegates to `meeting-facilitation`
- Synced via `scripts/sync-skills.ts` (Phase 2 back-sync)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-04 | - | production | Record created retrospectively; skill long active and registered | pm |
| 2026-09-09 | production | retired | Shortcut skill directory removed; `/meeting` delegates to `meeting-facilitation` | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/meeting/SKILL.md`
- [x] Registered in docs/VERSION_MANIFEST.md and platform command tables
- [x] Version parity with meeting-facilitation maintained

## Retirement

- **2026-09-09**: Retired 2026-09-09; superseded by `meeting-facilitation` as the active canonical skill.
