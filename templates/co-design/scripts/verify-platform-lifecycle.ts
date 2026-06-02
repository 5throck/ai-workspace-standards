#!/usr/bin/env bun
/**
 * verify-platform-lifecycle.ts — Platform Skill and Command lifecycle verification.
 *
 * Checks:
 *   E: .claude/skills/ and .gemini/skills/ version: field completeness
 *   F: .claude/skills/ <-> .gemini/skills/ version synchronization
 *   G: .claude/commands/ <-> templates/common/.claude/commands/ parity (Tier 1 only)
 *   H: Platform Skill propagation to templates/common/ (Tier 1 only)
 *
 * Tier 1 vs Tier 3 auto-detection: if variant.json exists in cwd, runs Tier 3 subset (E+F only).
 *
 * @version 1.1.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const ROOT = process.cwd();

// Auto-detect Tier 1 vs Tier 3
const IS_TIER3 = existsSync(join(ROOT, 'variant.json'));
const LEVEL = IS_TIER3 ? 'Tier 3' : 'Tier 1 SSOT';

const issues: Array<{ level: 'error' | 'warning'; check: string; message: string; fix?: string }> = [];

function pass(msg: string) {
  if (!JSON_MODE) console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
}
function fail(check: string, msg: string, fix?: string) {
  issues.push({ level: 'error', check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
    if (fix) console.log(`       \x1b[2mFix: ${fix}\x1b[0m`);
  }
}
function warn(check: string, msg: string, fix?: string) {
  issues.push({ level: 'warning', check, message: msg, fix });
  if (!JSON_MODE) {
    console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
    if (fix) console.log(`       \x1b[2mFix: ${fix}\x1b[0m`);
  }
}

function getSkillVersion(skillMdPath: string): string | null {
  if (!existsSync(skillMdPath)) return null;
  const content = readFileSync(skillMdPath, 'utf-8');
  const match = content.match(/^version:\s*(\d+\.\d+\.\d+)/m);
  return match ? match[1] : null;
}

function listSkillDirs(baseDir: string): string[] {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir).filter(d =>
    !d.startsWith('_') && statSync(join(baseDir, d)).isDirectory()
  );
}

// Check E: version: field completeness
function checkE(): void {
  if (!JSON_MODE) console.log(`=== Check E: Platform Skill version: completeness (${LEVEL}) ===`);

  for (const platform of ['.claude', '.gemini']) {
    const skillsDir = join(ROOT, platform, 'skills');
    for (const skillName of listSkillDirs(skillsDir)) {
      const skillMd = join(skillsDir, skillName, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      const ver = getSkillVersion(skillMd);
      if (!ver) {
        fail('platform-skill-version', `${platform}/skills/${skillName}/SKILL.md missing version: field`,
          `Add 'version: 1.0.0' to frontmatter`);
      } else {
        pass(`${platform}/skills/${skillName}: version ${ver}`);
      }
    }
  }
}

// Check F: .claude/skills/ <-> .gemini/skills/ version sync
function checkF(): void {
  if (!JSON_MODE) console.log(`\n=== Check F: Platform Skill version sync .claude/ <-> .gemini/ (${LEVEL}) ===`);

  const claudeSkillsDir = join(ROOT, '.claude', 'skills');
  for (const skillName of listSkillDirs(claudeSkillsDir)) {
    const claudeVer = getSkillVersion(join(claudeSkillsDir, skillName, 'SKILL.md'));
    const geminiVer = getSkillVersion(join(ROOT, '.gemini', 'skills', skillName, 'SKILL.md'));

    if (claudeVer && geminiVer && claudeVer !== geminiVer) {
      fail('platform-skill-version-sync',
        `${skillName}: .claude/skills version ${claudeVer} != .gemini/skills version ${geminiVer}`,
        `Sync version fields to match`);
    } else if (claudeVer && !geminiVer && existsSync(join(ROOT, '.gemini', 'skills', skillName))) {
      warn('platform-skill-version-sync',
        `${skillName}: .claude/skills has version ${claudeVer} but .gemini/skills missing version:`,
        `Add version: ${claudeVer} to .gemini/skills/${skillName}/SKILL.md`);
    } else if (claudeVer) {
      pass(`${skillName}: version sync OK (${claudeVer})`);
    }
  }
}

// Check G: .claude/commands/ parity with templates/common/ (Tier 1 only)
function checkG(): void {
  if (IS_TIER3) return; // Tier 3 projects don't have templates/common/
  if (!JSON_MODE) console.log('\n=== Check G: Platform Command propagation to templates/common/ (Tier 1 -> Tier 2) ===');

  for (const platform of ['.claude', '.gemini']) {
    const cmdDir = join(ROOT, platform, 'commands');
    const commonCmdDir = join(ROOT, 'templates', 'common', platform, 'commands');
    if (!existsSync(cmdDir)) continue;

    const rootFiles = readdirSync(cmdDir).filter(f => f.endsWith('.md'));
    const commonFiles = existsSync(commonCmdDir)
      ? new Set(readdirSync(commonCmdDir).filter(f => f.endsWith('.md')))
      : new Set<string>();

    const missing = rootFiles.filter(f => !commonFiles.has(f));
    if (missing.length > 0) {
      fail('platform-command-propagation',
        `${platform}/commands/ files not in templates/common/${platform}/commands/: ${missing.join(', ')}`,
        `Run platform-command-lifecycle-manager skill`);
    } else {
      pass(`${platform}/commands/ → templates/common: all ${rootFiles.length} file(s) propagated`);
    }
  }
}

// Check H: Platform Skill propagation to templates/common/ (Tier 1 only)
// Only checks skills declared in common-contract.json common_platform_skills — not ALL workspace skills
function checkH(): void {
  if (IS_TIER3) return;
  if (!JSON_MODE) console.log('\n=== Check H: Platform Skill propagation to templates/common/ (Tier 1 -> Tier 2) ===');

  // Load common-contract.json to find skills that should be propagated
  const contractPath = join(ROOT, 'docs', 'templates', 'common-contract.json');
  if (!existsSync(contractPath)) {
    if (!JSON_MODE) console.log('       \x1b[2mSkipping: common-contract.json not found\x1b[0m');
    return;
  }
  let contract: Record<string, unknown>;
  try {
    contract = JSON.parse(readFileSync(contractPath, 'utf-8'));
  } catch {
    if (!JSON_MODE) console.log('       \x1b[2mSkipping: common-contract.json is not valid JSON\x1b[0m');
    return;
  }
  const platformSkills = contract['common_platform_skills'] as Record<string, unknown> | undefined;
  if (!platformSkills || Object.keys(platformSkills).length === 0) {
    pass('Check H: no common_platform_skills registered in common-contract.json (OK)');
    return;
  }

  for (const [skillName] of Object.entries(platformSkills)) {
    for (const platform of ['.claude', '.gemini']) {
      const commonPath = join(ROOT, 'templates', 'common', platform, 'skills', skillName, 'SKILL.md');
      if (!existsSync(commonPath)) {
        fail('platform-skill-propagation',
          `${platform}/skills/${skillName}/ not propagated to templates/common/${platform}/skills/`,
          `Run platform-skill-lifecycle-manager skill`);
      } else {
        pass(`${platform}/skills/${skillName}: propagated to templates/common/`);
      }
    }
  }
}

async function main() {
  if (!JSON_MODE) console.log(`=== verify-platform-lifecycle.ts (${LEVEL}) ===\n`);

  checkE();
  checkF();
  checkG();
  checkH();

  if (JSON_MODE) {
    console.log(JSON.stringify({ level: LEVEL, errors: issues.filter(i => i.level === 'error'), warnings: issues.filter(i => i.level === 'warning') }));
  } else if (issues.filter(i => i.level === 'error').length === 0) {
    console.log('\n\x1b[32m✅ Platform lifecycle checks passed.\x1b[0m');
  } else {
    console.log(`\n\x1b[31m❌ ${issues.filter(i => i.level === 'error').length} error(s) found.\x1b[0m`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
