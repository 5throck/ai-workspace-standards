#!/usr/bin/env bun
// @version 0.2.0
/**
 * prune-country-scoped-assets.ts
 *
 * Prunes country-specific skills, scripts, and env key blocks from generated
 * projects/L3 drafts based on the target country. Reads the country_scoped_assets
 * registry from workspace schema (SSOT) and removes assets whose registered country != target.
 *
 * Usage: bun scripts/helpers/prune-country-scoped-assets.ts <target-dir> <country|none>
 *
 * @country: ISO 3166-1 alpha-2 code (KR, US, etc.) or region code (EU, ASEAN)
 *           or "none" for region-neutral projects (prunes ALL scoped assets)
 *
 * Pruning rules:
 * - Skills: removes <target>/{skills,.claude/skills,.gemini/skills,.agents/skills}/<name>/
 * - Scripts: removes <target>/scripts/<name>*
 * - Env keys: parses <target>/.env.sample for # >>> country-scoped:<CODE> marker blocks
 *             and deletes blocks whose CODE != target country. For "none", deletes ALL blocks.
 *             Marker format: # >>> country-scoped:<CODE> opens, # <<< country-scoped:<CODE> closes.
 * - Idempotent: missing paths are silent; unbalanced marker blocks leave file unchanged
 * - Exit 0 on success, exit 1 on bad args
 */

import { readFileSync, existsSync, rmSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Argument parsing ────────────────────────────────────────────────────────
if (process.argv.length < 4) {
  console.error('Usage: bun scripts/helpers/prune-country-scoped-assets.ts <target-dir> <country|none>');
  process.exit(1);
}

const targetDir = process.argv[2];
const countryArg = process.argv[3];

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

let registry: { skills: Record<string, string>; scripts: Record<string, string>; env: Record<string, string> } = {
  skills: {},
  scripts: {},
  env: {}
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
    }
  } catch (error) {
    console.warn(`⚠️  Warning: Could not read workspace schema at ${schemaPath}. Proceeding with empty registry.`);
  }
} else {
  console.warn(`⚠️  Warning: Workspace schema not found at ${schemaPath}. Proceeding with empty registry.`);
}

// ── Pruning logic ───────────────────────────────────────────────────────────

let prunedCount = 0;

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
  const skillDirs = [
    'skills',
    '.claude/skills',
    '.gemini/skills',
    '.agents/skills'
  ];

  let removed = false;
  for (const skillDir of skillDirs) {
    const skillPath = join(targetDir, skillDir, skillName);
    if (safeRemove(skillPath)) {
      removed = true;
    }
  }

  if (removed) {
    console.log(`Pruned ${scopedCountry}-scoped skill: ${skillName}`);
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
 * Prune env key marker blocks from .env.sample
 */
function pruneEnvBlocks(): void {
  const envSamplePath = join(targetDir, '.env.sample');
  if (!existsSync(envSamplePath)) return;

  try {
    const content = readFileSync(envSamplePath, 'utf-8');
    const lines = content.split('\n');
    const output: string[] = [];
    let inBlock = false;
    let currentBlockCode: string | null = null;
    let blockStartLine = -1;
    let blockLines: string[] = [];
    let blocksDeleted = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const openMatch = line.match(/^# >>>\s*country-scoped:([A-Z]{2,4})/);
      const closeMatch = line.match(/^# <<<\s*country-scoped:([A-Z]{2,4})/);

      if (openMatch) {
        if (inBlock) {
          // Nested/unbalanced opening marker - warn and skip
          console.warn(`  ⚠️  Unbalanced marker at line ${i + 1}: nested opening marker without closing previous block. File left unchanged.`);
          return;
        }
        inBlock = true;
        currentBlockCode = openMatch[1];
        blockStartLine = i;
        blockLines = [line];
      } else if (closeMatch) {
        if (!inBlock) {
          console.warn(`  ⚠️  Unbalanced marker at line ${i + 1}: closing marker without opening. File left unchanged.`);
          return;
        }
        if (closeMatch[1] !== currentBlockCode) {
          console.warn(`  ⚠️  Unbalanced marker at line ${i + 1}: closing code '${closeMatch[1]}' doesn't match opening code '${currentBlockCode}'. File left unchanged.`);
          return;
        }

        // Complete block - decide whether to keep or delete
        blockLines.push(line);

        if (countryArg !== 'none' && countryArg !== '' && countryArg === currentBlockCode) {
          // Keep the block - country matches
          output.push(...blockLines);
        } else {
          // Delete the block - country doesn't match
          blocksDeleted++;
          console.log(`Pruned ${currentBlockCode}-scoped env block from .env.sample`);
        }

        inBlock = false;
        currentBlockCode = null;
        blockLines = [];
      } else if (inBlock) {
        blockLines.push(line);
      } else {
        output.push(line);
      }
    }

    // Check for unclosed block
    if (inBlock) {
      console.warn(`  ⚠️  Unbalanced marker: block starting at line ${blockStartLine + 1} has no closing marker. File left unchanged.`);
      return;
    }

    // Only rewrite if something was deleted
    if (blocksDeleted > 0) {
      writeFileSync(envSamplePath, output.join('\n'), 'utf-8');
      prunedCount += blocksDeleted;
    }
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

// Prune env marker blocks
pruneEnvBlocks();

if (prunedCount === 0) {
  console.log('No country-scoped assets needed pruning.');
} else {
  console.log(`Pruned ${prunedCount} country-scoped asset(s).`);
}

process.exit(0);
