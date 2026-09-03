#!/usr/bin/env bun
/**
 * Agent Dispatcher CLI — VSP variant
 * @version 1.1.0
 * Thin mode router over the common dispatch CLI.
 *
 * Help text and mode routing live in templates/common/scripts/dispatch.ts;
 * argument parsing and execution live in the common dispatch-parallel /
 * dispatch-serial modules. This file only wires the VSP default tasks and
 * pipeline by delegating to the sibling VSP wrappers.
 * (ADR-0050 Part 1: Variant scripts inherit from templates/common, never duplicate)
 *
 * Usage:
 *   bun scripts/dispatch.ts parallel [--task "Description:role:task:priority"]
 *   bun scripts/dispatch.ts serial [--pipeline file.ts] [--continue-on-error] [--verbose]
 *   bun scripts/dispatch.ts help
 *
 * @module dispatch
 */

import { showHelp as printHelp } from '../dispatch.ts';
import { runCli as runParallelMode } from './dispatch-parallel.ts';
import { runCli as runSerialMode } from './dispatch-serial.ts';

const MODE_HANDLERS: Record<string, (argv: string[]) => Promise<void>> = {
  parallel: runParallelMode,
  serial: runSerialMode
};

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'help';
  const rest = process.argv.slice(3);

  try {
    const handler = MODE_HANDLERS[mode] ?? (async () => printHelp());
    await handler(rest);
  } catch (err) {
    console.error('\n❌ Dispatch failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.main) {
  void main();
}
