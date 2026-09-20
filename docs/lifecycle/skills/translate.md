# Translate Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/translate/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: translate, translation, localize, Korean translation
- [x] Successfully tested in translation operations

## Dependencies

- pm (owner agent)
- scripts/translate-readme.ts (underlying translation script)
- scripts/verify-readme-sync.ts (hash verification)
- scripts/readme-lifecycle-audit.ts (lifecycle audit)

## Usage Statistics

- **First Used**: 2026-05-30 (estimated, per lifecycle.created in frontmatter)
- **Last Used**: 2026-07-03 (current session)
- **Total Invocations**: ~10+ (estimated — used for README translation maintenance)

## Metadata

- **Current Phase**: production
- **Version**: 1.0.3
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: pm

## Changelog

- **1.0.2** (2026-09-21): patch bump — deliver accumulated template content that predated this version to the fleet (equal-version content drift measured 2026-09-21; upgrade-project 1.37 UPDATE delivery).
