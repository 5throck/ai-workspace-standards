#!/usr/bin/env bun
/**
 * Workspace Integration Module
 *
 * Transactional workspace registration for new variants.
 * Implements a 5-phase transaction model:
 *   1. PREFLIGHT — validate all targets without writing
 *   2. BEGIN     — snapshot current file states via pipeline-state.ts
 *   3. WRITE     — apply changes in order (propagation-map → VERSION_REGISTRY → README → scripts → AGENTS.md)
 *   4. VERIFY    — re-read and confirm expected content
 *   5. COMMIT    — finalize or rollback
 *
 * Fixes the VERSION_REGISTRY schema mismatch (§7.3 of design doc):
 *   - Writes nested object format (correct) instead of array format (legacy bug).
 *
 * @version 1.0.0
 * @phase 4: Workspace Integration (Transactional)
 * @see docs/designs/variant-registry-architecture-design.md §7
 *
 * Dependencies:
 * - registries/variant-type-registry.ts (VariantType)
 * - registries/index.ts (validateRegistryIntegrity)
 * - lib/pipeline-state.ts (PipelineState API for rollback)
 * - lib/encoding-utils.ts (readUTF8File / writeUTF8File)
 */

import { join } from 'path';
import { existsSync, accessSync, constants } from 'fs';
import { createHash } from 'crypto';
import { readUTF8File, writeUTF8File } from '../lib/encoding-utils.ts';
import {
  initializeState,
  saveState,
  loadState,
  addRollbackAction,
  completePipeline,
  failPipeline,
  rollbackPipeline,
  type PipelineState,
} from '../lib/pipeline-state.ts';
import { ErrorPhase } from '../lib/error-handling.ts';
import type { VariantType } from './registries/variant-type-registry.ts';
import { validateRegistryIntegrity } from './registries/index.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Configuration for workspace registration.
 */
export interface WorkspaceRegistrationConfig {
  readonly variantName: string;
  readonly variantType: VariantType;
  readonly version: string;
  readonly description: string;
  readonly sourceProject?: string;
}

/**
 * Result of workspace registration.
 */
export interface WorkspaceRegistrationResult {
  readonly success: boolean;
  readonly preflightPassed: boolean;
  readonly filesModified: readonly string[];
  readonly rollbackAvailable: boolean;
  readonly errors: readonly RegistrationError[];
}

/**
 * A single error encountered during registration.
 */
export interface RegistrationError {
  readonly phase: 'preflight' | 'begin' | 'write' | 'verify';
  readonly step: string;
  readonly message: string;
  readonly file?: string;
}

/**
 * A planned change reported during dry-run.
 */
export interface PlannedChange {
  readonly file: string;
  readonly action: string;
  readonly description: string;
}

/**
 * Internal file snapshot for rollback.
 */
interface FileSnapshot {
  readonly filePath: string;
  readonly content: string;
  readonly hash: string;
}

// ============================================================================
// CONSTANTS — Target file paths
// ============================================================================

const WORKSPACE_ROOT = process.cwd();

const PROPAGATION_MAP_PATH = join(WORKSPACE_ROOT, 'scripts', 'propagation-map.json');
const VERSION_REGISTRY_PATH = join(WORKSPACE_ROOT, 'docs', 'templates', 'VERSION_REGISTRY.json');
const README_PATH = join(WORKSPACE_ROOT, 'README.md');
const AGENTS_MD_PATH = join(WORKSPACE_ROOT, 'AGENTS.md');

const NEW_PROJECT_TS = join(WORKSPACE_ROOT, 'scripts', 'new-project.ts');
const NEW_PROJECT_SH = join(WORKSPACE_ROOT, 'scripts', 'new-project.sh');
const NEW_PROJECT_PS1 = join(WORKSPACE_ROOT, 'scripts', 'new-project.ps1');

/** All target files that must be snapshotted before writes begin. */
const ALL_TARGET_FILES = [
  PROPAGATION_MAP_PATH,
  VERSION_REGISTRY_PATH,
  README_PATH,
  NEW_PROJECT_TS,
  NEW_PROJECT_SH,
  NEW_PROJECT_PS1,
  AGENTS_MD_PATH,
] as const;

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Compute SHA-256 hex digest of a string.
 */
function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/**
 * Check whether a file exists and is writable.
 */
