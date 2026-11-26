# Machinery batch — per-row evidence (PR #2177)

- **Date**: 2026-11-25
- **Design**: `docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md`
- **Branch**: `pr/20261125-154958-fix-verifier-name-engine-preserved-confl`
- **Author**: automation-engineer

## Why this file exists

The seven commits of rows 1 to 7 carry a title and an empty body: `dev-sync` used the message argument as the commit message and the `--body-file` text as the pull-request body only. The canary evidence the design requires per row (section 5, implementation note) was therefore not recorded in any commit. This file records it.

## How the evidence was produced

Every canary and every named test below was **re-run read-only** on 2026-11-25 between 11:30:43Z and 11:35:55Z (20:30 to 20:35 KST), at head `8b42bbeec` (after row 8), with the working tree as described in "tree state". The earlier outputs saved during the rows' development were not used as the record. Raw outputs are in `/tmp/machinery/ev/` on the operator machine (not committed, not durable).

- "Dry-run" canaries are read-only for the project trees. No file under `Projects/*` was written.
- Engine tests run the real engine on temporary projects under the system temp directory, not on fleet projects.
- Tree state at re-run time: `docs/skill-graph-history.html` and `memory/skill-graph-metrics/snapshot-2026-11-25.json` dirty (PM-owned, unstaged), `tickets/governance/T-20261124-010.yaml` dirty (its move to `running`), `memory/2026-11-25.md` carrying dev-sync session blocks.

`dev-sync` ran the full unit and integration suites before each of the eight landings; each landing exited 0. Two landings failed first and were re-run after a fix (row 1: a TypeScript narrowing error caught by the typecheck gate; row 5 and row 6: a new git-spawning test file not registered in the fixture-git adoption registry). No hook or gate was bypassed.

## Row 1 — §4.4 verifier (T-20261124-011) — commit `a37dd0dd3`

- **Files**: `scripts/verify-delivered-versions.ts` (1.0.0 -> 1.1.0), `tests/unit/verify-delivered-versions-conflict.test.ts`, `scripts/SCRIPTS.md`, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 6 (conflict with matching hash; changed hash -> `conflict-overwritten`; `decisions[]`-only conflict; common script present only in `baselines` is probed; unlisted template `scripts/**` path is probed; clean project).
- **Test run**: `bun test tests/unit/verify-delivered-versions-conflict.test.ts` — 6 pass, 0 fail.
- **Canary**: `bun scripts/verify-delivered-versions.ts --project Projects/co-deck --template templates/co-deck` — exit **1**, run 11:30:43Z.
  - `✗ verify-delivered: 41 finding(s) — the delivery is INCOMPLETE`
  - 39 `[conflict]` rows, 0 `conflict-overwritten`, 2 `[stale]` (`scripts/co-deck/tests/diagram-helpers.test.ts` 1.0.0 < 1.1.0; `agents/pm.md` 1.1.0 < 1.2.1)
- **Canary**: same on `Projects/co-architect` / `templates/co-architect` — exit **1**.
  - `✗ verify-delivered: 7 finding(s)`; 6 `[conflict]` rows (bylaw-expert, drafting-architect, interior-designer, mep-engineer, structural-engineer, visualization-expert), 0 `conflict-overwritten`, 1 `[stale]` (`agents/pm.md` 1.2.0 < 1.2.3)
- **Design fact stale**: the design expects 10 `conflict` rows on co-deck. The stored manifest carries 39 `pendingBackport` CONFLICT rows; the 10 the design names are the ten that also read as stale.
- **Design fact stale**: `pendingBackport[].projectHash` is not a raw SHA-256 of the file. The engine records `baselineKeyFor` (lifecycle-stripped text for `agents/**`), so the overwrite check uses the same key. A raw hash would report every preserved agent as overwritten.

## Row 2 — §4.2 + §4.3 ledger verify (T-20261124-008, T-20261123-008) — commit `9ea92d8bc`

- **Files**: `scripts/run-manifest.ts` (1.1.0 -> 1.2.0), `tests/unit/run-manifest-verify-coverage.test.ts`, `scripts/SCRIPTS.md`, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 13 (exit 4 / 0 / 0 for the three gate-coverage fixtures; battery-only night; exit 5 with a missing component; skip-only row covers; failed row covers; no `--profile` no check; unknown profile is usage error; exit 6 for a night without a manifest; present night exits 0; Saturday is not scheduled; `--nights 0` inspects nothing).
- **Test run**: `bun test tests/unit/run-manifest-verify-coverage.test.ts tests/unit/run-manifest-gate-step-i.test.ts` — 21 pass, 0 fail.
- **Canary**: `bun scripts/run-manifest.ts verify --date 2026-11-25` — exit **0**. `✓ manifest verify passed: 7 merge(s), 7 skip(s), 0 repair(s), 15 review(s), 15 gate check(s), 15/10 project(s) gate-covered`
- **Canary**: `bun scripts/run-manifest.ts verify --date 2026-11-24` — exit **0**. `14 merge(s), 11 skip(s), 16 review(s), 15 gate check(s), 15/6 project(s) gate-covered`
- **Canary**: `bun scripts/run-manifest.ts verify --date 2026-11-25 --profile full` — exit **5**. `component coverage FAILED: 8 component(s) of 10 have neither a steps row nor a skippedBudget row: STEP_A, STEP_B, STEP_C, STEP_D, STEP_F, STEP_G, STEP_H, STEP_J`
- **Canary**: `bun scripts/run-manifest.ts verify --date 2026-11-25 --nights 1` — exit **0** (`1 scheduled night(s) present`).
- **Canary**: `bun scripts/run-manifest.ts verify --date 2026-11-24 --nights 1` — exit **6**. `missed-night check FAILED: 1 scheduled night(s) before 2026-11-24 have no run manifest: 2026-11-23`
- **Reconstruction (not the stored ledger)**: a copy of the 2026-11-24 manifest with `gateChecks` emptied, replayed from a temp directory — exit **4**. `STEP I gate coverage FAILED: 0 project(s) carry a STEP_I_PRE_REVIEW row, 6 expected (16 review row(s) minus STEP I skip(s))`
- **Design fact stale**: the design expects exit 4 on the stored 2026-11-24 manifest. It exits 0: that manifest now holds 15 gate rows stamped 2026-11-24T18:16Z, written after the incident run.
- **Assumption made**: the design names two profiles without listing components. `full` = STEP_A to STEP_J; `fast` = STEP_A, STEP_E, STEP_J (my choice; needs PM confirmation). `--nights` inspects the nights before the verified date.

