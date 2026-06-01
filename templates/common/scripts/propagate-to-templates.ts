#!/usr/bin/env bun
/**
 * propagate-to-templates.ts — Tier 1 → Tier 2 sync tool
 * Compares workspace root (Tier 1 SSOT) against templates/common/ (Tier 2) and optionally applies updates.
 * @version 1.1.0
 * @usage bun scripts/propagate-to-templates.ts [--dry-run|--apply] [--domain <name>]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';

// ── ANSI colors ────────────────────────────────────────────────────────────────
const C = {
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
  reset:  '\x1b[0m',
};

// ── CLI flags ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const APPLY     = args.includes('--apply');
const DRY_RUN   = args.includes('--dry-run') || !APPLY; // default to dry-run
const domainIdx = args.indexOf('--domain');
const DOMAIN_FILTER: string | null = domainIdx !== -1 ? (args[domainIdx + 1] ?? null) : null;

// ── Types ──────────────────────────────────────────────────────────────────────
interface Domain {
  description: string;
  source: string;
  target: string;
  include_pattern: string;
  recursive: boolean;
  exclude: string[];
  note?: string;
}

interface PropagationMap {
  _comment: string;
  version: string;
  domains: Record<string, Domain>;
}

interface FileDiff {
  domain: string;
  relativePath: string;
  sourcePath: string;
  targetPath: string;
  status: 'in-sync' | 'differs' | 'missing';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function md5(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

/**
 * Glob files in a directory matching a simple pattern.
 * Supports patterns like "*.ts" and "* /SKILL.md" (recursive).
 */
function globFiles(dir: string, pattern: string, recursive: boolean): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];

  // Parse pattern: supports "*.ext" or "*/filename"
  const isRecursivePattern = pattern.includes('/');
  const targetFilename = isRecursivePattern ? basename(pattern) : null;
  const ext = !isRecursivePattern ? pattern.replace('*', '') : null; // e.g. ".ts"

  function walk(currentDir: string, relBase: string): void {
    let entries: string[];
    try {
      entries = readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const relPath = relBase ? `${relBase}/${entry}` : entry;
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (recursive || isRecursivePattern) {
          walk(fullPath, relPath);
        }
      } else if (stat.isFile()) {
        if (targetFilename !== null) {
          // Recursive pattern like "*/SKILL.md"
          if (entry === targetFilename) {
            results.push(relPath);
          }
        } else if (ext !== null) {
          // Extension pattern like "*.ts"
          if (entry.endsWith(ext)) {
            results.push(relPath);
          }
        }
      }
    }
  }

  walk(dir, '');
  return results;
}

// ── Core logic ─────────────────────────────────────────────────────────────────
function collectDiffs(mapPath: string): FileDiff[] {
  const raw = readFileSync(mapPath, 'utf-8');
  const map: PropagationMap = JSON.parse(raw);

  const diffs: FileDiff[] = [];
  const domains = DOMAIN_FILTER
    ? Object.fromEntries(
        Object.entries(map.domains).filter(([k]) => k === DOMAIN_FILTER)
      )
    : map.domains;

  if (DOMAIN_FILTER && Object.keys(domains).length === 0) {
    console.error(`${C.red}Error: domain "${DOMAIN_FILTER}" not found in propagation-map.json${C.reset}`);
    process.exit(1);
  }

  for (const [domainName, domain] of Object.entries(domains)) {
    const files = globFiles(domain.source, domain.include_pattern, domain.recursive);

    for (const relPath of files) {
      const fileBasename = basename(relPath);

      // Check exclude list (matches on basename for flat patterns, full relPath for nested)
      if (domain.exclude.includes(fileBasename) || domain.exclude.includes(relPath)) {
        continue;
      }

      const sourcePath = join(domain.source, relPath);
      const targetPath = join(domain.target, relPath);

      let status: FileDiff['status'];
      if (!existsSync(targetPath)) {
        status = 'missing';
      } else {
        const srcContent = readFileSync(sourcePath, 'utf-8');
        const tgtContent = readFileSync(targetPath, 'utf-8');
        status = md5(srcContent) === md5(tgtContent) ? 'in-sync' : 'differs';
      }

      diffs.push({ domain: domainName, relativePath: relPath, sourcePath, targetPath, status });
    }
  }

  return diffs;
}

