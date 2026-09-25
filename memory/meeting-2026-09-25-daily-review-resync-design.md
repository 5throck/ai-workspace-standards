# Meeting — Daily 01:30 Fleet Review + co-* Resync Automation Design

**Date**: 2026-09-25
**Facilitator**: PM (ZCode session)
**Type**: Design review (multi-agent) — proposal for user approval
**Agenda**: Review the proposed daily 01:30 KST automation — Phase I `project-review` (full mode, workspace L0 + templates/) and Phase II `project-resync` (Projects/co-*, plus per-project skill-graph and Domain Operating Model analysis) — and identify supplements and additions.
**Participants**: architect + scaffolding-expert (Slot A), automation-engineer (Slot B), auditor + lifecycle-manager + docs-writer (Slot C), skill-graph-analyst (Slot D), security-expert + designated dissent seat (Slot E). PM synthesized.

---

## 1. Per-slot contributions (round 1, parallel)

### Slot A — architect + scaffolding-expert
- Baseline-first matches project-review Step 0; `review-baseline.ts` is read-only with a verified JSON drift contract; resync skill already encodes the sequential branch rule.
- **Ticket runner time is wrong in the plan**: ADR-0082 + `docs/constitution/09-operations-workflow.md` §9.8 document the governance batch at 05:30 KST (the live automation was moved to 03:00 today by user request — docs are stale in the other direction). Re-baseline collision math on the live 03:00 schedule.
- **Fleet size drifts**: `Projects/co-*` counted 13 (agent read), 11 (PM's earlier `ls`), 12 (PM's close-of-meeting `ls`) within one hour — never hardcode the count; derive via glob.
- **Design Gate hole**: resync SKILL.md never mentions `spec-register.ts` / E1–E5. Template backports are code changes; the sync-time spec-check (dev-sync step 3.9, ADR-0074) is FATAL — an unattended run would hard-fail at Step 3 or be tempted to bypass. Fix: explicit spec-register step before the root sync.
- **Orphans already covered**: agent/skill lifecycle audits are baseline items 4–5; `skill-graph-fleet-report.ts` v1.1.0 rootOrphans 4-axis check is the weekly analyst's cadence. Do not duplicate; ticket only new findings.
- **Missing watch classes**: `docs/templates/common-contract.json`, `docs/workspace-schema.json`, `propagation-map.json`, new ADRs/designs/specs, platform twins (five mirrors incl. `.hermes` per ADR-0088), `docs/skill-graph.json`, `VERSION_MANIFEST.md`, `tickets/`.
- Per-class verification: propagate dry-run zero pending zones; new project → audit + `verify-scripts --verify` + `template-version.txt`; promotions → `PROMOTION_CHECKLIST.md` status (co-hr criteria 5–10 still Pending — flag, never approve); five-mirror parity.
- **DISSENT (preserved verbatim)**: "Daily full-mode review violates the skill's own Step 1.5 triage rule ('smallest mode that covers the blast radius') and its T-02 structural triggers. Run `baseline-only` daily and escalate to `scoped`/`full` only when the 24h diff hits T-02 conditions — cheaper, and consistent with ADR-0050's resolution that detection+cadence beats fixed scheduling."

