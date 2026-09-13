#!/usr/bin/env bun
/**
 * Lifecycle Sync Audit Script
 *
 * Detects version drift between lifecycle management artifacts.
 * Check A: scripts/*.ts @version comment vs scripts/SCRIPTS.md registry version
 * Check B: scripts/SCRIPTS.md vs templates/common/scripts/SCRIPTS.md version entries
 * Check C: skills/<name>/SKILL.md vs templates/common/skills/<name>/SKILL.md content
 *          (normalized through the shared scrub so only REAL drift reports)
 * Check E: docs/lifecycle/skills/<name>.md Version/Owner vs SKILL.md frontmatter
 *
 * Usage:
 *   bun scripts/lifecycle-sync-audit.ts
 *   bun scripts/lifecycle-sync-audit.ts --json
 *   bun scripts/lifecycle-sync-audit.ts --fix
 *
 * @version 1.9.0
 * @last_updated 2026-09-12
 * v1.9.0: Check D now parses intentional-duplicate markers through the shared
 *          parser (helpers/markers.ts parseIntentionalDuplicateLine — complete
 *          one-line comment + workspace standards §<digits> grammar,
 *          T-20260912-029) instead of a looser inline regex, so prose that
 *          merely MENTIONS the marker syntax no longer pollutes the
 *          informational registry (4 phantom entries → the 2 real markers).
 *          Registry mapping: source = parsed source (fallback: parsed name),
 *          reason = parsed reason (fallback: parsed name). Workspace-wide
 *          walk, all exclusions, and the informational severity are unchanged.
 * v1.8.0: Check C now normalizes L0 skill content through the shared scrub
 *          (scripts/lib/constitution-scrub.ts — the exact transform propagate
 *          applies to templates/ targets) before comparing, so the intentional
 *          CONSTITUTION.md→context.md substitution (§7.5 Non-Propagation) no
 *          longer reports as permanent drift for skills/sync, gateguard, and
 *          translate — and the old fix hint ("run propagate:apply") can no longer
 *          recommend clobbering that intentional state. Remaining real content
 *          drift is upgraded from warning to FAILURE. New Check E: a lifecycle
 *          record's Version/Owner (docs/lifecycle/skills/<name>.md) that
 *          disagrees with its skill's SKILL.md frontmatter is a FAILURE, not a
 *          warning (T-20260912-010). The Check C summary line is informational
 *          output now, not a warning entry. CLI dispatch wrapped in
 *          import.meta.main so the checks are importable for tests.
 * v1.7.1: Added 'audit:check-upgrade-coverage' to INTENTIONAL_CROSS_REFS — the upgrade coverage
 *          gate (ADR-0073) is existsSync-guarded; the checker is L0-only (ADR-0073 Amendment 1
 *          retired the inert per-project copies of the upgrade trio).
 * v1.7.0: Fixed Check X's collectTsFiles() recursing into each subdirectory twice
 *          (one depth+1 call plus one depth-0 call), producing duplicate file scans
 *          and duplicate Check X issues; now a single correct recursion.
 * v1.6.1: Symlink-safe, depth-bounded directory walkers (T-20260910-026).
 * v1.6.0: Added 'dev-sync:skill-dependency-analysis' to INTENTIONAL_CROSS_REFS —
 *          dev-sync.ts step 3.96c (session-evidence skill review, SkillHone-inspired
 *          loop) runs skill-session-review.ts, promoted to L0+L1 (ADR-0067), and the
 *          full health-report sub-step calls the L0-only analyzer behind an
 *          existsSync guard (design doc: docs/designs/2026-09-06-skill-session-review-design.md).
 * v1.5.0: Added 'audit:upgrade-project' to INTENTIONAL_CROSS_REFS — audit.ts's new
 *          checkProjectDocMarkerDrift() mentions upgrade-project.ts in a WARN hint, guarded by
 *          existsSync('Projects') (same shape as the other existsSync-guarded L0-only refs).
 * @license MIT
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, type Dirent } from 'node:fs';
import { join, basename } from 'node:path';
import { cwd } from 'node:process';
import { createHash } from 'node:crypto';
import { load as loadYaml } from 'js-yaml';
import { scrubConstitutionRefs } from './lib/constitution-scrub.ts';
import { parseIntentionalDuplicateLine } from './helpers/markers.ts';

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

interface SyncIssue {
  level: 'error' | 'warning';
  file: string;
  message: string;
  fix?: string;
  // For --fix mode: structured data to perform the fix
  fixData?: {
    scriptName: string;
    fileVersion: string;
    registryVersion: string;
  };
}

interface DuplicateEntry {
  file: string;
  source: string;
  reason: string;
}

interface AuditResult {
  checksRun: number;
  errors: SyncIssue[];
  warnings: SyncIssue[];
  registry: DuplicateEntry[];
  passed: boolean;
}

const ROOT = cwd();
const SCRIPTS_MD = join(ROOT, 'scripts', 'SCRIPTS.md');
const TEMPLATE_SCRIPTS_MD = join(ROOT, 'templates', 'common', 'scripts', 'SCRIPTS.md');

// Detect workspace root by presence of CONSTITUTION.md
const IS_WORKSPACE_ROOT = existsSync(join(ROOT, 'CONSTITUTION.md'));

interface RegistryEntry {
  version: string;
  /** Deployment layer: 'common' (both L0 + L1), 'L0-only' (workspace root only), 'L1-only' (generated projects only). Defaults to 'common' when column is absent. */
  layer: 'common' | 'L0-only' | 'L1-only';
}

