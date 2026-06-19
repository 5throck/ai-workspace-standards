#!/usr/bin/env tsx
/**
 * Variant Generator
 *
 * Generates variant project structure from reconciled manifest.
 * Creates variant.json, directory structure, agent overrides, and skill directories.
 *
 * @version 1.6.0
 * @phase 3: Variant Generation
 *
 * Dependencies:
 * - helpers/scan-l2-project.ts (File classification types)
 * - helpers/reconcile-with-l0-l1.ts (Reconciled manifest types)
 * - helpers/variant-governance-rules.ts (Variant type definitions)
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 * - lib/platform-context.ts (Platform detection)
 */

import { join, dirname, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { ReconciledManifest, ReconciledFile } from './reconcile-with-l0-l1.js';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.js';
import { fatalError, warningError, ErrorPhase } from '../lib/error-handling.js';
import { applyContextTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './template-utils.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VariantMetadata {
  /** Variant name (e.g., 'co-consult', 'co-security') */
  name: string;
  /** Variant description */
  description: string;
  /** Variant type for governance rules */
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration' | 'lecture';
  /** Lifecycle status - always beta for MVP */
  status: 'beta';
  /** Version - always 0.1.0 for MVP */
  version: '0.1.0';
  /** Inherits from templates/common */
  inherits_common: string;
  /** Agent roster from L2 project */
  agentRoster: AgentDefinition[];
  /** Skills from L2 project */
  skills: SkillDefinition[];
}

export interface AgentDefinition {
  /** Agent name */
  name: string;
  /** Agent type (tier) */
  tier: 'high' | 'medium' | 'low';
  /** Agent model */
  model: string;
  /** Agent description */
  description?: string;
  /** Phases this agent works in */
  phases?: number[];
  /** Agents this agent hands off to */
  handoffTo?: string[];
  /** Agents that hand off to this agent */
  handoffFrom?: string[];
}

export interface SkillDefinition {
  /** Skill name */
  name: string;
  /** Skill description */
  description?: string;
  /** Skill triggers */
  triggers?: string[];
}

export interface GeneratedVariant {
  /** Path to generated variant */
  variantPath: string;
  /** Path to variant.json */
  variantJsonPath: string;
  /** Generated directory structure */
  directories: string[];
  /** Generated agent override files */
  agentOverrides: string[];
  /** Generated skill directories */
  skillDirectories: string[];
  /** Generated AGENTS.md path */
  agentsMdPath: string;
  /** Generated README.md path */
  readmePath: string;
  /** Generated README_ko.md path */
  readmeKoPath: string;
  /** Generated skills/SKILLS.md path */
  skillsIndexPath: string;
  /** Generated <variant>.context.md path */
  contextMdPath: string;
  /** Generation summary */
  summary: {
    totalFilesCreated: number;
    totalDirectoriesCreated: number;
    agentsInRoster: number;
    skillsCreated: number;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================()

const WORKSPACE_ROOT = process.cwd();
const TEMPLATES_DIR = join(WORKSPACE_ROOT, 'templates');
const COMMON_TEMPLATE = join(TEMPLATES_DIR, 'common');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Create directory recursively with error handling
 * @version 1.1.0
 */
function createDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Normalize agent frontmatter when copying from L2 source to variant template.
 *
 * Strips L2-only fields (lifecycle, formal_name, variant) that do not belong in
 * standard variant agent files, and ensures all four tier platforms are present
 * (claude, gemini, antigravity, gemini-cli) by inheriting the claude tier value.
 *
 * @version 1.0.0
 */
export function normalizeAgentFrontmatter(content: string): string {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)([\s\S]*)$/);
  if (!fmMatch) return content;

  const [, open, fm, close, body] = fmMatch;

  // Strip L2-only fields
  const L2_ONLY_FIELDS = ['lifecycle', 'formal_name', 'variant'];
  let normalized = fm;

  for (const field of L2_ONLY_FIELDS) {
    // Match single-line field: "field: value"
    // Match block field: "field:\n  key: val\n  key2: val2" (indented sub-keys)
    normalized = normalized.replace(
      new RegExp(`^${field}:[ \\t]*.*(?:\\n[ \\t]+.*)*\\n?`, 'gm'),
      ''
    );
  }

  // Add missing tier platforms — inherit from claude tier if absent
  const claudeTierMatch = normalized.match(/^(\s+)claude:\s*(high|medium|low)/m);
  if (claudeTierMatch) {
    const indent = claudeTierMatch[1];
    const tier = claudeTierMatch[2];
    const platforms = ['gemini', 'antigravity', 'gemini-cli'] as const;
    for (const platform of platforms) {
      if (!new RegExp(`^${indent}${platform}:`, 'm').test(normalized)) {
        // Insert after the claude: line
        normalized = normalized.replace(
          new RegExp(`(^${indent}claude:\\s*${tier})`, 'm'),
          `$1\n${indent}${platform}: ${tier}`
        );
      }
    }
  }

  // Clean up consecutive blank lines left by removed fields
  normalized = normalized.replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n+$/, '');

  return `${open}${normalized}${close}${body}`;
}

/**
 * Copy file with UTF-8 handling
 * @version 1.1.0
 */
function copyFileUTF8(sourcePath: string, targetPath: string): void {
  try {
    const content = readUTF8File(sourcePath);
    writeUTF8File(targetPath, content);
  } catch (error) {
    throw fatalError(
      ErrorPhase.VARIANT_GENERATION,
      'FILE_COPY_FAILED',
      `Failed to copy file from ${sourcePath} to ${targetPath}`,
      error instanceof Error ? error.message : String(error),
      'Ensure source file exists and is readable'
    );
  }
}

