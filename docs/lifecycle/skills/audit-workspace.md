# Audit-Workspace Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for workspace auditing | lifecycle-manager |
| 2026-09-10 | production | deprecated | Superseded by standing `audit.ts` checks and the weekly health check (`project-review`); removal 2026-10-10 (PR #855) | pm |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Workspace consistency validation
- [x] Trigger conditions: Pre-commit, pre-push, manual audit requests
- [x] Examples provided: Audit execution, validation checks
- [x] Successfully tested in audit operations

## Dependencies

- auditor (owner agent)
- security-expert (secret scanning)

## Usage Statistics

- **First Used**: 2026-05-10 (estimated)
- **Last Used**: 2026-05-29 (current session)
- **Total Invocations**: ~50+ (estimated - runs on every commit)

## Metadata

- **Current Phase**: deprecated
- **Owner**: auditor
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
- **Removal Date**: 2026-10-10
