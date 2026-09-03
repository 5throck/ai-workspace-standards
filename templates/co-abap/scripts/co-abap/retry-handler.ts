#!/usr/bin/env bun
/**
 * Error Recovery Handler — VSP variant
 * @version 1.1.0
 * Implements retry logic with exponential backoff for subagent failures
 *
 * Thin wrapper over the common retry handler. VSP-specific configuration:
 * - jittered backoff by default (thundering-herd protection in parallel dispatch)
 * - AbortSignal pass-through for external cancellation
 * The common module owns the retry loop, error classification, and escalation UI.
 * (ADR-0050 Part 1: Variant files only diverge when logic is genuinely variant-specific)
 */

import {
  withRetry as commonWithRetry,
  escalateToHuman,
  classifyError,
  getRecoverySuggestion,
  DEFAULT_CONFIG,
  type RetryConfig,
  type RetryResult
} from '../retry-handler.ts';

/**
 * Execute a function with retry logic, VSP defaults applied.
 *
 * Jittered backoff is enabled unless explicitly disabled via config.jitter.
 * Pass an optional AbortSignal (4th argument or config.signal) to allow
 * external cancellation — a thrown AbortError propagates without retrying.
 */
function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_CONFIG,
  context?: string,
  signal?: AbortSignal
): Promise<RetryResult & { result?: T }> {
  return commonWithRetry(fn, {
    ...config,
    jitter: config.jitter ?? true,
    signal: config.signal ?? signal
  }, context);
}

// Re-export common helpers for backward compatibility
export { withRetry, escalateToHuman, classifyError, getRecoverySuggestion, DEFAULT_CONFIG };
export type { RetryConfig, RetryResult };