## Row 3 — §4.1 backfill content key (T-20261124-001) — commit `979041f5f`

- **Files**: `scripts/skill-graph-fleet-report.ts` (2.6.2 -> 2.7.0), `memory/skill-graph-metrics/root-backfill.json` (regenerated), `docs/designs/2026-11-24-backfill-invalidation-key-design.md` (section 3), `tests/unit/skill-graph-observability.test.ts`, `scripts/SCRIPTS.md`, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 5 (equal content with a different graph commit is fresh; different content is stale; legacy file stale once; graph commit still compared without a content hash; `readGraphContentSha256` hashes the blob at the commit). One existing test re-pinned to the content key.
- **Test run**: `bun test tests/unit/skill-graph-observability.test.ts tests/unit/skill-graph-fleet-convergence.test.ts` — 60 pass, 0 fail.
- **Canary**: `ensureRootBackfill(cwd, docs/skill-graph.json, <temp output path>)` twice — exit **0**. Call 1 `rebuilt true`; call 2 `rebuilt false`; `graphHeadSha f05298ac98f517e834fe6f66397aaf25402fbc29`, `graphContentSha256 30ec27ee567f9a31be90514cec3212eef619b5bae007c41adf9c415231a39306`.
- **Design canary NOT RUN**: "the next graph-touching landing; the following fleet-report run reports the backfill fresh" needs the nightly fleet-report run, which writes PM-owned artifacts. What ran is the two-call fixed-point check above.

## Row 4 — §4.5 validator fallback (T-20261124-012, U-20261123-004) — commit `5a57171a7`

- **Files**: `scripts/validate-decisions.ts` (1.2.1 -> 1.3.0) and its byte-identical `templates/common/scripts/validate-decisions.ts`, `tests/unit/validate-decisions-root-fallback.test.ts`, both `SCRIPTS.md` registries, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 4 (root-only id passes with an INFO line and `rootResolved`; both levels resolve locally; nowhere fails Check V; `ROOT/../../` without `AGENTS.md` is ignored).
- **Test run**: `bun test tests/unit/validate-decisions-root-fallback.test.ts tests/unit/validate-decisions.test.ts` — 10 pass, 0 fail.
- **Canary**: in `Projects/co-security`, `bun ../../scripts/validate-decisions.ts` — exit **0**, run 11:31:15Z. `Errors: 0`, `Warnings: 4`, `✅ All decision records valid`, 0 root-resolved INFO lines. Also exit 0 on co-deck, co-architect (1 root-resolved INFO line), co-work, co-abap.
- **Design canary NOT RUN as written**: "step 3.96b exits 0 without pointer records". The current co-security checkout already exits 0 with the pre-change validator (0 `dec-id-unresolved` errors), so it does not reproduce the blocking state. dev-sync step 3.96b was not exercised inside a project.

## Row 5 — §4.8 content-identity fast path (PM finding 1) — commit `2fa962eb8`

- **Files**: `scripts/lib/upgrade-policy.ts` (1.49.0 -> 1.50.0) and twin, `scripts/upgrade-project.ts` (1.116.0 -> 1.117.0), one matrix row in `docs/designs/2026-10-27-sync-overwrite-policy-design.md` section 4, `docs/lifecycle/scripts/upgrade-project.md`, `tests/unit/upgrade-policy-content-equivalent.test.ts`, `tests/unit/fixture-git-identity.test.ts` (registry), registries, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 9 (6 unit on `classifyProjectState` and `contentEquivalentText`; 3 engine: fast path fires at INFO without a grant and the baseline resets; a project marker the template lacks stays a conflict).
- **Test run**: `bun test tests/unit/upgrade-policy-content-equivalent.test.ts` — 9 pass, 0 fail. Regression at landing: six engine files, 172 pass, 0 fail.
- **Canary (dry-run only)**: `bun scripts/upgrade-project.ts Projects/co-architect --dry-run` — exit **0**, run 11:30:46Z. Six `UPDATE agents/<name>.md 1.0.1 → 1.0.2` rows (mep-engineer, drafting-architect, bylaw-expert, visualization-expert, interior-designer, structural-engineer); 0 `CONFLICT DISPOSITION` lines.
- **Not shown by a dry-run**: the `CONTENT_EQUIVALENT` verdict row is written to the delivery manifest only on a real run. The six deliveries appear as `UPDATE` lines. The conflicts are not cleared on disk by this commit; that needs a real upgrade of co-architect.
- **Design fact stale**: `scripts/upgrade-project.ts:4036` is cited as the agents conflict site; the agents version-gated arm calls `evolvedDeliveryGuard` from about line 6700. There is no `templates/common/scripts/upgrade-project.ts` twin.

## Row 6 — §4.9 dependency location (PM finding 2) — commit `f13c104fb`

- **Files**: `scripts/contained-run.ts` (1.0.0 -> 1.1.0), `tests/unit/contained-run-manifest-dir.test.ts`, `tests/unit/fixture-git-identity.test.ts` (registry), `scripts/SCRIPTS.md`, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 5 (scripts-scoped layout passes; `postinstall` in `scripts/package.json` exits 3; a root `package.json` keeps the root location; both absent exits 3; absence reported against the scripts location).
- **Test run**: `bun test tests/unit/contained-run-manifest-dir.test.ts` — 5 pass, 0 fail.
- **Canary**: `bun scripts/contained-run.ts --project Projects/co-safety -- bun scripts/audit.ts` — exit **0**. `· contained-run: bun scripts/audit.ts → exit 0 in 2.3s (env-scrubbed, group-killed on 900s)`. The co-safety tree was unchanged afterwards.

## Row 7 — §4.6 four engine gaps (T-20261124-013, U-20261123-003) — commit `ffed5d8b9`

