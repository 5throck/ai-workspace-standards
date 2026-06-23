#!/usr/bin/env bun
/**
 * Error Recovery Handler
 * @version 1.0.0
 * Implements retry logic with exponential backoff for subagent failures
 */

import path from "node:path";

const scriptDir = path.dirname(import.meta.path);
const projectRoot = path.resolve(scriptDir, "..");

interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // milliseconds
  backoffMultiplier: number;
  maxDelay: number; // milliseconds
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
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_CONFIG,
  context?: string
): Promise<RetryResult & { result?: T }> {
  const startTime = Date.now();
  let lastError: Error | undefined;
  let delay = config.initialDelay;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      console.log(`${context ? `[${context}] ` : ''}Attempt ${attempt}/${config.maxRetries}`);

      const result = await fn();

      const totalTime = Date.now() - startTime;
      console.log(`${context ? `[${context}] ` : ''} Success on attempt ${attempt}`);

      return {
        success: true,
        attempts: attempt,
        totalTime,
        result
      };
    } catch (error) {
      lastError = error as Error;
      console.error(`${context ? `[${context}] ` : ''}Attempt ${attempt} failed: ${lastError.message}`);

      if (attempt < config.maxRetries) {
        const waitTime = Math.min(delay, config.maxDelay);
        console.log(`${context ? `[${context}] ` : ''}Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        delay = Math.floor(delay * config.backoffMultiplier);
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
