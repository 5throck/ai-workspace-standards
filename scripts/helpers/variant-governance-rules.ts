#!/usr/bin/env tsx
/**
 * Variant Governance Rules
 *
 * Defines variant-weighted promotion criteria and dependency graph
 * for the L2-to-variant pipeline.
 *
 * Addresses Gap #2: Variant-weighted criteria for promotion
 * Addresses Gap #3: Dependency graph for reconciliation order
 *
 * @version 1.1.0
 * @phase 2-3: Governance & Integration
 *
 * Dependencies:
 * - lib/error-handling.ts (Error management)
 */

import { ErrorPhase, fatalError, warningError } from '../lib/error-handling.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/**
 * Variant promotion criteria by type
 * @version 1.1.0
 */
export interface VariantPromotionCriteria {
  /** Variant type identifier */
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration';
  /** Minimum number of client engagements required */
  minEngagements: number;
  /** Minimum beta duration in months */
  minBetaMonths: number;
  /** Additional validation checks required */
  additionalChecks: string[];
  /** Description of criteria rationale */
  rationale: string;
}

/**
 * Variant dependency specification
 * @version 1.1.0
 */
export interface VariantDependency {
  /** Variant name (e.g., 'co-work', 'co-consult') */
  variant: string;
  /** Variants this one depends on */
  dependsOn: string[];
  /** Reconciliation order (lower = earlier) */
  reconciliationOrder: number;
  /** Whether this variant can be reconciled in parallel */
  allowsParallelReconciliation: boolean;
  /** Description of dependency rationale */
  rationale: string;
}

/**
 * Promotion eligibility result
 * @version 1.1.0
 */
export interface PromotionEligibility {
  eligible: boolean;
  variantType: string;
  criteria: VariantPromotionCriteria;
  currentEngagements: number;
  currentBetaMonths: number;
  additionalChecksPassed: string[];
  additionalChecksFailed: string[];
  reasons: string[];
}

/**
 * Dependency validation result
 * @version 1.1.0
 */
export interface DependencyValidation {
  valid: boolean;
  variant: string;
  dependenciesSatisfied: boolean;
  circularDependencies: string[][];
  missingDependencies: string[];
  reconciliationOrder: number;
  canReconcileInParallel: boolean;
}

/**
 * L1 MAJOR update reconciliation plan
 * @version 1.1.0
 */
export interface L1MajorReconciliationPlan {
  l1Version: string;
  affectedVariants: string[];
  reconciliationSteps: Array<{
    order: number;
    variant: string;
    action: 'reconcile' | 'skip' | 'manual_review';
    reason: string;
  }>;
  estimatedDuration: string;
  requiresRollback: boolean;
}

// ============================================================================
// VARIANT-WEIGHTED PROMOTION CRITERIA (Gap #2 Solution)
// ============================================================================

/**
 * Promotion criteria by variant type
 *
 * Rationale:
 * - Security variants require highest engagement threshold (5 engagements / 6 months)
 *   due to critical nature and potential for security vulnerabilities
 * - Development variants require medium threshold (3 engagements / 3 months)
 *   for feature completeness and stability validation
 * - Consulting/Collaboration variants require lower threshold (2 engagements / 2 months)
 *   as they are process-focused and less code-intensive
 *
 * @version 1.1.0
 */
export const PROMOTION_CRITERIA_BY_TYPE: Record<string, VariantPromotionCriteria> = {
  security: {
    variantType: 'security',
    minEngagements: 5,
    minBetaMonths: 6,
    additionalChecks: [
      'security_review_passed',
      'penetration_testing_completed',
      'compliance_validation_passed',
      'incident_response_documented',
      'audit_log_compliance_verified',
    ],
    rationale: 'Security variants require rigorous validation due to critical impact of security vulnerabilities and compliance requirements.',
  },
  development: {
    variantType: 'development',
    minEngagements: 3,
    minBetaMonths: 3,
    additionalChecks: [
      'feature_coverage_complete',
      'integration_tests_passed',
      'performance_benchmarks_met',
      'api_stability_verified',
      'backward_compatibility_checked',
    ],
    rationale: 'Development variants require thorough validation of feature completeness and integration stability before promotion.',
  },
  design: {
    variantType: 'design',
    minEngagements: 2,
    minBetaMonths: 2,
    additionalChecks: [
      'design_system_compliance',
      'accessibility_standards_met',
      'responsive_design_verified',
      'cross_browser_testing_passed',
      'design_system_documentation_complete',
    ],
    rationale: 'Design variants require visual and UX consistency validation across different contexts.',
  },
  consulting: {
    variantType: 'consulting',
    minEngagements: 2,
    minBetaMonths: 2,
    additionalChecks: [
      'stakeholder_alignment_verified',
      'documentation_complete',
      'best_practices_documented',
      'case_study_available',
      'knowledge_transfer_material_ready',
    ],
    rationale: 'Consulting variants are process-focused and require validation of methodology and documentation quality.',
  },
  collaboration: {
    variantType: 'collaboration',
    minEngagements: 2,
    minBetaMonths: 2,
    additionalChecks: [
      'team_workflow_validated',
      'communication_channels_verified',
      'collaboration_tools_tested',
      'documentation_practices_checked',
      'feedback_mechanisms_tested',
    ],
    rationale: 'Collaboration variants require validation of team workflows and communication patterns.',
  },
};