- **Files**: `scripts/lib/upgrade-policy.ts` (1.50.0 -> 1.51.0) and twin, `scripts/upgrade-project.ts` (1.117.0 -> 1.118.0), `templates/co-work/scripts/co-work/SCRIPTS.md` (`check_openability.py` row added), `docs/lifecycle/scripts/upgrade-project.md`, `tests/unit/upgrade-script-lane-gaps.test.ts`, `tests/unit/fixture-git-identity.test.ts` (registry), `tests/unit/upgrade-prune-removed.test.ts` and `tests/unit/upgrade-overwrite-protection.test.ts` (their fixture registries gain the `## Registry` heading their own comment describes), registries, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 7 (3 unit on the registry helpers, including a backtick pipe parsing to 8 columns; 4 engine: `.py` under `scripts/deck/` delivered; a file no lane places gets `UNCLASSIFIED`; a stale row is reconciled; an unfixable row is `REGISTRY_DRIFT` with a non-zero exit).
- **Test run**: `bun test tests/unit/upgrade-script-lane-gaps.test.ts` — 7 pass, 0 fail. Regression at landing: ten engine files, 143 pass, 0 fail after the fixes described below.
- **Canary (dry-run only)**: `bun scripts/upgrade-project.ts Projects/co-work --dry-run` — exit **0**. `deck/check_openability.py 1.1.0`, `deck/render_previews.py 1.0.0`, `deck/svg_check.py 2.1.1`, `deck/tests/test_svg_check.py 2.0.1` listed; 8 `UNCLASSIFIED` rows (7 sample-business-report fixtures and `scripts/propagation-map.json`).
- **Canary (dry-run only)**: `Projects/co-security --dry-run` — exit **0**. 1 `UNCLASSIFIED`, 0 `L0-ONLY SKIP`, 0 `UNREGISTERED SCRIPT`.
- **Fleet dry-run**: all 18 `Projects/co-*`, run 11:31:22Z to 11:31:37Z. 15 exit 0 with zero `REGISTRY DRIFT` and zero `UNREGISTERED SCRIPT`. Exit 1 on: co-deck (39 pre-existing conflict dispositions), co-safety (1 pre-existing conflict disposition), co-abap-plugin (not a fleet member; refuses), co-utility (adoption-only; refuses), co-newbiz (`ERROR: .github/workflows/ci.yml merge failed validation — nothing was written for it`, cause `MIGRATION_UNSAFE: unknown top-level key(s) concurrency`; a ci.yml merge finding, not a script-lane row; not compared against the pre-batch engine).
- **Design fact confirmed**: `collectScriptFiles` accepted `.ts` only and the variant lane `.ts/.mjs/.json`, so `.py` fell through both lanes.
- **Design canary NOT RUN**: `L0_ONLY_SKIP for the fleet-report script` on co-security cannot fire. `skill-graph-fleet-report.ts` has no `templates/common/scripts/` twin and is not under `templates/co-security/scripts/`, so no lane visits it. The skip is covered by the unit helper test only, not by an engine run. The code path that copied it on 2026-11-23 is still unknown.
- **Deviation**: an absent `scripts/SCRIPTS.md` does not raise `REGISTRY_DRIFT` (that made 53 existing engine fixtures fail; the registry file is not a script-lane deliverable). The error fires only when a registry exists and a row still disagrees after one reconcile.
- **Not delivered**: the files now named `UNCLASSIFIED` (deck test fixtures, `propagation-map.json`) are named, not delivered.

## Row 8 — §4.7 full-scan config delivery (T-20261124-007) — commit `8b42bbeec`

- **Files**: `templates/common/.github/gitleaks-full.toml` (new, byte copy), `docs/protected-paths.json` (carve-out entry), `docs/adr/0105-unified-batch-runner.md` (amendment), `scripts/lib/upgrade-policy.ts` (1.51.0 -> 1.52.0) and twin, `scripts/upgrade-project.ts` (1.118.0 -> 1.119.0), `docs/lifecycle/scripts/upgrade-project.md`, `tests/unit/gitleaks-full-config-parity.test.ts`, registries, `docs/VERSION_MANIFEST.md`.
- **Tests added**: 3 (byte identity; LOCKED claim; carve-out membership with the parity-closure guard clean).
- **Test run**: `bun test tests/unit/gitleaks-full-config-parity.test.ts` — 3 pass, 0 fail (with four engine files: 57 pass, 0 fail).
- **Canary**: `bun scripts/check-upgrade-coverage.ts --strict` — exit **0**, `No violations.`
- **Canary**: `bun scripts/verify-prompt-integrity.ts --parity-closure --no-ticket` — exit **0**. `✓ parity-closure: 7 fleetParityCarveOut path(s) inside engine LOCKED ∪ MERGE_MANAGED`
- **Canary**: the engine (apply) on a fresh temporary co-work project — exit **0**, run 11:32:37Z. `LOCKED: .github/gitleaks-full.toml`, `WROTE: .github/gitleaks-full.toml`; the delivered file is byte-identical to the root file.
- **Two files outside the design's row 8 list, both required by its goal**: the parity-closure guard admits only LOCKED or MERGE_MANAGED paths into the carve-out, so the path needed the LOCKED claim; and the engine's LOCKED pass is a hardcoded list, so the claim alone did not deliver the file (it was absent from the fresh project before the list entry was added).
- **Design canary NOT RUN**: "co-abap: wave PR carries the file; predicate 4 runs and passes" needs a real upgrade of a fleet project, which writes under `Projects/*`.

## Row 9 — §4.10 runner prompt revision — repository half landed

- **Status**: the repository half is landed: `docs/governance/automation-prompts/runner-v6.snapshot.txt` (new) and the `prompts.manifest.json` entry for `automation-dfba3ff1-a1df-42e3-b358-7c641f974648` (sha256 `f0744a2aa8eaa5432f91353202ed98c62b3e453bebf6885f1d9ba3e53edb0ae7`, `snapshot` now `runner-v6.snapshot.txt`, 24,076 bytes). `runner-v5.snapshot.txt` is kept as the prior ratified generation, as v4 was at the v5 bump (commit `ef37c242c`).
- **Live store**: update pending the PR merge — performed by the PM. The PM pastes the exact bytes of `runner-v6.snapshot.txt` into the live prompt. The file has NO trailing newline; the live v5 text has none either, so a paste that adds one will not hash to the manifest value.
- **How v6 was made**: v5 plus six exact string replacements, each required to match once (header sentence, STEP 0, STEP I (0a) inserted, STEP I (1), STEP I (5), PER-STEP DEADLINES). The diff against v5 is 5 lines removed and 6 added. Nothing else was reworded.
- **Verifier method**: `scripts/verify-prompt-integrity.ts` reads the live `prompt` column of `automations` for the automation id through bun:sqlite read-only and hashes its UTF-8 bytes (no trimming, no newline normalisation). It hashes the file named in the manifest `snapshot` field as raw bytes. Both must equal the manifest `sha256`. There is no flag that skips the live store (`--store`, `--exec-closure`, `--parity-closure`, `--gate`, `--no-ticket` only).
- **Verification 1 (real store, v5 live)**: `bun scripts/verify-prompt-integrity.ts --no-ticket --exec-closure` — exit **1**, the expected result before the store is updated.
  - `✗ automation-dfba3ff1-a1df-42e3-b358-7c641f974648 — unratified-live-edit: live store is AHEAD of the ratified record — the snapshot still hashes to the manifest sha256 (store text changed without a governance change set)` (the verdict text reads "ahead" because the script names the older direction; here the live text is BEHIND, at v5)
  - `hunks: live lines 5-41 (37) vs snapshot lines 5-42 (38)`
  - `✓ exec-closure: 17 prompt-referenced script(s) inside protectedPaths ∪ runner-exec-allowlist`
  - `✗ prompt integrity ALERT (scheduled, host Mac-mini-6.local): exit 1 — alert JSON .pipeline-state/prompt-integrity-alert-2026-11-25.json`
  - The one mismatch is live against the manifest. The snapshot and the manifest agree: both hash to `f0744a2a…` (`shasum -a 256 runner-v6.snapshot.txt` and the manifest `sha256` are identical). The alert wrote one `prompt-integrity ALERT` line into `memory/2026-11-25.md`; that line was removed from the working tree before the commit because it describes the pre-merge state, not a runner event.
