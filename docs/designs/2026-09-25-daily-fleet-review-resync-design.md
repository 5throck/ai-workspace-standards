# Design: Daily Fleet Review + co-* Resync Automation — Governance Registration (Design Gate)

- **Spec id**: `2026-09-25-daily-fleet-review-resync`
- **Date**: 2026-09-25
- **Author**: Template Architect (Design Gate, ADR-0074)
- **Source**: user-approved ZCode automation (CronCreate, daily 01:30 KST, cron `30 1 * * *`); multi-agent design meeting 2026-09-25 (`memory/meeting-2026-09-25-daily-review-resync-design.md`)
- **Related**: ADR-0089 (cadence + unattended merge policy), ADR-0082 (ticket-batch contract, unchanged), ADR-0083 (Terminology rule — the "DOM" acronym is banned; this document spells "Domain Operating Model"), ADR-0079 (instruction standard), ADR-0065 / ADR-0070 (exemptions, §8–§9)

---

## 1. Background

The user approved a daily local ZCode automation on 2026-09-25 (meeting: PM-facilitated, five review slots, dissents preserved). The automation runs at 01:30 KST and has two phases:

- **Phase I — `project-review` skill** over workspace root L0 + `templates/`: machine baseline via `bun scripts/review-baseline.ts --quiet`; orphan agent/skill sweep including `bun scripts/skill-graph-fleet-report.ts`; a 4-slot parallel agent review scoped to a marker-file change window (`.pipeline-state/last-daily-review`); FULL-mode escalation on structural triggers; a **Friday FULL override** (user-approved 2026-09-25 — Fridays run FULL mode regardless of the window). Findings land in `docs/reports/YYYY-MM-DD-project-review-daily.md` with a mandatory Class column (`one-time` / `systemic` / `script-gap`); `script-gap` findings produce validator-hardening tickets capped at 10/day.
- **Phase II — `project-resync` skill** over ALL `Projects/co-*` (glob-derived; the fleet count is never hardcoded — it was observed as 11, 12, and 13 within one hour during the meeting): Steps 0–6, plus a new read-only **Step 2d "Domain Operating Model"** diff of project vs `templates/co-<x>/` on `process/stages.yaml`, `governance/raci.yaml` (+ `actor_types`), `governance/_human-roles.yaml`, `decisions/gates.yaml`, `evidence-models/`, and `docs/graph-deltas/`. Findings become `domain-model:` human-triage rows and are never auto-promoted.

Two governance gaps motivate this registration:

1. **No spec exists.** The automation is substantive standing work (ADR-0078); the Universal Design Gate (ADR-0074) requires a registered design before its landing surfaces are touched.
2. **Docs drifted from reality.** ADR-0082 and `docs/constitution/09-operations-workflow.md` §9.8 document the governance-ticket batch at 05:30 KST; the live schedule is 03:00 KST (moved 2026-09-25 by user request; originally 02:30). Additionally, the 01:30 runner introduces the workspace's first auto-merging automation — a policy change that requires an ADR. ADR-0089 records both; this design specifies the automation itself.

## 2. Goals

1. Register the running automation as a governed spec with testable requirements and acceptance criteria.
2. Make the collision-safety, dirty-tree, and change-window guards explicit and verifiable.
3. Bound the unattended merge authority with canary-first controls and a secrets gate.
4. Define degraded mode, stop conditions, and reporting so every unattended night produces auditable evidence.

## 3. Non-goals

