#!/usr/bin/env bun
/**
 * verify-adr-governance.ts
 * @version 1.0.0
 * @last_updated 2026-08-23
 *
 * Verifies the ADR→governance linkage mechanism (upward reflection gap detection).
 * Detects Accepted ADRs that landed without any pointer from the governance docs.
 *
 * Governance corpus: CONSTITUTION.md, docs/constitution/ (recursive), docs/governance/ (recursive)
 * ADR corpus: docs/adr/*.md (top level only — skips retired/ and templates/ subdirectories)
 *
 * Rules:
 * - Only ADRs ON OR AFTER CUTOFF_DATE (2026-08-23) are checked
 * - Earlier ADRs are grandfathered silently (avoids ~50-file backfill noise)
 * - "Linked" means the ADR number or filename appears in any governance doc
 * - Accepted/active ADRs must be referenced from governance docs
 * - WARN-only: always exits 0 on findings; exits 1 only on operational failure
 *
 * Usage: bun scripts/verify-adr-governance.ts
 *
 * Exit codes:
 * - 0: Check completed (findings are WARN-only)
 * - 1: Operational failure (e.g., docs/adr missing)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// Constants
const CUTOFF_DATE = '2026-08-23';
const ADR_DIR = join(ROOT, 'docs', 'adr');
const CONSTITUTION_MD = join(ROOT, 'CONSTITUTION.md');
const CONSTITUTION_DIR = join(ROOT, 'docs', 'constitution');
const GOVERNANCE_DIR = join(ROOT, 'docs', 'governance');

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
    process.exit(0);
  }

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

  // WARN-only: always exit 0 on findings
  process.exit(0);
}

// Run the check
main();
