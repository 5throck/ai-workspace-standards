#!/usr/bin/env bun
/**
 * verify-adr-governance.ts
 * @version 1.6.0
 * @last_updated 2026-09-16
 *
 * Verifies the ADR→governance linkage mechanism (upward reflection gap detection),
 * ADR ID uniqueness, and intentional-duplicate marker hash drift detection.
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
 * Phase 3 (Amendment References): Detects "ADR-NNNN Amendment N" citations that do not
 * resolve to an actual amendment record. A reference resolves when an Amendment heading
 * or bold lead-in naming the amendment number appears in the referenced ADR, in any
 * other ADR cited alongside it on the same line (the "recorded in [ADR-XXXX]" pattern),
 * or in the citing file itself. Amendments are often RECORDED in a different ADR than
 * the one cited, so all three sites are searched.
 *
 * Rules:
 * - Only ADRs ON OR AFTER CUTOFF_DATE (2026-08-23) are checked
 * - Earlier ADRs are grandfathered silently (avoids ~50-file backfill noise)
 * - "Linked" means the ADR number or filename appears in any governance doc
 * - Accepted/active ADRs must be referenced from governance docs
 * - Marker hashes must match their section source (section-sliced sha256-8; WARN on drift in default mode, blocking in strict)
 * - Default mode: WARN-only (always exits 0 on findings; exits 1 only on operational failure)
 * - Strict mode (--strict): exits 1 on ADR-linkage, amendment-reference, OR marker-drift findings
 *
 * Usage: bun scripts/verify-adr-governance.ts [--update-marker-hashes] [--strict]
 *
 * Flags:
 * - --update-marker-hashes: Rewrite/insert source+hash fields in all markers (seeding mode)
 * - --strict: Exit 1 on ADR-linkage or marker-drift findings (blocking gate for dev-sync step 3.97; Stage 2b)
 *
 * Exit codes:
 * - 0: Check completed (default: findings are WARN-only; strict: no ADR-linkage, amendment-reference, or marker-drift findings)
 * - 1: Operational failure (e.g., docs/adr missing), duplicate ADR numbers (any mode), OR strict mode with ADR-linkage, amendment-reference, or marker-drift findings
 */

// v1.6.0 (T-20260917-002): amendment-reference resolution arm — every "ADR-NNNN Amendment N"
// citation in the governance corpus must resolve to an Amendment heading or bold lead-in in
// the referenced ADR, in any other ADR cited alongside it on the same line ("recorded in
// [ADR-XXXX]"), or in the citing file itself; warn-level, blocking under --strict exactly
// like ADR-linkage findings (2026-09-17 project review finding 8).

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
const AGENTS_MD = join(ROOT, 'AGENTS.md');
const CLAUDE_MD = join(ROOT, 'CLAUDE.md');
const GEMINI_MD = join(ROOT, 'GEMINI.md');
const CONSTITUTION_DIR = join(ROOT, 'docs', 'constitution');
const GOVERNANCE_DIR = join(ROOT, 'docs', 'governance');
const TEMPLATES_DIR = join(ROOT, 'templates');

// Phase 3: "ADR-NNNN Amendment N" citation pattern. Line-scoped (applied per line)
// so a reference cannot bleed across sentences: the gap class excludes periods and
// newlines, and the dash class covers en-dash/em-dash/ASCII-hyphen amendment ranges
// ("Amendments 3–6") with `-` kept last so it stays a literal.
const AMENDMENT_REF_PATTERN = /ADR-(\d{4})[^.\n]{0,200}?Amendments?\s+(\d+)(?:\s*[–—-]\s*(\d+))?/g;

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
 * Read the Phase 3 amendment-reference corpus: the four root governance docs,
 * every docs/constitution/*.md (recursive), and every docs/adr/NNNN-*.md (top
 * level, same filename grammar as scanADRFiles). Each location is existsSync-
 * guarded like readGovernanceCorpus().
 */
function readAmendmentCorpus(): string[] {
  const files: string[] = [];

  for (const rootDoc of [CONSTITUTION_MD, AGENTS_MD, CLAUDE_MD, GEMINI_MD]) {
    if (existsSync(rootDoc)) {
      files.push(rootDoc);
    }
  }

  if (existsSync(CONSTITUTION_DIR)) {
    const constitutionFiles = readdirSync(CONSTITUTION_DIR, { recursive: true, withFileTypes: true })
      .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
      .map(dirent => join(dirent.parentPath, dirent.name));
    files.push(...constitutionFiles);
  }

  if (existsSync(ADR_DIR)) {
    for (const entry of readdirSync(ADR_DIR)) {
      if (entry.endsWith('.md') && parseADRNumber(entry)) {
        files.push(join(ADR_DIR, entry));
      }
    }
  }

  return files;
}

/**
 * Resolution test: does `text` record amendment number `n`?
 * Either a Markdown heading LINE containing it ("## Amendment 2026-08-25 — ... (Amendment 1)")
 * or a bold lead-in containing it ("**ADR-0073 Amendment 2 — ...**").
 */
function hasAmendmentMarker(text: string, n: number): boolean {
  if (new RegExp(`^#{1,6}[^\\n]*Amendment\\s*${n}\\b`, 'm').test(text)) {
    return true;
  }
  return new RegExp(`\\*\\*[^*\\n]*Amendment\\s*${n}\\b`).test(text);
}

