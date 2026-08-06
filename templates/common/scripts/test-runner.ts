/**
 * test-runner.ts — Test Runner for TypeScript Test Suites
 * @version 1.1.0
 */
import { readdirSync, existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { availableParallelism, cpus } from 'os';

interface TestSuite {
  name: string;
  pattern: string;
  timeout: number;
  dir: string;
  ext: string;
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
  { name: 'unit', pattern: '*.test.ts', timeout: 30000, dir: 'tests/unit', ext: '.test.ts' },
  { name: 'integration', pattern: '*.test.ts', timeout: 120000, dir: 'tests', ext: '.test.ts' },
  { name: 'scenarios', pattern: '*', timeout: 300000, dir: 'tests/scenarios', ext: '' },
  { name: 'scripts', pattern: 'test-*.ts', timeout: 120000, dir: 'scripts', ext: '.ts' }
];

function getTestFiles(suite: TestSuite): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(suite.dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const matchesExt = suite.ext === '' || entry.name.endsWith(suite.ext);
      const matchesPattern = suite.name !== 'scripts' || entry.name.startsWith('test-');
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
  workerId: number
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
    proc = Bun.spawn([process.execPath, 'test', file], {
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdoutPromise = proc.stdout ? new Response(proc.stdout).text() : Promise.resolve('');
    const stderrPromise = proc.stderr ? new Response(proc.stderr).text() : Promise.resolve('');

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

  const isParallel = options.parallel !== undefined ? options.parallel : files.length > 1;
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

  try {
    if (isParallel && concurrency > 1) {
      try {
        results = await runInParallel(files, concurrency, (file, _, workerId) =>
          executeTestFile(file, timeoutMs, workerId)
        );
      } catch (err: any) {
        console.warn(`[test-runner] Warning: Parallel execution failed (${err.message}). Falling back to sequential execution...`);
        results = [];
        for (let i = 0; i < files.length; i++) {
          const res = await executeTestFile(files[i], timeoutMs, 1);
          results.push(res);
        }
      }
    } else {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`  Running: ${file}`);
        const res = await executeTestFile(file, timeoutMs, 1);
        results.push(res);
      }
    }

    const totalDuration = Date.now() - startTime;
    let hasFailures = false;

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
