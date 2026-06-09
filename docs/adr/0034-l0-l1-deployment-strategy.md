# ADR-0034: L0→L1 Deployment Strategy

## Metadata

- **Status**: Proposed
- **Type**: Operational
- **Created**: 2026-06-09
- **Deciders**: architect, docs-writer, lifecycle-manager
- **Related**: ADR-0029 (L0-L2 Workspace Design), ADR-0030 (Agent Lifecycle Management)

## Context

The workspace uses an L0-L2 deployment model where:
- **L0** (workspace root) contains authoritative governance, PM orchestration, and cross-cutting concerns
- **L1** (templates/common) contains shared platform configuration templates
- **L2** (variant projects) contains project-specific instantiations

Current manual L0→L1 deployment process has issues:
- L0-specific content (governance, orchestration, lifecycle management) leaks into L1 templates
- Manual sync is error-prone and inconsistent
- No automated verification of L0 leakage
- Section filtering rules are ad-hoc and poorly documented
- Risk of contaminating variant projects with workspace-root-specific logic

## Problem Statement

How do we automatically deploy L0 configuration files to L1 templates while ensuring:
1. L0-specific content is removed before deployment
2. Consistent section filtering across all deployments
3. Automated verification that L0 leakage hasn't occurred
4. Safe rollback capability if deployment fails
5. Clear separation between workspace orchestration and platform templates

## Decision

Implement automatic L0→L1 deployment via `deploy-to-l1.ts` script with comprehensive section filtering and verification.

### Deployment Scope

**Files subject to L0→L1 deployment**:
- `CLAUDE.md` (workspace root → `templates/common/CLAUDE.md`)
- `GEMINI.md` (workspace root → `templates/common/GEMINI.md`)
- `agents/pm.md` (workspace root → `templates/common/agents/pm.md`)

### Section Filtering Rules

#### 1. Remove from L0 Before Deploying

