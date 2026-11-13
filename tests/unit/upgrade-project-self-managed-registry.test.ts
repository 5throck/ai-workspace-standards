/**
 * upgrade-project SKILLS_REGISTRY_RECONCILE vs self-managed skills (T-20261113-002)
 * @version 1.0.0
 *
 * Spec: docs/designs/2026-11-13-skill-audit-self-managed-registry-design.md
 *
 * A full upgrade-project spawn runs the whole delivery engine (see
 * upgrade-project-tenant-guard.test.ts), so this suite pins (a) the
 * isSelfManagedPath rootDir contract U relies on, (b) the reconcile helper
 * still adding rows for normal skills, and (c) the structural call in the
 * SKILLS_REGISTRY_RECONCILE block. The real dry-run is the verification step.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reconcileSkillRegistry } from '../../scripts/helpers/skills-registry.ts';
import { isSelfManagedPath } from '../../scripts/lib/self-managed-tools.ts';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('isSelfManagedPath against a project dir (cwd is a different root)', () => {
  test('skills/graft is self-managed, a normal skill is not', () => {
    const proj = mkdtempSync(join(tmpdir(), 'upg-sm-'));
    dirs.push(proj);
    expect(isSelfManagedPath('skills/graft/SKILL.md', proj)).toBe(true);
    expect(isSelfManagedPath('skills/demo/SKILL.md', proj)).toBe(false);
  });

  test('external-deps install_dirs of the PROJECT count', () => {
    const proj = mkdtempSync(join(tmpdir(), 'upg-sm-'));
    dirs.push(proj);
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'external-deps.json'), JSON.stringify({ dependencies: [{ id: 'vend', install_dir: 'external/vend' }] }));
    expect(isSelfManagedPath('external/vend/skills/vend/SKILL.md', proj)).toBe(true);
    expect(isSelfManagedPath('external/other/SKILL.md', proj)).toBe(false);
  });
});

describe('reconcile still adds rows for normal skills', () => {
  test('a normal delivered skill with no row is added', () => {
    const registry = '# Skills\n\n## Registry\n\n| Skill | Version | Status | Owner | Last Reviewed | Removal Date | Notes |\n|---|---|---|---|---|---|---|\n| `existing` | 1.0.0 | active | pm | 2026-11-01 | — | — |\n';
    const { added } = reconcileSkillRegistry(registry, [
      { skill: 'demo', version: '1.0.0', status: 'active', owner: 'pm', lastReviewed: '2026-11-01' },
    ]);
    expect(added).toEqual(['demo']);
  });
});

describe('SKILLS_REGISTRY_RECONCILE structure', () => {
  test('collection skips self-managed dirs using projectDir', () => {
    const src = readFileSync(join(import.meta.dir, '../../scripts/upgrade-project.ts'), 'utf8');
    const block = src.slice(src.indexOf('--- SKILLS_REGISTRY_RECONCILE'), src.indexOf('--- OVERWRITE: docs/_common/'));
    expect(block).toContain('isSelfManagedPath(`skills/${skillName}/SKILL.md`, projectDir)');
    expect(block.indexOf('isSelfManagedPath(')).toBeLessThan(block.indexOf('reconcileSkillRegistry('));
  });
});
