Append a session summary entry to today's memory log file.

Arguments: $ARGUMENTS

Steps:
1. Determine today's date in YYYY-MM-DD format.
2. Ensure `memory/` directory exists.
3. Append the following to `memory/YYYY-MM-DD.md` (create if missing):
   ```
   ## Session — $ARGUMENTS
   ```
   If $ARGUMENTS is empty, use `## Session — update` as the heading.
4. Update `memory/MEMORY.md` index by appending a row:
   `| [YYYY-MM-DD](YYYY-MM-DD.md) | $ARGUMENTS |`
   (Create MEMORY.md with header row if it does not exist.)
5. Confirm: "📝 Session logged to memory/YYYY-MM-DD.md"

Note: `/sync` already runs memlog automatically. Use `/memlog` only when you want to log a session entry without triggering a full sync.
