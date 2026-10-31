/**
 * Sanitization tests for scripts/skill-session-review.ts (U-20261031-001).
 *
 * spec docs/designs/2026-10-31-template-security-hardening-design.md R2.1:
 * touched skill names derive from `git status --porcelain` output, so a hostile
 * working-tree directory name (quotes, `$()`, whitespace, separators) must never
 * reach the `bun -e` payload, a `new RegExp` pattern, or any command string.
 * The fix shape is strict-name allowlist + argv path passing + regex escaping;
 * these pins hold all three.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
    SKILL_NAME_RE,
    TRIGGERS_READ_PAYLOAD,
    runStructuralChecks,
    manifestVersion,
} from '../../scripts/skill-session-review.ts';

describe('SKILL_NAME_RE (strict skill-name allowlist, U-20261031-001)', () => {
    test('rejects the quote-breakout class that motivated the fix', () => {
        // The design's own exploit shape: a directory name that closes the JS
        // string literal in the old bun -e payload and executes as JavaScript.
        expect(SKILL_NAME_RE.test("x'-require('child_process')-y")).toBe(false);
        expect(SKILL_NAME_RE.test('x"y')).toBe(false);
        expect(SKILL_NAME_RE.test("a`b")).toBe(false);
        expect(SKILL_NAME_RE.test('; rm -rf /')).toBe(false);
    });

    test('rejects shell metacharacters, whitespace, separators, and leading dots', () => {
        expect(SKILL_NAME_RE.test('$(id)')).toBe(false);
        expect(SKILL_NAME_RE.test('a b')).toBe(false);
        expect(SKILL_NAME_RE.test('a/b')).toBe(false);
        expect(SKILL_NAME_RE.test('a\\b')).toBe(false);
        expect(SKILL_NAME_RE.test('.hidden')).toBe(false);
        expect(SKILL_NAME_RE.test('')).toBe(false);
        expect(SKILL_NAME_RE.test('-leading-dash')).toBe(false);
    });

    test('accepts every legitimate name shape in this workspace', () => {
        expect(SKILL_NAME_RE.test('sync')).toBe(true);
        expect(SKILL_NAME_RE.test('meeting-facilitation')).toBe(true);
        expect(SKILL_NAME_RE.test('a')).toBe(true);
        expect(SKILL_NAME_RE.test('A1')).toBe(true);
        expect(SKILL_NAME_RE.test('skill.v2_beta-x')).toBe(true);
    });
});

describe('TRIGGERS_READ_PAYLOAD (argv path passing, U-20261031-001)', () => {
    test('payload is a constant string reading the path from process.argv[1]', () => {
        expect(typeof TRIGGERS_READ_PAYLOAD).toBe('string');
        expect(TRIGGERS_READ_PAYLOAD).toContain('process.argv[1]');
        // A plain constant cannot interpolate anything — but pin it anyway so a
        // future refactor back to a template literal fails loudly.
        expect(TRIGGERS_READ_PAYLOAD.includes('${')).toBe(false);
        expect(TRIGGERS_READ_PAYLOAD.includes('skills/')).toBe(false);
    });
});

describe('runStructuralChecks allowlist gate (U-20261031-001)', () => {
    test('a non-conforming touched name is WARN-skipped and excluded from every downstream check', async () => {
        const hostile = "x'-require('child_process').exec('id')-y";
        const findings = await runStructuralChecks([hostile]);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toBe(
            `WARN ${hostile}: skipped — skill directory name contains characters outside [A-Za-z0-9._-]`,
        );
    });

    test('each hostile class produces exactly the skip finding (nothing else executes)', async () => {
        for (const hostile of ['a b', '$(id)', 'x"y', '.hidden', 'a/b', ';rm']) {
            const findings = await runStructuralChecks([hostile]);
            expect(findings).toHaveLength(1);
            expect(findings[0]).toContain(': skipped — skill directory name contains characters outside');
        }
    });
});

describe('manifestVersion regex escaping (defense in depth, U-20261031-001)', () => {
    test('regex metacharacters in the name do not throw and match nothing', () => {
        expect(manifestVersion('(.*+?[]{}|\\)')).toBeNull();
        expect(manifestVersion('definitely-not-a-registered-skill-xyz')).toBeNull();
    });
});
