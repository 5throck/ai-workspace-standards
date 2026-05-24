# AI Workspace Standards - Implementation Roadmap

**Created**: 2026-05-24
**Status**: Ready to Execute
**Total Issues Identified**: 96 (26 Critical, 36 Medium, 34 Minor)

---

## 📋 Quick Reference

| Phase | Focus | Tasks | Est. Time | Status |
|-------|-------|-------|-----------|--------|
| **Phase 1** | Critical Fixes | 6 | 9 hours | ⏳ Ready |
| **Phase 2** | Structural | 10 | 28 hours | 🔮 Planned |
| **Phase 3** | Enhancement | 10 | 41 hours | 🔮 Planned |

---

## 🎯 Phase 1: Critical Fixes (Current Sprint)

**Goal**: Fix 6 critical issues that break functionality or cause platform inconsistencies.

### Task 1.1: Fix sync-md.ps1 Dedup Gap

**Owner**: automation-engineer
**File**: `scripts/sync-md.ps1`
**Estimate**: 1 hour
**Status**: ⏳ Pending

**Problem**: PowerShell version lacks deduplication logic that Bash version has.

**Steps**:
1. [ ] Read `scripts/sync-md.sh` to understand dedup logic (line ~16)
2. [ ] Add dedup check to `sync-md.ps1` before Add-Content:
   ```powershell
   if ($IndexContent -notmatch [regex]::Escape("[$Date]")) {
       # Add-Content logic here
   }
   ```
3. [ ] Test by running sync-md.ps1 twice - should not create duplicates
4. [ ] Verify parity with sync-md.sh behavior

**Acceptance**:
- [ ] Multiple runs don't create duplicate index entries
- [ ] Exit code matches sync-md.sh

---

### Task 1.2: Add UTF-8 Encoding to All .ps1 Scripts

**Owner**: automation-engineer
**Files**: All `*.ps1` scripts
**Estimate**: 2 hours
**Status**: ⏳ Pending

**Problem**: PowerShell 5.1 defaults to system codepage (CP949), causing corruption.

**Steps**:
1. [ ] List all .ps1 files: `find . -name "*.ps1" -type f`
2. [ ] For each file, add to top of script:
   ```powershell
   # UTF-8 encoding enforcement
   $PSDefaultParameterValues['*:Encoding'] = 'utf8'
   $ErrorActionPreference = 'Stop'
   ```
3. [ ] Ensure all Get-Content/Set-Content/Add-Content use `-Encoding UTF8`
4. [ ] Test on Windows with Korean locale

**Files to Update**:
- [ ] `scripts/sync-md.ps1`
- [ ] `scripts/dev-sync.ps1`
- [ ] `scripts/new-project.ps1`
- [ ] `scripts/gen-pr-body.ps1`
- [ ] `scripts/audit.ps1`
- [ ] `templates/scripts/*.ps1` (all)

**Acceptance**:
- [ ] All .ps1 scripts have encoding header
- [ ] No corruption when running on Windows Korean locale

---

### Task 1.3: Standardize Git Hooks Path

**Owner**: scaffolding-expert
**Files**: `scripts/new-project.sh`, `scripts/new-project.ps1`
**Estimate**: 1 hour
**Status**: ⏳ Pending

**Problem**: Inconsistent hooks path (`.githooks` vs `../.githooks`).

**Steps**:
1. [ ] Find current hooks path in new-project.sh (should be `.githooks`)
2. [ ] Find current hooks path in new-project.ps1 (currently `../.githooks`)
3. [ ] Change .ps1 to use `.githooks` for consistency
4. [ ] Update templates/scripts/new-project.* to match
5. [ ] Test both scripts create same hooks config

**Acceptance**:
- [ ] Both scripts use `.githooks` (relative to project root)
- [ ] Templates match workspace root behavior

---

### Task 1.4: Add Pre-Rebase Security Hook

**Owner**: security-expert
**File**: `.githooks/pre-rebase` (NEW)
**Estimate**: 2 hours
**Status**: ⏳ Pending

