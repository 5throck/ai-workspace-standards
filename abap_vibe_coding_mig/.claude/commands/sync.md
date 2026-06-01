---
name: sync
description: Sync today's development session to Git — run the documentation audit, update the memory index, and commit all changes with a conventional commit message.
argument-hint: "<conventional-commit-message>"
allowed-tools: ["Bash"]
---

# Sync

Sync today's development session to Git: run the documentation audit, update the memory index, and commit all changes.

Run:

```bash
bash "${CLAUDE_PLUGIN_ROOT:-.}/scripts/dev-sync.sh" "$ARGUMENTS"
```

$ARGUMENTS should be a conventional commit message (e.g. `feat: add ZCL_MY_CLASS`).
If $ARGUMENTS is empty, prompt the user for a commit message before running.

The script will:
1. Run the documentation audit (vsp-audit) — aborts if audit fails
2. Verify today's memory log exists in memory/YYYY-MM-DD.md
3. Update the MEMORY.md index
4. Commit all staged changes with the provided message

Report the result clearly (success or failure with reason).

## Pre-PR Security Gate (public repos only)

Before pushing/creating PR, check if the repo is public:

```bash
gh repo view --json isPrivate -q '.isPrivate' 2>/dev/null
```

If the result is `false` (public repo): run `/security-check --pr` (read-only advisory check).

- If CRITICAL advisories are found: show the warning and **pause** — let the user decide whether to proceed or stop.
- If no CRITICAL advisories: continue with push and PR.

For private repos: skip this gate entirely.
