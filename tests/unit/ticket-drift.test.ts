import { test, expect, describe, beforeEach, afterEach, spyOn } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { driftCheck, reportDriftFindings, type DriftReport } from '../../scripts/helpers/ticket-drift.ts';

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
    expect(withMemory).toEqual({ cited: 0, unresolved: [], ambiguous: [] });

    const absent = await driftCheck({
      memoryDir: join(root, 'does-not-exist'),
      serviceDir,
      governanceDir,
    });
    expect(absent).toEqual({ cited: 0, unresolved: [], ambiguous: [] });
  });

  test('4-digit seq ids match the citation pattern', async () => {
    writeTicket(serviceDir, 'T-20261105-1000');
    writeMemory('2026-11-05.md', ['four digits: T-20261105-1000']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toEqual([]);
  });
});

// v1.1.0 (T-20261127-001a, spec docs/designs/2026-11-27-ticket-store-drift-and-nextid-design.md
// §3.2): a cited id resolving in MULTIPLE stores is AMBIGUITY (provenance problem — the
// ticket exists, twice), NOT a silent loss. The 2026-11-26 incident: 7 ids flagged as
// "resolve in NO store or archive" whose true condition was cross-store duplication,
// FATALing every sync with a misleading diagnostic.
describe('driftCheck AMBIGUOUS arm (v1.1.0, T-20261127-001a)', () => {
  test('an id double-resident in BOTH stores is an ambiguous finding naming both paths, NOT unresolved', async () => {
    // The observed incident shape: T-20261126-001 in the tracked governance store AND
    // the gitignored local service store, cited from memory.
    writeTicket(governanceDir, 'T-20261126-001');
    writeTicket(serviceDir, 'T-20261126-001');
    writeMemory('2026-11-26.md', ['merge concluded: T-20261126-001']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(1);
    expect(report.unresolved).toEqual([]);
    expect(report.ambiguous).toHaveLength(1);
    const a = report.ambiguous[0];
    expect(a.id).toBe('T-20261126-001');
    expect(a.scope).toBe('stores');
    expect(a.locations).toEqual([join(governanceDir, 'T-20261126-001.yaml'), join(serviceDir, 'T-20261126-001.yaml')]);
    expect(a.file.endsWith('2026-11-26.md')).toBe(true);
    expect(a.line).toBe(1);
  });

  test('an id double-resident in BOTH archives reports scope "archives"', async () => {
    writeTicket(join(serviceDir, 'archive'), 'U-20261120-004');
    writeTicket(join(governanceDir, 'archive'), 'U-20261120-004');
    writeMemory('2026-11-26.md', ['upstream: U-20261120-004']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.unresolved).toEqual([]);
    expect(report.ambiguous).toHaveLength(1);
    expect(report.ambiguous[0].scope).toBe('archives');
    expect(report.ambiguous[0].locations).toEqual([
      join(governanceDir, 'archive', 'U-20261120-004.yaml'),
      join(serviceDir, 'archive', 'U-20261120-004.yaml'),
    ]);
  });

  test('mixed report: ambiguous ids stay out of the unresolved (fatal) set', async () => {
    writeTicket(governanceDir, 'T-20261126-002');
    writeTicket(serviceDir, 'T-20261126-002');
    writeMemory('2026-11-26.md', ['ambiguous: T-20261126-002', 'vanished: T-20261126-999']);
    const report = await driftCheck({ memoryDir, serviceDir, governanceDir });
    expect(report.cited).toBe(2);
    expect(report.ambiguous.map((x) => x.id)).toEqual(['T-20261126-002']);
    expect(report.unresolved.map((x) => x.id)).toEqual(['T-20261126-999']);
  });
});

describe('reportDriftFindings verdicts (v1.1.0, spec §3.2 — one gate definition)', () => {
  function makeReport(partial: Partial<DriftReport>): DriftReport {
    return { cited: 2, unresolved: [], ambiguous: [], ...partial };
  }

  test('unresolved > 0 → "fatal" and the FATAL block prints (wording unchanged)', () => {
    const errLog: string[] = [];
    const e = spyOn(console, 'error').mockImplementation((...a: unknown[]) => errLog.push(a.join(' ')));
    const log: string[] = [];
    const l = spyOn(console, 'log').mockImplementation((...a: unknown[]) => log.push(a.join(' ')));
    try {
      const verdict = reportDriftFindings(
        makeReport({ unresolved: [{ id: 'T-20261126-999', file: 'memory/2026-11-26.md', line: 4 }] }),
      );
      expect(verdict).toBe('fatal');
      expect(errLog.join('\n')).toContain('resolve in NO store or archive');
      expect(errLog.join('\n')).toContain('T-20261126-999 cited at memory/2026-11-26.md:4');
    } finally {
      e.mockRestore();
      l.mockRestore();
    }
  });

  test('ambiguous-only → "ambiguous" with the AMBIGUOUS non-fatal lines naming both paths', () => {
    const warnLog: string[] = [];
    const w = spyOn(console, 'warn').mockImplementation((...a: unknown[]) => warnLog.push(a.join(' ')));
    const log: string[] = [];
    const l = spyOn(console, 'log').mockImplementation((...a: unknown[]) => log.push(a.join(' ')));
    const errLog: string[] = [];
    const e = spyOn(console, 'error').mockImplementation((...a: unknown[]) => errLog.push(a.join(' ')));
    try {
      const verdict = reportDriftFindings(
        makeReport({
          ambiguous: [
            {
              id: 'T-20261126-001',
              file: 'memory/2026-11-26.md',
              line: 12,
              locations: [join(governanceDir, 'T-20261126-001.yaml'), join(serviceDir, 'T-20261126-001.yaml')],
              scope: 'stores',
            },
          ],
        }),
      );
      expect(verdict).toBe('ambiguous');
      const out = warnLog.join('\n');
      expect(out).toContain('resolve in MULTIPLE stores (AMBIGUOUS — provenance problem, not a loss)');
      expect(out).toContain('T-20261126-001 cited at memory/2026-11-26.md:12');
      expect(out).toContain('governance');
      expect(out).toContain('service');
      expect(out).toContain('Non-fatal');
      // the pass line still prints (annotated), and no FATAL block
      expect(log.join('\n')).toContain('1 AMBIGUOUS — see warning above');
      expect(errLog.join('')).not.toContain('resolve in NO store');
    } finally {
      w.mockRestore();
      l.mockRestore();
      e.mockRestore();
    }
  });

  test('clean report → "pass"', () => {
    const log: string[] = [];
    const l = spyOn(console, 'log').mockImplementation((...a: unknown[]) => log.push(a.join(' ')));
    try {
      expect(reportDriftFindings(makeReport({}))).toBe('pass');
      expect(log.join('\n')).toContain('all resolve');
    } finally {
      l.mockRestore();
    }
  });
});
