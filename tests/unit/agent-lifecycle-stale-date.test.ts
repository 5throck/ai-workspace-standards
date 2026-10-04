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
  isMetadataOnlyChange,
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

describe('isMetadataOnlyChange (design 2026-10-03-validator-warning-fixes-design §2.1)', () => {
  test('metadata-only: only last_updated +/- lines (in hunk)', () => {
    const diff =
      '@@ -1,1 +1,1 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n';
    expect(isMetadataOnlyChange(diff)).toBe(true);
  });

  test('not metadata-only: extra body line', () => {
    const diff =
      '@@ -1,2 +1,3 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n' +
      '+new description line\n';
    expect(isMetadataOnlyChange(diff)).toBe(false);
  });

  test('not metadata-only: no hunk marker (empty diff)', () => {
    const diff = 'diff --git a/file.md b/file.md\nindex abc..def\n';
    expect(isMetadataOnlyChange(diff)).toBe(false);
  });

  test('metadata-only: ignores diff headers before @@', () => {
    const diff =
      'diff --git a/agents/pm.md b/agents/pm.md\n' +
      'index abc123..def456 100644\n' +
      '--- a/agents/pm.md\n' +
      '+++ b/agents/pm.md\n' +
      '@@ -1,1 +1,1 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n';
    expect(isMetadataOnlyChange(diff)).toBe(true);
  });

  test('not metadata-only: body line other than last_updated', () => {
    const diff =
      '@@ -1,2 +1,2 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n' +
      '-some description\n';
    expect(isMetadataOnlyChange(diff)).toBe(false);
  });

  test('metadata-only: empty string returns false (fail-open)', () => {
    expect(isMetadataOnlyChange('')).toBe(false);
  });

  test('not metadata-only: last_updated changes PLUS removed markdown fence line (---)', () => {
    // Regression test: --- in body (markdown fence removal) must not be skipped as a header
    const diff =
      'diff --git a/agents/pm.md b/agents/pm.md\n' +
      'index abc..def 100644\n' +
      '--- a/agents/pm.md\n' +
      '+++ b/agents/pm.md\n' +
      '@@ -1,3 +1,3 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n' +
      '----\n'; // removed markdown fence line (body content)
    expect(isMetadataOnlyChange(diff)).toBe(false);
  });

  test('metadata-only: last_updated changes with header ---, +++, but only after @@ hunk start', () => {
    // Control case: --- and +++ before @@ are ignored (headers), but we only change last_updated in hunk
    const diff =
      'diff --git a/agents/pm.md b/agents/pm.md\n' +
      'index abc..def 100644\n' +
      '--- a/agents/pm.md\n' +
      '+++ b/agents/pm.md\n' +
      '@@ -1,1 +1,1 @@\n' +
      '-last_updated: 2026-09-30\n' +
      '+last_updated: 2026-10-02\n';
    expect(isMetadataOnlyChange(diff)).toBe(true);
  });

  test('not metadata-only: real git diff with extra content (new file)', () => {
    // Full realistic git diff: new file with multiple content lines
    const diff =
      'diff --git a/agents/pm.md b/agents/pm.md\n' +
      'new file mode 100644\n' +
      'index 0000000..abc1234\n' +
      '--- /dev/null\n' +
      '+++ b/agents/pm.md\n' +
      '@@ -0,0 +1,2 @@\n' +
      '+name: pm\n' +
      '+last_updated: 2026-10-02\n';
    expect(isMetadataOnlyChange(diff)).toBe(false); // has a +name: line
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
  }, 20000); // git subprocesses are slow on loaded windows runners (run 37207767453)

  test('returns null outside a git repository', () => {
    const dir = mkdtempSync(join(tmpdir(), 'alc-no-git-'));
    writeFileSync(join(dir, 'agents.md'), 'no git here\n', 'utf-8');
    expect(lastContentCommitDate(join(dir, 'agents.md'))).toBeNull();
  });

  test('metadata-only bump: content commit (d1) then metadata-only bump (d2) -> returns d1', () => {
    const dir = initRepo();
    // d1: Create file with name and last_updated
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-09-01\n---\nPM description\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): initial pm.md'], {
      GIT_AUTHOR_DATE: '2026-09-01T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-09-01T12:00:00 +0000',
    });
    // d2: Bump only last_updated (metadata-only change)
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-10-02\n---\nPM description\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'chore(agents): bump pm.md last_updated'], {
      GIT_AUTHOR_DATE: '2026-10-02T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-10-02T12:00:00 +0000',
    });
    // Should return d1 because d2 is metadata-only
    expect(lastContentCommitDate(join(dir, 'pm.md'), dir)).toBe('2026-09-01');
  }, 30_000);

  test('metadata-only rejection: bump commit that also edits body -> returns bump date', () => {
    const dir = initRepo();
    // d1: Create file
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-09-01\n---\nPM description\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): initial pm.md'], {
      GIT_AUTHOR_DATE: '2026-09-01T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-09-01T12:00:00 +0000',
    });
    // d2: Edit both last_updated and description (not metadata-only)
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-10-02\n---\nPM description updated\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): update pm.md description and bump last_updated'], {
      GIT_AUTHOR_DATE: '2026-10-02T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-10-02T12:00:00 +0000',
    });
    // Should return d2 because it has body changes
    expect(lastContentCommitDate(join(dir, 'pm.md'), dir)).toBe('2026-10-02');
  }, 30_000);

  test('mixed sequence: metadata-only + sync-only -> returns earliest content date', () => {
    const dir = initRepo();
    // d1: content
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-09-01\n---\nContent\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): initial pm.md'], {
      GIT_AUTHOR_DATE: '2026-09-01T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-09-01T12:00:00 +0000',
    });
    // d2: metadata-only bump
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-10-01\n---\nContent\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'chore(agents): bump pm.md last_updated'], {
      GIT_AUTHOR_DATE: '2026-10-01T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-10-01T12:00:00 +0000',
    });
    // d3: sync-only (template sync)
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-10-01\n---\nContent synced\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'chore(upgrade): template sync v0.8.1'], {
      GIT_AUTHOR_DATE: '2026-10-02T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-10-02T12:00:00 +0000',
    });
    // Should return d1 (both d2 and d3 are skipped)
    expect(lastContentCommitDate(join(dir, 'pm.md'), dir)).toBe('2026-09-01');
  }, 30_000);

  test('regression: content commit after last_updated -> isFrontmatterStale true', () => {
    const dir = initRepo();
    // d1: Create with last_updated: 2026-09-01
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-09-01\n---\nContent\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): initial pm.md'], {
      GIT_AUTHOR_DATE: '2026-09-01T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-09-01T12:00:00 +0000',
    });
    // d2: Content edit at 2026-09-15 (without updating last_updated)
    writeFileSync(
      join(dir, 'pm.md'),
      'name: pm\nlast_updated: 2026-09-01\n---\nContent updated\n',
      'utf-8'
    );
    git(dir, ['add', 'pm.md']);
    git(dir, ['commit', '-m', 'docs(agents): update pm.md'], {
      GIT_AUTHOR_DATE: '2026-09-15T12:00:00 +0000',
      GIT_COMMITTER_DATE: '2026-09-15T12:00:00 +0000',
    });
    // lastContentCommitDate should return 2026-09-15 (the edit, not the initial commit)
    const contentDate = lastContentCommitDate(join(dir, 'pm.md'), dir);
    expect(contentDate).toBe('2026-09-15');
    // isFrontmatterStale should be true: 2026-09-01 < 2026-09-15
    expect(isFrontmatterStale('2026-09-01', contentDate!)).toBe(true);
  }, 30_000);
});
