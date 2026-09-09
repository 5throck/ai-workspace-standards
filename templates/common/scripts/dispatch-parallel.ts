#!/usr/bin/env bun
/**
 * Parallel Agent Dispatcher
 * @version 1.1.1
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

interface DispatchOptions {
  dryRun?: boolean;
}

/**
 * Default parallel agent configurations for workspace workflows.
 * Roles map to agent definitions in agents/ directory.
 */
const defaultTasks: ParallelAgentTask[] = [
  {
    description: "Codebase analysis",
    role: "architect",
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
    description: "Documentation audit",
    role: "docs-writer",
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
    description: "Security review",
    role: "security-expert",
    task: "Run security checks on the project",
    context: [
      "Scan for secrets or unsafe patterns",
      "Check dependency vulnerabilities",
      "Validate permission configurations"
    ],
    outputFormat: "markdown",
    priority: "high"
  },
  {
    description: "Quality gate audit",
    role: "auditor",
    task: "Run bun scripts/audit.ts and report all findings",
    context: [
      "Run full workspace audit",
      "Check lifecycle sync",
      "Verify skill definitions"
    ],
    outputFormat: "markdown",
    priority: "low"
  }
];

/**
 * Dispatch a single agent task
 * In production, this would invoke the Agent tool or call the appropriate API
 */
async function dispatchAgent(task: ParallelAgentTask, options: DispatchOptions = {}): Promise<DispatchResult> {
  const startTime = Date.now();

  try {
    console.log(`   [${task.priority || 'medium'}] ${task.description}`);
    console.log(`   Role: ${task.role}`);
    console.log(`   Task: ${task.task.substring(0, 60)}${task.task.length > 60 ? '...' : ''}`);

    const elapsed = Date.now() - startTime;

    if (options.dryRun) {
      console.log(`   ✅ Dry run accepted (${elapsed}ms)\n`);
      return {
        task,
        status: 'completed',
        output: 'dry-run',
        timestamp: new Date()
      };
    }

    const errMsg = 'CLI dispatch cannot invoke the host Agent tool. Run with --dry-run, or dispatch this task from the PM/orchestrator session.';
    console.log(`   ❌ Failed: ${errMsg} (${elapsed}ms)\n`);
      return {
        task,
        status: 'failed',
        error: errMsg,
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
export async function dispatchParallel(tasks: ParallelAgentTask[], options: DispatchOptions = {}): Promise<DispatchResult[]> {
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
    prioritizedTasks.map(task => dispatchAgent(task, options))
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
 * CLI entry point, also callable by variant wrappers (ADR-0050 Part 1).
 * `args` defaults to process.argv; `defaults` lets a variant supply its own
 * default task list while reusing the common argument parsing and dispatch.
 */
export async function runCli(
  args: string[] = process.argv.slice(2),
  defaults: ParallelAgentTask[] = defaultTasks
): Promise<void> {
  const customTasks: ParallelAgentTask[] = [];

  const dryRun = args.includes('--dry-run');

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

  const tasksToRun = customTasks.length > 0 ? customTasks : defaults;

  try {
    const results = await dispatchParallel(tasksToRun, { dryRun });
    process.exit(results.some(result => result.status === 'failed') ? 1 : 0);
  } catch (error) {
    console.error('❌ Dispatch failed:', error);
    process.exit(1);
  }
}

/**
 * CLI entry point
 */
async function main() {
  await runCli();
}

/**
 * Export for direct module use - handles empty task array by using defaults
 */
export async function runDispatcher(tasks?: ParallelAgentTask[], options: DispatchOptions = {}): Promise<DispatchResult[]> {
  return dispatchParallel(tasks && tasks.length > 0 ? tasks : defaultTasks, options);
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { dispatchParallel as default, ParallelAgentTask, DispatchResult, DispatchOptions };

