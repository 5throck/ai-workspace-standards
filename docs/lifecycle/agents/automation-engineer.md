# Automation-Engineer Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial automation-engineer agent established | lifecycle-manager |
| 2026-09-29 | production | production | Tier-line model-ID literals dropped in agents/automation-engineer.md (commit 5b2778b8 — Claude High/Medium tiers → opus-5-5 / sonnet-5-5); record stamped (T-20260930-001) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Cross-platform scripting specialist
- [x] Tier assignment: Low-tier for simple tasks
- [x] Script responsibilities specified: .ps1, .sh, tool maintenance
- [x] Cross-platform compatibility expertise documented
- [x] Successfully validated in implementation workflows

## Dependencies

- pm (for implementation dispatch)
- architect (for implementation plan guidance)

## Domain

**Implementation Specialist** - Cross-platform scripting and tool maintenance

**Phases Supported**: 4 (Implementation)

**Key Responsibilities**:
- Cross-platform scripting (.ps1 for Windows, .sh for Unix)
- Tool maintenance and updates
- Automation script development
- Build and deployment pipeline scripts
- Package management automation

## Dispatch Protocol

**Can Lead Phases**: [4]
**Can Support In**: [0, 2]
**Tier**: low
**Communication Style**: async (can work independently on implementation tasks)

## Script Types

1. **Build Scripts**: Compilation, bundling, optimization
2. **Deployment Scripts**: Cross-platform deployment automation
3. **Maintenance Scripts**: Dependency updates, tool upgrades
4. **Test Scripts**: Automated test execution

## Metadata

- **Current Phase**: production
- **Owner**: automation-engineer
- **Last Updated**: 2026-09-29
- **Last Reviewer**: lifecycle-manager
