#!/usr/bin/env bun
// @version 1.1.0
// agent-lifecycle-stale-date.test.ts — T-20260909-004 stale last_updated helpers
//
// Covers the pure date helpers behind Check 11: frontmatter date normalization
// (plain + ISO-datetime forms, non-date rejection) and the strictly-older
// comparison against the last git commit date. v1.1.0 adds the sync-only
// commit-subject filter (DEC-20260930-01 ruling 2, T-20260930-024) with a
// git-fixture test for lastContentCommitDate.

import { test, expect, describe } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  parseFrontmatterDate,
  isFrontmatterStale,
  isSyncOnlyCommitSubject,
  lastContentCommitDate,
} from '../../scripts/agent-lifecycle-audit.ts';

describe('parseFrontmatterDate (T-20260909-004)', () => {
  test('parses plain YYYY-MM-DD values', () => {
    expect(parseFrontmatterDate('2026-08-24')).toBe('2026-08-24');
  });

  test('parses ISO datetime values (lifecycle.last_updated form)', () => {
    expect(parseFrontmatterDate('2026-08-24T00:00:00.000Z')).toBe('2026-08-24');
  });

  test('accepts quoted values', () => {
    expect(parseFrontmatterDate("'2026-05-31'")).toBe('2026-05-31');
  });

  test('rejects non-date values and non-strings', () => {
    expect(parseFrontmatterDate('inherit')).toBeNull();
    expect(parseFrontmatterDate('')).toBeNull();
    expect(parseFrontmatterDate(undefined)).toBeNull();
    expect(parseFrontmatterDate(42)).toBeNull();
  });
});

describe('isFrontmatterStale (T-20260909-004)', () => {
  test('stale when frontmatter date is strictly older than last commit', () => {
    expect(isFrontmatterStale('2026-08-24', '2026-09-07')).toBe(true);
  });

  test('not stale on the same day', () => {
    expect(isFrontmatterStale('2026-09-07', '2026-09-07')).toBe(false);
  });

  test('not stale when frontmatter date is newer than last commit', () => {
    expect(isFrontmatterStale('2026-09-09', '2026-09-07')).toBe(false);
  });
});

describe('isSyncOnlyCommitSubject (DEC-20260930-01 ruling 2)', () => {
  test('fleet upgrade template-sync commits are sync-only', () => {
    expect(isSyncOnlyCommitSubject('chore(upgrade): template sync v0.8.1 (Claude 5.5 models)')).toBe(true);
  });

  test('auto-release cuts are sync-only', () => {
    expect(isSyncOnlyCommitSubject('chore(templates): auto-release v0.8.1 (patch, 50 delivered paths)')).toBe(true);
  });

  test('propagate sync cascade commits are sync-only', () => {
    expect(isSyncOnlyCommitSubject('chore(skills): propagate sync SKILL.md 1.2.1 to template platform mirrors (cascade follow-up)')).toBe(true);
  });

  test('content commits are not sync-only', () => {
    expect(isSyncOnlyCommitSubject('docs(agents): update pm.md tier semantics')).toBe(false);
    expect(isSyncOnlyCommitSubject('chore(scaffold): initial commit of the co-work variant instance')).toBe(false);
    expect(isSyncOnlyCommitSubject('fix(scripts): port co-newbiz validator gap fixes to L0/L1')).toBe(false);
    expect(isSyncOnlyCommitSubject('chore(upgrade): manual agent refresh')).toBe(false);
  });
});

describe('lastContentCommitDate (DEC-20260930-01 ruling 2)', () => {
  const git = (cwd: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync('git', args, { cwd, encoding: 'utf-8', env: { ...process.env, ...env } });

  const commitAt = (cwd: string, file: string, subject: string, date: string) => {
    writeFileSync(join(cwd, file), `content for ${subject}\n`, 'utf-8');
    git(cwd, ['add', file]);
    git(cwd, ['commit', '-m', subject], {
      GIT_AUTHOR_DATE: `${date}T12:00:00 +0000`,
      GIT_COMMITTER_DATE: `${date}T12:00:00 +0000`,
    });
  };

  const initRepo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'alc-stale-date-'));
    git(dir, ['init', '--initial-branch=main']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    return dir;
  };

  test('skips a newer sync-only commit and reports the newest content commit', () => {
    const dir = initRepo();
    commitAt(dir, 'pm.md', 'docs(agents): refresh pm.md', '2026-09-01');
    commitAt(dir, 'pm.md', 'chore(upgrade): template sync v0.8.1', '2026-09-20');
    expect(lastContentCommitDate(join(dir, 'pm.md'), dir)).toBe('2026-09-01');
  });

  test('returns null when every commit touching the file is sync-only', () => {
    const dir = initRepo();
    commitAt(dir, 'pm.md', 'chore(skills): propagate sync SKILL.md 1.2.1', '2026-09-05');
    commitAt(dir, 'pm.md', 'chore(templates): auto-release v0.8.1', '2026-09-20');
    expect(lastContentCommitDate(join(dir, 'pm.md'), dir)).toBeNull();
  });

  test('returns null outside a git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alc-no-git-'));
    writeFileSync(join(dir, 'agents.md'), 'no git here\n', 'utf-8');
    expect(lastContentCommitDate(join(dir, 'agents.md'))).toBeNull();
  });
});
