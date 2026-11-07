/**
 * Behavioral test for scripts/fleet-list.ts v1.0.0 (design
 * docs/designs/2026-11-07-fleet-membership-ssot-design.md §5/§9.2,
 * DEC-20261107-01) — the fleet membership SSOT wrapper CLI. Fixture
 * workspaces via mkdtempSync + `--root` (the CLI's root override; equivalent
 * to the design's process.chdir fixture but without mutating process state).
 */

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const CLI = join(REPO_ROOT, 'scripts', 'fleet-list.ts');

function makeFixture(opts: { projects: string[]; registry?: string }): string {
  const root = mkdtempSync(join(tmpdir(), 'fleet-list-'));
  for (const p of opts.projects) mkdirSync(join(root, 'Projects', p), { recursive: true });
  if (opts.registry !== undefined) {
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'docs', 'fleet-membership.json'), opts.registry);
  }
  return root;
}

function runCli(root: string, extraArgs: string[] = []): { stdout: string; stderr: string; status: number } {
  const r = spawnSync('bun', [CLI, '--root', root, ...extraArgs], { encoding: 'utf-8' });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

describe('fleet-list CLI (§9.2 wrapper behavioral test)', () => {
  test('default output prints only member paths, one per line, sorted', () => {
    const root = makeFixture({
      projects: ['co-real', 'co-excluded-tool', 'co-another'],
      registry: JSON.stringify({
        version: 1,
        excluded: [{ id: 'co-excluded-tool', reason: 'standalone tool', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }],
      }),
    });
    try {
      const { stdout, stderr, status } = runCli(root);
      expect(status).toBe(0);
      expect(stderr).toBe('');
      expect(stdout.split('\n').filter(Boolean)).toEqual(['Projects/co-another', 'Projects/co-real']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('--json reports {"root",count,projects,excluded:[{id,decided,decision_ref}]}', () => {
    const root = makeFixture({
      projects: ['co-real', 'co-excluded-tool'],
      registry: JSON.stringify({
        version: 1,
        excluded: [{ id: 'co-excluded-tool', reason: 'standalone tool', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }],
      }),
    });
    try {
      const { stdout, status } = runCli(root, ['--json']);
      expect(status).toBe(0);
      const parsed = JSON.parse(stdout) as { root: string; count: number; projects: string[]; excluded: Array<{ id: string; decided: string; decision_ref: string }> };
      expect(parsed.root).toBe(root);
      expect(parsed.count).toBe(1);
      expect(parsed.projects).toEqual(['Projects/co-real']);
      expect(parsed.excluded).toEqual([{ id: 'co-excluded-tool', decided: '2026-11-07', decision_ref: 'DEC-20261107-01' }]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('registry absent → historical glob behavior, exit 0', () => {
    const root = makeFixture({ projects: ['co-real', 'co-excluded-tool'] });
    try {
      const { stdout, status } = runCli(root);
      expect(status).toBe(0);
      expect(stdout.split('\n').filter(Boolean)).toEqual(['Projects/co-excluded-tool', 'Projects/co-real']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('malformed registry → exit non-zero with the malformed detail (fail-closed, §7)', () => {
    const root = makeFixture({ projects: ['co-real'], registry: '{"version": 99, "excluded": []}' });
    try {
      const { stdout, stderr, status } = runCli(root);
      expect(status).not.toBe(0);
      expect(stdout).toBe('');
      expect(stderr).toMatch(/Malformed fleet registry.*version must be 1/s);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
