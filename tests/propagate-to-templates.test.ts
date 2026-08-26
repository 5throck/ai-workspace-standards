/**
 * Integration tests for propagate-to-templates.ts CLI dispatch behavior.
 * Spawns the script as a subprocess to verify CLI flag combinations and
 * exit codes, testing the full execution path.
 *
 * @version 1.0.0
 */
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..');
const scriptPath = join(workspaceRoot, 'scripts', 'propagate-to-templates.ts');

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function runScript(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('bun', [scriptPath, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf-8',
    timeout: 30000,
  });
  return {
    stdout: stripAnsi(result.stdout ?? ''),
    stderr: stripAnsi(result.stderr ?? ''),
    exitCode: result.status ?? -1,
  };
}

describe('--check-drift CLI dispatch', () => {
  test('--check-drift --apply → error exit (conflict rejected)', () => {
    const { stderr, exitCode } = runScript(['--check-drift', '--apply']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('--check-drift cannot be combined with');
  });

  test('--check-drift --domain gemini-settings → results contain ONLY gemini-settings domain', () => {
    const { stdout, exitCode } = runScript(['--check-drift', '--domain', 'gemini-settings']);
    // Exit code may be 0 or 1 depending on actual drift state — just verify domain filtering
    const lines = stdout.split('\n');
    const dataLines = lines.filter(l =>
      l.includes('gemini-settings') && (l.includes('in sync') || l.includes('differs') || l.includes('missing'))
    );
    expect(dataLines.length).toBeGreaterThan(0);
    // Verify no other domain names appear in data output lines
    const nonDataLines = lines.filter(l => {
      const trimmed = l.trim();
      if (trimmed === '') return false;
      if (trimmed.startsWith('===')) return false;
      if (trimmed.startsWith('---')) return false;
      if (trimmed.startsWith('ℹ️')) return false;
      if (trimmed.startsWith('Domain')) return false;  // header row + filter info
      if (trimmed.startsWith('File')) return false;     // header row
      if (trimmed.startsWith('Status')) return false;    // header row
      if (trimmed.includes('Total checked')) return false;
      return true;
    });
    // All remaining non-data lines should contain gemini-settings (if any exist)
    for (const line of nonDataLines) {
      expect(line).toContain('gemini-settings');
    }
  });

  test('--check-drift --domain scripts → informational message + 0 results (ineligible domain UX)', () => {
    const { stdout, exitCode } = runScript(['--check-drift', '--domain', 'scripts']);
    expect(exitCode).toBe(0);
    expect(stdout).toContain('not eligible for L2 drift checking');
    expect(stdout).toContain('Fork Model');
    expect(stdout).toContain('Total checked: 0, Out of sync: 0');
  });

  test('--check-drift --domain does-not-exist → error exit', () => {
    const { stderr, exitCode } = runScript(['--check-drift', '--domain', 'does-not-exist']);
    expect(exitCode).toBe(1);
    expect(stderr).toContain('not found in propagation-map.json');
  });
});

// Cascade re-publish convergence (dev-sync step 4.62 safety)
// Pass 1 may pre-heal a drifted tree (identical to the official --apply behavior).
// The copied counter is NOT a convergence signal because scrub rewrites are counted
// (applyDiffs() labels in-sync mirrors 'scrubbed' when their raw source mentions
// CONSTITUTION.md, and these count toward the copied total). Convergence is
// verified by asserting ZERO per-file 'copied' lines in pass 2 — scrubbed
// rewrites are byte-identical by design, so they should not appear.
describe('cascade re-publish convergence (dev-sync step 4.62 safety)', () => {
  // Two full propagate runs exceed bun's 5s default per-test ceiling under load —
  // match runScript's own 30s subprocess budget (observed ~5.7s on a busy Windows host).
  test('consecutive --apply passes converge (no copied lines in pass 2)', () => {
    const pass1 = runScript(['--apply']);
    expect(pass1.exitCode).toBe(0);
    // Pass 1 may copy files; pass 2 must be idempotent
    const pass2 = runScript(['--apply']);
    expect(pass2.exitCode).toBe(0);
    // Terminal output confirms convergence (may be 'Nothing to apply' or 'Done. N file(s) copied.')
    const stdout = pass2.stdout;
    const hasNothing = stdout.includes('Nothing to apply');
    const hasDone = stdout.includes('Done.');
    expect(hasNothing || hasDone).toBe(true);
    // Assert ZERO per-file 'copied' lines in pass 2 (scrubbed rewrites excluded)
    const lines = stdout.split('\n');
    const copiedLines = lines.filter(l => l.includes('copied  '));
    expect(copiedLines.length).toBe(0);
  }, 30000);
});
