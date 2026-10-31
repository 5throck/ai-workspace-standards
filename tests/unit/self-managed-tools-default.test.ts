/**
 * Unit tests for scripts/lib/self-managed-tools.ts — the built-in default
 * (U-20261009-001; trail-era paths per design 2026-10-31-graft-trail-migration):
 * docs/self-managed-surfaces.json is L0-only, so a fresh scaffolded project loads
 * no registry and a third-party trail/graft install used to re-block every /sync
 * on the missing version: gate. The default set applies with or without the
 * registry; the registry and SELF_MANAGED_SURFACES_EXCL can only ADD exclusions.
 * The default carries BOTH path generations (graft-era legacy kept until fleet
 * convergence; trail-era paths for post-`trail init` states), and the tracked
 * `skills/trail/` SSOT is deliberately NOT excluded (lifecycle gates read it).
 * @version 1.1.0
 */
import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_SELF_MANAGED_PATHS,
  isSelfManagedPath,
  loadSelfManagedTools,
  selfManagedMirrorSkills,
} from '../../scripts/lib/self-managed-tools.ts';

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'self-managed-tools-test-'));
}

describe('self-managed-tools built-in default (U-20261009-001; trail-era 2026-10-31)', () => {
  test('missing registry still excludes graft-era surfaces (the fresh-scaffold case)', () => {
    const root = freshRoot();
    try {
      const tools = loadSelfManagedTools(root);
      expect(tools.some((t) => t.name === 'trail')).toBe(true);
      expect(isSelfManagedPath('.claude/skills/graft/SKILL.md', root)).toBe(true);
      expect(isSelfManagedPath('.hermes/skills/graft/SKILL.md', root)).toBe(true);
      expect(isSelfManagedPath('skills/graft/SKILL.md', root)).toBe(true);
      const mirrorSkills = selfManagedMirrorSkills(root);
      for (const platform of ['.claude', '.agents', '.codex', '.gemini', '.hermes']) {
        expect(mirrorSkills.has(`${platform}/skills/graft`)).toBe(true);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('default set covers the trail-era paths (design 2026-10-31-graft-trail-migration R2.1)', () => {
    const root = freshRoot();
    try {
      expect(isSelfManagedPath('.trail/cache/INDEX.md', root)).toBe(true);
      expect(isSelfManagedPath('.claude/helpers/trail-hooks.cjs', root)).toBe(true);
      expect(isSelfManagedPath('.claude/helpers/trail-statusline.cjs', root)).toBe(true);
      // The renamed tracked SSOT is NOT excluded — lifecycle gates read its frontmatter.
      expect(isSelfManagedPath('skills/trail/SKILL.md', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('non-tool paths are not excluded', () => {
    const root = freshRoot();
    try {
      expect(isSelfManagedPath('.claude/skills/sync/SKILL.md', root)).toBe(false);
      expect(isSelfManagedPath('skills/sync/SKILL.md', root)).toBe(false);
      expect(isSelfManagedPath('scripts/audit.ts', root)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('registry entries ADD to the default (union, never shrink)', () => {
    const root = freshRoot();
    try {
      mkdirSync(join(root, 'docs'), { recursive: true });
      writeFileSync(
        join(root, 'docs', 'self-managed-surfaces.json'),
        JSON.stringify({
          tools: [{ name: 'mytool', reason: 'test', paths: ['.claude/skills/mytool/'] }],
        }),
      );
      const tools = loadSelfManagedTools(root);
      expect(tools.some((t) => t.name === 'trail')).toBe(true);
      expect(tools.some((t) => t.name === 'mytool')).toBe(true);
      expect(isSelfManagedPath('.claude/skills/graft/SKILL.md', root)).toBe(true);
      expect(isSelfManagedPath('.claude/skills/mytool/SKILL.md', root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('a registry trail entry suppresses the built-in default row without shrinking the path set', () => {
    const root = freshRoot();
    try {
      mkdirSync(join(root, 'docs'), { recursive: true });
      writeFileSync(
        join(root, 'docs', 'self-managed-surfaces.json'),
        JSON.stringify({
          tools: [{ name: 'trail', reason: 'registry of record', paths: ['.trail/'] }],
        }),
      );
      const tools = loadSelfManagedTools(root);
      expect(tools).toHaveLength(1); // no synthetic default graft row appended
      expect(isSelfManagedPath('.trail/cache/INDEX.md', root)).toBe(true);
      // Default paths survive via the module-level set even when the registry omits them.
      expect(isSelfManagedPath('.claude/skills/graft/SKILL.md', root)).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('SELF_MANAGED_SURFACES_EXCL extends the set; default paths stay excluded', () => {
    const root = freshRoot();
    const prev = process.env.SELF_MANAGED_SURFACES_EXCL;
    process.env.SELF_MANAGED_SURFACES_EXCL = '.claude/skills/othertool/';
    try {
      expect(isSelfManagedPath('.claude/skills/othertool/SKILL.md', root)).toBe(true);
      expect(isSelfManagedPath('.claude/skills/graft/SKILL.md', root)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.SELF_MANAGED_SURFACES_EXCL;
      else process.env.SELF_MANAGED_SURFACES_EXCL = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('default set matches the L0 registry entry shape (both path generations)', () => {
    expect(DEFAULT_SELF_MANAGED_PATHS).toContain('.claude/skills/graft/');
    expect(DEFAULT_SELF_MANAGED_PATHS.filter((p) => p.endsWith('/skills/graft/'))).toHaveLength(5);
    expect(DEFAULT_SELF_MANAGED_PATHS).toContain('.trail/');
    expect(DEFAULT_SELF_MANAGED_PATHS).toContain('.claude/helpers/trail-hooks.cjs');
    expect(DEFAULT_SELF_MANAGED_PATHS).toContain('.claude/helpers/trail-statusline.cjs');
    expect(DEFAULT_SELF_MANAGED_PATHS).not.toContain('skills/trail/');
  });
});
