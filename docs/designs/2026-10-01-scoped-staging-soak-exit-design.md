# Design: Scoped-staging soak exit — exclusion becomes the default (T-20261001-015)

- **Spec ID**: 2026-10-01-scoped-staging-soak-exit
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-015)
- **Amends**: docs/designs/2026-09-12-dev-sync-scoped-staging-design.md (Amendment 3 recorded there)

## Problem

The ADR-0055 WARN soak left dev-sync sweeping un-staged, un-generated files into
commits. PR #1280 hit the predicted failure live: foreign WIP test files swept
into a fix commit, pre-push blocked, repair required a reset + re-stage +
`--scoped-staging` re-run because the pre-commit hook refuses amends.

## Decision

dev-sync v1.23.0 flips the step 6.5 default to the promoted exclude-behavior
(`SYNC_SCOPED_STAGING !== '0'`). Opt-out restores the WARN soak via
`SYNC_SCOPED_STAGING=0` or the new `--warn-staging` flag; the legacy opt-in
forms (`=1`, `--scoped-staging`) stay accepted no-ops. `skills/sync/SKILL.md`
step 0 documents the exclusion default (skill 1.7.0). `.gitignore`-first for
tool artifacts was considered and REJECTED: template-delivered tracked files
(`.claude/skills/graft` etc.) would break mirror-parity validation, and scoped
staging already protects them by default.

## Accessibility

Non-UI tooling change — no accessibility impact (explicit statement per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- tests/unit/dev-sync-scoped-staging-default.test.ts (4 cases) — pass
- tests/unit/dev-sync-scoped-staging-deletion.test.ts (5 cases) — regression pass
