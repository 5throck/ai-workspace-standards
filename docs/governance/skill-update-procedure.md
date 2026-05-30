# Skill Update Procedure

## Overview

Defines the procedure for when a skill in the production phase requires modification.

## When to Use This Procedure

**Trigger**: When a production phase skill needs to be modified

**Examples**:
- Bug fix
- Feature improvement
- Performance optimization
- Compatibility fix
- Security patch

## Procedure Steps

### Step 1: Rollback to Design Phase

**Initiator**: Anyone who identifies the need for change

**Action**:
1. Lifecycle-manager rolls back the skill's phase from "production" to "design"
2. Record the rollback in the Phase History of `doc/lifecycle/skills/[skill-name].md`

**Example**:
```markdown
## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-15 | - | design | Initial creation | pm |
| 2026-05-25 | review | production | Acceptance criteria met | auditor |
| 2026-05-29 | production | design | Bug fix needed: incorrect trigger conditions | lifecycle-manager |
```

### Step 2: Create Branch

**Branch naming**: `skill-update/[skill-name]`

**Example**:
```bash
git checkout -b skill-update/meeting-facilitation
```

### Step 3: Implement Changes

**Action**:
1. Modify the skill file (`skills/[skill-name]/SKILL.md`)
2. Update related documentation (e.g., README, examples)
3. Test and validate

**Commit message format**:
```
skill-update: [skill-name] - [brief description]

Detail: [detailed explanation of changes]
Reason: [why this change is needed]
Impact: [what behavior changes]
```

### Step 4: Update Lifecycle Document

**Action**: Update `doc/lifecycle/skills/[skill-name].md`

**Add to Phase History**:
```markdown
| 2026-05-29 | design | review | Bug fix complete, ready for re-validation | lifecycle-manager |
```

**Update Acceptance Criteria** (if changed):
```markdown
## Acceptance Criteria

### Design Phase (Modified)
- [x] Bug fix implemented: trigger conditions now correctly handle edge cases
- [x] Additional test cases added for edge case coverage
```

### Step 5: Create Pull Request

**PR Title Format**:
```
[skill-update] [skill-name]: [brief description]
```

**PR Body Template**:
```markdown
## Skill Update

**Skill**: [skill-name]
**Previous Phase**: production → design → review
**Update Type**: [bug fix / feature enhancement / performance improvement / security patch]

## Changes

### What Changed
- [Change 1]
- [Change 2]
- [Change 3]

### Why This Change Was Needed
[Detailed explanation of the issue or improvement opportunity]

### Impact on Behavior
- **Before**: [previous behavior]
- **After**: [new behavior]
- **Breaking Changes**: [yes/no - if yes, detail the impact]

## Acceptance Criteria Changes

### Previous Acceptance Criteria
- [x] [old criterion 1]
- [x] [old criterion 2]

### Updated Acceptance Criteria
- [x] [old criterion 1]
- [x] [old criterion 2]
- [x] [new criterion 3] (added)

## Testing

- [x] Tested locally with [test scenario]
- [x] Verified no regression in [use case]
- [x] Edge case [specific edge case] now handled correctly

## Documentation Updates

- [x] SKILL.md updated
- [x] Lifecycle document updated
- [x] Examples updated (if applicable)
- [x] README updated (if applicable)

## Checklist

- [ ] Phase history updated in lifecycle document
- [ ] Acceptance criteria updated (if changed)
- [ ] All tests passing
- [ ] No breaking changes (or documented if present)
- [ ] Ready for auditor review

## Reviewer Notes

Please validate:
1. Changes align with skill purpose
2. No breaking changes without documentation
3. Acceptance criteria remain appropriate
4. Lifecycle documentation is complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Step 6: Auditor Review

**Reviewer**: Auditor

**Validation Checklist**:
- [ ] Changes align with skill purpose
- [ ] No breaking changes without proper documentation
- [ ] Acceptance criteria remain appropriate for production phase
- [ ] Lifecycle documentation is complete and accurate
- [ ] All tests passing
- [ ] No security implications

**Review Decision**:
- **Approve**: Changes are ready for production
- **Request Changes**: Additional work needed before approval
- **Reject**: Changes not appropriate for this skill

### Step 7: Re-Promote to Production

**Action**:
1. After PR merge, Auditor approves
2. Lifecycle-manager promotes the phase from "review" to "production"
3. Record the promotion in the Phase History of `doc/lifecycle/skills/[skill-name].md`

**Example**:
```markdown
| 2026-05-29 | review | production | Bug fix validated, re-promoted to production | auditor |
```

### Step 8: Post-Merge Tasks

**Action**:
1. Merge PR
2. Update CHANGELOG.md (if significant change)
3. Archive meeting transcript (if from meeting)
4. Communicate change to team (if breaking change)

## Emergency Hotfix Procedure

**For urgent fixes without full rollback**:

1. **Document hotfix in Phase History**:
   ```markdown
   | 2026-05-29 | production | production | Hotfix: critical bug fix, remaining in production | auditor |
   ```

2. **Create PR with `[hotfix]` prefix**:
   ```
   [skill-update][hotfix] [skill-name]: [critical fix description]
   ```

3. **Expedited review**: Tag as "high priority" for immediate review

4. **Monitor after merge**: Track hotfix effectiveness, full review if issues persist

## Rollback Procedure (If Update Fails)

**If re-promoted skill has issues**:

1. **Immediate rollback**:
   - Lifecycle-manager changes phase to "design"
   - Document rollback in Phase History
   - Notify team via PR comment or meeting

2. **Investigation**:
   - Auditor investigates root cause
   - Architect validates fix approach (if architectural issue)

3. **Re-promotion**:
   - Fix must pass full design → review → production cycle
   - Update lifecycle document with new promotion history

## Acceptance Criteria for Skill Update

**Design Phase** (after rollback):
- [x] Update requirements clearly defined
- [x] Impact on existing usage understood
- [x] Breaking changes identified (if any)

**Review Phase** (before re-promotion):
- [x] Changes implemented correctly
- [x] All tests passing (including edge cases)
- [x] No regression in existing functionality
- [x] Documentation complete and accurate

**Production Phase** (after re-promotion):
- [x] All review phase criteria met
- [x] Successfully validated in real scenario
- [x] No known critical bugs
- [x] Team notified of changes (if breaking)

## Governance

**Enforcement**:
- Auditor must validate all skill updates before re-promotion to production
- Lifecycle-manager maintains phase history accuracy
- PM orchestrates the update workflow

**Metrics**:
- Track number of rollbacks per skill (quality indicator)
- Track time in design phase (efficiency indicator)
- Track post-production issues (effectiveness indicator)

## Best Practices

✅ **DO**:
- Document rollback reasons clearly
- Include comprehensive testing in PR
- Update acceptance criteria if behavior changes
- Communicate breaking changes to team
- Monitor skill effectiveness after update

❌ **DON'T**:
- Skip documentation updates
- Merge without auditor approval
- Update acceptance criteria without justification
- Make breaking changes without team communication
- Leave skill in design phase for extended periods
