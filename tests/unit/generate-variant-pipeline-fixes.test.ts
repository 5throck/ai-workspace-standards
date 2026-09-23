// tests/unit/generate-variant-pipeline-fixes.test.ts
// @version 1.1.0
// Covers the four pipeline gaps root-caused during the co-hr promotion
// (2026-08-23): Windows path normalization in generateSkillDirectories,
// lifecycle frontmatter preservation in normalizeAgentFrontmatter, and
// VARIANT-INJECT wrapper injection for promoted context.md files.

import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  ensureVariantInjectMarkers,
  generateSkillDirectories,
  normalizeAgentFrontmatter,
} from '../../scripts/helpers/generate-variant.ts';

describe('normalizeAgentFrontmatter (v1.1.0 — lifecycle preserved)', () => {
  const agentWithLifecycle = [
    '---',
    'name: labor-compliance-analyst',
    'formal_name: Labor Compliance Analyst',
    'variant: co-hr',
    'status: active',
    'lifecycle:',
    '  phase: production',
    '  created: 2026-08-22',
    '  governance: docs/lifecycle/agents/labor-compliance-analyst.md',
    '---',
    '',
    'Body content',
  ].join('\n');

  it('preserves the lifecycle block (L2 governance records reference it)', () => {
    const result = normalizeAgentFrontmatter(agentWithLifecycle);
    expect(result).toContain('lifecycle:');
    expect(result).toContain('phase: production');
    expect(result).toContain('governance: docs/lifecycle/agents/labor-compliance-analyst.md');
  });

  it('still strips formal_name and variant (genuinely L3-only)', () => {
    const result = normalizeAgentFrontmatter(agentWithLifecycle);
    expect(result).not.toMatch(/^formal_name:/m);
    expect(result).not.toMatch(/^variant:/m);
    expect(result).toContain('name: labor-compliance-analyst');
    expect(result).toContain('Body content');
  });
});

describe('ensureVariantInjectMarkers (v1.0.0 — context.md wrapper injection)', () => {
  const bareContext = [
    '# Co Test — test Configuration',
    '',
    '## Tech Stack',
    '',
    'TypeScript.',
    '',
    '---',
    '',
    '## Agents',
    '',
    'PM row.',
    '',
    '---',
    '',
    '## Skills',
    '',
    'Skill row.',
    '',
    '---',
    '',
    '## Environment Setup',
    '',
    'Bun.',
    '',
    '---',
    '',
    '## Development Workflow',
    '',
    'Phases.',
    '',
    '---',
    '',
    '## Guidelines',
    '',
    'Rules.',
    '',
    '---',
    '',
    '## File Organization Policy',
    '',
    'Layout.',
    '',
    '---',
    '',
    '## Domain Rules',
    '',
    'Domain.',
    '',
  ].join('\n');

  it('injects all 8 slot wrappers into a bare WS-09 document', () => {
    const result = ensureVariantInjectMarkers(bareContext);
    expect(result).toContain('<!-- VARIANT-INJECT: tech-stack -->');
    expect(result).toContain('<!-- VARIANT-INJECT: agents -->');
    expect(result).toContain('<!-- VARIANT-INJECT: skills -->');
    expect(result).toContain('<!-- VARIANT-INJECT: environment-setup -->');
    expect(result).toContain('<!-- VARIANT-INJECT: development-workflow -->');
    expect(result).toContain('<!-- VARIANT-INJECT: guidelines [REQUIRED] -->');
    expect(result).toContain('<!-- VARIANT-INJECT: file-organization -->');
    expect(result).toContain('<!-- VARIANT-INJECT: domain-rules -->');
    expect((result.match(/<!-- END VARIANT-INJECT -->/g) ?? []).length).toBe(8);
  });

  it('places the guidelines [REQUIRED] marker before its heading (co-deck placement)', () => {
    const result = ensureVariantInjectMarkers(bareContext);
    const markerIdx = result.indexOf('<!-- VARIANT-INJECT: guidelines [REQUIRED] -->');
    const headingIdx = result.indexOf('## Guidelines');
    expect(markerIdx).toBeGreaterThanOrEqual(0);
    expect(headingIdx).toBeGreaterThan(markerIdx);
  });

  it('is idempotent — a second pass adds no duplicate wrappers', () => {
    const once = ensureVariantInjectMarkers(bareContext);
    const twice = ensureVariantInjectMarkers(once);
    expect(twice).toBe(once);
  });

  it('leaves documents with existing markers unchanged', () => {
    const marked = bareContext.replace(
      '## Tech Stack\n',
      '## Tech Stack\n<!-- VARIANT-INJECT: tech-stack -->\n'
    );
    expect(ensureVariantInjectMarkers(marked)).toContain(
      '<!-- VARIANT-INJECT: tech-stack -->\n'
    );
    expect((ensureVariantInjectMarkers(marked).match(/VARIANT-INJECT: tech-stack/g) ?? []).length).toBe(1);
  });
});