/**
 * Parse the Registry table from a SCRIPTS.md file.
 * Returns a map of { filename -> RegistryEntry }.
 * The table may optionally have a `layer` column (common / L0-only / L1-only).
 * Only includes rows with status 'active' or 'experimental' when activeOnly=true.
 */
function parseScriptsMdRegistry(
  filePath: string,
  activeOnly = false,
): Map<string, RegistryEntry> {
  const result = new Map<string, RegistryEntry>();

  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, 'utf-8');

  // Extract section between ## Registry and the next ## header
  const registryMatch = content.match(/## Registry\r?\n([\s\S]*?)(?:\r?\n## |\s*$)/);
  if (!registryMatch) return result;

  const section = registryMatch[1];
  const lines = section.split('\n');

  // Detect column positions from the header row
  // Expected columns (may vary): script | source | version | status  [| layer]
  // OR:                          script | source | version | layer | status
  let versionColIdx = 3;
  let statusColIdx = 4;
  let layerColIdx = -1; // -1 = column absent; defaults to 'common'

  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map((c) => c.trim());
    if (cols[1] === 'script') {
      // Header row — detect column indices
      for (let i = 1; i < cols.length; i++) {
        const h = cols[i].toLowerCase();
        if (h === 'version') versionColIdx = i;
        else if (h === 'status') statusColIdx = i;
        else if (h === 'layer') layerColIdx = i;
      }
      break;
    }
  }

  for (const line of lines) {
    // Data rows start with | and have a backtick-wrapped filename in column 1
    if (!line.startsWith('|')) continue;

    const cols = line.split('|').map((c) => c.trim());
    if (cols.length < 5) continue;

    const rawName = cols[1];
    const version = cols[versionColIdx] ?? '';
    const status = cols[statusColIdx] ?? '';

    // Skip header/separator rows
    if (rawName === 'script' || rawName.startsWith('-')) continue;
    if (!rawName.startsWith('`')) continue;

    const filename = rawName.replace(/`/g, '').trim();
    if (!filename) continue;

    // For Check A we only care about active/experimental
    if (activeOnly && status !== 'active' && status !== 'experimental') continue;

    const rawLayer = layerColIdx >= 0 ? (cols[layerColIdx] ?? '') : '';
    let layer: RegistryEntry['layer'] = 'common';
    if (rawLayer === 'L0-only' || rawLayer === 'L0') layer = 'L0-only';
    else if (rawLayer === 'L1-only') layer = 'L1-only';

    result.set(filename, { version, layer });
  }

  return result;
}

/**
 * Extract @version X.Y.Z from a TypeScript file's JSDoc block.
 * Returns null if not found.
 */
function extractFileVersion(filePath: string): string | null {
  if (!existsSync(filePath)) return null;

  try {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/@version\s+([\d.]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Check A: Compare @version in each active/experimental .ts file
 * against the version listed in scripts/SCRIPTS.md.
 * NOTE: Check A verifies formal consistency only (@version header == SCRIPTS.md entry).
 * Semantic content alignment (file content matches version history) is NOT verified.
 */
function runCheckA(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!existsSync(SCRIPTS_MD)) {
    issues.push({
      level: 'error',
      file: 'scripts/SCRIPTS.md',
      message: 'scripts/SCRIPTS.md not found — cannot run Check A',
    });
    return issues;
  }

  const registry = parseScriptsMdRegistry(SCRIPTS_MD, true);

  for (const [filename, { version: registryVersion }] of registry) {
    // Only check .ts files (not .sh/.ps1)
    if (!filename.endsWith('.ts')) continue;

    const scriptPath = join(ROOT, 'scripts', filename);

    // Skip if file doesn't exist on disk (may be template-only)
    if (!existsSync(scriptPath)) continue;

    const fileVersion = extractFileVersion(scriptPath);

    // WARN: @version missing — SCRIPTS.md version cannot be validated against file
    if (fileVersion === null) {
      if (!jsonMode) console.log(`\x1b[33m[WARN]\x1b[0m ${filename}: @version header missing — SCRIPTS.md version cannot be validated (add @version JSDoc to enable Check A)`);
      issues.push({
        level: 'warning',
        file: `scripts/${filename}`,
        message: `Check A: @version header missing in ${filename} — SCRIPTS.md version unvalidatable (add @version to enable Check A)`,
      });
      continue;
    }

    if (fileVersion !== registryVersion) {
      issues.push({
        level: 'error',
        file: `scripts/${filename}`,
        message: `Check A: scripts/${filename} @version ${fileVersion} does not match SCRIPTS.md entry ${registryVersion}`,
        fix: `Update scripts/SCRIPTS.md version for ${filename} from ${registryVersion} to ${fileVersion}`,
        fixData: {
          scriptName: filename,
          fileVersion,
          registryVersion,
        },
      });
    }
  }

  return issues;
}

/**
 * Extract {version, owner} from a SKILL.md YAML frontmatter block.
 * Returns {} when there is no parseable frontmatter.
 */
export function parseSkillFrontmatter(content: string): { version?: string; owner?: string } {
  const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!fmMatch) return {};
  try {
    const doc = loadYaml(fmMatch[1]) as Record<string, unknown> | null;
    if (!doc || typeof doc !== 'object') return {};
    return {
      version: doc.version !== undefined ? String(doc.version).trim() : undefined,
      owner: doc.owner !== undefined ? String(doc.owner).trim() : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Extract a `- **Field**: value` metadata value from a lifecycle record.
 * Returns undefined when the field is absent (a record predating the metadata
 * convention is not a mismatch — there is nothing to compare).
 */
export function extractRecordField(recordContent: string, field: string): string | undefined {
  const match = new RegExp(`^\\s*-?\\s*\\*\\*${field}\\*\\*\\s*:\\s*(.+)$`, 'm').exec(recordContent);
  if (!match) return undefined;
  const value = match[1].trim();
  return value.length > 0 ? value : undefined;
}

/**
 * Check C: Detect content drift between skills/<name>/SKILL.md (workspace root)
 * and templates/common/skills/<name>/SKILL.md.
 *
 * The L0 side is first normalized through scrubConstitutionRefs — the exact
 * transform propagate-to-templates.ts applies when copying to templates/
 * targets (§7.5 Non-Propagation: L1 copies carry context.md substitutions by
 * design). Comparing normalized L0 vs L1 means only REAL drift reports; the
 * intentional substitution no longer produces permanent warnings for
 * skills/sync, gateguard, and translate, and the fix hint can never recommend
 * clobbering that intentional state.
 *
 * Remaining drift (not explainable by the scrub) is a FAILURE — the L1 mirror
 * is propagated, not hand-maintained.
 */
export function runCheckC(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!IS_WORKSPACE_ROOT) return issues;

  const templateSkillsDir = join(ROOT, 'templates', 'common', 'skills');
  if (!existsSync(templateSkillsDir)) return issues;

  const rootSkillsDir = join(ROOT, 'skills');
  if (!existsSync(rootSkillsDir)) return issues;

  let checkedCount = 0;
  let driftCount = 0;

  const skillEntries = readdirSync(rootSkillsDir, { withFileTypes: true });
  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;

    const skillName = entry.name;
    const rootSkillFile = join(rootSkillsDir, skillName, 'SKILL.md');
    const templateSkillFile = join(templateSkillsDir, skillName, 'SKILL.md');

    if (!existsSync(rootSkillFile)) continue;
    if (!existsSync(templateSkillFile)) continue;

    checkedCount++;

    const rootContent = readFileSync(rootSkillFile, 'utf-8');
    const templateContent = readFileSync(templateSkillFile, 'utf-8');

    // Normalize L0 through the same scrub the propagator applies for this
    // source→target pair (idempotent; no-op when nothing matches).
    const normalizedRoot = scrubConstitutionRefs(rootContent, rootSkillFile, templateSkillFile);

    const rootHash = createHash('sha256').update(normalizedRoot).digest('hex');
    const templateHash = createHash('sha256').update(templateContent).digest('hex');

    if (rootHash !== templateHash) {
      driftCount++;
      issues.push({
        level: 'error',
        file: `skills/${skillName}/SKILL.md`,
        message: `Check C: skills/${skillName}/SKILL.md differs from templates/common/skills/${skillName}/SKILL.md beyond the intentional CONSTITUTION.md→context.md substitution`,
        fix: `First verify whether the L1 copy diverged intentionally; if the L0 version is canonical, re-sync it with 'bun scripts/propagate-to-templates.ts --apply --domain skills' — do not hand-edit the L1 mirror`,
      });
    }
  }

  if (!jsonMode && checkedCount > 0) {
    console.log(
      `${colors.dim}Check C: checked ${checkedCount} skill(s) for content drift${driftCount > 0 ? ` — ${driftCount} real drift(s)` : ' (normalized; no drift)'}${colors.reset}`,
    );
  }

  return issues;
}

/**
 * Check E: Lifecycle record metadata vs SKILL.md frontmatter.
 *
 * For every docs/lifecycle/skills/<name>.md record whose subject
 * skills/<name>/SKILL.md exists, a recorded Version or Owner that disagrees
 * with the SKILL.md frontmatter is a FAILURE — these records feed lifecycle
 * decisions and promotion gates, so stale metadata is not advisory.
 * Records missing a Version/Owner field are skipped (many predate the metadata
 * convention; absence is not a mismatch). Runs only at workspace root.
 */
export function runCheckE(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!IS_WORKSPACE_ROOT) return issues;

  const lifecycleDir = join(ROOT, 'docs', 'lifecycle', 'skills');
  if (!existsSync(lifecycleDir)) return issues;

  const rootSkillsDir = join(ROOT, 'skills');
  if (!existsSync(rootSkillsDir)) return issues;

  for (const entry of readdirSync(lifecycleDir)) {
    if (!entry.endsWith('.md')) continue;
    const skillName = entry.replace(/\.md$/, '');
    const skillMdPath = join(rootSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue; // record for a removed/renamed skill — not this check's concern

    const recordPath = join(lifecycleDir, entry);
    const recordContent = readFileSync(recordPath, 'utf-8');
    const frontmatter = parseSkillFrontmatter(readFileSync(skillMdPath, 'utf-8'));

    const recordVersion = extractRecordField(recordContent, 'Version');
    if (recordVersion && frontmatter.version) {
      const a = recordVersion.replace(/^v/i, '');
      const b = frontmatter.version.replace(/^v/i, '');
      if (a !== b) {
        issues.push({
          level: 'error',
          file: `docs/lifecycle/skills/${entry}`,
          message: `Check E: lifecycle record Version ${recordVersion} does not match skills/${skillName}/SKILL.md frontmatter version ${frontmatter.version}`,
          fix: `Update docs/lifecycle/skills/${entry} Version to ${frontmatter.version} (or fix the SKILL.md frontmatter if the record is correct)`,
        });
      }
    }

    const recordOwner = extractRecordField(recordContent, 'Owner');
    if (recordOwner && frontmatter.owner && recordOwner !== frontmatter.owner) {
      issues.push({
        level: 'error',
        file: `docs/lifecycle/skills/${entry}`,
        message: `Check E: lifecycle record Owner "${recordOwner}" does not match skills/${skillName}/SKILL.md frontmatter owner "${frontmatter.owner}"`,
        fix: `Update docs/lifecycle/skills/${entry} Owner to ${frontmatter.owner} (or fix the SKILL.md frontmatter if the record is correct)`,
      });
    }
  }

  return issues;
}

/**
 * Check B: Compare version entries between scripts/SCRIPTS.md and
 * templates/common/scripts/SCRIPTS.md. Uses the layer column to decide
 * whether each script should be present in templates/common/:
 *   - L0-only  → skip (intentionally absent from templates)
 *   - common / L1-only → must exist in templates/common/scripts/SCRIPTS.md
 *     AND as an actual file in templates/common/scripts/<filename>
 * Only runs at workspace root.
 */
function runCheckB(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!IS_WORKSPACE_ROOT) return issues;

  // Skip silently if template SCRIPTS.md doesn't exist
  if (!existsSync(TEMPLATE_SCRIPTS_MD)) return issues;

  const rootRegistry = parseScriptsMdRegistry(SCRIPTS_MD);
  const templateRegistry = parseScriptsMdRegistry(TEMPLATE_SCRIPTS_MD);

  for (const [filename, rootEntry] of rootRegistry) {
    const { version: rootVersion, layer } = rootEntry;

    if (layer === 'L0-only') {
      continue; // legitimate — L0-only scripts intentionally absent from templates
    }

    // layer === 'common' or 'L1-only': should exist in templates/common/
    if (!templateRegistry.has(filename)) {
      issues.push({
        level: 'error',
        file: 'scripts/SCRIPTS.md',
        message: `Check B: ${filename} (layer: ${layer}) registered in root SCRIPTS.md but missing from templates/common/scripts/SCRIPTS.md`,
        fix: `Add ${filename} entry to templates/common/scripts/SCRIPTS.md or copy the script file`,
      });
      continue;
    }

    // Also check actual file existence in templates/common/scripts/
    const templateScriptPath = join('templates', 'common', 'scripts', filename);
    if (!existsSync(join(ROOT, templateScriptPath))) {
      issues.push({
        level: 'error',
        file: templateScriptPath,
        message: `Check B: ${filename} (layer: ${layer}) registered as ${layer} but file missing from templates/common/scripts/`,
        fix: `Copy scripts/${filename} to templates/common/scripts/${filename}`,
      });
      continue;
    }

    const templateVersion = templateRegistry.get(filename)!.version;
    if (rootVersion !== templateVersion) {
      issues.push({
        level: 'error',
        file: 'scripts/SCRIPTS.md',
        message: `Check B: scripts/SCRIPTS.md version for ${filename} (${rootVersion}) differs from templates/common/scripts/SCRIPTS.md (${templateVersion})`,
        fix: `Run 'bun run propagate:apply' to sync or manually align versions`,
      });
    }
  }

  return issues;
}

/**
 * Check X: Scan templates/common/scripts/ for references to L0-only scripts.
 * If an L0-only script is called from a templates/common script, that is a
 * deployment contract violation — the L0-only script won't exist in generated projects.
 */
/**
 * Intentional cross-references: L1 scripts that reference L0-only scripts
 * in a context-guarded or string-only way (not a real deployment violation).
 * Format: 'l1-script-base:l0-script-base'
 */
const INTENTIONAL_CROSS_REFS = new Set([
  'audit:tag-template',                         // audit.ts: string mention in warning message only
  'dev-sync:propagate-to-templates',            // dev-sync.ts: called only inside isL0Context guard
  'audit:propagate-to-templates',               // audit.ts: comment reference only (replaced checkScriptSync)
  'lifecycle-sync-audit:propagate-to-templates',  // lifecycle-sync-audit.ts: string mention in Check C fix hint only (re-sync advice; the hint never runs the L0 script)
  'create-l3-scaffold:generate-version-manifest', // L0-workflow coordination; reference only in L1 copy
  'list-template-versions:tag-template',        // L0-workflow coordination; reference only in L1 copy
  'new-project:list-template-versions',         // L0-workflow coordination; reference only in L1 copy
  'pre-commit:validate-templates',              // pre-commit.ts: guarded by existsSync — skipped when L0 script absent
  'pre-commit:fix-script-versions',             // pre-commit.ts: guarded by existsSync — string in error hint only
  'verify-skills:upgrade-project',              // verify-skills.ts: warning string mention only
  'audit:spec-register',                          // audit.ts: string mention in warning message only (--spec-check mode)
  'audit:upgrade-project',                        // audit.ts: guarded by existsSync('Projects') — checkProjectDocMarkerDrift skips entirely when Projects/ is absent (gitignored, L0-dev-machine-only directory; scaffolded/L1 projects have no Projects/ to check)
  'audit:test-platform-parity',                   // audit.ts: guarded by existsSync — skipped when L0 script absent (L3/L1 projects have no templates/ to test parity on)
  'dev-sync:verify-adr-governance',               // dev-sync.ts step 3.97: guarded by existsSync — skipped when L0 validator absent (ADR-0059 Stage 2 gate; scaffolded projects have no docs/adr corpus)
  'dev-sync:generate-skill-graph',                // dev-sync.ts step 4.65: guarded by existsSync — skipped when L0 generator absent (ADR-0060 skill graph gate; scaffolded projects ship no skill graph tooling)
  'dev-sync:verify-skill-graph',                  // dev-sync.ts step 4.65: guarded by existsSync — skipped when L0 verifier absent (ADR-0060 skill graph gate; scaffolded projects ship no skill graph tooling)
  'dev-sync:sync-template-deps',                  // dev-sync.ts step 4.52: called only inside isWorkspaceRoot guard (same shape as dev-sync:propagate-to-templates; template dep mirror is L0-only tooling)
  'dev-sync:skill-dependency-analysis',           // dev-sync.ts step 3.96c: full health report pass is non-fatal + existsSync-guarded; skill-session-review.ts itself is L0+L1 (ADR-0067) so needs no entry
  'skill-session-review:skill-dependency-analysis', // skill-session-review.ts: per-skill re-analysis is existsSync-guarded (import.meta.dir sibling check) and skips in L1/L3 where the analyzer is absent (ADR-0067 §Decision 5)
  'audit:sync-template-deps',                     // audit.ts: string mention in FAIL fix hint only; checkTemplateDependencyMirror skips entirely when templates/common/package.json is absent (L1/L3)
  'upgrade-project:validate-variant-readiness',   // upgrade-project.ts: Variant Readiness Gate is existsSync-guarded — the gate runs only at a workspace root where the L0 validator exists (surfaced when the L1 copy caught up to v1.18.0)
  'audit:check-upgrade-coverage',                 // audit.ts: upgrade coverage gate (ADR-0073) is existsSync-guarded — the checker is L0-only and the gate self-skips when scripts/check-upgrade-coverage.ts is absent (L1/L3 projects)
]);

function runCheckX(): SyncIssue[] {
  const issues: SyncIssue[] = [];
  if (!IS_WORKSPACE_ROOT) return issues;
  if (!existsSync(SCRIPTS_MD)) return issues;

  const rootRegistry = parseScriptsMdRegistry(SCRIPTS_MD);

  // Collect L0-only script base names (without extension)
  const l0OnlyScripts: string[] = [];
  for (const [filename, entry] of rootRegistry) {
    if (entry.layer === 'L0-only') {
      l0OnlyScripts.push(filename.replace(/\.(ts|sh|ps1)$/, ''));
    }
  }

  if (l0OnlyScripts.length === 0) return issues;

  // Scan templates/common/scripts/ for references
  const templateScriptsDir = join(ROOT, 'templates', 'common', 'scripts');
  if (!existsSync(templateScriptsDir)) return issues;

  // Recursively collect all .ts files under templateScriptsDir (including helpers/, hooks/, lib/, etc.)
  function collectTsFiles(dir: string, depth = 0): string[] {
    const result: string[] = [];
    if (depth > 8) return result; // symlink-cycle / runaway-recursion bound (T-20260910-026)
    let entries: Dirent<string>[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return result;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // never follow links: cycle-safe, no duplicate visits (T-20260910-026)
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        result.push(...collectTsFiles(fullPath, depth + 1));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        result.push(fullPath);
      }
    }
    return result;
  }

  const tsFiles = collectTsFiles(templateScriptsDir);

  for (const file of tsFiles) {
    let content: string;
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    for (const scriptName of l0OnlyScripts) {
      // Match: bun run scripts/<name>, bun scripts/<name>, import from '.../<name>' or '.../<name>.js'
      const patterns = [
        new RegExp(`bun\\s+(?:run\\s+)?scripts\\/${scriptName}`, 'g'),
        new RegExp(`import.*from\\s+['"].*\\/${scriptName}(?:\\.js)?['"]`, 'g'),
      ];
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          const relFile = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
          const l1Base = basename(file).replace(/\.(ts|sh|ps1)$/, '');
          // Self-reference: L1 copy of the same script referencing itself is expected
          if (l1Base === scriptName) break;
          if (INTENTIONAL_CROSS_REFS.has(`${l1Base}:${scriptName}`)) break;
          issues.push({
            level: 'error',
            file: relFile,
            message: `Check X: L0-only script '${scriptName}' is referenced in ${relFile} — this script won't exist in generated projects`,
            fix: `Either promote '${scriptName}' to 'common' layer and copy to templates/common/scripts/, or remove the reference`,
          });
          break;
        }
      }
    }
  }

  return issues;
}

