/**
 * Root-target guards added after the 2026-09-12 root-upgrade incident
 * (memory/2026-09-12.md): an upgrade-project run aimed at the workspace ROOT
 * delivered the whole template/L1 tree into the repo root, and new-project
 * scaffolded bare names directly into the root. These tests pin the guards:
 *
 *   - scripts/upgrade-project.ts rejects a workspace-ROOT <project-path>
 *   - scripts/new-project.ts resolves bare names under Projects/
 *   - scripts/new-project.ts rejects targets that escape the workspace
 *   - tests/reflect-skill-graph-to-project.ts rejects the workspace ROOT
 *
 * @version 1.0.0
 */
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');

describe('root-target guards (incident 2026-09-12)', () => {
  test('upgrade-project.ts rejects the workspace ROOT as <project-path>', () => {
    const result = spawnSync(
      'bun',
      ['scripts/upgrade-project.ts', '.'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('workspace ROOT');
    expect(out).toContain('L0, not a project');
  }, 30000);

  test('new-project.ts resolves bare names under Projects/ (existence pre-flight path)', () => {
    // The name `.` resolves to <root>/Projects, which exists — so the pre-flight
    // fails fast with the resolved path BEFORE any scaffold side effects run.
    // Under pre-1.16.0 behavior the message would have named the workspace root.
    const result = spawnSync(
      'bun',
      ['scripts/new-project.ts', '.', '--variant', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('Directory already exists');
    expect(out).toContain(join(workspaceRoot, 'Projects'));
  }, 30000);

  test('new-project.ts rejects targets that escape the workspace', () => {
    // An absolute path-like name resolves outside the workspace — the containment
    // guard must reject it before any filesystem work.
    const result = spawnSync(
      'bun',
      ['scripts/new-project.ts', '/tmp/project-target-guard-escape', '--variant', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 60000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('escapes the workspace');
  }, 30000);

  test('reflect-skill-graph-to-project.ts rejects the workspace ROOT', () => {
    const result = spawnSync(
      'bun',
      ['tests/reflect-skill-graph-to-project.ts', '.', 'co-develop'],
      { cwd: workspaceRoot, encoding: 'utf-8', timeout: 30000 }
    );
    expect(result.status).toBe(1);
    const out = (result.stderr ?? '') + (result.stdout ?? '');
    expect(out).toContain('workspace ROOT');
  }, 30000);
});
