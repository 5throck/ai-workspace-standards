# Lifecycle Documentation

## Purpose

Records and governs the lifecycle of agents and skills.

## File Structure

```
doc/lifecycle/
├── README.md (this file)
├── agents/
│   ├── pm.md
│   ├── architect.md
│   ├── automation-engineer.md
│   ├── auditor.md
│   ├── docs-writer.md
│   ├── lifecycle-manager.md
│   └── ...
├── skills/
│   ├── skill-lifecycle-manager.md
│   ├── agent-lifecycle-manager.md
│   ├── meeting-facilitation.md
│   └── ...
└── templates/
    ├── co-design.md
    ├── co-develop.md
    ├── co-work.md
    ├── co-security.md
    └── common.md
```

## Required Sections

Each `[agent/skill/template].md` file MUST include the following sections:

### 1. Creation Date

**Format**:
```markdown
Created: [YYYY-MM-DD]
```

**Purpose**: Records when the agent/skill was created

**Example**:
```markdown
Created: 2026-05-15
```

### 2. Phase History

**Format**:
```markdown
## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| [YYYY-MM-DD] | [from-phase] | [to-phase] | [reason] | [approver] |
```

**Purpose**: Tracks phase change history and records approvers

**Phases**:
- **design**: Initial design phase
- **review**: Review and validation phase
- **production**: Available for use in production environment
- **deprecated**: No longer in use (usually has a replacement)

**Example**:
```markdown
## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-05-15 | - | design | Initial creation | pm |
| 2026-05-20 | design | review | Design complete, ready for review | architect |
| 2026-05-25 | review | production | Acceptance criteria met | auditor |
```

### 3. Acceptance Criteria

**Format**:
```markdown
## Acceptance Criteria

### [Phase Name] Phase

- [x] [criterion-1]
- [x] [criterion-2]
- [ ] [criterion-3] (optional)
```

**Purpose**: Defines the satisfaction criteria for each phase

**Example**:
```markdown
## Acceptance Criteria

### Design Phase

- [x] Agent role clearly defined
- [x] Tier assignment justified
- [x] Dispatch protocol specified

### Review Phase

- [x] Architect reviewed design
- [x] No role overlap with existing agents
- [x] Template structure validated

### Production Phase

- [x] All acceptance criteria from review phase met
- [x] Successfully tested in real scenario
- [x] Documentation complete (README, examples)
```

### 4. Dependencies (Optional)

**Format**:
```markdown
## Dependencies

- [dependency-1]
- [dependency-2]
```

**Purpose**: Specifies dependencies on other agents/skills

**Example**:
```markdown
## Dependencies

- architect (for design validation)
- automation-engineer (for script implementation)
- skill-lifecycle-manager (for lifecycle tracking)
```

## Phase Transition Rules

### 1. Design → Review

**Trigger**: Approved by Architect or Domain Expert
**Requirements**:
- Agent role clearly defined
- Tier assignment justified
- Dispatch protocol specified
- No critical design gaps

**Approver**: Architect, Domain Expert, or PM

### 2. Review → Production

**Trigger**: Approved by Auditor after validating acceptance criteria
**Requirements**:
- All review phase acceptance criteria met
- Successfully tested in real scenario
- Documentation complete
- No known critical bugs

**Approver**: Auditor

### 3. Production → Design (Rollback)

**Trigger**: Lifecycle-manager initiates rollback when a fix is required
**Requirements**:
- Bug discovered that requires design change
- Feature addition that changes agent role
- Performance issue requiring architectural change

**Approver**: Lifecycle-manager, Architect

### 4. Production → Deprecated

**Trigger**: Replacement available or no longer needed
**Requirements**:
- New agent/skill replaces this one
- Or agent/skill no longer aligns with current architecture

**Approver**: PM, Architect

## Validation

### Automated Validation

**Scripts**:
- `scripts/validate-skills.sh`: Validates required sections in all `skills/*.md` files
- `scripts/validate-agents.sh`: Validates required sections in all `agents/*.md` files
- `scripts/validate-doc-folder.sh`: Confirms no lifecycle-related files exist in the workspace root

**Pre-commit hook**:
```bash
# .git/hooks/pre-commit
bun scripts/validate-skills.sh
bun scripts/validate-agents.sh
bash scripts/validate-doc-folder.sh
```

**Validation failures**:
- ❌ Missing required sections → commit blocked
- ⚠️ Optional sections missing → commit allowed with warning

### Manual Validation

**Before phase transition**:
1. Review phase history completeness
2. Verify all acceptance criteria met
3. Check dependencies are still valid
4. Ensure documentation is up-to-date

