#!/usr/bin/env bun
/**
 * verify-adr-governance.ts
 * @version 1.4.0
 * @last_updated 2026-08-24
 *
 * Verifies the ADR→governance linkage mechanism (upward reflection gap detection)
 * and intentional-duplicate marker hash drift detection.
 *
 * Phase 1 (ADR Linkage): Detects Accepted ADRs that landed without any pointer from the governance docs.
 * Governance corpus: CONSTITUTION.md, docs/constitution/ (recursive), docs/governance/ (recursive)
 * ADR corpus: docs/adr/*.md (top level only — skips retired/ and templates/ subdirectories)
 *
 * Phase 2 (Marker Hash Drift): Detects intentional-duplicate markers whose source files have changed.
 * Scans templates/ for markers and validates sha256 hashes against their constitution sources.
 *
 * Rules:
 * - Only ADRs ON OR AFTER CUTOFF_DATE (2026-08-23) are checked
 * - Earlier ADRs are grandfathered silently (avoids ~50-file backfill noise)
 * - "Linked" means the ADR number or filename appears in any governance doc
 * - Accepted/active ADRs must be referenced from governance docs
 * - Marker hashes must match their section source (section-sliced sha256-8; WARN on drift in default mode, blocking in strict)
 * - Default mode: WARN-only (always exits 0 on findings; exits 1 only on operational failure)
 * - Strict mode (--strict): exits 1 on ADR-linkage OR marker-drift findings
 *
 * Usage: bun scripts/verify-adr-governance.ts [--update-marker-hashes] [--strict]
 *
 * Flags:
 * - --update-marker-hashes: Rewrite/insert source+hash fields in all markers (seeding mode)
 * - --strict: Exit 1 on ADR-linkage or marker-drift findings (blocking gate for dev-sync step 3.97; Stage 2b)
 *
 * Exit codes:
 * - 0: Check completed (default: findings are WARN-only; strict: no ADR-linkage or marker-drift findings)
 * - 1: Operational failure (e.g., docs/adr missing) OR strict mode with ADR-linkage or marker-drift findings
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  parseSectionNumber,
  parseMarkerFields,
  resolveConstitutionSource,
  computeSectionHash,
  scanIntentionalDuplicateMarkers,
  type IntentionalDuplicateMarker
} from './helpers/markers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// Constants
const CUTOFF_DATE = '2026-08-23';
const ADR_DIR = join(ROOT, 'docs', 'adr');
const CONSTITUTION_MD = join(ROOT, 'CONSTITUTION.md');
const CONSTITUTION_DIR = join(ROOT, 'docs', 'constitution');
const GOVERNANCE_DIR = join(ROOT, 'docs', 'governance');
const TEMPLATES_DIR = join(ROOT, 'templates');

// CLI flags
const UPDATE_MARKER_HASHES = process.argv.includes('--update-marker-hashes');
const STRICT = process.argv.includes('--strict');

/**
 * Represents a parsed ADR file
 */
interface ADR {
  number: string;
  slug: string;
  file: string;
  status: string | null;
  date: string | null;
}

/**
 * Classification of ADR status
 */
enum ADRStatus {
  Accepted = 'accepted',
  Proposed = 'proposed',
  Unparseable = 'unparseable',
}

/**
 * Check marker hash drift
 */
function checkMarkerDrift(markers: IntentionalDuplicateMarker[]): number {
  console.log('🔍 Checking intentional-duplicate marker drift...\n');

  let okCount = 0;
  let totalMarkers = markers.length;
  let findings = 0;

  for (const marker of markers) {
    // Check if marker has source/hash fields
    if (!marker.source || !marker.hash) {
      console.log(
        `[WARN] marker at ${marker.file}:${marker.line} lacks source/hash fields (seed with: bun scripts/verify-adr-governance.ts --update-marker-hashes)`
      );
      findings++;
      continue;
    }

    // Resolve source file
    const resolvedSource = marker.source.startsWith('docs/')
      ? join(ROOT, marker.source)
      : marker.source;

    if (!existsSync(resolvedSource)) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} references missing source: ${marker.source}`);
      findings++;
      continue;
    }

    // Compute current hash
    const currentHash = computeSectionHash(resolvedSource);

    if (!currentHash) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} - failed to compute hash for source: ${marker.source}`);
      findings++;
      continue;
    }

    // Check for drift
    if (currentHash !== marker.hash) {
      console.log(
        `[WARN] intentional-duplicate marker at ${marker.file}:${marker.line} is stale: source ${marker.source} changed since hash ${marker.hash} was recorded (expected ${currentHash}) — review the duplicated section and re-seed with --update-marker-hashes after updating it`
      );
      findings++;
      continue;
    }

    okCount++;
  }

  console.log(`\nintentional-duplicate markers: ${okCount}/${totalMarkers} in sync\n`);

  // Strict-mode note: marker-drift findings block in strict mode (Stage 2b)
  if (STRICT && findings > 0) {
    console.log(`⛔ Strict mode: ${findings} marker-drift finding(s) — blocking (Stage 2b; see docs/adr/0059)`);
  }

  return findings;
}

