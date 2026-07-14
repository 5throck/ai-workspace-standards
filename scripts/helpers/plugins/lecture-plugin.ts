/**
 * @file Lecture Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'lecture' variant type.
 * Provides lecture-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — content-creation, presentation, assessment, curriculum-design
 *   2. Learning objectives mention (WARNING) — learning objectives reference
 *   3. Student interaction model mention (INFO) — student interaction model documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'lecture' variant type.
 *
 * Handles lecture-specific validation and golden reference generation for
 * variants focused on educational content delivery, curriculum design, and
 * student assessment. Lecture variants have unique requirements around
 * learning objectives, interaction models, and assessment criteria that go
 * beyond standard variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { LecturePlugin } from './helpers/plugins/lecture-plugin.ts';
 * const plugin = new LecturePlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class LecturePlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'lecture' as const;

  /**
   * Validates a lecture variant against lecture-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required lecture capabilities: content-creation,
   *      presentation, assessment, and curriculum-design. Missing any produces
   *      an ERROR.
   *   2. **Learning objectives mention** (WARNING) — Checks whether the variant
   *      documentation references learning objectives. Lecture variants should
   *      explicitly document learning objectives for each session.
   *   3. **Student interaction model mention** (INFO) — Checks whether the
   *      variant documents student interaction models. This is informational;
   *      not all lecture contexts require explicit interaction model documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Lecture-specific capability coverage ---
    // Verify that agents collectively cover content-creation, presentation,
    // assessment, and curriculum-design.
    // These are hard functional requirements — lecture variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'content-creation',
      'presentation',
      'assessment',
      'curriculum-design',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing lecture capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Learning objectives mention ---
    // Lecture variants should reference learning objectives in their documentation.
    // Explicit learning objectives ensure educational content is goal-oriented and measurable.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('learning objectives')
    ) {
      issues.push({
        severity: 'warning',
        category: 'learning-objectives',
        message:
          'Lecture variant should reference learning objectives',
      });
    }

    // --- Check 3: Student interaction model mention ---
    // Standard student interaction model documentation for lecture contexts.
    // This is informational; not all lecture contexts require explicit interaction model docs.
    if (
      !variantContent.toLowerCase().includes('student interaction model')
    ) {
      issues.push({
        severity: 'info',
        category: 'student-interaction-model',
        message:
          'Consider documenting student interaction model standards',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for lecture variants.
   *
   * Defines expected section headings for agent files and skill files in
   * lecture variants. Agent files require standard sections (Role, Responsibilities,
   * Session Protocol) plus lecture-specific optional sections (Curriculum Map,
   * Assessment Criteria, Engagement Strategy).
   *
   * @returns The golden reference for lecture variants.
   */
  goldenReference(): GoldenReference {
    return {
      agentSections: {
        required: [
          '## Role',
          '## Responsibilities',
          '## Session Protocol',
        ],
        optional: [
          '## Curriculum Map',
          '## Assessment Criteria',
          '## Engagement Strategy',
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
