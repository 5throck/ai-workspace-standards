# Rollback Procedure for Variant Migration

**Migration**: abap_vibe_coding → co-develop variant
**Test project**: `c:\git\abap_vibe_coding_mig`
**Created**: 2026-06-01
**Purpose**: Emergency rollback if Phase 1-3 validation fails

---

## When to Use This Procedure

**Trigger rollback immediately if**:
- Content loss detected during context.md split
- CONSTITUTION.md mistakenly added to variant
- PM Gateway breaks critical workflows
- Integration test failures > 50%
- Phase 3 validation fails catastrophically
- Data corruption detected
- Migration cannot proceed safely

**DO NOT rollback for**:
- Minor formatting issues (fix iteratively)
- Non-critical reference path corrections
- CLAUDE.md wording improvements
- Test failures < 50% (fix and re-test)

---

## Pre-Rollback Checklist

### Safety Confirmation
- [ ] Rollback trigger criteria met (see above)
- [ ] PM and architect consulted
- [ ] Rollback decision documented in memory
- [ ] Team notified of rollback

### Current State Documentation
- [ ] Current git state documented: `git status > /tmp/pre-rollback-state.txt`
- [ ] Current docs structure documented: `ls -la docs/ > /tmp/pre-rollback-docs.txt`
- [ ] Current CLAUDE.md backed up: `cp CLAUDE.md CLAUDE.md.rollback-backup`
- [ ] Baseline commit hash recorded: `git rev-parse HEAD > /tmp/baseline-commit.txt`

---

## Rollback Execution

### Step 1: Create Rollback Commit

**Before making changes**, create a safety commit:

```bash
cd /c/git/abap_vibe_coding_mig

# Document rollback intention
echo "=== ROLLBACK INITIATED ===" > /tmp/rollback-log.txt
echo "Date: $(date)" >> /tmp/rollback-log.txt
echo "Reason: [SPECIFY REASON]" >> /tmp/rollback-log.txt
echo "Baseline: $(cat /tmp/baseline-commit.txt)" >> /tmp/rollback-log.txt

# Stage current state (even if broken)
git add -A

# Create rollback commit
git commit -m "rollback: variant conversion failed - reverting to baseline

Reason: [SPECIFY REASON FROM /tmp/rollback-log.txt]

This commit preserves the failed migration state for analysis.
Next commit will restore baseline configuration."
```

### Step 2: Restore Original context.md

```bash
# Remove new variant context files
rm docs/context.md
rm docs/abap.context.md

# Restore original from backup
cp docs/context.md.backup docs/context.md

# Verify restoration
ls -la docs/context.md
grep "Project Overview" docs/context.md  # Should exist
grep "vsp" docs/context.md  # Should exist (original monolithic)
```

### Step 3: Restore Original CLAUDE.md

```bash
# Restore original CLAUDE.md
cp CLAUDE.md.backup CLAUDE.md

# Verify restoration
ls -la CLAUDE.md
grep "Role Declaration" CLAUDE.md  # Should exist
```

### Step 4: Clean Rollback State

```bash
# Stage restored files
git add docs/context.md CLAUDE.md

# If abap.context.md was created, ensure deletion staged
git add docs/abap.context.md  # Should show as deleted

# Verify git status
git status

# Expected: docs/context.md and CLAUDE.md show as "modified"
# Expected: docs/abap.context.md shows as "deleted" (if created)
```

### Step 5: Create Rollback Complete Commit

```bash
# Commit rollback completion
git commit -m "rollback: variant conversion reverted - baseline restored

Restored files:
- docs/context.md (original monolithic version)
- CLAUDE.md (original standalone version)

Removed files:
- docs/abap.context.md (variant-specific context)

Migration rollback complete.
Project ready for re-migration or alternative approach."

# Verify commit
git log -1 --stat
```

---

## Post-Rollback Verification

### Structural Verification
```bash
# Verify original structure restored
echo "=== Context file check ==="
ls -la docs/context.md
echo "=== No abap.context.md ==="
ls docs/abap.context.md  # Should fail: "No such file or directory"

echo "=== CLAUDE.md check ==="
ls -la CLAUDE.md

echo "=== Git status ==="
git status  # Should be clean (except for rollback commits)
```

