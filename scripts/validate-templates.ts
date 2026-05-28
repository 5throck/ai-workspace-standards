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
  status: 'stable' | 'planned' | 'deprecated' | 'draft' | 'beta';
  version?: string;
}

interface VariantContract {
  version: string;
  required: string[];
  optional: string[];
  context_file_pattern: string;
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
  const requiredDirs = ['.githooks', '.github', 'scripts', 'docs', 'memory', 'skills'];
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

      const validStatuses = ['stable', 'planned', 'deprecated', 'draft', 'beta'];
      if (!validStatuses.includes(raw.status as string)) {
        fail(dir, 'variant-json', `templates/${dir}/variant.json has invalid status: "${raw.status}"`, `Use: stable | planned | deprecated | draft | beta`);
        continue;
      }

      // B-02: Lifecycle field validation
      const lifecycle = raw.lifecycle as Record<string, unknown> | undefined;
      if (!lifecycle) {
        fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json missing 'lifecycle' object`);
      } else {
        if (!lifecycle.statusSince) {
          fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json lifecycle.statusSince is missing`, `Add "statusSince": "YYYY-MM-DD" to lifecycle object`);
        }
        if (!lifecycle.lastTransition) {
          fail(dir, 'variant-lifecycle', `templates/${dir}/variant.json lifecycle.lastTransition is missing`, `Add "lastTransition": "... → ... on YYYY-MM-DD" to lifecycle object`);
        }
        if (lifecycle.statusSince && lifecycle.lastTransition) {
          pass(`templates/${dir}/variant.json lifecycle fields OK (statusSince, lastTransition)`);
        }
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

    const universalCommands = ['changelog.md', 'memlog.md', 'new-task.md', 'sync.md'];
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

// Check 11: README presence in stable variants
function checkReadmePresence(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 11: README presence in ${variant} ===`);

  const readmePath = join(TEMPLATES_DIR, variant, 'README.md');
  const readmeKoPath = join(TEMPLATES_DIR, variant, 'README_ko.md');

  const readmeExists = existsSync(readmePath);
  const readmeKoExists = existsSync(readmeKoPath);

  if (!readmeExists) {
    fail(variant, 'readme-presence', `templates/${variant}/README.md is missing`, `Create README.md with a content_hash: frontmatter field`);
  }
  if (!readmeKoExists) {
    fail(variant, 'readme-presence', `templates/${variant}/README_ko.md is missing`, `Create README_ko.md with a translated_from_hash: frontmatter field`);
  }

  if (readmeExists && readmeKoExists) {
    pass(`${variant}/README.md and README_ko.md both present`);
  }

  // Warn if frontmatter hash fields are missing
  if (readmeExists) {
    const readmeFields = parseFrontmatter(readFileSync(readmePath, 'utf-8'));
    if (!('content_hash' in readmeFields)) {
      warn(variant, 'readme-frontmatter', `templates/${variant}/README.md is missing 'content_hash:' frontmatter field`, `Add 'content_hash: <hash>' to the README.md frontmatter`);
    }
  }
  if (readmeKoExists) {
    const readmeKoFields = parseFrontmatter(readFileSync(readmeKoPath, 'utf-8'));
    if (!('translated_from_hash' in readmeKoFields)) {
      warn(variant, 'readme-frontmatter', `templates/${variant}/README_ko.md is missing 'translated_from_hash:' frontmatter field`, `Add 'translated_from_hash: <hash>' to the README_ko.md frontmatter`);
    }
  }
}

// Check 9: docs/context.md sync and broken paths
function checkContextSync(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 9: docs/context.md sync and paths in ${variant} ===`);
  const agentsMdPath = join(TEMPLATES_DIR, variant, 'AGENTS.md');
  const contextMdPath = join(TEMPLATES_DIR, variant, 'docs', `${variant}.context.md`);

  if (!existsSync(agentsMdPath) || !existsSync(contextMdPath)) {
    return; // Skip if either doesn't exist
  }

  const agentsMd = readFileSync(agentsMdPath, 'utf-8');
  const contextMd = readFileSync(contextMdPath, 'utf-8');

  // Check for broken paths in AGENTS.md
  if (agentsMd.includes('../common/skills/')) {
    fail(variant, 'broken-paths', `AGENTS.md contains broken '../common/skills/' paths`, `Change to 'skills/'`);
  }

  // Check for Agent Lifecycle Manager existence
  if (!agentsMd.includes('agent-lifecycle-manager/SKILL.md')) {
    fail(variant, 'missing-lifecycle-manager', `AGENTS.md is missing 'agent-lifecycle-manager' skill`);
  }

  // Find all skills in AGENTS.md
  const skillRegex = /`([a-zA-Z0-9-./_]+\/SKILL\.md)`/g;
  const expectedSkills = new Set<string>();
  for (const match of agentsMd.matchAll(skillRegex)) {
    expectedSkills.add(match[1]);
  }

  // Check if they are all in contextMd
  const missingSkills: string[] = [];
  for (const skill of expectedSkills) {
    if (!contextMd.includes(skill)) {
      missingSkills.push(skill);
    }
  }

  if (missingSkills.length > 0) {
    fail(variant, 'context-sync', `docs/context.md is missing skills defined in AGENTS.md: ${missingSkills.join(', ')}`, 'Sync the ## Skills table in docs/context.md with AGENTS.md');
  } else {
    pass(`${variant}/docs/context.md has all ${expectedSkills.size} skills from AGENTS.md`);
  }
}

