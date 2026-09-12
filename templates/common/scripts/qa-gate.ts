#!/usr/bin/env bun
// qa-gate.ts - QA Gate Automation - Phase 6
// Run by Consistency Auditor to verify workspace standards

/** @version 1.3.0 */
// v1.3.0 (2026-09-12, T-20260912-021): Step 4 L0↔L1 parity deepened — was
//   top-level .ts only, intersection-only (a file deleted on one side was never
//   flagged), skills compared on SKILL.md only. Now: (a) recursive content
//   comparison of scripts/ vs templates/common/scripts/ (catches lib/, helpers/,
//   hooks/ and nested drift), (b) one-sided file detection scoped to the
//   propagation-map mirror contract (top-level .ts + helpers/ + hooks/ + lib/
//   .ts + propagation-map.json — L0 files flagged via the SCRIPTS.md layer
//   registry, L1-only .ts flagged as orphans), (c) full-directory comparison of
//   skills the layer contract includes at L1 (frontmatter scope; workspace- and
//   variant-scoped skills legitimately have no L1 mirror). Outside the mirrored
//   subtrees the two trees legitimately differ (L0-only governance scripts,
//   L1-authored handbook suite), so they are content-compared only when present
//   in both trees.

import { $ } from 'bun';
import { createHash } from 'node:crypto';
import { normalizeLineEndings } from './lib/encoding-utils.ts';

// Re-export for downstream consumers (e.g. unit tests)
export { normalizeLineEndings };

