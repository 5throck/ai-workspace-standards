#!/usr/bin/env bun
/**
 * sync-skills.ts
 * Distributes skills from the SSOT (skills/) to .claude/skills/, .gemini/skills/, and .agents/skills/.
 * Also syncs shortcut skills (sync, meeting) from .agents/skills/ back to .claude and .gemini.
 *
 * Phase 1: Copy every skill directory (containing SKILL.md) to all three platform skill directories.
 * Phase 2: Back-sync shortcut skills that only exist in .agents/skills/ to .claude and .gemini.
 * Special: meeting-facilitation SKILL.md is also synced to .claude/commands/meeting.md and .gemini/commands/meeting.md.
 *
 * Idempotent: a target is only overwritten when its content differs from the
 * source (dirsEqual()); unchanged skills are left untouched on repeat runs
 * (no needless mtime churn or filesystem writes).
 *
 * By default operates on the workspace root. Pass `--dir <path>` to target a single
 * project root instead (e.g. a `templates/co-*` variant or `templates/common`), or
 * `--all-variants` to run once per `templates/co-*` directory plus `templates/common`
 * — this is how per-variant `.agents/skills/` (Antigravity CLI) drift gets caught and
 * fixed; the default workspace-root run does NOT touch variant directories.
 *
 * `security-gate: true` skills (validate-templates.ts Check B-03) are excluded from
 * Phase 1 distribution entirely — they must remain platform-neutral (`skills/` only).
 *
 * @version 1.4.1
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');

function resolveTargetRoots(): string[] {
    const args = process.argv.slice(2);
    const dirArgIndex = args.indexOf('--dir');
    if (dirArgIndex !== -1 && args[dirArgIndex + 1]) {
        return [path.resolve(workspaceRoot, args[dirArgIndex + 1])];
    }
    if (args.includes('--all-variants')) {
        const templatesDir = path.join(workspaceRoot, 'templates');
        const variants = fs.readdirSync(templatesDir, { withFileTypes: true })
            .filter(d => d.isDirectory() && d.name.startsWith('co-'))
            .map(d => path.join(templatesDir, d.name));
        return [...variants, path.join(templatesDir, 'common')];
    }
    return [workspaceRoot];
}

function dirsFor(root: string): SkillSyncDirs {
    return {
        ssotSkills:   path.join(root, 'skills'),
        claudeSkills: path.join(root, '.claude', 'skills'),
        geminiSkills: path.join(root, '.gemini', 'skills'),
        agentsSkills: path.join(root, '.agents', 'skills'),
    };
}

export interface SkillSyncDirs {
    ssotSkills: string;
    claudeSkills: string;
    geminiSkills: string;
    agentsSkills: string;
}

export interface SyncSkillsOptions {
    /** Overridable for tests; defaults to an idempotent (compare-then-copy) real fs copy. */
    copyDir?: (src: string, dest: string) => void;
}

/**
 * Recursively compares two directories (or files) for identical content.
 * Returns false if either path is missing, if the entry sets differ, or if
 * any file's content differs. Used to skip no-op copies (M3 idempotency).
 */
export function dirsEqual(a: string, b: string): boolean {
    if (!fs.existsSync(a) || !fs.existsSync(b)) return false;

    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    if (statA.isDirectory() !== statB.isDirectory()) return false;

    if (statA.isDirectory()) {
        const entriesA = fs.readdirSync(a).sort();
        const entriesB = fs.readdirSync(b).sort();
        if (entriesA.length !== entriesB.length) return false;
        for (let i = 0; i < entriesA.length; i++) {
            if (entriesA[i] !== entriesB[i]) return false;
            if (!dirsEqual(path.join(a, entriesA[i]), path.join(b, entriesB[i]))) return false;
        }
        return true;
    }

    return fs.readFileSync(a).equals(fs.readFileSync(b));
}

function defaultCopyDir(src: string, dest: string): void {
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(src, dest, { recursive: true });
}

/**
 * Runs the full skill distribution (Phase 1: SSOT -> platform dirs; Phase 2:
 * .agents/ shortcut skills back-synced to .claude/.gemini). Each skill/item
 * is wrapped independently in try/catch (M2): a failure on one item is
 * collected and reported, and does not abort processing of the rest.
 */
