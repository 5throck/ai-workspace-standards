# Design: Variant Mirror Stale-Orphan Check (PM-02 FAIL arm)

- **Spec ID**: 2026-09-22-variant-mirror-stale-orphan-check
- **Date**: 2026-09-22
- **Status**: implemented
- **Source**: user-directed project review (backport-process focus) — T-20260924-004

## Problem

The remediation (2026-09-24-variant-skill-mirror-drift-remediation) removed stale variant platform-mirror copies of common skills (co-hr agent-lifecycle-manager v1.0.0, co-consult research-analysis/documentation-writing), but the class could regrow silently: checkVariantMirrorParity's only signal for mirror copies of skills absent from both owning trees was a WARN, and copies of COMMON skills absent from the variant tree but not flagged were skipped entirely (`(inVariant || inCommon) && !flagged → continue`).

## Decision

1. Extract the decision into a pure exported classifier `classifyVariantMirrorCopy()` (validate-templates.ts, L0+L1 mirrored) so the arm is unit-testable without running the whole validator.
2. New FAIL arm: a variant platform-mirror copy of a COMMON skill, absent from the variant skills/ tree, unflagged, whose mirror version is OLDER than the common SSOT version, and carried by no peer variant → `fail-stale-orphan` (the regrown D1/D2 class). Same-version or peer-shared copies stay at the pre-existing WARN/INFO level (uniform-baseline set is legitimate per the remediation design §1.3).
3. Peer counting via a fleet pre-pass census (which variants' mirrors carry each skill).

## Non-Goals

- No auto-removal: the fix hint instructs deletion or variant.json declaration; the operator decides.
- No semantic content comparison: version comparison only (content drift needs the content-similarity fleet scan — separate follow-up).

## Verification

- Positive fixture: documentation-writing v1.0.0 injected into co-game's 4 mirrors (common carries v1.0.3, no peers) → 4 stale-orphan FAILs.
- Negative: fixture removed → 0 errors (the pre-existing 15-warning baseline unchanged).
- Unit tests: classifier decision table (tests/unit/variant-mirror-classify.test.ts).
