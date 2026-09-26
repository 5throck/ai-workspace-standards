/**
 * Unit tests for resync-audit.ts subset-match corroboration (v1.1.0) and the
 * v1.3.0 hardening: porcelain rename-row parsing (porcelainPath, ASCII "->")
 * and the empty-file guard (an emptied file must not corroborate
 * STALE-RESIDUE on mtime alone).
 *
 * corroboratedStale() reads real mtimes, so tests run against temp files
 * with utimes-controlled timestamps.
 *
 * @version 1.1.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { corroboratedStale, linesInOrder, porcelainPath, walkProjectDir } from '../../scripts/resync-audit.ts';

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

describe('porcelainPath — rename-row parsing (v1.3.0, T-20260926-012)', () => {
  test('staged rename (ASCII arrow) → null, not a phantom path', () => {
    expect(porcelainPath('R  docs/old.md -> docs/new.md')).toBeNull();
  });

  test('staged copy (ASCII arrow) → null', () => {
    expect(porcelainPath('C  src/a.md -> src/b.md')).toBeNull();
  });

  test('modified / untracked / quoted paths parse to their real path', () => {
    expect(porcelainPath(' M docs/plain.md')).toBe('docs/plain.md');
    expect(porcelainPath('?? skills/new-skill/SKILL.md')).toBe('skills/new-skill/SKILL.md');
    expect(porcelainPath(' M "docs/with space.md"')).toBe('docs/with space.md');
  });

  test('a unicode arrow in a filename is NOT treated as a rename', () => {
    // Regression: the pre-1.3.0 guard tested '→', which porcelain never emits;
    // a file genuinely named with '→' must still parse.
    expect(porcelainPath(' M docs/a → b.md')).toBe('docs/a → b.md');
  });
});

describe('corroboratedStale — empty-file guard (v1.3.0, T-20260926-020a)', () => {
  test('emptied file with older mtime → PRESUME-STALE (mtime alone cannot corroborate)', () => {
    const { project, source } = writePair('emptied', '', new Date('2026-09-01T00:00:00Z'));
    const c = corroboratedStale(project, source, '', SOURCE);
    expect(c.verdict).toBe('PRESUME-STALE');
    expect(c.basis).toContain('file is empty');
  });

  test('whitespace-only file with older mtime → PRESUME-STALE', () => {
    const { project, source } = writePair('blank', '\n\n  \n', new Date('2026-09-01T00:00:00Z'));
    const c = corroboratedStale(project, source, '\n\n  \n', SOURCE);
    expect(c.verdict).toBe('PRESUME-STALE');
  });
});

describe('walkProjectDir — VCS-ignored dir skip (v1.3.0, T-20260926-020b)', () => {
  test('node_modules/build trees are skipped, sibling files are kept', () => {
    const root = join(dir, 'walktest');
    mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'keep.md'), 'x');
    writeFileSync(join(root, 'node_modules', 'pkg', 'index.js'), 'x');
    writeFileSync(join(root, 'dist', 'bundle.js'), 'x');
    expect(walkProjectDir(root)).toEqual([join(root, 'keep.md')]);
  });
});
