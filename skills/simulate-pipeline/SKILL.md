---
name: simulate-pipeline
description: >
  Runs workspace pipeline smoke tests with an explicit mode: project scaffolding
  (`--mode project-creation`) or L3 scaffold to L2 variant promotion
  (`--mode l3-to-variant-promotion`). Use when validating new-project scaffolding,
  testing disposable L3 promotion fixtures, or checking promotion/scaffold regressions.
version: 1.0.0
last_reviewed: 2026-09-09
status: active
scope: workspace
owner: automation-engineer
prerequisites: Bun (`new-project.ts`, `test-l3-to-variant-promotion.ts`; ADR-0036 TypeScript-only scripts)
metadata:
  type: process
  triggers:
    - simulate pipeline
    - simulate project
    - test scaffolding
    - dry run project creation
    - simulate l3 promotion
    - test l3 pipeline
    - dry run variant promotion
---

# Skill: simulate-pipeline

Use this skill to run disposable end-to-end smoke checks for workspace creation and promotion pipelines. It replaces the former `simulate-project-creation` and `simulate-l3-to-variant-promotion` skills; choose the path with an explicit mode flag.

## Modes

### `--mode project-creation`

Validates the project scaffolding path driven by `new-project.ts`.

1. Create a disposable scratch folder such as `scripts/temp/e2e-test-scaffold`.
2. Run `bun scripts/new-project.ts "e2e-test-scaffold"`.
3. Verify the generated files exist and match the expected template layout.
4. Verify UTF-8 without BOM for generated Markdown and TypeScript files.
5. Run `bun scripts/verify-scripts.ts --verify` in the scaffolded project; it must exit 0 with 0 errors.
6. Delete the disposable scaffold after verification.

### `--mode l3-to-variant-promotion`

Validates the L3 scaffold to L2 variant promotion smoke-test path.

1. Run `bun scripts/test-l3-to-variant-promotion.ts`.
2. Confirm the harness creates and removes its disposable `Projects/` fixture and `tests/.temp/` output.
3. Confirm assertions cover the historical regression classes: README files not classified as agents, report field name compatibility, no `process.exit(1)` from the programmatic API, and incomplete-agent gap detection.
4. Treat any non-zero exit as a blocker before promoting a real L3 project.

## Related Skills

- `project-to-variant` — production L3/project to L2 variant promotion workflow.
- `create-variant` — L2 variant creation workflow; this simulation does not modify real templates.
