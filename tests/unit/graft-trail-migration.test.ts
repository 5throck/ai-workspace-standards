/**
 * Unit tests for the graft→trail migration policy (design
 * docs/designs/2026-10-31-graft-trail-migration-design.md, U-20261031-009):
 *
 *   1. lib/hook-dedupe.ts dropMissingPathHookEntries — the JSON_MERGE hook-entry
 *      guard (design R2.4 arm (a)): template hook entries whose command references
 *      a repo-relative path absent from the project are dropped from the TEMPLATE
 *      side before the deep merge, so a trail-init-rewritten project never gets
 *      graft-era hook entries re-added. Unmigrated shapes (every referenced path
 *      present) are byte-for-byte unchanged.
 *   2. lib/upgrade-policy.ts isTrailRetiredSeed / TRAIL_RETIRED_SEEDS — the
 *      retired-seed vocabulary for the SEED_SKIP (retired-surface) guard (design
 *      R2.4 arm (b)).
 *   3. The upgrade JSON_MERGE composition (guard → mergeSettingsData → dedupe →
 *      serialize) pinned on both fixture shapes: migrated (helper absent → no
 *      graft hooks in the merged payload) and unmigrated (helper present →
 *      graft-era hooks still merge, unchanged behavior).
 *
 * @version 1.0.0
 */
import { describe, expect, test } from 'bun:test';
import { dropMissingPathHookEntries } from '../../scripts/lib/hook-dedupe.ts';
import { isTrailRetiredSeed, TRAIL_RETIRED_SEEDS, mergeSettingsData } from '../../scripts/lib/upgrade-policy.ts';
import { dedupeClaudeSettingsHooks } from '../../scripts/lib/hook-dedupe.ts';

/** Fixture exists-predicate: a fixed set of paths that "exist" in the project. */
function existsOf(paths: string[]): (p: string) => boolean {
  const set = new Set(paths);
  return (p) => set.has(p);
}

describe('dropMissingPathHookEntries (trail-migration JSON_MERGE guard, R2.4 arm a)', () => {
  const GRAFT_HOOK_ENTRY = {
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" session-start',
      timeout: 10,
    }],
  };
  const GRAFT_GUARDED_HOOK_ENTRY = {
    matcher: 'Bash|mcp__graft__|Read|Grep|Glob',
    hooks: [{
      type: 'command',
      command: 'if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" ]; then node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" post-edit; fi',
      timeout: 30,
    }],
  };
  const NORMAL_HOOK_ENTRY = {
    matcher: 'Agent',
    hooks: [{
      type: 'command',
      command: 'bun scripts/hooks/pm-dispatch-gate.ts',
      timeout: 10,
    }],
  };
  const EXTLESS_HOOK_ENTRY = {
    matcher: '',
    hooks: [{ type: 'command', command: 'git config core.hooksPath .githooks' }],
  };

  function templateWith(...entries: unknown[]): unknown {
    return { effortLevel: 'high', hooks: { SessionStart: entries } };
  }

  test('migrated-project shape: helper absent → graft-era hook entries dropped', () => {
    const template = templateWith(GRAFT_HOOK_ENTRY, NORMAL_HOOK_ENTRY);
    const result = dropMissingPathHookEntries(template, existsOf(['scripts/hooks/pm-dispatch-gate.ts']));
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.event).toBe('SessionStart');
    expect(result.dropped[0]?.missingPath).toBe('.claude/helpers/graft-hooks.cjs');
    const hooks = (result.settings as { hooks: { SessionStart: unknown[] } }).hooks;
    expect(hooks.SessionStart).toHaveLength(1); // only the healthy entry survives
    expect(JSON.stringify(hooks.SessionStart)).not.toContain('graft-hooks.cjs');
    // Non-hooks template content untouched.
    expect((result.settings as { effortLevel: string }).effortLevel).toBe('high');
  });

  test('shell-guarded graft command (co-develop template shape) is dropped too', () => {
    const template = templateWith(GRAFT_GUARDED_HOOK_ENTRY);
    const result = dropMissingPathHookEntries(template, existsOf([]));
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.missingPath).toBe('.claude/helpers/graft-hooks.cjs');
    const hooks = (result.settings as { hooks: { SessionStart: unknown[] } }).hooks;
    expect(hooks.SessionStart).toHaveLength(0);
  });

  test('unmigrated shape: every referenced path present → nothing dropped, content unchanged', () => {
    const template = templateWith(GRAFT_HOOK_ENTRY, NORMAL_HOOK_ENTRY, EXTLESS_HOOK_ENTRY);
    const exists = existsOf([
      '.claude/helpers/graft-hooks.cjs',
      'scripts/hooks/pm-dispatch-gate.ts',
    ]);
    const result = dropMissingPathHookEntries(template, exists);
    expect(result.dropped).toHaveLength(0);
    expect(result.settings).toEqual(template); // deep-equal — byte-identical semantics
  });

  test('extensionless commands are never guard candidates', () => {
    const template = templateWith(EXTLESS_HOOK_ENTRY);
    const result = dropMissingPathHookEntries(template, existsOf([]));
    expect(result.dropped).toHaveLength(0);
    const hooks = (result.settings as { hooks: { SessionStart: unknown[] } }).hooks;
    expect(hooks.SessionStart).toHaveLength(1);
  });

  test('an entry with multiple commands drops when ANY referenced path is missing', () => {
    const entry = {
      matcher: '',
      hooks: [
        { type: 'command', command: 'bun scripts/hooks/healthy.ts' },
        { type: 'command', command: 'node ".claude/helpers/graft-statusline.cjs"' },
      ],
    };
    const result = dropMissingPathHookEntries(templateWith(entry), existsOf(['scripts/hooks/healthy.ts']));
    expect(result.dropped).toHaveLength(1);
    expect((result.settings as { hooks: { SessionStart: unknown[] } }).hooks.SessionStart).toHaveLength(0);
  });

  test('absolute paths and .. escapes are ignored (never candidates)', () => {
    const entry = {
      matcher: '',
      hooks: [{ type: 'command', command: 'node /usr/local/lib/tool.cjs && bun ../outside.ts' }],
    };
    const result = dropMissingPathHookEntries(templateWith(entry), existsOf([]));
    expect(result.dropped).toHaveLength(0);
  });

  test('malformed / hook-less input is returned untouched', () => {
    expect(dropMissingPathHookEntries(null, existsOf([])).dropped).toHaveLength(0);
    expect(dropMissingPathHookEntries({}, existsOf([])).dropped).toHaveLength(0);
    expect(dropMissingPathHookEntries({ hooks: 'not-an-array-map' }, existsOf([])).dropped).toHaveLength(0);
  });

  test('input is never mutated (pure)', () => {
    const template = templateWith(GRAFT_HOOK_ENTRY);
    const snapshot = JSON.stringify(template);
    dropMissingPathHookEntries(template, existsOf([]));
    expect(JSON.stringify(template)).toBe(snapshot);
  });
});

