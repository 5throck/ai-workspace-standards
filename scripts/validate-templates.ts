#!/usr/bin/env bun
/**
 * Template Lifecycle Validation Script
 * @version 1.2.0
 *
 * Validates template variants for structural integrity.
 * Follows the same pattern as agent-lifecycle-audit.ts
 *
 * Usage:
 *   bun scripts/validate-templates.ts
 *   bun scripts/validate-templates.ts --variant co-develop
 *   bun scripts/validate-templates.ts --json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TEMPLATES_DIR = join(ROOT, 'templates');

if (!existsSync(TEMPLATES_DIR)) {
  console.error(`\x1b[31m[ERROR] templates/ directory not found at: ${TEMPLATES_DIR}\x1b[0m`);
  process.exit(1);
}

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

// D-04: Governance policy loaded from lifecycle-governance.json
interface GovernanceDomain {
  applicable: boolean;
  tool?: string;
  mandatory?: boolean;
  currentStatus?: string;
}
interface GovernanceLayer {
  orchestrator: string | null;
  domains: Record<string, GovernanceDomain>;
}
interface GovernancePolicy {
  version: string;
  layers: Record<string, GovernanceLayer>;
  variantValidationPolicy: {
    mandatoryBeforeProjectCreation: string[];
    warningOnly: string[];
  };
}

let governance: GovernancePolicy | null = null;
function loadGovernance(): void {
  const govPath = join(ROOT, 'docs', 'templates', 'lifecycle-governance.json');
  if (!existsSync(govPath)) return;
  try {
    governance = JSON.parse(readFileSync(govPath, 'utf-8')) as GovernancePolicy;
  } catch {
    // governance stays null — checks will proceed without policy enforcement
  }
}

function isMandatory(domain: string): boolean {
  if (!governance) return true; // default to mandatory if governance file missing
  const variantLayer = governance.layers['templates-variants'];
  if (!variantLayer) return true;
  const d = variantLayer.domains[domain];
  if (!d || !d.applicable) return false;
  return d.mandatory ?? true;
}

// Check D-04: Governance policy + common.lifecycle.json
function checkGovernance(): void {
  if (!JSON_MODE) console.log('\n=== Check D-04: Lifecycle governance ===');
  const govPath = join(ROOT, 'docs', 'templates', 'lifecycle-governance.json');
  if (!existsSync(govPath)) {
    warn('common', 'governance-missing', 'docs/templates/lifecycle-governance.json not found', 'Create lifecycle-governance.json per D-01 action item');
    return;
  }
  pass('docs/templates/lifecycle-governance.json: present');

  const commonLcPath = join(ROOT, 'docs', 'templates', 'common.lifecycle.json');
  if (!existsSync(commonLcPath)) {
    warn('common', 'common-lifecycle-missing', 'docs/templates/common.lifecycle.json not found', 'Create common.lifecycle.json per D-03 action item');
  } else {
    try {
      const lc = JSON.parse(readFileSync(commonLcPath, 'utf-8')) as Record<string, unknown>;
      if (!lc.version || !lc.status || !lc.propagatedTo) {
        warn('common', 'common-lifecycle-schema', 'common.lifecycle.json missing required fields: version, status, propagatedTo');
      } else {
        pass(`docs/templates/common.lifecycle.json: v${lc.version} (${lc.status}), propagated to ${(lc.propagatedTo as string[]).length} variant(s)`);
      }
    } catch {
      fail('common', 'common-lifecycle-invalid', 'docs/templates/common.lifecycle.json is not valid JSON');
    }
  }

  if (governance && !JSON_MODE) {
    const policy = governance.variantValidationPolicy;
    console.log(`       ${colors.dim}Mandatory domains: ${policy.mandatoryBeforeProjectCreation.join(', ')}${colors.reset}`);
    console.log(`       ${colors.dim}Warning-only domains: ${policy.warningOnly.join(', ')}${colors.reset}`);
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

  // Check forbidden files — files that must NOT exist in templates/common/
  const forbiddenFiles = ['CONSTITUTION.md', 'CLAUDE.md', 'GEMINI.md'];
  const presentForbidden = forbiddenFiles.filter(f => existsSync(join(commonDir, f)));
  if (presentForbidden.length > 0) {
    for (const f of presentForbidden) {
      fail('common', 'forbidden-file', `templates/common/${f} must not exist — workspace-level file must not be copied to L2 projects. Delete it from templates/common/.`);
    }
  } else {
    pass('templates/common/ blocklist: no forbidden files present');
  }
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

/**
 * Resolve extends pattern in frontmatter
 * If file has "extends: path/to/skeleton.md", read skeleton and merge frontmatters
 * @param filePath - Absolute path to the variant file
 * @param frontmatter - Parsed frontmatter fields from the variant file
 * @returns Merged frontmatter fields (skeleton + variant overrides)
 */
