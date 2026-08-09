---
name: simulate-project-creation
description: Performs end-to-end (E2E) testing of the project scaffolding scripts to verify cross-platform functionality and encoding integrity.
version: 1.0.1
last_reviewed: 2026-08-09
status: active
scope: workspace
owner: scaffolding-expert
prerequisites: Bun (bun scripts/new-project.ts, per ADR-0036 — no .ps1/.sh script variants exist)
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
2. Execute the scaffolding script targeted at that folder (single cross-platform command per ADR-0036 — only `.ts` scripts exist, no `.ps1`/`.sh` variants):
   - `bun scripts/new-project.ts "e2e-test-scaffold"`
3. Verify that the output files exist in `e2e-test-scaffold/` and match the `templates/` directory layout.
4. Verify file encoding (ensure `.ts` and `.md` files contain UTF-8 characters without CP949 corruption).
5. Clean up: Delete the test folder after verification `rm -rf scripts/temp/e2e-test-scaffold`.
6. **SCRIPTS.md consistency**: Run `bun scripts/verify-scripts.ts --verify` in the scaffolded project — must exit 0 with 0 errors (confirms L0-only registry entries were filtered out).
