import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const HOOK_PATH = join(import.meta.dir, '../../scripts/hooks/post-write-lifecycle-check.ts');

interface HookResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn the post-write lifecycle check hook with the given stdin JSON and extra args.
 * `timeoutMs` defaults to the hook's own spawn budget; the Claude-mode test passes a
 * larger budget because the child `bun scripts/audit.ts` alone can exceed 30s under
 * the full-suite parallel load on win32 (observed 2026-10-12; same flake family as
 * PR #785).
 */
function runHook(stdinJson: string, extraArgs: string[] = [], timeoutMs = 30000): HookResult {
  const result = spawnSync('bun', [HOOK_PATH, ...extraArgs], {
    input: stdinJson,
    encoding: 'utf-8',
    timeout: timeoutMs,
    cwd: import.meta.dir.replace(/[/\\]tests[/\\]unit$/, ''),
  });

  return {
    exitCode: result.status ?? -1,
    stdout: (result.stdout as string) || '',
    stderr: (result.stderr as string) || '',
  };
}

describe('post-write-lifecycle-check hook script', () => {
  test('Gemini mode — valid AfterTool stdin, non-blocking', () => {
    const input = JSON.stringify({
      tool_name: 'write_file',
      tool_input: {
        path: 'README.md',
        content: '# Test',
      },
    });
    const result = runHook(input, ['--platform', 'gemini']);

    // Non-blocking: exit 0
    expect(result.exitCode).toBe(0);
  });

  test('Gemini mode — no path in tool_input — non-blocking', () => {
    const input = JSON.stringify({
      tool_name: 'write_file',
      tool_input: { content: '# Test' },
    });
    const result = runHook(input, ['--platform', 'gemini']);

    expect(result.exitCode).toBe(0);
  });

  test('Gemini mode — malformed JSON — non-blocking', () => {
    const result = runHook('{broken json', ['--platform', 'gemini']);

    expect(result.exitCode).toBe(0);
  });

  test('Gemini mode — empty stdin — non-blocking', () => {
    const result = runHook('', ['--platform', 'gemini']);

    expect(result.exitCode).toBe(0);
  });

  // Claude mode always spawns `bun scripts/audit.ts` as a child (network I/O
  // included), so total latency can exceed bun's default 5s test timeout —
  // observed flaking on windows-latest CI (2026-08-30, PR #785). Match the
  // 30s spawnSync budget already used by runHook, with headroom: under the
  // full-suite parallel load on win32 the child audit.ts alone can eat the
  // 30s budget (observed 2026-10-12) — align with the runner's 120s unit
  // budget instead of racing it.
  test(
    'Claude mode (no --platform) — reads git diff',
    () => {
      const input = JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: 'some-file.ts', content: 'test' },
      });
      // Claude mode ignores stdin and reads git diff — may take longer
      const result = runHook(input, [], 120000);

      // Non-blocking: exit 0
      expect(result.exitCode).toBe(0);
    },
    120000,
  );
});
