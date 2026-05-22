Run the full project sync pipeline.

Arguments: $ARGUMENTS

## Pipeline steps

Execute the following steps **in order**:

### Step 1 — Security advisory check (public repositories only)

Before committing, check whether this repository is public:

```bash
gh repo view --json isPrivate -q '.isPrivate' 2>/dev/null || echo "unknown"
```

- If the output is `false` (public repo): run `/security-check --pr`.
  - If the check finds active CRITICAL or HIGH advisories → present them to the user and
    ask whether to **proceed** or **stop to resolve first** (do not hard-block).
  - If the check passes or the user chooses to proceed → continue to Step 2.
- If the output is `true` or `unknown`: skip the check and continue.

### Step 2 — Sync pipeline

Execute the following bash command exactly as written:

```bash
bash scripts/dev-sync.sh "$ARGUMENTS"
```

The pipeline will:
1. Append a session entry to `memory/YYYY-MM-DD.md`
2. Update `memory/MEMORY.md` index via `sync-md.sh`
3. Auto-add `$ARGUMENTS` to `CHANGELOG.md [Unreleased]` if the section has no entries yet
4. Run `audit.sh` — must exit 0 before proceeding
5. Create a new PR branch, commit all staged changes, push, and open a GitHub PR

If audit fails, fix the reported issue before re-running `/sync`.
