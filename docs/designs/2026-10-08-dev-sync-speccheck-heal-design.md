# dev-sync Step 3.9 Heal-by-Early-Publish — Design

- **Date**: 2026-10-08
- **Status**: implemented
- **Spec id**: `2026-10-08-dev-sync-speccheck-heal-design`
- **Ticket**: T-20261008-005 (dev-sync step ordering — spec-check flags publish-pending L1 drift)
- **Affected**: `scripts/dev-sync.ts` 1.24.0 → 1.25.0 (+ scrub-canonical L1 mirror), registry rows

## Problem

Step 3.9 runs `audit.ts --spec-check --lifecycle-only` as a FATAL gate, but the
lifecycle members of that audit include the L0/L1 agreement checks. A change
set that adds or bumps an L1-delivered script or skill (root `@version` +
registry row, L1 mirror intentionally left to the pipeline) fails step 3.9 on
drift that step 4.5 (`propagate-to-templates.ts --apply`, running later) exists
to heal — reproduced in PR #1476. The operator workaround was running the
publish by hand and re-running /sync.

## Decision

On a step 3.9 failure (after the existing auto-E5 path), dev-sync attempts ONE
early scoped publish (`propagate-to-templates.ts --apply`) and retries the
gate:

- Retry passes → the failure was publish-pending drift; proceed with an
  explicit log line. Step 4.5's publish still runs (idempotent no-op).
- Retry still fails → the diff genuinely lacks spec activity (or has real
  lifecycle defects); block exactly as before.

Gate strength is unchanged: only a genuinely passing audit continues, and the
workspace-root guard (`templates/common` + `scripts/propagation-map.json`)
mirrors step 4.5's own precondition, so L1+ projects never run the heal.

## Alternatives rejected

- Reordering 4.5 before 3.9 wholesale: moves a FATAL step across the language
  gate / QA pre-checks boundary and changes the pipeline's step semantics for
  every consumer of the documented step order.
- Tolerating (WARN) a lifecycle failure when drift is pending: would weaken the
  Design Gate — a genuine spec-relevance failure could hide behind pending
  drift, and 4.9's plain audit does not re-run the spec-relevance check.

## Verification

- `scripts/typecheck.ts`: 0 errors.
- Mechanics repro (post-landing, scratch): bump an L1-delivered script version
  at L0 only → `audit.ts --spec-check --lifecycle-only` exits 1 →
  `propagate-to-templates.ts --apply` → audit exits 0; scratch restored.
- L1 mirror produced via `scrubConstitutionRefs(root, 'scripts/dev-sync.ts',
  'templates/common/scripts/dev-sync.ts')` (code-path comment-only scrub);
  `verify-scripts.ts --check-drift` clean.
