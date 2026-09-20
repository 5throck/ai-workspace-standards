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
 * @version 1.3.1
 * @l2-propagate false
 * @last_updated 2026-09-21
 * v1.3.1: Check 12 gated to IS_WORKSPACE_ROOT — project snapshots keep delivered owners as-is (co-safety virtual domain owners would otherwise fail project-side audits).
 * @license MIT
 *
 * v1.2.0: New Check 11 (T-20260909-004) — WARN when an agent's frontmatter
 *         last_updated is older than the file's last git commit date (archived
 *         agents exempt). CLI dispatch is import-guarded so unit tests can
 *         import the helper functions safely.
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
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

  // Strip HTML comments so placeholder/example rows (e.g. VARIANT-AGENTS scaffolding) aren't mistaken for real registrations
  const content = readFileSync(AGENTS_FILE, 'utf-8').replace(/<!--[\s\S]*?-->/g, '');

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

      const indent = line.search(/\S/);
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();

      // Track if we're entering or leaving a tier block
      if (key === 'tier' && value === '' && indent === 0) {
        inTierBlock = true;
        currentIndentation = indent; // Get indentation level
        continue;
      }

      // Check if we've left the tier block (decreased indentation or new top-level key)
      if (inTierBlock && indent <= currentIndentation && key !== 'claude' && key !== 'antigravity' && key !== 'gemini-cli') {
        inTierBlock = false;
      }

      // Ignore nested keys unless we are parsing the tier block
      if (!inTierBlock && indent > 0) {
        continue;
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
        (frontmatter['tier'] as Record<string, string>)[key] = cleanValue;
      } else {
        frontmatter[key] = value.replace(/^['"]|['"]$/g, '');
      }
    }

    return frontmatter as unknown as AgentFrontmatter;
  } catch {
    return null;
  }
}

