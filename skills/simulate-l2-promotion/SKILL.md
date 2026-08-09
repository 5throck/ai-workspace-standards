---
name: simulate-l2-promotion
description: Performs end-to-end (E2E) smoke testing of the L2 scaffold → variant promotion pipeline (create-l2-scaffold.ts + l2-to-variant-pipeline.ts) to catch classification/parsing regressions before promotion.
version: 1.0.0
last_reviewed: 2026-08-09
status: active
scope: workspace
owner: automation-engineer
prerequisites: Bun (bun scripts/test-l2-promotion.ts, per ADR-0036)
metadata:
  type: process
  triggers:
    - simulate l2 promotion
    - test l2 pipeline
    - dry run variant promotion
    - test create-l2-scaffold
---

# 🛠️ Skill: simulate-l2-promotion

## Context
This skill is designed to be used by the `automation-engineer` or `architect` agents to verify that
`scripts/create-l2-scaffold.ts` (L2 variant scaffold creation) and `scripts/l2-to-variant-pipeline.ts`
(L2 → variant promotion) work correctly end-to-end against a disposable fixture, before an L2 project
is promoted for real.

It exists as a separate, minimal skill from `simulate-project-creation` because the two pipelines exercise
structurally different scripts (`new-project.ts` for L1 scaffolding vs. `create-l2-scaffold.ts` +
`l2-to-variant-pipeline.ts` for L2 → variant promotion) with different owners in practice. See
`docs/designs/l2-pipeline-governance-fixes-2026-08-09-design.md` (Issue Set C) for the full rationale:
the 2026-08-09 co-export promotion required three same-day fix commits to `l2-to-variant-pipeline.ts`
(a `README_ko.md`-as-agent classification bug, a JSON report field-name mismatch, and internal
`process.exit(1)` calls killing programmatic callers) — none of which any existing test would have caught.

This is a **smoke test, not a full test suite**: it does not re-validate every pipeline phase (platform
parity and workspace integration are skipped) and does not touch `templates/` — it is a lightweight
regression guard against the specific bug class fixed on 2026-08-09.

## Execution Steps

1. Run the harness script:
   - `bun scripts/test-l2-promotion.ts`
2. The harness (self-contained, cleans up after itself on success or failure):
   1. Scaffolds a disposable L2 fixture via `bun scripts/create-l2-scaffold.ts <timestamp-scoped-name>`
      (output lands under `Projects/`, per the script's own hardcoded convention — not `templates/`).
   2. Injects two regression-bait files into the fixture's `agents/` dir: a `README_ko.md` (Korean
      README with no agent sections — the A.1 bait) and an intentionally incomplete agent file with only
      a `## Role` section (missing the other 6 required Layer-1 sections).
   3. Invokes `executeL2ToVariantPipeline()` **programmatically** (via direct import, not a CLI shell-out)
      against the fixture, with `--output=` redirected to a scratch path under `tests/.temp/` — never into
      `templates/`.
   4. Asserts:
      - The pipeline call returns a `PipelineResult` without killing the host process (A.3 regression check
        — before the fix, a BLOCKING Phase 3.5/4.5 failure called `process.exit(1)` inside the exported
        function itself).
      - `_pipeline_report.json` never lists `README_ko.md` among the scanned agent files (A.1 regression
        check).
      - `_pipeline_report.json` never contains the stale, always-empty `extraSections` field name — only
        the real `missingOptionalSections` field (A.2 regression check).
      - The intentionally incomplete agent file is correctly flagged as a non-passing gap with a populated
        `missingSections` list (sanity check that classification actually ran, not just skipped everything).
   5. Deletes both the `Projects/` fixture and the `tests/.temp/` pipeline output, regardless of outcome.
3. Exit code: `0` if all assertions passed, `1` otherwise. Treat any non-zero exit as a blocker before
   promoting a real L2 project.

## Output Format
Console test report in the same style as `test-new-project.ts`: one `✅`/`❌` line per assertion, followed
by a `Tests run` / `Tests passed` / `Result` summary.

## Related Skills
- `simulate-project-creation` — the equivalent smoke test for the L1 project-scaffolding path
  (`new-project.ts`); does not cover `create-l2-scaffold.ts` or `l2-to-variant-pipeline.ts`.
- `create-variant` — the real (non-disposable) L2 → variant promotion workflow this skill smoke-tests.
- `promote-variant` — Phase B promotion once a variant has proven itself.
