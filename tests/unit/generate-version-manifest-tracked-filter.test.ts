/**
 * Tests for generate-version-manifest.ts — machine-independent enumeration
 * (T-20261001-007): isTracked() excludes untracked (tool-managed) files from
 * the tracked-set filter, and fail-open behavior when git is unavailable.
 *
 * @file Tests for the tracked-file filter of the version manifest generator.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { isTracked, trackedFilterForRoot } from '../../scripts/generate-version-manifest.ts';

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

describe('trackedFilterForRoot (T-20261001-007 follow-up, PR #1271 E2E)', () => {
    // Tracked set holds entries ONLY under skills/, so the .claude/skills
    // root carries zero tracked entries (fresh-scaffold shape).
    const tracked = new Set([
        'skills/sync/SKILL.md',
        'skills/sync/README.md',
    ]);

    test('root with tracked entries still filters untracked candidates', () => {
        const keep = trackedFilterForRoot(tracked, 'skills');
        expect(keep('skills/graft/SKILL.md')).toBe(false);
        expect(keep('skills/sync/SKILL.md')).toBe(true);
    });

    test('root with ZERO tracked entries fails open (fresh-scaffold context)', () => {
        const keep = trackedFilterForRoot(tracked, '.claude/skills');
        expect(keep('.claude/skills/anything-untracked/SKILL.md')).toBe(true);
    });

    test('fully empty tracked set fails open for every root', () => {
        const keep = trackedFilterForRoot(new Set(), 'skills');
        expect(keep('skills/untracked-fixture/SKILL.md')).toBe(true);
    });

    test('Windows backslash candidate paths are normalized against the set', () => {
        const keep = trackedFilterForRoot(tracked, '.claude\\skills');
        expect(keep('.claude\\skills\\sync\\SKILL.md')).toBe(true);
    });
});
