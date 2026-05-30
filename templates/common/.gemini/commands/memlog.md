Append a session summary entry to today's memory log file.

Arguments: $ARGUMENTS

Steps:
1. Determine today's date in YYYY-MM-DD format.
2. Ensure `memory/` directory exists.
3. Collect context automatically:
   - Run `git diff --name-only HEAD` to get the list of files changed in this session.
   - Run `git log --oneline -5` to see recent commit messages for context.
4. Append to `memory/YYYY-MM-DD.md` (create if missing) using the mandatory 4-section format:
   ```
   ## Session Summary
   $ARGUMENTS

   ## Changes
   <!-- Auto-populated from git diff --name-only HEAD -->
   - `path/to/file` — brief description of what changed

   ## Decisions
   <!-- Fill in architectural or design choices made this session, with rationale -->
   - None

   ## Open Issues
   <!-- Fill in unresolved problems, blockers, or follow-up items -->
   - None
   ```
   If `memory/YYYY-MM-DD.md` already has content, prepend a `---` separator before the new entry.
5. After writing the entry:
   - Fill in `## Changes` from the git diff output collected in step 3.
   - Fill in `## Decisions` based on key architectural/design choices discussed this session.
   - Fill in `## Open Issues` based on any unresolved problems or follow-up items.
6. Update `memory/MEMORY.md` Sessions section — run:
   ```bash
   bun run scripts/sync-md.ts "YYYY-MM-DD" "$ARGUMENTS"
   ```
7. Confirm: "📝 Session logged to memory/YYYY-MM-DD.md"

> **Format note**: The four section headings (`## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`) are mandatory. All AI tools must produce logs with these exact headings for cross-tool consistency. See CONSTITUTION.md §2.

> **MEMORY.md structure**: MEMORY.md has three sections — Sessions, Meetings, ADRs.
> - Sessions: auto-updated by this command and the commit-msg hook.
> - Meetings: register via `bun run scripts/sync-md.ts "DATE" "TOPIC" --meeting` after `/meeting`.
> - ADRs: register via `bun run scripts/sync-md.ts "DATE" "TITLE" --adr ADR-NNNN` when creating an ADR file.

Note: `/sync` already runs memlog automatically. Use `/memlog` only when you want to log a session entry without triggering a full sync.
