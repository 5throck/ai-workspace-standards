// @version 1.1.0
import * as fs from 'node:fs';
import * as path from 'node:path';
import { $ } from 'bun';
import * as yaml from 'js-yaml';

const MANIFEST_PATH = path.join('docs', 'VERSION_MANIFEST.md');
const MANIFEST_VERSION = '1.0';

const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
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

function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

function parseAgentFrontmatter(content: string): { tier?: string; model?: string } {
    const tierMatch = /^tier:[ \t]*\n[ \t]+claude:[ \t]+(.+)$/m.exec(content);
    const modelMatch = /^model:[ \t]+(.+)$/m.exec(content);
    return {
        tier: tierMatch ? tierMatch[1].trim() : 'N/A',
        model: modelMatch ? modelMatch[1].trim() : 'N/A',
    };
}

function extractFrontmatterBlock(content: string): string | null {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    return match ? match[1] : null;
}

export function parseSkillFrontmatter(content: string): { version?: string; triggers?: string[]; owner?: string; parseError?: string } {
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
    };
}

function extractScriptVersion(content: string): string {
    // Match single-line comment style: // @version X.Y.Z
    const singleLineMatch = /^\/\/ @version\s*([\d.]+)$/m.exec(content);
    if (singleLineMatch) return singleLineMatch[1].trim();
    // Match JSDoc style:  * @version X.Y.Z
    const jsdocMatch = /^\s*\*\s*@version\s+([\d.]+)/m.exec(content);
    if (jsdocMatch) return jsdocMatch[1].trim();
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
const COMMAND_SKILL_EXEMPT = new Set(['changelog', 'memlog', 'new-task']);

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
const SKILL_SCAN_DIRS = ['skills', path.join('.claude', 'skills')];

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
            const { version, triggers, owner, parseError } = parseSkillFrontmatter(content);

            const inWorkspace = fs.existsSync(path.join('skills', dir, 'SKILL.md'));
            const inClaude = fs.existsSync(path.join('.claude', 'skills', dir, 'SKILL.md'));
            const inGemini = fs.existsSync(path.join('.gemini', 'skills', dir, 'SKILL.md'));

            let platform = 'workspace';
            if (!inWorkspace && inClaude && inGemini) platform = 'both';
            else if (!inWorkspace && inClaude) platform = 'claude';

            seen.set(dir, {
                name: dir,
                version: version || 'N/A',
                location: normalizePath(skillMd),
                platform,
                triggers: triggers || [],
                owner: owner || 'N/A',
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

    function walkDir(dir: string, callback: (filePath: string) => void) {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
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
    return scripts.sort((a, b) => a.name.localeCompare(b.name));
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

        let platform = 'claude';
        if (hasGemini) platform = 'both';

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

async function generateManifest() {
    console.log(`${CYAN}Collecting workspace data...${RESET}`);

    const [agents, skills, scripts, commands] = await Promise.all([
        collectAgents(),
        collectSkills(),
        collectScripts(),
        collectCommands(),
    ]);

    const driftIssues = detectDrift(agents, skills, commands);

    let markdown = `# VERSION_MANIFEST.md

**Generated**: ${new Date().toISOString()}
**Manifest Version**: ${MANIFEST_VERSION}
**Location**: ${MANIFEST_PATH}

---

## Summary

- **Agents**: ${agents.length}
- **Skills**: ${skills.length}
- **Scripts**: ${scripts.length}
- **Commands**: ${commands.length}

---

## Agents

| Name | File | Tier | Model | Last Modified |
|------|------|------|-------|---------------|
`;

    for (const agent of agents) {
        markdown += `| ${agent.name} | ${agent.file} | ${agent.tier} | ${agent.model} | ${agent.last_modified} |\n`;
    }

    markdown += `
---

## Skills

| Name | Version | Location | Platform | Triggers | Owner |
|------|---------|----------|----------|----------|-------|
`;

    for (const skill of skills) {
        markdown += `| ${skill.name} | ${skill.version} | ${skill.location} | ${skill.platform} | ${skill.triggers.join(', ') || 'N/A'} | ${skill.owner} |\n`;
    }

    markdown += `
---

## Scripts

| Name | Version | Location | Dependencies |
|------|---------|----------|--------------|
`;

    for (const script of scripts) {
        markdown += `| ${script.name} | ${script.version} | ${script.location} | ${script.dependencies.join(', ') || 'N/A'} |\n`;
    }

    markdown += `
---

## Commands

| Name | File | Platform | Skill Integration |
|------|------|----------|-------------------|
`;

    for (const cmd of commands) {
        markdown += `| ${cmd.name} | ${cmd.file} | ${cmd.platform} | ${cmd.skill_integration} |\n`;
    }

    markdown += `
---

## Platform Parity Status

**Checked**: Claude (.claude/) vs Gemini (.gemini/)

- **Commands with parity**: ${commands.filter(c => c.platform === 'both').length} / ${commands.length}
- **Skills with parity**: ${skills.filter(s => s.platform === 'both').length} / ${skills.length}

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

    // Ensure docs directory exists
    const docsDir = path.dirname(MANIFEST_PATH);
    if (!fs.existsSync(docsDir)) {
        fs.mkdirSync(docsDir, { recursive: true });
    }

    // Write manifest
    fs.writeFileSync(MANIFEST_PATH, markdown, 'utf-8');
    console.log(`${GREEN}✓ Manifest generated: ${MANIFEST_PATH}${RESET}`);
    console.log(`${GREEN}✓ ${agents.length} agents, ${skills.length} skills, ${scripts.length} scripts, ${commands.length} commands${RESET}`);
    if (driftIssues.length > 0) {
        console.log(`${CYAN}⚠ ${driftIssues.length} drift issues detected${RESET}`);
    }
}

if (import.meta.main) {
    generateManifest().catch(console.error);
}
