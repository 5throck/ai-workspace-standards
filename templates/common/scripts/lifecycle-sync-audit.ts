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
 * @version 1.2.0
 * @license MIT
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
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

/**
 * Parse the Registry table from a SCRIPTS.md file.
 * Returns a map of { filename -> version }.
 * Only includes rows with status 'active' or 'experimental'.
 */
function parseScriptsMdRegistry(
  filePath: string,
  activeOnly = false,
): Map<string, string> {
  const result = new Map<string, string>();

  if (!existsSync(filePath)) return result;

  const content = readFileSync(filePath, 'utf-8');

  // Extract section between ## Registry and the next ## header
  const registryMatch = content.match(/## Registry\n([\s\S]*?)(?:\n## |\s*$)/);
  if (!registryMatch) return result;

  const section = registryMatch[1];
  const lines = section.split('\n');

  for (const line of lines) {
    // Data rows start with | and have a backtick-wrapped filename in column 1
    if (!line.startsWith('|')) continue;

    const cols = line.split('|').map((c) => c.trim());
    // cols[0] is empty (before leading |), cols[1] is script, cols[2] is source,
    // cols[3] is version, cols[4] is status
    if (cols.length < 5) continue;

    const rawName = cols[1];
    const version = cols[3];
    const status = cols[4];

    // Skip header/separator rows
    if (rawName === 'script' || rawName.startsWith('-')) continue;
    if (!rawName.startsWith('`')) continue;

    const filename = rawName.replace(/`/g, '').trim();
    if (!filename) continue;

    // For Check A we only care about active/experimental
    if (activeOnly && status !== 'active' && status !== 'experimental') continue;

    result.set(filename, version);
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

  for (const [filename, registryVersion] of registry) {
    // Only check .ts files (not .sh/.ps1)
    if (!filename.endsWith('.ts')) continue;

    const scriptPath = join(ROOT, 'scripts', filename);

    // Skip if file doesn't exist on disk (may be template-only)
    if (!existsSync(scriptPath)) continue;

    const fileVersion = extractFileVersion(scriptPath);

    // Skip if file has no @version comment
    if (fileVersion === null) continue;

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
 * templates/common/scripts/SCRIPTS.md for scripts that appear in both.
 * Only runs at workspace root.
 */
function runCheckB(): SyncIssue[] {
  const issues: SyncIssue[] = [];

  if (!IS_WORKSPACE_ROOT) return issues;

  // Skip silently if template SCRIPTS.md doesn't exist
  if (!existsSync(TEMPLATE_SCRIPTS_MD)) return issues;

  const rootRegistry = parseScriptsMdRegistry(SCRIPTS_MD);
  const templateRegistry = parseScriptsMdRegistry(TEMPLATE_SCRIPTS_MD);

  for (const [filename, rootVersion] of rootRegistry) {
    if (!templateRegistry.has(filename)) continue;

    const templateVersion = templateRegistry.get(filename)!;
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
    console.log('');
  }

  const checkAIssues = runCheckA();
  const checkBIssues = runCheckB();
  const checkCIssues = runCheckC();
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
  ];
  const allWarnings = [
    ...checkAIssues.filter((i) => i.level === 'warning'),
    ...checkBIssues.filter((i) => i.level === 'warning'),
    ...checkCIssues.filter((i) => i.level === 'warning'),
  ];

  return {
    checksRun: 4,
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
    console.log(`${colors.green}✅ All lifecycle sync checks passed.${colors.reset}`);
  } else if (result.passed) {
    console.log(
      `${colors.green}✅ All lifecycle sync checks passed.${colors.reset} ` +
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

