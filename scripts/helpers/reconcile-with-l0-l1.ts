#!/usr/bin/env tsx
/**
 * L0/L1 Reconciliation
 *
 * Compares L2 scan results with L0/L1 versions and determines
 * which files to keep in variant, move to common, or discard.
 *
 * @version 1.1.0
 * @phase 2: L0/L1 Reconciliation
 *
 * Dependencies:
 * - helpers/scan-l2-project.ts (File classification)
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 * - lib/pipeline-state.ts (State persistence)
 */

import * as semver from 'semver';
import { join, basename } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { FileClassification, L2ScanResult } from './scan-l2-project.js';
import { fatalError, warningError, ErrorPhase } from '../lib/error-handling.js';
import { readUTF8File } from '../lib/encoding-utils.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ReconciledManifest {
  /** Files to keep in variant-specific */
  keepInVariant: ReconciledFile[];
  /** Files to move to common (anti-swelling protection) */
  moveToCommon: ReconciledFile[];
  /** Files to discard (outdated or superseded) */
  discard: ReconciledFile[];
  /** Conflicts and their resolutions */
  conflicts: ConflictResolution[];
  /** Summary statistics */
  summary: {
    totalFiles: number;
    keepInVariantCount: number;
    moveToCommonCount: number;
    discardCount: number;
    conflictCount: number;
  };
}

export interface ReconciledFile {
  /** Source file path (L2, L0, or L1) */
  sourcePath: string;
  /** Target path in final structure */
  targetPath: string;
  /** Reason for reconciliation decision */
  reason: string;
  /** Version of the file */
  version?: string;
  /** Hash for verification */
  hash?: string;
  /** Which layer this came from */
  sourceLayer: 'L0' | 'L1' | 'L2';
}