function resolveExtends(filePath: string, frontmatter: Record<string, true>): Record<string, true> {
  if (!frontmatter.extends) {
    return frontmatter; // No extends, return as-is
  }

  // Extract the extends path from the raw content (we need the actual path string, not just 'true')
  const rawContent = readFileSync(filePath, 'utf-8');
  const content = normalizeContent(rawContent);
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return frontmatter;

  // Parse the extends value from YAML
  let extendsPath: string | undefined;
  try {
    const yamlObj = load(match[1]) as Record<string, unknown>;
    extendsPath = yamlObj.extends as string | undefined;
  } catch {
    return frontmatter; // Invalid YAML, return original
  }

  if (!extendsPath) return frontmatter;

  // Resolve skeleton path relative to current file
  const skeletonPath = resolve(dirname(filePath), extendsPath);

  try {
    if (!existsSync(skeletonPath)) {
      console.warn(`[WARN] Skeleton file not found: ${skeletonPath}`);
      return frontmatter;
    }

    const skeletonContent = readFileSync(skeletonPath, 'utf-8');
    const skeletonMatch = skeletonContent.match(/^---\n([\s\S]*?)\n---/);

    if (!skeletonMatch) {
      // No frontmatter in skeleton, return variant frontmatter
      return frontmatter;
    }

    const skeletonFrontmatter = parseFrontmatter(skeletonContent);

    // Merge: skeleton base + variant overrides (variant takes precedence)
    const merged = { ...skeletonFrontmatter };
    for (const key of Object.keys(frontmatter)) {
      if (key !== 'extends') {
        merged[key] = frontmatter[key];
      }
    }

    return merged;
  } catch (error) {
    console.warn(`[WARN] Failed to resolve extends: ${skeletonPath}`, error);
    return frontmatter; // Fallback to original
  }
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

  // Check for required agents/README.md and agents/README_ko.md (per VARIANT_CONTRACT.md)
  for (const readmeFile of ['README.md', 'README_ko.md']) {
    const readmePath = join(agentsDir, readmeFile);
    if (!existsSync(readmePath)) {
      fail(variant, `agents-readme-missing`, `templates/${variant}/agents/${readmeFile} not found`,
        `Create agents/${readmeFile} with agent roster table`);
    } else {
      pass(`${variant}/agents/${readmeFile}: present`);
    }
  }

  const requiredFrontmatter = ['name', 'status', 'tier', 'description', 'examples'];
  const validAgentStatuses = ['active', 'deprecated', 'experimental'];
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

    // Resolve extends pattern - merge skeleton frontmatter with variant frontmatter
    const resolvedFields = resolveExtends(filePath, fields);

    // Check frontmatter (field must exist as a key, value can be empty/block)
    const missingFields = requiredFrontmatter.filter(f => !(f in resolvedFields));
    if (missingFields.length > 0) {
      fail(variant, 'agent-frontmatter', `agents/${file}: missing frontmatter: ${missingFields.join(', ')}`,
        `Add missing fields to YAML frontmatter. Required: ${requiredFrontmatter.join(', ')}`);
    } else {
      // Validate status enum value (extract actual value from resolved content)
      // If file has extends, we need to check the skeleton file for the status value
      let statusVal = '';

      // Check if the original (non-resolved) frontmatter has extends
      const hasExtends = 'extends' in fields;

      if (hasExtends) {
        // Read status from skeleton file
        const extendsLine = rawContent.split('\n').find(l => l.match(/^extends:\s*\S/));
        const extendsVal = extendsLine ? extendsLine.replace(/^extends:\s*/, '').trim() : '';
        const skeletonPath = resolve(dirname(filePath), extendsVal);

        try {
          const skeletonContent = readFileSync(skeletonPath, 'utf-8');
          // Extract status from skeleton frontmatter
          const skeletonMatch = skeletonContent.match(/^---\n([\s\S]*?)\n---/);
          if (skeletonMatch) {
            const skeletonYaml = load(skeletonMatch[1]) as Record<string, unknown>;
            statusVal = (skeletonYaml.status as string) ?? '';
          }
        } catch (error) {
          // If skeleton read fails, fall back to variant file
          console.warn(`[WARN] Failed to read skeleton for status validation: ${skeletonPath}`, error);
          const variantMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (variantMatch) {
            const variantYaml = load(variantMatch[1]) as Record<string, unknown>;
            statusVal = (variantYaml.status as string) ?? '';
          }
        }
      } else {
        // No extends, read from variant file directly
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          const yamlObj = load(match[1]) as Record<string, unknown>;
          statusVal = (yamlObj.status as string) ?? '';
        }
      }

      if (!validAgentStatuses.includes(statusVal)) {
        fail(variant, 'agent-status-invalid',
          `agents/${file}: invalid status value '${statusVal}' (allowed: ${validAgentStatuses.join(' | ')})`,
          `Set status to one of: ${validAgentStatuses.join(', ')}`);
      } else {
        pass(`agents/${file}: frontmatter OK`);
      }
    }

    // Check required sections
    // For additive overrides, invariant sections may be missing from variant file (provided by skeleton)
    const agentName = file.replace('.md', '');
    const variantJsonForAgent = join(TEMPLATES_DIR, variant, 'variant.json');
    let agentOverrideType = 'replacement';
    if (existsSync(variantJsonForAgent)) {
      try {
        const vj = JSON.parse(readFileSync(variantJsonForAgent, 'utf-8'));
        agentOverrideType = vj.agent_overrides?.[agentName]?.type ?? 'replacement';
      } catch { /* keep default */ }
    }
    const commonAgentPath = join(TEMPLATES_DIR, 'common', 'agents', file);
    const commonAgentContent = existsSync(commonAgentPath)
      ? normalizeContent(readFileSync(commonAgentPath, 'utf-8'))
      : '';

    // Section is "present" if in variant file OR (additive override AND in skeleton)
    const hasMeetingSection = MEETING_SECTIONS.some(s =>
      content.includes(s) || (agentOverrideType === 'additive' && commonAgentContent.includes(s))
    );
    const hasDispatchSection = content.includes(DISPATCH_SECTION) ||
      (agentOverrideType === 'additive' && commonAgentContent.includes(DISPATCH_SECTION));
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

  // Also consider agents inherited from templates/common/agents/ as "present"
  const commonAgentsDir = join(TEMPLATES_DIR, 'common', 'agents');
  const commonAgentFiles = existsSync(commonAgentsDir)
    ? new Set(readdirSync(commonAgentsDir).filter(f => f.endsWith('.md') && !f.startsWith('_') && !f.startsWith('README')))
    : new Set<string>();
  const allAvailableFiles = new Set([...actualFiles, ...commonAgentFiles]);

  const orphaned = [...actualFiles].filter(f => !registeredFiles.has(f));
  const missing = [...registeredFiles].filter(f => !allAvailableFiles.has(f));

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

