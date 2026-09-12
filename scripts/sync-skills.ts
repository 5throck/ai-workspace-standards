#!/usr/bin/env bun
// @version 1.8.0
// v1.8.0 (2026-09-12, T-20260912-017): hardening — (1) advisory concurrency guard:
//   a PID-stamped `.sync-skills.lock` at the workspace root (PID-validated stale-lock
//   recovery, mirroring .githooks/post-checkout) makes a second concurrent run fail
//   fast instead of interleaving its copy/rename sequences with the first. (2) Atomic
//   copies: defaultCopyDir stages into a temp sibling and swaps in with rename, so an
//   interrupted run can no longer leave a half-written platform skill tree behind the
//   old rm-then-cp window. (3) Phase 2 premise fix: the hardcoded SHORTCUT_SKILLS list
//   claimed 'sync'/'meeting'/'source-command-commit-push-pr' exist only in
//   .agents/skills/, but the first and last DO exist in the SSOT (skills/) — Phase 1
//   overwrote them from SSOT before Phase 2 back-synced the clobbered copy. Back-sync
//   now applies only to genuinely .agents-only dirs (discovered dynamically), and an
//   .agents dir diverging from its SSOT counterpart produces a WARN instead of a
//   silent clobber. (4) `--dir` with a missing value is a hard argument error instead
//   of a silent workspace-root fallback, and a nonexistent target root is rejected
//   before any writes.
// v1.7.0 (2026-09-12, ADR-0077 W1): fourth platform target `.codex/skills/` (Codex CLI +
//   Desktop App mirror — same B-03/mirror:false exclusions as the other targets) and
//   Phase 1b — `.claude/commands/*.md` (the commands SSOT) mirrored to `.codex/prompts/`
//   as Codex custom prompts; live project-prompts support is verified in W5, and an
//   unsupported result demotes this mirror to documented no-op output.
// v1.6.0 (2026-09-12): Phase 1 honors `mirror: false` frontmatter — agent-dispatched
//   fleet skills (PM-gateway model) stay in skills/ without platform mirroring.
// v1.5.0 (2026-09-10, T-20260910-026): dirsEqual() now lstats instead of statting
//   (symlinks compared by target string, never dereferenced) and carries a depth
//   cap of 64 so a symlinked directory cycle cannot recurse infinitely.
/**
 * sync-skills.ts
 * Distributes skills from the SSOT (skills/) to .claude/skills/, .gemini/skills/,
 * .agents/skills/, and .codex/skills/.
 * Also back-syncs genuinely .agents-only shortcut skills to .claude and .gemini,
 * and WARNs when an .agents copy diverges from its SSOT counterpart.
 *
 * Phase 1: Copy every skill directory (containing SKILL.md) to all four platform skill directories.
 * Phase 1b: Mirror .claude/commands/*.md (commands SSOT) to .codex/prompts/ as Codex prompts.
 * Phase 2: Back-sync shortcut skill dirs that exist ONLY in .agents/skills/ (absent
 *          from the SSOT) to .claude and .gemini; WARN on .agents dirs that diverge
 *          from their SSOT counterpart (SSOT wins — see the Phase 2 comment).
 * Special: meeting-facilitation SKILL.md is also synced to .claude/commands/meeting.md and .gemini/commands/meeting.md.
 *
 * Idempotent: a target is only overwritten when its content differs from the
 * source (dirsEqual()); unchanged skills are left untouched on repeat runs
 * (no needless mtime churn or filesystem writes). Copies are atomic
 * (temp sibling + rename) so an interrupted run cannot leave a half-written
 * platform skill tree.
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
 * Concurrency: the CLI takes an advisory `.sync-skills.lock` at the workspace root
 * (PID-stamped, stale-lock recovering) and fails fast when another run is active.
 *
 * @version 1.8.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const scriptDir     = import.meta.dir;
const workspaceRoot = path.resolve(scriptDir, '..');

/**
 * Resolves the target roots from argv. Exported for unit tests.
 *
 * T-20260912-017: `--dir` with a missing value is a HARD argument error — the old
 * behavior silently fell back to the workspace root, so a typo'd invocation (e.g.
 * `--dir` forgotten at the end of the command) would rewrite all four platform
 * directories at the wrong root. Callers should also verify the returned roots
 * exist before writing (done in the CLI entry point).
 */
