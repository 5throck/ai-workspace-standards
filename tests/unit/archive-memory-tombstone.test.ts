#!/usr/bin/env bun
// @version 1.0.0
// archive-memory-tombstone.test.ts — U-20261116-013 (PR-1 of the root machinery batch,
// spec docs/designs/2026-11-17-root-machinery-batch-design.md §1.3).
//
// Pins archive-memory.ts v1.2.0 tombstone generalization:
//   - A-T1 date-named session row `[date](date.md)` → plain date (v1.1.0 behavior preserved);
//   - A-T2 non-date file (meeting-*.md) archived → its index link becomes
//     `*(archived — local only)*`, table pipes/cells intact (Check-3c green afterwards);
//   - A-T3 link to a target NOT archived in the run → untouched;
//   - A-T4 `../docs/adr/…` escape link → untouched;
//   - A-T5 absent MEMORY.md → archive runs, no crash (v1.1.0 behavior preserved);
//   - A-T6 count lines report actual rewrites, not archived-file counts;
//   - idempotency: a re-run produces no duplicate tombstones and no second rewrite.

import { describe, test, expect, afterAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findMissingIndexLinks } from '../../scripts/verify-memory.ts';
import { TOMBSTONE_TOKEN, tombstoneIndex } from '../../scripts/archive-memory.ts';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
const SCRIPT = join(WORKSPACE_ROOT, 'scripts', 'archive-memory.ts');
const TEMP_BASE = join(WORKSPACE_ROOT, 'tests', '.temp');

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs) rmSync(dir, { recursive: true, force: true });
});

/** ISO date string N days before today (UTC-safe for filename classification). */
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Fresh fixture root with a memory/ dir; registered for cleanup. */
function makeFixture(tag: string): string {
  mkdirSync(TEMP_BASE, { recursive: true });
  const dir = mkdtempSync(join(TEMP_BASE, `archive-memory-${tag}-`));
  createdDirs.push(dir);
  mkdirSync(join(dir, 'memory'), { recursive: true });
  return dir;
}

function write(fixture: string, rel: string, content: string, mtime?: Date): void {
  const p = join(fixture, 'memory', rel);
  writeFileSync(p, content, 'utf-8');
  if (mtime) utimesSync(p, mtime, mtime);
}

function readIndex(fixture: string): string {
  return readFileSync(join(fixture, 'memory', 'MEMORY.md'), 'utf-8');
}

function runArchive(fixture: string): { status: number; stdout: string } {
  const r = spawnSync('bun', [SCRIPT], { cwd: fixture, encoding: 'utf-8' });
  return { status: r.status ?? -1, stdout: r.stdout ?? '' };
}

