/**
 * Unit tests for scripts/lib/pipeline-state.ts executeRollback().
 *
 * Regression coverage (project review 2026-09-10): executeRollbackAction()
 * used Bun Shell (`await $`rm -f ${target}`.quiet()`) without importing `$`
 * from 'bun', so every rollback execution threw ReferenceError at runtime.
 * The fix replaced the shell calls with fs.rmSync equivalents; these tests
 * run the real module in a subprocess with a temp cwd — STATE_DIR is derived
 * from process.cwd() at import time, so the subprocess isolates both the
 * state file and the rollback targets from the repo checkout.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'pipeline-state-rollback-test');
const PIPELINE_STATE_MODULE = path.resolve(import.meta.dir, '..', '..', 'scripts', 'lib', 'pipeline-state.ts');

interface RollbackScenarioResult {
  ok: boolean;
  status: string | null;
  cleared: boolean;
}

function runRollbackScenario(): RollbackScenarioResult {
  const scenarioDir = path.join(scratchRoot, 'scenario');
  const targetFile = path.join(scenarioDir, 'created.txt');
  const targetDir = path.join(scenarioDir, 'created-dir', 'nested');
  const copyFile = path.join(scenarioDir, 'copied.txt');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(targetFile, 'created-by-pipeline');
  fs.writeFileSync(copyFile, 'copied-by-pipeline');

  const script = `
    const mod = await import(${JSON.stringify(PIPELINE_STATE_MODULE)});
    mod.initializeState('rollback-unit-test');
    mod.addRollbackAction('variant_generation', 'create_file', ${JSON.stringify(targetFile)});
    mod.addRollbackAction('variant_generation', 'create_directory', ${JSON.stringify(path.join(scenarioDir, 'created-dir'))});
    mod.addRollbackAction('variant_generation', 'copy_file', ${JSON.stringify(copyFile)});
    const ok = await mod.executeRollback();
    const status = mod.loadState()?.status ?? null;
    console.log('ROLLBACK_RESULT=' + JSON.stringify({ ok, status }));
    await mod.clearState();
    console.log('STATE_CLEARED=' + (mod.loadState() === null));
  `;

  const proc = Bun.spawnSync({
    cmd: [process.execPath, '-e', script],
    cwd: scratchRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  if (proc.exitCode !== 0) {
    throw new Error(
      `rollback scenario subprocess failed (exit ${proc.exitCode}):\n${proc.stderr.toString()}`
    );
  }

  const stdout = proc.stdout.toString();
  const resultMatch = stdout.match(/ROLLBACK_RESULT=(\{.*\})/);
  if (!resultMatch) {
    throw new Error(`rollback scenario produced no result line:\n${stdout}`);
  }
  const parsed = JSON.parse(resultMatch[1]) as { ok: boolean; status: string | null };
  return {
    ok: parsed.ok,
    status: parsed.status,
    cleared: stdout.includes('STATE_CLEARED=true'),
  };
}

describe('pipeline-state executeRollback', () => {
  afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

  test('deletes create_file / create_directory / copy_file targets without shell errors', () => {
    const result = runRollbackScenario();

    expect(result.ok).toBe(true);
    expect(result.status).toBe('rolled_back');
    expect(result.cleared).toBe(true);
    expect(fs.existsSync(path.join(scratchRoot, 'scenario', 'created.txt'))).toBe(false);
    expect(fs.existsSync(path.join(scratchRoot, 'scenario', 'created-dir'))).toBe(false);
    expect(fs.existsSync(path.join(scratchRoot, 'scenario', 'copied.txt'))).toBe(false);
  });

  test('rollback of missing targets succeeds (rm -f semantics preserved)', () => {
    // Second run against the same scratch layout: the first test's cleanup
    // already proved deletion; here the targets never exist, and force-flagged
    // fs.rmSync must treat them as missing-ok exactly like `rm -f` did.
    const scenarioDir = path.join(scratchRoot, 'scenario');
    fs.mkdirSync(scenarioDir, { recursive: true });

    const script = `
      const mod = await import(${JSON.stringify(PIPELINE_STATE_MODULE)});
      mod.initializeState('rollback-unit-test');
      mod.addRollbackAction('variant_generation', 'create_file', ${JSON.stringify(path.join(scenarioDir, 'never-created.txt'))});
      mod.addRollbackAction('variant_generation', 'create_directory', ${JSON.stringify(path.join(scenarioDir, 'never-created-dir'))});
      const ok = await mod.executeRollback();
      console.log('ROLLBACK_RESULT=' + JSON.stringify({ ok }));
    `;

    const proc = Bun.spawnSync({
      cmd: [process.execPath, '-e', script],
      cwd: scratchRoot,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(proc.exitCode).toBe(0);
    expect(proc.stdout.toString()).toContain('"ok":true');
  });
});