export function resolveTargetRoots(argv: string[] = process.argv.slice(2)): string[] {
    const dirArgIndex = argv.indexOf('--dir');
    if (dirArgIndex !== -1) {
        const dirValue = argv[dirArgIndex + 1];
        if (!dirValue || dirValue.startsWith('--')) {
            throw new Error("--dir requires a path argument (e.g. `bun scripts/sync-skills.ts --dir templates/co-consult`)");
        }
        return [path.resolve(workspaceRoot, dirValue)];
    }
    if (argv.includes('--all-variants')) {
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
        codexSkills:  path.join(root, '.codex', 'skills'),
    };
}

export interface SkillSyncDirs {
    ssotSkills: string;
    claudeSkills: string;
    geminiSkills: string;
    agentsSkills: string;
    codexSkills: string;
}

export interface SyncSkillsOptions {
    /** Overridable for tests; defaults to an idempotent (compare-then-copy) real fs copy. */
    copyDir?: (src: string, dest: string) => void;
}

/**
 * Copies `src` to `dest` atomically (T-20260912-017): the tree is first staged into
 * a temp sibling inside dest's parent directory (same filesystem, so the final
 * rename is atomic) and only then swapped in. The previous rm-then-cp pattern left
 * a half-written platform skill tree behind whenever a run was interrupted between
 * rm and cp; now an interrupted run leaves at most a stray `.tmp-<pid>-<ts>` sibling,
 * never a truncated destination.
 */
export function defaultCopyDir(src: string, dest: string): void {
    const tmpDest = `${dest}.tmp-${process.pid}-${Date.now()}`;
    try {
        fs.cpSync(src, tmpDest, { recursive: true });
        if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
        fs.renameSync(tmpDest, dest);
    } catch (err) {
        // Never leave staging debris behind on failure.
        try { fs.rmSync(tmpDest, { recursive: true, force: true }); } catch { /* best effort */ }
        throw err;
    }
}

/**
 * Recursion guard for dirsEqual (T-20260910-026): a symlinked directory cycle
 * (e.g. skills/a -> . -> skills/a) would otherwise recurse until the process
 * exhausts the stack. Skill trees are shallow; 64 levels is far beyond any
 * real layout and matches the cap used by the audit.ts tree walkers.
 */
const DIRS_EQUAL_MAX_DEPTH = 64;

/**
 * Recursively compares two directories (or files) for identical content.
 * Returns false if either path is missing, if the entry sets differ, or if
 * any file's content differs. Used to skip no-op copies (M3 idempotency).
 *
 * Symlinks are compared as symlinks (lstat, never followed): two links are
 * equal iff both sides link to the same target string. This keeps a cyclic
 * or dangling link from being dereferenced into infinite recursion or a
 * spurious content mismatch.
 */
export function dirsEqual(a: string, b: string, depth: number = 0): boolean {
    if (depth > DIRS_EQUAL_MAX_DEPTH) return false;
    if (!fs.existsSync(a) || !fs.existsSync(b)) return false;

    const statA = fs.lstatSync(a);
    const statB = fs.lstatSync(b);

    // Symlink vs symlink: equal iff identical target strings; symlink vs
    // anything else: not equal (copyDir will replace the target with real
    // content, so treating it as "already equal" would leak the link).
    if (statA.isSymbolicLink() || statB.isSymbolicLink()) {
        return statA.isSymbolicLink() && statB.isSymbolicLink()
            && fs.readlinkSync(a) === fs.readlinkSync(b);
    }

    if (statA.isDirectory() !== statB.isDirectory()) return false;

    if (statA.isDirectory()) {
        const entriesA = fs.readdirSync(a).sort();
        const entriesB = fs.readdirSync(b).sort();
        if (entriesA.length !== entriesB.length) return false;
        for (let i = 0; i < entriesA.length; i++) {
            if (entriesA[i] !== entriesB[i]) return false;
            if (!dirsEqual(path.join(a, entriesA[i]), path.join(b, entriesB[i]), depth + 1)) return false;
        }
        return true;
    }

    return fs.readFileSync(a).equals(fs.readFileSync(b));
}

