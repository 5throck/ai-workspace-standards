#!/usr/bin/env bun
/**
 * verify-adr-governance.ts
 * @version 1.6.0
 * @last_updated 2026-09-17
 *
 * Verifies the ADR→governance linkage mechanism (upward reflection gap detection),
 * ADR ID uniqueness, intentional-duplicate marker hash drift detection, and
 * amendment-reference resolution (T-20260917-002).
 *
 * Phase 0 (ID Uniqueness): Derives the 4-digit ADR number from each docs/adr/*.md
 * filename (^NNNN-) and hard-fails when two files share the same number — a duplicate
 * silently breaks every ADR-NNNN citation pointing at the pair. Fails in BOTH modes.
 *
 * Phase 1 (ADR Linkage): Detects Accepted ADRs that landed without any pointer from the governance docs.
 * Governance corpus: CONSTITUTION.md, docs/constitution/ (recursive), docs/governance/ (recursive)
 * ADR corpus: docs/adr/*.md (top level only — skips retired/ and templates/ subdirectories)
 *
 * Phase 2 (Marker Hash Drift): Detects intentional-duplicate markers whose source files have changed.
 * Scans templates/ for markers and validates sha256 hashes against their constitution sources.
 *
 * Phase 3 (Amendment-Reference Resolution, T-20260917-002): Detects governance-corpus
 * citations of the form "ADR-NNNN Amendment K" that resolve to no amendment recorded
 * in ADR-NNNN's own text (ranges must resolve at every number they span). Lines citing
 * two or more distinct ADR numbers are skipped — the documented fix convention for an
 * amendment recorded outside its own ADR cites the recording ADR on the same line
 * (project-review finding #8 class).
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
 * - 0: Check completed (default: findings are WARN-only; strict: no ADR-linkage, marker-drift, or amendment-reference findings)
 * - 1: Operational failure (e.g., docs/adr missing), duplicate ADR numbers (any mode), OR strict mode with ADR-linkage, marker-drift, or amendment-reference findings
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
      .map(dirent => join(dirent.parentPath, dirent.name));
    files.push(...constitutionFiles);
  }

  // docs/governance/**/*.md
  if (existsSync(GOVERNANCE_DIR)) {
    const governanceFiles = readdirSync(GOVERNANCE_DIR, { recursive: true, withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
      .map(dirent => join(dirent.parentPath, dirent.name));
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
 * Check ADR ID uniqueness (Phase 0)
 * Derives the 4-digit number from each docs/adr/*.md filename (^NNNN-) and reports
 * every number claimed by more than one file. Returns the number of colliding IDs.
 * Collisions are integrity errors: they fail in BOTH default and strict mode.
 */
function checkADRIdUniqueness(adrs: ADR[]): number {
  console.log('🔍 Checking ADR ID uniqueness...\n');

  const byNumber = new Map<string, ADR[]>();
  for (const adr of adrs) {
    const group = byNumber.get(adr.number) ?? [];
    group.push(adr);
    byNumber.set(adr.number, group);
  }

  let findings = 0;
  for (const [number, group] of byNumber) {
    if (group.length < 2) {
      continue;
    }
    findings++;
    console.log(`[ERROR] ADR number collision: ${group.length} files claim ADR-${number}:`);
    for (const adr of group) {
      console.log(`        - docs/adr/${adr.file} (status: ${adr.status ?? 'unknown'})`);
    }
  }

  if (findings === 0) {
    console.log(`✅ ADR IDs are unique across ${adrs.length} file(s).\n`);
  } else {
    console.log(
      `\n⛔ ${findings} duplicate ADR number(s) found — renumber the later ADR of each pair and repoint all citations by meaning (blocking in every mode)`
    );
  }

  return findings;
}

/**
 * Main check function
 */
/**
 * Phase 3 (Amendment-Reference Resolution, T-20260917-002): scans the governance
 * corpus for "ADR-NNNN Amendment K" citations and verifies each resolves against
 * the cited ADR's own text. A reference resolves when the ADR carries an
 * "Amendment K" mention of its own (recorded locally — e.g. ADR-0073's
 * "## Amendment 1 (2026-09-11)" heading or ADR-0060's "(Amendment N)" heading
 * suffixes); a range ("Amendments 1–9", en/em-dash or hyphen) must resolve at
 * every number it spans. Lines citing two or more distinct ADR numbers are
 * skipped — the amendment↔ADR association is ambiguous there, and the
 * documented fix convention for an amendment recorded outside its own ADR is to
 * cite the recording ADR on the same line (CONSTITUTION.md's "ADR-0073
 * Amendment 2 (recorded in [ADR-0074](...), Decision ¶2)" pattern, the fix for
 * project-review finding #8), which this skip honors. ADR-internal
 * cross-citations (docs/adr/*.md citing each other) are outside the scanned
 * corpus. Captured ordinals > 100 are treated as dates, not amendment numbers.
 * Returns the finding count. Default mode: WARN-only; strict mode: blocking.
 */
function checkAmendmentReferences(governanceFiles: string[], adrs: ADR[]): number {
  console.log('🔍 Checking ADR amendment-reference resolution...\n');

  const textByNumber = new Map<string, string>();
  for (const adr of adrs) {
    // ADR.file is the bare entry name (scanADRFiles) — resolve against ADR_DIR.
    textByNumber.set(adr.number, readFileSync(join(ADR_DIR, adr.file), 'utf-8').replace(/\r\n/g, '\n'));
  }

  const AMEND_RE = /Amendments?\s+(\d+)(?:\s*[–—-]\s*(\d+))?/g;
  const ADR_NUM_RE = /ADR-(\d{4})/g;

  let findings = 0;
  for (const file of governanceFiles) {
    const lines = readFileSync(file, 'utf-8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const amendMatches = [...line.matchAll(AMEND_RE)];
      if (amendMatches.length === 0) continue;
      const adrNumbers = new Set([...line.matchAll(ADR_NUM_RE)].map(m => m[1]));
      if (adrNumbers.size !== 1) continue; // ambiguous association — skipped by design
      const adrNumber = [...adrNumbers][0] as string;
      const target = textByNumber.get(adrNumber);
      if (target === undefined) {
        console.log(`[WARN] ${file}:${i + 1} cites ADR-${adrNumber} which does not exist under docs/adr/ — repoint or remove the citation`);
        findings++;
        continue;
      }
      const missing: string[] = [];
      for (const m of amendMatches) {
        const low = parseInt(m[1] as string, 10);
        const high = m[2] !== undefined ? parseInt(m[2] as string, 10) : low;
        if (low > 100 || high > 100 || high < low || high - low > 30) continue; // date-like, not an ordinal range
        for (let k = low; k <= high; k++) {
          if (!new RegExp(`Amendment\\s+${k}\\b`).test(target)) missing.push(String(k));
        }
      }
      if (missing.length > 0) {
        console.log(`[WARN] ${file}:${i + 1} cites "ADR-${adrNumber} Amendment ${missing.join(', ')}" but ADR-${adrNumber} records no such amendment — repoint the citation at the ADR that records the amendment (the CONSTITUTION.md ADR-0073-Amendment-2 → ADR-0074 pattern)`);
        findings++;
      }
    }
  }

  if (findings === 0) {
    console.log('✅ All ADR amendment references in governance docs resolve.\n');
  } else {
    console.log(`\n⚠️  ${findings} unresolvable ADR amendment reference(s) in governance docs (WARN-only in default mode, blocking in strict)\n`);
  }
  return findings;
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

  // Phase 0: ID uniqueness — integrity error, hard fail in both modes
  const duplicateFindings = checkADRIdUniqueness(adrs);

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

  // Phase 3: amendment-reference resolution (T-20260917-002)
  const amendmentFindings = UPDATE_MARKER_HASHES ? 0 : checkAmendmentReferences(governanceFiles, adrs);

  if (UPDATE_MARKER_HASHES) {
    updateMarkerHashes(markers);
  } else if (STRICT && (linkageFindings > 0 || markerFindings > 0 || amendmentFindings > 0)) {
    console.log(`⛔ Strict mode: ${linkageFindings} unlinked-ADR and/or ${markerFindings} marker-drift and/or ${amendmentFindings} amendment-reference finding(s) — blocking (dev-sync step 3.97; see docs/adr/0059)`);
  } else if (STRICT && linkageFindings === 0 && markerFindings === 0 && amendmentFindings === 0) {
    console.log('ℹ️  Strict mode: no linkage, marker-drift, or amendment-reference findings — exit 0');
  }

  // ID-uniqueness collisions fail in EVERY mode (integrity error, not a linkage WARN).
  // Default mode: otherwise always exit 0 on findings (WARN-only)
  // Strict mode: exit 1 if linkage, marker, or amendment findings exist, otherwise 0
  if (duplicateFindings > 0) {
    process.exit(1);
  }
  process.exit(STRICT && (linkageFindings + markerFindings + amendmentFindings) > 0 ? 1 : 0);
}

// Run the check
main();
