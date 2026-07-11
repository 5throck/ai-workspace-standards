> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §3 GitHub PR Workflow
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 3. GitHub PR Workflow {#github-pr-workflow}

#### 3.1 Core Rule

**All changes must reach `main` via a Pull Request - never by direct push.**

```
Edit code
  ↓  Post-Write Verification (Manually run audit scripts in Gemini/Desktop app, automated in CLI hooks)

/changelog "added|changed|fixed|removed <description>" (optional)
  ↓  Entry added to CHANGELOG.md under [Unreleased]

/sync "feat: description" (or running dev-sync scripts directly)
  ↓
  1. memory/YYYY-MM-DD.md     - append session log entry
  2. MEMORY.md index         - update entry
  3. CHANGELOG.md            - auto-insert commit message if [Unreleased] is empty
  4. Audit script execution  - abort on failure (includes CHANGELOG.md existence check)
  5. git checkout -b pr/<date>-<slug>
  6. git add -A && git commit
  7. git push + gh pr create ➔ GitHub PR opened (Direct push blocked by local hooks)
```

#### 3.2 Rules
- Each project must have `scripts/dev-sync.ts` runnable via `bun scripts/dev-sync.ts` (ADR-0036 — TypeScript-only scripts policy).
- **Mandatory English Git & PR Artifacts**: All Git and GitHub-related artifacts (including commit messages, pull request titles, pull request descriptions/bodies, branch names, and code review comments) **MUST** be written entirely in **English**, regardless of the developer's native or session conversation language. Always double-check before pushing.
- **Conventional Commits Standard**: All commits in this workspace must adhere to the Conventional Commits specification:

  | Prefix | When to use |
  | :--- | :--- |
  | `feat:` | New feature |
  | `fix:` | Bug fix |
  | `docs:` | Documentation only |
  | `refactor:` | Code change with no new feature or fix |
  | `chore:` | Tooling, build, configurations |
  | `test:` | Adding or modifying tests |
  | `perf:` | Performance improvement (no feature/fix) |
  | `ci:` | CI/CD pipeline changes |
  | `style:` | Formatting only (no logic change) |
  | `revert:` | Revert a previous commit |

- **Branch Naming Standard**: Active development branches must follow the strict pattern: `pr/<YYYYMMDD-HHmmss>-<slug>` (automatically formatted and switched by `dev-sync` scripts).
- **GitHub PR Requirements**: The GitHub CLI (`gh`) must be installed and authenticated (`gh auth login`) globally to automate PR creation.
- **Forced Local Git Hooks**: Before triggering commits or PR workflows, all active sessions must ensure Git configuration points to local hooks:
  ```bash
  git config core.hooksPath .githooks
  ```
  This binds local automated hooks (like `pre-push` blocking direct `main` push, and `pre-commit` validating changelog compliance) forcibly.
- Workflow scripts must avoid interactive prompts to prevent terminal hangs during automated agent runs.
- `/changelog` is **optional** - run it before syncing when your change needs a user-visible entry in `CHANGELOG.md`. Skip it for internal refactors, formatting, or tooling changes.
- Project-specific PR settings live in `.gemini/settings.json` or `.claude/settings.json` - kept version-controlled and shared with the team.

#### 3.3 Sequential Branch Dependency Rule

**Before creating a new PR branch from `main`, confirm any previously-created-but-unmerged PR branch is either merged first, or explicitly justified as safe to leave open in parallel.**

**Why this matters**: `dev-sync.ts` touches shared pipeline files on *every* commit regardless of which workstream a PR belongs to — `CHANGELOG.md` (`[Unreleased]` section), `memory/YYYY-MM-DD.md`, `docs/VERSION_MANIFEST.md`, `scripts/README.md`, and `templates/common/scripts/README.md`. If two PR branches are both created from the same stale `main` (i.e., neither has merged), both will edit the same lines in these shared files relative to the same merge-base — producing a real git merge conflict on *every* such PR, regardless of what order they are later merged in. Merging in sequence does not undo this: the conflict is baked in at branch-creation time, not merge time, because each branch's diff is computed against whichever `main` existed when it was created.

**Rule**:
1. Before running `dev-sync.ts` to open a new PR while a prior PR from the same session is still open and unmerged, check whether the new branch's work will touch any of the shared pipeline files above (it almost always will, since every `/sync` run does).
2. If so, merge the prior PR **first** — do not fan out multiple parallel branches from the same stale `main`.
3. If genuinely parallel work is required (e.g., a large multi-workstream execution plan), state explicitly in the plan/design doc why the specific PRs are safe to leave open simultaneously (e.g., a documented list of files each touches, confirmed disjoint) — an unstated assumption of independence is not sufficient, since the shared pipeline files above make near-total overlap the default case, not the exception.
4. For a PM-orchestrated multi-row execution plan (per §5.1 in AGENTS.md) that spans more than one PR, treat "merge the prior PR" as an implicit step between PR-producing rows unless the plan's Trade-offs section explicitly justifies parallel branching.
5. **Applies to project templates too**: `templates/common/CLAUDE.md` and `templates/common/GEMINI.md` carry the same rule (see their "Commit Protection" sections) so that projects scaffolded via `new-project.ts` inherit this discipline from day one, not just the workspace root.
