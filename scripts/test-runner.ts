/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.7.0
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
import { readdirSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import { availableParallelism, cpus } from 'os';
import { isTransientTestFixture } from './helpers/scaffold-markers.ts';

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
  { name: 'unit', pattern: '*.test.ts', timeout: 120000, dir: 'tests/unit', ext: '.test.ts' },
  { name: 'integration', pattern: '*.test.ts', timeout: 120000, dir: 'tests', ext: '.test.ts' },
  { name: 'scenarios', pattern: '*', timeout: 300000, dir: 'tests/scenarios', ext: '' },
  // sequential: members stage transient fixture dirs under the real templates/
  // tree (test-l3promo-*, co-e2eguard-*, co-e2p2*) and race concurrent
  // validators when run in parallel — T-20260916-001.
  { name: 'scripts', pattern: 'test-*.ts', timeout: 120000, dir: 'scripts', ext: '.ts', sequential: true }
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
 * 38412124373). Headroom ≈2.5x suite / ≥2x test over the observed win32 max. */
const FILE_TIME_BUDGETS: Record<string, { suite: number; test: number }> = {
  'mcp-upstream-server.test.ts': { suite: 300000, test: 30000 },
  'upgrade-tree-sync.test.ts': { suite: 300000, test: 60000 },
  'upgrade-decision-log.test.ts': { suite: 600000, test: 60000 },
};

function getTestFiles(suite: TestSuite): string[] {
  const files: string[] = [];
  try {
    if (!existsSync(suite.dir)) return files;
    const entries = readdirSync(suite.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const matchesExt = suite.ext === '' || entry.name.endsWith(suite.ext);
      const matchesPattern = suite.name !== 'scripts' || (entry.name.startsWith('test-') && entry.name !== 'test-runner.ts');
      if (matchesExt && matchesPattern) {
        files.push(join(suite.dir, entry.name));
      }
    }
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
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
  execMode: 'bun-test' | 'bun-script' = 'bun-test'
): Promise<TestFileResult> {
  const startTime = Date.now();
  const workerTempDir = join('tests', '.temp', `worker-${workerId}`);

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
    const argv = execMode === 'bun-script'
      ? [process.execPath, file]
      : [process.execPath, 'test', '--timeout', String(bunTestTimeoutMs), file];
    proc = Bun.spawn(argv, {
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // stdout/stderr are 'pipe', so at runtime they are ReadableStreams (never fd numbers).
    const stdoutPromise = proc.stdout ? new Response(proc.stdout as ReadableStream<Uint8Array>).text() : Promise.resolve('');
    const stderrPromise = proc.stderr ? new Response(proc.stderr as ReadableStream<Uint8Array>).text() : Promise.resolve('');

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

    const execPromise = Promise.all([stdoutPromise, stderrPromise, proc.exited]).then(
      ([stdout, stderr, exitCode]) => ({
        timedOut: false,
        stdout,
        stderr,
        exitCode,
      })
    );

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
      stdout: '',
      stderr: '',
      exitCode: null,
      timedOut: false,
      error: err.message,
    };
  }
}

async function runInParallel<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number, workerId: number) => Promise<R>
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
    const proc = Bun.spawnSync(['git', 'status', '--porcelain', '--', 'docs/templates'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode === 0) {
      snap.gitAvailable = true;
      const out = new TextDecoder().decode(proc.stdout ?? new Uint8Array());
      for (const line of out.split('\n')) {
        const entry = line.trim();
        if (entry) snap.dirtyDocsTemplates.add(entry.replace(/^\S+\s+/, ''));
      }
    }
  } catch { /* no git — hygiene check will be skipped with a note */ }
  try {
    if (existsSync('templates')) {
      for (const entry of readdirSync('templates', { withFileTypes: true })) {
        if (entry.isDirectory() && isTransientTestFixture(entry.name)) snap.fixtureDirs.add(entry.name);
      }
    }
  } catch { /* unreadable templates/ — post-run scan reports what it can */ }
  return snap;
}

/**
 * Verify the suite added no pollution: no NEW modifications under
 * docs/templates/ and no NEW transient fixture dirs under templates/.
 * Returns a list of human-readable violations (empty = clean).
 */
