/**
 * T-20261114-007 / T-20261114-006 (design docs/designs/2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md).
 *
 * dev-sync.ts is a monolithic top-level-await script (not import-safe), so — like
 * dev-sync-scoped-staging-default.test.ts — the wiring is asserted textually, and the
 * pure logic it relies on (parseTrackedWorktreeChanges) is tested directly.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTrackedWorktreeChanges } from '../../scripts/lib/git-status.ts';

const root = join(import.meta.dir, '..', '..');
const src = readFileSync(join(root, 'scripts', 'dev-sync.ts'), 'utf-8');

describe('parseTrackedWorktreeChanges', () => {
  const z = (...r: string[]) => r.join('\0') + '\0';

  test('A-T1: unstaged modify/delete are tracked changes with the FULL path', () => {
    expect(parseTrackedWorktreeChanges(z(' M AGENTS.md', ' D gone.md'))).toEqual(['AGENTS.md', 'gone.md']);
  });

  test('A-T4: untracked and ignored entries do not count', () => {
    expect(parseTrackedWorktreeChanges(z('?? scratch/a.txt', '!! ignored.log'))).toEqual([]);
  });

  test('renames count once and skip the source field', () => {
    expect(parseTrackedWorktreeChanges(z('R  new.md', 'old.md', ' M other.md'))).toEqual(['new.md', 'other.md']);
  });

  test('paths with spaces survive (-z format)', () => {
    expect(parseTrackedWorktreeChanges(z(' M docs/a b.md'))).toEqual(['docs/a b.md']);
  });
});

describe('dev-sync empty-index guard wiring', () => {
  test('flags are parsed and never reach the message args (A-T2, A-T3)', () => {
    expect(src).toMatch(/arg === ["']--allow-generated-only["']/);
    expect(src).toMatch(/arg === ["']--stage["']/);
    expect(src).toMatch(/arg\.startsWith\(["']--stage=["']\)/);
  });

  test('A-T7: an unmatched --stage pathspec exits 1', () => {
    expect(src).toMatch(/--stage "\$\{spec\}" matched nothing/);
  });

  test('A-T8: the guard keys on the start-of-run index, not step-6.5 taskStaged', () => {
    const guard = src.slice(src.indexOf('Empty-index guard'), src.indexOf('U-20261107-003 (v1.43.0)'));
    expect(guard).toContain('agentStagedAtStart');
    expect(guard).not.toContain('taskStaged');
  });

  test('A-T5/A-T6: exempt in sweep mode, --conclude-merge and --allow-generated-only', () => {
    const guard = src.slice(src.indexOf('Empty-index guard'), src.indexOf('U-20261107-003 (v1.43.0)'));
    expect(guard).toMatch(/scopedStaging &&/);
    expect(guard).toMatch(/!concludeMerge &&/);
    expect(guard).toMatch(/!allowGeneratedOnly &&/);
    expect(guard).toContain('process.exit(1)');
  });

  test('the guard runs before the first pipeline write (memory session entry)', () => {
    expect(src.indexOf('Empty-index guard')).toBeLessThan(src.indexOf('duplicatePattern'));
  });

  test('tracked residual is listed separately and repeated after the PR step', () => {
    expect(src).toContain('TRACKED edits left out of this commit');
    expect(src).toMatch(/left OUT of this PR/);
  });
});

describe('dev-sync commit body wiring (T-20261114-006)', () => {
  test('message is split into subject + body; msg stays the subject', () => {
    expect(src).toMatch(/const \{ subject: msgSubject, body: msgBody \} = splitCommitMessage\(/);
    expect(src).toMatch(/let msg = msgSubject;/);
  });

  test('commit uses a second -m for the body', () => {
    expect(src).toMatch(/git commit -m \$\{msg\} -m \$\{msgBody\}/);
  });

  test('language gate covers the body', () => {
    expect(src).toMatch(/hasNonEnglish\(msg\) \|\| hasNonEnglish\(msgBody\)/);
  });

  test('O-1: a trailer joined onto the subject hard-fails', () => {
    expect(src).toMatch(/findTrailerInSubject\(msg\)/);
  });

  test('PR title still comes from the subject only', () => {
    expect(src).toMatch(/let prTitle = msg;/);
  });
});

describe('git commit with subject + body (T-20261114-006)', () => {
  test('%s equals the subject, %b the body, and a body trailer parses as a trailer', async () => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { spawnSync } = await import('node:child_process');
    const { splitCommitMessage } = await import('../../scripts/helpers/commit-message.ts');
    const dir = mkdtempSync(join(tmpdir(), 'dev-sync-body-'));
    try {
      const git = (...a: string[]) => spawnSync('git', a, { cwd: dir, encoding: 'utf-8' });
      git('init', '-q');
      git('config', 'user.email', 'a@example.invalid');
      git('config', 'user.name', 'A');
      writeFileSync(join(dir, 'f.txt'), 'x');
      git('add', 'f.txt');
      const { subject, body } = splitCommitMessage('feat: x\n\n# note\nmore\n\nCo-Authored-By: B <b@example.invalid>');
      const c = git('commit', '-q', '-m', subject, '-m', body);
      expect(c.status).toBe(0);
      expect(git('log', '-1', '--format=%s').stdout.trim()).toBe('feat: x');
      expect(git('log', '-1', '--format=%b').stdout.trim()).toBe(body);
      expect(git('log', '-1', '--format=%(trailers:key=Co-Authored-By,valueonly)').stdout.trim()).toBe('B <b@example.invalid>');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