export interface ConflictResolution {
  /** File path with conflict */
  filePath: string;
  /** Type of conflict */
  conflict: 'version_mismatch' | 'content_divergence' | 'platform_parity' | 'circular_dependency';
  /** Resolution strategy */
  resolution: 'keep_l2' | 'keep_l0' | 'keep_l1' | 'merge' | 'manual_review';
  /** Reason for resolution */
  reason: string;
  /** Versions involved */
  versions: {
    l0?: string;
    l1?: string;
    l2?: string;
  };
  /** Is this resolution automated or requires manual review */
  requiresManualReview: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ANTI_SWELLING_THRESHOLD = 0.5; // 50% override threshold
const L0_ROOT = process.cwd();
const L1_COMMON = join(L0_ROOT, 'templates', 'common');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compare versions using semver
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal, undefined if incomparable
 * @version 1.1.0
 */
function compareVersions(v1: string | undefined, v2: string | undefined): number | undefined {
  if (!v1 || !v2) {
    return undefined;
  }

  if (!semver.valid(v1) || !semver.valid(v2)) {
    return undefined;
  }

  if (semver.gt(v1, v2)) {
    return 1;
  } else if (semver.lt(v1, v2)) {
    return -1;
  } else {
    return 0;
  }
}

/**
 * Determine if file should be moved to common based on override percentage
 * @version 1.1.0
 */
function shouldMoveToCommon(
  file: FileClassification,
  totalFilesInCategory: number
): { move: boolean; reason: string } {
  // If file is new, doesn't apply
  if (file.classification === 'new') {
    return { move: false, reason: 'New file, no override' };
  }

  // If file only exists in L2, doesn't apply
  if (!file.existsInL0 && !file.existsInL1) {
    return { move: false, reason: 'New file, no override' };
  }

  // Check if this is a common file that should not be overridden
  const commonFiles = [
    'CLAUDE.md',
    'GEMINI.md',
    'README.md',
    'package.json',
    '.claude/settings.json',
    '.gemini/settings.json',
  ];

  const isCommonFile = commonFiles.some(cf => file.relativePath.endsWith(cf));

  if (isCommonFile && file.classification === 'modified') {
    // Check override percentage (simplified - would need full scan in production)
    // For now, conservative approach: if modifying core config, flag for review
    return {
      move: true,
      reason: 'Core configuration file modified - consider moving to common if used across variants',
    };
  }

  return { move: false, reason: 'Variant-specific file' };
}

// ============================================================================
// RECONCILIATION LOGIC
// ============================================================================

/**
 * Reconcile a single file against L0 and L1
 * @version 1.1.0
 */
function reconcileFile(
  file: FileClassification,
  variantName: string
): {
  decision: 'keep' | 'move' | 'discard';
  reason: string;
  sourceLayer: 'L0' | 'L1' | 'L2';
  conflict?: ConflictResolution;
} {
  const { relativePath, classification, l0Version, l1Version, l2Version, existsInL0, existsInL1 } = file;

  // Case 1: New file (only in L2)
  if (classification === 'new') {
    return {
      decision: 'keep',
      reason: `New file in ${variantName} variant`,
      sourceLayer: 'L2',
    };
  }

  // Case 2: Identical to L0 or L1
  if (classification === 'identical') {
    return {
      decision: 'discard',
      reason: 'Identical to existing file in L0/L1 - no action needed',
      sourceLayer: existsInL0 ? 'L0' : 'L1',
    };
  }

  // Case 3: Modified file
  if (classification === 'modified') {
    // Version comparison
    const versionComparison = compareVersions(l2Version, l0Version || l1Version);

    if (versionComparison === 1) {
      // L2 version is newer
      return {
        decision: 'keep',
        reason: `L2 version (${l2Version}) is newer than L0/L1 (${l0Version || l1Version})`,
        sourceLayer: 'L2',
      };
    } else if (versionComparison === -1) {
      // L0/L1 version is newer
      return {
        decision: 'discard',
        reason: `L0/L1 version (${l0Version || l1Version}) is newer than L2 (${l2Version}) - use L0/L1 version`,
        sourceLayer: existsInL0 ? 'L0' : 'L1',
      };
    } else if (versionComparison === 0) {
      // Versions equal but content differs - conflict
      return {
        decision: 'keep',
        reason: `Same version (${l2Version}) but different content - L2 variant may have variant-specific changes`,
        sourceLayer: 'L2',
        conflict: {
          filePath: relativePath,
          conflict: 'content_divergence',
          resolution: 'keep_l2',
          reason: 'Same version but content differs - preserving L2 variant for review',
          versions: { l0: l0Version, l1: l1Version, l2: l2Version },
          requiresManualReview: true,
        },
      };
    }

    // No version info - keep L2 for review
    return {
      decision: 'keep',
      reason: 'Modified file without version headers - preserving L2 for manual review',
      sourceLayer: 'L2',
    };
  }

  // Case 4: Conflict
  if (classification === 'conflict') {
    const conflict: ConflictResolution = {
      filePath: relativePath,
      conflict: 'content_divergence',
      resolution: 'manual_review',
      reason: 'L0 and L1 have diverged - requires manual reconciliation',
      versions: { l0: l0Version, l1: l1Version, l2: l2Version },
      requiresManualReview: true,
    };

    // Attempt automated resolution
    const l0vsL1 = compareVersions(l0Version, l1Version);
    const l2vsL0 = compareVersions(l2Version, l0Version);
    const l2vsL1 = compareVersions(l2Version, l1Version);

    // If L2 is newest, keep it
    if ((l2vsL0 === 1 || l2vsL0 === undefined) && (l2vsL1 === 1 || l2vsL1 === undefined)) {
      conflict.resolution = 'keep_l2';
      conflict.reason = 'L2 version is newest - keeping variant version';
      conflict.requiresManualReview = false;

      return {
        decision: 'keep',
        reason: conflict.reason,
        sourceLayer: 'L2',
        conflict,
      };
    }

    // If L0 is newest, use it
    if (l0vsL1 === 1 || (l0vsL1 === undefined && existsInL0)) {
      conflict.resolution = 'keep_l0';
      conflict.reason = 'L0 version is newest - using workspace version';
      conflict.requiresManualReview = false;

      return {
        decision: 'discard',
        reason: conflict.reason,
        sourceLayer: 'L0',
        conflict,
      };
    }

    // If L1 is newest, use it
    if (l0vsL1 === -1 || (l0vsL1 === undefined && existsInL1)) {
      conflict.resolution = 'keep_l1';
      conflict.reason = 'L1 version is newest - using common template version';
      conflict.requiresManualReview = false;

      return {
        decision: 'discard',
        reason: conflict.reason,
        sourceLayer: 'L1',
        conflict,
      };
    }

    // Cannot auto-resolve - manual review required
    return {
      decision: 'keep',
      reason: 'Unresolvable conflict - requires manual review',
      sourceLayer: 'L2',
      conflict,
    };
  }

  // Fallback - keep L2
  return {
    decision: 'keep',
    reason: 'Default - preserving L2 file',
    sourceLayer: 'L2',
  };
}

/**
 * Apply anti-swelling protection
 * @version 1.1.0
 */
function applyAntiSwellingProtection(
  files: FileClassification[],
  keepInVariant: ReconciledFile[]
): { moveToCommon: ReconciledFile[]; warnings: string[] } {
  const moveToCommon: ReconciledFile[] = [];
  const warnings: string[] = [];

  // Group files by category
  const byCategory = new Map<string, FileClassification[]>();

  for (const file of files) {
    const category = file.relativePath.split('/')[0];
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
    }
    byCategory.get(category)!.push(file);
  }

