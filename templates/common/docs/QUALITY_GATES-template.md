# Quality Gates Template

**Version**: 1.0.0
**Purpose**: Define quality gates for each Phase of variant creation workflow
**Usage**: Reference these gates during Phase A and Phase C validation

---

## Quality Gate Overview

Quality gates are validation checkpoints at the end of each Phase to ensure work meets quality standards before proceeding.

```
Phase A: Prototype Development
  ├─ Quality Gate A-1: Prototype Completeness
  └─ Quality Gate A-2: Platform Parity

Phase B: Workspace Integration & Promotion
  └─ Promotion Checklist (7 criteria) → See PROMOTION_CHECKLIST-template.md

Phase C: Template Creation & Validation
  ├─ Quality Gate C-1: Template Validation
  └─ Quality Gate C-2: Integration Test
```

---

## Phase A Quality Gates

### Quality Gate A-1: Prototype Completeness

**Timing**: End of Phase A (after A-3: Project Refinement)

**Objective**: Ensure prototype has all required components and is ready for workspace integration.

**Pass Criteria**:

1. **Design Document Complete**
   - `memory/[variant-name]-plan.md` exists
   - All sections filled (Why/What/How, Architecture, Strategy, Structure, Catalogs, Roadmap)
   - Version and last updated fields populated

2. **Project Structure Complete**
   - `Projects/[variant-name]/` directory exists
   - Root config files present: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `CHANGELOG.md`
   - `agents/` directory contains all variant-specific agents
   - `skills/` directory contains all variant-specific skills
   - Variant-specific directories created (e.g., `regulations/`, `industry-profiles/`)

3. **Agent Completeness**
   - All variant-specific agents defined
   - Each agent has name, role, responsibilities
   - 3-section structure (Section A/B/C) complete for all agents
   - `AGENTS.md` includes variant agent roster

4. **Skill Completeness**
   - All variant-specific skills defined
   - Each skill has SKILL.md with frontmatter (name, description, owner, version, triggers)
   - Skills are platform-agnostic (work on both Claude Code and Antigravity)

5. **Common Drift Tracking**
   - `_ORIGIN.md` created: Lists files copied from workspace root
   - `_COMMON_VERSION.md` created: Contains workspace common version + git hash

**Verification Method**:
- Manual review by architect
- File existence checks: `ls Projects/[variant-name]/agents/*.md`
- Audit script: `bun run scripts/audit.ts` (if project is in workspace root)

**Fail Action**:
- Rollback to A-3 (Project Refinement)
- Fix missing components
- Re-submit for quality gate review

---

### Quality Gate A-2: Platform Parity

**Timing**: End of Phase A (after A-1 passes)

**Objective**: Ensure prototype works on both Claude Code and Antigravity platforms.

**Pass Criteria**:

1. **Agent 3-Section Structure**
   - All agents have Section A (Platform-agnostic): Role & Responsibility
   - All agents have Section B (Claude Code): Skill invocation, Agent tool, tools (Read, Write, Bash)
   - All agents have Section C (Antigravity): activate_skill, agent_manager, tools (read_file, write_file, run_command)
   - No platform mixing (e.g., Claude-specific code in Section C)

2. **Skill Platform Agnostic**
   - All skills use platform-agnostic triggers
   - Skills reference tools generically (e.g., "Read tool" not "Claude Code Read tool")
   - No platform-specific hard-coded dependencies in skill logic

3. **Platform-Specific Configuration**
   - CLAUDE.md: Claude Code-specific configuration only
   - GEMINI.md: Antigravity-specific configuration only
   - No cross-platform contamination

**Verification Method**:
- Run `bun run scripts/verify-platform-lifecycle.ts`
- Manual review of agent files (check 3-section structure)
- Manual review of skill files (check platform agnostic)

**Fail Action**:
- Rollback to A-3 (Project Refinement)
- Fix platform-specific code violations
- Re-separate platform concerns
- Re-submit for quality gate review

---

## Phase B: Promotion Checklist

**Timing**: End of Phase B (after B-3: Promotion Checklist Execution)

**Objective**: Comprehensive 7-criteria validation before Phase C (Template Creation).

**Note**: Phase B uses `PROMOTION_CHECKLIST-template.md` which includes:
1. Folder Structure Compliance
2. Agent Completeness
3. Skill Completeness
4. Common Drift Prevention
5. Platform Parity
6. Documentation Completeness
7. Test Coverage

**Reference**: See `docs/templates/PROMOTION_CHECKLIST-template.md` for detailed criteria.

**Pass Criteria**: All 7/7 criteria checked ✅

**Fail Action**: Rollback to Phase A (fix issues, repeat refinement)

---

## Phase C Quality Gates

### Quality Gate C-1: Template Validation

