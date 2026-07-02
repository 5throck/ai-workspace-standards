// verify-new-theme.test.ts — tests for the composite theme registration gate.
//
// Tests that verify-new-theme.ts runs successfully against existing themes
// in fast mode, and that error reporting works for non-existent themes.

import { describe, it, expect } from 'bun:test';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

const SCRIPT = resolve(dirname(import.meta.path), '../verify-new-theme.ts');
const ROOT = resolve(dirname(import.meta.path), '../../..');

// Existing themes that should pass fast-mode verification.
const EXISTING_THEMES = ['outline', 'pitch', 'pitch-enhanced', 'vertical', 'zen'];

function runVerify(theme: string, extraArgs: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(
      `bun "${SCRIPT}" ${theme} ${extraArgs}`,
      { encoding: 'utf-8', timeout: 30000, cwd: ROOT },
    );
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() || '',
      stderr: err.stderr?.toString() || err.message || '',
      exitCode: err.status ?? 1,
    };
  }
}

function runVerifyJson(theme: string, extraArgs: string): any {
  try {
    const stdout = execSync(
      `bun "${SCRIPT}" ${theme} ${extraArgs} --json`,
      { encoding: 'utf-8', timeout: 30000, cwd: ROOT },
    );
    return { data: JSON.parse(stdout), exitCode: 0 };
  } catch (err: any) {
    const raw = err.stdout?.toString() || '';
    try {
      return { data: JSON.parse(raw), exitCode: err.status ?? 1 };
    } catch {
      return { data: null, exitCode: err.status ?? 1, stderr: err.stderr?.toString() || err.message };
    }
  }
}

describe('verify-new-theme', () => {
  describe('fast mode against existing themes', () => {
    for (const theme of EXISTING_THEMES) {
      it(`${theme}: passes fast-mode verification`, () => {
        const { stdout, exitCode } = runVerify(theme, '--fast');
        expect(exitCode).toBe(0);
        expect(stdout).toContain('✅');
        expect(stdout).toContain(`${theme}`);
        expect(stdout).not.toContain('❌');
      });

      it(`${theme}: reports PASS for checks 1-3 in fast mode`, () => {
        const { data, exitCode } = runVerifyJson(theme, '--fast');
        expect(exitCode).toBe(0);
        expect(data).not.toBeNull();
        expect(data.theme).toBe(theme);
        expect(data.fast_mode).toBe(true);

        // Checks 1-3 should pass
        for (const r of data.results.slice(0, 3)) {
          expect(r.status).toBe('PASS');
        }

        // Checks 4-5 should be skipped
        for (const r of data.results.slice(3)) {
          expect(r.status).toBe('SKIP');
          expect(r.details).toContain('fast mode');
        }
      });
    }
  });

  describe('fast mode timing', () => {
    it('completes fast mode in under 3 seconds', () => {
      const start = Date.now();
      const { exitCode } = runVerify('outline', '--fast');
      const elapsed = Date.now() - start;
      expect(exitCode).toBe(0);
      expect(elapsed).toBeLessThan(3000);
    });
  });

  describe('non-existent theme', () => {
    it('exits 1 for a theme not in THEMES.md', () => {
      const { exitCode } = runVerify('nonexistent-fantasy-theme', '--fast');
      expect(exitCode).toBe(1);
    });

    it('reports FAIL for THEMES.md marker check', () => {
      const { data, exitCode } = runVerifyJson('nonexistent-fantasy-theme', '--fast');
      expect(exitCode).toBe(1);
      // Check 3 should fail (theme not in THEMES.md)
      const check3 = data.results.find((r: any) => r.id === 3);
      expect(check3).toBeDefined();
      expect(check3.status).toBe('FAIL');
      expect(check3.details).toContain('nonexistent-fantasy-theme');
    });

    it('reports JSON output with correct summary', () => {
      const { data, exitCode } = runVerifyJson('nonexistent-fantasy-theme', '--fast');
      expect(exitCode).toBe(1);
      expect(data.summary.fail).toBeGreaterThan(0);
      expect(data.summary.pass).toBeGreaterThan(0);
    });
  });

  describe('--json output format', () => {
    it('produces valid JSON with expected structure', () => {
      const { data, exitCode } = runVerifyJson('outline', '--fast');
      expect(exitCode).toBe(0);
      expect(data).toHaveProperty('theme');
      expect(data).toHaveProperty('style');
      expect(data).toHaveProperty('fast_mode');
      expect(data).toHaveProperty('total_duration_ms');
      expect(data).toHaveProperty('results');
      expect(data).toHaveProperty('summary');
      expect(data.results).toHaveLength(5);
      expect(data.summary).toHaveProperty('pass');
      expect(data.summary).toHaveProperty('fail');
      expect(data.summary).toHaveProperty('skip');
    });

    it('each result has id, name, status, duration_ms', () => {
      const { data, exitCode } = runVerifyJson('outline', '--fast');
      expect(exitCode).toBe(0);
      for (const r of data.results) {
        expect(r).toHaveProperty('id');
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('status');
        expect(r).toHaveProperty('duration_ms');
        expect(['PASS', 'FAIL', 'SKIP']).toContain(r.status);
      }
    });
  });

  describe('--style flag', () => {
    it('accepts --style flag and reports it in JSON output', () => {
      const { data, exitCode } = runVerifyJson('outline', '--fast --style minimal');
      expect(exitCode).toBe(0);
      expect(data.style).toBe('minimal');
    });
  });
});