// Check 6: commands structure — shared in common/, variant-specific only in variants
function checkCommands(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 6: commands in ${variant} ===`);

  const allSharedCommands = ['changelog.md', 'meeting.md', 'memlog.md', 'new-task.md', 'sync.md'];

  if (variant === 'common') {
    // common/ must have all 5 shared commands in BOTH .claude/commands/ and .gemini/commands/
    for (const platform of ['.claude', '.gemini']) {
      const commandsDir = join(TEMPLATES_DIR, 'common', platform, 'commands');
      if (!existsSync(commandsDir)) {
        fail('common', 'commands-dir', `templates/common/${platform}/commands/ not found`);
        continue;
      }
      for (const cmd of allSharedCommands) {
        if (!existsSync(join(commandsDir, cmd))) {
          fail('common', 'command-missing', `${platform}/commands/${cmd} not found in common/`);
        }
      }
      pass(`common/${platform}/commands: ${allSharedCommands.length} shared commands OK`);
    }
    return;
  }

  // Variants must NOT have shared commands (inherited from common/ via new-project.sh overlay)
  // Only security-check.md is allowed as a variant-specific command
  const allowedVariantCommands = new Set(['security-check.md']);
  for (const platform of ['.claude', '.gemini']) {
    const commandsDir = join(TEMPLATES_DIR, variant, platform, 'commands');
    if (!existsSync(commandsDir)) continue;
    const files = readdirSync(commandsDir);
    const unexpected = files.filter(f => !allowedVariantCommands.has(f));
    if (unexpected.length > 0) {
      fail(variant, 'command-duplicate', `${platform}/commands/ contains shared commands that belong in common/ only: ${unexpected.join(', ')}`);
    } else {
      pass(`${variant}/${platform}/commands: OK (${files.length} variant-specific file(s))`);
    }
  }
}

// Check 7: scripts and .githooks parity
function checkScriptParity(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 7: scripts parity in ${variant} ===`);

  // Only check common/ for script parity
  if (variant !== 'common') return;

  // 7a: scripts/ bidirectional .sh/.ps1 parity (Fail)
  const scriptsDir = join(TEMPLATES_DIR, 'common', 'scripts');
  if (!existsSync(scriptsDir)) {
    warn('common', 'scripts-dir', 'templates/common/scripts/ not found');
  } else {
    const files = readdirSync(scriptsDir);
    const shNames = new Set(files.filter(f => f.endsWith('.sh') && !f.startsWith('test-')).map(f => f.replace('.sh', '')));
    const ps1Names = new Set(files.filter(f => f.endsWith('.ps1') && !f.startsWith('test-')).map(f => f.replace('.ps1', '')));

    const missingPs1 = [...shNames].filter(n => !ps1Names.has(n));
    const missingSh = [...ps1Names].filter(n => !shNames.has(n));

    if (missingPs1.length > 0) {
      fail('common', 'script-parity', `Missing .ps1 counterparts: ${missingPs1.map(n => n + '.sh').join(', ')}`, 'Create matching .ps1 files');
    }
    if (missingSh.length > 0) {
      fail('common', 'script-parity', `Missing .sh counterparts: ${missingSh.map(n => n + '.ps1').join(', ')}`, 'Create matching .sh files');
    }
    if (missingPs1.length === 0 && missingSh.length === 0) {
      pass(`common/scripts: .sh/.ps1 parity OK (${shNames.size} pairs, test-* excluded)`);
    }
  }

  // 7b: .githooks/ parity — Removed since hooks are now TS wrappers without .ps1 equivalents
  const hooksDir = join(TEMPLATES_DIR, 'common', '.githooks');
  if (existsSync(hooksDir)) {
    pass(`common/.githooks: present`);
  }
}

