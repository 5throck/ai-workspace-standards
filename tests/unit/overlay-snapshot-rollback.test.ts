/**
 * Overlay snapshot-rename rollback trio tests (T-20260916-004, design
 * docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §4.2/§6).
 *
 * Sibling of new-project-rollback.test.ts (which pins the M13 fresh-create
 * rm rollback). This file pins the v1.1.0 snapshot trio in
 * scripts/helpers/rollback-partial-project.ts:
 *
 *   - snapshotDirForOverlay   — atomic rename to a dot-prefixed sibling
 *   - restoreOverlaySnapshot  — partial output removed, snapshot renamed back
 *   - discardOverlaySnapshot  — snapshot removed after a green run
 *
 * rm-based rollback is WRONG for authorized overlays (it would delete the
 * live variant, not the run's output) — these tests prove the snapshot path
 * preserves the previous tree byte-identically, mtime order included, and
 * that the dot-prefixed backup name is invisible to template-directory scans
 * (deriveCoVariantDirs' `startsWith('co-')` filter).
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    discardOverlaySnapshot,
    restoreOverlaySnapshot,
    snapshotDirForOverlay,
} from '../../scripts/helpers/rollback-partial-project.ts';
import { deriveCoVariantDirs } from '../../scripts/lib/propagation-map-schema.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'overlay-snapshot-rollback-test');
const workspaceRoot = path.join(scratchRoot, 'workspace');
const templatesDir = path.join(workspaceRoot, 'templates');
const targetDir = path.join(templatesDir, 'co-ovrlay');

function writeTree(): void {
    fs.mkdirSync(path.join(targetDir, 'agents'), { recursive: true });
    fs.writeFileSync(path.join(targetDir, 'variant.json'), '{"status":"beta"}');
    fs.writeFileSync(path.join(targetDir, 'agents', 'pm.md'), 'previous tree pm body');
    fs.writeFileSync(path.join(targetDir, 'README.md'), 'previous tree readme');
}

function treeState(root: string): Map<string, { content: string; mtimeMs: number }> {
    const state = new Map<string, { content: string; mtimeMs: number }>();
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else {
                const stat = fs.statSync(full);
                state.set(path.relative(root, full), { content: fs.readFileSync(full, 'utf-8'), mtimeMs: stat.mtimeMs });
            }
        }
    };
    if (fs.existsSync(root)) walk(root);
    return state;
}

describe('overlay snapshot trio (rollback-partial-project v1.1.0)', () => {
    beforeEach(() => {
        fs.rmSync(scratchRoot, { recursive: true, force: true });
        fs.mkdirSync(templatesDir, { recursive: true });
        writeTree();
        // Distinct mtimes so restore-order preservation is observable.
        const past = new Date(Date.now() - 60_000);
        fs.utimesSync(path.join(targetDir, 'variant.json'), past, past);
    });
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('snapshot renames the live tree to a dot-prefixed sibling; target path is freed', () => {
        const before = treeState(targetDir);

        const snap = snapshotDirForOverlay(targetDir, workspaceRoot);

        expect(snap.snapshotted).toBe(true);
        expect(snap.backupPath).toBeTruthy();
        const backupName = path.basename(snap.backupPath!);
        expect(backupName.startsWith('.overlay-backup-co-ovrlay')).toBe(true);
        expect(path.dirname(snap.backupPath!)).toBe(templatesDir);
        expect(fs.existsSync(targetDir)).toBe(false); // path freed for the new run
        // Snapshot content == previous tree, byte-identical.
        expect(treeState(snap.backupPath!)).toEqual(before);
    });

    test('snapshot → partial new output → restore leaves the old tree byte-identical with mtime order preserved', () => {
        const before = treeState(targetDir);
        const snap = snapshotDirForOverlay(targetDir, workspaceRoot);
        expect(snap.snapshotted).toBe(true);

        // Simulate a failed authorized-overlay run writing partial output into
        // the freed target path (a mixed subset plus junk the run created).
        fs.mkdirSync(path.join(targetDir, 'agents'), { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'variant.json'), '{"status":"beta","RUINED":true}');
        fs.writeFileSync(path.join(targetDir, 'agents', 'pm.md'), 'half-written generation output');
        fs.writeFileSync(path.join(targetDir, 'junk.tmp'), 'orphan from the failed run');

        const restored = restoreOverlaySnapshot(snap.backupPath!, targetDir, workspaceRoot);
        expect(restored.restored).toBe(true);

        expect(fs.existsSync(snap.backupPath!)).toBe(false); // snapshot moved back, not copied
        const after = treeState(targetDir);
        expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
        for (const [rel, entry] of before) {
            expect(after.get(rel)!.content).toBe(entry.content);
            expect(after.get(rel)!.mtimeMs).toBe(entry.mtimeMs); // rename preserves mtime
        }
        expect(fs.existsSync(path.join(targetDir, 'junk.tmp'))).toBe(false);
    });

    test('snapshot → discard removes the backup after a green run', () => {
        const snap = snapshotDirForOverlay(targetDir, workspaceRoot);
        expect(snap.snapshotted).toBe(true);
        // A green run replaces the target; the snapshot must NOT be restored.
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'variant.json'), '{"status":"beta","version":"0.2.0"}');

        const discarded = discardOverlaySnapshot(snap.backupPath!, workspaceRoot);
        expect(discarded.discarded).toBe(true);
        expect(fs.existsSync(snap.backupPath!)).toBe(false);
        expect(fs.existsSync(path.join(targetDir, 'variant.json'))).toBe(true);
    });

    test('restore with a missing snapshot reports failure and keeps reporting reasons (never throws)', () => {
        const missing = path.join(templatesDir, '.overlay-backup-co-ovrlay-never-was');
        const restored = restoreOverlaySnapshot(missing, targetDir, workspaceRoot);
        expect(restored.restored).toBe(false);
        expect(restored.reason).toContain('snapshot not found');
        // The live target is untouched by the failed restore.
        expect(fs.existsSync(path.join(targetDir, 'variant.json'))).toBe(true);
    });

    test('containment: the trio refuses the workspace root itself and paths outside it', () => {
        // Root itself.
        expect(snapshotDirForOverlay(workspaceRoot, workspaceRoot).snapshotted).toBe(false);
        expect(discardOverlaySnapshot(workspaceRoot, workspaceRoot).discarded).toBe(false);
        // Outside the root.
        const outside = path.join(scratchRoot, 'outside');
        fs.mkdirSync(outside, { recursive: true });
        expect(snapshotDirForOverlay(outside, workspaceRoot).reason).toContain('not inside workspaceRoot');
        expect(discardOverlaySnapshot(outside, workspaceRoot).reason).toContain('not inside workspaceRoot');
        expect(restoreOverlaySnapshot(outside, targetDir, workspaceRoot).restored).toBe(false);
        expect(restoreOverlaySnapshot(path.join(templatesDir, 'x'), outside, workspaceRoot).restored).toBe(false);
        // Nothing was touched.
        expect(fs.existsSync(path.join(targetDir, 'variant.json'))).toBe(true);
        expect(fs.existsSync(outside)).toBe(true);
    });

    test('dot-prefixed backup name is invisible to deriveCoVariantDirs (never mistaken for a variant)', () => {
        const snap = snapshotDirForOverlay(targetDir, workspaceRoot);
        expect(snap.snapshotted).toBe(true);
        const derived = deriveCoVariantDirs(templatesDir);
        expect(derived).not.toContain(path.basename(snap.backupPath!));
        expect(derived.every((name) => name.startsWith('co-'))).toBe(true);
    });

    test('snapshot refuses when there is nothing to snapshot', () => {
        const absent = path.join(templatesDir, 'co-never-created');
        const snap = snapshotDirForOverlay(absent, workspaceRoot);
        expect(snap.snapshotted).toBe(false);
        expect(snap.reason).toContain('nothing to snapshot');
    });
});
