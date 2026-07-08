#!/usr/bin/env bun
/**
 * Validator Framework — Barrel Exports + Runner — Design Doc §6.3 / §6.4
 * @version 1.0.0
 *
 * Provides runAllValidators() to execute all validators in dependency order,
 * and generateReport() to produce a CI-friendly JSON report.
 *
 * Execution order respects prerequisites — validators whose prerequisites
 * have errors are skipped (not failed).
 *
 * Usage:
 *   import { runAllValidators, generateReport } from './validators/index.ts';
 *   const ctx = buildContext(variantDir);
 *   const results = await runAllValidators(ctx);
 *   const report = generateReport(results, 'co-develop', 'development');
 *   console.log(JSON.stringify(report, null, 2));
 */

import type { ValidatorContext, ValidatorDefinition, ValidatorResult, ValidationReport } from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Validator Imports
// ─────────────────────────────────────────────────────────────────────────────

import { variantJsonValidator } from './variant-json-validator.ts';
import { extendsValidatorWrapper } from './extends-validator-wrapper.ts';
import { capabilityValidator } from './capability-validator.ts';
import { orphanReferenceValidator } from './orphan-reference-validator.ts';
import { duplicateValidator } from './duplicate-validator.ts';
import { platformParityValidator } from './platform-parity-validator.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Execution Order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered list of all validators. Order matters — earlier validators produce
 * context that later validators depend on via the prerequisites system.
 *
 * Dependency graph:
 *   variant-json    → (none — root validator)
 *   duplicate       → [variant-json]
 *   extends         → [variant-json]
 *   capability      → [variant-json]
 *   orphan-reference → [variant-json, extends]
 *   platform-parity → [variant-json, extends]
 */
const ALL_VALIDATORS: readonly ValidatorDefinition[] = [
  variantJsonValidator,
  duplicateValidator,
  extendsValidatorWrapper,
  capabilityValidator,
  orphanReferenceValidator,
  platformParityValidator,
];

// ─────────────────────────────────────────────────────────────────────────────
// Barrel Exports
// ─────────────────────────────────────────────────────────────────────────────

export { variantJsonValidator } from './variant-json-validator.ts';
export { extendsValidatorWrapper } from './extends-validator-wrapper.ts';
export { capabilityValidator } from './capability-validator.ts';
export { orphanReferenceValidator } from './orphan-reference-validator.ts';
export { duplicateValidator } from './duplicate-validator.ts';
export { platformParityValidator } from './platform-parity-validator.ts';
export type {
  ValidatorContext,
  ValidationIssue,
  ValidatorResult,
  ValidatorDefinition,
  ValidationReport,
} from './types.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute all validators against the given context in dependency order.
 *
 * Skips validators whose prerequisites have failed (produced ERROR-severity
 * issues). Skipped validators are recorded in the results with skipped=true
 * and a skipReason.
 *
 * @param ctx - The validator context for the variant being validated.
 * @returns Array of ValidatorResult in execution order.
 */
export async function runAllValidators(ctx: ValidatorContext): Promise<ValidatorResult[]> {
  const results: ValidatorResult[] = [];
  const failedValidators = new Set<string>();

  for (const validator of ALL_VALIDATORS) {
    // ── Check prerequisites ─────────────────────────────────────────────
    const unmetPrereqs = validator.prerequisites.filter(p => failedValidators.has(p));

    if (unmetPrereqs.length > 0) {
      results.push({
        validator: validator.name,
        duration_ms: 0,
        checks: 0,
        issues: [],
        skipped: true,
        skipReason: `Prerequisites failed: ${unmetPrereqs.join(', ')}`,
      });
      continue;
    }

    // ── Execute validator ─────────────────────────────────────────────────
    const start = performance.now();
    let result: ValidatorResult;

    try {
      result = await validator.validate(ctx);
    } catch (error) {
      // Catch unexpected exceptions — convert to a single ERROR issue
      const message = (error as Error).message ?? 'Unknown error';
      result = {
        validator: validator.name,
        duration_ms: performance.now() - start,
        checks: 0,
        issues: [{
          severity: 'error',
          category: 'validator-crash',
          message: `Validator "${validator.name}" threw unexpectedly: ${message}`,
        }],
      };
    }

    // ── Track failures ──────────────────────────────────────────────────
    const hasErrors = result.issues.some(i => i.severity === 'error');
    if (hasErrors) {
      failedValidators.add(validator.name);
    }

    results.push(result);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Report Generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a CI-friendly JSON report from validator results.
 *
 * Per Design Doc §6.4, the report is intended to be:
 *   - Written to disk as JSON
 *   - Consumed by CI pipelines (pass/fail gating on `passed` field)
 *   - Human-readable in JSON form
 *
 * @param results - Array of ValidatorResult from runAllValidators().
 * @param variant - The variant name (e.g., 'co-develop').
 * @param type - The variant type (e.g., 'development').
 * @returns A complete ValidationReport.
 */
export function generateReport(
  results: readonly ValidatorResult[],
  variant: string,
  type: string,
): ValidationReport {
  let totalChecks = 0;
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let passedValidators = 0;
  let skippedValidators = 0;
  let failedValidators = 0;

  for (const result of results) {
    totalChecks += result.checks;

    if (result.skipped) {
      skippedValidators++;
      continue;
    }

    const hasErrors = result.issues.some(i => i.severity === 'error');
    if (hasErrors) {
      failedValidators++;
    } else {
      passedValidators++;
    }

    for (const issue of result.issues) {
      switch (issue.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'info':
          infos++;
          break;
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    variant,
    type,
    passed: errors === 0,
    summary: {
      totalValidators: results.length,
      passedValidators,
      skippedValidators,
      failedValidators,
      totalChecks,
      errors,
      warnings,
      infos,
    },
    results,
  };
}
