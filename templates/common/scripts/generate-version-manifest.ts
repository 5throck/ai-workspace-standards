// @version 1.8.0
// v1.8.0 (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md,
//           site 10 / D10): skills platform vocabulary extended to the four
//           mirror era — 'both' keeps meaning claude+gemini exactly (legacy,
//           test-pinned), 'all' means all four mirrors, any other partial
//           combination renders as '+'.joined descending platform names,
//           single-platform presence renders the platform name (agents/codex
//           joined the vocabulary). Command platform gains 'all' when the codex
//           prompts mapping carries the command (ADR-0077 D4). Platform Parity
//           Status section names all four surfaces with per-surface counts.
// v1.7.1: scripts-table sort gained a full-path tiebreaker — basename ties
//           (e.g. scripts/x.ts vs scripts/<variant>/x.ts) previously fell back
//           to readdir insertion order, which differs between macOS and Linux,
//           so the committed manifest and CI's regeneration ordered the tied
//           rows differently and the drift gate failed spuriously.
// v1.7.0 (ADR-0081 / T-20260918-001): --check masks the "Last Modified" columns
//           on BOTH comparison sides unconditionally — the shallow-only gating
//           is gone. Rationale: the cells derive from committed `git log`, but
//           dev-sync generates the manifest (step 4.7) before committing
//           (step 6), so the committed manifest always records the PRE-PR date
//           for every file the PR touches; a full-history CI merge preview then
//           regenerates with the PR commit as last toucher and the date cells
//           drift by one commit whenever the previous toucher predates the PR's
//           day (observed: PR #954 first CI run failed on "1 differing line";
//           recovery needed the eb6901ab convergence commit). Structural rows
//           (name/file/tier/model/version/location/triggers) are still compared
//           literally; published dates remain as informational content.
//           isShallowRepository() is retained (exported, unit-pinned) for
//           potential date-source work but is no longer consulted by --check.
// v1.6.0 (T-20260916-013): shallow-tolerant --check. In a shallow checkout
// v1.6.1 (T-20260917-review): parseAgentFrontmatter normalizes CRLF before tier/model regexes; on Windows working trees the nested `tier:` block parsed as tier=N/A and regenerated a drifting manifest. parseAgentFrontmatter is now exported for CRLF unit coverage.
//           (actions/checkout default depth=1) `git log` has no history, so the
//           per-file "Last Modified" dates fall back to checkout-time values and
//           the committed manifest (generated locally with full history) then
//           PERMANENTLY drifts against CI regeneration, failing the gate no
//           matter what is committed (real case: co-safety Documentation Audit
//           job — its ci.yml was fixed with fetch-depth: 0 during the fleet
//           resync, PR #149). The comparator now detects a shallow repository
//           (`git rev-parse --is-shallow-repository`) and switches to
//           ignoreDateColumns mode: the volatile "Last Modified" cell (column
//           index derived from each table's header row, never a hard-coded
//           position) is masked on BOTH sides, so structural drift (rows
//           added/removed, name/version/path changes) is still caught while the
//           git-depth-dependent dates are ignored. Full-history behavior is
//           byte-identical to v1.5.0 (dates compared). The audit.ts gate spawns
//           `--check` and inherits the fix with no changes of its own.
// v1.5.0 (T-20260915-004, finding M7): (a) scripts/experiments/** is excluded
//           from the CLI script collection (count AND table) — experiment files
//           without a CLI surface previously inflated the Scripts count (93 vs
//           real 92). (b) New `--check` mode: regenerates the manifest in memory
//           and compares it against docs/VERSION_MANIFEST.md on disk (exit 0 on
//           match, exit 1 with a concise line diff on drift). The generation
//           timestamp line (`**Generated**: ...`) is normalized on both sides so
//           the comparison is deterministic. Contexts without a committed
//           manifest self-skip (exit 0), mirroring the ADR-0073 Amendment 1
//           self-skip pattern.
// v1.4.1 (previous)
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { $ } from 'bun';
import * as yaml from 'js-yaml';