**Timing**: After C-1 (Template Creation) and C-2 (Workspace Root Reflection)

**Objective**: Ensure created template follows workspace standards and is ready for use.

**Pass Criteria**:

1. **Template Structure Compliance**
   - `templates/co-[variant-name]/` directory exists
   - Root config files present: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`
   - `agents/` directory contains all variant-specific agents
   - `skills/` directory contains all variant-specific skills
   - Variant-specific directories included (e.g., `regulations/`, `industry-profiles/`)

2. **Template File Integrity**
   - All files from `Projects/[variant-name]/` successfully copied
   - No missing files
   - No file corruption (verify file sizes match)

3. **Workspace Root Integration**
   - `workspace standards` updated (if variant introduces new governance)
   - `CLAUDE.md` updated (if variant affects PM workflow)
   - `GEMINI.md` updated (platform parity)

**Verification Method**:
- Run `bun run scripts/validate-templates.ts`
- Manual file listing: `ls templates/co-[variant-name]/`
- Compare file lists: `diff <(ls Projects/[variant-name]/agents/) <(ls templates/co-[variant-name]/agents/)`

**Fail Action**:
- Rollback to C-1 (Template Creation)
- Fix template structure issues
- Re-copy missing files
- Re-submit for quality gate review

---

### Quality Gate C-2: Integration Test

**Timing**: After C-3 (Validation) and before workflow completion

**Objective**: Ensure end-to-end workflow works: new project generation from template.

**Pass Criteria**:

1. **Template Functional Test**
   - `validate-templates.ts` passes without errors
   - No structural violations detected

2. **New Project Generation**
   - Test project can be created: `bun run scripts/new-project.sh test-[variant-name] --variant co-[variant-name]`
   - Test project directory exists: `Projects/test-[variant-name]/`
   - Test project has all expected files (agents/, skills/, config files)

3. **Generated Project Functionality**
   - Test project runs without errors
   - Variant-specific agents work correctly
   - Variant-specific skills work correctly
   - Platform parity maintained (test on both Claude Code and Antigravity if available)

4. **Audit Compliance**
   - Run `bun run scripts/audit.ts` on test project
   - All audit checks pass

**Verification Method**:
- Run `bun run scripts/validate-templates.ts`
- Generate test project: `bun run scripts/new-project.sh test-[variant-name] --variant co-[variant-name]`
- Manual test of agents and skills in test project
- Run audit on test project: `cd Projects/test-[variant-name]/ && bun run ../../scripts/audit.ts`

**Fail Action**:
- Rollback to C-1 (Template Creation)
- Fix template issues
- Delete test project: `rm -rf Projects/test-[variant-name]/`
- Re-test after fixes

---

## Rollback Mechanisms

### Phase A Rollback

**Trigger**: Quality Gate A-1 or A-2 fails

**Rollback Path**:
1. Return to A-3 (Project Refinement)
2. Fix identified issues
3. Re-submit for quality gate review

**Cost**: Low (only `Projects/` directory affected)

---

### Phase B Rollback

**Trigger**: Promotion Checklist fails (any of 7 criteria)

**Rollback Path**:
1. Return to Phase A (A-3: Project Refinement)
2. Fix identified issues
3. Re-run Phase B steps
4. Re-submit for promotion review

**Cost**: Low-Medium (repeat Phase A + Phase B)

---

### Phase C Rollback

**Trigger**: Quality Gate C-1 or C-2 fails

**Rollback Path**:
1. Return to C-1 (Template Creation)
2. Fix template issues
3. Re-validate (C-3)
4. Re-test (C-4)

**Cost**: Low (only `templates/` directory affected)

---

## Quality Gate Summary

| Phase | Quality Gate | Criteria | Verification |
|-------|--------------|----------|--------------|
| A | A-1: Prototype Completeness | 5 criteria (Design, Structure, Agents, Skills, Drift) | Manual review + audit |
| A | A-2: Platform Parity | 3 criteria (Agent 3-section, Skill agnostic, Config) | verify-platform-lifecycle.ts |
| B | Promotion Checklist | 7 criteria (see PROMOTION_CHECKLIST-template.md) | Manual + audit |
| C | C-1: Template Validation | 3 criteria (Structure, Integrity, Integration) | validate-templates.ts |
| C | C-2: Integration Test | 4 criteria (Validation, Generation, Functionality, Audit) | New project test |

---

## References

- Variant Creation Workflow: `docs/variant-creation-workflow.md`
- Promotion Checklist: `docs/templates/PROMOTION_CHECKLIST-template.md`
- Validate Templates: `scripts/validate-templates.ts`
- Platform Validation: `scripts/verify-platform-lifecycle.ts`
- Workspace Audit: `scripts/audit.ts`

---

*Template Owner: pm*
*Last Updated: 2026-06-05*
