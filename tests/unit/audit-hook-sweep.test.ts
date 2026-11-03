#!/usr/bin/env bun
/**
 * Unit tests for scripts/helpers/audit-hook-sweep.ts — the audit.ts §28
 * templates audit-variant hook sweep core (U-20261104-001).
 *
 * The sweep used to live inline in audit.ts §28, where its "no co-X manifest
 * declares a hook" outcome (hookCount === 0) produced a permanent WARN in
 * variant/project layouts whose audit-variant hook lives in the ROOT
 * variant.json and is executed by §27. The co-newbiz-shaped fixture below
 * (templates/ present, but no templates/co-X directory) reproduces that
 * sweep input and asserts the collector reports zero hooks for it — §28 then
 * keys its skip-vs-WARN decision on §27's variantAuditPath.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectTemplateAuditHooks } from '../../scripts/helpers/audit-hook-sweep';

const tempDirs: string[] = [];

function makeTempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'audit-hook-sweep-'));
    tempDirs.push(dir);
    return dir;
}

afterEach(() => {
    while (tempDirs.length) {
        const dir = tempDirs.pop()!;
        rmSync(dir, { recursive: true, force: true });
    }
});

describe('collectTemplateAuditHooks', () => {
    test('collects audit-variant hooks declared by templates/co-* manifests', () => {
        const root = makeTempDir();
        const variantDir = join(root, 'templates', 'co-design');
        mkdirSync(variantDir, { recursive: true });
        writeFileSync(join(variantDir, 'variant.json'), JSON.stringify({
            name: 'co-design',
            script_manifest: {
                local: [
                    { name: 'audit-variant', path: 'scripts/co-design/audit-variant.ts' },
                    { name: 'other-hook', path: 'scripts/other.ts' },
                ],
            },
        }));

        const sweep = collectTemplateAuditHooks(join(root, 'templates'));

        expect(sweep.hooks).toHaveLength(1);
        expect(sweep.hooks[0].variant).toBe('co-design');
        expect(sweep.hooks[0].declaredPath).toBe('scripts/co-design/audit-variant.ts');
        expect(sweep.hooks[0].resolvedPath).toBe(join(root, 'templates', 'co-design', 'scripts/co-design/audit-variant.ts'));
        expect(sweep.malformed).toHaveLength(0);
    });

    test('reports zero hooks for the co-newbiz project shape (templates/ exists, no co-* dir)', () => {
        // Reproduction fixture for U-20261104-001: a variant project keeps a
        // templates/ directory (deliverables only) but its audit-variant hook
        // lives in the ROOT variant.json, so the templates sweep must find
        // nothing instead of misattributing the layout as "no hook declared".
        const root = makeTempDir();
        mkdirSync(join(root, 'templates', 'deliverables'), { recursive: true });
        writeFileSync(join(root, 'variant.json'), JSON.stringify({
            name: 'co-newbiz',
            script_manifest: {
                variant_scripts_dir: 'scripts/co-newbiz',
                local: [{ name: 'audit-variant', path: 'scripts/co-newbiz/audit-variant.ts' }],
            },
        }));

        const sweep = collectTemplateAuditHooks(join(root, 'templates'));

        expect(sweep.hooks).toHaveLength(0);
        expect(sweep.malformed).toHaveLength(0);
    });

    test('ignores directories without variant.json and non-co-* directories', () => {
        const root = makeTempDir();
        mkdirSync(join(root, 'templates', 'co-empty'), { recursive: true });
        mkdirSync(join(root, 'templates', 'not-a-variant'), { recursive: true });
        writeFileSync(join(root, 'templates', 'not-a-variant', 'variant.json'), JSON.stringify({
            script_manifest: { local: [{ name: 'audit-variant', path: 'x.ts' }] },
        }));

        const sweep = collectTemplateAuditHooks(join(root, 'templates'));

        expect(sweep.hooks).toHaveLength(0);
    });

    test('skips malformed variant.json and surfaces it via malformed[]', () => {
        const root = makeTempDir();
        const badDir = join(root, 'templates', 'co-broken');
        mkdirSync(badDir, { recursive: true });
        writeFileSync(join(badDir, 'variant.json'), '{ not json');
        const goodDir = join(root, 'templates', 'co-good');
        mkdirSync(goodDir, { recursive: true });
        writeFileSync(join(goodDir, 'variant.json'), JSON.stringify({
            script_manifest: { local: [{ name: 'audit-variant', path: 'scripts/hook.ts' }] },
        }));

        const sweep = collectTemplateAuditHooks(join(root, 'templates'));

        expect(sweep.hooks).toHaveLength(1);
        expect(sweep.hooks[0].variant).toBe('co-good');
        expect(sweep.malformed).toEqual([join(root, 'templates', 'co-broken', 'variant.json')]);
    });

    test('ignores local entries without a usable path or wrong hook name', () => {
        const root = makeTempDir();
        const variantDir = join(root, 'templates', 'co-partial');
        mkdirSync(variantDir, { recursive: true });
        writeFileSync(join(variantDir, 'variant.json'), JSON.stringify({
            script_manifest: {
                local: [
                    { name: 'audit-variant' },
                    { name: 'audit-variant', path: '' },
                    { path: 'scripts/x.ts' },
                    'garbage',
                ],
            },
        }));

        const sweep = collectTemplateAuditHooks(join(root, 'templates'));

        expect(sweep.hooks).toHaveLength(0);
    });
});
