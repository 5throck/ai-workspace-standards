#!/usr/bin/env bun
/**
 * Schema Validator — Validates agent, skill, and command frontmatter against JSON Schemas
 * @version 1.2.0
 *
 * Reads each agent, skill, and command file, parses YAML frontmatter, and manually
 * validates the declared fields against schema requirements.
 *
 * Checks performed:
 *   1. Agent frontmatter: required fields, status enum, tier object,
 *      tier value enums, version semver pattern, description min-length,
 *      lifecycle required fields and phase enum
 *   2. Skill frontmatter: required fields, status enum, metadata.type enum
 *   3. Command frontmatter: optional fields only; validates gemini-parity enum,
 *      description min-length, version semver, scope enum (lenient — no frontmatter = skip)
 */

import { join, basename } from 'path';
import { existsSync, readFileSync, readdirSync } from 'fs';
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
// 'beta' mirrors the variant.json `status` vocabulary. It is used consistently — by exactly the
// agents of the two variants whose variant.json status is 'beta' (co-export 9, co-news 6) and
// nowhere else — so the enum was stale, not the data.
const VALID_LIFECYCLE_PHASES = ['production', 'beta', 'development', 'retired'] as const;

// Skill metadata.type is NOT enum-constrained. The four values this list once held
// ('process', 'security', 'quality', 'lifecycle') match only 60 of the 80 skills that declare a
// type; 16 distinct values are in use overall, grown organically with no documented taxonomy to
// migrate toward. Freezing the current spread into an enum would encode the sprawl rather than
// govern it, so the check below enforces shape (non-empty string) and leaves the taxonomy
// question open — see the follow-up noted in the 2026-08-21 CHANGELOG entry.

/** Valid gemini-parity values for commands. */
const VALID_GEMINI_PARITY_VALUES = ['full', 'partial', 'skip'] as const;

/** Valid scope values for commands. */
const VALID_COMMAND_SCOPE_VALUES = ['common', 'claude-only', 'gemini-only'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Agent Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Required top-level fields in agent frontmatter.
 */
// `last_reviewed` is deliberately NOT required. It is an L0-only convention — present on the 8
// workspace-root agents and absent from 92 of 100 agents overall, because variant agents track
// freshness with `last_updated` instead. Requiring it here would fail almost every variant agent
// for not following a convention that was never propagated to them. Its date-pattern check below
// still applies whenever the field IS present. (2026-08-21: measured before wiring this validator
// into audit.ts for the first time.)
const AGENT_REQUIRED_FIELDS = [
  'name', 'role', 'status', 'tier', 'version',
  'description', 'lifecycle',
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

  // ── metadata.type shape ─────────────────────────────────────────────────
  if (typeof fm.metadata === 'object' && fm.metadata !== null && !Array.isArray(fm.metadata)) {
    if (fm.metadata.type !== undefined && (typeof fm.metadata.type !== 'string' || fm.metadata.type.trim() === '')) {
      issues.push({
        severity: 'error',
        category: 'constraint-violation',
        message: `Skill "${skillName}" metadata.type must be a non-empty string`,
        file: skillFile,
      });
    }
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Validation (Lenient — all optional)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate a single command file's parsed frontmatter.
 * Lenient: if no frontmatter is present, no issues are raised.
 * Only validates fields that exist — missing fields are not errors.
 */
function validateCommandFrontmatter(
  fm: Record<string, any>,
  commandFile: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const cmdName = basename(commandFile, '.md');

  // ── description min length (if present) ────────────────────────────────
  if (typeof fm.description === 'string' && fm.description.trim().length < 10) {
    issues.push({
      severity: 'error',
      category: 'constraint-violation',
      message: `Command "${cmdName}" description must be at least 10 characters (currently ${fm.description.trim().length})`,
      file: commandFile,
    });
  }

  // ── gemini-parity enum (if present) ─────────────────────────────────────
  if (typeof fm['gemini-parity'] === 'string' && !VALID_GEMINI_PARITY_VALUES.includes(fm['gemini-parity'] as any)) {
    issues.push({
      severity: 'error',
      category: 'invalid-enum',
      message: `Command "${cmdName}" gemini-parity has invalid value "${fm['gemini-parity']}" — must be one of: ${VALID_GEMINI_PARITY_VALUES.join(', ')}`,
      file: commandFile,
    });
  }

  // ── version semver (if present) ──────────────────────────────────────────
  if (typeof fm.version === 'string' && !SEMVER_PATTERN.test(fm.version)) {
    issues.push({
      severity: 'error',
      category: 'invalid-format',
      message: `Command "${cmdName}" version "${fm.version}" does not match semver pattern (MAJOR.MINOR.PATCH)`,
      file: commandFile,
    });
  }

  // ── scope enum (if present) ────────────────────────────────────────────
  if (typeof fm.scope === 'string' && !VALID_COMMAND_SCOPE_VALUES.includes(fm.scope as any)) {
    issues.push({
      severity: 'error',
      category: 'invalid-enum',
      message: `Command "${cmdName}" scope has invalid value "${fm.scope}" — must be one of: ${VALID_COMMAND_SCOPE_VALUES.join(', ')}`,
      file: commandFile,
    });
  }

  // ── status enum (if present) ─────────────────────────────────────────────
  if (typeof fm.status === 'string' && !VALID_STATUSES.includes(fm.status)) {
    issues.push({
      severity: 'error',
      category: 'invalid-enum',
      message: `Command "${cmdName}" has invalid status "${fm.status}" — must be one of: ${VALID_STATUSES.join(', ')}`,
      file: commandFile,
    });
  }

  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates agent, skill, and command frontmatter against JSON Schema requirements.
 * Uses manual validation (no ajv) — checks required fields, enums, patterns,
 * and structural constraints. Commands are validated leniently (all optional).
 */
export const schemaValidator: ValidatorDefinition = {
  name: 'schema-validator',
  description: 'Validates agent, skill, and command frontmatter against JSON Schemas',
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

      // Skip L1-B `extends:` stubs (i.e. every variant's pm.md). Their frontmatter is a delta —
      // the required fields live in the parent and are merged at resolve time — so validating the
      // stub standalone reports the entire required set as missing. This accounted for 46 of the
      // 47 remaining errors when this validator was first wired into audit.ts (2026-08-21):
      // exactly one agent per variant, always pm.md. Resolution is `extendsValidatorWrapper`'s job.
      if (frontmatter.extends) continue;

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

    // ── Validate command files (lenient — skip if no frontmatter) ─────────
    const commandDirs = [
      join(ctx.variantDir, '.claude', 'commands'),
      join(ctx.variantDir, '.gemini', 'commands'),
    ];

    for (const cmdDir of commandDirs) {
      if (!existsSync(cmdDir)) continue;
      let entries: string[];
      try {
        entries = readdirSync(cmdDir).filter(f => f.endsWith('.md'));
      } catch {
        continue;
      }

      for (const cmdFile of entries) {
        const cmdPath = join(cmdDir, cmdFile);
        const relativePath = cmdPath.replace(ctx.variantDir + '/', '');
        checks++;

        const content = readFileSync(cmdPath, 'utf-8');
        const frontmatter = parseFrontmatter(content);

        if (Object.keys(frontmatter).length === 0) {
          // No frontmatter — skip (lenient, no error)
          continue;
        }

        const cmdIssues = validateCommandFrontmatter(frontmatter, relativePath);
        checks += cmdIssues.length;
        issues.push(...cmdIssues);
      }
    }

    return {
      validator: 'schema-validator',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
