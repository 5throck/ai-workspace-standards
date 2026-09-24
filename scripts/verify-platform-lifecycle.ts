#!/usr/bin/env bun
/**
 * verify-platform-lifecycle.ts — Platform Skill and Command lifecycle verification.
 *
 * Checks:
 *   E: platform mirror skills/ version: field completeness (4 mirrors)
 *   F: n-way version synchronization across the 4 platform mirrors
 *   G: command propagation to templates/common/ — .claude/commands and
 *      .gemini/commands 1:1, plus the .codex/prompts mapping (ADR-0077 D4);
 *      .agents/commands excluded (no producer/consumer — Finding D)
 *   H: Platform Skill propagation to templates/common/ (4 mirrors, Tier 1 only)
 *
 * Tier 1 vs Tier 3 auto-detection: if variant.json exists in cwd, runs Tier 3 subset (E+F only).
 *
 * Net-new coverage (.agents/.codex legs, codex prompts leg) soaks in WARN per
 * ADR-0055; the dated promotion ticket flips those to fail. Pre-existing
 * .claude/.gemini semantics keep their severity.
 *
 * @version 1.2.0
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PLATFORM_MIRROR_DIRS } from './lib/platforms.ts';

const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const ROOT = process.cwd();

// Auto-detect Tier 1 vs Tier 3
const IS_TIER3 = existsSync(join(ROOT, 'variant.json')) || !existsSync(join(ROOT, 'templates'));
const LEVEL = IS_TIER3 ? 'Tier 3' : 'Tier 1 SSOT';

const issues: Array<{ level: 'error' | 'warning'; check: string; message: string; fix?: string }> = [];
const VERSION_EXEMPT_PLATFORM_SKILLS = new Set([
  // ADR-0076 and the 2026-09-12 graft wiring refresh define this as a
  // Claude-only, tool-owned skill. graft rewrites the frontmatter on version
  // bumps, so workspace lifecycle fields would create recurring churn.
  '.claude/skills/graft',
]);

// Net-new mirror legs soak in WARN (ADR-0055) — TODO(promotion): flip to fail.
const SOAK_MIRRORS = new Set(['.agents/skills', '.codex/skills']);

function platformOf(mirrorDir: string): string {
  return mirrorDir.split('/')[0];
}

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
  const match = content.match(/^version:\s*"?(\d+\.\d+\.\d+)"?/m);
  return match ? match[1] : null;
}

function isVersionExempt(platform: string, skillName: string): boolean {
  return VERSION_EXEMPT_PLATFORM_SKILLS.has(`${platform}/skills/${skillName}`);
}

function listSkillDirs(baseDir: string): string[] {
  if (!existsSync(baseDir)) return [];
  return readdirSync(baseDir).filter(d =>
    !d.startsWith('_') && statSync(join(baseDir, d)).isDirectory()
  );
}

// Check E: version: field completeness (all 4 platform mirrors)
function checkE(): void {
  if (!JSON_MODE) console.log(`=== Check E: Platform Skill version: completeness (${LEVEL}, 4 mirrors) ===`);

  for (const mirrorDir of PLATFORM_MIRROR_DIRS) {
    const platform = platformOf(mirrorDir);
    const skillsDir = join(ROOT, mirrorDir);
    for (const skillName of listSkillDirs(skillsDir)) {
      const skillMd = join(skillsDir, skillName, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      if (isVersionExempt(platform, skillName)) {
        pass(`${platform}/skills/${skillName}: version exempt (tool-owned)`);
        continue;
      }
      const ver = getSkillVersion(skillMd);
      const soak = SOAK_MIRRORS.has(mirrorDir);
      const emit = soak ? warn : fail;
      if (!ver) {
        emit('platform-skill-version', `${platform}/skills/${skillName}/SKILL.md missing version: field${soak ? ' (soak: WARN until promotion)' : ''}`,
          `Add 'version: 1.0.0' to frontmatter`);
      } else {
        pass(`${platform}/skills/${skillName}: version ${ver}`);
      }
    }
  }
}

// Check F: n-way version sync across the 4 platform mirrors
// For each skill present in any mirror: collect the versions of every mirror
// carrying it. A .claude↔.gemini disagreement is pre-existing fail semantics;
// any other mismatch (e.g. .claude==.gemini vs .agents/.codex — the Finding-C
// shape) is net-new coverage soaking in WARN. A mirror directory present
// without a parseable version warns (pre-existing semantics, generalized).
function checkF(): void {
  if (!JSON_MODE) console.log(`\n=== Check F: Platform Skill version sync (n-way across 4 mirrors, ${LEVEL}) ===`);

  const union = new Set<string>();
  for (const mirrorDir of PLATFORM_MIRROR_DIRS) {
    for (const skillName of listSkillDirs(join(ROOT, mirrorDir))) union.add(skillName);
  }

  for (const skillName of [...union].sort()) {
    // graft (and any future entry in the exemption set) is version-exempt in
    // the mirror(s) it lives in — skip entirely (exemption semantics unchanged).
    const versions = new Map<string, string | null>();
    for (const mirrorDir of PLATFORM_MIRROR_DIRS) {
      const skillDir = join(ROOT, mirrorDir, skillName);
      if (!existsSync(skillDir)) continue;
      if (isVersionExempt(platformOf(mirrorDir), skillName)) continue;
      versions.set(mirrorDir, getSkillVersion(join(skillDir, 'SKILL.md')));
    }
    if (versions.size === 0) continue;

    for (const [mirrorDir, ver] of versions) {
      if (ver === null) {
        warn('platform-skill-version-sync',
          `${skillName}: ${mirrorDir} directory present but missing version:`,
          `Add a parseable version: field to ${mirrorDir}/${skillName}/SKILL.md`);
      }
    }

    const claudeVer = versions.get('.claude/skills') ?? null;
    const geminiVer = versions.get('.gemini/skills') ?? null;
    const distinct = new Set([...versions.values()].filter((v): v is string => v !== null));

    if (distinct.size > 1) {
      const detail = [...versions.entries()].map(([m, v]) => `${m}=${v ?? '<none>'}`).join(', ');
      if (claudeVer && geminiVer && claudeVer !== geminiVer) {
        fail('platform-skill-version-sync',
          `${skillName}: version mismatch across mirrors — ${detail}`,
          `Sync version fields to match`);
      } else {
        // Net-new mismatch shape (pre-existing pairwise check could not see it)
        // — soak in WARN; message text is what the Fail promotion will use.
        warn('platform-skill-version-sync',
          `${skillName}: version mismatch across mirrors — ${detail} (soak: WARN until promotion)`,
          `Sync version fields to match`);
      }
    } else if (distinct.size === 1) {
      pass(`${skillName}: version sync OK (${[...distinct][0]})`);
    }
  }
}

// Check G: command propagation to templates/common/ (Tier 1 only)
// .claude/commands and .gemini/commands mirror 1:1 (gemini honors its
// gemini-parity: skip marker). The .codex leg verifies the ADR-0077 D4 mapping
// (SSOT .claude/commands → templates/common/.codex/prompts) with NO skip
// marker — Phase 1b mirrors unconditionally, a deliberate asymmetry.
// .agents/commands is excluded: no producer, no documented consumer (design
// Finding D — govern-or-retire ticket; recorded exclusion, not a silent skip).
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

  // .codex leg: prompts mapping (net-new — soak in WARN; TODO(promotion): flip to fail)
  const claudeCmdDir = join(ROOT, '.claude', 'commands');
  const codexPromptsDir = join(ROOT, 'templates', 'common', '.codex', 'prompts');
  if (existsSync(claudeCmdDir)) {
    const codexPrompts = existsSync(codexPromptsDir)
      ? new Set(readdirSync(codexPromptsDir).filter(f => f.endsWith('.md')))
      : new Set<string>();
    const claudeFiles = readdirSync(claudeCmdDir).filter(f => f.endsWith('.md'));
    const missingPrompts = claudeFiles.filter(f => !codexPrompts.has(f));
    if (missingPrompts.length > 0) {
      warn('platform-command-propagation',
        `.claude/commands/ files with no templates/common/.codex/prompts/ counterpart (ADR-0077 D4 mapping; no skip marker on the codex leg) (soak: WARN until promotion): ${missingPrompts.join(', ')}`,
        `Re-run sync-skills (Phase 1b propagates prompts unconditionally)`);
    } else {
      pass(`.claude/commands/ → templates/common/.codex/prompts: all ${claudeFiles.length} prompt(s) propagated (mapping)`);
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
    for (const mirrorDir of PLATFORM_MIRROR_DIRS) {
      const platform = platformOf(mirrorDir);
      const commonPath = join(ROOT, 'templates', 'common', mirrorDir, skillName, 'SKILL.md');
      // Net-new mirrors (.agents/.codex) soak in WARN — TODO(promotion): flip to fail.
      const emit = SOAK_MIRRORS.has(mirrorDir) ? warn : fail;
      if (!existsSync(commonPath)) {
        emit('platform-skill-propagation',
          `${platform}/skills/${skillName}/ not propagated to templates/common/${platform}/skills/${SOAK_MIRRORS.has(mirrorDir) ? ' (soak: WARN until promotion)' : ''}`,
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
  if (import.meta.main) {
    process.exit(1);
  }
});
