/**
 * @file Collaboration Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'collaboration' variant type.
 * Provides collaboration-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — communication, task-management, documentation, knowledge-sharing
 *   2. Team workflow mention (WARNING) — team workflow reference
 *   3. Meeting cadence mention (INFO) — meeting cadence documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'collaboration' variant type.
 *
 * Handles collaboration-specific validation and golden reference generation for
 * variants focused on team communication, task management, and knowledge sharing.
 * Collaboration variants have unique requirements around team workflows,
 * documentation standards, and meeting cadences that go beyond standard
 * variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { CollaborationPlugin } from './helpers/plugins/collaboration-plugin.ts';
 * const plugin = new CollaborationPlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class CollaborationPlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'collaboration' as const;

  /**
   * Validates a collaboration variant against collaboration-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required collaboration capabilities: communication,
   *      task-management, documentation, and knowledge-sharing. Missing any
   *      produces an ERROR.
   *   2. **Team workflow mention** (WARNING) — Checks whether the variant
   *      documentation references team workflow processes. Collaboration variants
   *      should explicitly document team workflows.
   *   3. **Meeting cadence mention** (INFO) — Checks whether the variant
   *      documents meeting cadence patterns. This is informational; not all
   *      collaboration contexts require explicit meeting cadence documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Collaboration-specific capability coverage ---
    // Verify that agents collectively cover communication, task-management,
    // documentation, and knowledge-sharing.
    // These are hard functional requirements — collaboration variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'communication',
      'task-management',
      'documentation',
      'knowledge-sharing',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing collaboration capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Team workflow mention ---
    // Collaboration variants should reference team workflows in their documentation.
    // Explicit workflow documentation ensures team members understand processes and handoffs.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('team workflow')
    ) {
      issues.push({
        severity: 'warning',
        category: 'team-workflow',
        message:
          'Collaboration variant should reference team workflow processes',
      });
    }

    // --- Check 3: Meeting cadence mention ---
    // Standard meeting cadence documentation for collaboration contexts.
    // This is informational; not all collaboration contexts require explicit meeting cadence docs.
    if (
      !variantContent.toLowerCase().includes('meeting cadence')
    ) {
      issues.push({
        severity: 'info',
        category: 'meeting-cadence',
        message:
          'Consider documenting meeting cadence standards',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for collaboration variants.
   *
   * Defines expected section headings for agent files and skill files in
   * collaboration variants. Agent files require standard sections (Role, Responsibilities,
   * Collaboration Protocol) plus collaboration-specific optional sections (Workflow
   * Guidelines, Documentation Standards, Team Norms).
   *
   * @returns The golden reference for collaboration variants.
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
          '## Workflow Guidelines',
          '## Documentation Standards',
          '## Team Norms',
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
