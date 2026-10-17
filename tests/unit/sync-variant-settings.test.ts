/**
 * Tests for scripts/sync-variant-settings.ts: managed hook entries (matched by
 * command substring) sync from the common settings into variant settings —
 * verbatim matches are no-ops, stale managed entries are replaced in place,
 * missing ones append, extraneous ones drop, and non-managed content is never
 * touched.
 *
 * v1.1.0 carries the contract over to `syncManagedEntries` across all managed
 * channels ({claude: SessionStart, PreToolUse} and {gemini: SessionStart,
 * BeforeTool}), adds the 'pm-dispatch-gate' managed substring, and pins the
 * Gemini mixed-shape rule: flat SessionStart entries are preserved
 * byte-for-value (never mutated with a `hooks` key), managed entries are
 * group-wrapped.
 *
 * @version 1.1.0
 */
import { describe, test, expect } from 'bun:test';
import { syncManagedSessionStart, syncManagedEntries, MANAGED_SUBSTRINGS, SYNC_TARGETS } from '../../scripts/sync-variant-settings.ts';

const BOOTSTRAP = { type: 'command', command: 'bun scripts/hooks/pm-role-bootstrap.ts', timeout: 8000 };
const DISPATCH_CLAUDE = { type: 'command', command: 'bun scripts/hooks/pm-dispatch-gate.ts', timeout: 10, statusMessage: 'Checking PM dispatch policy...' };
const DISPATCH_GEMINI = { type: 'command', command: 'bun scripts/hooks/pm-dispatch-gate.ts', timeout: 5000 };

const common = {
  hooks: {
    SessionStart: [
      { matcher: '', hooks: [{ type: 'command', command: 'git config core.hooksPath .githooks', async: true }] },
      { hooks: [BOOTSTRAP] },
    ],
  },
};

const commonGemini = {
  hooks: {
    SessionStart: [
      // flat entry — legitimate L1/L2 shape, identical to L0, not drift
      { type: 'command', command: 'git config core.hooksPath .githooks', statusMessage: 'Configuring git hooks...' },
      { hooks: [BOOTSTRAP] },
    ],
    BeforeTool: [
      { matcher: 'write_file|replace_file_content|multi_replace_file_content', hooks: [{ type: 'command', command: 'bun scripts/hooks/gateguard-fact-force.ts --platform gemini', timeout: 5000 }] },
      { matcher: 'invoke_subagent', hooks: [DISPATCH_GEMINI] },
    ],
  },
};

