/**
 * Tests for generate-version-manifest.ts — machine-independent enumeration
 * (T-20261001-007): isTracked() excludes untracked (tool-managed) files from
 * the tracked-set filter, and fail-open behavior when git is unavailable.
 *
 * @file Tests for the tracked-file filter of the version manifest generator.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { isTracked } from '../../scripts/generate-version-manifest.ts';

describe('isTracked (T-20261001-007)', () => {
    const tracked = new Set([
        'agents/pm.md',
        '.claude/skills/sync/SKILL.md',
        'scripts/audit.ts',
    ]);

    test('includes a tracked file', () => {
        expect(isTracked(tracked, 'agents/pm.md')).toBe(true);
    });

    test('excludes an untracked (tool-managed) path', () => {
        expect(isTracked(tracked, '.claude/skills/graft/SKILL.md')).toBe(false);
    });

    test('normalizes Windows backslash separators', () => {
        expect(isTracked(tracked, 'agents\\pm.md')).toBe(true);
    });

    test('fail-open: null tracked set (no git) includes every candidate', () => {
        expect(isTracked(null, '.claude/skills/graft/SKILL.md')).toBe(true);
    });
});
