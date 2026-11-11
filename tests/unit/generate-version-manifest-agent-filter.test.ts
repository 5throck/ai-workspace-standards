/**
 * Tests for generate-version-manifest.ts agent enumeration (U-20261112-009):
 * locale READMEs (agents/README_ko.md) are docs, not agents.
 *
 * @file Agent-file filter tests for the version manifest generator.
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isAgentFileName, collectManifestData } from '../../scripts/generate-version-manifest.ts';

describe('isAgentFileName', () => {
    test('accepts plain agent files', () => {
        expect(isAgentFileName('pm.md')).toBe(true);
        expect(isAgentFileName('docs-writer.md')).toBe(true);
    });

    test('rejects README, locale READMEs, underscore-prefixed and non-md files', () => {
        for (const f of ['README.md', 'README_ko.md', 'README_ja.md', '_COMMON.md', 'notes.txt']) {
            expect(isAgentFileName(f)).toBe(false);
        }
    });
});

describe('collectManifestData agents', () => {
    test('README_ko.md is not counted and the table lists only real agents', async () => {
        const root = mkdtempSync(join(tmpdir(), 'vm-agents-'));
        const prev = process.cwd();
        try {
            mkdirSync(join(root, 'agents'));
            const fm = (n: string) => `---\nname: ${n}\ntier: low\nversion: 1.0.0\n---\n\n# ${n}\n`;
            writeFileSync(join(root, 'agents', 'alpha.md'), fm('alpha'));
            writeFileSync(join(root, 'agents', 'beta.md'), fm('beta'));
            writeFileSync(join(root, 'agents', 'README.md'), '# readme\n');
            writeFileSync(join(root, 'agents', 'README_ko.md'), '# 안내\n');
            writeFileSync(join(root, 'agents', '_COMMON.md'), '# common\n');
            process.chdir(root);
            const data = await collectManifestData();
            expect(data.agents.map((a) => a.name).sort()).toEqual(['alpha', 'beta']);
        } finally {
            process.chdir(prev);
            rmSync(root, { recursive: true, force: true });
        }
    });
});
