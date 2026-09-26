/**
 * Unit tests for automation-lock.ts (T-20260926-021, design D1): file-based
 * exclusivity locks for the unattended local runners — acquire while a live
 * same-host holder exists must fail; dead-pid / foreign-host / corrupt
 * records are breakable with --break-stale.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hostname } from 'node:os';
import { acquireLock, releaseLock, lockStatus, readLock, pidAlive } from '../../scripts/automation-lock.ts';

const dir = mkdtempSync(join(tmpdir(), 'automation-lock-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A pid that is DEFINITELY dead: spawn a child, wait for it, use its pid. */
function deadPid(): number {
  const child = spawnSync('true');
  return child.pid ?? -1;
}

describe('pidAlive', () => {
  test('own pid is alive', () => expect(pidAlive(process.pid)).toBe(true));
  test('an exited child pid is dead', () => expect(pidAlive(deadPid())).toBe(false));
});

describe('acquireLock — fresh, held, stale, foreign, corrupt', () => {
  test('fresh acquire succeeds; the record carries pid/hostname/name', () => {
    const r = acquireLock('test-batch', { stateDir: dir });
    expect(r.ok).toBe(true);
    const record = readLock('test-batch', { stateDir: dir });
    expect(record?.pid).toBe(process.pid);
    expect(record?.name).toBe('test-batch');
  });

  test('second acquire fails while OUR live process holds it', () => {
    const r = acquireLock('test-batch', { stateDir: dir });
    expect(r.ok).toBe(false);
    expect((r as { state: string }).state).toBe('held-live');
  });

  test('release clears it; releasing a missing lock is a no-op success', () => {
    const r = releaseLock('test-batch', { stateDir: dir });
    expect(r.ok).toBe(true);
    expect(releaseLock('test-batch', { stateDir: dir }).ok).toBe(true);
    expect(acquireLock('test-batch', { stateDir: dir }).ok).toBe(true);
    releaseLock('test-batch', { stateDir: dir });
  });

  test('a dead-pid record is refused without --break-stale and acquired with it', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'automation-test-stale.lock'), JSON.stringify({ name: 'test-stale', pid: deadPid(), hostname: hostname(), acquiredAt: '2026-09-26T00:00:00Z' }));
    const refused = acquireLock('test-stale', { stateDir: dir });
    expect(refused.ok).toBe(false);
    expect((refused as { state: string }).state).toBe('stale');
    const broken = acquireLock('test-stale', { stateDir: dir, breakStale: true });
    expect(broken.ok).toBe(true);
    releaseLock('test-stale', { stateDir: dir });
  });

  test('a foreign-host record is treated as stale (single-operator non-goal D4)', () => {
    writeFileSync(join(dir, 'automation-test-foreign.lock'), JSON.stringify({ name: 'test-foreign', pid: 1, hostname: 'some-other-box', acquiredAt: '2026-09-26T00:00:00Z' }));
    const refused = acquireLock('test-foreign', { stateDir: dir });
    expect((refused as { state: string }).state).toBe('foreign');
    const broken = acquireLock('test-foreign', { stateDir: dir, breakStale: true });
    expect(broken.ok).toBe(true);
    releaseLock('test-foreign', { stateDir: dir });
  });

  test('a corrupt record is refused, then breakable', () => {
    writeFileSync(join(dir, 'automation-test-corrupt.lock'), '{not json');
    const refused = acquireLock('test-corrupt', { stateDir: dir });
    expect((refused as { state: string }).state).toBe('corrupt');
    expect(acquireLock('test-corrupt', { stateDir: dir, breakStale: true }).ok).toBe(true);
    releaseLock('test-corrupt', { stateDir: dir });
  });

  test('status reports free vs held', () => {
    expect(lockStatus('test-status', { stateDir: dir }).state).toBe('free');
    acquireLock('test-status', { stateDir: dir });
    expect(lockStatus('test-status', { stateDir: dir }).state).toBe('held');
    releaseLock('test-status', { stateDir: dir });
  });
});
