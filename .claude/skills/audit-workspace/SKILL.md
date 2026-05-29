---
name: audit-workspace
description: Runs the root workspace audit scripts to enforce CONSTITUTION.md compliance.
version: 1.0.0
last_reviewed: 2026-05-30
status: active
owner: auditor
prerequisites: PowerShell or Bash
---

# 🛠️ Skill: audit-workspace

## Context
Used by the `auditor` or `pm` agents to run automated sanity checks against the project structure.

## Execution Steps

1. Run the audit script:
   - **Windows**: `powershell -ExecutionPolicy Bypass -File .\scripts\audit.ps1`
   - **macOS/Linux**: `bash scripts/audit.sh`
2. Analyze the output for `[FAIL]` or `[WARN]` lines.
3. Fix issues if possible (e.g., missing `[Unreleased]` header in `CHANGELOG.md`), or delegate the fix to the appropriate expert agent.
