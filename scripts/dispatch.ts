#!/usr/bin/env bun
/**
 * Agent Dispatcher CLI
 * @version 1.0.0
 * Main entry point for agent dispatch operations
 *
 * Usage:
 *   bun scripts/dispatch.ts parallel [--task "Description:role:task:priority"]
 *   bun scripts/dispatch.ts serial [--pipeline file.ts] [--continue-on-error] [--verbose]
 *   bun scripts/dispatch.ts help
 *
 * @module dispatch
 */

import path from "node:path";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

interface CliOptions {
  mode: string;
  args: string[];
}

/**
 * Display help information
 */
function showHelp(): void {
  console.log(`
╭─────────────────────────────────────────────────────────────╮
│              Agent Dispatcher CLI v1.0.0                    │
╰─────────────────────────────────────────────────────────────╯

USAGE:
  bun scripts/dispatch.ts <mode> [options]

MODES:
  parallel    Dispatch multiple read-only agents simultaneously
              Use for: codebase analysis, documentation, health checks

  serial      Execute agents sequentially with dependency tracking
              Use for: implementation pipelines, multi-phase workflows

  help        Show this help message

PARALLEL OPTIONS:
  --task <desc:role:task[:priority]>
              Add a custom task to the dispatch queue
              Priority: high | medium | low (default: medium)

              Example:
                --task "Audit code:code-auditor:Check quality:high"

SERIAL OPTIONS:
  --pipeline <file.ts>
              Load custom pipeline from TypeScript file

  --continue-on-error
              Continue pipeline execution even if a task fails

  --verbose, -v
              Show detailed output for each task

  --dry-run
              Simulate execution without actually running tasks

              Example:
                bun scripts/dispatch.ts serial --dry-run --verbose

EXAMPLES:
  # Run default parallel dispatch
  bun scripts/dispatch.ts parallel

  # Run custom parallel tasks
  bun scripts/dispatch.ts parallel \\
    --task "Analyze code:analyst:Review structure:high" \\
    --task "Check docs:doc-checker:Verify MD files"

  # Run default serial pipeline
  bun scripts/dispatch.ts serial

  # Run serial pipeline with verbose output
  bun scripts/dispatch.ts serial --verbose

  # Dry run serial pipeline
  bun scripts/dispatch.ts serial --dry-run

CONFIGURATION:
  Default tasks are defined in:
  - scripts/dispatch-parallel.ts (parallel mode)
  - scripts/dispatch-serial.ts (serial mode)

  Customize by editing the defaultTasks/pipeline arrays
  or provide your own via command line options.

╭─────────────────────────────────────────────────────────────╮
│  For more information, see: docs/context.md                  │
╰─────────────────────────────────────────────────────────────╯
`);
}

/**
 * Execute parallel dispatch mode
 */
async function runParallel(args: string[]): Promise<void> {
  console.log('🚀 Parallel Dispatch Mode\n');

  // Build task list from --task arguments
  const tasks: any[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--task' && args[i + 1]) {
      const parts = args[i + 1].split(':');
      if (parts.length >= 3) {
        tasks.push({
          description: parts[0],
          role: parts[1],
          task: parts[2],
          priority: parts[3] || 'medium'
        });
      }
      i++;
    }
  }

  // Import and run - pass tasks or undefined for defaults
  const dispatchModule = await import('./dispatch-parallel.ts');

  if (tasks.length > 0) {
    await dispatchModule.dispatchParallel(tasks);
  } else {
    // Use the runDispatcher helper that handles empty arrays
    await dispatchModule.runDispatcher(undefined);
  }
}

/**
 * Execute serial dispatch mode
 */
async function runSerial(args: string[]): Promise<void> {
  console.log('🔄 Serial Dispatch Mode\n');

  const options: any = {
    stopOnError: !args.includes('--continue-on-error'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    dryRun: args.includes('--dry-run')
  };

  // Check for custom pipeline
  const pipelineIndex = args.indexOf('--pipeline');
  let pipeline: any;

  if (pipelineIndex >= 0 && args[pipelineIndex + 1]) {
    const pipelinePath = path.resolve(projectRoot, args[pipelineIndex + 1]);
    if (!pipelinePath.startsWith(projectRoot + path.sep) || !pipelinePath.endsWith('.ts')) {
      console.error(`[dispatch] Invalid pipeline path: ${pipelinePath}`);
      process.exit(1);
    }
    try {
      const pipelineModule = await import(pipelinePath);
      pipeline = pipelineModule.default || pipelineModule.pipeline;
    } catch (error) {
      console.error(`❌ Failed to load pipeline from ${args[pipelineIndex + 1]}:`, error);
      process.exit(1);
    }
  }

  // Import dispatch module and run with pipeline or defaults
  const dispatchModule = await import('./dispatch-serial.ts');

  if (pipeline) {
    await dispatchModule.dispatchSerial(pipeline, options);
  } else {
    // Use default pipeline from module
    await dispatchModule.runDispatcher(options);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const mode = process.argv[2] || "help";
  const args = process.argv.slice(3);

  try {
    switch (mode) {
      case "parallel":
        await runParallel(args);
        break;

      case "serial":
        await runSerial(args);
        break;

      case "help":
      case "--help":
      case "-h":
      default:
        showHelp();
        break;
    }
  } catch (error) {
    console.error('\n❌ Dispatch failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  main();
}

export { main };
