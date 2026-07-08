#!/usr/bin/env bun
/**
 * Capability Validator — Design Doc §6.2, Validator #3
 * @version 1.0.0
 *
 * Scans all agent files for `capabilities:` frontmatter and cross-references
 * against the validation policy's requiredCapabilities list.
 *
 * Checks performed:
 *   1. Collect capabilities declared in all agent .md frontmatter
 *   2. Cross-reference against validation policy requiredCapabilities
 *   3. Report missing capabilities as ERROR
 *   4. Report unknown capabilities (not in CAPABILITY_REGISTRY) as WARNING
 */

import { join, basename } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { getValidationPolicy, isCapability, type VariantType } from '../helpers/registries/index.ts';
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
 * Extract capabilities array from frontmatter.
 * Returns an empty array if the field is missing or malformed.
 */
function extractCapabilities(frontmatter: Record<string, any>): string[] {
  if (!frontmatter.capabilities) return [];
  if (!Array.isArray(frontmatter.capabilities)) return [];
  return frontmatter.capabilities.filter((c: any) => typeof c === 'string' && c.trim() !== '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that required capabilities are covered by agent declarations.
 * Also warns about unknown capability values (possible typos).
 */
export const capabilityValidator: ValidatorDefinition = {
  name: 'capability',
  description: 'Validates that required capabilities are covered across all agent files',
  prerequisites: ['variant-json'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;

    // ── Collect all capabilities declared across agents ──────────────────
    const coveredCapabilities = new Set<string>();
    const agentsDir = join(ctx.variantDir, 'agents');

    for (const agentFile of ctx.agentFiles) {
      const agentPath = join(agentsDir, agentFile);
      if (!existsSync(agentPath)) continue;

      checks++;
      const content = readFileSync(agentPath, 'utf-8');
      const frontmatter = parseFrontmatter(content);
      const caps = extractCapabilities(frontmatter);
      const agentName = basename(agentFile, '.md');

      // Check for unknown capabilities (typos)
      for (const cap of caps) {
        checks++;
        if (!isCapability(cap)) {
          issues.push({
            severity: 'warning',
            category: 'unknown-capability',
            message: `Agent "${agentName}" declares unknown capability "${cap}" — possible typo`,
            file: agentFile,
            agentName,
            capability: cap,
          });
        }
      }

      for (const cap of caps) {
        coveredCapabilities.add(cap);
      }
    }

    // ── Check required capabilities from policy ───────────────────────────
    if (ctx.policy && 'requiredCapabilities' in ctx.policy) {
      const required = ctx.policy.requiredCapabilities as string[];
      for (const reqCap of required) {
        checks++;
        if (!coveredCapabilities.has(reqCap)) {
          issues.push({
            severity: 'error',
            category: 'missing-capability',
            message: `Required capability "${reqCap}" is not covered by any agent`,
            capability: reqCap,
          });
        }
      }
    }

    return {
      validator: 'capability',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
