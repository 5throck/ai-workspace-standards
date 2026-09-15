/**
 * Tests for the registry version parity helpers introduced by the
 * validator-hardening batch T-20260915-013 (H10, C-CM-03b) and
 * T-20260915-001 (H8, l0-l1-scripts-registry-version) plus the
 * VERSION_MANIFEST --check comparison helpers from T-20260915-004 (M7).
 *
 * Spec: docs/designs/2026-09-16-registry-version-parity-hardening-design.md
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
    declaredPlatformTrees,
    extractFrontmatterVersion,
    versionParityIssue,
    parseScriptsMdRegistry,
} from '../../scripts/validate-templates.ts';
import {
    normalizeManifestForCompare,
    diffManifests,
} from '../../scripts/generate-version-manifest.ts';

describe('declaredPlatformTrees (C-CM-03b)', () => {
    test('maps claude_source + gemini_source to the two platform trees', () => {
        const entry = { claude_source: '.claude/skills/x/SKILL.md', gemini_source: '.gemini/skills/x/SKILL.md' };
        expect(declaredPlatformTrees(entry)).toEqual(['.claude', '.gemini']);
    });

    test('includes agents_source when declared', () => {
        const entry = { claude_source: '.claude/skills/x/SKILL.md', agents_source: '.agents/skills/x/SKILL.md' };
        expect(declaredPlatformTrees(entry)).toEqual(['.claude', '.agents']);
    });

    test('returns empty for an entry with no *_source keys', () => {
        expect(declaredPlatformTrees({ version: '1.0.0' })).toEqual([]);
    });

    test('ignores empty-string source values', () => {
        expect(declaredPlatformTrees({ claude_source: '' })).toEqual([]);
    });
});

describe('extractFrontmatterVersion (C-CM-03/03a/03b)', () => {
    test('extracts an unquoted version line', () => {
        expect(extractFrontmatterVersion('---\nname: x\nversion: 1.2.3\n---\n')).toBe('1.2.3');
    });

    test('extracts a quoted version line', () => {
        expect(extractFrontmatterVersion('version: "2.0.0"\n')).toBe('2.0.0');
    });

    test('returns undefined when no version field exists', () => {
        expect(extractFrontmatterVersion('name: x\nowner: pm\n')).toBeUndefined();
    });
});

describe('versionParityIssue (C-CM-03/03a/03b semantics)', () => {
    test('missing contract version fails loud (never a silent skip)', () => {
        expect(versionParityIssue(undefined, '1.0.0')).toBe('missing-contract-version');
        expect(versionParityIssue('', '1.0.0')).toBe('missing-contract-version');
    });

    test('missing artifact version fails loud (M5 direction)', () => {
        expect(versionParityIssue('1.0.0', undefined)).toBe('missing-artifact-version');
    });

    test('unequal versions are a mismatch', () => {
        expect(versionParityIssue('1.0.0', '1.1.0')).toBe('mismatch');
    });

    test('equal versions pass with no issue', () => {
        expect(versionParityIssue('1.0.0', '1.0.0')).toBeNull();
    });
});

const REGISTRY_MD = `# SCRIPTS.md

## Registry Scope

Prose section that a startsWith-based finder would wrongly match.

## Registry

| script | source | version | status | removal-date | security-advisory | layer | pair |
|--------|--------|---------|--------|--------------|-------------------|-------|------|
| \`audit.ts\` | L0 | 2.39.0 | active | —| —| L0+L1 | —|
| \`helpers/beta-lifecycle.ts\` | L0 | 1.2.1 | active | —| —| L0 | —|
| \`verify-adr-governance.ts\` | L0 | 1.5.0 | active | \`--strict\` | —| L0 | —|

## Lifecycle States

Not a registry row.
`;

describe('parseScriptsMdRegistry (l0-l1-scripts-registry-version)', () => {
    test('parses name + version cells from registry data rows', () => {
        const rows = parseScriptsMdRegistry(REGISTRY_MD);
        expect(rows.get('audit.ts')).toEqual({ name: 'audit.ts', version: '2.39.0' });
        expect(rows.get('verify-adr-governance.ts')).toEqual({ name: 'verify-adr-governance.ts', version: '1.5.0' });
    });

    test('includes sub-path rows (helpers/, hooks/ registry entries)', () => {
        const rows = parseScriptsMdRegistry(REGISTRY_MD);
        expect(rows.get('helpers/beta-lifecycle.ts')?.version).toBe('1.2.1');
    });

    test('matches only the section headed exactly "Registry" (not "Registry Scope")', () => {
        const rows = parseScriptsMdRegistry(REGISTRY_MD);
        // The Registry Scope prose section contains backticked names in prose but no table rows;
        // if the finder matched it, audit.ts (first data row of the real Registry) would be absent.
        expect(rows.size).toBe(3);
        expect(rows.has('audit.ts')).toBe(true);
    });

    test('skips the header and separator rows', () => {
        const rows = parseScriptsMdRegistry(REGISTRY_MD);
        expect(rows.has('script')).toBe(false);
        expect(rows.has('--------')).toBe(false);
    });

    test('returns an empty map when no Registry section exists', () => {
        expect(parseScriptsMdRegistry('# Doc\n\n## Guide\n\nNo table here.\n').size).toBe(0);
    });
});

const MANIFEST = (generated: string, scripts: string): string => `# VERSION_MANIFEST.md

**Generated**: ${generated}
**Manifest Version**: 1.0

## Summary

- **Scripts**: ${scripts}
`;

describe('normalizeManifestForCompare (--check, T-20260915-004)', () => {
    test('normalizes the Generated timestamp line on any content', () => {
        const a = normalizeManifestForCompare(MANIFEST('2026-09-16T01:00:00.000Z', '92'));
        const b = normalizeManifestForCompare(MANIFEST('2026-09-16T09:00:00.000Z', '92'));
        expect(a).toBe(b);
    });

    test('leaves non-timestamp lines untouched', () => {
        const normalized = normalizeManifestForCompare(MANIFEST('2026-09-16T01:00:00.000Z', '92'));
        expect(normalized).toContain('- **Scripts**: 92');
        expect(normalized).toContain('**Generated**: <timestamp>');
    });
});

describe('diffManifests (--check, T-20260915-004)', () => {
    test('reports no diffs for equal manifests with different timestamps', () => {
        const a = MANIFEST('2026-09-16T01:00:00.000Z', '92');
        const b = MANIFEST('2026-09-16T09:00:00.000Z', '92');
        expect(diffManifests(a, b)).toEqual([]);
    });

    test('reports an in-place cell change with its line number', () => {
        const a = MANIFEST('2026-09-16T01:00:00.000Z', '92');
        const b = MANIFEST('2026-09-16T01:00:00.000Z', '93');
        const diffs = diffManifests(a, b);
        expect(diffs.length).toBe(1);
        expect(diffs[0].onDisk).toContain('**Scripts**: 92');
        expect(diffs[0].regenerated).toContain('**Scripts**: 93');
    });

    test('reports appended drift lines with their content', () => {
        const a = MANIFEST('2026-09-16T01:00:00.000Z', '92') + 'drift-line\n';
        const b = MANIFEST('2026-09-16T01:00:00.000Z', '92');
        const diffs = diffManifests(a, b);
        expect(diffs.length).toBe(2); // 'drift-line' + the shifted trailing empty line
        expect(diffs[0].onDisk).toBe('drift-line');
        expect(diffs[0].regenerated).toBe('');
    });

    test('caps output at the limit to keep gate output concise', () => {
        const a = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n');
        const b = Array.from({ length: 50 }, (_, i) => `changed ${i}`).join('\n');
        expect(diffManifests(a, b).length).toBe(20);
        expect(diffManifests(a, b, 5).length).toBe(5);
    });
});
