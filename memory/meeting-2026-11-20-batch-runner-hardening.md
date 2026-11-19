# Meeting — Unified 03:00 batch runner hardening (v3 → v4)

**Date**: 2026-11-20
**Facilitator**: PM
**Participants**: automation-engineer (Medium), security-expert (Medium), architect (High), auditor (Medium — RED-TEAM / dissent seat)
**Rounds**: 2 (fixed at convening; not reduced)
**Artifact under review**: live automation prompt v3 for `automation-dfba3ff1-a1df-42e3-b358-7c641f974648`, snapshot `.pipeline-state/logs/runner-prompt-v3-snapshot.txt`, sha256 `2e6058b7…`
**Objective**: find the structural weaknesses that survived the 2026-11-19/20 runs and convert them into mechanical controls.

---

## Facilitator agenda pass (issue list, stated before round 2)

- **A — Ledger integrity**: `run-manifest-*.json` is a pre-run HEAD census, not the ledger the REVERT rule depends on.
- **B — Gate falsifiability**: several gates have never been observed firing; one control (prompt integrity) is marked done with no implementation.
- **C — Privilege boundary**: STEP E/I now execute each project's own code with the runner's identity and credentials.
- **D — Throughput & closure**: STEP E's budget can permanently starve STEP I; no post-delivery verification; no systemic dedup; two conflicting ticket caps.

## Fact verification performed by the facilitator (before round 2)

| Claim | Verified result |
|---|---|
| `memory/meeting-2026-11-12-unified-batch-runner.md` cited by ADR-0105 and prompt line 5 | **DOES NOT EXIST** — citation points at nothing |
| `T-20261120-002` "does not exist" (auditor R1) | **REFUTED** — exists, `status: backlog` (design handoff) |
| `T-20261119-008` "still backlog" (auditor R1) | **REFUTED** — `waiting`; auditor read a checkout 4 commits behind origin |
| Manifests carry only `prerunHeads` | **CONFIRMED** — 2/2 nights, no `mergedPRs`/`sanctionedRepairs`/`skippedBudget` |
| `scripts/verify-prompt-integrity.ts` | **ABSENT**; `T-20261112-003` is `done` — false closure |
| `docs/protected-paths.json` lists itself | **NO** — 15 entries, self absent; only `note` claims protection |
| `upgrade-project` emits a machine-readable delivery manifest | **YES** — `.claude/last-upgrade-delivery.json` schemaVersion 2: `files[]` (208), `baselines{}` (503), `decisions[]` (502) |

---

## Round 1 — positions (attributed, condensed)

**automation-engineer**: "v3 hardened *judgment*, not machinery… every rail still terminates in agent adjudication." Five issues: manifest is a census; stop-file heartbeat read as stop order plus a kill that the script disclaims; E→I order is prose; "dry-run clean ≠ delivered"; battery false-green via pattern matching. Also flagged unenforceable-as-written clauses: never-busy-poll, ticket caps, never-`--disposition`, deadlines, and date-scoped lock names that make a foreign session invisible.

**security-expert**: "the merge predicate is an **integrity** gate, not an **authority** gate: every arm attests content or repo state, none binds the runner's own inputs." Nine bypass scenarios, incl. protected-list self-weakening, prompt/JSON divergence, case-insensitive APFS, unprotected execution surface (`ticket.ts`, `upgrade-project.ts`), gitleaks `--no-git` net-pathspec false negative, spoofable author string, report leak without `--redact`. New risk surface: STEP E executes project code with inherited `GH_TOKEN`, reach to `../..` and `.pipeline-state`. Verdict: "REQUIRES CHANGES before the next run."

**architect**: "the decomposition is directionally right but **not closed**: a one-way chain with no verification edge on either end." Warned that v3's gate introduces a deadlock — E is the only step with a hard 2-hour ceiling, so a budget-skipped E permanently starves I. Six structural gaps (no post-upgrade closure, time-of-check/time-of-use, no systemic lane, cap contradiction, temporally impossible STEP E instruction, scope census disagreement), four missing lanes (post-delivery verify, review-basis digest, scope closure, cross-project dedup), and a cohort re-budget proposal.

