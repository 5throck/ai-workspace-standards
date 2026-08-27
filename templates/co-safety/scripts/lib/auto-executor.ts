#!/usr/bin/env bun
/**
 * Auto-Executor for Auto-Mode Workflow
 * @version 1.0.0
 *
 * Orchestrates the entire auto-mode workflow with proper error handling
 * and user interaction. Manages phase group execution, checkpoint creation,
 * rollback, and user notifications.
 *
 * Usage:
 *   import { AutoExecutor } from './lib/auto-executor';
 *
 *   const executor = new AutoExecutor(dispatcher, checkpointManager);
 *   const result = await executor.executePhaseGroup(phaseGroup);
 *
 * @module auto-executor
 */

import { createDispatcher, type PlatformDispatcher, type AgentTask, type DispatchResult } from './platform-dispatcher';
import { withRetry, classifyError, getRecoverySuggestion, escalateToHuman } from '../retry-handler';
import checkpointManager, { type Checkpoint } from './checkpoint-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface PhaseGroup {
  id: string;
  name: string;
  description: string;
  tasks: AgentTask[];
  executionMode: 'sequential' | 'parallel';
  critical: boolean; // Whether failure should pause execution
  phase: number;
}

export interface ExecutionResult {
  success: boolean;
  completedTasks: number;
  totalTasks: number;
  failures: TaskFailure[];
  checkpoints: string[];
  duration: number;
  userActionRequired: boolean;
}

export interface TaskFailure {
  task: AgentTask;
  error: Error;
  attempts: number;
  critical: boolean;
  recoverable: boolean;
}

export interface UserNotification {
  type: 'error' | 'warning' | 'success' | 'paused';
  task: AgentTask;
  message: string;
  error?: Error;
  options?: UserOption[];
  checkpointId?: string;
}

export interface UserOption {
  label: string;
  action: 'retry' | 'skip' | 'rollback' | 'abort';
  description: string;
}

// ============================================================================
// AUTO-EXECUTOR CLASS
// ============================================================================

export class AutoExecutor {
  private taskStates: Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'> = new Map();
  private completedTasks: string[] = [];
  private failures: TaskFailure[] = [];
  private checkpoints: string[] = [];
  private currentPhase: number = 0;

  constructor(
    private dispatcher: PlatformDispatcher,
    private checkpointMgr: typeof checkpointManager
  ) {}

  /**
   * Execute a phase group with error handling and checkpointing
   */
  async executePhaseGroup(group: PhaseGroup): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.currentPhase = group.phase;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 Phase Group: ${group.name}`);
    console.log(`📝 Description: ${group.description}`);
    console.log(`🎯 Mode: ${group.executionMode}`);
    console.log(`⚠️  Critical: ${group.critical ? 'Yes' : 'No'}`);
    console.log(`📦 Tasks: ${group.tasks.length}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      if (group.executionMode === 'sequential') {
        await this.executeSequential(group);
      } else {
        await this.executeParallel(group);
      }

      const duration = Date.now() - startTime;
      return {
        success: this.failures.length === 0,
        completedTasks: this.completedTasks.length,
        totalTasks: group.tasks.length,
        failures: this.failures,
        checkpoints: this.checkpoints,
        duration,
        userActionRequired: this.failures.some(f => f.critical && f.recoverable)
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`\n❌ Phase group execution failed:`, error);

      return {
        success: false,
        completedTasks: this.completedTasks.length,
        totalTasks: group.tasks.length,
        failures: this.failures,
        checkpoints: this.checkpoints,
        duration,
        userActionRequired: true
      };
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeSequential(group: PhaseGroup): Promise<void> {
    for (const task of group.tasks) {
      const taskId = `${group.phase}-${task.description.replace(/\s+/g, '-').toLowerCase()}`;
      this.taskStates.set(taskId, 'in_progress');

      try {
        console.log(`\n→ Executing: ${task.description}`);
        console.log(`   Role: ${task.role}`);
        console.log(`   Task ID: ${taskId}`);

        // Execute with retry logic
        const result = await this.executeTaskWithRetry(task, group.critical);

        if (result.success) {
          this.taskStates.set(taskId, 'completed');
          this.completedTasks.push(taskId);
          console.log(`   ✅ Completed (${result.attempts} attempts, ${result.totalTime}ms)`);

          // Create checkpoint after successful task
          this.createCheckpoint(task, group.phase);
        } else {
          this.taskStates.set(taskId, 'failed');
          this.handleTaskFailure(task, result.lastError!, group.critical, taskId, result.attempts);
        }
      } catch (error) {
        this.taskStates.set(taskId, 'failed');
        this.handleTaskFailure(task, error as Error, group.critical, taskId);
      }
    }
  }

