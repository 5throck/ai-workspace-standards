#!/usr/bin/env bun
/**
 * Platform Dispatcher Abstraction for Auto-Mode
 * @version 1.0.0
 *
 * Provides unified agent dispatch interface across Claude Code and Antigravity platforms.
 * Detects platform capabilities and routes dispatch calls appropriately.
 *
 * Usage:
 *   import { createDispatcher, detectPlatform } from './lib/platform-dispatcher';
 *
 *   const platform = detectPlatform();
 *   const dispatcher = createDispatcher();
 *
 *   // Single agent dispatch
 *   const result = await dispatcher.dispatchAgent({
 *     role: 'automation-engineer',
 *     task: 'Implement the feature',
 *     description: 'Feature implementation'
 *   });
 *
 *   // Parallel dispatch
 *   const results = await dispatcher.dispatchParallel([
 *     { role: 'architect', task: 'Analyze structure', description: 'Analysis' },
 *     { role: 'docs-writer', task: 'Update docs', description: 'Documentation' }
 *   ]);
 *
 * @module platform-dispatcher
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';

/**
 * Supported platforms
 */
export type Platform = 'claude-code' | 'antigravity' | 'unknown';

/**
 * Agent task specification
 */
export interface AgentTask {
  /** Agent role name (must match agent definition file) */
  role: string;
  /** Task description for the agent */
  task: string;
  /** Human-readable description of what this task does */
  description: string;
  /** Optional context files to include */
  context?: string[];
  /** Expected output format */
  outputFormat?: 'markdown' | 'json' | 'text';
  /** Priority level for parallel dispatch ordering */
  priority?: 'high' | 'medium' | 'low';
  /** Whether to continue if this task fails (serial pipelines only) */
  continueOnError?: boolean;
  /** Task this depends on (serial pipelines only) */
  dependsOn?: string;
}

/**
 * Result from a single agent dispatch
 */
export interface DispatchResult {
  /** Original task specification */
  task: AgentTask;
  /** Execution status */
  status: 'dispatched' | 'completed' | 'failed' | 'skipped';
  /** Agent output if successful */
  output?: string;
  /** Error message if failed */
  error?: string;
  /** When the dispatch completed */
  timestamp: Date;
  /** Execution duration in milliseconds */
  duration: number;
  /** Platform that handled the dispatch */
  platform: Platform;
}

/**
 * Platform capability flags
 */
export interface PlatformCapabilities {
  /** Can use native Agent tool (Claude Code) */
  agentTool: boolean;
  /** Can use invoke_subagent (Antigravity) */
  invokeSubagent: boolean;
  /** Supports parallel agent execution */
  parallelExecution: boolean;
  /** Supports inter-agent messaging */
  interAgentMessaging: boolean;
  /** Desktop App limitations apply */
  desktopAppLimitations: boolean;
  /** Multi-workspace isolation available */
  multiWorkspaceIsolation: boolean;
}

/**
 * Platform dispatcher interface
 */
export interface PlatformDispatcher {
  /** Dispatch a single agent task */
  dispatchAgent(task: AgentTask): Promise<DispatchResult>;

  /** Dispatch multiple agents in parallel */
  dispatchParallel(tasks: AgentTask[]): Promise<DispatchResult[]>;

  /** Dispatch agents serially with dependency management */
  dispatchSerial(
    pipeline: AgentTask[],
    options?: SerialDispatchOptions
  ): Promise<DispatchResult[]>;

  /** Check if platform supports a specific capability */
  checkCapability(capability: keyof PlatformCapabilities): boolean;

  /** Get platform information */
  getPlatform(): PlatformInfo;
}

/**
 * Platform metadata
 */
export interface PlatformInfo {
  name: Platform;
  capabilities: PlatformCapabilities;
  version?: string;
  environment: 'cli' | 'desktop-app' | 'unknown';
}

/**
 * Options for serial dispatch
 */
export interface SerialDispatchOptions {
  /** Stop pipeline on first failure */
  stopOnError?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Dry run without actual execution */
  dryRun?: boolean;
}

/**
 * Detect the current platform
 */