const MANIFEST_PATH = path.join('docs', 'VERSION_MANIFEST.md');
const MANIFEST_VERSION = '1.0';

const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

export interface AgentInfo {
    name: string;
    file: string;
    tier: string;
    model: string;
    last_modified: string;
}

export interface SkillInfo {
    name: string;
    version: string;
    location: string;
    platform: string;
    triggers: string[];
    owner: string;
    status?: string;
    parseError?: string;
}

export interface ScriptInfo {
    name: string;
    version: string;
    location: string;
    dependencies: string[];
}

export interface CommandInfo {
    name: string;
    file: string;
    platform: string;
    skill_integration: string;
}

async function getGitTimestamp(filePath: string): Promise<string> {
    try {
        const { stdout } = await $`git log -1 --format=%ct ${filePath}`.quiet().nothrow();
        if (!stdout.toString().trim()) return 'N/A';
        const timestamp = parseInt(stdout.toString().trim(), 10);
        return new Date(timestamp * 1000).toISOString().split('T')[0];
    } catch { return 'N/A'; }
}

/**
 * Shallow-repository detection (T-20260916-013): `git rev-parse
 * --is-shallow-repository` prints "true" for a shallow clone (actions/checkout
 * default depth=1) and "false" for a full one. Anything else — non-zero exit,
 * empty/unexpected output, git missing (spawnSync throws → caught) — is treated
 * as a FULL repository so behavior stays byte-identical to v1.5.0.
 */
export function isShallowRepository(): boolean {
    try {
        const { status, stdout } = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
            encoding: 'utf-8',
        });
        return status === 0 && stdout.trim() === 'true';
    } catch {
        return false;
    }
}

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

/**
 * Trim a YAML scalar and drop a trailing `# comment` (T-20260910-028): the
 * manifest previously leaked inline comments straight into the Tier/Model
 * columns. A `#` only opens a comment when preceded by whitespace (YAML rule),
 * so `a#b`-style values are left intact.
 */
function scalarValue(raw: string): string {
    const hash = raw.indexOf(' #');
    return (hash === -1 ? raw : raw.slice(0, hash)).trim().replace(/\s+/g, ' ');
}

export function parseAgentFrontmatter(content: string): { tier?: string; model?: string } {
    // Normalize CRLF first (T-20260917-review): on Windows working trees the
    // nested `tier:` block is `tier:\r\n  claude: ...` and a bare `\n` in the
    // regex silently parsed tier as 'N/A', regenerating a drifting manifest.
    const normalized = content.replace(/\r\n/g, '\n');
    const tierMatch = /^tier:[ \t]*\n[ \t]+claude:[ \t]+(.+)$/m.exec(normalized);
    const modelMatch = /^model:[ \t]+(.+)$/m.exec(normalized);
    return {
        tier: tierMatch ? scalarValue(tierMatch[1]) : 'N/A',
        model: modelMatch ? scalarValue(modelMatch[1]) : 'N/A',
    };
}

function extractFrontmatterBlock(content: string): string | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    return match ? match[1] : null;
}

export function parseSkillFrontmatter(content: string): { version?: string; triggers?: string[]; owner?: string; status?: string; parseError?: string } {
    const block = extractFrontmatterBlock(content);
    if (!block) {
        return { parseError: 'No YAML frontmatter block found' };
    }

    let doc: any;
    try {
        doc = yaml.load(block);
    } catch (err) {
        return { parseError: err instanceof Error ? err.message : String(err) };
    }

    if (!doc || typeof doc !== 'object') {
        return { parseError: 'Frontmatter did not parse to an object' };
    }

    const rawTriggers = doc.metadata?.triggers ?? doc.triggers;
    const triggers = Array.isArray(rawTriggers)
        ? rawTriggers.map((t: unknown) => String(t).trim()).filter(Boolean)
        : [];

    return {
        version: doc.version !== undefined ? String(doc.version).trim() : undefined,
        triggers,
        owner: doc.owner !== undefined ? String(doc.owner).trim() : undefined,
        status: doc.status !== undefined ? String(doc.status).trim() : undefined,
    };
}

