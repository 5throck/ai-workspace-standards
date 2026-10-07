# Project Resync Cycle — 2026-10-07 afternoon (run-10b, user-directed)

**Date**: 2026-10-07 (14:39 KST start)
**Trigger**: user-directed off-schedule invocation (runner prompt pasted with "continue"); regular 01:30 slot resumes 2026-10-08
**Preconditions**: templates v0.13.1 released + tagged (PR #1453) before upgrades; review findings landed first (PR #1452)

## Steps 0–3

- resync-audit: only two findings — co-develop's regenerated scripts-snapshot.json (LOCAL-WORK; tool artifact, discarded — the upgrade regenerates it) and co-deck (in-flight lecture-v4 session, excluded from the wave entirely; its dirty count grew 14→64 during the run — live session, hands off).
- Steps 2/2b/2c/2d: no committed LOCAL-WORK ranges to backport (the only dirty items were the co-develop artifact and live sessions) — skipped with rationale.

## Steps 4–5 — upgrade wave 0.12.0 → 0.13.1 (13 projects; co-deck excluded)

Canary co-price #144 merged first and verified on main (audit PASS, 141 scripts clean). Then 12 more, merged CLEAN only:

| Project | PR | Note |
|---|---|---|
| co-price (canary) | #144 | + source-map-js 1.2.2 bump (GHSA-68fv-2mgg-jv7q) |
| co-abap | #185 | pre-existing local registry drift fixed (new-requirement.ts row 1.1.0→1.2.0 to match @version) |
| co-architect | #367 | + @modelcontextprotocol/sdk 1.32.1 bump (GHSA-6qxp-vccf-f47h) |
| co-consult | #90 | origin/main conflict (CLAUDE.md Last-Updated line) resolved via --conclude-merge; spec registry re-sorted |
| co-design | #32 | spec registry re-sorted |
| co-develop | #178 | spec registry re-sorted |
| co-export | #45 | broken anchor in delivered phase-definitions fixed project-side; template fix ticketed (T-20261007-005) |
| co-game | #44 | post-upgrade regen wrote machine-local absolute l1_source — helper fixed (1.2.0) + snapshot regenerated |
| co-learning | #12 | — |
| co-newbiz | #456 | + @modelcontextprotocol/sdk 1.32.1 bump |
| co-safety | #198 | local registry drift fixed (start-mcp.ts row 1.0.0→1.0.1) |
| co-security | #74 | origin/main merged; manifest reconciled; _ko report lang declared |
| co-work | #12 | — |

Projects/co-hr does not exist (template-only variant — fleet drift noted; glob derived).

## Security gate

Two real advisories hit the wave's Dependency Audit gates — both fixed by patched-release lockfile bumps on the upgrade branches (no waivers): source-map-js 1.2.2 (GHSA-68fv-2mgg-jv7q) and @modelcontextprotocol/sdk 1.32.1 (GHSA-6qxp-vccf-f47h). gitleaks clean on all pushed ranges.

## Regenerated-snapshot hygiene (post-wave)

The wave's post-upgrade regeneration (new in 1.65.0) wrote machine-local ABSOLUTE l1_source into 7 tracked scripts-snapshot.json files (write-scripts-snapshot 1.1.1 read absolute inputs correctly but wrote them verbatim; co-game's audit-variant caught it live). Helper fixed to 1.2.0 (writes the workspace-root-relative form) + integration test; all 14 project snapshots regenerated to the relative form; 7 repos re-landed the corrected snapshot via dedicated PRs (co-price #145, co-abap #186, co-architect #368, co-consult #91, co-design #33, co-develop #179, co-export #46 — all merged). co-learning/co-game/co-newbiz/co-safety/co-security/co-work already carried relative forms.

## Final state table (at close-out)

| Project | br | dirty | unpushed | open PRs | template version |
|---|---|---|---|---|---|
| co-abap | main | 0 | 0 | 0 | 0.13.1 |
| co-architect | main | 0 | 0 | 0 | 0.13.1 |
| co-consult | main | 0 | 0 | 0 | 0.13.1 |
| co-deck | main | **14** | 0 | 0 | 0.12.0 — live lecture-v4 session (excluded) |
| co-design | main | 0 | 0 | 0 | 0.13.1 |
| co-develop | main | 0 | 0 | 0 | 0.13.1 |
| co-export | main | 0 | 0 | 0 | 0.13.1 |
| co-game | main | 0 | 0 | 0 | 0.13.1 |
| co-learning | main | 0 | 0 | 0 | 0.13.1 |
| co-newbiz | main | 0 | 0 | 0 | 0.13.1 |
| co-price | main | 0 | 0 | 0 | 0.13.1 |
| co-safety | main | 0 | 0 | 0 | 0.13.1 |
| co-security | main | 0 | 0 | 0 | 0.13.1 |
| co-work | main | 0 | 0 | 0 | 0.13.1 |

Cycle status: **complete** — 13/13 included projects at 0.13.1; co-deck deferred (live session); two vulnerability bumps delivered fleet-wide.
