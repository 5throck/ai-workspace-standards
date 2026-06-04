#!/usr/bin/env bun
// publish-to-template.ts — Publishes L0 scripts and skills to L1 (templates/common) and propagates to L2 (templates/co-*)
// Usage: bun run scripts/publish-to-template.ts [--dry-run] [--domain <name>] [--docs]
// @version 1.3.6

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { execSync } from 'node:child_process';

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
const APPLY = !dryRun;
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
  if (layer.includes('L0-only')) continue;
  if (!script) continue;
  const src = path.join(l0Dir, script);
  const dst = path.join(l1Dir, script);
  if (!fs.existsSync(src)) continue;
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
      // Check SKILL.md frontmatter for scope field
      const skillMdPath = path.join(itemPath, 'SKILL.md');
      let scope: string | undefined;
      if (fs.existsSync(skillMdPath)) {
        const skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
        const scopeMatch = skillMdContent.match(/^scope:\s*(\S+)/m);
        scope = scopeMatch?.[1];
      }
      if (scope === 'workspace') {
        console.log(`  ⊘ Skipped (workspace-only): ${item}/`);
        continue;
      }
      if (scope === undefined && fs.existsSync(skillMdPath)) {
        console.log(`  ${YELLOW}[WARN]${RESET} ${item}/: scope field missing in SKILL.md, defaulting to common`);
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
// ── L1 → L2 PROPAGATION ────────────────────────────────────────────────────
// ============================================================================

console.log(`\n${CYAN}=== L1 → L2 propagation: templates/common/ → templates/co-*/ ===${RESET}`);
if (DOMAIN_FILTER) console.log(`${DARKGRAY}Domain filter: ${DOMAIN_FILTER}${RESET}`);
console.log(`${DARKGRAY}Mode: ${APPLY ? 'apply' : 'dry-run'}${RESET}`);

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

function parseScriptLayers(scriptsMdPath: string): Map<string, string> {
  const layers = new Map<string, string>();
  try {
    const content = fs.readFileSync(scriptsMdPath, 'utf-8');
    for (const line of content.split('\n')) {
      if (!line.startsWith('| `')) continue;
      const cols = line.split('|').map(c => c.trim());
      if (cols.length < 8) continue;
      const scriptName = cols[1].replace(/`/g, '');
      const layer = cols[7];
      if (scriptName && layer) layers.set(scriptName, layer);
    }
  } catch { /* ignore */ }
  return layers;
}

function collectDiffs(mapPath: string): FileDiff[] {
  const raw = fs.readFileSync(mapPath, 'utf-8');
  const map: PropagationMap = JSON.parse(raw);

  const diffs: FileDiff[] = [];
  const domains = DOMAIN_FILTER
    ? Object.fromEntries(
        Object.entries(map.domains).filter(([k]) => k === DOMAIN_FILTER)
      )
    : map.domains;

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

      // Skip L0-only files: check SCRIPTS.md layer column
      const scriptKey = domainSourceSegment ? `${domainSourceSegment}/${relPath}` : relPath;
      if (scriptLayers.get(scriptKey)?.includes('L0-only')) {
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

function applyDiffs(diffs: FileDiff[]): number {
  let copied = 0;
  for (const d of diffs) {
    if (d.status === 'in-sync') continue;

    const targetDir = path.dirname(d.targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(d.targetPath)) {
      fs.rmSync(d.targetPath, { force: true });
    }
    const content = fs.readFileSync(d.sourcePath, 'utf-8');
    fs.writeFileSync(d.targetPath, content, 'utf-8');
    setExecutableBit(d.targetPath);
    
    const relSrc = path.relative(workspaceRoot, d.sourcePath);
    const relDst = path.relative(workspaceRoot, d.targetPath);
    console.log(`${GREEN}  copied${RESET}  ${relSrc} → ${relDst}`);
    copied++;
  }
  return copied;
}

const MAP_PATH = path.join(workspaceRoot, 'scripts', 'propagation-map.json');

if (!fs.existsSync(MAP_PATH)) {
  console.error(`${RED}Error: propagation-map.json not found at ${MAP_PATH}${RESET}`);
  process.exit(1);
}

const diffs = collectDiffs(MAP_PATH);
printTable(diffs);

const outOfSync = diffs.filter(d => d.status !== 'in-sync');
const inSync    = diffs.filter(d => d.status === 'in-sync');

console.log(`Total files checked : ${diffs.length}`);
console.log(`${GREEN}In sync             : ${inSync.length}${RESET}`);
console.log(`${outOfSync.length > 0 ? YELLOW : GREEN}Out of sync         : ${outOfSync.length}${RESET}`);

if (APPLY) {
  if (outOfSync.length === 0) {
    console.log(`\n${GREEN}Nothing to apply — all files in sync.${RESET}`);
  } else {
    console.log(`\n${CYAN}Applying ${outOfSync.length} file(s)...${RESET}`);
    const copied = applyDiffs(outOfSync);
    console.log(`\n${GREEN}Done. ${copied} file(s) copied.${RESET}`);
  }
} else {
  // dry-run mode
  if (outOfSync.length > 0) {
    console.log(`\n${YELLOW}Run without --dry-run to sync these files.${RESET}`);
    process.exitCode = 1;
  } else {
    console.log(`\n${GREEN}All files in sync.${RESET}`);
  }
}

// ── SCRIPTS.md: L1 → L2 explicit propagation ────────────────────────────────
// SCRIPTS.md is not a .ts file so it is excluded from the propagation-map
// *.ts pattern. Propagate it explicitly to keep all variant registries in sync.
{
  const l1ScriptsMd = path.join(workspaceRoot, 'templates', 'common', 'scripts', 'SCRIPTS.md');
  if (fs.existsSync(l1ScriptsMd)) {
    const variants = fs.readdirSync(path.join(workspaceRoot, 'templates'))
      .filter(d => d.startsWith('co-') && fs.statSync(path.join(workspaceRoot, 'templates', d)).isDirectory());
    const l1Content = fs.readFileSync(l1ScriptsMd, 'utf-8');
    let scriptsMdSynced = 0;
    let scriptsMdSkipped = 0;
    console.log(`\n${CYAN}=== SCRIPTS.md: L1 → L2 propagation ===${RESET}`);
    for (const variant of variants) {
      const dst = path.join(workspaceRoot, 'templates', variant, 'scripts', 'SCRIPTS.md');
      if (!fs.existsSync(dst) || fs.readFileSync(dst, 'utf-8') !== l1Content) {
        if (APPLY || dryRun === false) {
          fs.writeFileSync(dst, l1Content, 'utf-8');
          console.log(`  ${GREEN}✅ templates/${variant}/scripts/SCRIPTS.md${RESET}`);
          scriptsMdSynced++;
        } else {
          console.log(`  ${YELLOW}[dry-run] templates/${variant}/scripts/SCRIPTS.md differs${RESET}`);
          scriptsMdSynced++;
        }
      } else {
        console.log(`  ${DARKGRAY}—  templates/${variant}/scripts/SCRIPTS.md already in sync${RESET}`);
        scriptsMdSkipped++;
      }
    }
    console.log(`${GREEN}SCRIPTS.md sync: ${scriptsMdSynced} updated, ${scriptsMdSkipped} already in sync.${RESET}`);
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

  const docPairs = [
    { root: 'CLAUDE.md',  marker: 'COMMON-CLAUDE',  variants: ['co-design', 'co-develop', 'co-security', 'co-work'] },
    { root: 'GEMINI.md',  marker: 'COMMON-GEMINI',  variants: ['co-design', 'co-develop', 'co-security', 'co-work'] },
    { root: 'AGENTS.md',  marker: 'COMMON-AGENTS',  variants: ['co-consult', 'co-design', 'co-develop', 'co-security', 'co-work'] },
  ];

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const { root, marker, variants } of docPairs) {
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
        } else if (!variantContent.includes(`<!-- ${marker}:START -->`)) {
          // Markers not present in variant — append section on first propagation
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
