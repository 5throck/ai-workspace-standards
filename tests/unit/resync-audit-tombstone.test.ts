#!/usr/bin/env bun
/**
 * Unit tests for resync-audit.ts tombstone reappearance detection (v1.7.0,
 * spec docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.B3,
 * PR4) and the nightly-guard invocation contract (T-20261029-007):
 *  - a manifest-tombstoned path PRESENT on disk → a TOMBSTONE-VIOLATION row
 *    carrying recordedAt / templateVersion / a reason snippet;
 *  - an absent tombstoned path → no violation row (the ordinary census
 *    classification keeps its KEEP/TOMBSTONE-UNCONFIRMED semantics);
 *  - violation rows override the ordinary per-path classification, one row
 *    per path (mergeViolationRows);
 *  - a deletion carried ONLY by a merge commit is invisible to plain
 *    `git log --diff-filter=D -- <path>` and detected by
 *    `git log -m --diff-filter=D -- <path>` — the fixture pins the git
 *    semantics behind the invocation contract documented in the
 *    resync-audit.ts header (the 01:30 cron prompt itself is user-managed
 *    and lives outside the repo).
 *
 * The merge fixture runs real git against a temp repo (git is a hard
 * prerequisite of resync-audit itself).
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll, beforeAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  loadDeliveryTombstoneState,
  tombstoneViolations,
  mergeViolationRows,
} from '../../scripts/resync-audit.ts';

const dir = mkdtempSync(join(tmpdir(), 'resync-tombstone-test-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** Fixture project: manifest with the given tombstones + paths re-created on disk. */
function makeProject(
  name: string,
  tombstones: Record<string, { recordedAt?: string; templateVersion?: string; reason?: string }>,
  present: string[],
): string {
  const project = join(dir, name);
  mkdirSync(join(project, '.claude'), { recursive: true });
  writeFileSync(
    join(project, '.claude', 'last-upgrade-delivery.json'),
    JSON.stringify({ schemaVersion: 2, tombstones, baselines: {} }, null, 2),
  );
  for (const rel of present) {
    mkdirSync(join(project, rel, '..'), { recursive: true });
    writeFileSync(join(project, rel), 're-applied content\n');
  }
  return project;
}

describe('tombstoneViolations — present on disk → row; absent → no row (v1.7.0 PR4 §3.B3)', () => {
  test('tombstoned path present on disk → TOMBSTONE-VIOLATION row with tombstone metadata', () => {
    const project = makeProject(
      'present',
      {
        'docs/gone.md': {
          templateVersion: '0.16.0',
          recordedAt: '2026-10-28',
          reason: 'L1 delivery retired; per-project removal (T-20261028-016)',
        },
      },
      ['docs/gone.md'],
    );
    const rows = tombstoneViolations(project, loadDeliveryTombstoneState(project));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.verdict).toBe('TOMBSTONE-VIOLATION');
    expect(rows[0]!.state).toBe('tombstoned');
    expect(rows[0]!.file).toBe('docs/gone.md');
    expect(rows[0]!.basis).toContain('present on disk');
    expect(rows[0]!.basis).toContain('recorded 2026-10-28');
    expect(rows[0]!.basis).toContain('template v0.16.0');
    expect(rows[0]!.basis).toContain('L1 delivery retired');
    expect(rows[0]!.basis).toContain('adjudicate intent');
  });

  test('tombstoned path ABSENT on disk → no violation row (KEEP census semantics stay)', () => {
    const project = makeProject(
      'absent',
      { 'docs/gone.md': { recordedAt: '2026-10-28' } },
      [],
    );
    const rows = tombstoneViolations(project, loadDeliveryTombstoneState(project));
    expect(rows).toHaveLength(0);
  });

  test('missing metadata degrades to "?" without breaking the row', () => {
    const project = makeProject('bare', { 'docs/gone.md': {} }, ['docs/gone.md']);
    const rows = tombstoneViolations(project, loadDeliveryTombstoneState(project));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.basis).toContain('recorded ?');
  });

  test('reason snippets longer than 80 chars are truncated with an ellipsis', () => {
    const project = makeProject(
      'longreason',
      { 'docs/gone.md': { recordedAt: '2026-10-28', reason: 'r'.repeat(120) } },
      ['docs/gone.md'],
    );
    const rows = tombstoneViolations(project, loadDeliveryTombstoneState(project));
    expect(rows).toHaveLength(1);
    const reasonPart = rows[0]!.basis.split(' — ').at(-1)!;
    expect(reasonPart.startsWith('r'.repeat(80))).toBe(true);
    expect(reasonPart.endsWith('…')).toBe(true);
    expect(reasonPart.length).toBeLessThanOrEqual(81);
  });

  test('multiple violations sort by path for a stable report', () => {
    const project = makeProject(
      'multi',
      {
        'docs/z.md': { recordedAt: '2026-10-28' },
        'docs/a.md': { recordedAt: '2026-10-28' },
      },
      ['docs/z.md', 'docs/a.md'],
    );
    const rows = tombstoneViolations(project, loadDeliveryTombstoneState(project));
    expect(rows.map((r) => r.file)).toEqual(['docs/a.md', 'docs/z.md']);
  });
});

