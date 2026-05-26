---
description: Append a session summary entry to today's memory log file
---

Append a session summary entry to today's memory log file.

Arguments: $ARGUMENTS

Steps:
1. Determine today's date in YYYY-MM-DD format.
2. Ensure `memory/` directory exists.
3. Parse $ARGUMENTS for structured content:
   - First line → commit title/heading
   - Lines starting with "Summary:" → summary section
   - Lines starting with "Decisions:" → decisions section
   - Lines starting with "Issues:" → issues section
4. If no structured markers found, treat entire $ARGUMENTS as summary.
5. Append to `memory/YYYY-MM-DD.md` (create if missing) using this format:
   ```
   ## Session - <first-line>

   **Summary**: <summary or arguments>

   **Files Changed**: N/A (manual session log)

   **Decisions**: <parsed decisions or "None">

   **Issues**: <parsed issues or "None">
   ```
6. Update `memory/MEMORY.md` index by appending a row:
   `| [YYYY-MM-DD](YYYY-MM-DD.md) | $ARGUMENTS |`
   (Create MEMORY.md with header row if it does not exist.)
7. Confirm: "📝 Session logged to memory/YYYY-MM-DD.md"

Note: `/sync` already runs memlog automatically. Use `/memlog` only when you want to log a session entry without triggering a full sync.
