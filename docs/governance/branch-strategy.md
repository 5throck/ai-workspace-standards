# Branch Strategy

## Main Branch

**`main`**: Production-ready code
- Protected branch
- Direct commits forbidden
- PR required for all changes
- Must pass all tests and audits

## Branch Types

### Feature Branches

**Purpose**: New feature development
**Naming**: `feat/<feature-name>`
**Create from**: `main`
**Merge into**: `main` (via PR)
**Lifetime**: Short-lived (days, not weeks)

**Example**:
```bash
git checkout -b feat/oauth2-login
# ... work ...
git push origin feat/oauth2-login
# Create PR from branch
```

### Fix Branches

**Purpose**: Bug fixes
**Naming**: `fix/<bug-description>`
**Create from**: `main` (or release branch if urgent)
**Merge into**: `main` (via PR)
**Lifetime**: Very short-lived (hours to days)

**Example**:
```bash
git checkout -b fix/memory-leak-in-auth
# ... work ...
git push origin fix/memory-leak-in-auth
# Create PR from branch
```

### Release Branches

**Purpose**: Release preparation
**Naming**: `release/<version>`
**Create from**: `main`
**Merge into**: `main` + `main` tagged
**Lifetime**: Short-lived (release preparation period)

**Example**:
```bash
git checkout -b release/v1.2.0
# ... finalize release ...
git push origin release/v1.2.0
# Create PR, merge, tag v1.2.0
```

### Hotfix Branches

**Purpose**: Urgent production fixes
**Naming**: `hotfix/<version>`
**Create from**: `main` (or tag)
**Merge into**: `main` + `main` tagged
**Lifetime**: Extremely short-lived (immediate fix)

**Example**:
```bash
git checkout -b hotfix/v1.2.1
# ... urgent fix ...
git push origin hotfix/v1.2.1
# Create PR, merge, tag v1.2.1
```

## Workflow Rules

### 1. Branch Protection

**`main` branch protection**:
- ✅ Require pull request before merging
- ✅ Require status checks (tests, audit) to pass
- ✅ Require 1 reviewer approval
- ❌ Restrict pushes (maintainers only)
- ❌ Do not allow bypassing rules

### 2. Branch Hygiene

**Keep branches clean**:
- Delete merged branches immediately
- Don't stack unrelated changes in one branch
- Rebase frequently to keep up with `main`
- Resolve conflicts before PR submission

### 3. Commit Rules

**Follow conventional commits**:
```
feat: add user authentication
fix: resolve memory leak in auth module
docs: update installation guide
refactor: simplify auth flow
test: add integration tests for auth
chore: update dependencies
security: patch CVE-2024-12345
```

**Forbidden**:
- No "WIP" or "TODO" commits
- No broken commits that fail tests
- No commits with bypassed hooks (`--no-verify`)

### 4. Synchronization

**Before starting work**:
```bash
git checkout main
git pull origin main
# Verify up-to-date
```

**Before pushing**:
```bash
git pull origin main --rebase
# Resolve conflicts if any
# Run tests and audit
git push origin <branch>
```

### 5. PR Merging

**Merge methods**:
- **Feature branches**: Merge commit (preserves history)
- **Fix branches**: Squash and merge (clean history)
- **Release/hotfix**: Merge commit (preserves release history)

**Auto-delete**: Delete branch after merge (automatic)

## Emergency Procedures

### Hotfix Workflow

For production emergencies:

1. Create hotfix from `main`:
   ```bash
   git checkout -b hotfix/critical-fix
   ```

2. Implement and test fix:
   ```bash
   # ... implement fix ...
   bun test
   bun scripts/audit.ts
   ```

3. Push and create PR:
   ```bash
   git push origin hotfix/critical-fix
   # Create PR, mark as urgent
   ```

4. Expedite review and merge:
   - Tag PR as "high priority"
   - Request immediate review
   - Merge once approved

5. Tag and deploy:
   ```bash
   git checkout main
   git pull origin main
   git tag v1.x.y
   git push origin v1.x.y
   ```

### Rollback Procedure

If a bad merge reaches `main`:

1. **Revert commit**:
   ```bash
   git revert <bad-commit-hash>
   git push origin main
   ```

2. **Hotfix if needed**:
   - Create `hotfix/` branch
   - Fix properly
   - PR and merge

3. **Post-mortem**:
   - Document what went wrong
   - Update procedures to prevent recurrence
   - Add tests to catch regression

## Branch Cleanup

**Automated cleanup**:
- Merged branches auto-deleted via PR settings
- Stale branches (>30 days) flagged for cleanup
- Abandoned branches (>90 days) force-deleted

**Manual cleanup**:
```bash
# List merged branches
git branch --merged

# Delete local merged branches
git branch -d <branch-name>

# Delete remote branches
git push origin --delete <branch-name>
```

## Best Practices

✅ **DO**:
- Keep branches short-lived
- Write descriptive branch names
- Rebase frequently to stay current
- Delete branches after merge
- Run full test suite before PR

❌ **DON'T**:
- Work directly on `main`
- Stack unrelated changes in one branch
- Keep long-running branches
- Bypass PR reviews (except emergencies)
- Merge broken code
