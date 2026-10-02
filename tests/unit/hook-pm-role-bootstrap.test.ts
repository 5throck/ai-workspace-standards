import { describe, test, expect, beforeEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const HOOK_PATH = join(import.meta.dir, '../../scripts/hooks/pm-role-bootstrap.ts');

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn the pm-role-bootstrap hook script with the given stdin JSON.
 * cwd can be overridden to test behavior in different directories.
 */
function runHook(stdinJson: string, cwd?: string): HookResult {
  const result = spawnSync('bun', [HOOK_PATH], {
    input: stdinJson,
    encoding: 'utf-8',
    timeout: 10000,
    cwd: cwd || import.meta.dir.replace(/[/\\]tests[/\\]unit$/, ''),
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: cwd || undefined,
    },
  });

  return {
    exitCode: result.status ?? -1,
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
  };
}

describe('PM Role Bootstrap hook script', () => {
  test('Case 1: Valid SessionStart stdin — exit 0, valid JSON with additionalContext', () => {
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'startup',
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBeTruthy();

    // Parse and validate output
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.hookSpecificOutput).toBeDefined();
    expect(parsed.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(parsed.hookSpecificOutput.additionalContext).toBeTruthy();

    // Verify the context contains the expected guidance
    expect(parsed.hookSpecificOutput.additionalContext).toContain('AGENTS.md');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('agents/pm.md');
  });

  test('Case 2: Malformed stdin JSON — exit 0 (fail-open)', () => {
    const input = '{not valid json';
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    // No stdout on fail-open
    expect(result.stdout.trim()).toBe('');
  });

  test('Case 3: Missing agents/pm.md (temporary project dir) — exit 0, no stdout', () => {
    // Create a temporary directory without the required files
    const tmpDir = mkdtempSync(join(import.meta.dir, 'tmp-'));

    try {
      const input = JSON.stringify({
        hook_event_name: 'SessionStart',
        source: 'startup',
      });
      const result = runHook(input, tmpDir);

      expect(result.exitCode).toBe(0);
      // No stdout when files are missing
      expect(result.stdout.trim()).toBe('');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('Case 4: Payload length check — 1000 characters or fewer', () => {
    const input = JSON.stringify({
      hook_event_name: 'SessionStart',
      source: 'startup',
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    const payload = parsed.hookSpecificOutput.additionalContext;

    expect(payload.length).toBeLessThanOrEqual(1000);
  });

  test('Additional: Non-SessionStart event — exit 0, no stdout', () => {
    const input = JSON.stringify({
      hook_event_name: 'UserPromptSubmit',
      source: 'startup',
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('Additional: Empty stdin — exit 0 (fail-open)', () => {
    const result = runHook('');

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });
});
