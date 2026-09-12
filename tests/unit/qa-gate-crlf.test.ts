/**
 * Tests for qa-gate.ts — CRLF-tolerant content comparison (M5) and the
 * deepened Step 4 L0↔L1 parity helpers (T-20260912-021).
 * Windows checkouts can normalize LF to CRLF; the L0 vs L1 sync check must
 * not report false-positive drift when the only difference is line endings.
 *
 * @version 1.1.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  normalizeLineEndings,
  scrubConstitutionRefs,
  sha256Normalized,
  walkFiles,
  isMirroredScriptPath,
  parseScriptLayersFromRegistry,
  getScriptLayer,
  skillLayerFromFrontmatter,
  collectMirrorParityFailures,
} from '../../scripts/qa-gate.ts';

describe('normalizeLineEndings', () => {
    test('converts CRLF to LF', () => {
        expect(normalizeLineEndings('line1\r\nline2\r\n')).toBe('line1\nline2\n');
    });

    test('leaves LF-only content unchanged', () => {
        expect(normalizeLineEndings('line1\nline2\n')).toBe('line1\nline2\n');
    });
});

describe('scrubConstitutionRefs', () => {
    test('replaces CONSTITUTION.md with context.md', () => {
        expect(scrubConstitutionRefs('see CONSTITUTION.md for details')).toBe('see context.md for details');
    });

    test('leaves content without CONSTITUTION.md unchanged', () => {
        const input = 'see context.md for details';
        expect(scrubConstitutionRefs(input)).toBe(input);
    });
});

describe('sha256Normalized', () => {
    test('produces identical hashes for CRLF vs LF versions of the same content', () => {
        const lf = 'const x = 1;\nconst y = 2;\n';
        const crlf = 'const x = 1;\r\nconst y = 2;\r\n';
        expect(sha256Normalized(lf)).toBe(sha256Normalized(crlf));
    });

    test('still distinguishes genuinely different content', () => {
        const a = 'const x = 1;\n';
        const b = 'const x = 2;\n';
        expect(sha256Normalized(a)).not.toBe(sha256Normalized(b));
    });
});

describe('walkFiles (T-20260912-021)', () => {
    const scratch = path.resolve(import.meta.dir, '..', '.temp', 'qa-gate-walk-test');

    beforeEach(() => fs.rmSync(scratch, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    test('lists files recursively as forward-slash relative paths', () => {
        fs.mkdirSync(path.join(scratch, 'sub', 'deep'), { recursive: true });
        fs.writeFileSync(path.join(scratch, 'top.ts'), 'x');
        fs.writeFileSync(path.join(scratch, 'sub', 'mid.json'), 'x');
        fs.writeFileSync(path.join(scratch, 'sub', 'deep', 'leaf.ts'), 'x');

        expect(walkFiles(scratch).sort()).toEqual([
            'sub/deep/leaf.ts',
            'sub/mid.json',
            'top.ts',
        ]);
    });

    test('returns empty for a missing directory', () => {
        expect(walkFiles(path.join(scratch, 'nope'))).toEqual([]);
    });
});

describe('isMirroredScriptPath (T-20260912-021)', () => {
    test('mirror contract covers top-level .ts, helpers/hooks/lib .ts, and propagation-map.json', () => {
        expect(isMirroredScriptPath('dev-sync.ts')).toBe(true);
        expect(isMirroredScriptPath('helpers/layer-filter.ts')).toBe(true);
        expect(isMirroredScriptPath('hooks/pre-push.ts')).toBe(true);
        expect(isMirroredScriptPath('lib/upgrade-policy.ts')).toBe(true);
        expect(isMirroredScriptPath('propagation-map.json')).toBe(true);
    });

    test('excludes non-mirrored subtrees and non-.ts files (trees legitimately differ there)', () => {
        expect(isMirroredScriptPath('experiments/infer-graph-from-phases.ts')).toBe(false);
        expect(isMirroredScriptPath('handbook/check-a11y.ts')).toBe(false);
        expect(isMirroredScriptPath('README_ko.md')).toBe(false);
        expect(isMirroredScriptPath('helpers/typecheck-baseline.json')).toBe(false);
    });
});

describe('SCRIPTS.md layer registry (T-20260912-021)', () => {
    const scratch = path.resolve(import.meta.dir, '..', '.temp', 'qa-gate-registry-test');

    beforeEach(() => fs.rmSync(scratch, { recursive: true, force: true }));
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    test('parses L0 and L0+L1 layers; unknown paths default to mirrored (L0+L1)', () => {
        fs.mkdirSync(scratch, { recursive: true });
        const md = path.join(scratch, 'SCRIPTS.md');
        fs.writeFileSync(md, [
            '## Registry',
            '',
            '| Script | Source | Version | Status | Removal | Security | Layer | Pair |',
            '|---|---|---|---|---|---|---|---|',
            '| `common.ts` | L0 | 1.0.0 | active | — | — | L0+L1 | — |',
            '| `l0only.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |',
            '| `plainL0.ts` | L0 | 1.0.0 | active | — | — | L0 | — |',
            '',
            '## Next Section',
        ].join('\n'), 'utf-8');

        const layers = parseScriptLayersFromRegistry(md);
        expect(getScriptLayer(layers, 'common.ts')).toBe('L0+L1');
        expect(getScriptLayer(layers, 'l0only.ts')).toBe('L0');
        expect(getScriptLayer(layers, 'plainL0.ts')).toBe('L0');
        // Unregistered paths default to L0+L1 (mirrored) — fail-safe, matching layer-filter.ts.
        expect(getScriptLayer(layers, 'unregistered.ts')).toBe('L0+L1');
    });

    test('a missing registry yields the mirrored default', () => {
        const layers = parseScriptLayersFromRegistry(path.join(scratch, 'nope.md'));
        expect(getScriptLayer(layers, 'whatever.ts')).toBe('L0+L1');
    });
});

describe('collectMirrorParityFailures end-to-end (T-20260912-021)', () => {
    const scratch = path.resolve(import.meta.dir, '..', '.temp', 'qa-gate-parity-test');
    const l0 = path.join(scratch, 'l0');
    const l1 = path.join(scratch, 'l1');
    const l0Scripts = path.join(l0, 'scripts');
    const l1Scripts = path.join(l1, 'scripts');
    const l0Skills = path.join(l0, 'skills');
    const l1Skills = path.join(l1, 'skills');

    beforeEach(() => {
        fs.rmSync(scratch, { recursive: true, force: true });
        // L0 scripts tree: mirrored script, nested lib file, an L0-only script,
        // and the registry. L1: mirror of the common items only.
        fs.mkdirSync(path.join(l0Scripts, 'lib'), { recursive: true });
        fs.mkdirSync(path.join(l1Scripts, 'lib'), { recursive: true });
        fs.writeFileSync(path.join(l0Scripts, 'SCRIPTS.md'),
            '## Registry\n\n| Script | Source | Version | Status | Removal | Security | Layer | Pair |\n' +
            '|---|---|---|---|---|---|---|---|\n' +
            '| `common.ts` | L0 | 1.0.0 | active | — | — | L0+L1 | — |\n' +
            '| `l0only.ts` | L0 | 1.0.0 | active | — | — | L0-only | — |\n');
        fs.writeFileSync(path.join(l0Scripts, 'common.ts'), 'export {};\n');
        fs.writeFileSync(path.join(l1Scripts, 'common.ts'), 'export {};\n');
        fs.writeFileSync(path.join(l0Scripts, path.join('lib', 'nested.ts')), 'export const a = 1;\n');
        fs.writeFileSync(path.join(l1Scripts, path.join('lib', 'nested.ts')), 'export const a = 1;\n');
        fs.writeFileSync(path.join(l0Scripts, 'l0only.ts'), 'export {};\n');

        // L0 skills: one common skill with subfiles, one workspace-scoped skill.
        fs.mkdirSync(path.join(l0Skills, 'demo', 'references'), { recursive: true });
        fs.mkdirSync(path.join(l1Skills, 'demo', 'references'), { recursive: true });
        fs.writeFileSync(path.join(l0Skills, 'demo', 'SKILL.md'), '---\nname: demo\nscope: common\n---\nbody');
        fs.writeFileSync(path.join(l1Skills, 'demo', 'SKILL.md'), '---\nname: demo\nscope: common\n---\nbody');
        fs.writeFileSync(path.join(l0Skills, 'demo', 'references', 'guide.md'), 'guide');
        fs.writeFileSync(path.join(l1Skills, 'demo', 'references', 'guide.md'), 'guide');
        fs.mkdirSync(path.join(l0Skills, 'ws-only'), { recursive: true });
        fs.writeFileSync(path.join(l0Skills, 'ws-only', 'SKILL.md'), '---\nname: ws\nscope: workspace\n---\nbody');
    });
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    function run(): string[] {
        return collectMirrorParityFailures(l0Scripts, l1Scripts, l0Skills, l1Skills);
    }

    test('clean mirrored trees yield no failures', () => {
        expect(run()).toEqual([]);
    });

    test('drift in a nested lib file IS flagged (old check was top-level .ts only)', () => {
        fs.writeFileSync(path.join(l1Scripts, 'lib', 'nested.ts'), 'export const a = 2;\n');
        expect(run().some(f => f.includes('lib/nested.ts differs'))).toBe(true);
    });

    test('an L0+L1-registered script missing from L1 IS flagged; an L0-only one is not', () => {
        fs.rmSync(path.join(l1Scripts, 'common.ts'));
        const failures = run();
        expect(failures.some(f => f.includes('common.ts is missing from'))).toBe(true);
        // l0only.ts is registered L0-only and lives only at L0 — absence is correct.
        expect(failures.some(f => f.includes('l0only.ts'))).toBe(false);
    });

    test('an unregistered L0 .ts defaults to mirrored (fail-safe) and IS flagged when absent from L1', () => {
        fs.writeFileSync(path.join(l0Scripts, 'unregistered.ts'), 'export {};\n');
        expect(run().some(f => f.includes('unregistered.ts is missing from'))).toBe(true);
    });

    test('an L1-only .ts under a mirrored subtree IS flagged as an orphan', () => {
        fs.writeFileSync(path.join(l1Scripts, 'zz-orphan.ts'), 'export {};\n');
        expect(run().some(f => f.includes('zz-orphan.ts') && f.includes('orphan'))).toBe(true);
    });

    test('a missing skill SUBFILE in L1 IS flagged (old check compared SKILL.md only)', () => {
        fs.rmSync(path.join(l1Skills, 'demo', 'references', 'guide.md'));
        expect(run().some(f => f.includes('demo/references/guide.md is missing'))).toBe(true);
    });

    test('a workspace-scoped skill absent from L1 is NOT flagged', () => {
        // ws-only has no L1 counterpart by design — no failure appears for it.
        expect(run().some(f => f.includes('ws-only'))).toBe(false);
    });

    test('CRLF-only drift is not flagged (M5 tolerance carries over)', () => {
        fs.writeFileSync(path.join(l1Scripts, 'common.ts'), 'export {};\r\n');
        expect(run()).toEqual([]);
    });
});

describe('skillLayerFromFrontmatter (T-20260912-021)', () => {
    test('scope: workspace maps to L0 (no L1 mirror expected)', () => {
        expect(skillLayerFromFrontmatter('---\nname: x\nscope: workspace\n---\nbody')).toBe('L0');
    });

    test('scope: common and unspecified map to L0+L1 (mirrored)', () => {
        expect(skillLayerFromFrontmatter('---\nname: x\nscope: common\n---\nbody')).toBe('L0+L1');
        expect(skillLayerFromFrontmatter('---\nname: x\n---\nbody')).toBe('L0+L1');
    });

    test('variant scope and l2_propagate: false are not L1 mirrors', () => {
        expect(skillLayerFromFrontmatter('---\nname: x\nscope: co-consult\n---\nbody')).toBe('L0+L2');
        expect(skillLayerFromFrontmatter('---\nname: x\nscope: common\nl2_propagate: false\n---\nbody')).toBe('L0');
    });
});
