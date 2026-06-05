#!/usr/bin/env tsx
/**
 * Variant Generator
 *
 * Generates variant project structure from reconciled manifest.
 * Creates variant.json, directory structure, agent overrides, and skill directories.
 *
 * @version 1.1.0
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

import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'fs';
import { ReconciledManifest, ReconciledFile } from './reconcile-with-l0-l1.js';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.js';
import { fatalError, warningError, ErrorPhase } from '../lib/error-handling.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface VariantMetadata {
  /** Variant name (e.g., 'co-consult', 'co-security') */
  name: string;
  /** Variant description */
  description: string;
  /** Variant type for governance rules */
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration';
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
  /** Generated CLAUDE.md path */
  claudeMdPath: string;
  /** Generated GEMINI.md path */
  geminiMdPath: string;
  /** Generated README.md path */
  readmePath: string;
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
  const variantJson = {
    name: metadata.name,
    description: metadata.description,
    variant_type: metadata.variantType,
    status: metadata.status,
    version: metadata.version,
    inherits_common: metadata.inherits_common,
    created_at: new Date().toISOString(),
    agents: metadata.agentRoster.map(agent => ({
      name: agent.name,
      tier: agent.tier,
      model: agent.model,
      description: agent.description || '',
    })),
    skills: metadata.skills.map(skill => ({
      name: skill.name,
      description: skill.description || '',
      triggers: skill.triggers || [],
    })),
  };

  return JSON.stringify(variantJson, null, 2);
}

/**
 * Create variant directory structure
 * @version 1.1.0
 */
function createDirectoryStructure(variantPath: string): string[] {
  const directories = [
    join(variantPath, 'agents'),
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
    if (file.targetPath.startsWith('agents/') && file.targetPath.endsWith('.md')) {
      const agentName = file.targetPath.replace('agents/', '').replace('.md', '');
      const overridePath = join(variantPath, file.targetPath);

      // Check if source exists (from L2 project)
      if (existsSync(file.sourcePath)) {
        copyFileUTF8(file.sourcePath, overridePath);
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

  const content = `# ${metadata.name}

> **⚠️ BETA VARIANT** - Status: ${metadata.status} (v${metadata.version})
> This variant is in active development and should not be used in production environments.

---

${metadata.description}

## Quick Start

This is a beta variant of the workspace template. It inherits from \`${metadata.inherits_common}\` and includes variant-specific customizations.

### For Claude Code users:

See \`CLAUDE.md\` for detailed instructions.

### For Gemini Code users:

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

| Agent | Tier | Model |
|-------|------|-------|
${metadata.agentRoster.map(agent => `| ${agent.name} | ${agent.tier} | ${agent.model} |`).join('\n')}

## Skills

${metadata.skills.map(skill => `- **${skill.name}**: ${skill.description || skill.triggers?.join(', ') || ''}`).join('\n')}

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

  // Generate CLAUDE.md
  console.log(`\n=== Generating CLAUDE.md ===`);
  const claudeMdPath = generateClaudeMd(variantPath, metadata, manifest);
  console.log(`Created: ${claudeMdPath}`);

  // Generate GEMINI.md
  console.log(`\n=== Generating GEMINI.md ===`);
  const geminiMdPath = generateGeminiMd(variantPath, metadata, manifest);
  console.log(`Created: ${geminiMdPath}`);

  // Generate README.md
  console.log(`\n=== Generating README.md ===`);
  const readmePath = generateReadme(variantPath, metadata);
  console.log(`Created: ${readmePath}`);

  // Copy remaining files from manifest
  console.log(`\n=== Copying Remaining Files ===`);
  let filesCopied = 0;

  for (const file of manifest.keepInVariant) {
    // Skip already handled files
    if (file.targetPath.startsWith('agents/') ||
        file.targetPath.includes('skills/') ||
        file.targetPath === 'CLAUDE.md' ||
        file.targetPath === 'GEMINI.md' ||
        file.targetPath === 'README.md' ||
        file.targetPath === 'variant.json') {
      continue;
    }

    const targetPath = join(variantPath, file.targetPath);
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
    totalFilesCreated: agentOverrides.length + skillDirectories.length + filesCopied + 4, // +4 for json, claude.md, gemini.md, readme.md
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
    claudeMdPath,
    geminiMdPath,
    readmePath,
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
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
