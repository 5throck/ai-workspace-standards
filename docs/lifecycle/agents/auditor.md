# Auditor Agent Lifecycle

## Created

2026-05-29

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-29 | - | production | Initial auditor agent established | lifecycle-manager |

## Acceptance Criteria

### Production Phase

- [x] Agent role clearly defined: Quality assurance and consistency validation
- [x] Tier assignment: Medium-tier (claude-sonnet-4-6)
- [x] QA responsibilities specified: Documentation validation, consistency checks
- [x] Independent QA execution documented
- [x] Maximum 2 iterations before PM escalation
- [x] Successfully validated in QA workflows

## Dependencies

- pm (for QA dispatch)
- All agents (for validation of their outputs)

## Domain

**Quality Assurance Specialist** - Independent validation and consistency checks

**Phases Supported**: 5 (QA)

**Key Responsibilities**:
- Documentation cross-validation
- Consistency checks across agents
- Workspace audit execution
- Quality gate enforcement
- Test execution and validation

## Dispatch Protocol

**Can Lead Phases**: [5]
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
- **Last Updated**: 2026-05-29
- **Last Reviewer**: lifecycle-manager