// Check 8: Shared file sync warning
function checkSharedFileSync(): void {
  if (!JSON_MODE) console.log('\n=== Check 8: Shared file sync ===');
  const workspaceMeeting = join(ROOT, '.claude', 'commands', 'meeting.md');
  const templateMeeting = join(TEMPLATES_DIR, 'common', '.claude', 'commands', 'meeting.md');

  if (!existsSync(workspaceMeeting) || !existsSync(templateMeeting)) {
    // One or both missing — skip silently
    return;
  }

  const wsContent = normalizeContent(readFileSync(workspaceMeeting, 'utf-8'));
  const tplContent = normalizeContent(readFileSync(templateMeeting, 'utf-8'));

  if (wsContent !== tplContent) {
    warn('root', 'shared-sync', 'meeting.md differs between workspace and templates/common', 'Run: cp .claude/commands/meeting.md templates/common/.claude/commands/meeting.md');
  } else {
    pass('meeting.md: workspace and common are in sync');
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

  // If DYNAMIC_SKILLS markers are present, inject-skills.ts handles sync at scaffold time — skip static check
  if (contextMd.includes('<!-- DYNAMIC_SKILLS_START -->')) {
    pass(`${variant}/docs/context.md uses DYNAMIC_SKILLS injection (runtime sync via inject-skills.ts)`);
    return;
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

// Check P-01: Platform Documentation Parity and Template Sync
function checkPlatformDocumentationParity(): void {
  if (!JSON_MODE) console.log('\n=== Check P-01: Platform Documentation Parity ===');
  
  const claudePath = join(ROOT, 'CLAUDE.md');
  const geminiPath = join(ROOT, 'GEMINI.md');
  
  if (!existsSync(claudePath) || !existsSync(geminiPath)) return;
  
  const extractSections = (content: string) => {
    const matches = content.matchAll(/^#{2,4} (.+)$/gm);
    return new Set(Array.from(matches).map(m => m[1].trim().replace(/^\d+\.\s*/, '')));
  };
  
  const claudeSections = extractSections(readFileSync(claudePath, 'utf-8'));
  const geminiSections = extractSections(readFileSync(geminiPath, 'utf-8'));
  
  // Parity between root CLAUDE.md and root GEMINI.md
  const ignoreParity = [
    'Claude Code-Specific Behaviors', 
    'Project-Specific Gemini Settings', 
    'Tool Name Mapping & Safeguards', 
    'Native Antigravity 2.0 Features', 
    'Git & PR Additions (Claude Code)',
    'Git & PR Additions (Gemini)',
    'Gemini-Specific & Antigravity Workflows',
    'Active Antigravity Tool Suite Mapping & Safeguards',
    'Planning Mode & Artifact Specifications',
    'Subagent Instantiation & Async Orchestration',
    'Automated Hooks',
    'Native Slash Commands',
    'MCP Configurations & Absolute Resolving',
    'Native Sub-agents',
    'Native Plan Mode',
    'Task Tracking',
    'Custom Command Error Recovery',
    'Windows Platform Requirement',
    'Language Policy for Documentation',
    'Agent Dispatch Rules',
    'Lifecycle Management Rules',
    'Security & Hook Configuration',
    'Git Commit Policy',
    'Executing Project Commands',
    'Pre-PR Security Gate',
    'Model Selection Override',
    'Security Engagement Rules',
    'Surgical Multi-Replace Offset Safeguard',
    'Windows Terminal & Code Page Safeguard',
    'Grep Search 50-Match Cap Safeguard',
    'implementation_plan.md',
    'task.md',
    'walkthrough.md',
    'Define Subagent',
    'Invoke Subagent',
    'Communication',
    'Phase 4 Execution Loop',
    'Mandatory Execution Plan Display',
    'Specialist Agent List',
    'Superpowers Plugin & Cost Optimization'
  ];
  
  const isIgnored = (s: string) => ignoreParity.some(ignore => s.includes(ignore));
  
  const missingInClaude = [...geminiSections].filter(s => !claudeSections.has(s) && !isIgnored(s));
  const missingInGemini = [...claudeSections].filter(s => !geminiSections.has(s) && !isIgnored(s));
  
  if (missingInClaude.length > 0) {
    fail('root', 'platform-parity', `CLAUDE.md is missing sections present in GEMINI.md: ${missingInClaude.join(', ')}`);
  }
  if (missingInGemini.length > 0) {
    fail('root', 'platform-parity', `GEMINI.md is missing sections present in CLAUDE.md: ${missingInGemini.join(', ')}`);
  }
  if (missingInClaude.length === 0 && missingInGemini.length === 0) {
    pass('Platform parity: CLAUDE.md and GEMINI.md section parity OK');
  }
  
  // Sync check: Root vs Templates
  const templatesDir = readdirSync(TEMPLATES_DIR);
  for (const tpl of templatesDir) {
    if (tpl === 'common' || tpl.startsWith('.')) continue;
    const tplPath = join(TEMPLATES_DIR, tpl);
    if (!statSync(tplPath).isDirectory()) continue;
    
    for (const doc of ['CLAUDE.md', 'GEMINI.md']) {
      const rootDoc = join(ROOT, doc);
      const variantDoc = join(tplPath, doc);
      if (!existsSync(rootDoc) || !existsSync(variantDoc)) continue;
      
      const rootSecs = extractSections(readFileSync(rootDoc, 'utf-8'));
      const variantSecs = extractSections(readFileSync(variantDoc, 'utf-8'));
      
      const missingInVariant = [...rootSecs].filter(s => !variantSecs.has(s) && !isIgnored(s));
      
      if (missingInVariant.length > 0) {
        fail(tpl, 'template-sync', `templates/${tpl}/${doc} is missing sections from root ${doc}: ${missingInVariant.join(', ')}`);
      }
    }
  }

  // P-01b: Variant CLAUDE.md <-> GEMINI.md Specialist Agent List content parity
  if (!JSON_MODE) console.log('\n=== Check P-01b: Variant Specialist Agent List Parity ===');
  const extractAgentList = (content: string): string => {
    const match = content.match(/####\s*Specialist Agent List[\s\S]*?(?=\n###|\n##|\n---|\Z)/);
    return match ? match[0].trim() : '';
  };
  for (const tpl of templatesDir) {
    if (tpl === 'common' || tpl.startsWith('.')) continue;
    const tplPath = join(TEMPLATES_DIR, tpl);
    if (!statSync(tplPath).isDirectory()) continue;
    const claudeVariant = join(tplPath, 'CLAUDE.md');
    const geminiVariant = join(tplPath, 'GEMINI.md');
    if (!existsSync(claudeVariant) || !existsSync(geminiVariant)) continue;
    const claudeList = extractAgentList(readFileSync(claudeVariant, 'utf-8'));
    const geminiList = extractAgentList(readFileSync(geminiVariant, 'utf-8'));
    if (claudeList && geminiList && claudeList !== geminiList) {
      fail(tpl, 'agent-list-parity', `templates/${tpl}/CLAUDE.md and GEMINI.md have different Specialist Agent List content`, 'Apply identical §5 changes to both files');
    } else if (claudeList || geminiList) {
      pass(`${tpl}: Specialist Agent List parity OK`);
    }
  }
}

// Check P-02: Root .claude/commands/ and .gemini/commands/ must be mirrored in templates/common/
function checkRootCommonCommandsParity(): void {
  if (!JSON_MODE) console.log('\n=== Check P-02: Root ↔ Common Commands Parity ===');

  const pairs = [
    {
      rootDir: join(ROOT, '.claude', 'commands'),
      commonDir: join(TEMPLATES_DIR, 'common', '.claude', 'commands'),
      label: '.claude/commands',
    },
    {
      rootDir: join(ROOT, '.gemini', 'commands'),
      commonDir: join(TEMPLATES_DIR, 'common', '.gemini', 'commands'),
      label: '.gemini/commands',
    },
  ];

  for (const { rootDir, commonDir, label } of pairs) {
    if (!existsSync(rootDir)) continue;
    const rootFiles = readdirSync(rootDir).filter(f => f.endsWith('.md'));
    const commonFiles = existsSync(commonDir)
      ? new Set(readdirSync(commonDir).filter(f => f.endsWith('.md')))
      : new Set<string>();

    const missing = rootFiles.filter(f => !commonFiles.has(f));
    if (missing.length > 0) {
      fail('root', 'command-parity',
        `Root ${label}/ has files not mirrored in templates/common/${label}/: ${missing.join(', ')}`,
        `Copy missing files to templates/common/${label}/`
      );
    } else {
      pass(`Root ↔ common ${label} parity OK (${rootFiles.length} file(s))`);
    }
  }
}

// Check B-05: Per-variant skill lifecycle (presence-driven)
function checkVariantSkills(variant: string): void {
  const skillsDir = join(TEMPLATES_DIR, variant, 'skills');
  if (!existsSync(skillsDir)) {
    pass(`${variant}/skills/: not present (OK — skill lifecycle check not applicable)`);
    return;
  }

  if (!JSON_MODE) console.log(`\n=== Check B-05: Skill lifecycle in ${variant} ===`);

  const dirs = readdirSync(skillsDir).filter(d =>
    d !== '_archive' && statSync(join(skillsDir, d)).isDirectory()
  );

  if (dirs.length === 0) {
    warn(variant, 'skill-lifecycle', `${variant}/skills/ exists but contains no skill directories`);
    return;
  }

  let missingSkillMd = 0;
  let deprecatedCount = 0;
  for (const skillName of dirs) {
    const skillMd = join(skillsDir, skillName, 'SKILL.md');
    if (!existsSync(skillMd)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md missing`, `Create SKILL.md with required frontmatter`);
      missingSkillMd++;
      continue;
    }
    const content = readFileSync(skillMd, 'utf-8');
    const fields = parseFrontmatter(content);
    if (!('name' in fields) || !('description' in fields)) {
      fail(variant, 'skill-lifecycle', `${variant}/skills/${skillName}/SKILL.md missing required frontmatter (name, description)`);
    }
    if ('status' in fields) {
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      const statusVal = statusLine ? statusLine.slice(statusLine.indexOf(':') + 1).trim() : '';
      if (statusVal === 'deprecated') deprecatedCount++;
    }
  }

  if (missingSkillMd === 0) {
    if (deprecatedCount > 0) {
      warn(variant, 'skill-lifecycle', `${variant}/skills/: ${deprecatedCount} deprecated skill(s) — remove before stable promotion`);
    } else {
      pass(`${variant}/skills/: ${dirs.length} skill(s) OK, no deprecated`);
    }
  }
}

// Check 11: Variant Contract compliance
function checkVariantContract(variant: string): void {
  if (!JSON_MODE) console.log(`\n=== Check 11: Variant Contract compliance in ${variant} ===`);

  try {
    const contractPath = join(ROOT, 'docs', 'templates', 'variant-contract.json');
    if (!existsSync(contractPath)) {
      fail('root', 'variant-contract-missing', 'docs/templates/variant-contract.json not found', 'Create variant-contract.json with version, required, optional fields');
      return;
    }

    const contractRaw = readFileSync(contractPath, 'utf-8');
    let contract: VariantContract;

    try {
      contract = JSON.parse(contractRaw) as VariantContract;
    } catch (parseError) {
      fail('root', 'variant-contract-invalid', 'docs/templates/variant-contract.json is not valid JSON', 'Fix JSON syntax');
      return;
    }

    const variantDir = join(TEMPLATES_DIR, variant);
    const missingFiles: string[] = [];

    const commonDir = join(TEMPLATES_DIR, 'common');
    for (const requiredFile of contract.required) {
      const filePath = join(variantDir, requiredFile);
      const commonFilePath = join(commonDir, requiredFile);
      // A required file is satisfied if it exists in the variant OR in templates/common/
      // (common-inherited files are copied to the project by new-project.sh)
      if (!existsSync(filePath) && !existsSync(commonFilePath)) {
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

// B-07: Sync scan results back to VERSION_REGISTRY.json
function updateVersionRegistry(manifests: Map<string, VariantManifest>): void {
  const registryPath = join(ROOT, 'docs', 'templates', 'VERSION_REGISTRY.json');
  if (!existsSync(registryPath)) return;

  let registry: Record<string, unknown>;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return;
  }

  const variants = (registry.variants ?? {}) as Record<string, Record<string, unknown>>;
  let changed = false;
  const today = new Date().toISOString().slice(0, 10);

  for (const [name, manifest] of manifests) {
    const existing = variants[name] ?? {};
    const newStatus = manifest.status;
    const newVersion = manifest.version ?? existing.latest ?? '0.0.0';

    if (existing.status !== newStatus || existing.latest !== newVersion) {
      variants[name] = {
        ...existing,
        latest: newVersion,
        status: newStatus,
        released: existing.released ?? today,
        security_advisories: existing.security_advisories ?? [],
        migration_guides: existing.migration_guides ?? [],
      };
      changed = true;
      if (!JSON_MODE) pass(`VERSION_REGISTRY.json: ${name} synced (status=${newStatus}, version=${newVersion})`);
    }
  }

  if (changed) {
    registry.variants = variants;
    registry.last_updated = today;
    writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n', 'utf-8');
    if (!JSON_MODE) pass(`VERSION_REGISTRY.json updated (last_updated=${today})`);
  } else {
    if (!JSON_MODE) pass('VERSION_REGISTRY.json already up-to-date');
  }
}

// B-08: Check for deprecated agents/skills in variant and warn about version bump
function checkDeprecatedVersionBump(variant: string, manifest: VariantManifest): void {
  const agentsDir = join(TEMPLATES_DIR, variant, 'agents');
  const skillsDir = join(TEMPLATES_DIR, variant, 'skills');

  let deprecatedAgents = 0;
  let deprecatedSkills = 0;

  if (existsSync(agentsDir)) {
    for (const file of readdirSync(agentsDir).filter(f => f.endsWith('.md') && !f.startsWith('README'))) {
      const content = readFileSync(join(agentsDir, file), 'utf-8');
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      if (statusLine && statusLine.includes('deprecated')) deprecatedAgents++;
    }
  }

  if (existsSync(skillsDir)) {
    for (const d of readdirSync(skillsDir).filter(d => d !== '_archive' && statSync(join(skillsDir, d)).isDirectory())) {
      const skillMd = join(skillsDir, d, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      const content = readFileSync(skillMd, 'utf-8');
      const statusLine = content.split('\n').find(l => l.startsWith('status:'));
      if (statusLine && statusLine.includes('deprecated')) deprecatedSkills++;
    }
  }

  if (deprecatedAgents > 0 || deprecatedSkills > 0) {
    const currentVersion = manifest.version ?? '0.0.0';
    const parts = currentVersion.split('.').map(Number);
    const bumpedVersion = `${parts[0]}.${parts[1]}.${(parts[2] ?? 0) + 1}`;
    warn(
      variant,
      'deprecated-version-bump',
      `${variant} has ${deprecatedAgents} deprecated agent(s) and ${deprecatedSkills} deprecated skill(s) — consider bumping patch version ${currentVersion} → ${bumpedVersion}`,
      `Update version in templates/${variant}/variant.json and VERSION_REGISTRY.json to ${bumpedVersion}`
    );
  }
}

// Check WS-01: workspace-schema.json consistency
function checkWorkspaceSchema(): void {
  if (!JSON_MODE) console.log('\n=== Check WS-01: workspace-schema.json consistency ===');

  const schemaPath = join(ROOT, 'workspace-schema.json');
  if (!existsSync(schemaPath)) {
    warn('root', 'ws-schema-missing', 'workspace-schema.json not found at workspace root', 'Create workspace-schema.json with workflow.phases and agent_tiers');
    return;
  }

  let schema: Record<string, unknown>;
  try {
    schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    fail('root', 'ws-schema-invalid', 'workspace-schema.json is not valid JSON');
    return;
  }

  pass('workspace-schema.json: present and valid JSON');

  const workflow = schema.workflow as Record<string, unknown> | undefined;
  const phases = workflow?.phases as Record<string, unknown> | undefined;
  const agentTiers = schema.agent_tiers as Record<string, string> | undefined;

  if (!phases) {
    fail('root', 'ws-schema-structure', 'workspace-schema.json missing workflow.phases');
    return;
  }

  const schemaPmOwned = (phases.pm_owned as string[] | undefined) ?? [];
  const schemaCanonical = (phases.canonical as string[] | undefined) ?? [];
  const schemaCount = phases.count as number | undefined;

  // --- WS-01 Check 1: agents/pm.md Can Lead Phases vs schema pm_owned ---
  const pmMdPath = join(ROOT, 'agents', 'pm.md');
  if (!existsSync(pmMdPath)) {
    warn('root', 'ws-01-pm-missing', 'agents/pm.md not found — skipping PM phase check');
  } else {
    const pmContent = readFileSync(pmMdPath, 'utf-8');
    const phaseLineMatch = pmContent.match(/\*{0,2}Can Lead Phases\*{0,2}\s*:\s*\[([^\]]+)\]/);
    if (!phaseLineMatch) {
      warn('root', 'ws-01-pm-phases', 'agents/pm.md: Can Lead Phases line not found');
    } else {
      const pmPhases = phaseLineMatch[1].split(',').map(s => s.trim().replace(/"/g, '').replace(/'/g, ''));
      const pmSorted = [...pmPhases].sort();
      const schemaSorted = [...schemaPmOwned].sort();
      if (JSON.stringify(pmSorted) === JSON.stringify(schemaSorted)) {
        pass(`agents/pm.md: Can Lead Phases [${pmPhases.join(', ')}] matches schema pm_owned`);
      } else {
        fail('root', 'ws-01-pm-phases',
          `[FAIL] agents/pm.md: Can Lead Phases [${pmPhases.join(', ')}] does not match workspace-schema.json pm_owned [${schemaPmOwned.join(', ')}]`,
          'Update Can Lead Phases in agents/pm.md or pm_owned in workspace-schema.json'
        );
      }
    }
  }

  // --- WS-01 Check 2: templates/common/docs/phase-definitions.md canonical phases ---
  const phaseDefPath = join(ROOT, 'templates', 'common', 'docs', 'phase-definitions.md');
  if (!existsSync(phaseDefPath)) {
    warn('root', 'ws-01-phase-defs-missing', 'templates/common/docs/phase-definitions.md not found — skipping canonical phase check');
  } else {
    const phaseDefContent = readFileSync(phaseDefPath, 'utf-8');
    // Extract phase identifiers from Phase Overview table rows (first column)
    const tableRowRegex = /^\|\s*([0-9][0-9-]*)\s*\|/gm;
    const foundPhases = new Set<string>();
    for (const m of phaseDefContent.matchAll(tableRowRegex)) {
      foundPhases.add(m[1].trim());
    }
    const missingFromDoc = schemaCanonical.filter(p => !foundPhases.has(p));
    if (missingFromDoc.length === 0) {
      pass(`templates/common/docs/phase-definitions.md: all ${schemaCanonical.length} canonical phases present`);
    } else {
      for (const missing of missingFromDoc) {
        fail('root', 'ws-01-phase-defs',
          `[FAIL] phase-definitions.md: missing phase "${missing}" from canonical list`,
          `Add phase "${missing}" to the Phase Overview table in templates/common/docs/phase-definitions.md`
        );
      }
    }
  }

  // --- WS-01 Check 3: docs/constitution/05-multi-agent-architecture.md phase count ---
  const constitutionPath = join(ROOT, 'docs', 'constitution', '05-multi-agent-architecture.md');
  if (!existsSync(constitutionPath)) {
    warn('root', 'ws-01-constitution-missing', 'docs/constitution/05-multi-agent-architecture.md not found — skipping phase count check');
  } else {
    const constitutionContent = readFileSync(constitutionPath, 'utf-8');
    // Find §5.4 section (including heading line) and look for "N phases" or "N-phase" pattern
    const section54Match = constitutionContent.match(/(#{1,4}\s*5\.4[^\n]*\n[\s\S]*?)(?=\n#{1,4}\s*5\.\d|$)/);
    const searchContent = section54Match ? section54Match[1] : constitutionContent;
    const phaseCountMatch = searchContent.match(/(\d+)[- ]phase/i) ?? searchContent.match(/(\d+)\s+phases/i);
    if (!phaseCountMatch) {
      warn('root', 'ws-01-constitution-count', 'constitution §5.4: phase count pattern not found (may be stated differently) — manual review recommended');
    } else {
      const declaredCount = parseInt(phaseCountMatch[1], 10);
      if (declaredCount === schemaCount) {
        pass(`docs/constitution/05-multi-agent-architecture.md §5.4: declares ${declaredCount} phases — matches schema`);
      } else {
        fail('root', 'ws-01-constitution-count',
          `[FAIL] constitution §5.4: declares ${declaredCount} phases, schema requires ${schemaCount}`,
          `Update phase count in docs/constitution/05-multi-agent-architecture.md §5.4 or workspace-schema.json workflow.phases.count`
        );
      }
    }
  }

  // --- WS-01 Check 4: agents/*.md tier frontmatter vs schema agent_tiers ---
  if (!agentTiers) {
    warn('root', 'ws-01-agent-tiers-missing', 'workspace-schema.json missing agent_tiers — skipping tier check');
  } else {
    const agentsDir = join(ROOT, 'agents');
    if (!existsSync(agentsDir)) {
      warn('root', 'ws-01-agents-dir', 'agents/ directory not found at workspace root — skipping tier check');
    } else {
      const agentFiles = readdirSync(agentsDir).filter(f =>
        f.endsWith('.md') && !f.startsWith('README') && !f.startsWith('handoff-spec')
      );

      const tierToModelKeyword: Record<string, string> = {
        high: 'opus',
        medium: 'sonnet',
        low: 'haiku',
      };

      for (const file of agentFiles) {
        const agentName = file.replace(/\.md$/, '');
        const filePath = join(agentsDir, file);
        const rawContent = readFileSync(filePath, 'utf-8');
        const content = normalizeContent(rawContent);

        // Extract frontmatter block
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        const fm = fmMatch[1];

        // Check if this agent is in schema
        if (!(agentName in agentTiers)) {
          // Not in schema — skip without warning (variant-specific agents are not in schema)
          continue;
        }

        const expectedTier = agentTiers[agentName];

        // Try simple tier: high/medium/low
        const simpleTierMatch = fm.match(/^tier:\s*(high|medium|low)\s*$/m);
        if (simpleTierMatch) {
          const actualTier = simpleTierMatch[1];
          if (actualTier === expectedTier) {
            pass(`agents/${file}: tier "${actualTier}" matches schema`);
          } else {
            fail('root', 'ws-01-agent-tier',
              `[FAIL] agents/${file}: tier "${actualTier}" does not match schema "${expectedTier}" for agent "${agentName}"`,
              `Update tier in agents/${file} or agent_tiers in workspace-schema.json`
            );
          }
          continue;
        }

        // Complex tier object — check claude: and gemini: sub-fields
        const claudeTierMatch = fm.match(/^\s+claude:\s*(high|medium|low)/m);
        const geminiTierMatch = fm.match(/^\s+gemini:\s*(high|medium|low)/m);
        
        if (claudeTierMatch || geminiTierMatch) {
          if (claudeTierMatch) {
            const claudeTier = claudeTierMatch[1];
            if (claudeTier === expectedTier) {
              pass(`agents/${file}: claude tier "${claudeTier}" matches schema`);
            } else {
              warn('root', 'ws-01-agent-tier-complex', `agents/${file}: claude tier "${claudeTier}" != schema "${expectedTier}"`);
            }
          }
          if (geminiTierMatch) {
            const geminiTier = geminiTierMatch[1];
            if (geminiTier === expectedTier) {
              pass(`agents/${file}: gemini tier "${geminiTier}" matches schema`);
            } else {
              warn('root', 'ws-01-agent-tier-complex', `agents/${file}: gemini tier "${geminiTier}" != schema "${expectedTier}"`);
            }
          }
        } else {
          // Can't reliably parse tier
          warn('root', 'ws-01-agent-tier-unreadable',
            `agents/${file}: tier block too complex to parse reliably — manual review recommended`
          );
        }
      }
    }
  }
}

// Check WS-02: common-contract.json compliance (C-CM-01, C-CM-02, C-SK-01, C-AG-01, C-AG-02, WS-02)
function checkCommonContract(): void {
  if (!JSON_MODE) console.log('\n=== Check WS-02: common-contract.json compliance ===');

  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) {
    warn('common', 'common-contract-missing', 'docs/templates/common-contract.json not found', 'Create common-contract.json with common_agents and common_skills');
    return;
  }

  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    fail('common', 'common-contract-invalid', 'docs/templates/common-contract.json is not valid JSON');
    return;
  }

  const commonSkills = Object.keys((contract.common_skills as Record<string, unknown>) ?? {});
  const commonAgents = Object.keys((contract.common_agents as Record<string, unknown>) ?? {});

  const variantDirs = readdirSync(TEMPLATES_DIR).filter(e => {
    const fullPath = join(TEMPLATES_DIR, e);
    try { return statSync(fullPath).isDirectory() && !e.startsWith('.') && e !== 'common'; } catch { return false; }
  });

  // C-CM-01 (ERROR): common/skills/ matches common-contract.json
  for (const skillName of commonSkills) {
    const skillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName, 'SKILL.md');
    if (!existsSync(skillPath)) {
      fail('common', 'C-CM-01', `common-contract.json lists common skill '${skillName}' but templates/common/skills/${skillName}/SKILL.md is missing`, `Create templates/common/skills/${skillName}/SKILL.md`);
    } else {
      pass(`C-CM-01: common skill '${skillName}' → SKILL.md present`);
    }
  }

  // C-CM-02 (ERROR): common/agents/ matches common-contract.json
  for (const agentName of commonAgents) {
    const agentPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(agentPath)) {
      fail('common', 'C-CM-02', `common-contract.json lists common agent '${agentName}' but templates/common/agents/${agentName}.md is missing`, `Create templates/common/agents/${agentName}.md`);
    } else {
      pass(`C-CM-02: common agent '${agentName}' → agent file present`);
    }
  }

  // C-SK-01 (WARNING): No duplicate common skills in variant dirs
  for (const skillName of commonSkills) {
    const commonSkillPath = join(TEMPLATES_DIR, 'common', 'skills', skillName, 'SKILL.md');
    if (!existsSync(commonSkillPath)) continue; // C-CM-01 already flagged this
    const commonContent = normalizeContent(readFileSync(commonSkillPath, 'utf-8'));
    for (const variant of variantDirs) {
      const variantSkillPath = join(TEMPLATES_DIR, variant, 'skills', skillName, 'SKILL.md');
      if (existsSync(variantSkillPath)) {
        const variantContent = normalizeContent(readFileSync(variantSkillPath, 'utf-8'));
        if (variantContent === commonContent) {
          warn(variant, 'C-SK-01', `Duplicate common skill '${skillName}' in ${variant}/skills/ — remove variant copy to inherit from common`);
        }
      }
    }
  }

  // C-AG-01 (WARNING): No duplicate common agents in variant dirs
  for (const agentName of commonAgents) {
    const commonAgentPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(commonAgentPath)) continue; // C-CM-02 already flagged this
    const commonContent = normalizeContent(readFileSync(commonAgentPath, 'utf-8'));
    for (const variant of variantDirs) {
      const variantAgentPath = join(TEMPLATES_DIR, variant, 'agents', `${agentName}.md`);
      if (existsSync(variantAgentPath)) {
        const variantContent = normalizeContent(readFileSync(variantAgentPath, 'utf-8'));
        if (variantContent === commonContent) {
          warn(variant, 'C-AG-01', `Duplicate common agent '${agentName}' in ${variant}/agents/ — remove variant copy to inherit from common`);
        }
      }
    }
  }

  // C-AG-02 (INFO/WARNING): Replacement overrides flagged
  for (const variant of variantDirs) {
    const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
    if (!existsSync(variantJsonPath)) continue;
    let variantJson: Record<string, unknown>;
    try {
      variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
    } catch { continue; }
    const agentOverrides = variantJson.agent_overrides as Record<string, Record<string, unknown>> | undefined;
    if (!agentOverrides) continue;
    for (const [agentName, override] of Object.entries(agentOverrides)) {
      if (override.type === 'replacement') {
        const reason = (override.reason as string | undefined) ?? 'no reason given';
        warn(variant, 'C-AG-02', `${variant}: ${agentName} has replacement override (reason: ${reason}) — lifecycle-manager review confirmed`);
      }
    }
  }

  // C-SK-02: Invariant sections identical across all variant pm.md files
  // Also: skeleton must not contain variant-specific agent names
  const commonAgentsMap = (contract.common_agents as Record<string, Record<string, unknown>>) ?? {};
  for (const [agentName, agentMeta] of Object.entries(commonAgentsMap)) {
    const skeletonSections = (agentMeta.skeleton_sections as string[] | undefined) ?? [];
    if (skeletonSections.length === 0) continue;

    const skeletonPath = join(TEMPLATES_DIR, 'common', 'agents', `${agentName}.md`);
    if (!existsSync(skeletonPath)) continue; // C-CM-02 already flagged this

    const skeletonRaw = normalizeContent(readFileSync(skeletonPath, 'utf-8'));

    // Helper: extract section content (heading line + body until next ## heading)
    function extractSection(content: string, heading: string): string | null {
      // Match the heading line (## heading, possibly with bold/emoji prefix)
      // We search for lines that contain the heading text after ##
      const lines = content.split('\n');
      let startIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && line.includes(heading)) {
          startIdx = i;
          break;
        }
      }
      if (startIdx === -1) return null;

      // Collect until next ## heading
      const sectionLines: string[] = [lines[startIdx]];
      for (let i = startIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) break;
        sectionLines.push(lines[i]);
      }
      return sectionLines.join('\n').trimEnd();
    }

    // Build map of invariant section content from skeleton
    const invariantSections = new Map<string, string>();
    for (const sectionTitle of skeletonSections) {
      const content = extractSection(skeletonRaw, sectionTitle);
      if (content !== null) {
        invariantSections.set(sectionTitle, content);
      }
    }

    // Check each variant
    for (const variant of variantDirs) {
      const variantAgentPath = join(TEMPLATES_DIR, variant, 'agents', `${agentName}.md`);
      if (!existsSync(variantAgentPath)) continue; // variant inherits from common — no override to check

      const variantRaw = normalizeContent(readFileSync(variantAgentPath, 'utf-8'));

      // Check if variant uses extends pattern
      const variantFields = parseFrontmatter(variantRaw);
      const hasExtends = 'extends' in variantFields;

      if (hasExtends) {
        // Variant using extends should ONLY contain the extends field in frontmatter
        // This is the new pattern — variant is a pure reference to skeleton
        const fieldKeys = Object.keys(variantFields);
        const nonExtendsKeys = fieldKeys.filter(k => k !== 'extends');

        if (nonExtendsKeys.length > 0) {
          warn(variant, 'C-SK-02',
            `C-SK-02: ${variant}/agents/${agentName}.md uses 'extends' but also has other frontmatter fields: ${nonExtendsKeys.join(', ')} — with extends, only the extends field should be present`,
            `Remove extra frontmatter fields from variant file or remove extends and use additive override pattern`
          );
        }

        // Skip the rest of the checks for extends-based variants
        // The skeleton file is already validated above
        continue;
      }

      // Sub-check A: no <!-- VARIANT-SECTION: markers should remain in scaffolded file
      if (variantRaw.includes('<!-- VARIANT-SECTION:')) {
        fail(variant, 'C-SK-02',
          `C-SK-02: ${variant}/agents/${agentName}.md contains unresolved <!-- VARIANT-SECTION: --> markers — skeleton not fully scaffolded`,
          `Replace all <!-- VARIANT-SECTION: --> blocks with actual variant-specific content`
        );
      }

      // Sub-check B: invariant sections — behavior depends on override type
      // additive: skeleton provides invariant sections → missing in variant is EXPECTED (skip warn)
      // replacement: variant provides everything → missing invariant = may have been stripped (warn)
      // both: if invariant section IS present but DIFFERENT → always warn
      const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
      let overrideType = 'replacement'; // conservative default
      if (existsSync(variantJsonPath)) {
        try {
          const vj = JSON.parse(readFileSync(variantJsonPath, 'utf-8'));
          overrideType = vj.agent_overrides?.[agentName]?.type ?? 'replacement';
        } catch { /* keep default */ }
      }

      for (const [sectionTitle, skeletonContent] of invariantSections) {
        const variantContent = extractSection(variantRaw, sectionTitle);
        if (variantContent === null) {
          if (overrideType !== 'additive') {
            warn(variant, 'C-SK-02',
              `C-SK-02: ${variant}/agents/${agentName}.md is missing invariant section '## ${sectionTitle}' — may have been stripped during override`,
              `Restore the '## ${sectionTitle}' section from templates/common/agents/${agentName}.md`
            );
          }
          // additive: missing invariant section is EXPECTED — skeleton provides it at scaffolding time
        } else if (variantContent !== skeletonContent) {
          warn(variant, 'C-SK-02',
            `C-SK-02: ${variant}/agents/${agentName}.md has modified invariant section '## ${sectionTitle}' — invariant sections should not be changed in variant overrides`,
            `Restore '## ${sectionTitle}' to match templates/common/agents/${agentName}.md, or promote the change to the skeleton`
          );
        }
      }
    }

    // Sub-check C: skeleton must not contain variant-specific agent names
    const variantSpecificNames = ['designer', 'code-writer', 'test-runner', 'red-team-lead'];
    for (const agentSpecificName of variantSpecificNames) {
      // Search in non-frontmatter body only (strip frontmatter)
      const bodyStart = skeletonRaw.indexOf('\n---\n', skeletonRaw.indexOf('---\n'));
      const body = bodyStart !== -1 ? skeletonRaw.slice(bodyStart + 5) : skeletonRaw;
      // Use word-boundary-style check: the name must appear as a standalone reference
      const nameRegex = new RegExp(`(?<![a-z])${agentSpecificName.replace('-', '[- ]')}(?![a-z])`, 'i');
      if (nameRegex.test(body)) {
        warn('common', 'C-SK-02',
          `C-SK-02: Skeleton templates/common/agents/${agentName}.md contains variant-specific agent name: '${agentSpecificName}' — skeleton should be agent-agnostic`,
          `Remove or generalize the reference to '${agentSpecificName}' in the skeleton`
        );
      }
    }
  }
  if (!JSON_MODE) pass('C-SK-02: invariant section check complete');

  // WS-02 (WARNING): Anti-swelling 50% rule
  const totalVariants = variantDirs.length;
  for (const agentName of commonAgents) {
    let overrideCount = 0;
    for (const variant of variantDirs) {
      const variantJsonPath = join(TEMPLATES_DIR, variant, 'variant.json');
      if (!existsSync(variantJsonPath)) continue;
      let variantJson: Record<string, unknown>;
      try {
        variantJson = JSON.parse(readFileSync(variantJsonPath, 'utf-8')) as Record<string, unknown>;
      } catch { continue; }
      const agentOverrides = variantJson.agent_overrides as Record<string, unknown> | undefined;
      if (agentOverrides && agentName in agentOverrides) overrideCount++;
    }
    const agentContract = (contract.common_agents as Record<string, Record<string, unknown>>)?.[agentName];
    if (agentContract?.expected_override_all_variants) {
      // skip anti-swelling check for this agent — all variants are expected to override
    } else if (totalVariants > 0 && overrideCount / totalVariants >= 0.5) {
      warn('common', 'WS-02', `Anti-swelling alert: '${agentName}' overridden by ${overrideCount}/${totalVariants} variants — consider updating common definition`);
    }
  }

  pass('WS-02: common-contract.json compliance check complete');
}

// Main
function main() {
  if (!JSON_MODE) {
    console.log(`${colors.cyan}Template Lifecycle Validator${colors.reset}`);
    console.log(`${colors.dim}Root: ${ROOT}${colors.reset}`);
    console.log(`${colors.dim}Variant filter: ${variantArg}${colors.reset}`);
  }

  loadGovernance();
  checkGovernance();
  checkVersion();
  checkCommon();
  const manifests = checkVariantManifests();

  // Check common/ commands and parity
  checkCommands('common');
  checkScriptParity('common');

  let variantsChecked = 0;
  for (const [variant, manifest] of manifests) {
    if (variantArg !== 'all' && variant !== variantArg) continue;

    // Check Variant Contract for all variants (including draft)
    checkVariantContract(variant);
    checkSecurityGateSkills(variant);          // B-03
    checkVariantSkills(variant);               // B-05: presence-driven skill lifecycle
    checkDeprecatedVersionBump(variant, manifest); // B-08: deprecated → version bump warning

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

  checkWorkspaceSchema();
  checkCommonContract();
  checkSharedFileSync();
  checkL0L1ScriptParity();
  checkPlatformDocumentationParity();
  checkRootCommonCommandsParity();

  // B-07: Sync validated variant info back to VERSION_REGISTRY.json
  if (!JSON_MODE) console.log('\n=== B-07: VERSION_REGISTRY.json sync ===');
  updateVersionRegistry(manifests);

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

