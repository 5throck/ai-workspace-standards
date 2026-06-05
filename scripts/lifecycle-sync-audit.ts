#!/usr/bin/env bun
/**
 * Lifecycle Sync Audit Script
 *
 * Detects version drift between lifecycle management artifacts.
 * Check A: scripts/*.ts @version comment vs scripts/SCRIPTS.md registry version
 * Check B: scripts/SCRIPTS.md vs templates/common/scripts/SCRIPTS.md version entries
 *
 * Usage:
 *   bun scripts/lifecycle-sync-audit.ts
 *   bun scripts/lifecycle-sync-audit.ts --json
 *   bun scripts/lifecycle-sync-audit.ts --fix
 *
 * @version 1.3.2
 * @last_updated 2026-06-02
 * @license MIT
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { cwd } from 'node:process';
import { createHash } from 'node:crypto';

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

  const content = readFileSync(filePath, 'utf-8');
  const match = content.match(/@version\s+([\d.]+)/);
  return match ? match[1] : null;
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
 * Check C: Detect content drift between skills/<name>/SKILL.md (workspace root)
 * and templates/common/skills/<name>/SKILL.md.
 * Severity: WARN — L0→L1 publish is explicit, so differences may be intentional.
 */
function runCheckC(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!IS_WORKSPACE_ROOT) return issues;

  const templateSkillsDir = join(ROOT, 'templates', 'common', 'skills');
  if (!existsSync(templateSkillsDir)) return issues;

  const rootSkillsDir = join(ROOT, 'skills');
  if (!existsSync(rootSkillsDir)) return issues;

  let checkedCount = 0;

  const skillEntries = readdirSync(rootSkillsDir, { withFileTypes: true });
  for (const entry of skillEntries) {
    if (!entry.isDirectory()) continue;

    const skillName = entry.name;
    const rootSkillFile = join(rootSkillsDir, skillName, 'SKILL.md');
    const templateSkillFile = join(templateSkillsDir, skillName, 'SKILL.md');

    if (!existsSync(rootSkillFile)) continue;
    if (!existsSync(templateSkillFile)) continue;

    checkedCount++;

    const rootHash = createHash('sha256').update(readFileSync(rootSkillFile)).digest('hex');
    const templateHash = createHash('sha256').update(readFileSync(templateSkillFile)).digest('hex');

    if (rootHash !== templateHash) {
      issues.push({
        level: 'warning',
        file: `skills/${skillName}/SKILL.md`,
        message: `Check C: skills/${skillName}/SKILL.md differs from templates/common/skills/${skillName}/SKILL.md (run publish-to-template to sync)`,
        fix: `Run 'bun run publish-to-template' to sync skills/${skillName}/SKILL.md to templates/common/skills/`,
      });
    }
  }

  if (checkedCount > 0) {
    issues.push({
      level: 'warning',
      file: 'skills/',
      message: `Check C: checked ${checkedCount} skill(s) for content drift`,
    });
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
        fix: `Run 'bun run publish-to-template' to sync or manually align versions`,
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
  'audit:tag-template',           // audit.ts: string mention in warning message only
  'dev-sync:publish-to-template', // dev-sync.ts: called only inside isL0Context guard
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

  const tsFiles = readdirSync(templateScriptsDir)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(templateScriptsDir, f));

  for (const file of tsFiles) {
    const content = readFileSync(file, 'utf-8');
    for (const scriptName of l0OnlyScripts) {
      // Match: bun run scripts/<name>, bun scripts/<name>, import from '.../<name>'
      const patterns = [
        new RegExp(`bun\\s+(?:run\\s+)?scripts\\/${scriptName}`, 'g'),
        new RegExp(`import.*from\\s+['"].*\\/${scriptName}['"]`, 'g'),
      ];
      for (const pattern of patterns) {
        if (pattern.test(content)) {
          const relFile = file.replace(ROOT + '\\', '').replace(ROOT + '/', '');
          const l1Base = basename(file).replace(/\.(ts|sh|ps1)$/, '');
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
 */
function runCheckD(): DuplicateEntry[] {
  const entries: DuplicateEntry[] = [];
  const PATTERN = /<!--\s*intentional-duplicate:\s*([^—\n]+)\s*—\s*([^;>\n]+)/g;
  const EXCLUDED = ['node_modules', '.git', '_archive', 'memory'];
  // Skip CONSTITUTION.md itself (contains the annotation definition/example, not a real duplicate)

  function walkDir(dir: string): void {
    let items: ReturnType<typeof readdirSync>;
    try {
      items = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const item of items) {
      if (EXCLUDED.includes(item.name)) continue;

      const fullPath = join(dir, item.name);

      if (item.isDirectory()) {
        walkDir(fullPath);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        // Skip CONSTITUTION.md (contains definition example, not a real duplicate)
        if (item.name === 'CONSTITUTION.md') continue;
        let content: string;
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch {
          continue;
        }

        let match: RegExpExecArray | null;
        PATTERN.lastIndex = 0;
        while ((match = PATTERN.exec(content)) !== null) {
          entries.push({
            file: fullPath.replace(ROOT + '\\', '').replace(ROOT + '/', ''),
            source: match[1].trim(),
            reason: match[2].trim(),
          });
        }
      }
    }
  }

  walkDir(ROOT);
  return entries;
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
    console.log('');
  }

  const checkAIssues = runCheckA();
  const checkBIssues = runCheckB();
  const checkCIssues = runCheckC();
  const checkXIssues = runCheckX();
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
  ];
  const allWarnings = [
    ...checkAIssues.filter((i) => i.level === 'warning'),
    ...checkBIssues.filter((i) => i.level === 'warning'),
    ...checkCIssues.filter((i) => i.level === 'warning'),
    ...checkXIssues.filter((i) => i.level === 'warning'),
  ];

  return {
    checksRun: 5,
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

