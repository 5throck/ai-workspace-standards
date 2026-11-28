#!/usr/bin/env bun
// @version 1.0.0
// contained-run-env.test.ts — U-20261128-001: the env allowlist forwards
// PLAYWRIGHT_BROWSERS_PATH when the caller sets it (v1.2.0 pass-through, like
// BUN_INSTALL_CACHE_DIR), and the contained PATH carries the directory of the
// `node` resolved from the inherited PATH (not just the runtime's dir). The
// credential deny-list properties are re-pinned here so the new pass-through
// cannot regress them. Each test spawns the real CLI on a temporary git project
// (same harness as contained-run-manifest-dir.test.ts) and prints the child
// environment for pinning.

import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const SCRIPT = join(import.meta.dir, '..', '..', 'scripts', 'contained-run.ts');
const dirs: string[] = [];

function project(): string {
  const dir = mkdtempSync(join(tmpdir(), 'contained-run-env-'));
  dirs.push(dir);
  assertCallerEnvSafeForGitFixtures(dir);
  spawnSync('git', ['init', '-q'], { cwd: dir, env: gitCleanEnv(), stdio: 'ignore' });
  assertFixtureGitIdentity(dir);
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: 'p', version: '1.0.0' })}\n`);
  mkdirSync(join(dir, 'node_modules'), { recursive: true });
  return dir;
}

// The child prints the env facts under pin as JSON on one line.
const PROBE = `console.log('ENVJSON:' + JSON.stringify({ path: process.env.PATH, pw: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null, bunCache: process.env.BUN_INSTALL_CACHE_DIR ?? null, home: process.env.HOME ?? null, gh: process.env.GITHUB_TOKEN ?? null, ghToken: process.env.GH_TOKEN ?? null, npm: process.env.NPM_TOKEN ?? null }))`;

function run(dir: string, extraEnv: Record<string, string>): { exit: number; env: Record<string, string | null> } {
  const r = spawnSync('bun', [SCRIPT, '--project', dir, '--', process.execPath, '-e', PROBE], {
    encoding: 'utf-8',
    timeout: 120000,
    env: { ...process.env, ...extraEnv },
  });
  const out = `${r.stdout}${r.stderr}`;
  const line = out.split('\n').find((l) => l.startsWith('ENVJSON:'));
  expect(line, `child did not print ENVJSON (exit ${r.status}): ${out.slice(0, 400)}`).toBeDefined();
  return { exit: r.status ?? -1, env: JSON.parse(line!.slice('ENVJSON:'.length)) };
}

function resolveNodeDir(): string | null {
  const probe = spawnSync('/bin/sh', ['-c', 'command -v node'], { encoding: 'utf-8' });
  const resolved = (probe.stdout ?? '').trim();
  if (probe.status !== 0 || !resolved.includes('/')) return null;
  return resolved.slice(0, resolved.lastIndexOf('/')) || null;
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('contained-run — env allowlist (U-20261128-001)', () => {
  test('PLAYWRIGHT_BROWSERS_PATH is forwarded when the caller sets it', () => {
    const dir = project();
    const { exit, env } = run(dir, { PLAYWRIGHT_BROWSERS_PATH: '/tmp/contained-run-env-test-browsers' });
    expect(exit).toBe(0);
    expect(env.pw).toBe('/tmp/contained-run-env-test-browsers');
  });

  test('PLAYWRIGHT_BROWSERS_PATH stays absent when the caller does not set it', () => {
    const dir = project();
    const { exit, env } = run(dir, { PLAYWRIGHT_BROWSERS_PATH: '' });
    expect(exit).toBe(0);
    expect(env.pw).toBeNull();
  });

  test('BUN_INSTALL_CACHE_DIR pass-through is unchanged', () => {
    const dir = project();
    const { exit, env } = run(dir, { BUN_INSTALL_CACHE_DIR: '/tmp/contained-run-env-test-bun-cache' });
    expect(exit).toBe(0);
    expect(env.bunCache).toBe('/tmp/contained-run-env-test-bun-cache');
  });

  test('the contained PATH carries the node dir resolved from the inherited PATH', () => {
    const nodeDir = resolveNodeDir();
    if (!nodeDir) {
      console.log('skip: node not resolvable in the test environment');
      return;
    }
    const dir = project();
    const { exit, env } = run(dir, {});
    expect(exit).toBe(0);
    const parts = (env.path ?? '').split(':');
    expect(parts).toContain(nodeDir);
  });

  test('HOME is still the scratch dir, never the caller home', () => {
    const dir = project();
    const { exit, env } = run(dir, {});
    expect(exit).toBe(0);
    expect(env.home).toContain('contained-home-');
    expect(env.home).not.toBe(process.env.HOME);
  });
});

describe('contained-run — credential deny-list is unchanged alongside the new pass-through', () => {
  test('GITHUB_TOKEN / GH_TOKEN / NPM_TOKEN sentinels never reach the child', () => {
    const dir = project();
    const { exit, env } = run(dir, {
      GITHUB_TOKEN: 'sentinel-gh-system',
      GH_TOKEN: 'sentinel-gh-short',
      NPM_TOKEN: 'sentinel-npm',
      PLAYWRIGHT_BROWSERS_PATH: '/tmp/contained-run-env-test-browsers',
    });
    expect(exit).toBe(0);
    expect(env.gh).toBeNull();
    expect(env.ghToken).toBeNull();
    expect(env.npm).toBeNull();
    // The one sanctioned pass-through still works next to the denied set.
    expect(env.pw).toBe('/tmp/contained-run-env-test-browsers');
  });
});
