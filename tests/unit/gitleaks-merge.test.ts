import { describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mergeGitleaksToml } from '../../scripts/helpers/gitleaks-merge.ts';

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