**Problem**: Git rebase can rewrite history without scanning for secrets.

**Steps**:
1. [ ] Create `.githooks/pre-rebase` file
2. [ ] Add shebang and execute permissions
3. [ ] Implement secret scanning logic:
   ```bash
   #!/bin/bash
   # Scan all commits being rebased
   git rev-list --no-merges $1..$2 | while read commit; do
       git show $1:$commit | gitleaks detect --no-git --verbose
   done
   ```
4. [ ] Add bypass flag with warning
5. [ ] Create corresponding `.ps1` version
6. [ ] Add to templates/.githooks/

**Acceptance**:
- [ ] Hook blocks rebase if secrets found
- [ ] Hook can be bypassed with environment variable
- [ ] Both .sh and .ps1 versions exist

---

### Task 1.5: Refine Memory Exemption Logic

**Owner**: security-expert
**File**: `.githooks/pre-commit`
**Estimate**: 1 hour
**Status**: ⏳ Pending

**Problem**: Current exemption skips ALL checks for memory-only commits.

**Steps**:
1. [ ] Read current pre-commit logic (lines 9-12)
2. [ ] Modify to skip documentation audit only, NOT secret scan
3. [ ] Keep memory workflow smooth but still secure
4. [ ] Test with memory-only commits
5. [ ] Update templates/.githooks/pre-commit

**Acceptance**:
- [ ] Memory commits still run gitleaks
- [ ] Memory commits skip documentation audit
- [ ] Workflow remains smooth for users

---

### Task 1.6: Fix templates/AGENTS.md Mismatch

**Owner**: auditor
**File**: `templates/AGENTS.md`
**Estimate**: 2 hours
**Status**: ⏳ Pending

**Problem**: Templates reference workspace agents that don't exist in templates.

**Steps**:
1. [ ] Read `templates/AGENTS.md`
2. [ ] Read `templates/agents/` directory listing
3. [ ] Update AGENTS.md to reference only actual template agents:
   - pm.md ✓
   - architect.md ✓
   - designer.md ✓
   - code-writer.md ✓
   - test-runner.md ✓
   - security-monitor.md ✓
   - stack-setup.md ✓
4. [ ] Remove references to: auditor, automation-engineer, docs-writer, scaffolding-expert, security-expert
5. [ ] Add note explaining workspace vs template agent difference

**Acceptance**:
- [ ] All referenced agents exist in templates/agents/
- [ ] No broken links in template AGENTS.md

---

### Phase 1 Completion Checklist

- [ ] **Task 1.1**: sync-md.ps1 dedup fixed
- [ ] **Task 1.2**: UTF-8 encoding added to all .ps1
- [ ] **Task 1.3**: Git hooks path standardized
- [ ] **Task 1.4**: Pre-rebase hook created
- [ ] **Task 1.5**: Memory exemption refined
- [ ] **Task 1.6**: templates/AGENTS.md fixed
- [ ] **Verification**: `bash scripts/audit.sh` passes with zero errors

---

## 🏗️ Phase 2: Structural Improvements (Next Sprint)

**Goal**: Fix architectural issues and create automation for consistency.

### Task 2.1: Create Template Sync Script

**Owner**: automation-engineer
**Files**: `scripts/sync-templates.sh`, `scripts/sync-templates.ps1`
**Estimate**: 4 hours

**Scope**: Script to propagate workspace standards to templates/.

### Task 2.2: Implement Parity Validation

**Owner**: automation-engineer
**File**: `scripts/audit.sh`
**Estimate**: 3 hours

**Scope**: Automated .sh/.ps1 parity checking.

### Task 2.3: Modularize CONSTITUTION.md

**Owner**: docs-writer
**Files**: `docs/` structure
**Estimate**: 6 hours

**Scope**: Split into getting-started/, guides/, reference/, architecture/.

### Task 2.4: Create GETTING_STARTED.md