describe('archive-memory v1.2.0 — e2e fixture runs (design §1.3 A-T1..A-T6)', () => {
  test('A-T1: date-named session row tombstones to a plain date (v1.1.0 behavior preserved)', () => {
    const f = makeFixture('at1');
    const date = daysAgoISO(30);
    write(f, `${date}.md`, '# Session log\n', new Date(`${date}T00:00:00Z`));
    write(f, 'MEMORY.md', `# Memory Index\n\n## Sessions\n\n| Date | Summary |\n|------|---------|\n| [${date}](${date}.md) | chore: workspace sync |\n`);
    const r = runArchive(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Tombstoned 1 session row(s)');
    expect(r.stdout).not.toContain('index link(s)');
    expect(readIndex(f)).toContain(`| ${date} | chore: workspace sync |`);
    expect(readIndex(f)).not.toContain(`](${date}.md)`);
    expect(existsSync(join(f, 'memory', 'archive', `${date}.md`))).toBe(true);
  });

  test('A-T2: archived meeting file index link becomes the tombstone token; table pipes intact; Check 3c green', () => {
    const f = makeFixture('at2');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    write(f, 'meeting-2026-09-25-adr019-step3b.md', '# Meeting notes\n', old);
    write(
      f,
      'MEMORY.md',
      [
        '# Memory Index',
        '',
        '## Sessions',
        '',
        '## Meetings',
        '',
        '| Date | Title | Status |',
        '|------|-------|--------|',
        '| 2026-09-25 | [ADR-019 step 3b review](meeting-2026-09-25-adr019-step3b.md) | done |',
        '',
        '## ADRs',
        '',
        '- [ADR-0065](../docs/adr/0065-accessibility.md)',
        '',
      ].join('\n'),
    );
    const r = runArchive(f);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Tombstoned 1 index link(s)');
    const index = readIndex(f);
    expect(index).toContain(`| 2026-09-25 | ${TOMBSTONE_TOKEN} | done |`);
    expect(index).not.toContain('meeting-2026-09-25-adr019-step3b.md)');
    // Table shape preserved: every row still has 4 pipes.
    const row = index.split('\n').find((l) => l.includes('2026-09-25'));
    expect(row?.split('|')).toHaveLength(5);
    // Check-3c green: no missing index link targets against the post-archive memory/ dir.
    expect(findMissingIndexLinks(index, join(f, 'memory'))).toEqual([]);
    expect(existsSync(join(f, 'memory', 'archive', 'meeting-2026-09-25-adr019-step3b.md'))).toBe(true);
  });

  test('A-T3: link to a target NOT archived in this run is untouched', () => {
    const f = makeFixture('at3');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    write(f, 'meeting-2026-09-25-adr019-step3b.md', '# Meeting notes\n', old);
    write(f, 'meeting-live.md', '# Live meeting\n'); // fresh mtime → not archived
    write(
      f,
      'MEMORY.md',
      [
        '# Memory Index',
        '',
        '## Meetings',
        '',
        '- [archived one](meeting-2026-09-25-adr019-step3b.md)',
        '- [live one](meeting-live.md)',
        '',
      ].join('\n'),
    );
    const r = runArchive(f);
    expect(r.status).toBe(0);
    const index = readIndex(f);
    expect(index).toContain(`- [live one](meeting-live.md)`);
    expect(index).toContain(`- ${TOMBSTONE_TOKEN}`);
  });

  test('A-T4: ../docs/adr/ escape link is untouched', () => {
    const f = makeFixture('at4');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    write(f, 'meeting-2026-09-25-adr019-step3b.md', '# Meeting notes\n', old);
    write(
      f,
      'MEMORY.md',
      ['## Meetings', '', '- [ADR-0065](../docs/adr/0065-accessibility.md)', '- [x](meeting-2026-09-25-adr019-step3b.md)', ''].join('\n'),
    );
    const r = runArchive(f);
    expect(r.status).toBe(0);
    const index = readIndex(f);
    expect(index).toContain('[ADR-0065](../docs/adr/0065-accessibility.md)');
    expect(index).toContain(`- ${TOMBSTONE_TOKEN}`);
  });

  test('A-T5: absent MEMORY.md — archive runs, no crash (v1.1.0 behavior preserved)', () => {
    const f = makeFixture('at5');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    write(f, 'meeting-2026-09-25-x.md', '# Meeting notes\n', old);
    const r = runArchive(f);
    expect(r.status).toBe(0);
    expect(existsSync(join(f, 'memory', 'archive', 'meeting-2026-09-25-x.md'))).toBe(true);
    expect(r.stdout).not.toContain('Tombstoned');
  });

  test('A-T6: count lines reflect actual rewrites, not archived-file counts', () => {
    const f = makeFixture('at6');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const date = daysAgoISO(30);
    // Archived: one date-named file with NO index row, one meeting WITH a row.
    write(f, `${date}.md`, '# Session log\n', new Date(`${date}T00:00:00Z`));
    write(f, 'meeting-2026-09-25-x.md', '# Meeting notes\n', old);
    write(
      f,
      'MEMORY.md',
      ['## Meetings', '', '- [one](meeting-2026-09-25-x.md)', ''].join('\n'),
    );
    const r = runArchive(f);
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('session row(s)'); // no session row existed to rewrite
    expect(r.stdout).toContain('Tombstoned 1 index link(s)');
  });

  test('idempotency: re-run produces no duplicate tombstones and no second rewrite', () => {
    const f = makeFixture('idem');
    const old = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const date = daysAgoISO(30);
    write(f, `${date}.md`, '# Session log\n', new Date(`${date}T00:00:00Z`));
    write(f, 'meeting-2026-09-25-adr019-step3b.md', '# Meeting notes\n', old);
    write(
      f,
      'MEMORY.md',
      [
        '# Memory Index',
        '',
        '## Sessions',
        '',
        `| [${date}](${date}.md) | sync |`,
        '',
        '## Meetings',
        '',
        '- [ADR-019 step 3b review](meeting-2026-09-25-adr019-step3b.md)',
        '',
      ].join('\n'),
    );
    const first = runArchive(f);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain('Tombstoned 1 session row(s)');
    expect(first.stdout).toContain('Tombstoned 1 index link(s)');
    const afterFirst = readIndex(f);

    const second = runArchive(f);
    expect(second.status).toBe(0);
    expect(second.stdout).not.toContain('Tombstoned');
    expect(second.stdout).not.toContain('Archived');
    expect(readIndex(f)).toBe(afterFirst); // byte-identical — no duplicate tombstones
  });
});

describe('tombstoneIndex (pure core)', () => {
  test('rewrites the exact flat link only — archive/… path-segment hrefs are never matched', () => {
    const index = ['- [live archive link](archive/meeting-x.md)', '- [dead link](meeting-x.md)', ''].join('\n');
    const r = tombstoneIndex(index, [], ['meeting-x.md']);
    expect(r.links).toBe(1);
    expect(r.index).toContain('[live archive link](archive/meeting-x.md)');
    expect(r.index).toContain(`- ${TOMBSTONE_TOKEN}`);
  });

  test('date rows are counted separately from link rewrites', () => {
    const index = ['| [2026-09-09](2026-09-09.md) | sync |', '- [x](meeting-y.md)', ''].join('\n');
    const r = tombstoneIndex(index, ['2026-09-09'], ['meeting-y.md']);
    expect(r.sessionRows).toBe(1);
    expect(r.links).toBe(1);
    expect(r.index).toBe(`| 2026-09-09 | sync |\n- ${TOMBSTONE_TOKEN}\n`);
  });

  test('empty archived lists return the index unchanged', () => {
    const index = '# Memory Index\n';
    expect(tombstoneIndex(index, [], [])).toEqual({ index, sessionRows: 0, links: 0 });
  });
});