**auditor (red team)**: "v3 is a better *prompt* guarding a worse *system*. Every hard finding concerns the record, not the code: the runner remains the sole author of every artifact by which it is judged — and on 11-19/11-20 two of those artifacts are demonstrably false." Four failure modes with falsifiable tests that do not exist; three prior dissent items marked [STILL OPEN].

## Round 2 — deliberation by issue

### Issue A — ledger integrity
- **automation-engineer** → architect: "Issue 1 makes the manifest a write-on-merge precondition… do you accept merge-predicate condition 7/8 as ADR-0105 Decision 2 amendments, or does each need its own spec row?" Stance: `changed: HEAD census → write-on-merge ledger`.
- **architect** → automation-engineer: **AGREE.** "Accept. The manifest write is a condition on *merging*, and Decision 2's Governance clause says the predicate is decision-of-record… A prompt-only condition 7/8 would be exactly the prose authority ADR-0105 rejected." But "**not one spec row per condition**… They land as Decision 2 amended with conditions 7/8 as a single numbered item, plus **AC-13** on the existing registered spec." Requires human merge (protected paths).
- **security-expert**: **REBUT (partially).** `changed: census → census, renamed` — "stop calling it integrity; label it tamper-*evidence*. No ledger until the verifier fires."
- **auditor**: `no change: a prerunHeads census is being cited as a ledger. Confirmed.`
- **Agreement**: the artifact must become a **write-on-merge ledger verified by a schema gate**, and the change is an ADR-0105 Decision 2 amendment (single numbered item + AC-13), human-merged. Security's "rename it tamper-evidence until the verifier fires" is accepted as the interim labelling.

### Issue B — gate falsifiability
- **security-expert**: ranked MUST-before-next-run = (a) env/token scrub, (b) protected-paths self-entry, (c) `--redact` on gitleaks. "Deliberately *not* in (i): case-insensitive normalize and per-commit blob scan — real but need mechanical work."
- **automation-engineer** → security: **AGREE on the set; RAISE one hole** — "`docs/protected-paths.json` is **absent from its own `protectedPaths[]`** — only the `note` claims self-protection. Lowercase `--name-only -z` before glob match. Gitleaks: add the deletion arm (`--diff-filter=D` blobs) and an allowlist-parity assertion."
- **architect**: `changed: silent pass → explicit not-applicable row` — "A gate that does not fire must still write a row."
- **auditor**: `no change, strengthened: the only gate with an observed firing is the one with a mechanical assertion (exit-code battery, co-deck #257). The STEP I pre-review gate and the S2 verifier have never been observed firing.`
- **Agreement**: five items — (1) protected-paths self-entry + read-at-merge-time, (2) gitleaks `--redact` + deletion arm, (3) prompt-integrity verifier + reopen T-20261112-003, (4) stop-file run-id scoping, (5) log tee. Plus (6) every gate that does not fire writes an explicit not-applicable row.

### Issue C — privilege boundary
- **security-expert**: `no change: critical, uncontained` — "Residual: unrestricted filesystem reads (`~/.ssh`, `../..`), arbitrary egress, and attacker-authored `scripts/audit.ts` still decides its own verdict."
- **automation-engineer** → security: **AGREE that containment is required, REBUT the mechanism.** "Feasible, **not** with bare `env -i` (strips `PATH`/`HOME`; bun needs both)." Minimal viable: `spawn({detached:true, env:{PATH,HOME:scratch,TMPDIR,LANG,BUN_INSTALL_CACHE_DIR}})`, explicit token deny-list, `process.kill(-pid, SIGKILL)` on deadline, generated `GIT_CONFIG_GLOBAL`, `node_modules` required (never install; absence = SKIPPED not FAIL), "Defer the tmp mirror to v2; a pre/post `git status --porcelain` assertion buys most of it."
- **architect**: `changed: in-session project code → subprocess, env-scrubbed, no gh credential` — "I ran `Projects/co-work/scripts/audit.ts` in this session — project-controlled code with runner authority, ahead of any merge gate."
- **auditor**: **REBUT the urgency.** "DEFER as ceremony: … sandbox (no harness, no measured incident)…"
- **Agreement**: minimal containment lands (env allowlist + token deny + per-project timeout + `preinstall`/`postinstall` assertion + pre/post dirty-tree assertion). Full sandbox/tmp-mirror deferred to v2. Security's residual-risk statement is preserved below.

