#!/usr/bin/env bun
// @version 1.10.0
// v1.10.0: Two gaps found while upgrading 7 real projects in one session:
//   (1) .gitleaks.toml moved out of blind LOCKED overwrite into mergeGitleaksToml() —
//         co-abap's project-specific allowlist entries (vendored-ABAP false-positive
//         exclusion, SAP trial default-credential regex) were silently dropped by the
//         old LOCKED behavior, breaking the pre-push secret scan on the next push.
//   (2) SYNC_IF_NEWER: scripts/ now calls reconcileScriptRegistry() after every copy —
//         previously file CONTENT was synced by version but the project's own
//         scripts/SCRIPTS.md registry was never updated, so verify-scripts.ts/
//         lifecycle-sync-audit.ts failed after every single upgrade (stale version
//         numbers on existing rows, "Unregistered script" for newly-added files) and
//         required manual reconciliation every time.
// upgrade-project.ts — Upgrade an existing project to the current template version
// Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run] [--prune-removed] [--rollback]
// v1.9.0: Moved docs/context.md from DOCS_MERGE (managed-block merge) to VARIANT_DOCS_SYNC
//           (version-footer sync) — the common template carries no managed-block markers,
//           so the merge path was a silent no-op despite the file's *context.md version: X.Y*
//           footer existing specifically for this comparison. VARIANT_DOCS_SYNC's src resolution
//           generalized from a variant-dir-only join() to resolveTemplate() (variant, then common)
//           to support docs/context.md's common-only SSOT.
// v1.3.0: Added multi-pattern managed block support (WORKSPACE-MANAGED, COMMON-CLAUDE, COMMON-GEMINI);
//           removed stale agent MERGE references and CONSTITUTION.md
// v1.6.0: Added --prune-removed, --rollback, conflict detection for SYNC files, auto-discovery for script subdirs
// v1.7.0: Added DOCS_MERGE (variant/common docs), VARIANT_DOCS_SYNC, COMMANDS_SYNC;
//           extended managed block markers (VARIANT-INJECT, COMMON-AGENTS, DYNAMIC_SKILLS);
//           added sync-skills.ts post-invoke for platform skill distribution
// v1.8.0: extractScriptVersion now falls back to JSDoc `* @version` headers (files like
//           security-validator.ts were silently never synced); added variant scripts/skills
//           sync (templates/<variant>/scripts/<variant>/ and skills/<variant>/ → project);
//           agent overwrites preserve the project's local `lifecycle:` frontmatter block.
// v1.8.1: fix(mergeWorkspaceManaged): match managed blocks positionally (template's Nth
//           occurrence of a marker <-> project's Nth occurrence) instead of blindly
//           replacing every occurrence with each template block in turn — the latter
//           clobbered all N blocks with the last-processed block's content whenever a
//           single marker type (e.g. COMMON-CLAUDE) wraps multiple distinct sections.
//
// Migrated from upgrade-project.sh/ps1 per ADR-0036. No file permission manipulation.

import {
  existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync,
  readdirSync, statSync,
} from 'node:fs';
import { resolve, join, dirname, basename, isAbsolute, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { extractScriptVersion, preserveLifecycleFrontmatter } from './helpers/upgrade-versions.ts';

// ── Argument parsing ───────────────────────────────────────────────────────────
let projectPath = '';
let variant = '';
let platform = 'both';
let dryRun = false;
let pruneRemoved = false;
let rollback = false;
let yesFlag = false;

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--variant' && args[i + 1]) { variant = args[++i]; continue; }
  if (args[i] === '--platform' && args[i + 1]) { platform = args[++i]; continue; }
  if (args[i] === '--dry-run') { dryRun = true; continue; }
  if (args[i] === '--prune-removed') { pruneRemoved = true; continue; }
  if (args[i] === '--rollback') { rollback = true; continue; }
  if (args[i] === '--yes' || args[i] === '-y') { yesFlag = true; continue; }
  if (!projectPath && !args[i].startsWith('--')) { projectPath = args[i]; continue; }
}

