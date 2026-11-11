/**
 * scripts/lib/template-vintage.ts (overwrite-protection design E3, DEC-20261111-01 PR-B):
 * git-blob-id parity with `git hash-object`, CRLF-normalized match, multi-root lookup, the
 * horizon bound, and blob text readback. Fixtures are throwaway git repos with dated commits.
 *
 * @version 1.0.0
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect, afterAll } from 'bun:test';

import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import {
  blobIdOf,
  blobIdsFor,
  loadTemplateBlobHistory,
  readBlobTexts,
  vintageMatch,
} from '../../scripts/lib/template-vintage.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const tmpDirs: string[] = [];
afterAll(() => {
  for (const d of tmpDirs) rmSync(d, { recursive: true, force: true });
});

const git = (cwd: string, args: string[], env: Record<string, string> = {}, input?: string): string =>
  spawnSync('git', ['-C', cwd, ...args], {
    env: { ...gitCleanEnv(), ...env },
    encoding: 'utf8',
    input,
  }).stdout ?? '';

function makeRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'template-vintage-'));
  tmpDirs.push(dir);
  assertCallerEnvSafeForGitFixtures(dir);
  spawnSync('git', ['init', '-q'], { cwd: dir, env: gitCleanEnv(), stdio: ['ignore', 'pipe', 'pipe'] });
  assertFixtureGitIdentity(dir);
  git(dir, ['config', 'user.email', 'test@example.com']);
  git(dir, ['config', 'user.name', 'Test']);
  git(dir, ['config', 'core.autocrlf', 'false']);
  return dir;
}

function commit(dir: string, files: Record<string, string>, isoDate: string): void {
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', `c ${isoDate}`], { GIT_AUTHOR_DATE: isoDate, GIT_COMMITTER_DATE: isoDate });
}

describe('blobIdOf — parity with git hash-object', () => {
  const samples = ['', 'x', 'hello\n', 'line1\nline2\r\nline3\n', 'ünïcödé — 한글 ✓\n', 'a\0b\n'.replace('\0', '')];
  test('matches `git hash-object --stdin` for ascii, empty, CRLF and multibyte content', () => {
    const dir = makeRepo();
    for (const s of samples) {
      const expected = git(dir, ['hash-object', '--stdin'], {}, s).trim();
      expect(blobIdOf(s)).toBe(expected);
    }
  });
});

describe('loadTemplateBlobHistory / vintageMatch', () => {
  const dir = makeRepo();
  const v1 = '// @version 1.0.0\nold body\n';
  const v2 = '// @version 1.0.0\nreformatted body\n';
  const v3 = '// @version 1.1.0\nnew body\n';
  commit(dir, { 'templates/co-x/scripts/old.ts': 'ancient\n' }, '2026-01-15T00:00:00Z');
  commit(dir, { 'templates/co-x/scripts/a.ts': v1, 'templates/common/scripts/b.ts': 'b1\n' }, '2026-07-01T00:00:00Z');
  commit(dir, { 'templates/co-x/scripts/a.ts': v2 }, '2026-08-01T00:00:00Z');
  commit(dir, { 'templates/co-x/scripts/a.ts': v3, 'templates/common/scripts/b.ts': 'b2\n' }, '2026-09-01T00:00:00Z');

  test('records every historical blob of a path (one spawn per root)', () => {
    const h = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-06-01');
    const blobs = h.get('templates/co-x/scripts/a.ts');
    expect(blobs?.has(blobIdOf(v1))).toBe(true);
    expect(blobs?.has(blobIdOf(v2))).toBe(true);
    expect(blobs?.has(blobIdOf(v3))).toBe(true);
    expect(vintageMatch('scripts/a.ts', v1, ['templates/co-x/scripts/a.ts'], h)).toBe(true);
    expect(vintageMatch('scripts/a.ts', v2, ['templates/co-x/scripts/a.ts'], h)).toBe(true);
    expect(vintageMatch('scripts/a.ts', 'project authored\n', ['templates/co-x/scripts/a.ts'], h)).toBe(false);
  });

  test('CRLF-normalized match: a CRLF checkout of a vintage blob still matches', () => {
    const h = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-06-01');
    const crlf = v1.replace(/\n/g, '\r\n');
    expect(crlf).not.toBe(v1);
    expect(vintageMatch('scripts/a.ts', crlf, ['templates/co-x/scripts/a.ts'], h)).toBe(true);
  });

  test('multi-root lookup: candidates span variant and common roots; a path only matches its own history', () => {
    const h = loadTemplateBlobHistory(dir, ['templates/co-x', 'templates/common'], '2026-06-01');
    expect(h.has('templates/common/scripts/b.ts')).toBe(true);
    const cands = ['templates/co-x/scripts/b.ts', 'templates/common/scripts/b.ts'];
    expect(vintageMatch('scripts/b.ts', 'b1\n', cands, h)).toBe(true);
    expect(vintageMatch('scripts/b.ts', 'b2\n', cands, h)).toBe(true);
    // a.ts content is not in b.ts's history
    expect(vintageMatch('scripts/b.ts', v1, cands, h)).toBe(false);
    // a root that was not loaded contributes nothing
    const only = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-06-01');
    expect(vintageMatch('scripts/b.ts', 'b1\n', cands, only)).toBe(false);
  });

  test('horizon bound: revisions older than `since` are not consulted', () => {
    const wide = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-01-01');
    const bounded = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-06-01');
    expect(vintageMatch('scripts/old.ts', 'ancient\n', ['templates/co-x/scripts/old.ts'], wide)).toBe(true);
    expect(vintageMatch('scripts/old.ts', 'ancient\n', ['templates/co-x/scripts/old.ts'], bounded)).toBe(false);
    // a tighter horizon also drops the July revision of a.ts
    const tight = loadTemplateBlobHistory(dir, ['templates/co-x'], '2026-07-15');
    expect(vintageMatch('scripts/a.ts', v1, ['templates/co-x/scripts/a.ts'], tight)).toBe(false);
    expect(vintageMatch('scripts/a.ts', v2, ['templates/co-x/scripts/a.ts'], tight)).toBe(true);
  });

  test('deleted revisions (all-zero post-image) never enter the history; unknown paths and a bad repo are empty', () => {
    const d2 = makeRepo();
    commit(d2, { 'templates/common/x.md': 'x\n' }, '2026-07-01T00:00:00Z');
    git(d2, ['rm', '-q', 'templates/common/x.md']);
    git(d2, ['commit', '-q', '-m', 'rm'], { GIT_AUTHOR_DATE: '2026-08-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-08-01T00:00:00Z' });
    const h = loadTemplateBlobHistory(d2, ['templates/common'], '2026-06-01');
    const blobs = [...(h.get('templates/common/x.md') ?? [])];
    expect(blobs).toEqual([blobIdOf('x\n')]);
    expect(loadTemplateBlobHistory(tmpdir(), ['templates/common'], '2026-06-01').size).toBe(0);
  });

  test('readBlobTexts round-trips the historical blob contents (multi-blob, multibyte)', () => {
    const d3 = makeRepo();
    const a = '한글 first\n';
    const b = 'second ✓\n';
    commit(d3, { 'templates/common/m.md': a }, '2026-07-01T00:00:00Z');
    commit(d3, { 'templates/common/m.md': b }, '2026-08-01T00:00:00Z');
    const h = loadTemplateBlobHistory(d3, ['templates/common'], '2026-06-01');
    const ids = blobIdsFor(['templates/common/m.md', 'templates/common/missing.md'], h);
    expect(ids.length).toBe(2);
    expect(readBlobTexts(d3, ids).sort()).toEqual([a, b].sort());
    expect(readBlobTexts(d3, [])).toEqual([]);
  });
});
