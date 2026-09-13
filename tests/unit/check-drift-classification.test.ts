/**
 * Pure-function tests for propagate-to-templates.ts classifySettingsDrift()
 * (T-20260912-028, design 2026-09-12-validator-hardening-drift-marker-design).
 *
 * The classifier decides whether a drifted L1→L2 .gemini/settings.json pair is
 * a tolerated intentional overlay (shared keys present + deep-equal, no
 * claude-only leak) or unexpected semantic drift — fail-closed on parse errors
 * and on an empty/missing shared-keys contract.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
  classifySettingsDrift,
  type PlatformSettingsContract,
} from '../../scripts/propagate-to-templates.ts';

const SESSION_START_HOOK = { hooks: { SessionStart: [{ type: 'command', command: 'echo hi' }] } };

/** Minimal contract mirroring docs/templates/common-contract.json platform_settings. */
const CONTRACT: PlatformSettingsContract = {
  platform_settings: {
    shared: { keys: { 'hooks.SessionStart': { validation: 'array' } } },
    claude_only: { keys: { permissions: {}, env: {} } },
  },
};

describe('classifySettingsDrift', () => {
  test('shared key equal + extra variant keys → tolerated, variantOwnedKeys lists the extras', () => {
    const l1 = JSON.stringify({ ...SESSION_START_HOOK, mcpServers: { a: {} } });
    const l2 = JSON.stringify({
      ...SESSION_START_HOOK,
      _comment: 'variant note',
      mcpServers: { a: {}, b: {} },
    });
    const result = classifySettingsDrift(l1, l2, CONTRACT);
    expect(result.classification).toBe('tolerated');
    expect(result.variantOwnedKeys).toEqual(['_comment']);
    expect(result.mismatchedSharedKeys).toEqual([]);
    expect(result.leakedClaudeOnlyKeys).toEqual([]);
    expect(result.parseError).toBeNull();
  });

  test('shared key value differs → unexpected, key listed as mismatched', () => {
    const l1 = JSON.stringify(SESSION_START_HOOK);
    const l2 = JSON.stringify({
      hooks: { SessionStart: [{ type: 'command', command: 'echo DIFFERENT' }] },
    });
    const result = classifySettingsDrift(l1, l2, CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.mismatchedSharedKeys).toEqual(['hooks.SessionStart']);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('shared key missing in L2 → unexpected, key listed as mismatched', () => {
    const l1 = JSON.stringify(SESSION_START_HOOK);
    const l2 = JSON.stringify({ mcpServers: { a: {} } });
    const result = classifySettingsDrift(l1, l2, CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.mismatchedSharedKeys).toEqual(['hooks.SessionStart']);
  });

  test('invalid JSON in L2 → unexpected with parseError "L2"', () => {
    const result = classifySettingsDrift(JSON.stringify(SESSION_START_HOOK), '{ not json', CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.parseError).toBe('L2');
  });

  test('invalid JSON in L1 → unexpected with parseError "L1"', () => {
    const result = classifySettingsDrift('nope', JSON.stringify(SESSION_START_HOOK), CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.parseError).toBe('L1');
  });

  test('FAIL-CLOSED: empty shared keys in contract → unexpected (nothing proves overlay intent)', () => {
    const emptyKeys: PlatformSettingsContract = {
      platform_settings: { shared: { keys: {} }, claude_only: { keys: {} } },
    };
    const result = classifySettingsDrift(
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'a' }),
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'b' }),
      emptyKeys
    );
    expect(result.classification).toBe('unexpected');
  });

  test('FAIL-CLOSED: contract null → unexpected', () => {
    const result = classifySettingsDrift(
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'a' }),
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'b' }),
      null
    );
    expect(result.classification).toBe('unexpected');
  });

  test('FAIL-CLOSED: platform_settings absent from contract → unexpected', () => {
    const result = classifySettingsDrift(
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'a' }),
      JSON.stringify({ ...SESSION_START_HOOK, _comment: 'b' }),
      { some_other_section: {} }
    );
    expect(result.classification).toBe('unexpected');
  });

  test('FAIL-CLOSED: shared section absent → unexpected', () => {
    const noShared: PlatformSettingsContract = {
      platform_settings: { claude_only: { keys: {} } },
    };
    const result = classifySettingsDrift(
      JSON.stringify(SESSION_START_HOOK),
      JSON.stringify(SESSION_START_HOOK),
      noShared
    );
    expect(result.classification).toBe('unexpected');
  });

  test('claude_only key leaked into an L2 .gemini file → unexpected, leak populated', () => {
    const l2 = JSON.stringify({ ...SESSION_START_HOOK, permissions: { allow: ['Bash'] } });
    const result = classifySettingsDrift(JSON.stringify(SESSION_START_HOOK), l2, CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.leakedClaudeOnlyKeys).toContain('permissions');
  });

  test('claude_only key leaked into the L1 .gemini file → unexpected, leak populated', () => {
    const l1 = JSON.stringify({ ...SESSION_START_HOOK, env: { FOO: 'bar' } });
    const result = classifySettingsDrift(l1, JSON.stringify(SESSION_START_HOOK), CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.leakedClaudeOnlyKeys).toContain('env');
  });

  test('dotted claude_only key (hooks.PreToolUse) leak is detected', () => {
    const contract: PlatformSettingsContract = {
      platform_settings: {
        shared: { keys: { 'hooks.SessionStart': {} } },
        claude_only: { keys: { 'hooks.PreToolUse': {} } },
      },
    };
    const l2 = JSON.stringify({
      ...SESSION_START_HOOK,
      hooks: { ...SESSION_START_HOOK.hooks, PreToolUse: [{ type: 'command', command: 'x' }] },
    });
    const result = classifySettingsDrift(JSON.stringify(SESSION_START_HOOK), l2, contract);
    expect(result.classification).toBe('unexpected');
    expect(result.leakedClaudeOnlyKeys).toEqual(['hooks.PreToolUse']);
  });

  test('array order sensitivity: SessionStart [A,B] vs [B,A] → unexpected (order is execution order)', () => {
    const hookA = { type: 'command', command: 'bun a.ts' };
    const hookB = { type: 'command', command: 'bun b.ts' };
    const l1 = JSON.stringify({ hooks: { SessionStart: [hookA, hookB] } });
    const l2 = JSON.stringify({ hooks: { SessionStart: [hookB, hookA] } });
    const result = classifySettingsDrift(l1, l2, CONTRACT);
    expect(result.classification).toBe('unexpected');
    expect(result.mismatchedSharedKeys).toEqual(['hooks.SessionStart']);
  });

  test('key ordering / whitespace-only differences do not affect deep equality', () => {
    const l1 = JSON.stringify({ hooks: { SessionStart: [1, 2] }, zzz: 'x' });
    const l2 = '{ "zzz": "x", "hooks": { "SessionStart": [1, 2] } }';
    const result = classifySettingsDrift(l1, l2, CONTRACT);
    expect(result.classification).toBe('tolerated');
  });
});