export function detectPlatform(rootPath: string = cwd()): Platform {
  // Check for Antigravity (Gemini CLI)
  if (existsSync(join(rootPath, 'GEMINI.md'))) {
    return 'antigravity';
  }

  // Check for Claude Code
  if (existsSync(join(rootPath, 'CLAUDE.md')) || existsSync(join(rootPath, '.claude'))) {
    return 'claude-code';
  }

  return 'unknown';
}

/**
 * Detect platform environment (CLI vs Desktop App)
 */
function detectEnvironment(): 'cli' | 'desktop-app' | 'unknown' {
  // Check for Desktop App indicators
  // Claude Code Desktop App doesn't set certain env vars that CLI does
  const hasDesktopAppIndicators = process.env.CLAUDE_CODE_DESKTOP === '1' ||
                                   process.env.ELECTRON_RUN_AS_NODE !== undefined;

  if (hasDesktopAppIndicators) {
    return 'desktop-app';
  }

  // Default to CLI
  return 'cli';
}

/**
 * Get platform capabilities
 */
function getPlatformCapabilities(platform: Platform): PlatformCapabilities {
  const environment = detectEnvironment();

  switch (platform) {
    case 'claude-code':
      return {
        agentTool: true,
        invokeSubagent: false,
        parallelExecution: true,
        interAgentMessaging: true,
        desktopAppLimitations: environment === 'desktop-app',
        multiWorkspaceIsolation: false
      };

    case 'antigravity':
      return {
        agentTool: false,
        invokeSubagent: true,
        parallelExecution: true,
        interAgentMessaging: false, // Antigravity doesn't have inter-agent messaging
        desktopAppLimitations: false,
        multiWorkspaceIsolation: true
      };

    default:
      return {
        agentTool: false,
        invokeSubagent: false,
        parallelExecution: false,
        interAgentMessaging: false,
        desktopAppLimitations: false,
        multiWorkspaceIsolation: false
      };
  }
}

/**
 * Create platform-specific dispatcher
 */
export function createDispatcher(rootPath?: string): PlatformDispatcher {
  const platform = detectPlatform(rootPath);
  const capabilities = getPlatformCapabilities(platform);
  const environment = detectEnvironment();

  const platformInfo: PlatformInfo = {
    name: platform,
    capabilities,
    environment
  };

  if (platform === 'claude-code') {
    return new ClaudeCodeDispatcher(platformInfo);
  } else if (platform === 'antigravity') {
    return new AntigravityDispatcher(platformInfo);
  } else {
    return new UnknownDispatcher(platformInfo);
  }
}

/**
 * Claude Code Dispatcher Implementation
 *
 * Uses native Agent tool with support for:
 * - In-process execution
 * - tmux split-pane (CLI only)
 * - Agent Teams (experimental, requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS)
 */
class ClaudeCodeDispatcher implements PlatformDispatcher {
  constructor(private platform: PlatformInfo) {}

  async dispatchAgent(task: AgentTask): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      console.log(`[Claude Code] Dispatching ${task.role}...`);
      console.log(`  Task: ${task.description}`);
      console.log(`  Platform: ${this.platform.environment}`);

      // Check for Desktop App limitations
      if (this.platform.capabilities.desktopAppLimitations) {
        console.log(`  ⚠️  Desktop App: Hooks and Agent Teams limitations apply`);
      }

      // In Claude Code, the Agent tool is called by the orchestrator/PM
      // This script provides the abstraction layer but actual dispatch
      // happens through the Agent tool in the session context
      //
      // For subprocess invocation, we'd use a dispatch script:
      const { $ } = await import('bun');
      const proc = await $`bun run scripts/dispatch.ts --role ${task.role} --task ${JSON.stringify(task)}`.nothrow();

      const stdout = proc.stdout.toString().trim();
      const stderr = proc.stderr.toString().trim();
      const exitCode = proc.exitCode ?? 1;
      const duration = Date.now() - startTime;

      if (exitCode !== 0) {
        return {
          task,
          status: 'failed',
          error: stderr || `exit code ${exitCode}`,
          timestamp: new Date(),
          duration,
          platform: 'claude-code'
        };
      }

