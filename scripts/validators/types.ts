// scripts/validators/types.ts
// @version 1.0.0
// Shared types for the Validator framework — Design Doc §6.2

/**
 * Context passed to every validator at execution time.
 * Populated once by the runner, then shared immutably across validators.
 */
export interface ValidatorContext {
  /** Absolute path to the variant directory (e.g., /path/to/templates/co-develop) */
  readonly variantDir: string;
  /** Variant type key (e.g., 'development', 'security') */
  readonly variantType: string;
  /** Parsed variant.json content (already JSON.parse'd) */
  readonly variantJson: Record<string, any>;
  /** List of agent .md filenames found on disk in agents/ */
  readonly agentFiles: readonly string[];
  /** List of skill names from variant.json skills[] */
  readonly skillFiles: readonly string[];
  /** Resolved validation policy from the registries */
  readonly policy: Record<string, any> | null;
}

/**
 * A single validation finding. One issue per check; never batched.
 */
export interface ValidationIssue {
  /** Severity of the finding. */
  readonly severity: 'error' | 'warning' | 'info';
  /** Machine-readable category slug (e.g., 'missing-field', 'circular-reference') */
  readonly category: string;
  /** Human-readable description of the issue */
  readonly message: string;
  /** File path relative to variantDir, when applicable */
  readonly file?: string;
  /** Line number within the file, when applicable */
  readonly line?: number;
  /** Agent name that produced the issue, when applicable */
  readonly agentName?: string;
  /** Capability string that produced the issue, when applicable */
  readonly capability?: string;
}

/**
 * Result returned by a single validator after execution.
 */
export interface ValidatorResult {
  /** Machine-readable validator name (matches ValidatorDefinition.name) */
  readonly validator: string;
  /** Wall-clock execution time in milliseconds */
  readonly duration_ms: number;
  /** Total number of individual checks performed */
  readonly checks: number;
  /** Issues discovered during validation (may be empty) */
  readonly issues: readonly ValidationIssue[];
  /** Whether this validator was skipped due to failed prerequisites */
  readonly skipped?: boolean;
  /** Reason for skipping, if skipped */
  readonly skipReason?: string;
}

/**
 * Definition of a validator — its metadata and the validate function.
 */
export interface ValidatorDefinition {
  /** Machine-readable slug used in reports (e.g., 'variant-json') */
  readonly name: string;
  /** Human-readable one-line description */
  readonly description: string;
  /** Names of validators that must pass before this one runs */
  readonly prerequisites: readonly string[];
  /**
   * Execute the validator against the given context.
   * Returns a ValidatorResult with zero or more issues.
   * Must not throw — all errors should be captured as issues.
   */
  readonly validate: (ctx: ValidatorContext) => ValidatorResult | Promise<ValidatorResult>;
}

/**
 * CI-friendly JSON report structure — Design Doc §6.4
 * Intended to be written to disk and consumed by CI pipelines.
 */
export interface ValidationReport {
  /** ISO 8601 timestamp of when the report was generated */
  readonly timestamp: string;
  /** The variant being validated */
  readonly variant: string;
  /** The variant type */
  readonly type: string;
  /** Overall pass/fail — true if zero ERROR-severity issues across all validators */
  readonly passed: boolean;
  /** Aggregate counts across all validators */
  readonly summary: {
    readonly totalValidators: number;
    readonly passedValidators: number;
    readonly skippedValidators: number;
    readonly failedValidators: number;
    readonly totalChecks: number;
    readonly errors: number;
    readonly warnings: number;
    readonly infos: number;
  };
  /** Per-validator results */
  readonly results: readonly ValidatorResult[];
}