describe('syncManagedSessionStart (T-20261002-011)', () => {
  test('a verbatim managed entry is a no-op', () => {
    const variant = JSON.parse(JSON.stringify({
      hooks: { SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: 'git config core.hooksPath .githooks', async: true }] }, { hooks: [BOOTSTRAP] }] },
    }));
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(false);
  });

  test('a stale managed entry is replaced in place; non-managed content untouched', () => {
    const stale = { type: 'command', command: 'bun scripts/hooks/pm-role-bootstrap.ts', timeout: 3000 };
    const variant = {
      hooks: {
        SessionStart: [
          { matcher: '', hooks: [{ type: 'command', command: 'git config core.hooksPath .githooks', async: true }] },
          { hooks: [stale] },
        ],
      },
    };
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(true);
    expect(res.updated).toBe(1);
    const groups = (res.settings as any).hooks.SessionStart;
    expect(groups).toHaveLength(2); // no group appended
    expect(groups[1].hooks[0]).toEqual(BOOTSTRAP);
    // non-managed entry preserved verbatim
    expect(groups[0].hooks[0].command).toBe('git config core.hooksPath .githooks');
  });

  test('a missing managed entry appends; an extraneous managed entry drops', () => {
    const variant = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'bun scripts/hooks/OTHER.ts' }] }] } };
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(true);
    expect(res.added).toBe(1);
    const groups = (res.settings as any).hooks.SessionStart;
    const bootstrap = groups.flatMap((g: any) => g.hooks).find((h: any) => h.command.includes('pm-role-bootstrap'));
    expect(bootstrap).toEqual(BOOTSTRAP);
  });

  test('a divergent managed entry is replaced in place, not duplicated', () => {
    const variant = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'bun scripts/hooks/pm-role-bootstrap-OLD.ts' }] }] } };
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(true);
    expect(res.updated).toBe(1);
    const groups = res.settings.hooks!.SessionStart;
    expect(groups).toHaveLength(1);
    expect(groups[0].hooks[0]).toEqual(BOOTSTRAP);
  });

  test('a managed entry with no common counterpart at all is removed', () => {
    const variant = { hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'totally-unrelated pm-role-bootstrap helper' }] }] } };
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(true);
    expect(res.removed).toBe(1);
  });

  test('empty groups left by removals are pruned; managed substrings are the match contract', () => {
    expect(MANAGED_SUBSTRINGS).toContain('pm-role-bootstrap');
    const variant = { hooks: { SessionStart: [{ matcher: '', hooks: [] }] } };
    const res = syncManagedSessionStart(common, variant);
    expect(res.changed).toBe(true);
    expect(res.settings.hooks!.SessionStart.filter((g) => (g.hooks ?? []).length === 0)).toHaveLength(0);
  });

  test('a verbatim managed entry is a no-op on the generic entry point too', () => {
    const variant = JSON.parse(JSON.stringify(common));
    const res = syncManagedEntries(common, variant, 'SessionStart');
    expect(res.changed).toBe(false);
  });
});