function extractScriptVersion(content: string): string {
    // Match single-line comment style: // @version X.Y.Z
    const singleLineMatch = /^\/\/ @version\s*([\d.]+)$/m.exec(content);
    if (singleLineMatch) return singleLineMatch[1].trim();
    // Match JSDoc style:  * @version X.Y.Z
    const jsdocMatch = /^\s*\*\s*@version\s+([\d.]+)/m.exec(content);
    if (jsdocMatch) return jsdocMatch[1].trim();
    // Match inline block comments and same-line metadata containing @version.
    const inlineMatch = /@version\s+([\d.]+)/m.exec(content);
    if (inlineMatch) return inlineMatch[1].trim();
    return 'N/A';
}

function extractScriptDependencies(content: string): string[] {
    const deps = new Set<string>();
    const bunImport = /^\$\s*from\s*'bun'$/m.exec(content);
    if (bunImport) deps.add('bun');

    const nodeImports = content.match(/^import \* from ['"]node:(\w+)['"]/gm) || [];
    for (const imp of nodeImports) {
        const match = /^import \* from ['"]node:(\w+)['"]/.exec(imp);
        if (match) deps.add(match[1]);
    }

    const externalImports = content.match(/^import .+ from ['"](?!(node:|\.))[^'"]+['"]/gm) || [];
    for (const imp of externalImports) {
        const match = /^import .+ from ['"](@?[^'"]+)['"]/.exec(imp);
        if (match) deps.add(match[1].split('/')[0]);
    }

    return Array.from(deps).sort();
}

// Simple, single-action commands with no orchestration logic — intentionally
// have no dedicated SKILL.md. See detectDrift() for rationale.
// commit-push-pr: pure redirect stub to /sync (workspace enforcement banner);
// flagged as drift in variants that lack the source-command-<name> alias skill
// (fixed at L0 because core scripts are immutable at L2/L3).
const COMMAND_SKILL_EXEMPT = new Set(['changelog', 'meeting', 'memlog', 'new-task', 'commit-push-pr']);
const SKILL_METADATA_EXEMPT = new Set([
    // ADR-0076 / 2026-09-12 graft wiring refresh: tool-owned Claude-only skill
    // with canonical graft frontmatter; workspace lifecycle fields are not
    // reattached because graft rewrites this file on version bumps.
    'graft',
]);

function hasGeminiParitySkip(content: string): boolean {
    return /^gemini-parity:\s*skip/m.test(content);
}


async function collectAgents(): Promise<AgentInfo[]> {
    const agents: AgentInfo[] = [];
    const agentsDir = 'agents';
    if (!fs.existsSync(agentsDir)) return agents;

    for (const file of fs.readdirSync(agentsDir)) {
        if (!file.endsWith('.md') || file === '_COMMON.md' || file === 'README.md') continue;
        const filePath = path.join(agentsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const { tier, model } = parseAgentFrontmatter(content);
        const lastModified = await getGitTimestamp(filePath);
        agents.push({
            name: path.basename(file, '.md'),
            file: normalizePath(filePath),
            tier: tier || 'N/A',
            model: model || 'N/A',
            last_modified: lastModified,
        });
    }
    return agents.sort((a, b) => a.name.localeCompare(b.name));
}

// Priority order matches AGENTS.md §6 Skill Resolution Priority: workspace-level
// skills/ is the SSOT; .claude/skills/ carries platform-specific-only skills.
// Each unique skill name is reported exactly once (fixes duplicate drift-issue
// reporting that previously emitted one row/issue per distribution copy).
const SKILL_SCAN_DIRS = ['skills', path.join('.claude', 'skills'), path.join('templates', 'common', 'skills')];

/**
 * Derive the skills-table `platform` vocabulary for one skill (D10):
 *   'workspace' — present in the skills/ SSOT (highest priority, unchanged)
 *   'common'    — common-template scan context without an SSOT copy (unchanged)
 *   'both'      — claude+gemini mirrors exactly (LEGACY value, test-pinned)
 *   'all'       — all four mirrors carry the skill
 *   <name>      — exactly one mirror carries it ('claude' | 'gemini' | 'agents' | 'codex')
 *   n+m         — any other partial combination, '+'.joined in DESCENDING
 *                 platform-name order (e.g. claude+codex → 'codex+claude')
 * @version 1.8.0
 */
export function deriveSkillsPlatform(opts: {
    inWorkspace: boolean;
    inCommonTemplate: boolean;
    mirrors: { claude: boolean; gemini: boolean; agents: boolean; codex: boolean };
}): string {
    if (opts.inWorkspace) return 'workspace';
    if (opts.inCommonTemplate) return 'common';
    const present = (Object.entries(opts.mirrors) as Array<[string, boolean]>)
        .filter(([, v]) => v)
        .map(([k]) => k);
    if (present.length === 0) return 'workspace';
    if (present.length === 4) return 'all';
    if (present.length === 2 && present.includes('claude') && present.includes('gemini')) return 'both';
    if (present.length === 1) return present[0];
    return [...present].sort((a, b) => b.localeCompare(a)).join('+');
}

/**
 * Derive the commands-table `platform` vocabulary for one command (D10):
 * 'claude' (no mirror carries it) | 'both' (gemini 1:1 mirror, legacy value) |
 * 'all' (gemini mirror AND the codex prompts mapping both carry it).
 * @version 1.8.0
 */
export function deriveCommandPlatform(hasGemini: boolean, hasCodexPrompt: boolean): string {
    if (hasGemini && hasCodexPrompt) return 'all';
    if (hasGemini) return 'both';
    return 'claude';
}

async function collectSkills(): Promise<SkillInfo[]> {
    const seen = new Map<string, SkillInfo>();

    for (const skillsDir of SKILL_SCAN_DIRS) {
        if (!fs.existsSync(skillsDir)) continue;
        for (const dir of fs.readdirSync(skillsDir)) {
            if (seen.has(dir)) continue; // already recorded from a higher-priority dir
            const skillPath = path.join(skillsDir, dir);
            if (!fs.statSync(skillPath).isDirectory()) continue;
            const skillMd = path.join(skillPath, 'SKILL.md');
            if (!fs.existsSync(skillMd)) continue;

            const content = fs.readFileSync(skillMd, 'utf-8');
            const { version, triggers, owner, status, parseError } = parseSkillFrontmatter(content);

            const inWorkspace = fs.existsSync(path.join('skills', dir, 'SKILL.md'));
            const mirrors = {
                claude: fs.existsSync(path.join('.claude', 'skills', dir, 'SKILL.md')),
                gemini: fs.existsSync(path.join('.gemini', 'skills', dir, 'SKILL.md')),
                agents: fs.existsSync(path.join('.agents', 'skills', dir, 'SKILL.md')),
                codex: fs.existsSync(path.join('.codex', 'skills', dir, 'SKILL.md')),
            };
            const inCommonTemplate = skillsDir.startsWith(path.join('templates', 'common'));

            const platform = deriveSkillsPlatform({ inWorkspace, inCommonTemplate, mirrors });

            seen.set(dir, {
                name: dir,
                version: version || 'N/A',
                location: normalizePath(skillMd),
                platform,
                triggers: triggers || [],
                owner: owner || 'N/A',
                status,
                parseError,
            });
        }
    }
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function collectScripts(): Promise<ScriptInfo[]> {
    const scripts: ScriptInfo[] = [];
    const scriptsDir = 'scripts';
    if (!fs.existsSync(scriptsDir)) return scripts;

    // Subdirectories excluded from the CLI script collection. Library/helper
    // modules (helpers, lib, validators, hooks) are not standalone executable
    // scripts. scripts/experiments/** holds CLI-less experiment files (T-20260915-004,
    // finding M7) that previously inflated the Scripts count (93 vs real 92).
    // None of these appear in the manifest count or table — scripts/SCRIPTS.md is
    // the full registry.
    const EXCLUDED_SUBDIRS = new Set(['helpers', 'lib', 'validators', 'hooks', 'experiments']);

    function walkDir(dir: string, callback: (filePath: string) => void) {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                // Skip excluded subdirectories — their modules are not standalone CLI scripts
                if (EXCLUDED_SUBDIRS.has(item)) continue;
                walkDir(itemPath, callback);
            } else if (item.endsWith('.ts')) {
                callback(itemPath);
            }
        }
    }

    walkDir(scriptsDir, (filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        scripts.push({
            name: path.basename(filePath),
            version: extractScriptVersion(content),
            location: normalizePath(filePath),
            dependencies: extractScriptDependencies(content),
        });
    });
    return scripts.sort((a, b) => a.name.localeCompare(b.name) || a.location.localeCompare(b.location));
}

async function collectCommands(): Promise<CommandInfo[]> {
    const commands: CommandInfo[] = [];
    const commandsDir = path.join('.claude', 'commands');
    if (!fs.existsSync(commandsDir)) return commands;

    for (const file of fs.readdirSync(commandsDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(commandsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const geminiCmd = path.join('.gemini', 'commands', file);
        const hasGemini = fs.existsSync(geminiCmd);
        // Codex consumes .claude/commands as .codex/prompts (ADR-0077 D4 mapping)
        const codexPrompt = path.join('.codex', 'prompts', file);
        const hasCodexPrompt = fs.existsSync(codexPrompt);

        const platform = deriveCommandPlatform(hasGemini, hasCodexPrompt);

        const skillMatch = /^>.*?Skill:\s*(.+?)$/m.exec(content);
        commands.push({
            name: file.replace('.md', ''),
            file: normalizePath(filePath),
            platform,
            skill_integration: skillMatch ? skillMatch[1].trim() : 'N/A',
        });
    }
    return commands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Detects drift issues, each prefixed with a severity level:
 * - [ERROR]: data is unrecoverable (e.g. frontmatter failed to parse) — a
 *   future CI gate can fail the build on ERROR-level drift.
 * - [WARNING]: data parsed successfully but a field is incomplete (e.g. no
 *   triggers defined) — informational, not build-blocking.
 * Issues are deduplicated by their exact text (dedup of skill-name based
 * checks is already guaranteed upstream by collectSkills() returning one
 * entry per unique skill name).
 */
export function detectDrift(agents: AgentInfo[], skills: SkillInfo[], commands: CommandInfo[]): string[] {
    const issues = new Set<string>();

    // Check for agents without tier/model metadata
    for (const agent of agents) {
        if (agent.tier === 'N/A' || agent.model === 'N/A') {
            issues.add(`[WARNING] Agent ${agent.name} missing tier or model metadata`);
        }
    }

    // Check for skills with unparseable frontmatter or incomplete metadata
    for (const skill of skills) {
        if (SKILL_METADATA_EXEMPT.has(skill.name)) continue;
        if (skill.parseError) {
            issues.add(`[ERROR] Skill ${skill.name} frontmatter YAML parse error: ${skill.parseError}`);
            continue; // version/triggers are unreliable if frontmatter didn't parse
        }
        if (skill.version === 'N/A') {
            issues.add(`[WARNING] Skill ${skill.name} missing version`);
        }
        if (skill.triggers.length === 0) {
            issues.add(`[WARNING] Skill ${skill.name} has no triggers defined`);
        }
    }

    // Check for command-skill integration drift. Per CLAUDE.md §2, every
    // .claude/commands/<name>.md file is automatically registered as a
    // <name> Skill — so integration is verified by name match against the
    // collected skills list, not by an in-file "> Skill: ..." annotation
    // (no command file in this repo uses that annotation format, which made
    // the previous check a permanent false positive for every command).
    // Migrated Antigravity source commands are registered under a
    // `source-command-<name>` skill directory (see .claude/skills/source-command-commit-push-pr) —
    // that alias also counts as integrated.
    // COMMAND_SKILL_EXEMPT lists commands that are intentionally simple,
    // single-action helpers (memory-log append, single changelog edit, task
    // creation) with no orchestration logic — they don't warrant a dedicated
    // SKILL.md, so their lack of a matching skill is an accepted state, not
    // drift, and is excluded from the report rather than re-flagged every run.
    const skillNames = new Set(skills.map(s => s.name));
    for (const cmd of commands) {
        if (COMMAND_SKILL_EXEMPT.has(cmd.name)) continue;
        const integrated = skillNames.has(cmd.name) || skillNames.has(`source-command-${cmd.name}`);
        if (!integrated) {
            issues.add(`[WARNING] Command ${cmd.name} has no matching skill of the same name`);
        }
    }

    return Array.from(issues);
}

interface ManifestData {
    agents: AgentInfo[];
    skills: SkillInfo[];
    scripts: ScriptInfo[];
    commands: CommandInfo[];
    driftIssues: string[];
}

async function collectManifestData(): Promise<ManifestData> {
    const [agents, skills, scripts, commands] = await Promise.all([
        collectAgents(),
        collectSkills(),
        collectScripts(),
        collectCommands(),
    ]);
    return { agents, skills, scripts, commands, driftIssues: detectDrift(agents, skills, commands) };
}

// The only nondeterministic content in the rendered manifest is the generation
// timestamp. `--check` normalizes that one line on BOTH sides so the comparison
// is deterministic (T-20260915-004). In shallow mode the volatile "Last
// Modified" date cells are masked on BOTH sides too (T-20260916-013).
const GENERATED_LINE_RE = /^\*\*Generated\*\*: .*$/;

export function normalizeManifestForCompare(content: string): string {
    return content
        .split('\n')
        .map(line => (GENERATED_LINE_RE.test(line) ? '**Generated**: <timestamp>' : line))
        .join('\n');
}

// ── Date-column masking (T-20260916-013) ─────────────────────────────────────
// The per-row "Last Modified" value is derived from `git log`, which is
// environment-dependent in a shallow clone (checkout-time fallback / N/A).
// Masking is header-derived, never positional: for every markdown table, the
// header row is scanned for a cell whose text is exactly "Last Modified"
// (case-insensitive) and only that column's DATA cells are replaced. Tables
// without such a header are returned untouched, so adding a date column to
// another table later needs no comparator change.

const DATE_COLUMN_HEADER_RE = /^last modified$/i;
const MASKED_DATE_CELL = '<date>';

/** Split a markdown table row into trimmed cells; null when not a table row. */
function splitTableRow(line: string): string[] | null {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
    return trimmed.slice(1, -1).split('|').map(cell => cell.trim());
}

function isTableSeparatorRow(cells: string[]): boolean {
    return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell));
}

/**
 * Replace every "Last Modified" DATA cell with a constant placeholder. The
 * column index comes from the current table's header row (first row of each
 * contiguous table block); header and separator rows are never masked.
 */
export function maskDateColumns(content: string): string {
    let dateColumnIndex = -1;
    let sawHeader = false;
    return content
        .split('\n')
        .map(line => {
            const cells = splitTableRow(line);
            if (!cells) {
                // Blank line / heading / prose: the current table block ends.
                dateColumnIndex = -1;
                sawHeader = false;
                return line;
            }
            if (!sawHeader) {
                sawHeader = true;
                dateColumnIndex = cells.findIndex(cell => DATE_COLUMN_HEADER_RE.test(cell));
                return line;
            }
            if (isTableSeparatorRow(cells)) return line;
            if (dateColumnIndex >= 0 && cells.length > dateColumnIndex) {
                cells[dateColumnIndex] = MASKED_DATE_CELL;
                return `| ${cells.join(' | ')} |`;
            }
            return line;
        })
        .join('\n');
}

export interface ManifestLineDiff {
    line: number;
    onDisk: string;
    regenerated: string;
}

export interface DiffManifestsOptions {
    /**
     * Date-masked mode (default behavior of --check since ADR-0081 /
     * T-20260918-001): mask the volatile "Last Modified" cells on BOTH sides
     * before comparing, so the git-log-derived dates — which always lag the
     * generating PR's own commit by one commit — are ignored while structural
     * drift (rows added/removed, name/version/path changes) is still caught.
     * Default false at the function level (raw comparison remains available
     * for tests); checkManifest() always passes true.
     */
    ignoreDateColumns?: boolean;
    /** Max reported diffs (default 20). */
    limit?: number;
}

/**
 * Line-wise comparison of the on-disk manifest against a fresh regeneration
 * (both timestamp-normalized; date columns additionally masked on both sides in
 * ignoreDateColumns mode). Line-wise — not LCS — is deliberate: manifest
 * drift is overwhelmingly in-place cell changes (version bumps, counts), and a
 * shifted insertion shows up as the shifted region, which is still actionable.
 * Output is capped at `limit` diffs to keep gate output concise.
 */
export function diffManifests(onDisk: string, regenerated: string, options: DiffManifestsOptions = {}): ManifestLineDiff[] {
    const limit = options.limit ?? 20;
    const prepare = (content: string): string[] => {
        const normalized = normalizeManifestForCompare(content);
        return (options.ignoreDateColumns ? maskDateColumns(normalized) : normalized).split('\n');
    };
    const diskLines = prepare(onDisk);
    const regenLines = prepare(regenerated);
    const diffs: ManifestLineDiff[] = [];
    const max = Math.max(diskLines.length, regenLines.length);
    for (let i = 0; i < max && diffs.length < limit; i++) {
        if (diskLines[i] !== regenLines[i]) {
            diffs.push({ line: i + 1, onDisk: diskLines[i] ?? '<missing>', regenerated: regenLines[i] ?? '<missing>' });
        }
    }
    return diffs;
}

function renderManifest(data: ManifestData): string {
    const { agents, skills, scripts, commands, driftIssues } = data;

    let markdown = `# VERSION_MANIFEST.md

**Generated**: ${new Date().toISOString()}
**Manifest Version**: ${MANIFEST_VERSION}
**Location**: ${normalizePath(MANIFEST_PATH)}

---

## Summary

- **Agents**: ${agents.length}
- **Skills**: ${skills.length}
- **Scripts**: ${scripts.length} *(top-level CLI scripts; library/helper modules under \`scripts/lib/\`, \`scripts/helpers/\`, \`scripts/hooks/\`, and \`scripts/validators/\` plus experiment files under \`scripts/experiments/\` are excluded here — \`scripts/SCRIPTS.md\` is the full registry)*
- **Commands**: ${commands.length}

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
`;

    for (const agent of agents) {
        markdown += `| ${agent.name} | ${normalizePath(agent.file)} | ${agent.tier} | ${agent.model} | ${agent.last_modified} |\n`;
    }

    markdown += `
---

<!-- validate-md-language:allowlist-begin reason="Triggers column embeds verbatim Korean search keywords copied from k-* SKILL.md frontmatter (proper-noun data values, not prose). Generated region — a whole-file lang: ko exception would be dishonest and would un-validate the rest of the manifest, so scripts/validate-md-language.ts exempts only this marked section (T-20260912-015)." -->
## Skills

| Name | Version | Status | Location | Platform | Triggers | Owner |
|------|---------|--------|----------|----------|----------|-------|
`;

    for (const skill of skills) {
        markdown += `| ${skill.name} | ${skill.version} | ${skill.status || 'active'} | ${normalizePath(skill.location)} | ${skill.platform} | ${skill.triggers.join(', ') || 'N/A'} | ${skill.owner} |\n`;
    }

    markdown += `
<!-- validate-md-language:allowlist-end -->

---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
`;

    for (const script of scripts) {
        markdown += `| ${script.name} | ${script.version} | ${normalizePath(script.location)} | ${script.dependencies.join(', ') || 'N/A'} |\n`;
    }

    markdown += `
---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
`;

    for (const cmd of commands) {
        markdown += `| ${cmd.name} | ${normalizePath(cmd.file)} | ${cmd.platform} | ${cmd.skill_integration} |\n`;
    }

    markdown += `
---

## Platform Parity Status

**Checked**: Claude (.claude/), Gemini (.gemini/), Antigravity (.agents/), Codex (.codex/ prompts mapping)

- **Commands with parity (gemini mirror)**: ${commands.filter(c => c.platform === 'both' || c.platform === 'all').length} / ${commands.length}
- **Commands with codex prompts mapping**: ${commands.filter(c => c.platform === 'all').length} / ${commands.length}
- **Skills in all four mirrors**: ${skills.filter(s => s.platform === 'all').length} / ${skills.filter(s => s.platform !== 'common').length}
- **Skills in claude+gemini only (both)**: ${skills.filter(s => s.platform === 'both').length} / ${skills.filter(s => s.platform !== 'common').length} (common-template skills are parity-exempt)

---

## Drift Detection
`;

    if (driftIssues.length === 0) {
        markdown += `
✅ No drift detected. All components are properly versioned and integrated.
`;
    } else {
        markdown += `
⚠️ **Drift detected**:

`;
        for (const issue of driftIssues) {
            markdown += `- ${issue}\n`;
        }
    }

    return markdown;
}

async function generateManifest() {
    console.log(`${CYAN}Collecting workspace data...${RESET}`);
    const data = await collectManifestData();

    // Ensure docs directory exists
    const docsDir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write manifest
    fs.writeFileSync(MANIFEST_PATH, renderManifest(data), 'utf-8');
    console.log(`${GREEN}✓ Manifest generated: ${MANIFEST_PATH}${RESET}`);
    console.log(`${GREEN}✓ ${data.agents.length} agents, ${data.skills.length} skills, ${data.scripts.length} scripts, ${data.commands.length} commands${RESET}`);
    if (data.driftIssues.length > 0) {
        console.log(`${CYAN}⚠ ${data.driftIssues.length} drift issues detected${RESET}`);
    }
}

// --check reconciliation gate (T-20260915-004): regenerate the manifest in
// memory and compare against the committed docs/VERSION_MANIFEST.md. Exit 0 on
// match (or self-skip when this context carries no committed manifest —
// mirroring the ADR-0073 Amendment 1 self-skip pattern), exit 1 with a concise
// diff list on drift. audit.ts auto-activates this gate in the same style as
// the skill-graph drift gate (ADR-0060).
async function checkManifest(): Promise<void> {
    if (!fs.existsSync(MANIFEST_PATH)) {
        console.log(`${CYAN}VERSION_MANIFEST check: ${MANIFEST_PATH} not present in this context — skipping (exit 0)${RESET}`);
        return;
    }
    const data = await collectManifestData();
    const regenerated = renderManifest(data);
    const onDisk = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    // Date-column masking (ADR-0081 / T-20260918-001): the "Last Modified"
    // cells derive from committed `git log`, but the manifest is generated
    // BEFORE the commit that touches these files (dev-sync step 4.7 vs 6), so
    // the recorded dates always lag the PR's own commit by one commit and
    // drift on CI merge previews across day boundaries. The comparison drops
    // the date columns (masked on BOTH sides) unconditionally and verifies
    // structural content only; published dates remain informational.
    console.log(`ℹ️ Last Modified columns excluded from comparison (informational; ADR-0081/T-20260918-001)`);
    const diffs = diffManifests(onDisk, regenerated, { ignoreDateColumns: true });
    if (diffs.length === 0) {
        console.log(`${GREEN}✓ VERSION_MANIFEST check: ${MANIFEST_PATH} matches the regenerated output${RESET}`);
        return;
    }
    const truncated = diffs.length >= 20;
    console.error(`${RED}✗ VERSION_MANIFEST drift: ${MANIFEST_PATH} is stale (${truncated ? '20+' : diffs.length} differing line(s)) — run bun scripts/generate-version-manifest.ts, review, and commit${RESET}`);
    for (const d of diffs.slice(0, 10)) {
        console.error(`  line ${d.line}:`);
        console.error(`    disk: ${d.onDisk.slice(0, 160)}`);
        console.error(`    regen: ${d.regenerated.slice(0, 160)}`);
    }
    process.exit(1);
}

if (import.meta.main) {
    if (process.argv.slice(2).includes('--check')) {
        checkManifest().catch(err => {
            console.error(err);
            process.exit(1);
        });
    } else {
        generateManifest().catch(console.error);
    }
}
