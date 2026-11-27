/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.21.0
 *
 * v1.21.0 (2026-11-27, T-20261127-006 — spec
 *          docs/designs/2026-11-27-version-advance-lane-coverage-design.md §13):
 *          FILE_TIME_BUDGETS gains upgrade-lane-coverage.test.ts (suite 300s /
 *          test 60s) — the lane-coverage engine suite joins the engine-spawn
 *          family (two wave-1 fixture spawns + six scene spawns); killed at the
 *          120000ms default wall on its first windows leg (PR #2202 attempt
 *          45916952645). First-time entry per the v1.6.0/v1.20.0 convention.
 *
 * v1.20.0 (2026-11-27, T-20261127-002 — spec
 *          docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md §5):
 *          windows-latest rebudget from MEASURED per-file durations parsed out of
 *          the cited runs' CI logs (5 healthy windows legs + the failure logs:
 *          PRs #2189/#2190/#2194/#2196/#2198 reruns and main post-merge runs
 *          45864068389 / 45905810289). Five first-time FILE_TIME_BUDGETS rows for
 *          the engine-spawn family members that keep hitting the 120s default
 *          wall (upgrade-template-advance-guards — measured healthy max 114.6s =
 *          96% of the wall, timed out at 120000ms TWICE on main; upgrade-template-
 *          advance 83.5s max, one 120s timeout; upgrade-stub-shape-conversion
 *          70.6s max, one 120s timeout; upgrade-stub-shape-guards 70.7s max —
 *          same max as the flaked sibling; upgrade-prune-removed 79.2s max), each
 *          at the family budget 300s suite / 60s test with the measured numbers
 *          pinned in the row comments; plus a TEST-ceiling raise on
 *          upgrade-overwrite-protection 60s → 120s (an individual engine-spawn
 *          test overran the 60s ceiling on attempt 45826913410 while the file's
 *          healthy total is 117-156s — its 300s suite budget was never the
 *          binding constraint). No test deleted or loosened; budgets only.
 *          Measured table: spec §5.
 *
 * v1.19.0 (2026-11-25, T-20261124-017 — spec
 *          docs/designs/2026-11-24-fleet-test-baseline-design.md, ADR-0106): the
 *          fleet test baseline. (1) ENTRY POINTS — `all` (baseline `common`, then
 *          `unit` when the directory exists, then the built-ins listed in the
 *          project`s test-suites.json `include`, then its declared suites) and
 *          `common` (flat *.test.ts in scripts/tests; the three delivered common
 *          tests are its core). Built-in specialized suites keep their v1.18.0
 *          behavior and verdict. (2) FAIL-CLOSED — FC1 zero baseline (in `common`
 *          or inside `all`) exits 1 with result=no-tests and stops `all` before
 *          any other suite; FC2 a declared suite or an `include` entry with zero
 *          targets exits 1; FC3 a baseline whose parsed test total is 0 exits 1;
 *          FC4 an invalid test-suites.json exits 1 for every entry point; FC5 a
 *          baseline file carrying an OS tag exits 1. An absent built-in
 *          specialized suite keeps exit 0 and prints a WARN row, so the fleet
 *          delivery is neutral for existing aliases. U-20261122-001 asked for
 *          exactly this fail-closed behavior; v1.17.3 had answered with a WARN
 *          only, and that WARN cited a ticket about another subject. (3) DECLARED
 *          SUITES — test-suites.json (project root, project-owned, not delivered
 *          by the template): `bun-test` (flat files per directory), `command`
 *          (argv array, no shell, project root as cwd, counts -1) and
 *          `workspace` (directories matching a glob that carry a package.json
 *          `test` script). Unknown keys and types, shadowed built-in names,
 *          zero-match declarations and a bad `include` are validation errors.
 *          Quarantine entries (path, ticket, reason, expires — at most 60 days
 *          out) keep their target running and report its failure without failing
 *          the run; an expired entry is not honored. `optOut` (reason, ticket,
 *          review) makes `common`/`all` print result=opt-out. (4) SUMMARY —
 *          every run ends with exactly one TEST-RUN-SUMMARY line
 *          (schema=1 entry= os= scope= suites=ran/resolved files= files_failed=
 *          tests= tests_failed= not_applicable= quarantined_failed= result=);
 *          counts come from bun`s `N pass`/`N fail` rows (stdout or stderr —
 *          piped bun writes its report to stderr), -1 means unknown. The exit
 *          code stays the verdict. (5) OS APPLICABILITY — a file tag
 *          `<name>.<win32|darwin|linux>.test.ts` and an optional suite `os` key;
 *          `--os <platform>` evaluates another platform, `--os-scope
 *          independent|specific|both` selects the part (default both), and
 *          `--plan-os` prints the non-linux platforms with an OS-specific
 *          target (e.g. ["win32"]) for the template`s declared-only matrix leg.
 *          A tag renames nothing: flat *.test.ts discovery is unchanged. OS
 *          selection runs at discovery, before orderLongestFirst; every
 *          dispatched file keeps its per-file pass/fail line (design 2026-11-15
 *          invariant). (6) `--dry-run` prints the selection and the summary line
 *          (result=selected) and executes nothing. The scripts-suite hygiene
 *          helper is loaded lazily so the fleet entry points never depend on
 *          the scripts/helpers import chain.
 *
 * v1.18.0 (2026-11-23, U-20261122-011 — spec
 *          docs/designs/2026-11-23-variant-core-script-loss-detection-design.md):
 *          `upgrade-policy-eviction.test.ts` joins FILE_TIME_BUDGETS (suite 300s /
 *          test 60s, first-time entry per the v1.6.0 convention) — the eviction
 *          wiring replay spawns the full upgrade-project.ts engine five times
 *          (two shared scene-A runs, scene B, the AC-5 rerun + vintage run) plus
 *          three cheap --audit-core-deltas report spawns; same windows-slow
 *          engine family budget as upgrade-overwrite-protection.
 *
 * v1.17.2 (2026-11-17, CI evidence runs 44018675727 + 44052958547): `upgrade-decision-log.test.ts`
 *          suite budget 300s -> 600s (test stays 60s). Both windows-latest main pushes hit
 *          "Test timed out after 300000ms" for the file (windows suite 548s vs ~380s normal;
 *          the file took ~163s on 2026-11-12). Raise #1 for the file this quarter since the
 *          v1.9.0 trim to 300s; the v1.8.x split/trim review rule still applies on a second.
 *
 * v1.17.1 (2026-11-16): tail BATCHING SHIPPED OFF (default 0). CI run 43788899945
 *          measured the windows unit step at 414s at batch size 12 against a 371s
 *          ideal (1485s cumulative / 4 workers), while the pre-batching baseline
 *          packed almost perfectly (361s vs 359s ideal); one failing batch member
 *          also costs the whole batch an individual re-run (local runs showed 2-3
 *          fallbacks per suite), so the spawn saving (312 → ~36) never converted
 *          into wall clock. `TEST_RUNNER_BATCH_SIZE=N` re-enables batching once
 *          the tail is residue-free.
 *
 * v1.17.0 (2026-11-16, spec docs/designs/2026-11-15-windows-ci-test-speedup-design.md
 *          items 3+4 — windows "Run unit tests" step 361s vs ubuntu 41s, run
 *          43705458736): (1) BATCHING — the sub-5s unit-suite tail (files
 *          WITHOUT a FILE_TIME_BUDGETS row, ~271 files / ~106s cumulative)
 *          now runs as ~12-file `bun test` invocations instead of one process
 *          per file (~311 spawns → ~36). A batch spawns one `bun test
 *          --timeout 15000 --reporter=junit --reporter-outfile <workerTempDir>`
 *          process; per-file results are parsed from the JUnit XML bun flushes
 *          at process end (depth-1 <testsuite> elements carry the file path in
 *          the `file` attribute, `time` in seconds, `failures` count — shape
 *          verified against bun 1.4.4 on a two-file probe run), and the
 *          runner's per-file `✓ path (NNms)` report lines are re-synthesized
 *          from the parsed durations so downstream consumers (QA gate,
 *          version-bump gate, BUDGET-HEADROOM WARN, log readers) see the
 *          identical format. Correctness NEVER depends on the parser: any
 *          parse gap, non-zero batch exit, or timeout kill immediately re-runs
 *          that batch's members individually through the existing
 *          `executeTestFile` path (junit flushes only at process end, so a
 *          killed batch has no XML — the individual re-run is authoritative
 *          and reproduces today's full per-file dump on failure). Budgeted
 *          files (13 rows) keep individual longest-first dispatch — their
 *          per-file kill budgets and BUDGET-HEADROOM WARN semantics are
 *          untouched. Batching applies to the unit suite only (other suites
 *          keep one process per file). Batch kill timer = min(sum of member
 *          suite budgets, 120s × member count). New env knob
 *          `TEST_RUNNER_BATCH_SIZE` (default 12) shrinks batches as the first
 *          mitigation for cross-file residue flakes. On batch pass the batch
 *          stdout is not dumped (noise); the per-file summary lines come from
 *          the parsed results. (2) CONCURRENCY — new env
 *          `TEST_RUNNER_CONCURRENCY=N` (any OS — lets CI experiment without
 *          code edits, invalid values are ignored; explicit `--concurrency`
 *          CLI still wins). The pool DEFAULT is UNCHANGED at
 *          `min(availableParallelism(), 4)`: the design's platform-aware
 *          win32=6 oversubscription was implemented and A/B-measured on the
 *          windows dev machine (same platform class as the slow CI leg) — at
 *          6 workers the three 300s-budgeted engine files exceeded their
 *          suite walls in BOTH full-suite runs (walls 599s/653s, three
 *          TIMEOUTs), while at 4 they pass — so per the design's own
 *          risk-table mitigation the default reverts to 4 and the A/B
 *          continues via the env knob (design §5.5), not via the code
 *          default.
 *
 * v1.16.0 (2026-11-16, T-20261114-008): four more co-workspace files join
 *          FILE_TIME_BUDGETS (suite 300s / test 45s, the co-workspace family
 *          budget) — migrations, shared-team-quarantine, admin-console-r2,
 *          admin-page each hit the 15000ms default per-test ceiling on
 *          windows-latest (runs 43423354132, 43446832817, 43476903271,
 *          43322937546; same commits pass on rerun and on ubuntu/macos).
 *          First-time entries per the v1.6.0 convention, not raises.
 *
 *
 * v1.15.0 (2026-11-12, CI speed): parallel dispatch is longest-first. windows-latest `test:unit` takes ~345s vs ~60s on ubuntu; the tail is a handful of files (upgrade-decision-log 163s, upgrade-overwrite-protection 119s, co-workspace-admin-console 103s, upgrade-tree-sync 97s, mcp-upstream-server 51s) that start late under alphabetical order and extend the wall clock. New pure exported `orderLongestFirst()` sorts files carrying a FILE_TIME_BUDGETS row first (larger suite budget, then larger test budget), the rest after in original order (stable); results/reporting stay in the original alphabetical order. No budget changed.
 *
 * v1.14.0 (2026-11-12, overwrite-protection PR-B): `upgrade-vintage-pending.test.ts` joins FILE_TIME_BUDGETS (suite 300s / test 60s) — three full upgrade-project.ts engine spawns per file run (dry-run, apply, apply with a grant); same windows-slow family budget as upgrade-overwrite-protection.
 *
 * v1.13.1 (2026-11-12): `upgrade-core-locked-fork.test.ts` joins FILE_TIME_BUDGETS (suite 300s / test 60s) — two full upgrade-project.ts engine spawns per file run (windows-slow family budget, same as upgrade-overwrite-protection).
 *
 * v1.13.0 (2026-11-12, PR #1963 follow-up): `upgrade-overwrite-protection.test.ts` joins
 *          FILE_TIME_BUDGETS (suite 300s / test 60s) — windows-latest run 43074272486: the file's
 *          ~7 full upgrade-project.ts engine spawns (shared describe-level runs + in-body
 *          lifecycles, ~9s on macOS) hit the 120000ms per-file wall on win32 after per-test
 *          budgets removed the 15s ceiling failures. Same family budget as upgrade-tree-sync /
 *          upgrade-decision-log; test 60s matches the in-file per-test budgets.
 *
 * v1.12.0 (2026-11-11, T-20261111-003 follow-up): `co-workspace-composer-wire-regression.test.ts`
 *          joins FILE_TIME_BUDGETS (suite 300s / test 45s) — windows-latest run 42913762200: the
 *          round-3 wire-regression suite (server bootstrap + argon2 hashing + per-request
 *          shared-team resolution) hit the 15000ms default ceiling at 15.58s while the same
 *          commit passed macos. Same first-time row shape as v1.11.0/v1.12.0 predecessors.
 *
 * v1.11.0 (2026-11-10, T-20261110-001 — spec
 *          docs/designs/2026-11-10-workspace-console-ci-flake-design.md):
 *          `co-workspace-admin-console.test.ts` joins FILE_TIME_BUDGETS
 * v1.11.0 (2026-11-10, T-20261110-001 — spec
 *          docs/designs/2026-11-10-workspace-console-ci-flake-design.md):
 *          `co-workspace-admin-console.test.ts` joins FILE_TIME_BUDGETS
 *          (suite 300s / test 45s) — windows-latest run 42656818953 (PR
 *          #1942) killed the heavy async service suite at the 120s unit-suite
 *          wall (mode a) on a base where healthy attempts and PR-3's CI
 *          passed first try; macOS total ~1s (66 tests). First-time row for
 *          a new file under the v1.9.0 ticket-evidence policy; family budget
 *          300s keeps ≥2.5x over the observed healthy win32 ceiling (<120s).
 *
 * v1.10.0 (2026-11-06, T-20261106-008): `hub-bootstrap.test.ts` joins
 *          FILE_TIME_BUDGETS (suite 300s / test 45s) — windows-latest run
 *          42078112151: the spawn-heavy bootstrap E2E tests hit 15.1s/16.1s
 *          against the 15000ms default per-test ceiling (win32 FS pressure;
 *          the same commit passed macos 1m55s). First-time row for a new
 *          file under the v1.9.0 ticket-evidence policy.
 *
 * v1.9.0 (2026-10-31, T-20261030-002 stage 2 — spec
 *         docs/designs/2026-10-31-test-budget-split-design.md): the evidence
 *         gate passed — PR #1770's own win32 CI run (windows-latest, runs
 *         41153388888/41153395059) measured the split
 *         upgrade-decision-log.test.ts at 99.9s (≤ the design's ~150s gate;
 *         ~2x headroom rule satisfied at 300s) and the extracted
 *         upgrade-policy-decisions.test.ts at 0.34s — so the decision-log row
 *         drops 600000 → 300000 (test ceiling stays 60s) and the file returns
 *         to the family convention (mcp-upstream-server and upgrade-tree-sync
 *         sit at 300s) instead of the twice-raised 600s outlier. Row-only
 *         behavioral change; the v1.8.0 BUDGET-HEADROOM WARN and the
 *         budget-raise policy stay on watch over the restored headroom.
 *
 * v1.8.0 (2026-10-31, T-20261030-002 — spec
 *         docs/designs/2026-10-31-test-budget-split-design.md, stage 1 of 2):
 *         the re-inflation guard. (1) BUDGET-HEADROOM WARN — every completed
 *         test file whose elapsed time exceeds 60% of its resolved suite
 *         budget prints a WARN row into the run log; WARN, not FAIL — CI
 *         timing variance must not block merges, the row makes slow burn-in
 *         visible in every CI log instead of at raise time. (2) Budget-raise
 *         policy (recorded, enforced by review): a FILE_TIME_BUDGETS raise
 *         requires a ticket naming the CI-run evidence that motivated it; two
 *         raises for the same file inside one quarter trigger a mandatory
 *         split/trim review — the rule the 3-raises-in-2-weeks pattern on
 *         upgrade-decision-log.test.ts (v1.5.0/v1.6.0/v1.7.0) violated
 *         silently. (3) The extracted pure-helper suite
 *         upgrade-policy-decisions.test.ts (split out of
 *         upgrade-decision-log.test.ts in the same change set) gets an
 *         explicit FILE_TIME_BUDGETS row pinned at the family defaults
 *         (suite 120s / test 15s) — its runtime is trivial today; the row
 *         makes any drift visible. Stage 2 of the design (NOT this change)
 *         drops the upgrade-decision-log row 600s → 300s once one green win32
 *         CI run shows the file total ≤ ~150 s.
 *
 * v1.7.0 (2026-10-29, Windows CI timing budgets — PR #1723 CI run
 * 40799972562): `upgrade-decision-log.test.ts` suite budget 300s → 600s
 * (test ceiling stays 60s). The delivery-bookkeeping PR1 wave (spec
 * 2026-10-29-delivery-bookkeeping-engine-design) added the TOMBSTONE_CLEARED
 * + clear-grant regression cases to the file (now 45 tests / 3087 expect()
 * calls; macOS total 16.7s, max per-test 1.4s); on windows-latest 41/45
 * tests printed (pass) before the 300s suite wall killed the file — the same
 * every-test-passes-file-killed-at-the-suite-wall shape v1.6.0 budgeted for.
 * Not a hang: observed win32 per-test max 36.7s (< the 60s bun ceiling, so no
 * individual test timed out) and the four tests that never ran are full
 * `upgrade-project.ts` integration runs (~15-37s each on win32). Projected
 * win32 file total ~330-440s → suite 600s keeps ~1.4-1.8x headroom.
 *
 * v1.6.0 (2026-10-28, Windows CI timing budgets — PR #1677 CI run
 * 40603661108): `upgrade-decision-log.test.ts` joins FILE_TIME_BUDGETS
 * (suite 300s / test 60s). The U-20261028-001 tombstone engine suites added
 * 17 full `upgrade-project.ts` integration runs to the file; on
 * windows-latest its first 25 tests alone cost 119.7s, so the LAST test was
 * killed by the 120s suite wall with "Test timed out after 120000ms" while
 * every individual test PASSED (macOS total: 8.4s) — the same
 * every-test-passes-file-killed-at-the-suite-wall shape that put
 * mcp-upstream-server and upgrade-tree-sync on the override list in v1.5.0.
 * Observed win32 per-test max 25.2s → test 60s keeps ≥2x headroom; projected
 * win32 file total ~126s → suite 300s keeps ~2.4x. Not a hang: all 25
 * printed passes are finite and the CI log shows no blocking test.
 *
 * v1.5.0 (2026-10-14, Windows CI timing budgets — CI run 38412124373):
 * (1) Bun per-test ceiling — the runner now passes `--timeout` to `bun test`
 * (default 15000ms; bun's implicit default is 5000ms). bun 1.4 ignores a
 * bunfig `[test] timeout` key (verified 1.4.3), so the CLI flag is the only
 * working knob. Spawn-heavy tests overran 5s on windows-latest with every
 * assertion passing (script-registry-audit "validate-templates missing
 * templates/common" 5.27s; mcp-upstream-server E13d 5.68s). (2) Per-file
 * budget overrides for files whose win32 wall time legitimately exceeds the
 * suite defaults — every individual test passing while the file is killed at
 * the 120s suite wall (mcp-upstream-server, upgrade-tree-sync; observed max
 * ~30s per test, >120s per file). An explicit `--timeout` CLI flag still wins
 * over both knobs. Same documented win32 flake family as the
 * hook-post-write-lifecycle 30s→120s raise (2026-10-12) and T-20261004-011.
 *
 * v1.3.0 (T-20260916-001): (1) per-suite `sequential` flag — the `scripts`
 * suite now runs its members one at a time because its E2E files stage
 * disposable fixture dirs under the REAL templates/ tree and race
 * concurrent validators when run in parallel (the unit suite stays
 * parallel); an explicit `--parallel` CLI flag still overrides for manual
 * runs. (2) Post-suite hygiene assertion for the `scripts` suite: git
 * status under docs/templates/ must gain no modifications and no
 * templates/test-l3promo-* / co-e2eguard-* / co-e2p2* fixture dirs may
 * appear (producer: test-l3-to-variant-promotion.ts; skipper predicate:
 * helpers/scaffold-markers.ts isTransientTestFixture) — new pollution
 * fails the suite.
 */
import { readdirSync, existsSync, rmSync, mkdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { availableParallelism, cpus } from "node:os";

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  dir: string;
  ext: string;
  /** Run this suite's files one at a time (default false). */
  sequential?: boolean;
}

export interface RunOptions {
  parallel?: boolean;
  concurrency?: number;
  timeout?: number;
}

interface TestFileResult {
  file: string;
  success: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  error?: string;
}

const suites: TestSuite[] = [
  { name: "unit", pattern: "*.test.ts", timeout: 120000, dir: "tests/unit", ext: ".test.ts" },
  { name: "integration", pattern: "*.test.ts", timeout: 120000, dir: "tests", ext: ".test.ts" },
  { name: "scenarios", pattern: "*", timeout: 300000, dir: "tests/scenarios", ext: "" },
  // sequential: members stage transient fixture dirs under the real templates/
  // tree (test-l3promo-*, co-e2eguard-*, co-e2p2*) and race concurrent
  // validators when run in parallel — T-20260916-001.
  { name: "scripts", pattern: "test-*.ts", timeout: 120000, dir: "scripts", ext: ".ts", sequential: true },
];

/** Bun per-test ceiling passed as `bun test --timeout` (ms). bun's implicit
 * default is 5000ms, which spawn-heavy tests overrun on slow runners with
 * every assertion passing; 15000ms keeps real hangs loud (≥3x the observed
 * worst case outside the override list). */
const DEFAULT_TEST_TIMEOUT_MS = 15000;

/** Per-file budget overrides, basename-keyed (OS-independent): `suite` is the
 * runner kill budget, `test` is the bun per-test ceiling. Only files whose
 * win32 wall time legitimately exceeds the suite defaults are listed — every
 * individual test passing while the file hits the suite wall (CI run
 * 38412124373). Headroom ≈2.5x suite / ≥2x test over the observed win32 max.
 *
 * Raise policy (v1.8.0, T-20261030-002 — recorded here, enforced by review):
 * a budget raise requires a ticket naming the CI-run evidence that motivated
 * it, and two raises for the same file inside one quarter trigger a mandatory
 * split/trim review. The BUDGET-HEADROOM WARN (60% of suite budget) makes
 * slow burn-in visible in every CI log instead of at raise time. */
const FILE_TIME_BUDGETS: Record<string, { suite: number; test: number }> = {
  // T-20261106-008 (windows-latest, run 42078112151): spawn-heavy hub-bootstrap
  // E2E — two tests at 15.1s/16.1s exceeded the 15000ms default ceiling on
  // win32 FS pressure while the same commit passed macos in 1m55s (~2.8x
  // headroom at 45s). First-time entry for a new file, not a raise on an
  // offender.
  "hub-bootstrap.test.ts": { suite: 300000, test: 45000 },
  // T-20261110-001 (windows-latest, PR #1942 CI run 42656818953; spec
  // 2026-11-10-workspace-console-ci-flake-design): the heavy async
  // admin-console service suite (66 tests — sqlite stores, tmpdir fixtures,
  // argon2 hashing via Bun.password.hash) hit the 120s unit-suite wall on
  // win32 (mode a) while the same base passed macos in ~1s and healthy win32
  // attempts completed inside the cap; the alternating failure mode (b) is
  // the M5 simulated-hash-failure rejection, contained in the test file
  // itself. No per-platform budget support exists (rows are basename-keyed,
  // OS-independent), so one family budget sized for the slowest observed
  // platform: 300s keeps ≥2.5x over the observed healthy win32 ceiling
  // (<120s) and absorbs the FS-pressure variance band. Test ceiling 45s
  // follows the hub-bootstrap precedent (no per-test timeout was
  // implicated in either CI failure mode).
  "co-workspace-admin-console.test.ts": { suite: 300000, test: 45000 },
  // T-20261114-008 (windows-latest runs 43423354132 attempt 1, 43476903271):
  // migrations/shared-team-quarantine per-test timeouts at 21.3-21.5s; same
  // commits green on rerun and on ubuntu/macos. Family budget, first-time entry.
  "co-workspace-migrations.test.ts": { suite: 300000, test: 45000 },
  "co-workspace-shared-team-quarantine.test.ts": { suite: 300000, test: 45000 },
  // T-20261114-008 (windows-latest runs 43446832817 attempt 1, 43322937546):
  // admin-console-r2 15.2s / admin-page 17.9s per-test timeouts; same rerun-
  // green shape as the rows above.
  "co-workspace-admin-console-r2.test.ts": { suite: 300000, test: 45000 },
  "co-workspace-admin-page.test.ts": { suite: 300000, test: 45000 },
  "mcp-upstream-server.test.ts": { suite: 300000, test: 30000 },
  "upgrade-tree-sync.test.ts": { suite: 300000, test: 60000 },
  // v1.9.0 (T-20261030-002 stage 2): 600s → 300s on the design's evidence
  // gate — PR #1770's win32 run measured the split file at 99.9s (≤ ~150s),
  // restoring the family's ~2x headroom at 300s.
  // v1.17.2 (2026-11-17): back to 600s — windows main runs 44018675727 and
  // 44052958547 timed out at 300000ms (file ~163s on 2026-11-12, windows suite 548s).
  "upgrade-decision-log.test.ts": { suite: 600000, test: 60000 },
  // v1.8.0 (T-20261030-002): the pure-helper suite extracted from
  // upgrade-decision-log.test.ts, pinned AT the family defaults — the row
  // exists so any runtime drift on the extracted file is visible without a
  // registry diff.
  "upgrade-policy-decisions.test.ts": { suite: 120000, test: 15000 },
  // T-20261111-003 (windows-latest, main CI run 42881762644): the PR #1956
  // shared-teams merge pushed three argon2-heavy co-workspace unit files over
  // the 15000ms per-test ceiling on win32 — each individual test's assertions
  // pass, but bun's timeout abort runs the file's afterAll BEFORE the aborted
  // test's finally has closed its sqlite stores, so cleanup then dies with
  // EBUSY rm on the still-locked tmpdir fixture (the timeout is the cause, the
  // EBUSY is the symptom). Same family as the co-workspace-admin-console
  // entry: sqlite stores, tmpdir fixtures, argon2 hashing (createState admin
  // bootstrap + password re-confirmation verifies). First-time entries, not
  // raises. Observed win32 worst case: D4 re-auth 16.8s, shared-team ACL 18.5s,
  // loop export 17.1s; local arm64 mac runs the same three files in <1s total.
  // Test ceiling 45s (~2.7x observed) follows the hub-bootstrap precedent;
  // 300s suite absorbs the win32 FS-pressure variance band (the access file
  // seeds ten states through the same argon2 path).
  "co-workspace-review-remediation.test.ts": { suite: 300000, test: 45000 },
  "co-workspace-shared-team-access.test.ts": { suite: 300000, test: 45000 },
  "co-workspace-shared-team-loop.test.ts": { suite: 300000, test: 45000 },
  // T-20261111-003 follow-up (windows-latest, run 42913762200): the round-3
  // wire-regression suite (server bootstrap + argon2 hashing + per-request
  // shared-team resolution) hit the 15000ms default ceiling at 15.58s on
  // win32 while the same commit passed macos; the three raised budgets above
  // cover the round-2 suites but missed this round-3 file. Same first-time
  // entry shape (family 300s / test 45s).
  "co-workspace-composer-wire-regression.test.ts": { suite: 300000, test: 45000 },
  // PR #1963 (windows-latest run 43074272486): engine-spawn-heavy overwrite-protection suite
  // hit the 120s per-file wall on win32 (macOS ~9s). Family budget 300s; test 60s.
  // T-20261127-002 TEST-ceiling raise 60s → 120s (suite unchanged): PR #2189 attempt
  // 45826913410 killed an individual engine-spawn test at 60000ms on win32 while the
  // file's healthy totals measured 117542-156280 ms across the five cited runs (spec
  // §5) — the 300s suite budget was never the binding constraint, the per-test
  // ceiling was. 120s = ~2x the observed worst single-test shape; no assertion
  // loosened, ceiling only.
  "upgrade-overwrite-protection.test.ts": { suite: 300000, test: 120000 },
  // Core-locked fork arm replay: two full engine spawns (one dry-run, one apply) per file run.
  "upgrade-core-locked-fork.test.ts": { suite: 300000, test: 60000 },
  // Overwrite-protection PR-B replay: three engine spawns (dry-run, apply, apply + grant) per file run.
  "upgrade-vintage-pending.test.ts": { suite: 300000, test: 60000 },
  // U-20261122-011 eviction replay: five full engine spawns (scene A default +
  // grant, scene B, AC-5 rerun + vintage) + three cheap --audit-core-deltas
  // report spawns per file run.
  "upgrade-policy-eviction.test.ts": { suite: 300000, test: 60000 },
  // T-20261127-002 (windows-latest, MEASURED from the cited runs' CI logs — table in
  // spec docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md §5): the four
  // files below + upgrade-prune-removed are the engine-spawn family members still
  // running against the 120s default wall. Measured healthy win32 maxima (5 runs:
  // 45831855690 / 45839104906 / 45858038084 / 45865640842 / 45876997661) vs their
  // observed 120000ms timeouts:
  //   upgrade-template-advance-guards: 114568 / 88942 / 83476 / 86280 / 112658 ms
  //     — healthy max 114.6s = 96% of the 120s wall; killed at 120000ms twice on
  //     main (runs 45864068389 + 45905810289, "Test timed out after 120000ms").
  //   upgrade-template-advance: 63455 / 65739 / 64190 / 65064 / 83525 ms — max
  //     83.5s; killed at 120000ms once (PR #2189 attempt 45817806959) — a ~1.4-1.9x
  //     FS-pressure spike, the family's characteristic failure shape.
  //   upgrade-stub-shape-conversion: 57804 / 68839 / 63659 / 64247 / 70573 ms — max
  //     70.6s; killed at 120000ms once (attempt 45822606148) — a ~1.7x spike.
  //   upgrade-stub-shape-guards: 59608 / 67193 / 64378 / 66284 / 70733 ms — max
  //     70.7s, never flaked; same measured max as the flaked sibling above, same
  //     engine family — pinned before it becomes the next rerun.
  // Family budget 300s / test 60s (headroom ≥1.9x over healthy max; ≥2.6x for the
  // twice-flaked guards file).
  "upgrade-template-advance-guards.test.ts": { suite: 300000, test: 60000 },
  "upgrade-template-advance.test.ts": { suite: 300000, test: 60000 },
  "upgrade-stub-shape-conversion.test.ts": { suite: 300000, test: 60000 },
  "upgrade-stub-shape-guards.test.ts": { suite: 300000, test: 60000 },
  // T-20261127-002 (same measured table): upgrade-prune-removed healthy max
  // 79220 ms on run 45865640842 (44-49s on the other four legs) — no timeout
  // observed yet, but the win32 spike band is ~1.5-2x and 79.2s sits above the
  // 2/3-of-wall burn-in line; pinned at the family budget preventively.
  "upgrade-prune-removed.test.ts": { suite: 300000, test: 60000 },
  // v1.21.0 (T-20261127-006, design docs/designs/2026-11-27-version-advance-lane-coverage-design.md
  // §13 implementation note): upgrade-lane-coverage joins the engine-spawn family —
  // TWO full wave-1 engine spawns as fixture bases (co-work + co-consult) plus six
  // scene spawns (dry-run + apply per scene family). Killed at 120000ms on its
  // first windows leg (PR #2202 attempt 45916952645, "Test timed out after
  // 120000ms") — the same first-time-engine-suite shape as the T-20261127-002
  // cohort; macOS ~21-25s. First-time entry at the family budget 300s/60s per the
  // v1.6.0/v1.20.0 convention; no assertion loosened.
  "upgrade-lane-coverage.test.ts": { suite: 300000, test: 60000 },
};

function getTestFiles(suite: TestSuite): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(suite.dir)) {
      console.warn(
        `⚠ test-runner: suite directory "${suite.dir}" does not exist — 0 tests discovered (non-fatal: a built-in specialized suite)`,
      );
      return files;
    }
    const entries = readdirSync(suite.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const matchesExt = suite.ext === "" || entry.name.endsWith(suite.ext);
      const matchesPattern =
        suite.name !== "scripts" || (entry.name.startsWith("test-") && entry.name !== "test-runner.ts");
      if (matchesExt && matchesPattern) {
        files.push(join(suite.dir, entry.name));
      }
    }
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      console.error(`Error reading directory ${suite.dir}: ${error.message}`);
    }
  }
  return files.sort();
}

async function executeTestFile(
  file: string,
  timeoutMs: number,
  bunTestTimeoutMs: number | null,
  workerId: number,
  execMode: "bun-test" | "bun-script" = "bun-test",
): Promise<TestFileResult> {
  const startTime = Date.now();
  const workerTempDir = join("tests", ".temp", `worker-${workerId}`);

  try {
    mkdirSync(workerTempDir, { recursive: true });
  } catch {}

  const env = {
    ...process.env,
    TEST_TEMP_DIR: workerTempDir,
    WORKER_ID: String(workerId),
  };

  let proc: ReturnType<typeof Bun.spawn> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    // The `scripts` suite members are standalone assertion scripts (they exit
    // non-zero on failure) — running them under `bun test` fails with
    // "filters did not match any test files" because their names lack a bun
    // test naming pattern. Everything else is a bun test file.
    const argv =
      execMode === "bun-script"
        ? [process.execPath, file]
        : [process.execPath, "test", "--timeout", String(bunTestTimeoutMs), file];
    proc = Bun.spawn(argv, {
      env,
      stdout: "pipe",
      stderr: "pipe",
    });

    // stdout/stderr are 'pipe', so at runtime they are ReadableStreams (never fd numbers).
    const stdoutPromise = proc.stdout
      ? new Response(proc.stdout as ReadableStream<Uint8Array>).text()
      : Promise.resolve("");
    const stderrPromise = proc.stderr
      ? new Response(proc.stderr as ReadableStream<Uint8Array>).text()
      : Promise.resolve("");

    const timeoutPromise = new Promise<{ timedOut: boolean }>((resolve) => {
      timer = setTimeout(() => {
        if (proc) {
          try {
            proc.kill();
          } catch {}
        }
        resolve({ timedOut: true });
      }, timeoutMs);
    });

    const execPromise = Promise.all([stdoutPromise, stderrPromise, proc.exited]).then(([stdout, stderr, exitCode]) => ({
      timedOut: false,
      stdout,
      stderr,
      exitCode,
    }));

    const result = await Promise.race([execPromise, timeoutPromise]);

    if (timer) clearTimeout(timer);

    if (result.timedOut) {
      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
      return {
        file,
        success: false,
        durationMs: Date.now() - startTime,
        stdout,
        stderr,
        exitCode: null,
        timedOut: true,
        error: `Test timed out after ${timeoutMs}ms`,
      };
    }

    const { stdout, stderr, exitCode } = result as {
      timedOut: false;
      stdout: string;
      stderr: string;
      exitCode: number;
    };

    return {
      file,
      success: exitCode === 0,
      durationMs: Date.now() - startTime,
      stdout,
      stderr,
      exitCode,
      timedOut: false,
      error: exitCode !== 0 ? `Process exited with code ${exitCode}` : undefined,
    };
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    return {
      file,
      success: false,
      durationMs: Date.now() - startTime,
      stdout: "",
      stderr: "",
      exitCode: null,
      timedOut: false,
      error: err.message,
    };
  }
}

/** Batch size for the non-budgeted unit-suite tail (v1.17.0, design item 3).
 * A positive value enables batching: N-file `bun test` invocations replace one
 * process per file. Files in a batch share one process and one TEST_TEMP_DIR and
 * run sequentially inside bun.
 *
 * SHIPPED OFF (0) — 2026-11-16 CI evidence run 43788899945: at batch size 12 the
 * windows unit step took 414s against a 371s ideal (1485s cumulative / 4
 * workers), while the pre-batching baseline packed almost perfectly (361s vs
 * 359s ideal). A coarse granule cannot pack around the 13 individually
 * dispatched budgeted files, and one failing member costs the whole batch an
 * individual re-run (local runs showed 2-3 such fallbacks per suite), so the
 * spawn saving does not convert into wall-clock. Optimise item 1's per-test
 * spawns first; re-enable with `TEST_RUNNER_BATCH_SIZE=N` once the tail is
 * residue-free and the heavy files no longer dominate. */
const DEFAULT_BATCH_SIZE = 0;

function resolveBatchSize(): number {
  const raw = process.env.TEST_RUNNER_BATCH_SIZE;
  if (raw !== undefined && raw.trim() !== "") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 1) return parsed;
    // invalid value = ignore, fall through to the default
  }
  return DEFAULT_BATCH_SIZE;
}

/** Pool default (v1.16.0, design item 4 — SHIPPED AS EVIDENCE-GATED OFF):
 * `min(availableParallelism(), 4)` exactly as before item 4. The design's
 * platform-aware win32=6 (oversubscribed for the spawn-wait-heavy workload)
 * was implemented and A/B-measured on the windows dev machine (same platform
 * class as the slow CI leg): at 6 workers the three 300s-budgeted engine
 * files (upgrade-decision-log / upgrade-tree-sync / upgrade-overwrite-
 * protection) exceeded their suite walls in BOTH full-suite runs
 * (599s/653s walls, 3 TIMEOUTs), while at 4 they pass. Per the design's own
 * risk-table mitigation ("default reverts to 4 … no code revert"), 4 stays
 * the default and the A/B continues through the env knob: explicit CLI
 * `--concurrency` wins; `TEST_RUNNER_CONCURRENCY=N` next (any OS, lets CI
 * experiment without code edits; invalid values are ignored); this default
 * last. */
function resolveDefaultConcurrency(numCpus: number): number {
  const envRaw = process.env.TEST_RUNNER_CONCURRENCY;
  if (envRaw !== undefined && envRaw.trim() !== "") {
    const parsed = Number.parseInt(envRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return Math.min(numCpus, 4);
}

interface JunitFileResult {
  failures: number;
  durationMs: number;
}

const normalizePath = (p: string): string => p.replace(/\\/g, "/");

/**
 * Parse bun's junit XML (v1.16.0, design item 3) into per-file results.
 *
 * Verified shape (bun 1.4.4, windows probe run): the ROOT `<testsuites>`
 * element's DIRECT `<testsuite>` children are one-per-FILE; their `file`
 * attribute carries the path with the OS separator, `time` is the file's
 * total test time in SECONDS, and `failures` counts failed tests. Describe
 * blocks nest as INNER `<testsuite>` elements (they carry a `line` attribute
 * and repeat the same file path), so the parser tracks tag depth and keeps
 * only depth-1 suites — no attribute heuristics.
 *
 * Returns a map keyed by the normalized file path; missing/invalid entries
 * are simply absent — the caller treats ANY gap as a fallback trigger.
 */
export function parseJunitPerFile(xml: string): Map<string, JunitFileResult> {
  const perFile = new Map<string, JunitFileResult>();

  const readAttr = (attrs: string, name: string): string | null => {
    const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
    return m ? m[1] : null;
  };

  // Walk the tag stream: a `<testsuite>` at depth 1 (direct child of the root
  // `<testsuites>`) is a per-FILE suite — capture its file/failures/time and
  // commit on its closing tag. Deeper suites (describe blocks, `line`
  // attribute) and everything else are skipped. `<failure>`/`<error>` tokens
  // anywhere inside a file suite's span force that file to failure (belt and
  // braces; the depth-1 `failures` attribute is the primary signal).
  const tokens =
    xml.match(/<testsuites\b[^>]*>|<\/testsuites>|<testsuite\b[^>]*>|<\/testsuite>|<failure\b|<error\b/g) ?? [];
  const stack: Array<{ file: string | null; failures: number; time: number }> = [];
  const forcedFailure = new Set<string>();
  for (const token of tokens) {
    if (token === "<failure" || token === "<error") {
      const fileSuite = stack.find((s) => s.file !== null);
      if (fileSuite?.file) forcedFailure.add(normalizePath(fileSuite.file));
      continue;
    }
    // The root <testsuites> element MUST be tested before the <testsuite>
    // branch — "testsuites".startsWith("testsuite") is true.
    if (token.startsWith("<testsuites") || token === "</testsuites>") {
      continue;
    }
    if (token.startsWith("<testsuite")) {
      const attrs = token.slice("<testsuite".length, -1);
      if (stack.length === 0) {
        // depth 1 — a per-file suite
        stack.push({
          file: readAttr(attrs, "file"),
          failures: Number.parseInt(readAttr(attrs, "failures") ?? "0", 10) || 0,
          time: Number.parseFloat(readAttr(attrs, "time") ?? "0") || 0,
        });
      } else {
        stack.push({ file: null, failures: 0, time: 0 });
      }
      continue;
    }
    if (token === "</testsuite>") {
      const popped = stack.pop();
      if (popped?.file) {
        perFile.set(normalizePath(popped.file), {
          failures: forcedFailure.has(normalizePath(popped.file)) ? Math.max(popped.failures, 1) : popped.failures,
          durationMs: Math.round(popped.time * 1000),
        });
      }
      continue;
    }
    // <testsuites> / </testsuites> — no-op (depth is tracked via suite stack)
  }
  return perFile;
}

/**
 * Run a BATCH of files (v1.16.0, design item 3) as ONE `bun test` process
 * with the junit reporter, then synthesize the runner's per-file results
 * from the XML. The parser is an optimization, never an authority: any
 * non-zero exit, timeout kill, or parse gap immediately re-runs the batch's
 * members individually through `executeTestFile` — the authoritative path
 * that reproduces today's full per-file reporting on failure.
 */
async function executeBatch(
  batch: string[],
  batchTimeoutMs: number,
  bunTestTimeoutMs: number,
  fileSuiteTimeoutMs: number,
  workerId: number,
): Promise<TestFileResult[]> {
  const startTime = Date.now();
  const workerTempDir = join("tests", ".temp", `worker-${workerId}`);
  try {
    mkdirSync(workerTempDir, { recursive: true });
  } catch {}

  const junitOut = join(workerTempDir, `junit-batch-w${workerId}-${startTime}.xml`);
  try {
    if (existsSync(junitOut)) rmSync(junitOut, { force: true });
  } catch {}

  const env = {
    ...process.env,
    TEST_TEMP_DIR: workerTempDir,
    WORKER_ID: String(workerId),
  };

  const argv = [
    process.execPath,
    "test",
    "--timeout",
    String(bunTestTimeoutMs),
    "--reporter=junit",
    `--reporter-outfile=${junitOut}`,
    ...batch,
  ];

  const proc = Bun.spawn(argv, { env, stdout: "pipe", stderr: "pipe" });
  const stdoutPromise = proc.stdout
    ? new Response(proc.stdout as ReadableStream<Uint8Array>).text()
    : Promise.resolve("");
  const stderrPromise = proc.stderr
    ? new Response(proc.stderr as ReadableStream<Uint8Array>).text()
    : Promise.resolve("");

  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      resolve({ timedOut: true });
    }, batchTimeoutMs);
  });

  const execPromise = Promise.all([stdoutPromise, stderrPromise, proc.exited]).then(([stdout, stderr, exitCode]) => ({
    timedOut: false as const,
    stdout,
    stderr,
    exitCode,
  }));

  const raced = await Promise.race([execPromise, timeoutPromise]);
  if (timer) clearTimeout(timer);
  const timedOut = raced.timedOut;
  const { stdout, stderr, exitCode } = timedOut
    ? { stdout: await stdoutPromise, stderr: await stderrPromise, exitCode: null }
    : (raced as { timedOut: false; stdout: string; stderr: string; exitCode: number });

  const fallback = async (reason: string): Promise<TestFileResult[]> => {
    console.log(`  [batch] falling back to individual runs for ${batch.length} file(s): ${reason}`);
    const results: TestFileResult[] = [];
    // Each member re-runs at its OWN suite budget (exactly the individual-dispatch
    // kill semantics — the batch sum is only the batch's kill timer), so a
    // timeout attributes the offender at its own budget and reports it TIMEOUT
    // exactly as today.
    for (const file of batch) results.push(await executeTestFile(file, fileSuiteTimeoutMs, bunTestTimeoutMs, workerId));
    return results;
  };

  // Authoritative fallback triggers (design §3.3): timeout kill (junit is only
  // flushed at process end — a killed batch has no XML) and non-zero exit.
  // Failure attribution is never guessed from batch stdout.
  if (timedOut) return fallback(`batch timed out after ${batchTimeoutMs}ms`);
  if (exitCode !== 0) return fallback(`batch exited with code ${exitCode}`);

  // Exit 0: parse the junit XML for per-file pass/duration.
  let xml: string;
  try {
    if (!existsSync(junitOut)) return fallback("junit XML missing");
    xml = readFileSync(junitOut, "utf8");
  } catch (err: any) {
    return fallback(`junit XML unreadable (${err.message})`);
  }

  let perFile: Map<string, JunitFileResult>;
  try {
    perFile = parseJunitPerFile(xml);
  } catch (err: any) {
    return fallback(`junit XML parse failed (${err.message})`);
  }

  const results: TestFileResult[] = [];
  let gap = false;
  for (const file of batch) {
    // bun echoes the file path it was given into the XML's `file` attribute,
    // but relativized to its cwd — so the exact string only matches when the
    // batch was passed relative paths. Match by full normalized path first,
    // then by basename (unique across the suite) so absolute/relative
    // invocation forms both attribute cleanly.
    const normalized = normalizePath(file);
    let parsed = perFile.get(normalized);
    if (!parsed) {
      const base = basename(normalized);
      for (const [key, value] of perFile) {
        if (basename(key) === base) {
          parsed = value;
          break;
        }
      }
    }
    if (!parsed) {
      gap = true;
      break;
    }
    results.push({
      file,
      success: parsed.failures === 0,
      durationMs: parsed.durationMs,
      stdout: "",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    });
  }
  // Parse gap (any member absent from the XML) → the whole batch re-runs
  // individually; per-file attribution is never guessed.
  if (gap) return fallback("junit XML missing one or more batch members");

  // On batch pass the raw stdout is NOT dumped (noise); the per-file summary
  // lines are re-synthesized below from the parsed results, preserving the
  // exact downstream report format.
  void stdout;
  void stderr;
  return results;
}

/**
 * Longest-first dispatch order (v1.15.0): files with a FILE_TIME_BUDGETS row
 * come first (larger suite budget, then larger test budget), then every other
 * file in its original order. The budget is a cheap proxy for "known slow".
 * Pure and stable; does not mutate the input.
 */
export function orderLongestFirst(
  files: string[],
  budgets: Record<string, { suite: number; test: number }> = FILE_TIME_BUDGETS,
): string[] {
  const rank = (file: string) => budgets[basename(file)];
  return files
    .map((file, index) => ({ file, index, b: rank(file) }))
    .sort((x, y) => {
      if (x.b && y.b) return y.b.suite - x.b.suite || y.b.test - x.b.test || x.index - y.index;
      if (x.b) return -1;
      if (y.b) return 1;
      return x.index - y.index;
    })
    .map((e) => e.file);
}

async function runInParallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number, workerId: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async (_, workerId) => {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index], index, workerId + 1);
    }
  });

  await Promise.all(workers);
  return results;
}

// ── Post-suite hygiene assertion (T-20260916-001 (c)) ──────────────────────

interface HygieneSnapshot {
  gitAvailable: boolean;
  dirtyDocsTemplates: Set<string>;
  fixtureDirs: Set<string>;
}

/**
 * Transient-fixture predicate, loaded lazily (v1.19.0): only the `scripts` suite
 * hygiene check needs it, so the fleet entry points never depend on the
 * scripts/helpers import chain behind it.
 */
function isTransientTestFixtureDir(name: string): boolean {
  try {
    const mod = require("./helpers/scaffold-markers.ts") as typeof import("./helpers/scaffold-markers.ts");
    return mod.isTransientTestFixture(name);
  } catch {
    return false;
  }
}

/**
 * Snapshot workspace pollution baselines BEFORE the suite runs:
 * dirty paths under docs/templates/ (git status) and transient fixture
 * dirs under templates/. Only DELTAS after the suite are blamed on it.
 */
function takeHygieneSnapshot(): HygieneSnapshot {
  const snap: HygieneSnapshot = { gitAvailable: false, dirtyDocsTemplates: new Set(), fixtureDirs: new Set() };
  try {
    const proc = Bun.spawnSync(["git", "status", "--porcelain", "--", "docs/templates"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (proc.exitCode === 0) {
      snap.gitAvailable = true;
      const out = new TextDecoder().decode(proc.stdout ?? new Uint8Array());
      for (const line of out.split("\n")) {
        const entry = line.trim();
        if (entry) snap.dirtyDocsTemplates.add(entry.replace(/^\S+\s+/, ""));
      }
    }
  } catch {
    /* no git — hygiene check will be skipped with a note */
  }
  try {
    if (existsSync("templates")) {
      for (const entry of readdirSync("templates", { withFileTypes: true })) {
        if (entry.isDirectory() && isTransientTestFixtureDir(entry.name)) snap.fixtureDirs.add(entry.name);
      }
    }
  } catch {
    /* unreadable templates/ — post-run scan reports what it can */
  }
  return snap;
}

/**
 * Verify the suite added no pollution: no NEW modifications under
 * docs/templates/ and no NEW transient fixture dirs under templates/.
 * Returns a list of human-readable violations (empty = clean).
 */
function verifyHygiene(snap: HygieneSnapshot): string[] {
  if (!snap.gitAvailable && !existsSync("templates")) {
    return ["hygiene check skipped: no git checkout and no templates/ directory"];
  }
  const violations: string[] = [];

  if (snap.gitAvailable) {
    const proc = Bun.spawnSync(["git", "status", "--porcelain", "--", "docs/templates"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = proc.exitCode === 0 ? new TextDecoder().decode(proc.stdout ?? new Uint8Array()) : "";
    for (const line of out.split("\n")) {
      const entry = line.trim();
      if (!entry) continue;
      const path = entry.replace(/^\S+\s+/, "");
      if (!snap.dirtyDocsTemplates.has(path)) {
        violations.push(`docs/templates/ modified during suite: ${path} (${entry.split(/\s+/)[0]})`);
      }
    }
  }

  if (existsSync("templates")) {
    try {
      for (const entry of readdirSync("templates", { withFileTypes: true })) {
        if (entry.isDirectory() && isTransientTestFixtureDir(entry.name) && !snap.fixtureDirs.has(entry.name)) {
          violations.push(
            `transient test fixture left behind: templates/${entry.name}/ (E2E cleanup failed or crashed mid-run)`,
          );
        }
      }
    } catch {
      /* handled above */
    }
  }

  return violations;
}

// ── v1.19.0: fleet test baseline (design 2026-11-24-fleet-test-baseline-design) ──

/** `process.platform` values a file tag or a suite `os` key may carry. */
export const OS_PLATFORMS = ["win32", "darwin", "linux"] as const;
export type TestOs = (typeof OS_PLATFORMS)[number];
export type OsScope = "independent" | "specific" | "both";

const OS_TAG_RE = /^(.+)\.(win32|darwin|linux)\.test\.ts$/;

/** File-level OS declaration: `<name>.<os>.test.ts`. No tag = OS-independent. */
export function parseOsTag(file: string): TestOs | null {
  const m = basename(file).match(OS_TAG_RE);
  return m ? (m[2] as TestOs) : null;
}

/** Selection rule for one file (design 4.8). */
export function isFileApplicable(file: string, os: TestOs, scope: OsScope): boolean {
  const tag = parseOsTag(file);
  if (scope === "independent") return tag === null;
  if (scope === "specific") return tag === os;
  return tag === null || tag === os;
}

export interface DeclaredSuite {
  name: string;
  type: "bun-test" | "command" | "workspace";
  dirs: string[];
  command: string[];
  os?: TestOs;
}

export interface QuarantineEntry {
  path: string;
  ticket: string;
  reason: string;
  expires: string;
}

export interface TestSuitesManifest {
  version: 1;
  include: string[];
  suites: DeclaredSuite[];
  quarantine: QuarantineEntry[];
  optOut?: { reason: string; ticket: string; review: string };
}

const BUILTIN_SPECIALIZED = ["integration", "scenarios", "scripts"];
const RESERVED_SUITE_NAMES = ["all", "common", "unit", ...BUILTIN_SPECIALIZED];
const SUITE_TYPES = ["bun-test", "command", "workspace"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SUITE_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
const MANIFEST_KEYS = ["version", "include", "suites", "quarantine", "optOut"];
const SUITE_KEYS = ["name", "type", "dirs", "command", "os"];
const QUARANTINE_KEYS = ["path", "ticket", "reason", "expires"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function isValidIsoDate(v: string): boolean {
  if (!ISO_DATE_RE.test(v)) return false;
  const ms = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === v;
}

function isOs(v: unknown): v is TestOs {
  return typeof v === "string" && (OS_PLATFORMS as readonly string[]).includes(v);
}

function isSafeRelDir(v: string): boolean {
  return !v.startsWith("/") && !/^[A-Za-z]:/.test(v) && !v.split(/[\\/]/).includes("..");
}

/** Validate a parsed `test-suites.json`. Returns human-readable errors (empty = valid). */
export function validateTestSuitesManifest(raw: unknown, runDate: Date = new Date()): string[] {
  const errors: string[] = [];
  if (!isObj(raw)) return ["test-suites.json: top level must be an object"];
  for (const key of Object.keys(raw)) {
    if (!MANIFEST_KEYS.includes(key)) errors.push(`test-suites.json: unknown key "${key}"`);
  }
  if (raw.version !== 1) errors.push(`test-suites.json: "version" must be 1`);

  const include = raw.include ?? [];
  if (!Array.isArray(include) || !include.every((v) => typeof v === "string")) {
    errors.push(`test-suites.json: "include" must be an array of built-in suite names`);
  } else {
    for (const name of include) {
      if (!BUILTIN_SPECIALIZED.includes(name)) {
        errors.push(
          `test-suites.json: "include" accepts built-in specialized suites only (${BUILTIN_SPECIALIZED.join(", ")}); got "${name}"`,
        );
      }
    }
    if (new Set(include).size !== include.length) errors.push(`test-suites.json: "include" repeats a suite`);
  }

  const suites = raw.suites ?? [];
  if (!Array.isArray(suites)) {
    errors.push(`test-suites.json: "suites" must be an array`);
  } else {
    const seen = new Set<string>();
    for (const s of suites) {
      if (!isObj(s)) {
        errors.push(`test-suites.json: each suite must be an object`);
        continue;
      }
      const label = `suite "${isNonEmptyString(s.name) ? s.name : "?"}"`;
      for (const key of Object.keys(s)) {
        if (!SUITE_KEYS.includes(key)) errors.push(`test-suites.json: ${label}: unknown key "${key}"`);
      }
      if (!isNonEmptyString(s.name) || !SUITE_NAME_RE.test(s.name)) {
        errors.push(`test-suites.json: ${label}: "name" must match ${SUITE_NAME_RE}`);
      } else if (RESERVED_SUITE_NAMES.includes(s.name)) {
        errors.push(`test-suites.json: ${label}: the name shadows a built-in entry point or "all"`);
      } else if (seen.has(s.name)) {
        errors.push(`test-suites.json: ${label}: duplicate suite name`);
      }
      if (isNonEmptyString(s.name)) seen.add(s.name);
      if (!SUITE_TYPES.includes(s.type as string)) {
        errors.push(`test-suites.json: ${label}: "type" must be one of ${SUITE_TYPES.join(", ")}`);
      } else if (s.type === "command") {
        if (!Array.isArray(s.command) || s.command.length === 0 || !s.command.every(isNonEmptyString)) {
          errors.push(`test-suites.json: ${label}: "command" suites need a non-empty argv array "command"`);
        }
      } else {
        const dirs = s.dirs;
        if (!Array.isArray(dirs) || dirs.length === 0 || !dirs.every(isNonEmptyString)) {
          errors.push(`test-suites.json: ${label}: "${s.type}" suites need a non-empty array "dirs"`);
        } else {
          for (const dir of dirs as string[]) {
            if (!isSafeRelDir(dir))
              errors.push(`test-suites.json: ${label}: "dirs" entry "${dir}" must be a repository-relative path`);
          }
        }
      }
      if (s.os !== undefined && !isOs(s.os)) {
        errors.push(`test-suites.json: ${label}: "os" must be one of ${OS_PLATFORMS.join(", ")}`);
      }
    }
  }

  const quarantine = raw.quarantine ?? [];
  if (!Array.isArray(quarantine)) {
    errors.push(`test-suites.json: "quarantine" must be an array`);
  } else {
    const maxMs = runDate.getTime() + 60 * 24 * 60 * 60 * 1000;
    for (const q of quarantine) {
      if (!isObj(q)) {
        errors.push(`test-suites.json: each quarantine entry must be an object`);
        continue;
      }
      const label = `quarantine "${isNonEmptyString(q.path) ? q.path : "?"}"`;
      for (const key of QUARANTINE_KEYS) {
        if (!isNonEmptyString(q[key])) errors.push(`test-suites.json: ${label}: "${key}" is required`);
      }
      for (const key of Object.keys(q)) {
        if (!QUARANTINE_KEYS.includes(key)) errors.push(`test-suites.json: ${label}: unknown key "${key}"`);
      }
      if (isNonEmptyString(q.expires)) {
        if (!isValidIsoDate(q.expires)) {
          errors.push(`test-suites.json: ${label}: "expires" must be YYYY-MM-DD`);
        } else if (Date.parse(`${q.expires}T00:00:00Z`) > maxMs) {
          errors.push(`test-suites.json: ${label}: "expires" is more than 60 days after the run date`);
        }
      }
      if (isNonEmptyString(q.path) && !isSafeRelDir(q.path)) {
        errors.push(`test-suites.json: ${label}: "path" must be repository-relative`);
      }
    }
  }

  if (raw.optOut !== undefined) {
    const o = raw.optOut;
    if (!isObj(o)) {
      errors.push(`test-suites.json: "optOut" must be an object`);
    } else {
      for (const key of ["reason", "ticket", "review"]) {
        if (!isNonEmptyString(o[key])) errors.push(`test-suites.json: "optOut": "${key}" is required`);
      }
      for (const key of Object.keys(o)) {
        if (!["reason", "ticket", "review"].includes(key))
          errors.push(`test-suites.json: "optOut": unknown key "${key}"`);
      }
    }
  }
  return errors;
}

/** Parse and validate the manifest text. `manifest` is undefined on any error. */
export function parseTestSuitesManifest(
  text: string,
  runDate: Date = new Date(),
): { manifest: TestSuitesManifest | undefined; errors: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err: any) {
    return { manifest: undefined, errors: [`test-suites.json is not valid JSON: ${err.message}`] };
  }
  const errors = validateTestSuitesManifest(raw, runDate);
  if (errors.length > 0) return { manifest: undefined, errors };
  const m = raw as TestSuitesManifest;
  return {
    manifest: { ...m, include: m.include ?? [], suites: m.suites ?? [], quarantine: m.quarantine ?? [] },
    errors: [],
  };
}

const toPosix = (p: string): string => p.replace(/\\/g, "/");

/** A quarantine entry is honored from the run date until its expiry date, inclusive. */
export function isQuarantineActive(q: QuarantineEntry, runDate: Date = new Date()): boolean {
  const today = runDate.toISOString().slice(0, 10);
  return q.expires >= today;
}

/** Active quarantine entries matching a target: the exact file, or anything under the entry path. */
export function quarantineFor(
  path: string,
  quarantine: QuarantineEntry[],
  runDate: Date = new Date(),
): QuarantineEntry[] {
  const norm = toPosix(path);
  return quarantine.filter(
    (q) => isSafeRelDir(q.path) && isQuarantineActive(q, runDate) && (norm === q.path || norm.startsWith(`${q.path}/`)),
  );
}

/** One regex extracts every field of the summary line (design 4.4). */
export const TEST_RUN_SUMMARY_RE =
  /^TEST-RUN-SUMMARY schema=(\d+) entry=(\S+) os=(\S+) scope=(\S+) suites=(\d+)\/(\d+) files=(\d+) files_failed=(\d+) tests=(-?\d+) tests_failed=(-?\d+) not_applicable=(\d+) quarantined_failed=(-?\d+) result=(\S+)$/;

/** bun's final ` N pass` / ` N fail` rows. Null when the text carries neither. */
export function parseBunCounts(text: string): { pass: number; fail: number } | null {
  const passRe = /^\s*(\d+) pass\b/gm;
  const failRe = /^\s*(\d+) fail\b/gm;
  let pass = 0;
  let fail = 0;
  let seen = false;
  for (const re of [passRe, failRe]) {
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      seen = true;
      if (re === passRe) pass += Number(m[1]);
      else fail += Number(m[1]);
    }
  }
  return seen ? { pass, fail } : null;
}

/** Platforms (other than linux) with at least one OS-specific target, as `--plan-os` prints it. */
export function formatPlanOs(platforms: TestOs[]): string {
  const ordered = (["win32", "darwin"] as TestOs[]).filter((p) => platforms.includes(p));
  return JSON.stringify(ordered);
}

interface RunContext {
  os: TestOs;
  scope: OsScope;
  dryRun: boolean;
  runDate: Date;
  manifest: TestSuitesManifest;
}

interface Step {
  name: string;
  /** baseline | builtin | declared */
  kind: "baseline" | "builtin" | "declared";
  type: "bun-test" | "command" | "workspace";
  /** Applicable targets: file paths, or workspace directories. */
  targets: string[];
  excluded: { path: string; tag: TestOs }[];
  timeout: number;
  sequential: boolean;
  execMode: "bun-test" | "bun-script";
  batching: boolean;
  hygiene: boolean;
  command?: string[];
  /** Suite-level OS declaration; undefined = applies to every OS. */
  suiteOs?: TestOs;
}

interface Plan {
  steps: Step[];
  /** Suites the OS selection leaves out (printed as notices, never dispatched). */
  skipped: { name: string; reason: string }[];
  optedOut: TestSuitesManifest["optOut"];
  /** The first rule that fails closed, with the step it belongs to. Nothing at or after it runs. */
  fatal: { name: string; detail: string } | null;
  osSpecific: Record<TestOs, number>;
}

const toPosixPath = (p: string): string => p.replace(/\\/g, "/");

/** Flat `*.test.ts` files directly in each directory. Sorted, de-duplicated. */
function flatTestFiles(dirs: string[]): string[] {
  const out = new Set<string>();
  for (const dir of dirs) {
    try {
      if (!existsSync(dir)) continue;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && entry.name.endsWith(".test.ts")) out.add(toPosixPath(join(dir, entry.name)));
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") console.error(`Error reading directory ${dir}: ${error.message}`);
    }
  }
  return [...out].sort();
}

/** Directories matching a glob that carry a `package.json` with a `test` script. */
function workspaceTargets(globs: string[]): { dirs: string[]; skipped: string[] } {
  const dirs = new Set<string>();
  const skipped: string[] = [];
  for (const glob of globs) {
    let found: string[] = [];
    try {
      for (const hit of new Bun.Glob(glob).scanSync({ cwd: ".", onlyFiles: false })) found.push(toPosixPath(hit));
    } catch (error: any) {
      console.error(`Error scanning ${glob}: ${error.message}`);
    }
    for (const dir of found.sort()) {
      if (dirs.has(dir) || skipped.includes(dir)) continue;
      try {
        if (!existsSync(join(dir, "package.json"))) continue;
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { scripts?: Record<string, string> };
        if (pkg.scripts?.test) dirs.add(dir);
        else skipped.push(dir);
      } catch {
        skipped.push(dir);
      }
    }
  }
  return { dirs: [...dirs], skipped };
}

/** Build the selection for one entry point. Discovery only: nothing is executed. */
function buildPlan(entry: string, ctx: RunContext): Plan {
  const { os, scope, manifest } = ctx;
  const steps: Step[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const osSpecific: Record<TestOs, number> = { win32: 0, darwin: 0, linux: 0 };
  const specific = scope === "specific";
  let fatal: Plan["fatal"] = null;

  const fileStep = (
    name: string,
    kind: Step["kind"],
    dirs: string[],
    extra: Partial<Step>,
    suiteOs?: TestOs,
  ): Step | null => {
    // OS selection runs at discovery, before orderLongestFirst (design 4.8).
    const discovered = flatTestFiles(dirs).map((file) => ({ file, tag: parseOsTag(file) }));
    const applicable = discovered.filter((f) => {
      // A suite-level `os` key already gated the whole suite on this platform.
      if (suiteOs !== undefined) return true;
      // Scope is explicit: "independent" must stay untagged-only even when the tag
      // equals the running platform (a win32-tagged file IS "both" on win32, but it
      // is never part of the OS-independent leg).
      if (scope === "independent") return f.tag === null;
      if (scope === "specific") return f.tag === os;
      return f.tag === null || f.tag === os;
    });
    const excluded = discovered
      .filter((f) => !applicable.includes(f) && f.tag !== null)
      .map((f) => ({ path: f.file, tag: f.tag as TestOs }));
    // OS-specific targets are counted on every DISCOVERED target, whatever the selected platform.
    if (suiteOs !== undefined) osSpecific[suiteOs] += discovered.length;
    else for (const f of discovered) if (f.tag) osSpecific[f.tag] += 1;
    const targets = applicable.map((f) => f.file);
    if (discovered.length === 0 && !specific && !fatal) {
      fatal = { name, detail: `suite "${name}" resolved 0 target(s) under ${dirs.join(", ")}` };
    }
    const step: Step = {
      name,
      kind,
      type: "bun-test",
      targets,
      excluded,
      timeout: 120000,
      sequential: false,
      execMode: "bun-test",
      batching: false,
      hygiene: false,
      suiteOs,
    };
    return Object.assign(step, extra);
  };

  const addDeclared = (s: DeclaredSuite): void => {
    if (s.os !== undefined && (scope === "independent" || s.os !== os)) {
      skipped.push({ name: s.name, reason: `suite os ${s.os}` });
      return;
    }
    if (s.type === "command") {
      if (s.os !== undefined) osSpecific[s.os] += 1;
      steps.push({
        name: s.name,
        kind: "declared",
        type: "command",
        targets: ["<command>"],
        excluded: [],
        timeout: 300000,
        sequential: true,
        execMode: "bun-test",
        batching: false,
        hygiene: false,
        command: s.command,
        suiteOs: s.os,
      });
      return;
    }
    if (s.type === "workspace") {
      const found = workspaceTargets(s.dirs);
      for (const dir of found.skipped) skipped.push({ name: s.name, reason: `"${dir}" has no test script` });
      if (s.os !== undefined) osSpecific[s.os] += found.dirs.length;
      if (found.dirs.length === 0 && !specific && !fatal) {
        fatal = {
          name: s.name,
          detail: `suite "${s.name}" resolved 0 workspace directories under ${s.dirs.join(", ")}`,
        };
      }
      steps.push({
        name: s.name,
        kind: "declared",
        type: "workspace",
        targets: found.dirs,
        excluded: [],
        timeout: 300000,
        sequential: true,
        execMode: "bun-test",
        batching: false,
        hygiene: false,
        suiteOs: s.os,
      });
      return;
    }
    const step = fileStep(s.name, "declared", s.dirs, {}, s.os);
    if (step) steps.push(step);
  };

  const declared = () => manifest.suites.forEach(addDeclared);

  if (entry === "all") {
    // FC1: the baseline is evaluated first; a zero baseline stops the run here.
    const baseline = fileStep("common", "baseline", ["scripts/tests"], {});
    const optedOut = ctx.manifest.optOut;
    if (baseline) {
      if (baseline.targets.length === 0 && !optedOut && !specific && !fatal) {
        fatal = { name: "common", detail: `no tests in scripts/tests (the fleet baseline)` };
      }
      // FC5: the baseline is OS-independent by definition.
      if (!specific) {
        const tagged = baseline.excluded.length + baseline.targets.filter((f) => parseOsTag(f) !== null).length;
        if (tagged > 0 && !fatal) {
          fatal = { name: "common", detail: `a baseline file carries an OS tag; the baseline is OS-independent` };
        }
      }
      if (!optedOut || specific) steps.push(baseline);
    }
    if (!optedOut || specific) {
      if (existsSync("tests/unit")) {
        const unit = fileStep("unit", "builtin", ["tests/unit"], {
          timeout: suites[0].timeout,
          batching: true,
        });
        if (unit) steps.push(unit);
      }
      for (const name of manifest.include) {
        const builtin = suites.find((s) => s.name === name);
        if (!builtin) continue;
        const files = getTestFiles(builtin).map(toPosixPath);
        const discovered = files.map((file) => ({ file, tag: parseOsTag(file) }));
        const applicable = discovered.filter((f) =>
          scope === "independent"
            ? f.tag === null
            : scope === "specific"
              ? f.tag === os
              : f.tag === null || f.tag === os,
        );
        for (const f of discovered) if (f.tag) osSpecific[f.tag] += 1;
        const targets = applicable.map((f) => f.file);
        if (discovered.length === 0 && !specific && !fatal) {
          fatal = { name, detail: `built-in suite "${name}" listed in include resolved 0 target(s)` };
        }
        steps.push({
          name,
          kind: "builtin",
          type: "bun-test",
          targets,
          excluded: discovered
            .filter((f) => !applicable.includes(f) && f.tag !== null)
            .map((f) => ({ path: f.file, tag: f.tag as TestOs })),
          timeout: builtin.timeout,
          sequential: Boolean(builtin.sequential),
          execMode: name === "scripts" ? "bun-script" : "bun-test",
          batching: false,
          hygiene: name === "scripts",
        });
      }
      declared();
    }
    return { steps, skipped, optedOut, fatal, osSpecific };
  }

  if (entry === "common") {
    const baseline = fileStep("common", "baseline", ["scripts/tests"], {});
    if (baseline) {
      if (
        !specific &&
        baseline.excluded.length + baseline.targets.filter((f) => parseOsTag(f) !== null).length > 0 &&
        !fatal
      ) {
        fatal = { name: "common", detail: "a baseline file carries an OS tag; the baseline is OS-independent" };
      }
      steps.push(baseline);
    }
    return { steps, skipped, optedOut: ctx.manifest.optOut, fatal, osSpecific };
  }

  const builtin = suites.find((s) => s.name === entry);
  if (builtin) {
    // Built-in specialized suites keep their v1.18.0 verdict: an absent suite is a notice, exit 0.
    const files = getTestFiles(builtin).map(toPosixPath);
    const discovered = files.map((file) => ({ file, tag: parseOsTag(file) }));
    const applicable = discovered.filter((f) =>
      scope === "independent" ? f.tag === null : scope === "specific" ? f.tag === os : f.tag === null || f.tag === os,
    );
    for (const f of applicable) if (f.tag) osSpecific[f.tag] += 1;
    steps.push({
      name: entry,
      kind: "builtin",
      type: "bun-test",
      targets: applicable.map((f) => f.file),
      excluded: discovered
        .filter((f) => !applicable.includes(f) && f.tag !== null)
        .map((f) => ({ path: f.file, tag: f.tag as TestOs })),
      timeout: builtin.timeout,
      sequential: Boolean(builtin.sequential),
      execMode: entry === "scripts" ? "bun-script" : "bun-test",
      batching: entry === "unit",
      hygiene: entry === "scripts",
    });
    return { steps, skipped, optedOut: ctx.manifest.optOut, fatal, osSpecific };
  }

  const declaredSuite = manifest.suites.find((s) => s.name === entry);
  if (declaredSuite) {
    addDeclared(declaredSuite);
    return { steps, skipped, optedOut: ctx.manifest.optOut, fatal, osSpecific };
  }

  throw new Error(`Suite not found: ${entry}`);
}

/** Fleet alias standard (design 4.5): WARN when package.json differs from the standard lines. */
const FLEET_ALIAS_STANDARD: Record<string, string> = {
  test: "bun scripts/test-runner.ts all",
  "test:unit": "bun scripts/test-runner.ts all",
  "test:common": "bun scripts/test-runner.ts common",
};

function warnOnAliasDrift(): void {
  let scripts: Record<string, string> | undefined;
  try {
    scripts = (JSON.parse(readFileSync("package.json", "utf8")) as { scripts?: Record<string, string> }).scripts;
  } catch {
    return;
  }
  if (!scripts) return;
  for (const [alias, standard] of Object.entries(FLEET_ALIAS_STANDARD)) {
    const actual = scripts[alias];
    if (actual !== undefined && actual.trim() !== standard) {
      console.log(`  ⚠ test-runner: alias "${alias}" is "${actual}"; the fleet standard line is "${standard}"`);
    }
  }
}

interface RunCounts {
  ran: number;
  resolved: number;
  files: number;
  filesFailed: number;
  tests: number;
  testsFailed: number;
  testsUnknown: boolean;
  quarantinedFailed: number;
  quarantineSeen: boolean;
  failed: boolean;
  notApplicable: number;
  /** FC3: the baseline ran and its parsed test total is zero. */
  baselineZero: boolean;
}

/** Spawn an argv array (no shell) with a kill timer; stdout/stderr are captured. */
async function runProcess(
  label: string,
  argv: string[],
  cwd: string | undefined,
  timeoutMs: number,
  env: Record<string, string> = {},
): Promise<TestFileResult> {
  const startTime = Date.now();
  let proc: ReturnType<typeof Bun.spawn> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    proc = Bun.spawn(argv, { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
    const stdoutPromise = proc.stdout
      ? new Response(proc.stdout as ReadableStream<Uint8Array>).text()
      : Promise.resolve("");
    const stderrPromise = proc.stderr
      ? new Response(proc.stderr as ReadableStream<Uint8Array>).text()
      : Promise.resolve("");
    const timeoutPromise = new Promise<{ timedOut: true }>((resolve) => {
      timer = setTimeout(() => {
        try {
          proc?.kill();
        } catch {}
        resolve({ timedOut: true });
      }, timeoutMs);
    });
    const execPromise = Promise.all([stdoutPromise, stderrPromise, proc.exited]).then(([stdout, stderr, exitCode]) => ({
      timedOut: false as const,
      stdout,
      stderr,
      exitCode,
    }));
    const raced = await Promise.race([execPromise, timeoutPromise]);
    if (timer) clearTimeout(timer);
    if (raced.timedOut) {
      const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);
      return {
        file: label,
        success: false,
        durationMs: Date.now() - startTime,
        stdout,
        stderr,
        exitCode: null,
        timedOut: true,
        error: `Test timed out after ${timeoutMs}ms`,
      };
    }
    const { stdout, stderr, exitCode } = raced;
    return {
      file: label,
      success: exitCode === 0,
      durationMs: Date.now() - startTime,
      stdout,
      stderr,
      exitCode,
      timedOut: false,
      error: exitCode !== 0 ? `Process exited with code ${exitCode}` : undefined,
    };
  } catch (err: any) {
    if (timer) clearTimeout(timer);
    return {
      file: label,
      success: false,
      durationMs: Date.now() - startTime,
      stdout: "",
      stderr: "",
      exitCode: null,
      timedOut: false,
      error: err.message,
    };
  }
}

/** Run one file step. Per-file report lines keep their v1.18.0 format (design 4.8 invariant). */
async function executeFileStep(step: Step, ctx: RunContext, counts: RunCounts, options: RunOptions): Promise<void> {
  const files = step.targets;
  const suiteName = step.name;
  const suiteTimeout = step.timeout;
  const isParallel = options.parallel !== undefined ? options.parallel : !step.sequential && files.length > 1;
  const numCpus = availableParallelism ? availableParallelism() : cpus().length;
  const defaultConcurrency = resolveDefaultConcurrency(numCpus);
  const concurrency = isParallel ? Math.max(1, options.concurrency || Math.min(files.length, defaultConcurrency)) : 1;
  const batchingEnabled = step.batching && isParallel && resolveBatchSize() > 0;
  const cliTimeoutMs = options.timeout;
  const resolveBudgets = (file: string): { suite: number; test: number } => {
    if (cliTimeoutMs) return { suite: cliTimeoutMs, test: cliTimeoutMs };
    const override = FILE_TIME_BUDGETS[basename(file)];
    return { suite: override?.suite ?? suiteTimeout, test: override?.test ?? DEFAULT_TEST_TIMEOUT_MS };
  };

  const modeStr = isParallel ? `parallel (concurrency: ${concurrency})` : "sequential";
  console.log(`Running ${suiteName} suite (${files.length} test file${files.length === 1 ? "" : "s"}, ${modeStr})...`);
  for (const x of step.excluded) {
    console.log(`  - ${x.path} (not applicable on ${ctx.os}: tagged ${x.tag})`);
  }

  const startTime = Date.now();
  let results: TestFileResult[] = [];
  const hygieneSnapshot = step.hygiene ? takeHygieneSnapshot() : null;

  try {
    const execMode = step.execMode;
    if (isParallel && concurrency > 1) {
      try {
        const dispatchOrder = orderLongestFirst(files);
        const batchSize = batchingEnabled ? resolveBatchSize() : 0;
        type Job = { kind: "single"; file: string } | { kind: "batch"; files: string[] };
        const jobs: Job[] = [];
        const tail: string[] = [];
        for (const file of dispatchOrder) {
          if (batchingEnabled && !FILE_TIME_BUDGETS[basename(file)]) {
            tail.push(file);
          } else {
            jobs.push({ kind: "single", file });
          }
        }
        for (let i = 0; i < tail.length; i += batchSize) {
          jobs.push({ kind: "batch", files: tail.slice(i, i + batchSize) });
        }

        const ordered = await runInParallel(jobs, concurrency, (job, _, workerId): Promise<TestFileResult[]> => {
          if (job.kind === "single") {
            const budgets = resolveBudgets(job.file);
            return executeTestFile(
              job.file,
              budgets.suite,
              execMode === "bun-test" ? budgets.test : null,
              workerId,
              execMode,
            ).then((res) => [res]);
          }
          const batchBudget = Math.min(
            job.files.reduce((sum, f) => sum + resolveBudgets(f).suite, 0),
            120000 * job.files.length,
          );
          return executeBatch(
            job.files,
            batchBudget,
            resolveBudgets(job.files[0]).test,
            resolveBudgets(job.files[0]).suite,
            workerId,
          );
        });

        const byFile = new Map<string, TestFileResult>();
        for (const jobResults of ordered) {
          for (const res of jobResults) {
            byFile.set(res.file, res);
            if (res.stdout === "" && res.success) counts.testsUnknown = true;
          }
        }
        results = files.map((f) => byFile.get(f)!);
      } catch (err: any) {
        console.warn(
          `[test-runner] Warning: Parallel execution failed (${err.message}). Falling back to sequential execution...`,
        );
        results = [];
        for (let i = 0; i < files.length; i++) {
          const budgets = resolveBudgets(files[i]);
          results.push(
            await executeTestFile(files[i], budgets.suite, execMode === "bun-test" ? budgets.test : null, 1, execMode),
          );
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`  Running: ${file}`);
        const budgets = resolveBudgets(file);
        results.push(
          await executeTestFile(file, budgets.suite, execMode === "bun-test" ? budgets.test : null, 1, execMode),
        );
      }
    }

    const totalDuration = Date.now() - startTime;
    let hasFailures = false;

    if (hygieneSnapshot) {
      const violations = verifyHygiene(hygieneSnapshot);
      for (const v of violations) {
        hasFailures = true;
        console.error(`\n================================================================================`);
        console.error(`FAIL: post-suite hygiene assertion (T-20260916-001)`);
        console.error(`--------------------------------------------------------------------------------`);
        console.error(v);
        console.error(`================================================================================\n`);
      }
      if (violations.length === 0) {
        console.log(`  ✓ post-suite hygiene: docs/templates/ clean, no leftover test fixture dirs`);
      }
    }

    for (const res of results) {
      const budgets = resolveBudgets(res.file);
      const headroomPct = Math.round((res.durationMs / budgets.suite) * 100);
      if (headroomPct >= 60) {
        console.log(
          `  ⚠️  BUDGET-HEADROOM: ${basename(res.file)} took ${res.durationMs}ms (${headroomPct}% of its ${budgets.suite}ms suite budget) — a raise requires a ticket with CI-run evidence; 2 raises/quarter triggers a mandatory split/trim review`,
        );
      }
      const parsed = execMode === "bun-test" ? parseBunCounts(`${res.stdout}\n${res.stderr}`) : null;
      if (execMode === "bun-test") {
        if (parsed) {
          counts.tests += parsed.pass + parsed.fail;
          counts.testsFailed += parsed.fail;
        } else {
          counts.testsUnknown = true;
        }
      }
      counts.files += 1;
      const quarantine = quarantineFor(res.file, ctx.manifest.quarantine, ctx.runDate);
      if (quarantine.length > 0) counts.quarantineSeen = true;
      if (res.success) {
        console.log(`  ✓ ${res.file} (${res.durationMs}ms)`);
      } else {
        if (quarantine.length === 0) {
          hasFailures = true;
          counts.filesFailed += 1;
        } else {
          const q = quarantine[0];
          counts.quarantinedFailed += Math.max(parsed?.fail ?? 0, 1);
          console.log(
            `  ! ${res.file} (${res.durationMs}ms) — QUARANTINED under ${q.ticket} until ${q.expires}; the failure is reported and does not fail this run`,
          );
        }
        console.error(`\n================================================================================`);
        console.error(`FAIL: ${res.file}`);
        console.error(`--------------------------------------------------------------------------------`);
        console.error(
          `Status: ${res.timedOut ? `TIMEOUT (${resolveBudgets(res.file).suite}ms)` : `FAILED (exit code ${res.exitCode})`}`,
        );
        if (res.error) console.error(`Error: ${res.error}`);
        if (res.stdout.trim()) {
          console.error(`--- STDOUT ---`);
          console.error(res.stdout.trim());
        }
        if (res.stderr.trim()) {
          console.error(`--- STDERR ---`);
          console.error(res.stderr.trim());
        }
        console.error(`================================================================================\n`);
      }
    }

    if (hasFailures) {
      const failedCount = results.filter((r) => !r.success).length;
      console.error(
        `✗ ${suiteName} suite failed (${failedCount} of ${files.length} test files failed, total ${totalDuration}ms)`,
      );
      counts.failed = true;
      return;
    }
    console.log(`✓ ${suiteName} suite passed (${totalDuration}ms)`);
    // FC3: a baseline whose files hold no test at all is an empty baseline.
    if (step.kind === "baseline") counts.baselineZero = counts.tests === 0;
  } catch (error: any) {
    console.error(`✗ Suite execution error: ${error.message}`);
    counts.failed = true;
  }
}

/** Run one `command` or `workspace` step: the exit code is the verdict. */
async function executeCommandStep(step: Step, counts: RunCounts): Promise<void> {
  if (step.type === "command") {
    console.log(`Running ${step.name} suite (command: ${(step.command ?? []).join(" ")})...`);
    const res = await runProcess((step.command ?? []).join(" "), step.command ?? [], undefined, step.timeout);
    counts.files += 1;
    counts.testsUnknown = true;
    if (res.success) {
      console.log(`  ✓ ${res.file} (${res.durationMs}ms)`);
    } else {
      counts.filesFailed += 1;
      counts.failed = true;
      console.error(
        `\nFAIL: ${res.file}\nStatus: ${res.timedOut ? `TIMEOUT (${step.timeout}ms)` : `FAILED (exit code ${res.exitCode})`}`,
      );
      if (res.stdout.trim()) console.error(`--- STDOUT ---\n${res.stdout.trim()}`);
      if (res.stderr.trim()) console.error(`--- STDERR ---\n${res.stderr.trim()}\n`);
    }
    return;
  }
  console.log(
    `Running ${step.name} suite (workspace: ${step.targets.length} director${step.targets.length === 1 ? "y" : "ies"})...`,
  );
  for (const dir of step.targets) {
    const res = await runProcess(dir, ["bun", "run", "test"], dir, step.timeout);
    const parsed = parseBunCounts(`${res.stdout}\n${res.stderr}`);
    if (parsed) {
      counts.tests += parsed.pass + parsed.fail;
      counts.testsFailed += parsed.fail;
    } else {
      counts.testsUnknown = true;
    }
    counts.files += 1;
    if (res.success) {
      console.log(`  ✓ ${dir} (${res.durationMs}ms)`);
    } else {
      counts.filesFailed += 1;
      counts.failed = true;
      console.error(
        `\nFAIL: ${dir}\nStatus: ${res.timedOut ? `TIMEOUT (${step.timeout}ms)` : `FAILED (exit code ${res.exitCode})`}`,
      );
      if (res.stdout.trim()) console.error(`--- STDOUT ---\n${res.stdout.trim()}`);
      if (res.stderr.trim()) console.error(`--- STDERR ---\n${res.stderr.trim()}\n`);
    }
  }
}

interface SummaryFields {
  entry: string;
  os: TestOs;
  scope: OsScope;
  counts: RunCounts;
  result: "pass" | "fail" | "no-tests" | "opt-out" | "selected";
}

function summaryLine(f: SummaryFields): string {
  const c = f.counts;
  const known = !c.testsUnknown;
  return (
    `TEST-RUN-SUMMARY schema=1 entry=${f.entry} os=${f.os} scope=${f.scope} suites=${c.ran}/${c.resolved} ` +
    `files=${c.files} files_failed=${c.filesFailed} tests=${known ? c.tests : -1} tests_failed=${known ? c.testsFailed : -1} ` +
    `not_applicable=${c.notApplicable} quarantined_failed=${c.quarantineSeen ? c.quarantinedFailed : -1} result=${f.result}`
  );
}

export interface RunOptions {
  parallel?: boolean;
  concurrency?: number;
  timeout?: number;
  /** Print the selection and the summary line; execute nothing. */
  dryRun?: boolean;
  /** Evaluate the selection for another platform (default: `process.platform`). */
  os?: TestOs;
  /** OS selection scope (default: `both`). */
  osScope?: OsScope;
  planOs?: boolean;
}

function newCounts(): RunCounts {
  return {
    ran: 0,
    resolved: 0,
    files: 0,
    filesFailed: 0,
    tests: 0,
    testsFailed: 0,
    testsUnknown: false,
    quarantinedFailed: 0,
    quarantineSeen: false,
    failed: false,
    notApplicable: 0,
    baselineZero: false,
  };
}

const emptyManifest = (): TestSuitesManifest => ({ version: 1, include: [], suites: [], quarantine: [] });

function loadManifest(runDate: Date): { manifest: TestSuitesManifest | undefined; errors: string[] } {
  if (!existsSync("test-suites.json")) return { manifest: emptyManifest(), errors: [] };
  return parseTestSuitesManifest(readFileSync("test-suites.json", "utf8"), runDate);
}

/** Execute one entry point. Prints the summary line last and returns the exit code. */
export async function executeRun(entry: string, options: RunOptions = {}): Promise<number> {
  const os = options.os ?? (process.platform as TestOs);
  const scope = options.osScope ?? "both";
  const runDate = new Date();
  let exitCode = 1;
  let summaryPrinted = false;
  const printSummary = (counts: RunCounts, result: SummaryFields["result"]): void => {
    if (summaryPrinted) return;
    summaryPrinted = true;
    console.log(summaryLine({ entry, os, scope, counts, result }));
  };
  try {
    const loaded = loadManifest(runDate);
    if (loaded.errors.length > 0 || !loaded.manifest) {
      for (const e of loaded.errors) console.error(`✗ test-runner: ${e}`);
      printSummary(newCounts(), "fail");
      return 1;
    }
    const ctx: RunContext = { os, scope, dryRun: Boolean(options.dryRun), runDate, manifest: loaded.manifest };
    const plan = buildPlan(entry, ctx);
    const counts = newCounts();
    const specific = scope === "specific";
    const baselineEntry = entry === "all" || entry === "common";

    if (entry === "all") warnOnAliasDrift();
    for (const s of plan.skipped) console.log(`  - suite ${s.name} skipped on ${os} (${s.reason})`);

    if (plan.optedOut && !specific && baselineEntry) {
      const o = plan.optedOut as NonNullable<TestSuitesManifest["optOut"]>;
      console.log(`⚠ test-runner: opt-out recorded in test-suites.json (${o.ticket}; review ${o.review}): ${o.reason}`);
      printSummary(counts, "opt-out");
      return 0;
    }
    const fatal = plan.fatal;
    if (fatal) {
      console.error(`✗ test-runner: fail-closed: ${fatal.detail} (result=no-tests)`);
      printSummary(counts, "no-tests");
      return 1;
    }
    if (ctx.dryRun) {
      console.log(`DRY-RUN: entry ${entry}, os ${os}, scope ${scope} — nothing is executed`);
      for (const step of plan.steps) {
        counts.notApplicable += step.excluded.length;
        if (step.targets.length === 0) {
          console.log(`  ${step.name}: 0 target(s)`);
          continue;
        }
        counts.resolved += 1;
        counts.files += step.targets.length;
        console.log(`  ${step.name}: ${step.targets.length} target(s)`);
        for (const t of step.targets) console.log(`    ${t}`);
        for (const x of step.excluded) console.log(`    - ${x.path} (not applicable on ${os}: tagged ${x.tag})`);
      }
      printSummary(counts, "selected");
      return 0;
    }

    for (const step of plan.steps) {
      // The first fail-closed rule stops the run before its suite starts.
      if (plan.fatal && plan.fatal.name === step.name) break;
      counts.notApplicable += step.excluded.length;
      if (step.targets.length === 0 && step.excluded.length > 0) {
        // Every discovered file belongs to another OS: report the selection, dispatch nothing.
        for (const x of step.excluded) console.log(`  - ${x.path} (not applicable on ${os}: tagged ${x.tag})`);
        continue;
      }
      if (step.targets.length === 0) {
        // An absent built-in specialized suite keeps exit 0 (neutral fleet delivery).
        console.log(`No tests found for suite: ${step.name}`);
        console.log(
          `  ⚠ test-runner: suite "${step.name}" resolved 0 target(s) — non-fatal: a built-in specialized suite`,
        );
        continue;
      }
      counts.resolved += 1;
      counts.ran += 1;
      if (step.type === "bun-test") await executeFileStep(step, ctx, counts, options);
      else await executeCommandStep(step, counts);
    }
    if (counts.failed) {
      printSummary(counts, "fail");
      exitCode = 1;
    } else if (counts.baselineZero) {
      console.error("✗ test-runner: fail-closed: the baseline parsed test total is 0 (result=no-tests)");
      printSummary(counts, "no-tests");
      exitCode = 1;
    } else if (counts.resolved === 0) {
      printSummary(counts, "no-tests");
      exitCode = 0;
    } else {
      printSummary(counts, "pass");
      exitCode = 0;
    }
    return exitCode;
  } catch (error: any) {
    console.error(`✗ test-runner: ${error.message}`);
    printSummary(newCounts(), "fail");
    return 1;
  } finally {
    try {
      if (existsSync("tests/.temp")) rmSync("tests/.temp", { recursive: true, force: true });
    } catch (e: any) {
      console.error(`[test-runner] Error during temp dir cleanup: ${e.message || e}`);
    }
  }
}

/** `--plan-os`: JSON array of the non-linux platforms with an OS-specific target in `all`. */
export async function planOsLegs(): Promise<number> {
  const runDate = new Date();
  const base = { os: "linux" as TestOs, scope: "both" as OsScope, dryRun: true, runDate };
  try {
    const loaded = loadManifest(runDate);
    if (loaded.errors.length > 0 || !loaded.manifest) {
      for (const e of loaded.errors) console.error(`✗ test-runner: ${e}`);
      console.error(summaryLine({ entry: "all", os: base.os, scope: base.scope, counts: newCounts(), result: "fail" }));
      return 1;
    }
    const plan = buildPlan("all", { ...base, manifest: loaded.manifest });
    const fatal = plan.fatal;
    if (fatal) {
      console.error(`✗ test-runner: fail-closed: ${fatal.detail} (result=no-tests)`);
      console.error(
        summaryLine({ entry: "all", os: base.os, scope: base.scope, counts: newCounts(), result: "no-tests" }),
      );
      return 1;
    }
    const platforms = (["win32", "darwin"] as TestOs[]).filter((p) => plan.osSpecific[p] > 0);
    console.log(formatPlanOs(platforms));
    console.error(
      summaryLine({ entry: "all", os: base.os, scope: base.scope, counts: newCounts(), result: "selected" }),
    );
    return 0;
  } catch (error: any) {
    console.error(`✗ test-runner: ${error.message}`);
    return 1;
  }
}

/** Backward-compatible wrapper: true when the run exits 0. */
export async function runTests(suiteName: string = "integration", options: RunOptions = {}): Promise<boolean> {
  return (await executeRun(suiteName, options)) === 0;
}

function parseArgs(args: string[]): { suiteName: string; options: RunOptions } {
  let suiteName = "integration";
  let parallel: boolean | undefined = undefined;
  let concurrency: number | undefined = undefined;
  let timeout: number | undefined = undefined;
  let dryRun = false;
  let os: TestOs | undefined = undefined;
  let osScope: OsScope | undefined = undefined;
  let planOs = false;

  const isOs = (v: string | undefined): v is TestOs =>
    Boolean(v) && (OS_PLATFORMS as readonly string[]).includes(v as string);
  const isScope = (v: string | undefined): v is OsScope => v === "independent" || v === "specific" || v === "both";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--parallel") {
      parallel = true;
    } else if (arg === "--sequential") {
      parallel = false;
    } else if (arg === "--concurrency" || arg === "-c") {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val) && val > 0) concurrency = val;
    } else if (arg === "--timeout" || arg === "-t") {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val) && val > 0) timeout = val;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--plan-os") {
      planOs = true;
    } else if (arg === "--os") {
      const val = args[++i];
      if (!isOs(val)) throw new Error(`--os expects one of ${OS_PLATFORMS.join(", ")}; got "${val}"`);
      os = val;
    } else if (arg === "--os-scope") {
      const val = args[++i];
      if (!isScope(val)) throw new Error(`--os-scope expects independent, specific or both; got "${val}"`);
      osScope = val;
    } else if (!arg.startsWith("-")) {
      suiteName = arg;
    }
  }

  return { suiteName, options: { parallel, concurrency, timeout, dryRun, os, osScope, planOs } };
}

// CLI entrypoint
if (import.meta.main) {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const code = parsed.options.planOs ? await planOsLegs() : await executeRun(parsed.suiteName, parsed.options);
    process.exit(code);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}
