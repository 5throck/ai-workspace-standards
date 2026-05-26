Append a session summary entry to today's memory log file.

Arguments: $ARGUMENTS

Steps:
1. Determine today's date in YYYY-MM-DD format.
2. Ensure `memory/` directory exists.
3. Append to `memory/YYYY-MM-DD.md` (create if missing) using the mandatory 4-section format:
   ```
   ## Session Summary
   <!-- One paragraph: what was accomplished this session -->
   $ARGUMENTS

   ## Changes
   <!-- File-level list of what was created, modified, or deleted -->
   - `path/to/file` — created/modified/deleted: reason

   ## Decisions
   <!-- Architectural or design choices made, with rationale -->
   - None

   ## Open Issues
   <!-- Unresolved problems, blockers, or follow-up items -->
   - None
   ```
   If `memory/YYYY-MM-DD.md` already has content, prepend a `---` separator before the new entry.
4. Update `memory/MEMORY.md` index by appending a row:
   `| [YYYY-MM-DD](YYYY-MM-DD.md) | $ARGUMENTS |`
   (Create MEMORY.md with header row if it does not exist.)
5. Fill in `## Changes` by listing any files that were written or edited in this session.
6. Fill in `## Decisions` and `## Open Issues` based on what was discussed or left pending.
7. Confirm: "📝 Session logged to memory/YYYY-MM-DD.md"

> **Format note**: The four section headings (`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) are mandatory. All AI tools must produce logs with these exact headings for cross-tool consistency. See CONSTITUTION.md §2 or docs/context.md § Documentation Standards.

Note: `/sync` already runs memlog automatically. Use `/memlog` only when you want to log a session entry without triggering a full sync.
