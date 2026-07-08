#!/usr/bin/env bun
/**
 * Extends Validator Wrapper — Design Doc §6.2, Validator #2
 * @version 1.0.0
 *
 * Wraps the existing extends-validator.ts for every agent .md file.
 * Detects circular references, depth violations, missing files, and oversized files.
 *
 * Checks performed:
 *   1. For each agent .md file, parse frontmatter for `extends:` field
 *   2. If present, call safeValidateExtends() from extends-validator.ts
 *   3. Report circular_reference, depth_exceeded, file_not_found as ERROR
 *   4. Report file_size_exceeded as WARNING
 */

import { join, basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { safeValidateExtends, type ExtendsValidationResult } from '../helpers/extends-validator.ts';
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
 * Skip files that are trivially small or non-agent files.
 * README.md and tiny pm.md files are not meaningful for extends validation.
 */
function shouldSkipFile(filename: string, content: string): boolean {
  if (filename === 'README.md') return true;
  if (filename === 'pm.md' && content.length < 200) return true;
  return false;
}

/**
 * Map an extends-validator error_type to our ValidationIssue severity.
 */
function errorTypeToSeverity(errorType: string): ValidationIssue['severity'] {
  switch (errorType) {
    case 'file_size_exceeded':
      return 'warning';
    case 'circular_reference':
    case 'depth_exceeded':
    case 'file_not_found':
    case 'security_violation':
    case 'parse_timeout':
      return 'error';
    default:
      return 'error';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates extends chains in all agent files.
 * Wraps the existing safeValidateExtends() and reports issues in standard format.
 */
export const extendsValidatorWrapper: ValidatorDefinition = {
  name: 'extends',
  description: 'Validates extends chains in agent files for circular references and depth limits',
  prerequisites: ['variant-json'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;

    const agentsDir = join(ctx.variantDir, 'agents');

    for (const agentFile of ctx.agentFiles) {
      const agentPath = join(agentsDir, agentFile);

      // Read and check skippability
      const content = existsSync(agentPath) ? readFileSync(agentPath, 'utf-8') : '';
      if (shouldSkipFile(agentFile, content)) continue;

      checks++;

      // Parse frontmatter
      const frontmatter = parseFrontmatter(content);
      if (!frontmatter.extends) continue; // No extends — nothing to check

      // Run the existing validator
      const result: ExtendsValidationResult = safeValidateExtends(agentPath);

      if (!result.valid) {
        const severity = errorTypeToSeverity(result.error_type);
        issues.push({
          severity,
          category: result.error_type,
          message: `extends validation failed for ${agentFile}: ${result.message}`,
          file: agentFile,
          agentName: basename(agentFile, '.md'),
        });
      }
    }

    return {
      validator: 'extends',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
