#!/usr/bin/env bun
/**
 * Platform Parity Validator — Design Doc §6.2, Validator #6
 * @version 1.1.0
 *
 * Ensures cross-platform parity between the variant's platform mirrors, using
 * .claude/ as the SSOT-side reference (spec
 * 2026-09-25-verifier-platform-expansion-design site 12, ruling D12):
 *   1. For each mirror (.gemini, .agents, .codex): skill-directory sets and
 *      command file sets must match .claude/'s counterparts.
 *   2. Codex command parity is NAME-MAPPED: .claude/commands/<x>.md must exist
 *      as .codex/prompts/<x>.md (ADR-0077 D4) — a mapping, not a directory
 *      mirror.
 *   3. Settings parity stays claude↔gemini (checked by
 *      helpers/validate-platform-parity.ts): settings.json is a Claude/Gemini
 *      concept; .codex/config.toml schema parity is out of scope.
 *   4. `mirror-parity: skip` in a .claude SKILL.md frontmatter means
 *      "claude-only parity" for all three non-claude mirrors; the legacy
 *      `gemini-parity: skip` marker is accepted as an alias (D3.4).
 *   5. Report missing counterparts as WARNING. Findings involving the
 *      .agents/.codex trees are net-new coverage soaking in WARN with a
 *      "(soak)" message suffix — the dated promotion ticket flips them to
 *      enforcement.
 */

import { join } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';
import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationIssue } from './types.ts';

/** The four platform trees, as [platform, mirror-root] pairs. */
const PLATFORM_TREES: ReadonlyArray<readonly [string, string]> = [
  ['gemini', '.gemini'],
  ['agents', '.agents'],
  ['codex', '.codex'],
];

/** Frontmatter skip markers honored for the non-claude mirrors (D3.4). */
function hasMirrorParitySkip(skillMdPath: string): boolean {
  try {
    const content = readFileSync(skillMdPath, 'utf-8');
    return /(^|\n)(mirror-parity|gemini-parity):\s*skip\s*(\n|$)/.test(content);
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List filenames (not paths) in a directory, or return empty array if directory
 * does not exist. Recursively collects filenames if recursive is true.
 */
function listFilenames(dirPath: string, recursive = false): string[] {
  if (!existsSync(dirPath)) return [];

  const entries = readdirSync(dirPath, { withFileTypes: true });
  const filenames: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      filenames.push(entry.name);
    } else if (entry.isDirectory() && recursive) {
      // For recursive mode (skills), list files inside subdirectories
      const subDir = join(dirPath, entry.name);
      const subEntries = readdirSync(subDir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile()) {
          filenames.push(`${entry.name}/${subEntry.name}`);
        }
      }
    }
  }

  return filenames;
}

/**
 * List top-level skill directories (a directory containing SKILL.md).
 */
function listSkillDirs(dirPath: string): string[] {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath, { withFileTypes: true })
    .filter(e => e.isDirectory() && existsSync(join(dirPath, e.name, 'SKILL.md')))
    .map(e => e.name);
}

/**
 * Compare two sets of filenames and report missing counterparts.
 */
function compareFileSets(
  claudeFiles: string[],
  otherFiles: string[],
  category: string,
  issues: ValidationIssue[],
  checks: { count: number },
  otherPlatform: string,
  soak: boolean,
): void {
  const claudeSet = new Set(claudeFiles);
  const otherSet = new Set(otherFiles);
  const soakNote = soak ? ' (soak: WARN until promotion)' : '';

  // Files in the reference (.claude/) but not in the mirror
  for (const file of claudeFiles) {
    checks.count++;
    if (!otherSet.has(file)) {
      issues.push({
        severity: 'warning',
        category,
        message: `File present in .claude/ but missing from ${otherPlatform}/: ${file}${soakNote}`,
      });
    }
  }

  // Files in the mirror but not in the reference (.claude/)
  for (const file of otherFiles) {
    checks.count++;
    if (!claudeSet.has(file)) {
      issues.push({
        severity: 'warning',
        category,
        message: `File present in ${otherPlatform}/ but missing from .claude/: ${file}${soakNote}`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates cross-platform parity across all four platform mirrors.
 */
export const platformParityValidator: ValidatorDefinition = {
  name: 'platform-parity',
  description: 'Ensures the platform mirrors (.gemini/.agents/.codex) match .claude/ skills and commands',
  prerequisites: ['variant-json', 'extends'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    const checks = { count: 0 };

    const variantDir = ctx.variantDir;
    const claudeSkillsDir = join(variantDir, '.claude', 'skills');
    const claudeSkillEntries = listSkillDirs(claudeSkillsDir);
    const claudeCommands = listFilenames(join(variantDir, '.claude', 'commands'), false);

    // ── Skills parity: each mirror vs .claude (the SSOT-side reference) ──
    for (const [platform, tree] of PLATFORM_TREES) {
      const mirrorSkillsDir = join(variantDir, tree, 'skills');
      const mirrorSkillEntries = listSkillDirs(mirrorSkillsDir);
      const soak = platform !== 'gemini'; // gemini leg is pre-existing coverage

      // Skip-marker honor (D3.4 generalized semantics): a skill marked
      // claude-only in its .claude SKILL.md frontmatter is exempt here.
      const comparableClaude = claudeSkillEntries.filter(
        s => !hasMirrorParitySkip(join(claudeSkillsDir, s, 'SKILL.md')),
      );

      compareFileSets(
        comparableClaude,
        mirrorSkillEntries,
        'platform-parity-skills',
        issues,
        checks,
        platform,
        soak,
      );

      // Also check for matching SKILL.md files inside skill directories
      for (const skillDir of comparableClaude) {
        if (!mirrorSkillEntries.includes(skillDir)) continue; // already reported above
        compareFileSets(
          listFilenames(join(claudeSkillsDir, skillDir), false).map(f => `${skillDir}/${f}`),
          listFilenames(join(mirrorSkillsDir, skillDir), false).map(f => `${skillDir}/${f}`),
          'platform-parity-skill-files',
          issues,
          checks,
          platform,
          soak,
        );
      }
    }

    // ── Commands parity ───────────────────────────────────────────────────
    // .gemini: 1:1 mirror (gemini-parity: skip commands handled by the
    // lifecycle check, not here). .codex: NAME-MAPPED prompts mirror
    // (commands/<x>.md ↔ prompts/<x>.md). .agents/commands: excluded — no
    // producer, no documented consumer (design Finding D; recorded exclusion).
    const geminiCommands = listFilenames(join(variantDir, '.gemini', 'commands'), false);
    compareFileSets(claudeCommands, geminiCommands, 'platform-parity-commands', issues, checks, 'gemini', false);

    const codexPrompts = listFilenames(join(variantDir, '.codex', 'prompts'), false);
    compareFileSets(claudeCommands, codexPrompts, 'platform-parity-commands-codex', issues, checks, 'codex-prompts', true);

    return {
      validator: 'platform-parity',
      duration_ms: performance.now() - start,
      checks: checks.count,
      issues,
    };
  },
};