// Recursively find all agent files
function findAgentFiles(dir: string, depth = 0): string[] {
  const agents: string[] = [];

  if (!existsSync(dir)) return agents;
  if (depth > 8) return agents; // symlink-cycle / runaway-recursion bound (T-20260910-026)

  // If project root has an agents/ directory, only scan that (avoids false positives in docs/, etc.)
  if (dir === ROOT) {
    const agentsDir = join(dir, 'agents');
    if (existsSync(agentsDir)) {
      return findAgentFiles(agentsDir);
    }
    return agents;
  }

  // In sub-project or specific directory: recursive scan
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // never follow links: cycle-safe, no duplicate visits (T-20260910-026)
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '_archive' ||
          entry.name === 'skills' || entry.name === 'commands') continue;
      agents.push(...findAgentFiles(fullPath, depth + 1));
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
function findSkillFiles(dir: string, depth = 0): string[] {
  const skills: string[] = [];

  if (!existsSync(dir)) return skills;

  if (depth > 8) return skills; // symlink-cycle / runaway-recursion bound (T-20260910-026)
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EPERM' || code === 'EACCES') return skills; // skip inaccessible dirs (e.g. test scaffolds)
    throw err;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // never follow links: cycle-safe, no duplicate visits (T-20260910-026)
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      skills.push(...findSkillFiles(fullPath, depth + 1));
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

// Normalize a frontmatter date value ("2026-08-24", "2026-08-24T00:00:00.000Z")
// to YYYY-MM-DD; null when the value is not calendar-date shaped.
export function parseFrontmatterDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const unquoted = value.replace(/^['"]|['"]$/g, '');
  const m = unquoted.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

// ISO YYYY-MM-DD dates compare correctly as plain strings.
export function isFrontmatterStale(frontmatterDate: string, lastCommitDate: string): boolean {
  return frontmatterDate < lastCommitDate;
}

// ── v1.3.0 lifecycle-modernization checks (2026-09-21) ──────────────────────

/** An agent name resolves if a roster entry, an agent file, or a variant agent file exists. */
function agentNameExists(name: string, registeredAgents: Set<string>): boolean {
  if (registeredAgents.has(name)) return true;
  if (existsSync(join(ROOT, 'agents', `${name}.md`))) return true;
  if (existsSync(join(ROOT, '.claude', 'agents', `${name}.md`))) return true;
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const e of readdirSync(templatesDir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.startsWith('co-') && existsSync(join(templatesDir, e.name, 'agents', `${name}.md`))) {
        return true;
      }
    }
  }
  return false;
}

/** Extract list-valued frontmatter entries (handoff_to, handoff_from, …) as name tokens. */
function extractFrontmatterNameList(filePath: string, field: string): string[] {
  try {
    const content = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
    const fm = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) return [];
    const names: string[] = [];
    const lines = fm[1].split('\n');
    for (let i = 0; i < lines.length; i++) {
      const inline = lines[i].match(new RegExp(`^${field}:\\s*(.+)$`));
      if (inline) {
        if (inline[1].startsWith('[')) {
          names.push(...inline[1].slice(1, -1).split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean));
        } else if (inline[1]) {
          names.push(inline[1].trim().replace(/^['"]|['"]$/g, ''));
        }
        continue;
      }
      if (new RegExp(`^${field}:\\s*$`).test(lines[i])) {
        for (let j = i + 1; j < lines.length && /^-\s/.test(lines[j]); j++) {
          names.push(lines[j].replace(/^-\s*/, '').trim().replace(/^['"]|['"]$/g, ''));
        }
      }
    }
    return names.filter(Boolean);
  } catch {
    return [];
  }
}

/** Removal-review deadline (ISO date) is in the past. */
export function isRemovalReviewOverdue(removalReview: string | null): boolean {
  if (!removalReview || !/^\d{4}-\d{2}-\d{2}$/.test(removalReview)) return false;
  return new Date(removalReview + 'T23:59:59').getTime() <= Date.now();
}

// Read a date-ish frontmatter field directly from the raw frontmatter text. The
// generic parser above only keeps top-level keys, but `last_updated` legitimately
// nests under `lifecycle:` in agent files — a targeted regex catches both layouts.
function extractFrontmatterDate(filePath: string, field: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;
    const m = frontmatterMatch[1].match(new RegExp(`^\\s*${field}:\\s*['"]?(\\S+)`, 'm'));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

// Last git commit date (YYYY-MM-DD) for a file; null when git is unavailable or the
// file has no commits yet (freshly added, uncommitted).
function lastCommitDate(filePath: string): string | null {
  try {
    const result = spawnSync('git', ['log', '-1', '--format=%cs', '--', filePath], { encoding: 'utf-8' });
    const date = (result.stdout || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

/** True when the named agent exists but is deprecated/archived (non-live). */
function isAgentNonLive(name: string): boolean {
  for (const p of [join(ROOT, 'agents', `${name}.md`), join(ROOT, '.claude', 'agents', `${name}.md`)]) {
    if (existsSync(p)) {
      const fm = parseAgentFrontmatter(p);
      return fm?.status === 'deprecated' || fm?.status === 'archived';
    }
  }
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const e of readdirSync(templatesDir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.startsWith('co-')) {
        const p = join(templatesDir, e.name, 'agents', `${name}.md`);
        if (existsSync(p)) {
          const fm = parseAgentFrontmatter(p);
          return fm?.status === 'deprecated' || fm?.status === 'archived';
        }
      }
    }
  }
  return false;
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

    // Check 11: Stale last_updated (T-20260909-004) — the file's git history moved
    // past its declared last_updated without the lifecycle metadata being refreshed.
    // Archived agents are exempt: stale metadata is expected there by definition.
    if (frontmatter.status !== 'archived' && !relPath.includes('_archive')) {
      const fmDate = parseFrontmatterDate(extractFrontmatterDate(agentFile, 'last_updated'));
      const commitDate = lastCommitDate(agentFile);
      if (fmDate && commitDate && isFrontmatterStale(fmDate, commitDate)) {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: `frontmatter last_updated (${fmDate}) is older than the last git commit (${commitDate})`,
          fix: "Update 'last_updated' in frontmatter to reflect the latest change",
        });
      }
    }

    // Check 4b: status vocabulary (v1.3.0) — `retired` is a legacy alias of `archived`
    const validAgentStatuses = ['draft', 'active', 'deprecated', 'archived'];
    if (frontmatter.status && !validAgentStatuses.includes(String(frontmatter.status))) {
      if (String(frontmatter.status) === 'retired') {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: "status 'retired' is a legacy alias — use 'archived'",
          fix: "Set 'status: archived' in frontmatter",
        });
      } else {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Invalid status value '${frontmatter.status}' (allowed: ${validAgentStatuses.join(' | ')})`,
          fix: `Set status to one of: ${validAgentStatuses.join(', ')}`,
        });
      }
    }

    // Check 13: handoff integrity (v1.3.0) — handoff targets must exist and be live
    for (const field of ['handoff_to', 'handoff_from'] as const) {
      for (const target of extractFrontmatterNameList(agentFile, field)) {
        if (!agentNameExists(target, registeredAgents)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Dangling ${field} reference: agent '${target}' does not exist`,
            fix: `Update or remove the ${field} entry`,
          });
        } else if (isAgentNonLive(target)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `${field} references non-live agent '${target}'`,
            fix: `Re-route the handoff to a live agent`,
          });
        }
      }
    }

    // Check 14: removal-review deadline (v1.3.0) — deprecated agents must carry a
    // future removal_review date, and an expired one blocks until the review runs.
    if (frontmatter.status === 'deprecated') {
      const removalReview = parseFrontmatterDate(extractFrontmatterDate(agentFile, 'removal_review'));
      if (!removalReview) {
        errors.push({
          level: 'error',
          file: relPath,
          message: 'Deprecated agent has no removal_review date',
          fix: "Add 'removal_review: YYYY-MM-DD' (default: deprecation + 90 days) to frontmatter",
        });
      } else if (isRemovalReviewOverdue(removalReview)) {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Removal review overdue for deprecated agent (removal_review ${removalReview} has passed)`,
          fix: 'Run the removal review now: delete (user-approved), archive, or push the date out with a recorded rationale',
        });
      }
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
      const requiredPlatforms = ['claude', 'antigravity', 'gemini-cli'] as const;
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

  // Check 12 (v1.3.0): skill `owner:` values on the L0 AUTHORING surface
  // (skills/) naming agents that exist nowhere. Variant-template skills are
  // excluded — several variants declare virtual domain owners (e.g. co-safety's
  // gmp-agent) as an intentional local model, and project copies heal through
  // the upgrade path. The soft orphaned-owner WARN in skill-lifecycle-audit
  // still covers those surfaces.
  for (const [owner, skillPaths] of skillOwnerRefs) {
    if (!IS_WORKSPACE_ROOT) break; // v1.3.1: authoring-surface check — project snapshots keep their owners as delivered
    for (const token of owner.split(/[\s,]+/).filter(Boolean)) {
      if (agentNameExists(token, registeredAgents)) continue;
      const l0Path = skillPaths.find(p => {
        const norm = p.replace(/\\/g, '/');
        return norm.startsWith('skills/');
      });
      if (l0Path) {
        errors.push({
          level: 'error',
          file: l0Path.replace(/\\/g, '/'),
          message: `Skill owner references nonexistent agent: ${token}`,
          fix: `Create agents/${token}.md, or reassign the skill's owner to a live agent`,
        });
      }
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

// Dispatch is import-guarded so unit tests can import the helper functions without
// triggering a full audit run.
if (import.meta.main) {
  if (helpMode) {
    console.log(`
Agent Lifecycle Audit v1.2.0

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
  ✓ Stale frontmatter last_updated vs last git commit date (warn)

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
}