- **Verification 2 (store copy, v6 pasted)**: a copy of `~/.zcode/v2/tasks-index.sqlite` under the system temp directory, with the copy's prompt set to the snapshot text (the live store was not written). `bun scripts/verify-prompt-integrity.ts --store <copy> --no-ticket --exec-closure --parity-closure` — exit **0**.
  - `✓ automation-dfba3ff1-a1df-42e3-b358-7c641f974648 — match: live, manifest, and snapshot agree`
  - `✓ exec-closure: 17 prompt-referenced script(s) inside protectedPaths ∪ runner-exec-allowlist`
  - `✓ parity-closure: 7 fleetParityCarveOut path(s) inside engine LOCKED ∪ MERGE_MANAGED`
  - `✓ prompt integrity: 1/1 match (scheduled, host Mac-mini-6.local)`
  - The copy's prompt hashed to `c91eeb1c…` (v5) before the update, which confirms that a paste of the file bytes reproduces the manifest hash.
- **Until the PM updates the store**: on this branch the verifier exits 1, and the runner's STEP 0 `--gate` wrapper aborts a 03:00 run that executes from a checkout holding v6 in the manifest with v5 in the store. The store must be updated before the first 03:00 run after the merge.
- **Deviation from the brief**: the brief named `run-manifest.ts step --status <done|failed>`. The CLI accepts `begin|complete|failed|skipped-budget` and rejects `done`. The prompt uses `complete`.
- **Not verifiable here**: the prompt is behaviour text. Whether the runner writes the `complete` rows and makes `verify --profile full --nights 1` pass is seen on the first night after the store update.

### Textual changes (v5 to v6)

1. Header: inserted after "post-delivery verification;" — "revised to v6 by design 2026-11-25-upgrade-runner-machinery-batch-design §4.10 (DEC-20261125-01)". The existing history text is unchanged.
2. STEP 0, after the ledger init — "Then verify the previous night (T-20261123-008): run `bun scripts/run-manifest.ts verify --date <previous night> --profile full --nights 1`; exit 5 (a component of the profile has no ledger row) or exit 6 (a scheduled night has no run manifest) is reported loudly in the daily report — it does not abort the run."
3. STEP I, new (0a) — "GATE CALL (T-20261124-008): BEFORE the first dry-run, run `bun scripts/run-manifest.ts gate-step-i --project <p> --basis <head>` (repeatable pairs, one pair per wave project; run it once with every admitted project) and confirm its exit code. Exit 0 = the submitted projects are admitted; a non-zero exit = the projects it names lack a fresh review pass — SKIP them tonight (`run-manifest.ts skip --step STEP_I --reason "..."`), waves defer per carried-wave-first, and they NEVER enter (1). A dry-run that starts before this call has exited did not pass the gate."
4. STEP I (1), appended — "The DRY-RUN runs for EVERY project admitted to STEP I; canary-first limits only the first REAL run (4), never the dry-run."
5. STEP I (5), appended — "A `[conflict]` or `[conflict-overwritten]` row is NEVER fixed by copying a template file over the project copy (T-20261124-011): the project copy is engine-preserved and is adjudicated, not overwritten — the delivery is recorded INCOMPLETE and a ticket is filed naming the path and the merge SHA."
6. PER-STEP DEADLINES, after "write the row):" — "at every step boundary the runner records the step it has just finished with `run-manifest.ts step --step <NAME> --status complete`, or `--status failed` when the step failed, in addition to the `skipped-budget` row rule that follows. `<NAME>` is the component name written exactly as the ledger expects it: STEP_A, STEP_B, STEP_C, STEP_D, STEP_E, STEP_F, STEP_G, STEP_H, STEP_I, STEP_J. The profile tables (`full`, `fast`) and their component lists are defined in `scripts/run-manifest.ts`, never in this prompt." The existing `skipped-budget` sentence follows unchanged.

### First attempt (rows 1–8 session) — superseded

- **Status**: stopped before any file was written. No commit.
- **Reason**: the revision needs the live prompt text in the ZCode automation store to be replaced. That store is out of repository (design section 3, `docs/protected-paths.json` `outOfRepoProtected`) and is edited by the human operator; the v5 ratification on 2026-11-20 recorded that store edits were made out-of-band by the dispatching session. This session has no tool that writes the store.
- **What was run**: `bun scripts/verify-prompt-integrity.ts --no-ticket` at 11:35Z — exit **0**. `✓ automation-dfba3ff1-a1df-42e3-b358-7c641f974648 — match: live, manifest, and snapshot agree`; `✓ prompt integrity: 1/1 match`.
- **Why not land snapshot and sha alone**: a v6 snapshot with a new `prompts.manifest.json` sha while the live store still holds v5 makes the verifier report drift, and the runner's STEP 0 `--gate` wrapper fail, on every run until the store is updated. No `runner-v6.snapshot.txt` was created and `prompts.manifest.json` is unchanged.
- **Required from a human**: apply the four revisions of design section 4.10 to the live prompt, then land prompt text, `runner-v6.snapshot.txt` and the new sha in one change set, then run the verifier. The four revisions are not written anywhere yet.

## Windows CI failures — 2026-11-25