// Check 10: Root vs Template Alignment (L0 vs L1 Sync)
function checkL0L1ScriptParity() {
  const L1_SCRIPTS = join(ROOT, 'scripts');
  const L0_SCRIPTS = join(ROOT, 'templates', 'common', 'scripts');
  
  if (!existsSync(L1_SCRIPTS) || !existsSync(L0_SCRIPTS)) return;
  
  const whitelist = [
    'agent-create.ts', 
    'dev-sync.ps1', 
    'dev-sync.sh', 
    'generate-scripts-readme.ts', 
    'sync-agent-status.ts', 
    'sync-skill-status.ts'
  ];
  
  for (const script of whitelist) {
    const l1Path = join(L1_SCRIPTS, script);
    const l0Path = join(L0_SCRIPTS, script);
    
    if (existsSync(l1Path) && existsSync(l0Path)) {
      const l1Content = readFileSync(l1Path, 'utf-8');
      const l0Content = readFileSync(l0Path, 'utf-8');
      
      if (l1Content !== l0Content) {
        fail('common', 'l0-l1-script-parity', `Script ${script} differs between L1 (root) and L0 (templates/common).`, `Backport L1 changes to L0 or update L1 to match L0.`);
      } else {
        pass(`Script ${script} is in sync between L0 and L1`);
      }
    }
  }
}

// Check 11: Variant Contract compliance
function checkVariantContract(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 11: Variant Contract compliance in ${variant} ===`);

  try {
    const contractPath = join(TEMPLATES_DIR, 'common', 'variant-contract.json');
    if (!existsSync(contractPath)) {
      fail('root', 'variant-contract-missing', 'templates/common/variant-contract.json not found', 'Create variant-contract.json with version, required, optional fields');
      return;
    }

    const contractRaw = readFileSync(contractPath, 'utf-8');
    let contract: VariantContract;

    try {
      contract = JSON.parse(contractRaw) as VariantContract;
    } catch (parseError) {
      fail('root', 'variant-contract-invalid', 'templates/common/variant-contract.json is not valid JSON', 'Fix JSON syntax');
      return;
    }

    const variantDir = join(TEMPLATES_DIR, variant);
    const missingFiles: string[] = [];

    for (const requiredFile of contract.required) {
      const filePath = join(variantDir, requiredFile);
      if (!existsSync(filePath)) {
        missingFiles.push(requiredFile);
      }
    }

    if (missingFiles.length > 0) {
      fail(variant, 'variant-contract', `Variant Contract FAILED — missing ${missingFiles.length} required files:\n     - ${missingFiles.join('\n     - ')}`);
    } else {
      pass(`${variant}: Variant Contract satisfied (${contract.required.length}/${contract.required.length} required files present)`);
    }
  } catch (error) {
    fail('root', 'variant-contract-error', `Failed to check Variant Contract: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Check B-03: security-gate: true skills must NOT be in .claude/skills/
function checkSecurityGateSkills(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check B-03: security-gate skill placement in ${variant} ===`);

  const claudeSkillsDir = join(TEMPLATES_DIR, variant, '.claude', 'skills');
  if (!existsSync(claudeSkillsDir)) {
    pass(`${variant}/.claude/skills/: not present (OK — security-gate check not applicable)`);
    return;
  }

  const skillDirs = readdirSync(claudeSkillsDir).filter(d =>
    statSync(join(claudeSkillsDir, d)).isDirectory()
  );

  let violations = 0;
  for (const skillName of skillDirs) {
    const skillMdPath = join(claudeSkillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMdPath)) continue;

    const rawContent = readFileSync(skillMdPath, 'utf-8');
    const fields = parseFrontmatter(rawContent);

    if ('security-gate' in fields) {
      // Check if value is true
      const content = normalizeContent(rawContent);
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      if (match) {
        const fmText = match[1];
        const sgLine = fmText.split('\n').find(l => l.startsWith('security-gate:'));
        const sgValue = sgLine ? sgLine.slice(sgLine.indexOf(':') + 1).trim() : '';
        if (sgValue === 'true') {
          fail(
            variant,
            'security-gate-placement',
            `${variant}/.claude/skills/${skillName}/SKILL.md has security-gate: true but is in .claude/skills/ (Claude Code-only). Move to skills/ (platform-neutral).`,
            `Move skills/${skillName}/ out of .claude/skills/ into the top-level skills/ directory`
          );
          violations++;
        }
      }
    }
  }

  if (violations === 0) {
    pass(`${variant}/.claude/skills/: no security-gate: true skills found (OK)`);
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

    // Check Variant Contract for all variants (including draft)
    checkVariantContract(variant);
    checkSecurityGateSkills(variant);  // B-03

    if (manifest.status === 'stable') {
      checkAgents(variant);
      checkAgentsRoster(variant);
      checkCommands(variant);
      checkScriptParity(variant);
      checkContextSync(variant);
      checkReadmePresence(variant);
      variantsChecked++;
    }
  }

  checkSharedFileSync();
  checkL0L1ScriptParity();

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
