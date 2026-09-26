#!/usr/bin/env bun
/**
 * verify-platform-lifecycle.ts — Platform Skill and Command lifecycle verification.
 *
 * Checks:
 *   E: platform mirror skills/ version: field completeness (5 mirrors)
 *   F: n-way version synchronization across the 5 platform mirrors
 *   G: command propagation to templates/common/ — .claude/commands and
 *      .gemini/commands 1:1, plus the .codex/prompts mapping (ADR-0077 D4);
 *      .agents/commands excluded (L0-resident by design — T-20260925-003)
 *   H: Platform Skill propagation to templates/common/ (5 mirrors, Tier 1 only)
 *
 * Tier 1 vs Tier 3 auto-detection: if variant.json exists in cwd, runs Tier 3 subset (E+F only).
 *
 * Net-new coverage (.agents/.codex legs, codex prompts leg) soaks in WARN per
 * ADR-0055; the dated promotion tickets (T-20260925-002, not-before 2026-10-09)
 * flip those to fail. The .hermes legs were promoted out of soak on 2026-09-25
 * (T-20260925-008: live hermes-agent E2E verification green). Pre-existing
 * .claude/.gemini semantics keep their severity.
 *
 * @version 1.5.0
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
// .hermes/skills joined in ADR-0088 W2 (same onboarding path as .agents/.codex)
// and was PROMOTED out of soak on 2026-09-25 (T-20260925-008: live hermes-agent
// v0.21.4 E2E — project skill discovery, frontmatter tolerance, AGENTS.md entry
// all verified green), so its legs run at fail severity like .claude/.gemini.
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

// ── Commands-surface registry (T-20260925-010: replaces the hardcoded
// ['.claude','.gemini'] pair loop — every platform's commands surface gets an
// explicit entry: a governed leg or a RECORDED exclusion, never a silent skip).
//   .claude/.gemini — 1:1 mirror into templates/common (fail severity, pre-existing)
//   .codex          — ADR-0077 D4 mapping .claude/commands → .codex/prompts
//                     (net-new WARN soak; promotion = T-20260925-002, 2026-10-09)
//   .agents         — L0-resident by design, consumed by the Antigravity CLI at the
//                     workspace root (spec 2026-09-25-propagation-engine-batch-design
//                     §6-D8, ticket T-20260925-003)
//   .hermes         — no commands mirror: skills are invoked natively as
//                     /<skill-name> (ADR-0088 D1, live-verified T-20260925-008)
interface CommandsSurface {
  platform: string;
  mode: 'mirror-1:1' | 'mapping' | 'excluded' | 'lockstep-root';
  /** soak=true emits WARN instead of FAIL on the mapping leg (ADR-0055). */
  soak?: boolean;
  /** Required for mode 'excluded' — the recorded reason an exclusion stands. */
  exclusionNote?: string;
}

// .agents/commands is L0-resident (T-20260925-003): it never propagates to
// templates/common, but it IS governed — same-commit lockstep with
// .claude/commands. Files here are recorded exceptions to that lockstep:
//   - ADAPTED: intentionally platform-adapted content (differs from .claude)
//   - EXCLUDED: no .agents copy at all
const AGENTS_COMMANDS_ADAPTED: ReadonlySet<string> = new Set(['commit-push-pr.md']);
const AGENTS_COMMANDS_EXCLUDED: ReadonlySet<string> = new Set(['gateguard.md']);

export const COMMANDS_SURFACES: readonly CommandsSurface[] = [
  { platform: '.claude', mode: 'mirror-1:1' },
  { platform: '.gemini', mode: 'mirror-1:1' },
  { platform: '.codex', mode: 'mapping', soak: true },
  { platform: '.agents', mode: 'lockstep-root', soak: true },
  { platform: '.hermes', mode: 'excluded', exclusionNote: 'no commands mirror — Hermes invokes skills natively as /<skill-name> (ADR-0088 D1)' },
];

