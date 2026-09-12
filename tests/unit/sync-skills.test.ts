/**
 * Tests for sync-skills.ts — idempotent copy (M3), per-item error
 * collection/continuation (M2, already present but verified here as a
 * regression guard), atomic copy semantics and dynamic shortcut back-sync
 * (T-20260912-017).
 *
 * @version 1.1.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { syncSkills, dirsEqual, defaultCopyDir, resolveTargetRoots } from '../../scripts/sync-skills.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'sync-skills-test');

function makeSkill(dir: string, name: string, content: string) {
    const skillDir = path.join(dir, name);
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf-8');
}

function freshDirs() {
    const ssotSkills = path.join(scratchRoot, 'skills');
    const claudeSkills = path.join(scratchRoot, '.claude', 'skills');
    const geminiSkills = path.join(scratchRoot, '.gemini', 'skills');
    const agentsSkills = path.join(scratchRoot, '.agents', 'skills');
    const codexSkills = path.join(scratchRoot, '.codex', 'skills');
    for (const d of [ssotSkills, claudeSkills, geminiSkills, agentsSkills, codexSkills]) {
        fs.mkdirSync(d, { recursive: true });
    }
    return { ssotSkills, claudeSkills, geminiSkills, agentsSkills, codexSkills };
}

describe('dirsEqual', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('true for directories with identical file content', () => {
        const a = path.join(scratchRoot, 'a');
        const b = path.join(scratchRoot, 'b');
        makeSkill(scratchRoot, 'a', 'same content');
        makeSkill(scratchRoot, 'b', 'same content');
        expect(dirsEqual(a, b)).toBe(true);
    });

    test('false for directories with differing file content', () => {
        const a = path.join(scratchRoot, 'a');
        const b = path.join(scratchRoot, 'b');
        makeSkill(scratchRoot, 'a', 'content one');
        makeSkill(scratchRoot, 'b', 'content two');
        expect(dirsEqual(a, b)).toBe(false);
    });

    test('false when target does not exist', () => {
        const a = path.join(scratchRoot, 'a');
        const missing = path.join(scratchRoot, 'does-not-exist');
        makeSkill(scratchRoot, 'a', 'content');
        expect(dirsEqual(a, missing)).toBe(false);
    });
});

describe('syncSkills idempotency (M3)', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('second run with unchanged source does not rewrite identical targets', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'demo-skill', '---\nname: demo\n---\n');

        await syncSkills(dirs);
        const target = path.join(dirs.claudeSkills, 'demo-skill', 'SKILL.md');
        const mtimeAfterFirstRun = fs.statSync(target).mtimeMs;

        // Second run: source unchanged — target must be left untouched (idempotent skip).
        await new Promise(r => setTimeout(r, 10));
        const result = await syncSkills(dirs);
        const mtimeAfterSecondRun = fs.statSync(target).mtimeMs;

        expect(mtimeAfterSecondRun).toBe(mtimeAfterFirstRun);
        expect(result.errors).toEqual([]);
    });

    test('re-copies when source content changes', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'demo-skill', '---\nname: demo\nversion: 1.0.0\n---\n');
        await syncSkills(dirs);

        makeSkill(dirs.ssotSkills, 'demo-skill', '---\nname: demo\nversion: 1.0.1\n---\n');
        await syncSkills(dirs);

        const target = path.join(dirs.claudeSkills, 'demo-skill', 'SKILL.md');
        expect(fs.readFileSync(target, 'utf-8')).toContain('1.0.1');
    });
});

describe('syncSkills per-item error collection (M2 regression guard)', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('one broken skill does not abort processing of remaining skills', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'good-skill-a', '---\nname: a\n---\n');
        makeSkill(dirs.ssotSkills, 'good-skill-b', '---\nname: b\n---\n');

        // Inject a copy function that deterministically throws for one skill,
        // simulating an OS-level copy failure without relying on a fragile
        // filesystem race to reproduce it.
        const result = await syncSkills(dirs, {
            copyDir: (src, dest) => {
                if (dest.includes('good-skill-a')) {
                    throw new Error('simulated copy failure');
                }
                if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
                fs.cpSync(src, dest, { recursive: true });
            },
        });

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.includes('good-skill-a'))).toBe(true);
        // good-skill-b must still have synced successfully despite good-skill-a failing.
        expect(fs.existsSync(path.join(dirs.claudeSkills, 'good-skill-b', 'SKILL.md'))).toBe(true);
    });
});

describe('defaultCopyDir atomic staging (T-20260912-017)', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('copies full tree and replaces an existing destination', () => {
        const src = path.join(scratchRoot, 'src');
        const dest = path.join(scratchRoot, 'dest');
        makeSkill(src, 'inner', '---\nname: inner\n---\n');
        fs.mkdirSync(dest, { recursive: true });
        fs.writeFileSync(path.join(dest, 'STALE.md'), 'old', 'utf-8');

        defaultCopyDir(src, dest);

        expect(fs.readFileSync(path.join(dest, 'inner', 'SKILL.md'), 'utf-8')).toContain('name: inner');
        expect(fs.existsSync(path.join(dest, 'STALE.md'))).toBe(false);
    });

    test('leaves no temp staging siblings behind on success', () => {
        const src = path.join(scratchRoot, 'src');
        const dest = path.join(scratchRoot, 'dest');
        makeSkill(src, 'demo', '---\nname: demo\n---\n');

        defaultCopyDir(src, dest);

        const siblings = fs.readdirSync(scratchRoot).filter(f => f.includes('.tmp-'));
        expect(siblings).toEqual([]);
    });

    test('leaves no temp staging siblings behind when the copy fails', () => {
        const dest = path.join(scratchRoot, 'dest');
        fs.mkdirSync(dest, { recursive: true });
        // Nonexistent source — cpSync into the temp sibling fails immediately,
        // exercising the cleanup path deterministically (no fragile fs race).
        expect(() => defaultCopyDir(path.join(scratchRoot, 'does-not-exist'), dest)).toThrow();
        const debris = fs.readdirSync(dest).filter(f => f.includes('.tmp-'));
        expect(debris).toEqual([]);
    });
});

describe('resolveTargetRoots argument validation (T-20260912-017)', () => {
    test('--dir with a missing value is a hard error, not a silent workspace-root fallback', () => {
        expect(() => resolveTargetRoots(['--dir'])).toThrow(/--dir requires a path argument/);
    });

    test('--dir followed by another flag is a hard error', () => {
        expect(() => resolveTargetRoots(['--dir', '--all-variants'])).toThrow(/--dir requires a path argument/);
    });

    test('--dir with a value resolves to that single root', () => {
        const roots = resolveTargetRoots(['--dir', 'templates/co-consult']);
        expect(roots).toHaveLength(1);
        expect(roots[0]).toBe(path.resolve(path.resolve(import.meta.dir, '..', '..'), 'templates', 'co-consult'));
    });
});

describe('Phase 2 shortcut semantics (T-20260912-017 premise fix)', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('an .agents dir diverging from its SSOT counterpart yields a WARN and SSOT wins', async () => {
        const dirs = freshDirs();
        // SSOT copy and a hand-edited .agents copy of the same skill.
        makeSkill(dirs.ssotSkills, 'sync', '---\nname: sync\n---\nSSOT BODY');
        makeSkill(dirs.agentsSkills, 'sync', '---\nname: sync\n---\nHAND-EDITED BODY');

        const result = await syncSkills(dirs);

        expect(result.errors).toEqual([]);
        expect(result.warnings.some(w => w.includes('sync'))).toBe(true);
        // SSOT wins: Phase 1 re-synced the SSOT content over the hand-edit...
        const agentsCopy = fs.readFileSync(path.join(dirs.agentsSkills, 'sync', 'SKILL.md'), 'utf-8');
        expect(agentsCopy).toContain('SSOT BODY');
        // ...and the divergent hand-edit was NOT propagated to .claude/.gemini.
        const claudeCopy = fs.readFileSync(path.join(dirs.claudeSkills, 'sync', 'SKILL.md'), 'utf-8');
        expect(claudeCopy).toContain('SSOT BODY');
    });

    test('a genuinely .agents-only shortcut is back-synced to .claude and .gemini', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.agentsSkills, 'agents-only-skill', '---\nname: agents-only\n---\n');

        const result = await syncSkills(dirs);

        expect(result.errors).toEqual([]);
        expect(result.warnings).toEqual([]);
        expect(fs.existsSync(path.join(dirs.claudeSkills, 'agents-only-skill', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(dirs.geminiSkills, 'agents-only-skill', 'SKILL.md'))).toBe(true);
        expect(fs.existsSync(path.join(dirs.codexSkills, 'agents-only-skill'))).toBe(false);
    });
});

describe('codex platform target (ADR-0077 W1)', () => {
    beforeEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('skills mirror into .codex/skills alongside the other platform targets', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'demo-skill', '---\nname: demo\n---\n');

        await syncSkills(dirs);

        expect(fs.existsSync(path.join(dirs.codexSkills, 'demo-skill', 'SKILL.md'))).toBe(true);
    });

    test('security-gate skills stay out of .codex/skills (B-03 parity)', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'gated-skill', '---\nname: gated\nsecurity-gate: true\n---\n');
        makeSkill(dirs.ssotSkills, 'open-skill', '---\nname: open\n---\n');

        await syncSkills(dirs);

        expect(fs.existsSync(path.join(dirs.codexSkills, 'gated-skill'))).toBe(false);
        expect(fs.existsSync(path.join(dirs.codexSkills, 'open-skill', 'SKILL.md'))).toBe(true);
    });

    test('.claude/commands are mirrored to .codex/prompts (Phase 1b)', async () => {
        const dirs = freshDirs();
        makeSkill(dirs.ssotSkills, 'plain-skill', '---\nname: plain\n---\n');
        const cmdDir = path.join(scratchRoot, '.claude', 'commands');
        fs.mkdirSync(cmdDir, { recursive: true });
        fs.writeFileSync(path.join(cmdDir, 'sync.md'), '# sync workflow\n', 'utf-8');

        await syncSkills(dirs);

        const mirrored = path.join(scratchRoot, '.codex', 'prompts', 'sync.md');
        expect(fs.existsSync(mirrored)).toBe(true);
        expect(fs.readFileSync(mirrored, 'utf-8')).toContain('sync workflow');
    });
});