The root CI matrix (3 OS) failed on `test (windows-latest, 18.x)` at `a1f9417fc`, `ffed5d8b9` and `f13c104fb`: "2 of 356 test files failed". Ubuntu and macOS passed. Both failures have one root cause: `Bun.Glob.scanSync` yields `\`-separated relative paths on Windows and `/`-separated paths elsewhere, and two new sweeps used its result raw as a POSIX-style manifest key. This is a **production-script** defect, not a test defect: fleet projects run `upgrade-project.ts` and `verify-delivered-versions.ts` on Windows too.

| Failing file | Introduced by | Assertion | Root cause |
|---|---|---|---|
| `tests/unit/verify-delivered-versions-conflict.test.ts` | `a37dd0dd3` (row 1) | `kindOf(findings, "scripts/variant/only.ts")` expects `absent`, received `undefined` | `scripts/verify-delivered-versions.ts` — the template `scripts/**` candidate sweep added raw glob entries (`scripts\variant\only.ts`), so the finding never carried the manifest-style path. A path the manifest lists both ways was also probed twice. |
| `tests/unit/upgrade-script-lane-gaps.test.ts` | `ffed5d8b9` (row 7) | `toContain('scripts/deck/tests/fixtures/sample-business-report/01-title.svg')` — the row was present with `scripts/deck\tests\...\01-title.svg` | `scripts/upgrade-project.ts` — the §4.6 a coverage sweep compared raw glob entries against lane keys built from `readdirSync` + name joins (`/`). On Windows every delivered script read as unplaced (spurious UNCLASSIFIED WARN rows — `scripts/deck\svg_check.py` was among them although the same run delivered it), and the `entry.endsWith("/SCRIPTS.md")` exclusion missed nested registries. |

Not the cause (ruled out from the log): CRLF/`core.autocrlf`, `path.relative`, drive-letter roots, git config. The passing sibling tests in both files use the same fixtures.

- **Reproduction**: the Windows walker output itself does not reproduce on macOS (`Bun.Glob.scanSync` returns `/` there, and the scratch control passed). The downstream effect reproduced locally with the literal strings from the CI log: `"deck\\svg_check.py"` is absent from a `/`-keyed set, its dot-part filter sees one part, and the nested-registry exclusion is `false`. The CI log is the evidence for the walker half.
- **Fix**: new pure helper `toPosixPath(rel, platform = process.platform)` in `scripts/lib/upgrade-policy.ts` (1.53.0; its `templates/common/scripts` twin is byte-identical). `scripts/verify-delivered-versions.ts` (1.2.0) and the `scripts/upgrade-project.ts` sweep (1.120.0) normalise each glob entry with it. The Windows arm is a parameter so it is unit-tested on every OS; POSIX is the identity function (a backslash is a legal filename character there).
- **Tests**: neither existing assertion was loosened. Added: `toPosixPath` cases with literal backslashes in both files; in the verifier test the finding set is now exactly the three template scripts with no backslash; in the engine test every UNCLASSIFIED row must start with `scripts/`, contain no backslash, never name a file a script lane delivered, and never name a registry file.
- **Registry**: `scripts/SCRIPTS.md` rows for the three scripts, the regenerated `templates/common/scripts/SCRIPTS.md` mirror span, and `docs/lifecycle/scripts/upgrade-project.md` (Version, changelog, Phase History row).

## Upstream request U-20261123-003 — kept open

- Row 7 implements the L0-only guard: a script whose only registry row has layer `L0`/`L0-only` is never copied to a variant target (`L0_ONLY_SKIP` at INFO), covered by a unit helper test.
- The script lane now names every file it cannot place (`UNCLASSIFIED` at WARN) instead of passing over it silently.
- The original event is still unexplained: `skill-graph-fleet-report.ts` appeared in co-security on 2026-11-23, but that script has no `templates/common/scripts/` twin and is not under `templates/co-security/scripts/`, so no lane visits it and the engine-run canary for the skip cannot fire. The code path that copied it was not identified. The ticket therefore stays open rather than being closed on a mitigation whose trigger is unproven.

## Follow-ups: T-20261125-002 and T-20261125-003 (2026-11-25)

Landed together on one branch (two commits, `fix(agents)` + `fix(upgrade)`), remedying predicate-8 ticket T-20261126-002 (four wall-exception merges verify with exactly one stale row — `agents/pm.md` behind template).

Design: `docs/designs/2026-11-25-agent-lifecycle-extends-and-dry-run-tombstone-design.md` (registered `--status implemented`; decisions D1 resolution-not-duplication, D2 previewable grants with apply-only persistence).

### T-20261125-002 — the `lifecycle` gap in variant `agents/pm.md`

- **Validator behaviour (evidence)**: `scripts/validate-agents.ts` (HEAD `a47c4ecf8`) validated every `agents/*.md` standalone — `hasNestedField(rawContent, field)` with no `extends` resolution (`AGENTS_DIR = join(cwd, "agents")` only; `templates/` never read). Running the HEAD validator standalone against pristine HEAD copies of `templates/co-security/agents/` (pm.md 1.1.1, i18n-specialist.md) in a temp dir reproduced the ticket's exact failure string: `pm: Missing frontmatter fields: lifecycle.phase, lifecycle.governance` plus the same for `i18n-specialist` (exit 1, 4 errors).
- **The asymmetry, explained**: root CI passes because the script scans `<cwd>/agents` — at the workspace root that is `agents/` (all 9 root agents carry their own `lifecycle` block); the 17 template stubs are never visited. A project copy does NOT fail — `Projects/co-security/agents/pm.md` is a scaffold-RESOLVED body carrying its own lifecycle block (v1.0.0); the HEAD validator run there exits 0. The failure surface is (a) running the validator inside a template checkout (standalone stubs), or (b) a delivery that carried a stub verbatim. The ticket's reported project-side failure could not be reproduced against the current delivered copy.
- **Fix chosen — resolution, not duplication (option ii)**: `validate-agents.ts` 1.4.2 Part 1 resolves the ADR-0033 `extends:` chain before checking (`frontmatterFieldPaths` / `resolveFrontmatterFields`, block-scalar aware, depth-capped at 5, cycle-safe); a base absent from the current checkout contributes nothing and the failure message names the unresolvable target. `agentBodyCompleteness` now skips extends stubs without depending on the L0-only schema validator being importable (the same tier asymmetry class). Adding `lifecycle:` blocks to the pm.md stubs was REJECTED: `audit.ts` `checkPmConsistency` enforces `lifecycle:` as L0-only for L1/L2 pm.md (`variantsAllowingLifecycle = {co-safety}`) — an attempted block addition failed the audit (`L1 pm.md: contains L0-only field "lifecycle:"`) and was reverted; the stubs stay deltas.
- **Changed**: `scripts/validate-agents.ts` 1.4.2 + byte-identical `templates/common/scripts/` twin; frontmatter-only version bumps on all 16 `templates/{common,co-*}/agents/pm.md` (common 1.4.4→1.4.5, variants patch+1, `last_updated: 2026-11-25`) so the next fleet wave delivers pm.md and the T-20261126-002 stale rows clear after delivery; `docs/templates/common-contract.json` pm version parity (C-CM-03a). `co-safety`'s own lifecycle block untouched (documented exception).
- **Test**: `tests/unit/agent-lifecycle-extends-inheritance.test.ts` (10 cases): chain inheritance, two-level chain, project-cwd unresolvable target still fails WITH the target named, cycle termination, and the doctrine pin (pm.md stubs stay lifecycle-free except co-safety). Pinned pre-fix failure: the standalone scan of HEAD stub copies (above).
- **Gate exits (2026-11-26 run)**: `bun scripts/audit.ts` 0; `bun scripts/validate-templates.ts` 0 (0 errors / 46 warnings, all pre-existing); `bun scripts/validate-agents.ts` 0 at root AND inside all 17 `templates/*/` checkouts AND inside `Projects/co-security` (the new resolution makes the standalone template scans green — the exact surface that failed); `bun test tests/unit` 5157 pass / 0 fail; `bun scripts/typecheck.ts` 0 errors.

### T-20261125-003 — `--dry-run` tombstone fidelity and previewable grants

- **Fidelity finding**: the ticket's co-deck observation (dry-run shows ADOPT/CONFLICT rows, no tombstone row) did NOT reproduce at HEAD `a47c4ecf8`: `bun scripts/upgrade-project.ts Projects/co-deck --dry-run --prune-removed` exit 1 already printed `⏭️ TOMBSTONE (SKIP): .mcp.json — project deleted a previously delivered file; delivery refused (severity ERROR)` plus the DELIVERY CONFLICTS summary row and the "Tombstoned paths — how to proceed" menu. `tombstoneSkip()` runs unconditionally in every absent-copy branch under dry-run (no short-circuit); only the manifest WRITE is apply-gated. The nightly runner's co-deck dry-run not showing the row is consistent with a suppressed/re-parsed pass view; not reproduced here — the behaviour is now pinned by tests instead.
- **The real gap — apply-mode-only flags**: `--tombstone` / `--clear-tombstone` were refused under `--dry-run` (`ERROR: ... apply-mode only`), so a reviewer holding the dry-run's `confirm with --tombstone <path>` line could not verify the grant glob before spending an apply run. Fixed in `scripts/upgrade-project.ts` 1.121.0: under `--dry-run` the flags are a READ-ONLY PREVIEW — `tombstoneSkip` reports `🪦 TOMBSTONE (would be recorded): <rel>` naming the matching grant and writes nothing (the manifest write stays inside the apply-only block); a `--tombstone` glob matching no candidate and a `--clear-tombstone` glob matching no recorded tombstone/baseline are named as WARNs before the summary. Decision: the flags KEEP their apply-only persistence semantics; only the refusal became a preview (recording intent is a manifest mutation, not previewable state).
- **Tests**: `tests/unit/upgrade-dry-run-tombstone.test.ts` (5 engine runs): dry-run emits the TOMBSTONED row at ERROR with resolution text and persists nothing (byte-identical manifest); previewed grant resolves the ERROR to exit 0 while persisting nothing; unmatched glob WARNs and the refusal stands; apply still refuses without the flag; apply with `--tombstone` records the entry and exits 0. `tests/unit/upgrade-decision-log.test.ts`: the old refusal expectation flipped to the preview contract (ordered before the mutating-grant rider on the shared fixture). Suite registered in `FIXTURE_GIT_ADOPTED_SUITES` (#2178 census).
- **Canaries (read-only, via `bun scripts/contained-run.ts`)**: co-deck exit 1 WITH the row `⏭️ TOMBSTONE (SKIP): .mcp.json — project deleted a previously delivered file; delivery refused (severity ERROR)`; co-safety exit 1, no tombstone row; co-architect exit 0, no tombstone row. No project tree mutated in any run (contained-run post-run porcelain assertion clean).
- **Gate exits**: same battery as above — `bun test tests/unit` 0 failures including the new suites; `scripts/SCRIPTS.md` + `templates/common/scripts/SCRIPTS.md` registry rows and `docs/lifecycle/scripts/upgrade-project.md` updated; `docs/VERSION_MANIFEST.md` / `docs/skill-graph.json` regenerated.

## Follow-up 2026-11-26: stub-version backfill and registry-normaliser regression

Two defects observed in all 7 real upgrade runs of this batch (row 7
`ffed5d8b9` / T-20261124-013 is implicated in the second). Fixes landed under spec
`2026-11-26-stub-version-backfill-and-registry-row-floor-design` (T-20261126-002;
upstream reports `U-20261126-001` / `U-20261126-002`).

### Defect 1 — `agents/pm.md` version never advances (STUB_VERSION_DIVERGENCE)

- **Symptom**: every run reports `STUB_VERSION_DIVERGENCE (INFO)` for
  `agents/pm.md` and `verify-delivered-versions` reports one
  `[stale] agents/pm.md` row per project forever (project stubs 1.0.0/1.1.0 vs
  template 1.1.2–1.2.3 after root #2181).
- **Root cause**: MERGE_MANAGED stubs — the MERGE pass refreshes the managed body
  but never the frontmatter, and the v1.24.0 backfill contract pins the existing
  `version` permanently.
- **Fix**: `backfillStubVersion` (lib/upgrade-policy v1.54.0) + verdict
  `STUB_VERSION_BACKFILL` (INFO); the MERGE pass calls it only after a CLEAN
  managed-body merge (no census escalation, no marker loss, frontmatter untouched
  by the merge). Non-clean merges keep the pin.
- **Tests**: `upgrade-policy-decisions.test.ts` backfillStubVersion (6);
  `upgrade-decision-log.test.ts` backfill / project-ahead pin / dry-run gate.

### Defect 2 — registry rows lowered below the scripts' own `@version`

- **Symptom**: the engine rewrote `lib/error-handling.ts` 1.4.0 → 1.3.0 and
  `detect-backport.ts` 1.0.1 → 1.0.0 in every project's `scripts/SCRIPTS.md`
  (`📝 ... → v1.3.0` / `→ v1.0.0` in the run logs), failing the project
  lifecycle-sync-audit Check A.
- **Root cause**: NOT a stale registry — root, the L1 mirror and delivered
  projects all carried the correct 1.4.0 / 1.0.1. Both scripts carry a stray
  mid-file line-form marker (`// @version 1.3.0` at error-handling.ts:298;
  `// @version 1.0.0` at detect-backport.ts:82) and `extractScriptVersion` gave
  ANY `// @version` line priority over the header; the v1.118.0 row-7 lockstep
  loop reconciled correct rows to the stray numbers.
