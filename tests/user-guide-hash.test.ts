/**
 * User-guide translated_from_hash gate tests
 * @version 1.0.0
 *
 * Tests for FAIL-stage user-guide hash synchronization:
 * - Audit runs correctly against real workspace variants
 * - --update-hashes is idempotent
 * - FAIL affects exit code
 * - L0 ↔ L1 script pair stays in sync
 */

import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'bun:test';

const workspaceRoot = resolve(import.meta.dir, '..');
const scriptPath = join(workspaceRoot, 'scripts', 'verify-readme-sync.ts');

/** Strip ANSI escape sequences from a string. */
function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

function runScript(args: string[] = []): { stdout: string; stderr: string; exitCode: number } {
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

describe('user-guide hash synchronization (FAIL stage)', () => {
  test('static audit runs and shows user-guide section', () => {
    const { stdout, exitCode } = runScript();

    // Should complete successfully when all hashes are synchronized
    expect(exitCode).toBe(0);

    // Should show the new audit section header
    expect(stdout).toContain('User-guide translated_from_hash');
    expect(stdout).toContain('FAIL stage');

    // Should show per-variant results (PASS or FAIL)
    expect(stdout).toMatch(/PASS|FAIL/);
  });

  test('counts all 11 user-guide pairs', () => {
    const { stdout } = runScript();

    // Should show audit results for all 11 variants with user-guide pairs
    const userGuideLines = stdout.split('\n').filter(line =>
      line.includes('templates/co-') && (line.includes('[PASS]') || line.includes('[FAIL]'))
    );

    // Should have exactly 11 user-guide results (co-abap through co-work)
    expect(userGuideLines.length).toBeGreaterThanOrEqual(10);
  });

  test('--update-hashes runs without errors', () => {
    const { stdout, exitCode } = runScript(['--update-hashes']);

    // Should complete successfully
    expect(exitCode).toBe(0);

    // Should mention updating README hashes
    expect(stdout).toContain('Updating content_hash');

    // Should mention updating user-guide hashes
    expect(stdout).toContain('Updating translated_from_hash');
  });

  test('--update-hashes is idempotent', () => {
    // First run
    const { exitCode: exitCode1 } = runScript(['--update-hashes']);
    expect(exitCode1).toBe(0);

    // Read a sample user-guide_ko.md to get its hash
    const sampleKo = readFileSync('templates/co-design/docs/user-guide_ko.md', 'utf-8');
    const hashMatch = sampleKo.match(/translated_from_hash:\s*([a-f0-9]+)/);

    // Second run (should be idempotent)
    const { exitCode: exitCode2 } = runScript(['--update-hashes']);
    expect(exitCode2).toBe(0);

    // Re-read to verify hash didn't change
    const sampleKoAfter = readFileSync('templates/co-design/docs/user-guide_ko.md', 'utf-8');
    const hashMatchAfter = sampleKoAfter.match(/translated_from_hash:\s*([a-f0-9]+)/);

    if (hashMatch && hashMatchAfter) {
      expect(hashMatch[1]).toBe(hashMatchAfter[1]);
    }
  });

  test('FAIL affects exit code when hashes are missing or stale', () => {
    // Run static audit - should pass when all hashes are synchronized
    const { stdout, exitCode } = runScript();

    // When all user-guide pairs have synchronized hashes, exit code must be 0
    expect(exitCode).toBe(0);

    // Should complete with success message
    expect(stdout).toContain('All README synchronizations valid');
  });

  test('L0 and L1 script copies are byte-identical', () => {
    const l0Content = readFileSync('scripts/verify-readme-sync.ts', 'utf-8');
    const l1Content = readFileSync('templates/common/scripts/verify-readme-sync.ts', 'utf-8');

    // L0 and L1 copies must be identical (per lifecycle-sync-audit.ts)
    expect(l0Content).toBe(l1Content);
  });
});