  /**
   * Execute tasks in parallel
   */
  private async executeParallel(group: PhaseGroup): Promise<void> {
    console.log(`\n🔄 Executing ${group.tasks.length} tasks in parallel...\n`);

    const taskIds = group.tasks.map(task =>
      `${group.phase}-${task.description.replace(/\s+/g, '-').toLowerCase()}`
    );

    // Mark all as in_progress
    taskIds.forEach(id => this.taskStates.set(id, 'in_progress'));

    try {
      const results = await this.dispatcher.dispatchParallel(group.tasks);

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const taskId = taskIds[i];

        if (result.status === 'completed') {
          this.taskStates.set(taskId, 'completed');
          this.completedTasks.push(taskId);
          console.log(`   ✅ ${result.task.description} completed (${result.duration}ms)`);
        } else if (result.status === 'failed') {
          this.taskStates.set(taskId, 'failed');
          const error = new Error(result.error || 'Unknown error');
          this.handleTaskFailure(result.task, error, group.critical, taskId);
        }
      }

      // Create checkpoint after all parallel tasks complete
      if (results.every(r => r.status === 'completed')) {
        this.createCheckpoint(group.tasks[0], group.phase);
      }
    } catch (error) {
      console.error(`\n❌ Parallel execution failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTaskWithRetry(
    task: AgentTask,
    critical: boolean
  ): Promise<{ success: boolean; attempts: number; totalTime: number; lastError?: Error }> {
    const maxRetries = critical ? 3 : 1; // Non-critical tasks skip retry

    const result = await withRetry(
      async () => {
        const dispatchResult = await this.dispatcher.dispatchAgent(task);
        // Throw error if dispatch failed so withRetry will retry
        if (dispatchResult.status === 'failed') {
          throw new Error(dispatchResult.error || 'Task dispatch failed');
        }
        return dispatchResult;
      },
      { ...await import('../retry-handler').then(m => m.DEFAULT_CONFIG), maxRetries },
      task.description
    );

    return {
      success: result.success,
      attempts: result.attempts,
      totalTime: result.totalTime,
      lastError: result.lastError
    };
  }

  /**
   * Handle task failure with appropriate recovery strategy
   */
  private handleError(task: AgentTask, error: Error): Promise<void> {
    console.error(`\n❌ Task failed: ${task.description}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Role: ${task.role}`);

    // Classify error type
    const errorType = classifyError(error);
    const suggestion = getRecoverySuggestion(errorType);

    console.error(`   Type: ${errorType}`);
    console.error(`   Suggestion: ${suggestion}`);

    return Promise.resolve();
  }

  /**
   * Create checkpoint for current task state
   */
  private createCheckpoint(task: AgentTask, phase: number): void {
    const checkpointId = this.checkpointMgr.createCheckpoint(
      phase,
      this.completedTasks,
      this.taskStates
    );

    this.checkpoints.push(checkpointId);
    console.log(`   📸 Checkpoint created: ${checkpointId}`);
  }

  /**
   * Rollback to specific checkpoint
   */
  async rollbackToCheckpoint(checkpointId: string): Promise<void> {
    console.log(`\n🔄 Rolling back to checkpoint: ${checkpointId}`);

    try {
      await this.checkpointMgr.restoreToCheckpoint(checkpointId);
      console.log(`   ✅ Rollback complete`);
    } catch (error) {
      console.error(`   ❌ Rollback failed:`, error);
      throw error;
    }
  }

  /**
   * Notify user about task failure and await decision
   */
  notifyUser(task: AgentTask, error: Error): UserNotification {
    const errorType = classifyError(error);
    const suggestion = getRecoverySuggestion(errorType);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`⏸️  TASK FAILED: ${task.description}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`Role: ${task.role}`);
    console.log(`Error: ${error.message}`);
    console.log(`Type: ${errorType}`);
    console.log(`Suggestion: ${suggestion}`);
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`OPTIONS:`);
    console.log(`1. 🔄 Retry - Attempt the task again`);
    console.log(`2. ⏭️  Skip - Continue to next task`);
    console.log(`3. ⏪ Rollback - Revert to last checkpoint`);
    console.log(`4. 🛑 Abort - Stop execution`);
    console.log(`${'═'.repeat(60)}\n`);

