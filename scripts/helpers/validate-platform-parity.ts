#!/usr/bin/env tsx
/**
 * Platform Parity Validator
 *
 * Validates cross-platform parity between .claude/ and .gemini/ directories.
 * Ensures structural equivalence, settings schema parity, and command/skill alignment.
 *
 * @version 1.1.0
 * @phase 3: Platform Parity Validation
 *
 * Dependencies:
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 */

import { join, relative, dirname } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { readUTF8File } from '../lib/encoding-utils.js';
import { ErrorPhase, fatalError, warningError } from '../lib/error-handling.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ParityValidationResult {
  /** Whether parity violations were found */
  hasParityViolations: boolean;
  /** List of parity violations */
  violations: ParityViolation[];
  /** Summary statistics */
  summary: {
    claudeOnlyFiles: number;
    geminiOnlyFiles: number;
    bothPlatformsFiles: number;
    totalViolations: number;
  };
}

export interface ParityViolation {
  /** Violation type */
  type: 'claude_only' | 'gemini_only' | 'schema_mismatch' | 'content_divergence' | 'missing_gemini_parity_skip';
  /** File path relative to variant root */
  filePath: string;
  /** Which platform has the file */
  platform: 'claude' | 'gemini' | 'both';
  /** Severity */
  severity: 'fatal' | 'warning' | 'info';
  /** Description of the violation */
  description: string;
  /** Suggested remediation */
  remediation: string;
}

export interface PlatformFileManifest {
  /** Files only in .claude/ */
  claudeOnly: string[];
  /** Files only in .gemini/ */
  geminiOnly: string[];
  /** Files in both platforms */
  both: string[];
  /** Files marked with gemini-parity: skip */
  skipped: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================()

const WORKSPACE_ROOT = process.cwd();
const SETTINGS_JSON_SCHEMA = {
  // Common tier (shared) - must be identical
  shared: ['mcpServers', 'hooks.SessionStart', 'hooks.PostToolUse'],
  // Claude-only tier (no .gemini parity required)
  claude_only: ['permissions', 'env', 'teammateMode', 'hooks.TeammateIdle', 'hooks.TaskCreated', 'hooks.TaskCompleted'],
  // Gemini-only tier (no .claude parity required)
  gemini_only: [], // TBD - add when Gemini-specific settings emerge
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Recursively scan directory for files
 * @version 1.1.0
 */
function scanDirectoryRecursively(dirPath: string, extensions: string[] = []): string[] {
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    return files;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__MACOSX') {
        continue;
      }
      // Recurse into subdirectory
      files.push(...scanDirectoryRecursively(fullPath, extensions));
    } else if (entry.isFile()) {
      // Filter by extension if specified
      if (extensions.length === 0 || extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Check if file has gemini-parity: skip frontmatter
 * @version 1.1.0
 */
function hasGeminiParitySkip(filePath: string): boolean {
  try {
    const content = readUTF8File(filePath);
    const match = content.match(/gemini-parity:\s*skip/i);
    return match !== null;
  } catch {
    return false;
  }
}

/**
 * Extract frontmatter from file
 * @version 1.1.0
 */
function extractFrontmatter(filePath: string): Record<string, any> | null {
  try {
    const content = readUTF8File(filePath);

    // Check for YAML frontmatter
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return null;
    }

    const frontmatterText = match[1];
    const frontmatter: Record<string, any> = {};

    // Simple YAML parser (simplified for common use cases)
    const lines = frontmatterText.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();

        // Parse boolean, number, string, array
        if (value === 'true') {
          frontmatter[key] = true;
        } else if (value === 'false') {
          frontmatter[key] = false;
        } else if (value.startsWith('[') && value.endsWith(']')) {
          frontmatter[key] = value.slice(1, -1).split(',').map(s => s.trim());
        } else if (!isNaN(parseFloat(value))) {
          frontmatter[key] = parseFloat(value);
        } else {
          frontmatter[key] = value;
        }
      }
    }

    return frontmatter;
  } catch {
    return null;
  }
}

/**
 * Compare JSON schemas for shared tier settings
 * @version 1.1.0
 */
