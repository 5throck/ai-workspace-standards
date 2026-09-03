#!/usr/bin/env bun
/**
 * Parallel Agent Dispatcher — VSP variant wrapper
 * @version 1.1.0
 * Automates dispatching multiple read-only subagents simultaneously
 *
 * Thin wrapper over the common dispatcher: this file only supplies the
 * VSP-specific default task list and re-exports the common implementation.
 * (ADR-0050 Part 1: Variant scripts inherit from templates/common, never duplicate)
 *
 * @module dispatch-parallel
 */

import {
  dispatchParallel as commonDispatchParallel,
  runCli as commonRunCli,
  type ParallelAgentTask,
  type DispatchResult
} from '../dispatch-parallel.ts';

/**
 * VSP-specific default tasks for parallel dispatch
 */
export const vspDefaultTasks: ParallelAgentTask[] = [
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
 * CLI entry point — delegates argument parsing and dispatch to the common module
 * with the VSP default task list.
 */
export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  await commonRunCli(args, vspDefaultTasks);
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
  void runCli();
}
