#!/usr/bin/env tsx
/**
 * Beta Lifecycle Manager
 *
 * Tracks beta variant lifecycle including engagements, bugs, and promotion eligibility.
 * Implements variant-weighted promotion criteria from governance rules.
 *
 * @version 1.1.0
 * @phase 3: Beta Lifecycle Management
 *
 * Dependencies:
 * - helpers/variant-governance-rules.ts (Promotion criteria)
 * - lib/error-handling.ts (Error management)
 */

import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { ErrorPhase, fatalError, warningError } from '../lib/error-handling.js';
import { PROMOTION_CRITERIA_BY_TYPE, checkPromotionEligibility } from './variant-governance-rules.js';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface BetaLifecycleState {
  /** Variant name */
  variantName: string;
  /** Variant type */
  variantType: string;
  /** Current status */
  status: 'beta' | 'stable';
  /** Status transition timestamp */
  statusSince: string;
  /** Beta creation timestamp */
  betaCreatedAt: string;
  /** Number of client engagements during beta */
  betaEngagements: number;
  /** Engagement log with timestamps */
  engagementLog: Engagement[];
  /** Number of bugs reported during beta */
  betaBugs: number;
  /** Bug log with severity and status */
  bugLog: Bug[];
  /** Age of beta in months */
  betaAgeInMonths: number;
  /** Promotion eligibility status */
  promotionEligible: boolean;
  /** Missing promotion criteria */
  missingCriteria: string[];
  /** Completed validation checks */
  completedChecks: string[];
}

export interface Engagement {
  /** Engagement timestamp */
  timestamp: string;
  /** Client identifier (obfuscated) */
  clientId: string;
  /** Engagement outcome */
  outcome: 'success' | 'failure' | 'ongoing';
  /** Notes */
  notes?: string;
}

export interface Bug {
  /** Bug report timestamp */
  timestamp: string;
  /** Bug severity */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Bug status */
  status: 'open' | 'in_progress' | 'resolved' | 'wontfix';
  /** Bug description */
  description: string;
}

export interface PromotionEligibilityResult {
  /** Whether promotion criteria are met */
  eligible: boolean;
  /** Current lifecycle state */
  currentState: BetaLifecycleState;
  /** Detailed eligibility check */
  eligibilityCheck: {
    engagementsMet: boolean;
    betaDurationMet: boolean;
    additionalChecksPassed: boolean;
    reasons: string[];
  };
  /** Recommendations to achieve eligibility */
  recommendations: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const WORKSPACE_ROOT = process.cwd();
const LIFECYCLE_DIR = join(WORKSPACE_ROOT, '.pipeline-state', 'beta-lifecycle');

// ============================================================================
// LIFECYCLE STATE MANAGEMENT
// ============================================================================

/**
 * Get lifecycle state file path for variant
 * @version 1.1.0
 */
function getLifecycleStatePath(variantName: string): string {
  return join(LIFECYCLE_DIR, `${variantName}.json`);
}

/**
 * Load lifecycle state for variant
 * @version 1.1.0
 */
export function loadLifecycleState(variantName: string): BetaLifecycleState | null {
  const statePath = getLifecycleStatePath(variantName);

  if (!existsSync(statePath)) {
    return null;
  }

  try {
    const content = readFileSync(statePath, 'utf-8');
    return JSON.parse(content) as BetaLifecycleState;
  } catch (error) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_LOAD_FAILED',
      `Failed to load lifecycle state for variant: ${variantName}`,
      error instanceof Error ? error.message : String(error),
      'Check lifecycle state file format and permissions'
    );
  }
}

/**
 * Save lifecycle state for variant
 * @version 1.1.0
 */
function saveLifecycleState(state: BetaLifecycleState): void {
  const statePath = getLifecycleStatePath(state.variantName);

  // Ensure directory exists
  if (!existsSync(LIFECYCLE_DIR)) {
    mkdirSync(LIFECYCLE_DIR, { recursive: true });
  }

  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_SAVE_FAILED',
      `Failed to save lifecycle state for variant: ${state.variantName}`,
      error instanceof Error ? error.message : String(error),
      'Check directory permissions and disk space'
    );
  }
}

/**
 * Initialize lifecycle state for new beta variant
 * @version 1.1.0
 */
