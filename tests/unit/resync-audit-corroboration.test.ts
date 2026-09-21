/**
 * Unit tests for resync-audit.ts v1.1.0 subset-match corroboration (v1.1.0):
 * a subset (isOlderRevision) match is STALE-RESIDUE only with corroborating
 * evidence — project mtime older than source AND line-order agreement on the
 * common lines; otherwise PRESUME-STALE (human confirm before discard).
 *
 * corroboratedStale() reads real mtimes, so tests run against temp files
 * with utimes-controlled timestamps.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { corroboratedStale, linesInOrder } from '../../scripts/resync-audit.ts';

const dir = mkdtempSync(join(tmpdir(), 'resync-audit-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const SOURCE = ['line a', 'line b', 'line c', 'line d'].join('\n');

function writePair(name: string, projectContent: string, projectMtime: Date): { project: string; source: string } {
  const project = join(dir, `${name}.project.md`);
  const source = join(dir, `${name}.source.md`);
  writeFileSync(project, projectContent);
  writeFileSync(source, SOURCE);
  utimesSync(project, projectMtime, projectMtime);
  utimesSync(source, new Date('2026-09-22T12:00:00Z'), new Date('2026-09-22T12:00:00Z'));
  return { project, source };
}

describe('linesInOrder — order-sensitive subsequence', () => {
  test('common lines in order → true', () => {
    expect(linesInOrder('line a\nline c', 'line a\nline b\nline c\nline d')).toBe(true);
  });

  test('reordered lines → false', () => {
    expect(linesInOrder('line c\nline a', 'line a\nline b\nline c\nline d')).toBe(false);
  });

  test('blank lines and trailing whitespace are ignored', () => {
    expect(linesInOrder('line a  \n\nline c', 'line a\nline b\nline c')).toBe(true);
  });
});

describe('corroboratedStale — mtime + order buffer (v1.1.0)', () => {
  test('older mtime + in-order subset → STALE-RESIDUE', () => {
    const { project, source } = writePair('ok', 'line a\nline b\nline c', new Date('2026-09-01T00:00:00Z'));
    const c = corroboratedStale(project, source, 'line a\nline b\nline c', SOURCE);
    expect(c.verdict).toBe('STALE-RESIDUE');
    expect(c.basis).toContain('corroborated');
  });

  test('newer mtime → PRESUME-STALE (possible legitimate deletion)', () => {
    const { project, source } = writePair('newer', 'line a\nline b\nline c', new Date('2026-09-23T00:00:00Z'));
    const c = corroboratedStale(project, source, 'line a\nline b\nline c', SOURCE);
    expect(c.verdict).toBe('PRESUME-STALE');
    expect(c.basis).toContain('human confirm before discard');
  });

  test('older mtime but reordered lines → PRESUME-STALE', () => {
    const { project, source } = writePair('reordered', 'line c\nline a\nline b', new Date('2026-09-01T00:00:00Z'));
    const c = corroboratedStale(project, source, 'line c\nline a\nline b', SOURCE);
    expect(c.verdict).toBe('PRESUME-STALE');
  });

  test('missing file → no corroboration (PRESUME-STALE, fail-closed)', () => {
    const { source } = writePair('vanished', 'line a', new Date('2026-09-01T00:00:00Z'));
    const c = corroboratedStale(join(dir, 'does-not-exist.md'), source, 'line a', SOURCE);
    expect(c.verdict).toBe('PRESUME-STALE');
  });
});
