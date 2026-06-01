---
name: simulate-project-creation
description: Performs end-to-end (E2E) testing of the project scaffolding scripts to verify cross-platform functionality and encoding integrity.
version: 1.0.0
last_reviewed: 2026-05-30
status: active
owner: scaffolding-expert
prerequisites: PowerShell or Bash
metadata:
  type: process
  triggers:
    - simulate project
    - test scaffolding
    - dry run project creation
---

# 🛠️ Skill: simulate-project-creation

## Context
This skill is designed to be used by the `scaffolding-expert` or `architect` agents to verify that the `new-project` logic creates fully functional workspace templates without corruption.

## Execution Steps

1. Create a temporary scratch folder using `mkdir scripts/temp/e2e-test-scaffold` (or equivalent).
2. Execute the scaffolding script targeted at that folder:
   - **Windows**: `powershell -ExecutionPolicy Bypass -File .\scripts\new-project.ps1 "e2e-test-scaffold"`
   - **macOS/Linux**: `bash scripts/new-project.sh "e2e-test-scaffold"`
3. Verify that the output files exist in `e2e-test-scaffold/` and match the `templates/` directory layout.
4. Verify file encoding (ensure `.ps1` and `.md` files contain UTF-8 characters without CP949 corruption).
5. Clean up: Delete the test folder after verification `rm -rf scripts/temp/e2e-test-scaffold`.