      return {
        task,
        status: 'completed',
        output: stdout,
        timestamp: new Date(),
        duration,
        platform: 'claude-code'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        task,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        duration,
        platform: 'claude-code'
      };
    }
  }

  async dispatchParallel(tasks: AgentTask[]): Promise<DispatchResult[]> {
    console.log(`\n[Claude Code] Parallel Dispatch`);
    console.log(`Platform: ${this.platform.environment}`);
    console.log(`Tasks: ${tasks.length}\n`);

    // Claude Code with Agent Teams supports native parallel execution
    // For subprocess mode, use Promise.all
    const startTime = Date.now();
    const results = await Promise.all(
      tasks.map(task => this.dispatchAgent(task))
    );
    const elapsed = Date.now() - startTime;

    console.log(`\n[Claude Code] Parallel dispatch completed in ${elapsed}ms`);

    return results;
  }

  async dispatchSerial(
    pipeline: AgentTask[],
    options: SerialDispatchOptions = {}
  ): Promise<DispatchResult[]> {
    const { stopOnError = true, verbose = false, dryRun = false } = options;

    console.log(`\n[Claude Code] Serial Dispatch`);
    console.log(`Platform: ${this.platform.environment}`);
    console.log(`Pipeline: ${pipeline.length} tasks\n`);

    const results: DispatchResult[] = [];
    const startTime = Date.now();

    for (const task of pipeline) {
      // Check dependencies
      if (task.dependsOn) {
        const dependency = results.find(r => r.task.description === task.dependsOn);
        if (!dependency || dependency.status === 'failed') {
          console.log(`⏭️  Skipping "${task.description}": dependency not met`);
          results.push({
            task,
            status: 'skipped',
            timestamp: new Date(),
            duration: 0,
            platform: 'claude-code'
          });
          continue;
        }
      }

      // Execute task
      const result = await this.dispatchAgent(task);
      results.push(result);

      if (verbose && result.output) {
        console.log(`Output: ${result.output}`);
      }

      if (result.status === 'failed' && stopOnError && !task.continueOnError) {
        console.log(`⛔ Pipeline stopped at "${task.description}"`);
        break;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n[Claude Code] Serial dispatch completed in ${elapsed}ms`);

    return results;
  }

  checkCapability(capability: keyof PlatformCapabilities): boolean {
    return this.platform.capabilities[capability];
  }

  getPlatform(): PlatformInfo {
    return this.platform;
  }
}

/**
 * Antigravity Dispatcher Implementation
 *
 * Uses invoke_subagent approach with:
 * - Multi-workspace isolation
 * - No inter-agent messaging constraint
 * - Agent Manager (UI-based) for workspace management
 */
class AntigravityDispatcher implements PlatformDispatcher {
  constructor(private platform: PlatformInfo) {}

  async dispatchAgent(task: AgentTask): Promise<DispatchResult> {
    const startTime = Date.now();

    try {
      console.log(`[Antigravity] Dispatching ${task.role}...`);
      console.log(`  Task: ${task.description}`);
      console.log(`  Workspace isolation: enabled`);

      // Antigravity uses invoke_subagent for agent dispatch
      // This would typically call the Antigravity CLI or API
      const { $ } = await import('bun');
      const proc = await $`bun run scripts/dispatch-antigravity.ts --role ${task.role} --task ${JSON.stringify(task)}`.nothrow();

      const stdout = proc.stdout.toString().trim();
      const stderr = proc.stderr.toString().trim();
      const exitCode = proc.exitCode ?? 1;
      const duration = Date.now() - startTime;

      if (exitCode !== 0) {
        return {
          task,
          status: 'failed',
          error: stderr || `exit code ${exitCode}`,
          timestamp: new Date(),
          duration,
          platform: 'antigravity'
        };
      }

      return {
        task,
        status: 'completed',
        output: stdout,
        timestamp: new Date(),
        duration,
        platform: 'antigravity'
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        task,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        duration,
        platform: 'antigravity'
      };
    }
  }

  async dispatchParallel(tasks: AgentTask[]): Promise<DispatchResult[]> {
    console.log(`\n[Antigravity] Parallel Dispatch`);
    console.log(`Workspace isolation: enabled`);
    console.log(`Tasks: ${tasks.length}\n`);

    // Antigravity supports parallel execution via multi-workspace
    const startTime = Date.now();
    const results = await Promise.all(
      tasks.map(task => this.dispatchAgent(task))
    );
    const elapsed = Date.now() - startTime;

    console.log(`\n[Antigravity] Parallel dispatch completed in ${elapsed}ms`);
    console.log(`Note: Inter-agent messaging not available`);

    return results;
  }

  async dispatchSerial(
    pipeline: AgentTask[],
    options: SerialDispatchOptions = {}
  ): Promise<DispatchResult[]> {
    const { stopOnError = true, verbose = false, dryRun = false } = options;

    console.log(`\n[Antigravity] Serial Dispatch`);
    console.log(`Workspace isolation: enabled`);
    console.log(`Pipeline: ${pipeline.length} tasks\n`);

    const results: DispatchResult[] = [];
    const startTime = Date.now();

    for (const task of pipeline) {
      // Check dependencies
      if (task.dependsOn) {
        const dependency = results.find(r => r.task.description === task.dependsOn);
        if (!dependency || dependency.status === 'failed') {
          console.log(`⏭️  Skipping "${task.description}": dependency not met`);
          results.push({
            task,
            status: 'skipped',
            timestamp: new Date(),
            duration: 0,
            platform: 'antigravity'
          });
          continue;
        }
      }

      // Execute task
      const result = await this.dispatchAgent(task);
      results.push(result);

      if (verbose && result.output) {
        console.log(`Output: ${result.output}`);
      }

      if (result.status === 'failed' && stopOnError && !task.continueOnError) {
        console.log(`⛔ Pipeline stopped at "${task.description}"`);
        break;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n[Antigravity] Serial dispatch completed in ${elapsed}ms`);

    return results;
  }

  checkCapability(capability: keyof PlatformCapabilities): boolean {
    return this.platform.capabilities[capability];
  }

  getPlatform(): PlatformInfo {
    return this.platform;
  }
}

