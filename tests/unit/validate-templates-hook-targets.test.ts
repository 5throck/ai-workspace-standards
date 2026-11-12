/**
 * Unit tests for the validate-templates.ts `hook-command-targets` arm
 * (v1.80.0, U-20261112-013): every hook `command` script target referenced in
 * template platform settings must exist in the effective template tree.
 *
 * The filesystem half of the check (variant-dir → templates/common fallback)
 * runs inside checkHookCommandTargets(); the pure primitives it composes —
 * collectHookCommands and extractHookScriptTargets — are pinned here.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  collectHookCommands,
  extractHookScriptTargets,
} from '../../scripts/validate-templates.ts';

describe('collectHookCommands (U-20261112-013)', () => {
  test('collects every command string across matcher-grouped Claude shape', () => {
    const settings = {
      hooks: {
        PostToolUse: [
          { matcher: 'Write|Edit', hooks: [{ type: 'command', command: 'bun scripts/sync-md.ts' }] },
          { matcher: 'Bash', hooks: [{ type: 'command', command: 'node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs"' }] },
        ],
      },
    };
    expect(collectHookCommands(settings)).toEqual([
      'bun scripts/sync-md.ts',
      'node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs"',
    ]);
  });

  test('collects commands from the flat Gemini/Codex hook shapes', () => {
    const flat = { hooks: { SessionStart: [{ type: 'command', command: 'git config core.hooksPath .githooks' }] } };
    expect(collectHookCommands(flat)).toEqual(['git config core.hooksPath .githooks']);
  });

  test('ignores non-command strings and non-object nodes', () => {
    expect(collectHookCommands({ a: 'just a string', b: 42, c: null })).toEqual([]);
    expect(collectHookCommands('a bare string')).toEqual([]);
    expect(collectHookCommands(undefined)).toEqual([]);
  });
});

describe('extractHookScriptTargets (U-20261112-013)', () => {
  test('bare script invocation', () => {
    expect(extractHookScriptTargets('bun scripts/sync-md.ts')).toEqual(['scripts/sync-md.ts']);
  });

  test('variable-prefix form (${CLAUDE_PROJECT_DIR:-.})', () => {
    expect(extractHookScriptTargets('node "${CLAUDE_PROJECT_DIR:-.}/.trail/hook.cjs" session-start || exit 0')).toEqual([
      '.trail/hook.cjs',
    ]);
  });

  test('subshell-prefix form ($(git rev-parse --show-toplevel))', () => {
    expect(extractHookScriptTargets('bun "$(git rev-parse --show-toplevel)/scripts/hooks/pm-role-bootstrap.ts"')).toEqual([
      'scripts/hooks/pm-role-bootstrap.ts',
    ]);
  });

  test('multiple targets with flags and args', () => {
    expect(extractHookScriptTargets('bun scripts/hooks/gateguard-fact-force.ts --mode ask')).toEqual([
      'scripts/hooks/gateguard-fact-force.ts',
    ]);
  });

  test('non-script commands carry no checkable target', () => {
    expect(extractHookScriptTargets('git config core.hooksPath .githooks')).toEqual([]);
  });

  test('deduplicates repeated targets in one command', () => {
    expect(extractHookScriptTargets('bun scripts/a.ts && bun scripts/a.ts')).toEqual(['scripts/a.ts']);
  });
});
