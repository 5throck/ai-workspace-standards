#!/usr/bin/env bun
// @version 0.3.4
// v0.3.4 (2026-09-24, spec docs/designs/2026-09-24-platform-ssot-constant-design.md):
//         behavior-neutral constant adoption — the multi-line 5-element
//         skill-dir literal in pruneSkill() becomes PLATFORM_SKILL_BASES
//         (../lib/platforms.ts, same element sequence). NO behavior change.
// v0.3.3: Context-doc reference scrub accepts an optional <variant> argument and
//         scrubs every existing candidate (docs/context.md for L3 drafts,
//         docs/<variant>.context.md for projects, docs/<basename>.context.md).
//         The old basename-only derivation was a silent no-op whenever the project
//         directory name differed from the variant (2026-09-21 review H-7).
// v0.3.1: Env block pruning delegated to the shared lib/env-sample.ts parser (same
//         marker grammar, same keep/drop and unbalanced-marker-leave-unchanged semantics).
//         Behavior-preserving refactor — the upgrade path (upgrade-project.ts ENV_SAMPLE
//         SYNC) uses the same lib so scaffold pruning and upgrade re-delivery cannot drift.
// v0.3.0: New "dirs" registry category — prunes whole variant asset directories (e.g.
//         co-safety's regulations/KR/) whose content is country-specific, the same way
//         "skills"/"scripts"/"env" already do. Needed because new-project.ts's region-neutral
//         path (--yes with no --country, or interactive "Region-neutral" selection) is reachable
//         even for single-country variants like co-safety, and country-specific regulation
//         data has no other pruning mechanism (unlike skills, which had k-law/k-dart/k-kosis).
/**
 * prune-country-scoped-assets.ts
 *
 * Prunes country-specific skills, scripts, env key blocks, and asset directories from
 * generated projects/L3 drafts based on the target country. Reads the country_scoped_assets
 * registry from workspace schema (SSOT) and removes assets whose registered country != target.
 *
 * Usage: bun scripts/helpers/prune-country-scoped-assets.ts <target-dir> <country|none> [variant]
 *
 * @country: ISO 3166-1 alpha-2 code (KR, US, etc.) or region code (EU, ASEAN)
 *           or "none" for region-neutral projects (prunes ALL scoped assets)
 *
 * Pruning rules:
 * - Skills: removes <target>/{skills,.claude/skills,.gemini/skills,.agents/skills}/<name>/
 * - Scripts: removes <target>/scripts/<name>*
 * - Dirs: removes <target>/<relPath>/ wholesale (e.g. "regulations/KR")
 * - Env keys: parses <target>/.env.sample for # >>> country-scoped:<CODE> marker blocks
 *             and deletes blocks whose CODE != target country. For "none", deletes ALL blocks.
 *             Marker format: # >>> country-scoped:<CODE> opens, # <<< country-scoped:<CODE> closes.
 * - Idempotent: missing paths are silent; unbalanced marker blocks leave file unchanged
 * - Exit 0 on success, exit 1 on bad args
 */

import { readFileSync, existsSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneCountryScopedEnvBlocks } from '../lib/env-sample.ts';
import { PLATFORM_SKILL_BASES } from '../lib/platforms.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Argument parsing ────────────────────────────────────────────────────────
if (process.argv.length < 4) {
  console.error('Usage: bun scripts/helpers/prune-country-scoped-assets.ts <target-dir> <country|none>');
  process.exit(1);
}

const targetDir = process.argv[2];
const countryArg = process.argv[3];
// Optional variant name: projects name their context doc docs/<variant>.context.md and
// the project directory name may differ from the variant; L3 drafts use docs/context.md.
const variantArg = process.argv[4] && process.argv[4] !== 'none' ? process.argv[4] : undefined;

// Validate country pattern (ISO 3166-1 alpha-2 or well-known region codes)
if (countryArg !== 'none' && countryArg !== '' && !/^[A-Z]{2,4}$/.test(countryArg)) {
  console.error(`❌ Invalid country code: '${countryArg}'. Use ISO 3166-1 alpha-2 (KR, US), region code (EU, ASEAN), or 'none'.`);
  process.exit(1);
}

