# Project Review — ai_workspace (workspace root) — 2026-10-17

**Date**: 2026-10-17
**Scope**: workspace root
**Method**: baseline-only (user requested a project status check; the machine battery came back fully green, so no agent dispatch per the smallest-mode rule) + PM lightweight checks
> Analysis only — no files modified in this report.

## Baseline (review-baseline.ts, 8/8 green, 0 warn, 0 fail)

- ✅ audit.ts (workspace standards)
- ✅ validate-templates.ts (template/variant integrity + L1 parity)
- ✅ verify-scripts.ts --verify (SCRIPTS.md registry sync)
- ✅ agent-lifecycle-audit / skill-lifecycle-audit
- ✅ propagate-to-templates --check-drift (exit 1 = documented tolerated drift class only; JSON contract verified: tolerated 8, unexpected 0)
- ✅ validate-variant-claims.ts · nightly E2E green as of 2026-10-17T05:55Z

## PM lightweight findings

| # | Issue | Evidence | Severity | Class | Fix |
|---|-------|----------|----------|-------|-----|
| 1 | Uncommitted local edit: `opencode.json` gained `$schema` key | `git diff opencode.json` (single-line addition, benign) | L | one-time | Fold into next /sync commit |
| 2 | `gitleaks detect --no-git` reports 1110 finding class matches — **0 in git-tracked files** — all under gitignored `services/co-workspace/` runtime data (hermes-home user configs carry plaintext API keys at runtime) | /tmp/leaks.json cross-checked against `git ls-files` | M (hygiene) | systemic | Optional: rely on the git-mode gitleaks gate only and document the no-git override as noisy; never commit runtime data (already gitignored) |
| 3 | Manual governance backlog: all listed tickets read `done` (13 entries, incl. upstream U-20261009/08 FLAGGED rows awaiting 7-day dwell archive) | `bun scripts/ticket.ts list --kind manual` | L | one-time | `ticket.ts archive` when dwell elapses (runner cadence) |

## Action wiring

- No Critical/High agent findings (no agents dispatched; battery green).
- Finding #2 (docs/governance triage of no-git scan noise): deferred, noted here — no ticket created (existing security-scan skill + git-mode gate already mechanically covers tracked files; the no-git mode is an operator ad-hoc tool, not a standing gate).

## Ratchet note

Prior `script-gap` seeds (T-20261014-001 toml-vacuous validators, T-20261013-010 merge-money anchors, T-20261012-007 fork self-contradiction) all read `done` today — hardening loop landed, not stalled.