describe('mergeViolationRows — violation overrides the ordinary classification', () => {
  test('a porcelain row for the same path is replaced; exactly one row per path', () => {
    const porcelainRows = [
      { file: 'docs/gone.md', state: 'modified' as const, mtime: '2026-10-29', verdict: 'LOCAL-WORK' as const, basis: 'ordinary classification' },
      { file: 'docs/keep.md', state: 'modified' as const, mtime: '2026-10-29', verdict: 'KEEP' as const, basis: 'unrelated' },
    ];
    const violations = [
      { file: 'docs/gone.md', state: 'tombstoned' as const, mtime: '', verdict: 'TOMBSTONE-VIOLATION' as const, basis: 'violation' },
    ];
    const merged = mergeViolationRows(porcelainRows, violations);
    expect(merged.map((r) => r.file).sort()).toEqual(['docs/gone.md', 'docs/keep.md']);
    expect(merged.find((r) => r.file === 'docs/gone.md')!.verdict).toBe('TOMBSTONE-VIOLATION');
    expect(merged.find((r) => r.file === 'docs/keep.md')!.verdict).toBe('KEEP');
  });

  test('no violations → porcelain rows pass through unchanged', () => {
    const porcelainRows = [
      { file: 'docs/keep.md', state: 'untracked' as const, mtime: '2026-10-29', verdict: 'LOCAL-WORK' as const, basis: 'b' },
    ];
    expect(mergeViolationRows(porcelainRows, [])).toEqual(porcelainRows);
  });
});

describe('nightly-guard invocation contract — merge-carried deletions (T-20261029-007)', () => {
  let repo = '';
  beforeAll(() => {
    repo = join(dir, 'merge-fixture');
    const g = (args: string[]): string => {
      const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf-8' });
      if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
      return r.stdout ?? '';
    };
    mkdirSync(join(repo, 'docs'), { recursive: true });
    g(['init', '-q', '-b', 'main']);
    g(['config', 'user.email', 'test@example.test']);
    g(['config', 'user.name', 'test']);
    writeFileSync(join(repo, 'docs', 'x.md'), 'x\n');
    writeFileSync(join(repo, 'docs', 'y.md'), 'y\n');
    g(['add', '.']);
    g(['commit', '-qm', 'base']);
    g(['checkout', '-qb', 'feat']);
    writeFileSync(join(repo, 'docs', 'y.md'), 'y-feat\n');
    g(['commit', '-qam', 'feat-side']);
    g(['checkout', '-q', 'main']);
    writeFileSync(join(repo, 'docs', 'y.md'), 'y-main\n');
    g(['commit', '-qam', 'main-side']);
    // Both branches edit docs/y.md, so the merge CONFLICTS (exit 1) — that is
    // the fixture's design: the resolution stage is where a deletion can ride
    // the merge commit without any standalone deletion commit.
    const merge = spawnSync('git', ['-C', repo, 'merge', '--no-commit', '--no-ff', 'feat'], { encoding: 'utf-8' });
    const mergeOut = `${merge.stdout ?? ''}${merge.stderr ?? ''}`;
    if (merge.status !== 0 && !mergeOut.includes('CONFLICT')) {
      throw new Error(`git merge failed unexpectedly: ${mergeOut}`);
    }
    writeFileSync(join(repo, 'docs', 'y.md'), 'y-merged\n');
    g(['add', 'docs/y.md']);
    // The deletion rides the MERGE COMMIT's tree only — no standalone
    // deletion commit exists anywhere in history (the conflict-resolution
    // shape that made PR #59's workflows.md delete invisible to the guard).
    const rm = spawnSync('git', ['-C', repo, 'rm', '-q', '--', 'docs/x.md'], { encoding: 'utf-8' });
    if (rm.status !== 0) throw new Error(`git rm failed: ${rm.stderr}`);
    g(['commit', '-qm', 'merge: carries the docs/x.md deletion (no standalone deletion commit)']);
  });

  test('plain --diff-filter=D sees NO deletion (the guard gap)', () => {
    const r = spawnSync(
      'git', ['-C', repo, 'log', '--diff-filter=D', '--format=%h', '--', 'docs/x.md'],
      { encoding: 'utf-8' },
    );
    expect(r.status).toBe(0);
    expect((r.stdout ?? '').trim()).toBe('');
  });

  test('`log -m --diff-filter=D` detects the merge-carried deletion', () => {
    const r = spawnSync(
      'git', ['-C', repo, 'log', '-m', '--diff-filter=D', '--format=%h', '--', 'docs/x.md'],
      { encoding: 'utf-8' },
    );
    expect(r.status).toBe(0);
    expect((r.stdout ?? '').trim().length).toBeGreaterThan(0);
  });
});
