# L0 Script Biome Conformance — 2026-11-19 (ticket-processing batch)

- **Status**: implemented
- **Decided**: 2026-11-19, unified runner session (user-directed ticket processing)
- **Scope**: L0 scripts/ + L1 templates/common/scripts mirrors
- **Relations**: T-20261108-009 residual (option (b) L0-side conformance), T-20261119-005, design 2026-11-18-dev-sync-hunk-staging-design

## Problem
Projects with stricter Biome profiles (co-newbiz: linter.rules.recommended=true) fail CI lint on every delivered L0-synced script wave. The 2026-11-19 co-newbiz wave (T-20261119-002) measured 12 errors across 4 files: useIterableCallbackReturn x9 (generate-raci.ts, validate-raci.ts), noControlCharactersInRegex x2 (constitution-scrub.ts NUL-sentinel protocol), noNonNullAssertedOptionalChain x1 (platform-skeleton-merge.ts headingLevel).

## Decision
Option (b) from T-20261108-009: fix at the L0 canonical so every stricter-profile project receives conformant content. Behavior-preserving edits only:
1. forEach callbacks get explicit braces (`(a) => { set.add(a); }`) — return-value elimination, no behavior change.
2. constitution-scrub.ts NUL-sentinel regex keeps its control characters (the scrub protocol's deliberate data channel) and gains a `biome-ignore lint/suspicious/noControlCharactersInRegex` line documenting the intent — suppression with provenance, not a rule weakening.
3. platform-skeleton-merge.ts `headingLevel` uses `?.[1]?.length` — the `!` was dead (the `?? 0` already handled undefined), so the optional chain is strictly safer.

## Acceptance
- [x] `biome ci --changed` reports 0 errors on the co-newbiz delivered set (310 warnings remain — profile policy, out of scope)
- [x] `bun run test:unit` green in co-newbiz with the fixed content
- [x] L1 mirrors byte-identical to L0 canonical (propagate-to-templates --check-drift: tolerated-overlay only)
- [x] Formatting verified via biome format on hand-edited files
