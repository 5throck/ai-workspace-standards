# AGENTS.md Section Integration Design

Date: 2026-06-09
Status: Accepted
Deciders: architect, docs-writer, auditor
Reference: meeting-2026-06-09-agents-md-duplication-review.md

## Context and Problem Statement

AGENTS.md contains duplicate or separated sections, making the document structure unclear:

1. **PM Gateway Policy and PM Gateway Workflow Separation**: Two sections exist separately but need logical integration
2. **Agent Roster and Individual Agent Definitions Duplication**: Same content duplicated in two places

## Decision

### 1. PM Gateway Policy → PM Gateway Workflow Integration

**Current Structure**:
```markdown
## Agent Roster

## PM Gateway Policy

## §2: Individual Agent Definitions

## §3: PM Gateway Workflow
```

**New Structure**:
```markdown
## §1: Agent Ecosystem Overview
### 🎯 Agent Roster (Roles Overview)
### 🛠️ Orchestration & Audit Agents
### 📐 Design Agents
### ⚙️ Execution Agents
### 🛡️ Security Agents

## §2: Individual Agent Definitions

## §3: PM Gateway Workflow
### §3.1: PM Gateway Policy
### §3.2: PM Direct Execution Scope
### §3.3: PM Role Boundaries
### §3.4: Enforcement Layers
### §3.5: Phase Determination (Deliverable-Type Gate)
### §3.6: 3-Tier Strategy
### §3.7: Meeting Facilitation
### §3.8: Permission Denial Protocol
```

**Rationale**:
- PM Gateway Policy is integrated as the first section of PM Gateway Workflow
- Policy → Workflow order is logical (policy precedes procedure)
- Unified single section numbering system (§3)

### 2. Agent Roster vs Orchestration/Audit Separation Maintenance

**Decision**: **MAINTAIN SEPARATION** - Not duplicates as they serve different purposes

**Agent Roster (§1)**: Quick understanding of all agent purposes (role-based overview)
**Individual Agent Definitions (§2)**: Detailed role definitions (specific role-based deep dive)

**Section Name Concretization**:
- `## Agent Roster` → `## 🎯 Agent Roster (Roles Overview)`
- `### 🛠️ Orchestration / Audit` → `### 🛠️ Orchestration & Audit Agents`
- Added emojis to clarify catalog vs detail page relationship

### 3. PM Role Boundaries AGENTS.md Maintenance

**Decision**: **MAINTAIN IN AGENTS.md** - Remove PM-related content from individual agent files

**Rationale**:
- PM Role Boundaries is core to governance documents, so AGENTS.md location is appropriate
- Individual agent files should focus on roles, not permissions
- Duplicate removal: Remove PM-related permission content from individual agent files

## Consequences

**Positive**:
- Document structure becomes clearer (Policy → Workflow integration)
- Section numbering system maintains consistency
- Content conciseness improved through duplicate removal

**Neutral**:
- Section number changes (§3 maintained, only subsections added)
- Existing reference links need updating

**Negative**:
- Compatibility with existing documents needs consideration (maintain backward compatibility)

## Implementation Plan

### Phase 1: AGENTS.md Section Integration ✅ (Complete)

**Completed Tasks**:
1. ✅ Moved `## PM Gateway Policy` section under `## §3: PM Gateway Workflow`
2. ✅ Subsectioned as `### §3.1: PM Gateway Policy`
3. ✅ Renumbered existing `§3` subsections (§3.2, §3.3, ...)
4. ✅ Section name concretization (added 🎯, 🛠️ emojis)

### Phase 2: CONSTITUTION.md Reference Changes

**CONSTITUTION.md Structure Verification Results**:
- ❌ **§5.3 PM Orchestrator Rules**: Does not exist
- ✅ **§5.5: PM Gateway Workflow**: Exists (relevant section)
- ✅ **§5.6: Agent Lifecycle Management**: Exists

**Deletion Targets**:
1. **§4 Architecture Overview** (line 302-397)
   - L1/L2 Structure, variant_overrides sections
   - Complete deletion, change to CONSTITUTION.md §5.5 reference

2. **§6 Skill Registry** (line 696-718)
   - Skill Registry table (15 skills)
   - Delete table, strengthen VERSION_MANIFEST.md reference

3. **§8 Lifecycle Management Detailed Procedures** (line 773-804)
   - Agent/Skill/Script Lifecycle tables
   - Delete detailed procedures, change to CONSTITUTION.md §5.6 reference
   - Keep Phase 5 Finalization table

**Reference Text Design**:

> **L0 vs L1 Distinction**: L0 (workspace root) links to `CONSTITUTION.md`; L1 (templates/common) links to `docs/context.md`. The text below is for L0. For L1 deployment, replace CONSTITUTION.md with docs/context.md.

```markdown
> **For PM Agent Architecture**: See [CONSTITUTION.md §5.5 - PM Gateway Workflow](CONSTITUTION.md#55-pm-gateway-workflow) for complete governance workflow and enforcement layers.

> **For Agent Lifecycle Procedures**: See [CONSTITUTION.md §5.6 - Agent Lifecycle Management](CONSTITUTION.md#56-agent-lifecycle-management) for creation, modification, and deprecation procedures.
```

**L1 Equivalent Reference Text** (for templates/common/AGENTS.md):
```markdown
> **For PM Agent Architecture**: See [docs/context.md](docs/context.md) for complete governance workflow and enforcement layers.

> **For Agent Lifecycle Procedures**: See [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management) for creation, modification, and deprecation procedures.
```

### Phase 3: Individual Agent File PM Content Removal

**Tasks**:
1. Investigate PM-related keywords in individual agent files using Grep
2. Remove PM-related content and replace with AGENTS.md references
3. Individual agent files should focus only on role definitions

### Phase 4: Verification

**Tasks**:
1. Consistency verification by running `bun scripts/audit.ts`
2. Link validity verification
3. CLAUDE.md, GEMINI.md reference consistency check

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | PM Gateway Policy integrated into §3.1 | Check AGENTS.md line |
| AC-02 | §3 subsection numbering consistency maintained | Check §3.1, §3.2, ... order |
| AC-03 | Agent Roster section name concretized | Check for 🎯, 🛠️ emojis |
| AC-04 | Individual agent file PM content removed | Check for no PM keywords via Grep |
| AC-05 | audit.ts passes | Check for zero failures |
| AC-06 | Link validity verified | Check for no broken links |

## Related Documentation

- [Meeting Transcript: AGENTS.md Duplicate Section Integration Review](../../memory/meeting-2026-06-09-agents-md-duplication-review.md)
- [AGENTS.md](../../AGENTS.md)
- [agents/pm.md](../../agents/pm.md)