/**
 * Check D: Scan all .md files for intentional-duplicate annotations.
 * Informational only — never produces errors or warnings.
 *
 * Markers are parsed per line through the shared parser
 * (helpers/markers.ts parseIntentionalDuplicateLine, T-20260912-029): a line
 * registers only when it contains a COMPLETE one-line
 * `<!-- intentional-duplicate: ... -->` comment whose name carries the
 * workspace standards §<digits> grammar — prose that merely mentions the
 * marker syntax stays out of the registry. Registry mapping:
 * source = parsed `source` field (fallback: parsed `name`),
 * reason = parsed `reason` field (fallback: parsed `name`).
 */
function runCheckD(): DuplicateEntry[] {
  const entries: DuplicateEntry[] = [];
  const EXCLUDED = ['node_modules', '.git', '_archive', 'memory'];
  // Skip CONSTITUTION.md itself (contains the annotation definition/example, not a real duplicate)

  function walkDir(dir: string, depth = 0): void {
    if (depth > 8) return; // symlink-cycle / runaway-recursion bound (T-20260910-026)
    let items: Dirent<string>[];
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      if (item.name.startsWith('.') || EXCLUDED.includes(item.name)) continue;
      if (item.isSymbolicLink()) continue; // never follow links: cycle-safe, no duplicate visits (T-20260910-026)

      const fullPath = join(dir, item.name);

      if (item.isDirectory()) {
        // Skip generated project directories (have AGENTS.md or variant.json)
        if (existsSync(join(fullPath, 'AGENTS.md')) || existsSync(join(fullPath, 'variant.json'))) {
          continue;
        }
        walkDir(fullPath, depth + 1);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        // Skip CONSTITUTION.md (contains definition example, not a real duplicate)
        if (item.name === 'CONSTITUTION.md') continue;
        let content: string;
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        // Per-line shared-parser scan (lines scanned in order, so `file`
        // remains a whole-file registry of marker lines).
        for (const line of content.split('\n')) {
          const parsed = parseIntentionalDuplicateLine(line);
          if (!parsed) continue;
          entries.push({
            file: fullPath.replace(ROOT + '\\', '').replace(ROOT + '/', ''),
            source: parsed.source ?? parsed.name ?? '',
            reason: parsed.reason ?? parsed.name ?? '',
          });
        }
      }
    }
  }

  walkDir(ROOT);
  return entries;
}

