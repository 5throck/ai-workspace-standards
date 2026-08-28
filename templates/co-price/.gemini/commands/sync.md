---
name: sync
description: Sync today's development session to Git — run the documentation audit, update the memory index, commit all changes, push, and create a GitHub PR.
argument-hint: "<conventional-commit-message>"
allowed-tools: ["Bash"]
---

# Sync

Sync today's development session to Git with full quality gate.

Run:

```bash
bun scripts/dev-sync.ts "$ARGUMENTS"
```

$ARGUMENTS should be a conventional commit message (e.g. `feat: add breakeven formula`).
If $ARGUMENTS is empty, the script will prompt for a commit message.

The script will:
1. Run documentation audit (`scripts/audit.ts`) — aborts if audit fails
2. Verify today's memory log exists in `memory/YYYY-MM-DD.md` (auto-creates if missing)
3. Update the `memory/MEMORY.md` index
4. `git add -A` and commit with the provided message
5. Push to origin (creates a `pr/<date>-<slug>` branch if on `main`)
6. Create a GitHub PR via `gh pr create`

Report the result clearly (success or failure with reason).
