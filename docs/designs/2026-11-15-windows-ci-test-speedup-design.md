# Windows CI Test Speedup — Design

- **Spec id**: 2026-11-15-windows-ci-test-speedup-design
- **Date**: 2026-11-15
- **Status**: implemented (flipped from draft when the implementation landed via the PM Gateway in a single PR; spec registered implemented)
- **Evidence baseline**: CI run 43705458736 (2026-11-15) — windows job 415s vs ubuntu 80s; "Run unit tests" step 361s (windows) vs 41s (ubuntu), 8.8x.
- **Approved scope**: items 1–5 below (user-approved).

## 1. Context & Evidence

Run 43705458736 per-file durations (311 unit files; cumulative 1435s under ~4-way parallelism → 361s wall):

| Bucket | Files | Cumulative | Share |
|---|---|---|---|
| ≥30s | 10 | 891s | 62% |
| 5–30s | 30 | 437s | 30% |
| <5s | 271 | 106s | 7% |

Top 10 files (windows): upgrade-decision-log 232s, upgrade-overwrite-protection 151s, upgrade-tree-sync 140s, co-workspace-admin-console 110s, mcp-upstream-server 63s, co-workspace-admin-console-r2 48s, upgrade-vintage-pending 44s, hub-bootstrap 38s, upgrade-prune-removed 33s, upgrade-skill-subfile-sync 31s.

Root causes, ranked: (a) full `upgrade-project.ts` engine subprocess spawns — each engine run is a bun process that itself spawns bun grandchildren (skill-graph / VERSION_MANIFEST / snapshot / provenance regenerations) and copies the template tree, so one spawn costs ~10–15s on win32; (b) Defender real-time scanning multiplying every file copy and every bun/git process start; (c) 311 one-file-per-`bun-test`-process invocations (~0.3–1s startup each, scanned); (d) the runner pool capped at ~4 workers on a spawn-wait-heavy workload.

Modifiability constraints: `scripts/dev-sync.ts` and `scripts/audit.ts` are frozen core scripts (untouched). `scripts/test-runner.ts` is modifiable but versioned — bump its `@version` header (currently 1.15.0) per its own changelog convention. Heavy test files under `tests/unit/` are freely modifiable.

## 2. Goals & Non-Goals

**Goals**

1. Windows "Run unit tests" wall time from 361s toward ≤200s, via the five approved items.
2. Preserve the runner's reporting invariant exactly: per-file `✓/✗ path (NNms)` lines, per-file pass/fail verdicts, per-file durations feeding the BUDGET-HEADROOM WARN, QA gate, and the version-bump test gate; suite exit code reflects any failure.
3. All changes OS-neutral in code shape; windows-only behavior selected by `process.platform` / workflow `if:` conditions — ubuntu/macos numbers must not regress.

**Non-Goals**

- No test budget raises (the v1.8.0 raise policy stays; post-fix lowering is handled in Validation).
- No `bun test --parallel` in-process parallelism, no runner-image changes, no splitting the windows matrix into its own job.
- No changes to the other workflow files' bun pins (nightly-scaffold-e2e, weekly-health-check, nightly-tickets, edu-sync each pin 1.4.0) — noted as a consistency follow-up, out of this PR's scope.
- Ubuntu/macos runtime optimization.

## 3. Per-Item Design

### 3.1 Item 1 — Reduce engine-subprocess spawns in heavy test files (root cause)

**Spawn inventory (per file run, verified by grep; "engine spawn" = `spawnSync('bun', [upgrade-project.ts, ...])`):**

| File (win32 time) | Engine spawns | Other subprocesses | Heavy factor |
|---|---|---|---|
| upgrade-decision-log (232s) | 14 `runUpgrade()` call sites (file header cites 17 effective runs incl. conditional paths; a v2.0.0 fixture cache already prevents re-seeding) | git init/config×2/add/commit per seeded fixture (5 per seed) + 1 `git config --unset` per lifecycle test (3) | engine grandchildren ≈4–6 bun startups each |
| upgrade-overwrite-protection (151s) | 14 `runUpgrade()` call sites — includes **two duplicated describe-level dry+apply base pairs** (lines ~147–149 and ~350–351) | 5 git helper call sites | engine grandchildren |
| upgrade-tree-sync (140s) | **23 engine spawns** (each `[upgradeScript,` array literal) | **29 direct git spawnSync calls** (init/config×2/add/commit per test seed) | engine grandchildren + per-test git seeding |
| co-workspace-admin-console (110s) | 0 | 0 | 66 tests; sqlite (bun:sqlite) stores + argon2id hashing (`Bun.password.hashSync`, memoryCost 4096) via service `createState`/login; tmpdir fixtures |
| mcp-upstream-server (63s) | 2 long-lived server `Session` spawns | 4 `runTicket` spawnSync sites + installer spawn family (~2 sites) | server JSON-RPC round-trips + workspace fixture `cpSync`, not spawn count |

