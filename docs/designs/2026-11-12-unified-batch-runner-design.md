# Design: Unified 03:00 Batch Runner — Governance Registration (Design Gate)

- **Spec id**: `2026-11-12-unified-batch-runner-design` (registry status: implemented)
- **Date**: 2026-11-12
- **Status**: implemented (registered 2026-11-12, user directive)
- **Author**: architect dispatch (meeting synthesis), docs-writer/automation-engineer dispatch (artifact landing)
- **Source**: user-approved ZCode automation (CronCreate, daily 03:00 KST, cron `0 3 * * *`, automation-dfba3ff1, first fire 2026-11-13); multi-agent hardening meeting 2026-11-12 (`memory/meeting-2026-11-12-unified-batch-runner.md`)
- **Related**: ADR-0105 (superseding decision — the authority record this spec pins), ADR-0082 (ticket-batch contract, carry-over unchanged), ADR-0089 (amended: cadence + schedule-change scope), ADR-0065 (accessibility exemption, §8), ADR-0074 (Design Gate), T-20261112-001 / T-20261112-002 / T-20261112-003

---

## 1. Background

The 2026-11-12 restructure (`memory/2026-11-12.md`) replaced the retired 01:30 fleet
runner (automation-a440106a) and 04:00 governance-ticket runner (automation-3c442369)
with one unified local ZCode batch runner at 03:00 KST (automation-dfba3ff1) holding
generic open-PR merge authority over the workspace root and the project fleet. The
same-day multi-agent review (two rounds, dissent seat active) hardened the authority
before first fire: merge-predicate authentication, billing-wall exception terms,
protected paths, an out-of-process watchdog, a run manifest, a revert runbook, and a
checked-in sanctioned-repairs list. ADR-0105 is the decision of record; this design
carries the testable requirements and acceptance criteria (the deadline table is an
AC row, not prose — the R48 lesson: a prose budget was silently dropped in a
restructure).

## 2. Goals

1. Pin the unified pipeline (steps A–J), its per-step deadlines, and the 13:00 wall as testable acceptance criteria.
2. Define the merge predicate and the nine-condition billing-wall exception so the runner prompt can cite them by reference.
3. Require the STEP-0 run manifest and a drilled revert runbook so every merged night is reversible.
4. Make sanctioned repairs list-backed and unexpected gate failures stop-backed.

## 3. Non-goals

- Changing the `project-review` / `project-resync` / backport skills (the runner consumes them as-is; STEP G copies live step numbering from the skill file at run time).
- The ADR-0082 ticket-batch contract (four gates, state machine, human-only `review → done`) — carried over unchanged inside STEP A.
- The launcher-side prompt hash-manifest gate (T-20261112-003, automation-host support).
- New manifest tooling (`scripts/run-manifest.ts`) — wave 1 is a prompt-executable convention writing `.pipeline-state/run-manifest-<date>.json`; a script-gap ticket is filed only if prompt execution proves insufficient.

## 4. Requirements

### 4.1 Pipeline and cadence

- R1. Run the fixed order: STEP A governance-ticket batch → STEP B root open-PR merges → STEP C root review+fix+PR+merge → STEP D fleet open-PR merges → STEP E sequential per-project reviews + upstream-ticket filing → STEP F fleet findings resolution → STEP G backporting → STEP H backport PR merge → STEP I upgrade waves (canary-first) → STEP J final CLEAN sweep.
- R2. STEP E is review-and-file only. Never claim or process any ticket, including one STEP E filed itself. All fix work belongs to STEP F under the nightly cap. `U-` upstream tickets are out of scope. Upstream filing requires the dedup pre-check (open `U-` tickets + LOCAL-PATCH markers).
- R3. STEP G runs skill steps by the live numbering copied from the skill file at run time (live v1.8.0 = 2d ledger / 2e learning / 2f per-project review; never stale design-doc letters). Upgrade-deliverable findings route to post-STEP-I disposition via the 2d loop-closing report.
- R4. Acquire `.pipeline-state/automation.lock` (defer-not-skip) and honor the stop-file (§4.5).

### 4.2 Deadline table (normative — AC-2)

| Step | Scope | Deadline (KST) |
|---|---|---|
| A | Governance-ticket batch | 05:00 |
| B–D | Root open-PR merges; root review+fix+PR+merge; fleet open-PR merges | 06:30 |
| E | Per-project reviews + upstream filing (hard 2 h budget) | 08:30 |
| F | Fleet findings resolution | 09:30 |
| G–H | Backporting; backport PR merge | 10:30 |
| I | Upgrade waves (canary-first, per-project PR merges) | 12:00 |
| J | Final CLEAN sweep | 12:45 |
| wall | Global wall clock, watchdog-enforced | 13:00 |

