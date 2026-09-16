---
schemaVersion: 1.0.0
spec-id: variant-ization-overlay-guard
---

# Variant-ization Overlay Guard and State Rollback — 2026-09-16

## 1. Overview

Lands ticket T-20260915-006 (H5) from the 2026-09-15 template-fleet review
[Source: docs/reports/2026-09-15-project-review-template-fleet.md, finding H5]:
the two variant-ization entry points can overwrite an existing live variant
template with no guard, and a failure after generation leaves orphaned
partial state. This is the design-only half of the ticket — it fixes the
semantics on paper; implementation files follow-up tickets (Section 9).

The design has two halves:

- An **exists-guard** on the promotion target `templates/co-<name>/`,
  fail-closed by default, with one explicit override flag for the
  legitimate re-promotion-during-beta case and a hard refusal for
  stable/deprecated targets.
- A **state rollback** for the generation tree, reusing the
  `rollbackPartialProject` helper pattern (M13/H11) for the fresh-create
  case and adding a snapshot-rename restore for the authorized-overlay
  case.

## 2. Problem (current code, verified 2026-09-16)

### 2.1 The overlay hazard — no exists-guard anywhere on the path

- `scripts/project-to-variant.ts:90` builds
  `targetDir = join(WORKSPACE_ROOT, 'templates', targetArg)` and never
  checks existence. The copy loop (`scripts/project-to-variant.ts:220-234`)
  runs `mkdirSync(recursive)` + `copyFileSync`, which silently overwrite an
  existing `templates/co-<name>/`. Nuance: line 238 skips variant.json
  regeneration when one already exists, so an overlay produces a mixed
  tree — new payload files under the OLD variant.json manifest.
- `scripts/helpers/generate-variant.ts:1598-1605`: `generateVariant()`
  resolves `variantPath = outputPath || join(TEMPLATES_DIR, metadata.name)`
  (line 1599) and applies only the C-08 workspace-escape check
  (lines 1601-1605). No existence check. Every later step
  (`createDirectoryStructure`, `writeUTF8File`, `copyFileUTF8`,
  lines 1611-1766) overwrites in place.
- `scripts/l3-to-variant-pipeline.ts:953` calls `generateVariant()` in
  Phase 4; `main()` (lines 1416-1531) validates the name shape (C-09,
  lines 1467-1472) but never asks whether the target slot is occupied.

### 2.2 The post-failure orphan — no rollback on the path

- `scripts/project-to-variant.ts:411-413`: partial copy failure exits 1
  and leaves the half-copied tree. A Variant Readiness Gate failure
  (lines 359-372) leaves the full tree.
- `scripts/l3-to-variant-pipeline.ts:1399-1410`: `buildFailureResult()`
  only returns a result object. A Phase 4/4.5/4.6/4.7 failure after
  generation exits 1 (`main()`, lines 1522-1525) and leaves the generated
  tree on disk. Phases 4.5-4.7 additionally write `_pipeline_report.json`
  inside the variant tree (read-modify-write, lines 1188-1204) — still
  tree-internal, but nothing cleans it up either.

Contrast: `scripts/new-project.ts:493-500` (M13) and
`scripts/create-l3-scaffold.ts:1039-1046` (H11) both arm a
`process.on('exit')` hook that calls the shared, unit-tested
`rollbackPartialProject` (`scripts/helpers/rollback-partial-project.ts:29-45`,
containment rules: refuse the workspace root, refuse paths outside it).
The variant-ization path has no equivalent wiring.

### 2.3 What exists today (so the design reuses, not duplicates)

- `scripts/helpers/rollback-partial-project.ts` v1.0.0 — whole-directory
  rm with a strict inside-workspace-root boundary. Directly reusable for
  the fresh-create case.