/**
 * Substitute placeholders in template content
 * @version 1.1.0
 */
function substitutePlaceholders(content: string, metadata: VariantMetadata): string {
  const placeholders: Record<string, string> = {
    '{{VARIANT_NAME}}': metadata.name,
    '{{VARIANT_DESCRIPTION}}': metadata.description,
    '{{VARIANT_TYPE}}': metadata.variantType,
    '{{VARIANT_STATUS}}': metadata.status,
    '{{VARIANT_VERSION}}': metadata.version,
    '{{INHERITS_COMMON}}': metadata.inherits_common,
  };

  let result = content;
  for (const [placeholder, value] of Object.entries(placeholders)) {
    result = result.split(placeholder).join(value);
  }

  return result;
}

// ============================================================================
// VARIANT STRUCTURE GENERATION
// ============================================================================

/**
 * Generate variant.json from metadata
 * @version 1.1.0
 */
function generateVariantJson(metadata: VariantMetadata): string {
  const today = new Date().toISOString().split('T')[0];
  const variantJson = {
    name: metadata.name,
    description: metadata.description,
    variant_type: metadata.variantType,
    status: metadata.status,
    version: metadata.version,
    inherits_common: metadata.inherits_common,
    created_at: new Date().toISOString(),
    lifecycle: {
      statusSince: today,
      lastTransition: `initial → ${metadata.status} on ${today}`,
      stablePromotedOn: metadata.status === 'stable' ? today : null,
    },
    agents: metadata.agentRoster.map(agent => ({
      name: agent.name,
      file: `agents/${agent.name}.md`,
    })),
    skills: metadata.skills.map(skill => ({
      name: skill.name,
    })),
  };

  return JSON.stringify(variantJson, null, 2);
}

/**
 * Create variant directory structure
 * @version 1.2.0
 */
function createDirectoryStructure(variantPath: string): string[] {
  const directories = [
    join(variantPath, 'agents'),
    join(variantPath, 'docs'),
    join(variantPath, 'skills'),
    join(variantPath, '.claude'),
    join(variantPath, '.claude', 'agents'),
    join(variantPath, '.claude', 'skills'),
    join(variantPath, '.claude', 'commands'),
    join(variantPath, '.gemini'),
    join(variantPath, '.gemini', 'agents'),
    join(variantPath, '.gemini', 'skills'),
    join(variantPath, '.gemini', 'commands'),
  ];

  for (const dir of directories) {
    createDirectory(dir);
  }

  return directories;
}

/**
 * Generate agent override files
 * @version 1.1.0
 */
function generateAgentOverrides(
  variantPath: string,
  metadata: VariantMetadata,
  manifest: ReconciledManifest
): string[] {
  const agentOverrides: string[] = [];

  // Process agent files from manifest
  for (const file of manifest.keepInVariant) {
    const normalizedTarget = file.targetPath.replace(/\\/g, '/');
    if (normalizedTarget.startsWith('agents/') && normalizedTarget.endsWith('.md')) {
      const agentName = normalizedTarget.replace('agents/', '').replace('.md', '');
      const overridePath = join(variantPath, file.targetPath);
      // Guard against path traversal in manifest targetPath
      if (!resolve(overridePath).startsWith(resolve(WORKSPACE_ROOT))) {
        throw new Error(`Path traversal detected: ${file.targetPath} resolves outside workspace`);
      }

      // Check if source exists (from L2 project)
      if (existsSync(file.sourcePath)) {
        // Skip README files — normalize only specialist agent files
        const isSpecialistAgent = !['README.md', 'README_ko.md', 'pm.md'].includes(
          normalizedTarget.replace('agents/', '')
        );
        if (isSpecialistAgent) {
          const raw = readUTF8File(file.sourcePath);
          writeUTF8File(overridePath, normalizeAgentFrontmatter(raw));
        } else {
          copyFileUTF8(file.sourcePath, overridePath);
        }
        agentOverrides.push(overridePath);
      } else {
        // Generate minimal override from common template
        const commonAgentPath = join(COMMON_TEMPLATE, file.targetPath);
        if (existsSync(commonAgentPath)) {
          const content = readUTF8File(commonAgentPath);
          const substituted = substitutePlaceholders(content, metadata);
          writeUTF8File(overridePath, substituted);
          agentOverrides.push(overridePath);
        }
      }
    }
  }

  return agentOverrides;
}

/**
 * Generate skill directories and files
 * @version 1.1.0
 */
