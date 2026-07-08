/**
 * @file Game Plugin Implementation
 * @version 1.0.0
 *
 * Implements the VariantPlugin interface for the 'game' variant type.
 * Provides game-specific validation logic and golden reference structure.
 *
 * Design: docs/designs/variant-registry-architecture-design.md §5.4
 *
 * Validation checks performed:
 *   1. Capability coverage (ERROR) — game-design, game-loop, asset-pipeline, debugging
 *   2. Performance budget mention (WARNING) — 60fps or "performance budget" reference
 *   3. Architecture pattern mention (INFO) — collision/tile grid pattern documentation
 */

import type {
  VariantPlugin,
  ValidationContext,
  ValidationIssue,
  GoldenReference,
} from './variant-plugin.ts';

/**
 * Plugin for the 'game' variant type.
 *
 * Handles game-specific validation and golden reference generation for
 * HTML5 Canvas games built with Vanilla TypeScript. Game variants have
 * unique requirements around performance budgets, asset pipelines, and
 * gameplay architecture that go beyond standard variant checks.
 *
 * Registered via explicit registration in plugins/index.ts (NOT self-register
 * on import — see design doc §5.3 for rationale).
 *
 * @example
 * ```typescript
 * import { GamePlugin } from './helpers/plugins/game-plugin.ts';
 * const plugin = new GamePlugin();
 * const issues = await plugin.validate(ctx);
 * const ref = plugin.goldenReference();
 * ```
 */
export class GamePlugin implements VariantPlugin {
  /** The variant type this plugin handles. */
  readonly type = 'game' as const;

  /**
   * Validates a game variant against game-specific requirements.
   *
   * Performs three tiers of checks:
   *   1. **Capability coverage** (ERROR) — Verifies that agents collectively
   *      cover the four required game capabilities: game-design, game-loop,
   *      asset-pipeline, and debugging. Missing any produces an ERROR.
   *   2. **Performance budget mention** (WARNING) — Checks whether the variant
   *      documentation references a performance budget (e.g., 60fps target).
   *      Game variants should explicitly document frame rate targets.
   *   3. **Architecture pattern mention** (INFO) — Checks whether the variant
   *      documents collision or tile grid architecture patterns. This is
   *      informational; not all game types use tile-based collision.
   *
   * @param ctx - The validation context containing agent frontmatters and variant data.
   * @returns Array of validation issues found (may be empty).
   */
  async validate(ctx: ValidationContext): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];

    // --- Check 1: Game-specific capability coverage ---
    // Verify that agents collectively cover game-design, game-loop, asset-pipeline, debugging.
    // These are hard functional requirements — game variants cannot function without them.
    const agentCapabilities = new Set(
      ctx.agentFrontmatters.flatMap((a) => a.capabilities),
    );
    const expectedCapabilities = [
      'game-design',
      'game-loop',
      'asset-pipeline',
      'debugging',
    ];
    for (const cap of expectedCapabilities) {
      if (!agentCapabilities.has(cap)) {
        issues.push({
          severity: 'error',
          category: 'capability-coverage',
          message: `Missing game capability: ${cap}`,
          capability: cap,
        });
      }
    }

    // --- Check 2: Performance budget mention ---
    // Game variants should reference a performance budget in their documentation.
    // A 60fps target is the standard for smooth HTML5 Canvas gameplay.
    const variantContent = JSON.stringify(ctx.variantJson);
    if (
      !variantContent.toLowerCase().includes('fps') &&
      !variantContent.toLowerCase().includes('performance budget')
    ) {
      issues.push({
        severity: 'warning',
        category: 'performance-budget',
        message:
          'Game variant should reference a performance budget (e.g., 60fps target)',
      });
    }

    // --- Check 3: Architecture pattern mention ---
    // Standard game architecture pattern for 2D games — tile-based collision grids.
    // This is informational; not all game types use this pattern.
    if (
      !variantContent.toLowerCase().includes('collision') &&
      !variantContent.toLowerCase().includes('tile')
    ) {
      issues.push({
        severity: 'info',
        category: 'architecture-pattern',
        message:
          'Consider documenting collision/tile grid architecture pattern',
      });
    }

    return issues;
  }

  /**
   * Returns the golden reference structure for game variants.
   *
   * Defines expected section headings for agent files and skill files in
   * game variants. Agent files require standard sections (Role, Responsibilities,
   * Collaboration Protocol) plus game-specific optional sections (Game Mechanics,
   * Performance Budget, Asset Pipeline, Technical Constraints).
   *
   * @returns The golden reference for game variants.
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
          '## Game Mechanics',
          '## Performance Budget',
          '## Asset Pipeline',
          '## Technical Constraints',
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
