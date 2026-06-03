#!/usr/bin/env bun
/**
 * Agent Lifecycle Audit Script
 *
 * Cross-platform agent health checker for Claude Code & Antigravity (Gemini CLI)
 * Checks: orphaned agents, missing frontmatter, status inconsistencies, skill references
 *
 * Usage:
 *   bun scripts/agent-lifecycle-audit.ts
 *   bun scripts/agent-lifecycle-audit.ts --json   # JSON output
 *
 * @version 1.1.1
 * @last_updated 2026-06-02
 * @license MIT
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { cwd } from 'node:process';

interface AgentFrontmatter {
  name: string;
  role?: string;
  status?: 'draft' | 'active' | 'deprecated' | 'archived';
  color?: string;
  description?: string;
  responsibilities?: string[];
  tier?: {
    claude?: 'high' | 'medium' | 'low';
    antigravity?: 'high' | 'medium' | 'low';
    'gemini-cli'?: 'high' | 'medium' | 'low';
  };
}

interface AgentIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
}

interface AuditResult {
  agentsScanned: number;
  errors: AgentIssue[];
  warnings: AgentIssue[];
  summary: string;
  summaryClean: string;
}

// ANSI colors
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

// Platform detection
const PLATFORM = detectPlatform();

function detectPlatform(): 'claude-code' | 'antigravity' | 'unknown' {
  if (existsSync(join(ROOT, 'GEMINI.md'))) return 'antigravity';
  if (existsSync(join(ROOT, 'CLAUDE.md')) || existsSync(join(ROOT, '.claude'))) return 'claude-code';
  return 'unknown';
}

// Parse AGENTS.md for registered agents
function getRegisteredAgents(): Set<string> {
  const agents = new Set<string>();

  if (!existsSync(AGENTS_FILE)) {
    console.warn(`${colors.yellow}⚠️  AGENTS.md not found${colors.reset}`);
    return agents;
  }

  const content = readFileSync(AGENTS_FILE, 'utf-8');

  // Extract agent names from markdown table links
  const matches = content.matchAll(/\[([^\]]+)\]\(agents\/([^)]+)\.md\)/g);
  for (const match of matches) {
    agents.add(match[2]); // Use the filename without .md
  }

  return agents;
}

// Parse agent frontmatter
function parseAgentFrontmatter(filePath: string): AgentFrontmatter | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) return null;

    const frontmatter: Record<string, unknown> = {};
    const lines = frontmatterMatch[1].split('\n');

    let inTierBlock = false;
    let currentIndentation = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;

      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Track if we're entering or leaving a tier block
      if (key === 'tier' && value === '') {
        inTierBlock = true;
        currentIndentation = line.search(/\S/); // Get indentation level
        continue;
      }

      // Check if we've left the tier block (decreased indentation or new top-level key)
      if (inTierBlock && line.search(/\S/) <= currentIndentation && key !== 'claude' && key !== 'antigravity' && key !== 'gemini-cli') {
        inTierBlock = false;
      }

      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
      } else if (inTierBlock && (key === 'claude' || key === 'antigravity' || key === 'gemini-cli')) {
        // Handle nested tier fields
        if (!frontmatter['tier']) {
          frontmatter['tier'] = {};
        }
        // Strip comments and clean the value
        const cleanValue = value.split('#')[0].trim().replace(/^['"]|['"]$/g, '');
        frontmatter['tier'][key] = cleanValue;
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }

    return frontmatter as AgentFrontmatter;
  } catch {
    return null;
  }
}

// Recursively find all agent files
function findAgentFiles(dir: string): string[] {
  const agents: string[] = [];

  if (!existsSync(dir)) return agents;

  // At workspace root: only scan agents/ directory
  if (IS_WORKSPACE_ROOT && dir === ROOT) {
    const agentsDir = join(dir, 'agents');
    if (existsSync(agentsDir)) {
      return findAgentFiles(agentsDir);
    }
    return agents;
  }

  // In sub-project or specific directory: recursive scan
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_archive' ||
          entry.name === 'skills' || entry.name === 'commands') continue;
      agents.push(...findAgentFiles(fullPath));
    } else if (entry.name.endsWith('.md') &&
               entry.name !== 'AGENTS.md' &&
               entry.name !== 'README.md' &&
               entry.name !== 'SKILL.md') {
      // Check if it looks like an agent file (has frontmatter with role or color)
      const content = readFileSync(fullPath, 'utf-8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (frontmatterMatch) {
        const fm = frontmatterMatch[1];
        // Agents have 'role:' or 'color:' in frontmatter; skills have 'description:' instead
        if ((fm.includes('role:') || fm.includes('color:')) && !fm.includes('description: This skill should be used')) {
          agents.push(fullPath);
        }
      }
    }
  }

  return agents;
}

// Find all skills and their owner references
function getSkillOwnerReferences(): Map<string, string[]> {
  const skillOwners = new Map<string, string[]>();

  const skillFiles = findSkillFiles(ROOT);
  for (const skillFile of skillFiles) {
    const frontmatter = parseSkillFrontmatter(skillFile);
    if (frontmatter?.owner) {
      const owners = skillOwners.get(frontmatter.owner) || [];
      owners.push(relative(ROOT, skillFile));
      skillOwners.set(frontmatter.owner, owners);
    }
  }

  return skillOwners;
}

// Find all skill files
function findSkillFiles(dir: string): string[] {
  const skills: string[] = [];

  if (!existsSync(dir)) return skills;

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      skills.push(...findSkillFiles(fullPath));
    } else if (entry.name === 'SKILL.md') {
      skills.push(fullPath);
    }
  }

  return skills;
}

// Parse skill frontmatter (minimal version)
function parseSkillFrontmatter(filePath: string): { owner?: string } | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const ownerMatch = frontmatterMatch[1].match(/^owner:\s*(.+)$/m);
    if (ownerMatch) {
      return { owner: ownerMatch[1].trim() };
    }
    return null;
  } catch {
    return null;
  }
}

// Main audit function
function auditAgents(jsonMode = false): AuditResult {
  const registeredAgents = getRegisteredAgents();
  const agentFiles = findAgentFiles(ROOT);
  const skillOwnerRefs = getSkillOwnerReferences();

  const errors: AgentIssue[] = [];
  const warnings: AgentIssue[] = [];

  // Skip header in JSON mode
  if (!jsonMode) {
    console.log(`${colors.cyan}🔍 Agent Lifecycle Audit${colors.reset}`);
    console.log(`${colors.cyan}========================${colors.reset}`);
    console.log(`${colors.dim}Platform: ${PLATFORM}${colors.reset}`);
    console.log(`${colors.dim}Location: ${IS_WORKSPACE_ROOT ? 'workspace root' : 'current project'}${colors.reset}`);
    console.log(`${colors.dim}Agents found: ${agentFiles.length}${colors.reset}`);
    console.log('');
  }

  // Check each agent file
  for (const agentFile of agentFiles) {
    const relPath = relative(ROOT, agentFile).replace(/\\/g, '/');
    // Extract agent name from filename (e.g., "agents/architect.md" -> "architect")
    const agentName = basename(relPath, '.md');
    const frontmatter = parseAgentFrontmatter(agentFile);

    // Check 1: Missing frontmatter
    if (!frontmatter) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'No valid frontmatter found',
        fix: 'Add YAML frontmatter with name, role, and status',
      });
      continue;
    }

    // Check 2: Missing name
    if (!frontmatter.name) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'Missing name in frontmatter',
        fix: "Add 'name: agent-name' to frontmatter",
      });
      continue;
    }

    // Check 3: Missing role
    if (!frontmatter.role) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Missing role in frontmatter',
        fix: "Add 'role: brief description of agent role'",
      });
    }

    // Check 4: Missing status
    if (!frontmatter.status) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Missing status in frontmatter',
        fix: "Add 'status: active' (or draft/deprecated/archived)",
      });
    }

    // Check 5: Agent not registered in AGENTS.md
    if (!registeredAgents.has(agentName) && frontmatter.status !== 'archived') {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: `Agent not registered in AGENTS.md`,
        fix: `Add to AGENTS.md agent roster table`,
      });
    }

    // Check 6: Deprecated agents with active skill references
    if (frontmatter.status === 'deprecated' || frontmatter.status === 'archived') {
      const refs = skillOwnerRefs.get(agentName) || [];
      if (refs.length > 0) {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Deprecated agent still referenced by ${refs.length} skill(s)`,
          fix: `Reassign skills: ${refs.slice(0, 3).join(', ')}${refs.length > 3 ? '...' : ''}`,
        });
      }
    }

    // Check 7: Check if agent file is in _archive but status is not archived
    if (relPath.includes('_archive') && frontmatter.status !== 'archived') {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: 'Agent in _archive/ but status not set to archived',
        fix: "Set 'status: archived' in frontmatter",
      });
    }

    // Check 8: Tier validation - missing tier field
    if (!frontmatter.tier) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'Missing tier field in frontmatter',
        fix: "Add tier field with claude, antigravity, and gemini-cli specifications",
      });
    } else {
      // Check 9: Tier validation - missing platforms
      const requiredPlatforms = ['claude', 'antigravity', 'gemini-cli'];
      for (const platform of requiredPlatforms) {
        if (!frontmatter.tier[platform]) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Missing tier.${platform} specification`,
            fix: `Add tier.${platform}: high|medium|low to frontmatter`,
          });
        } else {
          // Check 10: Tier validation - invalid tier values
          const validTiers = ['high', 'medium', 'low'];
          if (!validTiers.includes(frontmatter.tier[platform])) {
            errors.push({
              level: 'error',
              file: relPath,
              message: `Invalid tier.${platform} value: "${frontmatter.tier[platform]}"`,
              fix: `Use one of: ${validTiers.join(', ')}`,
            });
          }
        }
      }
    }
  }

  // Check 8: Agents registered in AGENTS.md but files don't exist
  for (const agentName of registeredAgents) {
    const agentPath1 = join(ROOT, 'agents', `${agentName}.md`);
    const agentPath2 = join(ROOT, '.claude', 'agents', `${agentName}.md`);
    if (!existsSync(agentPath1) && !existsSync(agentPath2)) {
      errors.push({
        level: 'error',
        file: `agents/${agentName}.md`,
        message: 'Registered in AGENTS.md but file not found',
        fix: `Create agents/${agentName}.md or remove from AGENTS.md`,
      });
    }
  }

  const summary = generateSummary(agentFiles.length, errors.length, warnings.length);

  return {
    agentsScanned: agentFiles.length,
    errors,
    warnings,
    summary: summary.colored,
    summaryClean: summary.clean,
  };
}

function generateSummary(scanned: number, errors: number, warnings: number): { colored: string; clean: string } {
  if (errors === 0 && warnings === 0) {
    return {
      colored: `${colors.green}✓ All ${scanned} agents healthy${colors.reset}`,
      clean: `All ${scanned} agents healthy`,
    };
  }
  return {
    colored: `${colors.green}✓ Agents scanned: ${scanned}${colors.reset}` +
      (warnings > 0 ? `\n${colors.yellow}⚠️  Warnings: ${warnings}${colors.reset}` : '') +
      (errors > 0 ? `\n${colors.red}✖ Errors: ${errors}${colors.reset}` : ''),
    clean: `Agents scanned: ${scanned}` +
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

  console.log(`${colors.cyan}========================${colors.reset}`);
  console.log(result.summary);
}

function printJsonResults(result: AuditResult): void {
  // Output clean JSON without ANSI codes
  const cleanResult = {
    agentsScanned: result.agentsScanned,
    errors: result.errors,
    warnings: result.warnings,
    summary: result.summaryClean,
  };
  console.log(JSON.stringify(cleanResult, null, 2));
}

// CLI interface
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const helpMode = args.includes('--help') || args.includes('-h');

if (helpMode) {
  console.log(`
Agent Lifecycle Audit v1.0.0

Usage:
  bun scripts/agent-lifecycle-audit.ts          # Run audit
  bun scripts/agent-lifecycle-audit.ts --json   # JSON output
  bun scripts/agent-lifecycle-audit.ts --help   # Show this help

Checks:
  ✓ Agents without proper frontmatter
  ✓ Agents not registered in AGENTS.md
  ✓ Registered agents with missing files
  ✓ Deprecated agents with active skill references
  ✓ Archive location vs status consistency
  ✓ Tier field validation (all platforms present, valid values)

Platform: ${PLATFORM}
  `);
  process.exit(0);
}

const result = auditAgents(jsonMode);

if (jsonMode) {
  printJsonResults(result);
} else {
  printResults(result);
}

process.exit(result.errors.length > 0 ? 1 : 0);

