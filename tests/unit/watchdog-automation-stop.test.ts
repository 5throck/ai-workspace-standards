/**
 * Unit tests for watchdog-automation-stop.ts (T-20261112-002; ADR-0105 Decision 4,
 * design docs/designs/2026-11-12-unified-batch-runner-design.md §4.5/AC-6):
 * the out-of-process degraded-mode kill-switch. Pins the three safety terms —
 * the stop-file is written, the write is atomic (temp + rename, no residue,
 * readers never see a truncated file), and existing content survives the write
 * (valid records merge; unparseable bytes are archived aside, never destroyed).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeAutomationStop, readAutomationStop, stopFilePresent } from '../../scripts/watchdog-automation-stop.ts';

const dir = mkdtempSync(join(tmpdir(), 'watchdog-stop-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('writeAutomationStop — fresh write', () => {
  test('writes the stop-file with reason/timestamp/pid at the state-dir root', () => {
    const r = writeAutomationStop({ reason: '13:00 KST wall reached', stateDir: dir, pid: 4242 });
    expect(r.ok).toBe(true);
    expect(r.state).toBe('written');
    const record = readAutomationStop(dir);
    expect(record).not.toBeNull();
    expect(record?.reason).toBe('13:00 KST wall reached');
    expect(record?.pid).toBe(4242);
    // timestamp is ISO-8601
    expect(Number.isNaN(Date.parse(record?.timestamp ?? ''))).toBe(false);
  });

  test('presence probe agrees with the file', () => {
    expect(stopFilePresent(dir)).toBe(true);
    expect(stopFilePresent(join(dir, 'missing-subdir'))).toBe(false);
  });

  test('an empty reason is refused (usage error class)', () => {
    expect(() => writeAutomationStop({ reason: '   ', stateDir: dir })).toThrow(/non-empty reason/);
  });
});

describe('writeAutomationStop — atomic rename', () => {
  test('no temp residue remains after the write', () => {
    writeAutomationStop({ reason: 'atomic check', stateDir: dir });
    const residue = readdirSync(dir).filter((f) => f.startsWith('automation-stop.tmp-'));
    expect(residue).toEqual([]);
  });

  test('the file on disk parses as complete JSON after the write (never truncated)', () => {
    writeAutomationStop({ reason: 'completeness probe', stateDir: dir });
    const raw = readFileSync(join(dir, 'automation-stop'), 'utf8');
    const parsed = JSON.parse(raw) as { reason: string; events: unknown[] };
    expect(parsed.reason).toBe('completeness probe');
    expect(Array.isArray(parsed.events)).toBe(true);
  });
});

describe('writeAutomationStop — preserves existing content', () => {
  const mergeDir = join(dir, 'merge');
  test('a second write keeps the first event and refreshes the top-level fields', () => {
    mkdirSync(mergeDir, { recursive: true });
    writeAutomationStop({ reason: 'first stop', stateDir: mergeDir, pid: 111, now: new Date('2026-11-12T04:00:00.000Z') });
    writeAutomationStop({ reason: 'second stop', stateDir: mergeDir, pid: 222, now: new Date('2026-11-12T04:05:00.000Z') });
    const record = readAutomationStop(mergeDir);
    expect(record?.reason).toBe('second stop');
    expect(record?.pid).toBe(222);
    expect(record?.events.map((e) => e.reason)).toEqual(['second stop', 'first stop']);
    expect(record?.events[1]?.pid).toBe(111);
  });

  test('a pre-existing first-generation flat record is carried into the event history', () => {
    const legacyDir = join(dir, 'legacy');
    mkdirSync(legacyDir, { recursive: true });
    writeFileSync(
      join(legacyDir, 'automation-stop'),
      JSON.stringify({ reason: 'legacy flat record', timestamp: '2026-11-11T13:00:00.000Z', pid: 99 }) + '\n',
      'utf8',
    );
    writeAutomationStop({ reason: 'new signal', stateDir: legacyDir });
    const record = readAutomationStop(legacyDir);
    expect(record?.reason).toBe('new signal');
    expect(record?.events.map((e) => e.reason)).toEqual(['new signal', 'legacy flat record']);
  });

  test('unparseable existing content is archived aside, never destroyed', () => {
    const corruptDir = join(dir, 'corrupt');
    mkdirSync(corruptDir, { recursive: true });
    const corruptBytes = '{"reason": "torn write", "timestamp": "2026-11-12T13:00';
    writeFileSync(join(corruptDir, 'automation-stop'), corruptBytes, 'utf8');
    const r = writeAutomationStop({ reason: 'fresh stop over corruption', stateDir: corruptDir });
    expect(r.ok).toBe(true);
    expect(r.state).toBe('corrupt-archived');
    // the corrupt bytes still exist under the archive name
    const archives = readdirSync(corruptDir).filter((f) => f.startsWith('automation-stop.corrupt-'));
    expect(archives.length).toBe(1);
    expect(readFileSync(join(corruptDir, archives[0] ?? ''), 'utf8')).toBe(corruptBytes);
    // and the live file carries the fresh record
    expect(readAutomationStop(corruptDir)?.reason).toBe('fresh stop over corruption');
  });

  test('an EMPTY existing stop-file is simply replaced (nothing to preserve)', () => {
    const emptyDir = join(dir, 'empty');
    mkdirSync(emptyDir, { recursive: true });
    writeFileSync(join(emptyDir, 'automation-stop'), '', 'utf8');
    const r = writeAutomationStop({ reason: 'after empty', stateDir: emptyDir });
    expect(r.state).toBe('written');
    expect(readAutomationStop(emptyDir)?.reason).toBe('after empty');
  });

  test('event history is capped at 50 entries', () => {
    const capDir = join(dir, 'cap');
    for (let i = 0; i < 55; i++) {
      writeAutomationStop({ reason: `event ${i}`, stateDir: capDir });
    }
    const record = readAutomationStop(capDir);
    expect(record?.events.length).toBe(50);
    expect(record?.events[0]?.reason).toBe('event 54');
  });
});
