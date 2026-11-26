# Design: ticket-store drift AMBIGUOUS semantics + next-id cross-store/archive scan

- **Spec id**: 2026-11-27-ticket-store-drift-and-nextid
- **Date**: 2026-11-27
- **Tickets**: T-20261127-001 (both fixes), T-20261127-002 (windows CI rebudget, measured-evidence section §5)
- **Status**: approved
- **Owner**: automation-engineer (dispatched per PM Gateway; defect fix in protected machinery — `scripts/dev-sync.ts`, `scripts/ticket.ts`/`scripts/helpers/ticket-store.ts` changed only per the filed tickets)

## 1. Problem

Two verified defect classes in the ticket-store machinery, observed 2026-11-26/27 (evidence in the tickets; see also `/tmp/wave3-1126/root-merge.log` for the 3.87 FATAL output):

1. **3.87 conflates cross-store ambiguity with silent loss.** `resolveTicketLocation`
   throws `[ticket-store] ambiguous ticket id X: ... BOTH stores` when a cited id is
   resident in both the governance and the service store, and a different error when it
   resolves nowhere. `driftCheck` (scripts/helpers/ticket-drift.ts) bare-catches every
   throw into `unresolved` — so an AMBIGUOUS id (a provenance problem: the ticket exists,
   twice) is reported as "resolve in NO store or archive" and FATALs every sync at step
   3.87 with a misleading diagnostic. Observed: 7 ids flagged of which the true condition
   was cross-store duplication, not loss.
2. **Next-id allocation under-scans.** Two allocation paths share one namespace per day:
   - `nextSeqGuess` (scripts/helpers/ticket-store.ts, T-id create path) scans BOTH live
     stores but **neither archive directory** — an id that left the live store through
     `archiveTickets` (`--days 0`) or is pending `restoreTicket` is invisible, so create
     can mint a colliding id that becomes live ambiguity on restore.
   - `nextSeqForToday` (scripts/mcp-upstream-server.ts, U-id intake path) scans ONLY the
     governance live store — not the service store, not either archive.
   Observed consequence: U-20261126-003 double-assigned across parallel sessions
   (co-deck filing landed on main; co-security filing re-minted the same seq — preserved
   as U-20261126-004).

Separately (T-20261127-002): windows `test:unit` files keep hitting the 120000ms
per-file wall after PR #2189's 4-file split (§5 has the measured table).

## 2. Non-goals

- No change to `resolveTicketLocation`'s bare-id resolution ORDER (governance precedence
  unchanged); no change to the explicit `service/<id>` / `governance/<id>` forms.
- No cross-worktree id reservation: two checkouts on different branches can still mint
  the same seq (git-tracked governance store files are invisible to a stale checkout).
  The widened scan is a same-tree fix; the residual cross-checkout race is a documented
  limit — the EEXIST-collision retry in both allocation loops remains the backstop.
- No test deleted or loosened anywhere in this delivery (T-002 is budgets/scheduling only).

## 3. Fix (a): AMBIGUOUS vs NOT-FOUND (T-20261127-001a)

### 3.1 Typed ambiguity (scripts/helpers/ticket-store.ts v1.16.0)

New `AmbiguousTicketError extends Error` with `readonly id`, `readonly locations:
string[]`, `readonly scope: "stores" | "archives"`. The two ambiguous throws in
`resolveTicketLocation` raise it with the same message text as today (message is a
contract — ticket-id-namespacing tests pin its content), plus the structured fields.

### 3.2 Drift check v1.1.0 (scripts/helpers/ticket-drift.ts)

- The guarded dynamic import now also loads `AmbiguousTicketError` (same no-op degrade
  rule when the L0-only store module is absent).
- `DriftReport` gains `ambiguous: AmbiguityFinding[]`; `AmbiguityFinding` =
  `DriftFinding` + `locations: string[]` + `scope`. `unresolved` keeps exactly its
  NOT-FOUND semantics.