Also engine-family (for later waves, same patterns): upgrade-vintage-pending 3 engine spawns (documented), upgrade-core-locked-fork 2, upgrade-prune-removed / upgrade-skill-subfile-sync ≤6 spawn-family sites each.

**Consolidation plan (before → after engine spawns):**

1. **upgrade-overwrite-protection: 14 → 9–10.** Hoist one shared dry+apply base pair to a module-level `beforeAll` reused by both suites (removes the duplicated pair, −2). Merge single-shot `--disposition` cases into composite runs: the engine already accepts repeated `--disposition adopt-template=<rel>` flags in one run, so N single-decision tests can assert N dispositions from one combined run's manifest (−2 to −3).
2. **upgrade-decision-log: 14 → 7–8.** (a) The three dry-run-only assertions (lines ~735, ~940, ~1195) reuse one committed read-only base fixture with per-test directory snapshot-restore (`cpSync` out, restore in) — a plain copy is strictly cheaper than an engine run (which is copy + git + grandchild spawns). (b) Group single-shot decision tests into composite multi-flag runs as in (1) where the decision log model allows several decisions per run. Lifecycle pairs (first/second run sequences at ~804/832, ~1046/1064, ~1150/1174) are intentionally multi-run — keep.
3. **upgrade-tree-sync: 23 → ~18 engine, 29 → ~8 git.** Share one git-seeded baseline project: `git init + config×2 + add + commit` once at suite level, `cpSync`-restore per test, then apply only the test-specific edits and a per-test `git add -A + commit` (2 git spawns/test instead of 5). Merge scenario families that differ only by one seeded file into parameterized composite runs where output assertions are per-scene.
4. **co-workspace-admin-console: spawns already 0.** The lever is state reuse, not spawns: build the sqlite-backed `GatewayState` once per describe in `beforeAll` (today `createState` re-bootstraps per test, re-running argon2 admin bootstrap and re-creating sqlite files); per-test isolation via logical cleanup (delete rows / logout sessions) instead of new stores. Keep the documented EBUSY/timeout containment — no store is left open across suites.
5. **mcp-upstream-server: keep the 2 sessions** (already minimal); reuse the ticket CLI workspace fixture across the §13.6 tests instead of re-copying `scripts/ticket.ts` + `helpers/` per test.

**Expected effect (windows):** engine-spawn total across the top files drops from ~54 to ~35–38 runs; with each run worth ~10–15s win32, decision-log 232s → ~110–130s, overwrite-protection 151s → ~100–110s, tree-sync 140s → ~90–100s, admin-console 110s → ~75–90s (with item 2 helping most). These are projections; the Validation plan gates any budget change on measured evidence.

**Invariant rule:** every consolidated run must keep producing the assertions it replaced (assert per-scene sections of the combined manifest/output); no assertion is deleted — only redundant process executions merge.

### 3.2 Item 2 — Windows Defender real-time scanning exclusions (workflow)

Slot: **immediately after "Checkout repository"**, before "Setup Bun" / "Install dependencies" — so `bun install`, template validation, and all later steps benefit, not only tests. windows-latest runners execute steps as an elevated admin user, so `Set-MpPreference`/`Add-MpPreference` succeed; `continue-on-error` makes the step non-fatal (Defender may be absent/disabled on some images — the step is an optimization, never a gate).

Use `Add-MpPreference` (append) rather than `Set-MpPreference` (replace) so image-default exclusions are not clobbered. `-ExclusionProcess bun.exe` covers every bun startup including the engine's grandchild processes (same exe name); workspace exclusion covers the checkout tree including `tests/.temp/` (all test temp dirs live under it — `TEST_TEMP_DIR` = `tests/.temp/worker-N`).

