#!/usr/bin/env bun
// @version 1.0.0
// contained-run-manifest-dir.test.ts — PM finding 2 (design
// docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md §4.9): the
// dependency location follows the manifest — the project root when it holds
// package.json, otherwise scripts/ when scripts/package.json exists. Each test
// spawns the real CLI on a temporary git project (the dirty-tree assertion needs
// a repository) and pins the exit code.

import { afterAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { gitCleanEnv } from '../../scripts/lib/git-env.ts';
import { assertCallerEnvSafeForGitFixtures, assertFixtureGitIdentity } from '../helpers/fixture-git.ts';

const SCRIPT = join(import.meta.dir, '..', '..', 'scripts', 'contained-run.ts');
const dirs: string[] = [];

function project(shape: { rootPkg?: Record<string, unknown>; scriptsPkg?: Record<string, unknown>; rootModules?: boolean; scriptsModules?: boolean }): string {
  const dir = mkdtempSync(join(tmpdir(), 'contained-run-manifest-'));
  dirs.push(dir);
  assertCallerEnvSafeForGitFixtures(dir);
  spawnSync('git', ['init', '-q'], { cwd: dir, env: gitCleanEnv(), stdio: 'ignore' });
  assertFixtureGitIdentity(dir);
  if (shape.rootPkg) writeFileSync(join(dir, 'package.json'), `${JSON.stringify(shape.rootPkg)}\n`);
  if (shape.scriptsPkg) {
    mkdirSync(join(dir, 'scripts'), { recursive: true });
    writeFileSync(join(dir, 'scripts', 'package.json'), `${JSON.stringify(shape.scriptsPkg)}\n`);
  }
  if (shape.rootModules) mkdirSync(join(dir, 'node_modules'), { recursive: true });
  if (shape.scriptsModules) mkdirSync(join(dir, 'scripts', 'node_modules'), { recursive: true });
  return dir;
}

function run(dir: string): { exit: number; out: string } {
  const r = spawnSync('bun', [SCRIPT, '--project', dir, '--', process.execPath, '-e', 'console.log("ran")'], {
    encoding: 'utf-8',
    timeout: 120000,
  });
  return { exit: r.status ?? -1, out: `${r.stdout}${r.stderr}` };
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('contained-run — dependency location (design §4.9)', () => {
  test('a scripts-scoped layout passes the dependency check', () => {
    const dir = project({ scriptsPkg: { name: 'project-scripts', version: '1.0.0' }, scriptsModules: true });
    const r = run(dir);
    expect(r.exit).toBe(0);
    expect(r.out).toContain('ran');
  });

  test('the same layout with a postinstall script in scripts/package.json exits 3', () => {
    const dir = project({
      scriptsPkg: { name: 'project-scripts', version: '1.0.0', scripts: { postinstall: 'node evil.js' } },
      scriptsModules: true,
    });
    const r = run(dir);
    expect(r.exit).toBe(3);
    expect(r.out).toContain('postinstall');
    expect(r.out).not.toContain('ran');
  });

  test('a root package.json keeps the root location (scripts/node_modules does not count)', () => {
    const withRootModules = project({ rootPkg: { name: 'p' }, scriptsPkg: { name: 's' }, rootModules: true });
    expect(run(withRootModules).exit).toBe(0);
    const onlyScriptsModules = project({ rootPkg: { name: 'p' }, scriptsPkg: { name: 's' }, scriptsModules: true });
    const r = run(onlyScriptsModules);
    expect(r.exit).toBe(3);
    expect(r.out).toContain('node_modules absent');
  });

  test('both manifests absent exits 3', () => {
    const dir = project({ rootModules: true });
    const r = run(dir);
    expect(r.exit).toBe(3);
    expect(r.out).toContain('no package.json');
  });

  test('the node_modules absence is reported against the scripts location', () => {
    const dir = project({ scriptsPkg: { name: 'project-scripts', version: '1.0.0' } });
    const r = run(dir);
    expect(r.exit).toBe(3);
    expect(r.out).toContain(join(dir, 'scripts'));
  });
});
