#!/usr/bin/env bun
/**
 * Parallel Agent Dispatcher
 * Automates dispatching multiple read-only subagents simultaneously
 *
 * This dispatcher is optimized for tasks that can run independently:
 * - Codebase analysis
 * - Documentation generation
 * - Health checks
 * - Parallel investigation
 *
 * @module dispatch-parallel
 */

interface ParallelAgentTask {
  description: string;
  role: string;
  task: string;
  context?: string[];
  outputFormat?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface DispatchResult {
  task: ParallelAgentTask;
  status: 'dispatched' | 'completed' | 'failed';
  output?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Default parallel agent configurations for common VSP workflows
 */
const defaultTasks: ParallelAgentTask[] = [
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
 * Dispatch a single agent task
 * In production, this would invoke the Agent tool or call the appropriate API
 */
async function dispatchAgent(task: ParallelAgentTask): Promise<DispatchResult> {
  const startTime = Date.now();

  try {
    console.log(`   [${task.priority || 'medium'}] ${task.description}`);
    console.log(`   Role: ${task.role}`);
    console.log(`   Task: ${task.task.substring(0, 60)}${task.task.length > 60 ? '...' : ''}`);

    // Simulate agent dispatch
    // In real implementation, this would call:
    // - Agent tool for Claude Code subagents
    // - MCP server tools for specialized agents
    // - External API calls for remote agents

    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));

    const elapsed = Date.now() - startTime;
    console.log(`   ✅ Complete (${elapsed}ms)\n`);

    return {
      task,
      status: 'completed',
      output: `Output from ${task.role}`,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      task,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date()
    };
  }
}

/**
 * Dispatch multiple agents in parallel and await all results
 */
export async function dispatchParallel(tasks: ParallelAgentTask[]): Promise<DispatchResult[]> {
  console.log(`\n🚀 Parallel Agent Dispatcher`);
  console.log(`📊 Dispatching ${tasks.length} agents simultaneously\n`);
  console.log(`━${'━'.repeat(60)}`);

  const startTime = Date.now();

  // Sort by priority and dispatch in parallel
  const prioritizedTasks = [...tasks].sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return (priorityOrder[a.priority || 'medium'] ?? 1) - (priorityOrder[b.priority || 'medium'] ?? 1);
  });

  const results = await Promise.all(
    prioritizedTasks.map(task => dispatchAgent(task))
  );

  const elapsed = Date.now() - startTime;
  const completed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log(`━${'━'.repeat(60)}`);
  console.log(`\n📊 Results:`);
  console.log(`   ✅ Completed: ${completed}/${tasks.length}`);
  console.log(`   ❌ Failed: ${failed}/${tasks.length}`);
  console.log(`   ⏱️  Total time: ${elapsed}ms`);
  console.log(`   📈 Average per task: ${Math.round(elapsed / tasks.length)}ms\n`);

  return results;
}

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
        customTasks.push({
          description: parts[0],
          role: parts[1],
          task: parts[2],
          priority: (parts[3] as any) || 'medium'
        });
      }
      i++;
    }
  }

  const tasksToRun = customTasks.length > 0 ? customTasks : defaultTasks;

  try {
    await dispatchParallel(tasksToRun);
    process.exit(0);
  } catch (error) {
    console.error('❌ Dispatch failed:', error);
    process.exit(1);
  }
}

/**
 * Export for direct module use - handles empty task array by using defaults
 */
export async function runDispatcher(tasks?: ParallelAgentTask[]): Promise<DispatchResult[]> {
  return dispatchParallel(tasks && tasks.length > 0 ? tasks : defaultTasks);
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { dispatchParallel as default, ParallelAgentTask, DispatchResult };
