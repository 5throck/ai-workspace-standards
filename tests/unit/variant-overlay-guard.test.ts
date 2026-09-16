/**
 * Variant-ization overlay guard tests (T-20260916-005, design
 * docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §6).
 *
 * Pins the fail-closed exists-guard that protects live variant templates from
 * silent whole-tree overwrite (2026-09-15 template-fleet review finding H5):
 *
 *   - scripts/lib/variant-overlay-guard.ts classification matrix (direct import)
 *   - scripts/project-to-variant.ts enforcement (subprocess, modeled on
 *     tests/unit/project-target-guards.test.ts — the 2026-09-12 incident precedent)
 *
 * Subprocess notes: the suite runs on ubuntu/macos/windows with a 30s budget
 * per file, so the beta+flag ALLOWED case is asserted with --dry-run on a
 * throwaway beta fixture (exit 0, [DRY] output, fixture byte-identical, no
 * refusal message). A full writing promotion into templates/ is deliberately
 * NOT executed here — it spawns workspace-wide validators and would blow the
 * unit-suite time budget; the write-path is covered by the promotion E2E
 * (scripts/test-l3-to-variant-promotion.ts) and the rollback trio tests
 * (tests/unit/overlay-snapshot-rollback.test.ts).
 *
 * @version 1.1.0
 *
 * v1.1.0: Part 2 (project-to-variant.ts subprocess assertions) MOVED to
 * scripts/test-l3-to-variant-promotion.ts Test 7 — the parallel unit runner
 * must never stage fixture dirs under the real templates/ tree while other
 * test files' invariants scan it (the T-20260916-001 interference class);
 * the E2E harness is sequential and owns that staging pattern.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
    evaluateVariantOverlayTarget,
    OVERLAY_GUARD_PREFIX,
    TERMINAL_VARIANT_STATUSES,
} from '../../scripts/lib/variant-overlay-guard.ts';

const workspaceRoot = resolve(import.meta.dir, '..', '..');
const scratchRoot = join(workspaceRoot, 'tests', '.temp', 'variant-overlay-guard-test');

// ── Part 1: classification matrix (direct lib import, temp dirs) ────────────

describe('evaluateVariantOverlayTarget classification matrix', () => {
    let templatesDir: string;
    let runSeq = 0;

    const makeSlot = (files: Record<string, string>): string => {
        const dir = join(templatesDir, `co-slot${++runSeq}`);
        for (const [rel, content] of Object.entries(files)) {
            const p = join(dir, rel);
            mkdirSync(join(p, '..'), { recursive: true });
            writeFileSync(p, content);
        }
        return dir;
    };

    beforeAll(() => {
        rmSync(scratchRoot, { recursive: true, force: true });
        templatesDir = join(scratchRoot, 'templates');
        mkdirSync(templatesDir, { recursive: true });
    });
    afterAll(() => rmSync(scratchRoot, { recursive: true, force: true }));

    const evaluate = (targetDir: string, opts: { overlayAuthorized?: boolean; explicitOutput?: boolean } = {}) =>
        evaluateVariantOverlayTarget({ targetDir, workspaceRoot: scratchRoot, ...opts });

    test('absent target proceeds as a fresh promotion', () => {
        const v = evaluate(join(templatesDir, 'co-fresh'));
        expect(v.action).toBe('proceed');
        expect(v.classification).toBe('absent');
    });

    test('explicit output OUTSIDE templates/ is exempt even when the slot is occupied', () => {
        // The E2E harness pattern (tests/.temp targets) must stay green.
        const outside = join(scratchRoot, 'elsewhere', 'co-exempt');
        mkdirSync(outside, { recursive: true });
        writeFileSync(join(outside, 'variant.json'), JSON.stringify({ status: 'stable' }));
        const v = evaluate(outside, { explicitOutput: true });
        expect(v.action).toBe('proceed');
        expect(v.classification).toBe('exempt-output');
    });

    test('explicit output INSIDE templates/ stays guarded (not exempt)', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'beta' }) });
        const v = evaluate(dir, { explicitOutput: true });
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('overlay-not-authorized');
    });

    test('beta target refuses without authorization; message names --overlay-variant', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'beta' }) });
        const v = evaluate(dir);
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('overlay-not-authorized');
        expect(v.message).toContain(OVERLAY_GUARD_PREFIX);
        expect(v.message).toContain('--overlay-variant');
        expect(v.message).toContain('"beta"');
    });

    test('beta target with authorization proceeds as overlay-authorized', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'beta' }) });
        const v = evaluate(dir, { overlayAuthorized: true });
        expect(v.action).toBe('proceed');
        expect(v.classification).toBe('overlay-authorized');
    });

    test('stable target hard-refuses EVEN WITH authorization (no bypass flag)', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'stable' }) });
        const v = evaluate(dir, { overlayAuthorized: true });
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('terminal-status');
        expect(v.message).toContain('"stable"');
        expect(v.message).toContain('no bypass flag');
        expect(v.message).toContain('variant.json');
    });

    test('deprecated target hard-refuses even with authorization', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'deprecated' }) });
        const v = evaluate(dir, { overlayAuthorized: true });
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('terminal-status');
    });

    test('any other non-terminal status (draft) follows the flag-gated bucket', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ status: 'draft' }) });
        expect(evaluate(dir).classification).toBe('overlay-not-authorized');
        expect(evaluate(dir, { overlayAuthorized: true }).classification).toBe('overlay-authorized');
    });

    test('missing status field is treated as non-terminal (flag-gated), not corrupt', () => {
        const dir = makeSlot({ 'variant.json': JSON.stringify({ name: 'co-x' }) });
        expect(evaluate(dir).classification).toBe('overlay-not-authorized');
    });

    test('occupied slot with MISSING variant.json hard-refuses', () => {
        const dir = makeSlot({ 'README.md': 'no manifest here' });
        const v = evaluate(dir);
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('corrupt');
        expect(v.message).toContain('missing or unparseable');
        expect(v.message).toContain('reserved');
    });

    test('occupied slot with UNPARSEABLE variant.json hard-refuses', () => {
        const dir = makeSlot({ 'variant.json': '{ this is not json' });
        const v = evaluate(dir);
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('corrupt');
    });

    test('occupied slot that is not a directory (foreign file) hard-refuses', () => {
        const filePath = join(templatesDir, `co-fileslot${++runSeq}`);
        writeFileSync(filePath, 'not a directory');
        const v = evaluate(filePath);
        expect(v.action).toBe('refuse');
        expect(v.classification).toBe('corrupt');
    });

    test('terminal status vocabulary is exactly stable + deprecated', () => {
        expect([...TERMINAL_VARIANT_STATUSES].sort()).toEqual(['deprecated', 'stable']);
    });
});
