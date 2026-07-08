#!/usr/bin/env bun
/**
 * Orphan Reference Validator — Design Doc §6.2, Validator #4
 * @version 1.0.0
 *
 * Scans agent frontmatter for cross-references (handoff_to, required_skills)
 * and verifies that each referenced agent or skill has a corresponding file.
 *
 * Checks performed:
 *   1. For each agent .md, parse frontmatter for `handoff_to` and `required_skills`
 *   2. Verify each referenced agent name has a matching .md file in agents/
 *   3. Verify each referenced skill name has a matching entry in variant.json skills[]
 *   4. Report orphan references as WARNING (may reference common/shared agents)
 */

import { join, basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationIssue } from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the parsed frontmatter object, or empty object if no frontmatter found.
 */
function parseFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]+?)\n---\n?/);
  if (!match) return {};

  try {
    return yaml.load(match[1]) as Record<string, any>;
  } catch {
    return {};
  }
}

/**
 * Extract string array from frontmatter field, with fallback to empty array.
 */
function extractStringArray(frontmatter: Record<string, any>, field: string): string[] {
  const value = frontmatter[field];
  if (!value) return [];
  if (typeof value === 'string') return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((v: any) => typeof v === 'string' && v.trim() !== '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that cross-references in agent frontmatter point to real files.
 */
export const orphanReferenceValidator: ValidatorDefinition = {
  name: 'orphan-reference',
  description: 'Validates that agent cross-references (handoff_to, required_skills) point to real files',
  prerequisites: ['variant-json', 'extends'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;

    const agentsDir = join(ctx.variantDir, 'agents');

    // Build a set of known agent names from filenames on disk
    const knownAgentFiles = new Set(ctx.agentFiles);
    // Map agent filenames to agent names (filename without .md)
    const knownAgentNames = new Set(
      ctx.agentFiles.map(f => basename(f, '.md')),
    );

    // Build a set of known skill names from variant.json
    const knownSkillNames = new Set(
      ctx.skillFiles.map(s => {
        // skillFiles come from variant.json skills[].name
        if (typeof s === 'object' && s !== null && 'name' in s) return (s as any).name;
        return s;
      }),
    );

    for (const agentFile of ctx.agentFiles) {
      const agentPath = join(agentsDir, agentFile);
      if (!existsSync(agentPath)) continue;

      const content = readFileSync(agentPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const agentName = basename(agentFile, '.md');

      // ── Check handoff_to references ────────────────────────────────────
      const handoffTo = extractStringArray(frontmatter, 'handoff_to');
      for (const target of handoffTo) {
        checks++;
        // Check if the target is a known agent name
        if (!knownAgentNames.has(target)) {
          issues.push({
            severity: 'warning',
            category: 'orphan-handoff',
            message: `Agent "${agentName}" handoff_to "${target}" — no matching agent file in agents/`,
            file: agentFile,
            agentName,
          });
        }
      }

      // ── Check required_skills references ───────────────────────────────
      const requiredSkills = extractStringArray(frontmatter, 'required_skills');
      for (const skill of requiredSkills) {
        checks++;
        if (!knownSkillNames.has(skill)) {
          issues.push({
            severity: 'warning',
            category: 'orphan-skill-reference',
            message: `Agent "${agentName}" required_skills "${skill}" — no matching skill in variant.json`,
            file: agentFile,
            agentName,
          });
        }
      }
    }

    return {
      validator: 'orphan-reference',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
