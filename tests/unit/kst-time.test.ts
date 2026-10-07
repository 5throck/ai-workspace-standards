import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { kstDate, kstIso } from '../../scripts/helpers/kst-time.ts';
import { nextServiceTicket } from '../../scripts/helpers/ticket-store.ts';

describe('kstDate / kstIso', () => {
  test('21:30Z on 2026-10-07 is 06:30 KST on 2026-10-08', () => {
    const d = new Date('2026-10-07T21:30:00Z');
    expect(kstDate(d)).toBe('2026-10-08');
    expect(kstIso(d)).toBe('2026-10-08T06:30:00.000+09:00');
  });

  test('14:59:59Z on 2026-10-07 is still 23:59:59 KST on 2026-10-07', () => {
    const d = new Date('2026-10-07T14:59:59Z');
    expect(kstDate(d)).toBe('2026-10-07');
    expect(kstIso(d)).toBe('2026-10-07T23:59:59.000+09:00');
  });

  test('kstIso keeps milliseconds and names the same instant as the input', () => {
    const d = new Date('2026-10-08T01:02:03.456Z');
    const iso = kstIso(d);
    expect(iso).toBe('2026-10-08T10:02:03.456+09:00');
    expect(Date.parse(iso)).toBe(d.getTime());
  });
});

describe('nextServiceTicket orders mixed Z and +09:00 created_at by instant', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'kst-time-test-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeWaitingService(id: string, createdAt: string): void {
    writeFileSync(join(dir, `${id}.yaml`), [
      'schemaVersion: 1', `id: ${id}`, 'kind: service', 'service: audit', 'priority: normal',
      'status: waiting', 'attempts: 0', `created_at: "${createdAt}"`,
      'history:', `  - at: "${createdAt}"`, '    from: null', '    to: waiting', 'result: null', 'error: null', '',
    ].join('\n'));
  }

  test('picks the earlier instant even when its string sorts later', () => {
    // 2026-10-08T06:30+09:00 == 2026-10-07T21:30Z, which is EARLIER than 22:00Z.
    // A lexical compare would rank "2026-10-08..." after "2026-10-07T22..." and pick the wrong ticket.
    writeWaitingService('T-20261008-001', '2026-10-08T06:30:00.000+09:00');
    writeWaitingService('T-20261007-001', '2026-10-07T22:00:00.000Z');
    expect(nextServiceTicket(dir)?.id).toBe('T-20261008-001');
  });
});