function generateSkillDirectories(
  variantPath: string,
  metadata: VariantMetadata,
  manifest: ReconciledManifest
): string[] {
  const skillDirectories: string[] = [];

  // Group skill files by skill name
  const skillFiles = new Map<string, ReconciledFile[]>();

  for (const file of manifest.keepInVariant) {
    if (file.targetPath.includes('skills/') && file.targetPath.endsWith('.md')) {
      // Extract skill name from path (e.g., 'skills/meeting-facilitation/SKILL.md')
      const match = file.targetPath.match(/skills\/([^/]+)\//);
      if (match) {
        const skillName = match[1];
        if (!skillFiles.has(skillName)) {
          skillFiles.set(skillName, []);
        }
        skillFiles.get(skillName)!.push(file);
      }
    }
  }

  // Create skill directories
  for (const [skillName, files] of skillFiles.entries()) {
    const claudeSkillDir = join(variantPath, '.claude', 'skills', skillName);
    const geminiSkillDir = join(variantPath, '.gemini', 'skills', skillName);

    createDirectory(claudeSkillDir);
    createDirectory(geminiSkillDir);

    skillDirectories.push(claudeSkillDir, geminiSkillDir);

    // Copy skill files
    for (const file of files) {
      const isClaude = file.targetPath.includes('.claude/skills/');
      const isGemini = file.targetPath.includes('.gemini/skills/');

      if (isClaude) {
        const targetPath = join(variantPath, '.claude', 'skills', skillName, 'SKILL.md');
        if (existsSync(file.sourcePath)) {
          copyFileUTF8(file.sourcePath, targetPath);
        }
      }

      if (isGemini) {
        const targetPath = join(variantPath, '.gemini', 'skills', skillName, 'SKILL.md');
        if (existsSync(file.sourcePath)) {
          copyFileUTF8(file.sourcePath, targetPath);
        }
      }
    }
  }

  return skillDirectories;
}

// ============================================================================
// AGENTS.md GENERATION — placeholder injection
// ============================================================================

/**
 * Parse YAML frontmatter from agent .md file content.
 * Handles: scalars, inline arrays, list items, nested objects, block scalars (> and |).
 */
function parseAgentFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const result: Record<string, unknown> = {};
  let currentKey = '';
  let blockScalar = false;
  let blockLines: string[] = [];

  function flushBlock() {
    if (blockScalar && currentKey) {
      result[currentKey] = blockLines.join(' ').trim();
      blockLines = [];
      blockScalar = false;
    }
  }

  for (const line of lines) {
    // Top-level key (no leading whitespace)
    const topMatch = line.match(/^([\w][\w-]*):\s*(.*)/);
    if (topMatch) {
      flushBlock();
      currentKey = topMatch[1];
      const val = topMatch[2].trim();
      if (val === '>' || val === '|') {
        blockScalar = true;
        blockLines = [];
      } else if (val === '') {
        // Will be populated by nested lines
        result[currentKey] = {};
      } else if (val.startsWith('[')) {
        result[currentKey] = val
          .replace(/[\[\]]/g, '').split(',')
          .map(s => s.trim()).filter(Boolean)
          .map(s => (isNaN(Number(s)) ? s : Number(s)));
      } else {
        result[currentKey] = val.replace(/^['"]|['"]$/g, '');
      }
      continue;
    }

    // Block scalar continuation (2-space indent)
    if (blockScalar && line.startsWith('  ')) {
      blockLines.push(line.trim());
      continue;
    }

    // Nested key: value (2-space indent, e.g. "  claude: high")
    const nestedKV = line.match(/^  ([\w][\w-]*):\s*(.*)/);
    if (nestedKV && !blockScalar) {
      flushBlock();
      const parentVal = result[currentKey];
      if (typeof parentVal === 'object' && parentVal !== null && !Array.isArray(parentVal)) {
        (parentVal as Record<string, unknown>)[nestedKV[1]] = nestedKV[2].trim().replace(/^['"]|['"]$/g, '');
      }
      continue;
    }

    // List item (2-space indent + dash)
    const listItem = line.match(/^  - (.*)/);
    if (listItem && !blockScalar) {
      const item = listItem[1].trim().replace(/^['"]|['"]$/g, '');
      if (!Array.isArray(result[currentKey])) result[currentKey] = [];
      (result[currentKey] as unknown[]).push(isNaN(Number(item)) ? item : Number(item));
      continue;
    }

    // Blank line ends block scalar
    if (blockScalar && line.trim() === '') {
      flushBlock();
    }
  }
  flushBlock();
  return result;
}

/**
 * Extract AgentDefinition from an agent .md file.
 * Reads name, tier (claude platform), model, description, phases, handoffTo, handoffFrom.
 */
function parseAgentFile(filePath: string): AgentDefinition | null {
  if (!existsSync(filePath)) return null;
  const content = readUTF8File(filePath);
  const fm = parseAgentFrontmatter(content);
  const name = fm['name'] as string;
  if (!name || name === 'pm') return null; // skip pm

  // tier: may be nested (tier.claude) or flat
  let tier: 'high' | 'medium' | 'low' = 'medium';
  if (typeof fm['tier'] === 'object' && fm['tier'] !== null) {
    const t = (fm['tier'] as Record<string, string>)['claude'];
    if (t === 'high' || t === 'medium' || t === 'low') tier = t;
  } else if (fm['tier'] === 'high' || fm['tier'] === 'medium' || fm['tier'] === 'low') {
    tier = fm['tier'] as 'high' | 'medium' | 'low';
  }

  const model = (fm['model'] as string) ?? 'inherit';
  const description = (fm['description'] as string) ?? (fm['role'] as string) ?? '';
  const phases = Array.isArray(fm['phases'])
    ? (fm['phases'] as number[]).filter(p => typeof p === 'number')
    : [];
  const handoffTo = Array.isArray(fm['handoff_to'])
    ? (fm['handoff_to'] as string[])
    : [];
  const handoffFrom = Array.isArray(fm['handoff_from'])
    ? (fm['handoff_from'] as string[])
    : [];

  return { name, tier, model, description, phases, handoffTo, handoffFrom };
}

/**
 * Scan agent files from the manifest and build AgentDefinition[].
 * Reads YAML frontmatter directly from agent .md source files.
 */
function readAgentRosterFromManifest(manifest: ReconciledManifest): AgentDefinition[] {
  const agents: AgentDefinition[] = [];
  for (const file of manifest.keepInVariant) {
    const normalizedTarget = file.targetPath.replace(/\\/g, '/');
    if (
      normalizedTarget.startsWith('agents/') &&
      normalizedTarget.endsWith('.md') &&
      normalizedTarget !== 'agents/pm.md' &&
      !normalizedTarget.includes('README') &&
      !normalizedTarget.includes('handoff-spec')
    ) {
      const agent = parseAgentFile(file.sourcePath);
      if (agent) agents.push(agent);
    }
  }
  return agents;
}

// ── PlaceholderGenerator map ──────────────────────────────────────────────────

function generateAgentRosterRows(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const desc = a.description
        ? a.description.replace(/\n/g, ' ').substring(0, 120)
        : `${a.name} specialist`;
      return `| **${a.name}** | [\`agents/${a.name}.md\`](agents/${a.name}.md) | ${a.tier.charAt(0).toUpperCase() + a.tier.slice(1)} | ${desc} |`;
    })
    .join('\n');
}

function generateAgentDetailSections(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const desc = a.description
        ? a.description.replace(/\n/g, ' ').trim()
        : `${a.name} specialist`;
      const phases = a.phases && a.phases.length > 0 ? a.phases.join(', ') : '—';
      return (
        `### ${a.name}\n\n` +
        `| Field | Value |\n` +
        `|-------|-------|\n` +
        `| **File** | [\`agents/${a.name}.md\`](agents/${a.name}.md) |\n` +
        `| **Tier** | ${a.tier} |\n` +
        `| **Phases** | ${phases} |\n` +
        `| **Role** | ${desc} |`
      );
    })
    .join('\n\n');
}

function generateDispatchTriggerRows(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const phases =
        a.phases && a.phases.length > 0
          ? a.phases.map(p => `Phase ${p}`).join(', ')
          : '—';
      const trigger = `"${a.name} task needed", "${a.name} work required"`;
      return `| \`${a.name}\` | ${phases} | ${trigger} |`;
    })
    .join('\n');
}