/**
 * Phase 3: ADR amendment-reference resolution.
 *
 * Every "ADR-NNNN Amendment N" citation in the governance corpus (ranges
 * "Amendments lo–hi" expand to each N) must resolve: an Amendment heading or
 * bold lead-in naming N must appear in (a) the referenced ADR file, or — the
 * "recorded in [ADR-XXXX]" pattern, since an amendment is often RECORDED in a
 * different ADR than the one cited — (b) any other ADR cited alongside the
 * reference on the same line, or (c) the citing file itself (an ADR that
 * records another ADR's amendment carries the bold-lead-in record directly).
 * Findings deduplicate per (source file, referenced ADR, amendment number).
 * Returns the number of findings — warn-level in default mode, counted as
 * blocking under --strict exactly like ADR-linkage findings.
 */
function checkAmendmentReferences(adrs: ADR[]): number {
  console.log('🔍 Checking ADR amendment references...\n');

  const adrFileByNumber = new Map(adrs.map(adr => [adr.number, adr.file]));
  const corpus = readAmendmentCorpus();

  let checked = 0;
  let findings = 0;
  const reported = new Set<string>();
  const contentCache = new Map<string, string>();
  const readText = (file: string): string => {
    let text = contentCache.get(file);
    if (text === undefined) {
      text = readFileSync(file, 'utf-8');
      contentCache.set(file, text);
    }
    return text;
  };

  for (const file of corpus) {
    const relFile = file.replace(ROOT, '').replace(/^[\/\\]+/, '');
    const lines = readText(file).split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      AMENDMENT_REF_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = AMENDMENT_REF_PATTERN.exec(line)) !== null) {
        const refNumber = match[1];
        const lo = parseInt(match[2], 10);
        const hi = match[3] !== undefined ? parseInt(match[3], 10) : lo;

        // Other ADR-NNNN cited alongside on the same reference line — the
        // "recorded in [ADR-XXXX]" companion sites.
        const companions: string[] = [];
        for (const cited of line.matchAll(/ADR-(\d{4})/g)) {
          if (cited[1] !== refNumber && !companions.includes(cited[1])) {
            companions.push(cited[1]);
          }
        }

        for (let n = lo; n <= hi; n++) {
          const dedupeKey = `${relFile}|${refNumber}|${n}`;
          if (reported.has(dedupeKey)) {
            continue;
          }
          reported.add(dedupeKey);
          checked++;

          const refFile = adrFileByNumber.get(refNumber);
          if (!refFile) {
            findings++;
            console.log(`[WARN] ${relFile}:${lineIndex + 1} — "${match[0]}" cites ADR-${refNumber} Amendment ${n} but the referenced ADR file docs/adr/${refNumber}-*.md does not exist`);
            continue;
          }

          // Resolution sites, in order: the referenced ADR; the companions cited
          // alongside; the citing file itself (self-recording bold lead-ins).
          const sites: string[] = [join(ADR_DIR, refFile)];
          for (const companion of companions) {
            const companionFile = adrFileByNumber.get(companion);
            if (companionFile) {
              const companionPath = join(ADR_DIR, companionFile);
              if (!sites.includes(companionPath)) {
                sites.push(companionPath);
              }
            }
          }
          sites.push(file);

          const resolved = sites.some(site => hasAmendmentMarker(readText(site), n));
          if (!resolved) {
            findings++;
            console.log(`[WARN] ${relFile}:${lineIndex + 1} — "${match[0]}" does not resolve to an Amendment heading or bold lead-in in docs/adr/${refFile} or any ADR cited alongside it`);
          }
        }
      }
    }
  }

  console.log(`\namendment references: ${checked - findings}/${checked} resolved\n`);

  if (STRICT && findings > 0) {
    console.log(`⛔ Strict mode: ${findings} amendment-reference finding(s) — blocking (dev-sync step 3.97; see docs/adr/0059)`);
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

  // Phase 3: ADR amendment-reference resolution (warn-only in default mode,
  // blocking under --strict exactly like ADR-linkage findings)
  const amendmentFindings = checkAmendmentReferences(adrs);

  // Phase 2: Check intentional-duplicate markers
  const markers = scanIntentionalDuplicateMarkers();

  const markerFindings = UPDATE_MARKER_HASHES ? 0 : checkMarkerDrift(markers);

  if (UPDATE_MARKER_HASHES) {
    updateMarkerHashes(markers);
  } else if (STRICT && markerFindings > 0) {
    console.log(`⛔ Strict mode: ${linkageFindings} unlinked-ADR, ${amendmentFindings} amendment-reference, and/or ${markerFindings} marker-drift finding(s) — blocking (dev-sync step 3.97; see docs/adr/0059)`);
  } else if (STRICT && linkageFindings === 0 && markerFindings === 0 && amendmentFindings === 0) {
    console.log('ℹ️  Strict mode: no linkage, amendment-reference, or marker-drift findings — exit 0');
  }

  // ID-uniqueness collisions fail in EVERY mode (integrity error, not a linkage WARN).
  // Default mode: otherwise always exit 0 on findings (WARN-only)
  // Strict mode: exit 1 if linkage, amendment-reference, or marker findings exist, otherwise 0
  if (duplicateFindings > 0) {
    process.exit(1);
  }
  process.exit(STRICT && (linkageFindings + amendmentFindings + markerFindings) > 0 ? 1 : 0);
}

// Run the check
main();
