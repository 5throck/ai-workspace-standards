#!/usr/bin/env bun
// publish-to-template.ts — Publishes L0 scripts/skills/commands to L1 (templates/common). Use --check-drift for L1↔L2 drift report. Use --docs for governance section injection. Use --governance-l1 for L0→L1 governance file deployment with reference transformation. L1→L2 auto-propagation is forbidden per ADR-0031.
// Usage: bun run scripts/publish-to-template.ts [--dry-run] [--domain <name>] [--docs] [--check-drift] [--governance-l1]
// @version 1.6.0

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { execSync } from 'node:child_process';
import { parseScriptLayers, includeSkillInL1, includeScriptInL1 } from './helpers/layer-filter.js';

// ── L0 → L1 Helper Functions ───────────────────────────────────────────────

function setExecutableBit(filePath: string) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.sh') || filePath.endsWith('.ps1')) {
    try {
      execSync(`git update-index --chmod=+x "${filePath.replace(/\\/g, '/')}"`);
    } catch (e) {
      // Ignore if not tracked yet, dev-sync will handle it
    }
  }
}

// Helper to safely copy a file
function safeCopyFile(src: string, dst: string) {
  if (fs.existsSync(dst)) {
    fs.rmSync(dst, { force: true });
  }
  fs.copyFileSync(src, dst);
  setExecutableBit(dst);
}

// Helper to safely copy a directory
function safeCopyDir(srcDir: string, dstDir: string) {
  if (fs.existsSync(dstDir)) {
    fs.rmSync(dstDir, { recursive: true, force: true });
  }
  fs.cpSync(srcDir, dstDir, { recursive: true });
  
  const walk = (dir: string) => {
    for (const item of fs.readdirSync(dir)) {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        walk(itemPath);
      } else {
        setExecutableBit(itemPath);
      }
    }
  };
  walk(dstDir);
}

const GREEN    = '\x1b[32m';
const YELLOW   = '\x1b[33m';
const DARKGRAY = '\x1b[90m';
const CYAN     = '\x1b[36m';
const RED      = '\x1b[31m';
const RESET    = '\x1b[0m';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const checkDrift = args.includes('--check-drift');
const governanceL1 = args.includes('--governance-l1');
const domainIdx = args.indexOf('--domain');
const DOMAIN_FILTER: string | null = domainIdx !== -1 ? (args[domainIdx + 1] ?? null) : null;

// Resolve paths relative to this script's directory
const scriptDir     = path.resolve(import.meta.dir);
const workspaceRoot = path.resolve(scriptDir, '..');
const l0Dir         = scriptDir;
const l1Dir         = path.resolve(scriptDir, '..', 'templates', 'common', 'scripts');

const scriptsMdPath = path.join(l0Dir, 'SCRIPTS.md');
if (!fs.existsSync(scriptsMdPath)) {
  console.log(`${RED}❌ SCRIPTS.md not found at ${l0Dir}${RESET}`);
  process.exit(1);
}

console.log(`${CYAN}=== L0 → L1 publish: scripts/ & skills/ → templates/common/ ===${RESET}`);
if (dryRun) console.log('(dry-run mode)');
console.log('');

let count = 0;

// Parse SCRIPTS.md — lines matching `| \`scriptname\` |`
const scriptsMd = fs.readFileSync(scriptsMdPath, 'utf-8');
const registryLines = scriptsMd
  .split('\n')
  .filter(line => /^\| `[^`]+`/.test(line));

for (const line of registryLines) {
  const cols = line.split('|');
  if (cols.length < 4) continue;
  const script = cols[1].trim().replace(/`/g, '');
  const source = cols[2].trim();
  const layer  = cols.length >= 8 ? cols[7].trim() : '—';
  if (source !== 'L0') continue;
  if (layer === 'L0' || layer === 'L0-only') continue;
  if (!script) continue;

  const excludeScripts = [
    'fix-script-versions.ts',
    'l2-to-variant-pipeline.ts',
    'validate-templates.ts',
    'publish-to-template.ts',
    'dev-sync.ts',
    'audit.ts'
  ];
  if (excludeScripts.includes(script)) continue;

  const src = path.join(l0Dir, script);
  const dst = path.join(l1Dir, script);
  if (!fs.existsSync(src)) continue;

  // Ensure parent directory exists
  const dstDir = path.dirname(dst);
  if (!fs.existsSync(dstDir) && !dryRun) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  if (dryRun) {
    console.log(`  [dry-run] ${script}`);
  } else {
    safeCopyFile(src, dst);
    console.log(`  ✅ ${script}`);
    count++;
  }
}

