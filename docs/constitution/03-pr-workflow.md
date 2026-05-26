> Part of [CONSTITUTION.md](../../CONSTITUTION.md) — §3 GitHub PR Workflow
> **Do not edit in isolation** — changes must be reflected in the hub index.

### 3. GitHub PR Workflow

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
- Each project must have `scripts/dev-sync.sh` and `scripts/dev-sync.ps1` adhering to the script parity rule.
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
