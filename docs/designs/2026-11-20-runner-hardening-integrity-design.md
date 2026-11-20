# Design: Runner Hardening + Integrity Cluster (STEP I gate, ledger invariant, prompt-integrity verifier, records integrity, union-verify noise, protected-path policy)

- **Spec id**: `2026-11-20-runner-hardening-integrity-design`
- **Date**: 2026-11-20
- **Status**: implemented (owner-approved via the standing delegation of defaults, meeting 2026-11-20; PR-1 landed #2119, PR-2 this change set, remaining rows per §10 sequence)
- **Author**: architect dispatch (PM Row 0, RUNNER HARDENING + INTEGRITY cluster)
- **Source**: tickets T-20261119-010, T-20261120-001, T-20261120-002, T-20261120-004, U-20261120-001, T-20261119-006; meeting 2026-11-20 (`memory/meeting-2026-11-20-batch-runner-hardening.md`, agreements A–D)
- **Related**: ADR-0105, design `2026-11-12-unified-batch-runner-design`, `prompts.manifest.json`, `docs/protected-paths.json`, T-20261112-003 (false closure), T-20261116-002 (commit-msg defect), T-20261120-003 (upgrade walk fix, v1.114.0)
- **Cut**: origin/main `03b7cc640` (PR #2118). All file:line citations are at that revision.

---

## 1. Background

Six tickets share one subject: the unified 03:00 batch runner (`automation-dfba3ff1`) and
the records it depends on. The 2026-11-20 hardening meeting landed v4 machinery (ledger,
falsifiable gates, containment, post-delivery verification — PR #2117) but left five
integrity edges open: the STEP I gate's design amendment, the ADR-0105 ledger amendment,
the absent prompt-integrity verifier (T-20261112-003 is a false closure — live drift exists
today), a records-integrity phantom citation, recurring union-verify stderr noise, and an
unruled protected-path policy that already discarded a real defect fix (commit-msg,
T-20261116-002) from three fleet projects.

## 2. Verified state (evidence base)

| # | Fact | Evidence |
|---|------|----------|
| V1 | The runner is prompt-executed; gates live in prompt text + ledger + state files, not in one code path | `docs/designs/2026-11-12-unified-batch-runner-design.md` §6; v4 prompt snapshot |
| V2 | Live prompt hash `c91eeb1cad1e9ce1603d4f7c4429646aa91843bbfd15b1c72fdedbe8c586d37c` (22,153 bytes) ≠ ratified manifest hash `e50d661f80ee76b23cec10bda215bff7d6567b6c2b778fa79e81e88914517192` (snapshot, 21,872 bytes) — 5 divergent hunks; live text is AHEAD (gitleaks `--redact` + deletion-arm, ledger repair rows, freshness in STEP I header, phantom meeting-2026-11-12 citation dropped) | live: `~/.zcode/v2/tasks-index.sqlite` table `automations`, row `automation-dfba3ff1-a1df-42e3-b358-7c641f974648`, column `prompt`; ratified: `prompts.manifest.json` + `.pipeline-state/logs/runner-prompt-v4-snapshot.txt` |
| V3 | The `sqlite3` CLI read path is not byte-faithful: SQL `length(prompt)` reports 21,967 CHARACTERS (multibyte UTF-8) while the byte-exact size is 22,153 bytes, and the CLI-piped sha256 (`f2e275b9…`) differs from the `bun:sqlite` hash (`c91eeb1c…`) — the verifier MUST read via `bun:sqlite`, never a CLI pipe | measured 2026-11-20 (design author) |
| V4 | No verifier script exists; T-20261112-003 is `status: done` with result claiming the manifest landed | `scripts/` has no `verify-prompt-integrity.ts`; `tickets/governance/T-20261112-003.yaml` history `review → done` 2026-11-13 |
| V5 | `memory/meeting-2026-11-12-unified-batch-runner.md` NEVER existed in git (`git log --all` on the path is empty); ADR-0105 References, the 11-12 design doc, the v4 snapshot line 5, `docs/reports/2026-11-12-revert-drill.md`, and T-20261112-001 all cite it | git history; `git grep meeting-2026-11-12-unified-batch-runner origin/main` → 7 files |
| V6 | `memory/meeting-2026-11-20-batch-runner-hardening.md` EXISTS at origin/main (PR #2117) — the v4 authority record is intact | `git show origin/main:memory/meeting-2026-11-20-batch-runner-hardening.md` |
| V7 | ADR-0105 also cites `memory/2026-11-12.md` (absent from the live tree) — but the file was ARCHIVED by the 7-day retention cycle (deleted in f14e522bb, retrievable at `f14e522bb^:memory/2026-11-12.md`; validate-decisions v1.2.0 resolves `memory/*.md` refs through the local `memory/archive/`), so this citation RESOLVES and is out of scope | `git show f14e522bb` (1345-line deletion); `scripts/validate-decisions.ts` v1.2.0 `knowledgeRefArchived` |
| V8 | 2026-11-19 wave: STEP E battery-only; STEP I delivered 14 projects; `.githooks/commit-msg` + `.github/workflows/ci.yml` updates reached fleet PRs; co-abap/co-consult/co-develop PRs were discarded by the runner per the protected-paths HOLD; 11 of 15 merges were billing-wall exception | `.pipeline-state/logs/unified-2026-11-19.log` |
| V9 | The commit-msg defect was REAL and template-side fixed (first body paragraph dropped by `sed '1,/^$/d'`; fixed in PR #2065, commit 4c7e586f6) — fleet delivery is the only way projects get it | `tickets/governance/T-20261116-002.yaml` (result) |
| V10 | Engine vs runner contradiction: `scripts/lib/upgrade-policy.ts:640,756` classifies `.githooks/**` as LOCKED whose pass DELIVERS (always overwrite — `scripts/upgrade-project.ts:4647-4680`), while `docs/protected-paths.json` `protectedPaths[]` lists `.githooks/**` and `.github/workflows/**`, and the runner's merge predicate 6 holds ANY merge touching them — so the sanctioned parity channel is blocked at merge time in an inconsistent per-repo way | cited files |
| V11 | `scripts/helpers/memory-union-verify.ts` `git()` wrapper (L467-476) warns `git show failed (exit 128) — sweep results may be incomplete` on EVERY non-zero exit without naming the ref; `showBlob` (L532-536) documents exit 128 as the ABSENT-path no-data signal; each merge-touched file triggers up to 3 absent-side reads per sweep (`unionScan` L561-661, `owedBlocks` L362-383) → 20+ WARN rows per 14-day scan in Projects/co-security | cited file |
| V12 | Ledger schema (run-manifest.ts L30-37): required arrays `mergedPRs, sanctionedRepairs, billingWallEvidence, skippedBudget, steps, projectReviews`; `review` (L201-218) writes `{project, tier: baseline-only\|scoped\|full, outcome, basis, at}`; `verify [--require-merged]` (L221-242) exits 2 on schema failure, 3 on zero merges | `scripts/run-manifest.ts` |
| V13 | `scripts/stop-gate.ts` (v1.0.0, landed) scopes by run-start and moves stale events to `automation-stop.history.jsonl`; the WATCHDOG (`scripts/watchdog-automation-stop.ts`) still appends an unconditional event on every invocation (MAX_EVENTS cap 50 in the stop file, but the history jsonl grows one heartbeat row per day, and the stop file is present at 03:00 every day — the 2026-11-20 run log is a 239-byte copied stop file) | cited files; `.pipeline-state/logs/unified-20261120.log` |
| V14 | The watchdog is launchd, not cron: `~/Library/LaunchAgents/ai.workspace.watchdog-automation-stop.plist` (ADR-0105 says "host cron" — host state either way) | host state, listed 2026-11-20 |
| V15 | T-20261119-005/-009 root fixes landed (PR #2110) — the STEP I gate's clean-baseline precondition is satisfied | `52caf5db8`; dispatch amended acceptance |

## 3. Per-ticket design

### 3.1 T-20261119-010 — STEP I review gate (mechanism + machine-checkable "full scope")

**Gap.** The ticket's option-2 wording ("STEP I proceeds only when STEP E ran at FULL
scope this run") conflicts with the LATER owner-clarified freshness semantics adopted at
meeting 2026-11-20 (v4 snapshot STEP I (0): "a same-run STEP E pass is preferred but is
NOT required… a project whose STEP E pass was budget-skipped does not automatically block
its upgrade"; rationale recorded in the transcript Issue D: STEP E is the only step with a
hard 2 h budget — same-run coupling permanently starves STEP I). The design doc / ADR-0105
carry no AC row for the gate at all, and no gate in the pipeline has ever been observed
firing (auditor, Issue B).

**Ruling (DEC-20261120-03).** Freshness semantics govern — they post-date option 2, carry
an owner directive, and fix the starvation arithmetic. The ticket's intent is PRESERVED,
not dropped: a battery-only STEP E produces no fresh review rows, so every wave project
lacks a fresh pass and the waves defer to the next night (carried-wave-first per R7) —
exactly option 2's degradation outcome, reached per-project instead of per-run, without
the starvation coupling. "STEP E ran at full scope" becomes machine-checkable as: **for
every project entering the wave, the ledger holds a review row with `outcome: pass` whose
basis HEAD is fresh** (same HEAD, or row timestamped within the last 2 nights with no
unresolved Critical/High finding since), and the run's review-tier digest (counts of
baseline-only / scoped / full rows) is stated in the report.

**Change spec.**
1. `scripts/run-manifest.ts` v1.1.0 — new subcommand `gate-step-i`:
   `bun scripts/run-manifest.ts gate-step-i --project <p> --basis <head> [--window-days 2] ...`
   (repeatable pairs, one per wave project). Verdict per project from `projectReviews[]`:
   fail if no row / latest row `outcome != pass` / basis mismatch AND row older than
   window. Writes one row per project into a new required array `gateChecks[]`
   `{gate: "STEP_I_PRE_REVIEW", project, verdict: pass|fail, detail}` BEFORE any dry-run —
   implementing the meeting rule "a gate that does not fire must still write a row".
   Exit 1 if any project fails (runner then SKIPs those projects with
   `run-manifest.ts skip --step STEP_I`, per the existing prompt text). Add
   `gateChecks` to `REQUIRED_ARRAYS` and the `verify` summary line. Reuse only existing
   commands; no hand-editing path is added.
2. ADR-0105 amendment (human merge, protected) — Decision 2 gains the amended gate
   sentence: STEP I admission requires a fresh ledger review pass per project (freshness
   definition above); same-run STEP E coupling is expressly NOT required (supersedes the
   2026-11-18 option-2 phrasing, which remains on record in the ticket).
3. Design doc amendment — `2026-11-12-unified-batch-runner-design.md` gains AC-14
   (see §5 here): the gate is machine-checkable via `gateChecks[]`, and a battery-only
   STEP E night yields zero fresh rows → waves defer with `skippedBudget` rows naming the
   carryover.
4. Prompt v5 (one line, rides the same governance change set): replace the STEP I (0)
   first sentence with "admission is decided by `run-manifest.ts gate-step-i` per project
   (fresh review pass: same HEAD, or ≤2 nights old with no unresolved Critical/High
   since); exit 1 → SKIP those projects tonight".
5. Canary requirement unchanged (co-abap full gate cycle stays the first wave unit).

**Tests.** `tests/unit/run-manifest-gate-step-i.test.ts`: (a) fresh same-HEAD pass →
verdict pass + gateChecks row; (b) 2-night-old pass + same HEAD → pass; (c) basis
mismatch + 3-night-old row → fail; (d) outcome fail → fail; (e) missing row → fail;
(f) `gateChecks[]` schema-verified present; (g) zero projects → exit 0 with an explicit
not-applicable row (gate evaluated, nothing to admit).

**Risks.** A project reviewed nightly baseline-only forever never gets a scoped/full
pass — accepted: baseline-only is the meeting-set nightly default, and scoped/full
escalation remains driven by the project-review skill's own triggers; the review-tier
digest makes starvation visible instead of silent.

### 3.2 T-20261120-001 — ADR-0105 Decision 2 amendment + AC-13 (one invariant, one item)

**Gap.** Merge-predicate conditions 7 (ledger write before merge; `verify --require-merged`
at run end) and 8 (delivery completeness via `verify-delivered-versions.ts`) exist only as
prompt prose (v4 snapshot items 7-8); ADR-0105 Decision 2 does not carry them, so they are
exactly the prose authority ADR-0105 rejects (architect, transcript Issue A). The
billing-wall suspension, the residual-risk register, and the overdue cap 16-vs-3
re-examination are recorded in a meeting file and a snapshot but not in the
decision-of-record.

**Change spec (all human merge — protected paths).**
1. ADR-0105 Decision 2: replace conditions 7+8 with ONE numbered item —
   **"Ledger-and-delivery integrity: a merge is recorded with `run-manifest.ts merge`
   BEFORE the merge command; at run end `run-manifest.ts verify --require-merged` must
   exit 0; a wave delivery PR is recorded as a success only when
   `verify-delivered-versions.ts` exited 0 for that project before the merge. A missing
   required field fails the merge rather than logging a gap."** Renumber the predicate
   accordingly in the v5 prompt (one item, cited by reference).
2. ADR-0105 Decision 3 (billing wall): prefix with **"SUSPENDED at meeting 2026-11-20
   pending explicit owner re-authorization (it was 11 of 15 merges on 2026-11-19). The
   nine conditions remain the standing terms if re-authorized; the mechanical expiry
   (condition 9 / predicate (vii)) is unchanged."**
3. ADR-0105 gains a **Residual-risk register** (from the meeting, security-expert):
   pre-review containment (`contained-run.ts` v1) does NOT close unrestricted filesystem
   reads (`~/.ssh`, `../..`), arbitrary egress, or a project-authored `scripts/audit.ts`
   deciding its own verdict; full sandbox/tmp-mirror is deferred to v2.
4. ADR-0105 Governance section: record that the **cap 16 vs cap 3 re-examination is DUE**
   (one week elapsed, never held) and schedule it with the next runner review.
5. Registered spec `2026-11-12-unified-batch-runner-design` gains **AC-13**: every
   manifest-required field is present BEFORE the merge SHA is written (schema verify exit
   2 otherwise), a merge without a prior ledger row fails the night's `--require-merged`
   check, and no delivery merge is recorded as a success with a non-zero
   `verify-delivered-versions.ts` exit. Evidence class: the ledger JSONL + verify output.
6. `prompts.manifest.json` + v5 prompt: collapse predicate items 7/8 into the single
   item; hash update rides the same governance PR (the invariant's own rule).

**Tests.** Extend `tests/unit/run-manifest-gate-step-i.test.ts`'s file family (or a
sibling): schema verify fails when any required array is absent; `--require-merged` exits
3 on a zero-merge ledger on a night with recorded merges (fixture). Existing
`verify-delivered-versions.ts` tests cover condition 8's mechanics; AC-13 only binds them
into the ADR of record.

**Risks.** Renumbering the prompt predicate invalidates older snapshot comparisons —
mitigated by landing snapshot + manifest hash + ADR in ONE governance PR.

### 3.3 T-20261120-002 — prompt-integrity verifier (+ watchdog run-id scoping + allow-exec set)

**Gap (V2, V3, V4).** Nothing hashes the LIVE prompt. Live drift exists TODAY: the store
text is ahead of the ratified v4 snapshot by 5 hunks (all matching meeting-agreed
controls, plus the phantom citation removal) — committed ≠ ratified, undetectable until
now. Second gap: watchdog writes an unconditional daily heartbeat (V13). Third gap:
`scripts/*.ts` beyond the protected entries are an unruled execution surface.

**Change spec.**

*3a. `scripts/verify-prompt-integrity.ts` (new, L0-only — never propagated).*
- Read `prompts.manifest.json`. For each entry: open
  `~/.zcode/v2/tasks-index.sqlite` READ-ONLY via `bun:sqlite`
  (`SELECT prompt FROM automations WHERE automation_id = ?`) and hash the TEXT
  byte-exact (`createHash("sha256").update(prompt, "utf8")`). NEVER shell out to the
  `sqlite3` CLI (V3: it mangles the TEXT). DB path overridable via
  `--store <path>` (tests); store file absent → alert (cannot-verify ≠ pass).
- Verdict matrix per entry: `live == manifest.sha256` → match; live differs AND the
  entry's `snapshot` file hashes to `manifest.sha256` → **UNRATIFIED LIVE EDIT** (store
  ahead of the record); live differs AND snapshot also differs → **DRIFT (both)**; live
  matches but snapshot differs → stale evidence file (WARN, not alert); automation row
  missing → **MISSING AUTOMATION** (deletion is drift).
- On any alert: exit 1, write `.pipeline-state/prompt-integrity-alert-<date>.json`
  (entry id, both hashes, hunk summary via the snapshot when present), append one line to
  `memory/<today>.md`, and — unless `--no-ticket` — file an urgent ticket through
  `bun scripts/ticket.ts` (title `prompt-integrity drift on automation-<id8>`; body
  carries both hashes and the verdict class).
- All-match run: append `prompt integrity verify: N/N match` to the day's memory log
  (the ADR-0105 §Prompt-Integrity contract line).
- **Allow-exec closure check** (third scope item, same script, `--exec-closure`):
  extract every `scripts/*.ts` path the live prompt names as an executed command
  (`bun scripts/…`), and require each to be within `docs/protected-paths.json`
  `protectedPaths[]` OR `docs/runner-exec-allowlist.json` (new, checked-in, protected,
  seeded with the runner's known set: `automation-lock.ts`, `external-deps.ts`,
  `fleet-list.ts`, `helpers/*` the prompt calls). Any prompt-referenced script outside
  the union = alert (a new execution surface entered the authority prompt without a
  governance change set).
- First run will fire on V2 — by design. The reconciliation PR (3d) lands BEFORE arming.

*3b. Scheduling — out-of-process, launchd (DEC-20261120-04).* A host launchd job
`ai.workspace.prompt-integrity-verify.plist` (StartCalendarInterval 06:00 KST) runs
`bun scripts/verify-prompt-integrity.ts`. Rationale: the S5 principle — enforcement the
runner session controls is not enforcement; a launchd job survives a compromised runner
session, matches the existing watchdog pattern (V14), and needs no new ZCode automation
id. The manifest `doc` field is amended to name the plist label + repo script path as the
verifier of record (replacing the "its own id joins entries" wording); the host job is
operator-managed state recorded in the change set's evidence, exactly like the 13:00
watchdog. Fallback if the owner prefers the in-app route: a user-created ZCode automation
(fresh chat, CronList not callable from subagents) running the same script daily 06:00 —
the script is identical; only the scheduler differs.
- Pre-fire wrapper: until the platform exposes a launcher pre-fire hook (T-20261112-003
  upstream thread stays the platform ask), the v5 prompt's STEP 0 gains one mandatory
  command: `bun scripts/verify-prompt-integrity.ts --gate` — exit non-zero → graceful
  abort with report before any merge. This is defense-in-depth (in-process), not the
  control; the 06:00 launchd job is.

*3c. Watchdog run-id scoping.* `scripts/watchdog-automation-stop.ts` v1.1.0: read
`.pipeline-state/automation.lock` (LockRecord: name/pid/hostname). If a live same-host
holder exists (`name === "unified-automation"`, pid alive) → append the stop event WITH
`run: <name>` as today. If no live run → NO stop-file write, NO history row (an idle-night
wall is not evidence of anything); print one stdout line for the launchd capture. Stop
`events[]` cap and atomic-write contract unchanged. Effect: the stop file is ABSENT at
03:00 by default; `automation-stop.history.jsonl` stops growing one heartbeat per day;
stop-gate.ts semantics unchanged. Note: a run that ignores deadlines past 13:00 keeps its
lock live, so the wall still fires against it — the degraded-mode kill-switch intent
(ADR-0105 Decision 4) is preserved.

*3d. Reconciliation of the CURRENT drift (prerequisite, human merge).* The live store
text (V2) ratifies: land `docs/governance/automation-prompts/runner-v5.snapshot.txt`
(byte-copy of the live prompt), update `prompts.manifest.json` (`sha256:
c91eeb1cad1e9ce1603d4f7c4429646aa91843bbfd15b1c72fdedbe8c586d37c`, `generatedAt`,
coverage wording), in the same governance PR as the ADR-0105 amendment (3.2). The live
edits match meeting-agreed controls (redact, deletion arm, ledger repair rows, freshness
header) and drop the phantom citation — ratification, not rollback. The store keeps its
text unchanged by this PR.

**Tests.** `tests/unit/verify-prompt-integrity.test.ts`: fixture store (temp sqlite)
exercising all five verdict classes; CLI-mangling regression pinned by asserting the
hash of a `bun:sqlite` read equals a direct byte hash of the fixture prompt;
exec-closure pass/fail fixtures; alert-file + exit-code contract. Watchdog:
`tests/unit/watchdog-automation-stop.test.ts` gains the idle-night no-write case and the
live-run tagged-append case.

**Risks.** Store path/migration drift (ZCode updates) — the verifier's
cannot-verify alert fails visible instead of passing; store schema is app-owned, so the
DB path and table/column names live in one constant with a self-test
(`SELECT 1 FROM automations LIMIT 1` at start; failure = alert, not crash).

### 3.4 T-20261120-004 — records integrity (phantom transcript; backfill audit)

**Gap (V5, V6, V7).** ADR-0105 and the v3/v4 prompts cite a transcript that never landed;
two nights of dissent-closure questions were answered from ADR-0105's excerpt alone.

**Ruling (DEC-20261120-02): explicit supersession — do NOT reconstruct.** No
contemporaneous transcript exists in git, in `memory/archive/`, or in any surviving
artifact, so a reconstruction would be a synthesis wearing a transcript's provenance —
the exact records-integrity failure this ticket exists to close. The authority record is:
ADR-0105 §Preserved-dissent (verbatim S2 / S5 / cap-16 dissent — the block the two lost
nights were actually answered from), plus the surviving same-day artifacts (registered
design doc, T-20261112-001/-002/-003, `docs/reports/2026-11-12-revert-drill.md`,
`memory/2026-11-12.md` retrievable at `f14e522bb^`). The v4-era record
(`memory/meeting-2026-11-20-batch-runner-hardening.md`) already documents the loss in its
facilitator fact-check table — no new evidence exists to recover.

**Change spec.**
1. ADR-0105 References (human merge): replace the transcript line with —
   "Hardening session record: the transcript file once cited here
   (`memory/meeting-2026-11-12-unified-batch-runner.md`) was never landed; per
   DEC-20261120-02 the authority of record is this ADR's §Preserved-dissent plus the
   registered design doc and T-20261112-001/-002/-003."
2. Prompt v5 header (same governance change set): cite ADR-0105 §Preserved-dissent as
   the 2026-11-12 hardening authority (the live store text already dropped the dead path —
   ratification in 3.3.3d carries it into the record).
3. `docs/designs/2026-11-12-unified-batch-runner-design.md` Source line and
   `docs/reports/2026-11-12-revert-drill.md` transcript reference: same one-line
   correction.
4. **Backfill audit** (second scope item): one implementation task — audit the
   2026-11-19/20 runner reports (`docs/reports/2026-11-19-project-review-daily.md`,
   `2026-11-19-project-resync-daily.md`, memory blocks, run logs) claim-by-claim against
   origin (`git show origin/main:…` for ticket states, PR SHAs, landed files); produce a
   corrections table; land corrections in one docs PR. Rule applied: a report claim is
   evidence only once origin carries it (v4 STEP J already requires this for new runs;
   the backfill covers the two nights that predate it). Known corrections to expect from
   the 11-19 log: the 13→11 wall-exception count correction (already self-corrected in
   the log), any ticket-state claims made before origin carried them.
5. Scope note: `memory/2026-11-12.md` is NOT phantom (V7) — validate-decisions v1.2.0
   resolves it; no change.

**Tests.** None code-side; the audit's corrections table is the evidence artifact
(`docs/reports/2026-11-20-runner-report-backfill-audit.md`).

**Risks.** A reconstructed-transcript faction may still want narrative recovery — the
DEC records why provenance forbids it; the surviving-artifact list in the DEC gives
researchers the honest map.

### 3.5 U-20261120-001 — memory-union-verify exit-128 noise (L0/L1 helper fix)

**Gap (V11).** `git()` treats the documented absent-path signal (exit 128 from
`git show <commit>:<path>`, "null when the path is absent in that commit — file added or
deleted relative to that side") as an incomplete-sweep warning, without naming the ref;
one-side-taken merges in the window make every scan emit 20+ rows. The earlier upstream
report under the same id (restore-then-re-collapse loop, triaged ready) targets the
v1.5.0 spare semantics — covered by design (owedBlocks merge-time inventory,
`scripts/helpers/memory-union-verify.ts` L339-360) but pinned by the new test below so
the class cannot regress silently.

**Change spec.** `scripts/helpers/memory-union-verify.ts` v1.6.0 (+ byte-identical L1
mirror `templates/common/scripts/helpers/memory-union-verify.ts`):
1. `git(args, cwd, opts?: { absentOk?: boolean })` — when `absentOk` and `exitCode ===
   128`, push the ref (`args[1]`, i.e. `<commit>:<file>`) onto a module-level collector
   and return null SILENTLY. All non-showBlob calls (log, diff-tree, show -s) keep the
   strict WARN.
2. `showBlob` is the only `absentOk: true` caller. Justification for treating ALL
   showBlob 128s as absent-path: the commit SHAs come from the same repo's `git log
   --merges` moments earlier, so an unknown-SHA 128 is not a real shape here; corrupt-
   object pathologies surface through the remaining strict calls.
3. `unionScan` and `owedBlocks` each end with ONE INFO line when the collector is
   non-empty: `memory-union-verify: N absent-side blob reads (documented no-data — file
   added/deleted between sides): <ref1>, <ref2>, <ref3> [+k more]` — then drain. Two
   INFO lines per dev-sync pipeline worst case, each naming refs, vs 20+ anonymous
   WARNs.
4. The strict WARN gains the failing ref too (`git show failed (exit <code>) on
   <args[1] ?? args.join(" ")> — sweep results may be incomplete`), fixing "no <!-- encoding-check-ignore -->
   indication of which ref/invocation fails" for genuine failures.

**Tests.** `tests/unit/memory-union-verify.test.ts` (existing fixture repo) gains:
(a) absent-side read emits NO warn; (b) sweep emits exactly one INFO naming the absent
ref; (c) genuine failure (bad object via a non-log-sourced sha) still warns with the ref
named; (d) loop-regression pin: one-side-taken merge + same-branch re-run converges in
one 3.88 pass (repro of the earlier U-20261120-001 report, asserting v1.5.0 spare
semantics hold).

**Delivery.** Standard SYNC_IF_NEWER scripts/ channel to the fleet (upgrade-project
v1.114.0 walk semantics — every owned path now gets a truthful decision row, T-20261120-003)
+ verify-delivered-versions.ts exit 0 per project before the wave records success.

**Risks.** A future git version changing exit codes for absent paths — the INFO line's
"documented no-data" wording keeps the semantics discoverable; the strict-WARN ref-naming
improves diagnosis if the classification ever misfires.

### 3.6 T-20261119-006 — protected-path policy ruling (fleet-parity carve-out)

**Gap (V8, V9, V10).** The engine sanctions hook/workflow delivery to projects (LOCKED =
template-wins always-overwrite; `ci.yml` MERGE_MANAGED), the parity channel is how
T-20261116-002's real defect fix reaches the fleet, and the runner discarded exactly that
delivery in 3 of 14 projects on 2026-11-19 — a per-repo inconsistent application of a
root-authored list. Under the status quo the parity channel stays blocked, forever, while
the engine keeps writing the PRs the runner then discards (waste + drift).

**Ruling (DEC-20261120-01): option (a) — parity delivery sanctioned, scoped as a
fleet-parity carve-out; root stays LOCKED.** The protected-path floor exists so the
runner can never merge changes to its OWN authority (ADR-0105 Decision 2: "the runner can
never merge changes to its own authority, gates, or this ADR"). A project's
`.githooks/commit-msg` is not the runner's authority — it is fleet parity content owned
by the template SSOT, delivered by an engine pass whose policy is already
"template always wins". The genuinely self-authoritative surfaces are the ROOT
`.githooks/**` and `.github/workflows/**` — those stay protected, human-merged, forever.

**Change spec.**
1. `docs/protected-paths.json` v2026-11-21 (human merge; itself protected): add
   `fleetParityCarveOut`:
   ```json
   "fleetParityCarveOut": {
     "comment": "Paths the runner MAY merge in FLEET repos (Projects/co-*) when the PR is an upgrade-wave delivery whose diff for these paths is byte-identical to the template source at the delivered version. Root-repo merges touching these paths remain HOLD. Membership changes are human-only (this file is protected). Seeded 2026-11-20 per DEC-20261120-01 with the T-20261116-002 defect-fix channel.",
     "paths": [".githooks/commit-msg", ".githooks/pre-commit", ".githooks/pre-push", ".githooks/post-checkout", ".githooks/pre-rebase", ".github/workflows/ci.yml"]
   }
   ```
   (Exact path enumeration — no `.githooks/**` glob — so a NEW hook file entering the
   template tree cannot self-sanction its fleet delivery; adding a path to this list is a
   human decision, one owner ask per NEW enforcement surface, then parity flows
   unattended forever. The LOCKED engine pass already enumerates exactly these five hook
   files — `upgrade-project.ts:4655-4660` — so the lists agree by construction.)
2. Merge predicate 6 (v5 prompt, same governance PR): "PROTECTED PATHS — for a ROOT-repo
   merge, the hold rule is unchanged (read at merge time from
   `docs/protected-paths.json`). For a FLEET-repo merge, paths in
   `fleetParityCarveOut.paths` are mergeable ONLY when: (i) the PR is part of an upgrade
   wave that passed the STEP I gates, (ii) for every carved-out path, the PR's blob is
   byte-identical to the template source at the delivered version
   (`git diff --no-renames` on the pathspec; any project-local delta — including a
   LOCAL-PATCH marker — voids the carve-out and HOLDs), (iii) the delivery passed
   `verify-delivered-versions.ts`. Everything else in `protectedPaths[]` holds in fleet
   repos exactly as in root."
3. Visibility gate (replaces a per-delivery interactive confirmation, which would
   deadlock the unattended night): every wave report lists the carved-out files delivered
   per project; `verify-delivered-versions.ts` already proves presence; the 06:00
   memory-log line from any prompt-integrity alert stays the escalation channel.
4. Mechanical guard in the verifier (3.3, `--exec-closure` sibling check
   `--parity-closure`): the carve-out's `paths[]` must each exist in the engine's LOCKED
   enumeration or MERGE_MANAGED set — engine/protected-list drift fails visible.
5. T-20261119-006 closes `review → done` with result citing DEC-20261120-01 + the
   landed JSON; the three discarded 11-19 deliveries (co-abap/co-consult/co-develop
   commit-msg fix) re-deliver via the next gated wave.

**Tests.** Unit test for the parity guard logic (fixture: fleet PR touching
`.githooks/commit-msg` byte-identical to template → carve-out applies; same PR with a
one-byte project delta → HOLD; root PR touching the same path → HOLD). JSON health gate
(check-upgrade-coverage) extended for the new key's shape.

**Risks.** A compromised template PR could ship a malicious hook to all projects through
the wave — that risk EXISTS ALREADY by the engine's LOCKED pass (delivery happens
regardless; only the merge was gated); the ruling does not widen it. The real mitigations
stay: root PR review (human), the secrets gate, and post-delivery verification. Accepted
residual: fleet hooks are template-wins by policy — an owner who wants project-local hook
customization must use LOCAL-PATCH markers (markerLossBlocks already blocks those
deliveries, `upgrade-project.ts:4666`).

## 4. Reconciliation notes (conflicts resolved by this design)

- **Option 2 (2026-11-18) vs freshness (2026-11-20)**: resolved in 3.1 — freshness
  governs; option 2's degradation outcome is preserved per-project via zero-fresh-rows
  deferral. DEC-20261120-03.
- **Engine LOCKED (deliver) vs runner HOLD (never merge)**: resolved in 3.6 — scope
  split; root keeps the floor, fleet gets a guarded parity channel. DEC-20261120-01.
- **Manifest "verifier automation id" wording vs out-of-process launchd verifier**:
  resolved in 3.3b — manifest `doc` amended; DEC-20261120-04.
- **Unratified live prompt ahead of the committed snapshot**: resolved in 3.3d —
  ratification PR; the verifier armed only after reconciliation.
- **Two upstream reports sharing id U-20261120-001** (01:53 loop symptom, 11:36 WARN
  noise): both addressed in 3.5; the loop shape gets a regression pin rather than a new
  fix (v1.5.0 semantics cover it by design).

## 5. Spec amendments to the registered 2026-11-12 design

- **AC-13** (3.2): ledger-write-before-merge + `--require-merged` + delivery
  completeness as one invariant; missing field FAILS the merge.
- **AC-14** (3.1): STEP I admission machine-checkable via `gateChecks[]` freshness
  rows; battery-only STEP E → zero fresh rows → waves defer with `skippedBudget`
  carryover rows; the review-tier digest appears in every run report.
- **AC-15** (3.3): prompt-integrity verify N/N match line present on every clean day;
  any drift fires an alert + urgent ticket the same day; the verifier runs
  out-of-process (launchd 06:00 KST).
- AC-3 wording note: protected-path holds apply per §3.6's scope split (root unchanged;
  fleet via `fleetParityCarveOut`).

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — runner is prompt/platform-neutral; no CLAUDE.md changes | N/A |
| Antigravity (GEMINI.md) | None — no platform surface in this cluster; runner + scripts + governance JSON are platform-neutral | N/A (justification: no file in the change set is platform config; GEMINI.md/AGENTS.md untouched) |
| templates/common | Propagation REQUIRED for the muv helper fix only — `templates/common/scripts/helpers/memory-union-verify.ts` must stay byte-identical to L0 (v1.6.0); `run-manifest.ts`, `verify-prompt-integrity.ts`, `watchdog-automation-stop.ts` are L0-only runner scripts (not in the propagation map's mirrored set — verify via qa-gate step 4's SCRIPTS.md layer registry on landing) | `templates/common/scripts/helpers/memory-union-verify.ts` |

## 7. Acceptance criteria (this design)

- [ ] AC-A (3.1): `gate-step-i` lands with `gateChecks[]`; every STEP I admission in the next gated wave has a fresh-row verdict recorded before its dry-run; a battery-only STEP E night defers waves with carryover rows (AC-14).
- [ ] AC-B (3.2): ADR-0105 Decision 2 carries the single ledger-and-delivery item + suspension note + residual-risk register + cap re-exam scheduling; spec AC-13 registered (AC-13 evidence: ledger verify output).
- [ ] AC-C (3.3): verifier exists; first armed run reports N/N match after reconciliation; a seeded drift in the test fixture fires alert + ticket + exit 1; watchdog writes only on live runs (history growth stops); exec-closure check green on the sanctioned set.
- [ ] AC-D (3.4): ADR-0105 + design doc + revert-drill report cite the authority record, not the phantom path; backfill audit report lands with its corrections table.
- [ ] AC-E (3.5): no `git show failed (exit 128)` WARN on a standard scan of Projects/co-security; single named-ref INFO lines observed; strict WARN names its ref; L0/L1 mirrors byte-identical (qa-gate step 4 green).
- [ ] AC-F (3.6): `fleetParityCarveOut` landed; next wave delivers the commit-msg fix to co-abap/co-consult/co-develop and the runner MERGES it; root holds stay in force (AC-3 note).

## 8. Alternatives considered

1. **Option 2 literal (same-run E gates I) — rejected**: permanently starves STEP I
   under E's hard 2 h budget (meeting Issue D arithmetic); the auditor's rebuttal stands.
2. **Keep `.githooks/**` human-only for fleet (option b) — rejected**: parity drift
   persists forever while the engine keeps delivering; T-20261116-002's defect fix already
   proved the channel is load-bearing; 16 manual human PRs per hook fix is not a control,
   it is an outage.
3. **Interactive per-delivery owner confirmation — rejected**: the runner is unattended
   at 03:00; an interactive gate converts back to human-only-in-practice. Byte-identity +
   wave gates + enumerated allowlist give the same safety mechanically.
4. **Reconstruct the 11-12 transcript from artifacts — rejected (DEC-20261120-02)**:
   synthesis in a transcript's provenance is the failure mode under repair.
5. **ZCode automation as the 06:00 verifier — demoted to fallback**: in-app scheduling is
   reachable by the same compromised session S5 warns about; launchd is out-of-process and
   already the house pattern for the wall.
6. **Protect ALL `scripts/*.ts` — rejected**: every helper fix would become human-merged;
   the exec-closure check gives the boundary without freezing maintenance.

## 9. Accessibility Impact

Accessibility-exempt per ADR-0065/0070 posture: governance, runner tooling, and script
output changes with no user-interface surface; all new output is plain text (single INFO
lines, JSONL, YAML).

## 10. Implementation PR sequence (proposal)

| # | PR | Contents | Merge class |
|---|----|----------|-------------|
| 1 | `pr/20261120-runner-governance-ratification` | ADR-0105 amendment (3.2 + 3.4.1 + gate sentence from 3.1.2), AC-13/AC-14/AC-15 spec amendments, `prompts.manifest.json` v5 hash + doc wording, `runner-v5.snapshot.txt`, `docs/protected-paths.json` `fleetParityCarveOut` + corrected `outOfRepoProtected` wording (it currently claims the verifier "landed"), phantom-citation corrections in 11-12 artifacts, prompt v5 text (owner applies to store; byte-copy lands as snapshot), DECs 01–04 | HUMAN merge (protected paths) — one governance change set, per the invariant |
| 2 | `pr/20261120-prompt-integrity-verifier` | `scripts/verify-prompt-integrity.ts` + tests + `docs/runner-exec-allowlist.json`; watchdog v1.1.0 run-scoping + tests; launchd plist installation steps (operator, recorded in evidence) | Runner-mergeable after PR 1 (touches protected? no — new files; watchdog script is NOT in protectedPaths) — CLEAN-gated |
| 3 | `pr/20261120-run-manifest-gate-step-i` | `run-manifest.ts` v1.1.0 (`gate-step-i`, `gateChecks[]`) + tests | Runner-mergeable (script is protected → **human merge**; tests are not) — note: `scripts/run-manifest.ts` IS protected, so this PR holds for human merge |
| 4 | `pr/20261120-union-verify-absent-path-info` | muv v1.6.0 L0 + L1 mirror + tests | Runner-mergeable (helpers are not protected) |
| 5 | `pr/20261120-backfill-audit` | 2026-11-19/20 report backfill corrections + audit report | Docs PR; `memory/**` in pathspec → human merge per protected paths if memory blocks are touched |
| 6 | next gated wave | Re-deliver commit-msg fix to co-abap/co-consult/co-develop; first live exercise of `gate-step-i` + carve-out + verifier (AC-A/C/F evidence) | Wave |

Sequencing rule: PR 1 precedes everything (the verifier must arm against a ratified
hash); PR 4 is independent and may land any time; PRs 2 and 3 both precede the wave.

## 11. Open questions for the owner (minimized)

1. **Billing-wall re-authorization** (3.2.2): remain suspended, or re-arm under the nine
   conditions? Default if unanswered: stay suspended (the meeting's standing decision).
2. **Verifier scheduler** (3.3b): launchd job (recommended) vs ZCode automation. Default:
   launchd. No further ask needed unless the owner objects.
3. **Cap 16 vs cap 3 re-examination** (3.2.4): scheduled as part of the next runner
   review — the DEC only records that it is DUE; the ruling itself is that review's
   output, not this design's.
4. **Ratify the live prompt text as v5** (3.3d): recommended (content equals
   meeting-agreed controls). If the owner prefers rollback to the committed v4, only
   3.3.3d's direction flips; every other section is unaffected.
