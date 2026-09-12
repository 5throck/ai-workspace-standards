/**
 * Tests for sync-skills.ts — idempotent copy (M3) and per-item error
 * collection/continuation (M2, already present but verified here as a
 * regression guard).
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { syncSkills, dirsEqual } from '../../scripts/sync-skills.ts';

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

describe('codex platform target (ADR-0075 W1)', () => {
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
