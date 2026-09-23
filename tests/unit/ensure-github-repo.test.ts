/**
 * Unit tests for scripts/ensure-github-repo.ts pure helpers — pre-adoption
 * GitHub repo readiness (check → create → push → VERIFY).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  buildCreateArgs, findGithubRemote, headOnRemote, parseGitRemotes, parseOwnerRepo, slugifyRepoName,
} from '../../scripts/ensure-github-repo.ts';

describe('parseGitRemotes', () => {
  test('parses fetch lines and dedupes push duplicates', () => {
    const out = [
      'origin\thttps://github.com/acme/widget.git (fetch)',
      'origin\thttps://github.com/acme/widget.git (push)',
      'upstream\tgit@github.com:acme/monorepo.git (fetch)',
    ].join('\n');
    const remotes = parseGitRemotes(out);
    expect(remotes).toEqual([
      { name: 'origin', url: 'https://github.com/acme/widget.git' },
      { name: 'upstream', url: 'git@github.com:acme/monorepo.git' },
    ]);
  });

  test('empty output yields no remotes', () => {
    expect(parseGitRemotes('')).toEqual([]);
  });
});

describe('parseOwnerRepo', () => {
  test('handles https, ssh, git protocol, and .git suffixes', () => {
    expect(parseOwnerRepo('https://github.com/acme/widget.git')).toBe('acme/widget');
    expect(parseOwnerRepo('https://github.com/acme/widget')).toBe('acme/widget');
    expect(parseOwnerRepo('git@github.com:acme/widget.git')).toBe('acme/widget');
    expect(parseOwnerRepo('ssh://git@github.com/acme/widget.git')).toBe('acme/widget');
  });

  test('returns null for non-github remotes', () => {
    expect(parseOwnerRepo('https://gitlab.com/acme/widget.git')).toBeNull();
    expect(parseOwnerRepo('/some/local/path')).toBeNull();
  });
});

describe('findGithubRemote', () => {
  test('picks the github remote among several', () => {
    const hit = findGithubRemote([
      { name: 'gitlab', url: 'https://gitlab.com/a/b.git' },
      { name: 'origin', url: 'git@github.com:a/b.git' },
    ]);
    expect(hit?.name).toBe('origin');
    expect(findGithubRemote([{ name: 'gitlab', url: 'https://gitlab.com/a/b.git' }])).toBeNull();
  });
});

describe('slugifyRepoName', () => {
  test('slugifies directory names into legal GitHub repo names', () => {
    expect(slugifyRepoName('My Legacy App')).toBe('my-legacy-app');
    expect(slugifyRepoName('abap_vibe_coding')).toBe('abap_vibe_coding'.replace(/[^a-z0-9._-]+/g, '-'));
    expect(slugifyRepoName('--weird__name--')).toBe('weird__name'); // trailing dashes stripped
    expect(slugifyRepoName('한글 프로젝트')).toBe('project');
  });
});

describe('buildCreateArgs', () => {
  test('private by default, pushes, targets org when given', () => {
    expect(buildCreateArgs({ name: 'widget', visibility: 'private', source: '/p/widget', remote: 'origin', push: true }))
      .toEqual(['repo', 'create', 'widget', '--private', '--source', '/p/widget', '--remote', 'origin', '--push']);
    expect(buildCreateArgs({ name: 'widget', org: 'acme', visibility: 'public', source: '/p/widget', remote: 'origin', push: true }))
      .toEqual(['repo', 'create', 'acme/widget', '--public', '--source', '/p/widget', '--remote', 'origin', '--push']);
  });
});

describe('headOnRemote', () => {
  const ls = [
    'f00dfeed00000000000000000000000000000000\trefs/heads/main',
    'deadbeef00000000000000000000000000000000\trefs/heads/develop',
  ].join('\n');
  const sha = 'f00dfeed00000000000000000000000000000000';

  test('confirms the sha on any branch when branch unknown', () => {
    expect(headOnRemote(ls, sha)).toBe(true);
  });

  test('confirms the sha on the named branch and rejects wrong branch/sha', () => {
    expect(headOnRemote(ls, sha, 'main')).toBe(true);
    expect(headOnRemote(ls, sha, 'develop')).toBe(false);
    expect(headOnRemote(ls, 'deadbeef00000000000000000000000000000000', 'main')).toBe(false);
    expect(headOnRemote(ls, '')).toBe(false);
  });
});
