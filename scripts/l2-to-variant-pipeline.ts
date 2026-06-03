#!/usr/bin/env tsx
/**
 * L2-to-Variant Conversion Pipeline
 *
 * Converts L2 projects into new template variants with full governance,
 * lifecycle management, and cross-platform support.
 *
 * @version 1.0.0
 * @phase 0: ADR Validation
 * @phase 1: Variant Structure Conversion (L2 Analysis)
 * @phase 2: L0/L1 Reflection & Reconciliation
 * @phase 3: Variant Generation
 * @phase 3.5: Beta Lifecycle Setup
 * @phase 4: Integration
 *
 * @architecture docs/designs/l2-to-variant-conversion-pipeline.md
 * @governance CONSTITUTION.md §5 Multi-Agent Architecture
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname, basename } from 'path';
import { hash as createHash } from 'crypto';
import * as semver from 'semver';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface ADRValidationResult {
  approved: boolean;
  adrPath: string | null;
  status: 'approved' | 'not_found' | 'rejected' | 'pending';
  message: string;
}

interface FileClassification {
  relativePath: string;
  existsInL0: boolean;
  existsInL1: boolean;
  l0Version?: string;
  l1Version?: string;
  l2Version?: string;
  hashL0?: string;
  hashL1?: string;
  hashL2?: string;
  classification: 'new' | 'modified' | 'identical' | 'conflict';
  platformScope: 'claude' | 'gemini' | 'both' | 'neutral';
}

interface L2ScanResult {
  agents: FileClassification[];
  skills: FileClassification[];
  claude: FileClassification[];
  gemini: FileClassification[];
  docs: FileClassification[];
  scripts: FileClassification[];
  rootFiles: FileClassification[];
}

interface IntermediateManifest {
  scanMetadata: {
    l2ProjectPath: string;
    l2ProjectName: string;
    scannedAt: string;
    totalFiles: number;
    newFiles: number;
    modifiedFiles: number;
    identicalFiles: number;
  };
  classifications: {
    agents: FileClassification[];
    skills: FileClassification[];
    claude: FileClassification[];
    gemini: FileClassification[];
    docs: FileClassification[];
    rootFiles: FileClassification[];
  };
  variantCandidates: {
    variantSpecificAgents: string[];
    variantSpecificSkills: string[];
    variantSpecificCommands: string[];
    variantSpecificPlatformSkills: string[];
    overrideCandidates: OverrideCandidate[];
  };
}

interface OverrideCandidate {
  filePath: string;
  overrideType: 'additive' | 'replacement' | 'unknown';
  reason: string;
  existingInCommon: boolean;
  affectedAgents: string[];
}

interface ReconciledManifest {
  phase: 'reconciled';
  decisions: {
    keepInVariant: ReconciledFile[];
    moveToCommon: ReconciledFile[];
    discard: ReconciledFile[];
    conflicts: ConflictResolution[];
  };
  variantJson: {
    name: string;
    inherits_common: string;
    agent_overrides: Record<string, AgentOverride>;
    skill_manifest: SkillManifest;
    phases: PhaseOverrides;
    version: string;
    description: string;
  };
  propagationActions: {
    updateCommon: string[];
    backpropagateFromVariant: string[];
  };
}

interface ReconciledFile {
  sourcePath: string;
  targetPath: string;
  reason: string;
  version?: string;
  hash?: string;
}

interface ConflictResolution {
  filePath: string;
  conflict: 'version_mismatch' | 'content_divergence' | 'platform_parity';
  resolution: 'keep_l2' | 'keep_l0' | 'keep_l1' | 'merge';
  reason: string;
}

interface AgentOverride {
  type: 'additive' | 'replacement' | 'none';
  reason: string;
  since: string;
  reviewed_by: string;
  overrides: string[];
}

interface SkillManifest {
  variant_specific: Array<{
    name: string;
    layer: string;
    used_by_agents: string[];
    phases: number[];
    platform_parity: string;
  }>;
}

interface PhaseOverrides {
  phase3_name: string;
}

interface VariantJson {
  name: string;
  version: string;
  status: 'beta' | 'stable';
  description: string;
  inherits_common: string;
  agent_overrides: Record<string, AgentOverride>;
  skill_manifest: SkillManifest;
  phases: PhaseOverrides;
  lifecycle: {
    statusSince: string;
    lastTransition: string;
    betaEngagements: number;
    stablePromotedOn: string | null;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PROJECT_ROOT = process.cwd();
const TEMPLATES_DIR = join(PROJECT_ROOT, 'templates');
const COMMON_DIR = join(TEMPLATES_DIR, 'common');
const ADR_DIR = join(PROJECT_ROOT, 'docs', 'adr');

// ============================================================================
// PHASE 0: ADR VALIDATION
// ============================================================================

/**
 * Validate ADR exists and is approved before pipeline execution
 * @version 1.0.0
 */
