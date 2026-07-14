/**
 * @file Development Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'development' variant type.
 * Provides development-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — architecture-design, code-review, testing, ci-cd
 *   2. Test coverage target mention (WARNING) — test-coverage target reference
 *   3. Branch strategy mention (INFO) — branch strategy documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'development' variant type.
 *
 * Handles development-specific validation and golden reference generation for
 * variants focused on software development workflows, code quality, and CI/CD
 * pipelines. Development variants have unique requirements around architecture
 * design, code review processes, and testing strategies that go beyond standard
 * variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { DevelopmentPlugin } from './helpers/plugins/development-plugin.ts';
 * const plugin = new DevelopmentPlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class DevelopmentPlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'development' as const;

  /**
   * Validates a development variant against development-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required development capabilities: architecture-design,
   *      code-review, testing, and ci-cd. Missing any produces an ERROR.
   *   2. **Test coverage target mention** (WARNING) — Checks whether the variant
   *      documentation references a test-coverage target. Development variants
   *      should explicitly document test coverage goals.
   *   3. **Branch strategy mention** (INFO) — Checks whether the variant
   *      documents branch strategy patterns. This is informational; not all
   *      development contexts require explicit branch strategy documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Development-specific capability coverage ---
    // Verify that agents collectively cover architecture-design, code-review,
    // testing, and ci-cd.
    // These are hard functional requirements — development variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'architecture-design',
      'code-review',
      'testing',
      'ci-cd',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing development capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Test coverage target mention ---
    // Development variants should reference a test-coverage target in their documentation.
    // Explicit coverage targets ensure quality standards are measurable and enforceable.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('test-coverage')
    ) {
      issues.push({
        severity: 'warning',
        category: 'test-coverage',
        message:
          'Development variant should reference a test-coverage target',
      });
    }

    // --- Check 3: Branch strategy mention ---
    // Standard branch strategy documentation for development contexts.
    // This is informational; not all development contexts require explicit branch strategy docs.
    if (
      !variantContent.toLowerCase().includes('branch strategy')
    ) {
      issues.push({
        severity: 'info',
        category: 'branch-strategy',
        message:
          'Consider documenting branch strategy patterns',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for development variants.
   *
   * Defines expected section headings for agent files and skill files in
   * development variants. Agent files require standard sections (Role, Responsibilities,
   * Collaboration Protocol) plus development-specific optional sections (Architecture
   * Guidelines, Code Standards, Testing Strategy).
   *
   * @returns The golden reference for development variants.
   */
  goldenReference(): GoldenReference {
    return {
      agentSections: {
        required: [
          '## Role',
          '## Responsibilities',
          '## Collaboration Protocol',
        ],
        optional: [
          '## Architecture Guidelines',
          '## Code Standards',
          '## Testing Strategy',
        ],
      },
      skillSections: {
        required: [
          '## Overview',
          '## Key Activities',
          '## Output Standards',
        ],
        optional: [],
      },
    };
  }
}
