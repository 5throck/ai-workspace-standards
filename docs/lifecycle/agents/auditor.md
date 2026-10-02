# Auditor Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial auditor agent established | lifecycle-manager |
| 2026-09-29 | production | production | Tier-line model-ID literals dropped in agents/auditor.md (commit 5b2778b8 — Claude High/Medium tiers → opus-5-5 / sonnet-5-5); record stamped (T-20260930-001) | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Quality assurance and consistency validation
- [x] Tier assignment: Medium-tier
- [x] QA responsibilities specified: Documentation validation, consistency checks
- [x] Independent QA execution documented
- [x] Maximum 2 iterations before PM escalation
- [x] Successfully validated in QA workflows

## Dependencies

- pm (for QA dispatch)
- All agents (for validation of their outputs)

## Domain

**Quality Assurance Specialist** - Independent validation and consistency checks

**Phases Supported**: 6 (Quality Assurance)

**Key Responsibilities**:
- Documentation cross-validation
- Consistency checks across agents
- Workspace audit execution
- Quality gate enforcement
- Test execution and validation

## Dispatch Protocol

**Can Lead Phases**: [6]
**Can Support In**: [0, 2, 6]
**Tier**: medium
**Communication Style**: sync (quality gates require verification)

## QA Scope

1. **Documentation Validation**:
   - Consistency across files
   - Completeness of documentation
   - Alignment with standards

2. **Code Validation**:
   - Test execution
   - Code quality checks
   - Security validation

3. **Workflow Validation**:
   - Agent output consistency
   - Process compliance
   - Acceptance criteria verification

## Iteration Policy

- **Max iterations**: 2 per review cycle
- **Escalation**: After 2 failed iterations, escalate to PM
- **Auto-fix**: Fix simple issues without escalation when possible

## Metadata

- **Current Phase**: production
- **Owner**: auditor
- **Last Updated**: 2026-10-01
- **Last Reviewer**: lifecycle-manager
