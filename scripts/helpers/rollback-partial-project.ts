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
 * @version 1.0.0
 */

import { existsSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';

export interface RollbackResult {
    rolledBack: boolean;
    reason?: string;
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