### Slot B — automation-engineer
- All commands verified in arg parsers: `review-baseline.ts --quiet`, `resync-audit.ts --snapshot-dir`, `backport-diff.ts --project/--base`, `evidence-backport-scan.ts --project/--json`, `skill-graph-fleet-report.ts --json/--snapshot-dir`, `upgrade-project.ts --dry-run/--prune-removed/--yes/--rollback`, `propagate-to-templates.ts --check-drift`, ticket verbs. Drifts: fleet-report takes only `--json/--snapshot-dir`; **`backport-diff.ts` default base is `HEAD~1`** — always pass `--base <pre-sync-rev>`; `ticket.ts done` requires `--result`.
- **Dirty-tree guard will fire constantly** on a shared checkout (tree is dirty right now with an in-flight session). Fix: scoped guard — abort only when dirt intersects `scripts/ templates/ agents/ skills/ docs/ memory/ tickets/`; else log-and-continue with `--scoped-staging`.
- **Phase 1's own outputs dirty the tree** (memory/, docs/reports/, fleet-report snapshot). Fix: land Phase I artifacts via one scoped PR before Phase II; write the `memory/<today>.md` block once at end-of-run (single writer).
- **No lock exists.** Proposes atomic mkdir lock in a gitignored path + heartbeat + stale detection; second runner **defers, never skips** (poll until window end).
- Runtime estimate: Phase I ≈ 2 h (full), resync 3–5 h for the fleet (2026-09-12 report: a full session for 7 projects) → guaranteed overlap with the 03:00 batch without a lock and a hard cap.
- Marker file beats `--since`-only for the change window (survives missed days, idempotent): `.pipeline-state/last-daily-review`.
- Phase 2 on FAIL baseline / Critical: **audit-only degraded mode** (report + tickets, zero commits/pushes/merges). Per-fleet: >2 failing projects → halt with one summarizing ticket. Hard wall clock cap.
- **DISSENT (preserved verbatim)**: "Daily FULL review contradicts project-review's own selection rule ('smallest mode that covers the blast radius'; baseline-only exists for routine pulses). 24h-windows will usually be empty. Propose: daily = baseline + scoped review of the 24h window; FULL review and full-fleet resync weekly or event-triggered (≥N deployments/promotions). Otherwise you're paying 5h/night plus merge risk for a no-op majority of nights."

### Slot C — auditor + lifecycle-manager + docs-writer
- No scheduler artifact exists in the repo for such a run; recommend registering the automation spec in `docs/specs/registry.json` + an ADR amending the ops-cadence section (now doubly stale: docs say 05:30, live ticket batch is 03:00, new run is 01:30).
- `docs/lifecycle/` has only agents/, skills/, scripts/, templates/ — no record class for new-project or upgrade-run events; variant transition validation (`lifecycle.statusSince/lastTransition`) is a documented governance gap.
- Stale-record checks missing: nothing flags a lifecycle record whose subject file vanished; agent bodies may name skills that don't exist (Check 12 validates `owner:` only). Both are cheap daily additions.
- **Ticket flood**: nightly runner consumes manual tickets (board shows 175 done); daily auto-filed tickets need dedupe + a daily cap (≤10, defer via `--not-before`).
- `docs/reports/` has no index/retention policy — daily files will bloat; add index row + weekly rollup (follow-up).
- verify-memory.ts four-heading rule confirmed; resync report precedent: `YYYY-MM-DD-project-resync-<scope>.md`.
- **Nothing auto-writes lifecycle records** — zero `docs/lifecycle` references in sync/promote/propagate/dev-sync paths; the run must author lifecycle records for template promotions (lifecycle-manager role) as part of landing.
- **DISSENT (preserved verbatim)**: "Daily FULL 4-slot review is over-cadenced — every landing already passes audit.ts via dev-sync, and §9.1 mandates the same checks weekly. Run daily delta-only (last-24h events + orphans + snapshot triage); keep FULL mode on the Friday weekly run."

