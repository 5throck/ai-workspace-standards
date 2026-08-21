---
name: source-command-celebrate
description: Celebrate the successful completion of a task to boost team morale.
version: 1.0.0
last_reviewed: 2026-08-15
status: active
scope: co-abap
owner: pm
prerequisites: none
metadata:
  type: core
  triggers:
    - source-command-celebrate
    - celebrate
    - task complete
---

# source-command-celebrate

Use this skill when the user asks to run the migrated source command `celebrate`.

## Command Template

# Celebrate

This command is a tool for celebrating when a task has been successfully completed.

## Description
Use this to boost team morale after successful code deployment or problem resolution.

## Implementation
```bash
# Example output pattern
echo "🎉 Task Completed Successfully!"
echo "🚀 ABAP Objects Deployed and Activated."
echo "✨ Great job, Team!"
```

## Context

A simple morale-boosting skill triggered when a task or deployment completes successfully. It provides a standardized celebration message to acknowledge team effort and maintain positive momentum throughout the development workflow.

## When to Use

- After successfully completing a development task or sprint
- After a successful code deployment or transport release
- When the user explicitly requests a celebration or morale boost
- After resolving a difficult bug or problem

## Execution Steps

1. Confirm the task or deployment has completed successfully.
2. Output a celebratory message acknowledging the achievement.
3. Optionally reference specific metrics (objects deployed, tests passed, etc.).

## Output Format

A brief, encouraging message confirming task completion. Example:
```
Task Completed Successfully!
ABAP Objects Deployed and Activated.
Great job, Team!
```

## Related Skills

- [abap-dev](../abap-dev/SKILL.md) — Core ABAP development workflows whose completion may trigger celebration
- [post-write-chain](../post-write-chain/SKILL.md) — QA chain that must pass before celebrating a successful deployment
