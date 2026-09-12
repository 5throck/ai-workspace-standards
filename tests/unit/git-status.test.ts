/**
 * Unit tests for scripts/lib/git-status.ts — the NUL-delimited porcelain parser
 * behind dev-sync scoped staging (design:
 * docs/designs/2026-09-12-dev-sync-scoped-staging-design.md). Both S0/S1
 * snapshots feed set math (S1 \ S0 = pipeline outputs), so the parser must
 * handle rename-record fields, spaced/UTF-8 paths, and untracked entries
 * without resurrecting paths that no longer exist.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { parseStatusPorcelain } from '../../scripts/lib/git-status.ts';

describe('parseStatusPorcelain', () => {
  test('parses modified, staged, untracked and deleted paths', () => {
    const out = [' M scripts/a.ts', 'M  docs/b.md', '?? scratch/c.ts', ' D old/d.txt', ''].join('\0');
    expect(parseStatusPorcelain(out)).toEqual(
      new Set(['scripts/a.ts', 'docs/b.md', 'scratch/c.ts', 'old/d.txt']),
    );
  });

  test('staged rename consumes the trailing original-path field', () => {
    // porcelain v1 -z rename record is "R  to\0from" — the vanished "from"
    // path must NOT enter the set (it no longer exists in the worktree).
    const out = 'R  new-name.ts\0old-name.ts\0 M keep.ts\0';
    expect(parseStatusPorcelain(out)).toEqual(new Set(['new-name.ts', 'keep.ts']));
  });

  test('worktree rename (status in column Y) also consumes the original path', () => {
    const out = ' R moved.md\0origin.md\0';
    expect(parseStatusPorcelain(out)).toEqual(new Set(['moved.md']));
  });

  test('staged copy consumes the source-path field', () => {
    const out = 'C  copy.ts\0source.ts\0';
    expect(parseStatusPorcelain(out)).toEqual(new Set(['copy.ts']));
  });

  test('paths with spaces and UTF-8 stay verbatim (no C-quoting under -z)', () => {
    const out = '?? my dir/파일 이름.md\0';
    expect(parseStatusPorcelain(out)).toEqual(new Set(['my dir/파일 이름.md']));
  });

  test('empty output yields an empty set (clean tree)', () => {
    expect(parseStatusPorcelain('')).toEqual(new Set());
  });

  test('stray fragments shorter than "XY path" are skipped, not thrown', () => {
    const out = 'M\0 M scripts/a.ts\0';
    expect(parseStatusPorcelain(out)).toEqual(new Set(['scripts/a.ts']));
  });
});
