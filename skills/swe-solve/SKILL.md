---
name: swe-solve
description: Autonomous 5-stage issue-to-PR resolution pipeline for software engineering tasks, featuring test-driven validation, pull-request synthesis, and resolution-trajectory logging.
version: 1.1.1
last_reviewed: 2026-08-25
status: active
scope: co-develop
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
Provides a structured 5-stage autonomous software engineering workflow for resolving repository issues, fixing bugs, and implementing features using test-driven development (TDD) and multi-agent coordination. Every run produces a scoreable trajectory record for measuring resolve-rate over time.

## When to Use
- Resolving GitHub issues autonomously in `co-develop` variant templates.
- Executing multi-step code refactoring or bug fixes requiring systematic verification.
- Running autonomous coding pipelines with automated PR output.
- Any issue resolution where you need a durable, machine-greppable record of the resolution attempt for later analysis.

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

### Stage 5: Trajectory Record
- Append a trajectory record file to capture the complete resolution attempt for scoring and retrospective analysis.
- **File path**: `memory/trajectories/swe-solve/<YYYY-MM-DD>-<issue-or-slug>.md` (one file per run; the directory is created on first use).
- **YAML frontmatter** (machine-greppable for resolve-rate computation):
  ```yaml
  ---
  run: <YYYY-MM-DD>-<slug>
  issue: <issue URL or local spec ref>
  resolved: true|false  # true only if PR merged or all stages passed with tests green
  tests_failed_before: <n>
  tests_passed_after: <n>
  files_touched: <n>
  pr: <PR URL or "none">
  stages_completed: 1-5
  ---
  ```
- **Body**: Brief per-stage notes (hypothesis, key edits, test evidence). Reuse and extend the Output Format summary structure rather than duplicating it verbatim. The Execution Summary belongs in the PR body; the trajectory file is the durable scoreable record.
- **Resolve-rate calculation**: `resolved: true` count ÷ total trajectory files for a given period. Compute with:
  ```bash
  grep -c '^resolved: true' memory/trajectories/swe-solve/*.md
  ```
- **Pipeline regression check**: the benchmark fixture set at `docs/benchmark-fixtures/` freezes three issues (pure-function bug, error-handling bug, micro-feature) with known-good resolutions for SWE-bench-style accepted/resolved scoring - run the pipeline against those when you need to attribute a resolve-rate change to the pipeline rather than the target. See the set's [README](../../docs/benchmark-fixtures/README.md) for the scoring rubric.

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
- **Branch**: `pr/20260824-swe-solve-fix`
- **Sync Status**: Opened PR #451

### 📊 Trajectory Record
- **Path**: `memory/trajectories/swe-solve/2026-08-24-target-fix.md`
- **Resolved**: true
```

## Related Skills
- `superpowers:test-driven-development` (global plugin skill) — TDD workflow guidelines
- `superpowers:systematic-debugging` (global plugin skill) — Diagnostic and root cause analysis techniques
- [sync](../sync/SKILL.md) — Commit and PR submission pipeline
