# Project Resync Cycle — Projects/co-* — 2026-09-29

**Cycle**: daily fleet-review runner, Phase II (full resync) — main CI green, DEGRADED lifted
**Fleet**: 13 projects (12 committed + new Projects/co-work, glob-derived)
**Phase I context**: review run 4 report docs/reports/2026-09-29-project-review-daily.md; PRs #1206/#1207 (review landing), #1208 (v0.8.0 release, tag template-v0.8.0 pushed)

## Steps 0–1 — Provenance + sync

11 projects clean/0-verdict. **Projects/co-work (new instance)**: 758-file scaffold, zero commits, no remote — resync-audit verdicts: 92 LOCAL-WORK (scaffold infrastructure), 117 STALE-RESIDUE (pre-0.8.0 template copies — self-healing via upgrade), 362 untracked-matching, 1 PRESUME-STALE. **Disposition**: destructive discard deferred (instance adjudication probe-vs-tenant pending owner); initial commit of the FULL scaffold made via the project's own dev-sync (a393d80), private remote bootstrapped (Safety Rule 4), preserved on the remote default branch (direct-main push blocked by the delivered pre-push hook — branch hygiene is owner follow-up with T-20260929-002's initial-commit design gap).

## Steps 2–2d — Backport/DOM

No template-promotion candidates (the instance's divergences are scaffold-version skew, self-healing). DOM/echo: clean. new-project skill's fleet "missing" presence: L0-only by design (verified frontmatter chain) — no ticket.

## Steps 4–5 — Upgrade wave v0.8.0 (HERMES.md fleet delivery)

All 12 committed projects: real upgrade + local verify (audit green, verify-scripts clean, template-version 0.8.0, HERMES.md present) + upgrade PR opened. Canary co-safety #182 merged 7/7 green; co-abap #168 merged 2/2 green.

**Merge status**: 2/12 merged (public repos, CI-verified). **10/12 OPEN — private repos' CI is quota-blocked (runner=none, T-20260927-016 URGENT human action); checks can never go CLEAN until billing is raised, and no red-merge authorization exists for this wave.** PRs: co-consult, co-deck, co-design, co-develop, co-export, co-game, co-newbiz, co-price, co-security, co-architect.

## Step 6 — Final state

| Project | dirty | unpushed | open PRs | template-version |
|---|---|---|---|---|
| co-abap | 0 | 0 | 0 (merged #168) | 0.8.0 |
| co-architect | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-consult | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-deck | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-design | 0 | 0 | 0 (created yesterday; instance on its default branch) | 0.7.0 |
| co-develop | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-export | 0 | 0 | 0 (merged #182 predecessor wave) | 0.8.0 |
| co-game | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-newbiz | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-price | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-safety | 0 | 0 | 0 (merged #182) | 0.8.0 |
| co-security | 0 | 0 | 1 (v0.8.0, quota) | 0.7.0→0.8.0 on PR |
| co-work (new) | preserved on private remote default branch | — | adjudication pending (owner) | 0.7.0 |

Open-PR reason (stated): T-20260927-016 Actions quota — merges resume on the first cycle after billing is raised.