function generatePhaseGateRows(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const phase =
        a.phases && a.phases.length > 0 ? `Phase ${a.phases[0]}` : 'Phase 4';
      const deliverable = a.description
        ? a.description.split('.')[0].trim().substring(0, 80)
        : `${a.name} deliverable`;
      return `| ${deliverable} | ${phase} | \`${a.name}\` | ${a.tier} | |`;
    })
    .join('\n');
}

function generateSubagentRosterRows(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const parallel = a.tier === 'low' ? '✅' : '⚠️ sequential preferred';
      const writeScope = a.tier === 'high' ? 'orchestrates only' : 'project files';
      return `| ${a.name} | \`agents/${a.name}.md\` | ${a.tier.charAt(0).toUpperCase() + a.tier.slice(1)} | ${parallel} | ${writeScope} |`;
    })
    .join('\n');
}

function generateRoleBoundaryRows(agents: AgentDefinition[]): string {
  if (agents.length === 0) return '';
  return agents
    .map(a => {
      const scenario = a.description
        ? a.description.split('.')[0].trim().substring(0, 80)
        : `${a.name} task needed`;
      return `| ${scenario} | \`${a.name}\` | \`pm\` |`;
    })
    .join('\n');
}

type PlaceholderGeneratorFn = (agents: AgentDefinition[]) => string;

const PLACEHOLDER_GENERATORS: Record<string, PlaceholderGeneratorFn> = {
  'VARIANT-AGENTS': generateAgentRosterRows,
  'VARIANT-AGENT-DETAILS': generateAgentDetailSections,
  'VARIANT-DISPATCH-TRIGGERS': generateDispatchTriggerRows,
  'VARIANT-PHASE-GATE': generatePhaseGateRows,
  'VARIANT-SUBAGENT-ROSTER': generateSubagentRosterRows,
  'VARIANT-ROLE-BOUNDARY': generateRoleBoundaryRows,
};

/**
 * Inject variant-specific content into all VARIANT-*-START/END placeholder blocks.
 * If agents array is empty, leaves placeholder comments intact (no-op per design).
 */
function injectVariantPlaceholders(content: string, agents: AgentDefinition[]): string {
  if (agents.length === 0) return content;

  let result = content;
  for (const [key, generator] of Object.entries(PLACEHOLDER_GENERATORS)) {
    const startTag = `<!-- ${key}-START -->`;
    const endTag = `<!-- ${key}-END -->`;
    const startIdx = result.indexOf(startTag);
    const endIdx = result.indexOf(endTag);
    if (startIdx === -1 || endIdx === -1) continue;

    const generated = generator(agents);
    if (!generated) continue;

    // Replace everything between START and END (exclusive of tags) with generated content
    const before = result.substring(0, startIdx + startTag.length);
    const after = result.substring(endIdx);
    result = `${before}\n${generated}\n${after}`;
  }
  return result;
}

/**
 * Generate AGENTS.md from L1 template with variant placeholder injection.
 * Reads agent files from manifest, fills VARIANT-* blocks, writes to variantPath/AGENTS.md.
 *
 * @version 1.2.0
 */
function generateAgentsMd(
  variantPath: string,
  metadata: VariantMetadata,
  manifest: ReconciledManifest
): string {
  const l1AgentsMd = join(COMMON_TEMPLATE, 'AGENTS.md');
  if (!existsSync(l1AgentsMd)) {
    throw fatalError(
      ErrorPhase.VARIANT_GENERATION,
      'L1_AGENTS_MD_NOT_FOUND',
      `L1 AGENTS.md not found at: ${l1AgentsMd}`,
      undefined,
      'Run --governance-l1 to publish AGENTS.md to templates/common/'
    );
  }

  let content = readUTF8File(l1AgentsMd);

  // Build agent roster from manifest agent files (preferred) or metadata.agentRoster
  const agents =
    manifest.keepInVariant.length > 0
      ? readAgentRosterFromManifest(manifest)
      : metadata.agentRoster;

  content = injectVariantPlaceholders(content, agents);

  const outputPath = join(variantPath, 'AGENTS.md');
  createDirectory(dirname(outputPath));
  writeUTF8File(outputPath, content);
  return outputPath;
}

