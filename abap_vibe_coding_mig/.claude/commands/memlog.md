---
name: memlog
description: Open or create today's memory log file and display its current contents so the agent can append a new development entry.
argument-hint: "[object-name]"
allowed-tools: ["Read", "Write", "Bash"]
---

# Memory Log

Open (or create) today's memory log file and display its current contents so the agent can append a new entry.

## Steps

1. Determine today's date in YYYY-MM-DD format.
2. Check whether `memory/YYYY-MM-DD.md` already exists.
   - If it **exists**: display its current content so the user can see what has already been logged today.
   - If it **does not exist**: create it with the header below, then display it.

```markdown
# Development Log — YYYY-MM-DD

---

```

3. Remind the agent to append a new entry using the standard format:

```markdown
## <Object Name> (<Object Type>)
- **Package**: <package>
- **ADT URL**: /sap/bc/adt/...
- **Purpose**: <one-line summary>
- **Decisions**: <key technical decisions>
- **Issues**: <symptom → root cause → resolution>
- **MCP/Config changes**: <if any>
```

4. After appending, remind the user to run `/sync` to commit the log to Git.

## Notes

- $ARGUMENTS (if provided) is treated as the object name for the log entry header.
- All memory files must be written in **English**.
- The MEMORY.md index is updated automatically by the sync script.
