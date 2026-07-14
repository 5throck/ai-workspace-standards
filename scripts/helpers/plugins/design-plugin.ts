/**
 * @file Design Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'design' variant type.
 * Provides design-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — visual-design, user-research, prototyping, design-system
 *   2. Accessibility compliance mention (WARNING) — accessibility compliance reference
 *   3. Design token system mention (INFO) — design token system documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'design' variant type.
 *
 * Handles design-specific validation and golden reference generation for
 * variants focused on visual design, user experience, and design systems.
 * Design variants have unique requirements around accessibility compliance,
 * design tokens, and component standards that go beyond standard variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { DesignPlugin } from './helpers/plugins/design-plugin.ts';
 * const plugin = new DesignPlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class DesignPlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'design' as const;

  /**
   * Validates a design variant against design-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required design capabilities: visual-design,
   *      user-research, prototyping, and design-system. Missing any produces
   *      an ERROR.
   *   2. **Accessibility compliance mention** (WARNING) — Checks whether the
   *      variant documentation references accessibility compliance. Design
   *      variants should explicitly document accessibility standards.
   *   3. **Design token system mention** (INFO) — Checks whether the variant
   *      documents a design token system. This is informational; not all
   *      design contexts require explicit design token system documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Design-specific capability coverage ---
    // Verify that agents collectively cover visual-design, user-research,
    // prototyping, and design-system.
    // These are hard functional requirements — design variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'visual-design',
      'user-research',
      'prototyping',
      'design-system',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing design capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Accessibility compliance mention ---
    // Design variants should reference accessibility compliance in their documentation.
    // Accessibility is a critical quality attribute for inclusive design workflows.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('accessibility')
    ) {
      issues.push({
        severity: 'warning',
        category: 'accessibility-compliance',
        message:
          'Design variant should reference accessibility compliance standards',
      });
    }

    // --- Check 3: Design token system mention ---
    // Standard design token system documentation for design contexts.
    // This is informational; not all design contexts require explicit design token system docs.
    if (
      !variantContent.toLowerCase().includes('design token')
    ) {
      issues.push({
        severity: 'info',
        category: 'design-token-system',
        message:
          'Consider documenting design token system standards',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for design variants.
   *
   * Defines expected section headings for agent files and skill files in
   * design variants. Agent files require standard sections (Role, Responsibilities,
   * Collaboration Protocol) plus design-specific optional sections (Design
   * Principles, Style Guide, Component Standards).
   *
   * @returns The golden reference for design variants.
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
          '## Design Principles',
          '## Style Guide',
          '## Component Standards',
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