- `scripts/lib/pipeline-state.ts` v1.1.2 — an action-log state machine
  (`initializeState` / `addRollbackAction` / `executeRollback`,
  lines 51-251). Its `modify_file` and `update_registry` action kinds are
  **no-op-with-warning** (lines 276-284: "Cannot restore file without
  backup"). It is wired only into `scripts/helpers/workspace-integration.ts`
  (line 626) — the Phase 7 workspace-registration helper that the pipeline
  skips by default (`scripts/l3-to-variant-pipeline.ts:1319-1325`,
  `skipIntegration=true`).

### 2.4 State the generation path actually touches (ticket hypothesis corrected)

The ticket hypothesized that Phase 4 touches the lifecycle record,
VERSION_REGISTRY, `variant_extensions`, and propagation-map lists.
Verified against today's code, the machine-written state is narrower:

| State | Written by | Verified at |
|-------|-----------|-------------|
| `templates/co-<name>/` tree (dirs, variant.json, agents, skills, AGENTS.md, READMEs, platform settings, context.md, manifest copies) | Phase 4 / generateVariant | generate-variant.ts:1611-1766; ACTIVE.md cleanup at pipeline:956-966 |
| `_pipeline_report.json` (inside the variant tree) | Phases 4.5-4.7 | pipeline:1188-1204 |
| `scripts/propagation-map.json`, `docs/templates/VERSION_REGISTRY.json`, root `README.md`, root `AGENTS.md` | ONLY the default-OFF Phase 7 helper `workspace-integration.ts` | workspace-integration.ts:105-118 |
| `docs/workspace-schema.json` `variant_extensions`, `docs/lifecycle/templates/<name>.md` | NO code — manual registration steps today | grep over all three scripts: zero references (finding C4/M8 context) |
| `docs/specs/registry.json` (append-only ledger) | lightweight path ONLY, when `--design-doc` is passed | project-to-variant.ts:384-396 |

Consequence: a tree-level rollback fully covers every automated write of
Phase 4. The registration files are either manual (not orphanable by a
crash) or written by the explicit Phase 7 helper, which owns its own
snapshot flow. `docs/specs/registry.json` appends are a deliberate ledger
residue, left in place by rollback.

## 3. Chosen approach A — exists-guard semantics

### 3.1 The rule

Classify the target slot before any write, from the target's own
`variant.json` when present:

| Target state at `templates/co-<name>/` | Behavior |
|----------------------------------------|----------|
| Does not exist | Proceed (fresh promotion) |
| Exists, `variant.json` missing or unparseable | Hard refuse — the `co-*` namespace is reserved; a corrupt or foreign directory must be resolved by a human |
| Exists, `status: "stable"` or `"deprecated"` | Hard refuse — no flag honors it |
| Exists, `status: "beta"` (or any other non-terminal value) | Refuse unless `--overlay-variant` is passed |
| Explicit `--output` to a path outside `templates/` | Guard does not apply — the destination is named, not derived (the E2E harness relies on this: `scripts/test-l3-to-variant-promotion.ts:63` targets `tests/.temp/`) |

Current fleet data supports the split: 8 variants are `stable`, 5 are
`beta` (`templates/co-*/variant.json`), none are `deprecated` on disk.

### 3.2 Enforcement points (three, cheap, defense in depth)

1. `scripts/l3-to-variant-pipeline.ts` — inside
   `executeL3ToVariantPipeline()`, before Phase 1. It must precede Phase
   3.5: the auto-fix branch can already write into a live variant when
   the L3 source lives under `templates/`
   (`scripts/l3-to-variant-pipeline.ts:644-646` runs
   `regenerate-agents-md.ts --variant <name>` against `templates/<name>/`).
   The guard lives in the exported execute function, not `main()`, so the
   E2E harness (which imports the function directly) gets the same
   protection.
2. `scripts/project-to-variant.ts` — immediately after `targetDir`
   resolution (line 90), before the copy loop.
3. `scripts/helpers/generate-variant.ts` — at the default `templates/`
   resolution (line 1599), as the last line of defense for any future
   caller of `generateVariant()`.

### 3.3 The override flag and its named trade-off

`--overlay-variant` (both entry points) authorizes overwriting an
existing **beta** variant template. The flag documentation must state the
trade-off: an authorized overlay destroys the previous beta tree as a
unit — per-file history lives in git, not on disk — and is therefore only
available while the variant is unambiguously pre-release. Overlaying a
`stable` variant by flag is deliberately impossible: a stable tree is the
lineage that `upgrade-project`'s managed-marker delivery maintains for
every scaffolded project, and wholesale regeneration from a diverged
project would destroy that lineage. An operator who truly needs to
re-promote a stable variant edits `status` in the target's `variant.json`
first — a small, reviewable git diff, mirroring how a promotion hold is
cleared by editing `variant.json`
(`scripts/project-to-variant.ts:68-88`).

### 3.4 Considered and rejected alternatives

- **Warn-and-continue (status quo)** — rejected: it is exactly the silent
  whole-tree destruction class H5 names. Note
  `create-l3-scaffold.ts:1049-1051` warns-and-proceeds for an existing
  `templates/<slug>/`, but that target is the read-only SOURCE of a
  scaffold, not a write target — the situations are not analogous.
- **Hard fail always, no override** — rejected: it breaks the legitimate
  iterate-and-re-promote loop during beta development and pushes
  operators to hand-deleting `templates/co-<name>/` with `rm -rf`, which
  is the more dangerous act this guard exists to rationalize.
- **Interactive confirm prompt** — rejected: promotions are long,
  scriptable runs (and the pipeline is also driven as an imported module
  by the E2E harness); a mid-run prompt is inconsistent with the
  promotion-hold precedent of explicit, non-interactive authorization.

## 4. Chosen approach B — state rollback

### 4.1 Fresh-create failure → existing helper, unchanged

When the run created the target (guard said "does not exist"), failure
rolls back with `rollbackPartialProject(targetDir, WORKSPACE_ROOT)` as-is
(`scripts/helpers/rollback-partial-project.ts:29-45`): the containment
rules already refuse the workspace root and anything outside it, and the
whole generated tree was created by this run, so whole-directory rm is
exact.

### 4.2 Authorized-overlay failure → snapshot-rename restore

`rm`-based rollback is wrong when the target pre-existed: it would delete
the live variant, not the run's output. For `--overlay-variant` runs,
`scripts/helpers/rollback-partial-project.ts` (1.0.0 → 1.1.0) gains a
snapshot trio, reusing the same containment checks:

- `snapshotDirForOverlay(targetDir, workspaceRoot)` — renames
  `templates/co-<name>/` to the sibling
  `templates/.overlay-backup-<name>-<UTC timestamp>/` (rename is atomic
  on one volume; the dot prefix keeps the dir invisible to
  `deriveCoVariantDirs` and every template-directory scan).
- `restoreOverlaySnapshot(backupPath, targetDir)` — removes the partial
  output, renames the snapshot back.
- `discardOverlaySnapshot(backupPath)` — removes the snapshot after a
  successful run.

Success path: snapshot → generate → discard. Failure path: snapshot →
generate fails → restore. Only a hard kill between rename and restore can
stray a `.overlay-backup-*` dir; the same nonzero-exit hook that drives
the rollback also clears it.

### 4.3 Wiring per entry point

- `scripts/project-to-variant.ts` — arm the M13/H11
  `process.on('exit')` hook once target classification resolves: nonzero
  exit → rollback (fresh: `rollbackPartialProject`; overlay:
  `restoreOverlaySnapshot`); zero exit → `discardOverlaySnapshot`. The
  script is a top-level imperative script with no import guard, so the
  hook pattern is safe and precedented.
- `scripts/l3-to-variant-pipeline.ts` — NO process-level hook: the module
  is imported by `scripts/test-l3-to-variant-promotion.ts:277`, and a
  module-scope hook would roll back inside the harness process. Instead
  the execute function invokes the same rollback decision on its
  `buildFailureResult` paths and in its catch, before returning.
- `scripts/helpers/generate-variant.ts` — guard only, no snapshot
  orchestration: the helper stays single-responsibility; rollback
  ownership belongs to the callers that know whether the target
  pre-existed.

### 4.4 Documented residues (out of rollback scope, stated on purpose)

- Phase 3.5 auto-fix rewrites the L3 SOURCE's `AGENTS.md` in place for
  `Projects/` sources (`scripts/l3-to-variant-pipeline.ts:652-653`) — a
  source-tree edit, recoverable via the source project's own git history,
  not part of the promotion output.
- `.pipeline-state/l3-scan-result.json` (scan helper,
  `scripts/helpers/scan-l3-project.ts:429-432`) is gitignored scratch.
- The `docs/specs/registry.json` append from `--design-doc`
  (project-to-variant.ts:384-396) is an append-only ledger; rollback
  leaves it.

### 4.5 Considered and rejected alternative

Extend `scripts/lib/pipeline-state.ts` with persisted content backups and
thread `addRollbackAction` calls through every `generateVariant` write —
rejected: its `modify_file`/`update_registry` kinds already cannot restore
without backup (lines 276-284), so the mechanism would need a new backup
persistence layer; per-file logging across ~10 write steps is invasive;
and the hazard (and the M13/H11 precedent) is whole-tree, which the
snapshot-rename covers with one primitive.

## 5. Version bumps (minor — new functionality)

| File | Version | Surfaces |
|------|---------|----------|
| `scripts/project-to-variant.ts` | 1.3.0 → 1.4.0 | `@version` + header changelog; guard + rollback + `--overlay-variant`; L0 + L1 SCRIPTS.md row (flags column) |
| `scripts/l3-to-variant-pipeline.ts` | 1.18.0 → 1.19.0 | `@version` + header changelog; guard + rollback; L0 + L1 SCRIPTS.md rows |
| `scripts/helpers/generate-variant.ts` | 1.14.0 → 1.15.0 | `@version`; helper-level guard; L0 + L1 SCRIPTS.md rows |
| `scripts/helpers/rollback-partial-project.ts` | 1.0.0 → 1.1.0 | `@version`; snapshot trio; L0 + L1 SCRIPTS.md rows |

`scripts/test-l3-to-variant-promotion.ts` changes follow the implementation
ticket; no data-file versions change (the design writes no JSON data).

## 6. Test plan (negative-first)

- `tests/unit/new-project-rollback.test.ts` (or a sibling) extends to the
  snapshot trio: snapshot→restore round-trip preserves content and mtime
  order; snapshot→discard removes the backup; containment refusals (root
  itself, outside root); dot-prefixed backup name never matches
  `co-*` derivation.
- Subprocess guard tests (modeled on
  `tests/unit/project-target-guards.test.ts`): promotion onto an existing
  `stable` target refuses with exit 1 — even with `--overlay-variant`;
  onto an existing `beta` target refuses without the flag, naming
  `--overlay-variant` in the message; onto a target with unparseable
  `variant.json` refuses; with the flag onto `beta` proceeds.
- `scripts/test-l3-to-variant-promotion.ts` (E2E): asserts the explicit
  `--output` path stays guard-exempt (existing harness flow must stay
  green); adds a second-run refusal assertion; adds an injected
  Phase 4.5 failure on an `--overlay-variant` run and verifies the old
  tree is byte-identical after restore and no `.overlay-backup-*`
  remains after a green run.

## 7. Accessibility

Backend/CLI-only work (guards, a rollback helper, subprocess and unit
tests). No user-facing UI is produced. Exempt from ADR-0065 WCAG scope;
the WCAG 2.1 AA baseline does not apply.

## 8. Preview Verification

Non-UI work — no rendered surface exists to screenshot. Exempt from
ADR-0070 preview verification; verification is via the executed validation
battery (unit suite, promotion E2E, validate-templates, typecheck, audit,
review-baseline).

## 9. Follow-up Tickets (to file after approval)

- `variant-ization: implement exists-guard and --overlay-variant flag in project-to-variant and l3-to-variant-pipeline (H5 design 2026-09-16-variant-ization-overlay-guard)`
- `variant-ization: add overlay snapshot-rename rollback trio to rollback-partial-project and wire exit-hook/module failure-path rollback (H5 design 2026-09-16-variant-ization-overlay-guard)`
- `test: negative promotion-overlay guard coverage in project-target-guards-style subprocess tests and promotion E2E second-run assertion (H5 design 2026-09-16-variant-ization-overlay-guard)`

## References

- [Source: docs/reports/2026-09-15-project-review-template-fleet.md — finding H5, ticket T-20260915-006]
- [Source: scripts/project-to-variant.ts, scripts/l3-to-variant-pipeline.ts, scripts/helpers/generate-variant.ts, scripts/helpers/rollback-partial-project.ts, scripts/lib/pipeline-state.ts — line anchors as cited, verified 2026-09-16]
- [Source: memory/2026-09-12.md — the whole-tree delivery incident class (via tests/unit/project-target-guards.test.ts header)]
