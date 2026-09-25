---
status: Accepted
date: 2026-09-25
author: Architect
---

# ADR-0089: Local Automation Cadence and Unattended Merge Policy

## Context

ADR-0082 ratified the local ZCode runner as the sole governance-ticket processor and
documented its cadence as 05:30 KST. That schedule is stale: the live ticket batch runs
at **03:00 KST** — moved on 2026-09-25 by user request (originally 02:30). The drift ran
in the opposite direction from the usual pattern: the automation moved and the docs did
not follow, so ADR-0082 and `docs/constitution/09-operations-workflow.md` §9.8 named a
time that no longer exists.

On the same day the user approved a second local ZCode automation (daily 01:30 KST,
cron `30 1 * * *`): a fleet review + resync run whose Phase I executes the
`project-review` skill over workspace root L0 + `templates/` and whose Phase II executes
the `project-resync` skill over all `Projects/co-*` (design:
`docs/designs/2026-09-25-daily-fleet-review-resync-design.md`; meeting transcript:
`memory/meeting-2026-09-25-daily-review-resync-design.md`). The two runs overlap in
time and mutation surface, and both touch shared working-tree state.

This run is also the workspace's **first auto-merging automation**. ADR-0082's contract
states that neither the local runner nor a manual dispatch merges PRs — written for the
ticket batch, but broadly read as an automation-wide never-merge stance. The meeting's
security slot recommended an explicit policy decision (canary-first upgrades at minimum)
precisely because no ADR covered unattended merges.

## Decision

1. **Canonical local automation cadence (all times KST)**:

   | Time | Automation | Scope |
   |---|---|---|
   | 01:30 daily | Local ZCode fleet review + resync runner | Phase I `project-review` (L0 + `templates/`); Phase II `project-resync` (`Projects/co-*`); hard stop 04:45; **Fridays run FULL review mode regardless of the change window** (user-approved 2026-09-25) |
   | 03:00 daily | Local ZCode governance-ticket batch | ADR-0082's contract unchanged (up to 50 tickets / ~5 h; four validation gates; PR-only landing) |

   Both automations are local ZCode runners sharing the atomic lock
   `.pipeline-state/automation.lock` (gitignored) with **defer-not-skip** semantics: a
   runner that finds the lock held polls until its window ends; it never skips and never
   double-runs. The 05:30 cadence references in ADR-0082 and §9.8 are superseded.

2. **Unattended merge policy — amends ADR-0082 for the 01:30 fleet runner ONLY**:

   - The 03:00 governance-ticket batch **still never merges PRs**. ADR-0082's never-merge
     contract for the ticket batch is unchanged.
   - The 01:30 fleet runner may merge **project PRs** (resync Step 1) and the **root PR**
     (Step 3) only when **all checks are CLEAN**.
   - **Upgrade PRs** (resync Step 5) merge **canary-first**: merge one project, verify its
     audit and verify-scripts are clean, then merge the remainder. Any failure leaves the
     remaining upgrade PRs **open** and files **one urgent ticket**.

3. **Schedule-change rule**: any future schedule change updates, in the same change set:
   this ADR, the `docs/constitution/09-operations-workflow.md` §9.8 cadence section, and
   the automation prompts themselves. Docs, decisions, and reality move together or the
   change does not land.

## Consequences

- `docs/constitution/09-operations-workflow.md` §9.8 is rewritten to document the two
  canonical schedules, the shared lock, and this ADR pointer — ending the documented/live
  drift.
- Blast-radius controls for unattended mutation are: **canary-first upgrade merges**
  (one verified project gates the fleet), the **secrets gate**
  (`gitleaks detect --no-git --config .github/gitleaks-full.toml` before any push or
  promotion — the default `.gitleaks.toml` allowlists `Projects/` entirely), and
  **degraded mode** (baseline ≥3 ERRORs or any Critical → Phase II runs audit-only with
  zero commits/pushes/merges).
- Risk accepted: the 01:30 runner merges project and root PRs unattended when every gate
  is CLEAN. Reviewer coverage for those PRs is the gate battery plus post-hoc audit of
  run reports, not a human merge checkpoint.
- ADR-0082's cadence sections (05:30 references) are superseded by this ADR; its safety
  rules, four-gate validation, PR-only landing, ticket state machine, and never-merge
  contract for the ticket batch carry over unchanged.
- A 01:30–03:00 window overlap is expected on heavy nights; the shared lock turns that
  overlap into ordered deferral, not collision.

## References

- Amends: ADR-0082 (schedule references; never-merge for the ticket batch unchanged)
- `docs/designs/2026-09-25-daily-fleet-review-resync-design.md` (spec
  `2026-09-25-daily-fleet-review-resync`)
- `memory/meeting-2026-09-25-daily-review-resync-design.md` (multi-agent design review,
  user-approved)
- `docs/constitution/09-operations-workflow.md` §9.8 (rewritten to the canonical cadence)
