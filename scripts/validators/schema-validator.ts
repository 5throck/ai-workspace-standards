#!/usr/bin/env bun
/**
 * Schema Validator — Validates agent and skill frontmatter against JSON Schemas
 * @version 1.0.0
 *
 * Reads each agent and skill file, parses YAML frontmatter, and manually
 * validates the declared fields against schema requirements.
 *
 * Checks performed:
 *   1. Agent frontmatter: required fields, status enum, tier object,
 *      tier value enums, version semver pattern, description min-length,
 *      lifecycle required fields and phase enum
 *   2. Skill frontmatter: required fields, status enum, metadata.type enum
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

/** Valid status values shared by agents and skills. */
const VALID_STATUSES = ['draft', 'active', 'deprecated', 'archived'] as const;

/** Valid tier values for each platform key. */
const VALID_TIER_VALUES = ['high', 'medium', 'low'] as const;

/** Required platform keys inside the tier object. */
const REQUIRED_TIER_KEYS = ['claude', 'gemini', 'antigravity', 'gemini-cli'] as const;

/** Semver pattern for version strings. */
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Date pattern for YYYY-MM-DD strings. */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Valid lifecycle phase values. */
const VALID_LIFECYCLE_PHASES = ['production', 'development', 'retired'] as const;

/** Valid metadata.type values for skills. */
const VALID_METADATA_TYPES = ['process', 'security', 'quality', 'lifecycle'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Agent Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Required top-level fields in agent frontmatter.
 */
const AGENT_REQUIRED_FIELDS = [
  'name', 'role', 'status', 'tier', 'version',
  'last_reviewed', 'description', 'lifecycle',
] as const;

/**
 * Validate a single agent's parsed frontmatter.
 */
function validateAgentFrontmatter(
  fm: Record<string, any>,
  agentFile: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const agentName = basename(agentFile, '.md');

  // ── Required fields ───────────────────────────────────────────────────
  for (const field of AGENT_REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === null) {
      issues.push({
        severity: 'error',
        category: 'missing-field',
        message: `Agent "${agentName}" is missing required field "${field}"`,
        file: agentFile,
        agentName,
      });
    }
  }

  // ── status enum ────────────────────────────────────────────────────────
  if (fm.status !== undefined && !VALID_STATUSES.includes(fm.status)) {
    issues.push({
      severity: 'error',
      category: 'invalid-enum',
      message: `Agent "${agentName}" has invalid status "${fm.status}" — must be one of: ${VALID_STATUSES.join(', ')}`,
      file: agentFile,
      agentName,
    });
  }

  // ── tier object ───────────────────────────────────────────────────────
  if (typeof fm.tier === 'object' && fm.tier !== null && !Array.isArray(fm.tier)) {
    // Check required keys
    for (const key of REQUIRED_TIER_KEYS) {
      if (!(key in fm.tier)) {
        issues.push({
          severity: 'error',
          category: 'missing-field',
          message: `Agent "${agentName}" tier object is missing required key "${key}"`,
          file: agentFile,
          agentName,
        });
      } else if (!VALID_TIER_VALUES.includes(fm.tier[key])) {
        issues.push({
          severity: 'error',
          category: 'invalid-enum',
          message: `Agent "${agentName}" tier.${key} has invalid value "${fm.tier[key]}" — must be one of: ${VALID_TIER_VALUES.join(', ')}`,
          file: agentFile,
          agentName,
        });
      }
    }
  } else if (fm.tier !== undefined) {
    issues.push({
      severity: 'error',
      category: 'invalid-type',
      message: `Agent "${agentName}" tier must be an object`,
      file: agentFile,
      agentName,
    });
  }

  // ── version semver ─────────────────────────────────────────────────────
  if (typeof fm.version === 'string' && !SEMVER_PATTERN.test(fm.version)) {
    issues.push({
      severity: 'error',
      category: 'invalid-format',
      message: `Agent "${agentName}" version "${fm.version}" does not match semver pattern (MAJOR.MINOR.PATCH)`,
      file: agentFile,
      agentName,
    });
  }

  // ── description min length ─────────────────────────────────────────────
  if (typeof fm.description === 'string' && fm.description.trim().length < 10) {
    issues.push({
      severity: 'error',
      category: 'constraint-violation',
      message: `Agent "${agentName}" description must be at least 10 characters (currently ${fm.description.trim().length})`,
      file: agentFile,
      agentName,
    });
  }

  // ── last_reviewed date pattern ─────────────────────────────────────────
  if (typeof fm.last_reviewed === 'string' && !DATE_PATTERN.test(fm.last_reviewed)) {
    issues.push({
      severity: 'error',
      category: 'invalid-format',
      message: `Agent "${agentName}" last_reviewed "${fm.last_reviewed}" does not match date pattern YYYY-MM-DD`,
      file: agentFile,
      agentName,
    });
  }

  // ── lifecycle object ───────────────────────────────────────────────────
  if (typeof fm.lifecycle === 'object' && fm.lifecycle !== null && !Array.isArray(fm.lifecycle)) {
    // phase
    if (fm.lifecycle.phase !== undefined && !VALID_LIFECYCLE_PHASES.includes(fm.lifecycle.phase)) {
      issues.push({
        severity: 'error',
        category: 'invalid-enum',
        message: `Agent "${agentName}" lifecycle.phase has invalid value "${fm.lifecycle.phase}" — must be one of: ${VALID_LIFECYCLE_PHASES.join(', ')}`,
        file: agentFile,
        agentName,
      });
    }

    // created date pattern
    if (typeof fm.lifecycle.created === 'string' && !DATE_PATTERN.test(fm.lifecycle.created)) {
      issues.push({
        severity: 'error',
        category: 'invalid-format',
        message: `Agent "${agentName}" lifecycle.created "${fm.lifecycle.created}" does not match date pattern YYYY-MM-DD`,
        file: agentFile,
        agentName,
      });
    }

    // last_updated date pattern
    if (typeof fm.lifecycle.last_updated === 'string' && !DATE_PATTERN.test(fm.lifecycle.last_updated)) {
      issues.push({
        severity: 'error',
        category: 'invalid-format',
        message: `Agent "${agentName}" lifecycle.last_updated "${fm.lifecycle.last_updated}" does not match date pattern YYYY-MM-DD`,
        file: agentFile,
        agentName,
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Required top-level fields in skill frontmatter.
 */
const SKILL_REQUIRED_FIELDS = ['name', 'status', 'description', 'owner', 'version'] as const;

/**
 * Validate a single skill's parsed frontmatter.
 */
function validateSkillFrontmatter(
  fm: Record<string, any>,
  skillFile: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const skillName = basename(skillFile);

  // ── Required fields ─────────────────────────────────────────────────────
  for (const field of SKILL_REQUIRED_FIELDS) {
    if (fm[field] === undefined || fm[field] === null) {
      issues.push({
        severity: 'error',
        category: 'missing-field',
        message: `Skill "${skillName}" is missing required field "${field}"`,
        file: skillFile,
      });
    }
  }

  // ── status enum ────────────────────────────────────────────────────────
  if (fm.status !== undefined && !VALID_STATUSES.includes(fm.status)) {
    issues.push({
      severity: 'error',
      category: 'invalid-enum',
      message: `Skill "${skillName}" has invalid status "${fm.status}" — must be one of: ${VALID_STATUSES.join(', ')}`,
      file: skillFile,
    });
  }

  // ── version semver ─────────────────────────────────────────────────────
  if (typeof fm.version === 'string' && !SEMVER_PATTERN.test(fm.version)) {
    issues.push({
      severity: 'error',
      category: 'invalid-format',
      message: `Skill "${skillName}" version "${fm.version}" does not match semver pattern (MAJOR.MINOR.PATCH)`,
      file: skillFile,
    });
  }

  // ── description min length ────────────────────────────────────────────
  if (typeof fm.description === 'string' && fm.description.trim().length < 10) {
    issues.push({
      severity: 'error',
      category: 'constraint-violation',
      message: `Skill "${skillName}" description must be at least 10 characters (currently ${fm.description.trim().length})`,
      file: skillFile,
    });
  }

  // ── metadata.type enum ──────────────────────────────────────────────────
  if (typeof fm.metadata === 'object' && fm.metadata !== null && !Array.isArray(fm.metadata)) {
    if (fm.metadata.type !== undefined && !VALID_METADATA_TYPES.includes(fm.metadata.type)) {
      issues.push({
        severity: 'error',
        category: 'invalid-enum',
        message: `Skill "${skillName}" metadata.type has invalid value "${fm.metadata.type}" — must be one of: ${VALID_METADATA_TYPES.join(', ')}`,
        file: skillFile,
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates agent and skill frontmatter against JSON Schema requirements.
 * Uses manual validation (no ajv) — checks required fields, enums, patterns,
 * and structural constraints.
 */
export const schemaValidator: ValidatorDefinition = {
  name: 'schema-validator',
  description: 'Validates agent and skill frontmatter against JSON Schemas',
  prerequisites: ['variant-json'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;

    // ── Validate agent files ──────────────────────────────────────────────
    const agentsDir = join(ctx.variantDir, 'agents');

    for (const agentFile of ctx.agentFiles) {
      const agentPath = join(agentsDir, agentFile);
      if (!existsSync(agentPath)) continue;

      checks++;
      const content = readFileSync(agentPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      if (Object.keys(frontmatter).length === 0) {
        issues.push({
          severity: 'error',
          category: 'missing-frontmatter',
          message: `Agent file "${agentFile}" has no YAML frontmatter`,
          file: agentFile,
        });
        continue;
      }

      const agentIssues = validateAgentFrontmatter(frontmatter, agentFile);
      checks += agentIssues.length;
      issues.push(...agentIssues);
    }

    // ── Validate skill files ──────────────────────────────────────────────
    for (const skillName of ctx.skillFiles) {
      const skillPath = join(ctx.variantDir, 'skills', skillName, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      checks++;
      const content = readFileSync(skillPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);

      if (Object.keys(frontmatter).length === 0) {
        const relativePath = `skills/${skillName}/SKILL.md`;
        issues.push({
          severity: 'error',
          category: 'missing-frontmatter',
          message: `Skill file "${relativePath}" has no YAML frontmatter`,
          file: relativePath,
        });
        continue;
      }

      const relativePath = `skills/${skillName}/SKILL.md`;
      const skillIssues = validateSkillFrontmatter(frontmatter, relativePath);
      checks += skillIssues.length;
      issues.push(...skillIssues);
    }

    return {
      validator: 'schema-validator',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