/**
 * Generate CLAUDE.md from template
 * @version 1.1.0
 */
function generateClaudeMd(variantPath: string, metadata: VariantMetadata, manifest: ReconciledManifest): string {
  const claudeMdPath = join(variantPath, 'CLAUDE.md');

  // Try to use L2 project's CLAUDE.md if it exists in manifest
  const claudeMdFile = manifest.keepInVariant.find(f => f.targetPath === 'CLAUDE.md');

  if (claudeMdFile && existsSync(claudeMdFile.sourcePath)) {
    copyFileUTF8(claudeMdFile.sourcePath, claudeMdPath);
    return claudeMdPath;
  }

  // Fall back to common template with substitution
  const commonClaudeMd = join(COMMON_TEMPLATE, 'CLAUDE.md');
  if (existsSync(commonClaudeMd)) {
    const content = readUTF8File(commonClaudeMd);
    const substituted = substitutePlaceholders(content, metadata);
    writeUTF8File(claudeMdPath, substituted);
    return claudeMdPath;
  }

  // Generate minimal CLAUDE.md
  const minimalContent = `# ${metadata.name}

> **Variant Type**: ${metadata.variantType}
> **Status**: ${metadata.status} (${metadata.version})
> **Inherits**: ${metadata.inherits_common}

---

${metadata.description}

## Agent Roster

${metadata.agentRoster.map(agent => `- **${agent.name}** (${agent.tier}): ${agent.model}`).join('\n')}

## Skills

${metadata.skills.map(skill => `- **${skill.name}**: ${skill.description || skill.triggers?.join(', ') || ''}`).join('\n')}

---

**Generated**: ${new Date().toISOString()}
`;

  writeUTF8File(claudeMdPath, minimalContent);
  return claudeMdPath;
}

/**
 * Generate GEMINI.md from template
 * @version 1.1.0
 */
function generateGeminiMd(variantPath: string, metadata: VariantMetadata, manifest: ReconciledManifest): string {
  const geminiMdPath = join(variantPath, 'GEMINI.md');

  // Try to use L2 project's GEMINI.md if it exists in manifest
  const geminiMdFile = manifest.keepInVariant.find(f => f.targetPath === 'GEMINI.md');

  if (geminiMdFile && existsSync(geminiMdFile.sourcePath)) {
    copyFileUTF8(geminiMdFile.sourcePath, geminiMdPath);
    return geminiMdPath;
  }

  // Fall back to common template with substitution
  const commonGeminiMd = join(COMMON_TEMPLATE, 'GEMINI.md');
  if (existsSync(commonGeminiMd)) {
    const content = readUTF8File(commonGeminiMd);
    const substituted = substitutePlaceholders(content, metadata);
    writeUTF8File(geminiMdPath, substituted);
    return geminiMdPath;
  }

  // Clone CLAUDE.md for MVP
  const claudeMdPath = join(variantPath, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const content = readUTF8File(claudeMdPath);
    writeUTF8File(geminiMdPath, content);
    return geminiMdPath;
  }

  return geminiMdPath;
}

/**
 * Generate README.md with beta warning
 * @version 1.1.0
 */
function generateReadme(variantPath: string, metadata: VariantMetadata): string {
  const readmePath = join(variantPath, 'README.md');

  const agentRosterRows = metadata.agentRoster.map(agent => {
    const role = agent.description
      ? agent.description.split('.')[0].trim().substring(0, 80)
      : `${agent.name} specialist`;
    return `| ${agent.name} | ${role} | ${agent.tier} | ${agent.model} |`;
  }).join('\n');

  const skillsList = metadata.skills.length > 0
    ? metadata.skills.map(skill => {
        const desc = skill.description || (skill.triggers ? skill.triggers.join(', ') : '');
        return `- **${skill.name}**: ${desc}`;
      }).join('\n')
    : '_(no variant-specific skills — see `.claude/skills/` for platform skills)_';

  const content = `---
content_hash: PLACEHOLDER
sync_version: 1
---

# ${metadata.name}

> **⚠️ BETA VARIANT** - Status: ${metadata.status} (v${metadata.version})
> This variant is in active development and should not be used in production environments.

---

${metadata.description}

## Quick Start

This is a beta variant of the workspace template. It inherits from \`${metadata.inherits_common}\` and includes variant-specific customizations.

### For Claude Code users:

See \`CLAUDE.md\` for detailed instructions.

### For Gemini CLI users:

See \`GEMINI.md\` for detailed instructions.

## Beta Status

This variant is currently in **beta** and requires:

- **Client Engagements**: 0/${getRequiredEngagements(metadata.variantType)} (see variant governance rules)
- **Beta Duration**: 0/${getRequiredBetaMonths(metadata.variantType)} months
- **Additional Checks**: Pending

See \`scripts/helpers/variant-governance-rules.ts\` for promotion criteria.

## Variant Type

**Type**: ${metadata.variantType}

This variant focuses on ${getVariantTypeDescription(metadata.variantType)}.

## Agent Roster

| Agent | Role | Tier | Model |
|-------|------|------|-------|
${agentRosterRows}

## Skills

${skillsList}

---

**Generated**: ${new Date().toISOString()}
**MVP Wave 3** - L2-to-Variant Pipeline
`;

  writeUTF8File(readmePath, content);
  return readmePath;
}

/**
 * Get required engagements for variant type
 * @version 1.1.0
 */
function getRequiredEngagements(variantType: string): number {
  const requirements: Record<string, number> = {
    security: 5,
    development: 3,
    design: 2,
    consulting: 2,
    collaboration: 2,
  };
  return requirements[variantType] || 2;
}

/**
 * Get required beta months for variant type
 * @version 1.1.0
 */
