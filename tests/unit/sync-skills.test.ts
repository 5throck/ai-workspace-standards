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
    for (const d of [ssotSkills, claudeSkills, geminiSkills, agentsSkills]) {
        fs.mkdirSync(d, { recursive: true });
    }
    return { ssotSkills, claudeSkills, geminiSkills, agentsSkills };
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
