/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.17.1
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
import { isTransientTestFixture } from "./helpers/scaffold-markers.ts";

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
  "upgrade-decision-log.test.ts": { suite: 300000, test: 60000 },
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
  "upgrade-overwrite-protection.test.ts": { suite: 300000, test: 60000 },
  // Core-locked fork arm replay: two full engine spawns (one dry-run, one apply) per file run.
  "upgrade-core-locked-fork.test.ts": { suite: 300000, test: 60000 },
  // Overwrite-protection PR-B replay: three engine spawns (dry-run, apply, apply + grant) per file run.
  "upgrade-vintage-pending.test.ts": { suite: 300000, test: 60000 },
};

function getTestFiles(suite: TestSuite): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(suite.dir)) return files;
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
        if (entry.isDirectory() && isTransientTestFixture(entry.name)) snap.fixtureDirs.add(entry.name);
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
        if (entry.isDirectory() && isTransientTestFixture(entry.name) && !snap.fixtureDirs.has(entry.name)) {
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

export async function runTests(suiteName: string = "integration", options: RunOptions = {}): Promise<boolean> {
  const suite = suites.find((s) => s.name === suiteName);
  if (!suite) {
    console.error(`Available suites: ${suites.map((s) => s.name).join(", ")}`);
    throw new Error(`Suite not found: ${suiteName}`);
  }

  const files = getTestFiles(suite);

  if (files.length === 0) {
    console.log(`No tests found for suite: ${suiteName}`);
    return true;
  }

  const isParallel = options.parallel !== undefined ? options.parallel : !suite.sequential && files.length > 1;
  const numCpus = availableParallelism ? availableParallelism() : cpus().length;
  const defaultConcurrency = resolveDefaultConcurrency(numCpus);
  const concurrency = isParallel ? Math.max(1, options.concurrency || Math.min(files.length, defaultConcurrency)) : 1;
  // Batch mode (v1.16.0, design item 3): unit suite only — non-budgeted files
  // grouped into ~12-file `bun test` invocations; budgeted files (per-file
  // kill budgets + BUDGET-HEADROOM WARN semantics) and all other suites keep
  // one process per file. Sequential mode never batches, and the tail batching
  // itself is OPT-IN (`TEST_RUNNER_BATCH_SIZE=N`, default 0 = disabled — see
  // DEFAULT_BATCH_SIZE for the CI evidence that turned it off).
  const batchingEnabled = suiteName === "unit" && isParallel && resolveBatchSize() > 0;
  // Explicit `--timeout` CLI wins over the per-file overrides (manual runs
  // know what they asked for); otherwise overridden files get their budgets
  // and everything else the suite default + DEFAULT_TEST_TIMEOUT_MS.
  const cliTimeoutMs = options.timeout;
  const resolveBudgets = (file: string): { suite: number; test: number } => {
    if (cliTimeoutMs) return { suite: cliTimeoutMs, test: cliTimeoutMs };
    const override = FILE_TIME_BUDGETS[basename(file)];
    return { suite: override?.suite ?? suite.timeout, test: override?.test ?? DEFAULT_TEST_TIMEOUT_MS };
  };

  const modeStr = isParallel ? `parallel (concurrency: ${concurrency})` : "sequential";
  console.log(`Running ${suiteName} suite (${files.length} test file${files.length === 1 ? "" : "s"}, ${modeStr})...`);

  const startTime = Date.now();
  let results: TestFileResult[] = [];
  const hygieneSnapshot = suiteName === "scripts" ? takeHygieneSnapshot() : null;

  try {
    const execMode = suiteName === "scripts" ? ("bun-script" as const) : ("bun-test" as const);
    if (isParallel && concurrency > 1) {
      try {
        const dispatchOrder = orderLongestFirst(files);
        // v1.16.0 batching: budgeted files stay individual (longest-first);
        // non-budgeted files chunk alphabetically into ~12-file `bun test`
        // batches (design item 3). Jobs preserve the dispatch order.
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
          // Batch kill timer (design §3.3): the sum of member suite budgets,
          // capped at 120s per member — budgeted members never enter batches,
          // so each member's suite budget here is the suite default.
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

        // Report in the original (alphabetical) file order, not dispatch order.
        const byFile = new Map<string, TestFileResult>();
        for (const jobResults of ordered) {
          for (const res of jobResults) byFile.set(res.file, res);
        }
        results = files.map((f) => byFile.get(f)!);
      } catch (err: any) {
        console.warn(
          `[test-runner] Warning: Parallel execution failed (${err.message}). Falling back to sequential execution...`,
        );
        results = [];
        for (let i = 0; i < files.length; i++) {
          const budgets = resolveBudgets(files[i]);
          const res = await executeTestFile(
            files[i],
            budgets.suite,
            execMode === "bun-test" ? budgets.test : null,
            1,
            execMode,
          );
          results.push(res);
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`  Running: ${file}`);
        const budgets = resolveBudgets(file);
        const res = await executeTestFile(
          file,
          budgets.suite,
          execMode === "bun-test" ? budgets.test : null,
          1,
          execMode,
        );
        results.push(res);
      }
    }

    const totalDuration = Date.now() - startTime;
    let hasFailures = false;

    // Post-suite hygiene assertion (scripts suite only): the suite must not
    // modify docs/templates/ nor leave transient fixture dirs behind.
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
      // BUDGET-HEADROOM WARN (v1.8.0, T-20261030-002): slow burn-in against a
      // file's resolved budget is visible in every run log, not just at raise
      // time. WARN only — CI timing variance must not block merges; the raise
      // policy lives in the FILE_TIME_BUDGETS doc block.
      const budgets = resolveBudgets(res.file);
      const headroomPct = Math.round((res.durationMs / budgets.suite) * 100);
      if (headroomPct >= 60) {
        console.log(
          `  ⚠️  BUDGET-HEADROOM: ${basename(res.file)} took ${res.durationMs}ms (${headroomPct}% of its ${budgets.suite}ms suite budget) — a raise requires a ticket with CI-run evidence; 2 raises/quarter triggers a mandatory split/trim review`,
        );
      }
      if (res.success) {
        console.log(`  ✓ ${res.file} (${res.durationMs}ms)`);
      } else {
        hasFailures = true;
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
      return false;
    }

    console.log(`✓ ${suiteName} suite passed (${totalDuration}ms)`);
    return true;
  } catch (error: any) {
    console.error(`✗ Suite execution error: ${error.message}`);
    return false;
  } finally {
    try {
      if (existsSync("tests/.temp")) {
        rmSync("tests/.temp", { recursive: true, force: true });
      }
    } catch (e: any) {
      console.error(`[test-runner] Error during temp dir cleanup: ${e.message || e}`);
    }
  }
}

function parseArgs(args: string[]): { suiteName: string; options: RunOptions } {
  let suiteName = "integration";
  let parallel: boolean | undefined = undefined;
  let concurrency: number | undefined = undefined;
  let timeout: number | undefined = undefined;

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
    } else if (!arg.startsWith("-")) {
      suiteName = arg;
    }
  }

  return { suiteName, options: { parallel, concurrency, timeout } };
}

// CLI entrypoint
if (import.meta.main) {
  const { suiteName, options } = parseArgs(process.argv.slice(2));
  runTests(suiteName, options)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
