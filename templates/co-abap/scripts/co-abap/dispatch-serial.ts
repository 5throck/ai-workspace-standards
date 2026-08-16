#!/usr/bin/env bun
/**
 * Serial Agent Dispatcher — VSP variant wrapper
 * @version 1.0.1
 * Automates dispatching subagents that must run sequentially
 *
 * Re-exports the common dispatcher with VSP-specific default pipeline.
 * (ADR-0050: Variant scripts inherit from templates/common, never duplicate)
 *
 * @module dispatch-serial
 */

import {
  dispatchSerial as commonDispatchSerial,
  type SerialAgentTask,
  type SerialPipelineResult,
  type SerialExecutionOptions
} from '../../dispatch-serial.ts';

/**
 * VSP-specific default pipeline for serial dispatch
 */
const vspDefaultPipeline: SerialAgentTask[] = [
  {
    description: "Implement feature",
    role: "code-writer",
    task: "Implement the new feature following the approved specification",
    verifyOutput: true
  },
  {
    description: "Review implementation",
    role: "code-reviewer",
    task: "Review the implemented feature for correctness and quality",
    dependsOn: "Implement feature",
    verifyOutput: true
  },
  {
    description: "Run quality gate",
    role: "quality-gate",
    task: "Execute post-write chain (SyntaxCheck → RunUnitTests → RunATCCheck)",
    dependsOn: "Review implementation",
    verifyOutput: true
  },
  {
    description: "Generate documentation",
    role: "doc-writer",
    task: "Update documentation to reflect the implemented changes",
    dependsOn: "Run quality gate",
    continueOnError: true
  },
  {
    description: "Create commit",
    role: "git-keeper",
    task: "Create a conventional commit with co-author signatures",
    dependsOn: "Generate documentation"
  }
];

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
  let pipeline = vspDefaultPipeline;

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
    const results = await commonDispatchSerial(pipeline, options);
    const hasFailures = results.some(r => r.status === 'failed');
    process.exit(hasFailures ? 1 : 0);
  } catch (error) {
    console.error('❌ Pipeline execution failed:', error);
    process.exit(1);
  }
}

/**
 * Export for direct module use - handles undefined pipeline by using VSP defaults
 */
export async function runDispatcher(options?: SerialExecutionOptions): Promise<SerialPipelineResult[]> {
  return commonDispatchSerial(vspDefaultPipeline, options);
}

// Re-export common types and functions for backward compatibility
export { commonDispatchSerial as dispatchSerial, type SerialAgentTask, type SerialPipelineResult, type SerialExecutionOptions };

// Run if executed directly
if (import.meta.main) {
  main();
}