### Slot D — skill-graph-analyst
- `skill-graph-fleet-report.ts` v1.1.1 is read-only, snapshot-based, and already produces root+per-project graphs, presence matrix, `missingFromProjects` (delivery gaps), NEW/VANISHED diff, rootOrphans 4-way cross-check. Flags: `--json`, `--snapshot-dir` only. Designed weekly (analyst, PM-only dispatch) — daily snapshot is fine; **daily full triage duplicates the weekly role**.
- Daily recipe: run the snapshot, read `rootOrphans` + `missingFromProjects`, ticket only NEW isolated ids vs yesterday's snapshot; weekly analyst keeps variant-isolated triage, NEW/VANISHED explanation, trend interpretation.
- **DOM surfaces missing from backport tooling**: `backport-diff.ts` covers skills/scripts/helpers/context/agents only — not `process/stages.yaml`, `governance/raci.yaml` (+`actor_types`), `governance/_human-roles.yaml`, `decisions/gates.yaml`, `evidence-models/`, `docs/graph-deltas/`. Fix: new read-only Step 2d diffing project-vs-template on exactly those paths; ADR-0084 leaves the second `_human-roles.yaml` adopter explicitly open — that diff is the detector.
- Per-project gating: analyze only projects whose HEAD moved in the window (`git -C Projects/co-x log --since -1`).
- Ticket prefixes: `skill-graph:` exists (T-20260923-001/-002); propose `domain-model:`.
- **DISSENT (preserved verbatim)**: "The plan's proposed ticket prefix `dom-backport:` violates ADR-0083's normative naming rule (docs/adr/0083, Terminology block): 'Never write DOM… No acronym is permitted in any document, schema, script, or commit message.' More substantively, I challenge daily agent review of the graph: convergence (≥3 projects) and delivery gaps move at weekly granularity, and daily runs mostly re-emit yesterday's snapshot. Run the machine snapshot daily; keep agent triage weekly unless the daily diff is non-empty."

### Slot E — security-expert (+ designated dissent seat)
- Pre-push gitleaks hook exists on project repos (`scripts/hooks/pre-push.ts`, `core.hooksPath=.githooks`), and resync Safety Rules 1–7 + ADR-0031 Principle 5 are genuinely conservative.
- **Secret scanning is structurally blind to the fleet**: `.gitleaks.toml:48` allowlists `Projects/` entirely, and subdirectory gitleaks runs without `--config` fall back to upstream defaults. Fix: pre-push/pre-backport `gitleaks detect --no-git --config .github/gitleaks-full.toml` (allowlist-free; verified to exist) over each project's diff range and the backport candidate set; hard-fail on any finding.
- **Snapshots are volatile**: `resync-audit.ts` default `--snapshot-dir /tmp/resync-snapshots` is wiped on reboot while unattended runs discard STALE-RESIDUE immediately — irreversible engagement-content deletion risk. Fix: durable gitignored snapshot path, retain ≥30 days.
- **Unattended merge policy**: workspace precedent (ADR-0082, §9.8) is automation-opens-PR, human-merges; the plan introduces the first auto-merging automation. Recommendation: at minimum canary-first upgrade merges (one project → verify → rest); ideally degrade root/upgrade merges to open-PR. Requires an ADR (policy change).
- PRESUME-STALE / KEEP confirmed safe-by-source: never auto-discarded; route to commit-side review.
- Blast radius: a bad backport → 13 upgrade PRs auto-merged within 24 h, no human checkpoint between template merge and fleet-wide upgrade.
- **RED-TEAM DISSENT (preserved verbatim, excerpts)**: "(a) Daily FULL all-agent review is disproportionate. […] run `review-baseline.ts` daily and dispatch agents only when the trigger table is non-empty. (b) Against daily auto-merge of upgrade PRs: one erroneous Step-2 promotion propagates to all 13 projects in a day […] Require a one-canary upgrade merge + clean audit soak before the remaining PRs may merge — or hold upgrade merges weekly. (c) Split the schedules: 01:30 review daily; resync twice-weekly attended (merge session). The user's intent — nothing drifts unnoticed — is fully satisfied by daily detection + prompt remediation, without daily unattended mutation of 14 repos."

---

## 2. Synthesized outcome (PROPOSAL — not a decision; user approves via the automation design)

Adopted into the automation design (CronCreate, daily 01:30 KST, cron `30 1 * * *`):

