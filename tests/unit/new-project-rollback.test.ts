/**
 * Tests for rollback-partial-project.ts — rollbackPartialProject() (M13),
 * used by new-project.ts's process 'exit' handler. On any failure after
 * scaffolding has started (mkdirSync(projectDir)), the partially-created
 * project directory must be cleaned up rather than left as broken
 * half-scaffolded state. new-project.ts itself is a top-level imperative
 * script with no import guard (tested via subprocess — see
 * scripts/test-new-project.ts), so the removal logic lives in its own
 * side-effect-free module to allow direct unit testing.
 *
 * @version 1.0.0
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { rollbackPartialProject } from '../../scripts/helpers/rollback-partial-project.ts';

const scratchRoot = path.resolve(import.meta.dir, '..', '.temp', 'new-project-rollback-test');
const workspaceRoot = path.join(scratchRoot, 'workspace');

describe('rollbackPartialProject', () => {
    beforeEach(() => {
        fs.rmSync(scratchRoot, { recursive: true, force: true });
        fs.mkdirSync(workspaceRoot, { recursive: true });
    });
    afterEach(() => fs.rmSync(scratchRoot, { recursive: true, force: true }));

    test('removes a partially-created project directory inside the workspace', () => {
        const projectDir = path.join(workspaceRoot, 'my-new-project');
        fs.mkdirSync(projectDir, { recursive: true });
        fs.writeFileSync(path.join(projectDir, 'partial-file.txt'), 'incomplete scaffold');

        const result = rollbackPartialProject(projectDir, workspaceRoot);

        expect(result.rolledBack).toBe(true);
        expect(fs.existsSync(projectDir)).toBe(false);
    });

    test('is a no-op when the project directory does not exist', () => {
        const projectDir = path.join(workspaceRoot, 'never-created');
        const result = rollbackPartialProject(projectDir, workspaceRoot);
        expect(result.rolledBack).toBe(false);
    });

    test('refuses to remove the workspace root itself', () => {
        const result = rollbackPartialProject(workspaceRoot, workspaceRoot);
        expect(result.rolledBack).toBe(false);
        expect(fs.existsSync(workspaceRoot)).toBe(true);
    });

    test('refuses to remove a directory outside the workspace root', () => {
        const outsideDir = path.join(scratchRoot, 'outside-workspace');
        fs.mkdirSync(outsideDir, { recursive: true });

        const result = rollbackPartialProject(outsideDir, workspaceRoot);

        expect(result.rolledBack).toBe(false);
        expect(fs.existsSync(outsideDir)).toBe(true);
    });

    test('supports nested project paths (e.g. --variant subdirectory scaffolds)', () => {
        const nestedProjectDir = path.join(workspaceRoot, 'group', 'nested-project');
        fs.mkdirSync(nestedProjectDir, { recursive: true });

        const result = rollbackPartialProject(nestedProjectDir, workspaceRoot);

        expect(result.rolledBack).toBe(true);
        expect(fs.existsSync(nestedProjectDir)).toBe(false);
        // Parent 'group' dir may or may not remain — only the project dir itself is guaranteed removed.
    });
});
