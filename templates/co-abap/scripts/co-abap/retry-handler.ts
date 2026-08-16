#!/usr/bin/env bun
/**
 * Error Recovery Handler — VSP variant
 * @version 1.0.2
 * Implements retry logic with exponential backoff for subagent failures
 *
 * VARIANT-SPECIFIC FEATURES:
 * - AbortSignal support for cancellation (VSP-specific, not in common version)
 * - Randomized jitter in backoff to prevent thundering herd in parallel dispatch
 * - Simpler error classification (co-abap does not require auth error detection)
 *
 * NOTE: Common version has more comprehensive auth error classification (401/403).
 * This variant intentionally excludes it as VSP context does not use such errors.
 * If merging with common later, consider whether auth error detection is needed.
 * (ADR-0050 Part 1: Variant files only diverge when logic is genuinely variant-specific)
 */

import path from "node:path";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  backoffMultiplier: number;
  maxDelay: number; // milliseconds
  isSuccess?: (result: unknown) => boolean; // optional predicate; when omitted, throw = failure, return = success
}

interface RetryResult {
  success: boolean;
  attempts: number;
  lastError?: Error;
  totalTime: number;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 10000
};

/**
 * Execute a function with retry logic
 *
 * Pass an optional AbortSignal to allow external cancellation (e.g. Ctrl-C,
 * caller timeout). A thrown AbortError propagates immediately without retrying.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_CONFIG,
  context?: string,
  signal?: AbortSignal
): Promise<RetryResult & { result?: T }> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    if (signal?.aborted) {
      throw (signal.reason ?? new DOMException("Aborted", "AbortError"));
    }

    try {
      console.log(`${context ? `[${context}] ` : ''}Attempt ${attempt}/${config.maxRetries}`);

      const result = await fn();

      // If isSuccess predicate is provided, use it to determine success
      if (config.isSuccess && !config.isSuccess(result)) {
        throw new Error(`isSuccess predicate returned false for attempt ${attempt}`);
      }

      const totalTime = Date.now() - startTime;
      console.log(`${context ? `[${context}] ` : ''} Success on attempt ${attempt}`);

      return {
        success: true,
        attempts: attempt,
        totalTime,
        result
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`${context ? `[${context}] ` : ''}Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < config.maxRetries) {
        // Randomized jitter avoids thundering-herd retries in parallel dispatch.
        const waitTime = Math.min(delay, config.maxDelay) * (0.5 + Math.random() * 0.5);
        console.log(`${context ? `[${context}] ` : ''}Waiting ${Math.round(waitTime)}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay = Math.min(Math.floor(delay * config.backoffMultiplier), config.maxDelay);
      }
    }
  }

  const totalTime = Date.now() - startTime;
  return {
    success: false,
    attempts: config.maxRetries,
    lastError,
    totalTime
  };
}

/**
 * Escalate to human after retries exhausted
 */
function escalateToHuman(context: string, error: Error, attempts: number): void {
  console.error(`
═══════════════════════════════════════════════════════════════
ESCALATION REQUIRED
═══════════════════════════════════════════════════════════════

Context: ${context}
Attempts: ${attempts}
Error: ${error.message}

The task failed after ${attempts} attempts. Manual intervention required.

Possible actions:
1. Check if the task description is clear and complete
2. Verify all required context is provided
3. Check for external dependencies (network, services)
4. Consider breaking the task into smaller steps

═══════════════════════════════════════════════════════════════
  `);
}

/**
 * Classify error type for appropriate response
 *
 * TODO(Task 26): Expand error classification with more granular categories:
 * - HTTP status codes (404, 429, 500, 503)
 * - SAP-specific errors (RFC_EXCEPTION, SYSTEM_FAILURE)
 * - Timeout subtypes (connect, read, write)
 * Consider extracting patterns into a configurable rule set.
 */
function classifyError(error: Error): 'tool' | 'context' | 'logic' | 'external' {
  const message = error.message.toLowerCase();

  if (message.includes('timeout') || message.includes('network') || message.includes('connection')) {
    return 'external';
  }
  if (message.includes('not found') || message.includes('does not exist')) {
    return 'context';
  }
  if (message.includes('permission') || message.includes('access denied')) {
    return 'tool';
  }

  return 'logic';
}

/**
 * Get recovery suggestion based on error type
 */
function getRecoverySuggestion(errorType: string): string {
  const suggestions = {
    tool: "Check tool permissions and configuration",
    context: "Verify all required files and context are provided",
    logic: "Review task logic and break into smaller steps",
    external: "Check network connectivity and external services"
  };

  return suggestions[errorType as keyof typeof suggestions] || "Unknown error type";
}

// Export functions for use by other scripts
export { withRetry, escalateToHuman, classifyError, getRecoverySuggestion, DEFAULT_CONFIG };

// CLI interface
if (import.meta.main) {
  const testFn = async () => {
    // Simulate a function that fails twice then succeeds
    const attempts = (globalThis as any).testAttempts || 0;
    (globalThis as any).testAttempts = attempts + 1;

    if (attempts < 2) {
      throw new Error("Simulated failure");
    }
    return "Success!";
  };

  const result = await withRetry(testFn, DEFAULT_CONFIG, "Test Task");

  if (!result.success) {
    escalateToHuman("Test Task", result.lastError!, result.attempts);
  }

  process.exit(result.success ? 0 : 1);
}
