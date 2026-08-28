---
name: new-task
description: Create a new task file in scratch/tasks/ for tracking feature development or bug fix work.
argument-hint: "[task-name]"
allowed-tools: ["Bash", "Write"]
---

# New Task

Create a new task file in `scratch/tasks/` for the given work item.

## Steps

1. Determine today's date (YYYY-MM-DD) and generate a sequential task ID: `task-YYYY-MM-DD-NNN.md` (NNN = count of existing task files + 1, zero-padded to 3 digits).
2. Create the file at `scratch/tasks/task-YYYY-MM-DD-NNN.md` with the template below.
3. Display the full path and template so the user can fill in the details.

## Template

```markdown
# Task — YYYY-MM-DD-NNN

## 0. Request

**Received**: YYYY-MM-DD HH:MM
**Description**:
> <paste user request here>

**Classification**: Feature | Bug | Refactor | Docs | Infra
**Affected modules**: <!-- e.g. pricing, simulation, auth -->

---

## 1. Analysis

<!-- What is the current behavior? What is expected? -->

## 2. Plan

<!-- Step-by-step implementation plan -->

## 3. Implementation Notes

<!-- Key decisions, trade-offs, formula references (link prd.md sections) -->

## 4. Verification

- [ ] Unit tests pass (`bun run test`)
- [ ] Audit passes (`bun scripts/audit.ts`)
- [ ] Math formulas verified against prd.md

## 5. Sync

- [ ] Memory log updated (`/memlog`)
- [ ] Committed and PR created (`/sync "type: description"`)
```

## Notes

- $ARGUMENTS (if provided) is used as the task description in the Request section.
- Create `scratch/tasks/` directory if it does not exist.
