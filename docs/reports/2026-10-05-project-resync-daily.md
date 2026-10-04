# Project Resync Cycle — 2026-10-05 (daily, run-9, Phase II)

**Date**: 2026-10-05
**Trigger**: nightly fleet review+resync automation (ADR-0089)
**Precondition**: Phase I landed and merged (PR #1412); templates released v0.12.0 (PR #1413, tag `template-v0.12.0`) before upgrades — sequential branch rule honored.

## Step 0 — Provenance audit

`bun scripts/resync-audit.ts` over 13 Projects: no STALE-RESIDUE, no PRESUME-STALE anywhere. Two findings:

| Project | Finding | Verdict | Action |
|---|---|---|---|
| co-deck | 1 tracked-modified test (`verify-new-theme.test.ts` 3s→10s) | KEEP (script) → overridden by template-equality proof | snapshot `.pipeline-state/resync-snapshots/2026-10-05-codeck-echo/` → discard (content byte-equals current template; 0.12.0 re-delivers) |
| co-safety | repo parked on local branch `pr/20261003-225351-docs-security-phase-b` (stale main) | not a verdict item | containment check proved commit already on origin/main (PR #196, concurrent session); refs deleted, main fast-forwarded |

- resync-audit classification defect observed (claimed "no HEAD version" for a tracked-modified file; truncated group key "cripts/co-deck*") → T-20261004-019.

## Step 1 — Sync to GitHub

No uncommitted LOCAL-WORK required a PR this cycle (the only dirty tree item was the co-deck echo above; co-safety's branch was already merged). Nothing pushed from verdicts.

## Steps 2 / 2b / 2c / 2d — Backport planes

- **Step 2 (5-surface)**: no committed LOCAL-WORK range → no candidates; skipped with rationale.
- **Step 2b (evidence scan)**: no PROMOTABLE. co-security prose-ledger NOT_YET (M1 fail: 0 decision records with evidence_refs); co-work NEEDS_TRIAGE (F0); co-safety M2-fail at 94.2d span — already tracked as T-20261003-009 (backlog). Nothing promoted; nothing written into templates/.
- **Step 2c (fleet echo)**: no candidates → no echo checks; skipped with rationale.
- **Step 2d (Domain Operating Model, read-only)**: process/stages.yaml, governance/raci.yaml, governance/_human-roles.yaml, decisions/gates.yaml, evidence-models/ — zero project↔template deltas across all template-track projects; co-architect and co-newbiz recorded as standalone-track. No domain-model triage rows.

## Secrets gate

gitleaks (full config) over the co-safety branch diff set before push: clean. No other pushes this cycle (upgrade PR pushes are CI-gated).

## Steps 4–5 — Upgrade wave 0.10.0 → 0.12.0 (13 projects)

`upgrade-project.ts --prune-removed` real runs: all Security checks PASSED, 0 files pruned. Canary-first merges: co-price #143 merged first, verified (audit PASS + verify-scripts 141/141 clean on main), then the remaining 12.

| Project | PR | Result |
|---|---|---|
| co-price (canary) | #143 | MERGED + verified on main |
| co-abap | #184 | MERGED |
| co-architect | #366 | MERGED |
| co-consult | #85 | MERGED |
| co-deck | #129 | MERGED |
| co-design | #31 | MERGED (2nd commit: regenerated playground/bun.lock after frozen-lockfile CI failure — T-20261004-030) |
| co-develop | #173 | MERGED |
| co-export | #44 | MERGED |
| co-game | #43 | MERGED |
| co-newbiz | #455 | MERGED (pre-req: illegal spec status "accepted" normalized → approved via spec-register --update) |
| co-security | #71 | MERGED (pre-req: illegal spec status "final" normalized → implemented) |
| co-safety | #197 | **OPEN — stated reason**: delivered dependency-audit.ts (new in 0.12.0) hard-fails on package.json-less repos; co-safety has none. Fix = skip-guard at root (T-20261004-029, urgent), release 0.12.1, re-run upgrade next cycle |
| co-work | #11 | MERGED |

## Process findings (this cycle's machinery)

1. **dev-sync v1.23.0 scoped-staging default flip**: project upgrade landings MUST set `SYNC_SCOPED_STAGING=0` — the default captured only memory/* into the commit (co-price #142 closed as partial, redone as #143).
2. **Two-attempt manifest gate**: first dev-sync after an upgrade stages everything then fails on VERSION_MANIFEST drift; regenerating the manifest and re-running the (reused) pr branch lands it. Inherent to the current gate order — candidate for the upgrader to pre-regenerate (fold into T-20261004-019-class hardening; noted, not ticketed separately).
3. co-newbiz/co-security carried pre-existing illegal spec statuses ("accepted"/"final") that only surfaced under the upgrade diff's spec-check — normalized via the sanctioned `spec-register.ts --update` inside their upgrade PRs.

## Final state table

| Project | dirty | unpushed | open PRs | template version |
|---|---|---|---|---|
| co-abap | 0 | 0 | 0 | 0.12.0 |
| co-architect | 0 | 0 | 0 | 0.12.0 (standalone-track) |
| co-consult | 0 | 0 | 0 | 0.12.0 |
| co-deck | 0 | 0 | 0 | 0.12.0 |
| co-design | 0 | 0 | 0 | 0.12.0 |
| co-develop | 0 | 0 | 0 | 0.12.0 |
| co-export | 0 | 0 | 0 | 0.12.0 |
| co-game | 0 | 0 | 0 | 0.12.0 |
| co-newbiz | 0 | 0 | 0 | 0.12.0 (standalone-track) |
| co-price | 0 | 0 | 0 | 0.12.0 |
| co-safety | 0 | 0 | **1** (#197) | 0.10.0 (upgrade parked — T-20261004-029) |
| co-security | 0 | 0 | 0 | 0.12.0 |
| co-work | 0 | 0 | 0 | 0.12.0 |

Cycle status: **complete** — 12/13 fully synced and upgraded; co-safety intentionally parked with an urgent fix ticket and a stated open-PR reason.
