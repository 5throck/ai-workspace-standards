#!/usr/bin/env bun
/**
 * propagate-to-templates.ts — Unified L0→L1 sync tool
 *
 * Replaces publish-to-template.ts (deprecated v1.8.0). Single authoritative script
 * for all L0→L1 propagation. Config-driven via propagation-map.json (SSOT for exclusions).
 *
 * @version 2.0.8
 *
 * Usage:
 *   bun scripts/propagate-to-templates.ts [--dry-run|--apply] [--domain <name>] [flags]
 *
 * Flags:
 *   --dry-run              Default: show diffs, exit 1 if out-of-sync (no writes)
 *   --apply                Write changed files to L1
 *   --force                With --apply: skip hash check, always overwrite
 *   --domain <name>        Filter to one domain from propagation-map.json
 *   --governance-l1        Deploy CLAUDE.md, GEMINI.md, AGENTS.md L0→L1 with ref transforms
 *   --docs                 Inject COMMON markers from L1 governance into templates/co-* variants
 *   --check-drift          L1 vs L2 drift report (read-only, uses propagation-map.json)
 *   --prune                Remove L0-only orphan scripts from templates/common/scripts/ tree
 *   --skip-encoding-check  Skip CP949 corruption pre-check (not recommended)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseScriptLayers, includeSkillInL1, includeScriptInL1 } from './helpers/layer-filter.js';

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
const APPLY            = args.includes('--apply');
const DRY_RUN          = args.includes('--dry-run') || !APPLY;
const FORCE            = args.includes('--force');
const SKIP_ENCODING    = args.includes('--skip-encoding-check');
const GOVERNANCE_L1    = args.includes('--governance-l1');
const DOCS             = args.includes('--docs');
const CHECK_DRIFT      = args.includes('--check-drift');
const PRUNE            = args.includes('--prune');
const domainIdx        = args.indexOf('--domain');
const DOMAIN_FILTER: string | null = domainIdx !== -1 ? (args[domainIdx + 1] ?? null) : null;
const workspaceRoot    = resolve(import.meta.dir, '..');

// ── Types ──────────────────────────────────────────────────────────────────────
interface Domain {
  description: string;
  source: string;
  target: string;
  include_pattern: string;
  recursive: boolean;
  exclude: string[];
  note?: string;
  mode?: string;
  source_file?: string;
  marker?: string;
  target_variants?: string[];
  exclude_prefixes?: string[];
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

// ── Encoding validation ────────────────────────────────────────────────────
// Detects CP949/Windows code-page corruption in text files before publishing.
// The most common artifact is '??' replacing em-dash (U+2014, UTF-8: E2 80 94)
// when a file passes through a non-UTF-8 Windows terminal pipeline.
const TEXT_EXTENSIONS = new Set(['.md', '.ts', '.sh', '.ps1', '.json', '.yaml', '.yml', '.toml', '.txt', '.sample']);

// Known patterns that indicate CP949 encoding corruption.
// NOTE: '??' is the TypeScript nullish-coalescing operator — only flag it in
// documentation files (.md, .txt, .yaml, .toml) where it cannot be valid syntax.
const DOC_ONLY_EXTENSIONS = new Set(['.md', '.txt', '.yaml', '.yml', '.toml', '.sample']);

// U+FFFD constructed at runtime so the source file itself doesn't contain the literal byte.
const REPLACEMENT_CHAR_RE = new RegExp(String.fromCodePoint(0xFFFD), 'g');

const ENCODING_CORRUPTION_PATTERNS: Array<{ pattern: RegExp; description: string; docOnly?: boolean }> = [
  { pattern: /\?\?/g,          description: 'corrupted em-dash (—) or other multibyte UTF-8 char → ??', docOnly: true },
  { pattern: REPLACEMENT_CHAR_RE, description: 'Unicode replacement character (U+FFFD) — raw non-UTF-8 byte survived' },
];

interface EncodingViolation {
  file: string;
  pattern: string;
  lineNumbers: number[];
  count: number;
}

function checkFileEncoding(filePath: string): EncodingViolation[] {
  const ext = extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) return [];
  const isDocFile = DOC_ONLY_EXTENSIONS.has(ext);
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return []; // binary or unreadable — skip
  }
  const violations: EncodingViolation[] = [];
  const lines = content.split('\n');
  for (const { pattern, description, docOnly } of ENCODING_CORRUPTION_PATTERNS) {
    if (docOnly && !isDocFile) continue; // skip ?? check in .ts/.sh/.ps1 (nullish coalescing)
    const lineNumbers: number[] = [];
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('encoding-check-ignore')) continue;
      const matches = lines[i].match(pattern);
      if (matches) {
        lineNumbers.push(i + 1);
        count += matches.length;
      }
    }
    if (count > 0) {
      violations.push({ file: filePath, pattern: description, lineNumbers, count });
    }
  }
  return violations;
}

const ENCODING_SKIP_DIRS = new Set(['node_modules', '.git', 'Projects', '.antigravitycli', '.codegraph', 'co-deck2', 'co-deck3', 'co-conult2']);

function walkFilesForEncoding(dir: string): string[] {
  const results: string[] = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (ENCODING_SKIP_DIRS.has(item.name)) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) {
      results.push(...walkFilesForEncoding(full));
    } else if (item.isFile()) {
      results.push(full);
    }
  }
  return results;
}

// ── L0→L1 Helper Functions ─────────────────────────────────────────────────────
function setExecutableBit(filePath: string) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.sh') || filePath.endsWith('.ps1')) {
    try {
      execFileSync('git', ['update-index', '--chmod=+x', filePath.replace(/\\/g, '/')]);
    } catch (e) {
      // Ignore if not tracked yet, dev-sync will handle it
    }
  }
}

// Helper to safely copy a file
function safeCopyFile(src: string, dst: string) {
  if (existsSync(dst)) {
    rmSync(dst, { force: true });
  }
  copyFileSync(src, dst);
  setExecutableBit(dst);
}

// Helper to safely copy a directory
function safeCopyDir(srcDir: string, dstDir: string) {
  if (existsSync(dstDir)) {
    rmSync(dstDir, { recursive: true, force: true });
  }
  cpSync(srcDir, dstDir, { recursive: true });
  
  const walk = (dir: string) => {
    for (const item of readdirSync(dir)) {
      const itemPath = join(dir, item);
      if (statSync(itemPath).isDirectory()) {
        walk(itemPath);
      } else {
        setExecutableBit(itemPath);
      }
    }
  };
  walk(dstDir);
}

// ── Core Helpers ─────────────────────────────────────────────────────────────────
function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
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

  const scriptLayers = parseScriptLayers(join(workspaceRoot, 'scripts', 'SCRIPTS.md'));

  const diffs: FileDiff[] = [];
  const allDomains = DOMAIN_FILTER
    ? Object.fromEntries(
        Object.entries(map.domains).filter(([k]) => k === DOMAIN_FILTER)
      )
    : map.domains;

  // Exclude marker-inject domains — handled by publishDocs()
  const domains = Object.fromEntries(
    Object.entries(allDomains).filter(([_, d]) => d.mode !== 'marker-inject')
  );

  if (DOMAIN_FILTER && Object.keys(domains).length === 0) {
    console.error(`${C.red}Error: domain "${DOMAIN_FILTER}" not found in propagation-map.json${C.reset}`);
    process.exit(1);
  }

  for (const [domainName, domain] of Object.entries(domains)) {
    const files = globFiles(domain.source, domain.include_pattern, domain.recursive);

    for (const relPath of files) {
      const fileBasename = basename(relPath);

      // Check exclude list (matches on basename for flat patterns, full relPath for nested,
      // and first directory segment for recursive skills patterns like "local/my-skill/SKILL.md")
      const skillDirSegment = relPath.split('/')[0].split('\\')[0];
      if ((domain.exclude ?? []).includes(fileBasename) || (domain.exclude ?? []).includes(relPath) || (domain.exclude ?? []).includes(skillDirSegment)) {
        continue;
      }

      // Apply exclude_prefixes — skip files whose relative path starts with any excluded prefix
      const excludePrefixes = domain.exclude_prefixes ?? [];
      if (excludePrefixes.some((prefix: string) => relPath.startsWith(prefix))) {
        continue;
      }


      // For skills domain: skip workspace-scoped skills (scope: workspace in frontmatter)
      if (domainName === 'skills') {
        const skillName = relPath.split('/')[0].split('\\')[0];
        if (!includeSkillInL1(skillName)) continue;
      }

      // Skip L0-only scripts — they must not propagate to L1
      if (domainName === 'scripts' || domainName === 'scripts-helpers' || domainName === 'scripts-hooks' || domainName === 'scripts-lib') {
        const domainSourceSegment = domain.source.replace(/^scripts\/?/, '');
        const scriptKey = domainSourceSegment ? `${domainSourceSegment}/${relPath}` : relPath;
        if (!includeScriptInL1(scriptKey, scriptLayers)) continue;
      }

      // Skip workspace-scoped platform skills — they must not propagate to L1
      if (domainName === 'claude-skills' || domainName === 'gemini-skills') {
        const skillName = relPath.split('/')[0].split('\\')[0];
        const skillMdPath = join(domain.source, skillName, 'SKILL.md');
        if (existsSync(skillMdPath)) {
          const content = readFileSync(skillMdPath, 'utf-8');
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const scopeMatch = fmMatch[1].match(/^\s*scope\s*:\s*(.+)$/m);
            if (scopeMatch && scopeMatch[1].trim().toLowerCase() === 'workspace') continue;
          }
        }
      }

      const sourcePath = join(domain.source, relPath);
      const targetPath = join(domain.target, relPath);

      let status: FileDiff['status'];
      if (!existsSync(targetPath)) {
        status = 'missing';
      } else {
        const srcContent = readFileSync(sourcePath, 'utf-8');
        const tgtContent = readFileSync(targetPath, 'utf-8');
        status = sha256(srcContent) === sha256(tgtContent) ? 'in-sync' : 'differs';
      }

      diffs.push({ domain: domainName, relativePath: relPath, sourcePath, targetPath, status });
    }
  }

  return diffs;
}

// ── L1→L2 drift report (--check-drift) ──────────────────────────────────────────
function collectDiffsL1L2(mapPath: string): FileDiff[] {
  const raw = readFileSync(mapPath, 'utf-8');
  const map: PropagationMap = JSON.parse(raw);

  const diffs: FileDiff[] = [];
  // Exclude marker-inject domains (governance-*) — those are handled by publishDocs()
  const allDomains = DOMAIN_FILTER
    ? Object.fromEntries(
        Object.entries(map.domains).filter(([k]) => k === DOMAIN_FILTER)
      )
    : map.domains;
  const domains = Object.fromEntries(
    Object.entries(allDomains).filter(([_, d]: any) => d.mode !== 'marker-inject')
  );

  if (DOMAIN_FILTER && Object.keys(domains).length === 0) {
    console.error(`${C.red}Error: domain "${DOMAIN_FILTER}" not found in propagation-map.json${C.reset}`);
    process.exit(1);
  }

  const templateVariants = readdirSync(join(workspaceRoot, 'templates'))
    .filter(d => d.startsWith('co-') && statSync(join(workspaceRoot, 'templates', d)).isDirectory());

  const scriptLayers = parseScriptLayers(join(workspaceRoot, 'scripts', 'SCRIPTS.md'));

  for (const [domainName, domain] of Object.entries(domains)) {
    // For L1 -> L2, the source is L1 (domain.target)
    const l1SourceDir = resolve(workspaceRoot, domain.target);

    if (!existsSync(l1SourceDir)) continue;

    // Derive the SCRIPTS.md key prefix from domain source (strip leading "scripts/" segment)
    const domainSourceSegment = domain.source.replace(/^scripts\/?/, '');

    const files = globFiles(l1SourceDir, domain.include_pattern, domain.recursive);

    for (const relPath of files) {
      const fileBasename = basename(relPath);

      if ((domain.exclude ?? []).includes(fileBasename) || (domain.exclude ?? []).includes(relPath)) {
        continue;
      }

      const excludePrefixes = (domain as any).exclude_prefixes ?? [];
      // relPath is relative to L1 source dir — "templates/" correctly excludes docs/templates/ subdir
      if (excludePrefixes.some((prefix: string) => relPath.startsWith(prefix))) {
        continue;
      }

      // Skip L0-only files: use layer-filter helper
      const scriptKey = domainSourceSegment ? `${domainSourceSegment}/${relPath}` : relPath;
      if (!includeScriptInL1(scriptKey, scriptLayers)) {
        continue;
      }

      const l1SourcePath = join(l1SourceDir, relPath);
      const srcContent = readFileSync(l1SourcePath, 'utf-8');
      
      for (const variant of templateVariants) {
        // The L2 target replaces 'templates/common' with 'templates/{variant}'
        const variantTarget = domain.target.replace('templates/common', `templates/${variant}`);
        const l2TargetDir = resolve(workspaceRoot, variantTarget);
        const l2TargetPath = join(l2TargetDir, relPath);

        let status: FileDiff['status'];
        if (!existsSync(l2TargetPath)) {
          status = 'missing';
        } else {
          const tgtContent = readFileSync(l2TargetPath, 'utf-8');
          status = sha256(srcContent) === sha256(tgtContent) ? 'in-sync' : 'differs';
        }

        diffs.push({ 
          domain: `${domainName} (${variant})`, 
          relativePath: relPath, 
          sourcePath: l1SourcePath, 
          targetPath: l2TargetPath, 
          status 
        });
      }
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
    if (d.status === 'in-sync' && !FORCE) continue;

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

// ── --docs: L1→L2 governance doc sync ────────────────────────────────────────────
function extractCommonSections(content: string, marker: string): Array<{heading: string, fullBlock: string}> {
  const sections: Array<{heading: string, fullBlock: string}> = [];
  const startTag = `<!-- ${marker}:START -->`;
  const endTag   = `<!-- ${marker}:END -->`;

  let pos = 0;
  while (true) {
    const startIdx = content.indexOf(startTag, pos);
    if (startIdx === -1) break;
    const endIdx = content.indexOf(endTag, startIdx);
    if (endIdx === -1) break;

    const block = content.slice(startIdx, endIdx + endTag.length);
    // Use first heading found inside the block as the section identifier
    const headingMatch = block.match(/^#{1,4}\s+.+$/m);
    const heading = headingMatch ? headingMatch[0] : `section-${sections.length}`;
    sections.push({ heading, fullBlock: block });
    pos = endIdx + endTag.length;
  }
  return sections;
}

function replaceCommonSection(
  variantContent: string,
  marker: string,
  section: { heading: string; fullBlock: string }
): { content: string; changed: boolean } {
  // Escape the heading for use in a regex
  const headingEscaped = section.heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `<!-- ${marker}:START -->\\s*${headingEscaped}[\\s\\S]*?<!-- ${marker}:END -->`,
    'm'
  );

  if (pattern.test(variantContent)) {
    const newContent = variantContent.replace(pattern, section.fullBlock);
    return { content: newContent, changed: newContent !== variantContent };
  }

  // Section heading exists but has no markers yet — skip to avoid unintended overwrites
  return { content: variantContent, changed: false };
}

function publishDocs(isDryRun: boolean): void {
  console.log(`\n${C.cyan}=== L1 → L2 publish: governance docs (CLAUDE.md, GEMINI.md, AGENTS.md) → templates/co-*/ ===${C.reset}`);
  if (isDryRun) console.log(`${C.dim}(dry-run mode)${C.reset}`);

  // Read governance-* domains from propagation-map.json
  const mapRaw = readFileSync(MAP_PATH, 'utf-8');
  const map = JSON.parse(mapRaw);

  const govDomains = Object.entries(map.domains)
    .filter(([_, d]: any) => d.mode === 'marker-inject')
    .map(([_, d]: any) => ({
      sourceFile: d.source_file as string,   // relative to workspaceRoot (L1 path)
      marker: d.marker as string,
      variants: d.target_variants as string[],
    }));

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { sourceFile, marker, variants } of govDomains) {
    const sourcePath = join(workspaceRoot, sourceFile);
    if (!existsSync(sourcePath)) {
      console.log(`  ${C.yellow}⚠️  ${sourceFile} not found, skipping${C.reset}`);
      continue;
    }

    const sourceContent = readFileSync(sourcePath, 'utf-8');
    const sections = extractCommonSections(sourceContent, marker);

    if (sections.length === 0) {
      console.log(`  ${C.yellow}⚠️  No <!-- ${marker}:START/END --> markers found in ${sourceFile}, skipping${C.reset}`);
      continue;
    }

    // Derive the target filename (basename of source_file, e.g. "AGENTS.md")
    const targetFilename = basename(sourceFile);
    console.log(`\n  ${C.cyan}${sourceFile}${C.reset} — ${sections.length} common section(s) found`);

    for (const variant of variants) {
      const variantPath = join(workspaceRoot, 'templates', variant, targetFilename);
      if (!existsSync(variantPath)) {
        console.log(`    ${C.yellow}⚠️  templates/${variant}/${targetFilename} not found, skipping${C.reset}`);
        continue;
      }

      let variantContent = readFileSync(variantPath, 'utf-8');
      let fileUpdated = false;

      for (const section of sections) {
        const result = replaceCommonSection(variantContent, marker, section);
        if (result.changed) {
          variantContent = result.content;
          fileUpdated = true;
        } else if (!variantContent.includes(section.heading)) {
          // Section not present in variant yet — append on first propagation
          const separator = variantContent.endsWith('\n') ? '\n' : '\n\n';
          variantContent = variantContent.trimEnd() + separator + section.fullBlock + '\n';
          fileUpdated = true;
        }
      }

      if (fileUpdated) {
        if (!isDryRun) {
          writeFileSync(variantPath, variantContent, 'utf-8');
        }
        console.log(`    ${C.green}✅ templates/${variant}/${targetFilename}${isDryRun ? ' [dry-run]' : ' updated'}${C.reset}`);
        totalUpdated++;
      } else {
        console.log(`    ${C.dim}—  templates/${variant}/${targetFilename} already in sync${C.reset}`);
        totalSkipped++;
      }
    }
  }

  console.log('');
  console.log(`${C.green}Docs sync complete.${C.reset} Updated: ${totalUpdated}, Already in sync: ${totalSkipped}`);
}

// ── --governance-l1: L0→L1 governance file deployment ────────────────────────────
const GOVERNANCE_L1_FILES = [
  { src: 'CLAUDE.md',  dst: 'templates/common/CLAUDE.md'  },
  { src: 'GEMINI.md',  dst: 'templates/common/GEMINI.md'  },
  { src: 'AGENTS.md',  dst: 'templates/common/AGENTS.md'  },
];

// Reference transformation rules: CONSTITUTION.md → docs/context.md
function applyGovernanceTransforms(content: string, filename: string): string {
  // ── Phase A: CONSTITUTION.md reference replacement ───────────────────────

  // A-1. Header line — must run first, before general replacements destroy the match pattern.
  //      Handles both backtick and plain variants; removes "Required Reading" clause.
  content = content.replace(
    /> \*\*(?:Shared workspace setup.*?|Project context.*?)(?:CONSTITUTION\.md|context\.md)[^*]*?\.\*\*/s,
    '> **Project context, architecture, coding guidelines, and design standards live in [`docs/context.md`](docs/context.md) - read it first.**'
  );

  // A-2. Full markdown links where the link text mentions CONSTITUTION.md:
  //      [CONSTITUTION.md ...](any-href) → [docs/context.md](docs/context.md)
  //      Catches cases where href is docs/constitution/... rather than CONSTITUTION.md directly.
  content = content.replace(
    /\[`?CONSTITUTION\.md`?[^\]]*\]\([^)]*\)/g,
    '[docs/context.md](docs/context.md)'
  );

  // A-3. Remaining markdown link targets that still point at CONSTITUTION.md:
  //      ](CONSTITUTION.md...) → ](docs/context.md)
  content = content.replace(/\]\(CONSTITUTION\.md[^)]*\)/g, '](docs/context.md)');

  // A-4. Plain-text mentions in lists/sentences (after markdown links handled):
  //      CONSTITUTION.md → context.md
  content = content.replace(/CONSTITUTION\.md/g, 'context.md');

  // ── Phase B: workspace root-specific content removal / replacement ────────
  if (filename === 'CLAUDE.md' || filename === 'GEMINI.md') {

    // B-1. Boilerplate table: "lifecycle-manager (workspace) / pm (variant)" → "pm"
    content = content.replace(/lifecycle-manager \(workspace\) \/ pm \(variant\)/g, 'pm');

    // B-2. Boilerplate table: "auditor (workspace) / pm (variant)" → "pm"
    content = content.replace(/auditor \(workspace\) \/ pm \(variant\)/g, 'pm');

    // B-3. Rule line: "At **workspace root**, dispatch `lifecycle-manager` for N-1 and `auditor` for N"
    content = content.replace(/^- At \*\*workspace root\*\*,.*\n/m, '');

    // B-4. Rule line: "In **variant projects**, PM handles both directly"
    content = content.replace(/^- In \*\*variant projects\*\*, PM handles both directly\n/m, '');

    // B-5. Rule line: dual-context declaration → L1-only variant declaration
    content = content.replace(
      /^- Always declare context above the execution plan table:.*\n/m,
      '- Always declare context above the execution plan table: "**Context**: variant project — pm direct"\n'
    );

    // B-6. Platform Note line containing "L0-only task classification"
    content = content.replace(/^\*\*Platform Note\*\*:.*L0-only task classification.*\n/m, '');

    // B-7. Workspace & Template Boundary Policy section.
    //      CLAUDE.md: section is wrapped in COMMON-CLAUDE:START/END markers (§9).
    //      GEMINI.md: section has an orphan COMMON-GEMINI:END with no START (§6),
    //                 preceded by a --- separator.
    if (filename === 'CLAUDE.md') {
      const boundaryStart = `<!-- COMMON-CLAUDE:START -->`;
      const boundaryEnd   = `<!-- COMMON-CLAUDE:END -->`;
      const boundaryPattern = new RegExp(
        `${boundaryStart}\\s*###\\s*9\\.\\s*Workspace & Template Boundary Policy[\\s\\S]*?${boundaryEnd}`,
        'g'
      );
      const l1BoundaryReplacement =
        `${boundaryStart}\n` +
        `### 9. Project Boundary Policy\n\n` +
        `- **Strict Scope**: Work only within the current project directory.\n` +
        `- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.\n\n` +
        `> For lifecycle management rules, see [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management).\n` +
        `${boundaryEnd}`;
      content = content.replace(boundaryPattern, l1BoundaryReplacement);
    } else if (filename === 'GEMINI.md') {
      // Orphan END marker — match from the --- separator before the section heading.
      const geminiBoundaryPattern = /---\n\n### \d+\. Workspace & Template Boundary Policy[\s\S]*?<!-- COMMON-GEMINI:END -->/;
      const geminiBoundaryReplacement =
        `---\n\n### 6. Project Boundary Policy\n\n` +
        `- **Strict Scope**: Work only within the current project directory.\n` +
        `- **No Cross-Project Modification**: Modifying files outside the project root during a session is forbidden.\n\n` +
        `> For lifecycle management rules, see [docs/context.md — Lifecycle Management](docs/context.md#lifecycle-management).\n` +
        `<!-- COMMON-GEMINI:END -->`;
      content = content.replace(geminiBoundaryPattern, geminiBoundaryReplacement);
    }
  }

  // ── Phase B-AGENTS: AGENTS.md workspace roster replacement ──────────────
  if (filename === 'AGENTS.md') {
    // B-A1. Replace §1 workspace agent roster (L0-specific agents: auditor, lifecycle-manager,
    //       architect, automation-engineer, etc.) with PM-only row + variant placeholder zone.
    const s1Pattern = /## §1: Agent Ecosystem Overview[\s\S]*?(?=\n---\n\n## §2:)/;
    const s1Replacement =
      `## §1: Agent Ecosystem Overview\n\n` +
      `### 🎯 Agent Roster (Roles Overview)\n\n` +
      `| Agent | File | Tier | Role |\n` +
      `|-------|------|------|------|\n` +
      `| **Project Manager (PM) Agent** | [\`agents/pm.md\`](agents/pm.md) | High | Orchestrates team assembly (Phase 0), design validation (Phase 2), and lifecycle finalization (Phase 6). **PM does NOT execute code or documentation directly — all specialist work dispatched through PM.** |\n\n` +
      `<!-- VARIANT-AGENTS-START -->\n` +
      `<!-- Define project-specific specialist agents here.\n` +
      `     Each row: | Agent Name | [\`agents/name.md\`](agents/name.md) | Tier | Role description |\n` +
      `     See docs/context.md for agent frontmatter specification. -->\n` +
      `<!-- VARIANT-AGENTS-END -->`;
    content = content.replace(s1Pattern, s1Replacement);

    // B-A2. Replace §2 Individual Agent Definitions (workspace-specific detail tables)
    //       with PM reference + variant placeholder zone.
    const s2Pattern = /## §2: Individual Agent Definitions[\s\S]*?(?=\n---\n\n## §3:)/;
    const s2Replacement =
      `## §2: Individual Agent Definitions\n\n` +
      `See [\`agents/pm.md\`](agents/pm.md) for the PM Agent full definition.\n\n` +
      `<!-- VARIANT-AGENT-DETAILS-START -->\n` +
      `<!-- Add project-specific agent detail definitions here.\n` +
      `     One subsection per agent: ### Agent Name, then a description table or prose. -->\n` +
      `<!-- VARIANT-AGENT-DETAILS-END -->`;
    content = content.replace(s2Pattern, s2Replacement);

    // B-A3. Remove workspace-only agent rows from §3 3-tier dispatch table
    //       (lifecycle-manager, auditor are L0-only; variants route these phases through PM).
    content = content.replace(/^\| \*\*lifecycle-manager\*\*[^\n]*\n/mg, '');
    content = content.replace(/^\| \*\*auditor\*\*[^\n]*\n/mg, '');

    // B-A4-sub. Remove L0-only agent rows from §4 Subagent Roster.
    content = content.replace(/^\| Lifecycle Manager[^\n]*\n/mg, '');
    content = content.replace(/^\| Consistency Auditor[^\n]*\n/mg, '');

    // B-A5. Execution plan tables §5: lifecycle-manager/auditor → pm throughout.
    //       Variant projects route N-1 and N through PM directly (per CLAUDE.md B-1/B-2).
    content = content.replace(/(\|[^|]+\|) lifecycle-manager (\|)/g, '$1 pm $2');
    content = content.replace(/(\|[^|]+\|) auditor (\|)/g, '$1 pm $2');

    // B-A5b. Prose owner lines: lifecycle-manager → pm.
    content = content.replace(/\*\*Owner\*\*: lifecycle-manager/g, '**Owner**: pm');

    // B-A6. L0→L1→L2 architecture description in PM row → simplified L1 description.
    content = content.replace(
      /\[`agents\/pm\.md`\]\(agents\/pm\.md\) \(L0\) → \[`templates\/common\/agents\/pm\.md`\]\(templates\/common\/agents\/pm\.md\) \(L1\) → \[`templates\/<variant>\/agents\/pm\.md`\]\(templates\/co-design\/agents\/pm\.md\) \(L2\)/g,
      '[`agents/pm.md`](agents/pm.md)'
    );
    content = content.replace(
      /Three-level inheritance architecture: L0 \(workspace root base\) → L1 \(common template pure-extends\) → L2 \(variant YAML overrides\)\. Orchestrates/g,
      'Orchestrates'
    );
    content = content.replace(/See \[L0→L1→L2 PM Agent Architecture\][^\n]*/g, '');

    // B-A12. §5.3 Example Execution Plans: replace workspace agent names with generic roles.
    //        These are illustrative examples — variant projects should substitute their own agents.
    content = content.replace(
      /\| 1 \| Update agents\/pm\.md \| docs-writer \|/g,
      '| 1 | Update agents/pm.md | `[docs specialist]` |'
    );
    content = content.replace(
      /\| 2 \| Update scripts\/audit\.ts \| automation-engineer \|/g,
      '| 2 | Update scripts/audit.ts | `[implementation specialist]` |'
    );
    content = content.replace(
      /\| 3 \| Update CLAUDE\.md §5 \| docs-writer \|/g,
      '| 3 | Update CLAUDE.md §5 | `[docs specialist]` |'
    );
    content = content.replace(
      /\| 4 \| Update GEMINI\.md §5 \| docs-writer \|/g,
      '| 4 | Update GEMINI.md §5 | `[docs specialist]` |'
    );
    content = content.replace(
      /\| 1 \| Update project README introduction \| docs-writer \|/g,
      '| 1 | Update project README introduction | `[docs specialist]` |'
    );

    // B-A7. §3.1 PM Direct Execution Scope prose: hardcoded workspace agent names → generic.
    content = content.replace(
      /dispatched to specialists \(docs-writer, architect, automation-engineer, auditor\)/g,
      'dispatched to project specialists'
    );
    content = content.replace(
      /Must delegate to specialist \(docs-writer, architect, automation-engineer, auditor\)/g,
      'Must delegate to project specialist'
    );
    content = content.replace(
      /- Perform documentation updates \(delegate to docs-writer\)/g,
      '- Perform documentation updates (delegate to `[docs specialist]`)'
    );
    content = content.replace(
      /- Perform design work \(delegate to architect\)/g,
      '- Perform design work (delegate to `[design specialist]`)'
    );
    content = content.replace(
      /dispatches specialists \(executor: docs-writer\/architect\/automation-engineer\)/g,
      'dispatches project specialists (executor: `[specialist agent]`)'
    );

    // B-A8. §3.1.5 Specialist Agent Roster: replace workspace-specific agent dispatch table
    //       with variant placeholder. Variant projects define their own dispatch triggers in §1.
    const specialistRosterPattern = /#### §3\.1\.5 Specialist Agent Roster \(PM-ONLY INVOCATION\)[\s\S]*?(?=\n\*\*⚠️ IMPORTANT\*\*: Do NOT invoke)/;
    const specialistRosterReplacement =
      `#### §3.1.5 Specialist Agent Roster (PM-ONLY INVOCATION)\n\n` +
      `All specialist agents below are dispatched ONLY through PM:\n\n` +
      `<!-- VARIANT-DISPATCH-TRIGGERS-START -->\n` +
      `<!-- Define project-specific agent dispatch triggers here. Format:\n` +
      `     | Agent | Phase | Dispatch Trigger |\n` +
      `     |-------|-------|------------------|\n` +
      `     | \`[agent-name]\` | [phase] | "trigger keyword 1", "trigger keyword 2" |\n` +
      `     See §1 for available agents. -->\n` +
      `<!-- VARIANT-DISPATCH-TRIGGERS-END -->`;
    content = content.replace(specialistRosterPattern, specialistRosterReplacement);

    // B-A9. Dispatch Rules #3: "Auditor owns Phase 6 QA gate" → PM-owned in variant context.
    content = content.replace(
      /3\. \*\*Independent QA Gate\*\* - Auditor owns Phase 6 QA gate autonomously[^\n]*/,
      '3. **QA Gate** - PM executes qa scripts at Phase 6 (bun scripts/qa-gate.ts)'
    );

    // B-A8. Subagent Roster: replace workspace-specific agent rows with variant placeholder.
    const rosterPattern = /### Subagent Roster\n\n\| Agent \| File \|[\s\S]*?(?=\n\n> \*\*Agent frontmatter)/;
    const rosterReplacement =
      `### Subagent Roster\n\n` +
      `| Agent | File | Tier | Parallelizable | Write Allowed? |\n` +
      `|-------|------|------|:--------------:|:--------------:|\n` +
      `| PM Orchestrator | \`agents/pm.md\` | High | - | orchestrates only |\n\n` +
      `<!-- VARIANT-SUBAGENT-ROSTER-START -->\n` +
      `<!-- Add project-specific specialist agents here. Format:\n` +
      `     | Agent Name | \`agents/name.md\` | High/Medium/Low | parallel conditions | write scope |\n` +
      `     See §1 for the agent roster and docs/context.md for frontmatter specification. -->\n` +
      `<!-- VARIANT-SUBAGENT-ROSTER-END -->`;
    content = content.replace(rosterPattern, rosterReplacement);

    // B-A9. §4.2 Harness Engineering Workflow: replace workspace agent names in phase descriptions.
    content = content.replace(
      /Phase 6 - Quality Assurance & Finalization \(specialist-autonomous in workspace, PM in variants\)\n  Auditor \(workspace\) executes bun scripts\/qa-gate\.ts autonomously\n  PM \(variants\) executes qa scripts/,
      'Phase 6 - Quality Assurance & Finalization (PM-owned)\n  PM executes bun scripts/qa-gate.ts'
    );
    content = content.replace(
      /  Automation Engineer implements per approved plan\n  Documentation Writer updates docs as needed/,
      '  `[implementation specialist]` implements per approved plan\n  `[docs specialist]` updates docs as needed'
    );

    // B-A10. §4.3 Role Boundary Matrix: replace workspace-specific agent rows with
    //        generic placeholder; keep only the PM orchestration row (universally applicable).
    const rbmPattern = /### 4\.3 Role Boundary Matrix\n\nUse this[\s\S]*?(?=\n---\n\n## §5:)/;
    const rbmReplacement =
      `### 4.3 Role Boundary Matrix\n\n` +
      `Use this to resolve ambiguity when multiple agents could handle a request.\n\n` +
      `| Scenario | Use | Do NOT use |\n` +
      `|----------|-----|------------|\n` +
      `| Orchestrate multi-step task across agents | \`pm\` | any execution agent |\n\n` +
      `<!-- VARIANT-ROLE-BOUNDARY-START -->\n` +
      `<!-- Add project-specific role boundary rules here. Example:\n` +
      `     | Design implementation approach | \`[design specialist]\` | \`[implementation specialist]\` |\n` +
      `     | Write or modify documentation | \`[docs specialist]\` | \`[design specialist]\` | -->\n` +
      `<!-- VARIANT-ROLE-BOUNDARY-END -->\n`;
    content = content.replace(rbmPattern, rbmReplacement);

    // B-A11. §3.5 Phase Determination table: replace workspace-specific agent names
    //       with generic role placeholders. Variant projects define actual agents in §1.
    //       The table structure (deliverable types + phases) is generic and kept as-is.
    const s35Pattern = /### §3\.5 Phase Determination \(Deliverable-Type Gate\)[\s\S]*?(?=\n###\s)/;
    const s35Replacement =
      `### §3.5 Phase Determination (Deliverable-Type Gate)\n\n` +
      `Before assigning an agent to any task, PM MUST classify the deliverable type:\n\n` +
      `| Deliverable Type | Phase | Required Agent | Tier | Notes |\n` +
      `|------------------|-------|----------------|------|-------|\n` +
      `| New file design, schema definition, ADR | Phase 1-2 | \`[design specialist]\` | High | Must precede implementation |\n` +
      `| New directory structure, template layout | Phase 1-2 | \`[design specialist]\` | High | Must precede implementation |\n` +
      `| Cross-platform convention, naming standard | Phase 1-2 | \`[design specialist]\` | High | Must precede implementation |\n` +
      `| Script/tool implementation (approved plan exists) | Phase 4 | \`[implementation specialist]\` | Low–Medium | Plan from design specialist required |\n` +
      `| Documentation update | Phase 4 | \`[docs specialist]\` | Medium | |\n` +
      `| Documentation writing | Phase 4 | \`[docs specialist]\` | Medium | |\n` +
      `| Security configuration | Phase 6 | \`[security specialist]\` | Medium | |\n` +
      `| Project setup | Phase 0 | pm | Low | PM handles initial setup directly |\n\n` +
      `<!-- VARIANT-PHASE-GATE-START -->\n` +
      `<!-- Map deliverable types to your project-specific agents from §1.\n` +
      `     Example: | Feature implementation | Phase 4 | \`engineer\` | Low | | -->\n` +
      `<!-- VARIANT-PHASE-GATE-END -->\n\n` +
      `**Tier Ceiling Rule**: An agent's tier may NOT be elevated beyond its defined tier.\n\n` +
      `> **Execution Plan Boilerplate Policy**: For mandatory and discretionary boilerplate cases, see [§3 (PM Gateway Workflow)](AGENTS.md#§3-pm-gateway-workflow) above.\n\n`;
    content = content.replace(s35Pattern, s35Replacement);
  }

  // ── Phase C: CLAUDE.md-only transforms ───────────────────────────────────
  if (filename === 'CLAUDE.md') {
    // C-1. Remove the /new-project slash command row from the commands table.
    content = content.replace(/^\| `\/new-project[^|]*\|[^|]*\|[^\n]*\n/m, '');

    // C-2. Update command count: "All 5 commands above" → "All 4 commands above"
    content = content.replace(/All 5 commands above/g, 'All 4 commands above');
  }

  return content;
}

function publishGovernanceL1(isDryRun: boolean): void {
  console.log(`\n${C.cyan}=== L0 → L1 governance file deployment (--governance-l1) ===${C.reset}`);
  if (isDryRun) console.log(`${C.dim}(dry-run mode — no files will be written)${C.reset}`);

  let updated = 0;
  let skipped = 0;

  for (const { src, dst } of GOVERNANCE_L1_FILES) {
    const srcPath = join(workspaceRoot, src);
    const dstPath = join(workspaceRoot, dst);

    if (!existsSync(srcPath)) {
      console.log(`  ${C.yellow}⚠️  ${src} not found at workspace root, skipping${C.reset}`);
      continue;
    }

    const original = readFileSync(srcPath, 'utf-8');
    const transformed = applyGovernanceTransforms(original, src);

    if (isDryRun) {
      const l0Refs = (original.match(/CONSTITUTION\.md/g) ?? []).length;
      if (l0Refs > 0) {
        console.log(`  ${C.cyan}~  ${src} → ${dst}${C.reset} ${C.dim}(${l0Refs} CONSTITUTION.md refs → docs/context.md)${C.reset}`);
      } else {
        console.log(`  ${C.dim}—  ${src} already has no CONSTITUTION.md references${C.reset}`);
      }
      updated++;
      continue;
    }

    const existingDst = existsSync(dstPath) ? readFileSync(dstPath, 'utf-8') : '';
    if (existingDst === transformed) {
      console.log(`  ${C.dim}—  ${dst} already in sync${C.reset}`);
      skipped++;
      continue;
    }

    writeFileSync(dstPath, transformed, 'utf-8');
    const refCount = (original.match(/CONSTITUTION\.md/g) ?? []).length;
    console.log(`  ${C.green}✅ ${dst} updated${C.reset} ${C.dim}(${refCount} refs transformed)${C.reset}`);
    updated++;
  }

  console.log('');
  if (isDryRun) {
    console.log(`${C.cyan}Dry-run complete.${C.reset} Would update: ${updated} file(s)`);
  } else {
    console.log(`${C.green}Governance L1 sync complete.${C.reset} Updated: ${updated}, Already in sync: ${skipped}`);
    console.log(`${C.dim}Note: templates/common/agents/pm.md skipped — L1 version uses extends: frontmatter and must not be overwritten.${C.reset}`);
  }
}

// ── --prune: remove L0-only orphans from L1 script directories ────────────────
/**
 * Walk a directory recursively and return all file paths (absolute).
 */
function walkAllFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkAllFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Prune L0-only scripts from L1 (templates/common/scripts/**).
 *
 * A file in the L1 scripts tree is removed when:
 *   1. Its basename/relative key maps to an L0-only layer in SCRIPTS.md, AND
 *   2. includeScriptInL1() returns false for that key.
 *
 * Operates on the four script domains: scripts, scripts-helpers, scripts-hooks, scripts-lib.
 */
function pruneL1Scripts(mapPath: string, isDryRun: boolean): void {
  console.log(`\n${C.cyan}=== --prune: removing L0-only orphans from L1 script directories ===${C.reset}`);
  if (isDryRun) console.log(`${C.dim}(dry-run mode — no files will be deleted)${C.reset}`);

  const raw = readFileSync(mapPath, 'utf-8');
  const map: PropagationMap = JSON.parse(raw);
  const scriptLayers = parseScriptLayers(join(workspaceRoot, 'scripts', 'SCRIPTS.md'));

  const scriptDomains = ['scripts', 'scripts-helpers', 'scripts-hooks', 'scripts-lib'];

  let pruned = 0;
  let kept = 0;

  for (const domainName of scriptDomains) {
    const domain = map.domains[domainName];
    if (!domain) continue;

    const targetDir = resolve(workspaceRoot, domain.target);
    if (!existsSync(targetDir)) continue;

    const allFiles = walkAllFiles(targetDir);

    for (const absPath of allFiles) {
      // Compute relative path from the target dir
      const relFromTarget = absPath.slice(targetDir.length).replace(/^[\\/]/, '').replace(/\\/g, '/');

      // Build the script key as used in SCRIPTS.md (same logic as collectDiffs)
      const domainSourceSegment = domain.source.replace(/^scripts\/?/, '');
      const scriptKey = domainSourceSegment ? `${domainSourceSegment}/${relFromTarget}` : relFromTarget;

      if (!includeScriptInL1(scriptKey, scriptLayers)) {
        if (isDryRun) {
          console.log(`  ${C.yellow}would remove${C.reset}  ${absPath}`);
        } else {
          rmSync(absPath, { force: true });
          console.log(`  ${C.red}removed${C.reset}  ${absPath}`);
        }
        pruned++;
      } else {
        kept++;
      }
    }
  }

  console.log('');
  if (isDryRun) {
    console.log(`${C.cyan}Prune dry-run complete.${C.reset} Would remove: ${pruned}, Would keep: ${kept}`);
  } else {
    console.log(`${C.green}Prune complete.${C.reset} Removed: ${pruned}, Kept: ${kept}`);
  }
}


// ── Main ───────────────────────────────────────────────────────────────────────
const MAP_PATH = join('scripts', 'propagation-map.json');

if (!existsSync(MAP_PATH)) {
  console.error(`${C.red}Error: propagation-map.json not found at ${MAP_PATH}${C.reset}`);
  process.exit(1);
}

// Encoding gate — only on --apply (not dry-run or governance/docs modes)
if (APPLY && !SKIP_ENCODING && !GOVERNANCE_L1 && !DOCS && !CHECK_DRIFT) {
  const scanDirs = ['.', join('templates')];
  const allViolations: EncodingViolation[] = [];
  for (const scanDir of scanDirs) {
    if (existsSync(scanDir)) {
      for (const file of walkFilesForEncoding(scanDir)) {
        allViolations.push(...checkFileEncoding(file));
      }
    }
  }
  if (allViolations.length > 0) {
    console.error(`${C.red}❌ Encoding corruption — ${allViolations.length} violation(s). Fix before publishing.${C.reset}`);
    for (const v of allViolations) {
      console.log(`   ${v.file}  [${v.count}×] ${v.pattern}`);
    }
    process.exit(1);
  }
}

console.log(`${C.cyan}=== propagate-to-templates.ts — L0→L1 sync ===${C.reset}`);
if (DOMAIN_FILTER) console.log(`${C.dim}Domain filter: ${DOMAIN_FILTER}${C.reset}`);
console.log(`${C.dim}Mode: ${APPLY ? 'apply' : 'dry-run'}${FORCE ? ' (--force)' : ''}${C.reset}`);

const diffs = collectDiffs(MAP_PATH);
printTable(diffs);

const outOfSync = diffs.filter(d => d.status !== 'in-sync');
const inSync    = diffs.filter(d => d.status === 'in-sync');

console.log(`Total files checked : ${diffs.length}`);
console.log(`${C.green}In sync             : ${inSync.length}${C.reset}`);
console.log(`${outOfSync.length > 0 ? C.yellow : C.green}Out of sync         : ${outOfSync.length}${C.reset}`);

if (APPLY) {
  if (outOfSync.length === 0 && !FORCE) {
    console.log(`\n${C.green}Nothing to apply — all files in sync.${C.reset}`);
  } else {
    const toApply = FORCE ? diffs : outOfSync;
    console.log(`\n${C.cyan}Applying ${toApply.length} file(s)...${C.reset}`);
    const copied = applyDiffs(diffs);
    console.log(`\n${C.green}Done. ${copied} file(s) copied.${C.reset}`);
  }
} else {
  // dry-run mode
  if (outOfSync.length > 0) {
    console.log(`\n${C.yellow}Run with --apply to sync these files.${C.reset}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${C.green}All files in sync.${C.reset}`);
  }
}

if (GOVERNANCE_L1) {
  publishGovernanceL1(DRY_RUN);
}

if (DOCS) {
  publishDocs(DRY_RUN);
}

if (CHECK_DRIFT) {
  console.log(`\n${C.cyan}=== --check-drift: L1 vs L2 drift report (read-only) ===${C.reset}`);
  const drifts = collectDiffsL1L2(MAP_PATH);
  printTable(drifts);
  const outOfSyncDrift = drifts.filter(d => d.status !== 'in-sync');
  console.log(`Total checked: ${drifts.length}, Out of sync: ${outOfSyncDrift.length}`);
  if (outOfSyncDrift.length > 0) {
    const variantDrifts = outOfSyncDrift.filter(d => /\/templates\/co-[^/]+\//.test(d.targetPath));
    const l2ProjectDrifts = outOfSyncDrift.filter(d => !/\/templates\/co-[^/]+\//.test(d.targetPath));
    if (variantDrifts.length > 0) {
      console.log(`\nℹ️  L1 variant drift may be intentional (variant-specific overrides). Review above before applying.`);
    }
    if (l2ProjectDrifts.length > 0) {
      console.log(`\nℹ️  L2 project drift is expected under Fork Model (ADR-0031) — L2 projects are independent after creation.`);
    }
  }
}

if (PRUNE) {
  pruneL1Scripts(MAP_PATH, DRY_RUN);
}
