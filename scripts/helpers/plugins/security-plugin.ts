/**
 * @file Security Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'security' variant type.
 * Provides security-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — threat-modeling, compliance-check, incident-response, access-control
 *   2. Authorization gate review mention (WARNING) — authorization-gate-review reference
 *   3. Encryption policy mention (INFO) — encryption policy documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'security' variant type.
 *
 * Handles security-specific validation and golden reference generation for
 * variants focused on security analysis, threat modeling, and compliance.
 * Security variants have unique requirements around access control, threat
 * modeling, and incident response that go beyond standard variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { SecurityPlugin } from './helpers/plugins/security-plugin.ts';
 * const plugin = new SecurityPlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class SecurityPlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'security' as const;

  /**
   * Validates a security variant against security-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required security capabilities: threat-modeling,
   *      compliance-check, incident-response, and access-control. Missing
   *      any produces an ERROR.
   *   2. **Authorization gate review mention** (WARNING) — Checks whether the
   *      variant documentation references an authorization gate review. Security
   *      variants should explicitly document authorization gate review processes.
   *   3. **Encryption policy mention** (INFO) — Checks whether the variant
   *      documents encryption policies. This is informational; not all security
   *      contexts require encryption policy documentation.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Security-specific capability coverage ---
    // Verify that agents collectively cover threat-modeling, compliance-check,
    // incident-response, and access-control.
    // These are hard functional requirements — security variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'threat-modeling',
      'compliance-check',
      'incident-response',
      'access-control',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing security capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Authorization gate review mention ---
    // Security variants should reference an authorization gate review in their documentation.
    // Authorization gates are a critical control point in security workflows.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('authorization-gate-review')
    ) {
      issues.push({
        severity: 'warning',
        category: 'authorization-gate-review',
        message:
          'Security variant should reference an authorization gate review process',
      });
    }

    // --- Check 3: Encryption policy mention ---
    // Standard encryption policy documentation for security contexts.
    // This is informational; not all security contexts require encryption policy documentation.
    if (
      !variantContent.toLowerCase().includes('encryption policy')
    ) {
      issues.push({
        severity: 'info',
        category: 'encryption-policy',
        message:
          'Consider documenting encryption policy standards',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for security variants.
   *
   * Defines expected section headings for agent files and skill files in
   * security variants. Agent files require standard sections (Role, Responsibilities,
   * Security Protocol) plus security-specific optional sections (Threat Model,
   * Compliance Requirements, Audit Procedures).
   *
   * @returns The golden reference for security variants.
   */
  goldenReference(): GoldenReference {
    return {
      agentSections: {
        required: [
          '## Role',
          '## Responsibilities',
          '## Security Protocol',
        ],
        optional: [
          '## Threat Model',
          '## Compliance Requirements',
          '## Audit Procedures',
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