function fileExistsAndWritable(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    accessSync(filePath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse JSON safely, returning null on failure.
 */
function safeJsonParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Validate that propagation-map.json has the expected top-level structure.
 * Must have `version` (string) and `domains` (object).
 */
function isValidPropagationMap(content: string): { valid: boolean; reason?: string } {
  const data = safeJsonParse(content);
  if (!data || typeof data !== 'object' || data === null) {
    return { valid: false, reason: 'File is not valid JSON or is not an object' };
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj.version !== 'string') {
    return { valid: false, reason: 'Missing or non-string "version" field' };
  }
  if (typeof obj.domains !== 'object' || obj.domains === null || Array.isArray(obj.domains)) {
    return { valid: false, reason: 'Missing or non-object "domains" field' };
  }
  return { valid: true };
}

/**
 * Validate that VERSION_REGISTRY.json uses the correct nested object format.
 * Must have `variants` as an object (not an array), where each key is a variant name
 * whose value contains at minimum `latest`, `released`, and `status`.
 */
function isValidVersionRegistry(content: string): { valid: boolean; reason?: string } {
  const data = safeJsonParse(content);
  if (!data || typeof data !== 'object' || data === null) {
    return { valid: false, reason: 'File is not valid JSON or is not an object' };
  }
  const obj = data as Record<string, unknown>;

  // Detect legacy array format — `variants` must be an object, not an array
  if (Array.isArray(obj.variants)) {
    return { valid: false, reason: 'VERSION_REGISTRY uses legacy array format — expected nested object format with "variants" as a keyed object' };
  }

  if (typeof obj.variants !== 'object' || obj.variants === null) {
    return { valid: false, reason: 'Missing or non-object "variants" field' };
  }

  // Verify at least one existing entry has the expected nested structure
  const variants = obj.variants as Record<string, unknown>;
  for (const [key, entry] of Object.entries(variants)) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      if (typeof e.latest !== 'string') {
        return { valid: false, reason: `Variant "${key}" missing required "latest" field` };
      }
      if (typeof e.status !== 'string') {
        return { valid: false, reason: `Variant "${key}" missing required "status" field` };
      }
      // Structure looks correct
      return { valid: true };
    }
  }

  // Empty variants object is valid (no entries to check)
  return { valid: true };
}

/**
 * Collect marker-inject domains from propagation-map.json that have a
 * `target_variants` array. These are the domains where the new variant
 * must be added.
 */
interface MarkerInjectDomain {
  readonly key: string;
  readonly targetVariants: readonly string[];
}

function getMarkerInjectDomains(data: unknown): MarkerInjectDomain[] {
  const domains: MarkerInjectDomain[] = [];
  if (!data || typeof data !== 'object') return domains;
  const obj = data as Record<string, unknown>;
  const domainsObj = obj.domains as Record<string, unknown> | undefined;
  if (!domainsObj || typeof domainsObj !== 'object') return domains;

  for (const [key, domain] of Object.entries(domainsObj)) {
    if (!domain || typeof domain !== 'object') continue;
    const d = domain as Record<string, unknown>;
    if (d.mode === 'marker-inject' && Array.isArray(d.target_variants)) {
      domains.push({
        key,
        targetVariants: d.target_variants as string[],
      });
    }
  }

  return domains;
}

/**
 * Inject variant name into the `target_variants` arrays of all marker-inject domains.
 * Returns the modified propagation-map content string, or the original if no changes needed.
 */
