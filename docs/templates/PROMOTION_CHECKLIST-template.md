# Promotion Checklist Template

**Version**: 1.0.0
**Purpose**: Define 7 criteria for variant promotion from Phase A (Prototype) to Phase C (Template Creation)
**Usage**: Copy this file to `Projects/[variant-name]/PROMOTION_CHECKLIST.md` and verify each criterion before promotion

---

## Promotion Checklist

Use this checklist to verify your variant is ready for promotion from Phase A (Prototype Development) to Phase C (Template Creation).

**Promotion Decision**: [ ] PASS / [ ] FAIL
**Reviewed By**: [Name]
**Review Date**: YYYY-MM-DD

---

### Criteria 1: Folder Structure Compliance

**Objective**: Variant follows workspace folder structure standards.

**Checklist**:
- [ ] Root configuration files present (`CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `CHANGELOG.md`)
- [ ] `agents/` directory contains all variant-specific agents
- [ ] `skills/` directory contains all variant-specific skills
- [ ] Variant-specific directories (e.g., `regulations/`, `industry-profiles/`) properly structured
- [ ] `_ORIGIN.md` lists files copied from workspace root
- [ ] `_COMMON_VERSION.md` contains workspace common version snapshot

**Pass Criteria**: All items checked ✅

**Fail Criteria**: Any item unchecked ❌ → Fix folder structure before promotion

---

### Criteria 2: Agent Completeness

**Objective**: All required agents defined with proper 3-section structure.

**Checklist**:
- [ ] Variant-specific agents defined in `agents/`
- [ ] Each agent follows 3-section structure:
  - [ ] Section A: Role & Responsibility (platform-agnostic)
  - [ ] Section B: Claude Code Integration (skills, tools, Agent tool)
  - [ ] Section C: Antigravity Integration (activate_skill, agent_manager, tools)
- [ ] `AGENTS.md` includes variant agent roster
- [ ] PM agent (pm.md) includes variant context if needed

**Pass Criteria**: All agents have complete 3-section structure ✅

**Fail Criteria**: Any agent missing sections or incomplete ❌ → Complete agent definitions before promotion

---

### Criteria 3: Skill Completeness

**Objective**: All required skills defined with platform parity.

**Checklist**:
- [ ] Variant-specific skills defined in `skills/`
- [ ] Each skill has complete SKILL.md frontmatter:
  - [ ] `name`: Skill identifier
  - [ ] `description`: 1-line summary
  - [ ] `owner`: Responsible agent
  - [ ] `version`: Semantic version
  - [ ] `last_reviewed`: Review date
  - [ ] `metadata.type`: Skill type (process, domain, etc.)
  - [ ] `triggers`: Invocation triggers
- [ ] Skills work on both Claude Code and Antigravity
- [ ] No platform-specific hard-coded dependencies

**Pass Criteria**: All skills complete and platform-agnostic ✅

**Fail Criteria**: Any skill incomplete or platform-specific ❌ → Fix skill definitions before promotion

---

### Criteria 4: Common Drift Prevention

**Objective**: Files from workspace common/ are tracked and versioned.

**Checklist**:
- [ ] `_ORIGIN.md` exists and lists all files copied from workspace root
- [ ] `_COMMON_VERSION.md` exists and contains:
  - [ ] Workspace common version (from `scripts/SCRIPTS.md`)
  - [ ] Git commit hash of workspace root at copy time
- [ ] No drift: Files from common/ are still in sync with workspace root
- [ ] If drift detected: Document reasons and justify deviation

**Pass Criteria**: Common drift tracked and justified ✅

**Fail Criteria**: `_ORIGIN.md` or `_COMMON_VERSION.md` missing ❌ → Create tracking files before promotion

---

### Criteria 5: Platform Parity

**Objective**: Variant works on both Claude Code and Antigravity platforms.

**Checklist**:
- [ ] All agents have 3-section structure (Section A/B/C)
- [ ] All skills are platform-agnostic
- [ ] No Claude-only or Antigravity-only hard-coded dependencies
- [ ] Platform-specific code properly isolated (Section B vs Section C)
- [ ] Run `bun run scripts/verify-platform-lifecycle.ts` → All checks pass

**Pass Criteria**: Full platform parity achieved ✅

**Fail Criteria**: Platform-specific code not isolated ❌ → Fix platform parity before promotion

---

### Criteria 6: Documentation Completeness

**Objective**: All required documentation present and up-to-date.

**Checklist**:
- [ ] `CLAUDE.md` exists with variant context
- [ ] `GEMINI.md` exists with platform parity to CLAUDE.md
- [ ] `AGENTS.md` includes variant agent roster
- [ ] `CHANGELOG.md` exists with [Unreleased] section
- [ ] `memory/[variant-name]-plan.md` (design document) complete
- [ ] `PROMOTION_CHECKLIST.md` (this file) complete

**Pass Criteria**: All documentation files present ✅

**Fail Criteria**: Any documentation file missing ❌ → Complete documentation before promotion

---

### Criteria 7: Test Coverage

**Objective**: Basic integration tests pass to validate variant functionality.

**Checklist**:
- [ ] Run `bun run scripts/audit.ts` → All checks pass
- [ ] Run `bun run scripts/validate-templates.ts` → No errors (if template exists)
- [ ] Run `bun run scripts/verify-platform-lifecycle.ts` → Platform parity confirmed
- [ ] Manual test: Invoke variant-specific skill → Works correctly
- [ ] Manual test: Dispatch variant-specific agent → Works correctly

**Pass Criteria**: All tests pass ✅

**Fail Criteria**: Any test fails ❌ → Fix issues before promotion

---

## Promotion Decision

### Summary

| Criterion | Status | Notes |
|-----------|--------|-------|
| 1. Folder Structure Compliance | [ ] PASS / [ ] FAIL | |
| 2. Agent Completeness | [ ] PASS / [ ] FAIL | |
| 3. Skill Completeness | [ ] PASS / [ ] FAIL | |
| 4. Common Drift Prevention | [ ] PASS / [ ] FAIL | |
| 5. Platform Parity | [ ] PASS / [ ] FAIL | |
| 6. Documentation Completeness | [ ] PASS / [ ] FAIL | |
| 7. Test Coverage | [ ] PASS / [ ] FAIL | |

### Overall Decision

**[ ] PASS** → Proceed to Phase C (Template Creation)
**[ ] FAIL** → Rollback to Phase A (fix issues and repeat refinement)

### Decision Notes

[Additional comments, justifications for failures, or promotion conditions]

---

## References

- Variant Creation Workflow: `docs/variant-creation-workflow.md`
- Workspace Audit Script: `scripts/audit.ts`
- Platform Validation: `scripts/verify-platform-lifecycle.ts`

---

*Template Owner: pm*
*Last Updated: 2026-06-05*
