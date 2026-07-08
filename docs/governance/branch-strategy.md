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

**`main` branch protection** (actual configured state — applied via
`bun scripts/setup-github-branch-protection.ts`, see script docstring for usage):
- ✅ Require pull request before merging — enforced by `scripts/hooks/pre-push.ts`
  blocking direct pushes to `main`/`master` (checked against the actual pushed
  ref, not just the locally checked-out branch)
- ✅ Require status checks (the repo's CI workflow job names) to pass before
  merging — configured as GitHub required status checks so `gh pr merge --auto`
  genuinely waits instead of merging immediately
- ❌ Require reviewer approval — **not required**. This workspace is
  maintained by a single owner whose commits are produced through the automated
  `/sync` pipeline (see [pr-workflow.md](pr-workflow.md)); a mandatory second
  reviewer has no one to satisfy it and would either block every PR or need a
  manual admin override on every single merge. If a second maintainer joins,
  add `required_pull_request_reviews` via the GitHub branch protection UI/API.
- ❌ Restrict pushes (maintainers only) — not configured; redundant with the
  direct-push-to-main block above for a single-maintainer repo
- ❌ Do not allow bypassing rules — `enforce_admins` is left `false` so the
  repo owner can still override in a genuine emergency; see Rollback Procedure
  below

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

**Merge method**: Merge commit for every branch type, regardless of prefix
(`feat/`, `fix/`, `release/`, `hotfix/`). This is what `scripts/dev-sync.ts`
and `gh pr merge --merge` actually use, and matches this repo's entire commit
history (`git log` shows "Merge pull request #N from ..." for every PR) — there
is no squash-merge path in the pipeline today. If per-type merge methods are
ever wanted, `dev-sync.ts` would need an explicit `--merge-method` decision
based on branch prefix; until then, treat "merge commit for everything" as the
actual rule, not the table that used to be here.

**Auto-delete**: Delete branch after merge (`delete_branch_on_merge` repo
setting — applied via `bun scripts/setup-github-branch-protection.ts`)

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