/**
 * Unknown Platform Dispatcher
 *
 * Fallback implementation for unsupported platforms
 */
class UnknownDispatcher implements PlatformDispatcher {
  constructor(private platform: PlatformInfo) {}

  async dispatchAgent(task: AgentTask): Promise<DispatchResult> {
    const duration = 0;
    console.error(`[Unknown Platform] Cannot dispatch ${task.role}: platform not supported`);

    return {
      task,
      status: 'failed',
      error: 'Platform not supported. Use Claude Code or Antigravity.',
      timestamp: new Date(),
      duration,
      platform: 'unknown'
    };
  }

  async dispatchParallel(tasks: AgentTask[]): Promise<DispatchResult[]> {
    console.error(`[Unknown Platform] Cannot dispatch ${tasks.length} tasks: platform not supported`);
    return tasks.map(task => this.dispatchAgent(task));
  }

  async dispatchSerial(
    pipeline: AgentTask[],
    options: SerialDispatchOptions = {}
  ): Promise<DispatchResult[]> {
    console.error(`[Unknown Platform] Cannot execute pipeline: platform not supported`);
    return Promise.all(pipeline.map(task => this.dispatchAgent(task)));
  }

  checkCapability(_capability: keyof PlatformCapabilities): boolean {
    return false;
  }

  getPlatform(): PlatformInfo {
    return this.platform;
  }
}

/**
 * Utility: Print platform detection results
 */
export function printPlatformInfo(info: PlatformInfo): void {
  console.log('\n🔍 Platform Detection Results');
  console.log('═'.repeat(60));
  console.log(`Platform: ${info.name}`);
  console.log(`Environment: ${info.environment}`);
  console.log(`\nCapabilities:`);
  console.log(`  Agent Tool: ${info.capabilities.agentTool ? '✅' : '❌'}`);
  console.log(`  Invoke Subagent: ${info.capabilities.invokeSubagent ? '✅' : '❌'}`);
  console.log(`  Parallel Execution: ${info.capabilities.parallelExecution ? '✅' : '❌'}`);
  console.log(`  Inter-Agent Messaging: ${info.capabilities.interAgentMessaging ? '✅' : '❌'}`);
  console.log(`  Desktop App Limitations: ${info.capabilities.desktopAppLimitations ? '⚠️' : '✅'}`);
  console.log(`  Multi-Workspace Isolation: ${info.capabilities.multiWorkspaceIsolation ? '✅' : '❌'}`);
  console.log('═'.repeat(60));
}

// CLI interface for platform detection
if (import.meta.main) {
  const platform = detectPlatform();
  const dispatcher = createDispatcher();
  const info = dispatcher.getPlatform();

  printPlatformInfo(info);

  process.exit(platform === 'unknown' ? 1 : 0);
}