/**
 * Check if variant is eligible for promotion from beta to stable
 * @version 1.1.0
 */
export function checkPromotionEligibility(
  variantName: string,
  variantType: keyof typeof PROMOTION_CRITERIA_BY_TYPE,
  currentEngagements: number,
  betaStartDate: Date,
  completedChecks: string[]
): PromotionEligibility {
  const criteria = PROMOTION_CRITERIA_BY_TYPE[variantType];

  if (!criteria) {
    throw fatalError(
      ErrorPhase.VALIDATION,
      'UNKNOWN_VARIANT_TYPE',
      `Unknown variant type: ${variantType}`,
      undefined,
      'Variant type must be one of: security, development, design, consulting, collaboration'
    );
  }

  const reasons: string[] = [];
  const additionalChecksPassed: string[] = [];
  const additionalChecksFailed: string[] = [];

  // Check engagement threshold
  const engagementsMet = currentEngagements >= criteria.minEngagements;
  if (!engagementsMet) {
    reasons.push(
      `Engagement threshold not met: ${currentEngagements}/${criteria.minEngagements} ` +
      `(${criteria.minEngagements - currentEngagements} more needed)`
    );
  } else {
    reasons.push(`Engagement threshold met: ${currentEngagements}/${criteria.minEngagements}`);
  }

  // Check beta duration
  const now = new Date();
  const betaMonths = (now.getTime() - betaStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  const betaMonthsMet = betaMonths >= criteria.minBetaMonths;

  if (!betaMonthsMet) {
    reasons.push(
      `Beta duration not met: ${betaMonths.toFixed(1)}/${criteria.minBetaMonths} months ` +
      `(${(criteria.minBetaMonths - betaMonths).toFixed(1)} months remaining)`
    );
  } else {
    reasons.push(`Beta duration met: ${betaMonths.toFixed(1)}/${criteria.minBetaMonths} months`);
  }

  // Check additional validation criteria
  for (const check of criteria.additionalChecks) {
    if (completedChecks.includes(check)) {
      additionalChecksPassed.push(check);
    } else {
      additionalChecksFailed.push(check);
    }
  }

  if (additionalChecksFailed.length > 0) {
    reasons.push(
      `Additional checks not passed: ${additionalChecksFailed.length}/${criteria.additionalChecks.length}`
    );
  } else {
    reasons.push(`All additional checks passed: ${additionalChecksPassed.length}/${criteria.additionalChecks.length}`);
  }

  const eligible = engagementsMet && betaMonthsMet && additionalChecksFailed.length === 0;

  return {
    eligible,
    variantType,
    criteria,
    currentEngagements,
    currentBetaMonths: betaMonths,
    additionalChecksPassed,
    additionalChecksFailed,
    reasons,
  };
}

// ============================================================================
// VARIANT DEPENDENCY GRAPH (Gap #3 Solution)
// ============================================================================

/**
 * Variant dependency graph
 *
 * Rationale:
 * - co-work is the foundational collaboration variant (order 1)
 * - co-consult builds on co-work (order 2)
 * - co-develop is independent of co-work (order 1)
 * - co-security builds on co-work and co-develop (order 3)
 * - All variants depend on templates/common
 *
 * This dependency graph ensures:
 * 1. Circular dependencies are detected and prevented
 * 2. Reconciliation happens in correct order
 * 3. Parallel reconciliation is enabled where safe
 * 4. L1 MAJOR updates trigger ordered reconciliation
 *
 * @version 1.1.0
 */
export const VARIANT_DEPENDENCY_GRAPH: VariantDependency[] = [
  {
    variant: 'templates/common',
    dependsOn: [],
    reconciliationOrder: 0,
    allowsParallelReconciliation: true,
    rationale: 'Common base template - no dependencies, always reconciled first',
  },
  {
    variant: 'co-work',
    dependsOn: ['templates/common'],
    reconciliationOrder: 1,
    allowsParallelReconciliation: true,
    rationale: 'Foundational collaboration variant - depends only on common',
  },
  {
    variant: 'co-develop',
    dependsOn: ['templates/common'],
    reconciliationOrder: 1,
    allowsParallelReconciliation: true,
    rationale: 'Development variant - depends only on common, independent of co-work',
  },
  {
    variant: 'co-consult',
    dependsOn: ['templates/common', 'co-work'],
    reconciliationOrder: 2,
    allowsParallelReconciliation: false,
    rationale: 'Consulting variant - depends on co-work for collaboration foundations',
  },
  {
    variant: 'co-security',
    dependsOn: ['templates/common', 'co-work', 'co-develop'],
    reconciliationOrder: 3,
    allowsParallelReconciliation: false,
    rationale: 'Security variant - depends on co-work and co-develop for comprehensive coverage',
  },
  {
    variant: 'co-design',
    dependsOn: ['templates/common'],
    reconciliationOrder: 1,
    allowsParallelReconciliation: true,
    rationale: 'Design variant - depends only on common, independent of other variants',
  },
];

/**
 * Build dependency map for quick lookup
 * @version 1.1.0
 */
function buildDependencyMap(): Map<string, VariantDependency> {
  const map = new Map<string, VariantDependency>();

  for (const dep of VARIANT_DEPENDENCY_GRAPH) {
    map.set(dep.variant, dep);
  }

  return map;
}

/**
 * Detect circular dependencies using DFS
 * @version 1.1.0
 */
function detectCircularDependencies(
  variant: string,
  dependencyMap: Map<string, VariantDependency>,
  visited: Set<string> = new Set(),
  path: string[] = []
): string[] | null {
  if (path.includes(variant)) {
    // Circular dependency found
    return [...path.slice(path.indexOf(variant)), variant];
  }

  if (visited.has(variant)) {
    return null;
  }

  visited.add(variant);
  path.push(variant);

  const dep = dependencyMap.get(variant);
  if (!dep) {
    return null;
  }

  for (const depVariant of dep.dependsOn) {
    const cycle = detectCircularDependencies(depVariant, dependencyMap, visited, [...path]);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

/**
 * Validate variant dependencies
 * @version 1.1.0
 */
export function validateDependencies(variantName: string): DependencyValidation {
  const dependencyMap = buildDependencyMap();
  const dep = dependencyMap.get(variantName);

  if (!dep) {
    return {
      valid: false,
      variant: variantName,
      dependenciesSatisfied: false,
      circularDependencies: [],
      missingDependencies: [],
      reconciliationOrder: -1,
      canReconcileInParallel: false,
    };
  }

  // Check for circular dependencies
  const circularDeps: string[][] = [];
  for (const variant of dependencyMap.keys()) {
    const cycle = detectCircularDependencies(variant, dependencyMap);
    if (cycle) {
      circularDeps.push(cycle);
    }
  }

  // Check for missing dependencies
  const missingDeps: string[] = [];
  for (const depVariant of dep.dependsOn) {
    if (!dependencyMap.has(depVariant)) {
      missingDeps.push(depVariant);
    }
  }

  const dependenciesSatisfied = missingDeps.length === 0;
  const valid = dependenciesSatisfied && circularDeps.length === 0;

  return {
    valid,
    variant: variantName,
    dependenciesSatisfied,
    circularDependencies: circularDeps,
    missingDependencies: missingDeps,
    reconciliationOrder: dep.reconciliationOrder,
    canReconcileInParallel: dep.allowsParallelReconciliation,
  };
}

/**
 * Get ordered reconciliation list for multiple variants
 * @version 1.1.0
 */
export function getReconciliationOrder(variantNames: string[]): Array<{
  variant: string;
  order: number;
  canParallel: boolean;
}> {
  const dependencyMap = buildDependencyMap();
  const orderedVariants = variantNames.map(variant => {
    const dep = dependencyMap.get(variant);
    return {
      variant,
      order: dep?.reconciliationOrder ?? -1,
      canParallel: dep?.allowsParallelReconciliation ?? false,
    };
  });

  // Sort by reconciliation order
  orderedVariants.sort((a, b) => a.order - b.order);

  return orderedVariants;
}

/**
 * Plan L1 MAJOR update reconciliation
 * @version 1.1.0
 */
export function planL1MajorUpdate(newL1Version: string): L1MajorReconciliationPlan {
  console.log(`\n=== Planning L1 MAJOR Update Reconciliation ===`);
  console.log(`New L1 version: ${newL1Version}\n`);

  const dependencyMap = buildDependencyMap();

  // Get all variants (excluding templates/common)
  const variants = VARIANT_DEPENDENCY_GRAPH
    .filter(d => d.variant !== 'templates/common')
    .sort((a, b) => a.reconciliationOrder - b.reconciliationOrder);

  const reconciliationSteps = variants.map((variant, index) => ({
    order: variant.reconciliationOrder,
    variant: variant.variant,
    action: (variant.allowsParallelReconciliation ? 'reconcile' : 'reconcile') as 'reconcile' | 'skip' | 'manual_review',
    reason: variant.rationale,
  }));

  // Estimate duration (conservative: 30 min per variant)
  const estimatedDuration = `${variants.length * 30} minutes`;

  // L1 MAJOR updates always require rollback capability
  const requiresRollback = true;

  console.log(`Affected variants: ${variants.length}`);
  console.log(`Estimated duration: ${estimatedDuration}`);
  console.log(`Requires rollback: ${requiresRollback ? 'Yes' : 'No'}\n`);

  for (const step of reconciliationSteps) {
    console.log(`  ${step.order}. ${step.variant}: ${step.action} (${step.canParallel ? 'parallel' : 'sequential'})`);
    console.log(`     Reason: ${step.reason}`);
  }

  return {
    l1Version: newL1Version,
    affectedVariants: variants.map(v => v.variant),
    reconciliationSteps,
    estimatedDuration,
    requiresRollback,
  };
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'check-promotion': {
      const variantName = args[1];
      const variantType = args[2] as keyof typeof PROMOTION_CRITERIA_BY_TYPE;
      const engagements = parseInt(args[3], 10);
      const betaStart = new Date(args[4]);
      const checks = args.slice(5);

      const eligibility = checkPromotionEligibility(
        variantName,
        variantType,
        engagements,
        betaStart,
        checks
      );

      console.log('\n=== Promotion Eligibility Check ===');
      console.log(`Variant: ${variantName}`);
      console.log(`Type: ${variantType}`);
      console.log(`Eligible: ${eligibility.eligible ? 'Yes' : 'No'}`);
      console.log('\nReasons:');
      for (const reason of eligibility.reasons) {
        console.log(`  - ${reason}`);
      }

      if (!eligibility.eligible) {
        process.exit(1);
      }
      break;
    }

    case 'validate-deps': {
      const variantName = args[1];
      const validation = validateDependencies(variantName);

      console.log('\n=== Dependency Validation ===');
      console.log(`Variant: ${variantName}`);
      console.log(`Valid: ${validation.valid ? 'Yes' : 'No'}`);
      console.log(`Reconciliation order: ${validation.reconciliationOrder}`);
      console.log(`Can reconcile in parallel: ${validation.canReconcileInParallel ? 'Yes' : 'No'}`);

      if (validation.circularDependencies.length > 0) {
        console.log('\n⚠️  Circular dependencies detected:');
        for (const cycle of validation.circularDependencies) {
          console.log(`  - ${cycle.join(' → ')}`);
        }
      }

      if (validation.missingDependencies.length > 0) {
        console.log('\n⚠️  Missing dependencies:');
        for (const missing of validation.missingDependencies) {
          console.log(`  - ${missing}`);
        }
      }

      if (!validation.valid) {
        process.exit(1);
      }
      break;
    }

    case 'plan-l1-major': {
      const newL1Version = args[1];
      const plan = planL1MajorUpdate(newL1Version);

      console.log('\n✅ Reconciliation plan created');
      console.log(`Affected variants: ${plan.affectedVariants.length}`);
      console.log(`Estimated duration: ${plan.estimatedDuration}`);
      break;
    }

    default:
      console.error('Usage:');
      console.error('  bun scripts/helpers/variant-governance-rules.ts check-promotion <variant> <type> <engagements> <beta-start> <checks...>');
      console.error('  bun scripts/helpers/variant-governance-rules.ts validate-deps <variant>');
      console.error('  bun scripts/helpers/variant-governance-rules.ts plan-l1-major <new-l1-version>');
      process.exit(1);
  }

  process.exit(0);
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
