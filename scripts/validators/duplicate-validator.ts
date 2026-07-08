#!/usr/bin/env bun
/**
 * Duplicate Validator — Design Doc §6.2, Validator #5
 * @version 1.0.0
 *
 * Detects duplicate agent definitions at both the filesystem and manifest level.
 *
 * Checks performed:
 *   1. Duplicate agent filenames in the agents/ directory on disk
 *   2. Duplicate agent names in variant.json agents[] array
 *   3. Report duplicates as ERROR — they cause silent overwrites and ambiguity
 */

import { join, basename } from 'path';
import { existsSync, readdirSync } from 'fs';
import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationIssue } from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Validator Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects duplicate agent filenames and names.
 */
export const duplicateValidator: ValidatorDefinition = {
  name: 'duplicate',
  description: 'Detects duplicate agent filenames on disk and duplicate agent names in variant.json',
  prerequisites: ['variant-json'],

  validate(ctx: ValidatorContext): ValidatorResult {
    const start = performance.now();
    const issues: ValidationIssue[] = [];
    let checks = 0;

    // ── Check 1: Duplicate filenames on disk ─────────────────────────────
    // ctx.agentFiles is already the list of .md files from the agents/ directory.
    // Use a Map to count occurrences.
    const filenameCounts = new Map<string, number>();
    for (const file of ctx.agentFiles) {
      filenameCounts.set(file, (filenameCounts.get(file) ?? 0) + 1);
    }

    checks++;
    const dupFiles = [...filenameCounts.entries()].filter(([, count]) => count > 1);
    if (dupFiles.length > 0) {
      for (const [filename, count] of dupFiles) {
        issues.push({
          severity: 'error',
          category: 'duplicate-filename',
          message: `Duplicate agent filename "${filename}" found ${count} times in agents/ directory`,
          file: filename,
        });
      }
    }

    // ── Check 2: Duplicate agent names in variant.json ────────────────────
    const v = ctx.variantJson;
    const agents = v.agents;

    checks++;
    if (Array.isArray(agents)) {
      const nameCounts = new Map<string, number[]>();
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        if (agent && typeof agent.name === 'string') {
          const existing = nameCounts.get(agent.name) ?? [];
          existing.push(i);
          nameCounts.set(agent.name, existing);
        }
      }

      const dupNames = [...nameCounts.entries()].filter(([, indices]) => indices.length > 1);
      if (dupNames.length > 0) {
        for (const [name, indices] of dupNames) {
          issues.push({
            severity: 'error',
            category: 'duplicate-agent-name',
            message: `Duplicate agent name "${name}" in variant.json at indices [${indices.join(', ')}]`,
          });
        }
      }
    }

    return {
      validator: 'duplicate',
      duration_ms: performance.now() - start,
      checks,
      issues,
    };
  },
};
