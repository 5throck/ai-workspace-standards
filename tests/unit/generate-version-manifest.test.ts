/**
 * Tests for generate-version-manifest.ts — parseSkillFrontmatter() nested
 * metadata.triggers parsing, malformed-YAML handling, and detectDrift()
 * severity/dedup behavior.
 *
 * @version 1.0.0
 */
import { describe, test, expect } from 'bun:test';
import {
    parseSkillFrontmatter,
    parseAgentFrontmatter,
    detectDrift,
    deriveSkillsPlatform,
    deriveCommandPlatform,
    type SkillInfo,
    type AgentInfo,
    type CommandInfo,
} from '../../scripts/generate-version-manifest.ts';

function skillMd(frontmatter: string): string {
    return `---\n${frontmatter}\n---\n\n# Skill\n`;
}

describe('parseSkillFrontmatter', () => {
    test('parses triggers nested under metadata: (real skill shape)', () => {
        const content = skillMd(
            "name: sync\nversion: 1.1.0\nowner: lifecycle-manager\nmetadata:\n  type: process\n  triggers:\n    - sync\n    - /sync\n    - commit and push"
        );
        const { version, triggers, owner, parseError } = parseSkillFrontmatter(content);
        expect(parseError).toBeUndefined();
        expect(version).toBe('1.1.0');
        expect(owner).toBe('lifecycle-manager');
        expect(triggers).toEqual(['sync', '/sync', 'commit and push']);
    });

    test('falls back to top-level triggers: [a, b] inline array', () => {
        const content = skillMd("name: legacy\nversion: 1.0.0\ntriggers: [foo, bar]");
        const { triggers, parseError } = parseSkillFrontmatter(content);
        expect(parseError).toBeUndefined();
        expect(triggers).toEqual(['foo', 'bar']);
    });

    test('returns empty triggers array (not an error) when genuinely absent', () => {
        const content = skillMd("name: no-triggers\nversion: 1.0.0\nowner: pm");
        const { triggers, parseError } = parseSkillFrontmatter(content);
        expect(parseError).toBeUndefined();
        expect(triggers).toEqual([]);
    });

    test('reports parseError on malformed YAML without aborting', () => {
        const content = skillMd("name: broken\n  version: [unterminated");
        const { parseError, version, triggers } = parseSkillFrontmatter(content);
        expect(parseError).toBeDefined();
        expect(version).toBeUndefined();
        expect(triggers).toBeUndefined();
    });

    test('reports parseError when no frontmatter block exists', () => {
        const { parseError } = parseSkillFrontmatter('# Just a heading, no frontmatter');
        expect(parseError).toBe('No YAML frontmatter block found');
    });
});

describe('detectDrift', () => {
    const noAgents: AgentInfo[] = [];
    const noCommands: CommandInfo[] = [];

    test('emits [ERROR] for parseError skills and skips version/trigger checks for them', () => {
        const skills: SkillInfo[] = [
            { name: 'broken-skill', version: 'N/A', location: 'x', platform: 'workspace', triggers: [], owner: 'N/A', parseError: 'bad yaml' },
        ];
        const issues = detectDrift(noAgents, skills, noCommands);
        expect(issues).toEqual(['[ERROR] Skill broken-skill frontmatter YAML parse error: bad yaml']);
    });

    test('emits [WARNING] for missing triggers on parseable skills', () => {
        const skills: SkillInfo[] = [
            { name: 'quiet-skill', version: '1.0.0', location: 'x', platform: 'workspace', triggers: [], owner: 'pm' },
        ];
        const issues = detectDrift(noAgents, skills, noCommands);
        expect(issues).toContain('[WARNING] quiet-skill'.replace('quiet-skill', 'Skill quiet-skill has no triggers defined') || issues[0]);
        expect(issues.some(i => i.includes('quiet-skill') && i.includes('no triggers defined'))).toBe(true);
    });

    test('deduplicates identical issues (one skill, one issue, not one per distribution copy)', () => {
        const skills: SkillInfo[] = [
            { name: 'dup-skill', version: 'N/A', location: 'x', platform: 'both', triggers: [], owner: 'N/A' },
        ];
        const issues = detectDrift(noAgents, skills, noCommands);
        // Both "missing version" and "no triggers" should appear exactly once each.
        const versionIssues = issues.filter(i => i.includes('dup-skill') && i.includes('missing version'));
        const triggerIssues = issues.filter(i => i.includes('dup-skill') && i.includes('no triggers defined'));
        expect(versionIssues.length).toBe(1);
        expect(triggerIssues.length).toBe(1);
    });

    test('command integration check matches by same-named skill, not a stale annotation', () => {
        const skills: SkillInfo[] = [
            { name: 'sync', version: '1.1.0', location: 'x', platform: 'both', triggers: ['sync'], owner: 'lifecycle-manager' },
        ];
        const commands: CommandInfo[] = [
            { name: 'sync', file: '.claude/commands/sync.md', platform: 'both', skill_integration: 'N/A' },
            { name: 'orphan-command', file: '.claude/commands/orphan-command.md', platform: 'both', skill_integration: 'N/A' },
        ];
        const issues = detectDrift(noAgents, skills, commands);
        expect(issues.some(i => i.includes('sync') && i.includes('no matching skill'))).toBe(false);
        expect(issues.some(i => i.includes('orphan-command') && i.includes('no matching skill'))).toBe(true);
    });

    test('exempts intentionally skill-less simple commands (changelog, memlog, new-task)', () => {
        const commands: CommandInfo[] = [
            { name: 'changelog', file: '.claude/commands/changelog.md', platform: 'both', skill_integration: 'N/A' },
            { name: 'memlog', file: '.claude/commands/memlog.md', platform: 'both', skill_integration: 'N/A' },
            { name: 'new-task', file: '.claude/commands/new-task.md', platform: 'both', skill_integration: 'N/A' },
        ];
        const issues = detectDrift(noAgents, [], commands);
        expect(issues.length).toBe(0);
    });

    test('command integration check also matches the source-command-<name> alias', () => {
        const skills: SkillInfo[] = [
            { name: 'source-command-commit-push-pr', version: '1.0.0', location: 'x', platform: 'both', triggers: ['commit and push'], owner: 'pm' },
        ];
        const commands: CommandInfo[] = [
            { name: 'commit-push-pr', file: '.claude/commands/commit-push-pr.md', platform: 'both', skill_integration: 'N/A' },
        ];
        const issues = detectDrift(noAgents, skills, commands);
        expect(issues.some(i => i.includes('commit-push-pr') && i.includes('no matching skill'))).toBe(false);
    });
});

