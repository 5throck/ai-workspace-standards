---
status: Accepted
date: 2026-11-12
author: architect
lang: ko
lang_reason: proper-noun
---

# ADR-0105: The Unified 03:00 Batch Runner and Its CLEAN-Gated, Billing-Wall-Excepted Merge Authority

## Context

On 2026-11-12 the user directed an automation restructure (`memory/2026-11-12.md`): the
01:30 fleet review + resync runner (runCount 46) and the 04:00 governance-ticket runner
(runCount 57) were deleted and replaced by ONE unified local ZCode batch runner —
**automation-dfba3ff1** ("매일 오전 3시 통합 배치 — 티켓·리뷰·리싱크·업그레이드"),
cron `0 3 * * *`, first fire 2026-11-13 03:00 KST — with an explicit merge-authority
pipeline. ADR-0082's never-merge contract was superseded for this runner by the same
user directive; ADR-0089's two-runner cadence table now describes runners that no
longer exist, and §9.8 of the operations workflow still documents them.

The restructure also dropped enforcement rails the retired fleet runner had: the
ADR-0089 degraded mode, the 04:45 wall (replaced by a 13:00 wall with no per-step
budgets), and the per-boundary secrets gate. A same-day multi-agent review meeting
(`memory/meeting-2026-11-12-unified-batch-runner.md`; participants automation-engineer,
security-expert, architect, auditor with the designated dissent seat; two rounds,
PM-facilitated) hardened the granted authority before first fire. Its findings shaped
every term below:

- The billing wall is **ACTIVE** (onset 2026-11-03; 13 private repos fail CI with the
  account-level annotation; public repos succeed on the same runner pool —
  `T-20261110-008`, `DEC-20261110-03`). On night one the exception IS the gate:
  14–15 of the wave merges observed on 2026-11-08 (`memory/2026-11-08.md`) already
  merged under exception conditions with no authentication terms.
- ADR-0089's prose authority rotted within one restructure — it granted merge to "the
  01:30 runner only", and within weeks the prompt granted it to any CLEAN PR. Prose
  authority is not enforcement; the boundaries below are mechanical.
- The auditor's dissent position (needs-rework until an out-of-process watchdog and a
  launcher hash-manifest gate are mandatory, not options) was resolved by adopting
  both as mandatory — the watchdog lands with the first fire (T-20261112-002), the
  launcher-side prompt-integrity gate is an upstream request (T-20261112-003).

## Decision

1. **Unified cadence (all times KST)**: ONE local ZCode runner, daily 03:00
   (automation-dfba3ff1), executing the fixed pipeline order **A–J**: STEP A
   governance-ticket batch → STEP B root open-PR merges → STEP C root review+fix+PR
   +merge → STEP D fleet open-PR merges → STEP E sequential per-project reviews and
   upstream-ticket filing → STEP F fleet findings resolution → STEP G backporting →
   STEP H backport PR merge → STEP I upgrade waves (canary-first) → STEP J final CLEAN
   sweep. Per-step deadlines: A by 05:00; B–D by 06:30; E by 08:30 (hard 2-hour
   budget); F by 09:30; G–H by 10:30; I by 12:00; J by 12:45. The global wall clock is
   **13:00**, enforced out-of-process by the watchdog (below) — not self-judged.
   `fork-watch.yml` and `edu-sync.yml` (GitHub-hosted) are unaffected and keep the
   ADR-0089 schedule-change regime.
2. **Merge authority — supersedes ADR-0082's "the runner never merges" FOR THIS
   RUNNER ONLY.** ADR-0082's four validation gates, PR-only landing, ticket state
   machine, and `review → done` human-only rule carry over unchanged; the CLEAN
   discipline (never merge red) is kept and made stricter. The runner may merge a
   generic open PR only when the **merge predicate** passes:
   - **Checks**: the PR's status rollup contains at least one completed check and
     zero failures. An empty rollup is NOT CLEAN — "no checks appeared" never merges.
   - **Worktree integrity (mechanical)**: `assertWorkTreeHealthy` plus the
     repository-config snapshot (`scripts/lib/repo-integrity.ts`), taken BEFORE the
     compensation battery on any exception night; mid-rebase / wrong-branch /
     `core.bare` classes abort the sweep.
   - **Foreign-author ride detection**: PRs authored by non-allowlisted authors, or
     whose branch carries foreign/ridden commits (dependabot class), are excluded
     from unattended merges.
   - **Secrets gate on the merge pathspec**: the full-config gitleaks scan
     (`.github/gitleaks-full.toml`) runs before any merge, scoped to the exported
     changed-path contents — never the raw worktree. The default `.gitleaks.toml`
     (which allowlists `Projects/` entirely) is never a fallback.
   - **Protected paths — hold-for-human-merge**: a PR touching any path in
     `docs/protected-paths.json` (the machine-readable SSOT: `docs/adr/**`,
     `AGENTS.md`, `CONSTITUTION.md`, `docs/governance/**`, `memory/**`,
     `docs/fleet-membership.json`, `scripts/dev-sync.ts`, `scripts/audit.ts`, the
     automation prompts, `.github/workflows/**`, `.github/gitleaks*.toml`,
     `.githooks/**`, `scripts/hooks/**`, `CODEOWNERS`, project external-deps
     manifests) is NEVER merged by the runner. CLEAN discipline is kept on top of
     this — protected paths are a human-merge floor, not a substitute for gates.
     For the out-of-repo automation-prompt surface (preserved dissent S2),
     `prompts.manifest.json` is the integrity SSOT — the expected SHA256 of each
     authority-bearing automation prompt, checked daily at 06:00 KST by the
     prompt-integrity verifier (T-20261112-003, §Prompt-Integrity); any prompt
     change updates the manifest in the same governance change set.
