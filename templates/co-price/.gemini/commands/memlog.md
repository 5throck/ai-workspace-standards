---
name: memlog
description: Open or create today's memory log file and display its current contents so the agent can append a new development entry.
argument-hint: "[feature-or-module-name]"
allowed-tools: ["Read", "Write", "Bash"]
---

# Memory Log

Open (or create) today's memory log and display its contents.

## Steps

1. Determine today's date in YYYY-MM-DD format.
2. Check whether `memory/YYYY-MM-DD.md` already exists.
   - If it **exists**: display its current content.
   - If it **does not exist**: create it with the header below, then display it.

```markdown
# Development Log — YYYY-MM-DD

---

```

3. Remind the agent to append a new entry using the standard format:

```markdown
## <Feature / Module Name>
- **Files**: src/...
- **Purpose**: <one-line summary>
- **Decisions**: <key technical decisions>
- **Formula changes**: <reference prd.md section if applicable>
- **Issues**: <symptom → root cause → resolution>
```

4. After appending, remind the user to run `/sync` to commit the log to Git.

## Notes

- $ARGUMENTS (if provided) is treated as the feature or module name for the log entry header.
- All memory files must be written in **English**.
- The `memory/MEMORY.md` index is updated automatically by the sync script.