```yaml
      - name: Windows Defender exclusions (CI speed)
        # windows-only: real-time scanning multiplies every bun/git process start
        # and every fixture-tree copy (unit step 361s vs 41s on ubuntu, run
        # 43705458736). Optimization only — must never fail the job.
        if: matrix.os == 'windows-latest'
        shell: pwsh
        continue-on-error: true
        run: |
          Add-MpPreference -ExclusionPath $env:GITHUB_WORKSPACE
          Add-MpPreference -ExclusionPath (Join-Path $env:USERPROFILE '.bun')   # bun install cache
          Add-MpPreference -ExclusionPath $env:TEMP                              # runner temp / sqlite sidecars
          Add-MpPreference -ExclusionProcess 'bun.exe'
          Write-Host "Exclusions:"; (Get-MpPreference).ExclusionPath | Out-String | Write-Host
```

Notes: `git.exe` process exclusion is optional (git is already on the image's exclusion-prone watch list only marginally); adding it is harmless and cheap if validation shows git spawns still hot. No `gh`/secret access in this step; scope is the runner machine only.

### 3.3 Item 3 — Batch the <5s tail into multi-file `bun test` invocations

**Scope:** unit-suite files **without** a `FILE_TIME_BUDGETS` row (today 271 files, 106s cumulative). Budgeted files (13 rows) keep individual longest-first dispatch — their per-file kill budgets and BUDGET-HEADROOM WARN semantics stay intact.

**Mechanism (in `scripts/test-runner.ts`, `@version` bump 1.15.0 → 1.16.0):**

- Partition: `budgeted` = files with a row → individual dispatch unchanged; `tail` = the rest, sorted alphabetically, chunked into batches of **12** (271/12 ≈ 23 batches).
- The existing `runInParallel` pool (concurrency from item 4) dispatches **batches** instead of single files: `executeBatch(files[], workerId)` spawns one process: `bun test --timeout 15000 --reporter=junit --reporter-outfile <workerTempDir>/junit.xml f1 f2 ... f12`.
  - Per-test ceiling `--timeout 15000` still applies inside bun (per-test, unchanged semantics).
  - Batch kill timer (replaces per-file suite wall for the batch): `min(sum of member suite budgets, 120000 × 12)` → 120s×12=1440s cap, practically bounded by member count.
- **Per-file result parsing (primary path):** after the process exits, parse the JUnit XML written at run end. Bun's junit reporter emits `<testsuite>` elements with the file path (classname/name attribute — verify exact attribute at implementation against bun 1.4.4 output); per file: pass = no `<failure>`/`<error>` children, `durationMs` = sum of its `<testcase time=...>` values ×1000. The runner then prints the exact invariant line `✓ f1 (NNms)` per member file in alphabetical order, so downstream consumers (QA gate, version-bump gate, log readers) see the identical report format.
- **Fallback (parsing unreliable or XML missing — e.g. batch was killed by the timer, junit is only flushed at run end):** re-run that batch's members **individually** through the existing `executeTestFile` path. This is the rare path (batch exit ≠ 0 or unparseable XML) and yields fully authoritative per-file results.
- **Failure attribution:** any batch with exit ≠ 0 or parse gap → individual re-run of its members (never guess attribution from stdout). Failures are rare, so the CI cost of this path is negligible.
- **Stdout policy:** on batch pass, do not dump the whole batch stdout (noise); print the per-file summary lines from the parsed results. On batch failure, the individual re-run reproduces the current full per-file STDOUT/STDERR dump.
- **Env isolation:** files in a batch share one process → one `TEST_TEMP_DIR`/`WORKER_ID`. Files run sequentially inside bun, so no intra-batch collision if files clean up (the runner already `rmSync`s `tests/.temp` at the end); alphabetical chunking keeps co-resident files stable. If a flake shows cross-file residue, first mitigation is smaller batches (env `TEST_RUNNER_BATCH_SIZE`), not reverting.
- **Precedent:** the workflow already runs multi-file `bun test` on windows today ("Hook reliability tests": `bun test tests/unit/hook-gateguard.test.ts tests/unit/hook-post-write-lifecycle.test.ts`), so multi-file invocation in this repo's CI is proven.

**Expected effect:** 311 process startups → ~13 individual (budgeted files) + ~23 batches ≈ 36; the 106s tail shrinks to roughly batch startup (~24 × ~0.5–1s) + real test time — projected −60–80s wall contribution on windows, small positive effect on ubuntu/macos too (they run the same runner path; ubuntu 41s → ~25–30s).

### 3.4 Item 4 — Windows-only concurrency bump for the runner pool

Current default: `Math.min(availableParallelism(), 4)` → 4 on windows-latest (4 vCPU). The workload is fs/spawn-wait heavy (workers mostly wait on child processes), so moderate oversubscription helps.

Design (in `test-runner.ts`, same 1.16.0 change): resolution order —

1. Explicit CLI `--concurrency N` (existing, wins);
2. env `TEST_RUNNER_CONCURRENCY=N` (new, any OS — lets CI experiment without code edits);
3. platform-aware default: **6 on `process.platform === "win32"`, else 4** (unchanged elsewhere).

Windows default 6 = 1.5× vCPU, justified by spawn-wait dominance; memory cost ≈ 6 × bun process (~150–250MB) — safe on the runner's 16GB. `WORKER_ID` temp-dir isolation (`tests/.temp/worker-N`) already scales with the worker count. No workflow change needed (platform detection is in-process); optionally the test job can export `TEST_RUNNER_CONCURRENCY` later for experimentation. If validation shows 6 regresses (CPU contention on argon2/sqlite files), fall back to 4 via env in the workflow — one line, no revert.

### 3.5 Item 5 — Bump pinned bun 1.4.0 → latest stable

- **Latest stable discovered**: `v1.4.4` (`gh api repos/oven-sh/bun/releases/latest`), and **local dev already runs 1.4.4** (`bun --version`) — the repo's full unit/integration suites pass locally on 1.4.4, which is direct compatibility evidence for a CI pin bump.
- **Mechanics:** change `bun-version: 1.4.0` → `1.4.4` at **both occurrences in `.github/workflows/test.yml`** (test job line 50 and hook-secret-gates job line 310). setup-bun v2.2.0 accepts exact version strings; the action downloads the pinned release, no caching contract changes.
- **package.json / bun.lock impact:** none. `engines.bun` is `>=1.0.0` (satisfied); there is no `packageManager` pin; `bun.lock` (`lockfileVersion: 1`, `configVersion: 1`) pins packages, not the runtime, and `bun install --frozen-lockfile` output is invariant across bun patch releases. No lockfile regeneration needed or desired.
- **Breaking-change check (1.4.0 → 1.4.4, same minor):** patch-level fixes only per upstream release notes; the known 1.4.x behavior this repo depends on is unchanged — bunfig `[test] timeout` is still ignored (test-runner correctly passes the CLI `--timeout` flag, verified against 1.4.3 per its v1.5.0 header). The `--reporter=junit` flag used by item 3 is present in 1.4.x; verify its exact XML attribute shape on 1.4.4 during implementation (one manual run of a two-file batch on a scratch dir — not in CI).
- Remaining 1.4.0 pins in four other workflows are listed in Non-Goals; a one-line follow-up PR can align them.

## 4. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Batch mode blurs per-file timeout semantics: the runner kill timer covers the batch, not each file; bun's `--timeout` covers tests, not files | Budgeted (heavy) files never enter batches. Batch kill = sum of member suite budgets (120s×12); on timeout the individual re-run attributes the offender at its own budget and reports it `TIMEOUT` exactly as today. Per-test ceilings unchanged. |
| JUnit XML per-file attribution differs from assumption (attribute name/shape) | Implementation verifies the XML against bun 1.4.4 once before wiring; parse failure falls back to individual re-run — correctness never depends on the parser. |
| Defender step fails on an image without Defender or without elevation | `continue-on-error: true`; step is pure optimization. Validation asserts the step's absence of effect never blocks the job. |
| bun 1.4.4 breaks something 1.4.0 tolerated | Local dev already runs 1.4.4 across the full suite (compat evidence). Same-minor patch range; junit reporter shape verified once. Rollback = revert the two-line pin. |
| Consolidation (item 1) silently drops an assertion | Rule 3.1 invariant: every replaced assertion moves to the combined run's output/manifest checks; PR review diffs the assertion list per file (grep `expect(` count before/after must not decrease). |
| Cross-file residue inside a batch (shared TEST_TEMP_DIR) | Files run sequentially in-process; alphabetical chunking; `TEST_RUNNER_BATCH_SIZE` env knob to shrink batches; runner already wipes `tests/.temp`. |
| Concurrency 6 oversubscribes and regresses | Env override + evidence gate in Validation; default reverts to 4 with one workflow env line, no code revert. |
| Budget-lowering temptation before evidence | Keep all FILE_TIME_BUDGETS rows in this PR unchanged; lowering is a separate row-only change gated on three green windows runs (Validation). |
| Expected windows budget deltas (projection only) | decision-log 300s → ~200s, overwrite-protection / tree-sync 300s → ~200s, admin-console 300s → ~240s — each **only after** measured file time ≤ ~40% of the new budget for 3 consecutive windows runs, via the recorded row-change policy. |

## 5. Validation Plan

1. **Local (windows dev machine, before/after):** `bun scripts/test-runner.ts unit` wall time and per-file lines; compare top-10 file durations against the run-43705458736 table. Also `bun run test` (integration) to confirm no cross-suite regressions from test-file edits.
2. **Assertion-count guard:** for each edited test file, `grep -c "expect(" before vs after` — counts must not decrease (only execution count does).
3. **CI comparison:** single PR; compare the windows leg of its Test Suite run against 43705458736: job total (415s → target ≤260s), "Run unit tests" step (361s → target ≤200s), ubuntu leg (80s → must not regress; expect ~65–70s).
4. **Batch-mode soak:** three consecutive green windows runs with batch mode + junit parsing enabled and zero fallback re-runs observed → parser is trustworthy; if fallback fires >5% of batches, shrink batch size or disable batching (env) and investigate.
5. **Concurrency A/B:** windows CI runs with default 6 vs `TEST_RUNNER_CONCURRENCY=4` vs 8 (workflow_dispatch inputs or env edits on a branch); keep the winner as the platform default.
6. **Budget lowering (follow-up PR, evidence-gated):** per Risk table projections, only after three green windows runs show the file ≤ ~40% of the proposed budget; rows-only diff, no other edits.

## 6. Rollout

- **Single PR** containing: item 1 test-file edits (top 5 files), item 2 workflow step, items 3+4 `test-runner.ts` (`@version` → 1.16.0 with a v1.16.0 header entry describing batching, junit parsing + fallback, and the platform-aware concurrency), item 5 two-line bun pin bump. No changes to `dev-sync.ts`, `audit.ts`, `package.json`, or `bun.lock`.
- **CHANGELOG entry (draft):**

  > ### Changed
  > - **CI (windows): unit test step ~2x faster.** `upgrade-project.ts` engine subprocess spawns in the five heaviest unit files consolidated (decision-log 14→~8, overwrite-protection 14→~10, tree-sync 23→~18, admin-console state reuse, mcp-upstream-server fixture reuse); Windows Defender real-time scanning exclusions added after checkout (non-fatal, windows-only); the sub-5s test-file tail now runs in ~12-file `bun test` batches with JUnit-based per-file reporting and an individual re-run fallback; the runner pool defaults to 6 workers on win32 (was 4; env `TEST_RUNNER_CONCURRENCY` overrides); pinned Bun bumped 1.4.0 → 1.4.4 (matches local dev; `engines.bun` and `bun.lock` unchanged). Evidence: run 43705458736 (windows 361s vs ubuntu 41s on the unit step).

- **Spec registration (at implementation time, after the design lands):**

  ```
  bun scripts/spec-register.ts --file docs/designs/2026-11-15-windows-ci-test-speedup-design.md --source manual --status implemented
  ```

  Registry convention verified: `docs/specs/registry.json` (`version: "1.0.0"`, `specs[]` entries with `id` / `title` / `file` / `status` / `source` / `created` / `last_updated`); `spec-register.ts` appends the entry — nothing is registered now (design-only change).

## References

- CI run 43705458736 (2026-11-15) per-file durations (evidence table above).
- `scripts/test-runner.ts` @1.15.0 — FILE_TIME_BUDGETS, `executeTestFile`, `orderLongestFirst`, pool default `min(parallelism, 4)`.
- `.github/workflows/test.yml` — matrix legs, bun pins (lines 50, 310), existing multi-file `bun test` step (Hook reliability tests).
- Bun CLI docs (test): positional file filters, non-zero exit on any failure, `--reporter=junit --reporter-outfile`, `--timeout` per-test, single-process default.
- `docs/specs/registry.json` — spec registry format.