export function initializeBetaLifecycle(
  variantName: string,
  variantType: 'security' | 'development' | 'design' | 'consulting' | 'collaboration'
): BetaLifecycleState {
  console.log(`\n=== Initializing Beta Lifecycle ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Type: ${variantType}\n`);

  const now = new Date().toISOString();

  const state: BetaLifecycleState = {
    variantName,
    variantType,
    status: 'beta',
    statusSince: now,
    betaCreatedAt: now,
    betaEngagements: 0,
    engagementLog: [],
    betaBugs: 0,
    bugLog: [],
    betaAgeInMonths: 0,
    promotionEligible: false,
    missingCriteria: [],
    completedChecks: [],
  };

  saveLifecycleState(state);

  console.log(`✅ Beta lifecycle initialized`);
  console.log(`State file: ${getLifecycleStatePath(variantName)}`);

  return state;
}

/**
 * Calculate beta age in months
 * @version 1.1.0
 */
function calculateBetaAge(betaCreatedAt: string): number {
  const created = new Date(betaCreatedAt);
  const now = new Date();
  const diffInMs = now.getTime() - created.getTime();
  const diffInMonths = diffInMs / (1000 * 60 * 60 * 24 * 30);
  return Math.floor(diffInMonths * 10) / 10; // Round to 1 decimal place
}

/**
 * Record client engagement
 * @version 1.1.0
 */
export function recordEngagement(
  variantName: string,
  clientId: string,
  outcome: 'success' | 'failure' | 'ongoing',
  notes?: string
): BetaLifecycleState {
  console.log(`\n=== Recording Engagement ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Client: ${clientId}`);
  console.log(`Outcome: ${outcome}\n`);

  let state = loadLifecycleState(variantName);

  if (!state) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_NOT_FOUND',
      `Lifecycle state not found for variant: ${variantName}`,
      undefined,
      'Initialize lifecycle state first using initializeBetaLifecycle'
    );
  }

  const engagement: Engagement = {
    timestamp: new Date().toISOString(),
    clientId,
    outcome,
    notes,
  };

  state.engagementLog.push(engagement);
  state.betaEngagements = state.engagementLog.length;

  // Recalculate eligibility
  const eligibility = checkPromotionEligibility(
    variantName,
    state.variantType as keyof typeof PROMOTION_CRITERIA_BY_TYPE,
    state.betaEngagements,
    new Date(state.betaCreatedAt),
    state.completedChecks
  );

  state.promotionEligible = eligibility.eligible;
  state.missingCriteria = eligibility.additionalChecksFailed;

  saveLifecycleState(state);

  console.log(`✅ Engagement recorded`);
  console.log(`Total engagements: ${state.betaEngagements}`);
  console.log(`Promotion eligible: ${state.promotionEligible ? 'Yes' : 'No'}`);

  return state;
}

/**
 * Record bug report
 * @version 1.1.0
 */
export function recordBug(
  variantName: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
  description: string
): BetaLifecycleState {
  console.log(`\n=== Recording Bug ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Severity: ${severity}\n`);

  let state = loadLifecycleState(variantName);

  if (!state) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_NOT_FOUND',
      `Lifecycle state not found for variant: ${variantName}`,
      undefined,
      'Initialize lifecycle state first using initializeBetaLifecycle'
    );
  }

  const bug: Bug = {
    timestamp: new Date().toISOString(),
    severity,
    status: 'open',
    description,
  };

  state.bugLog.push(bug);
  state.betaBugs = state.bugLog.length;

  saveLifecycleState(state);

  console.log(`✅ Bug recorded`);
  console.log(`Total bugs: ${state.betaBugs}`);

  return state;
}

/**
 * Update bug status
 * @version 1.1.0
 */
export function updateBugStatus(
  variantName: string,
  bugIndex: number,
  newStatus: 'open' | 'in_progress' | 'resolved' | 'wontfix'
): BetaLifecycleState {
  const state = loadLifecycleState(variantName);

  if (!state) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_NOT_FOUND',
      `Lifecycle state not found for variant: ${variantName}`
    );
  }

  if (bugIndex < 0 || bugIndex >= state.bugLog.length) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'INVALID_BUG_INDEX',
      `Invalid bug index: ${bugIndex} (total bugs: ${state.bugLog.length})`
    );
  }

  state.bugLog[bugIndex].status = newStatus;
  saveLifecycleState(state);

  console.log(`✅ Bug status updated: ${bugIndex} -> ${newStatus}`);

  return state;
}

/**
 * Record completed validation check
 * @version 1.1.0
 */
