#!/usr/bin/env bun
/**
 * verify-adr-governance.ts
 * @version 1.1.0
 * @last_updated 2026-08-23
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
 * - Marker hashes must match their source files (WARN on drift)
 * - WARN-only: always exits 0 on findings; exits 1 only on operational failure
 *
 * Usage: bun scripts/verify-adr-governance.ts [--update-marker-hashes]
 *
 * Flags:
 * - --update-marker-hashes: Rewrite/insert source+hash fields in all markers (seeding mode)
 *
 * Exit codes:
 * - 0: Check completed (findings are WARN-only)
 * - 1: Operational failure (e.g., docs/adr missing)
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
 * Represents an intentional-duplicate marker
 */
interface Marker {
  file: string;
  line: number;
  section: string; // §3, §8, etc.
  text: string; // Full marker text
  source: string | null; // Resolved source path
  hash: string | null; // Stored hash
}

/**
 * Parse section number from marker text (e.g., "workspace standards §8" -> "8")
 */
function parseSectionNumber(markerText: string): string | null {
  const match = markerText.match(/workspace standards §(\d+)/);
  return match ? match[1] : null;
}

/**
 * Resolve constitution source file for a section number
 * Maps §3 -> docs/constitution/03-pr-workflow.md, §8 -> docs/constitution/08-coding-guidelines.md
 */
function resolveConstitutionSource(section: string): string | null {
  if (!existsSync(CONSTITUTION_DIR)) {
    return null;
  }

  // Zero-pad the section number (e.g., "3" -> "03", "8" -> "08")
  const paddedSection = section.padStart(2, '0');

  // Scan for files matching the pattern 0{section}-*.md
  const entries = readdirSync(CONSTITUTION_DIR);
  const matching = entries.filter(entry =>
    entry.startsWith(`${paddedSection}-`) && entry.endsWith('.md')
  );

  if (matching.length === 0) {
    return null; // Cannot resolve source
  }
  if (matching.length > 1) {
    return null; // Ambiguous - multiple matches
  }

  return join(CONSTITUTION_DIR, matching[0]);
}

/**
 * Compute sha256 hash of a file (first 8 hex chars)
 */
function computeFileHash(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const hash = createHash('sha256').update(content, 'utf-8').digest('hex');
    return hash.substring(0, 8); // First 8 hex chars
  } catch {
    return null;
  }
}

/**
 * Parse marker fields from comment text
 * Extracts section, source, and hash if present
 */
function parseMarkerFields(markerText: string): { section: string | null; source: string | null; hash: string | null } {
  const sectionMatch = markerText.match(/workspace standards §(\d+)/);
  const section = sectionMatch ? sectionMatch[1] : null;

  const sourceMatch = markerText.match(/source:\s*([^\s;]+)/);
  const source = sourceMatch ? sourceMatch[1] : null;

  const hashMatch = markerText.match(/hash:\s*([0-9a-f]{8})/);
  const hash = hashMatch ? hashMatch[1] : null;

  return { section, source, hash };
}

/**
 * Scan templates/ for intentional-duplicate markers
 */
function scanIntentionalDuplicateMarkers(): Marker[] {
  const markers: Marker[] = [];

  if (!existsSync(TEMPLATES_DIR)) {
    return markers;
  }

  // Recursively scan all .md files under templates/
  const entries = readdirSync(TEMPLATES_DIR, { recursive: true, withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }

    const filePath = join(entry.path, entry.name);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const markerMatch = line.match(/<!--\s*intentional-duplicate:\s*([^>]+)-->/);

      if (markerMatch) {
        const markerText = markerMatch[1];
        const section = parseSectionNumber(markerText);

        if (section) {
          const { source, hash } = parseMarkerFields(markerText);
          markers.push({
            file: filePath,
            line: i + 1, // 1-indexed
            section,
            text: markerText,
            source,
            hash,
          });
        }
      }
    }
  }

  return markers;
}

/**
 * Check marker hash drift
 */
function checkMarkerDrift(markers: Marker[]): void {
  console.log('🔍 Checking intentional-duplicate marker drift...\n');

  let okCount = 0;
  let totalMarkers = markers.length;

  for (const marker of markers) {
    // Check if marker has source/hash fields
    if (!marker.source || !marker.hash) {
      console.log(
        `[WARN] marker at ${marker.file}:${marker.line} lacks source/hash fields (seed with: bun scripts/verify-adr-governance.ts --update-marker-hashes)`
      );
      continue;
    }

    // Resolve source file
    const resolvedSource = marker.source.startsWith('docs/')
      ? join(ROOT, marker.source)
      : marker.source;

    if (!existsSync(resolvedSource)) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} references missing source: ${marker.source}`);
      continue;
    }

    // Compute current hash
    const currentHash = computeFileHash(resolvedSource);

    if (!currentHash) {
      console.log(`[WARN] marker at ${marker.file}:${marker.line} - failed to compute hash for source: ${marker.source}`);
      continue;
    }

    // Check for drift
    if (currentHash !== marker.hash) {
      console.log(
        `[WARN] intentional-duplicate marker at ${marker.file}:${marker.line} is stale: source ${marker.source} changed since hash ${marker.hash} was recorded (expected ${currentHash}) — review the duplicated section and re-seed with --update-marker-hashes after updating it`
      );
      continue;
    }

    okCount++;
  }

  console.log(`\nintentional-duplicate markers: ${okCount}/${totalMarkers} in sync\n`);
}

/**
 * Update marker hashes (seeding mode)
 */
function updateMarkerHashes(markers: Marker[]): void {
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
    const currentHash = computeFileHash(resolvedSource);

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

    // Report findings (WARN-only)
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
      console.log('✅ Check completed (findings are WARN-only — exit 0)');
    } else {
      console.log('✅ All post-cutoff Accepted ADRs are referenced from governance docs.');
    }
  }

  // Phase 2: Check intentional-duplicate markers
  const markers = scanIntentionalDuplicateMarkers();

  if (UPDATE_MARKER_HASHES) {
    updateMarkerHashes(markers);
  } else {
    checkMarkerDrift(markers);
  }

  // WARN-only: always exit 0 on findings
  process.exit(0);
}

// Run the check
main();