**CLAUDE.md sections to remove**:
- **§5 — Agent Dispatch Rules** (entire section)
- **§20 — Native Sub-agents (Agent Tool)** (entire section)
- **§7 — Native Plan Mode (EnterPlanMode)** (entire section)
- **§8 — Task Tracking (TaskCreate/TaskUpdate)** (entire section)
- **§9 — Workspace & Template Boundary Policy** (entire section)
- **§10 — Custom Command Error Recovery** (entire section)
- **§12 — Windows Platform Requirement** (entire section)
- Any L0→L1→L2 deployment strategy references
- Lifecycle Management Rules details (scripts/.ts, templates/, agents/*.md sync)
- Execution Plan Boilerplate detailed content

**GEMINI.md sections to remove**:
- Parallel sections to CLAUDE.md where applicable
- L0-specific hook implementations
- Workspace-root-specific git configurations

**agents/pm.md sections to remove**:
- L0→L1→L2 deployment orchestration logic
- Workspace lifecycle management responsibilities
- Template boundary enforcement mechanisms

#### 2. Change References

**CONSTITUTION.md references**:
- Change all `CONSTITUTION.md` references to `templates/common/docs/context.md`
- Example: `See [CONSTITUTION.md §5]` → `See [templates/common/docs/context.md §5]`

**AGENTS.md references**:
- Keep AGENTS.md references unchanged (shared resource)
- Ensure path references work from L1 context

**Path references**:
- Update any `agents/<name>.md` references to account for L1 location
- Update any `scripts/` references if they reference workspace-root scripts

#### 3. Preserve in L1

**Agent-specific platform behaviors** (CLAUDE.md §1, GEMINI.md §1):
- Platform-specific hook implementations
- Native command registrations
- Tool mappings and platform-specific features

**Native commands and skills** (CLAUDE.md §2, GEMINI.md §2):
- Slash command definitions
- Skill resolution priority rules
- MCP configurations

**Git & PR additions** (CLAUDE.md §13, GEMINI.md §13):
- Platform-specific git workflow additions
- PR language policies
- Commit protection rules

### Script Requirements

**Core functionality**:
```typescript
// scripts/deploy-to-l1.ts
interface DeploymentConfig {
  sourceFiles: string[];        // CLAUDE.md, GEMINI.md, pm.md
  targetDir: string;            // templates/common/
  sectionsToRemove: Section[];
  referenceChanges: ReferenceMap[];
  dryRun: boolean;
  createBackup: boolean;
  verifyAfterDeploy: boolean;
}
```

**Required features**:
1. **Dry-run mode**: Preview changes without writing files
2. **Section filtering**: Remove L0-specific sections per filtering rules
3. **Reference transformation**: Update CONSTITUTION.md → templates/common/docs/context.md
4. **File permission preservation**: Maintain executable permissions on .sh scripts
5. **Backup creation**: Create timestamped backups before deployment
6. **Automatic audit.ts execution**: Run verification after deployment
7. **Rollback capability**: Restore from backup if deployment fails
8. **L0 leakage check**: Verify no L0-specific content remains in deployed files

**Verification steps**:
1. Run `bun scripts/audit.ts` before deployment (establish baseline)
2. Deploy with `--dry-run` mode and preview changes
3. Review diff output and confirm section filtering
4. Execute actual deployment with `--execute`
5. Run `bun scripts/audit.ts` after deployment (verify compliance)
6. Check L0 leakage check passes (no L0-specific sections detected)

### Usage Examples

**Dry-run deployment**:
```bash
bun scripts/deploy-to-l1.ts --dry-run
```

**Execute deployment**:
```bash
bun scripts/deploy-to-l1.ts --execute
```

**Rollback deployment**:
```bash
bun scripts/deploy-to-l1.ts --rollback <backup-timestamp>
```

**Verification only** (no deployment):
```bash
bun scripts/deploy-to-l1.ts --verify-only
```

## Consequences

### Positive

- **Automated L0→L1 sync**: Eliminates manual copy-paste errors
- **Consistent section filtering**: Same rules applied across all deployments
- **Automatic L0 leakage verification**: Audit.ts validates no L0 content leaked
- **Reduced manual errors**: Script enforces filtering rules consistently
- **Rollback capability**: Safe recovery if deployment introduces issues
- **Clear audit trail**: Backups and dry-run mode provide visibility
- **Versioned deployments**: Timestamped backups enable rollback to any state

### Negative

- **Additional script maintenance**: Filtering rules must be kept in sync with L0 changes
- **Complexity overhead**: Need to maintain section removal rules and reference transformations
- **Potential for false negatives**: L0 leakage check may miss edge cases
- **Testing requirement**: Script must be tested with each L0 file change

### Mitigation

- **Comprehensive dry-run mode**: Always preview changes before execution
- **Audit verification**: Automated audit.ts checks catch most issues
- **Rollback capability**: Immediate recovery if deployment fails
- **Regular filtering rule review**: Update section removal rules as L0 evolves
- **Integration test coverage**: Test script with sample L0 files in CI/CD
- **Documentation maintenance**: Keep ADR in sync with script implementation

## Implementation Plan

### Phase 1: Script Development
1. Create `scripts/deploy-to-l1.ts` with core deployment logic
2. Implement section filtering functions for CLAUDE.md, GEMINI.md, pm.md
3. Add reference transformation (CONSTITUTION.md → templates/common/docs/context.md)
4. Implement dry-run mode with diff output

### Phase 2: Safety Features
1. Add backup creation functionality
2. Implement rollback capability
3. Add automatic audit.ts execution after deployment
4. Implement L0 leakage check verification

### Phase 3: Testing & Validation
1. Test dry-run mode with current L0 files
2. Execute test deployment to temporary location
3. Verify audit.ts passes after deployment
4. Test rollback functionality
5. Validate section filtering correctness

### Phase 4: Integration & Documentation
1. Add script to SCRIPTS.md
2. Update AGENTS.md lifecycle-manager responsibilities
3. Document usage examples in README
4. Create runbook for L0→L1 deployment process

## Alternatives Considered

### Alternative 1: Manual Deployment with Checklist
**Pros**: Simple, no script maintenance
**Cons**: Error-prone, inconsistent, no verification

**Rejected**: Manual process has already proven unreliable

### Alternative 2: Git Submodule Approach
**Pros**: Native git versioning, automatic sync
**Cons**: Complexity overhead, submodule management overhead, mixed with template concerns

**Rejected**: Adds unnecessary complexity for 3 files

### Alternative 3: Pre-commit Hook for Auto-Deployment
**Pros**: Automatic deployment on L0 changes
**Cons**: Risk of unintended deployments, difficult to control timing

**Rejected**: Deployment should be explicit, not automatic

## References

- [ADR-0029: L0-L2 Workspace Design](0029-l0-l2-workspace-design.md)
- [ADR-0030: Agent Lifecycle Management](0030-agent-lifecycle-management.md)
- [CONSTITUTION.md §9: Workspace & Template Boundary Policy](../../CONSTITUTION.md#9-workspace--template-boundary-policy)
- [CONSTITUTION.md §10: Lifecycle Management Rules](../../CONSTITUTION.md#10-lifecycle-management-rules)

## Changelog

- 2026-06-09: Initial ADR creation from L0→L1 Deployment Design Meeting
