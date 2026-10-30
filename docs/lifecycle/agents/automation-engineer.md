# Automation-Engineer Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial automation-engineer agent established | lifecycle-manager |
| 2026-09-29 | production | production | Tier-line model-ID literals dropped in agents/automation-engineer.md (commit 5b2778b8 — Claude High/Medium tiers → opus-5-5 / sonnet-5-5); record stamped (T-20260930-001) | lifecycle-manager |
| 2026-10-26 | production | production | Dispatch Protocol re-aligned to the agents/automation-engineer.md SSOT (Can Support In corrected to [1]); agents/automation-engineer.md frontmatter last_updated backfilled to the 2026-10-23 tier-sweep commit 72d75af8 (project review 2026-10-26 findings #4/#9, T-20261026-004) | lifecycle-manager |
| 2026-10-28 | production | production | Engine-day roster content changes (2026-10-28 commits); frontmatter last_updated backfilled per Check 11/F (agent-lifecycle-audit) | pm |

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
**Can Support In**: [1]
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
- **Last Updated**: 2026-10-28
- **Last Reviewer**: lifecycle-manager
