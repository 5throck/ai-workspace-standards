#!/usr/bin/env bun
/**
 * L3 Project Scanner
 *
 * Recursively scans L3 project directories and classifies files
 * for variant conversion pipeline.
 *
 * @version 1.3.0
 * @phase 1: L3 Analysis
 *
 * Dependencies:
 * - lib/encoding-utils.ts (UTF-8 handling)
 * - lib/error-handling.ts (Error management)
 * - lib/pipeline-state.ts (State persistence)
 *
 * Renamed from scan-l2-project.ts (see CONSTITUTION.md §Terminology Definition —
 * L2 = templates/co-*, L3 = Projects/*; this scanner operates on Projects/*).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { createHash } from 'crypto';
import { readUTF8File, detectEncoding } from '../lib/encoding-utils.ts';
import { fatalError, warningError, ErrorPhase, ErrorSeverity } from '../lib/error-handling.ts';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface FileClassification {
  /** Relative path from L3 project root */
  relativePath: string;
  /** File exists in L0 (workspace root) */
  existsInL0: boolean;
  /** File exists in L1 (templates/common/) */
  existsInL1: boolean;
  /** Version extracted from L0 file header (@version X.Y.Z) */
  l0Version?: string;
  /** Version extracted from L1 file header */
  l1Version?: string;
  /** Version extracted from L3 file header */
  l3Version?: string;
  /** SHA-256 hash of L0 file content */
  hashL0?: string;
  /** SHA-256 hash of L1 file content */
  hashL1?: string;
  /** SHA-256 hash of L3 file content */
  hashL3?: string;
  /** Classification based on comparison */
  classification: 'new' | 'modified' | 'identical' | 'conflict';
  /** Platform scope detection */
  platformScope: 'claude' | 'gemini' | 'both' | 'neutral';
}