/**
 * Parse a variant-level SCRIPTS.md registry.
 * Variant SCRIPTS.md format: | script | version | status | description | cli-usage |
 * Returns map of { filename -> version }.
 */
function parseVariantScriptsMd(filePath: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, 'utf-8');
  const registryMatch = content.match(/## Registry\r?\n([\s\S]*?)(?:\r?\n## |\s*$)/);
  if (!registryMatch) return result;

  const lines = registryMatch[1].split('\n');
  for (const line of lines) {
    if (!line.startsWith('|')) continue;
    const cols = line.split('|').map(c => c.trim());
    if (cols.length < 4) continue;
    const rawName = cols[1];
    if (!rawName.startsWith('`') || rawName === 'script') continue;
    const filename = rawName.replace(/`/g, '').trim();
    const version = cols[2];
    if (filename && version && version !== 'version' && !version.startsWith('-')) {
      result.set(filename, version);
    }
  }
  return result;
}

/**
 * Check V: Variant script @version consistency.
 * For each variant with script_manifest.local in variant.json,
 * validates that each script's @version comment matches the version
 * in the variant's own scripts/<variant>/SCRIPTS.md registry.
 * See ADR-0033.
 */
function runCheckV(): SyncIssue[] {
  const issues: SyncIssue[] = [];
  if (!IS_WORKSPACE_ROOT) return issues;

  const templatesDir = join(ROOT, 'templates');
  if (!existsSync(templatesDir)) return issues;

  let variantDirs: string[];
  try {
    variantDirs = readdirSync(templatesDir)
      .filter(d => d.startsWith('co-'))
      .map(d => join(templatesDir, d))
      .filter(d => statSync(d).isDirectory());
  } catch {
    return issues;
  }

  for (const variantDir of variantDirs) {
    const variantJsonPath = join(variantDir, 'variant.json');
    if (!existsSync(variantJsonPath)) continue;

    let variantJson: { script_manifest?: { local?: Array<{ name: string; path: string }> } };
    try {
      variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
    } catch {
      continue;
    }

    const localScripts = variantJson.script_manifest?.local;
    if (!localScripts || localScripts.length === 0) continue;

    const variantName = basename(variantDir); // e.g. 'co-deck'
    // variant SCRIPTS.md is at: templates/co-deck/scripts/co-deck/SCRIPTS.md
    const variantScriptsMd = join(variantDir, 'scripts', variantName, 'SCRIPTS.md');

    // Parse variant registry (different column format from L1 SCRIPTS.md)
    const variantRegistry = parseVariantScriptsMd(variantScriptsMd);

    for (const entry of localScripts) {
      const scriptFile = join(variantDir, entry.path);
      if (!existsSync(scriptFile)) continue; // B-03 already catches missing files

      const fileVersion = extractFileVersion(scriptFile);
      // Preserve subdirectory prefix for registry lookup (e.g. "handbook/check-labels.ts")
      // instead of stripping it via basename() (which yields just "check-labels.ts")
      const variantScriptsPrefix = `scripts/${variantName}/`;
      const registryKey = entry.path.startsWith(variantScriptsPrefix)
        ? entry.path.slice(variantScriptsPrefix.length)
        : basename(entry.path);
      const registryVersion = variantRegistry.get(registryKey);

      if (fileVersion === null) {
        issues.push({
          level: 'warning',
          file: `templates/${variantName}/${entry.path}`,
          message: `Check V: ${variantName}/${entry.path} — @version header missing (add @version to enable version tracking)`,
        });
        continue;
      }

      if (registryVersion === undefined) {
        issues.push({
          level: 'warning',
          file: variantScriptsMd.replace(ROOT + '/', '').replace(ROOT + '\\', ''),
          message: `Check V: ${variantName}/${entry.path} declared in variant.json but not found in ${variantName}/scripts/${variantName}/SCRIPTS.md registry`,
          fix: `Add ${registryKey} to templates/${variantName}/scripts/${variantName}/SCRIPTS.md`,
        });
        continue;
      }

      if (fileVersion !== registryVersion) {
        issues.push({
          level: 'error',
          file: `templates/${variantName}/${entry.path}`,
          message: `Check V: ${variantName}/${entry.path} @version ${fileVersion} does not match ${variantName}/SCRIPTS.md entry ${registryVersion}`,
          fix: `Update templates/${variantName}/scripts/${variantName}/SCRIPTS.md version for ${registryKey} from ${registryVersion} to ${fileVersion}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Apply --fix for Check A errors: update version entries in scripts/SCRIPTS.md
 * to match the @version found in each file.
 */
function applyFix(checkAIssues: SyncIssue[]): void {
  const fixable = checkAIssues.filter((i) => i.fixData);
  if (fixable.length === 0) {
    console.log(`${colors.dim}Nothing to fix in scripts/SCRIPTS.md.${colors.reset}`);
    return;
  }

  let content = readFileSync(SCRIPTS_MD, 'utf-8');

  for (const issue of fixable) {
    const { scriptName, fileVersion, registryVersion } = issue.fixData!;

    // Replace the version column in the registry row for this script.
    // Row format: | `scriptName` | source | version | ...
    // We use a regex to find the row and replace only the version column.
    const escapedName = scriptName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rowRegex = new RegExp(
      `(\\|\\s*\`${escapedName}\`\\s*\\|[^|]+\\|\\s*)${registryVersion.replace(/\./g, '\\.')}(\\s*\\|)`,
    );

    if (rowRegex.test(content)) {
      content = content.replace(rowRegex, `$1${fileVersion}$2`);
      console.log(
        `${colors.green}✔ Fixed${colors.reset}: ${scriptName} — updated SCRIPTS.md entry ${registryVersion} → ${fileVersion}`,
      );
    } else {
      console.log(
        `${colors.yellow}⚠  Could not auto-fix${colors.reset}: ${scriptName} (row pattern not matched)`,
      );
    }
  }

  writeFileSync(SCRIPTS_MD, content, 'utf-8');
}

/**
 * Run all checks and return the combined result.
 */
function runAudit(jsonMode = false): AuditResult {
  if (!jsonMode) {
    console.log(`${colors.cyan}🔍 Lifecycle Sync Audit${colors.reset}`);
    console.log(`${colors.cyan}========================${colors.reset}`);
    console.log(
      `${colors.dim}Check A: scripts @version vs SCRIPTS.md registry${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check B: scripts/SCRIPTS.md vs templates/common/scripts/SCRIPTS.md${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check C: skills/ vs templates/common/skills/ content${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check D: intentional-duplicate registry${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check X: templates/common/scripts/ references to L0-only scripts${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check V: variant scripts @version vs variant SCRIPTS.md registry${colors.reset}`,
    );
    console.log(
      `${colors.dim}Check E: lifecycle records Version/Owner vs SKILL.md frontmatter${colors.reset}`,
    );
    console.log('');
  }

  const checkAIssues = runCheckA();
  const checkBIssues = runCheckB();
  const checkCIssues = runCheckC();
  const checkXIssues = runCheckX();
  const checkVIssues = runCheckV();
  const checkEIssues = runCheckE();
  const registryEntries = runCheckD();

  if (!jsonMode) {
    if (registryEntries.length === 0) {
      console.log(`${colors.dim}Check D: No intentional duplicates registered.${colors.reset}`);
    } else {
      console.log(`${colors.cyan}Check D: Intentional Duplicate Registry${colors.reset}`);
      console.log(`  Found ${registryEntries.length} intentional duplicate(s):`);
      for (const entry of registryEntries) {
        console.log(`  · ${entry.file} → ${entry.source} (${entry.reason})`);
      }
    }
    console.log('');
  }

  const allErrors = [
    ...checkAIssues.filter((i) => i.level === 'error'),
    ...checkBIssues.filter((i) => i.level === 'error'),
    ...checkCIssues.filter((i) => i.level === 'error'),
    ...checkXIssues.filter((i) => i.level === 'error'),
    ...checkVIssues.filter((i) => i.level === 'error'),
    ...checkEIssues.filter((i) => i.level === 'error'),
  ];
  const allWarnings = [
    ...checkAIssues.filter((i) => i.level === 'warning'),
    ...checkBIssues.filter((i) => i.level === 'warning'),
    ...checkCIssues.filter((i) => i.level === 'warning'),
    ...checkXIssues.filter((i) => i.level === 'warning'),
    ...checkVIssues.filter((i) => i.level === 'warning'),
    ...checkEIssues.filter((i) => i.level === 'warning'),
  ];

  return {
    checksRun: 7,
    errors: allErrors,
    warnings: allWarnings,
    registry: registryEntries,
    passed: allErrors.length === 0,
  };
}

function printResults(result: AuditResult): void {
  for (const error of result.errors) {
    console.log(`${colors.red}✖ ERROR: ${error.message}${colors.reset}`);
    if (error.fix) console.log(`   Fix: ${error.fix}`);
    console.log('');
  }

  for (const warning of result.warnings) {
    console.log(`${colors.yellow}⚠️  WARNING: ${warning.message}${colors.reset}`);
    if (warning.fix) console.log(`   Fix: ${warning.fix}`);
    console.log('');
  }

  console.log(`${colors.cyan}========================${colors.reset}`);
  if (result.passed && result.warnings.length === 0) {
    console.log(`${colors.green}✅ All lifecycle sync checks passed. (Check A: formal version consistency only — semantic content not verified)${colors.reset}`);
  } else if (result.passed) {
    console.log(
      `${colors.green}✅ All lifecycle sync checks passed. (Check A: formal version consistency only — semantic content not verified)${colors.reset} ` +
        `${colors.yellow}(${result.warnings.length} warning(s))${colors.reset}`,
    );
  } else {
    console.log(
      `${colors.red}❌ ${result.errors.length} error(s) found.${colors.reset}`,
    );
  }
}

// CLI interface
const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const fixMode = args.includes('--fix');

if (import.meta.main) {
  if (fixMode) {
    // In fix mode: run Check A, apply fixes, then re-run full audit to report final state
    console.log(`${colors.cyan}🔧 Lifecycle Sync Audit — Fix Mode${colors.reset}`);
    console.log(`${colors.cyan}====================================${colors.reset}`);
    console.log('');

    const checkAIssues = runCheckA();
    applyFix(checkAIssues.filter((i) => i.level === 'error'));
    console.log('');

    // Report remaining issues after fix
    const result = runAudit(false);
    printResults(result);
    process.exit(result.errors.length > 0 ? 1 : 0);
  } else {
    const result = runAudit(jsonMode);

    if (jsonMode) {
      // Strip fixData from JSON output (internal only)
      const cleanResult = {
        ...result,
        errors: result.errors.map(({ fixData: _fd, ...rest }) => rest),
        warnings: result.warnings.map(({ fixData: _fd, ...rest }) => rest),
        registry: result.registry,
      };
      console.log(JSON.stringify(cleanResult, null, 2));
    } else {
      printResults(result);
    }

    process.exit(result.errors.length > 0 ? 1 : 0);
  }
}