/**
 * Runs the full skill distribution (Phase 1: SSOT -> platform dirs; Phase 2:
 * .agents/ shortcut skills back-synced to .claude/.gemini). Each skill/item
 * is wrapped independently in try/catch (M2): a failure on one item is
 * collected and reported, and does not abort processing of the rest.
 */
export async function syncSkills(dirs: SkillSyncDirs, opts: SyncSkillsOptions = {}): Promise<{ errors: string[]; warnings: string[] }> {
    const copyDir = opts.copyDir ?? defaultCopyDir;
    const { ssotSkills, claudeSkills, geminiSkills, agentsSkills, codexSkills } = dirs;
    const root = path.dirname(ssotSkills);

    fs.mkdirSync(claudeSkills, { recursive: true });
    fs.mkdirSync(geminiSkills, { recursive: true });
    fs.mkdirSync(agentsSkills, { recursive: true });
    fs.mkdirSync(codexSkills, { recursive: true });

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!fs.existsSync(ssotSkills)) {
        return { errors, warnings };
    }

    // --- Phase 2 pre-flight: SSOT-divergence visibility (T-20260912-017) ---
    // Premise fix: the old hardcoded SHORTCUT_SKILLS list ('sync', 'meeting',
    // 'source-command-commit-push-pr') claimed those items "only exist in
    // .agents/skills/ (not in SSOT)" — but 'sync' and 'source-command-commit-push-pr'
    // DO exist in the SSOT (skills/), and 'meeting' is stale (the SSOT skill is
    // meeting-facilitation; the `meeting` command is a commands mirror handled in
    // Phase 1). Because Phase 1 overwrites .agents/skills/<name> from the SSOT and
    // Phase 2 then back-synced those same names, any hand-edit in .agents was
    // silently clobbered and the clobbered copy propagated to .claude/.gemini.
    //
    // Semantics chosen:
    //   * The divergence scan runs BEFORE Phase 1 overwrites anything — comparing
    //     after Phase 1 could never fire, since SSOT and .agents are identical by
    //     then. A WARN here means a hand-edit exists that this run is about to
    //     overwrite with the SSOT copy (visible instead of silent).
    //   * Back-sync (Phase 2 proper, below) applies ONLY to genuinely .agents-only
    //     skill dirs (absent from the SSOT) — the mechanism is kept for such items,
    //     discovered dynamically instead of via a rotting hardcoded list.
    //   * This is a single-source-of-truth pipeline, not a merge tool — SSOT wins.
    if (fs.existsSync(agentsSkills)) {
        for (const item of fs.readdirSync(agentsSkills)) {
            try {
                const source = path.join(agentsSkills, item);
                if (!fs.statSync(source).isDirectory()) continue;
                const ssotCounterpart = path.join(ssotSkills, item);
                if (fs.existsSync(ssotCounterpart) && fs.statSync(ssotCounterpart).isDirectory()
                    && !dirsEqual(source, ssotCounterpart)) {
                    warnings.push(`shortcut ${item} in .agents/skills/ diverges from its SSOT counterpart (skills/${item}) — SSOT wins; hand-edits in .agents are overwritten by Phase 1`);
                    console.warn(`  ⚠️  Shortcut ${item} diverges from SSOT (skills/${item}) — SSOT wins, hand-edit overwritten`);
                }
            } catch (err) {
                const msg = (err instanceof Error) ? err.message : String(err);
                errors.push(`Phase 2 pre-flight: ${item}: ${msg}`);
                console.error(`  ❌ Error inspecting shortcut ${item}: ${msg}`);
            }
        }
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
            // .claude/skills/, .gemini/skills/, .agents/skills/, or .codex/skills/,
            // only skills/.
            if (/^security-gate:\s*true\b/m.test(fs.readFileSync(skillMdSrc, 'utf-8'))) {
                continue;
            }

            // `mirror: false` skills are agent-dispatched only (PM-gateway fleet
            // skills such as the domain planners) — they live in skills/ but are
            // never mirrored into the platform directories.
            if (/^mirror:\s*false\b/m.test(fs.readFileSync(skillMdSrc, 'utf-8'))) {
                continue;
            }

            for (const targetDir of [claudeSkills, geminiSkills, agentsSkills, codexSkills]) {
                const target = path.join(targetDir, item);
                if (dirsEqual(itemPath, target)) {
                    continue; // idempotent skip — content already matches
                }
                copyDir(itemPath, target);
                console.log(`  -> Synced ${item} to ${path.relative(root, targetDir)}/`);
            }

            // Special logic for commands derived from skills — workspace root ONLY.
            // Variant `.claude|gemini/commands/meeting.md` files are Fork-Model overlays
            // (e.g. co-safety's adjudicated divergence, T-20260910-022); regenerating them
            // from the variant's own meeting-facilitation SKILL.md would clobber the
            // adapted frontmatter (scope/audit_exception) that the variant registry
            // validates against.
            if (item === 'meeting-facilitation' && path.resolve(root) === workspaceRoot) {
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

    // --- Phase 1b: Mirror .claude/commands/*.md to .codex/prompts/ (ADR-0077 D4) ---
    // Codex consumes slash-style workflows as custom prompts. `.claude/commands/` is the
    // commands SSOT; this mirror is per-file idempotent. Project-level prompt support on
    // Codex is verified live in W5 — an unsupported result demotes this mirror to a
    // documented no-op rather than a silent gap.
    const claudeCmdSource = path.join(root, '.claude', 'commands');
    const codexPromptsDir = path.join(root, '.codex', 'prompts');
    if (fs.existsSync(claudeCmdSource)) {
        fs.mkdirSync(codexPromptsDir, { recursive: true });
        for (const cmdFile of fs.readdirSync(claudeCmdSource)) {
            try {
                if (!cmdFile.endsWith('.md')) continue;
                const src = path.join(claudeCmdSource, cmdFile);
                if (!fs.statSync(src).isFile()) continue;
                const dst = path.join(codexPromptsDir, cmdFile);
                if (dirsEqual(src, dst)) continue;
                fs.copyFileSync(src, dst);
                console.log(`  -> Mirrored command ${cmdFile} to .codex/prompts/`);
            } catch (err) {
                const msg = (err instanceof Error) ? err.message : String(err);
                errors.push(`Phase 1b: ${cmdFile}: ${msg}`);
                console.error(`  ❌ Error mirroring ${cmdFile}: ${msg}`);
            }
        }
    }

    // --- Phase 2: Back-sync genuinely .agents-only shortcuts (T-20260912-017) ---
    // Divergence visibility for .agents dirs that DO exist in the SSOT happened in
    // the pre-flight above (it must run before Phase 1 overwrites, or it could never
    // fire). Here only genuinely .agents-only skill dirs — absent from the SSOT —
    // are back-synced to .claude and .gemini, discovered dynamically instead of via
    // the old rotting SHORTCUT_SKILLS hardcoded list.
    if (fs.existsSync(agentsSkills)) {
        for (const item of fs.readdirSync(agentsSkills)) {
            try {
                const source = path.join(agentsSkills, item);
                if (!fs.statSync(source).isDirectory()) continue;
                const ssotCounterpart = path.join(ssotSkills, item);
                if (fs.existsSync(ssotCounterpart)) continue; // SSOT-derived — Phase 1 owns it

                // Genuinely .agents-only: back-sync to .claude and .gemini.
                if (!fs.existsSync(path.join(source, 'SKILL.md'))) continue;

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
    }

    return { errors, warnings };
}

// ── Concurrency guard (T-20260912-017) ────────────────────────────────────────
// Advisory lockfile preventing concurrent sync-skills runs from interleaving
// their staged-copy/rename sequences on the same platform directories (e.g. a
// manual `bun scripts/sync-skills.ts` racing the dev-sync step 4.6/4.52 pass).
// The lock lives at the workspace root (gitignored), records the owning PID and
// a timestamp, and is PID-validated: a lock whose owner is no longer alive
// (crashed run) is recovered instead of blocking all future runs — the same
// stale-lock pattern as .githooks/post-checkout. A second concurrent run fails
// fast with a clear message. CLI-only: the library entry (syncSkills) stays
// unguarded for testability.
const LOCK_FILE = path.join(workspaceRoot, '.sync-skills.lock');

function writeLock(): void {
    fs.writeFileSync(LOCK_FILE, `${process.pid}\n${new Date().toISOString()}\n`, { flag: 'wx' });
}

function pidAlive(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        // EPERM means the process exists but is owned by another user — alive.
        return (err as NodeJS.ErrnoException)?.code === 'EPERM';
    }
}

function installLockRelease(): void {
    const release = () => {
        try { fs.rmSync(LOCK_FILE, { force: true }); } catch { /* best effort */ }
    };
    process.on('exit', release);
    for (const sig of ['SIGINT', 'SIGTERM'] as const) {
        process.on(sig, () => {
            release();
            process.exit(1);
        });
    }
}

function acquireLock(): void {
    try {
        // 'wx' fails when the file already exists — the closest thing to an
        // atomic O_CREAT|O_EXCL lock without native modules.
        writeLock();
    } catch {
        // Lock present (or raced): validate the recorded owner before failing.
        let lockPid = NaN;
        try {
            lockPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf-8').split('\n')[0].trim(), 10);
        } catch { /* unreadable lock treated as stale below */ }

        if (Number.isInteger(lockPid) && lockPid !== process.pid && pidAlive(lockPid)) {
            console.error(`❌ Another sync-skills run appears active (pid ${lockPid}; lock: ${LOCK_FILE}).`);
            console.error('   Wait for it to finish, or remove the lock file if that process is gone.');
            process.exit(1);
        }
        // Stale (owner dead / unreadable / our own leftover) — recover and retry once.
        console.warn(`⚠️  Removing stale sync-skills lock (pid ${Number.isNaN(lockPid) ? 'unknown' : lockPid} is gone).`);
        try { fs.rmSync(LOCK_FILE, { force: true }); } catch { /* fall through to retry */ }
        try {
            writeLock();
        } catch {
            console.error(`❌ Could not acquire the sync-skills lock (${LOCK_FILE}) after stale-lock recovery — another run may be starting right now.`);
            process.exit(1);
        }
    }
    installLockRelease();
}

if (import.meta.main) {
    let targetRoots: string[];
    try {
        targetRoots = resolveTargetRoots();
    } catch (err) {
        console.error(`❌ ${(err instanceof Error) ? err.message : err}`);
        process.exit(1);
    }
    // Reject nonexistent targets BEFORE any writes (T-20260912-017): a typo'd
    // --dir path must not have its four platform directories created at the
    // wrong root as a side effect of running the sync.
    for (const root of targetRoots) {
        if (!fs.existsSync(root)) {
            console.error(`❌ Target root does not exist: ${root}`);
            process.exit(1);
        }
    }

    acquireLock();

    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    for (const root of targetRoots) {
        const dirs = dirsFor(root);
        console.log(`Syncing skills from SSOT (${dirs.ssotSkills})...`);
        const { errors, warnings } = await syncSkills(dirs);
        allErrors.push(...errors);
        allWarnings.push(...warnings);
    }

    if (allWarnings.length > 0) {
        console.warn(`\n⚠️  ${allWarnings.length} divergence warning(s):`);
        for (const w of allWarnings) console.warn(`  - ${w}`);
    }

    if (allErrors.length > 0) {
        console.error(`\n❌ ${allErrors.length} error(s) during skill synchronization:`);
        for (const e of allErrors) console.error(`  - ${e}`);
        process.exitCode = 1;
    }

    console.log('Skill synchronization complete!');
}