- New exported `reportDriftFindings(report): "pass" | "ambiguous" | "fatal"` — the
  step-3.87 presentation/decision logic moves here so the FATAL semantics have ONE
  definition, shared by dev-sync and replayable verbatim in tests:
  - `unresolved.length > 0` → prints the RED `✗ Step 3.87` block (unchanged wording)
    and returns `"fatal"` → dev-sync exits 1 exactly as today.
  - else `ambiguous.length > 0` → prints YELLOW `⚠️ Step 3.87: N cited ticket id(s)
    resolve in MULTIPLE stores (AMBIGUOUS — provenance problem, not a loss)` with one
    line per finding naming both paths, plus a non-fatal guidance line (qualify the
    citation with `governance/<id>` / `service/<id>`, or de-duplicate the store), then
    the GREEN pass line annotated with the ambiguous count; returns `"ambiguous"`.
  - else the GREEN pass line, returns `"pass"`.
- `ticket.ts doctor` gains the same ambiguous block (report-only; decision (ii) surface).

### 3.3 dev-sync step 3.87 (v1.54.0)

The inline block delegates printing/decision to `reportDriftFindings`; exit-1 happens
only on `"fatal"`. AMBIGUOUS alone never exits non-zero — the sync proceeds (the gate's
loss-detection purpose is intact; ambiguity is surfaced, not silenced).

## 4. Fix (b): next-id scan widening (T-20261127-001b)

- ticket-store.ts: `storeScanDirs(dir)` exported — returns `[serviceDir, governanceDir,
  archiveDirFor(serviceDir), archiveDirFor(governanceDir)]` derived from `dir` with the
  same governance/service sibling rule as today (works "in both directions": `dir` may be
  either store). `nextSeqGuess` scans all four (existing same-day prefix + regex filter
  unchanged; nonexistent dirs skipped).
- mcp-upstream-server.ts `nextSeqForToday`: same widened scan via `storeScanDirs` (the
  module already imports ticket-store), U-prefix and `/^U-\d{8}-(\d+)\.yaml$/` grammar
  unchanged (v1.13.0 note: the U grammar must not widen).
- `maxSeqGuess` ordering unchanged (max over files, return max+1); EEXIST retry loops in
  both allocation paths unchanged as the concurrency backstop.

### Acceptance criteria

- AC-1: cited id present in BOTH stores → `driftCheck.ambiguous` has one finding with
  both paths + `scope:"stores"`; `unresolved` empty; `reportDriftFindings` returns
  `"ambiguous"`; replay (§6) exits 0 with the AMBIGUOUS line.
- AC-2: cited id resolving nowhere → `unresolved` finding as today; replay exits 1.
- AC-3: BOTH-archives case → `scope:"archives"` finding with both archive paths.
- AC-4: next-id: same-day ids in service store / governance store / governance archive /
  service archive each raise the next create/intake seq above the max (4 new unit cases
  per store pair).
- AC-5: existing resolve/next-id/drift/intake tests stay green (no loosening).

## 5. T-20261127-002: windows CI rebudget (measured evidence)

Per-file win32 durations (ms) parsed from the `Run unit tests` step logs of the cited
runs (job logs, `✓ <file> (<ms>)` lines; five healthy runs + the failure runs):