  // Check each category for swelling
  for (const [category, categoryFiles] of byCategory.entries()) {
    const modifiedCount = categoryFiles.filter(f => f.classification === 'modified').length;
    const totalCount = categoryFiles.length;

    if (totalCount === 0) continue;

    const overrideRatio = modifiedCount / totalCount;

    if (overrideRatio >= ANTI_SWELLING_THRESHOLD) {
      const warning =
        `⚠️  Category '${category}' has ${overrideRatio.toFixed(1)}% override rate ` +
        `(${modifiedCount}/${totalCount} files). Consider consolidating to common.`;

      warnings.push(warning);

      // Mark core files for move to common
      for (const file of categoryFiles) {
        if (file.classification === 'modified') {
          const moveCheck = shouldMoveToCommon(file, totalCount);
          if (moveCheck.move) {
            // Find in keepInVariant and move to moveToCommon
            const index = keepInVariant.findIndex(f => f.targetPath === file.relativePath);
            if (index !== -1) {
              const [fileToMove] = keepInVariant.splice(index, 1);
              moveToCommon.push({
                ...fileToMove,
                reason: moveCheck.reason,
              });
            }
          }
        }
      }
    }
  }

  return { moveToCommon, warnings };
}

// ============================================================================
// MAIN RECONCILIATION FUNCTION
// ============================================================================

/**
 * Reconcile L2 scan results with L0 and L1
 * @version 1.1.0
 */
export async function reconcileWithL0L1(
  scanResult: L2ScanResult,
  variantName: string
): Promise<ReconciledManifest> {
  console.log(`\n=== Reconciling with L0/L1 ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Files to reconcile: ${scanResult.files.length}\n`);

  const keepInVariant: ReconciledFile[] = [];
  const discard: ReconciledFile[] = [];
  const conflicts: ConflictResolution[] = [];

  // Reconcile each file
  for (const file of scanResult.files) {
    const result = reconcileFile(file, variantName);

    const reconciledFile: ReconciledFile = {
      sourcePath: join(scanResult.scanMetadata.l2ProjectPath, file.relativePath),
      targetPath: file.relativePath,
      reason: result.reason,
      version: file.l2Version,
      hash: file.hashL2,
      sourceLayer: result.sourceLayer,
    };

    switch (result.decision) {
      case 'keep':
        keepInVariant.push(reconciledFile);
        break;
      case 'discard':
        discard.push(reconciledFile);
        break;
      case 'move':
        // Will be handled by anti-swelling protection
        keepInVariant.push(reconciledFile);
        break;
    }

    if (result.conflict) {
      conflicts.push(result.conflict);
    }
  }

  // Apply anti-swelling protection
  console.log(`\n=== Applying Anti-Swelling Protection ===`);
  const { moveToCommon, warnings } = applyAntiSwellingProtection(scanResult.files, keepInVariant);

  if (warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    for (const warning of warnings) {
      console.warn(warning);
    }
  }

  // Remove moved files from keepInVariant
  for (const movedFile of moveToCommon) {
    const index = keepInVariant.findIndex(f => f.targetPath === movedFile.targetPath);
    if (index !== -1) {
      keepInVariant.splice(index, 1);
    }
  }

  // Compute summary
  const summary = {
    totalFiles: scanResult.files.length,
    keepInVariantCount: keepInVariant.length,
    moveToCommonCount: moveToCommon.length,
    discardCount: discard.length,
    conflictCount: conflicts.length,
  };

  console.log(`\n=== Reconciliation Complete ===`);
  console.log(`Keep in variant: ${summary.keepInVariantCount}`);
  console.log(`Move to common: ${summary.moveToCommonCount}`);
  console.log(`Discard: ${summary.discardCount}`);
  console.log(`Conflicts: ${summary.conflictCount}`);

  if (conflicts.length > 0) {
    console.log(`\n⚠️  Conflicts requiring attention:`);
    for (const conflict of conflicts) {
      console.log(`  - ${conflict.filePath}: ${conflict.conflict} (${conflict.resolution})`);
      if (conflict.requiresManualReview) {
        console.log(`    ⚠️  MANUAL REVIEW REQUIRED`);
      }
    }
  }

  // Save to state file
  const stateDir = join(L0_ROOT, '.pipeline-state');
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const manifestPath = join(stateDir, 'reconciled-manifest.json');
  const manifest: ReconciledManifest = {
    keepInVariant,
    moveToCommon,
    discard,
    conflicts,
    summary,
  };

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\n✅ Manifest saved to: ${manifestPath}`);

  return manifest;
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const scanResultArg = args.find(arg => arg.startsWith('--scan-result='))?.split('=')[1];
  const variantArg = args.find(arg => arg.startsWith('--variant='))?.split('=')[1];

  if (!scanResultArg || !variantArg) {
    console.error('Usage: bun scripts/helpers/reconcile-with-l0-l1.ts --scan-result=<path> --variant=<name>');
    process.exit(1);
  }

  try {
    const scanResultJson = readFileSync(scanResultArg, 'utf-8');
    const scanResult = JSON.parse(scanResultJson) as L2ScanResult;

    await reconcileWithL0L1(scanResult, variantArg);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Reconciliation failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}

export { reconcileFile, applyAntiSwellingProtection };
