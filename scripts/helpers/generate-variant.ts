#!/usr/bin/env bun
/**
 * Variant Generator
 *
 * Generates variant project structure from reconciled manifest.
 * Creates variant.json, directory structure, agent overrides, and skill directories.
 *
 * @version 1.13.1
 * @phase 3: Variant Generation
 *
 * Dependencies:
 * - helpers/scan-l3-project.ts (File classification types)
 * - helpers/reconcile-with-l0-l1.ts (Reconciled manifest types)
 * - helpers/variant-governance-rules.ts (Variant type definitions)
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 * - lib/platform-context.ts (Platform detection)
 */

import { join, dirname, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { ReconciledManifest, ReconciledFile } from './reconcile-with-l0-l1.ts';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.ts';
import { fatalError, warningError, ErrorPhase } from '../lib/error-handling.ts';
import { applyContextTemplate, applyTemplate, DEFAULT_PM_ROLE_DESCRIPTIONS } from './template-utils.ts';
import type { VariantType } from './registries/variant-type-registry.ts';
import { getVariantTypeDefinition } from './registries/variant-type-registry.ts';
import { getPromotionPolicy } from './registries/promotion-policy.ts';
import { SKIP_AGENT_FILES } from './golden-reference-loader.ts';
import type { L3ScanResult } from './scan-l3-project.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VariantMetadata {
  /** Variant name (e.g., 'co-consult', 'co-security') */
  name: string;
  /** Variant description */
  description: string;
  /** Variant type for governance rules */
  variantType: VariantType;
  /** Lifecycle status — defaults to 'beta' for new variants */
  status: string;
  /** Version — defaults to '0.1.0' for new variants */
  version: string;
  /** Inherits from templates/common */
  inherits_common: string;
  /** Agent roster from L3 project */
  agentRoster: AgentDefinition[];
  /** Skills from L3 project */
  skills: SkillDefinition[];
  /** Optional: Lecture variant — agent pipeline order and optional flags */
  agent_manifest?: {
    variant_agents_dir: string;
    pipeline_order: string[];
    optional: string[];
    notes: string;
  };
  /** Optional: Lecture variant — HTML theme configuration */
  theme_manifest?: {
    themes_dir: string;
    base_css: string;
    available: string[];
    default: string;
    overrides_dir: string;
    notes?: string;
  };
  /** Optional: Lecture variant — lecture profile template metadata */
  lecture_profile?: {
    template_path: string;
    required_fields: string[];
    notes?: string;
  };
  /** Optional: README narrative prose for hand-authored (stable) variants. When omitted,
   *  the generator renders generic default prose for each narrative section. */
  readmeNarrative?: {
    overview?: string;
    mission?: string;
    teamIntro?: string;
    howToIntro?: string;
    workflowPhases?: string;
    quickStartBody?: string;
  };
  /** Optional: Custom fields from L3 source variant.json (engagement_methodology, etc.) */
  [key: string]: unknown;
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
 * Normalize agent frontmatter when copying from L3 source to variant template.
 *
 * Strips L3-only fields (formal_name, variant) that do not belong in standard
 * variant agent files, and ensures all four tier platforms are present
 * (claude, gemini, antigravity, gemini-cli) by inheriting the claude tier value.
 *
 * `lifecycle` is deliberately PRESERVED (v1.1.0): L2 variant agents carry
 * lifecycle frontmatter that their docs/lifecycle/agents/<name>.md governance
 * records reference — stripping it forced manual backfills of 59 agents (PR
 * #588) and 11 more (co-hr, 2026-08-23). Only templates/common/agents/pm.md
 * must stay lifecycle-free (audit L0-only check), and that file is never
 * routed through this normalizer.
 *
 * @version 1.1.0
 */
export function normalizeAgentFrontmatter(content: string): string {
  const fmMatch = content.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)([\s\S]*)$/);
  if (!fmMatch) return content;

  const [, open, fm, close, body] = fmMatch;

  // Strip L3-only fields
  const L3_ONLY_FIELDS = ['formal_name', 'variant'];
  let normalized = fm;

  for (const field of L3_ONLY_FIELDS) {
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
  const canonicalKeys = new Set([
    'name', 'description', 'variantType', 'status', 'version', 'inherits_common',
    'agentRoster', 'skills', 'agent_manifest', 'theme_manifest', 'lecture_profile',
  ]);
  const customFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!canonicalKeys.has(key)) {
      customFields[key] = value;
    }
  }
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
    ...(metadata.agent_manifest && { agent_manifest: metadata.agent_manifest }),
    ...(metadata.theme_manifest && { theme_manifest: metadata.theme_manifest }),
    ...(metadata.lecture_profile && { lecture_profile: metadata.lecture_profile }),
    ...customFields,
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

      // Check if source exists (from L3 project)
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
 *
 * v1.2.0: normalizes targetPath separators before every prefix/match check —
 * on Windows path.relative() yields backslashes, so the old forward-slash
 * 'skills/' checks never matched and zero skill directories were created
 * (the co-hr promotion, 2026-08-23, logged "Skills created: 10" while
 * materializing none — same defect class as the v1.8.1 SKIP_IN_COPY fix).
 * Also materializes the top-level skills/<name>/ copy of the co-consult
 * layout, which was previously dropped by BOTH this function (platform dirs
 * only) and the copy-remaining loop (skips 'skills/' assuming this function
 * handled it).
 *
 * @version 1.2.0
 */
