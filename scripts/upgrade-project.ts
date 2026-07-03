#!/usr/bin/env bun
// @version 1.2.2
// upgrade-project.ts — Upgrade an existing project to the current template version
// Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run]
//
// Migrated from upgrade-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync,
  readdirSync, statSync,
} from 'node:fs';
import { resolve, join, dirname, basename, isAbsolute, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectPath = '';
let variant = '';
let platform = 'both';
let dryRun = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--platform' && args[i + 1]) { platform = args[++i]; continue; }
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (!projectPath && !args[i].startsWith('--')) { projectPath = args[i]; continue; }
}

if (!projectPath) {
  console.error('Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run]');
  if (import.meta.main) {
    process.exit(1);
  }
}
if (!['claude', 'antigravity', 'both'].includes(platform)) {
  console.error('ERROR: --platform must be one of: claude, antigravity, both');
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Resolve paths ──────────────────────────────────────────────────────────────
const workspaceRoot = resolve(import.meta.dir, '..');
const projectDir = isAbsolute(projectPath) ? projectPath : resolve(projectPath);

if (!existsSync(projectDir)) {
  console.error(`ERROR: Project directory not found: ${projectDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// Validate git repo
const gitCheck = spawnSync('git', ['-C', projectDir, 'rev-parse', '--git-dir'], { encoding: 'utf8' });
if (gitCheck.status !== 0) {
  console.error(`ERROR: Not a git repository: ${projectDir}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

// ── Version resolution ─────────────────────────────────────────────────────────
const versionFile = join(workspaceRoot, 'templates', 'VERSION');
const currentVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf8').trim() : 'unknown';

const templateVersionFile = join(projectDir, '.claude', 'template-version.txt');
let detectedVersion = 'unknown';
let detectedVariant = '';

if (existsSync(templateVersionFile)) {
  const tvContent = readFileSync(templateVersionFile, 'utf8');
  detectedVariant = (tvContent.match(/^variant=(.*)$/m)?.[1] ?? '').trim();
  detectedVersion = (tvContent.match(/^version=(.*)$/m)?.[1] ?? 'unknown').trim();
} else {
  console.log('\nWARNING: template-version.txt not found in this project.');
  console.log('    This project may have been created before version tracking was introduced.');
  console.log(`    Treating as: unknown -> current (${currentVersion})\n`);
  const answer = prompt('    Proceed? [y/N] ') ?? '';
  if (import.meta.main) {
    if (!['y', 'Y'].includes(answer)) { console.log('Aborted.'); process.exit(0); }
  }
}

if (!variant) {
  if (detectedVariant) {
    variant = detectedVariant;
    console.log(`Auto-detected variant: ${variant}`);
  } else {
    console.error('ERROR: Could not detect variant from template-version.txt. Specify --variant explicitly.');
    if (import.meta.main) {
      process.exit(1);
    }
  }
}

// Validate variant
const validVariants = existsSync(join(workspaceRoot, 'templates'))
  ? readdirSync(join(workspaceRoot, 'templates')).filter(d => d.startsWith('co-')).sort()
  : [];
if (!validVariants.includes(variant)) {
  console.error(`ERROR: Invalid variant: ${variant}`);
  console.error(`   Valid variants: ${validVariants.join(' ')}`);
  if (import.meta.main) {
    process.exit(1);
  }
}

const templatesDir = join(workspaceRoot, 'templates', variant);
const commonDir = join(workspaceRoot, 'templates', 'common');

if (import.meta.main) {
  if (!existsSync(templatesDir)) { console.error(`ERROR: Template variant not found: ${templatesDir}`); process.exit(1); }
}
if (import.meta.main) {
  if (!existsSync(commonDir)) { console.error(`ERROR: Common templates directory not found: ${commonDir}`); process.exit(1); }
}

// ── Script version comparison ──────────────────────────────────────────────────
const scriptsSnapshot = join(projectDir, 'scripts-snapshot.json');
const scriptsMd = join(workspaceRoot, 'scripts', 'SCRIPTS.md');
if (existsSync(scriptsSnapshot) && existsSync(scriptsMd)) {
  console.log('\n--- Script version comparison (L2 snapshot vs L1 current) ---');
  try {
    const snapshot = JSON.parse(readFileSync(scriptsSnapshot, 'utf8'));
    const l2Scripts: Record<string, { version: string }> = snapshot.scripts || {};
    console.log(`  Snapshot created: ${snapshot.created ?? 'unknown'}  (${Object.keys(l2Scripts).length} scripts)`);

    const mdContent = readFileSync(scriptsMd, 'utf8');
    const registryMatch = mdContent.match(/## Registry\n.*?\n\|[-| ]+\|\n([\s\S]*?)(?=\n##|\Z)/);
    const l1Scripts: Record<string, { version: string; status: string }> = {};
    if (registryMatch) {
      for (const line of registryMatch[1].trim().split('\n')) {
        const parts = line.split('|').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 4 && /^\d+\.\d+\.\d+$/.test(parts[2])) {
          l1Scripts[parts[0].replace(/`/g, '')] = { version: parts[2], status: parts[3] };
        }
      }
    }

    const outdated: [string, string, string][] = [];
    const deprecated: [string, string][] = [];
    for (const [name, l2Info] of Object.entries(l2Scripts)) {
      const l1Info = l1Scripts[name];
      if (!l1Info) continue;
      if (l2Info.version !== l1Info.version) outdated.push([name, l2Info.version, l1Info.version]);
      if (l1Info.status === 'deprecated') deprecated.push([name, l1Info.version]);
    }

    if (!outdated.length && !deprecated.length) {
      console.log('  ✅ All scripts up-to-date with L1 SCRIPTS.md');
    } else {
      if (outdated.length) { console.log(`  ⚠️  ${outdated.length} script(s) have newer versions:`); outdated.forEach(([n, o, nv]) => console.log(`     ${n.padEnd(40)} ${o} → ${nv}`)); }
      if (deprecated.length) { console.log(`  ⚠️  ${deprecated.length} script(s) deprecated in L1:`); deprecated.forEach(([n, v]) => console.log(`     ${n.padEnd(40)} ${v}  (deprecated)`)); }
    }
    console.log('');
  } catch (e) { console.log(`  WARN: Could not parse scripts-snapshot.json: ${(e as Error).message}`); }
}

// ── Header ─────────────────────────────────────────────────────────────────────
const dryTag = dryRun ? '[DRY RUN] ' : '';
console.log('\n========================================================');
console.log(`  ${dryRun ? '[DRY RUN] ' : ''}upgrade-project.ts`);
console.log(`  Project : ${projectDir}`);
console.log(`  Variant : ${variant}`);
console.log(`  Platform: ${platform}`);
console.log(`  From    : ${detectedVersion}`);
console.log(`  To      : ${currentVersion}`);
console.log('========================================================\n');

// ── Pre-upgrade snapshot ───────────────────────────────────────────────────────
if (!dryRun) {
  console.log('--- Creating pre-upgrade git stash snapshot ---');
  const snapDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const stash = spawnSync('git', ['-C', projectDir, 'stash', 'push', '-m', `pre-upgrade-snapshot-${snapDate}`], { encoding: 'utf8' });
  if (stash.status === 0 && !stash.stdout.includes('No local changes')) {
    console.log('Snapshot saved. To revert: git stash pop');
  } else {
    console.log('INFO: Nothing to stash (working tree clean) — snapshot skipped.');
  }
  console.log('');
}

// ── Version utilities ─────────────────────────────────────────────────────────
function semverGt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

function extractScriptVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const line = readFileSync(filePath, 'utf8').split('\n').find(l => /^\s*\/\/\s*@version\s+\d/.test(l)) ?? '';
  return line.match(/(\d+\.\d+\.\d+)/)?.[1] ?? '';
}

function extractFrontmatterVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  return content.match(/^version:\s*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
}

function fileHash(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveTemplate(rel: string): string {
  const vf = join(templatesDir, rel);
  const cf = join(commonDir, rel);
  if (existsSync(vf)) return vf;
  if (existsSync(cf)) return cf;
  return '';
}

function diffSummary(old: string, src: string): void {
  if (!existsSync(old)) { console.log('    (project file does not exist — will create)'); return; }
  const oldArr = readFileSync(old, 'utf8').split('\n');
  const newArr = readFileSync(src, 'utf8').split('\n');
  const { added, removed } = lineDiffCounts(oldArr, newArr);
  console.log(`    Lines: ${oldArr.length} -> ${newArr.length}  (+${added}/-${removed})`);
}

// LCS-based line diff counts — cross-platform (no external `diff` dependency,
// which is absent on Windows PATH and previously crashed with null stdout).
function lineDiffCounts(a: string[], b: string[]): { added: number; removed: number } {
  const n = a.length, m = b.length;
  // dp[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lcs = dp[0][0];
  return { removed: n - lcs, added: m - lcs };
}

function mergeWorkspaceManaged(projectFile: string, templateFile: string, rel: string): void {
  const tplContent = readFileSync(templateFile, 'utf8');
  if (!tplContent.includes('<!-- WORKSPACE-MANAGED -->')) {
    console.log(`    INFO: Template has no WORKSPACE-MANAGED markers — skipping ${rel}`);
    return;
  }

  const tplBlockMatch = tplContent.match(/<!-- WORKSPACE-MANAGED -->[\s\S]*?<!-- \/WORKSPACE-MANAGED -->/);
  const tplBlock = tplBlockMatch?.[0] ?? '';

  if (!existsSync(projectFile)) {
    console.log('    INFO: Project file does not exist, will create with template content');
    if (!dryRun) {
      mkdirSync(dirname(projectFile), { recursive: true });
      copyFileSync(templateFile, projectFile);
    }
    console.log(`    ${dryTag}CREATED: ${rel}`);
    return;
  }

  const projContent = readFileSync(projectFile, 'utf8');
  if (projContent.includes('<!-- WORKSPACE-MANAGED -->')) {
    if (!dryRun) {
      const updated = projContent.replace(/<!-- WORKSPACE-MANAGED -->[\s\S]*?<!-- \/WORKSPACE-MANAGED -->/, tplBlock);
      writeFileSync(projectFile, updated, 'utf8');
    }
    console.log(`    ${dryTag}MERGED managed section in: ${rel}`);
  } else {
    console.log(`    WARNING: ${rel} has no WORKSPACE-MANAGED markers.`);
    console.log('             Appending managed block at end of file.');
    if (!dryRun) writeFileSync(projectFile, projContent + '\n\n' + tplBlock + '\n', 'utf8');
    console.log(`    ${dryTag}APPENDED managed block to: ${rel}`);
  }
}

let lockedChanged = 0, mergeChanged = 0, preserveListed = 0, syncChanged = 0;

// ── LOCKED files ───────────────────────────────────────────────────────────────
console.log('--- LOCKED files (always overwrite) ---');
const LOCKED_FILES = [
  '.githooks/pre-commit', '.githooks/pre-push', '.githooks/commit-msg',
  '.githooks/post-checkout', '.githooks/pre-rebase',
  '.gitattributes', '.gitleaks.toml',
];
for (const rel of LOCKED_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  LOCKED: ${rel}`);
  diffSummary(dest, src);
  if (!dryRun) {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  console.log(`  ${dryTag}WROTE: ${rel}`);
  lockedChanged++;
}
console.log('');

// ── MERGE files ────────────────────────────────────────────────────────────────
console.log('--- MERGE files (WORKSPACE-MANAGED sections) ---');
const MERGE_FILES: string[] = [];
if (platform === 'claude' || platform === 'both') MERGE_FILES.push('CLAUDE.md');
if (platform === 'antigravity' || platform === 'both') MERGE_FILES.push('GEMINI.md');
MERGE_FILES.push(
  'CONSTITUTION.md', '.gitignore', 'agents/pm.md', 'agents/architect.md',
  'agents/automation-engineer.md', 'agents/docs-writer.md',
  'agents/scaffolding-expert.md', 'agents/security-expert.md',
);
for (const rel of MERGE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  MERGE: ${rel}`);
  mergeWorkspaceManaged(dest, src, rel);
  mergeChanged++;
}
console.log('');

// ── PRESERVE files ─────────────────────────────────────────────────────────────
console.log('--- PRESERVE files (listed only, not modified) ---');
const PRESERVE_FILES = ['README.md', 'README_ko.md', 'docs/context.md'];
for (const rel of PRESERVE_FILES) {
  if (existsSync(join(projectDir, rel))) { console.log(`  PRESERVE: ${rel}`); preserveListed++; }
}
if (existsSync(join(projectDir, 'src'))) { console.log('  PRESERVE: src/ (directory — not touched)'); preserveListed++; }
console.log('');

// ── SKILLS.md schema migration (layer column removal) ─────────────────────────
console.log('--- SKILLS.md schema migration (layer column removal) ---');
const skillsMdPath = join(projectDir, 'skills', 'SKILLS.md');
if (existsSync(skillsMdPath)) {
  const skillsMdContent = readFileSync(skillsMdPath, 'utf8');
  const lines = skillsMdContent.split('\n');

  // Find ## Registry section and locate its header row
  const registryLineIdx = lines.findIndex(l => l.trim() === '## Registry');
  if (registryLineIdx !== -1) {
    // Find first | row after ## Registry (the header)
    let headerIdx = -1;
    for (let i = registryLineIdx + 1; i < lines.length; i++) {
      if (lines[i].trimStart().startsWith('|')) { headerIdx = i; break; }
    }

    if (headerIdx !== -1) {
      const headerCells = lines[headerIdx].split('|').map(c => c.trim());
      // headerCells[0] === '', headerCells[1..n-1] are column names, headerCells[n] === ''
      const layerColIndex = headerCells.findIndex((c, i) => i > 0 && c.toLowerCase() === 'layer');

      if (layerColIndex !== -1) {
        // Remove layer column from every | row in the Registry section (until next ## or EOF)
        const newLines = [...lines];
        for (let i = headerIdx; i < newLines.length; i++) {
          if (i > headerIdx && newLines[i].trim().startsWith('##')) break;
          if (!newLines[i].trimStart().startsWith('|')) continue;
          const cells = newLines[i].split('|');
          // cells[0] = '' (before first |), cells[layerColIndex] = the layer cell, cells[last] = ''
          cells.splice(layerColIndex, 1);
          newLines[i] = cells.join('|');
        }

        // Inject comment before ## Registry heading
        const comment = '<!-- propagation controlled via SKILL.md l2_propagate/scope -->';
        newLines.splice(registryLineIdx, 0, comment);

        const newContent = newLines.join('\n');
        if (!dryRun) {
          writeFileSync(skillsMdPath, newContent, 'utf8');
        }
        console.log(`  ${dryTag}MIGRATED: skills/SKILLS.md — removed stale 'layer' column`);
      } else {
        console.log("  INFO: skills/SKILLS.md — no 'layer' column found (already migrated)");
      }
    } else {
      console.log("  INFO: skills/SKILLS.md — ## Registry section has no table header");
    }
  } else {
    console.log("  INFO: skills/SKILLS.md — no ## Registry section found");
  }
} else {
  console.log("  INFO: skills/SKILLS.md not found — skipping migration");
}
console.log('');

// ── SYNC_IF_NEWER: scripts/ ───────────────────────────────────────────────────
console.log('--- SYNC_IF_NEWER: scripts/ ---');
const scriptSubDirs = ['', 'hooks', 'lib', 'helpers'];
for (const subDir of scriptSubDirs) {
  const tplScriptsDir = join(commonDir, 'scripts', subDir);
  if (!existsSync(tplScriptsDir)) continue;
  const relPrefix = subDir ? `scripts/${subDir}` : 'scripts';
  for (const fname of readdirSync(tplScriptsDir)) {
    if (!fname.endsWith('.ts')) continue;
    const tplFile = join(tplScriptsDir, fname);
    if (!statSync(tplFile).isFile()) continue;
    const rel = `${relPrefix}/${fname}`;
    const projFile = join(projectDir, rel);
    const tplVer = extractScriptVersion(tplFile);
    if (!tplVer) { console.log(`  SKIP (no version): ${rel}`); continue; }
    const projVer = extractScriptVersion(projFile);
    if (!existsSync(projFile)) {
      console.log(`  NEW   ${rel}  (none) → ${tplVer}`);
      if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(tplFile, projFile); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      if (!dryRun) copyFileSync(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  ${projVer}`);
    }
  }
}
console.log('');

// ── SYNC_IF_NEWER: agents/ ────────────────────────────────────────────────────
console.log('--- SYNC_IF_NEWER: agents/ ---');
const tplAgentsDirs = [join(templatesDir, 'agents'), join(commonDir, 'agents')];
const seenAgents = new Set<string>();
for (const agentsDir of tplAgentsDirs) {
  if (!existsSync(agentsDir)) continue;
  for (const fname of readdirSync(agentsDir)) {
    if (!fname.endsWith('.md') || seenAgents.has(fname)) continue;
    if (fname === 'README.md' || fname === 'README_ko.md' || fname === '_COMMON.md') {
      console.log(`  PRESERVE (README): agents/${fname}`);
      seenAgents.add(fname);
      continue;
    }
    seenAgents.add(fname);
    const tplFile = join(agentsDir, fname);
    if (!statSync(tplFile).isFile()) continue;
    const rel = `agents/${fname}`;
    const projFile = join(projectDir, rel);
    const tplVer = extractFrontmatterVersion(tplFile);
    if (!tplVer) { console.log(`  SKIP (no version): ${rel}`); continue; }
    const projVer = extractFrontmatterVersion(projFile);
    if (!existsSync(projFile)) {
      console.log(`  NEW   ${rel}  (none) → ${tplVer}`);
      if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(tplFile, projFile); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (!projVer) {
      console.log(`  UPDATE ${rel}  (no version) → ${tplVer}`);
      if (!dryRun) copyFileSync(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      if (!dryRun) copyFileSync(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  ${projVer}`);
    }
  }
}
// List project-only agents as PRESERVE
const projAgentsDir = join(projectDir, 'agents');
if (existsSync(projAgentsDir)) {
  for (const fname of readdirSync(projAgentsDir)) {
    if (fname.endsWith('.md') && !seenAgents.has(fname)) {
      console.log(`  PRESERVE (project-only): agents/${fname}`);
    }
  }
}
console.log('');

// ── SYNC_IF_NEWER: skills/ ────────────────────────────────────────────────────
console.log('--- SYNC_IF_NEWER: skills/ ---');
const tplSkillsDir = join(commonDir, 'skills');
const seenSkills = new Set<string>();
if (existsSync(tplSkillsDir)) {
  for (const skillName of readdirSync(tplSkillsDir)) {
    const tplSkillFile = join(tplSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(tplSkillFile)) continue;
    seenSkills.add(skillName);
    const projSkillFile = join(projectDir, 'skills', skillName, 'SKILL.md');
    const tplVer = extractFrontmatterVersion(tplSkillFile);
    if (tplVer) {
      const projVer = extractFrontmatterVersion(projSkillFile);
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (none) → ${tplVer}`);
        if (!dryRun) { mkdirSync(dirname(projSkillFile), { recursive: true }); copyFileSync(tplSkillFile, projSkillFile); }
        console.log(`  ${dryTag}COPIED: skills/${skillName}/SKILL.md`);
        syncChanged++;
      } else if (semverGt(tplVer, projVer)) {
        console.log(`  UPDATE skills/${skillName}/SKILL.md  ${projVer || '(none)'} → ${tplVer}`);
        if (!dryRun) copyFileSync(tplSkillFile, projSkillFile);
        console.log(`  ${dryTag}COPIED: skills/${skillName}/SKILL.md`);
        syncChanged++;
      } else {
        console.log(`  OK     skills/${skillName}/SKILL.md  ${projVer}`);
      }
    } else {
      // No explicit version — compare by content hash
      const tplHash = fileHash(tplSkillFile);
      const projHash = fileHash(projSkillFile);
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (hash-based)`);
        if (!dryRun) { mkdirSync(dirname(projSkillFile), { recursive: true }); copyFileSync(tplSkillFile, projSkillFile); }
        console.log(`  ${dryTag}COPIED: skills/${skillName}/SKILL.md`);
        syncChanged++;
      } else if (tplHash !== projHash) {
        console.log(`  UPDATE skills/${skillName}/SKILL.md  (content changed)`);
        if (!dryRun) copyFileSync(tplSkillFile, projSkillFile);
        console.log(`  ${dryTag}COPIED: skills/${skillName}/SKILL.md`);
        syncChanged++;
      } else {
        console.log(`  OK     skills/${skillName}/SKILL.md  (hash match)`);
      }
    }
  }
}
// List project-only skills as PRESERVE
const projSkillsDir = join(projectDir, 'skills');
if (existsSync(projSkillsDir)) {
  for (const skillName of readdirSync(projSkillsDir)) {
    if (!seenSkills.has(skillName) && existsSync(join(projSkillsDir, skillName, 'SKILL.md'))) {
      console.log(`  PRESERVE (project-only): skills/${skillName}/`);
    }
  }
}
console.log('');

// ── OVERWRITE: docs/_common/ (allowlist) ──────────────────────────────────────
console.log('--- OVERWRITE: docs/_common/ (governance files) ---');
const DOCS_OVERWRITE = ['security.md'];
const DOCS_PRESERVE  = ['phase-definitions.md', 'context.md', 'README.md', 'README_ko.md'];
for (const fname of DOCS_OVERWRITE) {
  const src = join(commonDir, 'docs', '_common', fname);
  const dest = join(projectDir, 'docs', fname);
  if (!existsSync(src)) { console.log(`  SKIP (no template): docs/${fname}`); continue; }
  if (!existsSync(dest)) {
    console.log(`  NEW   docs/${fname}`);
  } else {
    diffSummary(dest, src);
  }
  if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
  console.log(`  ${dryTag}WROTE: docs/${fname}`);
  syncChanged++;
}
for (const fname of DOCS_PRESERVE) {
  if (existsSync(join(projectDir, 'docs', fname))) console.log(`  PRESERVE: docs/${fname}`);
}
console.log('');

// ── Post-upgrade: write template-version.txt ───────────────────────────────────
if (!dryRun) {
  mkdirSync(join(projectDir, '.claude'), { recursive: true });
  writeFileSync(
    templateVersionFile,
    `variant=${variant}\nversion=${currentVersion}\nplatform=${platform}\nupgraded=${new Date().toISOString()}\n`,
    'utf8'
  );
  console.log(`Written: .claude/template-version.txt (version=${currentVersion})`);
} else {
  console.log(`[DRY RUN] Would write: .claude/template-version.txt (version=${currentVersion})`);
}
console.log('');

// ── Security Bootstrap Verification ───────────────────────────────────────────
console.log('--- Security Bootstrap Verification ---');
let securityPass = true;
function secCheck(label: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK ' : 'FAIL'} ${label}`);
  if (!ok) securityPass = false;
}

secCheck('.gitleaks.toml exists', existsSync(join(projectDir, '.gitleaks.toml')));
secCheck('.githooks/pre-commit exists', existsSync(join(projectDir, '.githooks', 'pre-commit')));
const ga = existsSync(join(projectDir, '.gitattributes')) ? readFileSync(join(projectDir, '.gitattributes'), 'utf8') : '';
secCheck('.gitattributes has eol=lf', ga.includes('eol=lf'));
const gi = existsSync(join(projectDir, '.gitignore')) ? readFileSync(join(projectDir, '.gitignore'), 'utf8') : '';
secCheck('.gitignore has .env pattern', gi.includes('.env'));

const hooksPath = spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath'], { encoding: 'utf8' }).stdout.trim();
if (hooksPath === '.githooks') {
  console.log('  OK  git core.hooksPath = .githooks');
} else {
  console.log(`  WARN git core.hooksPath = '${hooksPath}' (expected .githooks)`);
  if (!dryRun) {
    spawnSync('git', ['-C', projectDir, 'config', 'core.hooksPath', '.githooks']);
    console.log('       -> Auto-fixed: set core.hooksPath to .githooks');
  }
}
console.log('');

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('========================================================');
console.log('  Upgrade Complete');
console.log(`  Locked files updated : ${lockedChanged}`);
console.log(`  Merge files processed: ${mergeChanged}`);
console.log(`  Sync files updated   : ${syncChanged}`);
console.log(`  Preserve files listed: ${preserveListed}`);
console.log(`  Security checks      : ${securityPass ? 'PASSED' : 'FAILED (see above)'}`);
if (dryRun) console.log('\n  [DRY RUN] No files were modified.');
