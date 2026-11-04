#!/usr/bin/env bun
/**
 * TEMPORARY diagnostic (U-20261104-002 windows CI investigation, round 2).
 * On win32 ONLY, deliberately fails with the computed path strings in the
 * expect diff (the one output channel the CI runner definitely prints).
 * ubuntu/macos stay green. Removed together with the actual fix.
 */
import { describe, test } from 'bun:test';
import { expect } from 'bun:test';
import { resolve, sep } from 'path';
import { realpathSync } from 'fs';
import { SecurityValidator } from '../../scripts/helpers/security-validator';

describe('secval windows diagnostic (expect-fail on win32)', () => {
    test('expose computed strings via expect diff', () => {
        const cwd = process.cwd();
        const target = resolve(cwd, 'agents/pm.md');
        let realCwd = '<threw>';
        try { realCwd = realpathSync(cwd); } catch (e) { realCwd = `threw:${e}`; }
        let realTarget = '<threw>';
        try { realTarget = realpathSync(target); } catch (e) { realTarget = `threw:${e}`; }

        const explicit = new SecurityValidator({ workspace_root: cwd });
        const wsExplicit = (explicit as unknown as { workspaceRoot: string }).workspaceRoot;
        const r1 = explicit.validateExtendsPath('agents/pm.md', cwd);

        const detected = new SecurityValidator();
        const wsDetected = (detected as unknown as { workspaceRoot: string }).workspaceRoot;
        const r2 = detected.validateExtendsPath('agents/pm.md', cwd);

        if (process.platform === 'win32') {
            const dump = [
                `platform=${process.platform}`,
                `sep=${JSON.stringify(sep)}`,
                `cwd=${JSON.stringify(cwd)}`,
                `realpath(cwd)=${JSON.stringify(realCwd)}`,
                `resolve(target)=${JSON.stringify(target)}`,
                `realpath(target)=${JSON.stringify(realTarget)}`,
                `wsExplicit=${JSON.stringify(wsExplicit)}`,
                `r1.valid=${r1.valid} r1.type=${r1.valid ? 'ok' : r1.violation_type} r1.msg=${r1.valid ? '' : r1.message} r1.sanitized=${r1.valid ? JSON.stringify(r1.sanitized_path) : ''}`,
                `wsDetected=${JSON.stringify(wsDetected)}`,
                `r2.valid=${r2.valid} r2.type=${r2.valid ? 'ok' : r2.violation_type}`,
            ].join(' | ');
            expect(dump).toBe('DIAGNOSTIC-SENTINEL');
        } else {
            // Non-windows: pin the contract so this test is never a no-op.
            expect(r1.valid).toBe(true);
            expect(r2.valid).toBe(true);
        }
    });
});
