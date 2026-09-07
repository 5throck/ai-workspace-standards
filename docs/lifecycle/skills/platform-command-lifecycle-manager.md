# Platform-Command-Lifecycle-Manager Skill — Lifecycle Record

## Metadata
- **Skill**: platform-command-lifecycle-manager
- **Status**: active
- **Version**: 1.0.0
- **Created**: 2026-09-04
- **Last Updated**: 2026-09-04

## Description
Guides creation and lifecycle management of platform commands
(`.claude/commands/*.md`, `.gemini/commands/*.md`): frontmatter standards,
L0↔L1 propagation rules, parity validation via `scripts/validate-templates.ts`,
and AGENTS.md §8 lifecycle trigger bookkeeping.

## Changelog
- 2026-09-04: 1.0.0 — initial version

## Dependencies
- `scripts/validate-templates.ts` (parity checks)
- `scripts/sync-skills.ts` (distribution)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-04 | - | production | Created and validated in same cycle | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/platform-command-lifecycle-manager/SKILL.md`
- [x] Frontmatter valid; registered in docs/VERSION_MANIFEST.md
- [x] Command parity procedure verified against validate-templates.ts
