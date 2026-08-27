# Appendix F: GitHub Templates

This appendix holds the standard templates for Issues, Pull Requests, and Discussions in the Safety OS repository.

## 1. Pull Request Template

**File**: `.github/pull_request_template.md`

```markdown
## Description
Describe the changes introduced by this PR.

## EHS Agent Impact
- [ ] Modifies Agent Instructions
- [ ] Updates an Evidence Schema
- [ ] Modifies Workflow Definitions

## Quality Checklist
- [ ] Run `bun scripts/audit.ts`
- [ ] English language strictly used
- [ ] `legal_basis` present on new workflows
- [ ] PR Title follows conventional commits

## Related Issues
Fixes #
```

## 2. Bug Report Issue Template

**File**: `.github/ISSUE_TEMPLATE/bug_report.md`

```markdown
**Describe the bug**
A clear and concise description of what the bug is.

**Affected Agent / Component**
Which agent or script is failing?

**Steps to Reproduce**
1. 
2. 

**Expected behavior**
A clear and concise description of what you expected to happen.
```