describe('isTrailRetiredSeed (trail-migration retired-seed vocabulary, R2.4 arm b)', () => {
  test('the three design-named graft-era seeds are retired', () => {
    expect(TRAIL_RETIRED_SEEDS).toEqual([
      '.mcp.json',
      '.claude/helpers/graft-hooks.cjs',
      '.claude/helpers/graft-statusline.cjs',
    ]);
    expect(isTrailRetiredSeed('.mcp.json')).toBe(true);
    expect(isTrailRetiredSeed('.claude/helpers/graft-hooks.cjs')).toBe(true);
    expect(isTrailRetiredSeed('.claude/helpers/graft-statusline.cjs')).toBe(true);
  });

  test('non-seeds are not retired', () => {
    expect(isTrailRetiredSeed('opencode.json')).toBe(false);
    expect(isTrailRetiredSeed('.claude/settings.json')).toBe(false);
    expect(isTrailRetiredSeed('.claude/helpers/keep-me.cjs')).toBe(false);
    expect(isTrailRetiredSeed('.mcp.json.bak')).toBe(false);
  });
});

describe('upgrade JSON_MERGE composition on the two fixture shapes (R5 acceptance)', () => {
  // The exact composition upgrade-project.ts v1.87.0 runs in the JSON_MERGE branch.
  function jsonMergeComposition(templateRaw: string, projectRaw: string, exists: (p: string) => boolean): string {
    const guardedTemplate = dropMissingPathHookEntries(JSON.parse(templateRaw), exists);
    const { merged } = mergeSettingsData(guardedTemplate.settings, JSON.parse(projectRaw));
    const deduped = dedupeClaudeSettingsHooks(merged);
    return `${JSON.stringify(deduped.settings, null, 2)}\n`;
  }

  const templateRaw = JSON.stringify({
    permissions: { allow: ['WebSearch(*)', 'Bash(graft:*)'] },
    hooks: {
      SessionStart: [{
        matcher: '',
        hooks: [{
          type: 'command',
          command: 'if [ -f "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" ]; then node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" session-start; fi',
        }],
      }],
    },
  });

  test('migrated shape: trail-rewritten settings never regain graft hook entries', () => {
    // trail init rewrote the hooks to .trail/hook.cjs and deleted the helper.
    const projectRaw = JSON.stringify({
      hooks: {
        SessionStart: [{ matcher: '', hooks: [{ type: 'command', command: 'node .trail/hook.cjs' }] }],
      },
    });
    const merged = jsonMergeComposition(templateRaw, projectRaw, existsOf([])); // helper absent
    const parsed = JSON.parse(merged);
    expect(JSON.stringify(parsed.hooks)).not.toContain('graft-hooks.cjs');
    // The trail hook the tool installed survives.
    expect(JSON.stringify(parsed.hooks)).toContain('.trail/hook.cjs');
    // Project-only permission entries survive the merge (project-wins union).
    expect(parsed.permissions.allow).toContain('Bash(graft:*)'); // template-side, outside the hook guard's scope (design R2.5/R2.6 residual)
    expect(JSON.stringify(parsed)).not.toContain('missingFlag');
  });

  test('unmigrated shape: helper present → graft-era hook entries still merge (unchanged behavior)', () => {
    const projectRaw = JSON.stringify({
      permissions: { allow: ['Bash(my-project-tool *)'] },
      hooks: { Stop: [] },
    });
    const exists = existsOf(['.claude/helpers/graft-hooks.cjs']);
    const merged = jsonMergeComposition(templateRaw, projectRaw, exists);
    const parsed = JSON.parse(merged);
    expect(JSON.stringify(parsed.hooks.SessionStart)).toContain('graft-hooks.cjs'); // template hooks arrive as before
    expect(parsed.permissions.allow).toContain('Bash(my-project-tool *)'); // project-only preserved
    expect(parsed.hooks.Stop).toEqual([]); // project keys preserved
  });
});
