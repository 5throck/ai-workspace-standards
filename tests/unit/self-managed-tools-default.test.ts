/**
 * Unit tests for scripts/lib/self-managed-tools.ts — the built-in graft default
 * (U-20261009-001): docs/self-managed-surfaces.json is L0-only, so a fresh
 * scaffolded project loads no registry and a third-party graft install used to
 * re-block every /sync on the missing version: gate. The default set applies with
 * or without the registry; the registry and SELF_MANAGED_SURFACES_EXCL can only
 * ADD exclusions.
 * @version 1.0.0
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

describe('self-managed-tools built-in default (U-20261009-001)', () => {
  test('missing registry still excludes graft surfaces (the fresh-scaffold case)', () => {
    const root = freshRoot();
    try {
      const tools = loadSelfManagedTools(root);
      expect(tools.some((t) => t.name === 'graft')).toBe(true);
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

  test('non-graft paths are not excluded', () => {
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
      expect(tools.some((t) => t.name === 'graft')).toBe(true);
      expect(tools.some((t) => t.name === 'mytool')).toBe(true);
      expect(isSelfManagedPath('.claude/skills/graft/SKILL.md', root)).toBe(true);
      expect(isSelfManagedPath('.claude/skills/mytool/SKILL.md', root)).toBe(true);
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

  test('default set matches the L0 registry graft entry shape', () => {
    expect(DEFAULT_SELF_MANAGED_PATHS).toContain('.claude/skills/graft/');
    expect(DEFAULT_SELF_MANAGED_PATHS.filter((p) => p.endsWith('/skills/graft/'))).toHaveLength(5);
  });
});