export function generateSkillDirectories(
  variantPath: string,
  metadata: VariantMetadata,
  manifest: ReconciledManifest
): string[] {
  const skillDirectories: string[] = [];

  // Group skill files by skill name
  const skillFiles = new Map<string, ReconciledFile[]>();

  for (const file of manifest.keepInVariant) {
    // Normalize to forward slashes so prefix checks match on Windows (same
    // normalization as the agent loop and the copy-remaining loop)
    const normalizedTarget = file.targetPath.replace(/\\/g, '/');
    if (normalizedTarget.includes('skills/') && normalizedTarget.endsWith('.md')) {
      // Extract skill name from path (e.g., 'skills/meeting-facilitation/SKILL.md')
      const match = normalizedTarget.match(/skills\/([^/]+)\//);
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
    const topLevelSkillDir = join(variantPath, 'skills', skillName);

    createDirectory(claudeSkillDir);
    createDirectory(geminiSkillDir);

    skillDirectories.push(claudeSkillDir, geminiSkillDir);

    // Copy skill files
    for (const file of files) {
      const normalizedTarget = file.targetPath.replace(/\\/g, '/');
      const isClaude = normalizedTarget.includes('.claude/skills/');
      const isGemini = normalizedTarget.includes('.gemini/skills/');

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

    // Top-level skills/<name>/SKILL.md (canonical co-consult layout): build it
    // from the source's top-level copy when present, else mirror a platform
    // copy, and backfill platform roots whose source had no platform file so
    // all three skill roots carry the skill.
    const canonicalSource =
      files.find((f) => f.targetPath.replace(/\\/g, '/').startsWith('skills/'))?.sourcePath ??
      files.find((f) => existsSync(f.sourcePath))?.sourcePath;
    if (canonicalSource && existsSync(canonicalSource)) {
      createDirectory(topLevelSkillDir);
      copyFileUTF8(canonicalSource, join(topLevelSkillDir, 'SKILL.md'));
      skillDirectories.push(topLevelSkillDir);

      for (const platformDir of [claudeSkillDir, geminiSkillDir]) {
        const platformDest = join(platformDir, 'SKILL.md');
        if (!existsSync(platformDest)) {
          copyFileUTF8(canonicalSource, platformDest);
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
 * CRLF-safe regex.
 */
export function parseAgentFrontmatter(content: string): Record<string, unknown> {
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
 * Uses CRLF-safe parseAgentFrontmatter internally.
 */
export function parseAgentFile(filePath: string): AgentDefinition | null {
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

  // Try to use L3 project's CLAUDE.md if it exists in manifest
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

  // Try to use L3 project's GEMINI.md if it exists in manifest
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

// ============================================================================
// README RENDERING (from templates/common/docs/README.template.md)
// The template IS the structural SSOT (validated by validate-templates.ts WS-08);
// these helpers only supply values. Default prose is used for generated/beta
// variants; hand-authored (stable) variants override via metadata.readmeNarrative.
// ============================================================================

/** Generic 5-phase workflow list used when a variant supplies no custom prose. */
const DEFAULT_WORKFLOW_PHASES = [
  '1. **Team Assembly:** The PM creates specialized agents/skills if required.',
  '2. **Triage:** The PM classifies the request; dispatches read-only agents in parallel.',
  '3. **Analysis:** The PM synthesizes findings into requirements + acceptance criteria.',
  '4. **Design:** An architect produces an implementation plan + ADR.',
  '5. **Implementation:** Specialists implement; the PM loops up to 3× on failures.',
  '6. **Finalization:** The PM logs decisions; runs `/sync`; opens a PR.',
].join('\n');

const DEFAULT_WORKFLOW_PHASES_KO = [
  '1. **팀 구성:** PM이 필요한 전문 에이전트/스킬을 생성합니다.',
  '2. **분류:** PM이 요청을 분류하고 읽기 전용 에이전트를 병렬로 배치합니다.',
  '3. **분석:** PM이 조사 결과를 요구사항 + 완료 기준으로 종합합니다.',
  '4. **설계:** 아키텍트가 구현 계획 + ADR을 작성합니다.',
  '5. **구현:** 전문가가 구현하고, PM은 실패 시 최대 3회까지 반복합니다.',
  '6. **마무리:** PM이 결정을 기록하고 `/sync`를 실행한 뒤 PR을 엽니다.',
].join('\n');

/** Render the unified status line for both stable and beta variants. */
function renderStatusLine(status: string, version: string): string {
  return status.toLowerCase() === 'stable'
    ? `✅ Stable — v${version}`
    : `⚠️ Beta — v${version}`;
}

/** Render the 4-column agent roster rows (PM fallback when roster is empty). */
function renderAgentRosterRows4Col(roster: AgentDefinition[]): string {
  const rows = roster.map(a => {
    const role = a.description
      ? a.description.split('.')[0].trim().substring(0, 80)
      : `${a.name} specialist`;
    return `| **${a.name}** | ${role} | ${a.tier} | ${a.model || 'inherit'} |`;
  });
  if (rows.length === 0) {
    rows.push('| **PM (Project Manager)** | Workflow management, dispatch, quality gates | high | inherit |');
  }
  return rows.join('\n');
}

/** Render the Skills section body (bullet list, or placeholder when empty). */
function renderSkillsBlock(skills: SkillDefinition[]): string {
  if (skills.length === 0) {
    return '_(no variant-specific skills — see `.claude/skills/` for platform skills)_';
  }
  return skills.map(s => {
    const desc = s.description || (s.triggers ? s.triggers.join(', ') : '');
    return `- **${s.name}**: ${desc}`;
  }).join('\n');
}

/** Render the beta-status block (engagement/months) for beta variants; empty for stable. */
function renderBetaBlock(variantType: VariantType, status: string, locale: 'en' | 'ko' = 'en'): string {
  if (status.toLowerCase() !== 'beta') return '';
  const engagements = getRequiredEngagements(variantType);
  const months = getRequiredBetaMonths(variantType);
  if (locale === 'ko') {
    return [
      '> **⚠️ 베타 변형** — 프로덕션 용도가 아닙니다.',
      '',
      `- **클라이언트 참여**: 0/${engagements} (변형 거버넌스 규칙 참조)`,
      `- **베타 기간**: 0/${months}개월`,
      '- **추가 검증**: 대기 중',
      '',
      '승급 기준은 `scripts/helpers/variant-governance-rules.ts`를 참조하세요.',
    ].join('\n');
  }
  return [
    '> **⚠️ Beta variant** — not for production use.',
    '',
    `- **Client Engagements**: 0/${engagements} (see variant governance rules)`,
    `- **Beta Duration**: 0/${months} months`,
    '- **Additional Checks**: Pending',
    '',
    'See `scripts/helpers/variant-governance-rules.ts` for promotion criteria.',
  ].join('\n');
}

/**
 * Build the README substitution map from VariantMetadata, applying readmeNarrative
 * overrides when present (stable/hand-authored variants) and generic default prose
 * otherwise (beta/generated variants). Shared by EN and KO rendering.
 * @version 1.0.0
 */
export function buildReadmeSubstitutions(metadata: VariantMetadata, locale: 'en' | 'ko'): Record<string, string> {
  const n = metadata.readmeNarrative ?? {};
  const ko = locale === 'ko';
  return {
    VARIANT_NAME: metadata.name,
    STATUS_LINE: renderStatusLine(metadata.status, metadata.version),
    TAGLINE: metadata.description,
    NARRATIVE_OVERVIEW: n.overview ?? (ko
      ? `${metadata.description}. 전체 아키텍처와 표준은 docs/context.md를 참고하세요.`
      : `${metadata.description}. See docs/context.md for full architecture and standards.`),
    QUICK_START_BODY: n.quickStartBody ?? (ko
      ? `이것은 워크스페이스 템플릿의 ${metadata.status} 변형입니다. \`${metadata.inherits_common}\`에서 상속하며 변형별 맞춤 설정을 포함합니다.`
      : `This is a ${metadata.status} variant of the workspace template. It inherits from \`${metadata.inherits_common}\` and includes variant-specific customizations.`),
    NARRATIVE_MISSION: n.mission ?? (ko ? `**미션:** ${metadata.description}` : `**Mission:** ${metadata.description}`),
    TEAM_INTRO_PROSE: n.teamIntro ?? (ko
      ? `당신의 파트너는 각기 고유한 역할을 가진 전문 에이전트들입니다. **프로젝트 매니저(PM)**가 유일한 진입점이며 나머지 팀을 조율합니다.`
      : `Your partners consist of specialized agents, each with a distinct role. The **Project Manager (PM)** is your single point of entry—they orchestrate the rest of the team.`),
    AGENT_ROSTER_ROWS: renderAgentRosterRows4Col(metadata.agentRoster),
    SKILLS_BLOCK: renderSkillsBlock(metadata.skills),
    NARRATIVE_HOWTO_INTRO: n.howToIntro ?? (ko
      ? `협업 방식은 품질을 극대화하고 충돌을 방지하도록 구조화되어 있습니다. 표준 워크플로는 다음과 같습니다:`
      : `Working with us is structured to maximize quality and prevent collisions. Here is our standard workflow:`),
    NARRATIVE_WORKFLOW_PHASES: n.workflowPhases ?? (ko ? DEFAULT_WORKFLOW_PHASES_KO : DEFAULT_WORKFLOW_PHASES),
    VARIANT_TYPE: metadata.variantType,
    VARIANT_TYPE_DESCRIPTION: getVariantTypeDescription(metadata.variantType),
    BETA_STATUS_BLOCK: renderBetaBlock(metadata.variantType, metadata.status, locale),
    LAST_UPDATED: new Date().toISOString().split('T')[0],
  };
}

/**
 * Generate README.md by rendering templates/common/docs/README.template.md.
 * The template IS the structural SSOT; this function only supplies values.
 * @version 2.0.0
 */
export function generateReadme(variantPath: string, metadata: VariantMetadata): string {
  const templatePath = join(COMMON_TEMPLATE, 'docs', 'README.template.md');

  if (!existsSync(templatePath)) {
    throw fatalError(
      ErrorPhase.VARIANT_GENERATION,
      'README_TEMPLATE_NOT_FOUND',
      `README.template.md not found at: ${templatePath}`,
      undefined,
      'Ensure templates/common/docs/README.template.md exists'
    );
  }

  const readmePath = join(variantPath, 'README.md');
  return applyTemplate(templatePath, readmePath, buildReadmeSubstitutions(metadata, 'en'));
}

/**
 * Get required engagements for variant type
 * @version 1.1.0
 */
function getRequiredEngagements(variantType: VariantType): number {
  return getPromotionPolicy(variantType).minEngagements;
}

/**
 * Get required beta months for variant type
 * @version 1.1.0
 */
function getRequiredBetaMonths(variantType: VariantType): number {
  return getPromotionPolicy(variantType).minBetaMonths;
}

/**
 * Get variant type description
 * @version 1.1.0
 */
function getVariantTypeDescription(variantType: VariantType): string {
  return getVariantTypeDefinition(variantType).description;
}

/**
 * Generate README_ko.md by rendering templates/common/docs/README_ko.template.md.
 * Korean mirror of generateReadme(); shares buildReadmeSubstitutions() with locale='ko'.
 * @version 2.0.0
 */
export function generateReadmeKo(variantPath: string, metadata: VariantMetadata): string {
  const templatePath = join(COMMON_TEMPLATE, 'docs', 'README_ko.template.md');

  if (!existsSync(templatePath)) {
    throw fatalError(
      ErrorPhase.VARIANT_GENERATION,
      'README_KO_TEMPLATE_NOT_FOUND',
      `README_ko.template.md not found at: ${templatePath}`,
      undefined,
      'Ensure templates/common/docs/README_ko.template.md exists'
    );
  }

  const readmeKoPath = join(variantPath, 'README_ko.md');
  return applyTemplate(templatePath, readmeKoPath, buildReadmeSubstitutions(metadata, 'ko'));
}

/**
 * Normalize scan relative paths to forward slashes (Windows uses backslashes).
 */
export function normalizeRelPath(relativePath: string): string {
  return relativePath.replaceAll('\\', '/');
}

/**
 * Extract agent roster from L3 scan result.
 * Skips pm.md, README.md, README_ko.md, and handoff-spec files.
 * @version 1.3.0
 */
export function extractAgentRoster(scanResult: L3ScanResult): VariantMetadata['agentRoster'] {
  const l3ProjectPath = scanResult.scanMetadata.l3ProjectPath;

  const agentFiles = scanResult.files.filter(f => {
    const relPath = normalizeRelPath(f.relativePath);
    if (!relPath.startsWith('agents/') || !relPath.endsWith('.md')) return false;
    const fileName = relPath.split('/').pop() ?? '';
    return !SKIP_AGENT_FILES.has(fileName) && !fileName.includes('handoff-spec');
  });

  return agentFiles
    .map(file => {
      const absPath = join(l3ProjectPath, file.relativePath);
      return parseAgentFile(absPath);
    })
    .filter((agent): agent is NonNullable<typeof agent> => agent !== null);
}

/**
 * Extract variant-specific skills from L3 scan result.
 * Only includes skills/ (not .claude/skills/ or .gemini/skills/ — those are L0 common).
 * When the L2 variant.json declares `skill_manifest.variant_specific`, only those skills are included;
 * otherwise falls back to all skill directories under skills/.
 * @version 1.4.0
 */
export function extractSkills(scanResult: L3ScanResult): VariantMetadata['skills'] {
  const l3ProjectPath = scanResult.scanMetadata.l3ProjectPath;

  // Variant-specific skills from L2 variant.json manifest (preferred)
  let variantSpecificNames: Set<string> | undefined;
  const variantJsonPath = join(l3ProjectPath, 'variant.json');
  if (existsSync(variantJsonPath)) {
    try {
      const variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
      const manifest = variantJson?.skill_manifest?.variant_specific;
      if (Array.isArray(manifest) && manifest.length > 0) {
        variantSpecificNames = new Set(
          manifest
            .map((s: { name?: unknown }) => (typeof s?.name === 'string' ? s.name : null))
            .filter((n: string | null): n is string => n !== null),
        );
      }
    } catch {
      // Ignore malformed variant.json — fall back to directory scan
    }
  }

  const skillFiles = scanResult.files.filter(f =>
    normalizeRelPath(f.relativePath).startsWith('skills/') && f.relativePath.endsWith('SKILL.md')
  );

  const skills: VariantMetadata['skills'] = [];
  const processedSkills = new Set<string>();

  for (const file of skillFiles) {
    const match = normalizeRelPath(file.relativePath).match(/skills\/([^/]+)\//);
    if (!match || processedSkills.has(match[1])) continue;
    if (variantSpecificNames && !variantSpecificNames.has(match[1])) continue;
    skills.push({ name: match[1] });
    processedSkills.add(match[1]);
  }

  return skills;
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

/**
 * WS-09 standard slots that must carry VARIANT-INJECT wrapper pairs in
 * <variant>.context.md. Seven slots wrap AFTER the `## ` heading;
 * `guidelines` is the sole [REQUIRED] slot and wraps immediately BEFORE its
 * heading (co-deck placement, mirrored by the 2026-08-23 co-hr promotion).
 */
const CONTEXT_INJECT_SLOTS = [
  { heading: 'Tech Stack', slot: 'tech-stack', beforeHeading: false },
  { heading: 'Agents', slot: 'agents', beforeHeading: false },
  { heading: 'Skills', slot: 'skills', beforeHeading: false },
  { heading: 'Environment Setup', slot: 'environment-setup', beforeHeading: false },
  { heading: 'Development Workflow', slot: 'development-workflow', beforeHeading: false },
  { heading: 'Guidelines', slot: 'guidelines', beforeHeading: true },
  { heading: 'File Organization Policy', slot: 'file-organization', beforeHeading: false },
  { heading: 'Domain Rules', slot: 'domain-rules', beforeHeading: false },
] as const;

/**
 * Ensure the 8 standard VARIANT-INJECT wrapper pairs exist in a variant's
 * context.md. The copy-remaining loop lets the L3 source's context.md
 * overwrite the marker-rich skeleton generated from the canonical template —
 * this re-applies missing wrappers around the WS-09 standard headings so the
 * variant contract (audit's VARIANT-INJECT: guidelines [REQUIRED] check)
 * holds without manual post-run fixes. Files that already carry a slot's
 * marker pass through unchanged (idempotent); absent headings are skipped
 * (WS-09 structural validation reports those separately).
 *
 * @version 1.0.0
 */
export function ensureVariantInjectMarkers(content: string): string {
  const lines = content.split(/\r?\n/);

  for (const { heading, slot, beforeHeading } of CONTEXT_INJECT_SLOTS) {
    if (content.includes(`VARIANT-INJECT: ${slot}`)) continue;

    const startMarker = `<!-- VARIANT-INJECT: ${slot}${slot === 'guidelines' ? ' [REQUIRED]' : ''} -->`;
    const headingIdx = lines.findIndex((line) => new RegExp(`^## ${heading}\\s*$`).test(line));
    if (headingIdx === -1) continue;

    // Section boundary: the next `---` separator or next ## heading after the
    // section body (### subsections stay inside the wrapper)
    let boundary = lines.length;
    for (let i = headingIdx + 1; i < lines.length; i++) {
      if (/^## /.test(lines[i]) || /^---\s*$/.test(lines[i])) {
        boundary = i;
        break;
      }
    }

    // END marker goes after the last non-blank content line
    let endInsertAt = boundary;
    while (endInsertAt > headingIdx + 1 && lines[endInsertAt - 1].trim() === '') {
      endInsertAt--;
    }
    lines.splice(endInsertAt, 0, '<!-- END VARIANT-INJECT -->');

    lines.splice(beforeHeading ? headingIdx : headingIdx + 1, 0, startMarker);
  }

  return lines.join('\n');
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
        command: 'bunx',
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
      'Variant-specific overrides vs L1 (templates/common). These are intentional L2 variant settings.',
    mcpServers: {
      codegraph: {
        command: 'bunx',
        args: ['@colbymchenry/codegraph@0.9.7', 'serve'],
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

  // Lecture-type: scaffold html-themes/ and presentations/ directories
  if (metadata.variantType === 'lecture') {
    for (const dir of [
      join(variantPath, 'docs', 'html-themes'),
      join(variantPath, 'docs', 'html-themes', 'base'),
      join(variantPath, 'docs', 'html-themes', 'overrides'),
      join(variantPath, 'presentations'),
    ]) {
      createDirectory(dir);
    }
    console.log(`Created lecture-specific directories: docs/html-themes/, presentations/`);
  }

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
    // L3 migration artifacts — not part of the variant template contract
    'docs/context.md',
    'docs/ARCHITECTURE.md',
    'docs/_ORIGIN.md',
    'docs/_COMMON_VERSION.md',
  ]);

  for (const file of manifest.keepInVariant) {
    // Normalize to forward slashes so SKIP_IN_COPY and prefix checks match on Windows,
    // where path.relative() yields backslashes (same normalization as the agent loop, L335).
    // Without this, an entry like 'docs/context.md' never matches 'docs\context.md' and the
    // stale immutable context leaks into the promoted variant template.
    const normalizedTarget = file.targetPath.replace(/\\/g, '/');
    // Skip already handled files and migration artifacts
    if (normalizedTarget.startsWith('agents/') ||
        normalizedTarget.startsWith('scripts/') ||
        normalizedTarget.includes('skills/') ||
        SKIP_IN_COPY.has(normalizedTarget)) {
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
      // The L3 source's <variant>.context.md overwrites the marker-rich
      // skeleton generated from the canonical template — re-apply the 8-slot
      // VARIANT-INJECT wrappers so the variant contract holds (v1.12.0).
      if (normalizedTarget === `docs/${metadata.name}.context.md`) {
        writeUTF8File(targetPath, ensureVariantInjectMarkers(readUTF8File(targetPath)));
      }
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
  const regenerateArg = args.find(arg => arg.startsWith('--regenerate='))?.split('=')[1];

  // --regenerate mode: re-render README.md for an existing variant
  if (regenerateArg) {
    if (!manifestArg || !metadataArg) {
      console.error('Usage: bun scripts/helpers/generate-variant.ts --regenerate=<variant> --manifest=<path> --metadata=<json-string>');
      process.exit(1);
    }

    try {
      // Load manifest
      const manifestJson = readFileSync(manifestArg, 'utf-8');
      const manifest = JSON.parse(manifestJson) as ReconciledManifest;

      // Parse metadata
      const metadata = JSON.parse(metadataArg) as VariantMetadata;

      // Locate variant directory
      const variantPath = resolve(process.cwd(), 'templates', regenerateArg);
      if (!existsSync(variantPath)) {
        console.error(`❌ Variant not found: templates/${regenerateArg}`);
        process.exit(1);
      }

      const readmePath = join(variantPath, 'README.md');
      const readmeTemplatePath = resolve(process.cwd(), 'templates', regenerateArg, 'README.template.md');

      if (!existsSync(readmeTemplatePath)) {
        console.error(`❌ README.template.md not found for variant ${regenerateArg}`);
        process.exit(1);
      }

      // Re-render README
      const readmeContent = await renderREADME(metadata, readmeTemplatePath);
      writeFileSync(readmePath, readmeContent, 'utf-8');

      console.log(`\n✅ README regenerated for templates/${regenerateArg}`);
      process.exit(0);
    } catch (error) {
      console.error('\n❌ README regeneration failed:');
      console.error(error);
      process.exit(1);
    }
    return;
  }

  // Normal generation mode
  if (!manifestArg || !metadataArg) {
    console.error('Usage: bun scripts/helpers/generate-variant.ts --manifest=<path> --metadata=<json-string> [--output=<path>]');
    console.error('   OR:  bun scripts/helpers/generate-variant.ts --regenerate=<variant> --manifest=<path> --metadata=<json-string>');
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
