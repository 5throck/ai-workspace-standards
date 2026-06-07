/**
 * Error Handling Library
 *
 * Structured error recovery and logging for the L2-to-variant pipeline.
 * Addresses Risk #4: Error Handling.
 *
 * @version 1.1.0
 * @Risk #4: Error Handling (P1 - High)
 */

// ============================================================================
// TYPES
// ============================================================================

export enum ErrorSeverity {
  FATAL = 'fatal',
  WARNING = 'warning',
  INFO = 'info',
}

export enum ErrorPhase {
  ADR_VALIDATION = 'adr_validation',
  L2_SCAN = 'l2_scan',
  RECONCILIATION = 'reconciliation',
  VARIANT_GENERATION = 'variant_generation',
  BETA_SETUP = 'beta_setup',
  INTEGRATION = 'integration',
  VALIDATION = 'validation',
}

export interface PipelineError {
  severity: ErrorSeverity;
  phase: ErrorPhase;
  code: string;
  message: string;
  details?: string;
  suggestedRemediation?: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export interface ErrorRecoveryAction {
  action: 'retry' | 'skip' | 'rollback' | 'abort';
  reason: string;
  steps: string[];
}

// ============================================================================
// ERROR CREATION
// ============================================================================

/**
 * Create a pipeline error
 * @version 1.1.0
 */
export function createError(
  severity: ErrorSeverity,
  phase: ErrorPhase,
  code: string,
  message: string,
  details?: string,
  suggestedRemediation?: string,
  context?: Record<string, unknown>
): PipelineError {
  return {
    severity,
    phase,
    code,
    message,
    details,
    suggestedRemediation,
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Create fatal error
 * @version 1.1.0
 */
export function fatalError(
  phase: ErrorPhase,
  code: string,
  message: string,
  details?: string,
  suggestedRemediation?: string
): PipelineError {
  return createError(
    ErrorSeverity.FATAL,
    phase,
    code,
    message,
    details,
    suggestedRemediation
  );
}

/**
 * Create warning error
 * @version 1.1.0
 */
export function warningError(
  phase: ErrorPhase,
  code: string,
  message: string,
  details?: string
): PipelineError {
  return createError(
    ErrorSeverity.WARNING,
    phase,
    code,
    message,
    details
  );
}

/**
 * Create info error
 * @version 1.1.0
 */
export function infoError(
  phase: ErrorPhase,
  code: string,
  message: string
): PipelineError {
  return createError(
    ErrorSeverity.INFO,
    phase,
    code,
    message
  );
}

// ============================================================================
// ERROR RECOVERY
// ============================================================================

/**
 * Determine error recovery strategy
 * @version 1.1.0
 */
export function determineRecoveryAction(error: PipelineError): ErrorRecoveryAction {
  switch (error.severity) {
    case ErrorSeverity.FATAL:
      return {
        action: 'abort',
        reason: `Fatal error in ${error.phase}: ${error.message}`,
        steps: [
          `1. Review error details: ${error.details || 'No details available'}`,
          `2. Check remediation: ${error.suggestedRemediation || 'No remediation available'}`,
          `3. Fix underlying issue`,
          `4. Retry pipeline execution`,
        ],
      };

    case ErrorSeverity.WARNING:
      return {
        action: 'skip',
        reason: `Non-critical warning: ${error.message}`,
        steps: [
          `1. Acknowledge warning: ${error.details || error.message}`,
          `2. Continue pipeline execution`,
          `3. Review warning in post-execution audit`,
        ],
      };

    case ErrorSeverity.INFO:
      return {
        action: 'skip',
        reason: `Informational message: ${error.message}`,
        steps: [
          `1. Note information: ${error.message}`,
          `2. Continue pipeline execution`,
        ],
      };

    default:
      return {
        action: 'abort',
        reason: `Unknown error severity: ${error.severity}`,
        steps: [
          `1. Review error: ${error.message}`,
          `2. Check error handling configuration`,
        ],
      };
  }
}

/**
 * Execute recovery action
 * @version 1.1.0
 */
export async function executeRecoveryAction(
  action: ErrorRecoveryAction
): Promise<boolean> {
  switch (action.action) {
    case 'abort':
      console.error(`??Pipeline aborted: ${action.reason}`);
      console.error('\nRecovery steps:');
      for (const step of action.steps) {
        console.error(`  ${step}`);
      }
      return false;

    case 'skip':
      console.warn(`?†Ô∏è  Warning: ${action.reason}`);
      console.warn('Continuing execution...');
      return true;

    case 'retry':
      console.info(`?πÔ∏è  Retry: ${action.reason}`);
      console.info('\nRetry steps:');
      for (const step of action.steps) {
        console.info(`  ${step}`);
      }
      return true;

    case 'rollback':
      console.error(`??Rollback required: ${action.reason}`);
      console.error('\nRollback steps:');
      for (const step of action.steps) {
        console.error(`  ${step}`);
      }
      return false;

    default:
      console.error(`??Unknown recovery action: ${action.action}`);
      return false;
  }
}

// ============================================================================
// ERROR LOGGING
// ============================================================================

/**
 * Format error for logging
 * @version 1.1.0
 */
export function formatErrorLog(error: PipelineError): string {
  const lines = [
    `[${error.timestamp}]`,
    `[${error.severity.toUpperCase()}]`,
    `[${error.phase}]`,
    `${error.code}: ${error.message}`,
  ];

  if (error.details) {
    lines.push(`Details: ${error.details}`);
  }

  if (error.suggestedRemediation) {
    lines.push(`Remediation: ${error.suggestedRemediation}`);
  }

  if (error.context && Object.keys(error.context).length > 0) {
    lines.push('Context:');
    for (const [key, value] of Object.entries(error.context)) {
      lines.push(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  return lines.join(' | ');
}

/**
 * Log error to console
 * @version 1.1.0
 */
export function logError(error: PipelineError): void {
  const formatted = formatErrorLog(error);

  switch (error.severity) {
    case ErrorSeverity.FATAL:
      console.error(formatted);
      break;
    case ErrorSeverity.WARNING:
      console.warn(formatted);
      break;
    case ErrorSeverity.INFO:
      console.info(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Batch log errors
 * @version 1.1.0
 */
export function logErrors(errors: PipelineError[]): void {
  const grouped = {
    fatal: errors.filter(e => e.severity === ErrorSeverity.FATAL),
    warning: errors.filter(e => e.severity === ErrorSeverity.WARNING),
    info: errors.filter(e => e.severity === ErrorSeverity.INFO),
  };

  if (grouped.fatal.length > 0) {
    console.error(`\n??Fatal Errors (${grouped.fatal.length}):`);
    for (const error of grouped.fatal) {
      logError(error);
    }
  }

  if (grouped.warning.length > 0) {
    console.warn(`\n?†Ô∏è  Warnings (${grouped.warning.length}):`);
    for (const error of grouped.warning) {
      logError(error);
    }
  }

  if (grouped.info.length > 0) {
    console.info(`\n?πÔ∏è  Info (${grouped.info.length}):`);
    for (const error of grouped.info) {
      logError(error);
    }
  }
}
