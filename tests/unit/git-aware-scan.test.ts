/**
 * Tests for scripts/lib/git-aware-scan.ts v1.0.0 (T-20261103-004) — the
 * git-aware discovery helpers for scripts whose output is committed:
 * trackedFilesUnder / isTrackedRel (fail-open on non-git), checkoutBranch /
 * isTransientCheckoutBranch / filterTransientCheckouts (only positive
 * `pr/*` evidence excludes a fleet candidate).
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  trackedFilesUnder,
  isTrackedRel,
  checkoutBranch,
  isTransientCheckoutBranch,
  filterTransientCheckouts,
} from '../../scripts/lib/git-aware-scan.ts';

const REPO_ROOT = join(import.meta.dir, '..', '..');

describe('trackedFilesUnder / isTrackedRel (per-FILE level inside tracked dirs)', () => {
  test('a tracked dir yields its committed files; untracked names are not members', () => {
    const tracked = trackedFilesUnder(REPO_ROOT, 'docs/decisions');
    expect(tracked).not.toBeNull();
    expect(tracked!.size).toBeGreaterThan(0);
    const sample = [...tracked!][0];
    expect(isTrackedRel(tracked, sample)).toBe(true);
    expect(isTrackedRel(tracked, 'docs/decisions/DEC-19000101-99.md')).toBe(false);
  });

  test('non-git context returns null and isTrackedRel fails open (include-all)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'git-aware-scan-nonrepo-'));
    try {
      expect(trackedFilesUnder(tmp, 'docs')).toBeNull();
      expect(isTrackedRel(null, 'docs/decisions/DEC-anything.md')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('a real git repo: committed file tracked, untracked file not (end-to-end)', () => {
    const repo = mkdtempSync(join(tmpdir(), 'git-aware-scan-repo-'));
    try {
      writeFileSync(join(repo, 'kept.md'), 'x');
      writeFileSync(join(repo, 'ignored.md'), 'x');
      spawnSync('git', ['init', '-q'], { cwd: repo });
      spawnSync('git', ['-C', repo, 'add', 'kept.md'], { cwd: repo });
      spawnSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: repo });
      const tracked = trackedFilesUnder(repo, '.');
      expect(tracked).not.toBeNull();
      expect(isTrackedRel(tracked, 'kept.md')).toBe(true);
      expect(isTrackedRel(tracked, 'ignored.md')).toBe(false);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('filterTransientCheckouts (only positive pr/* evidence excludes)', () => {
  test('pr/* candidates are skipped with name+branch; main/detached/non-git stay', () => {
    const candidates = ['Projects/co-a', 'Projects/co-b', 'Projects/co-c', 'Projects/co-d'];
    const branchOf = (dir: string): string | null =>
      ({
        'Projects/co-a': 'main',
        'Projects/co-b': 'pr/20261030-215102-chore',
        'Projects/co-c': null, // detached HEAD or non-git
        'Projects/co-d': 'feature-not-pr',
      })[dir] ?? null;
    const { projects, skipped } = filterTransientCheckouts(candidates, branchOf);
    expect(projects).toEqual(['Projects/co-a', 'Projects/co-c', 'Projects/co-d']);
    expect(skipped).toEqual([{ name: 'Projects/co-b', branch: 'pr/20261030-215102-chore' }]);
  });

  test('isTransientCheckoutBranch pins the pr/* prefix exactly', () => {
    expect(isTransientCheckoutBranch('pr/20261030-215102-chore')).toBe(true);
    expect(isTransientCheckoutBranch('main')).toBe(false);
    expect(isTransientCheckoutBranch('xpr/lookalike')).toBe(false);
  });

  test('checkoutBranch on the real repo returns a branch name (positive evidence)', () => {
    const branch = checkoutBranch(REPO_ROOT);
    expect(branch).not.toBeNull();
    expect(branch!.length).toBeGreaterThan(0);
  });
});
