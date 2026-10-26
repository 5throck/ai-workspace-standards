/**
 * Tests for scripts/hooks/pre-push.ts branchDeletionGuardError (U-20261026-011):
 * a pure deletion push that removes refs/heads/pr/* is refused unless
 * ALLOW_REMOTE_BRANCH_DELETE=1; non-pr deletions and empty input are allowed.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { branchDeletionGuardError } from '../../scripts/hooks/pre-push';

describe('branchDeletionGuardError', () => {
  test('blocks deletion of a pr/* remote branch by default', () => {
    const err = branchDeletionGuardError(['refs/heads/pr/20261026-x'], false);
    expect(err).not.toBeNull();
    expect(err).toContain('pr/20261026-x');
    expect(err).toContain('ALLOW_REMOTE_BRANCH_DELETE=1');
  });

  test('allows pr/* deletion when the override flag is set', () => {
    expect(branchDeletionGuardError(['refs/heads/pr/20261026-x'], true)).toBeNull();
  });

  test('lists every blocked pr/* branch in one message', () => {
    const err = branchDeletionGuardError(
      ['refs/heads/pr/a', 'refs/heads/pr/b'],
      false,
    );
    expect(err).toContain('pr/a, pr/b');
  });

  test('allows non-pr remote branch deletion without the flag', () => {
    expect(branchDeletionGuardError(['refs/heads/wip/scratch'], false)).toBeNull();
  });

  test('blocks only when a pr/* ref is among mixed deletions', () => {
    const err = branchDeletionGuardError(
      ['refs/heads/wip/scratch', 'refs/heads/pr/keep'],
      false,
    );
    expect(err).toContain('pr/keep');
    expect(err).not.toContain('wip/scratch');
  });

  test('returns null for empty input', () => {
    expect(branchDeletionGuardError([], false)).toBeNull();
  });

  test('does not treat a branch merely containing pr/ as a pr/* branch', () => {
    expect(branchDeletionGuardError(['refs/heads/feature/pr/x'], false)).toBeNull();
  });
});
