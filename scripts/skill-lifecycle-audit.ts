#!/usr/bin/env bun
/**
 * Skill Lifecycle Audit Script
 *
 * Cross-platform skill health checker for Claude Code & Antigravity (Gemini CLI)
 * Checks: orphaned skills, deprecated skills, missing owners, circular dependencies
 *
 * Usage:
 *   bun scripts/skill-lifecycle-audit.ts
 *   bun scripts/skill-lifecycle-audit.ts --json   # JSON output
 *
 * @version 1.5.1
 * v1.5.1: scope validation accepts the project's variant name from
 *         .claude/template-version.txt (project dir name != variant name);
 *         orphaned-owner WARN gated to the workspace-root authoring surface.
 * @last_updated 2026-09-21
 * @license MIT
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
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

interface ReferenceAllowlistEntry {
  file_substring: string;
  refs: string[];
  reason?: string;
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

interface SkillRegistryRow {
  version: string;
  status: string;
  owner: string;
  lastReviewed: string;
  removalDate: string;
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

// A skill's `scope` may be 'workspace' (L0-only), 'common' (L0+L1, shared across
// all variants), or the literal name of the variant it belongs to (L0+L1+L2) —
// see scripts/helpers/layer-filter.ts. `variant` itself is also accepted as a
// generic placeholder for skills not yet tied to one specific variant name.
const CURRENT_VARIANT_NAME = basename(ROOT);
// In a scaffolded project the skills' variant scope is the VARIANT name recorded
// in .claude/template-version.txt — not the project directory name (a project
// named `co-develop-demo` still carries `scope: co-develop` skills).
const PROJECT_VARIANT_NAME = (() => {
  const tv = join(ROOT, '.claude', 'template-version.txt');
  if (!existsSync(tv)) return '';
  const m = readFileSync(tv, 'utf-8').match(/^variant=(\S+)/m);
  return m ? m[1].trim() : '';
})();
// Root-level (L0) skills in skills/ may declare a specific variant's name as
// their scope even though the audit always runs from workspace root (where
// CURRENT_VARIANT_NAME resolves to the workspace folder name, never a co-*
// name) — so known variant directory names must be accepted too.
const KNOWN_VARIANT_NAMES = (() => {
  const templatesDir = join(ROOT, 'templates');
  if (!existsSync(templatesDir)) return [] as string[];
  return readdirSync(templatesDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('co-'))
    .map(e => e.name);
})();
function isValidScope(scope: string): boolean {
  return ['workspace', 'common', 'variant', CURRENT_VARIANT_NAME, PROJECT_VARIANT_NAME, ...KNOWN_VARIANT_NAMES].filter(Boolean).includes(scope);
}

// Detect if we're at workspace root or in a sub-project
const IS_WORKSPACE_ROOT = existsSync(CONSTITUTION_FILE);

// Platform detection: Claude Code vs Antigravity
const PLATFORM = detectPlatform();

function detectPlatform(): 'claude-code' | 'antigravity' | 'unknown' {
  if (existsSync(join(ROOT, 'GEMINI.md'))) return 'antigravity';
  if (existsSync(join(ROOT, 'CLAUDE.md')) || existsSync(join(ROOT, '.claude'))) return 'claude-code';
  return 'unknown';
}


function parseSkillRegistryRows(registryPath = join(ROOT, 'skills', 'SKILLS.md')): Map<string, SkillRegistryRow> {
  const rows = new Map<string, SkillRegistryRow>();
  if (!existsSync(registryPath)) return rows;
  const content = readFileSync(registryPath, 'utf-8').replace(/\r\n/g, '\n');
  const registrySection = (content.split(/\n###\s+Workspace Skills\b/i)[1]?.split(/\n###\s+Variant-Exclusive Skills\b/i)[0]) ?? (content.split(/\n##\s+Registry\b/i)[1]?.split(/\n##\s+/)[0] ?? content);
  for (const line of registrySection.split('\n')) {
    const cells = line.split('|').map(c => c.trim());
    if (cells.length < 8) continue;
    const nameMatch = cells[1].match(/`([^`]+)`/);
    if (!nameMatch) continue;
    if (cells[2].toLowerCase() === 'version') continue;
    rows.set(nameMatch[1], {
      version: cells[2],
      status: cells[3],
      owner: cells[4],
      lastReviewed: cells[5],
      removalDate: cells[6],
    });
  }
  return rows;
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
    const content = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
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

    return frontmatter as unknown as SkillFrontmatter;
  } catch {
    return null;
  }
}

// Recursively find all SKILL.md files
function findSkillFiles(dir: string, baseDir: string = ROOT, depth = 0): string[] {
  const skills: string[] = [];

  if (!existsSync(dir)) return skills;
  if (depth > 8) return skills; // symlink-cycle / runaway-recursion bound (T-20260910-026)

  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue; // never follow links: cycle-safe, no duplicate visits (T-20260910-026)
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      // Skip agent directories (they don't contain skills)
      if (entry.name === 'agents') continue;
      // Skip documentation/teaching example trees — illustrative SKILL.md
      // samples under docs/_examples/ are not real, lifecycle-managed skills.
      if (entry.name === '_examples' && basename(dir) === 'docs') continue;

      // At workspace root: only scan known subdirectories
      if (IS_WORKSPACE_ROOT && dir === ROOT) {
        // Only recurse into skills/ and .claude/ directories
        if (entry.name !== 'skills' && entry.name !== '.claude') continue;
      }

      skills.push(...findSkillFiles(fullPath, baseDir, depth + 1));
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
  if (existsSync(agentPath1) || existsSync(agentPath2)) return true;

  // A root-level (L0) skill's owner may be a variant-specific agent (the
  // skill's home domain) even though the skill itself lives in the shared
  // skills/ directory for L1 propagation — check every variant's roster too.
  for (const variantName of KNOWN_VARIANT_NAMES) {
    const variantAgentPath = join(ROOT, 'templates', variantName, 'agents', `${owner}.md`);
    if (existsSync(variantAgentPath)) return true;
  }
  return false;
}

// Check file modification time (safe, no shell execution)
function wasModifiedRecently(filePath: string, days: number = 30): boolean {
  if (!existsSync(filePath)) return false;

  const mtime = statSync(filePath).mtime;
  const daysSince = (Date.now() - mtime.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince < days;
}

// ── Reference integrity (v1.5.0, 2026-09-21 agent-skill-lifecycle modernization) ──

/** Every skill name that exists in the workspace: root SSOT + every variant/common template. */
function collectKnownSkillNames(): { names: Set<string>; statusByName: Map<string, string> } {
  const names = new Set<string>();
  const statusByName = new Map<string, string>();
  const roots = [join(ROOT, 'skills')];
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const e of readdirSync(templatesDir, { withFileTypes: true })) {
      if (e.isDirectory() && (e.name.startsWith('co-') || e.name === 'common')) {
        roots.push(join(templatesDir, e.name, 'skills'));
      }
    }
  }
  for (const base of roots) {
    if (!existsSync(base)) continue;
    for (const e of readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const fm = parseFrontmatter(join(base, e.name, 'SKILL.md'));
      if (fm?.name) {
        names.add(fm.name);
        if (fm.status) statusByName.set(fm.name, String(fm.status));
      }
    }
  }
  return { names, statusByName };
}