if (!existsSync(targetDir)) {
  console.error(`❌ Target directory not found: ${targetDir}`);
  process.exit(1);
}

// ── Load registry from workspace schema (SSOT) ──────────────────────────────
const workspaceRoot = resolve(__dirname, '../..');
const schemaPath = join(workspaceRoot, 'docs', 'workspace-schema.json');

let registry: { skills: Record<string, string>; scripts: Record<string, string>; env: Record<string, string>; dirs: Record<string, string> } = {
  skills: {},
  scripts: {},
  env: {},
  dirs: {}
};

if (existsSync(schemaPath)) {
  try {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent) as Record<string, unknown>;
    const countryScoped = schema.country_scoped_assets as Record<string, unknown> | undefined;

    if (countryScoped) {
      registry.skills = (countryScoped.skills as Record<string, string>) || {};
      registry.scripts = (countryScoped.scripts as Record<string, string>) || {};
      registry.env = (countryScoped.env as Record<string, string>) || {};
      registry.dirs = (countryScoped.dirs as Record<string, string>) || {};
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read workspace schema at ${schemaPath}. Proceeding with empty registry.`);
  }
} else {
  console.warn(`⚠️  Warning: Workspace schema not found at ${schemaPath}. Proceeding with empty registry.`);
}

// ── Pruning logic ───────────────────────────────────────────────────────────

let prunedCount = 0;
const prunedSkillNames: string[] = [];

/**
 * Safely remove a directory or file if it exists
 */
function safeRemove(targetPath: string): boolean {
  if (!existsSync(targetPath)) return false;

  try {
    const stat = statSync(targetPath);
    if (stat.isDirectory()) {
      rmSync(targetPath, { recursive: true, force: true });
    } else {
      rmSync(targetPath, { force: true });
    }
    return true;
  } catch (error) {
    console.warn(`  ⚠️  Could not remove ${targetPath}: ${error}`);
    return false;
  }
}

/**
 * Prune a skill from all mirror locations
 */
function pruneSkill(skillName: string, scopedCountry: string): void {
  // Prune if target country doesn't match (including region-neutral case)
  if (countryArg !== 'none' && countryArg !== '' && countryArg === scopedCountry) {
    return; // Keep the skill - country matches
  }

  // Mirror locations for skills
  const skillDirs = PLATFORM_SKILL_BASES;

  let removed = false;
  for (const skillDir of skillDirs) {
    const skillPath = join(targetDir, skillDir, skillName);
    if (safeRemove(skillPath)) {
      removed = true;
    }
  }

  if (removed) {
    console.log(`Pruned ${scopedCountry}-scoped skill: ${skillName}`);
    prunedSkillNames.push(skillName);
    prunedCount++;
  }
}

/**
 * Prune a script (by name pattern)
 */
function pruneScript(scriptName: string, scopedCountry: string): void {
  // Prune if target country doesn't match
  if (countryArg !== 'none' && countryArg !== '' && countryArg === scopedCountry) {
    return; // Keep the script - country matches
  }

  // Scripts are in scripts/ directory
  const scriptsDir = join(targetDir, 'scripts');
  if (!existsSync(scriptsDir)) return;

  try {
    const scripts = readdirSync(scriptsDir);
    const pattern = new RegExp(`^${scriptName}`);

    for (const script of scripts) {
      if (pattern.test(script)) {
        const scriptPath = join(scriptsDir, script);
        if (safeRemove(scriptPath)) {
          console.log(`Pruned ${scopedCountry}-scoped script: ${script}`);
          prunedCount++;
        }
      }
    }
  } catch (error) {
    console.warn(`  ⚠️  Could not read scripts directory: ${error}`);
  }
}

/**
 * Prune a variant asset directory (relative path from project root) whose content
 * is scoped to one country, e.g. "regulations/KR".
 */
function pruneDir(relPath: string, scopedCountry: string): void {
  // Prune if target country doesn't match (including region-neutral case)
  if (countryArg !== 'none' && countryArg !== '' && countryArg === scopedCountry) {
    return; // Keep the directory - country matches
  }

  const dirPath = join(targetDir, relPath);
  if (safeRemove(dirPath)) {
    console.log(`Pruned ${scopedCountry}-scoped directory: ${relPath}/`);
    prunedCount++;
  }
}

/**
 * Prune env key marker blocks from .env.sample — delegated to the shared
 * lib/env-sample-blocks.ts parser so scaffold-time and upgrade-time pruning
 * share one grammar and one keep/drop decision.
 */
function pruneEnvBlocks(): void {
  const envSamplePath = join(targetDir, '.env.sample');
  if (!existsSync(envSamplePath)) return;

  try {
    const result = pruneCountryScopedEnvBlocks(readFileSync(envSamplePath, 'utf-8'), countryArg);
    for (const warning of result.warnings) {
      console.warn(`  ⚠️  ${warning}`);
    }
    if (result.unbalanced || result.pruned.length === 0) return;
    for (const code of result.pruned) {
      console.log(`Pruned ${code}-scoped env block from .env.sample`);
    }
    writeFileSync(envSamplePath, result.output, 'utf-8');
    prunedCount += result.pruned.length;
  } catch (error) {
    console.warn(`  ⚠️  Could not process .env.sample: ${error}`);
  }
}

// ── Execute pruning ───────────────────────────────────────────────────────────

console.log(`Pruning country-scoped assets for: ${countryArg === 'none' || countryArg === '' ? 'region-neutral' : countryArg}`);

// Prune skills
for (const [skillName, scopedCountry] of Object.entries(registry.skills)) {
  pruneSkill(skillName, scopedCountry);
}

// Prune scripts
for (const [scriptName, scopedCountry] of Object.entries(registry.scripts)) {
  pruneScript(scriptName, scopedCountry);
}

// Prune variant asset directories
for (const [dirRelPath, scopedCountry] of Object.entries(registry.dirs)) {
  pruneDir(dirRelPath, scopedCountry);
}

// Prune env marker blocks
pruneEnvBlocks();

// ── Reference scrub (T-20260921-006): pruned skills must not survive as
// dangling references in AGENTS.md (skill-path table lines) or the variant
// context doc — a region-neutral scaffold otherwise fails its own audit.
function scrubPrunedSkillReferences(): void {
  if (prunedSkillNames.length === 0) return;
  let scrubbed = 0;

  const agentsPath = join(targetDir, 'AGENTS.md');
  if (existsSync(agentsPath)) {
    const lines = readFileSync(agentsPath, 'utf-8').split('\n');
    const kept = lines.filter(line =>
      !prunedSkillNames.some(n => line.includes(`skills/${n}/SKILL.md`)));
    if (kept.length !== lines.length) {
      writeFileSync(agentsPath, kept.join('\n'), 'utf-8');
      scrubbed += lines.length - kept.length;
    }
  }

  // Context-doc naming differs by delivery path (2026-09-21 review H-7): L3 drafts use
  // docs/context.md, scaffolded projects use docs/<variant>.context.md, and the project
  // directory name may differ from the variant. Scrub every candidate that exists.
  const ctxCandidates = [
    join(targetDir, 'docs', 'context.md'),
    join(targetDir, 'docs', `${basename(targetDir)}.context.md`),
    ...(variantArg ? [join(targetDir, 'docs', `${variantArg}.context.md`)] : []),
  ];
  for (const ctxPath of ctxCandidates) {
    if (!existsSync(ctxPath)) continue;
    const lines = readFileSync(ctxPath, 'utf-8').split('\n');
    const kept = lines.filter(line =>
      !prunedSkillNames.some(n => line.includes(`\`${n}\``)));
    if (kept.length !== lines.length) {
      writeFileSync(ctxPath, kept.join('\n'), 'utf-8');
      scrubbed += lines.length - kept.length;
    }
  }

  if (scrubbed > 0) {
    console.log(`Scrubbed ${scrubbed} dangling reference line(s) (AGENTS.md / context)`);
    prunedCount += scrubbed;
  }
}
scrubPrunedSkillReferences();

if (prunedCount === 0) {
  console.log('No country-scoped assets needed pruning.');
} else {
  console.log(`Pruned ${prunedCount} country-scoped asset(s).`);
}

process.exit(0);
