#!/usr/bin/env bun
/**
 * rollback-partial-project.ts — Safe cleanup of a partially-scaffolded
 * project directory after a failed new-project.ts run (M13).
 *
 * Extracted as its own module (rather than inline in new-project.ts) so it
 * can be unit-tested directly: new-project.ts is a top-level imperative
 * script with no import guard (matches the existing convention — see
 * scripts/test-new-project.ts, which tests it via subprocess, not import),
 * so importing it directly in a unit test would execute a real scaffold run.
 *
 * v1.1.0 adds the overlay snapshot-rename trio (design
 * docs/designs/2026-09-16-variant-ization-overlay-guard-design.md §4.2):
 * rm-based rollback is WRONG when the target pre-existed — it would delete
 * the live variant, not the run's output. For authorized-overlay runs the
 * caller snapshots the existing tree (atomic rename, dot-prefixed sibling
 * under the same parent so every template-directory scan — including
 * deriveCoVariantDirs' `startsWith('co-')` filter — skips it), restores it
 * on failure, and discards it after a green run.
 *
 * @version 1.1.0
 */

import { existsSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';

export interface RollbackResult {
    rolledBack: boolean;
    reason?: string;
}

export interface OverlaySnapshotResult {
    snapshotted: boolean;
    /** Dot-prefixed sibling path the previous tree was renamed to. */
    backupPath?: string;
    reason?: string;
}

export interface OverlayRestoreResult {
    restored: boolean;
    reason?: string;
}

export interface OverlayDiscardResult {
    discarded: boolean;
    reason?: string;
}

/**
 * UTC timestamp for snapshot directory names. Colons/dots are replaced so the
 * name is filename-safe on every CI platform (Windows forbids `:` in names).
 */
function overlaySnapshotStamp(date = new Date()): string {
    return date.toISOString().replace(/[:.]/g, '-');
}

/**
 * Removes `projectDir` if it exists, but ONLY when it is a real subdirectory
 * of `workspaceRoot` (never the workspace root itself, and never a path
 * outside it) — a safety boundary against a caller-error wiping out
 * unrelated directories.
 */
export function rollbackPartialProject(projectDir: string, workspaceRoot: string): RollbackResult {
    const resolvedProjectDir = resolve(projectDir);
    const resolvedRoot = resolve(workspaceRoot);

    if (resolvedProjectDir === resolvedRoot) {
        return { rolledBack: false, reason: 'refusing to remove the workspace root itself' };
    }
    if (!resolvedProjectDir.startsWith(resolvedRoot + sep)) {
        return { rolledBack: false, reason: 'projectDir is not inside workspaceRoot' };
    }
    if (!existsSync(resolvedProjectDir)) {
        return { rolledBack: false, reason: 'nothing to roll back' };
    }

    rmSync(resolvedProjectDir, { recursive: true, force: true });
    return { rolledBack: true };
}

/**
 * Shared containment check for the snapshot trio — the same boundary
 * rollbackPartialProject enforces: refuse the workspace root itself and
 * anything outside it.
 */
function checkContainment(path: string, workspaceRoot: string): string | undefined {
    const resolved = resolve(path);
    const resolvedRoot = resolve(workspaceRoot);
    if (resolved === resolvedRoot) return 'refusing to operate on the workspace root itself';
    if (!resolved.startsWith(resolvedRoot + sep)) return 'path is not inside workspaceRoot';
    return undefined;
}

/**
 * Rename `targetDir` to a dot-prefixed sibling
 * `.overlay-backup-<name>-<UTC timestamp>/` in the same parent directory.
 * The rename is atomic on one volume. Never throws — failures come back as
 * `{ snapshotted: false, reason }` so a rollback-orchestration bug can never
 * mask the run's original error (best-effort with loud reporting, design §4.2).
 */
export function snapshotDirForOverlay(targetDir: string, workspaceRoot: string): OverlaySnapshotResult {
    const resolvedTarget = resolve(targetDir);
    const containment = checkContainment(resolvedTarget, workspaceRoot);
    if (containment) return { snapshotted: false, reason: containment };
    if (!existsSync(resolvedTarget)) {
        return { snapshotted: false, reason: 'nothing to snapshot — target does not exist' };
    }
    if (!statSync(resolvedTarget).isDirectory()) {
        return { snapshotted: false, reason: 'target is not a directory' };
    }

    const backupPath = join(
        dirname(resolvedTarget),
        `.overlay-backup-${basename(resolvedTarget)}-${overlaySnapshotStamp()}`,
    );
    if (existsSync(backupPath)) {
        return { snapshotted: false, reason: `snapshot path already exists: ${backupPath}` };
    }

    try {
        renameSync(resolvedTarget, backupPath);
    } catch (error) {
        return { snapshotted: false, reason: `rename failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    return { snapshotted: true, backupPath };
}

/**
 * Undo an authorized-overlay run: remove the partial output at `targetDir`,
 * then rename the snapshot back over it. Never throws; a failed restore
 * returns `{ restored: false, reason }` and KEEPS the snapshot on disk so the
 * operator (or a re-run) can still recover — the original run error must
 * never be masked by a rollback failure.
 */
export function restoreOverlaySnapshot(backupPath: string, targetDir: string, workspaceRoot: string): OverlayRestoreResult {
    const resolvedBackup = resolve(backupPath);
    const resolvedTarget = resolve(targetDir);

    const backupContainment = checkContainment(resolvedBackup, workspaceRoot);
    if (backupContainment) return { restored: false, reason: `backupPath: ${backupContainment}` };
    const targetContainment = checkContainment(resolvedTarget, workspaceRoot);
    if (targetContainment) return { restored: false, reason: `targetDir: ${targetContainment}` };
    if (!existsSync(resolvedBackup)) {
        return { restored: false, reason: `snapshot not found: ${resolvedBackup}` };
    }
    if (resolvedBackup === resolvedTarget) {
        return { restored: false, reason: 'backupPath and targetDir are the same path' };
    }

    try {
        if (existsSync(resolvedTarget)) {
            rmSync(resolvedTarget, { recursive: true, force: true });
        }
        renameSync(resolvedBackup, resolvedTarget);
    } catch (error) {
        return {
            restored: false,
            reason: `restore failed (snapshot kept at ${resolvedBackup}): ${error instanceof Error ? error.message : String(error)}`,
        };
    }
    return { restored: true };
}

/**
 * Remove the snapshot after a green run. Never throws; a failed discard is
 * reported so the dot-prefixed leftover is visible to the operator instead of
 * silently straying in templates/.
 */
export function discardOverlaySnapshot(backupPath: string, workspaceRoot: string): OverlayDiscardResult {
    const resolvedBackup = resolve(backupPath);
    const containment = checkContainment(resolvedBackup, workspaceRoot);
    if (containment) return { discarded: false, reason: `backupPath: ${containment}` };
    if (!existsSync(resolvedBackup)) {
        return { discarded: false, reason: `snapshot not found: ${resolvedBackup}` };
    }
    try {
        rmSync(resolvedBackup, { recursive: true, force: true });
    } catch (error) {
        return { discarded: false, reason: `discard failed: ${error instanceof Error ? error.message : String(error)}` };
    }
    return { discarded: true };
}