if (!projectPath) {
  console.error('Usage: bun scripts/upgrade-project.ts <project-path> [--variant <variant>] [--platform claude|antigravity|both] [--dry-run] [--prune-removed] [--rollback] [--yes]');
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
  if (import.meta.main && !yesFlag) {
    const answer = prompt('    Proceed? [y/N] ') ?? '';
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

// G12: --rollback convenience flag
if (rollback) {
  console.log('--- Rolling back last upgrade ---');
  const stashList = spawnSync('git', ['-C', projectDir, 'stash', 'list'], { encoding: 'utf8' });
  const preUpgradeStash = stashList.stdout.split('\n').find(l => l.includes('pre-upgrade-snapshot'));
  if (preUpgradeStash) {
    const stashIdx = preUpgradeStash.match(/^stash@\{(\d+)\}/)?.[1] ?? '0';
    const pop = spawnSync('git', ['-C', projectDir, 'stash', 'pop', `stash@{${stashIdx}}`], { encoding: 'utf8' });
    if (pop.status === 0) {
      console.log('✅ Pre-upgrade stash restored successfully.');
    } else {
      console.error(`ERROR: Failed to restore stash: ${pop.stderr}`);
    }
  } else {
    console.log('INFO: No pre-upgrade stash found. Nothing to rollback.');
  }
  if (import.meta.main) process.exit(0);
}

if (!dryRun) {
  console.log('--- Creating pre-upgrade git stash snapshot ---');
  const snapDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const stash = spawnSync('git', ['-C', projectDir, 'stash', 'push', '-m', `pre-upgrade-snapshot-${snapDate}`], { encoding: 'utf8' });
  if (stash.status === 0 && !stash.stdout.includes('No local changes')) {
    console.log('Snapshot saved. To revert: git stash pop or --rollback');
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

// extractScriptVersion / preserveLifecycleFrontmatter are imported from
// ./helpers/upgrade-versions.ts (testable pure helpers).

function extractFrontmatterVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  return content.match(/^version:\s*["']?(\d+\.\d+\.\d+)/m)?.[1] ?? '';
}

function fileHash(filePath: string): string {
  if (!existsSync(filePath)) return '';
  return createHash('md5').update(readFileSync(filePath)).digest('hex');
}

/**
 * Reconcile the project's local scripts/SCRIPTS.md registry after SYNC_IF_NEWER
 * copies an updated (or brand-new) script file into the project.
 *
 * Previously this script synced FILE CONTENT by version comparison but never touched
 * the project's own SCRIPTS.md — every upgrade left `verify-scripts.ts`/`lifecycle-sync-
 * audit.ts` failing on stale version numbers (existing rows) or "Unregistered script"
 * (new files like a newly-added helper), requiring manual reconciliation every time.
 * The L0 (workspace root) registry is the version source of truth: if a row for this
 * script already exists in the project registry, only its version column is replaced,
 * preserving every project-specific column (layer label conventions differ project to
 * project — e.g. "L0+L1" vs "common" — this must never silently normalize those). If no
 * row exists yet, the L0 registry's row is copied in verbatim (same shape, since the
 * project's registry format is itself derived from L0) and appended after the last
 * script row in the table.
 */
function reconcileScriptRegistry(scriptRelPath: string): void {
  const registryPath = join(projectDir, 'scripts', 'SCRIPTS.md');
  if (!existsSync(registryPath) || !existsSync(scriptsMd)) return;
  // Registry rows key scripts by path relative to scripts/ (no "scripts/" prefix).
  const name = scriptRelPath.replace(/^scripts\//, '');
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const l0Content = readFileSync(scriptsMd, 'utf8');
  const l0RowMatch = l0Content.match(new RegExp(`^\\| \`${escaped}\` \\| [^|]*\\| ([^|]+) \\|.*$`, 'm'));
  if (!l0RowMatch) return; // not in L0 registry (e.g. a variant-local script) — nothing to reconcile
  const l0Version = l0RowMatch[1].trim();
  const l0FullRow = l0RowMatch[0];

  const content = readFileSync(registryPath, 'utf8');
  const rowRe = new RegExp(`^(\\| \`${escaped}\` \\| [^|]*\\| )[^|]+( \\|.*)$`, 'm');
  if (rowRe.test(content)) {
    const updated = content.replace(rowRe, `$1${l0Version}$2`);
    if (updated !== content) {
      writeFileSync(registryPath, updated, 'utf8');
      console.log(`    📝 scripts/SCRIPTS.md: ${name} → v${l0Version}`);
    }
    return;
  }

  // No row at all — append the L0 row verbatim after the last `| \`*.ts\` |` row.
  const lines = content.split('\n');
  let lastRowIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\|\s*`[^`]+\.ts`\s*\|/.test(lines[i])) lastRowIdx = i;
  }
  if (lastRowIdx >= 0) {
    lines.splice(lastRowIdx + 1, 0, l0FullRow);
    writeFileSync(registryPath, lines.join('\n'), 'utf8');
    console.log(`    📝 scripts/SCRIPTS.md: registered ${name} (v${l0Version})`);
  }
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

/** Marker patterns supported by mergeWorkspaceManaged.
 *  Each entry supports raw regex in `open`/`close` fields — NOT literal strings.
 *  WORKSPACE-MANAGED open pattern accepts an optional `: description` suffix.
 *  VARIANT-INJECT uses asymmetric open/close naming (open: VARIANT-INJECT, close: END VARIANT-INJECT).
 *  COMMON-AGENTS and DYNAMIC_SKILLS use asymmetric START/END naming.
 */
const MANAGED_PATTERNS: Array<{ open: RegExp; close: string; label: string }> = [
  { open: /<!-- WORKSPACE-MANAGED(?::[^\-]*?)? -->/, close: '<!-- /WORKSPACE-MANAGED -->', label: 'WORKSPACE-MANAGED' },
  { open: /<!-- COMMON-CLAUDE:START -->/, close: '<!-- COMMON-CLAUDE:END -->', label: 'COMMON-CLAUDE' },
  { open: /<!-- COMMON-GEMINI:START -->/, close: '<!-- COMMON-GEMINI:END -->', label: 'COMMON-GEMINI' },
  { open: /<!-- VARIANT-INJECT(?::[^\-]*?)? -->/, close: '<!-- END VARIANT-INJECT -->', label: 'VARIANT-INJECT' },
  { open: /<!-- COMMON-AGENTS:START -->/, close: '<!-- COMMON-AGENTS:END -->', label: 'COMMON-AGENTS' },
  { open: /<!-- DYNAMIC_SKILLS_START -->/, close: '<!-- DYNAMIC_SKILLS_END -->', label: 'DYNAMIC_SKILLS' },
];

/**
 * Find all managed blocks in the given content.
 * Returns an array of { pattern, blocks: [{start, end, matched}] }.
 */
function findManagedBlocks(content: string): Array<{ pattern: typeof MANAGED_PATTERNS[number]; blocks: Array<{ start: number; end: number; matched: string }> }> {
  const results: Array<{ pattern: typeof MANAGED_PATTERNS[number]; blocks: Array<{ start: number; end: number; matched: string }> }> = [];
  for (const p of MANAGED_PATTERNS) {
    // p.open is already a RegExp; p.close is a literal string that needs escaping.
    const closeEscaped = p.close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(p.open.source + '[\\s\\S]*?' + closeEscaped, 'g');
    const blocks: Array<{ start: number; end: number; matched: string }> = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      blocks.push({ start: match.index, end: match.index + match[0].length, matched: match[0] });
    }
    if (blocks.length > 0) results.push({ pattern: p, blocks });
  }
  return results;
}

function mergeWorkspaceManaged(projectFile: string, templateFile: string, rel: string): void {
  let tplContent = readFileSync(templateFile, 'utf8');
  let tplManaged = findManagedBlocks(tplContent);

  // If variant template has no managed markers, fall back to common template
  // (variant may be an extends-only file that shadows the marker-rich common version).
  if (tplManaged.length === 0 && templateFile.startsWith(templatesDir)) {
    const commonFile = join(commonDir, rel);
    if (existsSync(commonFile)) {
      const commonContent = readFileSync(commonFile, 'utf8');
      const commonManaged = findManagedBlocks(commonContent);
      if (commonManaged.length > 0) {
        console.log(`    INFO: Variant template has no markers for ${rel}, using common template`);
        tplContent = commonContent;
        tplManaged = commonManaged;
      }
    }
  }

  if (tplManaged.length === 0) {
    console.log(`    INFO: Template has no managed markers — skipping ${rel}`);
    return;
  }

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
  const projManaged = findManagedBlocks(projContent);

  // Strategy: merge each managed block from template into project, matched
  // POSITIONALLY (template's Nth block of a given marker type -> project's Nth
  // occurrence of that same marker type). A marker type like COMMON-CLAUDE can
  // wrap several distinct blocks with different content in one file (e.g. one
  // per numbered CLAUDE.md section) — the marker itself carries no per-block
  // label, so a blind "replace every match with this one block" would clobber
  // every occurrence with whichever block was processed last.
  let updated = projContent;
  let merged = false;

  for (const { pattern, blocks: tplBlocks } of tplManaged) {
    const closeEscaped = pattern.close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(pattern.open.source + '[\\s\\S]*?' + closeEscaped, 'g');

    const projOccurrences: Array<{ start: number; end: number }> = [];
    for (const occ of updated.matchAll(regex)) {
      projOccurrences.push({ start: occ.index!, end: occ.index! + occ[0].length });
    }

    if (projOccurrences.length === 0) {
      // No matching block in project — append all template blocks
      for (const tplBlock of tplBlocks) {
        if (!dryRun) {
          updated = updated + '\n\n' + tplBlock.matched + '\n';
        }
        merged = true;
        console.log(`    ${dryTag}APPENDED ${pattern.label} block to: ${rel}`);
      }
      continue;
    }

    if (projOccurrences.length !== tplBlocks.length) {
      console.log(`    WARNING: ${pattern.label} block count mismatch in ${rel} (project has ${projOccurrences.length}, template has ${tplBlocks.length}) — merging positionally up to the shorter count`);
    }

    // Replace positionally, back-to-front so earlier offsets stay valid.
    const pairCount = Math.min(projOccurrences.length, tplBlocks.length);
    for (let i = pairCount - 1; i >= 0; i--) {
      const { start, end } = projOccurrences[i];
      const tplBlock = tplBlocks[i];
      if (!dryRun) {
        updated = updated.slice(0, start) + tplBlock.matched + updated.slice(end);
      }
      merged = true;
      console.log(`    ${dryTag}MERGED ${pattern.label} block in: ${rel}`);
    }
  }

  if (projManaged.length === 0 && !merged) {
    console.log(`    WARNING: ${rel} has no managed markers in project.`);
    console.log('             Appending template managed blocks at end of file.');
    if (!dryRun) writeFileSync(projectFile, updated, 'utf8');
    console.log(`    ${dryTag}APPENDED managed blocks to: ${rel}`);
  } else if (!dryRun && merged) {
    writeFileSync(projectFile, updated, 'utf8');
  }
}

/** Check if a project file has local modifications (via git status). */
function isLocallyModified(filePath: string): boolean {
  const rel = relative(projectDir, filePath);
  const status = spawnSync('git', ['-C', projectDir, 'status', '--porcelain', '--', rel], { encoding: 'utf8' });
  return status.stdout.trim().length > 0;
}

let lockedChanged = 0, mergeChanged = 0, preserveListed = 0, syncChanged = 0;

/**
 * Extract every `'''...'''` (or `'...'`) string literal from a named TOML array
 * (e.g. `regexes = [ ... ]` or `paths = [ ... ]`), by array name. Comment-only lines
 * are stripped first — explanatory comments routinely contain apostrophes (e.g. "AI
 * session notes" or "they're"), which a naive single-quote match mistakes for the
 * start of a string literal and misparses everything after it.
 */
function extractGitleaksArray(content: string, arrayName: string): string[] {
  const blockMatch = content.match(new RegExp(`${arrayName}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`));
  if (!blockMatch) return [];
  const codeOnly = blockMatch[1]
    .split('\n')
    .filter(line => !line.trim().startsWith('#'))
    .join('\n');
  const entries: string[] = [];
  for (const m of codeOnly.matchAll(/'''([^']*)'''|'([^']*)'/g)) {
    entries.push(m[1] ?? m[2]);
  }
  return entries;
}

/**
 * .gitleaks.toml is shared boilerplate but routinely carries project-specific allowlist
 * entries (e.g. co-abap's exclusion for vendored ABAP source that trips generic-api-key
 * false positives) — a plain LOCKED overwrite silently deletes those, and the next
 * `git push` fails the pre-push secret scan on findings that were already known-safe.
 * Preserve any project-only `regexes`/`paths` entries by appending them into the new
 * template content before writing, rather than dropping them.
 */
function mergeGitleaksToml(dest: string, src: string): void {
  if (!existsSync(dest)) {
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
    console.log(`  ${dryTag}WROTE: .gitleaks.toml (new)`);
    return;
  }
  const destContent = readFileSync(dest, 'utf8');
  const srcContent = readFileSync(src, 'utf8');
  const srcRegexes = new Set(extractGitleaksArray(srcContent, 'regexes'));
  const srcPaths = new Set(extractGitleaksArray(srcContent, 'paths'));
  const projectOnlyRegexes = extractGitleaksArray(destContent, 'regexes').filter(e => !srcRegexes.has(e));
  const projectOnlyPaths = extractGitleaksArray(destContent, 'paths').filter(e => !srcPaths.has(e));

  let merged = srcContent;
  if (projectOnlyRegexes.length > 0) {
    merged = merged.replace(
      /(regexes\s*=\s*\[[\s\S]*?)(\n\])/,
      `$1\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyRegexes.map(e => `  '''${e}''',`).join('\n') + `$2`
    );
    console.log(`  ⚠️  Preserved ${projectOnlyRegexes.length} project-specific regex allowlist entr${projectOnlyRegexes.length === 1 ? 'y' : 'ies'} that the template overwrite would have dropped`);
  }
  if (projectOnlyPaths.length > 0) {
    merged = merged.replace(
      /(paths\s*=\s*\[[\s\S]*?)(\n\])/,
      `$1\n  # Preserved from this project's prior .gitleaks.toml (not in the current common template):\n` +
        projectOnlyPaths.map(e => `  '''${e}''',`).join('\n') + `$2`
    );
    console.log(`  ⚠️  Preserved ${projectOnlyPaths.length} project-specific path exclusion${projectOnlyPaths.length === 1 ? '' : 's'} that the template overwrite would have dropped`);
  }
  diffSummary(dest, src);
  if (!dryRun) writeFileSync(dest, merged, 'utf8');
  console.log(`  ${dryTag}WROTE: .gitleaks.toml`);
}

// ── LOCKED files ───────────────────────────────────────────────────────────────
console.log('--- LOCKED files (always overwrite) ---');
const LOCKED_FILES = [
  '.githooks/pre-commit', '.githooks/pre-push', '.githooks/commit-msg',
  '.githooks/post-checkout', '.githooks/pre-rebase',
  '.gitattributes',
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
// .gitleaks.toml: same "always take the template" intent as LOCKED, but merge-aware —
// see mergeGitleaksToml() for why a blind overwrite is unsafe for this specific file.
{
  const rel = '.gitleaks.toml';
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) {
    console.log(`  SKIP (no template): ${rel}`);
  } else {
    console.log(`  LOCKED (merge-aware): ${rel}`);
    mergeGitleaksToml(dest, src);
    lockedChanged++;
  }
}
console.log('');

// ── MERGE files ────────────────────────────────────────────────────────────────
console.log('--- MERGE files (WORKSPACE-MANAGED sections) ---');
const MERGE_FILES: string[] = [];
if (platform === 'claude' || platform === 'both') MERGE_FILES.push('CLAUDE.md');
if (platform === 'antigravity' || platform === 'both') MERGE_FILES.push('GEMINI.md');
MERGE_FILES.push(
  '.gitignore', 'agents/pm.md',
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

// ── Inline version parsing utility ──────────────────────────────────────────────
function extractInlineVersion(filePath: string): string {
  if (!existsSync(filePath)) return '';
  const content = readFileSync(filePath, 'utf8');
  const fname = basename(filePath).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.match(new RegExp(`\\*${fname}\\s+version:\\s*(\\d+\\.\\d+)`, 'm'))?.[1] ?? '';
}

function parseInlineVersion(ver: string): [number, number] {
  const parts = ver.split('.').map(Number);
  return [(parts[0] ?? 0), (parts[1] ?? 0)];
}

function inlineVersionGt(a: string, b: string): boolean {
  const [amajor, aminor] = parseInlineVersion(a);
  const [bmajor, bminor] = parseInlineVersion(b);
  return amajor > bmajor || (amajor === bmajor && aminor > bminor);
}

// ── DOCS_MERGE: common/variant docs with managed blocks ───────────────────────
console.log('--- DOCS_MERGE: common and variant docs (managed blocks) ---');
const DOCS_MERGE_FILES: string[] = [
  'AGENTS.md',
];
// Auto-discover variant-specific context file
const variantContextRel = `docs/${variant}.context.md`;
if (existsSync(join(templatesDir, variantContextRel)) || existsSync(join(commonDir, 'docs', `${variant}.context.md`))) {
  DOCS_MERGE_FILES.push(variantContextRel);
}
// Common docs without managed blocks → plain overwrite
const DOCS_OVERWRITE_FILES: string[] = [
  'docs/phase-definitions.md',
];

for (const rel of DOCS_MERGE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  console.log(`  MERGE: ${rel}`);
  mergeWorkspaceManaged(dest, src, rel);
  mergeChanged++;
}
for (const rel of DOCS_OVERWRITE_FILES) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }
  if (!existsSync(dest)) {
    console.log(`  NEW    ${rel}`);
  } else {
    diffSummary(dest, src);
  }
  if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
  console.log(`  ${dryTag}WROTE: ${rel}`);
  mergeChanged++;
}
console.log('');

// ── VARIANT_DOCS_SYNC: variant-specific docs (version/hash based) ──────────────
console.log('--- VARIANT_DOCS_SYNC: variant documentation (version/hash based) ---');
// docs/context.md's SSOT is templates/common/, not the variant dir — WS-07 forbids
// variants from carrying their own copy — so it needs the variant-then-common
// fallback resolveTemplate() already provides, not a variant-dir-only join().
const VARIANT_DOCS_SYNC: string[] = [
  'docs/context.md',
  'docs/engagement-orchestration.md',
  'docs/team-configuration-guide.md',
];
for (const rel of VARIANT_DOCS_SYNC) {
  const src = resolveTemplate(rel);
  const dest = join(projectDir, rel);
  if (!src) { console.log(`  SKIP (no template): ${rel}`); continue; }

  const tplInlineVer = extractInlineVersion(src);
  if (!existsSync(dest)) {
    console.log(`  NEW    ${rel}  ${tplInlineVer ? `(v${tplInlineVer})` : '(hash-based)'}`);
    if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
    console.log(`  ${dryTag}COPIED: ${rel}`);
    syncChanged++;
  } else if (tplInlineVer) {
    const projInlineVer = extractInlineVersion(dest);
    if (!projInlineVer) {
      console.log(`  UPDATE ${rel}  (no version) → v${tplInlineVer}`);
      if (!dryRun) copyFileSync(src, dest);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (inlineVersionGt(tplInlineVer, projInlineVer)) {
      if (isLocallyModified(dest)) {
        console.log(`  ⚠️  CONFLICT ${rel}  v${projInlineVer} → v${tplInlineVer}  (local modifications exist)`);
      } else {
        console.log(`  UPDATE ${rel}  v${projInlineVer} → v${tplInlineVer}`);
      }
      if (!dryRun) copyFileSync(src, dest);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  v${projInlineVer}`);
    }
  } else {
    // No inline version — hash-based
    const tplHash = fileHash(src);
    const projHash = fileHash(dest);
    if (tplHash !== projHash) {
      if (isLocallyModified(dest)) {
        console.log(`  ⚠️  CONFLICT ${rel}  (content changed, local modifications exist)`);
      } else {
        console.log(`  UPDATE ${rel}  (content changed)`);
      }
      if (!dryRun) copyFileSync(src, dest);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  (hash match)`);
    }
  }
}
console.log('');

// ── COMMANDS_SYNC: platform command files (.claude/commands, .gemini/commands) ──
console.log('--- COMMANDS_SYNC: platform commands (hash-based) ---');
const COMMANDS_DIRS: string[] = [];
if (platform === 'claude' || platform === 'both') COMMANDS_DIRS.push('.claude/commands');
if (platform === 'antigravity' || platform === 'both') COMMANDS_DIRS.push('.gemini/commands');

for (const cmdDir of COMMANDS_DIRS) {
  // Check variant template first, then common
  const tplCmdDir = existsSync(join(templatesDir, cmdDir)) ? join(templatesDir, cmdDir) : join(commonDir, cmdDir);
  if (!existsSync(tplCmdDir)) { console.log(`  SKIP (no template): ${cmdDir}/`); continue; }
  for (const fname of readdirSync(tplCmdDir)) {
    if (!fname.endsWith('.md')) continue;
    const rel = `${cmdDir}/${fname}`;
    const src = join(tplCmdDir, fname);
    const dest = join(projectDir, rel);
    if (!existsSync(dest)) {
      console.log(`  NEW    ${rel}`);
      if (!dryRun) { mkdirSync(dirname(dest), { recursive: true }); copyFileSync(src, dest); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      const tplHash = fileHash(src);
      const projHash = fileHash(dest);
      if (tplHash !== projHash) {
        diffSummary(dest, src);
        if (!dryRun) copyFileSync(src, dest);
        console.log(`  ${dryTag}COPIED: ${rel}`);
        syncChanged++;
      } else {
        console.log(`  OK     ${rel}`);
      }
    }
  }
}
console.log('');

// ── PRESERVE files ─────────────────────────────────────────────────────────────
console.log('--- PRESERVE files (listed only, not modified) ---');
const PRESERVE_FILES = ['README.md', 'README_ko.md'];
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

// G11: Auto-discover script subdirectories from template instead of hardcoding.
const tplScriptsRoot = join(commonDir, 'scripts');
const scriptSubDirs = [''];  // root scripts/ always included
if (existsSync(tplScriptsRoot)) {
  for (const entry of readdirSync(tplScriptsRoot)) {
    const fullPath = join(tplScriptsRoot, entry);
    if (statSync(fullPath).isDirectory() && !entry.startsWith('.') && entry !== 'node_modules' && entry !== 'temp') {
      scriptSubDirs.push(entry);
    }
  }
}

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
      if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      // G05: Warn if project file has local modifications.
      if (existsSync(projFile) && isLocallyModified(projFile)) {
        console.log(`  ⚠️  CONFLICT ${rel}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
      } else {
        console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      }
      if (!dryRun) { copyFileSync(tplFile, projFile); reconcileScriptRegistry(rel); }
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else {
      console.log(`  OK     ${rel}  ${projVer}`);
    }
  }
}
console.log('');

// ── VARIANT SCRIPTS SYNC: scripts/<variant>/ ─────────────────────────────────
// Variant-specific scripts (scripts/<variant>/) are not part of the L1 common
// registry; sync them from templates/<variant>/scripts/<variant>/ so template
// improvements (e.g. handbook validation scripts) reach the project. Version-
// based where an @version header exists (line or JSDoc style); hash-based for
// unversioned files (template is canonical). Project-only files are preserved.
const variantScriptsSrc = join(templatesDir, 'scripts', variant);
if (existsSync(variantScriptsSrc)) {
  console.log(`--- VARIANT SCRIPTS: scripts/${variant}/ ---`);
  const variantScriptsDst = join(projectDir, 'scripts', variant);
  const seenVariantScripts = new Set<string>();
  const syncVariantScripts = (dir: string, rel: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp') continue;
      const abs = join(dir, entry.name);
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        syncVariantScripts(abs, entryRel);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs'))) {
        seenVariantScripts.add(entryRel);
        const rel2 = `scripts/${variant}/${entryRel}`;
        const projFile = join(projectDir, rel2);
        const tplVer = extractScriptVersion(abs);
        if (tplVer) {
          const projVer = existsSync(projFile) ? extractScriptVersion(projFile) : '';
          if (!existsSync(projFile)) {
            console.log(`  NEW   ${rel2}  (none) → ${tplVer}`);
            if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(abs, projFile); }
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else if (semverGt(tplVer, projVer)) {
            if (isLocallyModified(projFile)) {
              console.log(`  ⚠️  CONFLICT ${rel2}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
            } else {
              console.log(`  UPDATE ${rel2}  ${projVer} → ${tplVer}`);
            }
            if (!dryRun) copyFileSync(abs, projFile);
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else {
            console.log(`  OK     ${rel2}  ${projVer}`);
          }
        } else {
          // Unversioned file — template is canonical; compare by content hash.
          if (!existsSync(projFile)) {
            console.log(`  NEW   ${rel2}  (hash)`);
            if (!dryRun) { mkdirSync(dirname(projFile), { recursive: true }); copyFileSync(abs, projFile); }
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else if (fileHash(abs) !== fileHash(projFile)) {
            if (isLocallyModified(projFile)) {
              console.log(`  ⚠️  CONFLICT ${rel2}  (unversioned, local modifications exist — template will overwrite)`);
            } else {
              console.log(`  UPDATE ${rel2}  (hash changed)`);
            }
            if (!dryRun) copyFileSync(abs, projFile);
            console.log(`  ${dryTag}COPIED: ${rel2}`);
            syncChanged++;
          } else {
            console.log(`  OK     ${rel2}  (hash match)`);
          }
        }
      }
    }
  };
  syncVariantScripts(variantScriptsSrc, '');
  // Preserve project-only variant scripts (files in the project not in the template).
  const preserveVariantScripts = (dir: string, rel: string): void => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'temp') continue;
      const abs = join(dir, entry.name);
      const entryRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        preserveVariantScripts(abs, entryRel);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.mjs')) && !seenVariantScripts.has(entryRel)) {
        console.log(`  PRESERVE (project-only): scripts/${variant}/${entryRel}`);
      }
    }
  };
  preserveVariantScripts(variantScriptsDst, '');
  // Sync the variant SCRIPTS.md registry from the template.
  const variantRegSrc = join(variantScriptsSrc, 'SCRIPTS.md');
  const variantRegDst = join(variantScriptsDst, 'SCRIPTS.md');
  if (existsSync(variantRegSrc) && (!existsSync(variantRegDst) || fileHash(variantRegSrc) !== fileHash(variantRegDst))) {
    console.log(`  UPDATE scripts/${variant}/SCRIPTS.md  (registry)`);
    if (!dryRun) copyFileSync(variantRegSrc, variantRegDst);
    console.log(`  ${dryTag}COPIED: scripts/${variant}/SCRIPTS.md`);
    syncChanged++;
  }
  console.log('');
}