### Functional Verification
```bash
# Test basic PM workflow
# Start Claude Code session
# Verify session start checklist works

# Test agent dispatch
# Verify no PM Gateway errors (should work as original standalone)

# Test scripts
./scripts/dev-sync.sh --help
./scripts/audit.sh --help
```

### Expected Results
- [ ] docs/context.md restored (original monolithic)
- [ ] docs/abap.context.md removed
- [ ] CLAUDE.md restored (original standalone)
- [ ] No CONSTITUTION.md in project (correct for standalone)
- [ ] Git status clean (2 rollback commits: failed state + restored state)
- [ ] PM workflow functional (original behavior)
- [ ] Scripts execute correctly
- [ ] No data corruption

---

## Rollback Failure Recovery

If rollback procedure fails:

### Scenario 1: Backup Files Missing

**Symptom**: `docs/context.md.backup` or `CLAUDE.md.backup` not found

**Recovery**:
```bash
# Restore from git history
git log --all --full-history -- docs/context.md
# Find last known good commit, then:
git checkout <commit-hash> -- docs/context.md

# Same for CLAUDE.md
git log --all --full-history -- CLAUDE.md
git checkout <commit-hash> -- CLAUDE.md
```

### Scenario 2: Git Corruption

**Symptom**: Git commands fail, repository corruption

**Recovery**:
```bash
# Reset to baseline commit (recorded in /tmp/baseline-commit.txt)
BASELINE=$(cat /tmp/baseline-commit.txt)
git reset --hard $BASELINE

# Verify clean state
git status
```

### Scenario 3: Data Corruption Detected

**Symptom**: Files restored but contain wrong/corrupted content

**Recovery**:
```bash
# Abort rollback, escalate to human
echo "=== ROLLBACK FAILURE ===" >> /tmp/emergency-log.txt
echo "Data corruption detected during rollback" >> /tmp/emergency-log.txt
echo "Requires manual intervention" >> /tmp/emergency-log.txt

# Contact team lead
# Preserve current state for forensic analysis
```

---

## Re-Migration After Rollback

### Root Cause Analysis

Before attempting re-migration:

1. **Analyze failure**:
   - Review why validation failed
   - Identify root cause (content loss? structural issue?)
   - Document findings in memory

2. **Fix root cause**:
   - Update migration ADR if strategy flawed
   - Fix automation scripts if tool error
   - Address team training if human error

3. **Update validation**:
   - Add new test cases for failure scenario
   - Strengthen rollback procedure
   - Document lessons learned

### Re-Migration Decision

**Re-migration approved if**:
- Root cause identified and fixed
- Updated validation covers failure scenario
- Team confident in retry
- Alternative approaches considered and rejected

**Re-migration blocked if**:
- Root cause unclear
- Fix not validated
- Team lacks confidence
- Alternative approach safer

### Re-Migration Execution

If re-migration approved:

```bash
# Start fresh from current baseline
# Current state: clean standalone project (after rollback)

# Repeat Phase 0-3 with improvements
# Use updated validation and lessons learned
# Monitor for previous failure signs
# Abort early if same issues recur
```

---

## Emergency Contacts

**Migration team**:
- PM: Mark Park
- Architect: [Architect agent]
- Docs-writer: [Docs-writer agent]

**Escalation path**:
1. PM analyzes failure
2. PM consults with architect
3. Joint decision on rollback vs iterative fix
4. Document decision in memory
5. Execute rollback (if approved)

---

## Rollback Success Criteria

Rollback considered successful if:

- [ ] Original structure restored (verified)
- [ ] All original files present (no loss)
- [ ] Git history preserved (rollback commits logged)
- [ ] Functionality verified (PM workflow works)
- [ ] No data corruption
- [ ] Re-migration possible (clean baseline)

**Rollback complete**: YES / NO

**Next action**: Re-migration (after fixes) / Alternative approach / Escalate

---

*Rollback procedure version: 1.0*
*Created: 2026-06-01*
*A-03: Validation documentation*
