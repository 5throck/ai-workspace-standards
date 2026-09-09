# Design — Validator Hardening Batch (T-20260909-002/003/004/006/021)

- **Spec ID**: nightly-hardening-2026-09-09
- **Date**: 2026-09-09
- **Status**: implemented (nightly governance-ticket runner, first batch)
- **Owner**: automation-engineer role

## Accessibility (ADR-0065)

Exempt — non-UI validator/process changes only.

## Scope

Five validator-hardening tickets implemented by the nightly governance-ticket runner
(first successful batch of `.github/workflows/nightly-tickets.yml`):

| Ticket | Change | File |
|---|---|---|
| T-20260909-002 | verify-memory v1.2.0 — reverse dead-link check: MEMORY.md index rows whose session log file no longer exists are flagged | scripts/verify-memory.ts |
| T-20260909-003 | verify-scripts v1.6.0 — `.bat` added to SCRIPT_EXTENSIONS so Windows batch helpers can no longer escape the unregistered-script check; import-guarded CLI dispatch | scripts/verify-scripts.ts |
| T-20260909-004 | agent-lifecycle-audit v1.2.0 — Check 11: WARN when an agent's `last_updated` frontmatter lags its git history | scripts/agent-lifecycle-audit.ts |
| T-20260909-006 / -021 | audit.ts v2.31.0 — stray-artifact check fails loud when the schema is missing/unparseable or rootAllowlist is absent (no more empty-allowlist fallback) | scripts/audit.ts |

Registry rows bumped in `scripts/SCRIPTS.md` and the `templates/common/scripts/SCRIPTS.md`
mirror; changed scripts propagated to L1 via `propagate-to-templates.ts --apply`.

## Alternatives

Implementing these as ad-hoc patches without registry/spec updates was rejected —
it is exactly the incompleteness that left the first runner batch unlanded.

## Verification

`bun test` (root), `verify-scripts --verify`, `lifecycle-sync-audit`, `audit.ts` all green
after mirror reconciliation.