3. **Billing-wall exception — nine authentication conditions.** While the
   account-level GitHub Actions billing wall makes real CI impossible, merges may
   proceed only when ALL nine hold:
   1. **Evidence class**: a startup_failure-class failure event recorded for the
      PR's head SHA (job annotation "recent account payments have failed or your
      spending limit needs to be increased", runner_id 0, zero steps). "No checks
      appeared" is not evidence.
   2. **Account-wide scope**: the wall is the diagnosed account-level Actions
      billing state (private repos fail, public repos succeed on the same hosted
      pool) — tracked in `T-20261110-008` / `DEC-20261110-03`, not re-diagnosed
      per PR.
   3. **Compensation battery**: what only CI provides (the 3-OS matrix, dependency
      audit, external-deps drift/verify) is executed locally — once per repo per
      night, BEFORE that repo's merge sweep, re-run only on battery-relevant paths
      (per-merge across a many-PR night would blow the B–D window).
   4. **Author allowlist**: only PRs from allowlisted authors (the user's own
      automation and the user) are eligible for exception merges.
   5. **Foreign-author ride detection**: a PR whose branch carries foreign or
      ridden commits is never merged under the exception.
   6. **Full-config secrets scan on the merge pathspec**: `.github/gitleaks-full.toml`
      over the exported changed-path contents before every exception merge.
   7. **Cap 16, wave-atomic**: at most 16 exception merges per night, and a
      canary-approved wave merges atomically — the cap never strands a half-merged
      wave (cap 3 was rejected on exactly this ground; the auditor's cap-3 position
      is preserved as partial dissent below for re-examination).
   8. **Manifest record**: every exception merge, with its gh-CLI evidence output,
      lands in the run manifest. Wall evidence comes from `gh` CLI output only —
      no credential or token is ever stored in prompt or prompt-adjacent files.
   9. **Event-based expiry (mechanical)**: the exception is not perpetually armed.
      It auto-expires on the first real green CI run; the gate script reads the
      tracked ticket's state (mechanical), and the wall's resolution is the
      user-only billing fix recorded in `T-20261110-008`.
4. **Degraded-mode kill-switch**: the stop-file `.pipeline-state/automation-stop`
   (JSON: reason, ISO timestamp, pid; written by `scripts/watchdog-automation-stop.ts`)
   is the single enforcement point for degraded mode. When present, the runner
   enters degraded mode — no further merges; in-flight atomic units finish. The
   watchdog writes it at the 13:00 wall (killing the run past deadline + 15 minutes
   and stamping the automation lock dead for `--break-stale` recovery, never
   mid-merge), and the runner writes it on the >2-gate-failures stop condition.
   This restores the ADR-0089 degraded-mode intent that the unified prompt dropped.
5. **First-fire precondition**: the governance PR carrying this ADR, the §9.8
   rewrite, `docs/protected-paths.json`, and the registered design doc must be
   merged by **02:00 KST 2026-11-13**. If not merged, the runner aborts no-op and
   re-arms its skip guard — unratified authority does not run.
6. **Self-authority limits (mechanical)**: STEP E is review-and-file only — it never
   claims or processes any ticket, including its own; all fix work belongs to STEP F
   under the nightly cap. `U-` upstream tickets are out of scope (they belong to hub
   triage). Upstream filing requires the dedup pre-check (open `U-` tickets plus
   LOCAL-PATCH markers). The protected-paths floor means the runner can never merge
   changes to its own authority, gates, or this ADR.
7. **Amendments**:
   - **Supersedes ADR-0082** cadence references and its never-merge rule **for this
     runner only**; ADR-0082's safety rules (four gates, PR-only landing, ticket
     state machine, deferral while a manual dispatch runs) carry over unchanged.
   - **Amends ADR-0089**: Decision 1's two-runner cadence table and the 01:30/04:00
     schedules are superseded by the unified runner; Decision 2's unattended merge
     policy (CLEAN-only, canary-first upgrades) is carried forward INTO this ADR's
     stricter predicate rather than left attached to the retired runner; Decision 3's
     schedule-change rule (ADR + §9.8 + prompts move together) stays in force and its
     scope now names this ADR's surfaces — `docs/protected-paths.json` and the
     registered design doc join the same-change-set requirement.