| file | #2189 final 45831855690 | #2190 45839104906 | #2194 45858038084 | #2196 45865640842 | #2198 45876997661 | healthy max | budget today |
|---|---|---|---|---|---|---|---|
| upgrade-decision-log | 220736 | 239136 | 210482 | 261753 | 249400 | 261.8s | 600s/60s (ok) |
| upgrade-tree-sync | 123306 | 139414 | 119708 | 149923 | 133190 | 149.9s | 300s/60s (ok) |
| upgrade-overwrite-protection | 122247 | 135605 | 117542 | 156280 | 141760 | 156.3s | 300s/**60s** (test ceiling hit) |
| upgrade-template-advance-guards | 114568 | 88942 | 83476 | 86280 | 112658 | 114.6s | **none — 120s wall** |
| co-workspace-admin-console | 70481 | 82058 | 69261 | 94427 | 86133 | 94.4s | 300s/45s (ok) |
| upgrade-policy-eviction | 61779 | 64628 | 58571 | 83033 | 70176 | 83.0s | 300s/60s (ok) |
| upgrade-template-advance | 63455 | 65739 | 64190 | 65064 | 83525 | 83.5s | **none — 120s wall** |
| upgrade-stub-shape-guards | 59608 | 67193 | 64378 | 66284 | 70733 | 70.7s | **none — 120s wall** |
| upgrade-stub-shape-conversion | 57804 | 68839 | 63659 | 64247 | 70573 | 70.6s | **none — 120s wall** |
| upgrade-prune-removed | 45026 | 48613 | 44417 | 79220 | — | 79.2s | **none — 120s wall** |

Timeout evidence (the runs that failed): `upgrade-template-advance-guards` killed at
120000ms twice on main (45864068389, 45905810289); `upgrade-stub-shape-conversion`
killed at 120000ms (PR #2189 attempt 45822606148); `upgrade-template-advance` killed at
120000ms (attempt 45817806959); `upgrade-overwrite-protection` individual test killed at
60000ms (attempt 45826913410 — the file's own 300s suite budget was never the problem).
Observed spike factor healthy→timeout ≈ 1.7-2x (FS-pressure band), consistent with the
family precedent rows.

Decision: **rebudget, not serialization** — serialization (platform-specific sequential
dispatch) would lengthen an already ~10-minute windows leg and the failure shape is a
budget-marginality shape, not a fixture race. Changes in `scripts/test-runner.ts`
(FILE_TIME_BUDGETS, v1.20.0):

- ADD `upgrade-template-advance-guards.test.ts: { suite: 300000, test: 60000 }`
  (measured healthy max 114.6s = 96% of the 120s wall; two 120s timeouts on main).
- ADD `upgrade-template-advance.test.ts: { suite: 300000, test: 60000 }`
  (measured healthy max 83.5s; one 120s timeout).
- ADD `upgrade-stub-shape-conversion.test.ts: { suite: 300000, test: 60000 }`
  (measured healthy max 70.6s; one 120s timeout — 1.7x spike).
- ADD `upgrade-stub-shape-guards.test.ts: { suite: 300000, test: 60000 }`
  (measured healthy max 70.7s — same engine family and same max as the flaked sibling).
- ADD `upgrade-prune-removed.test.ts: { suite: 300000, test: 60000 }`
  (measured healthy max 79.2s on #2196 — above the 2/3-of-wall burn-in line).
- RAISE `upgrade-overwrite-protection.test.ts` test ceiling 60000 → 120000 (suite
  unchanged at 300000): a single engine-spawn test overran 60s under win32 pressure
  while the whole file passed in 117-156s.

All rows follow the family precedent (suite 300s / test 60s; headroom ≥1.9x over healthy
max, ≥2.5x for the timed-out guards file), with the measured numbers pinned in the
budget comments. No test deleted or loosened — budgets only. Regression pin: the
test-runner manifest test gains the new rows (see tests/unit/test-runner-baseline.test.ts
conventions).

## 6. Replay (3.87 gate semantics)

Two fixture trees built under a temp root (memory file + store files):
1. AMBIGUOUS fixture — `memory/*.md` cites `T-<today>-901`; the id exists as real files
   in BOTH `tickets/` and `tickets/governance/`. Run the gate: `reportDriftFindings`
   must print the AMBIGUOUS non-fatal block and the process must exit 0.
2. NOT-FOUND fixture — cites `T-<today>-902` present nowhere. Gate must print the FATAL
   block and exit 1.
The replay harness imports the same `driftCheck` + `reportDriftFindings` exports
dev-sync's step 3.87 calls (single definition — §3.2), so the replay exercises the
production decision path, not a re-implementation. Both replays also run as unit tests
(subprocess, exit-code asserted) in tests/unit/ticket-drift-gate-replay.test.ts.

## 7. Risks

- L0/L1 mirrors: ticket-drift.ts and dev-sync.ts are L0+L1 byte-identical; propagate
  step 4.5 republishes and the 3.7 drift check verifies. ticket-store.ts /
  mcp-upstream-server.ts / ticket.ts / test-runner.ts are L0-only (delivered trees carry
  no ticket machinery); the guarded dynamic import in ticket-drift keeps variants no-op.
- `DriftReport` shape change is additive (`ambiguous` field) — doctor/dev-sync are the
  only consumers (grep-verified), plus tests.
- Version bumps trigger the 4.85 full-unit-suite gate at sync time; suites must be green
  before landing (they are a §Gates requirement anyway).