- **Fix**: header-first parsing (helpers/upgrade-versions v1.3.0, new pure
  `extractScriptVersionFromContent`; header block = shebang/`//`/JSDoc/`#`/Python
  docstring, imports stepped over) + `floorAtProjectScriptVersion` in
  `reconcileScriptRegistry` — a row is never lowered below the project file's own
  header. Verified scope: old-vs-new parser over 600 script files changes exactly
  the 4 intended files.
- **Tests**: `upgrade-versions.test.ts` (+4), `upgrade-script-lane-gaps.test.ts`
  delivery regression (fails 1.3.0 without the fix).

### Gates and canary

- `bun test tests/unit` all green; `bun scripts/typecheck.ts` 0 errors;
  `bun scripts/audit.ts` PASS; `bun scripts/validate-templates.ts` PASS;
  `bun scripts/lifecycle-sync-audit.ts` PASS (after
  `bun scripts/generate-scripts-mirror.ts` regenerated the L1 registry span and
  `bun scripts/generate-version-manifest.ts` refreshed the manifest).
- Canary on a TEMP COPY (`cp -R Projects/co-consult /tmp/wave-canary/co-consult`,
  real project untouched at `50db72d`):
  `bun scripts/upgrade-project.ts /tmp/wave-canary/co-consult --prune-removed --yes`
  exit 0 (engine accepts the non-`Projects/` path). Results:
  `agents/pm.md` `version: "1.0.0"` → `"1.1.2"` with `last_updated` re-stamped
  (out-of-zone body and nested lifecycle block byte-preserved; manifest row
  `STUB_VERSION_BACKFILL | INFO | stub version 1.0.0 → 1.1.2 — ... clean`);
  `lib/error-handling.ts` row unchanged at 1.4.0, `detect-backport.ts` row
  unchanged at 1.0.1 (the run PRINTS `OK detect-backport.ts 1.0.1` /
  `OK lib/error-handling.ts 1.4.0` — the pre-fix runs printed 1.0.0 / 1.3.0 and
  lowered the rows); zero REGISTRY_DRIFT rows;
  `bun scripts/verify-delivered-versions.ts --project <copy> --template
  templates/co-consult` → exit 0, `11 path(s) checked ... 0 findings` (pre-fix
  state on the same copy: `✗ 1 finding(s) — [stale] agents/pm.md — project 1.0.0
  < template 1.1.2`); the project's own
  `bun scripts/lifecycle-sync-audit.ts` ran through
  `bun scripts/contained-run.ts --project <copy>` → exit 0 (`All lifecycle sync
  checks passed`). `/tmp/wave-canary` deleted afterwards.
