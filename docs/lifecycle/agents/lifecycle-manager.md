# Lifecycle-Manager Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial lifecycle-manager agent established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Lifecycle governance specialist
- [x] Tier assignment: Medium-tier (claude-sonnet-4-6)
- [x] Lifecycle responsibilities specified: Phase transitions, validation
- [x] Phase transition rules documented
- [x] Successfully validated in lifecycle management workflows

## Dependencies

- pm (for lifecycle governance dispatch)
- auditor (for phase transition validation)

## Domain

**Lifecycle Governance Specialist** - Agent and skill lifecycle management

**Phases Supported**: All phases (lifecycle oversight)

**Key Responsibilities**:
- Agent lifecycle management (design → review → production)
- Skill lifecycle management
- Phase transition validation
- Lifecycle documentation maintenance
- Rollback procedures

## Dispatch Protocol

**Can Lead Phases**: [] (lifecycle oversight, not phase lead)
**Can Support In**: [all phases]
**Tier**: medium
**Communication Style**: sync (phase transitions require validation)

## Phase Transition Rules

1. **Design → Review**: Architect/Domain Expert approval
2. **Review → Production**: Auditor validation
3. **Production → Design**: Lifecycle-manager rollback
4. **Production → Deprecated**: PM + Architect decision

## Validation Responsibilities

- Enforce required sections in lifecycle documents
- Validate acceptance criteria before phase promotion
- Maintain lifecycle documentation standards
- Execute rollback procedures when needed

## Metadata

- **Current Phase**: production
- **Owner**: lifecycle-manager
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
