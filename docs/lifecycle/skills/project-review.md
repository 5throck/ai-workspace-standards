# Project-Review Skill Lifecycle

## Created

2026-07-03

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-03 | - | production | Backfilled lifecycle record for existing production skill | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill SKILL.md exists at `skills/project-review/SKILL.md`
- [x] Frontmatter valid: name, description, status, scope, version, owner populated
- [x] Triggers defined: project review, review project, audit project, quality review
- [x] Successfully tested in project review operations

## Dependencies

- pm (owner agent)
- architect (architecture review domain)
- auditor (standards compliance review domain)
- automation-engineer (automation review domain)
- docs-writer (documentation review domain)
- security-expert / security-monitor (security review domain)
- lifecycle-manager (lifecycle review domain)
- scaffolding-expert (scaffolding review domain, workspace only)

## Usage Statistics

- **First Used**: 2026-05-30 (estimated, per last_reviewed)
- **Last Used**: 2026-07-03 (current session)
- **Total Invocations**: ~10+ (estimated — triggered by user request, PM detection, or QA escalation)

## Metadata

- **Current Phase**: production
- **Version**: 1.0.0
- **Owner**: pm
- **Last Updated**: 2026-07-03
- **Last Reviewer**: pm