### Issue D — throughput & closure
- **auditor** → architect: **REBUT.** "Don't add reviewer roles to a deadline-starved run — ceremony is what turned STEP E into battery-only… no new steps, rounds, or prose gates."
- **architect**: **CONCEDE.** "The auditor is right on the mechanism, and I'll take the loss. Three cohorts do not change the arithmetic (18 scoped reviews × 12–15 min ≫ 120 min); they only redistribute it and add a construct to a starved run." Replaced with a record-level alternative: `reviewTier`/`reviewOutcome`/`reviewBasisHead`/`capArbitration` per project, and the STEP I gate becomes **freshness** ("baseline pass within 2 nights AND no unresolved Critical/High") instead of "E completed this run".
- **automation-engineer** → architect (answering the round-1 question): **"Yes, it exists; no engine change needed."** `.claude/last-upgrade-delivery.json` carries `files[]` (208 paths — "only **12** of its `scripts/co-deck/*`"), `baselines{}`, `templateVersion/Sha/baseSha`. R18 derives as set-diff against the dry-run's expected set — "the swallow appears as **absence**". **Self-correction**: "the dry-run *does* emit CONFLICT for these paths… The gap is narrower and worse: an **ADOPT-grant row reads as 'resolved' but the copy never happens**."
- **security-expert**: `changed: "E/I ordering" → "E budget is an unlogged gate bypass"` — "budget skip must write a manifest row, and the cap contradiction must be resolved to one number."
- **Agreement**: R18 post-delivery verification via `last-upgrade-delivery.json` set-diff + per-file `@version`/sha256 sweep; review-basis digest; one counter replacing the 50-vs-10 contradiction; freshness gate; and a NEW engine ticket for the ADOPT-grant-skipped-copy defect.

---

## Agreements reached

1. **A** — `run-manifest` becomes a write-on-merge ledger (merged PR SHA, sanctioned repairs, billing-wall evidence, SKIPPED-BUDGET rows) with a schema verify that FAILS the merge when a required field is absent. Lands as ADR-0105 Decision 2 amendment (single numbered item + AC-13), human-merged.
2. **B** — Six mechanical controls: protected-paths self-entry + read-at-merge-time; gitleaks `--redact` + deletion arm + allowlist parity; prompt-integrity verifier (reopen T-20261112-003); stop-file run-id scoping; log tee; explicit not-applicable rows for gates that do not fire.
3. **C** — Minimal containment for project-code execution: env allowlist, token deny-list, per-project timeout, `preinstall`/`postinstall` assertion, pre/post dirty-tree assertion. Full sandbox deferred to v2 with the residual risk recorded.
4. **D** — Post-delivery verification (R18) from `last-upgrade-delivery.json`; review-basis digest; freshness-based STEP I gate (replacing same-run E requirement); single ticket counter; systemic dedup by defect class; engine ticket for ADOPT-grant-skipped-copy.
5. **Billing-wall exception suspended** pending owner re-authorization (auditor: it was the majority merge path at 11/15 with an unproven expiry).

## PRESERVED DISSENT (verbatim — not summarized, not averaged)

**auditor (red team), on scope of tonight's fix:**
> "DEFER as ceremony: gitleaks per-commit (full-config already runs at merge), sandbox (no harness, no measured incident), cohort re-budget (clock arithmetic cannot cure E starving I — scope is the cause), protected-list edits, further review rounds."