const CYAN   = '\x1b[36m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN  = '\x1b[32m';
const RESET  = '\x1b[0m';

/** Replaces CONSTITUTION.md references with context.md so template transforms don't register as content drift. */
export function scrubConstitutionRefs(content: string): string {
  return content.replace(/CONSTITUTION\.md/g, 'context.md');
}

/** SHA256 of CRLF-normalized, constitution-scrubbed content — used to compare L0/L1 file pairs without false positives from line-ending or template transform differences (M5). */
export function sha256Normalized(content: string): string {
  return createHash('sha256').update(scrubConstitutionRefs(normalizeLineEndings(content))).digest('hex');
}

/**
 * Recursively lists files under `dir` as forward-slash relative paths.
 * Directories are walked; symlinks to directories are NOT followed (lstat
 * guard, same rationale as sync-skills.ts dirsEqual). Exported for unit tests.
 */
export function walkFiles(dir: string, baseDir: string = dir): string[] {
  const fsMod = require('node:fs') as typeof import('node:fs');
  const pathMod = require('node:path') as typeof import('node:path');
  const out: string[] = [];
  if (!fsMod.existsSync(dir)) return out;
  // Structural entry type (fsMod is a runtime value, not a type namespace).
  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }>;
  try {
    entries = fsMod.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = pathMod.join(dir, entry.name);
    const rel = pathMod.relative(baseDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (entry.isSymbolicLink()) continue; // never follow dir symlinks
      out.push(...walkFiles(full, baseDir));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

/**
 * Whether a scripts/-tree relative path participates in the L0→L1 mirror
 * contract — the union of propagation-map.json's script domains (scripts:
 * top-level *.ts; scripts-helpers / scripts-hooks / scripts-lib: *.ts inside
 * those subtrees; propagation-map: propagation-map.json itself). Outside these
 * paths the two trees legitimately differ (L0-only governance scripts,
 * L1-authored handbook suite), so one-sided files there are not drift.
 * Exported for unit tests.
 */
export function isMirroredScriptPath(relPath: string): boolean {
  if (relPath === 'propagation-map.json') return true;
  const hasDir = relPath.includes('/');
  const top = hasDir ? relPath.split('/')[0] : null;
  if (hasDir && !(top === 'helpers' || top === 'hooks' || top === 'lib')) return false;
  return relPath.endsWith('.ts');
}

/**
 * SCRIPTS.md layer lookup — mirrored-subtree contract for qa-gate Step 4.
 *
 * The SSOT engine is scripts/helpers/layer-filter.ts, which is deliberately NOT
 * imported here: it is registered layer-L0 (workspace-only) in SCRIPTS.md, while
 * this file is mirrored to L1 (templates/common/scripts/qa-gate.ts) — importing
 * it would dangle in the L1 mirror (the exact failure mode validate-templates
 * hit with its old propagate-to-templates import). Keep the parsing semantics in
 * sync with layer-filter.ts: normalizeLayer (L0/L0-only -> L0, common/L0+L1 ->
 * L0+L1), column indices resolved from the header row, unknown values default
 * to L0+L1 (mirrored — fail-safe).
 */
export type ScriptLayer = 'L0' | 'L0+L1';

export function parseScriptLayersFromRegistry(scriptsMdPath: string): Map<string, ScriptLayer> {
  const fsMod = require('node:fs') as typeof import('node:fs');
  const layers = new Map<string, ScriptLayer>();
  let content: string;
  try {
    content = fsMod.readFileSync(scriptsMdPath, 'utf-8');
  } catch {
    return layers; // no registry — getScriptLayer defaults everything to L0+L1
  }
  let inRegistry = false;
  let headerParsed = false;
  let scriptCol = -1;
  let layerCol = -1;
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (/^## Registry/.test(line)) { inRegistry = true; continue; }
    if (inRegistry && /^## /.test(line)) break;
    if (!inRegistry || !line.startsWith('|')) continue;
    if (!headerParsed) {
      const cols = line.split('|').map(c => c.trim().toLowerCase());
      scriptCol = cols.findIndex(c => c === 'script');
      layerCol = cols.findIndex(c => c === 'layer');
      if (scriptCol >= 0 && layerCol >= 0) headerParsed = true;
      continue;
    }
    if (/^\|[-\s|]+\|$/.test(line)) continue; // separator row
    const cols = line.split('|').map(c => c.trim());
    const scriptCell = cols[scriptCol] ?? '';
    if (!scriptCell) continue;
    const name = scriptCell.replace(/`/g, '').trim();
    const rawLayer = (cols[layerCol] ?? '').trim();
    const layer: ScriptLayer = (rawLayer === 'L0-only' || rawLayer === 'L0') ? 'L0' : 'L0+L1';
    layers.set(name, layer);
  }
  return layers;
}

/** Layer for a script path: exact registry key, then basename fallback, then default L0+L1 (mirrored — same fallback as layer-filter.ts getScriptLayer). */
export function getScriptLayer(layers: Map<string, ScriptLayer>, relPath: string): ScriptLayer {
  const pathMod = require('node:path') as typeof import('node:path');
  if (layers.has(relPath)) return layers.get(relPath)!;
  const base = pathMod.basename(relPath);
  for (const [key, val] of layers) {
    if (pathMod.basename(key) === base) return val;
  }
  return 'L0+L1';
}

/**
 * Skill layer from SKILL.md frontmatter, mirroring layer-filter.ts
 * parseSkillLayers semantics: `scope: workspace` -> L0 (no L1 mirror),
 * `scope: common` or unspecified -> L0+L1 (mirrored), any other scope value
 * (e.g. `scope: co-consult`) -> variant-scoped L0+L2 (no L1 mirror);
 * `l2_propagate: false` forces L0.
 */
export function skillLayerFromFrontmatter(skillMdContent: string): ScriptLayer | 'L0+L2' {
  const fm = skillMdContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  let layer: ScriptLayer | 'L0+L2' = 'L0+L1'; // default: mirrored
  if (fm) {
    for (const line of fm[1].split(/\r?\n/)) {
      const scope = line.match(/^\s*scope\s*:\s*(.+)$/);
      if (scope) {
        const val = scope[1].trim().toLowerCase();
        if (val === 'workspace') layer = 'L0';
        else if (val === 'common') layer = 'L0+L1';
        else layer = 'L0+L2';
      }
      if (/^\s*l2_propagate\s*:\s*false\b/.test(line)) layer = 'L0';
    }
  }
  return layer;
}

/**
 * Step 4 core — L0↔L1 mirror parity (T-20260912-021). Returns failure message
 * strings (plain text, no color codes); an empty array means parity. Reads the
 * filesystem, never exits — the caller decides how to report. Exported so the
 * detection logic is unit-testable without mutating the real trees.
 *
 * (a) scripts/ vs templates/common/scripts/ — RECURSIVE content comparison for
 *     files present in both trees (the old check walked top-level .ts only, so
 *     drift in lib/, helpers/, hooks/ or any nested file was invisible), plus
 *     one-sided detection scoped to the propagation-map.json mirror contract
 *     (see isMirroredScriptPath): L0-side files flagged when the SCRIPTS.md
 *     registry layer says L0+L1 (unregistered defaults to mirrored — fail-safe,
 *     matching propagate-to-templates' includeScriptInL1); L1-side .ts flagged
 *     as orphans. SCRIPTS.md itself is excluded from content comparison — it is
 *     intentionally a per-layer subset (same precedent as validate-templates.ts
 *     checkL0L1ScriptParity). Outside the mirrored subtrees the two trees
 *     legitimately differ (L0-only governance scripts; L1-authored handbook
 *     suite), so absence there is not drift.
 * (b) skills/ vs templates/common/skills/ — FULL directory comparison (the old
 *     check compared SKILL.md only, blind to a skill's references/scripts/assets
 *     subfiles), scoped to skills whose SKILL.md frontmatter includes them at L1
 *     (see skillLayerFromFrontmatter). L1-authored skills with no L0 counterpart
 *     (handbook, i18n-*, k-*, ...) are NOT flagged: L1 is an SSOT in its own
 *     right for those.
 */
export function collectMirrorParityFailures(
  l0Scripts: string,
  l1Scripts: string,
  l0Skills: string,
  l1Skills: string,
): string[] {
  const fsMod = require('node:fs') as typeof import('node:fs');
  const pathMod = require('node:path') as typeof import('node:path');
  const failures: string[] = [];

  if (fsMod.existsSync(l0Scripts) && fsMod.existsSync(l1Scripts)) {
    const l0Rel = new Set(walkFiles(l0Scripts));
    const l1Rel = new Set(walkFiles(l1Scripts));
    const layers = parseScriptLayersFromRegistry(pathMod.join(l0Scripts, 'SCRIPTS.md'));

    // (a1) Files present in BOTH trees: normalized content hash (CRLF +
    // CONSTITUTION-scrub tolerant).
    for (const rel of [...l0Rel].filter(r => l1Rel.has(r)).sort()) {
      if (rel === 'SCRIPTS.md') continue;
      const h0 = sha256Normalized(fsMod.readFileSync(pathMod.join(l0Scripts, rel), 'utf-8'));
      const h1 = sha256Normalized(fsMod.readFileSync(pathMod.join(l1Scripts, rel), 'utf-8'));
      if (h0 !== h1) {
        failures.push(`scripts/${rel} differs from templates/common/scripts/${rel}. Lifecycle Manager deployment not run!`);
      }
    }

    // (a2) One-sided files inside the mirror contract.
    for (const rel of [...l0Rel].filter(r => !l1Rel.has(r)).sort()) {
      if (!isMirroredScriptPath(rel)) continue;
      if (getScriptLayer(layers, rel) !== 'L0+L1') continue; // registered L0-only
      failures.push(`scripts/${rel} is missing from templates/common/scripts/ (registry layer L0+L1). Lifecycle Manager deployment not run!`);
    }
    for (const rel of [...l1Rel].filter(r => !l0Rel.has(r)).sort()) {
      if (!isMirroredScriptPath(rel)) continue;
      // Fix hint intentionally names no L0-only script: this file is mirrored to
      // L1, where a mention of an L0-only tool would trip lifecycle-sync-audit
      // Check X (L0-only references in generated projects).
      failures.push(`templates/common/scripts/${rel} is an orphan — no scripts/${rel} at L0. Fix: remove it in the L0→L1 propagation pipeline (mirror prune step).`);
    }
  }

  if (fsMod.existsSync(l0Skills) && fsMod.existsSync(l1Skills)) {
    const skillDirs = fsMod.readdirSync(l0Skills, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name !== '_archive' && e.name !== 'local' && e.name !== 'external' && !e.name.startsWith('_'))
      .map(e => e.name);
    for (const skill of skillDirs) {
      const skillMdPath = pathMod.join(l0Skills, skill, 'SKILL.md');
      if (!fsMod.existsSync(skillMdPath)) continue; // not a skill dir
      if (skillLayerFromFrontmatter(fsMod.readFileSync(skillMdPath, 'utf-8')) !== 'L0+L1') continue;

      const l0Dir = pathMod.join(l0Skills, skill);
      const l1Dir = pathMod.join(l1Skills, skill);
      if (!fsMod.existsSync(l1Dir)) {
        failures.push(`Skill ${skill} is missing from templates/common/skills/. Lifecycle Manager deployment not run!`);
        continue;
      }
      const l0Files = new Set(walkFiles(l0Dir));
      const l1Files = new Set(walkFiles(l1Dir));
      for (const rel of [...l0Files].filter(f => !l1Files.has(f)).sort()) {
        failures.push(`skills/${skill}/${rel} is missing from templates/common/skills/${skill}/. Lifecycle Manager deployment not run!`);
      }
      for (const rel of [...l1Files].filter(f => !l0Files.has(f)).sort()) {
        failures.push(`templates/common/skills/${skill}/${rel} is an orphan — not in skills/${skill}/. Lifecycle Manager deployment not run!`);
      }
      for (const rel of [...l0Files].filter(f => l1Files.has(f)).sort()) {
        const h0 = sha256Normalized(fsMod.readFileSync(pathMod.join(l0Dir, rel), 'utf-8'));
        const h1 = sha256Normalized(fsMod.readFileSync(pathMod.join(l1Dir, rel), 'utf-8'));
        if (h0 !== h1) {
          failures.push(`Skill ${skill} file ${rel} differs from templates/common/skills/${skill}/${rel}. Lifecycle Manager deployment not run!`);
        }
      }
    }
  }

  return failures;
}

async function runQaGate(): Promise<void> {
  console.log(`${CYAN}🔬 QA Gate - Phase 6${RESET}`);
  console.log('=====================');

  // 1. Workspace audit
  console.log('Step 1: Workspace standards audit...');
  const auditRes = await $`bun scripts/audit.ts`.nothrow();

  if (auditRes.exitCode !== 0) {
    console.log(`${RED}❌ FAIL: audit.ts failed${RESET}`);
    process.exit(1);
  }

  // 2. Project-specific tests (if package.json exists)
  const pkgFile = Bun.file('package.json');
  if (await pkgFile.exists()) {
    console.log('Step 2: Running project tests...');
    const pkg = await pkgFile.json();
    if (pkg.scripts && 'test' in pkg.scripts) {
      const testRes = await $`bun run test`.nothrow();
      if (testRes.exitCode !== 0) {
        console.log(`${RED}❌ FAIL: Tests failed${RESET}`);
        process.exit(1);
      }
    } else {
      console.log(`${YELLOW}⚠️  SKIP: No test script found in package.json${RESET}`);
    }
  }

  // 3. Documentation consistency checks
  console.log('Step 3: Checking documentation consistency...');

  // Check AGENTS.md exists
  if (!(await Bun.file('AGENTS.md').exists())) {
    console.log(`${RED}❌ FAIL: AGENTS.md not found${RESET}`);
    process.exit(1);
  }

  // Check README.md has Korean pair (for templates only)
  const hasTemplateReadme = await Bun.file('templates/README.md').exists();
  const hasTemplateReadmeKo = await Bun.file('templates/README_ko.md').exists();
  if (hasTemplateReadme && !hasTemplateReadmeKo) {
    console.log(`${RED}❌ FAIL: templates/README.md exists but templates/README_ko.md missing${RESET}`);
    process.exit(1);
  }

  // 4. Verify Lifecycle Manager deployment (L0↔L1 mirror parity)
  console.log('Step 4: Verifying L0↔L1 mirror parity (scripts trees + skill dirs, recursive)...');

  const fs = await import('node:fs');
  const path = await import('node:path');

  const l0Scripts = 'scripts';
  const l1Scripts = path.join('templates', 'common', 'scripts');
  const l0Skills = 'skills';
  const l1Skills = path.join('templates', 'common', 'skills');

  const parityFailures = collectMirrorParityFailures(l0Scripts, l1Scripts, l0Skills, l1Skills);
  for (const failure of parityFailures) {
    console.log(`${RED}❌ FAIL: ${failure}${RESET}`);
  }
  if (parityFailures.length > 0) {
    process.exit(1);
  }

  // 5. Validate variant.json schema
  console.log('Step 5: Validating variant.json schema...');
  const templatesDir = 'templates';
  if (fs.existsSync(templatesDir)) {
    const variants = fs.readdirSync(templatesDir).filter(f => fs.statSync(path.join(templatesDir, f)).isDirectory() && f.startsWith('co-'));
    for (const variant of variants) {
      const variantJsonPath = path.join(templatesDir, variant, 'variant.json');
      if (fs.existsSync(variantJsonPath)) {
        try {
          const variantJson = JSON.parse(fs.readFileSync(variantJsonPath, 'utf-8'));
          const skillExt = variantJson.skill_manifest?.external;
          if (skillExt && !Array.isArray(skillExt)) {
             console.log(`${RED}❌ FAIL: ${variant}/variant.json skill_manifest.external is not an array${RESET}`);
             process.exit(1);
          }
          const scriptExt = variantJson.script_manifest?.external;
          if (scriptExt && !Array.isArray(scriptExt)) {
             console.log(`${RED}❌ FAIL: ${variant}/variant.json script_manifest.external is not an array${RESET}`);
             process.exit(1);
          }
        } catch (e) {
          console.log(`${RED}❌ FAIL: Could not parse ${variantJsonPath}: ${e}${RESET}`);
          process.exit(1);
        }
      }
    }
  }

  console.log(`${GREEN}✔ QA PASS${RESET}`);
  console.log('==========');
  process.exit(0);
}

if (import.meta.main) {
  await runQaGate();
}
