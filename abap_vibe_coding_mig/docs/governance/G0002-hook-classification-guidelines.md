# Governance Guidelines G0002: Hook Classification Guidelines

**Version**: 1.0
**Effective**: 2026-06-01
**Status**: Active
**Owner**: pm

## Purpose

This document provides criteria for classifying hooks as **PM-Managed (Critical)** or **Agent-Managed (Non-Critical)** to ensure consistent hook execution behavior across all agents.

## Classification Criteria

### PM-Managed Hooks (Critical)

**Definition**: Hooks whose failure blocks workflow progress and requires PM Gateway orchestration.

**Criteria**:
1. **Failure Impact**: Hook failure → workflow halt, rollback required
2. **Quality Gate**: Hook validates workspace compliance or system integrity
3. **Execution Model**: PM Gateway calls hook, logs execution in PM execution plan
4. **Fallback**: No fallback (if PM unavailable, workflow blocks)

**Examples**:

| Hook Name | Purpose | Why Critical |
|-----------|---------|--------------|
| `audit.ts` | Workspace compliance validation | Validates CLAUDE.md consistency, markdown links, file structure. Failure → governance violation |
| `vsp-sync.ps1` | SAP infrastructure synchronization | Syncs VSP WebSocket state with SAP system. Failure → ABAP execution blocked |
| `vsp-audit.ps1` | ABAP object validation | Validates ABAP syntax, naming conventions. Failure → defective code committed to SAP |

**Classification Checklist**:
- [ ] Does hook failure require workflow halt?
- [ ] Does hook validate compliance or integrity?
- [ ] Is hook execution visible in PM execution plan?
- [ ] Does hook have no fallback mechanism?

If **all answers are YES**, classify as **PM-Managed**.

---

### Agent-Managed Hooks (Non-Critical)

**Definition**: Hooks whose failure does not block workflow progress and agents manage autonomously.

**Criteria**:
1. **Failure Impact**: Hook failure → warning logged, workflow continues
2. **Cosmetic/Logging**: Hook updates cosmetic artifacts or logs session activity
3. **Execution Model**: Agent definition files (agents/*.md) define hook execution
4. **Fallback**: Agent fallback logic if PM unavailable (Enhanced Alternative C)

**Examples**:

| Hook Name | Purpose | Why Non-Critical |
|-----------|---------|------------------|
| `sync-md.ts` | Markdown date auto-update | Updates "Last Updated:" dates in .md files. Failure → cosmetic issue only |
| `memlog` | Session logging to memory/ | Appends session summary to daily log. Failure → documentation gap, no workflow impact |
| `gen-pr-body.ts` | PR body generation | Generates PR description from template. Failure → manual PR body creation possible |

**Classification Checklist**:
- [ ] Does hook failure allow workflow continuation?
- [ ] Is hook purpose cosmetic or logging only?
- [ ] Can hook failure be manually recovered?
- [ ] Does hook have minimal compliance impact?

If **all answers are YES**, classify as **Agent-Managed**.

---

## Decision Matrix

| Hook | Failure Blocking? | Compliance Critical? | Recovery Possible? | Classification |
|------|-------------------|---------------------|-------------------|----------------|
| audit.ts | Yes (block) | Yes (compliance) | No (auto-fix impossible) | **PM-Managed** |
| vsp-sync.ps1 | Yes (block) | Yes (integrity) | No (manual sync complex) | **PM-Managed** |
| vsp-audit.ps1 | Yes (block) | Yes (quality) | No (manual validation error-prone) | **PM-Managed** |
| sync-md.ts | No (warn) | No (cosmetic) | Yes (manual edit possible) | **Agent-Managed** |
| memlog | No (warn) | No (documentation) | Yes (manual entry possible) | **Agent-Managed** |
| gen-pr-body.ts | No (warn) | No (cosmetic) | Yes (manual write possible) | **Agent-Managed** |

## Ambiguous Cases

### vsp-audit.ps1 Classification Discussion

**Initial ambiguity**: vsp-audit.ps1 validates ABAP objects (quality-critical), but in code-writer's workflow, it's a **post-hook** that agents could execute autonomously.

**Resolution**: **PM-Managed**

**Rationale**:
1. ABAP validation is **domain-critical** (defective code breaks SAP system integrity)
2. PM Gateway ensures **consistent validation** across all agents
3. Agent-managed execution risks **inconsistent validation** (e.g., code-writer calls `vsp-audit.ps1`, fiori-developer calls `vsp-audit.ps1 --verbose`)

**Future consideration**: If PM Gateway failure rate > 2% (Alternative C trigger), reclassify as Agent-Managed with fallback logic.

## Governance Enforcement

### PM Execution Plan Table Documentation

All hooks must be documented in PM execution plan table with classification:

```markdown
| # | Task | Agent | PM-Managed Hooks | Agent-Managed Hooks | Classification Rationale |
|---|------|-------|------------------|---------------------|-------------------------|
| 3 | code-writer | code-writer | (none) | vsp-audit.ps1 (post-hook) | PM-Managed: ABAP validation critical |
| 4 | auditor | auditor | audit.ts (pre-hook) | (none) | PM-Managed: Workspace compliance required |
| 5 | test-runner | test-runner | vsp-sync.ps1 (pre-hook) | sync-md.ts (post-hook) | PM: SAP sync critical, Agent: Date update cosmetic |
```

### Agent Definition File Template

Each agent .md file must document its hooks:

```markdown
## agent/code-writer.md

### Post-Hook Execution

**Hook**: vsp-audit.ps1
**Classification**: PM-Managed (Critical)
**Purpose**: ABAP object validation after code generation
**Execution**: PM Gateway calls this hook after agent completion
**Fallback (if PM unavailable)**: Agent executes hook directly (see Enhanced Alternative C, Phase 2)
```

## Review and Maintenance

### Quarterly Review

Quarterly governance review (Q1, Q2, Q3, Q4) to:
1. Review hook classification accuracy
2. Assess PM-Managed hook failure impact
3. Evaluate Agent-Managed hook drift (should they be PM-Managed?)

### Reclassification Process

To reclassify a hook:

1. **Proposal**: Document rationale in memory/YYYY-MM-DD.md
2. **Review**: pm + architect + devops-admin joint review
3. **Approval**: Update this document (G0002) with new classification
4. **Deployment**: Update PM execution plan table and agent .md files

## References

- **Meeting**: meeting-2026-06-01-resolve-remaining-issues.md
- **Related**: G0001 (Hook Execution Policy)
- **Related**: G0003 (Phase Completion Governance)
- **Related**: Alternative C (Enhanced PM-Orchestrated Architecture, Phase 2)

## Change History

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-06-01 | 1.0 | Initial guidelines creation | pm |
