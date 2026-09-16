/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.4.0
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
import { join } from 'path';
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
    const argv = execMode === 'bun-script' ? [process.execPath, file] : [process.execPath, 'test', file];
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
  const timeoutMs = options.timeout || suite.timeout;

  const modeStr = isParallel ? `parallel (concurrency: ${concurrency})` : 'sequential';
  console.log(`Running ${suiteName} suite (${files.length} test file${files.length === 1 ? '' : 's'}, ${modeStr})...`);

  const startTime = Date.now();
  let results: TestFileResult[] = [];
  const hygieneSnapshot = suiteName === 'scripts' ? takeHygieneSnapshot() : null;

  try {
    const execMode = suiteName === 'scripts' ? 'bun-script' as const : 'bun-test' as const;
    if (isParallel && concurrency > 1) {
      try {
        results = await runInParallel(files, concurrency, (file, _, workerId) =>
          executeTestFile(file, timeoutMs, workerId, execMode)
        );
      } catch (err: any) {
        console.warn(`[test-runner] Warning: Parallel execution failed (${err.message}). Falling back to sequential execution...`);
        results = [];
        for (let i = 0; i < files.length; i++) {
          const res = await executeTestFile(files[i], timeoutMs, 1, execMode);
          results.push(res);
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`  Running: ${file}`);
        const res = await executeTestFile(file, timeoutMs, 1, execMode);
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
        console.error(`Status: ${res.timedOut ? `TIMEOUT (${timeoutMs}ms)` : `FAILED (exit code ${res.exitCode})`}`);
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
