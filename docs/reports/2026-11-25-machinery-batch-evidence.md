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

## Row 9 — §4.10 runner prompt revision — NOT IMPLEMENTED

- **Status**: stopped before any file was written. No commit.
- **Reason**: the revision needs the live prompt text in the ZCode automation store to be replaced. That store is out of repository (design section 3, `docs/protected-paths.json` `outOfRepoProtected`) and is edited by the human operator; the v5 ratification on 2026-11-20 recorded that store edits were made out-of-band by the dispatching session. This session has no tool that writes the store.
- **What was run**: `bun scripts/verify-prompt-integrity.ts --no-ticket` at 11:35Z — exit **0**. `✓ automation-dfba3ff1-a1df-42e3-b358-7c641f974648 — match: live, manifest, and snapshot agree`; `✓ prompt integrity: 1/1 match`.
- **Why not land snapshot and sha alone**: a v6 snapshot with a new `prompts.manifest.json` sha while the live store still holds v5 makes the verifier report drift, and the runner's STEP 0 `--gate` wrapper fail, on every run until the store is updated. No `runner-v6.snapshot.txt` was created and `prompts.manifest.json` is unchanged.
- **Required from a human**: apply the four revisions of design section 4.10 to the live prompt, then land prompt text, `runner-v6.snapshot.txt` and the new sha in one change set, then run the verifier. The four revisions are not written anywhere yet.
