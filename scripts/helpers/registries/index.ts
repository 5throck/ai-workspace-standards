// scripts/helpers/registries/index.ts
// @version 1.0.0
// Barrel exports + cross-registry integrity validation

// --- Barrel Exports ---

export {
  VARIANT_TYPE_REGISTRY,
  type VariantType,
  type VariantTypeDefinition,
  isVariantType,
  listVariantTypes,
  getVariantTypeDefinition,
} from './variant-type-registry.ts';

export {
  CAPABILITY_REGISTRY,
  type Capability,
  isCapability,
} from './capability-registry.ts';

export {
  PROMOTION_POLICIES,
  type PromotionPolicy,
  getPromotionPolicy,
} from './promotion-policy.ts';

export {
  VALIDATION_POLICIES,
  type ValidationPolicy,
  getValidationPolicy,
} from './validation-policy.ts';

// --- Cross-Registry Integrity Validation ---

import { VARIANT_TYPE_REGISTRY } from './variant-type-registry.ts';
import { CAPABILITY_REGISTRY, isCapability } from './capability-registry.ts';
import { PROMOTION_POLICIES } from './promotion-policy.ts';
import { VALIDATION_POLICIES } from './validation-policy.ts';

/**
 * A single error or warning found during registry integrity validation.
 */
export interface RegistryIntegrityError {
  /** The registry where the issue was found (e.g., 'promotion-policy', 'validation-policy'). */
  readonly registry: string;
  /** Human-readable description of the issue. */
  readonly message: string;
  /** Severity of the issue — only 'error' counts as a failure. */
  readonly severity: 'error' | 'warning';
}

/**
 * Result of cross-registry integrity validation.
 */
export interface RegistryIntegrityReport {
  /** `true` if no ERROR-severity issues were found. */
  readonly passed: boolean;
  /** All issues found during validation (errors and warnings). */
  readonly errors: readonly RegistryIntegrityError[];
}

/**
 * Validates cross-registry integrity. Called during preflight checks
 * and at pipeline startup.
 *
 * Checks performed:
 *   1. VARIANT_TYPE_REGISTRY keys == PROMOTION_POLICIES keys (exact match)
 *   2. VARIANT_TYPE_REGISTRY keys == VALIDATION_POLICIES keys (exact match)
 *   3. No duplicate variant type names
 *   4. Every variant type has non-empty description
 *   5. Every VALIDATION_POLICIES entry references valid CAPABILITY_REGISTRY values
 *   6. Every PROMOTION_POLICIES entry has minEngagements >= 1 and minBetaMonths >= 1
 *   7. No unregistered capability references (explicit cross-check of all policies)
 *
 * @returns A report indicating whether all checks passed and any issues found.
 */
export function validateRegistryIntegrity(): RegistryIntegrityReport {
  const errors: RegistryIntegrityError[] = [];

  const typeKeys = Object.keys(VARIANT_TYPE_REGISTRY) as string[];
  const promotionKeys = Object.keys(PROMOTION_POLICIES) as string[];
  const validationKeys = Object.keys(VALIDATION_POLICIES) as string[];

  // Check 1: Type registry keys match promotion policy keys
  const missingPromotion = typeKeys.filter(k => !promotionKeys.includes(k));
  const extraPromotion = promotionKeys.filter(k => !typeKeys.includes(k));
  if (missingPromotion.length > 0) {
    errors.push({
      registry: 'promotion-policy',
      message: `Missing promotion policies for types: ${missingPromotion.join(', ')}`,
      severity: 'error',
    });
  }
  if (extraPromotion.length > 0) {
    errors.push({
      registry: 'promotion-policy',
      message: `Promotion policies for unregistered types: ${extraPromotion.join(', ')}`,
      severity: 'error',
    });
  }

  // Check 2: Type registry keys match validation policy keys
  const missingValidation = typeKeys.filter(k => !validationKeys.includes(k));
  const extraValidation = validationKeys.filter(k => !typeKeys.includes(k));
  if (missingValidation.length > 0) {
    errors.push({
      registry: 'validation-policy',
      message: `Missing validation policies for types: ${missingValidation.join(', ')}`,
      severity: 'error',
    });
  }
  if (extraValidation.length > 0) {
    errors.push({
      registry: 'validation-policy',
      message: `Validation policies for unregistered types: ${extraValidation.join(', ')}`,
      severity: 'error',
    });
  }

  // Check 3: No duplicate variant type names
  const names = Object.values(VARIANT_TYPE_REGISTRY).map(v => v.name);
  const duplicateNames = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicateNames.length > 0) {
    errors.push({
      registry: 'variant-type',
      message: `Duplicate variant type names: ${[...new Set(duplicateNames)].join(', ')}`,
      severity: 'error',
    });
  }

  // Check 4: Every variant type has non-empty description
  for (const [key, def] of Object.entries(VARIANT_TYPE_REGISTRY)) {
    if (!def.description || def.description.trim().length === 0) {
      errors.push({
        registry: 'variant-type',
        message: `Type "${key}" has empty description`,
        severity: 'warning',
      });
    }
  }

  // Check 5: Every VALIDATION_POLICIES entry references valid CAPABILITY_REGISTRY values
  const validCapabilities = new Set(Object.values(CAPABILITY_REGISTRY));
  for (const [type, policy] of Object.entries(VALIDATION_POLICIES)) {
    for (const cap of policy.requiredCapabilities) {
      if (!validCapabilities.has(cap)) {
        errors.push({
          registry: 'validation-policy',
          message: `Type "${type}" references unregistered capability: ${cap}`,
          severity: 'error',
        });
      }
    }
  }

  // Check 6: Every PROMOTION_POLICIES entry has valid bounds
  for (const [type, policy] of Object.entries(PROMOTION_POLICIES)) {
    if (policy.minEngagements < 1) {
      errors.push({
        registry: 'promotion-policy',
        message: `Type "${type}" has minEngagements < 1`,
        severity: 'error',
      });
    }
    if (policy.minBetaMonths < 1) {
      errors.push({
        registry: 'promotion-policy',
        message: `Type "${type}" has minBetaMonths < 1`,
        severity: 'error',
      });
    }
  }

  // Check 7: No unregistered capability references across all policies
  // Collect all capability references from validation policies and verify each
  // is registered in CAPABILITY_REGISTRY (explicit cross-check supplementing check 5)
  const allReferencedCapabilities = new Set<string>();
  for (const policy of Object.values(VALIDATION_POLICIES)) {
    for (const cap of policy.requiredCapabilities) {
      allReferencedCapabilities.add(cap);
    }
  }
  // Verify every referenced capability exists in the registry
  const registeredCapabilityValues = new Set(Object.values(CAPABILITY_REGISTRY));
  for (const ref of allReferencedCapabilities) {
    if (!registeredCapabilityValues.has(ref)) {
      // This would also be caught by check 5, but we report it with a distinct registry label
      // for clarity: check 5 is type-specific, check 7 is a global audit
      errors.push({
        registry: 'capability-registry',
        message: `Unregistered capability referenced in policies: ${ref}`,
        severity: 'error',
      });
    }
  }

  return {
    passed: errors.filter(e => e.severity === 'error').length === 0,
    errors,
  };
}