1. **Scope triage per the skill** (A/B/C/E dissent, unanimous): daily run = machine baseline always + all-four-slot agent review scoped to the change window; auto-escalate to FULL on structural triggers (3+ agent files, workspace-schema/common-contract change, new variant, promotion events). All agents still participate every day there is anything to review — the 4-slot pairing IS the full roster per project-review Step 2/3.
2. **Collision safety** (B/E): atomic lock `.pipeline-state/automation.lock` (verified gitignored); defer-not-skip polling on both the new run and the existing 03:00 ticket batch (batch prompt updated); hard wall clock 04:45 KST; scoped dirty-tree guard (abort only on intersecting surfaces).
3. **Change window** (B): marker file `.pipeline-state/last-daily-review` + `git log --since`; per-project gating by HEAD movement; survives missed days.
4. **Design Gate** (A): spec-register (or documented E-exemption) before any template-touching root sync; if the standing spec is unregistered → file ticket, leave PR open, never bypass.
5. **Secrets gate** (E): `.github/gitleaks-full.toml` (allowlist-free) over diff ranges + backport candidates before any push/promotion; durable snapshots under `.pipeline-state/resync-snapshots` (never `/tmp`).
6. **Merge policy** (E, adopted compromise): project PRs merge when CLEAN (skill-mandated, lowest blast radius); root PR merges when CLEAN (sequential branch rule); **upgrade PRs canary-first** — one project, verify, then the rest; any non-CLEAN gate → PR stays open + ticket.
7. **Orphan/skill-graph** (A/D): baseline audits + fleet-report snapshot daily; ticket only NEW ids (`skill-graph:` prefix, deduped, ≤10/day); weekly analyst keeps full triage.
8. **Domain Operating Model** (D): new read-only Step 2d diffing the six DOM surfaces project-vs-template → `domain-model:` human-triage rows; never promote from the runner; the "DOM" acronym is banned (ADR-0083).
9. **Degraded mode** (B/E): baseline ≥3 ERROR or any Critical → Phase II audit-only (zero mutations).
10. **Reporting** (B/C): single end-of-run memory block (four headings), review + resync reports in `docs/reports/`, session log tee, final zero-state table (open PRs allowed with stated reason).

Rejected / deferred (recorded for the user):
- Weekly FULL sweep (A/B/C/E proposal) — deferred to user decision; current design escalates by trigger only.
- Twice-weekly attended resync (E-c) — deferred to user decision; daily resync kept per user's explicit instruction, with canary + degraded-mode controls.
- `docs/reports/` index/retention, lifecycle record classes for new-project/upgrade events, variant transition validation — follow-up tickets, not automation-blocking.

## 3. Action items

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Create the daily 01:30 automation with the adopted design | PM (this session) | Done via CronCreate |
| 2 | Add lock-honoring guard to the 03:00 ticket batch prompt | PM (this session) | Done via CronUpdate |
| 3 | Register automation spec: design doc + `spec-register.ts` + ADR amending ops cadence (ADR-0082/§9.8 now stale vs live schedules; auto-merge policy needs an ADR) | architect via PM Gateway | Open — user to trigger |
| 4 | Decide weekly-FULL review and attended-resync-cadence proposals | User | Open |
| 5 | `docs/reports/` index + retention policy | docs-writer via PM Gateway | Open (ticket candidate) |
| 6 | Lifecycle record classes for new-project/upgrade events; variant transition validation | lifecycle-manager via PM Gateway | Open (ticket candidate) |
| 7 | Fleet count drift (11→12 observed mid-meeting; templates/co-* = 13) — glob-derivation mandated in the automation | noted | Mitigated by design |

## 4. Governance invariants upheld

- Dissent seat: Slot E (security-expert) held it; dissents from A/B/C/D also preserved verbatim above.
- Proposal, not decision: §2 items 1 and the two deferred cadence questions go to the user; the automation implements only the user's explicit instruction + skill-mandated mechanics + safety supplements.
- Dissent preserved verbatim: yes — quoted, not summarized.
