/**
 * Tests for the design-lint.ts `token-role-misuse` sub-check (T-20261029-004).
 *
 * The bg/fg/border triplet convention (templates/common/docs/design-tokens.template.css)
 * reserves `*-bg` / `*-border` / bare `--success|--warning|--danger|--info` for
 * surfaces and strokes; text color must pair `*-fg`. The anti-pattern was
 * hand-fixed in co-newbiz (PR #740, commit 8cf2f396) with the mechanized check
 * deferred to this ticket. The check shares token-usage's exemptions and
 * allowlist; non-text color declarations (background-color, border-color,
 * custom-property definitions) are out of scope — including Tailwind
 * arbitrary-value bracket utilities for non-text utilities
 * (`border-[color:…]`, `bg-[color:…]`, …), whose `[color:` fragment the
 * v2.5.0 matcher misread as a text declaration (131 co-newbiz false
 * positives, U-20261123-001); `text-[color:…]` stays in scope as a
 * text-role check. Since v2.6.0 the var() matcher also sees fallback-chain
 * heads (`var(--a,var(--b,var(--c)))`), so nested chains are checked at
 * every level.
 *
 * Fixtures are built in a temp project root; the lint runs via the real CLI
 * (`--check token-role-misuse --json`) so the exit-code contract is exercised
 * end to end.
 */

import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const dirs: string[] = [];

function repoRoot(): string {
  return resolve(import.meta.dir, '..', '..');
}

function misuseProject(files: Record<string, string>, allowlist: string[] = []): string {
  const dir = mkdtempSync(join(tmpdir(), 'design-lint-token-role-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'app'), { recursive: true });
  mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(
    join(dir, 'docs', 'workspace-schema.json'),
    JSON.stringify({ designLint: { scanRoots: ['app'], allowlist } }, null, 2),
    'utf-8',
  );
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(dir, name), content, 'utf-8');
  }
  return dir;
}

interface RoleReport {
  checks: Array<{ name: string; status: string; findings: Array<{ match: string; severity: string; line?: number; classification?: string }> }>;
}

function runRoleCheck(root: string, asCwd = false): { exitCode: number; report: RoleReport } {
  const args = ['bun', join(repoRoot(), 'scripts', 'design-lint.ts'), '--check', 'token-role-misuse', '--json'];
  if (!asCwd) args.push(root);
  const proc = Bun.spawnSync(args, {
    cwd: asCwd ? root : repoRoot(),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: proc.exitCode,
    report: JSON.parse(new TextDecoder().decode(proc.stdout)) as RoleReport,
  };
}

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe('token-role-misuse (T-20261029-004)', () => {
  test('flags status/bg/border tokens in text color; fg + non-text declarations stay clean', () => {
    const root = misuseProject({
      'app/styles.css': [
        '.bad-bg { color: var(--success-bg); }',
        '.bad-border { color: var(--danger-border); }',
        '.bad-bare { color: var(--warning); }',
        '.good-fg { color: var(--success-fg); }',
        '.good-muted { color: var(--text-muted); }',
        '.not-text { background-color: var(--success-bg); border-color: var(--card-bg); }',
        '.not-compound-def { --icon-color: var(--success-bg); }',
        '',
      ].join('\n'),
    });
    const { exitCode, report } = runRoleCheck(root);
    const check = report.checks.find((c) => c.name === 'token-role-misuse')!;
    expect(check.status).toBe('fail');
    expect(exitCode).toBe(1);
    const flagged = check.findings.filter((f) => f.severity === 'fail').map((f) => f.match);
    expect(flagged).toEqual(['--success-bg', '--danger-border', '--warning']);
  });

  test('G1 (U-20261123-001): non-text bracket utilities stay out of scope; text-[color:...] remains a text-role check', () => {
    const root = misuseProject({
      'app/components.html': [
        // 131-site false-positive class from co-newbiz (v2.5.0): the [color:
        // fragment inside border-/bg-/ring- brackets must never read as text.
        '<div class="border-[color:var(--success-border)] bg-[color:var(--danger-bg)] ring-[color:var(--warning)]">',
        // The text-utility arm stays in scope: wrong role inside text-[...] fires.
        '<span class="text-[color:var(--success-border)]">',
        // Correct role inside text-[...] stays clean.
        '<span class="text-[color:var(--success-fg)]">',
        // Plain declarations keep v2.4.0 behavior.
        '.plain-bad { color: var(--success-bg); }',
        '.plain-ok { color: var(--text-muted); }',
        '',
      ].join('\n'),
    });
    const { exitCode, report } = runRoleCheck(root);
    const check = report.checks.find((c) => c.name === 'token-role-misuse')!;
    expect(check.status).toBe('fail');
    expect(exitCode).toBe(1);
    const flagged = check.findings.filter((f) => f.severity === 'fail').map((f) => f.match);
    expect(flagged).toEqual(['--success-border', '--success-bg']);
  });

  test('G2 (U-20261123-001): var() fallback chains are role-var uses — every chain head is checked', () => {
    const root = misuseProject({
      'app/panel.tsx': [
        // Observed at co-newbiz app/web-next/components/wacc/BetaPanel.tsx:412:
        // the bare status head escaped the v2.5.0 close-paren-anchored matcher.
        '.chain { color: var(--warning,var(--warning-fg,var(--muted-fg))); }',
        // Forbidden roles at any chain level are caught: the head --card-bg
        // (bg role) and the deeper head --success-border (border role) both.
        '.chain-deep { color: var(--card-bg, var(--success-border)); }',
        // All-allowed chain stays clean.
        '.chain-ok { color: var(--text-muted, var(--warning-fg)); }',
        // Simple var() reference behavior is unchanged.
        '.simple { color: var(--success-bg); }',
        '',
      ].join('\n'),
    });
    const { exitCode, report } = runRoleCheck(root);
    const check = report.checks.find((c) => c.name === 'token-role-misuse')!;
    expect(check.status).toBe('fail');
    expect(exitCode).toBe(1);
    const flagged = check.findings.filter((f) => f.severity === 'fail').map((f) => f.match);
    expect(flagged).toEqual(['--warning', '--card-bg', '--success-border', '--success-bg']);
  });

  test('documented exemptions downgrade to info; allowlist entries are exempt', () => {
    const root = misuseProject(
      {
        'app/legacy.css': '.legend { color: var(--danger-bg); /* design-token-exempt: legacy chart legend */ }\n',
        'app/other.css': '.chip { color: var(--info-border); }\n',
      },
      ['--info-border'],
    );
    const { exitCode, report } = runRoleCheck(root);
    const check = report.checks.find((c) => c.name === 'token-role-misuse')!;
    expect(exitCode).toBe(0);
    expect(check.status).toBe('pass');
    const exempt = check.findings.find((f) => f.match === '--danger-bg');
    expect(exempt?.severity).toBe('info');
    expect(exempt?.classification).toBe('one-off (documented)');
    expect(check.findings.find((f) => f.match === '--info-border')).toBeUndefined();
  });

  test('projects without scan roots skip cleanly (same skip semantics as token-usage)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'design-lint-token-role-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'docs'), { recursive: true });
    writeFileSync(join(dir, 'docs', 'workspace-schema.json'), JSON.stringify({ designLint: { scanRoots: [], allowlist: [] } }), 'utf-8');
    // cwd-based run (no positional scan scope) — the no-roots skip arm.
    const { exitCode, report } = runRoleCheck(dir, true);
    const check = report.checks.find((c) => c.name === 'token-role-misuse')!;
    expect(check.status).toBe('skipped');
    expect(exitCode).toBe(0);
  });
});
