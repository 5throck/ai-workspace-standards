# Pull Request Workflow

## Mandatory English Artifacts

All Git artifacts must be written in English - **no exceptions**:

- **Commit messages**: Summarize changes in present tense (e.g., "feat: Add user authentication")
- **PR titles**: Concise, following conventional commit format (e.g., "feat: Add OAuth2 login flow")
- **PR bodies**: Describe what changed and why, with testing notes
- **Review comments**: All feedback must be in English

## PR Creation Process

### 1. Pre-PR Checklist

Before creating a PR, ensure:
- [ ] All tests pass (`bun test` or equivalent)
- [ ] Audit passes (`bash scripts/audit.sh`)
- [ ] CHANGELOG.md entry added (use `/changelog` command)
- [ ] No secrets committed (check `.gitleaks` output)
- [ ] Documentation updated (if applicable)

### 2. PR Title Format

Follow conventional commit format:

```
<type>: <description>

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- refactor: Code restructuring (no behavior change)
- chore: Maintenance tasks
- perf: Performance improvements
- test: Test additions or modifications
- security: Security vulnerability fixes
```

**Special Prefix for Skill Updates**:
When updating a production-phase skill, use the `[skill-update]` prefix:

```
[skill-update] [skill-name]: [brief description]
```

**Example**:
```
[skill-update] meeting-facilitation: Fix participant ordering bug
```

**For urgent skill fixes**, add the `[hotfix]` prefix:
```
[skill-update][hotfix] [skill-name]: Critical fix description
```

**Note**: Skill updates must follow the [Skill Update Procedure](skill-update-procedure.md)

### 3. PR Body Template

#### Standard PR Template

```markdown
## Summary
[Brief description of changes - 2-3 bullet points]

## Test plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed (if applicable)
- [ ] Audit passes (`bash scripts/audit.sh`)

## Breaking changes
[List any breaking changes here, or "None"]

## Checklist
- [ ] CHANGELOG.md updated
- [ ] Documentation updated
- [ ] No secrets committed
- [ ] All tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

#### Skill Update PR Template

For production-phase skill updates, use this expanded template:

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

**See also**: [Skill Update Procedure](skill-update-procedure.md) for detailed workflow

### 4. PR Review Process

**Minimum approvers**:
- 1 reviewer for documentation changes
- 1 reviewer for code changes
- 1 security-expert reviewer for security-related changes

**Review criteria**:
- Code quality and maintainability
- Test coverage
- Documentation accuracy
- Security implications (if applicable)
- Alignment with CONSTITUTION.md standards

### 5. Merge Rules

**Auto-merge allowed when**:
- All tests passing
- All approvals received
- No conflicts
- CHANGELOG.md entry present

**Manual merge required for**:
- Breaking changes
- Security fixes
- Template structure changes
- Cross-platform script changes

## Branch Naming

Use descriptive branch names:
- `feat/<feature-name>` - New features
- `fix/<bug-description>` - Bug fixes
- `docs/<doc-change>` - Documentation changes
- `refactor/<component>` - Code restructuring
- `security/<cve-id>` - Security fixes
- `skill-update/<skill-name>` - Production-phase skill updates

**Example**:
```bash
git checkout -b skill-update/meeting-facilitation
```

## Post-Merge

After merge:
1. Run `/sync "feat: ..."` to finalize
2. Verify memory log entry created
3. Update AGENTS.md if agent changes
4. Archive meeting transcripts if applicable
