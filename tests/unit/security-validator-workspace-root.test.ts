#!/usr/bin/env bun
/**
 * Workspace-root detection tests for scripts/helpers/security-validator.ts
 * (U-20261104-002).
 *
 * The validator used to pin its workspace boundary to process.cwd(), so a
 * tool running inside a variant PROJECT (cwd = the project root) rejected the
 * documented cross-tier extends contract (`extends: ../../../agents/pm.md`,
 * agents/pm.md:2 / agents/docs-writer.md:2) as a path-traversal escape. The
 * boundary is now detected by walking upward for an L0-only workspace marker.
 *
 * These tests pin the three contracts the fix must keep simultaneously:
 *   1. NEGATIVE CONTROL — traversal escaping the DETECTED root fails closed
 *      (a detector bug that widened the boundary must not weaken Check 2).
 *   2. The legitimate 3-tier relative extends (project → workspace root)
 *      validates when the target exists.
 *   3. An explicit options.workspace_root override always wins over detection.
 */

import { describe, test, expect, afterEach } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
    SecurityValidator,
    detectWorkspaceRoot,
    SecurityViolationType,
} from '../../scripts/helpers/security-validator';

const tempDirs: string[] = [];
const originalCwd = process.cwd();

function makeFakeWorkspace(): { workspace: string; project: string } {
    const workspace = mkdtempSync(join(tmpdir(), 'secval-ws-'));
    tempDirs.push(workspace);
    // L0-only markers the detector looks for.
    writeFileSync(join(workspace, 'CONSTITUTION.md'), '# Constitution\n');
    mkdirSync(join(workspace, 'templates', 'common'), { recursive: true });
    // The workspace-root agents the variant extends.
    mkdirSync(join(workspace, 'agents'), { recursive: true });
    writeFileSync(join(workspace, 'agents', 'pm.md'), '# PM\n');
    // A nested variant project like Projects/co-newbiz.
    const project = join(workspace, 'Projects', 'co-newbiz');
    mkdirSync(join(project, 'agents'), { recursive: true });
    writeFileSync(join(project, 'agents', 'pm.md'), '---\nextends: ../../../agents/pm.md\n---\n');
    // A decoy SIBLING of the workspace whose name shares its prefix — must
    // never pass the boundary check even though the string prefix matches.
    mkdirSync(workspace + '-evil', { recursive: true });
    tempDirs.push(workspace + '-evil');
    return { workspace, project };
}

afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length) {
        const dir = tempDirs.pop()!;
        rmSync(dir, { recursive: true, force: true });
    }
});

describe('detectWorkspaceRoot', () => {
    test('walks upward from a nested project to the marker-bearing root', () => {
        const { workspace, project } = makeFakeWorkspace();
        expect(detectWorkspaceRoot(project)).toBe(workspace);
        expect(detectWorkspaceRoot(join(project, 'agents'))).toBe(workspace);
    });

    test('CONSTITUTION.md and templates/common each suffice as markers', () => {
        const constitutionOnly = mkdtempSync(join(tmpdir(), 'secval-c-'));
        tempDirs.push(constitutionOnly);
        writeFileSync(join(constitutionOnly, 'CONSTITUTION.md'), 'x');
        expect(detectWorkspaceRoot(join(constitutionOnly, 'deep', 'dir'))).toBe(constitutionOnly);

        const templatesOnly = mkdtempSync(join(tmpdir(), 'secval-t-'));
        tempDirs.push(templatesOnly);
        mkdirSync(join(templatesOnly, 'templates', 'common'), { recursive: true });
        expect(detectWorkspaceRoot(templatesOnly)).toBe(templatesOnly);
    });

    test('fail-closed: no marker anywhere falls back to the start dir', () => {
        const bare = mkdtempSync(join(tmpdir(), 'secval-bare-'));
        tempDirs.push(bare);
        expect(detectWorkspaceRoot(join(bare, 'sub'))).toBe(join(bare, 'sub'));
    });
});

describe('SecurityValidator workspace-root semantics (U-20261104-002)', () => {
    test('NEGATIVE CONTROL: traversal escaping the DETECTED root still fails closed', () => {
        const { project } = makeFakeWorkspace();
        process.chdir(project);
        const validator = new SecurityValidator(); // no options — detection path
        const result = validator.validateExtendsPath(
            '../../../../../../../../etc/passwd',
            join(project, 'agents'),
        );
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.violation_type).toBe(SecurityViolationType.PATH_TRAVERSAL);
        }
    });

    test('NEGATIVE CONTROL: a sibling directory sharing the root name prefix is outside', () => {
        const { workspace, project } = makeFakeWorkspace();
        process.chdir(project);
        const validator = new SecurityValidator();
        // Resolves to <workspace>-evil/secret.md — startsWith(workspace) would
        // wrongly accept it under a bare-prefix comparison.
        const result = validator.validateExtendsPath(
            '../../../' + (workspace + '-evil').split('/').pop()! + '/secret.md',
            join(project, 'agents'),
        );
        expect(result.valid).toBe(false);
    });

    test('the legitimate 3-tier relative extends (project agents -> workspace agents) validates', () => {
        const { project } = makeFakeWorkspace();
        process.chdir(project);
        const validator = new SecurityValidator();
        const result = validator.validateExtendsPath('../../../agents/pm.md', join(project, 'agents'));
        expect(result.valid).toBe(true);
        if (result.valid) {
            // The validator canonicalizes symlinks (macOS /var → /private/var),
            // so the sanitized path is compared against the canonical spelling.
            expect(result.sanitized_path).toBe(realpathSync(resolve(join(project, '..', '..', 'agents', 'pm.md'))));
        }
    });

    test('explicit options.workspace_root takes precedence over detection', () => {
        const { workspace, project } = makeFakeWorkspace();
        process.chdir(project);
        const validator = new SecurityValidator({ workspace_root: project });
        // Inside the explicit root: valid (target exists in project agents/).
        expect(validator.validateExtendsPath('pm.md', join(project, 'agents')).valid).toBe(true);
        // Reaching the wider workspace root is now OUTSIDE the declared boundary.
        const result = validator.validateExtendsPath('../../../agents/pm.md', join(project, 'agents'));
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.violation_type).toBe(SecurityViolationType.PATH_TRAVERSAL);
        }
    });
});
