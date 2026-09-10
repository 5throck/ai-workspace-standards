# Simulate-Project-Creation Skill Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial skill established for project creation simulation | lifecycle-manager |
| 2026-09-09 | production | retired | Skill directory removed; project-creation simulation merged into `simulate-pipeline` | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Skill purpose clearly defined: Test project scaffolding without git operations
- [x] Trigger conditions: When testing new project templates
- [x] Examples provided: Dry-run project creation, template validation
- [x] Successfully tested in simulation scenarios

## Dependencies

- scaffolding-expert (owner agent)
- pm (orchestrator)

## Usage Statistics

- **First Used**: 2026-05-15 (estimated)
- **Last Used**: 2026-05-25 (estimated)
- **Total Invocations**: ~5 (estimated)

## Metadata

- **Current Phase**: retired
- **Owner**: scaffolding-expert
- **Last Updated**: 2026-09-10
- **Last Reviewer**: lifecycle-manager
- **Successor**: `simulate-pipeline` (merged smoke-test skill for project creation and L3→variant promotion modes)

## Retirement

- **2026-09-09**: Retired 2026-09-09; superseded by `simulate-pipeline` as the active canonical skill.