function compareSharedSettingsSchema(
  claudeSettings: Record<string, any>,
  geminiSettings: Record<string, any>
): string[] {
  const mismatches: string[] = [];

  // Check shared tier keys
  for (const key of SETTINGS_JSON_SCHEMA.shared) {
    const claudeValue = JSON.stringify(claudeSettings[key]);
    const geminiValue = JSON.stringify(geminiSettings[key]);

    if (claudeValue !== geminiValue) {
      mismatches.push(
        `Shared tier setting '${key}' differs: ` +
        `claude=${claudeValue}, gemini=${geminiValue}`
      );
    }
  }

  return mismatches;
}

// ============================================================================
// PARITY VALIDATION
// ============================================================================

/**
 * Build platform file manifest
 * @version 1.1.0
 */
function buildPlatformManifest(variantPath: string): PlatformFileManifest {
  const claudePath = join(variantPath, '.claude');
  const geminiPath = join(variantPath, '.gemini');

  const manifest: PlatformFileManifest = {
    claudeOnly: [],
    geminiOnly: [],
    both: [],
    skipped: [],
  };

  // Scan .claude/
  if (existsSync(claudePath)) {
    const claudeFiles = scanDirectoryRecursively(claudePath, ['.md', '.json']);

    for (const claudeFile of claudeFiles) {
      const relativePath = relative(claudePath, claudeFile);

      // Check for gemini-parity: skip
      if (hasGeminiParitySkip(claudeFile)) {
        manifest.skipped.push(relativePath);
        continue;
      }

      // Check if corresponding file exists in .gemini/
      const geminiFile = join(geminiPath, relativePath);
      if (!existsSync(geminiFile)) {
        manifest.claudeOnly.push(relativePath);
      } else {
        manifest.both.push(relativePath);
      }
    }
  }

  // Scan .gemini/
  if (existsSync(geminiPath)) {
    const geminiFiles = scanDirectoryRecursively(geminiPath, ['.md', '.json']);

    for (const geminiFile of geminiFiles) {
      const relativePath = relative(geminiPath, geminiFile);

      // Skip if already counted in "both"
      if (manifest.both.includes(relativePath)) {
        continue;
      }

      // Check if corresponding file exists in .claude/
      const claudeFile = join(claudePath, relativePath);
      if (!existsSync(claudeFile)) {
        manifest.geminiOnly.push(relativePath);
      }
    }
  }

  return manifest;
}

/**
 * Validate settings.json schema parity
 * @version 1.1.0
 */
function validateSettingsParity(variantPath: string): ParityViolation[] {
  const violations: ParityViolation[] = [];

  const claudeSettingsPath = join(variantPath, '.claude', 'settings.json');
  const geminiSettingsPath = join(variantPath, '.gemini', 'settings.json');

  // Both settings.json must exist
  if (!existsSync(claudeSettingsPath) && !existsSync(geminiSettingsPath)) {
    // Neither exists - not a violation for new variants
    return violations;
  }

  if (existsSync(claudeSettingsPath) && !existsSync(geminiSettingsPath)) {
    violations.push({
      type: 'claude_only',
      filePath: '.claude/settings.json',
      platform: 'claude',
      severity: 'fatal',
      description: '.claude/settings.json exists but .gemini/settings.json is missing',
      remediation: 'Create .gemini/settings.json with shared tier settings from .claude/settings.json',
    });
    return violations;
  }

  if (!existsSync(claudeSettingsPath) && existsSync(geminiSettingsPath)) {
    violations.push({
      type: 'gemini_only',
      filePath: '.gemini/settings.json',
      platform: 'gemini',
      severity: 'fatal',
      description: '.gemini/settings.json exists but .claude/settings.json is missing',
      remediation: 'Create .claude/settings.json with shared tier settings from .gemini/settings.json',
    });
    return violations;
  }

  // Both exist - validate schema parity
  try {
    const claudeSettings = JSON.parse(readUTF8File(claudeSettingsPath));
    const geminiSettings = JSON.parse(readUTF8File(geminiSettingsPath));

    // Check shared tier parity
    const schemaMismatches = compareSharedSettingsSchema(claudeSettings, geminiSettings);

    for (const mismatch of schemaMismatches) {
      violations.push({
        type: 'schema_mismatch',
        filePath: '.claude/settings.json <-> .gemini/settings.json',
        platform: 'both',
        severity: 'fatal',
        description: mismatch,
        remediation: 'Ensure shared tier settings (mcpServers, hooks.SessionStart, hooks.PostToolUse) are identical in both files',
      });
    }
  } catch (error) {
    violations.push({
      type: 'schema_mismatch',
      filePath: '.claude/settings.json <-> .gemini/settings.json',
      platform: 'both',
      severity: 'fatal',
      description: `Failed to parse settings.json: ${error instanceof Error ? error.message : String(error)}`,
      remediation: 'Ensure both settings.json files are valid JSON',
    });
  }

  return violations;
}

