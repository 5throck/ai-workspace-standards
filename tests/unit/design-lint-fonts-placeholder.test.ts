/**
 * Subprocess tests for design-lint.ts fonts placeholder skip (U-20261006-003).
 *
 * `*.template.*` token files carry `<value>` placeholders, not real font
 * stacks — the font-fallback-contract check must skip declarations from
 * template files and declarations whose value contains `<`/`>`, while real
 * violations in ordinary token files still fail the lint.
 *
 * The lint is driven as a subprocess with `--check fonts --json <root>` so the
 * JSON report gives per-check status and findings.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..', '..');
const LINT = join(REPO_ROOT, 'scripts', 'design-lint.ts');
const TEMP_ROOTS: string[] = [];

afterAll(() => {
  for (const root of TEMP_ROOTS) rmSync(root, { recursive: true, force: true });
});

const TEMPLATE_TOKENS = [
  '/* scaffold template — values are substituted at scaffold time */',
  '--font-display: <font-display-value>;',
  '--font-body: <font-family-value>;',
  '',
].join('\n');

interface FontsReport {
  checks: Array<{
    name: string;
    status: string;
    findings: Array<{ file: string; pattern: string; match: string; severity: string }>;
  }>;
}

function runFontsCheck(root: string): { exitCode: number; report: FontsReport } {
  const proc = Bun.spawnSync(['bun', LINT, '--check', 'fonts', '--json', root], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: proc.exitCode ?? -1,
    report: JSON.parse(new TextDecoder().decode(proc.stdout)) as FontsReport,
  };
}

function stageFixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'design-lint-fonts-fixture-'));
  TEMP_ROOTS.push(root);
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(root, name), content);
  }
  return root;
}

const fontsCheck = (report: FontsReport) => report.checks.find((c) => c.name === 'fonts');

describe('design-lint fonts placeholder skip (U-20261006-003)', () => {
  test('a *.template.* token file with <value> placeholders yields zero font findings (exit 0)', () => {
    const root = stageFixture({ 'tokens.template.css': TEMPLATE_TOKENS });
    const { exitCode, report } = runFontsCheck(root);
    expect(exitCode).toBe(0);
    const fonts = fontsCheck(report);
    expect(fonts?.status).toBe('pass');
    expect(fonts?.findings).toHaveLength(0);
  });

  test('template placeholders are skipped while a real violation in tokens.css still fails', () => {
    const root = stageFixture({
      'tokens.template.css': TEMPLATE_TOKENS,
      'tokens.css': ['--font-bad: Helvetica;', '--font-good: "Helvetica Neue", Arial, sans-serif;', ''].join('\n'),
    });
    const { exitCode, report } = runFontsCheck(root);
    expect(exitCode).toBe(1);
    const fonts = fontsCheck(report);
    expect(fonts?.status).toBe('fail');
    expect(fonts?.findings).toHaveLength(1);
    expect(fonts?.findings[0].file).toBe('tokens.css');
    expect(fonts?.findings[0].pattern).toBe('font-fallback-contract');
    expect(fonts?.findings[0].match).toContain('--font-bad');
    // the guard: no placeholder value ever reaches the findings
    for (const f of fonts?.findings ?? []) expect(f.match).not.toMatch(/[<>]/);
  });

  test('a <value>-shaped declaration in ANY file is skipped (value guard leg)', () => {
    const root = stageFixture({ 'tokens.css': '--font-body: <font-family-value>;' });
    const { exitCode, report } = runFontsCheck(root);
    expect(exitCode).toBe(0);
    expect(fontsCheck(report)?.findings).toHaveLength(0);
  });
});
