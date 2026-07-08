#!/usr/bin/env bun
/**
 * Platform Parity Validator — Design Doc §6.2, Validator #6
 * @version 1.0.0
 *
 * Ensures cross-platform parity between .claude/ and .gemini/ directories.
 * Skills and commands should have matching counterparts on both platforms.
 *
 * Checks performed:
 *   1. .claude/skills/ vs .gemini/skills/ — same filenames must exist in both
 *   2. .claude/commands/ vs .gemini/commands/ — same filenames must exist in both
 *   3. Report missing counterparts as WARNING
 */

import { join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationIssue } from './types.ts';

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
 * Compare two sets of filenames and report missing counterparts.
 */
function compareFileSets(
  claudeFiles: string[],
  geminiFiles: string[],
  category: string,
  issues: ValidationIssue[],
  checks: { count: number },
): void {
  const claudeSet = new Set(claudeFiles);
  const geminiSet = new Set(geminiFiles);

  // Files in .claude/ but not in .gemini/
  for (const file of claudeFiles) {
    checks.count++;
    if (!geminiSet.has(file)) {
      issues.push({
        severity: 'warning',
        category,
        message: `File present in .claude/ but missing from .gemini/: ${file}`,
      });
    }
  }

  // Files in .gemini/ but not in .claude/
  for (const file of geminiFiles) {
    checks.count++;
    if (!claudeSet.has(file)) {
      issues.push({
        severity: 'warning',
        category,
        message: `File present in .gemini/ but missing from .claude/: ${file}`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates cross-platform parity between .claude/ and .gemini/ directories.
 */
export const platformParityValidator: ValidatorDefinition = {
  name: 'platform-parity',
  description: 'Ensures .claude/ and .gemini/ have matching skills and commands',
  prerequisites: ['variant-json', 'extends'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    const checks = { count: 0 };

    const variantDir = ctx.variantDir;

    // ── Skills parity ─────────────────────────────────────────────────────
    const claudeSkillsDir = join(variantDir, '.claude', 'skills');
    const geminiSkillsDir = join(variantDir, '.gemini', 'skills');

    // Skills are typically organized as directories containing files.
    // Compare top-level directory names for structural parity, then compare files within.
    const claudeSkillEntries = listFilenames(claudeSkillsDir, false);
    const geminiSkillEntries = listFilenames(geminiSkillsDir, false);

    compareFileSets(
      claudeSkillEntries,
      geminiSkillEntries,
      'platform-parity-skills',
      issues,
      checks,
    );

    // Also check for matching SKILL.md files inside skill directories
    for (const skillDir of claudeSkillEntries) {
      if (!geminiSkillEntries.includes(skillDir)) continue; // already reported above
      const claudeSkillFiles = listFilenames(join(claudeSkillsDir, skillDir), false);
      const geminiSkillFiles = listFilenames(join(geminiSkillsDir, skillDir), false);
      compareFileSets(
        claudeSkillFiles.map(f => `${skillDir}/${f}`),
        geminiSkillFiles.map(f => `${skillDir}/${f}`),
        'platform-parity-skill-files',
        issues,
        checks,
      );
    }

    // ── Commands parity ───────────────────────────────────────────────────
    const claudeCommandsDir = join(variantDir, '.claude', 'commands');
    const geminiCommandsDir = join(variantDir, '.gemini', 'commands');

    const claudeCommands = listFilenames(claudeCommandsDir, false);
    const geminiCommands = listFilenames(geminiCommandsDir, false);

    compareFileSets(
      claudeCommands,
      geminiCommands,
      'platform-parity-commands',
      issues,
      checks,
    );

    return {
      validator: 'platform-parity',
      duration_ms: performance.now() - start,
      checks: checks.count,
      issues,
    };
  },
};
