/**
 * Tests for the scaffold delivery/validation helpers introduced by the
 * Wave 2 scaffolder-validation batch: T-20260915-002 (C3, marker→source
 * mapping), T-20260915-003 (H13, delivery-tree parity), T-20260915-010
 * (H12, canonical PM extends-stub body), T-20260915-011 (M11, templates/
 * VERSION provenance reader).
 *
 * Spec: docs/designs/2026-09-16-scaffold-delivery-validation-design.md
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
    COMMON_AGENTS_START,
    COMMON_AGENTS_END,
    GRAFT_BLOCK_OPEN,
    WORKSPACE_MANAGED_CLOSE,
    VARIANT_SCAFFOLD_MARKER_NAMES,
    SCAFFOLD_MARKER_SOURCES,
    canonicalPmStubBody,
    isCanonicalPmStubBody,
    flattenCommonRelPath,
    buildCommonUniverse,
    deriveNewProjectDelivery,
    deriveL3ScaffoldDelivery,
    diffDeliveryTrees,
    matchReviewedExclusion,
    reviewedExclusionCoverage,
    verifyActualTreeMatchesDerivation,
    isPostDeliveryArtifact,
} from '../../scripts/helpers/scaffold-markers.ts';
import {
    parseTemplateVersion,
    readTemplateVersion,
    TEMPLATE_VERSION_RELPATH,
} from '../../scripts/helpers/template-version.ts';

// ── T-20260915-002 (C3): marker mapping resolution ──────────────────────────

describe('SCAFFOLD_MARKER_SOURCES (C3)', () => {
    test('every declared source exists and carries its marker (real tree)', () => {
        for (const entry of SCAFFOLD_MARKER_SOURCES) {
            for (const relSource of entry.sources) {
                const abs = join(import.meta.dir, '..', '..', relSource);
                expect(existsSync(abs)).toBe(true);
                expect(readFileSync(abs, 'utf-8').includes(entry.marker)).toBe(true);
            }
        }
    });

    test('every exported marker constant is covered by the mapping', () => {
        const mapped = new Set(SCAFFOLD_MARKER_SOURCES.map((e) => e.marker));
        for (const marker of [COMMON_AGENTS_START, COMMON_AGENTS_END, GRAFT_BLOCK_OPEN, WORKSPACE_MANAGED_CLOSE]) {
            expect(mapped.has(marker)).toBe(true);
        }
        for (const name of VARIANT_SCAFFOLD_MARKER_NAMES) {
            expect(mapped.has(`<!-- ${name}-START -->`)).toBe(true);
        }
    });

    test('every mapping entry has at least one source and a purpose', () => {
        for (const entry of SCAFFOLD_MARKER_SOURCES) {
            expect(entry.sources.length).toBeGreaterThan(0);
            expect(entry.purpose.length).toBeGreaterThan(0);
        }
    });
});

// ── T-20260915-010 (H12): canonical PM extends-stub body ────────────────────

describe('isCanonicalPmStubBody (H12)', () => {
    test('canonical prose for the variant slug passes', () => {
        expect(isCanonicalPmStubBody(canonicalPmStubBody('co-export'), 'co-export')).toBe(true);
    });

    test('whitespace-tolerant (stub files carry surrounding newlines)', () => {
        expect(isCanonicalPmStubBody(`\n${canonicalPmStubBody('co-hr')}\n`, 'co-hr')).toBe(true);
    });

    test('empty body is canonical', () => {
        expect(isCanonicalPmStubBody('', 'co-news')).toBe(true);
        expect(isCanonicalPmStubBody('   \n  ', 'co-news')).toBe(true);
    });

    test('real variant content fails (the H12 silent-discard shape)', () => {
        expect(isCanonicalPmStubBody('## Real override\n\nSubstantive variant governance.', 'co-price')).toBe(false);
    });

    test('canonical prose for a DIFFERENT slug fails', () => {
        expect(isCanonicalPmStubBody(canonicalPmStubBody('co-export'), 'co-safety')).toBe(false);
    });

    test('canonical sentence names the slug verbatim', () => {
        expect(canonicalPmStubBody('co-x')).toBe(
            'This co-x PM override inherits the common PM body and supplies only variant-specific governance, roster, and dispatch deltas.',
        );
    });
});

// ── T-20260915-011 (M11): templates/VERSION parsing ─────────────────────────

describe('parseTemplateVersion (M11)', () => {
    test('parses a bare semver with surrounding whitespace', () => {
        expect(parseTemplateVersion('0.6.0\n')).toBe('0.6.0');
        expect(parseTemplateVersion('  1.2.3  ')).toBe('1.2.3');
    });

    test('parses pre-release and build suffixes', () => {
        expect(parseTemplateVersion('1.2.0-beta.1')).toBe('1.2.0-beta.1');
        expect(parseTemplateVersion('2.0.0+build.7')).toBe('2.0.0+build.7');
    });

    test('empty content fails loud', () => {
        expect(() => parseTemplateVersion('')).toThrow(/empty/);
        expect(() => parseTemplateVersion('\n\n')).toThrow(/empty/);
    });

    test('non-semver content fails loud', () => {
        expect(() => parseTemplateVersion('unknown')).toThrow(/valid x\.y\.z version/);
        expect(() => parseTemplateVersion('v1')).toThrow(/valid x\.y\.z version/);
        expect(() => parseTemplateVersion('1.2')).toThrow(/valid x\.y\.z version/);
    });
});

describe('readTemplateVersion (M11)', () => {
    test('reads the SSOT from a root dir', () => {
        const root = mkdtempSync(join(tmpdir(), 'tplver-'));
        try {
            mkdirSync(join(root, 'templates'), { recursive: true });
            writeFileSync(join(root, 'templates', 'VERSION'), '9.9.9\n');
            expect(readTemplateVersion(root)).toBe('9.9.9');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('missing templates/VERSION fails loud (never a silent fallback)', () => {
        const root = mkdtempSync(join(tmpdir(), 'tplver-missing-'));
        try {
            expect(() => readTemplateVersion(root)).toThrow(/not found .* cannot record scaffold provenance/);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    test('declared SSOT path is templates/VERSION', () => {
        expect(TEMPLATE_VERSION_RELPATH).toBe('templates/VERSION');
    });
});

// ── T-20260915-003 (H13): delivery-tree derivations and diff ────────────────

describe('flattenCommonRelPath (H13)', () => {
    test('maps docs/_common/* into docs/*', () => {
        expect(flattenCommonRelPath('docs/_common/context.md')).toBe('docs/context.md');
        expect(flattenCommonRelPath('docs/_common/a/b.md')).toBe('docs/a/b.md');
    });

    test('identity for everything else', () => {
        expect(flattenCommonRelPath('docs/context.md')).toBe('docs/context.md');
        expect(flattenCommonRelPath('AGENTS.md')).toBe('AGENTS.md');
        expect(flattenCommonRelPath('.agents/skills.json')).toBe('.agents/skills.json');
    });
});

describe('diffDeliveryTrees (H13)', () => {
    test('computes newProject \\ l3, ignoring the reverse direction', () => {
        const np = new Set(['a.md', 'b.md', 'c.md']);
        const l3 = new Set(['b.md', 'c.md', 'd.md']);
        expect([...diffDeliveryTrees(np, l3)].sort()).toEqual(['a.md']);
    });

    test('empty gap on identical sets', () => {
        expect(diffDeliveryTrees(new Set(['x']), new Set(['x'])).size).toBe(0);
    });
});

describe('reviewed-exclusion matching (H13)', () => {
    const rules = [
        { path: 'docs/skill-graph.json', reason: 'exact rule' },
        { path: '.agents/', reason: 'prefix rule' },
    ];

    test('exact rule matches only the exact relpath', () => {
        expect(matchReviewedExclusion('docs/skill-graph.json', rules)?.reason).toBe('exact rule');
        expect(matchReviewedExclusion('docs/skill-graph.json.bak', rules)).toBeNull();
    });

    test('prefix rule matches everything under the prefix', () => {
        expect(matchReviewedExclusion('.agents/skills.json', rules)?.reason).toBe('prefix rule');
        expect(matchReviewedExclusion('.agents/skills/x/SKILL.md', rules)?.reason).toBe('prefix rule');
        expect(matchReviewedExclusion('.agents', rules)).toBeNull(); // files only — prefix needs the slash
    });

    test('uncovered gap files are reported', () => {
        const coverage = reviewedExclusionCoverage(new Set(['docs/brand-new-file.md']), rules);
        expect(coverage.uncovered).toEqual(['docs/brand-new-file.md']);
    });

    test('stale exact rules are reported (dead exemptions)', () => {
        const coverage = reviewedExclusionCoverage(new Set(), rules);
        expect(coverage.staleExact).toEqual(['docs/skill-graph.json']);
        expect(coverage.stalePrefix).toEqual(['.agents/']);
    });

    test('prefix rule stays alive while at least one gap file matches', () => {
        const coverage = reviewedExclusionCoverage(new Set(['.agents/skills.json']), rules);
        expect(coverage.stalePrefix).toEqual([]);
        expect(coverage.staleExact).toEqual(['docs/skill-graph.json']);
    });
});

describe('POST_DELIVERY_ARTIFACTS (H13 pinning support)', () => {
    test('lockfiles and build/git trees are artifacts', () => {
        expect(isPostDeliveryArtifact('bun.lock')).toBe(true);
        expect(isPostDeliveryArtifact('bun.lockb')).toBe(true);
        expect(isPostDeliveryArtifact('node_modules/x/index.js')).toBe(true);
        expect(isPostDeliveryArtifact('.git/config')).toBe(true);
        expect(isPostDeliveryArtifact('graft/INDEX.md')).toBe(true);
    });

    test('delivered files are not artifacts', () => {
        expect(isPostDeliveryArtifact('AGENTS.md')).toBe(false);
        expect(isPostDeliveryArtifact('scripts/dev-sync.ts')).toBe(false);
    });
});

describe('synthetic-tree derivations (H13)', () => {
    // A miniature templates/common/ exercising every exclusion rule of both
    // derivations without touching the real tree.
    function makeSyntheticCommon(): { root: string; commonDir: string; workspaceRoot: string } {
        const workspaceRoot = mkdtempSync(join(tmpdir(), 'delivery-parity-'));
        const commonDir = join(workspaceRoot, 'templates', 'common');
        const write = (rel: string, content = 'x\n'): void => {
            const abs = join(commonDir, rel);
            mkdirSync(join(abs, '..'), { recursive: true });
            writeFileSync(abs, content);
        };
        write('AGENTS.md');
        write('README.md');
        write('CHANGELOG.md');
        write('package.json');
        write('bun.lock');
        write('.env.sample');
        write('.DS_Store');
        write('.agents/skills.json');
        write('.gateguard-state/state.json');
        write('node_modules/pkg/index.js');
        write('agents/pm.md');
        write('agents/pm.md.backup');
        write('agents/i18n-specialist.md');
        write('docs/context.md');
        write('docs/_common/playbook.md');
        write('docs/adr/0001-x.md');
        write('docs/_examples/x.md');
        write('docs/variant.context.template.md');
        write('docs/skill-graph.json');
        write('memory/MEMORY.md');
        write('memory/2026-01-01.md');
        write('skills/zzz-local-fake/SKILL.md');
        write('.claude/settings.json');
        write('.claude/skills/zzz-local-fake/SKILL.md');
        write('scripts/zzz-local-fake.ts');
        write('scripts/helpers/zzz-local-fake-helper.ts');
        // variant overlay skip probe: docs/context.md at the VARIANT level is
        // covered by VARIANT_OVERLAY_SKIP — not modeled here (overlay is out
        // of the common-universe scope).
        return { root: workspaceRoot, commonDir, workspaceRoot };
    }

    test('new-project derivation applies every skip rule', () => {
        const { commonDir, workspaceRoot } = makeSyntheticCommon();
        try {
            const set = deriveNewProjectDelivery(commonDir, { workspaceRoot });
            // delivered
            expect(set.has('AGENTS.md')).toBe(true);
            expect(set.has('docs/playbook.md')).toBe(true); // _common flattened
            expect(set.has('agents/i18n-specialist.md')).toBe(true);
            expect(set.has('scripts/zzz-local-fake.ts')).toBe(true);
            // skipped
            expect(set.has('bun.lock')).toBe(false);            // workspace-only
            expect(set.has('package.json')).toBe(true);         // removed, then regenerated at the same relpath (§2.5c)
            expect(set.has('.DS_Store')).toBe(false);
            expect(set.has('.agents/skills.json')).toBe(true);  // DELIVERED by new-project (the H13 gap source)
            expect(set.has('.gateguard-state/state.json')).toBe(false);
            expect(set.has('node_modules/pkg/index.js')).toBe(false);
            expect(set.has('agents/pm.md')).toBe(true);         // delivered (only agents/pm.md.backup is L1-only)
            expect(set.has('agents/pm.md.backup')).toBe(false); // L1-only agent
            expect(set.has('docs/adr/0001-x.md')).toBe(false);  // L1-only dir
            expect(set.has('docs/_examples/x.md')).toBe(false);
            expect(set.has('docs/variant.context.template.md')).toBe(false); // cleanup
            expect(set.has('memory/MEMORY.md')).toBe(false);    // memory cleared
            expect(set.has('memory/2026-01-01.md')).toBe(false);
            expect(set.has('CODEX.md')).toBe(false);            // platform both removes
            expect(set.has('docs/skill-graph.json')).toBe(true); // delivered (regenerated later)
        } finally {
            rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });

    test('l3 derivation models overlay excludes + dedicated steps', () => {
        const { commonDir, workspaceRoot } = makeSyntheticCommon();
        try {
            const set = deriveL3ScaffoldDelivery(commonDir, { workspaceRoot });
            // overlay delivers
            expect(set.has('CHANGELOG.md')).toBe(true);
            expect(set.has('.env.sample')).toBe(true);
            // overlay excludes, dedicated steps re-add
            expect(set.has('AGENTS.md')).toBe(true);       // stub collision
            expect(set.has('README.md')).toBe(true);       // stub collision
            expect(set.has('package.json')).toBe(true);    // adapted package.json
            expect(set.has('agents/pm.md')).toBe(true);    // stub
            expect(set.has('memory/MEMORY.md')).toBe(true);// stub
            expect(set.has('docs/context.md')).toBe(true); // explicit copy
            expect(set.has('docs/playbook.md')).toBe(true);// _common flatten
            expect(set.has('skills/zzz-local-fake/SKILL.md')).toBe(true); // full skills copy
            expect(set.has('scripts/zzz-local-fake.ts')).toBe(true);      // L1 script
            // never delivered
            expect(set.has('bun.lock')).toBe(false);
            expect(set.has('.agents/skills.json')).toBe(false);
            expect(set.has('agents/i18n-specialist.md')).toBe(false);     // dedicated-step agents only
            expect(set.has('docs/adr/0001-x.md')).toBe(false);
            expect(set.has('docs/skill-graph.json')).toBe(false);         // the H13 gap
            expect(set.has('memory/2026-01-01.md')).toBe(false);
        } finally {
            rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });
});

describe('verifyActualTreeMatchesDerivation (H13 E2E pinning helper)', () => {
    test('detects drift between an actual tree and the derivation', () => {
        const workspaceRoot = mkdtempSync(join(tmpdir(), 'actual-tree-'));
        const commonDir = join(workspaceRoot, 'templates', 'common');
        const actualRoot = join(workspaceRoot, 'project');
        for (const rel of ['AGENTS.md', 'CHANGELOG.md', 'docs/_common/playbook.md', 'skills/zzz-fake/SKILL.md']) {
            const abs = join(commonDir, rel);
            mkdirSync(join(abs, '..'), { recursive: true });
            writeFileSync(abs, 'x\n');
        }
        // Actual scaffold: has AGENTS.md + CHANGELOG.md + flattened docs/playbook.md,
        // MISSING the skills tree. bun.lock is a post-delivery artifact — ignored.
        mkdirSync(join(actualRoot, 'docs'), { recursive: true });
        writeFileSync(join(actualRoot, 'AGENTS.md'), 'x\n');
        writeFileSync(join(actualRoot, 'CHANGELOG.md'), 'x\n');
        writeFileSync(join(actualRoot, 'docs', 'playbook.md'), 'x\n');
        writeFileSync(join(actualRoot, 'bun.lock'), '{}');
        try {
            const verdict = verifyActualTreeMatchesDerivation({
                which: 'new-project',
                actualRoot,
                commonDir,
                workspaceRoot,
            });
            expect(verdict.ok).toBe(false);
            expect(verdict.missing).toEqual(['skills/zzz-fake/SKILL.md']);
            expect(verdict.extra).toEqual([]);
        } finally {
            rmSync(workspaceRoot, { recursive: true, force: true });
        }
    });
});

// ── Real-tree sanity: the reviewed constant pins today's gap exactly ────────

describe('real-tree parity invariants (H13)', () => {
    const WORKSPACE_ROOT = join(import.meta.dir, '..', '..');
    const COMMON_DIR = join(WORKSPACE_ROOT, 'templates', 'common');

    test('the real gap equals the reviewed set (nothing more, nothing stale)', () => {
        const gap = diffDeliveryTrees(
            deriveNewProjectDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT }),
            deriveL3ScaffoldDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT }),
        );
        const coverage = reviewedExclusionCoverage(gap);
        expect(coverage.uncovered).toEqual([]);
        expect(coverage.staleExact).toEqual([]);
        expect(coverage.stalePrefix).toEqual([]);
    });

    test('both derivations are subsets of the flattened universe', () => {
        const universe = buildCommonUniverse(COMMON_DIR);
        for (const rel of deriveNewProjectDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT })) {
            expect(universe.has(rel)).toBe(true);
        }
        for (const rel of deriveL3ScaffoldDelivery(COMMON_DIR, { workspaceRoot: WORKSPACE_ROOT })) {
            expect(universe.has(rel)).toBe(true);
        }
    });
});