function getRequiredBetaMonths(variantType: string): number {
  const requirements: Record<string, number> = {
    security: 6,
    development: 3,
    design: 2,
    consulting: 2,
    collaboration: 2,
  };
  return requirements[variantType] || 2;
}

/**
 * Get variant type description
 * @version 1.1.0
 */
function getVariantTypeDescription(variantType: string): string {
  const descriptions: Record<string, string> = {
    security: 'Security-focused workflows, compliance validation, and vulnerability assessment',
    development: 'Development workflows, feature implementation, and integration testing',
    design: 'Design system compliance, accessibility standards, and UX consistency',
    consulting: 'Consulting methodologies, stakeholder alignment, and knowledge transfer',
    collaboration: 'Team workflows, communication patterns, and collaboration tools',
  };
  return descriptions[variantType] || 'custom workflows and capabilities';
}

/**
 * Generate README_ko.md (Korean README) for the variant
 * @version 1.0.0
 */
function generateReadmeKo(variantPath: string, metadata: VariantMetadata): string {
  const readmeKoPath = join(variantPath, 'README_ko.md');

  const agentTable = metadata.agentRoster
    .map(a => `| **${a.name}** | \`agents/${a.name}.md\` | ${a.description || `${a.name} 전문 에이전트`} |`)
    .join('\n');

  const skillList = metadata.skills
    .map(s => `- **${s.name}**: ${s.description || `${s.name} 스킬`}`)
    .join('\n');

  const content = `---
sync_version: 1
translated_from_hash: TBD
---

# ${metadata.name}

> **Status**: 🔶 Beta — v${metadata.version}

## 1. 팀 미션

**미션:** ${metadata.description}

## 2. AI 팀 소개

| 에이전트 | 파일 | 역할 |
|---------|------|------|
${agentTable}

## 3. 스킬

${skillList}

## 4. 의존성 설치

\`\`\`bash
bun --version   # audit.ts, dev-sync.ts 실행에 필요
\`\`\`

*Last Updated: ${new Date().toISOString().split('T')[0]} — ${metadata.name} variant template*
`;

  writeUTF8File(readmeKoPath, content);
  return readmeKoPath;
}

/**
 * Generate skills/SKILLS.md index for the variant
 * @version 1.0.0
 */
function generateSkillsIndex(variantPath: string, metadata: VariantMetadata): string {
  const skillsIndexPath = join(variantPath, 'skills', 'SKILLS.md');

  const skillTable = metadata.skills
    .map(s => `| ${s.name} | \`${s.name}/\` | ${s.description || `${s.name} skill`} |`)
    .join('\n');

  const content = `# Skills Index — ${metadata.name}

This directory contains variant-specific skills for the \`${metadata.name}\` template.

## Available Skills

| Skill | Directory | Purpose |
|-------|-----------|---------|
${skillTable}

## Usage

Skills are invoked by the PM orchestrator or by individual agents using the trigger phrases defined in each \`SKILL.md\` file.

See [\`agents/README.md\`](../agents/README.md) for the full workflow and agent handoff chain.

---

*Maintained by: ${metadata.name} variant team*
`;

  createDirectory(dirname(skillsIndexPath));
  writeUTF8File(skillsIndexPath, content);
  return skillsIndexPath;
}

/**
 * Copy L0 common skills from templates/common into the variant's .claude/ and .gemini/ skill dirs.
 * These 4 skills are required in every variant.
 * @version 1.0.0
 */
function copyL0CommonSkills(variantPath: string): void {
  const L0_COMMON_SKILLS = [
    'agent-lifecycle-manager',
    'finishing-a-development-branch',
    'platform-command-lifecycle-manager',
    'platform-skill-lifecycle-manager',
  ];

  const platforms = ['.claude', '.gemini'] as const;

  for (const platform of platforms) {
    for (const skillName of L0_COMMON_SKILLS) {
      const srcSkillMd = join(COMMON_TEMPLATE, platform, 'skills', skillName, 'SKILL.md');
      if (!existsSync(srcSkillMd)) {
        // agent-lifecycle-manager lives in workspace skills/, not common template
        const wsSkillMd = join(WORKSPACE_ROOT, 'skills', skillName, 'SKILL.md');
        if (existsSync(wsSkillMd)) {
          const destDir = join(variantPath, platform, 'skills', skillName);
          createDirectory(destDir);
          copyFileUTF8(wsSkillMd, join(destDir, 'SKILL.md'));
        }
        continue;
      }
      const destDir = join(variantPath, platform, 'skills', skillName);
      createDirectory(destDir);
      copyFileUTF8(srcSkillMd, join(destDir, 'SKILL.md'));
    }
  }
}

// ============================================================================
// CONTEXT.MD GENERATION — from canonical template
// ============================================================================

/**
 * Generate <variant>.context.md from the canonical template at
 * templates/common/docs/variant.context.template.md.
 * Replaces {{VARIANT_NAME}}, {{VERSION}}, and {{PM_ROLE_DESCRIPTION}} placeholders.
 *
 * @version 1.0.0
 */
function generateContextMd(variantPath: string, metadata: VariantMetadata): string {
  const templatePath = join(COMMON_TEMPLATE, 'docs', 'variant.context.template.md');

  if (!existsSync(templatePath)) {
    throw fatalError(
      ErrorPhase.VARIANT_GENERATION,
      'CONTEXT_TEMPLATE_NOT_FOUND',
      `variant.context.template.md not found at: ${templatePath}`,
      undefined,
      'Ensure templates/common/docs/variant.context.template.md exists'
    );
  }

  const contextPath = join(variantPath, 'docs', `${metadata.name}.context.md`);

  return applyContextTemplate(templatePath, contextPath, {
    variantName: metadata.name,
    version: metadata.version,
    pmRoleDescription: DEFAULT_PM_ROLE_DESCRIPTIONS[metadata.name] ?? 'Workflow management, dispatch, quality gates',
  });
}