describe('generateSkillDirectories (v1.16.0 — Windows backslash paths + four mirrors)', () => {
  it('creates all five skill roots from backslashed targetPaths', () => {
    const tmpRoot = join(tmpdir(), `gv-fixes-${process.pid}-${Date.now()}`);
    const variantPath = join(tmpRoot, 'variant');
    const sourceSkill = join(tmpRoot, 'src', 'skills', 'demo-skill', 'SKILL.md');
    mkdirSync(join(tmpRoot, 'src', 'skills', 'demo-skill'), { recursive: true });
    writeFileSync(sourceSkill, '---\nname: demo-skill\n---\nDemo body\n');

    try {
      // Backslashed targetPath — the exact Windows form that produced
      // "Skills created: 10" with zero directories during the co-hr promotion
      const manifest = {
        keepInVariant: [
          { sourcePath: sourceSkill, targetPath: 'skills\\demo-skill\\SKILL.md' },
        ],
      };
      const dirs = generateSkillDirectories(variantPath, { name: 'co-test' } as never, manifest as never);

      expect(existsSync(join(variantPath, 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(variantPath, '.claude', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(variantPath, '.gemini', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
      // T-20260921-009 (review H-3): the .agents/.codex mirrors joined the set.
      expect(existsSync(join(variantPath, '.agents', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
      expect(existsSync(join(variantPath, '.codex', 'skills', 'demo-skill', 'SKILL.md'))).toBe(true);
      expect(dirs.length).toBe(5);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('generateSkillDirectories (v1.17.0 — whole-dir skill-asset parity, T-20260923-005)', () => {
  const SKILL_BODY = '---\nname: handbook-skill\n---\nCanonical SKILL body\n';

  function seedMultiFileSkill(srcRoot: string): void {
    // Top-level skill with a references/ subdir AND a non-Markdown asset.
    mkdirSync(join(srcRoot, 'skills', 'handbook-skill'), { recursive: true });
    writeFileSync(join(srcRoot, 'skills', 'handbook-skill', 'SKILL.md'), SKILL_BODY);
    mkdirSync(join(srcRoot, 'skills', 'handbook-skill', 'references'), { recursive: true });
    writeFileSync(join(srcRoot, 'skills', 'handbook-skill', 'references', 'GUIDE.md'), '# Guide\n');
    mkdirSync(join(srcRoot, 'skills', 'handbook-skill', 'assets'), { recursive: true });
    writeFileSync(join(srcRoot, 'skills', 'handbook-skill', 'assets', 'logo.svg'), '<svg/>\n');
    // Partial mirrors: only .claude carries a mirror copy (single SKILL.md).
    mkdirSync(join(srcRoot, '.claude', 'skills', 'handbook-skill'), { recursive: true });
    writeFileSync(join(srcRoot, '.claude', 'skills', 'handbook-skill', 'SKILL.md'), SKILL_BODY);
  }

  function multiFileManifest(srcRoot: string) {
    const files: Array<{ sourcePath: string; targetPath: string; reason: string }> = [];
    const walk = (dir: string, rel: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(join(dir, e.name), r);
        else files.push({ sourcePath: join(dir, e.name), targetPath: r, reason: 'test' });
      }
    };
    walk(srcRoot, '');
    return { keepInVariant: files };
  }

  it('materializes every skill asset into top-level + all four mirrors with subpaths preserved', () => {
    const tmpRoot = join(tmpdir(), `gv-parity-${process.pid}-${Date.now()}`);
    const srcRoot = join(tmpRoot, 'src');
    seedMultiFileSkill(srcRoot);
    try {
      const dirs = generateSkillDirectories(
        join(tmpRoot, 'variant'),
        { name: 'co-test' } as never,
        multiFileManifest(srcRoot) as never,
      );
      expect(dirs.length).toBe(5);
      const roots = [
        join(tmpRoot, 'variant', 'skills', 'handbook-skill'),
        join(tmpRoot, 'variant', '.claude', 'skills', 'handbook-skill'),
        join(tmpRoot, 'variant', '.gemini', 'skills', 'handbook-skill'),
        join(tmpRoot, 'variant', '.agents', 'skills', 'handbook-skill'),
        join(tmpRoot, 'variant', '.codex', 'skills', 'handbook-skill'),
      ];
      for (const root of roots) {
        expect(existsSync(join(root, 'SKILL.md'))).toBe(true);
        expect(existsSync(join(root, 'references', 'GUIDE.md'))).toBe(true);
        expect(existsSync(join(root, 'assets', 'logo.svg'))).toBe(true);
        // Sub-files keep their own content — no last-writer-wins collapse.
        expect(readFileSync(join(root, 'references', 'GUIDE.md'), 'utf8')).toBe('# Guide\n');
      }
      // SKILL.md content is the canonical body in every root — a mirror
      // references file must never clobber it.
      for (const root of roots) {
        expect(readFileSync(join(root, 'SKILL.md'), 'utf8')).toBe(SKILL_BODY);
      }
      // Non-Markdown assets are byte-preserved.
      expect(readFileSync(join(roots[0], 'assets', 'logo.svg'), 'utf8')).toBe('<svg/>\n');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('a mirror references file does not clobber SKILL.md (v1.16.x corruption regression)', () => {
    const tmpRoot = join(tmpdir(), `gv-corrupt-${process.pid}-${Date.now()}`);
    const variantPath = join(tmpRoot, 'variant');
    try {
      // Source scanned from an L3 project whose mirrors carry sub-files: the
      // pre-1.17.0 code wrote EVERY mirror-grouped file to SKILL.md, so the
      // last one processed won and the real SKILL.md body was lost.
      const mk = (p: string, body: string): void => {
        mkdirSync(join(tmpRoot, 'src', p, '..'), { recursive: true });
        writeFileSync(join(tmpRoot, 'src', p), body);
      };
      mk('skills/handbook-skill/SKILL.md', SKILL_BODY);
      mk('.claude/skills/handbook-skill/SKILL.md', SKILL_BODY);
      mk('.claude/skills/handbook-skill/references/AUTHORING.md', '# Authoring\n');
      const manifest = {
        keepInVariant: [
          { sourcePath: join(tmpRoot, 'src', 'skills', 'handbook-skill', 'SKILL.md'), targetPath: 'skills/handbook-skill/SKILL.md', reason: 'test' },
          { sourcePath: join(tmpRoot, 'src', '.claude', 'skills', 'handbook-skill', 'SKILL.md'), targetPath: '.claude/skills/handbook-skill/SKILL.md', reason: 'test' },
          { sourcePath: join(tmpRoot, 'src', '.claude', 'skills', 'handbook-skill', 'references', 'AUTHORING.md'), targetPath: '.claude/skills/handbook-skill/references/AUTHORING.md', reason: 'test' },
        ],
      };
      generateSkillDirectories(variantPath, { name: 'co-test' } as never, manifest as never);
      const claudeSkill = join(variantPath, '.claude', 'skills', 'handbook-skill');
      expect(readFileSync(join(claudeSkill, 'SKILL.md'), 'utf8')).toBe(SKILL_BODY);
      expect(readFileSync(join(claudeSkill, 'references', 'AUTHORING.md'), 'utf8')).toBe('# Authoring\n');
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
