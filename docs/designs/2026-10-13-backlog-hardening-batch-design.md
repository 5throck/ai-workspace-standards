# Design: Backlog hardening batch — gitleaks merge integrity, LOCAL-PATCH noise filter, dev-sync REST fallback

- **Spec ID**: 2026-10-13-backlog-hardening-batch-design
- **Date**: 2026-10-13
- **Status**: implemented
- **Tickets**: T-20261013-010, T-20261013-006, T-20261013-002, T-20261013-005 (+ lost-patch recovery promoted from Projects/co-abap)

## Summary

The 2026-10-13 0.18.0 upgrade wave surfaced three defects and one lost patch; this batch fixes them at the root and lands the promoted patch.

### D1 — gitleaks merge corrupted `$''`-anchored entries (T-20261013-010)

`mergeGitleaksToml` built its `String.replace` replacement by string-concatenating `$1`/`$2` with project-only allowlist entries. `$'` inside a replacement **string** substitutes the text-after-match, so a project entry ending in `$` followed by `'''` lost its anchor — co-abap's `.gitleaks.toml` allowlist silently disabled and the landing blocked on 6 gitleaks false positives. Fix: entries extracted to `scripts/helpers/gitleaks-merge.ts` (new L0+L1 helper, mirror span 152→153); the merge now uses replacer **functions** (inserted literally); `dryRun` parameterized; unit tests pin the `$''` round-trip.

### D2 — LOCAL-PATCH scanner noise drowned real patches (T-20261013-006)

co-abap's pre-upgrade scan reported 27 markers: instruction-doc protocol text (backticked), scanner-source self-matches, and SCRIPTS.md registry descriptions — noise that got the report dismissed while **real** markers (dev-sync REST fallback, audit Gemini-TOML parity) were overwritten. Fix in `helpers/local-patch-scan.ts` 1.1.0: strip inline-code spans per line before matching, and skip the marker's defining/registry sites (`scripts/hooks/pre-commit.ts`, the scanner itself, `scripts/upgrade-project.ts`, `scripts/SCRIPTS.md`). Real plain-comment markers still report (unit-proven).

### D3 — dev-sync REST fallback promoted (lost co-abap patch)

`dev-sync.ts` 1.28.0: when `gh pr view` fails with 403/GraphQL (cloud sessions), the existing-PR check resolves via `gh api repos/<slug>/pulls?head=…&state=open` instead of reading "no PR" and risking duplicate creation. Promoted from Projects/co-abap's LOCAL-PATCH (lost in the 0.18.0 wave, recovered from git history).

### D4 — sync skill branch-behavior documentation (T-20261013-002, T-20261013-005)

`skills/sync/SKILL.md` (+ common mirror + 5 platform mirrors via sync-skills) now documents: full-diff PR title derivation, the closed-PR branch refusal, the fresh-branch preference for superseding deliveries (GitHub-server-side phantom conflicts on reused branches, #1526 case), and the REST fallback.

## Verification

- `tests/unit/gitleaks-merge.test.ts` — 4 tests: `$''`-anchored entry preserved literally; preserved-comment placement; no-op merge; dryRun immutability.
- `tests/unit/local-patch-scan.test.ts` — +2 tests: protocol-text/backtick/registry-row non-findings; real plain-comment marker survives.
- Root battery: `audit.ts` green, `validate-templates.ts` 0 errors, `verify-scripts.ts --verify` 231 scripts clean, mirror-span pin 153.

## Non-goals / deferred (triage recorded, tickets stay open)

- T-20261013-001 (extract registry-append duplication) — refactor batched for the next window; both call sites changed twice today.
- T-20261013-003 (country-profile pollination) — template content design, needs co-export domain input.
- T-20261013-004 (checklist-to-gate wiring in common agents) — common-contract policy change, design first.
- T-20261012-003/004/005, T-20261007-012 — learning patterns; promotion is human-judged (ADR-0080).
- T-20261008 (review-baseline coverage) — premise corrected: co-abap's file was a same-named project-local L3 baseline runner, not the root tool; restored project-side as variant-owned tooling (separate project PR).