function printTable(diffs: FileDiff[]): void {
  const COL1 = 20;
  const COL2 = 45;
  const COL3 = 12;

  const header = `${padEnd('Domain', COL1)}  ${padEnd('File', COL2)}  ${padEnd('Status', COL3)}`;
  const sep    = '-'.repeat(COL1 + COL2 + COL3 + 4);

  console.log(`\n${C.cyan}${header}${C.reset}`);
  console.log(`${C.dim}${sep}${C.reset}`);

  for (const d of diffs) {
    let statusStr: string;
    let color: string;
    if (d.status === 'in-sync') {
      statusStr = '✅ in sync';
      color = C.green;
    } else if (d.status === 'differs') {
      statusStr = '⚠️  differs';
      color = C.yellow;
    } else {
      statusStr = '❌ missing';
      color = C.red;
    }

    const domainCol = padEnd(d.domain, COL1);
    const fileCol   = padEnd(d.relativePath, COL2);
    console.log(`${color}${domainCol}  ${fileCol}  ${statusStr}${C.reset}`);
  }

  console.log(`${C.dim}${sep}${C.reset}\n`);
}

function applyDiffs(diffs: FileDiff[]): number {
  let copied = 0;
  for (const d of diffs) {
    if (d.status === 'in-sync') continue;

    const targetDir = dirname(d.targetPath);
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const content = readFileSync(d.sourcePath, 'utf-8');
    writeFileSync(d.targetPath, content, 'utf-8');
    console.log(`${C.green}  copied${C.reset}  ${d.sourcePath} → ${d.targetPath}`);
    copied++;
  }
  return copied;
}

// ── Main ───────────────────────────────────────────────────────────────────────
const MAP_PATH = join('scripts', 'propagation-map.json');

if (!existsSync(MAP_PATH)) {
  console.error(`${C.red}Error: propagation-map.json not found at ${MAP_PATH}${C.reset}`);
  process.exit(1);
}

console.log(`${C.cyan}=== propagate-to-templates.ts — L0→L1 sync ===${C.reset}`);
if (DOMAIN_FILTER) console.log(`${C.dim}Domain filter: ${DOMAIN_FILTER}${C.reset}`);
console.log(`${C.dim}Mode: ${APPLY ? 'apply' : 'dry-run'}${C.reset}`);

const diffs = collectDiffs(MAP_PATH);
printTable(diffs);

const outOfSync = diffs.filter(d => d.status !== 'in-sync');
const inSync    = diffs.filter(d => d.status === 'in-sync');

console.log(`Total files checked : ${diffs.length}`);
console.log(`${C.green}In sync             : ${inSync.length}${C.reset}`);
console.log(`${outOfSync.length > 0 ? C.yellow : C.green}Out of sync         : ${outOfSync.length}${C.reset}`);

if (APPLY) {
  if (outOfSync.length === 0) {
    console.log(`\n${C.green}Nothing to apply — all files in sync.${C.reset}`);
  } else {
    console.log(`\n${C.cyan}Applying ${outOfSync.length} file(s)...${C.reset}`);
    const copied = applyDiffs(outOfSync);
    console.log(`\n${C.green}Done. ${copied} file(s) copied.${C.reset}`);
  }
  process.exit(0);
} else {
  // dry-run mode
  if (outOfSync.length > 0) {
    console.log(`\n${C.yellow}Run with --apply to sync these files.${C.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${C.green}All files in sync.${C.reset}`);
    process.exit(0);
  }
}
