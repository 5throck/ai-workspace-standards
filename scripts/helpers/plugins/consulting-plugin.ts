/**
 * @file Consulting Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'consulting' variant type.
 * Provides consulting-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — client-engagement, analysis, reporting, presentation
 *   2. Engagement methodology mention (WARNING) — engagement methodology reference
 *   3. Deliverable template mention (INFO) — deliverable template documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'consulting' variant type.
 *
 * Handles consulting-specific validation and golden reference generation for
 * variants focused on client engagement, analysis, and professional services
 * delivery. Consulting variants have unique requirements around engagement
 * methodology, deliverable standards, and quality checklists that go beyond
 * standard variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { ConsultingPlugin } from './helpers/plugins/consulting-plugin.ts';
 * const plugin = new ConsultingPlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class ConsultingPlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'consulting' as const;

  /**
   * Validates a consulting variant against consulting-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required consulting capabilities: client-engagement,
   *      analysis, reporting, and presentation. Missing any produces an ERROR.
   *   2. **Engagement methodology mention** (WARNING) — Checks whether the
   *      variant documentation references an engagement methodology. Consulting
   *      variants should explicitly document their engagement approach.
   *   3. **Deliverable template mention** (INFO) — Checks whether the variant
   *      documents deliverable templates. This is informational; not all
   *      consulting contexts require explicit deliverable template documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Consulting-specific capability coverage ---
    // Verify that agents collectively cover client-engagement, analysis,
    // reporting, and presentation.
    // These are hard functional requirements — consulting variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'client-engagement',
      'analysis',
      'reporting',
      'presentation',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing consulting capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Engagement methodology mention ---
    // Consulting variants should reference an engagement methodology in their documentation.
    // A structured methodology ensures consistent and repeatable client delivery.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('engagement methodology')
    ) {
      issues.push({
        severity: 'warning',
        category: 'engagement-methodology',
        message:
          'Consulting variant should reference an engagement methodology',
      });
    }

    // --- Check 3: Deliverable template mention ---
    // Standard deliverable template documentation for consulting contexts.
    // This is informational; not all consulting contexts require explicit deliverable template docs.
    if (
      !variantContent.toLowerCase().includes('deliverable template')
    ) {
      issues.push({
        severity: 'info',
        category: 'deliverable-template',
        message:
          'Consider documenting deliverable template standards',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for consulting variants.
   *
   * Defines expected section headings for agent files and skill files in
   * consulting variants. Agent files require standard sections (Role, Responsibilities,
   * Engagement Protocol) plus consulting-specific optional sections (Methodology,
   * Deliverable Standards, Quality Checklist).
   *
   * @returns The golden reference for consulting variants.
   */
  goldenReference(): GoldenReference {
    return {
      agentSections: {
        required: [
          '## Role',
          '## Responsibilities',
          '## Engagement Protocol',
        ],
        optional: [
          '## Methodology',
          '## Deliverable Standards',
          '## Quality Checklist',
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
