/**
 * Tests for the registry version parity helpers introduced by the
 * validator-hardening batch T-20260915-013 (H10, C-CM-03b) and
 * T-20260915-001 (H8, l0-l1-scripts-registry-version) plus the
 * VERSION_MANIFEST --check comparison helpers from T-20260915-004 (M7),
 * extended with the shallow-repository ignoreDateColumns mode from
 * T-20260916-013.
 *
 * Spec: docs/designs/2026-09-16-registry-version-parity-hardening-design.md
 *       docs/designs/2026-09-16-manifest-gate-shallow-tolerance-design.md
 *
 * @version 1.1.0
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
    maskDateColumns,
    isShallowRepository,
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
        expect(diffManifests(a, b, { limit: 5 }).length).toBe(5);
    });
});

// ── Shallow-mode comparison (ignoreDateColumns, T-20260916-013) ─────────────
// In a shallow checkout (actions/checkout default depth=1) the per-row "Last
// Modified" dates are git-depth-dependent (checkout-time fallback), so the
// committed manifest would permanently drift against CI regeneration. The
// ignoreDateColumns mode masks those cells on BOTH sides; structural drift
// must still be caught. Fixtures use scratch strings only.

const AGENTS_MANIFEST = (generated: string, architectDate: string, pmDate: string): string => `# VERSION_MANIFEST.md

**Generated**: ${generated}
**Manifest Version**: 1.0

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
| architect | agents/architect.md | High | opus | ${architectDate} |
| pm | agents/pm.md | Medium | sonnet | ${pmDate} |
`;

describe('maskDateColumns (shallow --check, T-20260916-013)', () => {
    test('masks only the Last Modified DATA cells; header and separator rows untouched', () => {
        const masked = maskDateColumns(AGENTS_MANIFEST('X', '2026-09-01', '2026-09-02'));
        expect(masked).toContain('| Name | File | Tier | Model | Last Modified |');
        expect(masked).toContain('|------|------|------|-------|---------------|');
        expect(masked).toContain('| architect | agents/architect.md | High | opus | <date> |');
        expect(masked).toContain('| pm | agents/pm.md | Medium | sonnet | <date> |');
        expect(masked).not.toContain('2026-09-01');
        expect(masked).not.toContain('2026-09-02');
    });

    test('date column index is derived from the header, not a hard-coded position', () => {
        const content = [
            '| Last Modified | Name |',
            '|----------------|------|',
            '| 2026-01-01 | alpha |',
            '',
            '| Name | Version |',
            '|------|---------|',
            '| beta | 2026-12-31 |',
        ].join('\n');
        const masked = maskDateColumns(content);
        expect(masked).toContain('| <date> | alpha |'); // first-column date masked
        // The second table has no "Last Modified" header — its cells (even a
        // date-shaped value) must stay untouched.
        expect(masked).toContain('| beta | 2026-12-31 |');
        expect(masked).toContain('| Name | Version |');
    });
});

describe('diffManifests shallow mode (ignoreDateColumns, T-20260916-013)', () => {
    const disk = AGENTS_MANIFEST('2026-09-16T01:00:00.000Z', '2026-09-01', '2026-09-02');
    const shallowRegen = AGENTS_MANIFEST('2026-09-16T09:00:00.000Z', '2026-09-15', 'N/A');

    test('date-only drift is ignored under ignoreDateColumns (Generated line still normalized)', () => {
        expect(diffManifests(disk, shallowRegen, { ignoreDateColumns: true })).toEqual([]);
    });

    test('full-history mode is unchanged: the same date-only drift IS reported', () => {
        const diffs = diffManifests(disk, shallowRegen);
        expect(diffs.length).toBe(2); // both agent rows differ on the date cell
        expect(diffs[0].onDisk).toContain('2026-09-01');
        expect(diffs[0].regenerated).toContain('2026-09-15');
    });

    test('structural drift is still caught in shallow mode: removed row', () => {
        const regen = AGENTS_MANIFEST('2026-09-16T09:00:00.000Z', '2026-09-15', '2026-09-15')
            .replace('| pm | agents/pm.md | Medium | sonnet | 2026-09-15 |\n', '');
        const diffs = diffManifests(disk, regen, { ignoreDateColumns: true });
        expect(diffs.length).toBeGreaterThanOrEqual(1);
        expect(diffs[0].onDisk).toContain('| pm |');
        expect(diffs[0].regenerated).toBe('');
    });

    test('structural drift is still caught in shallow mode: name/path change', () => {
        const regen = AGENTS_MANIFEST('2026-09-16T09:00:00.000Z', '2026-09-15', '2026-09-15')
            .replace('| pm | agents/pm.md |', '| pm-renamed | agents/pm-renamed.md |');
        const diffs = diffManifests(disk, regen, { ignoreDateColumns: true });
        expect(diffs.length).toBe(1);
        expect(diffs[0].onDisk).toContain('| pm | agents/pm.md |');
        expect(diffs[0].regenerated).toContain('| pm-renamed | agents/pm-renamed.md |');
    });

    test('non-date columns of other tables still compare (header-derived masking is per table)', () => {
        const tables = (skillVersion: string): string => [
            '| Last Modified | Name |',
            '|----------------|------|',
            '| 2026-01-01 | alpha |',
            '',
            '| Name | Version |',
            '|------|---------|',
            '| sync | ' + skillVersion + ' |',
        ].join('\n');
        const diffs = diffManifests(tables('1.0.0'), tables('1.1.0'), { ignoreDateColumns: true });
        expect(diffs.length).toBe(1); // only the Version cell drifts
        expect(diffs[0].onDisk).toContain('| sync | 1.0.0 |');
        expect(diffs[0].regenerated).toContain('| sync | 1.1.0 |');
    });
});

describe('date-masked --check default (ADR-0081 / T-20260918-001)', () => {
    // checkManifest() now passes ignoreDateColumns: true unconditionally (the
    // shallow-only gating is gone): the Last Modified cells always lag the
    // generating PR's own commit by one commit (generation precedes the
    // commit), so they are informational, not gate-bearing. These fixtures pin
    // that contract at the comparator level.

    test('date-only drift across a day boundary is not a gate failure', () => {
        const disk = AGENTS_MANIFEST('2026-09-17T10:00:00.000Z', '2026-09-17', '2026-09-17');
        const regen = AGENTS_MANIFEST('2026-09-18T09:00:00.000Z', '2026-09-18', '2026-09-18');
        expect(diffManifests(disk, regen, { ignoreDateColumns: true })).toEqual([]);
    });

    test('tier drift is still a failure under the date-masked default', () => {
        const disk = AGENTS_MANIFEST('2026-09-18T10:00:00.000Z', '2026-09-18', '2026-09-18');
        const regen = AGENTS_MANIFEST('2026-09-18T10:00:00.000Z', '2026-09-18', '2026-09-18').replace('| High |', '| Low |');
        const diffs = diffManifests(disk, regen, { ignoreDateColumns: true });
        expect(diffs.length).toBe(1);
        expect(diffs[0].onDisk).toContain('| High |');
        expect(diffs[0].regenerated).toContain('| Low |');
    });

    test('path drift is still a failure under the date-masked default', () => {
        const disk = AGENTS_MANIFEST('2026-09-18T10:00:00.000Z', '2026-09-18', '2026-09-18');
        const regen = AGENTS_MANIFEST('2026-09-18T10:00:00.000Z', '2026-09-18', '2026-09-18')
            .replace('agents/architect.md', 'agents/architect-renamed.md');
        const diffs = diffManifests(disk, regen, { ignoreDateColumns: true });
        expect(diffs.length).toBe(1);
        expect(diffs[0].onDisk).toContain('agents/architect.md');
        expect(diffs[0].regenerated).toContain('agents/architect-renamed.md');
    });
});

describe('isShallowRepository (T-20260916-013)', () => {
    test('returns a boolean without throwing (spawn failure counts as full)', () => {
        expect(typeof isShallowRepository()).toBe('boolean');
    });
});