- Not verified: a second apply run on the canary copy (idempotence at engine
  level) — the copy's own pre-commit hook refuses the intermediate commit and
  hooks are not bypassed in this workspace; helper-level idempotence is
  unit-pinned instead.

## Follow-up 2026-11-26: skill-drift structural fixes S1-S4 + legacy-stub conversion (spec 2026-11-26-skill-drift-structural-fixes-design, PR #2189)

Design `docs/designs/2026-11-26-skill-drift-structural-fixes-design.md` (#2188) — rows 1-5 of its
§5 implementation order (root machinery only; the pair program rows 6-8 are a later dispatch).
Landed as five commits on PR #2189 (branch `pr/20261126-191030-feat-skill-graph-s4-snapshot-transient-r`),
one per change, through `bun scripts/dev-sync.ts` scoped staging.

### Changes and evidence

1. **S4 — snapshot `transient[]`** (commit dd36d06cf): `lib/git-aware-scan.ts` v1.1.0
   (+ byte-identical L1 twin) gains `checkoutHead()` (`git rev-parse --short HEAD` under
   `gitCleanEnv()`, fail-open null); `skill-graph-fleet-report.ts` v2.8.0 writes an additive
   top-level `transient[]` (`{id, branch, head, reason}`, fixed T-20261103-004 rationale)
   from pure `buildTransientEntries`. Tests: `tests/unit/skill-graph-transient-snapshot.test.ts`
   (9, fixture-git FM1/FM2 adopted, registry v1.4.0) — fixture `pr/*` checkout yields exactly one
   entry; main/detached yield none; legacy snapshot shape parses unchanged; head read receives only
   the checkout dir (no tree reads).
2. **S2 — variant-token hash compensation** (commit ffb1d1832): `lib/skill-graph-compat.ts` v1.2.0
   (+ twin) `normalizeForHash(content, variantName?)` / `contentHash(content, variantName?)` reverse
   the scaffold's backtick substitution (exact-slug boundaries on `[a-z0-9-]`; prose outside
   backticks untouched; template-side hashing passes no parameter). `generate-skill-graph.ts`
   v2.1.0 (+ twin) derives `VARIANT_NAME = basename(ROOT)` when `isFleetProjectPath(ROOT,
   workspace-root-inferred-two-levels-up)` — refinement over the design's bare
   `isFleetProjectPath(ROOT)` (a delivered fleet.ts's defaultRoot is the project itself, so the
   workspace root is inferred upward for the guard to hold in both invocation contexts) — and
   forwards to BOTH contentHash call sites (readCopy AND the platform-mirror mirror[] comparison).
   Root graph regenerated byte-identical (S2 is a no-op at root scope); zero SKILL.md diffs. Tests:
   `tests/unit/skill-graph-variant-hash.test.ts` (7) — the real template × co-news
   script-lifecycle-manager pair hashes equal under `co-news` and differs under an unrelated slug.
