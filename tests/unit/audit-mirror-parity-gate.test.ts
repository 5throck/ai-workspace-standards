/**
 * Tests for the audit.ts L0↔L1 mirror parity EARLY SIGNAL (v2.70.0,
 * T-20261118-002; design docs/designs/2026-11-18-subfile-mirror-drift-gate-design.md).
 *
 * The audit gate is a thin wrapper: it calls qa-gate.ts's exported pure collector
 * collectMirrorParityFailures and emits each failure as an audit [FAIL] row. The
 * wrapper's logic (workspace-root scoping, tree-existence precondition, Fail/Pass
 * mapping) is asserted by reading the audit source; the comparison semantics are
 * pinned here end-to-end against scratch trees, including the ticket's core case:
 * a seeded STALE SKILL SUBFILE drifts like T-20261117-011's
 * templates/common/skills/explain-me/references/PLATFORM_HARNESS.md and must be
 * detected at audit time, not only at full qa-gate runs.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { collectMirrorParityFailures } from '../../scripts/qa-gate.ts';

describe('audit mirror parity early signal source contract (T-20261118-002)', () => {
    const auditPath = path.resolve(import.meta.dir, '..', '..', 'scripts', 'audit.ts');

    test('audit.ts imports the shared collector from qa-gate.ts (single verdict source)', () => {
        const src = fs.readFileSync(auditPath, 'utf-8');
        expect(src).toContain('import { collectMirrorParityFailures } from "./qa-gate.ts"');
    });

    test('the gate arm exists, is workspace-root scoped, and emits bare Fail rows', () => {
        const src = fs.readFileSync(auditPath, 'utf-8');
        expect(src).toContain('L0↔L1 mirror parity EARLY SIGNAL');
        // The arm block must be guarded by the IS_WORKSPACE_ROOT convention so
        // L2/L3 audits keep their verdict unchanged.
        expect(src).toContain('if (IS_WORKSPACE_ROOT) {\n  const l0ScriptsDir = "scripts"');
        // One Fail() per collector failure — no Fail-then-increment epilogue (v2.69.0 rule).
        expect(src).toContain('for (const failure of mirrorFailures) {\n      // One Fail() call per failure');
        // Mirror trees absent in a checkout → Skip, never a silent Pass.
        expect(src).toContain('mirror trees not present in this checkout');
    });
});

describe('collectMirrorParityFailures — audit-gate detection semantics (T-20261118-002)', () => {
    const scratch = path.resolve(import.meta.dir, '..', '.temp', 'audit-mirror-parity-gate');
    const l0Scripts = path.join(scratch, 'scripts');
    const l1Scripts = path.join(scratch, 'l1-scripts');
    const l0Skills = path.join(scratch, 'skills');
    const l1Skills = path.join(scratch, 'l1-skills');

    beforeEach(() => {
        fs.rmSync(scratch, { recursive: true, force: true });
        // L0+L1 skill with subfiles, mirrored into L1.
        fs.mkdirSync(path.join(l0Skills, 'demo', 'references'), { recursive: true });
        fs.mkdirSync(path.join(l1Skills, 'demo', 'references'), { recursive: true });
        fs.writeFileSync(path.join(l0Skills, 'demo', 'SKILL.md'), '---\nname: demo\nscope: common\n---\nbody');
        fs.writeFileSync(path.join(l1Skills, 'demo', 'SKILL.md'), '---\nname: demo\nscope: common\n---\nbody');
        fs.writeFileSync(path.join(l0Skills, 'demo', 'references', 'PLATFORM_HARNESS.md'), 'v1');
        fs.writeFileSync(path.join(l1Skills, 'demo', 'references', 'PLATFORM_HARNESS.md'), 'v1');
        // Workspace-scoped skill: no L1 mirror by contract.
        fs.mkdirSync(path.join(l0Skills, 'ws-only'), { recursive: true });
        fs.writeFileSync(path.join(l0Skills, 'ws-only', 'SKILL.md'), '---\nname: ws\nscope: workspace\n---\nbody');
        // Minimal mirrored scripts tree (the collector runs the scripts half too).
        fs.mkdirSync(l0Scripts, { recursive: true });
        fs.mkdirSync(l1Scripts, { recursive: true });
        fs.writeFileSync(path.join(l0Scripts, 'common.ts'), 'export {};\n');
        fs.writeFileSync(path.join(l1Scripts, 'common.ts'), 'export {};\n');
    });
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    function run(): string[] {
        return collectMirrorParityFailures(l0Scripts, l1Scripts, l0Skills, l1Skills);
    }

    test('parity passes on the current tree shape (post T-20261117-011 live-tree expectation)', () => {
        expect(run()).toEqual([]);
    });

    test('T-011 shape: a seeded STALE subfile IS detected, naming both paths', () => {
        // Simulate 57dcdc191: the L0 reference moved forward, the L1 mirror stayed.
        fs.writeFileSync(path.join(l0Skills, 'demo', 'references', 'PLATFORM_HARNESS.md'), 'v2 — prompt-only fallback sections');
        const failures = run();
        expect(failures.some((f) => f.includes('references/PLATFORM_HARNESS.md differs from') && f.includes('templates/common/skills/demo/references/PLATFORM_HARNESS.md'))).toBe(true);
    });

    test('a subfile MISSING from L1 IS detected, naming both paths', () => {
        fs.rmSync(path.join(l1Skills, 'demo', 'references', 'PLATFORM_HARNESS.md'));
        const failures = run();
        expect(failures.some((f) => f.includes('demo/references/PLATFORM_HARNESS.md is missing from') && f.includes('templates/common/skills/demo/'))).toBe(true);
    });

    test('an L1 ORPHAN subfile IS detected, naming both paths', () => {
        fs.writeFileSync(path.join(l1Skills, 'demo', 'references', 'ghost.md'), 'orphan');
        const failures = run();
        expect(failures.some((f) => f.includes('templates/common/skills/demo/references/ghost.md') && f.includes('orphan'))).toBe(true);
    });

    test('SKILL.md drift is surfaced by the same collector (scope not narrowed vs qa-gate)', () => {
        fs.writeFileSync(path.join(l1Skills, 'demo', 'SKILL.md'), '---\nname: demo\nscope: common\n---\ndrifted body');
        const failures = run();
        expect(failures.some((f) => f.includes('SKILL.md differs from'))).toBe(true);
    });

    test('non-mirrored subtrees are NOT flagged: workspace-scoped skill absent at L1 is fine', () => {
        expect(run().some((f) => f.includes('ws-only'))).toBe(false);
    });

    test('nested subdirectories (references/, scripts/, templates/) are walked recursively', () => {
        fs.mkdirSync(path.join(l0Skills, 'demo', 'scripts', 'deep'), { recursive: true });
        fs.mkdirSync(path.join(l1Skills, 'demo', 'scripts', 'deep'), { recursive: true });
        fs.writeFileSync(path.join(l0Skills, 'demo', 'scripts', 'deep', 'helper.ts'), 'a');
        fs.writeFileSync(path.join(l1Skills, 'demo', 'scripts', 'deep', 'helper.ts'), 'a');
        expect(run()).toEqual([]);
        fs.writeFileSync(path.join(l1Skills, 'demo', 'scripts', 'deep', 'helper.ts'), 'b');
        expect(run().some((f) => f.includes('scripts/deep/helper.ts differs'))).toBe(true);
    });

    test('the collector is a no-op on missing mirror trees (L2/L3 self-skip precondition)', () => {
        expect(collectMirrorParityFailures('missing-a', 'missing-b', 'missing-c', 'missing-d')).toEqual([]);
    });
});
