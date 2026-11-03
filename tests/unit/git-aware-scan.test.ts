/**
 * Tests for scripts/lib/git-aware-scan.ts v1.0.0 (T-20261103-004) — the
 * git-aware discovery helpers for scripts whose output is committed:
 * trackedFilesUnder / isTrackedRel (fail-open on non-git), checkoutBranch /
 * isTransientCheckoutBranch / filterTransientCheckouts (only positive
 * `pr/*` evidence excludes a fleet candidate).
 */

import { afterAll, describe, expect, test } from 'bun:test';
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

// Hooks (pre-push) run `bun test` with GIT_DIR exported, and every git spawn
// honors GIT_DIR over cwd-based discovery — fixture repos would silently
// resolve to the workspace repo. Sanitize for the suite's duration so the
// tests are hermetic regardless of the caller's git environment.
const GIT_ENV_KEYS = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY'];
const savedGitEnv = new Map<string, string | undefined>();
for (const key of GIT_ENV_KEYS) {
  savedGitEnv.set(key, process.env[key]);
  delete process.env[key];
}
afterAll(() => {
  for (const [key, value] of savedGitEnv) {
    if (value !== undefined) process.env[key] = value;
  }
});

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

  test('checkoutBranch on a fixture repo returns the checked-out branch (positive evidence)', () => {
    // Standalone fixture instead of the ambient repo: CI checkouts run on a
    // detached HEAD, so REPO_ROOT legitimately has no branch name to return.
    const repo = mkdtempSync(join(tmpdir(), 'git-aware-scan-branch-'));
    try {
      writeFileSync(join(repo, 'seed.md'), 'x');
      spawnSync('git', ['init', '-q'], { cwd: repo });
      spawnSync('git', ['-C', repo, 'add', 'seed.md'], { cwd: repo });
      spawnSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'], { cwd: repo });
      spawnSync('git', ['-C', repo, 'checkout', '-qb', 'fixture-branch'], { cwd: repo });
      const branch = checkoutBranch(repo);
      expect(branch).not.toBeNull();
      expect(branch).toBe('fixture-branch');
      // Detached HEAD is "no positive evidence" — null, never a branch name.
      const sha = spawnSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
      spawnSync('git', ['-C', repo, 'checkout', '-q', sha], { cwd: repo });
      expect(checkoutBranch(repo)).toBeNull();
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