export interface L3ScanResult {
  /** All classified files */
  files: FileClassification[];
  /** Scan summary statistics */
  summary: {
    totalFiles: number;
    newFiles: number;
    modifiedFiles: number;
    identicalFiles: number;
    conflicts: number;
  };
  /** Metadata about the scan */
  scanMetadata: {
    l3ProjectPath: string;
    l3ProjectName: string;
    scannedAt: string;
    platform: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const L0_ROOT = process.cwd();
const L1_COMMON = join(L0_ROOT, 'templates', 'common');

// File categories to scan
const SCAN_CATEGORIES = {
  agents: ['agents', '.claude/agents', '.gemini/agents'],
  skills: ['skills', '.claude/skills', '.gemini/skills'],
  commands: ['.claude/commands', '.gemini/commands'],
  configs: ['.claude', '.gemini'],
  scripts: ['scripts'],
  docs: ['docs'],
  // Procedure Schema YAML workflows (ADR-0063) — MUST survive L3→variant promotion
  // so promoted variants carry their (agent, phase) workflow corpus.
  procedures: ['procedures'],
  root: ['CLAUDE.md', 'GEMINI.md', 'README.md', 'CHANGELOG.md', 'package.json'],
} as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Compute SHA-256 hash of file content
 * @version 1.1.0
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Extract version from file header (@version X.Y.Z)
 * @version 1.1.0
 */
function extractVersion(content: string): string | undefined {
  const versionMatch = content.match(/@version\s+(\d+\.\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : undefined;
}

/**
 * Detect platform scope from file path
 * @version 1.1.0
 */
function detectPlatformScope(relativePath: string): FileClassification['platformScope'] {
  if (relativePath.includes('.claude/') && !relativePath.includes('.gemini/')) {
    return 'claude';
  }
  if (relativePath.includes('.gemini/') && !relativePath.includes('.claude/')) {
    return 'gemini';
  }
  if (relativePath.includes('.claude/') && relativePath.includes('.gemini/')) {
    return 'both'; // Should not happen in normal structure
  }
  return 'neutral';
}

/**
 * Recursively scan directory for files
 * @version 1.1.0
 */
function scanDirectoryRecursively(
  dirPath: string,
  baseDir: string,
  extensions: string[] = []
): string[] {
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    return files;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.pipeline-state') {
        continue;
      }
      // Recurse into subdirectory
      files.push(...scanDirectoryRecursively(fullPath, baseDir, extensions));
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
 * Classify a single file by comparing L0/L1/L3 versions
 * @version 1.1.0
 */
function classifyFile(
  l3Path: string,
  l3ProjectPath: string,
  l0Root: string,
  l1Common: string
): FileClassification {
  const relativePath = relative(l3ProjectPath, l3Path);
  const platformScope = detectPlatformScope(relativePath);

  // Check existence in L0 and L1
  const l0Path = join(l0Root, relativePath);
  const l1Path = join(l1Common, relativePath);

  const existsInL0 = existsSync(l0Path);
  const existsInL1 = existsSync(l1Path);

  // Read L3 file (must exist)
  let l3Content: string;
  let l3Encoding: string;

  try {
    const encoding = detectEncoding(l3Path);
    l3Encoding = encoding.encoding;
    l3Content = readUTF8File(l3Path);
  } catch (error) {
    throw fatalError(
      ErrorPhase.L3_SCAN,
      'L3_FILE_READ_FAILED',
      `Failed to read L3 file: ${relativePath}`,
      error instanceof Error ? error.message : String(error),
      'Ensure file is readable and valid UTF-8 encoding'
    );
  }

  const l3Version = extractVersion(l3Content);
  const hashL3 = computeHash(l3Content);

  // Read L0 and L1 if they exist
  let l0Version: string | undefined;
  let l1Version: string | undefined;
  let hashL0: string | undefined;
  let hashL1: string | undefined;

  if (existsInL0) {
    try {
      const l0Content = readUTF8File(l0Path);
      l0Version = extractVersion(l0Content);
      hashL0 = computeHash(l0Content);
    } catch (error) {
      throw warningError(
        ErrorPhase.L3_SCAN,
        'L0_FILE_READ_FAILED',
        `Failed to read L0 file: ${relativePath}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (existsInL1) {
    try {
      const l1Content = readUTF8File(l1Path);
      l1Version = extractVersion(l1Content);
      hashL1 = computeHash(l1Content);
    } catch (error) {
      throw warningError(
        ErrorPhase.L3_SCAN,
        'L1_FILE_READ_FAILED',
        `Failed to read L1 file: ${relativePath}`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Classify based on comparison
  let classification: FileClassification['classification'] = 'new';

  if (!existsInL0 && !existsInL1) {
    // New file - only exists in L3
    classification = 'new';
  } else if (existsInL0 && !existsInL1) {
    // Compare with L0 only
    if (hashL3 === hashL0) {
      classification = 'identical';
    } else {
      classification = 'modified';
    }
  } else if (!existsInL0 && existsInL1) {
    // Compare with L1 only
    if (hashL3 === hashL1) {
      classification = 'identical';
    } else {
      classification = 'modified';
    }
  } else if (existsInL0 && existsInL1) {
    // Compare with both L0 and L1
    const matchesL0 = hashL3 === hashL0;
    const matchesL1 = hashL3 === hashL1;

    if (matchesL0 && matchesL1) {
      classification = 'identical';
    } else if (matchesL1) {
      // L3 matches L1 (variant's inheritance source) even when L0 differs —
      // the variant inherits this file from templates/common, so the L3 copy is redundant.
      classification = 'identical';
    } else if (!matchesL0 && !matchesL1) {
      // Check if L0 and L1 are identical (then it's a true modification)
      if (hashL0 === hashL1) {
        classification = 'modified';
      } else {
        // L0 and L1 differ - potential conflict
        classification = 'conflict';
      }
    } else {
      // Matches L0 but not L1 - variant cannot inherit from common
      classification = 'conflict';
    }
  }

  return {
    relativePath,
    existsInL0,
    existsInL1,
    l0Version,
    l1Version,
    l3Version,
    hashL0,
    hashL1,
    hashL3,
    classification,
    platformScope,
  };
}

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================

/**
 * Scan L3 project and classify all files
 * @version 1.2.0
 */
export async function scanL3Project(l3ProjectPath: string): Promise<L3ScanResult> {
  console.log(`\n=== Scanning L3 Project ===`);
  console.log(`L3 Path: ${l3ProjectPath}`);
  console.log(`L0 Root: ${L0_ROOT}`);
  console.log(`L1 Common: ${L1_COMMON}\n`);

  if (!existsSync(l3ProjectPath)) {
    throw fatalError(
      ErrorPhase.L3_SCAN,
      'L3_PROJECT_NOT_FOUND',
      `L3 project path does not exist: ${l3ProjectPath}`,
      undefined,
      'Verify the L3 project path is correct and the directory exists'
    );
  }

  const l3ProjectName = basename(l3ProjectPath);
  const files: FileClassification[] = [];
  const startTime = Date.now();

  // Scan each category
  for (const [category, paths] of Object.entries(SCAN_CATEGORIES)) {
    console.log(`Scanning ${category}...`);

    for (const scanPath of paths) {
      const fullScanPath = join(l3ProjectPath, scanPath);

      if (!existsSync(fullScanPath)) {
        console.log(`  ⊘ ${scanPath} - not found, skipping`);
        continue;
      }

      const isDirectory = statSync(fullScanPath).isDirectory();
      let filesToScan: string[] = [];

      if (isDirectory) {
        // Scan directory recursively
        const extensions = category === 'scripts' ? ['.ts', '.sh', '.ps1'] :
                         category === 'agents' || category === 'skills' ? ['.md'] :
                         category === 'procedures' ? ['.yaml', '.yml', '.ts'] :
                         ['.md', '.json'];
        filesToScan = scanDirectoryRecursively(fullScanPath, l3ProjectPath, extensions);
      } else {
        // Single file
        filesToScan = [fullScanPath];
      }

      console.log(`  Found ${filesToScan.length} files in ${scanPath}`);

      // Classify each file
      for (const filePath of filesToScan) {
        try {
          const classification = classifyFile(filePath, l3ProjectPath, L0_ROOT, L1_COMMON);
          files.push(classification);
        } catch (error) {
          // Log error but continue scanning
          console.error(`  ❌ Failed to classify ${filePath}: ${error}`);
        }
      }
    }
  }

  // Compute summary
  const summary = {
    totalFiles: files.length,
    newFiles: files.filter(f => f.classification === 'new').length,
    modifiedFiles: files.filter(f => f.classification === 'modified').length,
    identicalFiles: files.filter(f => f.classification === 'identical').length,
    conflicts: files.filter(f => f.classification === 'conflict').length,
  };

  const scanDuration = Date.now() - startTime;

  console.log(`\n=== Scan Complete ===`);
  console.log(`Duration: ${scanDuration}ms`);
  console.log(`Total files: ${summary.totalFiles}`);
  console.log(`  New: ${summary.newFiles}`);
  console.log(`  Modified: ${summary.modifiedFiles}`);
  console.log(`  Identical: ${summary.identicalFiles}`);
  console.log(`  Conflicts: ${summary.conflicts}`);

  return {
    files,
    summary,
    scanMetadata: {
      l3ProjectPath,
      l3ProjectName,
      scannedAt: new Date().toISOString(),
      platform: process.platform,
    },
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const l3PathArg = args.find(arg => arg.startsWith('--l3-path='));

  if (!l3PathArg) {
    console.error('Usage: bun scripts/helpers/scan-l3-project.ts --l3-path=<path-to-l3-project>');
    process.exit(1);
  }

  const l3ProjectPath = l3PathArg.split('=')[1];

  try {
    const result = await scanL3Project(l3ProjectPath);

    // Output JSON for programmatic use
    const jsonPath = join(L0_ROOT, '.pipeline-state', 'l3-scan-result.json');
    const fs = await import('fs');
    const { mkdirSync, writeFileSync } = fs;
    const stateDir = join(L0_ROOT, '.pipeline-state');

    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true });
    }

    writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`\n✅ Scan result saved to: ${jsonPath}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Scan failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}

export { scanDirectoryRecursively, classifyFile };