export function checkG(): void {
  if (IS_TIER3) return; // Tier 3 projects don't have templates/common/
  if (!JSON_MODE) console.log('\n=== Check G: Platform Command propagation to templates/common/ (Tier 1 -> Tier 2) ===');

  const claudeCmdDir = join(ROOT, '.claude', 'commands');

  for (const surface of COMMANDS_SURFACES) {
    if (surface.mode === 'excluded') {
      pass(`${surface.platform}/commands: recorded exclusion — ${surface.exclusionNote}`);
      continue;
    }

    if (surface.mode === 'mirror-1:1') {
      const cmdDir = join(ROOT, surface.platform, 'commands');
      const commonCmdDir = join(ROOT, 'templates', 'common', surface.platform, 'commands');
      if (!existsSync(cmdDir)) continue;

      const rootFiles = readdirSync(cmdDir).filter(f => f.endsWith('.md'));
      const commonFiles = existsSync(commonCmdDir)
        ? new Set(readdirSync(commonCmdDir).filter(f => f.endsWith('.md')))
        : new Set<string>();

      const missing = rootFiles.filter(f => !commonFiles.has(f));
      if (missing.length > 0) {
        fail('platform-command-propagation',
          `${surface.platform}/commands/ files not in templates/common/${surface.platform}/commands/: ${missing.join(', ')}`,
          `Run platform-command-lifecycle-manager skill`);
      } else {
        pass(`${surface.platform}/commands/ → templates/common: all ${rootFiles.length} file(s) propagated`);
      }
      continue;
    }

    // mode === 'mapping': .codex leg — ADR-0077 D4 (.claude/commands → .codex/prompts),
    // NO skip marker — Phase 1b mirrors unconditionally, a deliberate asymmetry.
    if (surface.mode === 'mapping') {
    const codexPromptsDir = join(ROOT, 'templates', 'common', '.codex', 'prompts');
    if (!existsSync(claudeCmdDir)) continue;
    const codexPrompts = existsSync(codexPromptsDir)
      ? new Set(readdirSync(codexPromptsDir).filter(f => f.endsWith('.md')))
      : new Set<string>();
    const claudeFiles = readdirSync(claudeCmdDir).filter(f => f.endsWith('.md'));
    const missingPrompts = claudeFiles.filter(f => !codexPrompts.has(f));
    const emit = surface.soak ? warn : fail;
    if (missingPrompts.length > 0) {
      emit('platform-command-propagation',
        `.claude/commands/ files with no templates/common/.codex/prompts/ counterpart (ADR-0077 D4 mapping; no skip marker on the codex leg)${surface.soak ? ' (soak: WARN until promotion)' : ''}: ${missingPrompts.join(', ')}`,
        `Re-run sync-skills (Phase 1b propagates prompts unconditionally)`);
    } else {
      pass(`.claude/commands/ → templates/common/.codex/prompts: all ${claudeFiles.length} prompt(s) propagated (mapping)`);
    }
    continue;
  }

  // mode === 'lockstep-root': the .agents leg (T-20260927-001). .agents/commands
  // never propagates to templates/common (L0-resident, T-20260925-003), but the
  // ruling requires same-commit lockstep WITH .claude/commands — existence for
  // every non-excluded command, and content parity for every non-adapted one.
  // This leg shipped 2026-09-27 after project-review.md drifted 2.5 months
  // behind with no gate watching; net-new → WARN soak per ADR-0055 (joins the
  // T-20260925-002 promotion scope).
  if (surface.mode === 'lockstep-root') {
    const agentsCmdDir = join(ROOT, '.agents', 'commands');
    if (!existsSync(claudeCmdDir) || !existsSync(agentsCmdDir)) continue;
    const agentsFiles = new Set(readdirSync(agentsCmdDir).filter(f => f.endsWith('.md')));
    const claudeFiles = readdirSync(claudeCmdDir).filter(f => f.endsWith('.md'));
    const emit = surface.soak ? warn : fail;
    const missing = claudeFiles.filter(f => !agentsFiles.has(f) && !AGENTS_COMMANDS_EXCLUDED.has(f));
    if (missing.length > 0) {
      emit('platform-command-propagation',
        `.claude/commands/ files with no .agents/commands/ counterpart (L0-resident lockstep, T-20260925-003)${surface.soak ? ' (soak: WARN until promotion)' : ''}: ${missing.join(', ')}`,
        `Copy the .claude/commands file to .agents/commands/, or record the exclusion`);
    }
    const drifted = claudeFiles
      .filter(f => agentsFiles.has(f) && !AGENTS_COMMANDS_ADAPTED.has(f))
      .filter(f => readFileSync(join(claudeCmdDir, f), 'utf-8') !== readFileSync(join(agentsCmdDir, f), 'utf-8'));
    if (drifted.length > 0) {
      emit('platform-command-propagation',
        `.agents/commands/ files drifted from .claude/commands/ (lockstep ruling T-20260925-003; platform adaptations must be recorded in AGENTS_COMMANDS_ADAPTED)${surface.soak ? ' (soak: WARN until promotion)' : ''}: ${drifted.join(', ')}`,
        `Re-sync from .claude/commands (the canonical source), or record the adaptation`);
    } else {
      pass(`.agents/commands/ ↔ .claude/commands/: lockstep holds (${claudeFiles.length - AGENTS_COMMANDS_EXCLUDED.size} governed file(s), ${AGENTS_COMMANDS_ADAPTED.size} adapted, ${AGENTS_COMMANDS_EXCLUDED.size} excluded)`);
    }
    continue;
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
      // (.hermes promoted 2026-09-25, T-20260925-008.)
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

if (import.meta.main) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
