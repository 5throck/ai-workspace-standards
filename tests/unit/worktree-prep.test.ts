#!/usr/bin/env bun
// @version 1.0.0
// worktree-prep.test.ts — U-20261128-005 (spec
// docs/designs/2026-11-28-sync-worktree-robustness-design.md §5.5).
//
// Pins dev-sync's self-provisioning helpers:
//   - enumerateNestedPackages: depth-2 package.json scan finding app/web-next
//     and packages/*, skipping external/, Projects/, node_modules interiors,
//     and dot-dirs; entries carry hasNodeModules (the absent-filter the runner
//     applies);
//   - pythonProvisionCommand: declared / absent / malformed manifest cases;
//   - runEnvironmentPrep: workspace-root context disables the step; a warm
//     fixture (nested node_modules present + .venv present) is a ZERO-SPAWN
//     no-op (idempotency regression); a fresh fixture installs nested packages
//     once and runs the declared provision hook once with --soft; failures
//     degrade to warnings (non-fatal step); dry-run plans without spawning.

import { describe, test, expect, beforeEach, afterEach, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { enumerateNestedPackages, pythonProvisionCommand, runEnvironmentPrep } from '../../scripts/lib/worktree-prep.ts';

const TEMP_BASE = join(import.meta.dir, '..', '.temp');
const SCRATCH = join(TEMP_BASE, 'worktree-prep-test');

const createdDirs: string[] = [];
afterAll(() => {
  for (const dir of createdDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixtureRoot(tag: string): string {
  mkdirSync(TEMP_BASE, { recursive: true });
  const dir = mkdtempSync(join(TEMP_BASE, `worktree-prep-${tag}-`));
  createdDirs.push(dir);
  return dir;
}

function writePkg(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: dir.split(/[\\/]/).pop(), private: true }), 'utf8');
}

describe('enumerateNestedPackages — depth-2 scan with exclusions (design §5.5)', () => {
  let root: string;
  beforeEach(() => {
    root = fixtureRoot('enum');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('finds depth-1 and depth-2 packages; carries hasNodeModules', () => {
    writePkg(join(root, 'tools', 'cli'));
    writePkg(join(root, 'app', 'web-next'));
    writePkg(join(root, 'packages', 'core-scoring'));
    const entries = enumerateNestedPackages(root);
    const names = entries.map((e) => e.name).sort();
    expect(names).toEqual(['app/web-next', 'packages/core-scoring', 'tools/cli']);
    expect(entries.every((e) => e.hasNodeModules === false)).toBe(true);
  });

  test('skips external/, Projects/, node_modules interiors, dot-dirs, and files', () => {
    writePkg(join(root, 'external', 'humanize'));
    writePkg(join(root, 'Projects', 'co-something'));
    writePkg(join(root, '.cache', 'hidden-pkg'));
    writePkg(join(root, 'app', 'web-next'));
    mkdirSync(join(root, 'app', 'web-next', 'node_modules'), { recursive: true }); // provisioned already
    writeFileSync(join(root, 'loose-file-package.json'), '{}', 'utf8');
    const entries = enumerateNestedPackages(root);
    expect(entries.map((e) => e.name)).toEqual(['app/web-next']);
    expect(entries[0].hasNodeModules).toBe(true);
  });

  test('absent root or unreadable dir yields [] (never throws)', () => {
    expect(enumerateNestedPackages(join(root, 'does-not-exist'))).toEqual([]);
  });
});

describe('pythonProvisionCommand — script_manifest.provision.python (design §5.2)', () => {
  test('declared → the script path (trimmed)', () => {
    expect(pythonProvisionCommand({ script_manifest: { provision: { python: ' scripts/co-x/setup-python-env.ts ' } } })).toEqual({
      script: 'scripts/co-x/setup-python-env.ts',
    });
  });
  test('absent manifest / absent provision / non-string / empty → null', () => {
    expect(pythonProvisionCommand({})).toBeNull();
    expect(pythonProvisionCommand({ script_manifest: {} })).toBeNull();
    expect(pythonProvisionCommand({ script_manifest: { provision: {} } })).toBeNull();
    expect(pythonProvisionCommand({ script_manifest: { provision: { python: 42 } } })).toBeNull();
    expect(pythonProvisionCommand({ script_manifest: { provision: { python: '' } } })).toBeNull();
    expect(pythonProvisionCommand(null)).toBeNull();
    expect(pythonProvisionCommand('nope')).toBeNull();
  });
});

describe('runEnvironmentPrep — runner semantics (design §5.3/§5.5)', () => {
  let root: string;
  beforeEach(() => {
    root = fixtureRoot('run');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('workspace-root context (no variant.json) disables the step — zero spawns', async () => {
    const calls: unknown[][] = [];
    const report = await runEnvironmentPrep(root, { exec: async (cmd) => (calls.push(cmd), { exitCode: 0 }) });
    expect(report.disabled).toBe(true);
    expect(calls).toEqual([]);
  });

  test('warm fixture: nothing to install, venv present → zero-spawn no-op (idempotency regression)', async () => {
    writeFileSync(join(root, 'variant.json'), JSON.stringify({ script_manifest: { provision: { python: 'setup.ts' } } }), 'utf8');
    writePkg(join(root, 'app', 'web-next'));
    mkdirSync(join(root, 'app', 'web-next', 'node_modules'), { recursive: true });
    mkdirSync(join(root, '.venv', 'bin'), { recursive: true });
    writeFileSync(join(root, '.venv', 'bin', 'python3'), '#!/bin/sh\n', 'utf8');
    const calls: string[][] = [];
    const report = await runEnvironmentPrep(root, { exec: async (cmd) => (calls.push(cmd), { exitCode: 0 }) });
    expect(report.disabled).toBe(false);
    expect(report.nestedInstalled).toEqual([]);
    expect(report.nestedSkipped.map((d) => d.split(/[\\/]/).slice(-2).join('/'))).toEqual(['app/web-next']);
    expect(report.python).toBe('present');
    expect(calls).toEqual([]);
  });

  test('fresh fixture: nested install once per absent-node_modules dir + declared hook once with --soft', async () => {
    writeFileSync(join(root, 'variant.json'), JSON.stringify({ script_manifest: { provision: { python: 'scripts/setup-python-env.ts' } } }), 'utf8');
    writePkg(join(root, 'app', 'web-next'));
    writePkg(join(root, 'mcp', 'co-x'));
    mkdirSync(join(root, 'app', 'web-next2'), { recursive: true });
    writePkg(join(root, 'app', 'web-next2'));
    mkdirSync(join(root, 'app', 'web-next2', 'node_modules'), { recursive: true });
    mkdirSync(join(root, 'scripts'), { recursive: true });
    writeFileSync(join(root, 'scripts', 'setup-python-env.ts'), 'export {};\n', 'utf8');
    const calls: { cmd: string[]; cwd: string }[] = [];
    const report = await runEnvironmentPrep(root, { exec: async (cmd, cwd) => (calls.push({ cmd, cwd }), { exitCode: 0 }) });
    expect(report.nestedInstalled.length).toBe(2);
    expect(report.python).toBe('ran');
    // Install targets exclude the node_modules-present dir; every install runs IN its dir.
    for (const call of calls.filter((c) => c.cmd[1] === 'install')) {
      expect(call.cwd).not.toContain('web-next2');
    }
    const provisionCall = calls.find((c) => c.cmd[1] !== 'install');
    expect(provisionCall).toBeDefined();
    expect(provisionCall!.cmd).toEqual(['bun', 'scripts/setup-python-env.ts', '--soft']);
    expect(provisionCall!.cwd).toBe(root);
  });

  test('failures degrade to warnings (non-fatal step): install exit 1, hook exit 1, missing hook script', async () => {
    writeFileSync(join(root, 'variant.json'), JSON.stringify({ script_manifest: { provision: { python: 'scripts/absent-hook.ts' } } }), 'utf8');
    writePkg(join(root, 'app', 'web-next'));
    const calls: string[][] = [];
    const report = await runEnvironmentPrep(root, { exec: async (cmd) => (calls.push(cmd), { exitCode: 1, stderr: 'boom' }) });
    expect(report.nestedInstalled).toEqual([]);
    expect(report.warnings.some((w) => w.includes('bun install in'))).toBe(true);
    expect(report.python).toBe('failed-soft');
    expect(report.warnings.some((w) => w.includes('provision script missing'))).toBe(true);
    expect(calls.length).toBe(1); // install attempted; hook script missing → never spawned
  });

  test('dry-run plans without spawning', async () => {
    writeFileSync(join(root, 'variant.json'), JSON.stringify({ script_manifest: { provision: { python: 'setup.ts' } } }), 'utf8');
    writePkg(join(root, 'app', 'web-next'));
    const calls: string[][] = [];
    const report = await runEnvironmentPrep(root, { dryRun: true, exec: async (cmd) => (calls.push(cmd), { exitCode: 0 }) });
    expect(report.nestedInstalled.length).toBe(1);
    expect(report.python).toBe('planned');
    expect(calls).toEqual([]);
  });
});