/**
 * Validate command parity
 * @version 1.1.0
 */
function validateCommandParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  // Check commands/ directory
  for (const claudeOnly of manifest.claudeOnly) {
    if (claudeOnly.startsWith('commands/') && claudeOnly.endsWith('.md')) {
      // Check if has gemini-parity: skip
      if (manifest.skipped.includes(claudeOnly)) {
        continue;
      }

      violations.push({
        type: 'claude_only',
        filePath: `.claude/${claudeOnly}`,
        platform: 'claude',
        severity: 'fatal',
        description: `Command file exists only in .claude/: ${claudeOnly}`,
        remediation: `Create corresponding file in .gemini/commands/ or add 'gemini-parity: skip' to frontmatter`,
      });
    }
  }

  for (const geminiOnly of manifest.geminiOnly) {
    if (geminiOnly.startsWith('commands/') && geminiOnly.endsWith('.md')) {
      violations.push({
        type: 'gemini_only',
        filePath: `.gemini/${geminiOnly}`,
        platform: 'gemini',
        severity: 'fatal',
        description: `Command file exists only in .gemini/: ${geminiOnly}`,
        remediation: `Create corresponding file in .claude/commands/`,
      });
    }
  }

  return violations;
}

/**
 * Validate skill parity
 * @version 1.1.0
 */
function validateSkillParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  // Check skills/ directory
  for (const claudeOnly of manifest.claudeOnly) {
    if (claudeOnly.startsWith('skills/') && claudeOnly.endsWith('SKILL.md')) {
      // Check if has gemini-parity: skip
      if (manifest.skipped.includes(claudeOnly)) {
        continue;
      }

      violations.push({
        type: 'claude_only',
        filePath: `.claude/${claudeOnly}`,
        platform: 'claude',
        severity: 'fatal',
        description: `Skill exists only in .claude/: ${claudeOnly}`,
        remediation: `Create corresponding skill in .gemini/skills/ or add 'gemini-parity: skip' to frontmatter`,
      });
    }
  }

  for (const geminiOnly of manifest.geminiOnly) {
    if (geminiOnly.startsWith('skills/') && geminiOnly.endsWith('SKILL.md')) {
      violations.push({
        type: 'gemini_only',
        filePath: `.gemini/${geminiOnly}`,
        platform: 'gemini',
        severity: 'fatal',
        description: `Skill exists only in .gemini/: ${geminiOnly}`,
        remediation: `Create corresponding skill in .claude/skills/`,
      });
    }
  }

  return violations;
}

/**
 * Validate agent parity
 * @version 1.1.0
 */
