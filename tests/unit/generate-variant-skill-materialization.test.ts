// tests/unit/generate-variant-skill-materialization.test.ts
// @version 1.0.0
// Covers the skill-materialization defects root-caused during the co-unity
// rehearsal (2026-09-01): generateSkillDirectories() picked the FIRST skill-tree
// entry as the canonical SKILL.md (often an asset — the promoted
// skills/code-review/SKILL.md contained assets/review-brief-template.md) and
// never copied skill sub-files into any of the three skill roots.

import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateSkillDirectories } from '../../scripts/helpers/generate-variant.ts';

const SKILL_MD = '---\nname: demo-skill\n---\n\n## Context\n\nCanonical skill body\n';
const ASSET_MD = '# Asset template\n\nNot the skill body.\n';
const REFERENCE_MD = '# Reference roster\n\nNot the skill body.\n';
const ASSET_CONF = 'ignored/path\n';

function makeFixture(): { tmpRoot: string; variantPath: string; manifest: unknown } {
  const tmpRoot = join(tmpdir(), `gv-skill-mat-${process.pid}-${Date.now()}`);
  const variantPath = join(tmpRoot, 'variant');
  const skillSrc = join(tmpRoot, 'src', 'skills', 'demo-skill');

  mkdirSync(join(skillSrc, 'assets'), { recursive: true });
  mkdirSync(join(skillSrc, 'references'), { recursive: true });
  writeFileSync(join(skillSrc, 'SKILL.md'), SKILL_MD);
  writeFileSync(join(skillSrc, 'assets', 'x.md'), ASSET_MD);
  writeFileSync(join(skillSrc, 'assets', 'ignore.conf'), ASSET_CONF);
  writeFileSync(join(skillSrc, 'references', 'y.md'), REFERENCE_MD);

  // assets/ first — the manifest order that made find(startsWith('skills/'))
  // return an asset instead of SKILL.md.
  const manifest = {
    keepInVariant: [
      { sourcePath: join(skillSrc, 'assets', 'x.md'), targetPath: 'skills/demo-skill/assets/x.md' },
      { sourcePath: join(skillSrc, 'assets', 'ignore.conf'), targetPath: 'skills/demo-skill/assets/ignore.conf' },
      { sourcePath: join(skillSrc, 'SKILL.md'), targetPath: 'skills/demo-skill/SKILL.md' },
      { sourcePath: join(skillSrc, 'references', 'y.md'), targetPath: 'skills/demo-skill/references/y.md' },
    ],
  };

  return { tmpRoot, variantPath, manifest };
}

describe('generateSkillDirectories (v1.3.0 — canonical SKILL.md + sub-files)', () => {
  it('writes the real SKILL.md as canonical even when an asset is listed first', () => {
    const { tmpRoot, variantPath, manifest } = makeFixture();
    try {
      generateSkillDirectories(variantPath, { name: 'co-test' } as never, manifest as never);

      for (const root of ['skills', join('.claude', 'skills'), join('.gemini', 'skills')]) {
        const skillMd = join(variantPath, root, 'demo-skill', 'SKILL.md');
        expect(existsSync(skillMd)).toBe(true);
        expect(readFileSync(skillMd, 'utf-8')).toContain('Canonical skill body');
        expect(readFileSync(skillMd, 'utf-8')).not.toContain('Asset template');
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('copies every skill sub-file — any extension — into all three skill roots', () => {
    const { tmpRoot, variantPath, manifest } = makeFixture();
    try {
      generateSkillDirectories(variantPath, { name: 'co-test' } as never, manifest as never);

      for (const root of ['skills', join('.claude', 'skills'), join('.gemini', 'skills')]) {
        const skillDir = join(variantPath, root, 'demo-skill');
        expect(readFileSync(join(skillDir, 'assets', 'x.md'), 'utf-8')).toContain('Asset template');
        expect(readFileSync(join(skillDir, 'references', 'y.md'), 'utf-8')).toContain('Reference roster');
        expect(existsSync(join(skillDir, 'assets', 'ignore.conf'))).toBe(true);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('does not treat docs/lifecycle/skills/*.md as a skill directory', () => {
    // The copy-remaining loop that carries docs/lifecycle/skills/ into the variant
    // lives inside generateVariant() and is not exported, so it cannot be exercised
    // in isolation here (it needs a full manifest, templates/common and an output
    // path inside the workspace root); the co-unity rehearsal covers it end to end.
    // What IS testable is the other half of that contract: lifecycle records must
    // not be mistaken for skill directories by this function.
    const tmpRoot = join(tmpdir(), `gv-lifecycle-${process.pid}-${Date.now()}`);
    const variantPath = join(tmpRoot, 'variant');
    const src = join(tmpRoot, 'src', 'docs', 'lifecycle', 'skills');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'code-review.md'), '# code-review lifecycle record\n');

    try {
      const manifest = {
        keepInVariant: [
          { sourcePath: join(src, 'code-review.md'), targetPath: 'docs/lifecycle/skills/code-review.md' },
        ],
      };
      const dirs = generateSkillDirectories(variantPath, { name: 'co-test' } as never, manifest as never);

      expect(dirs.length).toBe(0);
      expect(existsSync(join(variantPath, 'skills', 'code-review'))).toBe(false);
      expect(existsSync(join(variantPath, '.claude', 'skills', 'code-review'))).toBe(false);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