**Owner**: docs-writer
**File**: `docs/getting-started/index.md`
**Estimate**: 4 hours

**Scope**: New user onboarding guide.

### Task 2.5: Add Mermaid Diagrams

**Owner**: docs-writer
**File**: `docs/architecture/`
**Estimate**: 3 hours

**Scope**: Visual workflow diagrams.

### Task 2.6: Create TROUBLESHOOTING.md

**Owner**: docs-writer
**File**: `docs/troubleshooting.md`
**Estimate**: 4 hours

**Scope**: Common error resolutions.

### Task 2.7: Add Supply Chain Security Docs

**Owner**: security-expert
**File**: `docs/context.md`
**Estimate**: 2 hours

**Scope**: npm/pip security requirements.

### Task 2.8: Expand Secret Patterns

**Owner**: security-expert
**File**: `.githooks/pre-commit`
**Estimate**: 2 hours

**Scope**: Add Stripe, GCP, Azure, Supabase patterns.

---

## 🚀 Phase 3: Enhanced Features (Future)

**Goal**: Nice-to-have features and quality of life improvements.

### Task 3.1: Create MIGRATION.md

**Owner**: docs-writer
**Estimate**: 3 hours

### Task 3.2: Set Up i18n Automation

**Owner**: automation-engineer
**Estimate**: 6 hours

### Task 3.3: Add Japanese/Chinese Docs

**Owner**: docs-writer
**Estimate**: 8 hours

### Task 3.4: Create test-all.sh/ps1

**Owner**: automation-engineer
**Estimate**: 4 hours

### Task 3.5: Implement Script Tests

**Owner**: automation-engineer
**Estimate**: 8 hours

### Task 3.6: Add Template Variants

**Owner**: scaffolding-expert
**Estimate**: 10 hours

### Task 3.7: Create Pre-Commit Wrapper

**Owner**: automation-engineer
**Estimate**: 2 hours

---

## 📊 Progress Tracking

### Overall Progress

```
Phase 1: ████░░░░░░ 0% (0/6 tasks)
Phase 2: ░░░░░░░░░░ 0% (0/8 tasks)
Phase 3: ░░░░░░░░░░ 0% (0/7 tasks)
```

### Issue Resolution

| Priority | Total | Resolved | In Progress | Pending |
|----------|-------|----------|-------------|---------|
| P0 (Critical) | 26 | 0 | 0 | 26 |
| P1 (Medium) | 36 | 0 | 0 | 36 |
| P2 (Minor) | 34 | 0 | 0 | 34 |

---

## 🔗 References

**Original Meeting Summary**:
- 3-round multi-agent meeting (2026-05-24)
- 7 specialist agents participated
- Full issue catalog available in Appendix

**Working Groups**:
- Automation-Scaffolding: Script parity & encoding
- Auditor-Architect: Template synchronization
- Security-Auditor: Security hardening
- Docs-Architect: Documentation structure

---

## 📝 Execution Notes

### How to Use This Roadmap

1. **Start with Phase 1, Task 1.1** - Work through tasks in order
2. **Check off each step** as you complete it
3. **Verify acceptance criteria** before marking task complete
4. **Run audit.sh** after each task to ensure no regressions
5. **Update progress** sections as you go

### Dispatching Tasks to Agents

When ready to execute a task, dispatch to the appropriate agent:

```
Agent(
  description = "[Task N.M: Brief Description]",
  prompt = "Execute the task as defined in memory/2026-05-24-multi-agent-meeting-summary.md\n\n[Task Name]: ...\n[Steps]: ...\n[Acceptance Criteria]: ...\n\nReport completion with verification results.",
  subagent_type = "claude"
)
```

### After Phase 1 Completion

1. Schedule review meeting
2. Assess remaining issues
3. Adjust Phase 2 scope if needed
4. Begin Phase 2 planning

---

**Last Updated**: 2026-05-24
**Next Review**: After Phase 1 completion
**Maintained By**: PM Orchestrator
