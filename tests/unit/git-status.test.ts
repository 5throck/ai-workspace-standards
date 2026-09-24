/**
 * Unit tests for scripts/lib/git-status.ts — the NUL-delimited parsers
 * behind dev-sync scoped staging (design:
 * docs/designs/2026-09-12-dev-sync-scoped-staging-design.md). Both S0/S1
 * snapshots feed set math (S1 \ S0 = pipeline outputs), so the parser must
 * handle rename-record fields, spaced/UTF-8 paths, and untracked entries
 * without resurrecting paths that no longer exist. parseCachedNameStatus
 * feeds the step 6.5 index-removed skip set (spec Amendment 2 §13:
 * docs/designs/2026-09-24-constitution-s33-context-injection-design.md).
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import { parseCachedNameStatus, parseStatusPorcelain } from '../../scripts/lib/git-status.ts';

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

describe('parseCachedNameStatus (step 6.5 index-removed set, spec Amendment 2 §13)', () => {
  test('T5: a cached D record classifies into indexRemoved', () => {
    // Probed byte shape: "D\0tracked.txt\0" (bare status token, one path).
    const out = 'D\0tracked.txt\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set(['tracked.txt']));
  });

  test('T5: an R100 staged-rename record contributes its SOURCE, not its target', () => {
    // Probed byte shape: "R100\0other.txt\0renamed.txt\0" — cached name-status
    // lists the SOURCE first (porcelain v1 lists the TARGET first). A staged
    // rename removes the source from the index; the target stays.
    const out = 'R100\0other.txt\0renamed.txt\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set(['other.txt']));
  });

  test('A / M records remove nothing', () => {
    const out = 'A\0new.txt\0M\0mod.txt\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set());
  });

  test('a C (copy) record keeps its source (copies do not remove it)', () => {
    const out = 'C75\0copy.ts\0source.ts\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set());
  });

  test('mixed stream: D and R100 records classify together, in field order', () => {
    // Probed real stream for "staged rename + staged deletion":
    // R100\0other.txt\0renamed.txt\0D\0tracked.txt\0
    const out = 'R100\0other.txt\0renamed.txt\0D\0tracked.txt\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set(['other.txt', 'tracked.txt']));
  });

  test('paths with spaces and UTF-8 stay verbatim (no C-quoting under -z)', () => {
    const out = 'D\0my dir/파일 이름.md\0';
    expect(parseCachedNameStatus(out)).toEqual(new Set(['my dir/파일 이름.md']));
  });

  test('empty output yields an empty set (nothing staged)', () => {
    expect(parseCachedNameStatus('')).toEqual(new Set());
  });

  test('truncated trailing records are ignored, not thrown', () => {
    expect(parseCachedNameStatus('D\0gone.txt\0R100\0only-source')).toEqual(new Set(['gone.txt']));
  });
});
