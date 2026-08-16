# error-handling.ts Script Lifecycle

## Created

2026-07-02 (initial v1.0.0, L3-to-variant pipeline scope)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-07-02 | - | production | Initial structured error handling library for the L3-to-variant pipeline (Risk #4: Error Handling) | automation-engineer |
| 2026-08-16 | production | production | v1.3.0: Expanded to general-purpose standard per ADR-0054 — added 6 generic ErrorPhase values (SCRIPT_EXECUTION, FILE_IO, CLI_PARSING, AUDIT, LIFECYCLE, SECURITY) and convenience functions (die, warnAndExit, withErrorHandling, withSyncErrorHandling); L0→L1 sync | pm, architect |

## Acceptance Criteria

### Production Phase

- [x] Structured `PipelineError` type with severity, phase, code, message, remediation, timestamp
- [x] `ErrorPhase` enum covering both pipeline (ADR_VALIDATION, L3_SCAN, RECONCILIATION, VARIANT_GENERATION, BETA_SETUP, INTEGRATION, VALIDATION) and general-purpose phases (v1.3.0)
- [x] Error creation helpers: `createError`, `fatalError`, `warningError`, `infoError`
- [x] Recovery: `determineRecoveryAction`, `executeRecoveryAction` (retry/skip/rollback/abort)
- [x] Logging: `formatErrorLog`, `logError`, `logErrors`
- [x] General-purpose convenience (v1.3.0): `die`, `warnAndExit`, `withErrorHandling`, `withSyncErrorHandling`
- [x] Imported by pipeline scripts and, incrementally, general utility scripts per ADR-0054

## Dependencies

- No runtime dependencies (Node/Bun stdlib only)
- Consumed by: `l3-to-variant-pipeline.ts`, `generate-l3-readme.ts` and migrated utility scripts

## Domain

**Error Handling Standard** — Structured error recovery and logging for workspace scripts per ADR-0054.

**Key Responsibilities**:
- Standardize error/exit paths across all workspace scripts (incremental migration)
- Carry remediation hints for agent-driven recovery
- Classify errors by phase for audit reporting
- Provide simple `die()`/`warnAndExit()` for lightweight scripts

## Metadata

- **Current Phase**: production
- **Owner**: automation-engineer
- **Last Updated**: 2026-08-16
- **Last Reviewer**: pm
