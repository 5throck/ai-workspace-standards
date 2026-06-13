# Variant Creation Workflow

> **Developer guide**: For step-by-step CLI instructions and the post-scaffolding checklist, see [`creating-a-variant.md`](creating-a-variant.md).

**Version**: 1.1.0
**Last Updated**: 2026-06-05
**Status**: Active

---

## Overview

This document defines the standardized 3-Phase workflow for creating new variants in the workspace. It ensures consistency, quality, and governance across all variant development projects.

---

## Workflow Architecture

### 3-Phase Structure

```
Phase A: Prototype Development
  → Phase B: Workspace Integration & Promotion Decision
    → Phase C: Template Creation & Validation
```

**Key Principles**:
- **Safety First**: Independent development prevents workspace root contamination
- **Quality Gates**: Each Phase has explicit validation criteria
- **Rollback Options**: Clear rollback paths on failure
- **Documentation**: All decisions and artifacts are version-controlled
- **Fork Model**: After L2 scaffold from L1, L2 evolves independently. L1 changes do NOT auto-propagate to L2 (see [ADR-0031](adr/0031-l1-l2-fork-model.md))

---

## Phase A: Prototype Development

### Objective
Develop variant-specific functionality in isolation without affecting workspace root.

### Steps

**A-1. Design Document Creation**
- **Output**: `memory/[variant-name]-plan.md`
- **Template**: Use `variant-execution-plan-template.md`
- **Content**: Why/What/How, Architecture, Development Strategy, Folder Structure, Agent/Skill Catalogs, Execution Roadmap

**A-2. New Project Creation**
- **Location**: `Projects/[variant-name]/`
- **Method**: `bun run scripts/new-project.sh [variant-name]` (or `.\scripts\new-project.ps1` for Windows)
- **Variant Selection**: Select appropriate base variant (co-consult, co-design, etc.) or start from scratch
- **Note**: Project is created with common/ dependencies from workspace root

**A-3. Project Refinement**
- **Activities**:
  - Develop variant-specific agents/ (agent definitions)
  - Develop variant-specific skills/ (skill definitions)
  - Configure variant-specific files (regulations/, industry-profiles/, etc.)
  - Modify CLAUDE.md, GEMINI.md (add variant context only)
  - Update AGENTS.md (include variant agent roster)
- **Common Drift Prevention**:
  - Create `_ORIGIN.md`: List files copied from workspace root common/
  - Create `_COMMON_VERSION.md`: Snapshot workspace common version + git hash

### Quality Gates

**Quality Gate A-1**: Prototype Completeness Check
- **Criteria**:
  - All variant-specific agents defined with proper roles and responsibilities
  - All variant-specific skills defined with clear triggers and workflows
  - CLAUDE.md, GEMINI.md updated with variant context
  - AGENTS.md includes variant agent roster
  - `_ORIGIN.md` and `_COMMON_VERSION.md` created
- **Verification**: Manual review by architect

**Quality Gate A-2**: Platform Parity Check
- **Criteria**:
  - Agent 3-section structure complete (Role & Responsibility, Claude Code Integration, Antigravity Integration)
  - Skills work on both Claude Code and Antigravity
  - No platform-specific hard-coded dependencies
- **Verification**: Run `bun run scripts/verify-platform-lifecycle.ts`

---

## Phase B: Workspace Integration & Promotion Decision

### Objective
Ensure prototype integrates properly with workspace common dependencies and meets promotion criteria.

### Steps

**B-1. Common Drift Verification**
- **Activity**: Review `_ORIGIN.md` and `_COMMON_VERSION.md`
- **Check**: Are files copied from common/ still in sync with workspace root?
- **Method**: Compare file versions and git hashes

**B-2. Workspace Fitting**
- **Activity**: Verify `Projects/[variant-name]/` correctly uses workspace common/ dependencies
- **Check**:
  - Scripts from `scripts/common/` properly referenced
  - Skills from `skills/common/` properly utilized
  - No duplicate or conflicting definitions
- **Method**: Manual review + audit script

**B-3. Promotion Checklist Execution**
- **Tool**: `PROMOTION_CHECKLIST.md` (7 criteria)
- **Criteria**:
  1. **Folder Structure Compliance**: Variant follows workspace folder structure standards
  2. **Agent Completeness**: All required agents defined with 3-section structure
  3. **Skill Completeness**: All required skills defined with platform parity
  4. **Common Drift Prevention**: `_ORIGIN.md`, `_COMMON_VERSION.md` present and accurate
  5. **Platform Parity**: Works on both Claude Code and Antigravity
  6. **Documentation Completeness**: CLAUDE.md, GEMINI.md, AGENTS.md, CHANGELOG.md present
  7. **Test Coverage**: Basic integration tests pass
- **Method**: Run `bun run scripts/audit.ts` + manual verification

**B-4. Promotion Decision**
- **Pass**: Proceed to Phase C (Template Creation)
- **Fail**: Rollback to Phase A (fix issues, repeat refinement)

### Rollback Option

**Rollback to Phase A**: If promotion checklist fails
- **Action**: Return to A-3 (Project Refinement)
- **Reasoning**: Fix identified issues before promotion
- **Cost**: Low (only Projects/ directory affected)

---

## Phase C: Template Creation & Validation

### Objective
Create variant template and propagate to workspace root, enabling future project generation.

### Steps

**C-1. Template Creation**
- **Location**: `templates/co-[variant-name]/`
- **Method**:
  - **Option 1 (Manual)**: Manually copy files from `Projects/[variant-name]/` to `templates/co-[variant-name]/`
  - **Option 2 (Automated)**: Run `bun run scripts/l2-to-variant-pipeline.ts Projects/[variant-name]/`
