/**
 * upgrade-project.ts PRUNE REMOVED — registry-aware scripts/ prune (v1.45.1).
 *
 * Spec: docs/designs/2026-09-23-upgrade-engine-l0-only-completion-design.md
 * Tickets: T-20260923-003 (the co-newbiz deploy-web.ts false prune).
 *
 * Contract under test (v1.45.1 semantics):
 *   A project script absent from the template tree is pruned ONLY when it has
 *   an UPSTREAM (L0/L1) SCRIPTS.md registry row — i.e. it was template-delivered
 *   and its absence means a retired delivery (the ADR-0073 Amendment 1 engine
 *   copies). Everything else — unregistered strays and project-owned scripts
 *   whatever their source cell claims — is KEEP-uncertain and survives
 *   (ADR-0031); verify-scripts owns registration hygiene at audit time.
 *
 * v1.1.0 (2026-09-24, platform-parity P1 bug 2 — spec
 *         docs/designs/2026-09-24-platform-parity-p1-bugfixes-design.md D2/D8):
 *         new VARIANT-SCOPE SKILL PRUNE describe block — a foreign-variant
 *         skill must be pruned from ALL FOUR platform mirrors; pre-fix the
 *         prune iterated a 4-element literal without .codex/skills, so the
 *         foreign skill's codex copy survived every prune run.
 *
 * @version 1.1.0
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

describe('upgrade-project.ts PRUNE REMOVED (upstream-row semantics, v1.45.1)', () => {
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

  test('retired delivery (upstream L0 row) is pruned with its row; delivered subdir scripts survive', () => {
    const tmp = makeTempProject();
    try {
      seedScriptRegistry(tmp, [
        '| `helpers/skills-registry.ts` | L0 | 1.0.0 | active | —| —| L0 | —|',
        '| `deploy-web.ts` | co-develop | 1.0.0 | active | —| —| L3 | —|',
      ]);
      mkdirSync(join(tmp, 'scripts', 'helpers'), { recursive: true });
      writeFileSync(join(tmp, 'scripts', 'helpers', 'skills-registry.ts'), 'export const HELPER = 1;\n');
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
      // helpers/skills-registry.ts is rowed in the REAL L0 registry (retired
      // Amendment-1 delivery): pruned recursively from the subdir, row dropped.
      expect(out).toContain('PRUNE  scripts/helpers/skills-registry.ts');
      expect(existsSync(join(tmp, 'scripts', 'helpers', 'skills-registry.ts'))).toBe(false);
      expect(registryContains(tmp, 'helpers/skills-registry.ts')).toBe(false);
      // Project-local content survives.
      expect(existsSync(join(tmp, 'scripts', 'deploy-web.ts'))).toBe(true);
      expect(registryContains(tmp, 'deploy-web.ts')).toBe(true);
      // Critical negative: delivered subdir scripts (L0+L1 shared data module)
      // must survive — a template walk that is not recursive would misread
      // them as prunable and break project dev-sync/validate-templates.
      expect(existsSync(join(tmp, 'scripts', 'lib', 'upgrade-policy.ts'))).toBe(true);
      expect(existsSync(join(tmp, 'scripts', 'helpers', 'upgrade-versions.ts'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);

  test('unregistered stray survives (KEEP-uncertain; verify-scripts owns registration)', () => {
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
      expect(out).toContain('KEEP   scripts/stray-foreign.ts');
      expect(existsSync(join(tmp, 'scripts', 'stray-foreign.ts'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});

// ============================================================================
// VARIANT-SCOPE SKILL PRUNE — .codex mirror coverage (P1 bug 2, spec
// 2026-09-24-platform-parity-p1-bugfixes-design.md D2/D8)
// ============================================================================
describe('upgrade-project.ts VARIANT-SCOPE SKILL PRUNE — four-mirror coverage (P1 bug 2)', () => {
  test('foreign-variant skill is pruned from all four platform mirrors including .codex', () => {
    const tmp = makeTempProject();
    try {
      // sound-synth is registered to co-game in the REAL workspace
      // docs/workspace-schema.json (variant_scoped_skills) — foreign to the
      // co-develop fixture variant. Seed it in all FOUR platform mirrors
      // (NOT the top-level skills/ SSOT, so the pre-fix bug is isolated to
      // the missing .codex element: 3 PRUNE verdicts pre-fix vs 4 post-fix).
      for (const mirror of ['.claude', '.gemini', '.agents', '.codex']) {
        mkdirSync(join(tmp, mirror, 'skills', 'sound-synth'), { recursive: true });
        writeFileSync(
          join(tmp, mirror, 'skills', 'sound-synth', 'SKILL.md'),
          '---\nname: sound-synth\ndescription: foreign co-game skill (fixture copy)\n---\n'
        );
      }
      spawnSync('git', ['-C', tmp, 'add', '-A'], { cwd: tmp });
      spawnSync('git', ['-C', tmp, 'commit', '-q', '-m', 'chore: seed foreign mirrors'], { cwd: tmp });

      const result = spawnSync(
        'bun',
        [upgradeScript, tmp, '--variant', VARIANT, '--dry-run', '--yes'],
        { encoding: 'utf-8', timeout: 300000 }
      );
      if (result.status !== 0) {
        console.error('stdout:', (result.stdout ?? '').slice(-3000));
        console.error('stderr:', (result.stderr ?? '').slice(0, 2000));
      }
      expect(result.status).toBe(0);
      const out = result.stdout ?? '';

      // Sanity: the three pre-existing mirrors still prune…
      expect(out).toContain('PRUNE  .claude/skills/sound-synth/');
      expect(out).toContain('PRUNE  .gemini/skills/sound-synth/');
      expect(out).toContain('PRUNE  .agents/skills/sound-synth/');
      // …and the .codex mirror joins them (the regression: pre-fix this
      // verdict never fired and the codex copy survived every prune run).
      expect(out).toContain('PRUNE  .codex/skills/sound-synth/');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 300000);
});
