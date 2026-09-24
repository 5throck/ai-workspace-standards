/**
 * Tests for helpers/mirror-hygiene.ts — the R6 mirror-hygiene scanner
 * (spec 2026-09-25-verifier-platform-expansion-design).
 *
 * A platform skill mirror contains ONLY skill directories; anything else
 * (stray files like SKILLS.md/README*.md, or directories without SKILL.md)
 * is a finding.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanMirrorHygiene } from '../../scripts/helpers/mirror-hygiene.ts';

const tempRoot = mkdtempSync(join(tmpdir(), 'mirror-hygiene-'));

function makeMirror(entries: Record<string, 'dir-with-skill' | 'dir-empty' | 'file'>): string {
    const mirrorDir = join(tempRoot, `mirror-${Math.random().toString(36).slice(2)}`);
    mkdirSync(mirrorDir, { recursive: true });
    for (const [name, kind] of Object.entries(entries)) {
        const entryPath = join(mirrorDir, name);
        if (kind === 'file') {
            writeFileSync(entryPath, 'stray content\n', 'utf-8');
        } else {
            mkdirSync(entryPath, { recursive: true });
            if (kind === 'dir-with-skill') {
                writeFileSync(join(entryPath, 'SKILL.md'), '# skill\n', 'utf-8');
            }
        }
    }
    return mirrorDir;
}

afterAll(() => {
    try {
        rmSync(tempRoot, { recursive: true, force: true });
    } catch { /* best-effort cleanup */ }
});

describe('scanMirrorHygiene (R6)', () => {
    test('clean mirror with only skill directories reports zero findings', () => {
        const dir = makeMirror({
            'sync': 'dir-with-skill',
            'graft': 'dir-with-skill',
            '_meta': 'dir-with-skill',
        });
        expect(scanMirrorHygiene(dir)).toEqual([]);
    });

    test('a stray SKILLS.md file in the mirror reports a stray-file finding (Finding-B class)', () => {
        const dir = makeMirror({
            'sync': 'dir-with-skill',
            'SKILLS.md': 'file',
        });
        const findings = scanMirrorHygiene(dir);
        expect(findings).toEqual([{ entry: 'SKILLS.md', kind: 'stray-file' }]);
    });

    test('README files report stray-file findings', () => {
        const dir = makeMirror({
            'sync': 'dir-with-skill',
            'README.md': 'file',
            'README_ko.md': 'file',
        });
        const findings = scanMirrorHygiene(dir);
        expect(findings.map(f => f.entry).sort()).toEqual(['README.md', 'README_ko.md']);
        expect(findings.every(f => f.kind === 'stray-file')).toBe(true);
    });

    test('a directory without SKILL.md reports a stray-dir finding', () => {
        const dir = makeMirror({
            'not-a-skill': 'dir-empty',
        });
        expect(scanMirrorHygiene(dir)).toEqual([{ entry: 'not-a-skill', kind: 'stray-dir' }]);
    });

    test('a missing mirror directory is not a finding (mirrors are optional)', () => {
        expect(scanMirrorHygiene(join(tempRoot, 'does-not-exist'))).toEqual([]);
    });
});