3. **S3 — skill-intent registry** (commit 48574821e): new L0-only `docs/skill-intent.json`
   (fleet-membership house shape, 5 kinds) seeded with the 7 adjudicated KEEP registrations
   (adjudication rows 1/5/10/11/12/20/21 of T-20261123-005's report); `skill-graph-fleet-report.ts`
   v2.9.0 — `classifyConvergence` takes an optional pure intent map (deterministic majority
   selection: largest group, tie → lex-smallest hash); fail-closed validation (schema/kind/
   decision_ref/non-fleet project/capability-absent abort the run naming the row);
   `validate-doc-folder.ts` v1.8.0 (+ L1 twin) allowlists the file; docs/README.md manifest
   updated (T-20261004-013 parity pin). Tests: `tests/unit/skill-intent-registry.test.ts` (15).
   Mechanism run: `bun scripts/skill-graph-fleet-report.ts --json --snapshot-dir /tmp/mb2-snapshot
   --no-html` exit 0 — `convergedIntent` covers design-foundation@co-design, i18n-audit@co-price,
   token-usage-lint@co-design; project-review (covered co-abap/co-safety/co-work) and
   skill-lifecycle-manager (covered co-safety) stay divergent annotated pending the pair-program
   rows (design §4.3 partial-coverage behavior). (`--no-html` added to keep the repo tree clean —
   the HTML/backfill islands are WARN-only courtyards; snapshot + JSON are the gate's subjects.)
4. **S1 — SYNC_TEMPLATE_ADVANCE** (commit cd972ac4f): `upgrade-project.ts` v1.123.0 shared helper
   `resolveEqualVersionDrift` routes same-version drifted files in BOTH skills lanes — guard order:
   pre-upgrade-dirty → CONFLICT (WARN) FIRST (the pre-upgrade stash means on-disk bytes during the
   pass are the committed state; found by the engine fixture), then no-baseline/project-moved →
   DRIFT_PRESERVE (unchanged, ADR-0085 D3), then `markerLossBlocks` before the write, then deliver
   the template copy verbatim at INFO with `noteDelivered` refreshing the manifest baseline row
   (the equal-version re-stamp). `lib/upgrade-policy.ts` v1.55.0 (+ twin): verdict + severity row.
   The gate owns the EQUAL-VERSION arm only — a project-ahead skill keeps the unconditional
   DRIFT_PRESERVE rows (first draft clobbered a seeded 99.0.0 baseline; caught by the
   vintage-pending fixture, fixed in the same commit series). Tests:
   `tests/unit/upgrade-template-advance.test.ts` (7 engine scenarios, real co-work templates,
   fixture-git registry v1.5.0).
   **Canary (dry-run, real `Projects/co-consult`, no writes)**: before S1
   (/tmp/mb2/canary-before-S1.txt) 21 `DRIFT (preserved)` rows; after S1
   (/tmp/mb2/canary-after-S1.txt) 15 — the six stranded
   `skills/k-*/references/terms-ko.json` template-side edits now report
   `[DRY RUN] ADVANCE ... SYNC_TEMPLATE_ADVANCE` (delivered by the next real wave), while every
   project-moved drift (script-lifecycle-manager, team-builder, translate, gateguard,
   api-documentation, ...) stays preserved.
5. **T-20261126-003 — STUB_SHAPE_CONVERSION** (commit 6606aa48f): `upgrade-project.ts` v1.124.0
   sibling arm beside STUB_VERSION_BACKFILL (same clean-merge preconditions + shape test);
   `lib/upgrade-policy.ts` v1.56.0 (+ twin) pure `convertLegacyStubShape(projectContent,
   templateContent, deliveryDate, templateCommonContent?)`. Two design-mechanism refinements,
   both found by the engine fixtures and documented in-code: (a) the frontmatter-superset guard is
   realized over the stub ∪ common KEY UNION — the variant counterpart is an extends-only stub
   shadowing the marker-rich common file (the merge pass's own composition rule), so a resolved
   copy's L1-filled keys must not read as project-only; (b) an in-sync managed body
   (finalMerged false) skips the merge's own markerLossBlocks, so the wholesale swap runs the same
   guard on the text it would leave — a project-authored LOCAL-PATCH prose loss blocks with
   MARKER_LOSS and no conversion row (wave-2 states pass via the UNTOUCHED rule). A legacy copy
   carrying genuinely project-only keys (co-work's live `model: inherit`) is WITHHELD at INFO by
   the design's own guard — the hand-advance path remains for those. Tests:
   `tests/unit/upgrade-stub-shape-conversion.test.ts` (8: 4 pure pins + 4 engine scenes);
   fixture-git registry v1.6.0.

### Gates (after each change and at the end)

`bun test tests/unit` all green (final: 5293 tests, 0 fail);
`bun scripts/typecheck.ts` 0 errors; `bun scripts/audit.ts` PASS;
`bun scripts/validate-templates.ts` PASS; `bun scripts/lifecycle-sync-audit.ts` PASS
(after `generate-scripts-mirror.ts` + `generate-version-manifest.ts` refreshes).

### Design facts that were stale or needed refinement

- §4.2's `isFleetProjectPath(ROOT)` needs the workspace root passed explicitly (delivered
  fleet.ts defaultRoot is the project itself in project context) — inferred two levels up.
- §4.2's mirror[] collapse comparison needed the same parameter on both sides (second call site).
- §4.1's guard order as written (marker guard before attribution) would have turned WARN
  DRIFT_PRESERVE rows for marker-bearing project edits into ERROR MARKER_LOSS rows; attribution
  runs first, the marker guard runs before any delivery write, and the AC ("marker blocks even
  under positive attribution") holds by construction — hash-equality implies UNTOUCHED implies no
  project-authored content.
- §4.5's superset guard needs the stub ∪ common union (see 5a above); the wave-2 five projects'
  real frontmatter (co-work carries `model: inherit`) is NOT stub∪common-subset, so those exact
  copies are withheld at INFO and keep the hand-advance path — the design's "bodies byte-identical"
  claim is accurate, its implicit "the guard passes for them" is not.
- The S4 durable artifact and stderr annotation framing (§4.4 "corrected framing") verified as
  written.

### Unverified

- The fleet-wide `script-lifecycle-manager` hash-group collapse (design §8 row 3, "was six → one")
  lands with the delivery wave regenerating project graphs (later dispatch) — not observable from
  the root-only machinery of this dispatch; the pair-equality AC is pinned at unit level.
- `transient[]` had no live `pr/*` checkout at the final mechanism run (all 16 members on main) —
  the record shape is proven by the S4 unit fixtures instead.
