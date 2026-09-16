/**
 * Tests for the propagation target-derivation helpers introduced by
 * T-20260915-005 (M8): the PM-03 `propagation-targets` check enforces that
 * the hand-maintained propagation target lists equal the actual
 * templates/co-* directory set.
 *
 * Spec: docs/designs/2026-09-16-propagation-target-derivation-design.md
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    validatePropagationMap,
    deriveCoVariantDirs,
    markerInjectTargetScope,
    auditVariantScopedTargets,
    auditFixedTargets,
} from '../../scripts/lib/propagation-map-schema.ts';

const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');

/** A miniature templates/ tree with the given directory names. */
function makeSyntheticTemplates(dirNames: string[]): string {
    const root = mkdtempSync(join(tmpdir(), 'pm03-templates-'));
    for (const name of dirNames) {
        mkdirSync(join(root, name), { recursive: true });
    }
    mkdirSync(join(root, 'common'), { recursive: true });
    writeFileSync(join(root, 'common', '.keep'), ''); // common/ is not a co-* dir
    return root;
}

// ── deriveCoVariantDirs: the derived variant directory set ──────────────────

describe('deriveCoVariantDirs (M8)', () => {
    test('returns only co-* directories, sorted', () => {
        const root = makeSyntheticTemplates(['co-work', 'co-abap', 'co-security']);
        try {
            expect(deriveCoVariantDirs(root)).toEqual(['co-abap', 'co-security', 'co-work']);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('excludes common/, non-co- dirs, and plain files', () => {
        const root = makeSyntheticTemplates(['co-design']);
        mkdirSync(join(root, 'templates-notes'), { recursive: true });
        writeFileSync(join(root, 'co-phantom.md'), 'a file, not a dir\n');
        try {
            expect(deriveCoVariantDirs(root)).toEqual(['co-design']);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('real tree derives the 13 registered variants in sorted order', () => {
        const dirs = deriveCoVariantDirs(join(WORKSPACE_ROOT, 'templates'));
        expect(dirs.length).toBe(13);
        expect(dirs).toEqual([...dirs].sort());
        expect(dirs.every((d) => d.startsWith('co-'))).toBe(true);
    });
});

// ── markerInjectTargetScope: structural classification, not name-based ──────

describe('markerInjectTargetScope (M8)', () => {
    test('absent target_file → variant-scoped (governance-agents shape: publishDocs basename-of-source default)', () => {
        expect(markerInjectTargetScope({})).toBe('variant-scoped');
    });

    test('{variant} placeholder → variant-scoped (variant-context shape)', () => {
        expect(markerInjectTargetScope({ target_file: 'docs/{variant}.context.md' })).toBe('variant-scoped');
    });

    test('fixed relative target_file → fixed-target (constitution-context shape)', () => {
        expect(markerInjectTargetScope({ target_file: 'docs/context.md' })).toBe('fixed-target');
    });
});

// ── auditVariantScopedTargets: the equality rule + exclusion semantics ──────

describe('auditVariantScopedTargets (M8)', () => {
    const thirteen = ['co-abap', 'co-consult', 'co-design', 'co-develop', 'co-export', 'co-game', 'co-hr', 'co-news', 'co-price', 'co-safety', 'co-security', 'co-work', 'co-deck'];

    test('clean full listing produces no violations', () => {
        const audit = auditVariantScopedTargets(thirteen, thirteen);
        expect(audit.staleEntries).toEqual([]);
        expect(audit.missingVariants).toEqual([]);
        expect(audit.invalidExclusions).toEqual([]);
        expect(audit.overlaps).toEqual([]);
        expect(audit.duplicates).toEqual([]);
    });

    test('stale listing: listed entry that is not a real co-* dir', () => {
        const audit = auditVariantScopedTargets([...thirteen, 'co-gone'], thirteen);
        expect(audit.staleEntries).toEqual(['co-gone']);
    });

    test('THE M8 SHAPE: a fake 14th variant missing from target_variants is reported by exact name', () => {
        const actual = [...thirteen, 'co-newcomer'];
        const audit = auditVariantScopedTargets(thirteen, actual);
        expect(audit.missingVariants).toEqual(['co-newcomer']);
    });

    test('excluded variant is a deliberate non-target — NOT reported missing', () => {
        const actual = [...thirteen, 'co-experiment'];
        const audit = auditVariantScopedTargets(thirteen, actual, ['co-experiment']);
        expect(audit.missingVariants).toEqual([]);
    });

    test('typo in exclude_variants (not a real co-* dir) is reported', () => {
        const audit = auditVariantScopedTargets(thirteen, thirteen, ['co-secruity']);
        expect(audit.invalidExclusions).toEqual(['co-secruity']);
    });

    test('overlap: dir in both arrays is contradictory', () => {
        const audit = auditVariantScopedTargets(['co-work', 'co-deck'], thirteen, ['co-work']);
        expect(audit.overlaps).toEqual(['co-work']);
    });

    test('duplicate entries within one array are reported', () => {
        const audit = auditVariantScopedTargets([...thirteen, 'co-work'], thirteen);
        expect(audit.duplicates).toEqual(['co-work']);
        const audit2 = auditVariantScopedTargets(thirteen, thirteen, ['co-hr', 'co-hr']);
        expect(audit2.duplicates).toEqual(['co-hr']);
    });
});

// ── auditFixedTargets: domains validated against their own declared shape ───

describe('auditFixedTargets (M8)', () => {
    test('constitution-context shape: templates/common carries docs/context.md → clean', () => {
        const audit = auditFixedTargets(['common'], 'docs/context.md', join(WORKSPACE_ROOT, 'templates'));
        expect(audit.unknownDirs).toEqual([]);
        expect(audit.missingTargetFiles).toEqual([]);
    });

    test('unknown template dir is reported', () => {
        const audit = auditFixedTargets(['no-such-dir'], 'docs/context.md', join(WORKSPACE_ROOT, 'templates'));
        expect(audit.unknownDirs).toEqual(['no-such-dir']);
    });

    test('existing dir without the resolved target file is a dead target', () => {
        const root = makeSyntheticTemplates(['common']);
        try {
            const audit = auditFixedTargets(['common'], 'docs/context.md', root);
            expect(audit.unknownDirs).toEqual([]);
            expect(audit.missingTargetFiles).toEqual([{ target: 'common', file: 'templates/common/docs/context.md' }]);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});

// ── validatePropagationMap: exclude_variants schema typing ──────────────────

describe('validatePropagationMap exclude_variants typing (M8)', () => {
    const baseDomain = {
        mode: 'marker-inject',
        source_file: 'templates/common/AGENTS.md',
        marker: 'COMMON-AGENTS',
        target_variants: ['co-work'],
    };

    const mapWith = (domain: Record<string, unknown>) => ({
        version: '1.10.0',
        domains: { d: { ...baseDomain, ...domain } },
    });

    test('absent exclude_variants stays valid', () => {
        expect(validatePropagationMap(mapWith({}))).toEqual([]);
    });

    test('valid string array is accepted', () => {
        expect(validatePropagationMap(mapWith({ exclude_variants: ['co-experiment'] }))).toEqual([]);
    });

    test('non-array and non-string entries are schema errors', () => {
        const nonArray = validatePropagationMap(mapWith({ exclude_variants: 'co-work' }));
        expect(nonArray).toContainEqual({ domain: 'd', field: 'exclude_variants', message: 'Must be an array of strings if present' });
        const nonString = validatePropagationMap(mapWith({ exclude_variants: [42] }));
        expect(nonString).toContainEqual({ domain: 'd', field: 'exclude_variants', message: 'Must be an array of strings if present' });
    });
});

// ── Real-tree invariants: today's data must satisfy the PM-03 rule ──────────

describe('real-tree propagation-target consistency (M8 pinning)', () => {
    const templatesDir = join(WORKSPACE_ROOT, 'templates');
    const coDirs = deriveCoVariantDirs(templatesDir);

    function readMapDomains(): Record<string, { mode?: string; target_file?: string; target_variants?: string[]; exclude_variants?: string[] }> {
        const map = JSON.parse(readFileSync(join(WORKSPACE_ROOT, 'scripts', 'propagation-map.json'), 'utf-8'));
        return map.domains ?? {};
    }

    test('every variant-scoped marker-inject domain satisfies target_variants ⊎ exclude_variants ≡ co-* set', () => {
        for (const [name, domain] of Object.entries(readMapDomains())) {
            if (domain.mode !== 'marker-inject') continue;
            if (markerInjectTargetScope(domain) !== 'variant-scoped') continue;
            const audit = auditVariantScopedTargets(domain.target_variants ?? [], coDirs, domain.exclude_variants ?? []);
            expect(audit.staleEntries).toEqual([]);
            expect(audit.missingVariants).toEqual([]);
            expect(audit.invalidExclusions).toEqual([]);
            expect(audit.overlaps).toEqual([]);
            expect(audit.duplicates).toEqual([]);
        }
    });

    test('fixed-target domains resolve to existing files (constitution-context shape)', () => {
        for (const [name, domain] of Object.entries(readMapDomains())) {
            if (domain.mode !== 'marker-inject') continue;
            if (markerInjectTargetScope(domain) !== 'fixed-target') continue;
            const audit = auditFixedTargets(domain.target_variants ?? [], domain.target_file!, templatesDir);
            expect(audit.unknownDirs).toEqual([]);
            expect(audit.missingTargetFiles).toEqual([]);
        }
    });

    test('common.lifecycle.json propagatedTo equals the derived co-* set exactly', () => {
        const lc = JSON.parse(readFileSync(join(WORKSPACE_ROOT, 'docs', 'templates', 'common.lifecycle.json'), 'utf-8'));
        expect(lc.propagatedTo).toEqual(coDirs);
    });
});
