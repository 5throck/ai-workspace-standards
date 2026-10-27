/**
 * Tests for the design-lint.ts `themes` sub-check (U-20261027-005 — DESIGN-R2
 * theme invariance).
 *
 * The documented rule (design-tokens.template.css + variant design docs) is
 * that theme presets in tokens.json may override ONLY color and shadow tokens;
 * typography/spacing/borderRadius/target-size are theme-invariant. That rule
 * had zero machine enforcement: extractThemes accepted any key tree and the
 * linter skipped the "themes" branch entirely. v2.3.0 enforces it in BOTH
 * tools — the compiler hard-fails (compile-tokens.test.ts pins that side),
 * this file pins the lint side. The key classification is shared via
 * scripts/helpers/theme-token-policy.ts so the two cannot drift.
 *
 * Fixtures are built in a temp project root; the lint runs via the real CLI
 * (`--check themes --json`) so the exit-code contract is exercised end to end.
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'bun';

const dirs: string[] = [];

function themeProject(tokens: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'design-lint-themes-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'tokens.json'), JSON.stringify(tokens, null, 2), 'utf-8');
  return dir;
}

interface ThemesReport {
  checks: Array<{ name: string; status: string; findings: Array<{ pattern: string; match: string; severity: string; note?: string }> }>;
}

async function runThemesCheck(root: string): Promise<{ exitCode: number; report: ThemesReport }> {
  const proc = Bun.spawnSync(['bun', 'scripts/design-lint.ts', '--check', 'themes', '--json', root], {
    cwd: resolveRepoRoot(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const report = JSON.parse(proc.stdout.toString()) as ThemesReport;
  return { exitCode: proc.exitCode ?? 0, report };
}

function resolveRepoRoot(): string {
  // tests/unit/<this file> → repo root is two levels up.
  return join(import.meta.dir, '..', '..');
}

const themeCheck = (report: ThemesReport) => report.checks.find((c) => c.name === 'themes')!;

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('design-lint themes sub-check (DESIGN-R2 theme invariance)', () => {
  test('typography override under a theme preset FAILS, naming preset + key path', async () => {
    const root = themeProject({
      color: { primary: '#000000' },
      themes: {
        dark: {
          color: { primary: '#ffffff' },
          typography: { 'font-size-base': '1rem' },
        },
      },
    });
    const { exitCode, report } = await runThemesCheck(root);
    expect(exitCode).toBe(1);
    const check = themeCheck(report);
    expect(check.status).toBe('fail');
    expect(check.findings).toHaveLength(1);
    expect(check.findings[0].pattern).toBe('theme-invariance');
    expect(check.findings[0].match).toBe('themes.dark.typography');
    expect(check.findings[0].severity).toBe('fail');
    expect(check.findings[0].note).toContain('ONLY color and shadow');
  });

  test('camelCase borderRadius override is also rejected (kebab normalization)', async () => {
    const root = themeProject({
      color: { primary: '#000000' },
      themes: {
        compact: { borderRadius: { sm: '2px' } },
      },
    });
    const { exitCode, report } = await runThemesCheck(root);
    expect(exitCode).toBe(1);
    expect(themeCheck(report).findings[0].match).toBe('themes.compact.borderRadius');
  });

  test('color/shadow-only presets PASS (rule-clean SSOT stays green)', async () => {
    const root = themeProject({
      color: { primary: '#000000' },
      shadow: { sm: '0 1px 2px rgba(0,0,0,0.1)' },
      themes: {
        dark: {
          color: { primary: '#ffffff' },
          shadow: { sm: '0 1px 2px rgba(0,0,0,0.5)' },
        },
        'high-contrast': { color: { primary: '#0000ff' } },
      },
    });
    const { exitCode, report } = await runThemesCheck(root);
    expect(exitCode).toBe(0);
    expect(themeCheck(report).status).toBe('pass');
    expect(themeCheck(report).findings).toHaveLength(0);
  });

  test('token source without a themes key → SKIP (project opt-in convention)', async () => {
    const root = themeProject({ color: { primary: '#000000' } });
    const { exitCode, report } = await runThemesCheck(root);
    expect(exitCode).toBe(0);
    expect(themeCheck(report).status).toBe('skipped');
  });

  test('no JSON token source at all → SKIP', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-lint-themes-empty-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'src'), { recursive: true });
    const { exitCode, report } = await runThemesCheck(dir);
    expect(exitCode).toBe(0);
    expect(themeCheck(report).status).toBe('skipped');
  });
});
