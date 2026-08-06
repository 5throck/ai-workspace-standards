---
name: swe-solve
description: Autonomous 4-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation and pull-request synthesis.
version: 1.0.0
last_reviewed: 2026-08-06
status: active
scope: common
owner: pm
prerequisites: Bun runtime, test-runner.ts
metadata:
  type: process
  triggers:
    - swe-solve
    - solve issue
    - autonomous issue resolution
    - issue to pr
---

# 🛠️ Skill: swe-solve

## Context
Provides a structured 4-stage autonomous software engineering workflow for resolving repository issues, fixing bugs, and implementing features using test-driven development (TDD) and multi-agent coordination.

## When to Use
- Resolving GitHub issues autonomously in `co-develop` variant templates.
- Executing multi-step code refactoring or bug fixes requiring systematic verification.
- Running autonomous coding pipelines with automated PR output.

## Execution Steps

### Stage 1: Ingest & Inspect
- Parse the target issue description, bug report, or feature spec.
- Identify candidate source files and data structures using `grep_search` and `view_file`.
- Inspect data schemas, exported interfaces, and caller dependencies.

### Stage 2: Localization & Plan
- Formulate a precise root-cause hypothesis or technical solution design.
- Create or update a failing test suite (TDD) that reproduces the reported issue.
- Verify test failure: `bun scripts/test-runner.ts` or `bun test`.

### Stage 3: Mutation & Test
- Apply minimal, surgical code modifications to resolve the underlying cause.
- Re-run test suite until all unit, integration, and contract tests pass 100%.
- Ensure no regression errors or side-effects are introduced.

### Stage 4: Review & PR Synthesis
- Run workspace quality gates: `bun scripts/audit.ts`.
- Generate structured PR body detailing issue root cause, code modifications, and test evidence.
- Submit PR via `/sync` pipeline.

## Output Format

```markdown
# 🛠️ SWE-Solve Execution Summary

### 🎯 Target Issue
[Issue description and scope summary]

### 🔍 Root Cause Analysis
[Detailed technical explanation of failure mechanism or missing capability]

### 🧪 Test Evidence
- **Reproducing Test**: `tests/unit/target-feature.test.ts`
- **Initial Status**: FAIL (Expected X, got Y)
- **Final Status**: PASS (All 12 assertions clean)

### 📝 Code Modifications
- `src/components/target-module.ts`: Fixed parameter boundary check
- `scripts/helpers/schema-validator.ts`: Updated schema mapping

### 🚀 PR Synthesis
- **Branch**: `pr/20260806-swe-solve-fix`
- **Sync Status**: Opened PR #451
```

## Related Skills
- [test-driven-development](../test-driven-development/SKILL.md) — TDD workflow guidelines
- [systematic-debugging](../systematic-debugging/SKILL.md) — Diagnostic and root cause analysis techniques
- [sync](../sync/SKILL.md) — Commit and PR submission pipeline