// ============================================================================
// SETTINGS FILE GENERATION
// ============================================================================

/**
 * Generate .claude/settings.json with full Agent Teams config, mcpServers, and all hooks.
 * Produces the same structure as other stable variants (co-design, co-work, etc.).
 * @version 1.0.0
 */
function generateClaudeSettings(variantPath: string): string {
  const settingsPath = join(variantPath, '.claude', 'settings.json');
  const settings = {
    effortLevel: 'high',
    permissions: {
      deny: [
        'Bash(git push --force*)',
        'Bash(git push --force-with-lease*)',
        'Bash(*--no-verify*)',
        'Bash(rm -rf *)',
      ],
    },
    env: {
      CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1',
    },
    teammateMode: 'auto',
    mcpServers: {
      codegraph: {
        command: 'npx',
        args: ['@colbymchenry/codegraph@0.9.7', 'serve'],
      },
    },
    hooks: {
      SessionStart: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'git config core.hooksPath .githooks',
              statusMessage: 'Configuring git hooks...',
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            {
              type: 'command',
              command: 'bun scripts/hooks/post-write-lifecycle-check.ts',
              async: true,
              asyncRewake: true,
              statusMessage: 'Running post-edit lifecycle check...',
            },
          ],
          timeout: 60,
        },
      ],
      TeammateIdle: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'bun scripts/hooks/post-write-lifecycle-check.ts',
              async: true,
              asyncRewake: true,
              statusMessage: 'Running teammate idle lifecycle check...',
            },
          ],
          timeout: 60,
        },
      ],
      WorktreeCreate: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'git config core.hooksPath .githooks',
              async: true,
              statusMessage: 'Configuring git hooks in new worktree...',
            },
          ],
        },
      ],
      TaskCompleted: [
        {
          matcher: '',
          hooks: [
            {
              type: 'command',
              command: 'bun scripts/audit.ts',
              timeout: 60,
              async: true,
              statusMessage: 'Running QA audit on task completion...',
            },
          ],
        },
      ],
    },
  };

  createDirectory(dirname(settingsPath));
  writeUTF8File(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return settingsPath;
}

/**
 * Generate .gemini/settings.json with mcpServers, PostToolUse hook, and security policies.
 * Produces the same structure as other stable variants.
 * @version 1.0.0
 */
