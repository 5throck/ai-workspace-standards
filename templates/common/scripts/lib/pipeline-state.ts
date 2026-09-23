/**
 * Pipeline State Library
 *
 * Rollback capability and intermediate state persistence.
 * Addresses Risk #5: Rollback Capability.
 *
 * @version 1.2.0
 * v1.2.0 (2026-09-23, adopt-project engine prerequisites): generalization required by
 *          in-place adopt flows that must persist state INSIDE the target project
 *          (.claude/adopt-project-state.json), not the workspace cwd. (1) Injectable
 *          state file via setStateFile()/resetStateFile() — default .pipeline-state/
 *          behavior unchanged for existing callers. (2) RollbackAction phase widened
 *          from the ErrorPhase enum to string so pipelines can name their own phases.
 *          (3) Snapshot-backed undo: addRollbackActionWithBackup() captures file
 *          content BEFORE the destructive write, and modify_file/delete_file/move_file
 *          rollback actions now restore from that snapshot instead of warning.
 * @version 1.1.2
 * @Risk #5: Rollback Capability (P1 - High)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { ErrorPhase } from './error-handling';

// ============================================================================
// TYPES
// ============================================================================

export type PipelineStatus = 'in_progress' | 'completed' | 'failed' | 'rolled_back';

/** Phase names are pipeline-specific since v1.2.0 — ErrorPhase values still accepted. */
export type PipelinePhase = ErrorPhase | string;

export interface RollbackAction {
  phase: PipelinePhase;
  action: string;
  target: string;
  executed: boolean;
  timestamp: string;
  /** v1.2.0: file content captured BEFORE the destructive write — enables true undo. */
  backup?: { encoding: 'utf8'; content: string };
}

export interface PipelineState {
  status: PipelineStatus;
  currentPhase: PipelinePhase;
  startedAt: string;
  completedAt?: string;
  variantName: string;
  l3ProjectPath?: string;
  rollbackActions: RollbackAction[];
  context: Record<string, unknown>;
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const STATE_DIR = join(process.cwd(), '.pipeline-state');
const STATE_FILE = join(STATE_DIR, 'current-state.json');

let stateFileOverride: string | null = null;

/**
 * Redirect all state operations to a specific file (v1.2.0). Pipelines that operate
 * inside a target project call this once at startup, e.g.
 * `setStateFile(join(projectDir, '.claude', 'adopt-project-state.json'))` — the
 * default `process.cwd()/.pipeline-state/current-state.json` would otherwise scatter
 * state into whatever directory the script was launched from.
 */
export function setStateFile(path: string): void {
  stateFileOverride = path;
}

/** Restore the default state file location (v1.2.0). */
export function resetStateFile(): void {
  stateFileOverride = null;
}

function resolveStateFile(): string {
  return stateFileOverride ?? STATE_FILE;
}

/**
 * Initialize pipeline state
 * @version 1.1.0
 */
export function initializeState(variantName: string, l3ProjectPath?: string, currentPhase: PipelinePhase = 'adr_validation'): PipelineState {
  const state: PipelineState = {
    status: 'in_progress',
    currentPhase,
    startedAt: new Date().toISOString(),
    variantName,
    l3ProjectPath,
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
  const stateFile = resolveStateFile();
  // Ensure state directory exists
  if (!existsSync(dirname(stateFile))) {
    mkdirSync(dirname(stateFile), { recursive: true });
  }

  writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Load pipeline state
 * @version 1.1.0
 */
export function loadState(): PipelineState | null {
  const stateFile = resolveStateFile();
  if (!existsSync(stateFile)) {
    return null;
  }

  try {
    const content = readFileSync(stateFile, 'utf-8');
    return JSON.parse(content) as PipelineState;
  } catch {
    return null;
  }
}

/**
 * Update current phase
 * @version 1.1.0
 */
export function updatePhase(phase: PipelinePhase): void {
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
  phase: PipelinePhase,
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
 * Add a rollback action carrying a pre-destruction content snapshot (v1.2.0).
 * Call this BEFORE overwriting/moving/deleting `target` so the undo pass can
 * restore the exact prior content instead of warning "cannot restore".
 */
export function addRollbackActionWithBackup(
  phase: PipelinePhase,
  action: string,
  target: string
): void {
  const state = loadState();
  if (!state) {
    throw new Error('No active pipeline state found');
  }

  const backup = existsSync(target)
    ? { encoding: 'utf8' as const, content: readFileSync(target, 'utf8') }
    : undefined;

  state.rollbackActions.push({
    phase,
    action,
    target,
    executed: false,
    timestamp: new Date().toISOString(),
    ...(backup ? { backup } : {}),
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
      console.log(`⊘ Skipping already executed: ${action.action} (${action.target})`);
      continue;
    }

    console.log(`↶ Rolling back: ${action.action} (${action.target})`);

    try {
      await executeRollbackAction(action);
      action.executed = true;
      console.log(`✅ Rolled back: ${action.action}`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${action.action}`);
      console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
      success = false;
    }
  }

  saveState(state);

  if (success) {
    rollbackPipeline();
    console.log('\n✅ Rollback complete');
  } else {
    console.log('\n⚠️  Rollback completed with errors');
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
      // Delete created file (force: missing-ok, same semantics as `rm -f`)
      rmSync(target, { force: true });
      break;

    case 'create_directory':
      // Delete created directory (recursive+force, same semantics as `rm -rf`)
      rmSync(target, { recursive: true, force: true });
      break;

    case 'copy_file':
      // Delete copied file (force: missing-ok, same semantics as `rm -f`)
      rmSync(target, { force: true });
      break;

    case 'modify_file':
    case 'delete_file':
    case 'move_file':
      // v1.2.0: restore the pre-destruction snapshot when one was recorded.
      if (action.backup?.encoding === 'utf8') {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, action.backup.content, 'utf8');
      } else {
        console.warn(`⚠️  Cannot restore file without backup: ${target}`);
      }
      break;

    case 'update_registry':
      // Restore registry from backup
      if (action.backup?.encoding === 'utf8') {
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, action.backup.content, 'utf8');
      } else {
        console.warn(`⚠️  Cannot restore registry without backup: ${target}`);
      }
      break;

    default:
      console.warn(`⚠️  Unknown rollback action: ${actionType} on ${target}`);
  }
}

// ============================================================================
// STATE CLEANUP
// ============================================================================

/**
 * Clear pipeline state
 * @version 1.1.0
 */
export async function clearState(): Promise<void> {
  rmSync(resolveStateFile(), { force: true });
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
    state.l3ProjectPath ? `L3 Project: ${state.l3ProjectPath}` : null,
    `Rollback Actions: ${state.rollbackActions.length}`,
  ].filter(Boolean) as string[];

  return lines.join('\n');
}