/** Allowlisted intentional historical references (docs/lifecycle/reference-allowlist.json). */
function loadReferenceAllowlist(): ReferenceAllowlistEntry[] {
  const p = join(ROOT, 'docs', 'lifecycle', 'reference-allowlist.json');
  if (!existsSync(p)) return [];
  try {
    const parsed = JSON.parse(readFileSync(p, 'utf-8'));
    return Array.isArray(parsed?.allow) ? parsed.allow as ReferenceAllowlistEntry[] : [];
  } catch {
    return [];
  }
}

/**
 * Scan a SKILL.md body for references that look like skill citations and
 * classify each as resolvable / deprecated / unknown / agent-only.
 *
 * Precision rules (kebab-case backticks alone would flag HTML attributes and
 * shell commands): a token counts as a skill reference only when it appears
 *   (a) in a `## Related Skills` section, or
 *   (b) adjacent to the word "skill" — `` `x` skill`` / ``skill `x` ``.
 */
export function scanSkillReferences(
  skillFile: string,
  known: { names: Set<string>; statusByName: Map<string, string> },
  allowlist: ReferenceAllowlistEntry[],
  agentNames: Set<string> = new Set(),
): { unknown: string[]; deprecated: string[]; agentOnly: string[] } {
  const content = readFileSync(skillFile, 'utf-8').replace(/\r\n/g, '\n');
  const body = content.replace(/^---\n[\s\S]*?\n---/, ''); // frontmatter relations are covered by requires/relates_to checks
  const self = parseFrontmatter(skillFile)?.name ?? '';
  const allowForFile = allowlist
    .filter(e => skillFile.replace(/\\/g, '/').includes(e.file_substring))
    .flatMap(e => e.refs);

  const candidates = new Set<string>();
  // (a) Related Skills sections
  const section = body.match(/## Related Skills\n([\s\S]*?)(?=\n## |$)/);
  if (section) {
    for (const m of section[1].matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`/g)) candidates.add(m[1]);
  }
  // (b) "skill"-adjacent inline mentions
  for (const m of body.matchAll(/`([a-z0-9]+(?:-[a-z0-9]+)+)`\s+skills?\b/gi)) candidates.add(m[1]);
  for (const m of body.matchAll(/skills?\s+`([a-z0-9]+(?:-[a-z0-9]+)+)`/gi)) candidates.add(m[1]);

  const unknown = new Set<string>();
  const deprecated = new Set<string>();
  const agentOnly = new Set<string>();
  for (const name of candidates) {
    if (name === self) continue;
    if (known.names.has(name)) {
      if (known.statusByName.get(name) === 'deprecated') deprecated.add(name);
      continue;
    }
    if (agentNames.has(name)) {
      agentOnly.add(name);
      continue;
    }
    if (allowForFile.includes(name)) continue;
    unknown.add(name);
  }
  return { unknown: [...unknown], deprecated: [...deprecated], agentOnly: [...agentOnly] };
}

/** Every agent name declared in agents/ rosters at L0 and inside template variants. */
function collectKnownAgentNames(): Set<string> {
  const names = new Set<string>();
  const dirs = [join(ROOT, 'agents'), join(ROOT, '.claude', 'agents')];
  const templatesDir = join(ROOT, 'templates');
  if (existsSync(templatesDir)) {
    for (const e of readdirSync(templatesDir, { withFileTypes: true })) {
      if (e.isDirectory() && e.name.startsWith('co-')) dirs.push(join(templatesDir, e.name, 'agents'));
    }
  }
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (f.endsWith('.md')) names.add(f.replace(/\.md$/, ''));
    }
  }
  return names;
}

/** Registry removal-date ≤ today on a skill that still exists (Check RD, ERROR). */
function isRemovalDateExpired(removalDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(removalDate)) return false;
  return new Date(removalDate + 'T23:59:59').getTime() <= Date.now();
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
  const registryRows = parseSkillRegistryRows();
  const runtimeSkillNames = new Set<string>();
  // v1.5.0 reference-integrity inputs (L0 only — mirrors/projects inherit L0 state)
  const knownSkills = collectKnownSkillNames();
  const refAllowlist = loadReferenceAllowlist();
  const knownAgents = collectKnownAgentNames();

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

    const isPlatformSkill = skillFile.includes('/.claude/skills/') || skillFile.includes('\\.claude\\skills\\');
    if (frontmatter.name && !isPlatformSkill) runtimeSkillNames.add(frontmatter.name);

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

    if (!isPlatformSkill && !frontmatter.owner) {
      errors.push({
        level: 'error',
        file: relPath,
        message: 'No owner defined',
        fix: "Add 'owner: agent-name' to frontmatter",
      });
      continue;
    }

    // v1.5.1: orphaned-owner is an authoring-surface check — project snapshots
    // keep their delivered owners as-is (same rationale as agent-audit Check 12).
    if (IS_WORKSPACE_ROOT && !isPlatformSkill && frontmatter.owner && !agentExists(frontmatter.owner, registry)) {
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
    if (!isPlatformSkill && frontmatter.name && registryRows.size > 0) {
      const row = registryRows.get(frontmatter.name);
      if (!row) {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Missing skills/SKILLS.md registry row for ${frontmatter.name}`,
          fix: `Add a registry row for ${frontmatter.name} or remove the runtime skill`,
        });
      } else {
        if (frontmatter.version && row.version !== String(frontmatter.version)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Registry version drift for ${frontmatter.name}: SKILL.md=${frontmatter.version}, SKILLS.md=${row.version}`,
            fix: 'Update skills/SKILLS.md version to match SKILL.md frontmatter',
          });
        }
        if (frontmatter.status && row.status !== String(frontmatter.status)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Registry status drift for ${frontmatter.name}: SKILL.md=${frontmatter.status}, SKILLS.md=${row.status}`,
            fix: 'Update skills/SKILLS.md status to match SKILL.md frontmatter',
          });
        }
        if (frontmatter.owner && row.owner !== String(frontmatter.owner)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Registry owner drift for ${frontmatter.name}: SKILL.md=${frontmatter.owner}, SKILLS.md=${row.owner}`,
            fix: 'Update skills/SKILLS.md owner to match SKILL.md frontmatter',
          });
        }
        if (frontmatter.last_reviewed && row.lastReviewed !== String(frontmatter.last_reviewed)) {
          errors.push({
            level: 'error',
            file: relPath,
            message: `Registry last_reviewed drift for ${frontmatter.name}: SKILL.md=${frontmatter.last_reviewed}, SKILLS.md=${row.lastReviewed}`,
            fix: 'Update skills/SKILLS.md last reviewed date to match SKILL.md frontmatter',
          });
        }
      }
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
    } else if (!isValidScope(scopeMatch[1])) {
      warnings.push({
        level: 'warning',
        file: relPath,
        message: `scope field has invalid value "${scopeMatch[1]}" — must be: workspace | common | variant | ${CURRENT_VARIANT_NAME} | ${KNOWN_VARIANT_NAMES.join(' | ')}`,
      });
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

    // Check RI/RI-d/RI-a (v1.5.0): body references must resolve to real skills
    if (IS_WORKSPACE_ROOT && !isPlatformSkill && frontmatter.name) {
      const { unknown, deprecated, agentOnly } = scanSkillReferences(skillFile, knownSkills, refAllowlist, knownAgents);
      for (const name of unknown) {
        errors.push({
          level: 'error',
          file: relPath,
          message: `Reference integrity: backtick reference \`${name}\` resolves to no skill in skills/ or templates/*/skills/`,
          fix: `Fix or remove the reference (add docs/lifecycle/reference-allowlist.json entry if it is an intentional historical note)`,
        });
      }
      for (const name of deprecated) {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: `Reference \`${name}\` points at a deprecated skill`,
          fix: `Update the reference to the successor skill`,
        });
      }
      for (const name of agentOnly) {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: `Related-Skills entry \`${name}\` resolves to an agent, not a skill`,
          fix: `Move the reference to the agent-relations section or cite the actual skill name`,
        });
      }
      // Check LC (v1.5.0): active skills must carry a lifecycle record
      if (frontmatter.status === 'active' && !existsSync(join(ROOT, 'docs', 'lifecycle', 'skills', `${frontmatter.name}.md`))) {
        warnings.push({
          level: 'warning',
          file: relPath,
          message: `No lifecycle record: docs/lifecycle/skills/${frontmatter.name}.md is missing for an active skill`,
          fix: `Create the record (Created / Phase History / Acceptance Criteria / Metadata)`,
        });
      }
    }
  }

  if (registryRows.size > 0) {
    for (const name of registryRows.keys()) {
      if (!runtimeSkillNames.has(name)) {
        errors.push({
          level: 'error',
          file: 'skills/SKILLS.md',
          message: `Registry row has no matching runtime skill: ${name}`,
          fix: `Remove the ${name} row from skills/SKILLS.md or restore skills/${name}/SKILL.md`,
        });
      }
      // Check RD (v1.5.0): expired removal-date on a still-present skill
      const row = registryRows.get(name)!;
      if (row.removalDate && isRemovalDateExpired(row.removalDate)) {
        errors.push({
          level: 'error',
          file: 'skills/SKILLS.md',
          message: `Removal date expired for ${name} (removal-date ${row.removalDate} has passed; the skill is still present)`,
          fix: `Run the removal review now: remove the skill or push the removal-date out with a recorded rationale`,
        });
      }
    }
  }

  // Check RI for template-resident skills (v1.5.0) — templates/*/skills are not
  // part of the runtime scan above, but their SKILL.md bodies reference skills too.
  if (IS_WORKSPACE_ROOT) {
    const templatesDir = join(ROOT, 'templates');
    if (existsSync(templatesDir)) {
      for (const e of readdirSync(templatesDir, { withFileTypes: true })) {
        if (!e.isDirectory() || !(e.name.startsWith('co-') || e.name === 'common')) continue;
        const tplSkillsDir = join(templatesDir, e.name, 'skills');
        if (!existsSync(tplSkillsDir)) continue;
        for (const s of readdirSync(tplSkillsDir, { withFileTypes: true })) {
          if (!s.isDirectory()) continue;
          const f = join(tplSkillsDir, s.name, 'SKILL.md');
          if (!existsSync(f)) continue;
          const { unknown } = scanSkillReferences(f, knownSkills, refAllowlist, knownAgents);
          for (const name of unknown) {
            errors.push({
              level: 'error',
              file: `templates/${e.name}/skills/${s.name}/SKILL.md`,
              message: `Reference integrity: backtick reference \`${name}\` resolves to no skill in skills/ or templates/*/skills/`,
              fix: `Fix or remove the reference (add docs/lifecycle/reference-allowlist.json entry if it is an intentional historical note)`,
            });
          }
        }
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
  if (import.meta.main) {
    process.exit(0);
  }
}

const result = auditSkills(jsonMode);

if (jsonMode) {
  printJsonResults(result);
} else {
  printResults(result);
}

if (import.meta.main) {
  process.exit(result.errors.length > 0 ? 1 : 0);
}