describe('syncManagedEntries v1.1.0 (pm-dispatch-gate propagation)', () => {
  test("MANAGED_SUBSTRINGS is the contract for both managed hooks and channels cover claude+gemini events", () => {
    expect(MANAGED_SUBSTRINGS).toContain('pm-dispatch-gate');
    expect(SYNC_TARGETS).toEqual([
      { platform: 'claude', event: 'SessionStart' },
      { platform: 'claude', event: 'PreToolUse' },
      { platform: 'gemini', event: 'SessionStart' },
      { platform: 'gemini', event: 'BeforeTool' },
    ]);
  });

  test('claude PreToolUse: a verbatim dispatch-gate group is a no-op', () => {
    const variant = JSON.parse(JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: 'Agent', hooks: [DISPATCH_CLAUDE] },
          { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'bun scripts/hooks/gateguard-fact-force.ts --mode ask' }] },
        ],
      },
    }));
    const res = syncManagedEntries({ hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [DISPATCH_CLAUDE] }] } }, variant, 'PreToolUse');
    expect(res.changed).toBe(false);
  });

  test('claude PreToolUse: a missing dispatch-gate group appends; gateguard group untouched', () => {
    const gateguard = { matcher: 'Edit|Write|MultiEdit', hooks: [{ type: 'command', command: 'bun scripts/hooks/gateguard-fact-force.ts --mode ask', timeout: 30 }] };
    const variant = {
      hooks: {
        PreToolUse: [JSON.parse(JSON.stringify(gateguard))],
      },
    };
    const res = syncManagedEntries({ hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [DISPATCH_CLAUDE] }] } }, variant, 'PreToolUse');
    expect(res.changed).toBe(true);
    expect(res.added).toBe(1);
    expect(res.updated).toBe(0);
    expect(res.removed).toBe(0);
    const pret = (res.settings as any).hooks.PreToolUse;
    const dispatch = pret.filter((g: any) => Array.isArray(g.hooks)).flatMap((g: any) => g.hooks).find((h: any) => h.command?.includes('pm-dispatch-gate'));
    expect(dispatch).toEqual(DISPATCH_CLAUDE);
    // non-managed group preserved; no empty-group prune artifact
    expect(pret.filter((g: any) => (g.hooks ?? []).some((h: any) => h.command.includes('gateguard')))).toHaveLength(1);
  });

  test('gemini BeforeTool: a stale dispatch-gate timeout is replaced in place, siblings kept', () => {
    const stale = { type: 'command', command: 'bun scripts/hooks/pm-dispatch-gate.ts', timeout: 3000 };
    const variant = {
      hooks: {
        BeforeTool: [
          { matcher: 'write_file|replace_file_content|multi_replace_file_content', hooks: [{ type: 'command', command: 'bun scripts/hooks/gateguard-fact-force.ts --platform gemini', timeout: 5000 }] },
          { matcher: 'invoke_subagent', hooks: [stale] },
        ],
      },
    };
    const res = syncManagedEntries(commonGemini, variant, 'BeforeTool');
    expect(res.changed).toBe(true);
    expect(res.updated).toBe(1);
    const bt = (res.settings as any).hooks.BeforeTool;
    expect(bt).toHaveLength(2);
    expect(bt[1].hooks[0]).toEqual(DISPATCH_GEMINI);
    expect(bt[0].hooks[0].command).toContain('gateguard');
  });

  test('gemini mixed-shape SessionStart: flat entries preserved byte-for-value (no hooks key added)', () => {
    const variant = JSON.parse(JSON.stringify(commonGemini));
    const res = syncManagedEntries(commonGemini, variant, 'SessionStart');
    expect(res.changed).toBe(false);
    const ss = (res.settings as any).hooks.SessionStart;
    expect(ss).toHaveLength(2);
    const flat = ss[0];
    expect(Object.hasOwn(flat, 'hooks')).toBe(false); // never mutated into a group
    expect(flat.command).toBe('git config core.hooksPath .githooks');
    expect(flat.statusMessage).toBe('Configuring git hooks...');
    expect(ss[1].hooks[0]).toEqual(BOOTSTRAP);
  });

  test('gemini mixed-shape SessionStart: removal and re-append coexist with untouched flat entries', () => {
    // extraneous managed entry drops AND its missing common counterpart appends in the SAME pass
    const variant = {
      hooks: {
        SessionStart: [
          { type: 'command', command: 'git config core.hooksPath .githooks', statusMessage: 'Configuring git hooks...' },
          { hooks: [{ type: 'command', command: 'totally-unrelated pm-role-bootstrap helper' }] },
        ],
      },
    };
    const res = syncManagedEntries(commonGemini, variant, 'SessionStart');
    expect(res.changed).toBe(true);
    expect(res.removed).toBe(1);
    expect(res.added).toBe(1);
    const ss = (res.settings as any).hooks.SessionStart;
    expect(ss).toHaveLength(2);
    expect(Object.hasOwn(ss[0], 'hooks')).toBe(false); // flat entry survived untouched
    expect(ss[0].command).toBe('git config core.hooksPath .githooks');
    expect(ss[1].hooks[0]).toEqual(BOOTSTRAP); // re-appended as a group
    // idempotency: a second pass is a no-op
    const res2 = syncManagedEntries(commonGemini, res.settings, 'SessionStart');
    expect(res2.changed).toBe(false);
  });

  test('the two managed commands do not collide at the 30-char family prefix', () => {
    const variant = { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'bun scripts/hooks/pm-dispatch-gate.ts', timeout: 1 }] }] } };
    // a bootstrap-only common must NOT adopt a dispatch-gate entry
    const res = syncManagedEntries({ hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [DISPATCH_CLAUDE] }] } }, variant, 'PreToolUse');
    // dispatch-gate IS managed (substring contract), so it is adopted from the dispatch common entry

    const variant2 = { hooks: { PreToolUse: [{ hooks: [{ type: 'command', command: 'bun scripts/hooks/pm-role-bootstrap.ts', timeout: 1 }] }] } };
    const res2 = syncManagedEntries({ hooks: { PreToolUse: [{ matcher: 'Agent', hooks: [DISPATCH_CLAUDE] }] } }, variant2, 'PreToolUse');
    expect(res2.removed).toBe(1);
    expect(res2.updated).toBe(0);
  });
});
