/**
 * Pipeline State Library
 *
 * Rollback capability and intermediate state persistence.
 * Addresses Risk #5: Rollback Capability.
 *
 * @version 1.1.0
 * @Risk #5: Rollback Capability (P1 - High)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ErrorPhase } from './error-handling';

// ============================================================================
// TYPES
// ============================================================================

export type PipelineStatus = 'in_progress' | 'completed' | 'failed' | 'rolled_back';

export interface RollbackAction {
  phase: ErrorPhase;
  action: string;
  target: string;
  executed: boolean;
  timestamp: string;
}

export interface PipelineState {
  status: PipelineStatus;
  currentPhase: ErrorPhase;
  startedAt: string;
  completedAt?: string;
  variantName: string;
  l2ProjectPath?: string;
  rollbackActions: RollbackAction[];
  context: Record<string, unknown>;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const STATE_DIR = join(process.cwd(), '.pipeline-state');
const STATE_FILE = join(STATE_DIR, 'current-state.json');

/**
 * Initialize pipeline state
 * @version 1.1.0
 */
export function initializeState(variantName: string, l2ProjectPath?: string): PipelineState {
  const state: PipelineState = {
    status: 'in_progress',
    currentPhase: 'adr_validation' as ErrorPhase,
    startedAt: new Date().toISOString(),
    variantName,
    l2ProjectPath,
    rollbackActions: [],
    context: {},
  };

  saveState(state);
  return state;
}

/**
 * Save pipeline state
 * @version 1.1.0
 */
export function saveState(state: PipelineState): void {
  // Ensure state directory exists
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }

  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Load pipeline state
 * @version 1.1.0
 */
export function loadState(): PipelineState | null {
  if (!existsSync(STATE_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(content) as PipelineState;
  } catch {
    return null;
  }
}

/**
 * Update current phase
 * @version 1.1.0
 */
export function updatePhase(phase: ErrorPhase): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  state.currentPhase = phase;
  saveState(state);
}

/**
 * Add rollback action
 * @version 1.1.0
 */
export function addRollbackAction(
  phase: ErrorPhase,
  action: string,
  target: string
): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  state.rollbackActions.push({
    phase,
    action,
    target,
    executed: false,
    timestamp: new Date().toISOString(),
  });

  saveState(state);
}

/**
 * Mark rollback action as executed
 * @version 1.1.0
 */
export function markRollbackExecuted(target: string): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  const action = state.rollbackActions.find(a => a.target === target);
  if (action) {
    action.executed = true;
    saveState(state);
  }
}

/**
 * Complete pipeline
 * @version 1.1.0
 */
export function completePipeline(): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  state.status = 'completed';
  state.completedAt = new Date().toISOString();
  saveState(state);
}

/**
 * Fail pipeline
 * @version 1.1.0
 */
export function failPipeline(): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  state.status = 'failed';
  state.completedAt = new Date().toISOString();
  saveState(state);
}

/**
 * Mark pipeline as rolled back
 * @version 1.1.0
 */
export function rollbackPipeline(): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  state.status = 'rolled_back';
  state.completedAt = new Date().toISOString();
  saveState(state);
}

// ============================================================================
// ROLLBACK EXECUTION
// ============================================================================

/**
 * Execute rollback actions
 * @version 1.1.0
 */
export async function executeRollback(): Promise<boolean> {
  const state = loadState();
  if (!state) {
    console.error('No active pipeline state found for rollback');
    return false;
  }

  console.log(`\n=== Rolling Back Pipeline ===`);
  console.log(`Variant: ${state.variantName}`);
  console.log(`Failed at phase: ${state.currentPhase}`);
  console.log(`Rollback actions: ${state.rollbackActions.length}\n`);

  let success = true;

  // Execute rollback actions in reverse order
  for (let i = state.rollbackActions.length - 1; i >= 0; i--) {
    const action = state.rollbackActions[i];

    if (action.executed) {
      console.log(`??Skipping already executed: ${action.action} (${action.target})`);
      continue;
    }

    console.log(`??Rolling back: ${action.action} (${action.target})`);

    try {
      await executeRollbackAction(action);
      action.executed = true;
      console.log(`??Rolled back: ${action.action}`);
    } catch (error) {
      console.error(`??Rollback failed: ${action.action}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      success = false;
    }
  }

  saveState(state);

  if (success) {
    rollbackPipeline();
    console.log('\n??Rollback complete');
  } else {
    console.log('\n?ая╕П  Rollback completed with errors');
  }

  return success;
}

/**
 * Execute individual rollback action
 * @version 1.1.0
 */
async function executeRollbackAction(action: RollbackAction): Promise<void> {
  const { action: actionType, target } = action;

  switch (actionType) {
    case 'create_file':
      // Delete created file
      await $`rm -f ${target}`.quiet();
      break;

    case 'create_directory':
      // Delete created directory
      await $`rm -rf ${target}`.quiet();
      break;

    case 'copy_file':
      // Delete copied file
      await $`rm -f ${target}`.quiet();
      break;

    case 'modify_file':
      // Restore from backup (would need backup mechanism)
      console.warn(`?ая╕П  Cannot restore file without backup: ${target}`);
      break;

    case 'update_registry':
      // Restore registry from backup
      console.warn(`?ая╕П  Cannot restore registry without backup: ${target}`);
      break;

    default:
      console.warn(`?ая╕П  Unknown rollback action: ${actionType} on ${target}`);
  }
}

// ============================================================================
// STATE CLEANUP
// ============================================================================

/**
 * Clear pipeline state
 * @version 1.1.0
 */
export function clearState(): void {
  if (existsSync(STATE_FILE)) {
    await $`rm ${STATE_FILE}`.quiet();
  }
}

/**
 * Get state summary
 * @version 1.1.0
 */
export function getStateSummary(): string | null {
  const state = loadState();
  if (!state) {
    return null;
  }

  const lines = [
    `Pipeline Status: ${state.status}`,
    `Current Phase: ${state.currentPhase}`,
    `Started: ${state.startedAt}`,
    state.completedAt ? `Completed: ${state.completedAt}` : null,
    `Variant: ${state.variantName}`,
    state.l2ProjectPath ? `L2 Project: ${state.l2ProjectPath}` : null,
    `Rollback Actions: ${state.rollbackActions.length}`,
  ].filter(Boolean) as string[];

  return lines.join('\n');
}
