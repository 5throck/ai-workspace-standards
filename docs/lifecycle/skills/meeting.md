# Meeting Skill — Lifecycle Record

## Metadata
- **Skill**: meeting
- **Status**: active
- **Version**: 1.4.0
- **Created**: 2026-09-04
- **Last Updated**: 2026-09-04

## Description
Shortcut skill for `/meeting` — multi-agent meeting orchestration entry point
registered in `.claude/commands/meeting.md` and `.gemini/commands/meeting.md`.
Delegates to `meeting-facilitation`; back-synced from `.agents/skills/` per
the platform skills distribution policy.

## Changelog
- 2026-09-04: 1.4.0 — current version at lifecycle-record creation (history kept in `meeting-facilitation` record and CHANGELOG)

## Dependencies
- Delegates to `meeting-facilitation`
- Synced via `scripts/sync-skills.ts` (Phase 2 back-sync)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-04 | - | production | Record created retrospectively; skill long active and registered | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/meeting/SKILL.md`
- [x] Registered in docs/VERSION_MANIFEST.md and platform command tables
- [x] Version parity with meeting-facilitation maintained

## Retirement

- **2026-09-09**: Retired 2026-09-09; superseded by `meeting-facilitation` as the active canonical skill.
