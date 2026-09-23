/**
 * upgrade-project.ts PRUNE REMOVED — registry-aware scripts/ prune (v1.44.0).
 *
 * Spec: docs/designs/2026-09-23-upgrade-engine-l0-only-completion-design.md
 * Tickets: T-20260923-003 (the co-newbiz deploy-web.ts false prune).
 *
 * Contract under test:
 *   (a) a scripts/SCRIPTS.md row whose source cell names the project variant
 *       marks a project-local script — absence from the template is its normal
 *       state, so the prune keeps file and row (KEEP verdict);
 *   (b) a registered script whose source is `L0` and whose file is absent from
 *       the template is pruned AND its registry row is dropped (no ghost row
 *       for verify-scripts);
 *   (c) an unregistered foreign script is pruned (legacy behavior unchanged).
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

const REGISTRY_HEADER = `# Script Registry

<!-- verify-scripts.ts parses rows between the Registry header and the next ## header. -->

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
`;

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-prune-removed-'));
  spawnSync('git', ['init', '-q'], { cwd: tmp });
  spawnSync('git', ['-C', tmp, 'config', 'user.email', 'test@example.com'], { cwd: tmp });
  spawnSync('git', ['-C', tmp, 'config', 'user.name', 'Test'], { cwd: tmp });
  mkdirSync(join(tmp, '.claude'), { recursive: true });
  writeFileSync(
    join(tmp, '.claude', 'template-version.txt'),
    `variant=${VARIANT}\nversion=0.0.0\ncountry=none\n`
  );
  return tmp;
}

function seedScriptRegistry(tmp: string, rows: string[]): void {
  mkdirSync(join(tmp, 'scripts'), { recursive: true });
  writeFileSync(join(tmp, 'scripts', 'SCRIPTS.md'), REGISTRY_HEADER + rows.join('\n') + '\n');
}

function registryContains(tmp: string, name: string): boolean {
  const content = readFileSync(join(tmp, 'scripts', 'SCRIPTS.md'), 'utf8');
  return content.includes(`| \`${name}\` |`);
}

describe('upgrade-project.ts PRUNE REMOVED (registry-aware, v1.44.0)', () => {
  test('project-local registered script survives the prune with its row', () => {
    const tmp = makeTempProject();
    try {
      seedScriptRegistry(tmp, [
        '| `deploy-web.ts` | co-develop | 1.0.0 | active | —| —| L3 | —|',
      ]);
      writeFileSync(join(tmp, 'scripts', 'deploy-web.ts'), 'export const LOCAL = 1;\n');
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: pre-upgrade'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--prune-removed', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-2000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('KEEP   scripts/deploy-web.ts');
      expect(out).not.toContain('PRUNE  scripts/deploy-web.ts');
      expect(existsSync(join(tmp, 'scripts', 'deploy-web.ts'))).toBe(true);
      expect(registryContains(tmp, 'deploy-web.ts')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('registered L0-source script absent from template is pruned and its row dropped', () => {
    const tmp = makeTempProject();
    try {
      seedScriptRegistry(tmp, [
        '| `sync-agent-status.ts` | L0 | 1.2.0 | active | —| —| L0 | —|',
        '| `deploy-web.ts` | co-develop | 1.0.0 | active | —| —| L3 | —|',
      ]);
      writeFileSync(join(tmp, 'scripts', 'sync-agent-status.ts'), 'export const RETIRED = 1;\n');
      writeFileSync(join(tmp, 'scripts', 'deploy-web.ts'), 'export const LOCAL = 1;\n');
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: pre-upgrade'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--prune-removed', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('PRUNE  scripts/sync-agent-status.ts');
      expect(existsSync(join(tmp, 'scripts', 'sync-agent-status.ts'))).toBe(false);
      // The L0 row is dropped with the file; the project-local row and file survive.
      expect(registryContains(tmp, 'sync-agent-status.ts')).toBe(false);
      expect(existsSync(join(tmp, 'scripts', 'deploy-web.ts'))).toBe(true);
      expect(registryContains(tmp, 'deploy-web.ts')).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('unregistered foreign script is pruned (legacy behavior unchanged)', () => {
    const tmp = makeTempProject();
    try {
      seedScriptRegistry(tmp, []);
      writeFileSync(join(tmp, 'scripts', 'stray-foreign.ts'), 'export const STRAY = 1;\n');
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: pre-upgrade'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--prune-removed', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('PRUNE  scripts/stray-foreign.ts');
      expect(existsSync(join(tmp, 'scripts', 'stray-foreign.ts'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
