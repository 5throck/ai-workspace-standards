/**
 * Integration test for upgrade-project.ts's TEMPLATE TREE SYNC pass
 * (2026-09-11-upgrade-policy-coverage-design.md): template files with no dedicated claiming
 * pass must now reach existing projects — the variant docs tree, .github/, platform
 * settings.json (JSON-merged), root stragglers — while project-owned files stay untouched.
 *
 * @version 1.0.0
 */
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const upgradeScript = join(workspaceRoot, 'scripts', 'upgrade-project.ts');
const VARIANT = 'co-develop';

function makeTempProject(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'upgrade-tree-sync-'));
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

describe('upgrade-project.ts TEMPLATE TREE SYNC', () => {
  test('dry-run reports NEW for uncovered docs and .github files and writes nothing', () => {
    const tmp = makeTempProject();
    try {
      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 180000 }
      );

      if (result.status !== 0) {
        console.error('--- dry-run spawn failed ---');
        console.error('status:', result.status, 'signal:', result.signal, 'error:', result.error);
        console.error('stderr:', (result.stderr ?? '').slice(0, 3000));
        console.error('stdout:', (result.stdout ?? '').slice(0, 3000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('TEMPLATE TREE SYNC');
      expect(out).toContain('NEW    docs/user-guide.md');
      expect(out).toContain('NEW    .github/CODEOWNERS');
      expect(out).toContain('NEW    .editorconfig');
      // Dry-run must not have written anything.
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(false);
      expect(existsSync(join(tmp, '.github'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('apply run delivers uncovered files, preserves project-owned files, JSON-merges settings', () => {
    const tmp = makeTempProject();
    try {
      // Pre-seed project-owned state (files upgrade must never clobber)
      mkdirSync(join(tmp, 'docs', 'designs'), { recursive: true });
      writeFileSync(join(tmp, 'docs', 'README.md'), '# Custom project docs index\n');
      writeFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), '# Project-local design note\n');
      // Pre-seed platform settings with a project-only permission grant
      writeFileSync(join(tmp, '.claude', 'settings.json'), JSON.stringify({
        permissions: { allow: ['Bash(my-project-tool *)'] },
        projectFlag: true,
      }, null, 2) + '\n');

      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: pre-upgrade'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';
      expect(out).toContain('Tree-sync delivered');

      // Delivered: previously-uncovered template files now reach the project
      expect(existsSync(join(tmp, 'docs', 'user-guide.md'))).toBe(true);
      expect(existsSync(join(tmp, 'docs', 'handoff-spec.md'))).toBe(true);
      expect(existsSync(join(tmp, '.github', 'CODEOWNERS'))).toBe(true);
      expect(existsSync(join(tmp, '.editorconfig'))).toBe(true);

      // Preserved: project-owned files untouched
      expect(readFileSync(join(tmp, 'docs', 'README.md'), 'utf8')).toBe('# Custom project docs index\n');
      expect(readFileSync(join(tmp, 'docs', 'designs', 'local-note.md'), 'utf8')).toBe('# Project-local design note\n');

      // JSON-merged: template settings keys arrived, project-only entries survived.
      // co-develop ships its own .claude/settings.json (variant-first scaffold parity):
      // its allow entries are ['WebSearch(*)', 'WebFetch(*)'].
      const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
      expect(settings.projectFlag).toBe(true);
      expect(settings.permissions.allow).toContain('Bash(my-project-tool *)');
      expect(settings.permissions.allow).toContain('WebSearch(*)');
      expect(out).toContain('MERGE  .claude/settings.json');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 120000);
});