8. **Mechanics bound by artifacts, not prose** (design doc
   `docs/designs/2026-11-12-unified-batch-runner-design.md`, spec-registered): the
   run manifest (`.pipeline-state/run-manifest-<date>.json`, written at STEP 0 with
   pre-run SHAs before any merge) records pre/post HEAD per repo, merged PR SHAs,
   the sanctioned-repair log, and billing-wall evidence; the checked-in expected-
   failure list `docs/expected-gate-failures.json` defines "sanctioned repair" —
   routine repairs against that list are logged, not escalated, and every sanctioned
   repair still passes the secrets gate; more than 2 gate failures outside the list
   trips the stop-file. A revert runbook (reverse-order revert, CLEAN-gated, executed
   by the next night's STEP 0 or a human) covers any merged night, and one revert
   drill is required before first fire — an untested runbook is documentation, not a
   control.

## Preserved dissent (verbatim, meeting transcript)

> **S2 (residual, ISSUE 2):** "in-repo self-amendment vector closed by mechanical
> protected paths + never-claim; out-of-repo prompt self-edit vector remains open —
> launcher hash-manifest gate is a required addition, not an option." … "automation
> prompts are not git-tracked, so the diff gate cannot cover them; their protection
> stays procedural … A cross-run authority escalation invisible to every in-repo gate."

> **S5 (ISSUE 4, partial):** "every rail is enforced by the thing it guards (P1)" —
> "The runner verifies CLEAN and executes merges in that same mutable worktree; the
> 13:00 wall, the '>2 failing projects' stop, and 'unexpected gate failure'
> classification are all self-judged by the agent — a hung `bun install` blows the
> wall because nothing outside the agent enforces it."

> **Cap 16 vs cap 3 (ISSUE 1, partial):** the auditor's cap-3 was not withdrawn — it
> was superseded by security-expert's wave-atomicity rebuttal (cap 3 strands a
> canary-approved wave half-merged). Recorded as partial dissent pending
> re-examination at the next review cycle. The 9 authentication conditions address
> the auditor's underlying concern (unauthenticated merge-anyway); the cap number
> remains contested.

The S5 and cap concerns convert to conditional-adopted with implementation pending:
the watchdog stop-file is mandatory and lands before first fire (T-20261112-002);
the launcher hash-manifest gate is T-20261112-003; cap 16 vs cap 3 re-examines after
one week of observed runs.

## Governance

- The merge predicate and the nine billing-wall conditions are decision-of-record
  here; the runner prompt cites them by reference, it does not restate them as
  convention.
- `docs/protected-paths.json` is the machine-readable SSOT for the protected-path
  floor (same pattern as `docs/fleet-membership.json`); changes to it are themselves
  protected (human merge only).
- Sanctioned repairs are list-backed (`docs/expected-gate-failures.json`); the list
  is versioned in git and grows only through the PR path.
- The watchdog (`scripts/watchdog-automation-stop.ts` + the host 13:00 cron entry)
  is operator-managed; its crontab entry is host state, recorded in the drill/report
  evidence, not in the repo.

## Consequences

- Positive: the workspace's most powerful automation (generic unattended merges
  across root and a 16-project fleet) operates under an authenticated, mechanically
  bounded, externally enforced authority instead of prompt prose; the billing wall —
  currently the DOMINANT merge path — gains authentication terms before first fire
  rather than after an incident.
- Cost: nightly throughput is capped and windowed (per-step deadlines; wall 13:00);
  exception nights carry a real local compensation battery; one governance artifact
  set (this ADR, §9.8, the SSOT JSON, the design doc) must be maintained in the same
  change set as any future schedule or authority change; three follow-up items remain
  open (T-20261112-003 launcher gate; cap re-examination; `gh` never-started
  predicate one-liner to be published as a DEC annotation riding this PR).
- Neutral: the 03:00 governance-ticket batch's ADR-0082 contract (gates, state
  machine, human-only `review → done`) is unchanged — only the merge prohibition
  moves, and only for this runner.

## Accessibility Impact

No accessibility impact — governance/automation cadence and merge-policy change with
no UI (ADR-0065/0070 posture; runner and watchdog output remains plain text).

## References

- Meeting transcript: `memory/meeting-2026-11-12-unified-batch-runner.md` (issue
  list, round-2 converged outcomes, preserved dissent, action items)
- Restructure record: `memory/2026-11-12.md` (automation-dfba3ff1 creation; deletions
  automation-a440106a, automation-3c442369)
- Supersedes (merge prohibition, this runner only): ADR-0082
  `docs/adr/0082-local-only-governance-ticket-processing.md`
- Amends: ADR-0089 `docs/adr/0089-local-automation-cadence-and-unattended-merge-policy.md`
- Billing wall: `tickets/governance/T-20261110-008.yaml`, `docs/decisions/DEC-20261110-03.md`,
  `docs/reports/2026-11-08-project-resync-daily.md`
- Protected-path SSOT: `docs/protected-paths.json`; expected-failure list:
  `docs/expected-gate-failures.json`
- Design doc (spec `2026-11-12-unified-batch-runner`): `docs/designs/2026-11-12-unified-batch-runner-design.md`
- Watchdog: `scripts/watchdog-automation-stop.ts` (T-20261112-002); launcher
  prompt-integrity gate: T-20261112-003
- Workflow rewrite: `docs/constitution/09-operations-workflow.md` §9.8
