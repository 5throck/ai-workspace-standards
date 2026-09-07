# Source-Command-Commit-Push-PR Skill — Lifecycle Record

## Metadata
- **Skill**: source-command-commit-push-pr
- **Status**: active
- **Version**: 1.0.1
- **Created**: 2026-09-04
- **Last Updated**: 2026-09-04

## Description
Shortcut skill for `/commit-push-pr` registered in `.agents/skills/` and
back-synced to `.claude/skills/` and `.gemini/skills/`: stages workspace
changes, writes an English conventional commit message, pushes the branch, and
opens a PR — the lightweight alternative to the full `sync` pipeline.

## Changelog
- 2026-09-04: 1.0.1 — patch adjustment at lifecycle-record creation
- 2026-09-04: 1.0.0 — initial version

## Dependencies
- Composes with (lighter than) `sync`
- Back-synced via `scripts/sync-skills.ts` (Phase 2)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-04 | - | production | Created and validated in same cycle | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/source-command-commit-push-pr/SKILL.md`
- [x] Frontmatter valid; registered in docs/VERSION_MANIFEST.md
- [x] Registered in `.agents/skills.json` shortcut table (AGENTS.md §6)