- R5. A step that reaches its deadline stops cleanly at its boundary, writes a SKIPPED-BUDGET row to the run manifest, and lets the next step start on time.
- R6. SKIPPED-BUDGET carryover: budget-skipped work carries to the next night's run; it is never silently dropped (the manifest row names what carried).
- R7. STEP-I-first carryover: carried-over upgrade waves are scheduled first in the next run's merge budget, before fresh STEP B/D merge categories — an interrupted canary wave is the most dangerous half-done state (the wave-atomicity ground).
- R8. The nightly merge cap binds merges. Canary-approved-wave completion is the carve-out: an in-progress canary-approved wave finishes even at the cap.

### 4.3 Merge predicate (cites ADR-0105 Decision 2)

- R9. Merge a generic open PR only when ALL hold: ≥1 completed check AND zero failures in the status rollup (empty rollup = NOT CLEAN); the mechanical worktree check passes (`assertWorkTreeHealthy` + repo-config snapshot, taken BEFORE any compensation battery); no foreign-author rides (allowlisted authors only, no foreign/ridden commits on the branch); the full-config gitleaks scan on the exported changed-path contents (never the raw worktree; the default config never a fallback) is clean.
- R10. Never merge a PR touching any `docs/protected-paths.json` path — hold-for-human-merge, regardless of CLEAN.

### 4.4 Billing-wall exception (cites ADR-0105 Decision 3 — all nine conditions required)

startup_failure-class failure event attributed to the head SHA; account-wide wall state tracked in T-20261110-008; compensation battery once per repo per night before that repo's merge sweep; author allowlist; foreign-author ride detection; full-config secrets scan on the merge pathspec; cap 16 wave-atomic; manifest record of every exception merge with gh-CLI evidence (credentials never stored in prompt files); event-based mechanical expiry (auto-expiry on the first real green CI run, gate reads the tracked ticket's state).

### 4.5 Watchdog and stop conditions

- R11. One stop-file `.pipeline-state/automation-stop` (JSON: reason, ISO timestamp, pid) is the single enforcement point for the 13:00 wall, the >2-gate-failures stop, and degraded mode. The watchdog (host cron 13:00 + `scripts/watchdog-automation-stop.ts`) writes it out-of-process; the runner writes it on its own stop conditions. The watchdog never kills mid-merge; past deadline + 15 minutes it stamps the lock dead for `--break-stale` recovery.
- R12. Gate failures outside the checked-in `docs/expected-gate-failures.json` are unexpected: the second one trips the stop-file. Repairs against the list are sanctioned — logged to the run manifest, never escalated — and the repaired files still pass the secrets gate. Routine dev-sync step 3.88 repairs are expected-list entries, not "unexpected gate failures".

### 4.6 Run manifest and revert (AC-4/AC-5)

- R13. At STEP 0, before any merge, write `.pipeline-state/run-manifest-<date>.json` with the pre-run HEAD per repo. Fields: `preRunHead` and `postRunHead` per repo, `mergedPRs[]` (repo, PR number, merge SHA), `sanctionedRepairs[]` (gate failure id, repair action, files touched), `billingWallEvidence[]` (head SHA, gh CLI output reference, condition checklist), `skippedBudget[]` (step, reason, carryover flag).
- R14. Revert runbook: revert merged PRs in reverse merge order (newest → oldest), one `git revert -m 1 <merge-sha>` per PR (or per-project branch revert for fleet waves), verifying each revert lands before the next; never force-push; the revert batch itself lands CLEAN-gated through the normal PR path — executed by the next night's STEP 0 (highest priority) or by a human. One revert drill is required before first fire.

### 4.7 Docs-manifest registration (this design's own landing)

- R15. Register `docs/protected-paths.json` in the docs/ folder manifest as the three-leg contract pattern proven by the `fleet-membership.json` registration (DEC-20261107-01): the `scripts/validate-doc-folder.ts` v1.4.0 root-file allowlist gain (L0+L1 mirror byte-identical), the `docs/README.md` §2 root-level loose-files row, and the decision reference (ADR-0105).

## 5. Acceptance criteria

