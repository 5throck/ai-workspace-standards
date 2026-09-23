/**
 * Unit tests for scripts/lib/pipeline-state.ts v1.2.0 generalization.
 *
 * Covers the adopt-project engine prerequisites: injectable state file
 * (setStateFile), string phase names, and snapshot-backed undo
 * (addRollbackActionWithBackup + modify_file/delete_file/move_file restore).
 * Runs the real module in-process — v1.2.0's setStateFile removes the need
 * for the subprocess-cwd isolation the v1.1 tests require.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'pipeline-state-adopt-test');
const stateModulePath = path.resolve(import.meta.dir, '..', '..', 'scripts', 'lib', 'pipeline-state.ts');

let stateFile: string;

function freshStateFile(): string {
  return path.join(scratchRoot, `state-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

afterEach(() => {
  fs.rmSync(scratchRoot, { recursive: true, force: true });
});

describe('pipeline-state v1.2.0 adopt generalization', () => {
  test('setStateFile redirects state persistence away from the cwd default', async () => {
    const mod = await import(stateModulePath);
    stateFile = freshStateFile();
    mod.setStateFile(stateFile);

    const state = mod.initializeState('adopt-unit-test', '/tmp/project', 'adopt_settling');

    expect(fs.existsSync(stateFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(stateFile, 'utf8')).variantName).toBe('adopt-unit-test');
    // string phase names are accepted (not welded to the ErrorPhase enum)
    expect(state.currentPhase).toBe('adopt_settling');
    mod.resetStateFile();
  });

  test('modify_file rollback restores the pre-destruction snapshot', async () => {
    const mod = await import(stateModulePath);
    stateFile = freshStateFile();
    mod.setStateFile(stateFile);
    mod.initializeState('adopt-undo-test');

    const target = path.join(scratchRoot, 'modified.txt');
    fs.mkdirSync(scratchRoot, { recursive: true });
    fs.writeFileSync(target, 'original-content');

    mod.addRollbackActionWithBackup('adopt_settling', 'modify_file', target);
    fs.writeFileSync(target, 'rewritten-by-adopt');

    const ok = await mod.executeRollback();
    expect(ok).toBe(true);
    expect(fs.readFileSync(target, 'utf8')).toBe('original-content');
    mod.resetStateFile();
  });

  test('delete_file and move_file rollbacks restore backed-up content at the target path', async () => {
    const mod = await import(stateModulePath);
    stateFile = freshStateFile();
    mod.setStateFile(stateFile);
    mod.initializeState('adopt-move-test');

    const original = path.join(scratchRoot, 'legacy.sh');
    fs.mkdirSync(scratchRoot, { recursive: true });
    fs.writeFileSync(original, '#!/bin/sh\necho legacy\n');

    // Simulate adopt's relocation: snapshot, then move the file away.
    mod.addRollbackActionWithBackup('adopt_relocation', 'move_file', original);
    fs.rmSync(original, { force: true });
    expect(fs.existsSync(original)).toBe(false);

    const ok = await mod.executeRollback();
    expect(ok).toBe(true);
    expect(fs.readFileSync(original, 'utf8')).toBe('#!/bin/sh\necho legacy\n');
    mod.resetStateFile();
  });

  test('unbacked modify_file rollback still warns instead of throwing (v1.1 behavior)', async () => {
    const mod = await import(stateModulePath);
    stateFile = freshStateFile();
    mod.setStateFile(stateFile);
    mod.initializeState('adopt-nobackup-test');

    const target = path.join(scratchRoot, 'unbacked.txt');
    fs.mkdirSync(scratchRoot, { recursive: true });
    fs.writeFileSync(target, 'current');
    mod.addRollbackAction('adopt_settling', 'modify_file', target);
    fs.writeFileSync(target, 'changed');

    const ok = await mod.executeRollback();
    expect(ok).toBe(true); // warns, but does not fail the rollback pass
    expect(fs.readFileSync(target, 'utf8')).toBe('changed'); // content untouched
    mod.resetStateFile();
  });
});