function verifyHygiene(snap: HygieneSnapshot): string[] {
  if (!snap.gitAvailable && !existsSync('templates')) {
    return ['hygiene check skipped: no git checkout and no templates/ directory'];
  }
  const violations: string[] = [];

  if (snap.gitAvailable) {
    const proc = Bun.spawnSync(['git', 'status', '--porcelain', '--', 'docs/templates'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const out = proc.exitCode === 0 ? new TextDecoder().decode(proc.stdout ?? new Uint8Array()) : '';
    for (const line of out.split('\n')) {
      const entry = line.trim();
      if (!entry) continue;
      const path = entry.replace(/^\S+\s+/, '');
      if (!snap.dirtyDocsTemplates.has(path)) {
        violations.push(`docs/templates/ modified during suite: ${path} (${entry.split(/\s+/)[0]})`);
      }
    }
  }

  if (existsSync('templates')) {
    try {
      for (const entry of readdirSync('templates', { withFileTypes: true })) {
        if (entry.isDirectory() && isTransientTestFixture(entry.name) && !snap.fixtureDirs.has(entry.name)) {
          violations.push(`transient test fixture left behind: templates/${entry.name}/ (E2E cleanup failed or crashed mid-run)`);
        }
      }
    } catch { /* handled above */ }
  }

  return violations;
}

export async function runTests(
  suiteName: string = 'integration',
  options: RunOptions = {}
): Promise<boolean> {
  const suite = suites.find(s => s.name === suiteName);
  if (!suite) {
    console.error(`Available suites: ${suites.map(s => s.name).join(', ')}`);
    throw new Error(`Suite not found: ${suiteName}`);
  }

  const files = getTestFiles(suite);

  if (files.length === 0) {
    console.log(`No tests found for suite: ${suiteName}`);
    return true;
  }

  const isParallel = options.parallel !== undefined
    ? options.parallel
    : (!suite.sequential && files.length > 1);
  const numCpus = availableParallelism ? availableParallelism() : cpus().length;
  const defaultConcurrency = Math.min(numCpus, 4);
  const concurrency = isParallel
    ? Math.max(1, options.concurrency || Math.min(files.length, defaultConcurrency))
    : 1;
  // Explicit `--timeout` CLI wins over the per-file overrides (manual runs
  // know what they asked for); otherwise overridden files get their budgets
  // and everything else the suite default + DEFAULT_TEST_TIMEOUT_MS.
  const cliTimeoutMs = options.timeout;
  const resolveBudgets = (file: string): { suite: number; test: number } => {
    if (cliTimeoutMs) return { suite: cliTimeoutMs, test: cliTimeoutMs };
    const override = FILE_TIME_BUDGETS[basename(file)];
    return { suite: override?.suite ?? suite.timeout, test: override?.test ?? DEFAULT_TEST_TIMEOUT_MS };
  };

  const modeStr = isParallel ? `parallel (concurrency: ${concurrency})` : 'sequential';
  console.log(`Running ${suiteName} suite (${files.length} test file${files.length === 1 ? '' : 's'}, ${modeStr})...`);

  const startTime = Date.now();
  let results: TestFileResult[] = [];
  const hygieneSnapshot = suiteName === 'scripts' ? takeHygieneSnapshot() : null;

  try {
    const execMode = suiteName === 'scripts' ? 'bun-script' as const : 'bun-test' as const;
    if (isParallel && concurrency > 1) {
      try {
        results = await runInParallel(files, concurrency, (file, _, workerId) => {
          const budgets = resolveBudgets(file);
          return executeTestFile(file, budgets.suite, execMode === 'bun-test' ? budgets.test : null, workerId, execMode);
        });
      } catch (err: any) {
        console.warn(`[test-runner] Warning: Parallel execution failed (${err.message}). Falling back to sequential execution...`);
        results = [];
        for (let i = 0; i < files.length; i++) {
          const budgets = resolveBudgets(files[i]);
          const res = await executeTestFile(files[i], budgets.suite, execMode === 'bun-test' ? budgets.test : null, 1, execMode);
          results.push(res);
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`  Running: ${file}`);
        const budgets = resolveBudgets(file);
        const res = await executeTestFile(file, budgets.suite, execMode === 'bun-test' ? budgets.test : null, 1, execMode);
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
      if (res.success) {
        console.log(`  ✓ ${res.file} (${res.durationMs}ms)`);
      } else {
        hasFailures = true;
        console.error(`\n================================================================================`);
        console.error(`FAIL: ${res.file}`);
        console.error(`--------------------------------------------------------------------------------`);
        console.error(`Status: ${res.timedOut ? `TIMEOUT (${resolveBudgets(res.file).suite}ms)` : `FAILED (exit code ${res.exitCode})`}`);
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
      const failedCount = results.filter(r => !r.success).length;
      console.error(`✗ ${suiteName} suite failed (${failedCount} of ${files.length} test files failed, total ${totalDuration}ms)`);
      return false;
    }

    console.log(`✓ ${suiteName} suite passed (${totalDuration}ms)`);
    return true;
  } catch (error: any) {
    console.error(`✗ Suite execution error: ${error.message}`);
    return false;
  } finally {
    try {
      if (existsSync('tests/.temp')) {
        rmSync('tests/.temp', { recursive: true, force: true });
      }
    } catch (e: any) {
      console.error(`[test-runner] Error during temp dir cleanup: ${e.message || e}`);
    }
  }
}

function parseArgs(args: string[]): { suiteName: string; options: RunOptions } {
  let suiteName = 'integration';
  let parallel: boolean | undefined = undefined;
  let concurrency: number | undefined = undefined;
  let timeout: number | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--parallel') {
      parallel = true;
    } else if (arg === '--sequential') {
      parallel = false;
    } else if (arg === '--concurrency' || arg === '-c') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val) && val > 0) concurrency = val;
    } else if (arg === '--timeout' || arg === '-t') {
      const val = parseInt(args[++i], 10);
      if (!isNaN(val) && val > 0) timeout = val;
    } else if (!arg.startsWith('-')) {
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
