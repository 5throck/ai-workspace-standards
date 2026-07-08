#!/usr/bin/env bun
/**
 * Variant JSON Validator — Design Doc §6.2, Validator #1
 * @version 1.0.0
 *
 * Validates the variant.json manifest for required fields and correct values.
 * This is the foundational validator — all others depend on its output.
 *
 * Checks performed:
 *   1. variant.json exists and is valid JSON
 *   2. Required top-level fields are present
 *   3. status is one of: draft, beta, stable
 *   4. variant_type passes isVariantType() check
 *   5. agents[] is a non-empty array with name + file fields
 *   6. skills[] is an array with name fields
 */

import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationIssue } from './types.ts';
import { isVariantType } from '../helpers/registries/index.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const VALID_STATUSES = ['draft', 'beta', 'stable'] as const;

const REQUIRED_TOP_LEVEL_FIELDS = [
  'name',
  'variant_type',
  'status',
  'version',
  'inherits_common',
  'agents',
  'skills',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a ValidationIssue for a missing or invalid field.
 */
function issue(
  severity: ValidationIssue['severity'],
  category: string,
  message: string,
  file?: string,
): ValidationIssue {
  return { severity, category, message, file };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates the variant.json manifest structure and content.
 */
export const variantJsonValidator: ValidatorDefinition = {
  name: 'variant-json',
  description: 'Validates variant.json manifest for required fields and correct values',
  prerequisites: [],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;
    const v = ctx.variantJson;

    // ── Check: Required top-level fields ──────────────────────────────────
    for (const field of REQUIRED_TOP_LEVEL_FIELDS) {
      checks++;
      if (!(field in v)) {
        issues.push(issue(
          'error',
          'missing-field',
          `variant.json missing required field: "${field}"`,
          'variant.json',
        ));
      }
    }

    // ── Check: status enum ────────────────────────────────────────────────
    checks++;
    if ('status' in v && !VALID_STATUSES.includes(v.status)) {
      issues.push(issue(
        'error',
        'invalid-status',
        `variant.json status "${v.status}" is not one of: ${VALID_STATUSES.join(', ')}`,
        'variant.json',
      ));
    }

    // ── Check: variant_type registry ─────────────────────────────────────
    checks++;
    if ('variant_type' in v && typeof v.variant_type === 'string') {
      if (!isVariantType(v.variant_type)) {
        issues.push(issue(
          'error',
          'invalid-variant-type',
          `variant.json variant_type "${v.variant_type}" is not a registered variant type`,
          'variant.json',
        ));
      }
    }

    // ── Check: agents array ──────────────────────────────────────────────
    checks++;
    if ('agents' in v && !Array.isArray(v.agents)) {
      issues.push(issue(
        'error',
        'invalid-agents',
        'variant.json "agents" must be an array',
        'variant.json',
      ));
    } else if ('agents' in v && Array.isArray(v.agents)) {
      // Check agents is non-empty
      checks++;
      if (v.agents.length === 0) {
        issues.push(issue(
          'error',
          'empty-agents',
          'variant.json "agents" array is empty — at least one agent is required',
          'variant.json',
        ));
      }

      // Check each agent has name + file
      for (let i = 0; i < v.agents.length; i++) {
        const agent = v.agents[i];
        checks++;

        if (!agent || typeof agent !== 'object') {
          issues.push(issue(
            'error',
            'invalid-agent-entry',
            `agents[${i}] is not a valid object`,
            'variant.json',
          ));
          continue;
        }

        if (!('name' in agent) || typeof agent.name !== 'string' || agent.name.trim() === '') {
          issues.push(issue(
            'error',
            'missing-agent-name',
            `agents[${i}] missing or empty "name" field`,
            'variant.json',
          ));
        }

        if (!('file' in agent) || typeof agent.file !== 'string' || agent.file.trim() === '') {
          issues.push(issue(
            'error',
            'missing-agent-file',
            `agents[${i}] ("${agent.name ?? '<unknown>'}") missing or empty "file" field`,
            'variant.json',
          ));
        }
      }
    }

    // ── Check: skills array ───────────────────────────────────────────────
    checks++;
    if ('skills' in v && !Array.isArray(v.skills)) {
      issues.push(issue(
        'error',
        'invalid-skills',
        'variant.json "skills" must be an array',
        'variant.json',
      ));
    } else if ('skills' in v && Array.isArray(v.skills)) {
      for (let i = 0; i < v.skills.length; i++) {
        const skill = v.skills[i];
        checks++;

        if (!skill || typeof skill !== 'object') {
          issues.push(issue(
            'error',
            'invalid-skill-entry',
            `skills[${i}] is not a valid object`,
            'variant.json',
          ));
          continue;
        }

        if (!('name' in skill) || typeof skill.name !== 'string' || skill.name.trim() === '') {
          issues.push(issue(
            'error',
            'missing-skill-name',
            `skills[${i}] missing or empty "name" field`,
            'variant.json',
          ));
        }
      }
    }

    return {
      validator: 'variant-json',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