## Lifecycle Templates

### Agent Lifecycle Template

```markdown
# [Agent Name] Lifecycle

## Created

[YYYY-MM-DD]

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| [YYYY-MM-DD] | - | design | Initial creation | [creator] |

## Acceptance Criteria

### Design Phase

- [x] Agent role clearly defined
- [x] Tier assignment justified
- [x] Dispatch protocol specified
- [x] No role overlap with existing agents

### Review Phase

- [x] Architect reviewed design
- [x] No role overlap with existing agents
- [x] Template structure validated
- [x] Integration with workflow verified

### Production Phase

- [x] All review phase criteria met
- [x] Successfully tested in real scenario
- [x] Documentation complete
- [x] No known critical bugs

## Dependencies

- [dependency-1]
- [dependency-2]

## Metadata

- **Current Phase**: [design/review/production/deprecated]
- **Owner**: [agent-name]
- **Last Updated**: [YYYY-MM-DD]
- **Last Reviewer**: [reviewer-name]
```

### Skill Lifecycle Template

```markdown
# [Skill Name] Lifecycle

## Created

[YYYY-MM-DD]

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| [YYYY-MM-DD] | - | design | Initial creation | [creator] |

## Acceptance Criteria

### Design Phase

- [x] Skill purpose clearly defined
- [x] Trigger conditions specified
- [x] Examples provided
- [x] No overlap with existing skills

### Review Phase

- [x] Skill description ≥ 50 characters
- [x] ## Trigger or ## When to Use section exists
- [x] At least 1 example provided
- [x] Agent-skill version consistency checked

### Production Phase

- [x] All review phase criteria met
- [x] Successfully tested in real scenario
- [x] Documentation complete
- [x] No known critical bugs

## Dependencies

- [agent-dependency-1]
- [skill-dependency-2]

## Usage Statistics

- **First Used**: [YYYY-MM-DD]
- **Last Used**: [YYYY-MM-DD]
- **Total Invocations**: [count] (if tracked)

## Metadata

- **Current Phase**: [design/review/production/deprecated]
- **Owner**: [agent-name]
- **Last Updated**: [YYYY-MM-DD]
- **Last Reviewer**: [reviewer-name]
```

## Governance

### Phase Promotion Workflow

1. **Create** (Design phase):
   - Create agent/skill file
   - Create lifecycle document in `doc/lifecycle/`
   - Set phase to "design"

2. **Review**:
   - Submit for architectural review
   - Address feedback
   - Update lifecycle document with review history
   - Set phase to "review"

3. **Production**:
   - Auditor validates acceptance criteria
   - Update lifecycle document with promotion history
   - Set phase to "production"

4. **Rollback** (if needed):
   - Lifecycle-manager initiates rollback
   - Update lifecycle document with rollback reason
   - Set phase back to "design"

### Post-Promotion Tasks

**After promotion to production**:
- [ ] Update AGENTS.md (for agents)
- [ ] Update .claude/commands/ (for skills that are commands)
- [ ] Run integration tests
- [ ] Document in project CHANGELOG.md
- [ ] Archive meeting transcript (if from meeting)

## Maintenance

### Regular Reviews

**Quarterly review**:
- Check all production agents/skills for continued relevance
- Update dependencies if needed
- Validate acceptance criteria still met
- Archive or deprecate if no longer needed

### Deprecation Process

**When to deprecate**:
- Agent/skill replaced by newer version
- Agent/skill no longer aligns with current architecture
- Agent/skill has critical unfixable issues

**Deprecation steps**:
1. Update lifecycle document with deprecation reason
2. Set phase to "deprecated"
3. Document replacement (if any)
4. Update references in other files
5. Communicate deprecation to team

## Emergency Procedures

### Rollback Procedure

**If production agent/skill has critical issue**:

1. **Immediate rollback**:
   - Lifecycle-manager changes phase to "design"
   - Document rollback reason and timestamp
   - Notify team via meeting or PR comment

2. **Issue investigation**:
   - Architect investigates root cause
   - Auditor validates fix approach
   - Update lifecycle document with findings

3. **Re-promotion**:
   - Fix must pass full review → production cycle
   - Update lifecycle document with new promotion history
   - Ensure acceptance criteria updated if needed

### Hotfix Procedure

**For minor fixes without full rollback**:

1. **Document hotfix**:
   - Update lifecycle document Phase History
   - Note "hotfix" in reason column
   - Keep phase as "production"

2. **Validate**:
   - Auditor validates hotfix
   - Run targeted tests
   - Document in meeting transcript

3. **Monitor**:
   - Track hotfix effectiveness
   - Full review if issues persist
