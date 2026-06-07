#!/usr/bin/env bun
/**
 * Skill Lifecycle Audit Script
 *
 * Cross-platform skill health checker for Claude Code & Antigravity (Gemini CLI)
 * Checks: orphaned skills, deprecated skills, missing owners, circular dependencies
 *
 * Usage:
 *   bun scripts/skill-lifecycle-audit.ts
 *   bun scripts/skill-lifecycle-audit.ts --fix    # Auto-fix simple issues
 *   bun scripts/skill-lifecycle-audit.ts --json   # JSON output
 *
 * @version 1.1.3
 * @last_updated 2026-06-02
 * @license MIT
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { cwd } from 'node:process';

interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  status?: 'draft' | 'active' | 'deprecated' | 'archived';
  owner?: string;
  requires?: string[];
  supersedes?: string;
  superseded_by?: string[];
  last_reviewed?: string;
  last_reviewed_by?: string;
}

interface SkillIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
}

interface AuditResult {
  skillsScanned: number;
  errors: SkillIssue[];
  warnings: SkillIssue[];
  summary: string;
  summaryClean: string;  // Without ANSI colors for JSON output
}

interface AgentRegistry {
  agents: string[];
  skills: Array<{ name: string; file: string; owner: string }>;
}

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();
const AGENTS_FILE = join(ROOT, 'AGENTS.md');
const CONSTITUTION_FILE = join(ROOT, 'CONSTITUTION.md');

// Detect if we're at workspace root or in a sub-project
const IS_WORKSPACE_ROOT = existsSync(CONSTITUTION_FILE);

// Platform detection: Claude Code vs Antigravity
const PLATFORM = detectPlatform();

function detectPlatform(): 'claude-code' | 'antigravity' | 'unknown' {
  if (existsSync(join(ROOT, 'GEMINI.md'))) return 'antigravity';
  if (existsSync(join(ROOT, 'CLAUDE.md')) || existsSync(join(ROOT, '.claude'))) return 'claude-code';
  return 'unknown';
}

// Parse AGENTS.md for valid agents
function getAgentRegistry(): AgentRegistry {
  const registry: AgentRegistry = { agents: [], skills: [] };

  if (!existsSync(AGENTS_FILE)) {
    console.warn(`${colors.yellow}⚠️  AGENTS.md not found - owner validation disabled${colors.reset}`);
    return registry;
  }

  const content = readFileSync(AGENTS_FILE, 'utf-8');

  // Extract agent names from markdown table
  const agentMatches = content.matchAll(/\[([^\]]+)\]\(agents\/([^)]+)\.md\)/g);
  for (const match of agentMatches) {
    registry.agents.push(match[1]);
  }

  return registry;
}

// Parse YAML frontmatter from SKILL.md
function parseFrontmatter(filePath: string): SkillFrontmatter | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) return null;

    const frontmatter: Record<string, unknown> = {};
    const lines = frontmatterMatch[1].split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }

    return frontmatter as SkillFrontmatter;
  } catch {
    return null;
  }
}

// Recursively find all SKILL.md files
function findSkillFiles(dir: string, baseDir: string = ROOT): string[] {
  const skills: string[] = [];

  if (!existsSync(dir)) return skills;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      // Skip agent directories (they don't contain skills)
      if (entry.name === 'agents') continue;

      // At workspace root: only scan known subdirectories
      if (IS_WORKSPACE_ROOT && dir === ROOT) {
        // Only recurse into skills/ and .claude/ directories
        if (entry.name !== 'skills' && entry.name !== '.claude') continue;
      }

      skills.push(...findSkillFiles(fullPath, baseDir));
    } else if (entry.name === 'SKILL.md') {
      skills.push(fullPath);
    }
  }

  return skills;
}

// Validate agent exists
function agentExists(owner: string, registry: AgentRegistry): boolean {
  if (registry.agents.includes(owner)) return true;

  const agentPath1 = join(ROOT, 'agents', `${owner}.md`);
  const agentPath2 = join(ROOT, '.claude', 'agents', `${owner}.md`);
  return existsSync(agentPath1) || existsSync(agentPath2);
}

// Check file modification time (safe, no shell execution)
function wasModifiedRecently(filePath: string, days: number = 30): boolean {
  if (!existsSync(filePath)) return false;

  const mtime = statSync(filePath).mtime;
  const daysSince = (Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < days;
}

// Check for circular dependencies
function checkCircularDependencies(
  skillFile: string,
  requires: string[],
  allSkills: Map<string, string>,
  visited = new Set<string>(),
  path: string[] = []
): string[] | null {
  const skillName = dirname(relative(ROOT, skillFile));

  if (visited.has(skillName)) {
    if (path.includes(skillName)) {
      return [...path, skillName];
    }
    return null;
  }

  visited.add(skillName);
  path.push(skillName);

  for (const req of requires) {
    const reqSkillFile = allSkills.get(req);
    if (reqSkillFile) {
      const reqFrontmatter = parseFrontmatter(reqSkillFile);
      if (reqFrontmatter?.requires) {
        const cycle = checkCircularDependencies(reqSkillFile, reqFrontmatter.requires, allSkills, visited, path);
        if (cycle) return cycle;
      }
    }
  }

  path.pop();
  return null;
}

// Main audit function
function auditSkills(jsonMode = false): AuditResult {
  const registry = getAgentRegistry();
  const skillFiles = findSkillFiles(ROOT);
  const allSkills = new Map<string, string>();

  for (const file of skillFiles) {
    const frontmatter = parseFrontmatter(file);
    if (frontmatter?.name) {
      allSkills.set(frontmatter.name, file);
    }
  }

  const errors: SkillIssue[] = [];
  const warnings: SkillIssue[] = [];

  // Skip header in JSON mode
  if (!jsonMode) {
    console.log(`${colors.cyan}🔍 Skill Lifecycle Audit${colors.reset}`);
    console.log(`${colors.cyan}=========================${colors.reset}`);
    console.log(`${colors.dim}Platform: ${PLATFORM}${colors.reset}`);
    console.log(`${colors.dim}Location: ${IS_WORKSPACE_ROOT ? 'workspace root' : 'current project'}${colors.reset}`);
    console.log(`${colors.dim}Skills found: ${skillFiles.length}${colors.reset}`);
    console.log('');
  }

  for (const skillFile of skillFiles) {
    const relPath = relative(ROOT, skillFile).replace(/\\/g, '/');
    const frontmatter = parseFrontmatter(skillFile);

    if (!frontmatter) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'No valid frontmatter found',
        fix: 'Add YAML frontmatter with name and description',
      });
      continue;
    }

    if (!frontmatter.name) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'Missing name in frontmatter',
        fix: "Add 'name: skill-name' to frontmatter",
      });
      continue;
    }

    if (!frontmatter.description) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Missing description in frontmatter',
        fix: "Add 'description: This skill should be used when...'",
      });
    }

    const isPlatformSkill = skillFile.includes('/.claude/skills/') || skillFile.includes('\\.claude\\skills\\');

    if (!isPlatformSkill && !frontmatter.owner) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'No owner defined',
        fix: "Add 'owner: agent-name' to frontmatter",
      });
      continue;
    }

    if (!isPlatformSkill && frontmatter.owner && !agentExists(frontmatter.owner, registry)) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: `Orphaned skill (owner: ${frontmatter.owner} not found)`,
        fix: `Reassign to valid agent or create agents/${frontmatter.owner}.md`,
      });
    }

    // Check status field is present and valid
    const validSkillStatuses = ['active', 'deprecated', 'experimental', 'archived'];
    if (!isPlatformSkill && !frontmatter.status) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'Missing status in frontmatter',
        fix: "Add 'status: active' (or deprecated/experimental/archived)",
      });
    } else if (!isPlatformSkill && frontmatter.status && !validSkillStatuses.includes(frontmatter.status as string)) {
      errors.push({
        level: 'error',
        file: relPath,
        message: `Invalid status value '${frontmatter.status}' (allowed: ${validSkillStatuses.join(' | ')})`,
        fix: `Set status to one of: ${validSkillStatuses.join(', ')}`,
      });
    }

    if (frontmatter.status === 'deprecated' && wasModifiedRecently(skillFile, 30)) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: `Deprecated skill still active (v${frontmatter.version || 'unknown'})`,
        fix: 'Archive to skills/_archive/ or remove from repository',
      });
    }

    // Check: scope field should be declared
    const skillContent = readFileSync(skillFile, 'utf-8');
    const scopeMatch = skillContent.match(/^scope:\s*(\S+)/m);
    if (!scopeMatch) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: `scope field missing in SKILL.md frontmatter — declare scope: workspace | common | variant`,
      });
    } else {
      const validScopes = ['workspace', 'common', 'variant'];
      if (!validScopes.includes(scopeMatch[1])) {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: `scope field has invalid value "${scopeMatch[1]}" — must be: workspace | common | variant`,
        });
      }
    }

    if (frontmatter.requires && frontmatter.requires.length > 0) {
      for (const req of frontmatter.requires) {
        if (!allSkills.has(req)) {
          warnings.push({
            level: 'warning',
            file: relPath,
            message: `Missing dependency: ${req}`,
            fix: `Create ${req} skill or remove from requires: []`,
          });
        }
      }
    }

    if (frontmatter.requires && frontmatter.requires.length > 0) {
      const cycle = checkCircularDependencies(skillFile, frontmatter.requires, allSkills);
      if (cycle) {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Circular dependency: ${cycle.join(' → ')}`,
          fix: 'Break the cycle by removing one dependency',
        });
      }
    }
  }

  const summary = generateSummary(skillFiles.length, errors.length, warnings.length);

  return {
    skillsScanned: skillFiles.length,
    errors,
    warnings,
    summary: summary.colored,
    summaryClean: summary.clean,
  };
}

function generateSummary(scanned: number, errors: number, warnings: number): { colored: string; clean: string } {
  if (errors === 0 && warnings === 0) {
    return {
      colored: `${colors.green}✓ All ${scanned} skills healthy${colors.reset}`,
      clean: `All ${scanned} skills healthy`,
    };
  }
  return {
    colored: `${colors.green}✓ Skills scanned: ${scanned}${colors.reset}` +
      (warnings > 0 ? `\n${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}` : '') +
      (errors > 0 ? `\n${colors.red}✖ Errors: ${errors}${colors.reset}` : ''),
    clean: `Skills scanned: ${scanned}` +
      (warnings > 0 ? `, Warnings: ${warnings}` : '') +
      (errors > 0 ? `, Errors: ${errors}` : ''),
  };
}

function printResults(result: AuditResult): void {
  for (const error of result.errors) {
    console.log(`${colors.red}✖ ERROR: ${error.message}${colors.reset}`);
    console.log(`   File: ${error.file}`);
    if (error.fix) console.log(`   Fix: ${error.fix}`);
    console.log('');
  }

  for (const warning of result.warnings) {
    console.log(`${colors.yellow}⚠️  WARNING: ${warning.message}${colors.reset}`);
    console.log(`   File: ${warning.file}`);
    if (warning.fix) console.log(`   Fix: ${warning.fix}`);
    console.log('');
  }

  console.log(`${colors.cyan}=========================${colors.reset}`);
  console.log(result.summary);
}

function printJsonResults(result: AuditResult): void {
  console.log(JSON.stringify(result, null, 2));
}

// CLI interface
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const helpMode = args.includes('--help') || args.includes('-h');

if (helpMode) {
  console.log(`
Skill Lifecycle Audit v1.0.0

Usage:
  bun scripts/skill-lifecycle-audit.ts          # Run audit
  bun scripts/skill-lifecycle-audit.ts --json   # JSON output
  bun scripts/skill-lifecycle-audit.ts --help   # Show this help

Checks:
  ✓ Skills without owners
  ✓ Orphaned skills (owner agent doesn't exist)
  ✓ Deprecated skills still being modified
  ✓ Missing dependencies (requires field)
  ✓ Circular dependencies

Platform: ${PLATFORM}
  `);
  process.exit(0);
}

const result = auditSkills(jsonMode);

if (jsonMode) {
  printJsonResults(result);
} else {
  printResults(result);
}

process.exit(result.errors.length > 0 ? 1 : 0);

