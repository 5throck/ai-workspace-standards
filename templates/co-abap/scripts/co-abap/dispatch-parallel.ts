#!/usr/bin/env bun
/**
 * Parallel Agent Dispatcher — VSP variant wrapper
 * @version 1.0.1
 * Automates dispatching multiple read-only subagents simultaneously
 *
 * Re-exports the common dispatcher with VSP-specific default tasks.
 * (ADR-0050: Variant scripts inherit from templates/common, never duplicate)
 *
 * @module dispatch-parallel
 */

import {
  dispatchParallel as commonDispatchParallel,
  type ParallelAgentTask,
  type DispatchResult
} from '../../dispatch-parallel.ts';

/**
 * VSP-specific default tasks for parallel dispatch
 */
const vspDefaultTasks: ParallelAgentTask[] = [
  {
    description: "Codebase analyzer",
    role: "code-analyst",
    task: "Analyze the codebase structure and identify key patterns",
    context: [
      "Look for architectural patterns",
      "Identify dependencies between components",
      "Check for code quality issues"
    ],
    outputFormat: "markdown",
    priority: "high"
  },
  {
    description: "Documentation auditor",
    role: "doc-auditor",
    task: "Audit all documentation files for consistency and completeness",
    context: [
      "Check CLAUDE.md files",
      "Verify README.md completeness",
      "Check AGENTS.md accuracy"
    ],
    outputFormat: "json",
    priority: "medium"
  },
  {
    description: "Health check runner",
    role: "health-checker",
    task: "Run comprehensive health checks on the project",
    context: [
      "Verify git hooks are installed",
      "Check MCP server configuration",
      "Validate skill definitions"
    ],
    outputFormat: "markdown",
    priority: "high"
  },
  {
    description: "Memory indexer",
    role: "memory-keeper",
    task: "Update the memory index with recent session changes",
    context: [
      "Scan memory/ directory",
      "Update MEMORY.md index",
      "Check for orphaned entries"
    ],
    outputFormat: "markdown",
    priority: "low"
  }
];

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const customTasks: ParallelAgentTask[] = [];

  // Parse custom tasks from command line
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      const parts = args[i + 1].split(':');
      if (parts.length >= 3) {
        const priority = ['high', 'medium', 'low'].includes(parts[3]) ? parts[3] as 'high' | 'medium' | 'low' : 'medium';
        customTasks.push({
          description: parts[0],
          role: parts[1],
          task: parts[2],
          priority
        });
      }
      i++;
    }
  }

  const tasksToRun = customTasks.length > 0 ? customTasks : vspDefaultTasks;

  try {
    await commonDispatchParallel(tasksToRun);
    process.exit(0);
  } catch (error) {
    console.error('❌ Dispatch failed:', error);
    process.exit(1);
  }
}

/**
 * Export for direct module use - handles empty task array by using VSP defaults
 */
export async function runDispatcher(tasks?: ParallelAgentTask[]): Promise<DispatchResult[]> {
  return commonDispatchParallel(tasks && tasks.length > 0 ? tasks : vspDefaultTasks);
}

// Re-export common types and functions for backward compatibility
export { commonDispatchParallel as dispatchParallel, type ParallelAgentTask, type DispatchResult };

// Run if executed directly
if (import.meta.main) {
  main();
}