function validateADRExists(variantName: string): ADRValidationResult {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  // Expected ADR path pattern: docs/adr/YYYYMM-variant-creation-<variant>.md
  const adrPattern = `docs/adr/${currentYear}${currentMonth}-variant-creation-${variantName}.md`;
  const adrPath = join(PROJECT_ROOT, adrPattern);

  if (!existsSync(adrPath)) {
    return {
      approved: false,
      adrPath: null,
      status: 'not_found',
      message: `ADR not found at ${adrPattern}. Create ADR before running pipeline. See template: docs/adr/templates/variant-creation-template.md`,
    };
  }

  const adrContent = stripBOM(readFileSync(adrPath, 'utf-8'));

  // Check ADR status
  const statusMatch = adrContent.match(/\*\*Status\*\*:\s*(Proposed|Accepted|Rejected)/);
  if (!statusMatch) {
    return {
      approved: false,
      adrPath,
      status: 'pending',
      message: `ADR exists but status is not set. Must set 'Status: **Accepted**' in ADR before pipeline execution.`,
    };
  }

  const status = statusMatch[1] as 'Proposed' | 'Accepted' | 'Rejected';

  if (status === 'Rejected') {
    return {
      approved: false,
      adrPath,
      status: 'rejected',
      message: `ADR is rejected. Cannot proceed with variant creation.`,
    };
  }

  if (status === 'Proposed') {
    return {
      approved: false,
      adrPath,
      status: 'pending',
      message: `ADR is in 'Proposed' status. Must change to 'Status: **Accepted**' before pipeline execution.`,
    };
  }

  // Accepted - proceed
  return {
    approved: true,
    adrPath,
    status: 'approved',
    message: `ADR approved. Pipeline execution authorized.`,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Strip UTF-8 BOM if present
 * @version 1.0.0
 */
function stripBOM(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1);
  }
  return content;
}

/**
 * Normalize line endings to LF
 * @version 1.0.0
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n');
}

/**
 * Compute SHA-256 hash of file content
 * @version 1.0.0
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Extract version from file header
 * @version 1.0.0
 */
function extractVersion(content: string): string | undefined {
  const versionMatch = content.match(/@version\s+(\d+\.\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : undefined;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const variantName = args.find(arg => arg.startsWith('--variant='))?.split('=')[1];

  if (!variantName) {
    console.error('Usage: bun scripts/l2-to-variant-pipeline.ts --variant=<variant-name> [--l2-path=<path>]');
    process.exit(1);
  }

  console.log(`=== L2-to-Variant Conversion Pipeline ===`);
  console.log(`Variant: ${variantName}\n`);

  // ============================================================================
  // PHASE 0: ADR Validation
  // ============================================================================

  console.log(`=== Phase 0: ADR Validation ===\n`);

  const adrCheck = validateADRExists(variantName);

  if (!adrCheck.approved) {
    console.error(`❌ ADR Check Failed: ${adrCheck.message}`);
    console.error(`\nRequired action:`);
    if (adrCheck.status === 'not_found') {
      console.error(`  1. Create ADR: docs/adr/${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-variant-creation-${variantName}.md`);
      console.error(`  2. Use template: docs/adr/templates/variant-creation-template.md`);
      console.error(`  3. Set status: 'Status: **Accepted**'`);
    } else if (adrCheck.status === 'pending') {
      console.error(`  1. Review ADR: ${adrCheck.adrPath}`);
      console.error(`  2. Update status: Change 'Status: **Proposed**' to 'Status: **Accepted**'`);
    } else if (adrCheck.status === 'rejected') {
      console.error(`  1. Review rejection rationale in ADR: ${adrCheck.adrPath}`);
      console.error(`  2. Address concerns or create new ADR with revised proposal`);
    }
    process.exit(1);
  }

  console.log(`✅ ADR approved: ${adrCheck.adrPath}`);
  console.log(`\n=== Proceeding to Phase 1: Variant Structure Conversion ===\n`);

  // TODO: Implement remaining phases in Wave 2-4
  console.log('Phase 1-4 implementation scheduled for Wave 2-4.');
  console.log('Wave 1 complete: TypeScript core + ADR validation foundation.');
}

// Run main if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  validateADRExists,
  stripBOM,
  normalizeLineEndings,
  computeHash,
  extractVersion,
};
