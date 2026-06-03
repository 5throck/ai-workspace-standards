#!/usr/bin/env tsx
/**
 * Integration Helpers
 *
 * Integrates newly generated variant into workspace by updating:
 * - workspace root README.md
 * - scripts/new-project.ts (and .sh, .ps1 counterparts)
 * - docs/templates/VERSION_REGISTRY.json
 * - AGENTS.md PM Dispatch table
 *
 * @version 1.1.0
 * @phase 3: Workspace Integration
 *
 * Dependencies:
 * - helpers/generate-variant.ts (Variant metadata types)
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 */

import { join, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.js';
import { ErrorPhase, fatalError, warningError } from '../lib/error-handling.js';
import type { VariantMetadata } from './generate-variant.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface IntegrationResult {
  /** README.md was updated */
  readmeUpdated: boolean;
  /** new-project scripts were updated */
  newProjectUpdated: boolean;
  /** VERSION_REGISTRY.json was updated */
  versionRegistryUpdated: boolean;
  /** AGENTS.md was updated */
  agentsMdUpdated: boolean;
  /** Paths of updated files */
  updatedFiles: string[];
  /** Integration summary */
  summary: string;
}

export interface VersionRegistryEntry {
  /** Variant name */
  name: string;
  /** Variant type */
  variant_type: string;
  /** Current version */
  version: string;
  /** Status */
  status: 'beta' | 'stable';
  /** Inherits from */
  inherits: string;
  /** Created at */
  created_at: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================()

const WORKSPACE_ROOT = process.cwd();
const README_PATH = join(WORKSPACE_ROOT, 'README.md');
const NEW_PROJECT_TS = join(WORKSPACE_ROOT, 'scripts', 'new-project.ts');
const NEW_PROJECT_SH = join(WORKSPACE_ROOT, 'scripts', 'new-project.sh');
const NEW_PROJECT_PS1 = join(WORKSPACE_ROOT, 'scripts', 'new-project.ps1');
const VERSION_REGISTRY = join(WORKSPACE_ROOT, 'docs', 'templates', 'VERSION_REGISTRY.json');
const AGENTS_MD = join(WORKSPACE_ROOT, 'AGENTS.md');

// ============================================================================
// README.md INTEGRATION
// ============================================================================

/**
 * Update workspace root README.md with variant entry
 * @version 1.1.0
 */
function updateReadme(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating README.md ===`);

  if (!existsSync(README_PATH)) {
    console.warn(`README.md not found at ${README_PATH} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(README_PATH);

    // Check if variant already listed
    if (content.includes(`## Variant: ${metadata.name}`)) {
      console.log(`Variant ${metadata.name} already listed in README.md - skipping`);
      return false;
    }

    // Find variant section (look for "## Variants" or "## Templates" section)
    const variantsSectionRegex = /(## Variants|## Templates)([\s\S]*?)(##|$)/;
    const match = content.match(variantsSectionRegex);

    if (!match) {
      console.warn(`Could not find Variants/Templates section in README.md - appending variant entry`);
      // Append to end of file
      const variantEntry = `\n## Variant: ${metadata.name}\n\n**Type**: ${metadata.variantType}\n**Status**: ${metadata.status} (v${metadata.version})\n**Inherits**: ${metadata.inherits_common}\n\n${metadata.description}\n`;
      const updatedContent = content + variantEntry;
      writeUTF8File(README_PATH, updatedContent);
      console.log(`✅ Appended variant entry to README.md`);
      return true;
    }

    // Insert variant entry into section
    const sectionHeader = match[1];
    const sectionContent = match[2];
    const nextHeader = match[3];

    const variantEntry = `### ${metadata.name}\n\n- **Type**: ${metadata.variantType}\n- **Status**: ${metadata.status} (v${metadata.version})\n- **Inherits**: ${metadata.inherits_common}\n- **Description**: ${metadata.description}\n`;

    const updatedSection = `${sectionHeader}${sectionContent}\n${variantEntry}${nextHeader}`;
    const updatedContent = content.replace(variantsSectionRegex, updatedSection);

    writeUTF8File(README_PATH, updatedContent);
    console.log(`✅ Updated README.md with variant entry`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'README_UPDATE_FAILED',
      `Failed to update README.md: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// ============================================================================
// NEW-PROJECT SCRIPTS INTEGRATION
// ============================================================================

/**
 * Update new-project.ts with variant option
 * @version 1.1.0
 */
function updateNewProjectTs(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating new-project.ts ===`);

  if (!existsSync(NEW_PROJECT_TS)) {
    console.warn(`new-project.ts not found at ${NEW_PROJECT_TS} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(NEW_PROJECT_TS);

    // Check if variant already listed
    if (content.includes(`'${metadata.name}'`)) {
      console.log(`Variant ${metadata.name} already listed in new-project.ts - skipping`);
      return false;
    }

    // Find VARIANT_OPTIONS array
    const variantOptionsRegex = /(VARIANT_OPTIONS\s*=\s*\[)([\s\S]*?)(\])/;
    const match = content.match(variantOptionsRegex);

    if (!match) {
      console.warn(`Could not find VARIANT_OPTIONS array in new-project.ts - skipping`);
      return false;
    }

    const arrayStart = match[1];
    const arrayContent = match[2];
    const arrayEnd = match[3];

    // Add new variant option
    const newOption = `  '${metadata.name}',`;
    const updatedArrayContent = arrayContent.trim() + `\n${newOption}\n`;
    const updatedContent = content.replace(variantOptionsRegex, `${arrayStart}${updatedArrayContent}${arrayEnd}`);

    writeUTF8File(NEW_PROJECT_TS, updatedContent);
    console.log(`✅ Updated new-project.ts with variant option`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'NEW_PROJECT_TS_UPDATE_FAILED',
      `Failed to update new-project.ts: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Update new-project.sh with variant option
 * @version 1.1.0
 */
function updateNewProjectSh(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating new-project.sh ===`);

  if (!existsSync(NEW_PROJECT_SH)) {
    console.warn(`new-project.sh not found at ${NEW_PROJECT_SH} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(NEW_PROJECT_SH);

    // Check if variant already listed
    if (content.includes(metadata.name)) {
      console.log(`Variant ${metadata.name} already listed in new-project.sh - skipping`);
      return false;
    }

    // Find variant options section (look for case statement or array)
    const variantOptionsRegex = /(# Variant options|VARIANT_OPTIONS=)([\s\S]*?)(# End|EOF)/;
    const match = content.match(variantOptionsRegex);

    if (!match) {
      console.warn(`Could not find variant options section in new-project.sh - skipping`);
      return false;
    }

    const sectionHeader = match[1];
    const sectionContent = match[2];
    const sectionEnd = match[3];

    // Add new variant option
    const newOption = `    ${metadata.name})\n        VARIANT_NAME="${metadata.name}"\n        ;;\n`;
    const updatedSection = `${sectionHeader}${sectionContent}${newOption}${sectionEnd}`;
    const updatedContent = content.replace(variantOptionsRegex, updatedSection);

    writeUTF8File(NEW_PROJECT_SH, updatedContent);
    console.log(`✅ Updated new-project.sh with variant option`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'NEW_PROJECT_SH_UPDATE_FAILED',
      `Failed to update new-project.sh: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Update new-project.ps1 with variant option
 * @version 1.1.0
 */
function updateNewProjectPs1(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating new-project.ps1 ===`);

  if (!existsSync(NEW_PROJECT_PS1)) {
    console.warn(`new-project.ps1 not found at ${NEW_PROJECT_PS1} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(NEW_PROJECT_PS1);

    // Check if variant already listed
    if (content.includes(metadata.name)) {
      console.log(`Variant ${metadata.name} already listed in new-project.ps1 - skipping`);
      return false;
    }

    // Find variant options array
    const variantOptionsRegex = /(\$VariantOptions\s*=\s*@\()(.*?)(\))/s;
    const match = content.match(variantOptionsRegex);

    if (!match) {
      console.warn(`Could not find \$VariantOptions array in new-project.ps1 - skipping`);
      return false;
    }

    const arrayStart = match[1];
    const arrayContent = match[2];
    const arrayEnd = match[3];

    // Add new variant option
    const newOption = `    "${metadata.name}"`;
    const updatedArrayContent = arrayContent.trim() + `\n${newOption}\n`;
    const updatedContent = content.replace(variantOptionsRegex, `${arrayStart}${updatedArrayContent}${arrayEnd}`);

    writeUTF8File(NEW_PROJECT_PS1, updatedContent);
    console.log(`✅ Updated new-project.ps1 with variant option`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'NEW_PROJECT_PS1_UPDATE_FAILED',
      `Failed to update new-project.ps1: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Update all new-project scripts
 * @version 1.1.0
 */
function updateNewProjectScripts(metadata: VariantMetadata): boolean {
  let updated = false;

  updated = updateNewProjectTs(metadata) || updated;
  updated = updateNewProjectSh(metadata) || updated;
  updated = updateNewProjectPs1(metadata) || updated;

  return updated;
}

// ============================================================================
// VERSION REGISTRY INTEGRATION
// ============================================================================

/**
 * Update VERSION_REGISTRY.json with variant entry
 * @version 1.1.0
 */
function updateVersionRegistry(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating VERSION_REGISTRY.json ===`);

  if (!existsSync(VERSION_REGISTRY)) {
    console.warn(`VERSION_REGISTRY.json not found at ${VERSION_REGISTRY} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(VERSION_REGISTRY);
    const registry = JSON.parse(content) as Record<string, VersionRegistryEntry[]>;

    // Ensure "variants" key exists
    if (!registry.variants) {
      registry.variants = [];
    }

    // Check if variant already registered
    const existing = registry.variants.find(v => v.name === metadata.name);
    if (existing) {
      console.log(`Variant ${metadata.name} already registered in VERSION_REGISTRY.json - updating`);

      // Update existing entry
      existing.variant_type = metadata.variantType;
      existing.version = metadata.version;
      existing.status = metadata.status;
      existing.inherits = metadata.inherits_common;
    } else {
      // Add new entry
      const entry: VersionRegistryEntry = {
        name: metadata.name,
        variant_type: metadata.variantType,
        version: metadata.version,
        status: metadata.status,
        inherits: metadata.inherits_common,
        created_at: new Date().toISOString(),
      };

      registry.variants.push(entry);
    }

    writeUTF8File(VERSION_REGISTRY, JSON.stringify(registry, null, 2));
    console.log(`✅ Updated VERSION_REGISTRY.json with variant entry`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'VERSION_REGISTRY_UPDATE_FAILED',
      `Failed to update VERSION_REGISTRY.json: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// ============================================================================
// AGENTS.md INTEGRATION
// ============================================================================

/**
 * Update AGENTS.md PM Dispatch table with variant entry
 * @version 1.1.0
 */
function updateAgentsMd(metadata: VariantMetadata): boolean {
  console.log(`\n=== Updating AGENTS.md ===`);

  if (!existsSync(AGENTS_MD)) {
    console.warn(`AGENTS.md not found at ${AGENTS_MD} - skipping`);
    return false;
  }

  try {
    const content = readUTF8File(AGENTS_MD);

    // Check if variant already listed in PM Dispatch table
    if (content.includes(`| ${metadata.name} |`)) {
      console.log(`Variant ${metadata.name} already listed in AGENTS.md - skipping`);
      return false;
    }

    // Find PM Dispatch table
    const pmDispatchTableRegex = /(\| Variant \| PM Dispatch Table File \|\|[\s\S]*?)(\|\|[\s\S]*?)(\n##|\n#|$)/;
    const match = content.match(pmDispatchTableRegex);

    if (!match) {
      console.warn(`Could not find PM Dispatch table in AGENTS.md - skipping`);
      return false;
    }

    const tableHeader = match[1];
    const tableContent = match[2];
    const tableEnd = match[3];

    // Add new variant row
    const newRow = `| ${metadata.name} | \`templates/${metadata.name}/AGENTS.md\` |`;
    const updatedTable = `${tableHeader}${tableContent}\n${newRow}${tableEnd}`;
    const updatedContent = content.replace(pmDispatchTableRegex, updatedTable);

    writeUTF8File(AGENTS_MD, updatedContent);
    console.log(`✅ Updated AGENTS.md with variant entry`);

    return true;
  } catch (error) {
    throw warningError(
      ErrorPhase.INTEGRATION,
      'AGENTS_MD_UPDATE_FAILED',
      `Failed to update AGENTS.md: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

// ============================================================================
// MAIN INTEGRATION FUNCTION
// ============================================================================

/**
 * Integrate variant into workspace
 * @version 1.1.0
 */
export async function integrateVariantToWorkspace(
  metadata: VariantMetadata
): Promise<IntegrationResult> {
  console.log(`\n=== Integrating Variant to Workspace ===`);
  console.log(`Variant: ${metadata.name}`);
  console.log(`Type: ${metadata.variantType}\n`);

  const updatedFiles: string[] = [];

  // Update README.md
  const readmeUpdated = updateReadme(metadata);
  if (readmeUpdated) {
    updatedFiles.push(README_PATH);
  }

  // Update new-project scripts
  const newProjectUpdated = updateNewProjectScripts(metadata);
  if (newProjectUpdated) {
    updatedFiles.push(NEW_PROJECT_TS, NEW_PROJECT_SH, NEW_PROJECT_PS1);
  }

  // Update VERSION_REGISTRY.json
  const versionRegistryUpdated = updateVersionRegistry(metadata);
  if (versionRegistryUpdated) {
    updatedFiles.push(VERSION_REGISTRY);
  }

  // Update AGENTS.md
  const agentsMdUpdated = updateAgentsMd(metadata);
  if (agentsMdUpdated) {
    updatedFiles.push(AGENTS_MD);
  }

  const summary =
    `Integrated variant ${metadata.name} into workspace:\n` +
    `- README.md: ${readmeUpdated ? '✅' : '⊘'}\n` +
    `- new-project scripts: ${newProjectUpdated ? '✅' : '⊘'}\n` +
    `- VERSION_REGISTRY.json: ${versionRegistryUpdated ? '✅' : '⊘'}\n` +
    `- AGENTS.md: ${agentsMdUpdated ? '✅' : '⊘'}\n` +
    `\nTotal files updated: ${updatedFiles.length}`;

  console.log(`\n=== Integration Complete ===`);
  console.log(summary);

  if (updatedFiles.length > 0) {
    console.log(`\nUpdated files:`);
    for (const file of updatedFiles) {
      console.log(`  - ${file}`);
    }
  }

  return {
    readmeUpdated,
    newProjectUpdated,
    versionRegistryUpdated,
    agentsMdUpdated,
    updatedFiles,
    summary,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const metadataArg = args.find(arg => arg.startsWith('--metadata='));

  if (!metadataArg) {
    console.error('Usage: bun scripts/helpers/integration-helpers.ts --metadata=<json-string>');
    process.exit(1);
  }

  try {
    // Parse metadata
    const metadata = JSON.parse(metadataArg.split('=')[1]) as VariantMetadata;

    // Integrate variant
    const result = await integrateVariantToWorkspace(metadata);

    console.log('\n✅ Integration successful');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Integration failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