- AC-1 (R1–R4, pipeline). A run executes steps A–J in order; a run log shows each step's start/end; STEP E files no processed ticket; the STEP G step letters match the live skill file, not a design doc.
- AC-2 (R5–R8, deadlines). The deadline table above is satisfied: each step ends by its deadline; a deadline breach produces a SKIPPED-BUDGET manifest row naming the carried work; carried upgrade waves run first in the next night's merge budget; a canary-approved wave completes past the cap as one unit.
- AC-3 (R9–R10, merge predicate). No merge in the manifest lacks: a completed-check rollup (never empty), a worktree check, an authorship verdict, and a clean full-config secrets scan on the merge pathspec. No merged PR touches a protected path.
- AC-4 (R13, manifest). Every run leaves `run-manifest-<date>.json` with pre/post HEAD per repo, merged PR SHAs, the sanctioned-repair log, billing-wall evidence, and SKIPPED-BUDGET rows; the pre-run HEAD is written before the first merge.
- AC-5 (R14, revert). The reverse-order revert runbook is drilled in a scratch repo before first fire; the drill restores the pre-run tree exactly and the evidence report lands in `docs/reports/`. A real revert executes newest→oldest, CLEAN-gated, no force-push.
- AC-6 (R11–R12, watchdog + sanctioned repairs). The watchdog stop-file exists after the 13:00 wall on a running night (watchdog never kills mid-merge; +15 min past deadline the lock is stamped dead); two unexpected gate failures trip it; every sanctioned repair appears in the manifest and its touched files pass the secrets gate.
- AC-7 (billing wall). Every exception merge in the manifest carries all nine conditions' evidence; the exception auto-expires on the first real green CI run.
- AC-8 (R15, docs-manifest registration). `validate-doc-folder.ts` v1.4.0 (root == L1 mirror) allowlists `protected-paths.json`; the `docs/README.md` §2 row names it with the ADR-0105 reference; the audit's docs-manifest gate passes with the file present at the docs/ root.

## 6. Verification plan

- First night observation: run report + manifest + watchdog state reviewed in the next morning's memory block (AC-1/AC-2/AC-4/AC-6 evidence).
- Revert drill: scratch repo, three sequential merge commits, manifest, reverse-order revert, tree-equality check — evidence in `docs/reports/2026-11-12-revert-drill.md` (AC-5).
- Watchdog drill: invoke the script with a test reason into a redirected state dir; confirm idempotent merge-safe write (AC-6), unit-pinned in `tests/unit/watchdog-automation-stop.test.ts`.
- Exception-night audit: compare the manifest's exception merges against the nine conditions (AC-3/AC-7); cap re-examination after one week of observed runs (ADR-0105 preserved dissent).

## 7. Alternatives considered

1. **Keep the two-runner split — rejected.** The user directive merged them; the review hardened rather than reverted.
2. **Cap 3 exception merges — rejected this cycle.** Strands a canary-approved wave half-merged; strictly worse than all-open or all-merged. Cap 16 wave-atomic adopted; auditor's cap-3 preserved as partial dissent for re-examination.
3. **Prompt-prose enforcement of boundaries — rejected.** ADR-0089's prose authority rotted within one restructure; boundaries are mechanical (protected-paths.json, watchdog stop-file, list-backed sanctions, manifest).
4. **`scripts/run-manifest.ts` tooling this wave — deferred.** Prompt-executable convention first; script-gap ticket only on evidence of insufficiency.

## 8. Accessibility Impact

Accessibility-exempt per ADR-0065: governance/automation registration with no user-interface surface; all runner, watchdog, and manifest output is plain text.

## 9. Addendum: Prompt-Integrity Manifest (T-20261112-003, 2026-11-12)

Auditor preserved-dissent S2 (out-of-repo prompt self-edit vector, closed "detection-based" this wave): automation prompts are not git-tracked, so the diff gates cannot see a cross-run authority escalation on them. The detection layer is `prompts.manifest.json` (repo root, protected path) — it carries the expected SHA256 of each authority-bearing automation prompt, and a companion prompt-integrity verifier automation (daily 06:00 KST) hashes the live automation prompts byte-exact (temp file + `shasum -a 256`, never eyeballed) and compares against the manifest: any mismatch or missing automation/entry files one urgent ticket and stops; an all-match run appends one `prompt integrity verify: N/N match` line to the day's memory log. The pre-fire launcher-side hash gate remains a platform ask (automation-host support, tracked on T-20261112-003's upstream thread). **Invariant**: any change to an automation prompt MUST update `prompts.manifest.json` in the same governance change set; the verifier automation's own id joins the manifest at its creation time, and the verifier treats its own prompt's drift as the highest-priority alert.