function addVariantToPropagationMap(content: string, variantName: string): string {
  const data = safeJsonParse(content) as Record<string, unknown>;
  if (!data || typeof data !== 'object') return content;

  const domainsObj = data.domains as Record<string, unknown>;
  if (!domainsObj || typeof domainsObj !== 'object') return content;

  let modified = false;

  for (const domain of Object.values(domainsObj)) {
    if (!domain || typeof domain !== 'object') continue;
    const d = domain as Record<string, unknown>;
    if (d.mode === 'marker-inject' && Array.isArray(d.target_variants)) {
      const variants = d.target_variants as string[];
      if (!variants.includes(variantName)) {
        variants.push(variantName);
        modified = true;
      }
    }
  }

  if (!modified) return content;

  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Add a variant entry to VERSION_REGISTRY.json in the correct nested object format.
 * This fixes the existing bug where integration-helpers.ts writes array format.
 *
 * Output format:
 *   { "variants": { "<name>": { latest, released, status, changelog, ... } } }
 */
function addVariantToVersionRegistry(
  content: string,
  config: WorkspaceRegistrationConfig,
): string {
  const data = safeJsonParse(content) as Record<string, unknown>;
  if (!data || typeof data !== 'object') {
    throw new Error('VERSION_REGISTRY.json is not a valid JSON object');
  }

  // Ensure variants object exists
  if (!data.variants || typeof data.variants !== 'object' || Array.isArray(data.variants)) {
    data.variants = {};
  }

  const variants = data.variants as Record<string, unknown>;
  const today = new Date().toISOString().slice(0, 10);

  variants[config.variantName] = {
    latest: config.version,
    released: today,
    status: 'beta',
    changelog: [],
    security_advisories: [],
    migration_guides: [],
    source_project: config.sourceProject ?? `Projects/${config.variantName}`,
    promoted_via: 'l2-to-variant-pipeline.ts',
  };

  return JSON.stringify(data, null, 2) + '\n';
}

/**
 * Insert a variant entry into the README.md ## Variants or ## Templates section.
 * Reuses logic from integration-helpers.ts updateReadme().
 */
function addVariantToReadme(content: string, config: WorkspaceRegistrationConfig): string {
  // Check if already listed
  if (content.includes(`### ${config.variantName}\n`)) return content;

  const variantsSectionRegex = /(## Variants|## Templates)([\s\S]*?)(##|$)/;
  const match = content.match(variantsSectionRegex);

  if (!match) {
    // No existing section — append to end of file
    const variantEntry = `\n## Variant: ${config.variantName}\n\n**Type**: ${config.variantType}\n**Status**: beta (v${config.version})\n\n${config.description}\n`;
    return content + variantEntry;
  }

  const sectionHeader = match[1];
  const sectionContent = match[2];
  const nextHeader = match[3];

  const variantEntry = `### ${config.variantName}\n\n- **Type**: ${config.variantType}\n- **Status**: beta (v${config.version})\n- **Description**: ${config.description}\n`;

  return content.replace(
    variantsSectionRegex,
    `${sectionHeader}${sectionContent}\n${variantEntry}${nextHeader}`,
  );
}

/**
 * Inject variant name into VARIANT_OPTIONS of a .ts new-project script.
 * Reuses logic from integration-helpers.ts updateNewProjectTs().
 */
function addVariantToNewProjectTs(content: string, variantName: string): string {
  if (content.includes(`'${variantName}'`)) return content;

  const variantOptionsRegex = /(VARIANT_OPTIONS\s*=\s*\[)([\s\S]*?)(\])/;
  const match = content.match(variantOptionsRegex);
  if (!match) return content;

  const arrayStart = match[1];
  const arrayContent = match[2];
  const arrayEnd = match[3];
  const newOption = `  '${variantName}',`;
  const updatedArrayContent = arrayContent.trim() + `\n${newOption}\n`;

  return content.replace(
    variantOptionsRegex,
    `${arrayStart}${updatedArrayContent}${arrayEnd}`,
  );
}

/**
 * Inject variant name into variant options of a .sh new-project script.
 * Reuses logic from integration-helpers.ts updateNewProjectSh().
 */
function addVariantToNewProjectSh(content: string, variantName: string): string {
  if (content.includes(variantName)) return content;

  const variantOptionsRegex = /(# Variant options|VARIANT_OPTIONS=)([\s\S]*?)(# End|EOF)/;
  const match = content.match(variantOptionsRegex);
  if (!match) return content;

  const sectionHeader = match[1];
  const sectionContent = match[2];
  const sectionEnd = match[3];
  const newOption = `    ${variantName})\n        VARIANT_NAME="${variantName}"\n        ;;\n`;

  return content.replace(
    variantOptionsRegex,
    `${sectionHeader}${sectionContent}${newOption}${sectionEnd}`,
  );
}

/**
 * Inject variant name into $VariantOptions array of a .ps1 new-project script.
 * Reuses logic from integration-helpers.ts updateNewProjectPs1().
 */
function addVariantToNewProjectPs1(content: string, variantName: string): string {
  if (content.includes(variantName)) return content;

  const variantOptionsRegex = /(\$VariantOptions\s*=\s*@\()(.*?)(\))/s;
  const match = content.match(variantOptionsRegex);
  if (!match) return content;

  const arrayStart = match[1];
  const arrayContent = match[2];
  const arrayEnd = match[3];
  const newOption = `    "${variantName}"`;
  const updatedArrayContent = arrayContent.trim() + `\n${newOption}\n`;

  return content.replace(
    variantOptionsRegex,
    `${arrayStart}${updatedArrayContent}${arrayEnd}`,
  );
}

/**
 * Add variant row to AGENTS.md PM Dispatch table.
 * Reuses logic from integration-helpers.ts updateAgentsMd().
 */
function addVariantToAgentsMd(content: string, variantName: string): string {
  // Check if already listed in a table row
  if (content.includes(`| ${variantName} |`)) return content;

  // Find PM Dispatch table — look for a markdown table containing variant rows
  // Pattern: lines like | co-design | `templates/co-design/AGENTS.md` |
  const dispatchTableRegex = /(\|[\s]*Variant[\s]*\|[\s]*PM Dispatch Table File[\s]*\|\|?)([\s\S]*?)(\n(?:##|#{2,}\s|\Z))/;
  const match = content.match(dispatchTableRegex);

  if (!match) {
    // Fallback: try a simpler pattern — find any table with co-design, co-develop etc.
    const simpleTableRegex = /(\n(?:\| .* \|.*\|\n)+)/;
    const simpleMatch = content.match(simpleTableRegex);
    if (!simpleMatch) return content;

    // Check if this table contains variant-like entries
    const tableBlock = simpleMatch[1];
    if (!tableBlock.includes('co-')) return content;

    // Insert before the last newline of the table block
    const newRow = `| ${variantName} | \`templates/${variantName}/AGENTS.md\` |\n`;
    const insertPos = content.indexOf(tableBlock) + tableBlock.length;
    return content.slice(0, insertPos) + newRow + content.slice(insertPos);
  }

  const tableHeader = match[1];
  const tableContent = match[2];
  const tableEnd = match[3];
  const newRow = `| ${variantName} | \`templates/${variantName}/AGENTS.md\` |`;

  return content.replace(
    dispatchTableRegex,
    `${tableHeader}${tableContent}\n${newRow}${tableEnd}`,
  );
}

// ============================================================================
// PHASE 1: PREFLIGHT
// ============================================================================

/**
 * Run all preflight checks without writing anything.
 * If ANY check fails, returns the list of errors and abort is required.
 */
async function runPreflight(
  config: WorkspaceRegistrationConfig,
): Promise<{ passed: boolean; errors: readonly RegistrationError[] }> {
  const errors: RegistrationError[] = [];

  // --- Check 1: All target files exist and are writable ---
  const fileLabels: Record<string, string> = {
    [PROPAGATION_MAP_PATH]: 'propagation-map.json',
    [VERSION_REGISTRY_PATH]: 'VERSION_REGISTRY.json',
    [README_PATH]: 'README.md',
    [AGENTS_MD_PATH]: 'AGENTS.md',
  };

  for (const [filePath, label] of Object.entries(fileLabels)) {
    if (!fileExistsAndWritable(filePath)) {
      errors.push({
        phase: 'preflight',
        step: 'file_access',
        message: `${label} does not exist or is not writable at ${filePath}`,
        file: filePath,
      });
    }
  }

  // new-project scripts — at least .ts must exist; .sh and .ps1 are optional
  if (!fileExistsAndWritable(NEW_PROJECT_TS)) {
    errors.push({
      phase: 'preflight',
      step: 'file_access',
      message: `new-project.ts does not exist or is not writable at ${NEW_PROJECT_TS}`,
      file: NEW_PROJECT_TS,
    });
  }
  // .sh and .ps1 are optional — only check if they exist
  for (const [filePath, label] of [
    [NEW_PROJECT_SH, 'new-project.sh'],
    [NEW_PROJECT_PS1, 'new-project.ps1'],
  ] as const) {
    if (existsSync(filePath) && !fileExistsAndWritable(filePath)) {
      errors.push({
        phase: 'preflight',
        step: 'file_access',
        message: `${label} exists but is not writable at ${filePath}`,
        file: filePath,
      });
    }
  }

  if (errors.length > 0) {
    return { passed: false, errors };
  }

  // --- Check 2: propagation-map.json structure is valid ---
  try {
    const propagationContent = readUTF8File(PROPAGATION_MAP_PATH);
    const propagationCheck = isValidPropagationMap(propagationContent);
    if (!propagationCheck.valid) {
      errors.push({
        phase: 'preflight',
        step: 'propagation_map_structure',
        message: `propagation-map.json structure invalid: ${propagationCheck.reason}`,
        file: PROPAGATION_MAP_PATH,
      });
    }
  } catch (err) {
    errors.push({
      phase: 'preflight',
      step: 'propagation_map_read',
      message: `Failed to read propagation-map.json: ${err instanceof Error ? err.message : String(err)}`,
      file: PROPAGATION_MAP_PATH,
    });
  }

  // --- Check 3: VERSION_REGISTRY.json structure is valid (nested object format) ---
  try {
    const registryContent = readUTF8File(VERSION_REGISTRY_PATH);
    const registryCheck = isValidVersionRegistry(registryContent);
    if (!registryCheck.valid) {
      errors.push({
        phase: 'preflight',
        step: 'version_registry_structure',
        message: `VERSION_REGISTRY.json structure invalid: ${registryCheck.reason}`,
        file: VERSION_REGISTRY_PATH,
      });
    }
  } catch (err) {
    errors.push({
      phase: 'preflight',
      step: 'version_registry_read',
      message: `Failed to read VERSION_REGISTRY.json: ${err instanceof Error ? err.message : String(err)}`,
      file: VERSION_REGISTRY_PATH,
    });
  }

  // --- Check 4: README.md exists (already checked in file access above) ---
  // Additional check: README.md should have a Variants/Templates section or be empty enough to append
  try {
    const readmeContent = readUTF8File(README_PATH);
    const hasVariantsSection = /## Variants|## Templates/i.test(readmeContent);
    if (!hasVariantsSection) {
      // Not an error — we can append. Log as informational.
      // (No error added; we handle this in the write phase)
    }
  } catch (err) {
    errors.push({
      phase: 'preflight',
      step: 'readme_read',
      message: `Failed to read README.md: ${err instanceof Error ? err.message : String(err)}`,
      file: README_PATH,
    });
  }

  // --- Check 5: new-project scripts directory exists ---
  const scriptsDir = join(WORKSPACE_ROOT, 'scripts');
  if (!existsSync(scriptsDir)) {
    errors.push({
      phase: 'preflight',
      step: 'scripts_directory',
      message: `Scripts directory does not exist: ${scriptsDir}`,
      file: scriptsDir,
    });
  }

  // --- Check 6: AGENTS.md exists (already checked in file access above) ---

  // --- Check 7: validateRegistryIntegrity() passes ---
  try {
    const integrityReport = validateRegistryIntegrity();
    if (!integrityReport.passed) {
      for (const issue of integrityReport.errors.filter(e => e.severity === 'error')) {
        errors.push({
          phase: 'preflight',
          step: 'registry_integrity',
          message: `Registry integrity check failed [${issue.registry}]: ${issue.message}`,
        });
      }
    }
  } catch (err) {
    errors.push({
      phase: 'preflight',
      step: 'registry_integrity',
      message: `validateRegistryIntegrity() threw: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  return { passed: errors.length === 0, errors };
}

// ============================================================================
// PHASE 2: BEGIN (Snapshot)
// ============================================================================

/**
 * Snapshot all target files. Hashes each file and records rollback actions
 * in pipeline-state.ts so files can be restored on failure.
 *
 * Returns the map of file snapshots keyed by file path.
 */
function snapshotFiles(): Map<string, FileSnapshot> {
  const snapshots = new Map<string, FileSnapshot>();

  // Initialize pipeline state
  const state = initializeState('workspace-integration');

  for (const filePath of ALL_TARGET_FILES) {
    if (!existsSync(filePath)) continue;

    try {
      const content = readUTF8File(filePath);
      const hash = sha256(content);

      snapshots.set(filePath, { filePath, content, hash });

      // Record rollback action: restore original content on failure
      addRollbackAction(
        ErrorPhase.INTEGRATION,
        'modify_file',
        filePath,
      );
    } catch (err) {
      throw new Error(
        `Failed to snapshot ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Store snapshot hashes in pipeline state context for verification phase
  const ctx = state.context;
  ctx.snapshotHashes = Object.fromEntries(snapshots);
  saveState(state);

  return snapshots;
}

// ============================================================================
// PHASE 3: WRITE (Ordered)
// ============================================================================

/**
 * Write all target files in the specified order:
 *   1. propagation-map.json
 *   2. VERSION_REGISTRY.json
 *   3. README.md
 *   4. new-project scripts (.ts, .sh, .ps1)
 *   5. AGENTS.md
 */
async function writePhase(
  config: WorkspaceRegistrationConfig,
): Promise<{ modifiedFiles: string[]; errors: RegistrationError[] }> {
  const errors: RegistrationError[] = [];
  const modifiedFiles: string[] = [];

  // --- Write 1: propagation-map.json ---
  try {
    const content = readUTF8File(PROPAGATION_MAP_PATH);
    const updated = addVariantToPropagationMap(content, config.variantName);
    if (updated !== content) {
      writeUTF8File(PROPAGATION_MAP_PATH, updated);
      modifiedFiles.push(PROPAGATION_MAP_PATH);
    }
  } catch (err) {
    errors.push({
      phase: 'write',
      step: 'propagation_map',
      message: `Failed to update propagation-map.json: ${err instanceof Error ? err.message : String(err)}`,
      file: PROPAGATION_MAP_PATH,
    });
    return { modifiedFiles, errors };
  }

  // --- Write 2: VERSION_REGISTRY.json (nested object format) ---
  try {
    const content = readUTF8File(VERSION_REGISTRY_PATH);
    const updated = addVariantToVersionRegistry(content, config);
    writeUTF8File(VERSION_REGISTRY_PATH, updated);
    modifiedFiles.push(VERSION_REGISTRY_PATH);
  } catch (err) {
    errors.push({
      phase: 'write',
      step: 'version_registry',
      message: `Failed to update VERSION_REGISTRY.json: ${err instanceof Error ? err.message : String(err)}`,
      file: VERSION_REGISTRY_PATH,
    });
    return { modifiedFiles, errors };
  }

  // --- Write 3: README.md ---
  try {
    const content = readUTF8File(README_PATH);
    const updated = addVariantToReadme(content, config);
    if (updated !== content) {
      writeUTF8File(README_PATH, updated);
      modifiedFiles.push(README_PATH);
    }
  } catch (err) {
    errors.push({
      phase: 'write',
      step: 'readme',
      message: `Failed to update README.md: ${err instanceof Error ? err.message : String(err)}`,
      file: README_PATH,
    });
    return { modifiedFiles, errors };
  }

  // --- Write 4: new-project scripts ---
  // .ts
  try {
    const content = readUTF8File(NEW_PROJECT_TS);
    const updated = addVariantToNewProjectTs(content, config.variantName);
    if (updated !== content) {
      writeUTF8File(NEW_PROJECT_TS, updated);
      modifiedFiles.push(NEW_PROJECT_TS);
    }
  } catch (err) {
    errors.push({
      phase: 'write',
      step: 'new_project_ts',
      message: `Failed to update new-project.ts: ${err instanceof Error ? err.message : String(err)}`,
      file: NEW_PROJECT_TS,
    });
    return { modifiedFiles, errors };
  }

  // .sh (optional)
  if (existsSync(NEW_PROJECT_SH)) {
    try {
      const content = readUTF8File(NEW_PROJECT_SH);
      const updated = addVariantToNewProjectSh(content, config.variantName);
      if (updated !== content) {
        writeUTF8File(NEW_PROJECT_SH, updated);
        modifiedFiles.push(NEW_PROJECT_SH);
      }
    } catch (err) {
      errors.push({
        phase: 'write',
        step: 'new_project_sh',
        message: `Failed to update new-project.sh: ${err instanceof Error ? err.message : String(err)}`,
        file: NEW_PROJECT_SH,
      });
      return { modifiedFiles, errors };
    }
  }

  // .ps1 (optional)
  if (existsSync(NEW_PROJECT_PS1)) {
    try {
      const content = readUTF8File(NEW_PROJECT_PS1);
      const updated = addVariantToNewProjectPs1(content, config.variantName);
      if (updated !== content) {
        writeUTF8File(NEW_PROJECT_PS1, updated);
        modifiedFiles.push(NEW_PROJECT_PS1);
      }
    } catch (err) {
      errors.push({
        phase: 'write',
        step: 'new_project_ps1',
        message: `Failed to update new-project.ps1: ${err instanceof Error ? err.message : String(err)}`,
        file: NEW_PROJECT_PS1,
      });
      return { modifiedFiles, errors };
    }
  }

  // --- Write 5: AGENTS.md ---
  try {
    const content = readUTF8File(AGENTS_MD_PATH);
    const updated = addVariantToAgentsMd(content, config.variantName);
    if (updated !== content) {
      writeUTF8File(AGENTS_MD_PATH, updated);
      modifiedFiles.push(AGENTS_MD_PATH);
    }
  } catch (err) {
    errors.push({
      phase: 'write',
      step: 'agents_md',
      message: `Failed to update AGENTS.md: ${err instanceof Error ? err.message : String(err)}`,
      file: AGENTS_MD_PATH,
    });
    return { modifiedFiles, errors };
  }

  return { modifiedFiles, errors };
}

// ============================================================================
// PHASE 4: VERIFY
// ============================================================================

/**
 * Re-read each written file and confirm the expected content is present.
 */
async function verifyPhase(
  config: WorkspaceRegistrationConfig,
  modifiedFiles: readonly string[],
  originalSnapshots: Map<string, FileSnapshot>,
): Promise<{ passed: boolean; errors: RegistrationError[] }> {
  const errors: RegistrationError[] = [];

  for (const filePath of modifiedFiles) {
    try {
      const currentContent = readUTF8File(filePath);
      const currentHash = sha256(currentContent);
      const original = originalSnapshots.get(filePath);

      // Verify the file actually changed from its snapshot
      if (original && currentHash === original.hash) {
        errors.push({
          phase: 'verify',
          step: 'content_change',
          message: `File was not modified from original: ${filePath}`,
          file: filePath,
        });
        continue;
      }

      // Verify expected content based on which file this is
      if (filePath === PROPAGATION_MAP_PATH) {
        const data = safeJsonParse(currentContent) as Record<string, unknown>;
        const domainsObj = data?.domains as Record<string, unknown> | undefined;
        let found = false;
        if (domainsObj) {
          for (const domain of Object.values(domainsObj)) {
            if (!domain || typeof domain !== 'object') continue;
            const d = domain as Record<string, unknown>;
            if (d.mode === 'marker-inject' && Array.isArray(d.target_variants)) {
              if ((d.target_variants as string[]).includes(config.variantName)) {
                found = true;
                break;
              }
            }
          }
        }
        if (!found) {
          errors.push({
            phase: 'verify',
            step: 'propagation_map_content',
            message: `Variant "${config.variantName}" not found in any marker-inject target_variants`,
            file: filePath,
          });
        }
      } else if (filePath === VERSION_REGISTRY_PATH) {
        if (!currentContent.includes(config.variantName)) {
          errors.push({
            phase: 'verify',
            step: 'version_registry_content',
            message: `Variant "${config.variantName}" not found in VERSION_REGISTRY.json`,
            file: filePath,
          });
        }
        // Verify nested object format
        const data = safeJsonParse(currentContent) as Record<string, unknown>;
        const variants = data?.variants as Record<string, unknown> | undefined;
        if (!variants || typeof variants[config.variantName] !== 'object') {
          errors.push({
            phase: 'verify',
            step: 'version_registry_format',
            message: `VERSION_REGISTRY.json does not have nested object entry for "${config.variantName}"`,
            file: filePath,
          });
        }
      } else if (filePath === README_PATH) {
        if (!currentContent.includes(config.variantName)) {
          errors.push({
            phase: 'verify',
            step: 'readme_content',
            message: `Variant "${config.variantName}" not found in README.md`,
            file: filePath,
          });
        }
      } else if (filePath === AGENTS_MD_PATH) {
        if (!currentContent.includes(`| ${config.variantName} |`)) {
          errors.push({
            phase: 'verify',
            step: 'agents_md_content',
            message: `Variant "${config.variantName}" not found in AGENTS.md dispatch table`,
            file: filePath,
          });
        }
      } else if (
        filePath === NEW_PROJECT_TS ||
        filePath === NEW_PROJECT_SH ||
        filePath === NEW_PROJECT_PS1
      ) {
        // For new-project scripts, the variant name should appear
        if (!currentContent.includes(config.variantName)) {
          errors.push({
            phase: 'verify',
            step: 'new_project_content',
            message: `Variant "${config.variantName}" not found in ${filePath}`,
            file: filePath,
          });
        }
      }
    } catch (err) {
      errors.push({
        phase: 'verify',
        step: 'file_read',
        message: `Failed to verify ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
        file: filePath,
      });
    }
  }

  return { passed: errors.length === 0, errors };
}

// ============================================================================
// PHASE 5: COMMIT or ROLLBACK
// ============================================================================

/**
 * Restore all files from snapshots in reverse order.
 */
function rollbackFiles(snapshots: Map<string, FileSnapshot>): void {
  const entries = Array.from(snapshots.values()).reverse();

  for (const snapshot of entries) {
    try {
      writeUTF8File(snapshot.filePath, snapshot.content);
    } catch (err) {
      console.error(
        `⚠️  Failed to restore ${snapshot.filePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Mark pipeline as rolled back
  const state = loadState();
  if (state) {
    rollbackPipeline();
  }
}

/**
 * Commit: mark pipeline as completed.
 */
function commitPhase(): void {
  const state = loadState();
  if (state) {
    completePipeline();
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Registers a variant in the workspace using a transactional model.
 *
 * Phases:
 *   1. PREFLIGHT — validate all targets without writing
 *   2. BEGIN     — snapshot current file states
 *   3. WRITE     — apply changes in order
 *   4. VERIFY    — confirm changes were applied
 *   5. COMMIT    — finalize or rollback
 *
 * On failure, all files are restored to their pre-registration state.
 *
 * @param config - Registration configuration specifying the variant to register.
 * @returns A result object with success status, modified files, and any errors.
 */
export async function registerVariantInWorkspace(
  config: WorkspaceRegistrationConfig,
): Promise<WorkspaceRegistrationResult> {
  const allErrors: RegistrationError[] = [];
  let snapshots: Map<string, FileSnapshot> = new Map();
  let modifiedFiles: string[] = [];

  console.log(`\n=== Workspace Integration: ${config.variantName} ===`);
  console.log(`Type: ${config.variantType} | Version: ${config.version}\n`);

  // ─── PHASE 1: PREFLIGHT ─────────────────────────────────────────────
  console.log(`Phase 1: PREFLIGHT — validating targets (no writes)`);
  const preflight = await runPreflight(config);

  if (!preflight.passed) {
    console.log(`  ❌ Preflight FAILED — aborting, no writes performed`);
    for (const err of preflight.errors) {
      console.log(`     [${err.step}] ${err.message}${err.file ? ` (${err.file})` : ''}`);
    }
    allErrors.push(...preflight.errors);
    return {
      success: false,
      preflightPassed: false,
      filesModified: [],
      rollbackAvailable: false,
      errors: allErrors,
    };
  }

  console.log(`  ✅ Preflight passed`);

  // ─── PHASE 2: BEGIN (Snapshot) ──────────────────────────────────────
  console.log(`Phase 2: BEGIN — snapshotting files`);
  try {
    snapshots = snapshotFiles();
    console.log(`  ✅ Snapshotted ${snapshots.size} files`);
  } catch (err) {
    const errorMsg = `Snapshot failed: ${err instanceof Error ? err.message : String(err)}`;
    console.log(`  ❌ ${errorMsg}`);
    allErrors.push({
      phase: 'begin',
      step: 'snapshot',
      message: errorMsg,
    });
    return {
      success: false,
      preflightPassed: true,
      filesModified: [],
      rollbackAvailable: false,
      errors: allErrors,
    };
  }

  // ─── PHASE 3: WRITE (Ordered) ────────────────────────────────────────
  console.log(`Phase 3: WRITE — applying changes`);
  const writeResult = await writePhase(config);

  if (writeResult.errors.length > 0) {
    console.log(`  ❌ Write FAILED — rolling back`);
    for (const err of writeResult.errors) {
      console.log(`     [${err.step}] ${err.message}${err.file ? ` (${err.file})` : ''}`);
    }
    allErrors.push(...writeResult.errors);

    // Rollback
    rollbackFiles(snapshots);

    return {
      success: false,
      preflightPassed: true,
      filesModified: writeResult.modifiedFiles,
      rollbackAvailable: true,
      errors: allErrors,
    };
  }

  modifiedFiles = writeResult.modifiedFiles;
  console.log(`  ✅ Write complete — ${modifiedFiles.length} files modified`);

  // ─── PHASE 4: VERIFY ────────────────────────────────────────────────
  console.log(`Phase 4: VERIFY — confirming changes`);
  const verifyResult = await verifyPhase(config, modifiedFiles, snapshots);

  if (!verifyResult.passed) {
    console.log(`  ❌ Verify FAILED — rolling back`);
    for (const err of verifyResult.errors) {
      console.log(`     [${err.step}] ${err.message}${err.file ? ` (${err.file})` : ''}`);
    }
    allErrors.push(...verifyResult.errors);

    // Rollback
    rollbackFiles(snapshots);

    return {
      success: false,
      preflightPassed: true,
      filesModified: modifiedFiles,
      rollbackAvailable: true,
      errors: allErrors,
    };
  }

  console.log(`  ✅ Verify passed`);

  // ─── PHASE 5: COMMIT ────────────────────────────────────────────────
  console.log(`Phase 5: COMMIT — finalizing`);
  commitPhase();

  console.log(`\n✅ Workspace integration complete for ${config.variantName}`);
  console.log(`   Files modified: ${modifiedFiles.length}`);
  for (const f of modifiedFiles) {
    console.log(`     - ${f}`);
  }

  return {
    success: true,
    preflightPassed: true,
    filesModified: modifiedFiles,
    rollbackAvailable: false,
    errors: [],
  };
}

/**
 * Dry-run version of registerVariantInWorkspace.
 * Runs preflight checks only and reports what would be written, without any writes.
 *
 * @param config - Registration configuration specifying the variant to plan.
 * @returns Preflight results and a list of planned changes.
 */
export async function dryRunRegistration(
  config: WorkspaceRegistrationConfig,
): Promise<{
  readonly preflightPassed: boolean;
  readonly plannedChanges: readonly PlannedChange[];
  readonly errors: readonly string[];
}> {
  console.log(`\n=== Dry Run: Workspace Integration for ${config.variantName} ===`);
  console.log(`Type: ${config.variantType} | Version: ${config.version}\n`);

  // Run preflight
  const preflight = await runPreflight(config);
  const errors = preflight.errors.map(e => `[${e.phase}:${e.step}] ${e.message}${e.file ? ` (${e.file})` : ''}`);

  // Build planned changes (only if preflight passes)
  const plannedChanges: PlannedChange[] = [];

  if (preflight.passed) {
    // 1. propagation-map.json
    try {
      const content = readUTF8File(PROPAGATION_MAP_PATH);
      const data = safeJsonParse(content) as Record<string, unknown>;
      const domains = getMarkerInjectDomains(data);
      const injectDomains = domains.filter(d => !d.targetVariants.includes(config.variantName));
      if (injectDomains.length > 0) {
        plannedChanges.push({
          file: PROPAGATION_MAP_PATH,
          action: 'update',
          description: `Add "${config.variantName}" to target_variants in ${injectDomains.length} marker-inject domain(s): ${injectDomains.map(d => d.key).join(', ')}`,
        });
      }
    } catch { /* skip */ }

    // 2. VERSION_REGISTRY.json
    try {
      const content = readUTF8File(VERSION_REGISTRY_PATH);
      if (!content.includes(config.variantName)) {
        plannedChanges.push({
          file: VERSION_REGISTRY_PATH,
          action: 'update',
          description: `Add nested object entry for "${config.variantName}" (version ${config.version}, status beta)`,
        });
      }
    } catch { /* skip */ }

    // 3. README.md
    try {
      const content = readUTF8File(README_PATH);
      if (!content.includes(`### ${config.variantName}\n`)) {
        plannedChanges.push({
          file: README_PATH,
          action: 'update',
          description: `Insert variant entry in ## Variants / ## Templates section`,
        });
      }
    } catch { /* skip */ }

    // 4. new-project scripts
    for (const [filePath, label] of [
      [NEW_PROJECT_TS, 'new-project.ts'],
      [NEW_PROJECT_SH, 'new-project.sh'],
      [NEW_PROJECT_PS1, 'new-project.ps1'],
    ] as const) {
      if (!existsSync(filePath)) continue;
      try {
        const content = readUTF8File(filePath);
        if (!content.includes(config.variantName)) {
          plannedChanges.push({
            file: filePath,
            action: 'update',
            description: `Inject "${config.variantName}" into VARIANT_OPTIONS`,
          });
        }
      } catch { /* skip */ }
    }

    // 5. AGENTS.md
    try {
      const content = readUTF8File(AGENTS_MD_PATH);
      if (!content.includes(`| ${config.variantName} |`)) {
        plannedChanges.push({
          file: AGENTS_MD_PATH,
          action: 'update',
          description: `Add row to PM Dispatch table`,
        });
      }
    } catch { /* skip */ }
  }

  console.log(`\nPreflight: ${preflight.passed ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Planned changes: ${plannedChanges.length}`);
  for (const change of plannedChanges) {
    console.log(`  [${change.action}] ${change.file}`);
    console.log(`    ${change.description}`);
  }

  if (errors.length > 0) {
    console.log(`\nErrors:`);
    for (const err of errors) {
      console.log(`  ❌ ${err}`);
    }
  }

  return {
    preflightPassed: preflight.passed,
    plannedChanges,
    errors,
  };
}
