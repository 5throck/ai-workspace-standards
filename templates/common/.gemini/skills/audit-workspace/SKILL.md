---
name: audit-workspace
description: Runs the root workspace audit scripts to enforce workspace standards compliance.
version: 1.0.0
last_reviewed: 2026-05-30
status: active
scope: common
l2_propagate: false
owner: auditor
prerequisites: PowerShell or Bash
relates_to:
  - skill: security-scan
    type: composes_with
  - skill: team-builder
    type: composes_with
  - skill: create-variant
    type: composes_with
  - skill: project-to-variant
    type: composes_with
  - skill: promote-variant
    type: follows
  - skill: sync
    type: composes_with
  - skill: upgrade-project
    type: composes_with
metadata:
  type: process
  triggers:
    - audit workspace
    - run audit
    - check compliance
    - workspace check
---

# 🛠️ Skill: audit-workspace

## Context
Used by the `auditor` or `pm` agents to run automated sanity checks against the project structure.

## Execution Steps

1. Run the audit script:
   - **Windows**: `powershell -ExecutionPolicy Bypass -File .\scripts\audit.ps1`
   - **macOS/Linux**: `bun scripts/audit.ts`
2. Analyze the output for `[FAIL]` or `[WARN]` lines.
3. Fix issues if possible (e.g., missing `[Unreleased]` header in `CHANGELOG.md`), or delegate the fix to the appropriate expert agent.
