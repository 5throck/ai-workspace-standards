// scripts/helpers/registries/promotion-policy.ts
// @version 1.2.0
// v1.2.0: safety entry added (mirrors abap-development) — d0ddc17f registered the
//         safety variant type without a policy, tripping the registry-integrity
//         exact-key-parity check (fatal) on every pipeline run.
// SSOT for beta-to-stable promotion policies

import type { VariantType } from './variant-type-registry.ts';

/**
 * Defines the criteria for promoting a variant type from beta to stable.
 */
export interface PromotionPolicy {
  /** Minimum number of completed engagements before promotion is eligible. */
  readonly minEngagements: number;
  /** Minimum number of months in beta before promotion is eligible. */
  readonly minBetaMonths: number;
  /** Optional additional checks that must pass (e.g., authorization-gate-review for security). */
  readonly additionalChecks?: readonly string[];
}

/**
 * Promotion policies keyed by variant type.
 * Uses `satisfies Record<VariantType, PromotionPolicy>` to ensure compile-time
 * completeness — adding a new variant type to variant-type-registry.ts without
 * a corresponding entry here produces a TypeScript error.
 */
export const PROMOTION_POLICIES = {
  security: {
    minEngagements: 5,
    minBetaMonths: 3,
    additionalChecks: ['authorization-gate-review'] as const,
  },
  development: {
    minEngagements: 3,
    minBetaMonths: 2,
  },
  design: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  consulting: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  collaboration: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  lecture: {
    minEngagements: 2,
    minBetaMonths: 2,
  },
  game: {
    minEngagements: 3,
    minBetaMonths: 3,
  },
  'abap-development': {
    minEngagements: 3,
    minBetaMonths: 2,
  },
  // safety: registered by d0ddc17f (co-safety variant regen) without a policy entry,
  // which tripped the registry-integrity exact-key-parity check (fatal) on every
  // pipeline run. Values mirror 'abap-development' (domain-specialist type); they only
  // bind when a safety-type promotion actually runs — flagged for architect review.
  safety: {
    minEngagements: 3,
    minBetaMonths: 2,
  },
} satisfies Record<VariantType, PromotionPolicy>;

/**
 * Returns the promotion policy for a variant type.
 *
 * @param type - A registered variant type key.
 * @returns The promotion policy for the given type.
 * @throws {Error} If the type is not registered (should not happen when using VariantType type).
 */
export function getPromotionPolicy(type: VariantType): PromotionPolicy {
  return PROMOTION_POLICIES[type];
}