if (!dryRun) {
  safeCopyFile(scriptsMdPath, path.join(l1Dir, 'SCRIPTS.md'));
  console.log(`  ✅ SCRIPTS.md`);
  count++;
  console.log('');
  console.log(`${GREEN}✅ Published ${count} files  L0 (scripts/) → L1 (templates/common/scripts/)${RESET}`);
}

// ── Skills: L0 (skills/) → L1 (templates/common/skills/) ───────────────────
const l0Skills = path.join(workspaceRoot, 'skills');
const l1Skills = path.join(workspaceRoot, 'templates', 'common', 'skills');

console.log('');
console.log('L0 → L1 publish: skills/ → templates/common/skills/');

let skillCount = 0;

if (fs.existsSync(l0Skills)) {
  for (const item of fs.readdirSync(l0Skills)) {
    const itemPath = path.join(l0Skills, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      // Skip local/ and external/ (variant-specific directories)
      if (item === 'local' || item === 'external') {
        continue;
      }
      
      // Check layer-filter for skill inclusion in L1
      if (!includeSkillInL1(item)) {
        console.log(`  ⊘ Skipped (L0 only): ${item}/`);
        continue;
      }
      if (dryRun) {
        console.log(`  [dry-run] ${item}/`);
      } else {
        const dst = path.join(l1Skills, item);
        safeCopyDir(itemPath, dst);
        console.log(`  ✅ ${item}/`);
        skillCount++;
      }
    } else if (stat.isFile()) {
      if (dryRun) {
        console.log(`  [dry-run] ${item}`);
      } else {
        safeCopyFile(itemPath, path.join(l1Skills, item));
        console.log(`  ✅ ${item}`);
        skillCount++;
      }
    }
  }
}

if (!dryRun) {
  console.log('');
  console.log(`${GREEN}✅ Published ${skillCount} items  L0 (skills/) → L1 (templates/common/skills/)${RESET}`);
}

// ── Compiled Commands: L0 (.claude/commands, .gemini/commands) → L1 ───────
console.log('');
console.log('L0 → L1 publish: .claude/commands/ & .gemini/commands/ → templates/common/...');

const platforms = ['.claude', '.gemini'];
let cmdCount = 0;

for (const platform of platforms) {
  const srcDir = path.join(workspaceRoot, platform, 'commands');
  const dstDir = path.join(workspaceRoot, 'templates', 'common', platform, 'commands');

  if (fs.existsSync(srcDir)) {
    if (!fs.existsSync(dstDir) && !dryRun) {
      fs.mkdirSync(dstDir, { recursive: true });
    }
    
    for (const item of fs.readdirSync(srcDir)) {
      if (!item.endsWith('.md')) continue; // only copy markdown commands
      
      const itemPath = path.join(srcDir, item);
      if (fs.statSync(itemPath).isFile()) {
        if (dryRun) {
          console.log(`  [dry-run] ${platform}/commands/${item}`);
        } else {
          safeCopyFile(itemPath, path.join(dstDir, item));
          console.log(`  ✅ ${platform}/commands/${item}`);
          cmdCount++;
        }
      }
    }
  }
}

if (!dryRun) {
  console.log('');
  console.log(`${GREEN}✅ Published ${cmdCount} command files to L1 (templates/common/)${RESET}`);
} else {
  console.log('');
  console.log(`${DARKGRAY}(dry-run complete — no files written)${RESET}`);
}


