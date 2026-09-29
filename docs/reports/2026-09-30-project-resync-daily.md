# Project Resync Cycle — Projects/co-* — 2026-09-30

**Cycle**: daily fleet-review runner, Phase II (full resync) — main CI green, no degraded mode
**Fleet**: 13 projects (glob-derived; +co-work new instance created 09-28)
**Phase I context**: review run 5 report docs/reports/2026-09-30-project-review-daily.md; PRs #1206/#1207 (review), #1208 (v0.8.1→ template-v0.8.1 release chain was 09-29; this cycle: v0.8.2 bump prepared → deferred, see 6b)

## Steps 0–1 — Provenance + sync

12 committed projects: dirty 0, empty verdicts. **Projects/co-work (new instance, zero commits)**: 758-file scaffold audit — 92 LOCAL-WORK (scaffold infra) / 117 STALE-RESIDUE (pre-0.8.1 template copies) / 362 untracked-matching / 1 PRESUME-STALE. Disposition: destructive discard deferred (instance adjudication probe-vs-tenant is an owner call); initial scaffold commit made via the project's own dev-sync (a393d80) + private remote bootstrapped (5throck/co-work, default branch carries the scaffold; direct-main push blocked by the delivered pre-push hook — branch hygiene owner follow-up with T-20260929-002).

## Steps 2–2d — Backport/DOM

No template-promotion candidates (instance divergence = scaffold-version skew, self-healing via upgrade). DOM/echo clean.

## Step 2b — Evidence scan

Deferred to the next full cycle (no new local work to scan; prior cycles: 0 PROMOTABLE).

## Steps 4–5 — Upgrade wave (v0.8.x delivery: fleet HERMES.md upkeep + contract/schema updates)

All 12 committed projects upgraded (locked ~4-5 + managed merges each), local verify green, template-version stamped. Delivery/merge results:

- **Merged**: co-safety #184 (public, CLEAN 7/7-era), co-abap #170 (public, CLEAN), **+ 6 instant auto-merges on PR creation** (co-architect, co-export, co-game, co-newbiz, co-price, co-security — no required checks on those private repos; merges happened on delivery, noted for the record).
- **OPEN (3)**: co-consult #73, co-deck #115, co-design #15 — private repos where the quota-failed checks surface as the PR's own failing checks (UNSTABLE not BLOCKED, but left per the never-merge-red rule absent wave-specific authorization).
- **GH007 incident (new)**: 5 pushes rejected by GitHub email-privacy protection (GH007) — the upgrade commits carried the global `techcross@gmail.com` identity while the account now blocks private-email pushes. Fixed per-repo: `user.email = 10958964+5throck@users.noreply.github.com` + soft-reset + dev-sync re-land (PRs re-created). Root repo identity unchanged (its pushes passed — timing-dependent enforcement observed).

## Step 6 — Final state

| Project | dirty | unpushed | open PRs | template-version |
|---|---|---|---|---|
| co-abap | 0 | 0 | 0 (merged #170) | 0.8.1 |
| co-architect | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-consult | 0 | 0 | 1 (#73, quota) | 0.8.1 on PR |
| co-deck | 0 | 0 | 1 (#115, quota) | 0.8.1 on PR |
| co-design | 0 | 0 | 1 (#15, quota) | 0.8.1 on PR |
| co-develop | 0 | 0 | 1 (#159, quota) | 0.8.1 on PR |
| co-export | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-game | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-newbiz | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-price | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-safety | 0 | 0 | 0 (merged #184 canary) | 0.8.1 |
| co-security | 0 | 0 | 0 (auto-merged) | 0.8.1 |
| co-work | preserved on private remote default branch | — | adjudication pending (owner) | 0.8.1 |

**6b note**: the v0.8.2 bump was prepared but refused by the clean-tree guard (concurrent branch race) — T-20260930-007 filed; the 19-path delta was delivered file-level by this wave regardless; the release stamp lands on the first clean-main retry.
