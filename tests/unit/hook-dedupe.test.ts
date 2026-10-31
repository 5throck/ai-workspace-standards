/**
 * Tests for scripts/lib/hook-dedupe.ts (U-20261031-008).
 *
 * spec docs/designs/2026-10-31-template-security-hardening-design.md R2.6:
 * variant .claude/settings.json files accumulated duplicate hook entries (graft
 * install appends; the upgrade JSON_MERGE array union does not dedupe —
 * co-consult / co-deck carried 5 SessionStart entries vs the template's 2).
 * Pins: the dedupe collapses exact (event, matcher, command) duplicates with
 * first-occurrence-wins and preserves distinct commands; the drift analysis
 * flags a 5-SessionStart fixture naming the excess commands and passes a
 * template-count fixture; cross-event repeats stay unflagged.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
    dedupeClaudeSettingsHooks,
    analyzeClaudeHookDrift,
} from '../../scripts/lib/hook-dedupe.ts';

const GIT_CONFIG = 'git config core.hooksPath .githooks';
const PM_BOOTSTRAP = 'bun scripts/hooks/pm-role-bootstrap.ts';
const GRAFT_GUARDED = 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" session-start --guarded';
const GRAFT_PLAIN = 'node "${CLAUDE_PROJECT_DIR:-.}/.claude/helpers/graft-hooks.cjs" session-start';

function entry(matcher: string | null, ...commands: string[]) {
    return {
        ...(matcher !== null ? { matcher } : {}),
        hooks: commands.map((command) => ({ type: 'command', command })),
    };
}

/** The co-deck drift shape: 5 SessionStart entries, template has 2. */
function driftedSettings() {
    return {
        permissions: { allow: ['Bash(bun scripts/audit.ts *)'] },
        hooks: {
            SessionStart: [
                entry('', GIT_CONFIG),
                entry('', GIT_CONFIG), // exact duplicate
                entry('', PM_BOOTSTRAP),
                entry(null, GRAFT_GUARDED), // graft's guarded form
                entry(null, GRAFT_PLAIN), // graft's unguarded form — DISTINCT, must survive
            ],
            TaskCompleted: [entry('', 'bun scripts/audit.ts')],
        },
    };
}

function templateSettings() {
    return {
        hooks: {
            SessionStart: [entry('', GIT_CONFIG), entry('', PM_BOOTSTRAP)],
            TaskCompleted: [entry('', 'bun scripts/audit.ts')],
            WorktreeCreate: [entry('', GIT_CONFIG)],
        },
    };
}

describe('dedupeClaudeSettingsHooks (U-20261031-008 arm 1)', () => {
    test('exact (event, matcher, command) duplicates collapse — first occurrence wins', () => {
        const { settings, removed } = dedupeClaudeSettingsHooks(driftedSettings());
        const session = (settings.hooks as Record<string, unknown>).SessionStart as unknown[];
        expect(session).toHaveLength(4); // 5 → 4: only the byte-equal repeat removed
        expect(session[0]).toEqual(entry('', GIT_CONFIG));
        expect(removed).toHaveLength(1);
        expect(removed[0]).toEqual({ event: 'SessionStart', matcher: '', command: GIT_CONFIG });
    });

    test('distinct commands are preserved (graft guarded vs unguarded both survive)', () => {
        const { settings } = dedupeClaudeSettingsHooks(driftedSettings());
        const session = (settings.hooks as Record<string, unknown>).SessionStart as Array<{ hooks: Array<{ command: string }> }>;
        const commands = session.flatMap((e) => e.hooks.map((h) => h.command));
        expect(commands).toContain(GRAFT_GUARDED);
        expect(commands).toContain(GRAFT_PLAIN);
        expect(commands).toContain(PM_BOOTSTRAP);
    });

    test('non-hooks keys pass through untouched; dedupe is idempotent', () => {
        const input = driftedSettings();
        const first = dedupeClaudeSettingsHooks(input);
        expect((first.settings as Record<string, unknown>).permissions).toEqual(input.permissions);
        const second = dedupeClaudeSettingsHooks(first.settings);
        expect(second.removed).toHaveLength(0);
        expect(second.settings).toEqual(first.settings);
    });

    test('missing matcher and missing hooks normalize without crashing', () => {
        const { settings, removed } = dedupeClaudeSettingsHooks({
            hooks: { Stop: [entry(null, 'a'), { matcher: '', hooks: [{ type: 'command', command: 'a' }] }] },
        });
        expect((settings.hooks as Record<string, unknown>).Stop).toHaveLength(1);
        expect(removed).toHaveLength(1);
    });

    test('non-object input returns an empty settings object, no throw', () => {
        expect(dedupeClaudeSettingsHooks(null).removed).toHaveLength(0);
        expect(dedupeClaudeSettingsHooks('x').settings).toEqual({});
    });
});

describe('analyzeClaudeHookDrift (U-20261031-008 arm 2 — lifecycle-sync-audit Check I)', () => {
    test('a 5-SessionStart fixture is flagged: duplicate named + excess commands named', () => {
        const report = analyzeClaudeHookDrift(driftedSettings(), templateSettings());
        expect(report.duplicates).toEqual([{ event: 'SessionStart', commands: [GIT_CONFIG] }]);
        expect(report.overCount).toHaveLength(1);
        const oc = report.overCount[0];
        expect(oc.event).toBe('SessionStart');
        expect(oc.localCount).toBe(5);
        expect(oc.templateCount).toBe(2);
        expect(oc.excessCommands).toEqual([GRAFT_GUARDED, GRAFT_PLAIN]); // the graft install pairs
    });

    test('the template-count fixture passes clean', () => {
        const report = analyzeClaudeHookDrift(templateSettings(), templateSettings());
        expect(report.duplicates).toEqual([]);
        expect(report.overCount).toEqual([]);
    });

    test('cross-event repeats are intentional and never flagged (within-event dedup only)', () => {
        const local = {
            hooks: {
                SessionStart: [entry('', GIT_CONFIG)],
                WorktreeCreate: [entry('', GIT_CONFIG)],
            },
        };
        const report = analyzeClaudeHookDrift(local, templateSettings());
        expect(report.duplicates).toEqual([]);
        expect(report.overCount).toEqual([]); // both events exist in the template with count 1
    });

    test('template = null (L1 context): only the duplicate arm runs', () => {
        const report = analyzeClaudeHookDrift(driftedSettings(), null);
        expect(report.duplicates).toEqual([{ event: 'SessionStart', commands: [GIT_CONFIG] }]);
        expect(report.overCount).toEqual([]); // arm (b) skipped without a template
    });

    test('an event the template lacks is over-count with all its commands as excess', () => {
        const local = { hooks: { Stop: [entry('', 'node graft-hooks.cjs stop')] } };
        const report = analyzeClaudeHookDrift(local, templateSettings());
        expect(report.overCount).toEqual([{
            event: 'Stop',
            localCount: 1,
            templateCount: 0,
            excessCommands: ['node graft-hooks.cjs stop'],
        }]);
    });

    test('malformed local settings yield an empty report, no throw', () => {
        expect(analyzeClaudeHookDrift(null, templateSettings())).toEqual({ duplicates: [], overCount: [] });
        expect(analyzeClaudeHookDrift({ hooks: 'nope' }, templateSettings())).toEqual({ duplicates: [], overCount: [] });
    });
});