// ============================================================================
// ── L1 → L2 drift functions (collectDiffs / printTable) ─────────────────────
// Used by --check-drift (read-only). L1→L2 auto-propagation is forbidden per ADR-0031.
// ============================================================================

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

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function padEnd(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

function globFiles(dir: string, pattern: string, recursive: boolean): string[] {
  if (!fs.existsSync(dir)) return [];

  const results: string[] = [];
  const isRecursivePattern = pattern.includes('/');
  const targetFilename = isRecursivePattern ? path.basename(pattern) : null;
  const ext = !isRecursivePattern ? pattern.replace('*', '') : null;

  function walk(currentDir: string, relBase: string): void {
    let entries: string[];
    try {
      entries = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const relPath = relBase ? `${relBase}/${entry}` : entry;
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (recursive || isRecursivePattern) {
          walk(fullPath, relPath);
        }
      } else if (stat.isFile()) {
        if (targetFilename !== null) {
          if (entry === targetFilename) {
            results.push(relPath);
          }
        } else if (ext !== null) {
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

function collectDiffs(mapPath: string): FileDiff[] {
  const raw = fs.readFileSync(mapPath, 'utf-8');
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
    console.error(`${RED}Error: domain "${DOMAIN_FILTER}" not found in propagation-map.json${RESET}`);
    process.exit(1);
  }

  const templateVariants = fs.readdirSync(path.join(workspaceRoot, 'templates'))
    .filter(d => d.startsWith('co-') && fs.statSync(path.join(workspaceRoot, 'templates', d)).isDirectory());

  const scriptLayers = parseScriptLayers(path.join(workspaceRoot, 'scripts', 'SCRIPTS.md'));

  for (const [domainName, domain] of Object.entries(domains)) {
    // For L1 -> L2, the source is L1 (domain.target)
    const l1SourceDir = path.resolve(workspaceRoot, domain.target);

    if (!fs.existsSync(l1SourceDir)) continue;

    // Derive the SCRIPTS.md key prefix from domain source (strip leading "scripts/" segment)
    const domainSourceSegment = domain.source.replace(/^scripts\/?/, '');

    const files = globFiles(l1SourceDir, domain.include_pattern, domain.recursive);

    for (const relPath of files) {
      const fileBasename = path.basename(relPath);

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

      const l1SourcePath = path.join(l1SourceDir, relPath);
      const srcContent = fs.readFileSync(l1SourcePath, 'utf-8');
      
      for (const variant of templateVariants) {
        // The L2 target replaces 'templates/common' with 'templates/{variant}'
        const variantTarget = domain.target.replace('templates/common', `templates/${variant}`);
        const l2TargetDir = path.resolve(workspaceRoot, variantTarget);
        const l2TargetPath = path.join(l2TargetDir, relPath);

        let status: FileDiff['status'];
        if (!fs.existsSync(l2TargetPath)) {
          status = 'missing';
        } else {
          const tgtContent = fs.readFileSync(l2TargetPath, 'utf-8');
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

  console.log(`\n${CYAN}${header}${RESET}`);
  console.log(`${DARKGRAY}${sep}${RESET}`);

  for (const d of diffs) {
    let statusStr: string;
    let color: string;
    if (d.status === 'in-sync') {
      statusStr = '✅ in sync';
      color = GREEN;
    } else if (d.status === 'differs') {
      statusStr = '⚠️  differs';
      color = YELLOW;
    } else {
      statusStr = '❌ missing';
      color = RED;
    }

    const domainCol = padEnd(d.domain, COL1);
    const fileCol   = padEnd(d.relativePath, COL2);
    console.log(`${color}${domainCol}  ${fileCol}  ${statusStr}${RESET}`);
  }

  console.log(`${DARKGRAY}${sep}${RESET}\n`);
}

const MAP_PATH = path.join(workspaceRoot, 'scripts', 'propagation-map.json');

if (!fs.existsSync(MAP_PATH)) {
  console.error(`${RED}Error: propagation-map.json not found at ${MAP_PATH}${RESET}`);
  process.exit(1);
}

// ── --check-drift: L1 vs L2 drift report (read-only) ────────────────────────
if (checkDrift) {
  console.log(`\n${CYAN}=== --check-drift: L1 vs L2 drift report (read-only) ===${RESET}`);
  const diffs = collectDiffs(MAP_PATH);
  printTable(diffs);
  const outOfSync = diffs.filter(d => d.status !== 'in-sync');
  console.log(`Total checked: ${diffs.length}, Out of sync: ${outOfSync.length}`);
  if (outOfSync.length > 0) {
    console.log(`\nℹ️  L2 drift is expected under Fork Model (ADR-0031). Run create-l2-scaffold.ts to re-scaffold.`);
    process.exitCode = 1;
  }
}

// ============================================================================
// ── --docs: L0 → L2 governance doc sync (CLAUDE.md, GEMINI.md) ─────────────
// ============================================================================

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
  console.log(`\n${CYAN}=== L0 → L2 publish: governance docs (CLAUDE.md, GEMINI.md) → templates/co-*/ ===${RESET}`);
  if (isDryRun) console.log(`${DARKGRAY}(dry-run mode)${RESET}`);

  // Read governance-* domains from propagation-map.json
  const mapRaw = fs.readFileSync(MAP_PATH, 'utf-8');
  const map = JSON.parse(mapRaw);

  const govDomains = Object.entries(map.domains)
    .filter(([_, d]: any) => d.mode === 'marker-inject')
    .map(([_, d]: any) => ({
      root: d.source_file as string,
      marker: d.marker as string,
      variants: d.target_variants as string[],
    }));

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { root, marker, variants } of govDomains) {
    const rootPath = path.join(workspaceRoot, root);
    if (!fs.existsSync(rootPath)) {
      console.log(`  ${YELLOW}⚠️  ${root} not found at workspace root, skipping${RESET}`);
      continue;
    }

    const rootContent = fs.readFileSync(rootPath, 'utf-8');
    const sections = extractCommonSections(rootContent, marker);

    if (sections.length === 0) {
      console.log(`  ${YELLOW}⚠️  No <!-- ${marker}:START/END --> markers found in ${root}, skipping${RESET}`);
      continue;
    }

    console.log(`\n  ${CYAN}${root}${RESET} — ${sections.length} common section(s) found`);

    for (const variant of variants) {
      const variantPath = path.join(workspaceRoot, 'templates', variant, root);
      if (!fs.existsSync(variantPath)) {
        console.log(`    ${YELLOW}⚠️  templates/${variant}/${root} not found, skipping${RESET}`);
        continue;
      }

      let variantContent = fs.readFileSync(variantPath, 'utf-8');
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
          fs.writeFileSync(variantPath, variantContent, 'utf-8');
        }
        console.log(`    ${GREEN}✅ templates/${variant}/${root}${isDryRun ? ' [dry-run]' : ' updated'}${RESET}`);
        totalUpdated++;
      } else {
        console.log(`    ${DARKGRAY}—  templates/${variant}/${root} already in sync${RESET}`);
        totalSkipped++;
      }
    }
  }

  console.log('');
  console.log(`${GREEN}Docs sync complete.${RESET} Updated: ${totalUpdated}, Already in sync: ${totalSkipped}`);
}

if (args.includes('--docs')) {
  publishDocs(dryRun);
}

// ============================================================================
// ── --governance-l1: L0 → L1 governance file deployment ─────────────────────
// Copies CLAUDE.md, GEMINI.md, AGENTS.md from workspace root to
// templates/common/, transforming CONSTITUTION.md references to docs/context.md.
// agents/pm.md is intentionally skipped — L1 version has extends: frontmatter
// and L1-specific content that must not be overwritten blindly.
// ============================================================================

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
  // These transforms apply to CLAUDE.md and GEMINI.md only (not AGENTS.md).
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
  console.log(`\n${CYAN}=== L0 → L1 governance file deployment (--governance-l1) ===${RESET}`);
  if (isDryRun) console.log(`${DARKGRAY}(dry-run mode — no files will be written)${RESET}`);

  let updated = 0;
  let skipped = 0;

  for (const { src, dst } of GOVERNANCE_L1_FILES) {
    const srcPath = path.join(workspaceRoot, src);
    const dstPath = path.join(workspaceRoot, dst);

    if (!fs.existsSync(srcPath)) {
      console.log(`  ${YELLOW}⚠️  ${src} not found at workspace root, skipping${RESET}`);
      continue;
    }

    const original = fs.readFileSync(srcPath, 'utf-8');
    const transformed = applyGovernanceTransforms(original, src);

    if (isDryRun) {
      const l0Refs = (original.match(/CONSTITUTION\.md/g) ?? []).length;
      if (l0Refs > 0) {
        console.log(`  ${CYAN}~  ${src} → ${dst}${RESET} ${DARKGRAY}(${l0Refs} CONSTITUTION.md refs → docs/context.md)${RESET}`);
      } else {
        console.log(`  ${DARKGRAY}—  ${src} already has no CONSTITUTION.md references${RESET}`);
      }
      updated++;
      continue;
    }

    const existingDst = fs.existsSync(dstPath) ? fs.readFileSync(dstPath, 'utf-8') : '';
    if (existingDst === transformed) {
      console.log(`  ${DARKGRAY}—  ${dst} already in sync${RESET}`);
      skipped++;
      continue;
    }

    fs.writeFileSync(dstPath, transformed, 'utf-8');
    const refCount = (original.match(/CONSTITUTION\.md/g) ?? []).length;
    console.log(`  ${GREEN}✅ ${dst} updated${RESET} ${DARKGRAY}(${refCount} refs transformed)${RESET}`);
    updated++;
  }

  console.log('');
  if (isDryRun) {
    console.log(`${CYAN}Dry-run complete.${RESET} Would update: ${updated} file(s)`);
  } else {
    console.log(`${GREEN}Governance L1 sync complete.${RESET} Updated: ${updated}, Already in sync: ${skipped}`);
    console.log(`${DARKGRAY}Note: templates/common/agents/pm.md skipped — L1 version uses extends: frontmatter and must not be overwritten.${RESET}`);
  }
}

if (governanceL1) {
  publishGovernanceL1(dryRun);
}