describe('deriveSkillsPlatform (D10 vocabulary)', () => {
    const mirrors4 = { claude: true, gemini: true, agents: true, codex: true };

    test('workspace SSOT presence wins (unchanged)', () => {
        expect(deriveSkillsPlatform({ inWorkspace: true, inCommonTemplate: false, mirrors: mirrors4 })).toBe('workspace');
    });

    test('common-template scan context without SSOT copy stays common (unchanged)', () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: true, mirrors: { claude: false, gemini: false, agents: false, codex: false } })).toBe('common');
    });

    test("claude+gemini mirrors exactly → 'both' (LEGACY pin, must keep passing)", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: { claude: true, gemini: true, agents: false, codex: false } })).toBe('both');
    });

    test("all four mirrors → 'all'", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: mirrors4 })).toBe('all');
    });

    test("claude-only → 'claude' (unchanged)", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: { claude: true, gemini: false, agents: false, codex: false } })).toBe('claude');
    });

    test("codex-only → 'codex' (new vocabulary)", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: { claude: false, gemini: false, agents: false, codex: true } })).toBe('codex');
    });

    test("claude+codex partial combination → 'codex+claude' (descending, D10 example)", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: { claude: true, gemini: false, agents: false, codex: true } })).toBe('codex+claude');
    });

    test("claude+agents+gemini partial combination → 'gemini+claude+agents'", () => {
        expect(deriveSkillsPlatform({ inWorkspace: false, inCommonTemplate: false, mirrors: { claude: true, gemini: true, agents: true, codex: false } })).toBe('gemini+claude+agents');
    });
});

describe('deriveCommandPlatform (D10 vocabulary)', () => {
    test('no mirrors → claude (unchanged)', () => {
        expect(deriveCommandPlatform(false, false)).toBe('claude');
    });

    test('gemini mirror only → both (LEGACY pin, must keep passing)', () => {
        expect(deriveCommandPlatform(true, false)).toBe('both');
    });

    test('gemini mirror + codex prompt → all (prompt detection)', () => {
        expect(deriveCommandPlatform(true, true)).toBe('all');
    });

    test('codex prompt without gemini mirror is not all — the mapping still needs the 1:1 gemini leg', () => {
        expect(deriveCommandPlatform(false, true)).toBe('claude');
    });
});

describe('parseAgentFrontmatter', () => {
    const agentMd = (eol: string) =>
        ['---',
         'name: pm',
         'tier:',
         '  claude: medium        # claude-sonnet-5-0',
         '  gemini: medium',
         'model: inherit',
         '---',
         '',
         '# Agent'].join(eol);

    test('parses nested tier/model from LF content', () => {
        const { tier, model } = parseAgentFrontmatter(agentMd('\n'));
        expect(tier).toBe('medium');
        expect(model).toBe('inherit');
    });

    test('parses nested tier/model from CRLF content (Windows working trees, T-20260917-review)', () => {
        const { tier, model } = parseAgentFrontmatter(agentMd('\r\n'));
        expect(tier).toBe('medium');
        expect(model).toBe('inherit');
    });

    test('returns N/A when no tier block exists', () => {
        const { tier } = parseAgentFrontmatter('---\nname: x\n---\n');
        expect(tier).toBe('N/A');
    });
});
