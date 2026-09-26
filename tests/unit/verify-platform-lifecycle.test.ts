/**
 * Subprocess tests for verify-platform-lifecycle.ts — Check G commands-surface
 * registry (T-20260925-010) and the .hermes soak promotion (T-20260925-008).
 *
 * The script runs main() at import time, so tests drive it as a subprocess
 * with cwd set to a Tier 1 fixture (a templates/ dir present, no variant.json)
 * and parse --json output. Tier 1 is required because Check G is Tier-1-only.
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, '..', '..', 'scripts', 'verify-platform-lifecycle.ts');
const scratch = path.resolve(import.meta.dir, '..', '.temp', 'verify-platform-lifecycle-test');

interface Issue { level: 'error' | 'warning'; check: string; message: string }

function runVerifier(root: string): { errors: Issue[]; warnings: Issue[]; stdout: string } {
    const stdout = execFileSync('bun', [scriptPath, '--json'], { cwd: root, encoding: 'utf-8' });
    const jsonLine = stdout.trim().split('\n').filter(l => l.startsWith('{')).pop() ?? '{}';
    return { ...JSON.parse(jsonLine), stdout };
}

/** Non-JSON run — pass() lines (e.g. recorded exclusions) print only in human mode. */
function runVerifierHuman(root: string): string {
    return execFileSync('bun', [scriptPath], { cwd: root, encoding: 'utf-8' });
}

function freshFixture(): string {
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.mkdirSync(path.join(scratch, 'templates'), { recursive: true }); // Tier 1 marker
    return scratch;
}

function writeCommands(root: string, rel: string, files: string[]): void {
    const dir = path.join(root, rel);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(dir, f), '# cmd\n', 'utf-8');
}