export function recordCompletedCheck(
  variantName: string,
  checkName: string
): BetaLifecycleState {
  console.log(`\n=== Recording Completed Check ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Check: ${checkName}\n`);

  const state = loadLifecycleState(variantName);

  if (!state) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_NOT_FOUND',
      `Lifecycle state not found for variant: ${variantName}`
    );
  }

  if (!state.completedChecks.includes(checkName)) {
    state.completedChecks.push(checkName);
  }

  // Recalculate eligibility
  const eligibility = checkPromotionEligibility(
    variantName,
    state.variantType as keyof typeof PROMOTION_CRITERIA_BY_TYPE,
    state.betaEngagements,
    new Date(state.betaCreatedAt),
    state.completedChecks
  );

  state.promotionEligible = eligibility.eligible;
  state.missingCriteria = eligibility.additionalChecksFailed;

  saveLifecycleState(state);

  console.log(`✅ Check recorded`);
  console.log(`Completed checks: ${state.completedChecks.length}`);
  console.log(`Promotion eligible: ${state.promotionEligible ? 'Yes' : 'No'}`);

  return state;
}

/**
 * Check promotion eligibility with full details
 * @version 1.1.0
 */
export function checkPromotionEligibilityDetails(
  variantName: string,
  variantType: string
): PromotionEligibilityResult {
  console.log(`\n=== Checking Promotion Eligibility ===`);
  console.log(`Variant: ${variantName}`);
  console.log(`Type: ${variantType}\n`);

  let state = loadLifecycleState(variantName);

  if (!state) {
    // Create initial state for check
    state = initializeBetaLifecycle(variantName, variantType as any);
  }

  // Update beta age
  state.betaAgeInMonths = calculateBetaAge(state.betaCreatedAt);

  // Check eligibility
  const eligibility = checkPromotionEligibility(
    variantName,
    variantType as keyof typeof PROMOTION_CRITERIA_BY_TYPE,
    state.betaEngagements,
    new Date(state.betaCreatedAt),
    state.completedChecks
  );

  state.promotionEligible = eligibility.eligible;
  state.missingCriteria = eligibility.additionalChecksFailed;
  saveLifecycleState(state);

  // Generate recommendations
  const recommendations: string[] = [];

  if (!eligibility.engagementsMet) {
    const criteria = PROMOTION_CRITERIA_BY_TYPE[variantType];
    if (criteria) {
      const needed = criteria.minEngagements - state.betaEngagements;
      recommendations.push(
        `Record ${needed} more client engagement${needed > 1 ? 's' : ''} ` +
        `(currently ${state.betaEngagements}/${criteria.minEngagements})`
      );
    }
  }

  if (!eligibility.betaDurationMet) {
    const criteria = PROMOTION_CRITERIA_BY_TYPE[variantType];
    if (criteria) {
      const monthsNeeded = (criteria.minBetaMonths - state.betaAgeInMonths).toFixed(1);
      recommendations.push(
        `Wait ${monthsNeeded} more month${parseFloat(monthsNeeded) > 1 ? 's' : ''} ` +
        `(currently ${state.betaAgeInMonths}/${criteria.minBetaMonths} months)`
      );
    }
  }

  if (eligibility.additionalChecksFailed.length > 0) {
    recommendations.push(
      `Complete ${eligibility.additionalChecksFailed.length} additional validation check(s):`
    );
    for (const check of eligibility.additionalChecksFailed) {
      recommendations.push(`  - ${check}`);
    }
  }

  console.log(`\n=== Eligibility Result ===`);
  console.log(`Eligible: ${eligibility.eligible ? 'Yes ✅' : 'No ❌'}`);
  console.log(`\nEngagements: ${state.betaEngagements} (met: ${eligibility.engagementsMet ? 'Yes' : 'No'})`);
  console.log(`Beta age: ${state.betaAgeInMonths} months (met: ${eligibility.betaDurationMet ? 'Yes' : 'No'})`);
  console.log(`Additional checks: ${eligibility.additionalChecksPassed.length}/${eligibility.additionalChecksPassed.length + eligibility.additionalChecksFailed.length} passed`);

  if (recommendations.length > 0) {
    console.log(`\nRecommendations:`);
    for (const rec of recommendations) {
      console.log(`  ${rec}`);
    }
  }

  return {
    eligible: eligibility.eligible,
    currentState: state,
    eligibilityCheck: {
      engagementsMet: eligibility.engagementsMet,
      betaDurationMet: eligibility.betaDurationMet,
      additionalChecksPassed: eligibility.additionalChecksFailed.length === 0,
      reasons: eligibility.reasons,
    },
    recommendations,
  };
}

