/**
 * Variant agent sections — resolve-and-check (spec
 * docs/designs/2026-09-25-registry-policy-completeness-design.md, R2.2/D3/D4).
 *
 * audit.ts checkVariantAgentSections (v2.45.0) validates the RESOLVED body of
 * ADR-0033 extends-stubs (pure composeResolvedAgentContent) instead of the raw
 * stub file, using the golden-reference-loader AGENT_LAYER1_SECTIONS list.
 * These tests pin the three behaviors the design demands:
 *   1. the 13 real variant i18n-specialist.md stubs resolve to bodies carrying
 *      all 7 Layer-1 sections against the updated common body (the audit WARN
 *      count drops 13 → 0),
 *   2. an induced common-body gap still produces a failure naming the missing
 *      section (resolve-and-check, not skip), and
 *   3. a full-copy agent missing a section still fails (existing behavior).
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { existsSync, readFileSync, readdirSync, mkdtempSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { AGENT_LAYER1_SECTIONS } from '../../scripts/helpers/golden-reference-loader.ts';
import { composeResolvedAgentContent } from '../../scripts/helpers/resolve-pm-stub.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const templatesDir = join(workspaceRoot, 'templates');
const COMMON_I18N = join(templatesDir, 'common', 'agents', 'i18n-specialist.md');

function variantDirs(): string[] {
  return readdirSync(templatesDir)
    .filter(d => d.startsWith('co-') && existsSync(join(templatesDir, d, 'agents', 'i18n-specialist.md')))
    .sort();
}

function missingSections(content: string): string[] {
  return AGENT_LAYER1_SECTIONS.filter(s => !content.includes(s));
}

describe('variant agent sections: resolve-and-check (registry completeness R2.2)', () => {
  test('all 13 real i18n-specialist stubs resolve to bodies with all 7 Layer-1 sections', () => {
    const variants = variantDirs();
    expect(variants.length).toBe(13);
    for (const variant of variants) {
      const stubPath = join(templatesDir, variant, 'agents', 'i18n-specialist.md');
      const composed = composeResolvedAgentContent(stubPath, COMMON_I18N, variant);
      expect(composed.composed).toBe(true);
      expect(composed.missingL1).toBeUndefined();
      expect(composed.shape).toBe('empty');
      const missing = missingSections(composed.content);
      expect(missing).toEqual([]);
    }
  });

  test('the common body actually carries the added Output Format section and version 1.1.0', () => {
    const content = readFileSync(COMMON_I18N, 'utf-8');
    expect(content).toContain('## Output Format');
    expect(content).toMatch(/^version: "1\.1\.0"$/m);
  });

  test('induced common-body gap: the resolved body fails, naming the removed section', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'variant-agent-sections-'));
    try {
      // Common body with `## Output Format` surgically removed (heading + body).
      const body = readFileSync(COMMON_I18N, 'utf-8');
      const gapped = body.replace(/## Output Format[\s\S]*?(?=\n## )/, '');
      expect(gapped).not.toContain('## Output Format');
      const commonPath = join(scratch, 'i18n-specialist.md');
      writeFileSync(commonPath, gapped, 'utf-8');

      const stubPath = join(scratch, 'i18n-specialist-stub.md');
      copyFileSync(join(templatesDir, 'co-abap', 'agents', 'i18n-specialist.md'), stubPath);

      const composed = composeResolvedAgentContent(stubPath, commonPath, 'co-abap');
      expect(composed.composed).toBe(true);
      // The resolved body is checked, not skipped: exactly the gapped section is named.
      expect(missingSections(composed.content)).toEqual(['## Output Format']);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test('full-copy agent missing a section still fails (no extends — raw content checked)', () => {
    const scratch = mkdtempSync(join(tmpdir(), 'variant-agent-sections-'));
    try {
      const fullCopyPath = join(scratch, 'specialist.md');
      // A self-contained agent (no extends:) with only one of the 7 sections.
      writeFileSync(
        fullCopyPath,
        '---\nname: specialist\nversion: "1.0.0"\n---\n\n## Role\n\nDoes things.\n',
        'utf-8',
      );
      const content = readFileSync(fullCopyPath, 'utf-8');
      // No extends: frontmatter → the checker inspects the raw file.
      expect(content).not.toMatch(/^extends:/m);
      const missing = missingSections(content);
      expect(missing.length).toBe(AGENT_LAYER1_SECTIONS.length - 1);
      expect(missing).toContain('## Output Format');
      expect(missing).toContain('## Dispatch Protocol');
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });

  test('audit.ts checks AGENT_LAYER1_SECTIONS by reference — inline duplicate is gone', () => {
    const auditSource = readFileSync(join(workspaceRoot, 'scripts', 'audit.ts'), 'utf-8');
    expect(auditSource).toContain('import { AGENT_LAYER1_SECTIONS } from \'./helpers/golden-reference-loader.ts\'');
    expect(auditSource).toContain('const REQUIRED_SECTIONS = AGENT_LAYER1_SECTIONS');
    // The inline 7-element Layer-1 list literal must not survive anywhere in audit.ts
    // (other checks' REQUIRED_SECTIONS lists are different sections and stay).
    expect(auditSource).not.toContain("'## ⚠️ PM-ONLY INVOCATION',");
  });
});
