import { describe, test, expect, beforeEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const HOOK_PATH = join(import.meta.dir, '../../scripts/hooks/gateguard-fact-force.ts');

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn the GateGuard hook script with the given stdin JSON and extra args.
 */
function runHook(stdinJson: string, extraArgs: string[] = []): HookResult {
  const result = spawnSync('bun', [HOOK_PATH, ...extraArgs], {
    input: stdinJson,
    encoding: 'utf-8',
    timeout: 10000,
    cwd: import.meta.dir.replace(/[/\\]tests[/\\]unit$/, ''),
  });

  return {
    exitCode: result.status ?? -1,
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
  };
}

describe('GateGuard hook script', () => {
  // GateGuard tracks state per-process, but since each test spawns a new
  // process, state isolation is automatic.

  test('safe path (memory/) — allow, exit 0', () => {
    const input = JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: 'memory/2026-08-01.md', content: 'test' },
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    // No stdout output for safe paths (silent pass-through)
  });

  test('safe path (CHANGELOG.md) — allow, exit 0', () => {
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { file_path: 'CHANGELOG.md', old_string: 'x', new_string: 'y' },
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
  });

  test('first edit + importers found + ask mode (default Claude) — ask, exit 0', () => {
    // scripts/lib/ssrf.ts has known importers (ingest-external-skills.ts, etc.)
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: {
        file_path: 'scripts/lib/ssrf.ts',
        old_string: 'x',
        new_string: 'y',
      },
    });
    const result = runHook(input);

    // Exit 0 for ask mode
    expect(result.exitCode).toBe(0);
    // Should output JSON with decision: ask
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('ask');
    expect(parsed.reason).toContain('GATEGUARD');
    expect(parsed.reason).toContain('importer');
  });

  test('first edit + deny mode — deny, exit 2', () => {
    // scripts/lib/ssrf.ts has known importers
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: {
        file_path: 'scripts/lib/ssrf.ts',
        old_string: 'x',
        new_string: 'y',
      },
    });
    const result = runHook(input, ['--mode', 'deny']);

    // Exit 2 for deny mode
    expect(result.exitCode).toBe(2);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('deny');
    expect(parsed.reason).toContain('GATEGUARD');
  });

  test('no file_path — allow, exit 0', () => {
    const input = JSON.stringify({
      tool_name: 'Edit',
      tool_input: { old_string: 'x', new_string: 'y' },
    });
    const result = runHook(input);

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('Gemini platform — deny mode regardless of --mode flag', () => {
    const input = JSON.stringify({
      tool_name: 'write_file',
      tool_input: {
        path: 'scripts/lib/ssrf.ts',
        content: 'test',
      },
    });
    // Even with --mode ask, Gemini should use deny
    const result = runHook(input, ['--platform', 'gemini', '--mode', 'ask']);

    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed.decision).toBe('deny');
    expect(parsed.reason).toContain('GATEGUARD');
  });

  test('malformed stdin JSON — allow, exit 0 (graceful)', () => {
    const result = runHook('{not valid json');

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('');
  });

  test('empty stdin — allow, exit 0', () => {
    const result = runHook('');

    expect(result.exitCode).toBe(0);
  });
});
