# Design: dev-sync Scoped Staging (task-staged + pipeline-output commits)

- **Spec ID**: 2026-09-12-dev-sync-scoped-staging-design
- **Date**: 2026-09-12
- **Status**: implemented (WARN phase active)
- **Related**: ADR-0055 (WARN-first playbook), AGENTS.md §5.1 (single-commit sync premise), scripts/dev-sync.ts, skills/sync/SKILL.md

## 1. Problem

`dev-sync.ts` step 6 stages the commit with a bare `git add -A`. This sweeps **every** working-tree change into the sync commit — including changes unrelated to the task the commit message describes.

Evidence (workspace root, 2026-09-12): commit `75f98784` (`docs(memory): record plan relocation to docs (recurrence prevention)`) also carried `templates/co-price/docs/co-price-plan.md` (+66 lines, the relocation artifact itself), `templates/co-price/docs/prd.md`, and `docs/VERSION_MANIFEST.md` — none described by the message. Any leftover edit from another task, or an untracked scratch file that is not gitignored, lands in the commit the same way.

The only pre-commit guard is the sensitive-file guard (filename pattern check), which never asks whether a file *belongs* to the task.

## 2. Constraint that shapes the design

At `/sync` invocation time the working tree is **supposed** to be dirty — the task's own changes are uncommitted. Therefore:

- A pre-flight "abort if dirty" gate is self-defeating (it would fire on every legitimate run).
- A commit-message-scope ↔ changed-path matcher is a heuristic (scope tokens do not map to path prefixes reliably) and would produce routine false positives.
- The only actor that knows which files belong to the task is the **invoking agent**. The design must make that knowledge mechanically visible.

Meanwhile the pipeline itself generates files that *must* join the commit (memory log, VERSION_MANIFEST, template propagation, skill-platform copies, bun.lock, generated READMEs, skill graphs) — the single-commit premise of AGENTS.md §5.1 is kept. But those generated files are exactly identifiable: they are the delta the pipeline produced *during this run*.

## 3. Design

Two working-tree snapshots bracket the pipeline:

1. **S0** — `git status --porcelain=v1 -z -uall`, taken immediately after the language gate and **before any pipeline step mutates files**.
2. **S1** — same command, taken in step 6 right before staging.

Derived sets:

- `pipelineOutputs = S1 \ S0` — files the pipeline itself wrote during this run (memory session entry, MEMORY.md index, scripts/README.md, propagation output, VERSION_MANIFEST, skill graphs, bun.lock, …).
- `taskStaged` — `git diff --cached --name-only -z`: what the invoking agent explicitly staged before `/sync`.
- `committable = taskStaged ∪ pipelineOutputs`
- `residual = S1 \ committable` — dirt that is neither task-declared nor pipeline-generated.

Two behaviors, selected by `SYNC_SCOPED_STAGING=1` (env) or `--scoped-staging` (flag):

| Mode | Staging | residual handling |
|------|---------|-------------------|
| **WARN (default, soak)** | `git add -A` (unchanged) | commit proceeds; loud WARN lists residual files and states they will be excluded once scoped staging is promoted |
| **HARD (`SYNC_SCOPED_STAGING=1`)** | `git add -- <committable paths>` only | residual files are left uncommitted; WARN lists them |

The WARN phase is ADR-0055 playbook: behavior-preserving soak (zero risk), with the future exclusion surfaced on every affected run. Promotion to HARD default is a one-line default flip in a later release after soak.

Supporting pieces:

- `scripts/lib/git-status.ts` (new): NUL-delimited porcelain parser (`parseStatusPorcelain`), shared by both snapshots. Unit-tested in `tests/unit/git-status.test.ts` (rename/copy records, untracked-with-space paths, deletions, `-uall` expansion).
- `skills/sync/SKILL.md` contract addition: the agent stages its task files (`git add <task files>`) **before** invoking `/sync`; unstaged non-pipeline files will be excluded after promotion (and are reported during soak).
- `scripts/SCRIPTS.md`: dev-sync row bumped 1.10.0 → 1.11.0.

## 4. Edge cases

- **Clean tree at S0** (sync of pipeline-only output): `committable = pipelineOutputs`, residual empty. Unchanged behavior.
- **Agent forgot to stage a new task file**: during soak it is committed + WARN-listed; after promotion it is excluded + WARN-listed — the run output names the omission either way. The memory-log instruction (`## Skills Used`) and the SKILL.md step-1 body-writing flow already precede the invocation, giving the agent a natural point to stage.
- **S0 collection failure**: WARN mode proceeds fail-open (S0 = ∅ makes every S1 change "pipeline output", i.e. today's behavior). HARD mode aborts — misclassification there would silently commit everything, defeating the feature. Mirrors the fail-closed contract of the sensitive-file guard.
- **Staged renames**: `--name-only -z` lists the destination; the vanished source path is absent from S1 anyway, so set math stays consistent.
- **`.sync_context.*.tmp`**: gitignored (`.gitignore` L32-33) and written *after* staging (unchanged order) — never in any snapshot.
- **Concurrent `/sync` runs**: the per-run UUID context file scheme already documents concurrency as out of scope; snapshot delta adds no new hazard.

## 5. Known limitations

- Relevance remains self-declared: an agent can stage unrelated files. The mechanism enforces *declaration*, not correctness of the declaration. WARN output makes the swept-set visible to humans reviewing the run log.
- Non-`-uall` directory collapsing is avoided via `-uall`; untracked directories therefore enumerate per file (slightly larger snapshots on big trees — negligible).

## 6. Accessibility

Non-UI change (CLI pipeline script + docs). No interaction surfaces affected; WCAG baseline not applicable. **Exempt with explicit statement** per AGENTS.md §5.1.

## 7. Preview Verification

Non-UI change (no rendered web/app UI). **Exempt with explicit statement** per ADR-0070.

## 8. Gates

- `bun test tests/unit/git-status.test.ts` — parser unit tests (new).
- `bun run test` — repo-scoped suite (test-runner.ts).
- `bun scripts/typecheck.ts` — `tsc --noEmit` over `scripts/` (zero-error baseline preserved).
- Full `/sync` (audit gate, spec-check satisfied by this design doc + registry entry).