describe('verify-platform-lifecycle Check G commands-surface registry (T-20260925-010)', () => {
    beforeEach(() => freshFixture());
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    test('a .claude command missing from templates/common is a FAIL (pre-existing severity)', () => {
        writeCommands(scratch, '.claude/commands', ['sync.md']);
        const { errors } = runVerifier(scratch);
        expect(errors.some(e => e.check === 'platform-command-propagation' && e.message.includes('.claude/commands/'))).toBe(true);
    });

    test('fully propagated .claude/.gemini/.codex/.agents legs emit no issues and the .hermes exclusion stands', () => {
        writeCommands(scratch, '.claude/commands', ['sync.md', 'meeting.md']);
        writeCommands(scratch, '.gemini/commands', ['sync.md', 'meeting.md']);
        writeCommands(scratch, 'templates/common/.claude/commands', ['sync.md', 'meeting.md']);
        writeCommands(scratch, 'templates/common/.gemini/commands', ['sync.md', 'meeting.md']);
        writeCommands(scratch, 'templates/common/.codex/prompts', ['sync.md', 'meeting.md']);
        writeCommands(scratch, '.agents/commands', ['sync.md', 'meeting.md']); // lockstep leg (T-20260927-001)
        const { errors, warnings } = runVerifier(scratch);
        expect(errors.filter(e => e.check === 'platform-command-propagation')).toEqual([]);
        expect(warnings.filter(w => w.check === 'platform-command-propagation')).toEqual([]);
        // Recorded exclusions — explicit pass lines, never silent skips (human mode only).
        const human = runVerifierHuman(scratch);
        expect(human).toContain('.agents/commands/ ↔ .claude/commands/: lockstep holds');
        expect(human).toContain('.hermes/commands: recorded exclusion');
    });

    test('the .agents lockstep leg: missing and drifted files FAIL (promoted T-20260925-002)', () => {
        writeCommands(scratch, '.claude/commands', ['sync.md', 'meeting.md']);
        writeCommands(scratch, '.gemini/commands', ['sync.md']);
        writeCommands(scratch, 'templates/common/.claude/commands', ['sync.md']);
        writeCommands(scratch, 'templates/common/.gemini/commands', ['sync.md']);
        writeCommands(scratch, 'templates/common/.codex/prompts', ['sync.md']);
        writeCommands(scratch, '.agents/commands', ['meeting.md']); // sync.md missing
        fs.writeFileSync(path.join(scratch, '.agents', 'commands', 'meeting.md'), '# drifted\n', 'utf-8'); // content differs
        const { errors, warnings } = runVerifier(scratch);
        expect(warnings.filter(w => w.message.includes('.agents/commands'))).toEqual([]);
        expect(errors.some(e => e.message.includes('no .agents/commands/ counterpart') && e.message.includes('sync.md'))).toBe(true);
        expect(errors.some(e => e.message.includes('drifted from .claude/commands/') && e.message.includes('meeting.md'))).toBe(true);
    });

    test('the .agents lockstep leg: recorded adaptation and exclusion do not fire (T-20260927-001)', () => {
        // commit-push-pr.md is in AGENTS_COMMANDS_ADAPTED (differs freely),
        // gateguard.md in AGENTS_COMMANDS_EXCLUDED (no .agents copy needed).
        writeCommands(scratch, '.claude/commands', ['commit-push-pr.md', 'gateguard.md']);
        writeCommands(scratch, '.gemini/commands', ['commit-push-pr.md', 'gateguard.md']);
        writeCommands(scratch, 'templates/common/.claude/commands', ['commit-push-pr.md', 'gateguard.md']);
        writeCommands(scratch, 'templates/common/.gemini/commands', ['commit-push-pr.md', 'gateguard.md']);
        writeCommands(scratch, 'templates/common/.codex/prompts', ['commit-push-pr.md', 'gateguard.md']);
        writeCommands(scratch, '.agents/commands', ['commit-push-pr.md']); // adapted content + no gateguard
        fs.writeFileSync(path.join(scratch, '.agents', 'commands', 'commit-push-pr.md'), '# adapted\n', 'utf-8');
        const { errors, warnings } = runVerifier(scratch);
        expect(errors.filter(e => e.message.includes('.agents/commands'))).toEqual([]);
        expect(warnings.filter(w => w.message.includes('.agents/commands'))).toEqual([]);
    });

    test('the .codex prompts mapping leg FAILs on a missing prompt (promoted T-20260925-002)', () => {
        writeCommands(scratch, '.claude/commands', ['sync.md']);
        writeCommands(scratch, '.gemini/commands', ['sync.md']);
        writeCommands(scratch, 'templates/common/.claude/commands', ['sync.md']);
        writeCommands(scratch, 'templates/common/.gemini/commands', ['sync.md']);
        // templates/common/.codex/prompts deliberately missing sync.md
        const { errors, warnings } = runVerifier(scratch);
        expect(warnings.filter(w => w.message.includes('.codex/prompts'))).toEqual([]);
        expect(errors.some(e => e.message.includes('.codex/prompts'))).toBe(true);
    });
});

describe('verify-platform-lifecycle .hermes soak promotion (T-20260925-008)', () => {
    beforeEach(() => freshFixture());
    afterEach(() => fs.rmSync(scratch, { recursive: true, force: true }));

    test('a .hermes mirror skill missing version: is a FAIL (promoted out of SOAK_MIRRORS)', () => {
        const skillDir = path.join(scratch, '.hermes', 'skills', 'demo');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo\n---\nbody', 'utf-8');
        const { errors, warnings } = runVerifier(scratch);
        expect(errors.some(e => e.message.includes('.hermes/skills/demo') && e.message.includes('version'))).toBe(true);
        expect(warnings.some(w => w.message.includes('.hermes/skills/demo'))).toBe(false);
    });

    test('an .agents mirror skill missing version: FAIL (promoted out of soak, T-20260925-002)', () => {
        const skillDir = path.join(scratch, '.agents', 'skills', 'demo');
        fs.mkdirSync(skillDir, { recursive: true });
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: demo\n---\nbody', 'utf-8');
        const { errors, warnings } = runVerifier(scratch);
        expect(warnings.filter(w => w.message.includes('.agents/skills/demo'))).toEqual([]);
        expect(errors.some(e => e.message.includes('.agents/skills/demo') && e.message.includes('version'))).toBe(true);
    });
});