function validateAgentParity(manifest: PlatformFileManifest): ParityViolation[] {
  const violations: ParityViolation[] = [];

  // Check agents/ directory
  for (const claudeOnly of manifest.claudeOnly) {
    if (claudeOnly.startsWith('agents/') && claudeOnly.endsWith('.md')) {
      violations.push({
        type: 'claude_only',
        filePath: `.claude/${claudeOnly}`,
        platform: 'claude',
        severity: 'warning',
        description: `Agent file exists only in .claude/: ${claudeOnly}`,
        remediation: `Create corresponding agent in .gemini/agents/ if applicable to Gemini platform`,
      });
    }
  }

  for (const geminiOnly of manifest.geminiOnly) {
    if (geminiOnly.startsWith('agents/') && geminiOnly.endsWith('.md')) {
      violations.push({
        type: 'gemini_only',
        filePath: `.gemini/${geminiOnly}`,
        platform: 'gemini',
        severity: 'warning',
        description: `Agent file exists only in .gemini/: ${geminiOnly}`,
        remediation: `Create corresponding agent in .claude/agents/ if applicable to Claude platform`,
      });
    }
  }

  return violations;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Validate platform parity for a variant
 * @version 1.1.0
 */
export async function validatePlatformParity(variantPath: string): Promise<ParityValidationResult> {
  console.log(`\n=== Validating Platform Parity ===`);
  console.log(`Variant path: ${variantPath}\n`);

  if (!existsSync(variantPath)) {
    throw fatalError(
      ErrorPhase.VALIDATION,
      'VARIANT_NOT_FOUND',
      `Variant path does not exist: ${variantPath}`,
      undefined,
      'Verify the variant path is correct'
    );
  }

  const violations: ParityViolation[] = [];

  // Build platform file manifest
  console.log(`=== Building Platform Manifest ===`);
  const manifest = buildPlatformManifest(variantPath);
  console.log(`Claude-only files: ${manifest.claudeOnly.length}`);
  console.log(`Gemini-only files: ${manifest.geminiOnly.length}`);
  console.log(`Both platforms: ${manifest.both.length}`);
  console.log(`Skipped (gemini-parity: skip): ${manifest.skipped.length}`);

  // Validate settings.json parity
  console.log(`\n=== Validating settings.json Parity ===`);
  const settingsViolations = validateSettingsParity(variantPath);
  violations.push(...settingsViolations);
  console.log(`Found ${settingsViolations.length} violations`);

  // Validate command parity
  console.log(`\n=== Validating Command Parity ===`);
  const commandViolations = validateCommandParity(manifest);
  violations.push(...commandViolations);
  console.log(`Found ${commandViolations.length} violations`);

  // Validate skill parity
  console.log(`\n=== Validating Skill Parity ===`);
  const skillViolations = validateSkillParity(manifest);
  violations.push(...skillViolations);
  console.log(`Found ${skillViolations.length} violations`);

  // Validate agent parity
  console.log(`\n=== Validating Agent Parity ===`);
  const agentViolations = validateAgentParity(manifest);
  violations.push(...agentViolations);
  console.log(`Found ${agentViolations.length} violations`);

  // Compute summary
  const summary = {
    claudeOnlyFiles: manifest.claudeOnly.length,
    geminiOnlyFiles: manifest.geminiOnly.length,
    bothPlatformsFiles: manifest.both.length,
    totalViolations: violations.length,
  };

  const hasParityViolations = violations.some(v => v.severity === 'fatal');

  console.log(`\n=== Platform Parity Validation Complete ===`);
  console.log(`Total violations: ${summary.totalViolations}`);
  console.log(`Fatal violations: ${violations.filter(v => v.severity === 'fatal').length}`);
  console.log(`Warnings: ${violations.filter(v => v.severity === 'warning').length}`);

  if (violations.length > 0) {
    console.log(`\n⚠️  Violations:`);
    for (const violation of violations) {
      const icon = violation.severity === 'fatal' ? '❌' : '⚠️ ';
      console.log(`${icon} [${violation.type}] ${violation.filePath}`);
      console.log(`   ${violation.description}`);
      console.log(`   Remediation: ${violation.remediation}`);
    }
  } else {
    console.log(`\n✅ No parity violations found`);
  }

  return {
    hasParityViolations,
    violations,
    summary,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const variantPathArg = args.find(arg => arg.startsWith('--variant-path='));

  if (!variantPathArg) {
    console.error('Usage: bun scripts/helpers/validate-platform-parity.ts --variant-path=<path-to-variant>');
    process.exit(1);
  }

  const variantPath = variantPathArg.split('=')[1];

  try {
    const result = await validatePlatformParity(variantPath);

    if (result.hasParityViolations) {
      console.log('\n❌ Platform parity validation failed');
      process.exit(1);
    } else {
      console.log('\n✅ Platform parity validation passed');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Platform parity validation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
