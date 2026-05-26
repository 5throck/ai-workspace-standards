#!/usr/bin/env bun
/**
 * Template Lifecycle Validation Script
 *
 * Validates template variants for structural integrity.
 * Follows the same pattern as agent-lifecycle-audit.ts
 *
 * Usage:
 *   bun scripts/validate-templates.ts
 *   bun scripts/validate-templates.ts --variant co-develop
 *   bun scripts/validate-templates.ts --json
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

interface VariantManifest {
  name: string;
  description: string;
  status: 'stable' | 'planned' | 'deprecated';
  version?: string;
}

interface ValidationIssue {
  level: 'error' | 'warning';
  variant: string;
  check: string;
  message: string;
  fix?: string;
}

interface ValidationResult {
  variantsScanned: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: string;
}

const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

const ROOT = cwd();
const TEMPLATES_DIR = join(ROOT, 'templates');
const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const variantArg = (() => {
  const idx = args.indexOf('--variant');
  return idx !== -1 ? args[idx + 1] : 'all';
})();

const issues: ValidationIssue[] = [];

function pass(msg: string) {
  if (!JSON_MODE) console.log(`${colors.green}[PASS]${colors.reset} ${msg}`);
}

function fail(variant: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', variant, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.red}[FAIL]${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

function warn(variant: string, check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', variant, check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`);
    if (fix) console.log(`       ${colors.dim}Fix: ${fix}${colors.reset}`);
  }
}

// Check 0: templates/common/
function checkCommon(): void {
  if (!JSON_MODE) console.log('\n=== Check 0: templates/common/ ===');
  const commonDir = join(TEMPLATES_DIR, 'common');
  if (!existsSync(commonDir)) {
    fail('root', 'common-dir', 'templates/common/ directory not found', 'Create templates/common/ with shared infrastructure');
    return;
  }

  // Check required subdirectories
  const requiredDirs = ['.githooks', '.github', 'scripts', 'docs'];
  for (const dir of requiredDirs) {
    const dirPath = join(commonDir, dir);
    if (!existsSync(dirPath)) {
      fail('common', 'common-structure', `templates/common/${dir}/ not found`, `Create templates/common/${dir}/ directory`);
    }
  }

  pass('templates/common/ exists with required subdirectories');
}

// Check 1: templates/VERSION
function checkVersion(): void {
  if (!JSON_MODE) console.log('\n=== Check 1: templates/VERSION ===');
  const versionFile = join(TEMPLATES_DIR, 'VERSION');
  if (!existsSync(versionFile)) {
    fail('root', 'VERSION', 'templates/VERSION file missing', 'Create templates/VERSION with semver (e.g. 0.4.0)');
    return;
  }
  const version = readFileSync(versionFile, 'utf-8').trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    fail('root', 'VERSION', `templates/VERSION has invalid semver: "${version}"`, 'Use format X.Y.Z');
    return;
  }
  pass(`templates/VERSION: ${version}`);
}

// Check 2: variant.json in each variant dir
function checkVariantManifests(): Map<string, VariantManifest> {
  if (!JSON_MODE) console.log('\n=== Check 2: variant.json manifests ===');
  const manifests = new Map<string, VariantManifest>();

  if (!existsSync(TEMPLATES_DIR)) {
    fail('root', 'variant-dirs', 'templates/ directory not found');
    return manifests;
  }

  const entries = readdirSync(TEMPLATES_DIR);
  const variantDirs = entries.filter(e => {
    const fullPath = join(TEMPLATES_DIR, e);
    return statSync(fullPath).isDirectory() && !e.startsWith('.') && e !== 'common';
  });

  if (variantDirs.length === 0) {
    fail('root', 'variant-dirs', 'No variant directories found in templates/');
    return manifests;
  }

  for (const dir of variantDirs) {
    if (variantArg !== 'all' && dir !== variantArg) continue;

    const manifestPath = join(TEMPLATES_DIR, dir, 'variant.json');
    if (!existsSync(manifestPath)) {
      fail(dir, 'variant-json', `templates/${dir}/variant.json missing`, `Create variant.json with name, description, status fields`);
      continue;
    }

    try {
      const raw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, unknown>;
      const requiredFields = ['name', 'description', 'status'];
      const missing = requiredFields.filter(f => !(f in raw));

      if (missing.length > 0) {
        fail(dir, 'variant-json', `templates/${dir}/variant.json missing fields: ${missing.join(', ')}`);
        continue;
      }

      const validStatuses = ['stable', 'planned', 'deprecated'];
      if (!validStatuses.includes(raw.status as string)) {
        fail(dir, 'variant-json', `templates/${dir}/variant.json has invalid status: "${raw.status}"`, `Use: stable | planned | deprecated`);
        continue;
      }

      manifests.set(dir, raw as unknown as VariantManifest);
      pass(`templates/${dir}/variant.json: status=${raw.status}`);
    } catch (e) {
      fail(dir, 'variant-json', `templates/${dir}/variant.json is not valid JSON`);
    }
  }

  return manifests;
}

// Normalize content: strip BOM and normalize line endings
function normalizeContent(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Parse frontmatter fields from markdown (handles BOM, CRLF, multi-line values, YAML blocks)
function parseFrontmatter(rawContent: string): Record<string, true> {
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields: Record<string, true> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    // Only top-level keys (no leading spaces, no list items)
    if (key && !key.startsWith(' ') && !key.startsWith('-')) fields[key] = true;
  }
  return fields;
}

// Check 3 & 4: Agent frontmatter and required sections
function checkAgents(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 3-4: Agent files in ${variant} ===`);
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  if (!existsSync(agentsDir)) {
    warn(variant, 'agents-dir', `templates/${variant}/agents/ directory not found`);
    return;
  }

  const agentFiles = readdirSync(agentsDir).filter(f => f.endsWith('.md'));
  if (agentFiles.length === 0) {
    warn(variant, 'agents-empty', `No agent .md files found in templates/${variant}/agents/`);
    return;
  }

  const requiredFrontmatter = ['name', 'tier', 'description', 'examples'];
  // PM uses "Meeting Facilitation" (facilitator role); all others use "Meeting Participation"
  const MEETING_SECTIONS = ['## Meeting Participation', '## Meeting Facilitation'];
  const DISPATCH_SECTION = '## Dispatch Protocol';

  // Only check actual agent definition files (skip README, handoff-spec, and similar docs)
  const agentDefinitionFiles = agentFiles.filter(f =>
    !f.startsWith('README') && !f.startsWith('handoff-spec')
  );

  for (const file of agentDefinitionFiles) {
    const filePath = join(agentsDir, file);
    const rawContent = readFileSync(filePath, 'utf-8');
    const content = normalizeContent(rawContent);
    const fields = parseFrontmatter(rawContent);

    // Check frontmatter (field must exist as a key, value can be empty/block)
    const missingFields = requiredFrontmatter.filter(f => !(f in fields));
    if (missingFields.length > 0) {
      fail(variant, 'agent-frontmatter', `agents/${file}: missing frontmatter: ${missingFields.join(', ')}`);
    } else {
      pass(`agents/${file}: frontmatter OK`);
    }

    // Check required sections
    const hasMeetingSection = MEETING_SECTIONS.some(s => content.includes(s));
    const hasDispatchSection = content.includes(DISPATCH_SECTION);
    const missingSections: string[] = [];
    if (!hasMeetingSection) missingSections.push('## Meeting Participation (or ## Meeting Facilitation)');
    if (!hasDispatchSection) missingSections.push(DISPATCH_SECTION);

    if (missingSections.length > 0) {
      fail(variant, 'agent-sections', `agents/${file}: missing sections: ${missingSections.join(', ')}`);
    } else {
      pass(`agents/${file}: required sections OK`);
    }
  }
}

// Check 5: AGENTS.md roster vs actual files
function checkAgentsRoster(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 5: AGENTS.md roster in ${variant} ===`);
  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');

  if (!existsSync(agentsMdPath)) {
    fail(variant, 'agents-roster', `templates/${variant}/AGENTS.md not found`);
    return;
  }
  if (!existsSync(agentsDir)) return;

  const agentsMd = readFileSync(agentsMdPath, 'utf-8');
  const registeredFiles = new Set<string>();
  for (const match of agentsMd.matchAll(/\[([^\]]+)\]\(agents\/([^)]+)\.md\)/g)) {
    registeredFiles.add(`${match[2]}.md`);
  }

  // Exclude documentation files (README, handoff-spec) from roster check
  const actualFiles = new Set(readdirSync(agentsDir).filter(f =>
    f.endsWith('.md') && !f.startsWith('README') && !f.startsWith('handoff-spec')
  ));

  const orphaned = [...actualFiles].filter(f => !registeredFiles.has(f));
  const missing = [...registeredFiles].filter(f => !actualFiles.has(f));

  if (orphaned.length > 0) {
    fail(variant, 'agents-roster', `Orphaned agent files (not in AGENTS.md): ${orphaned.join(', ')}`, 'Add to AGENTS.md roster table');
  }
  if (missing.length > 0) {
    fail(variant, 'agents-roster', `AGENTS.md references missing files: ${missing.join(', ')}`, 'Create the agent file or remove from AGENTS.md');
  }
  if (orphaned.length === 0 && missing.length === 0) {
    pass(`${variant}/AGENTS.md roster matches filesystem (${actualFiles.size} agents)`);
  }
}

// Check 6: .claude/commands in variant
function checkCommands(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 6: .claude/commands in ${variant} ===`);

  // For common/, check universal commands only
  if (variant === 'common') {
    const commandsDir = join(TEMPLATES_DIR, 'common', '.claude', 'commands');
    if (!existsSync(commandsDir)) {
      fail('common', 'commands-dir', 'templates/common/.claude/commands/ not found');
      return;
    }

    const universalCommands = ['changelog.md', 'memlog.md', 'new-task.md', 'security-check.md', 'sync.md'];
    for (const cmd of universalCommands) {
      const cmdPath = join(commandsDir, cmd);
      if (!existsSync(cmdPath)) {
        fail('common', 'command-missing', `.claude/commands/${cmd} not found in common/`);
      }
    }
    pass(`common/.claude/commands: ${universalCommands.length} universal commands OK`);
    return;
  }

  // For variants, check meeting.md exists
  const commandsDir = join(TEMPLATES_DIR, variant, '.claude', 'commands');
  if (!existsSync(commandsDir)) {
    warn(variant, 'commands-dir', `templates/${variant}/.claude/commands/ not found`);
    return;
  }

  const meetingCmd = join(commandsDir, 'meeting.md');
  if (!existsSync(meetingCmd)) {
    fail(variant, 'command-missing', `templates/${variant}/.claude/commands/meeting.md not found`);
  } else {
    pass(`${variant}/.claude/commands/meeting.md: OK`);
  }
}

// Check 7: scripts parity
function checkScriptParity(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 7: scripts parity in ${variant} ===`);

  // Only check common/ for script parity
  if (variant !== 'common') return;

  const scriptsDir = join(TEMPLATES_DIR, 'common', 'scripts');
  if (!existsSync(scriptsDir)) {
    warn('common', 'scripts-dir', 'templates/common/scripts/ not found');
    return;
  }

  const files = readdirSync(scriptsDir);
  const shNames = new Set(files.filter(f => f.endsWith('.sh')).map(f => f.replace('.sh', '')));
  const ps1Names = new Set(files.filter(f => f.endsWith('.ps1')).map(f => f.replace('.ps1', '')));

  const missingPs1 = [...shNames].filter(n => !ps1Names.has(n));
  const missingSh = [...ps1Names].filter(n => !shNames.has(n));

  if (missingPs1.length > 0) {
    fail('common', 'script-parity', `Missing .ps1 counterparts: ${missingPs1.map(n => n + '.sh').join(', ')}`, 'Create matching .ps1 files');
  }
  if (missingSh.length > 0) {
    fail('common', 'script-parity', `Missing .sh counterparts: ${missingSh.map(n => n + '.ps1').join(', ')}`, 'Create matching .sh files');
  }
  if (missingPs1.length === 0 && missingSh.length === 0) {
    pass(`common/scripts: .sh/.ps1 parity OK (${shNames.size} pairs)`);
  }
}

// Check 8: Shared file sync warning
function checkSharedFileSync(): void {
  if (!JSON_MODE) console.log('\n=== Check 8: Shared file sync ===');
  const workspaceMeeting = join(ROOT, '.claude', 'commands', 'meeting.md');
  const templateMeeting = join(TEMPLATES_DIR, 'co-develop', '.claude', 'commands', 'meeting.md');

  if (!existsSync(workspaceMeeting) || !existsSync(templateMeeting)) {
    // One or both missing — skip silently
    return;
  }

  const wsContent = normalizeContent(readFileSync(workspaceMeeting, 'utf-8'));
  const tplContent = normalizeContent(readFileSync(templateMeeting, 'utf-8'));

  if (wsContent !== tplContent) {
    warn('root', 'shared-sync', 'meeting.md differs between workspace and templates/co-develop', 'Run: cp .claude/commands/meeting.md templates/co-develop/.claude/commands/meeting.md');
  } else {
    pass('meeting.md: workspace and co-develop are in sync');
  }
}

// Main
function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}Template Lifecycle Validator${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
    console.log(`${colors.dim}Variant filter: ${variantArg}${colors.reset}`);
  }

  checkVersion();
  checkCommon();
  const manifests = checkVariantManifests();

  // Check common/ commands
  checkCommands('common');

  let variantsChecked = 0;
  for (const [variant, manifest] of manifests) {
    if (variantArg !== 'all' && variant !== variantArg) continue;

    if (manifest.status === 'stable') {
      checkAgents(variant);
      checkAgentsRoster(variant);
      checkCommands(variant);
      checkScriptParity(variant);
      variantsChecked++;
    }
  }

  checkSharedFileSync();

  const errors = issues.filter(i => i.level === 'error');
  const warnings = issues.filter(i => i.level === 'warning');

  if (JSON_MODE) {
    console.log(JSON.stringify({
      variantsScanned: variantsChecked,
      errors,
      warnings,
      summary: `${errors.length} error(s), ${warnings.length} warning(s)`,
    }, null, 2));
  } else {
    console.log(`\n${colors.dim}${'─'.repeat(50)}${colors.reset}`);
    if (errors.length === 0) {
      console.log(`${colors.green}✓ ${errors.length} error(s), ${warnings.length} warning(s) across ${variantsChecked} stable variant(s)${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ ${errors.length} error(s), ${warnings.length} warning(s) across ${variantsChecked} stable variant(s)${colors.reset}`);
    }
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
