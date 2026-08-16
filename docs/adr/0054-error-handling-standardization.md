# ADR-0054: Error Handling Standardization

**Status**: Accepted
**Date**: 2026-08-16
**Deciders**: pm, architect, automation-engineer

## Context

The 7-domain parallel project review (2026-08-16) identified **inconsistent error handling** across the workspace's 80+ TypeScript scripts (Moderate issue; Risk #4 in the L3-to-variant pipeline). Most scripts use ad-hoc patterns:

- `console.error(msg); process.exit(1)` — inline, no structured metadata
- `throw new Error(msg)` — uncaught in CLI context, no remediation guidance
- Silent `process.exit(0)` on non-fatal-but-wrong conditions — no warning

`scripts/lib/error-handling.ts` existed since the L3-to-variant pipeline (v1.0.0 → v1.2.0) but was **pipeline-scoped**: its `ErrorPhase` enum contained only pipeline phases (`ADR_VALIDATION`, `L3_SCAN`, `RECONCILIATION`, `VARIANT_GENERATION`, `BETA_SETUP`, `INTEGRATION`, `VALIDATION`), and it was imported by only 2 top-level scripts. The library could not serve general-purpose scripts without extension.

## Decision

**Adopt `scripts/lib/error-handling.ts` as the standard error handling library for all workspace scripts**, with incremental migration.

### 1. Library Expansion (v1.3.0)

Extend the existing library (not a new module) to serve general-purpose scripts:

- **Generic `ErrorPhase` values** added alongside pipeline phases: `SCRIPT_EXECUTION`, `FILE_IO`, `CLI_PARSING`, `AUDIT`, `LIFECYCLE`, `SECURITY`.
- **Convenience functions** for simple scripts:
  - `die(message, code = 1): never` — formatted fatal error + exit
  - `warnAndExit(message, code = 0): never` — formatted warning + exit
  - `withErrorHandling(phase, fn, context)` — async wrapper with structured catch → log → recovery → exit(1)
  - `withSyncErrorHandling(phase, fn, context)` — sync wrapper variant

### 2. Migration Convention

Scripts migrate **incrementally** (opportunistic — when a script is otherwise modified), not as a bulk rewrite. Each migrated script follows the established pattern from `generate-l3-readme.ts`:

```typescript
import { ErrorPhase, fatalError, logError, die } from './lib/error-handling.ts';

// Early fatal conditions:
if (!existsSync(path)) {
  die(`Required file not found: ${path}`, 1);
}

// Structured errors for complex failure points:
const err = fatalError(ErrorPhase.SCRIPT_EXECUTION, 'CODE', 'Message', details, remediation);
logError(err);
process.exit(1);
```

**Priority order** for migration batches:
1. Simple self-contained utility scripts (validators, listers, cleanup tools) — low risk
2. L0+L1 scripts (must sync L0 → `templates/common/scripts/` in the same change)
3. Core governance scripts (audit.ts, dev-sync.ts, validate-templates.ts, propagate-to-templates.ts, qa-gate.ts, lifecycle-sync-audit.ts) — **last**, only when a functional change already requires touching them

### 3. What NOT to Do

- Do **not** force every `console.log` into a `PipelineError`. The library is for error/exit paths, not normal output.
- Do **not** migrate scripts purely for consistency — the migration rides along with functional changes (per §8.3 Surgical Changes in coding guidelines).
- Do **not** remove existing structured errors from pipeline scripts (they already use the library correctly).

## Consequences

**Positive:**

- Consistent error output format across scripts (`[timestamp] [SEVERITY] [phase] CODE: message`).
- Fatal errors carry remediation hints (`suggestedRemediation`) for agent-driven recovery.
- The `ErrorPhase` taxonomy gives the auditor (and `lifecycle-sync-audit.ts`) a stable classification for error-rate reporting.
- Incremental migration keeps risk low — no large-bang rewrite of governance scripts.

**Negative / Trade-offs:**

- Migration is slow (opportunistic only) — full coverage may take several quarters.
- `die()` output prefix (`❌`) differs from legacy `console.error` styling during the transition; visual parity is not a goal.
- Pipeline scripts keep their pipeline-specific phases; the enum grows with each new domain but stays backward compatible (existing values unchanged).

## Implementation

### 1. Library (done in v1.3.0)

`scripts/lib/error-handling.ts` v1.3.0:
- 6 generic `ErrorPhase` values added
- `die`, `warnAndExit`, `withErrorHandling`, `withSyncErrorHandling` added
- L0 → L1 sync to `templates/common/scripts/lib/error-handling.ts`

### 2. First migration batch (this PR)

| Script | Layer | Changes |
|--------|-------|---------|
| `validate-doc-folder.ts` | L0+L1 | `die()` for fatal conditions, `withSyncErrorHandling` wrapper |
| `cleanup-completed-md.ts` | L0+L1 | `die()` for error paths, explicit exit codes |
| `agent-list.ts` | L0+L1 | `die()` for ENOENT/catch paths |

### 3. Registry + Docs

- `scripts/SCRIPTS.md` — note the migration convention in the header comment.
- `docs/constitution/08-coding-guidelines.md` §8.11 — reference the standard.
- `docs/lifecycle/scripts/error-handling.md` — lifecycle record.

**References:**

- ADR-0001: Scripts Type Column (script registry)
- ADR-0036: TypeScript Script Migration
- ADR-0037: propagate-to-templates consolidation
- `docs/constitution/08-coding-guidelines.md` §8.2 (Simplicity First), §8.3 (Surgical Changes)
- `scripts/lib/error-handling.ts` header comment (Risk #4: Error Handling)
