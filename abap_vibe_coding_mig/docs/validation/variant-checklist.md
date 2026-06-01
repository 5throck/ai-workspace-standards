# Variant Validation Checklist

**Migration**: abap_vibe_coding → co-develop variant
**Test project**: `c:\git\abap_vibe_coding_mig`
**Date**: 2026-06-01

---

## Pre-migration Baseline (abap_vibe_coding_mig initial state)

### Structural Integrity
- [ ] Migration copy created at `c:\git\abap_vibe_coding_mig`
- [ ] File count matches original (run: `find abap_vibe_coding_mig -type f | wc -l`)
- [ ] Directory structure matches original (run: `diff -q abap_vibe_coding abap_vibe_coding_mig`)
- [ ] No CONSTITUTION.md exists (correct - variant references workspace root)
- [ ] Original context.md backed up to `context.md.backup`

### Git State
- [ ] Git commit created (baseline before changes)
- [ ] Commit message: "feat: baseline for variant conversion migration"
- [ ] Clean working tree (no uncommitted changes)

### Content Audit
- [ ] Original `docs/context.md` sections catalogued
- [ ] No broken file references detected
- [ ] MCP server config intact (`.mcp.json`)

---

## Phase 1 Validation (context.md Split)

### File Creation
- [ ] New `docs/context.md` created (immutable)
- [ ] New `docs/abap.context.md` created (custom)
- [ ] Old `docs/context.md` backed up before deletion
- [ ] Old `docs/context.md` removed after verification

### Content Verification
- [ ] **New context.md contains**:
  - [ ] Project Overview section
  - [ ] Architecture section (key directories)
  - [ ] Governance References section (CONSTITUTION.md links)
  - [ ] Session Start checklist (read order)
  - [ ] NO ABAP-specific content (moved to abap.context.md)

- [ ] **New abap.context.md contains**:
  - [ ] Tech Stack (vsp MCP server details)
  - [ ] Environment Setup (SAP credentials)
  - [ ] Agent Roles (SAP-specific agents)
  - [ ] ABAP Development Rules (SQL, naming)
  - [ ] Development Workflow (/triage, /post-write)

- [ ] **No content loss**:
  - [ ] All original sections accounted for
  - [ ] No missing content
  - [ ] Section mapping verified

### Reference Verification
- [ ] context.md references workspace root CONSTITUTION.md
- [ ] Correct section references (CONSTITUTION.md §1, §2, §3, §5, §8)
- [ ] References use correct path: `../CONSTITUTION.md` or `CONSTITUTION.md`
- [ ] No self-references to local CONSTITUTION.md

---

## Phase 2 Validation (CLAUDE.md Update)

### Required Additions
- [ ] **Role Declaration section updated**:
  - [ ] CONSTITUTION.md reference added: "Shared workspace setup... live in [`CONSTITUTION.md`](CONSTITUTION.md)"
  - [ ] "read it first and the files listed in its `## Required Reading` block" included

- [ ] **§5 Agent Dispatch Rules added**:
  - [ ] "MANDATORY PM GATEWAY" declaration
  - [ ] CONSTITUTION.md §5 reference
  - [ ] Mandatory Execution Plan Display table format
  - [ ] Lifecycle Update + Final QA Audit as final steps
  - [ ] "Agent tool must not be called until table is visible"

- [ ] **Session Start Checklist updated**:
  - [ ] Step 0: git config core.hooksPath .githooks
  - [ ] Step 1: Read CONSTITUTION.md (workspace root)
  - [ ] Step 2: Read docs/context.md (this file)
  - [ ] Step 3: Read docs/abap.context.md
  - [ ] Step 4: Read AGENTS.md
  - [ ] Step 5: Read memory/MEMORY.md (if exists)

### Removal Verification
- [ ] ABAP-specific configuration details removed (moved to abap.context.md)
- [ ] Custom environment setup instructions removed (moved to abap.context.md)
- [ ] No orphaned references to removed sections

### Template Alignment
- [ ] CLAUDE.md structure matches co-develop template pattern
- [ ] PM Gateway enforcement present (variant requirement)
- [ ] No standalone project assumptions

---

## Phase 3 Validation (Integration Test)