export async function syncSkills(dirs: SkillSyncDirs, opts: SyncSkillsOptions = {}): Promise<{ errors: string[] }> {
    const copyDir = opts.copyDir ?? defaultCopyDir;
    const { ssotSkills, claudeSkills, geminiSkills, agentsSkills } = dirs;
    const root = path.dirname(ssotSkills);

    fs.mkdirSync(claudeSkills, { recursive: true });
    fs.mkdirSync(geminiSkills, { recursive: true });
    fs.mkdirSync(agentsSkills, { recursive: true });

    const errors: string[] = [];

    if (!fs.existsSync(ssotSkills)) {
        return { errors };
    }

    // --- Phase 1: Distribute SSOT skills to all three platform directories ---
    for (const item of fs.readdirSync(ssotSkills)) {
        try {
            const itemPath = path.join(ssotSkills, item);
            const stat = fs.statSync(itemPath);
            if (!stat.isDirectory()) continue;
            const skillMdSrc = path.join(itemPath, 'SKILL.md');
            // Skip non-skill files (README.md, SKILLS.md, etc.)
            if (!fs.existsSync(skillMdSrc)) continue;

            // `security-gate: true` skills are a platform-neutral-only hard gate
            // (validate-templates.ts Check B-03) — they must never be mirrored into
            // .claude/skills/, .gemini/skills/, or .agents/skills/, only skills/.
            if (/^security-gate:\s*true\b/m.test(fs.readFileSync(skillMdSrc, 'utf-8'))) {
                continue;
            }

            for (const targetDir of [claudeSkills, geminiSkills, agentsSkills]) {
                const target = path.join(targetDir, item);
                if (dirsEqual(itemPath, target)) {
                    continue; // idempotent skip — content already matches
                }
                copyDir(itemPath, target);
                console.log(`  -> Synced ${item} to ${path.relative(root, targetDir)}/`);
            }

            // Special logic for commands derived from skills
            if (item === 'meeting-facilitation') {
                const claudeCmdDir = path.join(root, '.claude', 'commands');
                const geminiCmdDir = path.join(root, '.gemini', 'commands');
                fs.mkdirSync(claudeCmdDir, { recursive: true });
                fs.mkdirSync(geminiCmdDir, { recursive: true });

                const skillMdPath = path.join(itemPath, 'SKILL.md');
                if (fs.existsSync(skillMdPath)) {
                    const claudeCmdTarget = path.join(claudeCmdDir, 'meeting.md');
                    if (!dirsEqual(skillMdPath, claudeCmdTarget)) {
                        fs.copyFileSync(skillMdPath, claudeCmdTarget);
                        console.log(`  -> Synced SKILL.md to .claude/commands/meeting.md`);
                    }

                    const geminiCmdTarget = path.join(geminiCmdDir, 'meeting.md');
                    if (!dirsEqual(skillMdPath, geminiCmdTarget)) {
                        fs.copyFileSync(skillMdPath, geminiCmdTarget);
                        console.log(`  -> Synced SKILL.md to .gemini/commands/meeting.md`);
                    }
                }
            }
        } catch (err) {
            const msg = (err instanceof Error) ? err.message : String(err);
            errors.push(`Phase 1: ${item}: ${msg}`);
            console.error(`  ❌ Error syncing ${item}: ${msg}`);
        }
    }

    // --- Phase 2: Sync .agents/skills/ shortcut skills back to .claude and .gemini ---
    // These are skills that only exist in .agents/skills/ (not in SSOT) but should be
    // available on Claude Code and Gemini CLI as well.
    const SHORTCUT_SKILLS = ['sync', 'meeting', 'source-command-commit-push-pr'];

    for (const item of SHORTCUT_SKILLS) {
        try {
            const source = path.join(agentsSkills, item);
            if (!fs.existsSync(source) || !fs.existsSync(path.join(source, 'SKILL.md'))) continue;

            for (const targetDir of [claudeSkills, geminiSkills]) {
                const target = path.join(targetDir, item);
                if (dirsEqual(source, target)) {
                    continue; // idempotent skip
                }
                copyDir(source, target);
                console.log(`  -> Synced shortcut ${item} to ${path.relative(root, targetDir)}/`);
            }
        } catch (err) {
            const msg = (err instanceof Error) ? err.message : String(err);
            errors.push(`Phase 2: ${item}: ${msg}`);
            console.error(`  ❌ Error syncing shortcut ${item}: ${msg}`);
        }
    }

    return { errors };
}

if (import.meta.main) {
    const targetRoots = resolveTargetRoots();
    const allErrors: string[] = [];

    for (const root of targetRoots) {
        const dirs = dirsFor(root);
        console.log(`Syncing skills from SSOT (${dirs.ssotSkills})...`);
        const { errors } = await syncSkills(dirs);
        allErrors.push(...errors);
    }

    if (allErrors.length > 0) {
        console.error(`\n❌ ${allErrors.length} error(s) during skill synchronization:`);
        for (const e of allErrors) console.error(`  - ${e}`);
        process.exitCode = 1;
    }

    console.log('Skill synchronization complete!');
}
