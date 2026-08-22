// tests/unit/generate-variant-pipeline-fixes.test.ts
// @version 1.0.0
// Covers the four pipeline gaps root-caused during the co-hr promotion
// (2026-08-23): Windows path normalization in generateSkillDirectories,
// lifecycle frontmatter preservation in normalizeAgentFrontmatter, and
// VARIANT-INJECT wrapper injection for promoted context.md files.

import { describe, expect, it } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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

describe('generateSkillDirectories (v1.2.0 — Windows backslash paths)', () => {
  it('creates all three skill roots from backslashed targetPaths', () => {
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
      expect(dirs.length).toBe(3);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