### Session Start Test
- [ ] Start PM agent in abap_vibe_coding_mig
- [ ] Verify file load order:
  1. [ ] CONSTITUTION.md (workspace root) loads first
  2. [ ] docs/context.md loads second
  3. [ ] docs/abap.context.md loads third
  4. [ ] AGENTS.md loads fourth
- [ ] No file load errors
- [ ] All files accessible

### CONSTITUTION Reference Test
- [ ] Check docs/context.md
- [ ] Verify CONSTITUTION.md references point to workspace root
- [ ] Confirm no local CONSTITUTION.md in abap_vibe_coding_mig
- [ ] Test reference resolution: Can navigate to CONSTITUTION.md sections

### ABAP Context Access Test
- [ ] Query ABAP development rules
- [ ] Verify content found in docs/abap.context.md
- [ ] Confirm ABAP rules NOT in docs/context.md
- [ ] Test section access: Tech Stack, Environment Setup, Agent Roles

### PM Gateway Enforcement Test
- [ ] Request multi-agent task: "design a new ABAP class"
- [ ] Verify PM displays execution plan table BEFORE dispatching
- [ ] Confirm table format: # | Task | Agent | Tier | Model
- [ ] Confirm Lifecycle Update + Final QA Audit in plan
- [ ] Verify architect dispatched only AFTER table visible

### Agent Dispatch Test
- [ ] Try direct specialist invocation: "invoke architect directly"
- [ ] Verify PM refuses (PM Gateway enforcement)
- [ ] Confirm PM redirects through PM Gateway
- [ ] Test architect dispatch after PM approval

### Workflow Test
- [ ] Run `/triage` command test
- [ ] Verify PM triage workflow functional
- [ ] Test agent coordination (Business → Technical groups)
- [ ] Confirm no workflow regressions

---

## Phase 4 Readiness (Apply to Main Project)

### Pre-rollout Requirements
- [ ] **All Phase 1-3 validations pass** (100%)
- [ ] No regressions detected
- [ ] No content loss verified
- [ ] Integration tests successful
- [ ] Test scenarios all pass

### Main Project Backup
- [ ] abap_vibe_coding backup strategy confirmed
- [ ] Backup location: `abap_vibe_coding_backup_YYYY-MM-DD`
- [ ] Backup verified (file count, integrity check)
- [ ] Rollback procedure documented

### Approval Gate
- [ ] PM reviews Phase 3 validation results
- [ ] Architect confirms migration successful
- [ ] User approval to proceed to Phase 4
- [ ] Rollback plan communicated

---

## Phase 4 Execution (Production Rollout)

### Pre-rollout Final Check
- [ ] Main project abap_vibe_coding confirmed clean state
- [ ] No uncommitted changes in main project
- [ ] Git status clean
- [ ] Backup accessible

### Changes Applied
- [ ] docs/context.md copied from migration project
- [ ] docs/abap.context.md copied from migration project
- [ ] CLAUDE.md copied from migration project
- [ ] Old context.md backed up in main project
- [ ] All changes staged for commit

### Post-rollout Validation
- [ ] Run complete variant checklist on main project
- [ ] All Pre-migration checks pass
- [ ] All Phase 1 checks pass
- [ ] All Phase 2 checks pass
- [ ] All Phase 3 integration tests pass

### Git Commit
- [ ] Commit message: "feat: convert abap_vibe_coding to co-develop variant"
- [ ] Commit includes ADR reference (ADR 0020)
- [ ] Commit passes pre-commit hooks
- [ ] No audit script failures

---

## Success Criteria Summary

**Overall migration success**:
- [ ] All checklist items pass (100%)
- [ ] Zero content loss verified
- [ ] Zero regressions detected
- [ ] PM Gateway functional
- [ ] Integration tests pass
- [ ] Main project validated

**Production deployment success**:
- [ ] Main project variant behavior confirmed
- [ ] No production issues
- [ ] Team notified of changes
- [ ] Migration ADR complete

---

## Failure Triggers

**Immediate rollback if**:
- Content loss detected during Phase 1
- CONSTITUTION.md mistakenly added to variant
- PM Gateway breaks critical workflows
- Integration test failures > 50%
- Main project validation fails

**Iterative fixes if**:
- Minor content organization issues
- CLAUDE.md formatting problems
- Non-critical reference path corrections

---

*Checklist version: 1.0*
*Created: 2026-06-01*
*A-03: Validation documentation*
