#!/usr/bin/env bun
/**
 * Serial Agent Dispatcher
 * @version 1.0.0
 * Automates dispatching subagents that must run sequentially
 *
 * This dispatcher is for tasks with dependencies:
 * - Code generation → Review → Test
 * - Implementation → Audit → Deploy
 * - Multi-phase workflows with handoffs
 *
 * @module dispatch-serial
 */

interface SerialAgentTask {
  description: string;
  role: string;
  task: string;
  dependsOn?: string;
  verifyOutput?: boolean;
  continueOnError?: boolean;
}

interface SerialPipelineResult {
  task: SerialAgentTask;
  status: 'completed' | 'failed' | 'skipped';
  output?: string;
  error?: string;
  timestamp: Date;
  duration: number;
}

interface SerialExecutionOptions {
  stopOnError?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
}

/**
 * Default serial pipeline for workspace development workflow.
 * Roles map to agent definitions in agents/ directory.
 */
const defaultPipeline: SerialAgentTask[] = [
  {
    description: "Implement feature",
    role: "automation-engineer",
    task: "Implement the new feature following the approved specification",
    verifyOutput: true
  },
  {
    description: "Review implementation",
    role: "architect",
    task: "Review the implemented feature for correctness and quality",
    dependsOn: "Implement feature",
    verifyOutput: true
  },
  {
    description: "Run quality gate",
    role: "auditor",
    task: "Run bun scripts/audit.ts and verify all checks pass",
    dependsOn: "Review implementation",
    verifyOutput: true
  },
  {
    description: "Generate documentation",
    role: "docs-writer",
    task: "Update documentation to reflect the implemented changes",
    dependsOn: "Run quality gate",
    continueOnError: true
  },
  {
    description: "Lifecycle update",
    role: "lifecycle-manager",
    task: "Bump versions and update SCRIPTS.md / AGENTS.md as required",
    dependsOn: "Generate documentation"
  }
];

/**
 * Execute a single serial agent task
 */
async function executeSerialTask(
  task: SerialAgentTask,
  options: SerialExecutionOptions
): Promise<SerialPipelineResult> {
  const startTime = Date.now();

  if (options.dryRun) {
    console.log(`   [DRY RUN] Would execute: ${task.description}`);
    return {
      task,
      status: 'completed',
      timestamp: new Date(),
      duration: 0
    };
  }

  try {
    console.log(`\n📤 Step: ${task.description}`);
    console.log(`   Role: ${task.role}`);
    console.log(`   Task: ${task.task}`);

    if (task.dependsOn) {
      console.log(`   Depends on: ${task.dependsOn}`);
    }

    // TODO: Replace with Agent tool invocation when running inside Claude Code.
    // The Agent tool cannot be called from a subprocess; this script is intended
    // to be driven by PM/orchestrator code that substitutes real agent calls.
    // For CLI use, we invoke dispatch.ts as a subprocess per task.
    const { $ } = await import('bun');
    const proc = await $`bun run scripts/dispatch.ts --task ${JSON.stringify(task)}`.nothrow();

    const stdout = proc.stdout.toString().trim();
    const stderr = proc.stderr.toString().trim();
    const exitCode = proc.exitCode ?? 1;

    if (options.verbose && stdout) {
      console.log(`   Output: ${stdout}`);
    }
    if (stderr) {
      console.log(`   Stderr: ${stderr}`);
    }

    const duration = Date.now() - startTime;

    if (exitCode !== 0) {
      console.log(`   ❌ Failed with exit code ${exitCode} (${duration}ms)\n`);
      return {
        task,
        status: 'failed',
        error: stderr || `exit code ${exitCode}`,
        timestamp: new Date(),
        duration
      };
    }

    console.log(`   ✅ Complete (${duration}ms)\n`);

    return {
      task,
      status: 'completed',
      output: stdout,
      timestamp: new Date(),
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`   ❌ Failed: ${error instanceof Error ? error.message : String(error)}\n`);

    return {
      task,
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date(),
      duration
    };
  }
}

/**
 * Execute a serial pipeline with dependency management
 */
export async function dispatchSerial(
  pipeline: SerialAgentTask[],
  options: SerialExecutionOptions = {}
): Promise<SerialPipelineResult[]> {
  const {
    stopOnError = true,
    verbose = false,
    dryRun = false
  } = options;

  console.log(`\n🔄 Serial Agent Dispatcher`);
  console.log(`📋 Executing pipeline of ${pipeline.length} tasks`);
  if (dryRun) console.log(`   [DRY RUN MODE - No actual execution]`);
  console.log(`\n━${'━'.repeat(60)}`);

  const results: SerialPipelineResult[] = [];
  const startTime = Date.now();
  let completedCount = 0;

  for (const task of pipeline) {
    // Check dependencies
    if (task.dependsOn) {
      const dependency = results.find(
        r => r.task.description === task.dependsOn
      );

      if (!dependency) {
        console.log(`\n⚠️  Skipping "${task.description}": dependency not found`);
        results.push({
          task,
          status: 'skipped',
          timestamp: new Date(),
          duration: 0
        });
        continue;
      }

      if (dependency.status === 'failed') {
        console.log(`\n⚠️  Skipping "${task.description}": dependency failed`);
        results.push({
          task,
          status: 'skipped',
          timestamp: new Date(),
          duration: 0
        });
        continue;
      }
    }

    // Execute task
    const result = await executeSerialTask(task, { ...options, verbose });
    results.push(result);

    if (result.status === 'completed') {
      completedCount++;
    } else if (result.status === 'failed' && stopOnError && !task.continueOnError) {
      console.log(`\n⛔ Pipeline stopped due to failure in "${task.description}"`);
      break;
    }
  }

  const elapsed = Date.now() - startTime;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;

  console.log(`\n━${'━'.repeat(60)}`);
  console.log(`\n📊 Pipeline Results:`);
  console.log(`   ✅ Completed: ${completedCount}/${pipeline.length}`);
  console.log(`   ❌ Failed: ${failedCount}/${pipeline.length}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}/${pipeline.length}`);
  console.log(`   ⏱️  Total time: ${elapsed}ms`);

  if (results.length > 0) {
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    console.log(`   📈 Average per task: ${Math.round(avgDuration)}ms`);
  }

  console.log();

  return results;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options: SerialExecutionOptions = {
    stopOnError: !args.includes('--continue-on-error'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run')
  };

  // Check for custom pipeline file
  const pipelineFileIndex = args.indexOf('--pipeline');
  let pipeline = defaultPipeline;

  if (pipelineFileIndex >= 0 && args[pipelineFileIndex + 1]) {
    try {
      const pipelinePath = args[pipelineFileIndex + 1];
      pipeline = await import(pipelinePath).then(m => m.default || m.pipeline);
    } catch (error) {
      console.error(`❌ Failed to load pipeline from ${args[pipelineFileIndex + 1]}:`, error);
      process.exit(1);
    }
  }

  try {
    const results = await dispatchSerial(pipeline, options);
    const hasFailures = results.some(r => r.status === 'failed');

    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

/**
 * Export for direct module use - handles undefined pipeline by using defaults
 */
export async function runDispatcher(options?: SerialExecutionOptions): Promise<SerialPipelineResult[]> {
  return dispatchSerial(defaultPipeline, options);
}

export { dispatchSerial as default, SerialAgentTask, SerialPipelineResult };
