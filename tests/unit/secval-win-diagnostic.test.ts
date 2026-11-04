#!/usr/bin/env bun
/**
 * TEMPORARY diagnostic (U-20261104-002 windows CI investigation).
 * Logs the exact strings validateExtendsPath computes, on every platform.
 * Asserts nothing — to be removed once the windows-leg divergence is fixed.
 */
import { describe, test } from 'bun:test';
import { resolve, sep } from 'path';
import { realpathSync, existsSync } from 'fs';
import { SecurityValidator } from '../../scripts/helpers/security-validator';

describe('secval windows diagnostic', () => {
    test('log computed path strings', () => {
        const cwd = process.cwd();
        const target = resolve(cwd, 'agents/pm.md');
        let realCwd = '<realpath threw>';
        try { realCwd = realpathSync(cwd); } catch (e) { realCwd = `threw: ${e}`; }
        let realTarget = '<realpath threw>';
        try { realTarget = realpathSync(target); } catch (e) { realTarget = `threw: ${e}`; }
        console.log(`[secval-diag] platform=${process.platform} sep=${JSON.stringify(sep)}`);
        console.log(`[secval-diag] cwd=${JSON.stringify(cwd)}`);
        console.log(`[secval-diag] realpath(cwd)=${JSON.stringify(realCwd)}`);
        console.log(`[secval-diag] resolve(cwd,'agents/pm.md')=${JSON.stringify(target)}`);
        console.log(`[secval-diag] realpath(target)=${JSON.stringify(realTarget)}`);
        console.log(`[secval-diag] existsSync(target)=${existsSync(target)}`);

        const v = new SecurityValidator();
        console.log(`[secval-diag] detected workspaceRoot=${JSON.stringify((v as any).workspaceRoot)}`);
        const explicit = new SecurityValidator({ workspace_root: cwd });
        console.log(`[secval-diag] explicit workspaceRoot=${JSON.stringify((explicit as any).workspaceRoot)}`);

        const r1 = explicit.validateExtendsPath('agents/pm.md', cwd);
        console.log(`[secval-diag] explicit 'agents/pm.md' from cwd => valid=${r1.valid} type=${r1.valid ? 'ok' : r1.violation_type} msg=${r1.valid ? '' : r1.message} sanitized=${r1.valid ? JSON.stringify(r1.sanitized_path) : ''}`);
        const r2 = v.validateExtendsPath('agents/pm.md', cwd);
        console.log(`[secval-diag] detected 'agents/pm.md' from cwd => valid=${r2.valid} type=${r2.valid ? 'ok' : r2.violation_type} msg=${r2.valid ? '' : r2.message}`);
    });
});
