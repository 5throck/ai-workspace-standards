import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { driftCheck } from '../../scripts/helpers/ticket-drift.ts';

/** Root-level ticket id that lives in a store, cited from memory —
 * resolveTicketLocation checks file existence (live store + archive), so the
 * fixture only needs the .yaml present, not schema-valid content. */
let root: string;
let memoryDir: string;
let serviceDir: string;
let governanceDir: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'ticket-drift-test-'));
  memoryDir = join(root, 'memory');
  serviceDir = join(root, 'tickets');
  governanceDir = join(root, 'tickets', 'governance');
  mkdirSync(memoryDir, { recursive: true });
  mkdirSync(serviceDir, { recursive: true });
  mkdirSync(governanceDir, { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeTicket(dir: string, id: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}.yaml`), `id: ${id}\n`);
}

function writeMemory(name: string, lines: string[]): string {
  const path = join(memoryDir, name);
  writeFileSync(path, lines.join('\n') + '\n', 'utf-8');
  return path;
}

describe('driftCheck (v1.0.0, T-20261104-004 item 3 — project-loss-hardening design §5.3b)', () => {
  test('cited ids resolving in the live service store are not findings', async () => {
    writeTicket(serviceDir, 'T-20261105-001');
    writeMemory('2026-11-05.md', [
      '# Session log',
      'filed: T-20261105-001',
    ]);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toEqual([]);
  });

  test('cited ids resolving in the governance store (T- and U- forms) are not findings', async () => {
    writeTicket(governanceDir, 'T-20261105-002');
    writeTicket(governanceDir, 'U-20261105-003');
    writeMemory('2026-11-05.md', [
      'manual ticket: T-20261105-002',
      'upstream request: U-20261105-003',
    ]);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(2);
    expect(report.unresolved).toEqual([]);
  });

  test('cited ids resolving only in an archive are not findings', async () => {
    // Archived tickets leave the live store but keep resolving
    // (resolveTicketLocation falls back to <store>/archive).
    writeTicket(join(serviceDir, 'archive'), 'T-20261028-013');
    writeMemory('2026-11-05.md', ['archived: T-20261028-013']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toEqual([]);
  });

  test('a cited id resolving NOWHERE is a finding with id + file + line', async () => {
    // The original T-20261104-004 vanish shape: id cited in memory, gone from
    // every store and archive.
    writeTicket(serviceDir, 'T-20261105-009');
    const path = writeMemory('2026-11-04.md', [
      '# Morning session',
      'resolves fine: T-20261105-009',
      'ticket filed: T-20261104-999 — vanished',
    ]);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(2);
    expect(report.unresolved).toHaveLength(1);
    expect(report.unresolved[0].id).toBe('T-20261104-999');
    expect(report.unresolved[0].file).toBe(path);
    expect(report.unresolved[0].line).toBe(3);
  });

  test('repeated citations of the same id are deduplicated to the first sighting', async () => {
    writeMemory('2026-11-04.md', [
      'first: T-20261104-555',
      'second: T-20261104-555',
    ]);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toHaveLength(1);
    expect(report.unresolved[0].line).toBe(1);
  });

  test('memory files without citations and an absent memoryDir are no-ops', async () => {
    writeMemory('2026-11-05.md', ['no ticket ids in this file at all']);
    const withMemory = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(withMemory).toEqual({ cited: 0, unresolved: [] });

    const absent = await driftCheck({
      memoryDir: join(root, 'does-not-exist'),
      serviceDir,
      governanceDir,
    });
    expect(absent).toEqual({ cited: 0, unresolved: [] });
  });

  test('4-digit seq ids match the citation pattern', async () => {
    writeTicket(serviceDir, 'T-20261105-1000');
    writeMemory('2026-11-05.md', ['four digits: T-20261105-1000']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toEqual([]);
  });
});
