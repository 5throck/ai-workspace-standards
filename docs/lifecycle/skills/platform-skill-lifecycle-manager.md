# Platform-Skill-Lifecycle-Manager Skill — Lifecycle Record

## Metadata
- **Skill**: platform-skill-lifecycle-manager
- **Status**: active
- **Version**: 1.0.2
- **Created**: 2026-09-04
- **Last Updated**: 2026-09-04

## Description
Guides creation and lifecycle management of platform skills
(`.claude/skills/`, `.gemini/skills/`, `.agents/skills/`): SSOT-first flow
(create in `skills/`, distribute via `scripts/sync-skills.ts`), shortcut-skill
back-sync rules, version pinning, and AGENTS.md §8 lifecycle triggers.

## Changelog

- **1.0.2** (2026-09-21): patch bump — deliver accumulated template content to the fleet (equal-version content drift measured 2026-09-21; upgrade-project 1.37 UPDATE delivery).

- **1.0.1** (2026-09-21): patch bump — deliver accumulated template content that predated this version to the fleet (equal-version content drift measured 2026-09-21; upgrade-project 1.37 UPDATE delivery).
- 2026-09-04: 1.0.0 — initial version

## Dependencies
- `scripts/sync-skills.ts` (distribution and back-sync)
- `scripts/validate-skills.ts` (frontmatter validation)

## Phase History
| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-09-04 | - | production | Created and validated in same cycle | pm |

## Acceptance Criteria

### Active Phase
- [x] SKILL.md exists at `skills/platform-skill-lifecycle-manager/SKILL.md`
- [x] Frontmatter valid; registered in docs/VERSION_MANIFEST.md
- [x] SSOT-first distribution flow documented