    const notification: UserNotification = {
      type: 'paused',
      task,
      message: `Task failed: ${error.message}`,
      error,
      options: [
        {
          label: 'Retry',
          action: 'retry',
          description: 'Attempt the task again with same configuration'
        },
        {
          label: 'Skip',
          action: 'skip',
          description: 'Continue to next task (may cause downstream failures)'
        },
        {
          label: 'Rollback',
          action: 'rollback',
          description: 'Revert to last successful checkpoint'
        },
        {
          label: 'Abort',
          action: 'abort',
          description: 'Stop all execution and exit'
        }
      ],
      checkpointId: this.checkpoints[this.checkpoints.length - 1]
    };

    return notification;
  }

  /**
   * Handle task failure with user interaction
   */
  private handleTaskFailure(task: AgentTask, error: Error, critical: boolean, taskId: string, attempts: number): void {
    this.handleError(task, error);

    const failure: TaskFailure = {
      task,
      error,
      attempts,
      critical,
      recoverable: !critical || classifyError(error) !== 'tool'
    };

    this.failures.push(failure);

    // For critical failures, notify user
    if (critical) {
      const notification = this.notifyUser(task, error);
      console.log(`\n⚠️  User action required. Check notification above.`);

      // In auto-mode, this would trigger a user interaction prompt
      // For now, we log and continue
      console.log(`   📋 Notification ID: ${notification.checkpointId}`);
      console.log(`   📋 Next step: Await user decision\n`);
    } else {
      console.log(`   ⚠️  Non-critical task failed. Continuing execution...\n`);
    }
  }

  /**
   * Get execution summary
   */
  getSummary(): string {
    const lines = [
      `\n${'='.repeat(60)}`,
      `📊 EXECUTION SUMMARY`,
      `${'='.repeat(60)}`,
      `Completed Tasks: ${this.completedTasks.length}/${this.taskStates.size}`,
      `Failed Tasks: ${this.failures.length}`,
      `Checkpoints: ${this.checkpoints.length}`,
      `Current Phase: ${this.currentPhase}`,
      `${'='.repeat(60)}\n`
    ];

    return lines.join('\n');
  }

  /**
   * Clear all state (cleanup)
   */
  clearState(): void {
    this.taskStates.clear();
    this.completedTasks = [];
    this.failures = [];
    this.checkpoints = [];
    this.currentPhase = 0;
    this.checkpointMgr.clearCheckpoints();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create auto-executor with default dispatcher
 */
export function createAutoExecutor(): AutoExecutor {
  const dispatcher = createDispatcher();
  return new AutoExecutor(dispatcher, checkpointManager);
}

// ============================================================================
// CLI INTERFACE
// ============================================================================

if (import.meta.main) {
  console.log('Auto-Executor for Auto-Mode Workflow v1.0.0');
  console.log('This module is intended to be used programmatically.');
  console.log('Import createAutoExecutor() from ./lib/auto-executor');
  console.log('\nExample:');
  console.log('  import { createAutoExecutor } from "./lib/auto-executor";');
  console.log('  const executor = createAutoExecutor();');
  console.log('  const result = await executor.executePhaseGroup(phaseGroup);');
}
