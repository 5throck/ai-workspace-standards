/**
 * Tests for validators/platform-parity-validator.ts — the D12 4-platform
 * rework (spec 2026-09-25-verifier-platform-expansion-design site 12):
 * 4-tree manifest, codex prompts mapping, skip-marker honor.
 *
 * @version 1.0.0
 */
import { describe, test, expect, afterAll } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { platformParityValidator } from '../../scripts/validators/platform-parity-validator.ts';
import type { ValidatorContext } from '../../scripts/validators/types.ts';

const tempRoot = mkdtempSync(join(tmpdir(), 'parity-validator-'));

interface VariantTreeSpec {
    /** relative paths to create under the variant root, e.g. '.claude/skills/x/SKILL.md' */
    files?: string[];
    /** skill dirs that additionally carry mirror-parity/gemini-parity skip frontmatter */
    skipSkills?: { claudeSkill: string; marker: 'mirror-parity: skip' | 'gemini-parity: skip' }[];
}

function makeVariant(name: string, spec: VariantTreeSpec): string {
    const variantDir = join(tempRoot, name);
    for (const rel of spec.files ?? []) {
        const p = join(variantDir, rel);
        mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
        writeFileSync(p, 'content\n', 'utf-8');
    }
    for (const { claudeSkill, marker } of spec.skipSkills ?? []) {
        const p = join(variantDir, '.claude', 'skills', claudeSkill, 'SKILL.md');
        mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true });
        writeFileSync(p, `---\nname: ${claudeSkill}\nversion: 1.0.0\n${marker}\n---\n\n# skill\n`, 'utf-8');
    }
    // validator prerequisites
    writeFileSync(join(variantDir, 'variant.json'), JSON.stringify({ name, extends: '../common' }), 'utf-8');
    mkdirSync(join(variantDir, 'agents'), { recursive: true });
    return variantDir;
}

function runValidator(variantDir: string) {
    const ctx = {
        variantDir,
        variantType: 'test',
        variantJson: { name: 'x' },
        agentFiles: [],
        skillFiles: [],
        policy: null,
    } as unknown as ValidatorContext;
    return platformParityValidator.validate(ctx);
}

afterAll(() => {
    try {
        rmSync(tempRoot, { recursive: true, force: true });
    } catch { /* best-effort cleanup */ }
});

describe('platform-parity-validator (D12 4-platform rework)', () => {
    test('all four mirrors in sync → zero issues', () => {
        const dir = makeVariant('in-sync', {
            files: [
                '.claude/skills/alpha/SKILL.md',
                '.gemini/skills/alpha/SKILL.md',
                '.agents/skills/alpha/SKILL.md',
                '.codex/skills/alpha/SKILL.md',
                '.claude/commands/sync.md',
                '.gemini/commands/sync.md',
                '.codex/prompts/sync.md',
            ],
        });
        const result = runValidator(dir);
        expect(result.issues).toEqual([]);
        expect(result.checks).toBeGreaterThan(0);
    });

    test('skill missing from .agents and .codex mirrors is reported per-mirror (4-tree manifest)', () => {
        const dir = makeVariant('missing-new-mirrors', {
            files: [
                '.claude/skills/alpha/SKILL.md',
                '.gemini/skills/alpha/SKILL.md',
            ],
        });
        const result = runValidator(dir);
        const messages = result.issues.map(i => i.message);
        expect(messages.some(m => m.includes('missing from agents/'))).toBe(true);
        expect(messages.some(m => m.includes('missing from codex/'))).toBe(true);
        expect(messages.some(m => m.includes('missing from gemini/'))).toBe(false);
        expect(messages.filter(m => m.includes('(soak:')).length).toBe(2);
    });

    test('codex command parity is NAME-MAPPED: prompts/<x>.md satisfies commands/<x>.md', () => {
        const dir = makeVariant('codex-mapping', {
            files: [
                '.claude/commands/meeting.md',
                '.gemini/commands/meeting.md',
                '.codex/prompts/meeting.md', // mapping target — NOT .codex/commands/
            ],
        });
        const result = runValidator(dir);
        expect(result.issues).toEqual([]);
    });

    test('a deleted codex prompt produces a finding (AC-2)', () => {
        const dir = makeVariant('deleted-prompt', {
            files: [
                '.claude/commands/meeting.md',
                '.gemini/commands/meeting.md',
                // .codex/prompts/meeting.md deliberately absent
            ],
        });
        const result = runValidator(dir);
        const messages = result.issues.map(i => i.message);
        expect(messages.some(m => m.includes('meeting.md') && m.includes('codex-prompts'))).toBe(true);
    });

    test('skip-marker honor: mirror-parity: skip exempts the skill from all non-claude mirrors', () => {
        const dir = makeVariant('skip-marker', {
            files: ['.claude/skills/tool-owned/SKILL.md'],
            skipSkills: [{ claudeSkill: 'tool-owned', marker: 'mirror-parity: skip' }],
        });
        const result = runValidator(dir);
        expect(result.issues).toEqual([]);
    });

    test('legacy alias: gemini-parity: skip is honored like mirror-parity: skip', () => {
        const dir = makeVariant('legacy-skip', {
            files: ['.claude/skills/legacy-skill/SKILL.md'],
            skipSkills: [{ claudeSkill: 'legacy-skill', marker: 'gemini-parity: skip' }],
        });
        const result = runValidator(dir);
        expect(result.issues).toEqual([]);
    });
});