/**
 * Update marker hashes (seeding mode)
 */
function updateMarkerHashes(markers: IntentionalDuplicateMarker[]): void {
  console.log('🔄 Updating intentional-duplicate marker hashes...\n');

  let touchedCount = 0;

  for (const marker of markers) {
    // Resolve source file from section number
    const resolvedSource = resolveConstitutionSource(marker.section);

    if (!resolvedSource) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} - cannot resolve source for §${marker.section}`);
      continue;
    }

    // Compute current hash
    const currentHash = computeSectionHash(resolvedSource);

    if (!currentHash) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} - failed to compute hash for source: ${resolvedSource}`);
      continue;
    }

    // Read file content
    let content = readFileSync(marker.file, 'utf-8');
    const lines = content.split('\n');
    const lineIndex = marker.line - 1; // Convert to 0-indexed

    // Extract the marker prefix (everything before " -->")
    const line = lines[lineIndex];
    const markerPrefixMatch = line.match(/^(<!--\s*intentional-duplicate:\s*[^;>\n]*;?\s*)/);

    if (!markerPrefixMatch) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} - unexpected format, cannot update`);
      continue;
    }

    // Build new marker with source and hash
    // Convert absolute path to relative (handle both Unix and Windows paths)
    let relativeSource = resolvedSource.replace(ROOT, '').replace(/^[\/\\]+/, '');
    // Normalize forward slashes
    relativeSource = relativeSource.replace(/\\/g, '/');
    const newMarker = `${markerPrefixMatch[1]}source: ${relativeSource}; hash: ${currentHash} -->`;

    // Update the line
    lines[lineIndex] = newMarker;
    content = lines.join('\n');

    // Write back
    writeFileSync(marker.file, content, 'utf-8');
    console.log(`✓ Updated: ${marker.file} (§${marker.section} → ${relativeSource}, hash: ${currentHash})`);
    touchedCount++;
  }

  console.log(`\n✅ Updated ${touchedCount} marker(s)\n`);
}

/**
 * Read governance corpus files
 */
function readGovernanceCorpus(): string[] {
  const files: string[] = [];

  // CONSTITUTION.md (workspace root)
  if (existsSync(CONSTITUTION_MD)) {
    files.push(CONSTITUTION_MD);
  }

  // docs/constitution/**/*.md
  if (existsSync(CONSTITUTION_DIR)) {
    const constitutionFiles = readdirSync(CONSTITUTION_DIR, { recursive: true, withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
      .map(dirent => join(dirent.path, dirent.name));
    files.push(...constitutionFiles);
  }

  // docs/governance/**/*.md
  if (existsSync(GOVERNANCE_DIR)) {
    const governanceFiles = readdirSync(GOVERNANCE_DIR, { recursive: true, withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
      .map(dirent => join(dirent.path, dirent.name));
    files.push(...governanceFiles);
  }

  return files;
}

/**
 * Parse ADR number from filename
 * Expects: NNNN-slug.md where NNNN is 4-digit number
 */
function parseADRNumber(filename: string): string | null {
  const match = filename.match(/^(\d{4})-/);
  return match ? match[1] : null;
}

/**
 * Extract status from ADR file
 * Priority: YAML frontmatter > body line "**Status:**:"
 */
function extractADRStatus(content: string): string | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const statusMatch = frontmatter.match(/^status:\s*(.+)$/m);
    if (statusMatch) {
      return statusMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  // Fallback to body line
  const bodyStatusMatch = content.match(/^\*\*Status\*\*:\s*(.+)$/m);
  if (bodyStatusMatch) {
    return bodyStatusMatch[1].trim().replace(/^["']|["']$/g, '');
  }

  return null;
}

/**
 * Extract date from ADR file
 * Looks for YAML frontmatter date: YYYY-MM-DD
 */
function extractADRDate(content: string): string | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];
    const dateMatch = frontmatter.match(/^date:\s*(\d{4}-\d{2}-\d{2})$/m);
    if (dateMatch) {
      return dateMatch[1];
    }
  }
  return null;
}

/**
 * Classify ADR status
 */
function classifyStatus(status: string | null): ADRStatus {
  if (!status) return ADRStatus.Unparseable;

  const normalized = status.toLowerCase();
  if (normalized.startsWith('accepted') || normalized.startsWith('active')) {
    return ADRStatus.Accepted;
  }
  if (normalized.startsWith('proposed')) {
    return ADRStatus.Proposed;
  }
  return ADRStatus.Unparseable;
}

/**
 * Check if ADR is linked in governance corpus
 * "Linked" = ADR-NNNN pattern OR literal filename
 */
function isADRLinkedInGovernance(adr: ADR, governanceFiles: string[]): boolean {
  // Pattern 1: ADR-0058 or ADR-58
  const numberPattern = new RegExp(`ADR-?0*${adr.number}\\b`, 'i');

  // Pattern 2: Literal basename without extension
  const basenamePattern = new RegExp(adr.file.replace(/\.md$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  for (const file of governanceFiles) {
    const content = readFileSync(file, 'utf-8');
    if (numberPattern.test(content) || basenamePattern.test(content)) {
      return true;
    }
  }

  return false;
}

/**
 * Scan ADR directory and parse all ADR files
 */
function scanADRFiles(): ADR[] {
  if (!existsSync(ADR_DIR)) {
    console.error(`[ERROR] ADR directory not found: ${ADR_DIR}`);
    process.exit(1);
  }

  const entries = readdirSync(ADR_DIR);
  const adrs: ADR[] = [];

  for (const entry of entries) {
    // Skip if not a .md file
    if (!entry.endsWith('.md')) {
      continue;
    }

    const number = parseADRNumber(entry);
    if (!number) {
      // Not an ADR file (e.g., README.md)
      continue;
    }

    const filePath = join(ADR_DIR, entry);
    // Skip if not a regular file (e.g., subdirectory)
    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf-8');
    const status = extractADRStatus(content);
    const date = extractADRDate(content);

    adrs.push({
      number,
      slug: entry.replace(/^\d{4}-/, '').replace(/\.md$/, ''),
      file: entry,
      status,
      date,
    });
  }

  return adrs;
}

/**
 * Main check function
 */
function main(): void {
  // Combined-mode guard: --strict and --update-marker-hashes are mutually exclusive
  if (UPDATE_MARKER_HASHES && STRICT) {
    console.error('[ERROR] --strict and --update-marker-hashes are mutually exclusive (gating vs seeding).');
    console.error('Usage: bun scripts/verify-adr-governance.ts [--strict | --update-marker-hashes]');
    process.exit(1);
  }

  console.log('🔍 Checking ADR→governance linkage...\n');

  // Load governance corpus
  const governanceFiles = readGovernanceCorpus();
  console.log(`📚 Governance corpus: ${governanceFiles.length} file(s)`);

  // Scan ADR files
  const adrs = scanADRFiles();
  console.log(`📋 ADR files scanned: ${adrs.length}\n`);

  // Filter: post-cutoff + Accepted/active
  const checked = adrs.filter(adr => {
    if (!adr.date) {
      // No date = pre-cutoff/grandfathered
      return false;
    }
    if (adr.date < CUTOFF_DATE) {
      // Pre-cutoff = grandfathered
      return false;
    }
    const status = classifyStatus(adr.status);
    return status === ADRStatus.Accepted;
  });

  console.log(`✓ Post-cutoff Accepted ADRs to check: ${checked.length}\n`);

  // Hoist linkage findings counter (used for strict-mode exit code)
  let linkageFindings = 0;

  if (checked.length === 0) {
    console.log('ℹ️  All ADRs predate the cutoff date — no linkage check needed.');
    console.log(`   (Cutoff: ${CUTOFF_DATE})\n`);
  } else {
    // Check linkage
    const findings: ADR[] = [];
    for (const adr of checked) {
      if (!isADRLinkedInGovernance(adr, governanceFiles)) {
        findings.push(adr);
      }
    }

    // Set linkage findings count from array length
    linkageFindings = findings.length;

    // Report findings (WARN-only in default mode, blocking in strict mode)
    if (findings.length > 0) {
      console.log(`⚠️  [WARN] Found ${findings.length} unlinked Accepted ADR(s):\n`);
      for (const adr of findings) {
        console.log(
          `[WARN] ADR-${adr.number} (${adr.slug}) dated ${adr.date} is Accepted but not referenced from any governance doc (CONSTITUTION.md, docs/constitution/, docs/governance/) — add a pointer using the canonical form ADR-${adr.number} so governance readers can discover it`
        );
      }
      console.log('');
    }

    const linked = checked.length - findings.length;
    console.log(`ADR governance linkage: ${linked}/${checked.length} post-cutoff Accepted ADRs referenced\n`);

    if (findings.length > 0) {
      if (STRICT) {
        console.log(`⛔ Strict mode: ${findings.length} unlinked-ADR finding(s) — blocking (dev-sync step 3.97; see docs/adr/0059)`);
      } else {
        console.log('✅ Check completed (findings are WARN-only — exit 0)');
      }
    } else {
      console.log('✅ All post-cutoff Accepted ADRs are referenced from governance docs.');
    }
  }

  // Phase 2: Check intentional-duplicate markers
  const markers = scanIntentionalDuplicateMarkers();

  const markerFindings = UPDATE_MARKER_HASHES ? 0 : checkMarkerDrift(markers);

  if (UPDATE_MARKER_HASHES) {
    updateMarkerHashes(markers);
  } else if (STRICT && markerFindings > 0) {
    console.log(`⛔ Strict mode: ${linkageFindings} unlinked-ADR and/or ${markerFindings} marker-drift finding(s) — blocking (dev-sync step 3.97; see docs/adr/0059)`);
  } else if (STRICT && linkageFindings === 0 && markerFindings === 0) {
    console.log('ℹ️  Strict mode: no linkage or marker-drift findings — exit 0');
  }

  // Default mode: always exit 0 on findings (WARN-only)
  // Strict mode: exit 1 if linkage or marker findings exist, otherwise 0
  process.exit(STRICT && (linkageFindings + markerFindings) > 0 ? 1 : 0);
}

// Run the check
main();
