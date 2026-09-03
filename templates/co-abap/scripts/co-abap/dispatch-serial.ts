#!/usr/bin/env bun
/**
 * Serial Agent Dispatcher — VSP variant wrapper
 * @version 1.1.0
 * Automates dispatching subagents that must run sequentially
 *
 * Thin wrapper over the common dispatcher: this file only supplies the
 * VSP-specific default pipeline and re-exports the common implementation.
 * (ADR-0050 Part 1: Variant scripts inherit from templates/common, never duplicate)
 *
 * @module dispatch-serial
 */

import {
  dispatchSerial as commonDispatchSerial,
  runCli as commonRunCli,
  type SerialAgentTask,
  type SerialPipelineResult,
  type SerialExecutionOptions
} from '../dispatch-serial.ts';

/**
 * VSP-specific default pipeline for serial dispatch
 */
export const vspDefaultPipeline: SerialAgentTask[] = [
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
 * CLI entry point — delegates option/pipeline parsing and execution to the
 * common module with the VSP default pipeline.
 */
export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
  await commonRunCli(args, vspDefaultPipeline);
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
  void runCli();
}
