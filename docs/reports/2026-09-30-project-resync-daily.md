# Project Resync Cycle — Projects/co-* — 2026-10-01 (upgrade wave HELD on 2 upstream defects)

**Cycle**: daily fleet-review runner, Phase II (full resync) — main CI green, no degraded mode
**Fleet**: 13 projects (12 committed + co-work new instance)
**Phase I context**: review run 5 report docs/reports/2026-09-30-project-review-daily.md

## Steps 0–1 — Provenance + sync

12 committed projects clean. co-work: initial scaffold committed (a393d80) + private remote bootstrapped (5throck/co-work, default branch); adjudication pending (owner).

## Steps 2–2d — Backport/DOM

No template-promotion candidates. DOM/echo clean. new-project skill L0-only confirmed (no ticket).

## Steps 4–5 — Upgrade wave (HELD on 2 upstream defects)

All 13 dry-runs: uniform ~4 locked + HERMES delivery plans. Real upgrades executed and locally verified on 12 projects (audit/verify-scripts ran; HERMES.md delivered). **Pushes/merges HALTED by 2 upstream defects in the delivered 0.8.x validators:**

1. **agent-lifecycle-audit false-positive on extends-stub pm.md** — "Missing tier field in frontmatter" fires on agents/pm.md files that are extends-stubs legitimately inheriting tier from templates/common/agents/pm.md 1.2.1. Affects ~10 fleet projects. → **T-20261001-003 (URGENT)**.
2. **Malformed SCRIPTS.md row (9 columns)** — root scripts/SCRIPTS.md:201 regenerate-agents-md row still carries duplicated tail cells (T-20260930-002's fix was partial; root tolerates as warning, the v0.8.x-delivered project validators ERROR). → **T-20261001-006 (URGENT)**.

Additionally: **GH007 email-privacy push rejections** — 5 upgrade pushes rejected (commits carried the global techcross@gmail.com identity; the GitHub account now blocks private-email pushes). Fixed per-repo: user.email = 10958964+5throck@users.noreply.github.com + soft-reset + dev-sync re-land (PRs #184/#170 created; co-consult/deck/design re-landed on their PR branches).

## Step 6 — Final state (upgrade commits local; PRs where pushable)

| Project | state | upgrade delivery |
|---|---|---|
| co-abap | PR #170 open (re-landed post-GH007) | v0.8.x on PR |
| co-consult | PR #73 carries delivery + main @ 0.8.1 | v0.8.x on PR branch |
| co-deck | PR #115 carries delivery | v0.8.x on PR branch |
| co-design | PR #15 carries delivery | v0.8.x on PR branch |
| co-develop | PR #159 open | v0.8.x on PR |
| co-export/game/newbiz/price/security | auto-merged (0.8.1 delivery, pre-defect discovery) | delivered |
| co-safety | PR #184 open (re-landed post-GH007) | v0.8.x on PR |
| co-work | initial scaffold on private remote default branch | adjudication pending |

Local trees: upgrade commits committed on PR/local branches; repos returned toward their default branches where clean.

## Blockers (owner/next-cycle)

- **T-20261001-003/-006 (URGENT)**: fix the 2 delivered-validator defects at root (scripts/agent-lifecycle-audit.ts extends-stub handling; SCRIPTS.md 8-column row) + re-release → then the 12 upgrade PRs merge / re-deliver.
- **T-20260927-016 (URGENT, human)**: Actions quota — still active; the 3+10 private merges/PRs ride over it.
- **co-work adjudication** (owner): keep-vs-delete.
