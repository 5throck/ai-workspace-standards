/**
 * Tests for scripts/sync-variant-settings.ts (T-20261002-011): managed SessionStart
 * hook entries (matched by command substring) sync from the common settings into
 * variant settings — verbatim matches are no-ops, stale managed entries are replaced
 * in place, missing ones append, extraneous ones drop, and non-managed content is
 * never touched.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { syncManagedSessionStart, MANAGED_SUBSTRINGS } from '../../scripts/sync-variant-settings.ts';

const BOOTSTRAP = { type: 'command', command: 'bun scripts/hooks/pm-role-bootstrap.ts', timeout: 8000 };

const common = {
  hooks: {
    SessionStart: [
      { matcher: '', hooks: [{ type: 'command', command: 'git config core.hooksPath .githooks', async: true }] },
      { hooks: [BOOTSTRAP] },
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
});