/**
 * Promote variant to stable status
 * @version 1.1.0
 */
export function promoteToStable(variantName: string): BetaLifecycleState {
  console.log(`\n=== Promoting Variant to Stable ===`);
  console.log(`Variant: ${variantName}\n`);

  const state = loadLifecycleState(variantName);

  if (!state) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'LIFECYCLE_STATE_NOT_FOUND',
      `Lifecycle state not found for variant: ${variantName}`
    );
  }

  if (!state.promotionEligible) {
    throw fatalError(
      ErrorPhase.BETA_SETUP,
      'PROMOTION_NOT_ELIGIBLE',
      `Variant ${variantName} is not eligible for promotion`,
      undefined,
      'Complete all promotion criteria first (run check-promotion-eligibility for details)'
    );
  }

  const now = new Date().toISOString();
  state.status = 'stable';
  state.statusSince = now;

  saveLifecycleState(state);

  console.log(`✅ Variant promoted to stable`);
  console.log(`Status since: ${now}`);

  return state;
}

// ============================================================================
// MAIN ENTRY POINT (for standalone execution)
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init': {
      const variantName = args[1];
      const variantType = args[2] as 'security' | 'development' | 'design' | 'consulting' | 'collaboration';

      if (!variantName || !variantType) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts init <variant-name> <variant-type>');
        process.exit(1);
      }

      initializeBetaLifecycle(variantName, variantType);
      break;
    }

    case 'record-engagement': {
      const variantName = args[1];
      const clientId = args[2];
      const outcome = args[3] as 'success' | 'failure' | 'ongoing';
      const notes = args[4];

      if (!variantName || !clientId || !outcome) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts record-engagement <variant> <client-id> <success|failure|ongoing> [notes]');
        process.exit(1);
      }

      recordEngagement(variantName, clientId, outcome, notes);
      break;
    }

    case 'record-bug': {
      const variantName = args[1];
      const severity = args[2] as 'critical' | 'high' | 'medium' | 'low';
      const description = args[3];

      if (!variantName || !severity || !description) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts record-bug <variant> <critical|high|medium|low> <description>');
        process.exit(1);
      }

      recordBug(variantName, severity, description);
      break;
    }

    case 'update-bug': {
      const variantName = args[1];
      const bugIndex = parseInt(args[2], 10);
      const newStatus = args[3] as 'open' | 'in_progress' | 'resolved' | 'wontfix';

      if (!variantName || isNaN(bugIndex) || !newStatus) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts update-bug <variant> <bug-index> <open|in_progress|resolved|wontfix>');
        process.exit(1);
      }

      updateBugStatus(variantName, bugIndex, newStatus);
      break;
    }

    case 'record-check': {
      const variantName = args[1];
      const checkName = args[2];

      if (!variantName || !checkName) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts record-check <variant> <check-name>');
        process.exit(1);
      }

      recordCompletedCheck(variantName, checkName);
      break;
    }

    case 'check-eligibility': {
      const variantName = args[1];
      const variantType = args[2];

      if (!variantName || !variantType) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts check-eligibility <variant> <variant-type>');
        process.exit(1);
      }

      checkPromotionEligibilityDetails(variantName, variantType);
      break;
    }

    case 'promote': {
      const variantName = args[1];

      if (!variantName) {
        console.error('Usage: bun scripts/helpers/beta-lifecycle.ts promote <variant>');
        process.exit(1);
      }

      promoteToStable(variantName);
      break;
    }

    default:
      console.error('Usage:');
      console.error('  bun scripts/helpers/beta-lifecycle.ts init <variant> <type>');
      console.error('  bun scripts/helpers/beta-lifecycle.ts record-engagement <variant> <client> <outcome> [notes]');
      console.error('  bun scripts/helpers/beta-lifecycle.ts record-bug <variant> <severity> <description>');
      console.error('  bun scripts/helpers/beta-lifecycle.ts update-bug <variant> <index> <status>');
      console.error('  bun scripts/helpers/beta-lifecycle.ts record-check <variant> <check-name>');
      console.error('  bun scripts/helpers/beta-lifecycle.ts check-eligibility <variant> <type>');
      console.error('  bun scripts/helpers/beta-lifecycle.ts promote <variant>');
      process.exit(1);
  }

  process.exit(0);
}

// Run main if executed directly
if (import.meta.url === process.argv[1]) {
  main().catch(console.error);
}