- Changing the `project-review` or `project-resync` skills (the automation consumes them as-is; Step 2d is a runner-side read-only diff, not a skill edit).
- The 03:00 governance-ticket batch's contract: ADR-0082's never-merge rule and four-gate validation are unchanged (ADR-0089 amends ADR-0082's schedule references only).
- Weekly-FULL-review and attended-resync cadence decisions — deferred to the user (meeting action item 4).
- `docs/reports/` index/retention, lifecycle record classes for new-project/upgrade events, and variant transition validation — follow-up ticket candidates, not automation-blocking (meeting items 5–6).
- Backport tooling changes to cover the six Domain Operating Model surfaces programmatically (Step 2d is the read-only detector; `backport-diff.ts` extension is future work).

## 4. Requirements (ASD-STE100, ADR-0079)

### 4.1 Guards (collision, dirty tree, change window)

- R1. Acquire the atomic lock `.pipeline-state/automation.lock` (gitignored) before any work.
- R2. Defer, never skip, while the lock is held. Poll until the runner's window ends.
- R3. Honor the same lock in both runners: the 01:30 fleet run and the 03:00 ticket batch.
- R4. Stop all automation work at the 04:45 KST hard wall clock.
- R5. Defer the 01:30 run when `git status --porcelain` intersects `scripts/`, `templates/`, `agents/`, `skills/`, `docs/`, `memory/`, or `tickets/`.
- R6. Continue with `--scoped-staging` when dirt touches no guarded path.
- R7. Derive the change window from the marker file `.pipeline-state/last-daily-review`.
- R8. Gate each project's Phase II work on HEAD movement inside the window.
- R9. Update the marker file only after a completed run.

### 4.2 Phase I — project-review

- R10. Run `bun scripts/review-baseline.ts --quiet` every day as the machine baseline.
- R11. Run the orphan sweep and the `skill-graph-fleet-report.ts` snapshot daily.
- R12. Scope the 4-slot parallel agent review to the change window.
- R13. Escalate to FULL mode on structural triggers per the project-review skill.
- R14. Run FULL mode every Friday regardless of the window. The user approved this override on 2026-09-25.
- R15. Write findings to `docs/reports/YYYY-MM-DD-project-review-daily.md`.
- R16. Give every finding a Class value: `one-time`, `systemic`, or `script-gap`.
- R17. File one validator-hardening ticket per `script-gap` finding. Cap new tickets at 10 per day. Defer overflow with `--not-before`.
- R18. Ticket only NEW orphan or skill-graph ids versus the previous snapshot. Use the `skill-graph:` prefix. Deduplicate.

### 4.3 Phase II — project-resync

- R19. Derive the project set with the glob `Projects/co-*`. Never hardcode the fleet count.
- R20. Run resync Steps 0–6 for each project whose HEAD moved in the window.
- R21. Register the standing spec, or file a documented E-exemption, before any template-touching root sync. Never bypass the sync-time spec-check (dev-sync step 3.9).
- R22. Run the read-only Step 2d "Domain Operating Model" diff per project. Compare project against `templates/co-<x>/` on exactly these paths:
  - `process/stages.yaml`
  - `governance/raci.yaml` (+ `actor_types`)
  - `governance/_human-roles.yaml`
  - `decisions/gates.yaml`
  - `evidence-models/`
  - `docs/graph-deltas/`
- R23. Emit Step 2d findings as `domain-model:` human-triage rows. Never auto-promote from these rows.
- R24. Write the string "DOM" in no artifact. ADR-0083's Terminology rule bans the acronym.

### 4.4 Unattended merge policy (amends ADR-0082 for the 01:30 runner only)

- R25. Keep the 03:00 ticket batch at never-merge. Merge nothing from the ticket batch.
- R26. Merge project PRs (resync Step 1) only when all checks are CLEAN.
- R27. Merge the root PR (Step 3) only when all checks are CLEAN.
- R28. Merge upgrade PRs (Step 5) canary-first. Merge one project first. Verify its audit and verify-scripts are clean. Then merge the remainder.
- R29. On any canary failure, leave the remaining upgrade PRs open. File one urgent ticket.

### 4.5 Secrets gate and safety invariants (non-negotiable)

- R30. Run `gitleaks detect --no-git --config .github/gitleaks-full.toml` before any push and before any promotion into `templates/`. The default `.gitleaks.toml` allowlists `Projects/` entirely (~line 48) and is blind to the fleet.
- R31. Hard-fail the run on any gitleaks finding.
- R32. Never pass `--no-verify`. Never bypass sync, audit, or spec gates. Never force-push.
- R33. Never hand-edit `tickets/governance/*.yaml` outside `ticket.ts`.
- R34. Bootstrap remotes as private-only.
- R35. Never discard PRESUME-STALE or KEEP provenance verdicts. Route them to commit-side review.
- R36. Keep durable snapshots under `.pipeline-state/resync-snapshots`. Never use `/tmp`. (The `resync-audit.ts` default `--snapshot-dir /tmp/resync-snapshots` is wiped on reboot while unattended runs discard STALE-RESIDUE — an irreversible deletion risk.)

### 4.6 Degraded mode

- R37. Enter audit-only Phase II when the Phase I baseline reports 3 or more ERRORs or any Critical. In audit-only mode: zero commits, zero pushes, zero merges.

### 4.7 Stop conditions

- R38. Stop at the 04:45 KST wall clock. File one summarizing ticket for halted work.
- R39. Halt Phase II when more than 2 projects fail. File one summarizing ticket for the fleet.

### 4.8 Reporting

- R40. Write one end-of-run memory block per day in `memory/YYYY-MM-DD.md`. Include all four mandatory headings enforced by `scripts/verify-memory.ts`: `## Session Summary`, `## Changes`, `## Decisions`, `## Open Issues`. One writer, one block, at end of run.
- R41. Keep the review report and the resync report in `docs/reports/`.
- R42. End the run with a zero-state table. State a reason for every open PR.

## 5. Acceptance criteria

- AC-1 (R1–R4, guards). With the lock held, a second runner defers and polls; it never skips and never double-runs. Both runner prompts reference `.pipeline-state/automation.lock`. Work stops at 04:45 KST with a summarizing ticket.
- AC-2 (R5–R6, dirty-tree guard). A dirty tree whose paths intersect a guarded directory defers the run. A dirty tree confined to other paths proceeds with `--scoped-staging`.
- AC-3 (R7–R9, change window). A project with no HEAD movement in the window is skipped; a moved project is processed; the marker file advances only on completion (idempotent across missed days).
- AC-4 (R10–R14, Phase I). Every run produces a baseline and a fleet-report snapshot. A Friday run reports FULL mode with an empty window. A run with a structural trigger escalates to FULL.
- AC-5 (R15–R18, Phase I reporting). The daily report file exists with a Class column; every row carries a value; `script-gap` rows have validator-hardening tickets; new-ticket count ≤ 10/day; repeat skill-graph ids produce no second ticket.
- AC-6 (R19–R24, Phase II). The project set is glob-derived (no literal count anywhere in the runner prompt); only moved projects resync; Step 2d output rows carry the `domain-model:` prefix and require human triage; no artifact contains the banned acronym; the six paths above are the Step 2d diff scope.
- AC-7 (R21, Design Gate). The root sync carries a registered spec or an E-exemption record; no bypass of dev-sync step 3.9 appears in any run log.
- AC-8 (R25–R29, merge policy). The 03:00 batch merges nothing. The 01:30 runner merges project/root PRs only with all checks CLEAN. Upgrade merges run one canary, verify audit + verify-scripts clean, then proceed; a canary failure leaves the remainder open plus one urgent ticket.
- AC-9 (R30–R31, secrets gate). The gitleaks-full command precedes every push and every promotion in the run transcript; any finding halts the run.
- AC-10 (R32–R36, safety). No `--no-verify`, no force-push, no gate bypass, no hand-edited ticket YAML, no `/tmp` snapshots in any run log; snapshots persist under `.pipeline-state/resync-snapshots`.
- AC-11 (R37, degraded mode). A baseline with ≥3 ERRORs or any Critical produces an audit-only Phase II: zero mutations of any kind.
- AC-12 (R38–R39, stop conditions). Wall-clock expiry and >2 failing projects each produce exactly one summarizing ticket, not one per item.
- AC-13 (R40–R42, reporting). The day's memory block passes `scripts/verify-memory.ts` (four headings present); `docs/reports/` holds both reports; the zero-state table closes the run with stated reasons for open PRs.

## 6. Alternatives considered

1. **Daily FULL review — rejected.** The project-review skill's Step 1.5 triage rule mandates the smallest mode that covers the blast radius; full-fleet 24 h windows are usually empty (unanimous slot dissent, preserved in the meeting transcript). Adopted instead: machine baseline daily + window-scoped 4-slot review + escalation on structural triggers + the user-approved Friday FULL override.
2. **Attended (twice-weekly) resync with a human merge session — deferred, not adopted.** It minimizes unattended mutation, but the user's explicit instruction keeps daily resync. Compensating controls: canary-first upgrades, degraded mode, secrets gate, hard wall clock.
3. **Open-PR-only merges (no unattended merges at all) — rejected.** It is the safest posture, but PRs would accumulate daily and stall the fleet. Adopted instead: canary-first upgrade merges with automated verification, full merges only for CLEAN project/root PRs, and ADR-0089 recording the accepted risk.

## 7. Verification plan

Commands validated against the live script arg parsers during the 2026-09-25 meeting (Slot B):

- `bun scripts/review-baseline.ts --quiet` — machine baseline (Phase I).
- `bun scripts/resync-audit.ts --snapshot-dir <durable-path>` — snapshot under `.pipeline-state/resync-snapshots` (never the `/tmp` default).
- `bun scripts/backport-diff.ts --project <p> --base <rev>` — **always pass `--base <pre-sync-rev>`**; the default base is `HEAD~1`, which is wrong for run-context diffs.
- `bun scripts/evidence-backport-scan.ts` — evidence backport candidates.
- `bun scripts/skill-graph-fleet-report.ts --json --snapshot-dir <dir>` — fleet snapshot (flags are exactly `--json` / `--snapshot-dir`).
- `bun scripts/upgrade-project.ts --dry-run` and `--prune-removed` — upgrade rehearsal and pruning.
- `gitleaks detect --no-git --config .github/gitleaks-full.toml` — allowlist-free secret scan over diff ranges and backport candidates.

Manual verification for this registration: `git status --porcelain` lists only the design doc, ADR-0089, the §9.8 edit, and `docs/specs/registry.json`; `bun scripts/spec-register.ts` reports the new spec id.

## 8. Accessibility exemption (ADR-0065)

Backend automation only — no UI; ADR-0065 accessibility baseline not applicable.

## 9. Preview-verification exemption (ADR-0070)

Exempt — non-UI change (ADR-0070). No rendered artifact is produced; verification is command-exit and artifact-presence based (§7).