// ── SYNC_IF_NEWER: agents/ ────────────────────────────────────────────────────
// Writes the template agent content over the project file, preserving the
// project's local `lifecycle:` frontmatter block (L3 governance records).
function writeAgentWithLifecycle(tplFile: string, projFile: string): void {
  if (existsSync(projFile)) {
    const merged = preserveLifecycleFrontmatter(readFileSync(tplFile, 'utf8'), readFileSync(projFile, 'utf8'));
    writeFileSync(projFile, merged);
  } else {
    copyFileSync(tplFile, projFile);
  }
}

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
      if (!dryRun) writeAgentWithLifecycle(tplFile, projFile);
      console.log(`  ${dryTag}COPIED: ${rel}`);
      syncChanged++;
    } else if (semverGt(tplVer, projVer)) {
      // G05: Warn if project file has local modifications.
      if (isLocallyModified(projFile)) {
        console.log(`  ⚠️  CONFLICT ${rel}  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
      } else {
        console.log(`  UPDATE ${rel}  ${projVer} → ${tplVer}`);
      }
      if (!dryRun) writeAgentWithLifecycle(tplFile, projFile);
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
        // G05: Warn if project file has local modifications.
        if (isLocallyModified(projSkillFile)) {
          console.log(`  ⚠️  CONFLICT skills/${skillName}/SKILL.md  ${projVer || '(none)'} → ${tplVer}  (local modifications exist)`);
        } else {
          console.log(`  UPDATE skills/${skillName}/SKILL.md  ${projVer || '(none)'} → ${tplVer}`);
        }
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

// ── VARIANT SKILLS SYNC: skills/<variant>/ ───────────────────────────────────
// Variant-specific skills (skills/<variant>/) are not in the L1 common pool;
// mirror them from templates/<variant>/skills/<name>/ so skill improvements
// (e.g. handbook skill content) reach the project. Version/hash-based on the
// SKILL.md frontmatter; the whole skill directory is mirrored on update.
const variantSkillsSrc = join(templatesDir, 'skills');
if (existsSync(variantSkillsSrc)) {
  console.log(`--- VARIANT SKILLS: skills/${variant}/ ---`);
  for (const skillName of readdirSync(variantSkillsSrc)) {
    const tplSkillFile = join(variantSkillsSrc, skillName, 'SKILL.md');
    if (!existsSync(tplSkillFile)) continue;
    const tplSkillDir = join(variantSkillsSrc, skillName);
    const projSkillDir = join(projectDir, 'skills', skillName);
    const projSkillFile = join(projSkillDir, 'SKILL.md');
    const tplVer = extractFrontmatterVersion(tplSkillFile);
    const projVer = existsSync(projSkillFile) ? extractFrontmatterVersion(projSkillFile) : '';
    const copySkillDir = (): void => {
      mkdirSync(projSkillDir, { recursive: true });
      for (const entry of readdirSync(tplSkillDir, { withFileTypes: true })) {
        const src = join(tplSkillDir, entry.name);
        const dst = join(projSkillDir, entry.name);
        if (entry.isDirectory()) {
          mkdirSync(dst, { recursive: true });
          for (const sub of readdirSync(src, { withFileTypes: true })) {
            const subSrc = join(src, sub.name);
            const subDst = join(dst, sub.name);
            if (sub.isFile()) copyFileSync(subSrc, subDst);
          }
        } else if (entry.isFile()) {
          copyFileSync(src, dst);
        }
      }
    };
    if (tplVer) {
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (none) → ${tplVer}`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else if (semverGt(tplVer, projVer)) {
        if (isLocallyModified(projSkillFile)) {
          console.log(`  ⚠️  CONFLICT skills/${skillName}/SKILL.md  ${projVer} → ${tplVer}  (local modifications exist — template will overwrite)`);
        } else {
          console.log(`  UPDATE skills/${skillName}/SKILL.md  ${projVer} → ${tplVer}`);
        }
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else {
        console.log(`  OK     skills/${skillName}/SKILL.md  ${projVer}`);
      }
    } else {
      const tplHash = fileHash(tplSkillFile);
      const projHash = existsSync(projSkillFile) ? fileHash(projSkillFile) : '';
      if (!existsSync(projSkillFile)) {
        console.log(`  NEW   skills/${skillName}/SKILL.md  (hash)`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else if (tplHash !== projHash) {
        console.log(`  UPDATE skills/${skillName}/SKILL.md  (content changed)`);
        if (!dryRun) copySkillDir();
        console.log(`  ${dryTag}COPIED: skills/${skillName}/`);
        syncChanged++;
      } else {
        console.log(`  OK     skills/${skillName}/SKILL.md  (hash match)`);
      }
    }
  }
  console.log('');
}

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

// ── G10: --prune-removed (files in project but absent from template) ─────────────
let prunedCount = 0;
if (pruneRemoved) {
  console.log('--- PRUNE REMOVED: files present in project but absent from template ---');
  // Check scripts/
  const pruneCategories = [
    { projDir: join(projectDir, 'scripts'), tplDirs: [join(commonDir, 'scripts')], ext: '.ts', label: 'scripts/' },
    { projDir: join(projectDir, 'agents'), tplDirs: [join(templatesDir, 'agents'), join(commonDir, 'agents')], ext: '.md', label: 'agents/', skipFiles: ['README.md', 'README_ko.md', '_COMMON.md'] },
    { projDir: join(projectDir, 'skills'), tplDirs: [join(commonDir, 'skills')], ext: '/SKILL.md', label: 'skills/', isSkill: true },
  ];
  for (const cat of pruneCategories) {
    if (!existsSync(cat.projDir)) continue;
    // Collect all template file basenames
    const tplBasenames = new Set<string>();
    for (const td of cat.tplDirs) {
      if (!existsSync(td)) continue;
      if (cat.isSkill) {
        for (const d of readdirSync(td)) {
          if (existsSync(join(td, d, 'SKILL.md'))) tplBasenames.add(d);
        }
      } else {
        for (const f of readdirSync(td)) {
          if (f.endsWith(cat.ext)) tplBasenames.add(f);
        }
      }
    }
    // Walk project dir recursively (for scripts/) or shallowly
    if (cat.isSkill) {
      for (const d of readdirSync(cat.projDir)) {
        if (!tplBasenames.has(d) && existsSync(join(cat.projDir, d, 'SKILL.md'))) {
          console.log(`  PRUNE  ${cat.label}${d}/`);
          if (!dryRun) {
            spawnSync('git', ['-C', projectDir, 'rm', '-rf', `${cat.label}${d}`], { encoding: 'utf8' });
          }
          prunedCount++;
        }
      }
    } else {
      for (const f of readdirSync(cat.projDir)) {
        if (f.endsWith(cat.ext) && !tplBasenames.has(f) && !(cat.skipFiles || []).includes(f)) {
          console.log(`  PRUNE  ${cat.label}${f}`);
          if (!dryRun) {
            spawnSync('git', ['-C', projectDir, 'rm', '-f', `${cat.label}${f}`], { encoding: 'utf8' });
          }
          prunedCount++;
        }
      }
    }
  }
  if (prunedCount === 0) console.log('  (no stale files found)');
  console.log('');
}

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

// ── Post-upgrade: sync-skills.ts for platform skill distribution ──────────────
const syncSkillsScript = join(projectDir, 'scripts', 'sync-skills.ts');
if (syncChanged > 0 && existsSync(syncSkillsScript)) {
  console.log('--- Post-upgrade: Running sync-skills.ts for platform skill distribution ---');
  if (!dryRun) {
    const syncResult = spawnSync('bun', ['scripts/sync-skills.ts'], { cwd: projectDir, encoding: 'utf8', timeout: 30000 });
    if (syncResult.status === 0) {
      console.log('  ✅ sync-skills.ts completed successfully');
    } else {
      console.log(`  ⚠️  sync-skills.ts exited with status ${syncResult.status}`);
      if (syncResult.stderr) console.log(`  STDERR: ${syncResult.stderr.trim()}`);
    }
  } else {
    console.log('  [DRY RUN] Would run: bun scripts/sync-skills.ts');
  }
  console.log('');
}

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('========================================================');
console.log('  Upgrade Complete');
console.log(`  Locked files updated : ${lockedChanged}`);
console.log(`  Merge files processed: ${mergeChanged}`);
console.log(`  Sync files updated   : ${syncChanged}`);
console.log(`  Preserve files listed: ${preserveListed}`);
if (pruneRemoved) console.log(`  Files pruned         : ${prunedCount}`);
console.log(`  Security checks      : ${securityPass ? 'PASSED' : 'FAILED (see above)'}`);
if (dryRun) console.log('\n  [DRY RUN] No files were modified.');
