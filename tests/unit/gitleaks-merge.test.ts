import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeGitleaksToml, extractRulesBlocks, templateCoversRule } from '../../scripts/helpers/gitleaks-merge.ts';

const TEMPLATE = `[extend]
defaults = false

[[rules]]
id = "generic-api-key"

[allowlist]
description = "template allowlist"
regexes = [
  '''^template-ok$''',
]

paths = [
]
`;

function fixture(projectExtraEntry?: string): { root: string; src: string; dst: string } {
  const root = mkdtempSync(join(tmpdir(), 'gitleaks-merge-'));
  const src = join(root, 'src.toml');
  const dst = join(root, 'dst.toml');
  writeFileSync(src, TEMPLATE);
  // Insert WITHOUT String.replace: the entry data contains `$''`, and `$'`
  // inside a replace() replacement string substitutes the text-after-match —
  // the very bug this suite pins (use splice-style insertion instead).
  const lines = TEMPLATE.split('\n');
  const anchor = lines.indexOf("  '''^template-ok$''',");
  if (projectExtraEntry) lines.splice(anchor + 1, 0, projectExtraEntry);
  writeFileSync(dst, lines.join('\n'));
  return { root, src, dst };
}

describe('mergeGitleaksToml', () => {
  test('preserves a dollar-anchored project-only regex entry literally (T-20261013-010 regression)', () => {
    const { root, src, dst } = fixture("  '''^scratch/stable/z\\.prog\\.abap$''',");
    mergeGitleaksToml(dst, src, { dryRun: false });
    const out = readFileSync(dst, 'utf-8');
    expect(out).toContain('^scratch/stable/z\\.prog\\.abap$');
    expect(out).not.toMatch(/abap\n''/);
    expect(out).toContain('^template-ok$');
    rmSync(root, { recursive: true, force: true });
  });

  test('project-only entries land under the preserved comment inside the array', () => {
    const { root, src, dst } = fixture("  '''^scratch/stable/z\\.prog\\.abap$''',");
    mergeGitleaksToml(dst, src, { dryRun: false });
    const out = readFileSync(dst, 'utf-8');
    expect(out).toContain("Preserved from this project's prior .gitleaks.toml");
    const pathsBlock = out.slice(out.indexOf('regexes = ['));
    expect(pathsBlock.indexOf('z\\.prog\\.abap')).toBeGreaterThan(-1);
    rmSync(root, { recursive: true, force: true });
  });

  test('no project-only entries: template content wins unchanged', () => {
    const { root, src, dst } = fixture();
    mergeGitleaksToml(dst, src, { dryRun: false });
    expect(readFileSync(dst, 'utf-8')).toBe(TEMPLATE);
    rmSync(root, { recursive: true, force: true });
  });

  test('dryRun leaves the destination untouched', () => {
    const { root, src, dst } = fixture("  '''^scratch/stable/z\\.prog\\.abap$''',");
    const before = readFileSync(dst, 'utf-8');
    mergeGitleaksToml(dst, src, { dryRun: true });
    expect(readFileSync(dst, 'utf-8')).toBe(before);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('[[rules]] preservation (U-20261029-008)', () => {
  const TEMPLATE_WITH_RULES = [
    '[extend]',
    'defaults = false',
    '',
    '[[rules]]',
    'id = "generic-api-key"',
    'description = "template rule"',
    "regex = '''(?i)key'''",
    '',
    '[allowlist]',
    'description = "template allowlist"',
    'regexes = []',
    '',
  ].join('\n');

  function rulesFixture(projectToml: string): { root: string; src: string; dst: string } {
    const root = mkdtempSync(join(tmpdir(), 'gitleaks-rules-'));
    const src = join(root, 'src.toml');
    const dst = join(root, 'dst.toml');
    writeFileSync(src, TEMPLATE_WITH_RULES);
    writeFileSync(dst, projectToml);
    return { root, src, dst };
  }

  test('a project-only [[rules]] block survives the re-merge (the U-20261028-004 prescribed location)', () => {
    const project = TEMPLATE_WITH_RULES + '\n[[rules]]\nid = "co-abap-custom"\ndescription = "ABAP secret pattern"\nregex = \'\'\'custom:\s*\'\'\'\n';
    const { root, src, dst } = rulesFixture(project);
    mergeGitleaksToml(dst, src, { dryRun: false });
    const out = readFileSync(dst, 'utf-8');
    expect(out).toContain('id = "co-abap-custom"');
    expect(out).toContain('custom:\s*');
    expect(out).toContain("Preserved from this project's prior .gitleaks.toml");
    expect(out).toContain('id = "generic-api-key"');
    rmSync(root, { recursive: true, force: true });
  });

  test('same-id project block is dropped — the template copy is authoritative', () => {
    const project = TEMPLATE_WITH_RULES + '\n[[rules]]\nid = "generic-api-key"\ndescription = "project-edit"\nregex = \'\'\'old\'\'\'\n';
    const { root, src, dst } = rulesFixture(project);
    mergeGitleaksToml(dst, src, { dryRun: false });
    const out = readFileSync(dst, 'utf-8');
    expect(out).toContain('description = "template rule"');
    expect(out).not.toContain('description = "project-edit"');
    expect(out.match(/id = "generic-api-key"/g)).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });

  test('a rules sub-table stays inside its parent block when preserved', () => {
    const project = TEMPLATE_WITH_RULES + [
      '', '[[rules]]', 'id = "co-abap-entropy"', "regex = '''x'''", '',
      '[rules.allowlists]', "paths = ['src/generated/**']", '',
    ].join('\n');
    const { root, src, dst } = rulesFixture(project);
    mergeGitleaksToml(dst, src, { dryRun: false });
    const out = readFileSync(dst, 'utf-8');
    const preserved = out.slice(out.indexOf('id = "co-abap-entropy"'));
    expect(preserved).toContain('[rules.allowlists]');
    expect(preserved.indexOf('src/generated/**')).toBeGreaterThan(-1);
    rmSync(root, { recursive: true, force: true });
  });

  test('no project-only rules: template wins with nothing appended', () => {
    const { root, src, dst } = rulesFixture(TEMPLATE_WITH_RULES);
    mergeGitleaksToml(dst, src, { dryRun: false });
    expect(readFileSync(dst, 'utf-8')).toBe(TEMPLATE_WITH_RULES.replace(/\n+$/, '\n'));
    rmSync(root, { recursive: true, force: true });
  });

  test('extractRulesBlocks keeps [[rules]] elements separate and nested sub-tables inside', () => {
    const toml = [
      '[[rules]]', 'id = "a"', "regex = '''a'''", '',
      '[rules.allowlists]', "paths = ['x']", '',
      '[[rules]]', 'id = "b"', '', '[allowlist]', 'description = "g"', '',
    ].join('\n');
    const blocks = extractRulesBlocks(toml);
    expect(blocks.map(b => b.id)).toEqual(['a', 'b']);
    expect(blocks[0].text).toContain('[rules.allowlists]');
    expect(blocks[1].text).not.toContain('description = "g"');
  });

  test('templateCoversRule: same id covered; id-less block covered only by exact text', () => {
    const tpl = [
      { id: 'generic-api-key', text: '[[rules]]\nid = "generic-api-key"' },
      { id: null, text: '[[rules]]\ndescription = "anon"' },
    ];
    expect(templateCoversRule({ id: 'generic-api-key', text: 'x' }, tpl)).toBe(true);
    expect(templateCoversRule({ id: 'other', text: 'x' }, tpl)).toBe(false);
    expect(templateCoversRule({ id: null, text: '[[rules]]\ndescription = "anon"' }, tpl)).toBe(true);
    expect(templateCoversRule({ id: null, text: '[[rules]]\ndescription = "different"' }, tpl)).toBe(false);
  });

  test('dryRun does not write the preserved rules', () => {
    const project = TEMPLATE_WITH_RULES + '\n[[rules]]\nid = "co-abap-custom"\nregex = \'\'\'c\'\'\'\n';
    const { root, src, dst } = rulesFixture(project);
    const before = readFileSync(dst, 'utf-8');
    mergeGitleaksToml(dst, src, { dryRun: true });
    expect(readFileSync(dst, 'utf-8')).toBe(before);
    rmSync(root, { recursive: true, force: true });
  });
});
