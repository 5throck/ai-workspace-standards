Run the full project sync pipeline.

Arguments: $ARGUMENTS

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