function generateGeminiSettings(variantPath: string): string {
  const settingsPath = join(variantPath, '.gemini', 'settings.json');
  const settings: Record<string, unknown> = {
    _comment:
      'Variant-specific overrides vs L1 (templates/common): unpinned codegraph version (-y) for auto-updates, PostToolUse lifecycle check hook added. These are intentional L2 variant settings.',
    mcpServers: {
      codegraph: {
        command: 'npx',
        args: ['-y', '@colbymchenry/codegraph', 'serve'],
      },
    },
    hooks: {
      SessionStart: [
        {
          type: 'command',
          command: 'git config core.hooksPath .githooks',
          statusMessage: 'Configuring git hooks...',
        },
      ],
      PostToolUse: [
        {
          matcher: 'Write|Edit',
          hooks: [
            {
              type: 'command',
              command: 'bun scripts/hooks/post-write-lifecycle-check.ts',
              statusMessage: 'Running post-edit lifecycle check...',
            },
          ],
        },
      ],
    },
    'terminal.executionPolicy': 'Auto',
    'artifact.reviewPolicy': 'Auto',
    'mcp.toolApproval': 'Manual',
    'terminal.denyList': [
      'rm -rf',
      'rm -r /',
      'chmod -R 777',
      'git push --force',
      'git reset --hard',
      'reboot',
      'shutdown',
      'format',
      'fdisk',
      'mkfs',
    ],
  };

  createDirectory(dirname(settingsPath));
  writeUTF8File(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  return settingsPath;
}

// ============================================================================
// MAIN GENERATION FUNCTION
// ============================================================================

/**
 * Generate variant from reconciled manifest and metadata
 * @version 1.1.0
 */
export async function generateVariant(
  metadata: VariantMetadata,
  manifest: ReconciledManifest,
  outputPath?: string
): Promise<GeneratedVariant> {
  console.log(`\n=== Generating Variant ===`);
  console.log(`Name: ${metadata.name}`);
  console.log(`Type: ${metadata.variantType}`);
  console.log(`Status: ${metadata.status} (${metadata.version})\n`);

  // Determine output path
  const variantPath = outputPath || join(TEMPLATES_DIR, metadata.name);

  // C-08: Validate variant path stays within workspace root (prevent path traversal)
  const resolvedVariantPath = resolve(variantPath);
  if (!resolvedVariantPath.startsWith(resolve(WORKSPACE_ROOT))) {
    throw new Error(`Security: variant path '${resolvedVariantPath}' escapes workspace root`);
  }

  const variantJsonPath = join(variantPath, 'variant.json');

  console.log(`Output path: ${variantPath}`);

  // Create variant directory structure
  console.log(`\n=== Creating Directory Structure ===`);
  const directories = createDirectoryStructure(variantPath);
  console.log(`Created ${directories.length} directories`);

  // Generate variant.json
  console.log(`\n=== Generating variant.json ===`);
  const variantJsonContent = generateVariantJson(metadata);
  writeUTF8File(variantJsonPath, variantJsonContent);
  console.log(`Created: ${variantJsonPath}`);

  // Generate agent overrides
  console.log(`\n=== Generating Agent Overrides ===`);
  const agentOverrides = generateAgentOverrides(variantPath, metadata, manifest);
  console.log(`Created ${agentOverrides.length} agent overrides`);

  // Generate skill directories
  console.log(`\n=== Generating Skill Directories ===`);
  const skillDirectories = generateSkillDirectories(variantPath, metadata, manifest);
  console.log(`Created ${skillDirectories.length} skill directories`);

  // Generate AGENTS.md
  console.log(`\n=== Generating AGENTS.md ===`);
  const agentsMdPath = generateAgentsMd(variantPath, metadata, manifest);
  console.log(`Created: ${agentsMdPath}`);

  // Generate README.md
  console.log(`\n=== Generating README.md ===`);
  const readmePath = generateReadme(variantPath, metadata);
  console.log(`Created: ${readmePath}`);

  // Generate README_ko.md
  console.log(`\n=== Generating README_ko.md ===`);
  const readmeKoPath = generateReadmeKo(variantPath, metadata);
  console.log(`Created: ${readmeKoPath}`);

  // Generate skills/SKILLS.md index
  console.log(`\n=== Generating skills/SKILLS.md ===`);
  const skillsIndexPath = generateSkillsIndex(variantPath, metadata);
  console.log(`Created: ${skillsIndexPath}`);

  // Copy L0 common skills to .claude/ and .gemini/
  console.log(`\n=== Copying L0 Common Skills ===`);
  copyL0CommonSkills(variantPath);
  console.log(`Copied L0 common skills to .claude/skills/ and .gemini/skills/`);

  // Generate .claude/settings.json and .gemini/settings.json
  console.log(`\n=== Generating Platform Settings ===`);
  const claudeSettingsPath = generateClaudeSettings(variantPath);
  console.log(`Created: ${claudeSettingsPath}`);
  const geminiSettingsPath = generateGeminiSettings(variantPath);
  console.log(`Created: ${geminiSettingsPath}`);

  // Generate <variant>.context.md from canonical template
  console.log(`\n=== Generating ${metadata.name}.context.md ===`);
  const contextMdPath = generateContextMd(variantPath, metadata);
  console.log(`Created: ${contextMdPath}`);

  // Copy remaining files from manifest
  console.log(`\n=== Copying Remaining Files ===`);
  let filesCopied = 0;

  // Files generated separately or that don't belong in a variant template
  const SKIP_IN_COPY = new Set([
    'CLAUDE.md',
    'GEMINI.md',
    'CHANGELOG.md',
    'AGENTS.md',
    'README.md',
    'README_ko.md',
    'variant.json',
    'skills/SKILLS.md',
    // L2 migration artifacts — not part of the variant template contract
    'docs/context.md',
    'docs/ARCHITECTURE.md',
    'docs/_ORIGIN.md',
    'docs/_COMMON_VERSION.md',
  ]);

  for (const file of manifest.keepInVariant) {
    // Skip already handled files and migration artifacts
    if (file.targetPath.startsWith('agents/') ||
        file.targetPath.startsWith('scripts/') ||
        file.targetPath.includes('skills/') ||
        SKIP_IN_COPY.has(file.targetPath)) {
      continue;
    }

    const targetPath = join(variantPath, file.targetPath);
    // Guard against path traversal in manifest targetPath
    if (!resolve(targetPath).startsWith(resolve(WORKSPACE_ROOT))) {
      throw new Error(`Path traversal detected: ${file.targetPath} resolves outside workspace`);
    }
    const targetDir = dirname(targetPath);
    createDirectory(targetDir);

    if (existsSync(file.sourcePath)) {
      copyFileUTF8(file.sourcePath, targetPath);
      filesCopied++;
    }
  }

  console.log(`Copied ${filesCopied} additional files`);

  // Compute summary
  const summary = {
    totalFilesCreated: agentOverrides.length + skillDirectories.length + filesCopied + 8, // +8 for json, agents.md, readme.md, readme_ko.md, skills/SKILLS.md, context.md, .claude/settings.json, .gemini/settings.json
    totalDirectoriesCreated: directories.length,
    agentsInRoster: metadata.agentRoster.length,
    skillsCreated: metadata.skills.length,
  };

  console.log(`\n=== Variant Generation Complete ===`);
  console.log(`Path: ${variantPath}`);
  console.log(`Files created: ${summary.totalFilesCreated}`);
  console.log(`Directories created: ${summary.totalDirectoriesCreated}`);
  console.log(`Agents in roster: ${summary.agentsInRoster}`);
  console.log(`Skills created: ${summary.skillsCreated}`);

  return {
    variantPath,
    variantJsonPath,
    directories,
    agentOverrides,
    skillDirectories,
    agentsMdPath,
    readmePath,
    readmeKoPath,
    skillsIndexPath,
    contextMdPath,
    summary,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const manifestArg = args.find(arg => arg.startsWith('--manifest='))?.split('=')[1];
  const metadataArg = args.find(arg => arg.startsWith('--metadata='))?.split('=')[1];
  const outputArg = args.find(arg => arg.startsWith('--output='))?.split('=')[1];

  if (!manifestArg || !metadataArg) {
    console.error('Usage: bun scripts/helpers/generate-variant.ts --manifest=<path> --metadata=<json-string> [--output=<path>]');
    process.exit(1);
  }

  try {
    // Load manifest
    const manifestJson = readFileSync(manifestArg, 'utf-8');
    const manifest = JSON.parse(manifestJson) as ReconciledManifest;

    // Parse metadata
    const metadata = JSON.parse(metadataArg) as VariantMetadata;

    // Generate variant
    const result = await generateVariant(metadata, manifest, outputArg);

    console.log('\n✅ Variant generation successful');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Variant generation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.main) {
  main().catch(console.error);
}