- **Structure**:
  ```
  templates/co-[variant-name]/
  ├── CLAUDE.md
  ├── GEMINI.md
  ├── AGENTS.md
  ├── agents/          (variant-specific agents)
  ├── skills/          (variant-specific skills)
  └── [variant-specific dirs]/
  ```

**C-2. Workspace Root Reflection**
- **Activity**: Update workspace root files to reference new variant
- **Files**:
  - Update `CONSTITUTION.md` (if variant introduces new governance rules)
  - Update `CLAUDE.md` (if variant affects PM workflow)
  - Update `GEMINI.md` (platform parity)
- **Method**: Manual edit + commit

**C-3. Validation**
- **Tool**: `validate-templates.ts`
- **Check**: Template structure compliance
- **Method**: `bun run scripts/validate-templates.ts`

**C-4. New Project Test**
- **Activity**: Generate new project from template to verify end-to-end workflow
- **Method**: `bun run scripts/new-project.sh test-[variant-name] --variant co-[variant-name]`
- **Verification**: Generated project works correctly

### Quality Gates

**Quality Gate C-1**: Template Validation
- **Criteria**:
  - `validate-templates.ts` passes all checks
  - Template folder structure matches workspace standards
  - All variant-specific files included
- **Verification**: `bun run scripts/validate-templates.ts` output

**Quality Gate C-2**: Integration Test
- **Criteria**:
  - New project can be generated from template
  - Generated project runs without errors
  - All agents and skills work correctly
- **Verification**: Manual test + `bun run scripts/audit.ts`

### Rollback Option

### Template Propagation Policy

| Direction | Mechanism | Frequency |
|-----------|-----------|-----------|
| L0 → L1 | `publish-to-template.ts` (auto via `/sync`) | Continuous |
| L1 → L2 | `create-l2-scaffold.ts` (scaffold only) | **One-time** |
| L2 → template | `l2-to-variant-pipeline.ts` (explicit) | On promotion |

> ⚠️ **No automatic L1→L2 sync after scaffold.** L2 is an independent fork.
> To check drift: `bun scripts/publish-to-template.ts --check-drift`

### Rollback Option

**Rollback to C-1**: If validation fails
- **Action**: Fix template structure issues
- **Reasoning**: Ensure template quality before propagation
- **Cost**: Low (only templates/ directory affected)

---

## Development Scenarios

### Scenario 1: Workspace-First Development

**Approach**: Develop variant directly in workspace root, extract to template later.

**Steps**:
1. Design document creation (in `memory/`)
2. Develop directly in workspace root (modify `CLAUDE.md`, `agents/`, `skills/`)
3. Refinement (in workspace root)
4. Workspace fitting: N/A (already in workspace root)
5. Extract template: `workspace root → templates/co-[variant-name]/`
6. Validation

**Pros**:
- Faster (no template copy overhead)
- Immediate workspace integration

**Cons**:
- Higher risk (workspace root contamination possible)
- Higher failure cost (workspace root rollback on failure)
- Common drift tracking difficult

**Use Case**: Small, experimental variants where speed is priority

---

### Scenario 2: Project-First Development (Recommended)

**Approach**: Develop variant in independent `Projects/[variant-name]/`, promote to template later.

**Steps**:
1. Design document creation (in `memory/`)
2. Independent development in `Projects/[variant-name]/`
3. Refinement (in `Projects/[variant-name]/`)
4. Workspace fitting (verify common/ dependencies)
5. Create template: `Projects/[variant-name]/ → templates/co-[variant-name]/`
6. Validation

**Pros**:
- Safer (workspace root isolation)
- Lower failure cost (delete `Projects/` directory on failure)
- Clear common drift tracking (`_ORIGIN.md`, `_COMMON_VERSION.md`)
- Validated approach (co-safety using this method)

**Cons**:
- Slower (additional template copy step)
- More manual steps

**Use Case**: Standard variant development (default approach)

---

## Tooling Support

### Required Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| `new-project.sh/ps1` | Create new project | ✅ Available |
| `l2-to-variant-pipeline.ts` | Automate Projects/ → templates/ conversion | ✅ Available |
| `validate-templates.ts` | Template structure validation | ✅ Available |
| `audit.ts` | Workspace standards compliance | ✅ Available |
| `verify-platform-lifecycle.ts` | Platform parity verification | ✅ Available |

### Template Files

| Template | Purpose | Status |
|----------|---------|--------|
| `variant-execution-plan-template.md` | Design document creation | 🔨 In Development |
| `PROMOTION_CHECKLIST-template.md` | Promotion criteria definition | 🔨 In Development |
| `QUALITY_GATES-template.md` | Quality gate definitions | 🔨 In Development |

---

## Success Criteria

A variant creation is considered successful when:

1. **Phase A**: All quality gates pass (A-1, A-2)
2. **Phase B**: Promotion checklist passes (7/7 criteria)
3. **Phase C**: All quality gates pass (C-1, C-2)
4. **End-to-End**: New project can be generated from template and works correctly

---

## References

- Safety OS Execution Plan: `memory/safety-os-plan.md`
- Variant Creation Template: `docs/templates/variant-execution-plan-template.md`
- Promotion Checklist: `docs/templates/PROMOTION_CHECKLIST-template.md`
- Quality Gates: `docs/templates/QUALITY_GATES-template.md`

---

*Document Owner: pm*
*Last Reviewed: 2026-06-05*
