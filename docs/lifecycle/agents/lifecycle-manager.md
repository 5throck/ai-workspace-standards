# Lifecycle-Manager Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial lifecycle-manager agent established | lifecycle-manager |
| 2026-09-29 | production | production | Tier-line model-ID literals dropped in agents/lifecycle-manager.md (commit 5b2778b8 — Claude High/Medium tiers → opus-5-5 / sonnet-5-5); record stamped (T-20260930-001) | lifecycle-manager |
| 2026-10-11 | production | production | model-migration skill attached to the agent (workspace directive 2026-10-11: registry model-ID migrations via sync-model-registry.ts); frontmatter last_updated refreshed (T-20261011-015) | lifecycle-manager |
| 2026-10-26 | production | production | Body-text canon fix: Phase 6 (Finalization) references renumbered to Phase 5 (Lifecycle Finalization); last_updated bumped (project review 2026-10-26, DEC-20261026-01) | lifecycle-manager |
| 2026-10-26 | production | production | Dispatch Protocol re-aligned to the agents/lifecycle-manager.md SSOT (lead [6], support [5], async) (project review 2026-10-26 finding #4, T-20261026-004) | lifecycle-manager |
| 2026-10-27 | production | production | Check F wording updated to the ADR-0102 scalar form (frontmatter anchor, schema `agent_tiers` removed); last_updated bumped (T-20261026-018 PR-1) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Lifecycle governance specialist
- [x] Tier assignment: Medium-tier
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

**Can Lead Phases**: [6]
**Can Support In**: [5]
**Tier**: medium
**Communication Style**: async

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
- **Last Updated**: 2026-10-27
- **Last Reviewer**: lifecycle-manager