**auditor (red team), on his own errors:**
> "My two refuted claims were audited against a local main four commits behind origin (`d62ec06e2` vs `e03afbb4c`). Both errors were mine — and the same class I charge the runner with: treating a worktree state as the record. That is now evidence *for* fix 2, not against it."

**auditor (red team), on S2 severity:**
> "The v3 hash reached origin inside a `chore(runner)` nightly landing PR, after two normative prompt edits (11-14, 11-20), with `generatedAt` still 2026-11-12. ADR-0105 requires 'the same governance change set'; a chore PR is not that. Committed ≠ ratified, and no verifier exists to notice the difference."

**security-expert, on residual risk after the agreed containment:**
> "Residual: unrestricted filesystem reads (`~/.ssh`, `../..`), arbitrary egress, and attacker-authored `scripts/audit.ts` still decides its own verdict."

**security-expert, stance on C:**
> "C: `no change: critical, uncontained`."

**security-expert, on A:**
> "A: `changed: census → census, renamed` — stop calling it integrity; label it tamper-*evidence*. No ledger until the verifier fires."

**automation-engineer, self-correction on his own round-1 finding:**
> "I must correct my R1 #4: the dry-run *does* emit CONFLICT for these paths (40 rows in the on-disk log)… The gap is narrower and worse: an ADOPT-grant row reads as 'resolved' but the copy never happens."

**architect, conceding on cohorts:**
> "The auditor is right on the mechanism, and I'll take the loss."

## Prior dissent status (2026-11-12 meeting)

| Item | Status |
|---|---|
| S2 — out-of-repo prompt self-edit vector | **[STILL OPEN]** — manifest hash now committed (#2116); verifier still absent; T-20261112-003 falsely `done` |
| S5 — every rail enforced by the thing it guards | **[STILL OPEN]** — protected paths + expected-gate-failures genuinely mechanical; wall, deadlines, E→I order, gate-failure class still agent-judged |
| Cap 16 vs cap 3 | **[STILL OPEN]** — one week elapsed, re-examination never held; 11/16 used on a night the wall was the default path |

## Open questions carried forward

1. Where does the missing `memory/meeting-2026-11-12-unified-batch-runner.md` authority record get resolved — reconstruct with provenance, or amend ADR-0105's citation? (Both are governance-class.)
2. Does the owner re-authorize the billing-wall exception at all, given it was the majority merge path?
3. Should `scripts/*.ts` beyond the current three entries join `protectedPaths`, and which subset is "allow-read"?

## Action items (owner → target)

| # | Action | Owner | Target |
|---|---|---|---|
| 1 | `run-manifest.ts` ledger + schema verify | automation-engineer | tonight |
| 2 | `stop-gate` run-id scoping + log tee | automation-engineer | tonight |
| 3 | `battery.ts` exit-code record | automation-engineer | tonight |
| 4 | R18 delivered-set verifier | automation-engineer | tonight |
| 5 | `contained-run.ts` env/token containment | security-expert | tonight |
| 6 | protected-paths self-entry + read-at-merge | security-expert | human merge |
| 7 | Prompt-integrity verifier + reopen T-20261112-003 | security-expert | this week |
| 8 | ADR-0105 Decision 2 amendment + AC-13 | architect | human merge |
| 9 | Engine ticket: ADOPT-grant-skipped-copy | automation-engineer | filed tonight |
| 10 | Citation-integrity ticket (missing 11-12 transcript) | auditor | filed tonight |

## PROPOSALS (for the user's decision — this meeting does not decide)

- **P1**: Adopt agreements A–D as the v4 prompt change set, landing the four scripts + prompt + manifest hash in one governance change set, with the ADR/design amendment delivered as a human-merged companion PR.
- **P2**: Suspend the billing-wall exception until the owner explicitly re-authorizes it (it was 11 of 15 merges on 2026-11-19).
- **P3**: Keep the 16/night cap but require every exception merge to carry a `test-integrity: unverified` marker in the manifest, per security's accept-and-document stance.

*Recorded by the PM facilitator. Disagreements above are transcribed as stated and are not to be read as consensus.*
