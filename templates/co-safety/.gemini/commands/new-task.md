Create a new task tracking entry in memory for the current session.

Arguments: $ARGUMENTS

Steps:
1. Determine today's date in YYYY-MM-DD format.
2. Ensure `memory/` directory exists.
3. Append the following block to `memory/YYYY-MM-DD.md` (create if missing):
   ```markdown
   ## Task: $ARGUMENTS

   **Status**: in_progress
   **Started**: YYYY-MM-DD

   ### Plan
   - [ ] (fill in steps)

   ### Notes
   -
   ```
4. Confirm: "📋 Task created: $ARGUMENTS"

This command creates a lightweight in-session task record in the daily memory log.
For multi-session task tracking, use the TaskCreate tool directly.
