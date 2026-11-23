# Fleet skill-graph machinery batch: owedBlocks merged-present sparing, snapshot freshness audit gate, fleet-report doc row — Design (Row 0)

- **Spec ID**: `2026-11-23-fleet-graph-machinery-batch-design`
- **Date**: 2026-11-23
- **Status**: implemented (owner pre-approved the direction — "proceed with remaining tasks"; this document formalizes it. Registry flip lands with the batch PR; §7 carries the rollout).
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074; design only — this document changes no script, template, test, or registry row).
- **Input tickets**: T-20261123-009 (backlog — `tickets/governance/T-20261123-009.yaml`, cited read-only), T-20261123-008 (backlog — intent carried into the audit-side design; the runner prompt itself is a non-goal), O-2 hygiene item (memory/2026-11-23.md:425).
- **Related work (explicit boundary)**: U-20261123-003 (co-security upstream, status waiting, untrusted — three upgrade-project delivery-generator defects: an L0-only script delivered into the variant tree, a raw pipe in a delivered SCRIPTS.md cell, and an @version/registry-row lockstep miss). Triage-ready but **out of scope for this batch**; it is the next machinery candidate. T-20261123-005 (divergence redelivery) stays routed to nightly STEP I — non-goal here.
- **Convention reference**: the core-script byte-parity change set follows the validate-doc-folder 1.6.0 bump exercised today (PR #2160, commits 176545ed1 / 5ac07669e): root + template byte-identical pair landed in the same PR, `docs/VERSION_MANIFEST.md` row, both SCRIPTS.md rows, parity re-verified by the mirror-parity arm (audit v2.70.0 `collectMirrorParityFailures`, CRLF/scrub-tolerant).
- **File:line currency**: all references measured on the workspace root working tree at 2026-11-23, HEAD `b04722091` (`scripts/dev-sync.ts` @ 1.53.0, `scripts/audit.ts` @ 2.70.0, `scripts/helpers/memory-union-verify.ts` @ 1.6.0, `scripts/skill-graph-fleet-report.ts` @ 2.5.0).

## 0. Summary

One compact batch, three items, one PR with three commits:

| Item | Ticket | Main file(s) | Change in one line | Byte-parity pair |
|------|--------|--------------|--------------------|------------------|
| A | T-20261123-009 | `scripts/helpers/memory-union-verify.ts` | `owedBlocks()` gains a `merged-present` class — blocks a recent merge delivered into the merged blob — so step-2 sparing protects restored blocks that merge-time debt cannot see | Yes (helpers pair) |
| B | T-20261123-008 (intent) | `scripts/lib/snapshot-freshness.ts` (new), `scripts/audit.ts` | Auto-activating root-only audit gate: fleet skill-graph snapshot older than 8 days WARNs, older than 15 days FAILs, missing/empty snapshot dir FAILs | Yes (new lib pair + audit pair) |
| C | O-2 | `templates/common/scripts/SCRIPTS.md` | One-line usage refresh: fleet-report entry gains `[--html <path>] [--no-html]` | N/A (doc row, not a script) |

`scripts/dev-sync.ts` is deliberately **not** modified (§2.4): its step-2 sparing call site is inventory-agnostic and consumes the extended `owedBlocks()` result unchanged, so it stays at 1.53.0 with no bump.

---

## 1. Context

### 1.1 The 2026-11-20 silent-skip incident (drives item B)

The daily 03:00 runner (prompt sha-protected in `prompts.manifest.json`) mandates the skill-graph orphan sweep daily and the weekly consolidation on Fridays. On 2026-11-20 (Friday FULL), the run produced its manifest (`run-manifest-2026-11-20.json`) but **silently skipped the fleet-report script invocation** — the weekly triage text rolled the 11-19 results forward without invoking the script. 11-21 and 11-23 produced no runner artifacts at all (no log, no manifest): absence was invisible. The snapshot inventory shows the damage class directly — `memory/skill-graph-metrics/` has gaps at 11-04/11-05, 11-09 through 11-18, and 11-20/11-21 (verified by directory listing at HEAD). The new dashboard (`docs/skill-graph-history.html`, fleet-report v2.5.0) visualizes gaps, but visibility must also be **mechanical**: every audit run should surface a stale sweep, not require a human to open a dashboard.

### 1.2 The PR #2160 restore-then-re-collapse incident (drives item A)

T-20261123-009 (cited read-only): "the spare inventory (owedBlocks) is keyed to merge-time debt only — a session block present in the merged blob but missing from the worktree is invisible to sparing, so step-2 same-branch replace collapses a manual restore before the gate sees it … observed 2026-11-23 during PR #2160 landing: merge 98b895dc6 dropped a theirs-side block, full-union repair restored it, step 2 re-collapsed it; converged only by restoring without the branch=main segment marker."

Git evidence measured at HEAD:

- Merge `98b895dc6` (PR #2159, parents `feaa4fab7` / `a44963aa7`): for `memory/2026-11-23.md` the merged blob is **byte-identical to the theirs parent**; the ours-side `branch=main` block (subject "land U-20261122-011 …") was dropped at merge time (classic `merge-drop` debt, parent `ours`), and the theirs-side `branch=main` block (subject "land U-20261123-001 …") was **delivered into** the merged blob.
- PR #2160's branch was cut from `98b895dc6`; `176545ed1` does not touch the memory log. During the six dev-sync retries the worktree lost the theirs-side `branch=main` block without a memory-touching merge (worktree-level loss — the class Arm A merge scanning and `owedBlocks()` both cannot see), and the manual restore of that block was re-collapsed by a retry's step-2 same-branch replace, because nothing in the sparing inventory matched it.
- Convergence required restoring the block **without** its `<!-- dev-sync:session branch=main -->` marker: step 2's segment regex keys on the marker, so a marker-less block is invisible to the replace path (and step 3.88 raises no finding — the block is in the merged blob, so there is no debt). That marker-less block is still in the landed tree (`memory/2026-11-23.md:394-395`), which is the workaround's fingerprint: sparing works only for merge-time debt, so a merge-delivered block can only be kept by hiding it from step 2.

### 1.3 Current mechanics (verified)

- `owedBlocks()` (`scripts/helpers/memory-union-verify.ts:390-412`, v1.5.0 semantics) runs the same bounded sweep as `unionScan` (7 days / 20 merges, `listMemoryMerges`) and per merge-touched file computes `droppedBlocks(ours, theirs, merged)` — blocks present in a **parent** but missing from the **merged blob**. That is the merge-time inventory; the merged blob itself is parsed and then discarded.
- dev-sync step 2 (`scripts/dev-sync.ts:1109-1211`, v1.52.0 owed-set sparing): in the `hasMarkerForBranch` path it calls `owedBlocks()` (`:1124`), classifies every same-branch segment with `parseBlocks` + fingerprint match (`isOwedSegment`, `:1130-1139`: exact trimmed text, or heading+firstLine), spares owed segments verbatim, gives the fresh template to the first non-owed segment, collapses further non-owed strays, and falls through to append when every segment is owed.
- v1.5.0's head-side clarification (`scripts/helpers/memory-union-verify.ts:373-377`): the debt is deliberately computed against the merged blob, **not** the current worktree, because "debt against the CURRENT WORKTREE zeroes out exactly when a restoration is present … making the sparing unfireable in the very deadlock it exists to close."

---

## 2. Work item A — T-20261123-009: extend sparing to merge-delivered blocks (helper 1.6.0 → 1.7.0)

### 2.1 Verification verdict: CONFIRMED, with one design-critical refinement

The ticket's mechanism is confirmed: `owedBlocks()` keys on merge-time debt only, and a block that a merge **delivered into** the merged blob (present in `merged`, absent from the worktree after a non-merge loss) is invisible to sparing — `droppedBlocks` compares parents against the merged result, so a block present in `merged` produces no entry. The restore-then-re-collapse sequence from §1.2 follows deterministically.

**Refinement that shapes the fix**: the ticket's option A phrasing — "include blocks present in the merged blob but missing from the worktree" — cannot be evaluated as a run-time worktree delta. At the fateful run the restored block **is present in the worktree** (the restore happened before the run), so any inventory of the form "merged blob minus current worktree" is empty exactly when sparing must fire. This is the same unfireability v1.5.0 already diagnosed and solved for merge-time debt (§1.3, helper :373-377): the inventory must be **git-side only**, never qualified by current worktree presence. The fix therefore keeps v1.5.0's established principle and applies it one level over: membership in a recent merge's merged blob is the debt signal; no worktree subtraction.

### 2.2 Chosen approach — `merged-present` sparing class in `owedBlocks()`

In `scripts/helpers/memory-union-verify.ts` (1.6.0 → 1.7.0), inside the existing `owedBlocks()` per-file loop (no new git plumbing — the merged blob is already fetched at :398 and currently discarded after `droppedBlocks`):

1. After the existing parent-loop, emit one additional entry per block in `parseBlocks(merged)` — the blocks the merge **delivered into** the committed state — with a new required discriminator field on `OwedBlock`:
   - `source: "merge-drop"` for the existing class (parent-vs-merged debt; entries unchanged otherwise), `source: "merged-present"` for the new class.
   - For `merged-present` entries, `parent` stays `OwedBlock["parent"]` and is set to `"ours"` when the ours parent carries the block verbatim (fingerprint rules of `droppedBlocks.matchesHead`), `"theirs"` otherwise; the field is documented as informational-only for this class (a resolution-authored block in neither parent gets `"theirs"` by this rule). Sparing and tests key on `block` + `source`.
2. Worktree gating unchanged: an absent worktree file contributes nothing (the tier arms own that shape, :399-404) — the incident's file exists, so the gating does not block the fix.
3. No dedup against `merge-drop` entries is needed: a block cannot be simultaneously absent from and present in the merged blob; the classes are disjoint by construction, and sparing is a boolean `some()`.
4. **dev-sync.ts: no change.** `isOwedSegment` (`scripts/dev-sync.ts:1130-1139`) matches segments against the inventory generically; the extended inventory flows through untouched. The spared-segment DIM log line ("spared union-gate-owed block") remains accurate. No version bump for dev-sync (1.53.0 stands).
5. Consequence for the incident: restoring the theirs-side `branch=main` block **with its marker** now survives step-2 replace/collapse — the restored segment fingerprint-matches a `merged-present` entry. The marker-less workaround becomes unnecessary; the landed marker-less block remains legal (legacy blocks append/never-match, unchanged behavior).

**Accepted over-breadth (fail-safe, self-healing)**: a same-branch segment whose content matches a merged-present block is spared even when the block is also present in HEAD and the worktree (the ordinary post-merge state) — so such a segment is not replaced by the fresh template until the merge ages out of the 7-day/20-merge window. This is the same accepted consequence class v1.5.0 documented ("a block whose repair was already committed stays in the inventory until the merge ages out — the segment becomes replaceable again once the merge ages out", helper :50-54). The steady state is bounded: spared merge-delivered segments plus exactly one rolling fresh slot (the first non-owed segment keeps being replaced; the append path fires only when every segment is owed, and a committed fresh block is non-owed on the next run). Direction of failure is content preservation — the same tier-agnostic fail-safety v1.5.0 chose.

### 2.3 Alternatives rejected

| Option | Why rejected |
|---|---|
| Literal option A — "merged blob minus worktree, evaluated at run time" | Unfireable in the incident itself: the restored block is present in the worktree when step 2 runs, so the delta is empty exactly when sparing must fire (§2.1; same paradox v1.5.0 solved for merge-time debt) |
| Option B — exempt blocks whose heading+firstLine fingerprint matches "a restored block" from step-2 replacement | "Restored" has no deterministic definition without a git-side inventory — every same-branch segment matches *some* historical block's fingerprint once merge-delivered content exists; a blanket fingerprint exemption would spare every stale draft and destroy the O-4 one-block-per-branch-per-day replace contract |
| Extend the inventory to "merged-blob blocks missing from the HEAD blob" | Fires only when a later commit dropped the block; in the incident the block was worktree-lost while still in HEAD, so the gate would stay blind — and a HEAD-exclusion variant reintroduces the §2.1 paradox for the restore |

### 2.4 Test plan (`tests/unit/memory-union-verify.test.ts`, new describe block "owedBlocks merged-present sparing (T-20261123-009)")

House pattern: synthetic git fixture (the `setupOwedFixture` style, scratch repo, `sinceDays: 365`), assertions per the existing OW suite.

- **MP-T1 (required regression — reproduces restore-then-re-collapse)**: base `[A]`; side branch adds `[C]` (with marker); clean `--no-ff` merge keeps both (merged blob has `C`, zero merge-drop debt); a **plain** (non-merge) commit then removes `C` from committed state; the worktree restore writes `C` back verbatim with its marker, uncommitted. Assert: `owedBlocks()` lists `C` with `source: "merged-present"`, and the step-2 classification contract pin — `parseBlocks(restoredSegment)` fingerprint-matches the entry under the `isOwedSegment` rules (`text ===` or heading+firstLine) — is true. RED with the helper at 1.6.0 (inventory lacks `C`; the classification pin is false, which is exactly the re-collapse precondition step 2 acted on), GREEN at 1.7.0. The implementer demonstrates the red state by stashing the helper delta before the bump.
- **MP-T2 (pins the membership semantics deliberately)**: same fixture with no non-merge loss (merged = HEAD = worktree all carrying `C`) → `C` still listed as `merged-present` (accepted over-breadth documented in the test comment with the self-healing rationale).
- **MP-T3 (merge-drop class unchanged)**: the OW-T1 dropping-merge fixture → entries carry `source: "merge-drop"` with parent/commit/file labels intact (extends OW-T1 assertions).
- **MP-T4 (gating unchanged)**: absent worktree file → `[]`; `merged === null` (deleted-file arm) → contributes nothing; `sinceDays: 0` → `[]` (OW-T3/OW-T4 shapes re-asserted over the extended inventory).
- **Regression guard**: OW-T1/T2/T4 and the v1.6.0 loop-regression pin (d) stay green unchanged.

### 2.5 Risks

- **R-A1** — O-4 degradation window: post-merge reruns spare merge-delivered same-branch segments instead of refreshing them (bounded, ages out with the window; §2.2). Acceptable: content preservation outranks block-count hygiene, per the v1.5.0 precedent.
- **R-A2** — deliberate re-delete followed by re-add of identical content is indistinguishable from a restore; sparing keeps it. Same edge exists for merge-time debt today; fail-safe direction.
- **R-A3** — self-hosting bootstrap: the landing sync runs helper 1.6.0 (unsparing for the new class). The landing cannot hit the incident shape unless a memory-touching merge lands mid-retry — the same accepted R-class as the 2026-11-17 machinery batch §7.

---

## 3. Work item B — T-20261123-008 intent: snapshot freshness gate in the sync audit (audit.ts 2.70.0 → 2.71.0, new lib 1.0.0)

### 3.1 Design

**Pure helper first** (`scripts/lib/snapshot-freshness.ts`, v1.0.0, L0+L1 byte-identical pair — `scripts/lib/` is mirrored, verified against `templates/common/scripts/lib/`): the spec-landing.ts discipline ("one derivation, two callers: the gate + the unit suite", `scripts/lib/spec-landing.ts:8-12`) applied to a gate that otherwise would ship untested, since audit.ts gates have no unit suite today.

```ts
export const WARN_AFTER_DAYS = 8;   // one full missed week of the daily sweep, +1 day grace
export const FAIL_AFTER_DAYS = 15;  // two missed weeks ≈ sustained runner failure
export interface SnapshotFreshness { status: "ok" | "warn" | "fail"; latest: string | null; ageDays: number | null; detail: string; }
export function assessSnapshotFreshness(opts: { dir: string; todayIso: string; warnAfterDays?: number; failAfterDays?: number }): SnapshotFreshness
```

Finalized semantics (deterministic, thresholds as named exported constants with rationale comments):

- Directory absent → `fail` ("missing snapshot directory").
- No `snapshot-YYYY-MM-DD.json` entries (empty dir, or only non-matching names — malformed names are ignored deterministically) → `fail` ("zero snapshots").
- Latest = lexicographic maximum of the matching filename dates (ISO dates sort correctly as strings); `ageDays` = calendar-day difference between `todayIso` and the latest date; `ageDays > failAfterDays` → `fail`; `ageDays > warnAfterDays` → `warn`; else `ok`. Boundary spelling: 8 days → ok, 9 → warn, 15 → warn, 16 → fail (the ticket language "older than 8/15").
- `todayIso` is injected by the caller (pure/testable); the audit call site passes `kstDate()` (`scripts/helpers/kst-time.ts:11`) — snapshot filenames are written in local (KST) calendar dates by fleet-report ("one per local calendar date", `scripts/SCRIPTS.md:441`).

**Freshness signal = filename date, not mtime**: mtimes are not stable across clones (a fresh clone would false-FAIL); committed filenames are facts.

**Audit gate** (`scripts/audit.ts` 2.70.0 → 2.71.0), following the auto-activating drift-gate pattern exactly (`scripts/audit.ts:4204-4222`): a new block inserted immediately after the skill-graph drift gate, before the upgrade coverage gate. Activation discriminator: the workspace root context via `fs.existsSync(path.join("templates"))` — the established L0 discriminator (the upgrade-coverage gate self-skips at "project (L2) context (no templates/ tree)", audit.ts:4226-4229). Rationale: the fleet sweep and its snapshot dir are root-only (U-20261123-003 independently confirms fleet-report is L0-layer); variant/project audits must not FAIL on a directory they legitimately lack. Within the root context: missing dir → FAIL, zero snapshots → FAIL, stale → WARN/FAIL per the helper; fresh → `Pass(...)` (gate-family precedent, drift gate :4220).

Runs on **every audit invocation**, including dev-sync step 3.9's `--spec-check --lifecycle-only` call — the same every-invocation property the drift gate has (dev-sync 1.53.0 header, :5-7), and exactly what the ticket intent requires ("every dev-sync/audit run surfaces staleness").

**Messages — distinctive and greppable above the ~98 pre-existing daily WARNs** (the `skill-graph snapshot freshness:` token appears nowhere else in audit output):

- `[WARN] skill-graph snapshot freshness: latest snapshot is 9 days old (snapshot-2026-11-14.json, WARN threshold 8) — the 03:00 runner fleet sweep has not written a snapshot in over a week; check the runner log`
- `[FAIL] skill-graph snapshot freshness: latest snapshot is 16 days old (snapshot-2026-11-07.json, FAIL threshold 15) — two missed weeks of the 03:00 runner fleet sweep; check the runner`
- `[FAIL] skill-graph snapshot freshness: no snapshot directory memory/skill-graph-metrics — the 03:00 runner fleet sweep has never produced a snapshot`
- `[FAIL] skill-graph snapshot freshness: zero snapshots in memory/skill-graph-metrics — the 03:00 runner fleet sweep has never produced a snapshot`

The gate call site stays thin: `existsSync` discriminator, one `readdirSync`, one helper call, `Warn`/`Fail`/`Pass` mapping through the existing helpers (audit.ts:478-487). All semantics live in the lib.

### 3.2 Alternatives rejected

| Option | Why rejected |
|---|---|
| Runner-side mandatory skip ledger (T-008's literal request) | Correct long-term but requires touching the sha-protected runner prompt (`prompts.manifest.json`) — a stated non-goal. The audit gate achieves the loud-failure goal without it; the ledger remains available as a follow-up if the owner wants runner-native accounting |
| mtime-based freshness | Not clone-stable — a fresh clone false-FAILs; filename dates are committed facts |
| Inline semantics in audit.ts | Audit gates are not unit-tested today; the spec-landing discipline exists precisely to extract pure logic ("one derivation, two callers") |
| Activation keyed on the snapshot dir existing | "Missing snapshot dir → FAIL" could never fire — the activation condition would exclude the very state the gate must catch |

### 3.3 Test plan (`tests/unit/snapshot-freshness.test.ts`, new)

Fixture dirs under a tmpdir; `todayIso` injected for determinism:

- **SF-T1** latest snapshot today → ok. **SF-T2** latest exactly 8 days old → ok (boundary). **SF-T3** 9 days old → warn. **SF-T4** exactly 15 days old → warn (boundary). **SF-T5** 16 days old → fail. **SF-T6** missing directory → fail ("missing snapshot directory"). **SF-T7** empty directory → fail ("zero snapshots"). **SF-T8** only malformed filenames (`snapshot-foo.json`, `notes.txt`) → fail ("zero snapshots"). **SF-T9** multiple snapshots → lexicographic max wins. **SF-T10** injected `warnAfterDays`/`failAfterDays` overrides respected (contract pin).

Gate-level assertion is covered by the pure-helper suite plus the call site's thinness (mapping only); the drift-gate pattern has no gate-level suite today and this design does not add one.

### 3.4 Risks

- **R-B1** — false WARN while the owner is traveling: 8+ days without a sweep WARNs on every sync until a snapshot lands. Intended — that is the mechanical visibility the ticket asks for; the message names the recovery path.
- **R-B2** — lifecycle-only amplification: the WARN/FAIL surfaces on every dev-sync run via step 3.9. Accepted by design (the drift gate set the precedent); FAIL blocks syncs after 15 silent days, which is the point of "mechanical".
- **R-B3** — Projects/co-* audits and variant upgrades run the mirrored audit: the `templates/` discriminator self-skips them; verified by SF-suite + one manual variant-context run in verification.

---

## 4. Work item C — O-2: stale fleet-report usage prose (one line)

`templates/common/scripts/SCRIPTS.md:340` reads `**Usage**: bun scripts/skill-graph-fleet-report.ts [--json] [--snapshot-dir <dir>]` — it predates the `--html`/`--no-html` flags (fleet-report v2.5.0, landed today). Refresh the usage line to align with root `scripts/SCRIPTS.md:448` (the coordinator's ":444" points at the prose block start; the measured Usage line is :448): append `[--html <path>] [--no-html]`. Nothing else in the entry changes in this batch.

**Folded observation (recorded, out of scope)**: the same template entry's "Runs automatically" prose (:345-347) still says "02:30 ticket runner" and "the snapshot is the only write", where the root entry (:449-451) says the 03:00 runner and the auto-emitted dashboard. Left for a future doc pass so this item stays one line per O-2.

---

## 5. Ticket claims checked (summary)

| Ticket | Claim | Finding |
|---|---|---|
| T-009 | owedBlocks is keyed to merge-time debt only | **Confirmed** — `droppedBlocks(ours, theirs, merged)` per scanned merge (helper :390-412); merged-blob-present blocks produce no entry |
| T-009 | restore re-collapsed by step-2 same-branch replace | **Confirmed** — step-2 `isOwedSegment` matches only the merge-time inventory (dev-sync :1130-1139); incident git shape verified (§1.2) |
| T-009 | converged only by restoring without the `branch=` marker | **Confirmed** — marker-less block present in the landed tree (memory/2026-11-23.md:394-395); step 2's segment regex keys on the marker (:1125) |
| T-009 option A as literally worded | "merged blob minus worktree" | **Excluded as unfireable** — a run-time worktree delta is empty exactly when the restored block needs sparing (§2.1; v1.5.0 solved the identical paradox for merge-time debt) |
| T-008 | 11-20 FULL ran but sweep silently skipped; 11-21/11-23 no artifacts | **Confirmed via ticket + snapshot gaps** (11-04/05, 11-09..11-18, 11-20/21 missing in `memory/skill-graph-metrics/`) |
| T-008 | runner prompt must not change | Honored as a non-goal — the audit gate needs no prompt/manifest change |
| O-2 | template SCRIPTS.md fleet-report usage predates `--html`/`--no-html` | **Confirmed** — :340 vs root :448 |

## 6. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | The freshness gate surfaces on every `/sync` (audit step 3.9 auto-activates it); no `.claude/` command change; skill mirrors refresh through /sync untouched | `scripts/audit.ts`, `scripts/lib/snapshot-freshness.ts` |
| Antigravity (GEMINI.md) | No GEMINI.md text change — it does not restate audit or sparing behavior. Byte-pair mirrors land with the PR (176545ed1 convention). | Mirrors only |
| Codex / Hermes / ZCode | Same as Antigravity — platform mirrors refresh; no platform config change. | Mirrors only |
| templates/common | Byte-identical pairs landed in the PR: `templates/common/scripts/helpers/memory-union-verify.ts`, `templates/common/scripts/lib/snapshot-freshness.ts` (new), `templates/common/scripts/audit.ts`; plus the O-2 doc row and SCRIPTS.md registry rows. `scripts/dev-sync.ts` has no mirror churn (unchanged). | As listed |

Cross-platform: no new subprocess patterns beyond audit's existing `existsSync`/`readdirSync` (sync fs, no shells); UTF-8/LF text writes only where pre-existing behavior already writes.

**Accessibility statement**: backend and tooling changes only (CLI scripts, one audit log line, one doc row). No UI, rendered page, or style change. Exempt from ADR-0065 by this explicit statement.

**Preview Verification statement**: non-UI change; nothing to preview in a browser. Exempt. Verification is by unit tests and gate runs (§2.4, §3.3, §7).

## 7. Rollout, verification plan, bootstrap

**Single PR, three commits** (items independent; one review surface; rollback = single revert):

1. **Commit A (T-009)**: helper 1.6.0 → 1.7.0 (root + helpers mirror byte-identical), `tests/unit/memory-union-verify.test.ts` MP-T1..T4 + extended OW assertions, registry rows: `docs/VERSION_MANIFEST.md` (helper row → 1.7.0), `scripts/SCRIPTS.md:203` row (L0+L1, 1.7.0 with change note), `templates/common/scripts/SCRIPTS.md` mirror row. RED/GREEN protocol for MP-T1 documented in the PR body (stash the helper delta → red → unstash → green).
2. **Commit B (T-008 intent)**: `scripts/lib/snapshot-freshness.ts` 1.0.0 (root + new lib mirror byte-identical), audit.ts 2.70.0 → 2.71.0 (header row + gate block after :4222), `tests/unit/snapshot-freshness.test.ts` SF-T1..T10, registry rows in all three registries (audit row bump + new lib row, both SCRIPTS.md files).
3. **Commit C (O-2)**: the one-line usage refresh at `templates/common/scripts/SCRIPTS.md:340`.

**Verification plan** (all must pass before merge):
- `bun test tests/unit/memory-union-verify.test.ts tests/unit/snapshot-freshness.test.ts` — 0 fail, MP-T1 demonstrated red pre-fix.
- Byte parity: `diff -q` on each of the three root↔template pairs; `bun scripts/audit.ts` mirror-parity arm reports zero failures (v2.70.0 `collectMirrorParityFailures`, CRLF/scrub-tolerant — no CONSTITUTION-substitution deltas expected in these files).
- Live gate check at root: with the current snapshot (`snapshot-2026-11-23.json`, age 0) the gate emits its Pass line; a temporary `--snapshot-dir`-style fixture or a renamed-dir dry run exercises the FAIL arm once, then restores.
- Variant-context check: run the mirrored audit in a project tree without `templates/` — no freshness lines in output (self-skip verified).
- Full suite: `bun run test:unit` — 0 fail; all existing gates green (`bun scripts/audit.ts` exit unchanged on the clean tree).

**Bootstrap (self-hosting)**: the landing `/sync` runs audit 2.70.0 (no freshness gate — harmless) and helper 1.6.0 (merge-delivered blocks unspared). The landing cannot hit the incident shape unless a memory-touching merge lands mid-retry (§2.5 R-A3). After merge, the next sync exercises the freshness gate against real state and the next post-merge rerun exercises the extended sparing.

**Rollback**: revert the PR. Helper semantics return to merge-time-only sparing (today's behavior — the incident class becomes possible again, no corruption); the freshness gate disappears (observability loss only); the registry rows and doc line revert with the PR. No data migration, no snapshot schema change (explicit non-goal), no state to unwind — the gate is read-only and sparing is behavior-only.

## 8. Owner decisions (open; defaults apply unless the owner objects)

- **OA-1 (item A)**: sparing inventory = git-side merged-blob membership (no run-time worktree delta). Alternative: the ticket's literal "merged blob minus worktree" — rejected as unfireable in the incident itself (§2.1). Default: membership.
- **OA-2 (item B)**: gate activation = root discriminator (`templates/` exists), firing on every audit invocation. Alternative: activate on snapshot-dir existence — rejected (the missing-dir FAIL could never fire). Default: root discriminator.
- **OA-3 (item B)**: fresh state emits a `Pass` line. Alternative: silent-ok to reduce log volume. Default: Pass, matching the drift-gate/upgrade-coverage/surface-registry gate family.

## 9. Acceptance criteria

Item A (T-009):
- [ ] MP-T1 regression test reproduces the restore-then-re-collapse precondition — RED with the helper at 1.6.0 (restored block absent from the inventory; sparing classification false) and GREEN at 1.7.0 (listed as `merged-present`; `isOwedSegment`-rule fingerprint match true).
- [ ] A verbatim restore **with** its `branch=` marker survives step-2 classification — the marker-less workaround is no longer required.
- [ ] The merge-time debt class is unchanged: `source: "merge-drop"` entries keep parent/commit/file labels; OW-T1/T2/T4 and the v1.6.0 loop-regression pin stay green.
- [ ] No new git plumbing: `owedBlocks()` makes the same `showBlob` calls as 1.6.0 (the merged blob is parsed, not discarded).
- [ ] `scripts/dev-sync.ts` is byte-unchanged (stays 1.53.0; no mirror churn for it).

Item B (T-008 intent):
- [ ] The freshness gate fires WARN at age > 8 days and FAIL at age > 15 days on fixture states (9d → `[WARN] skill-graph snapshot freshness:` line; 16d → `[FAIL] skill-graph snapshot freshness:` line); exactly 8 → ok; exactly 15 → WARN (SF-T1..T5).
- [ ] Missing snapshot dir → FAIL; empty dir and malformed-names-only dir → FAIL; multiple snapshots → latest wins (SF-T6..T9).
- [ ] The message prefixes `skill-graph snapshot freshness:` are unique in audit output (greppable above the ~98 pre-existing WARNs).
- [ ] The gate self-skips outside the root context — a project-tree audit emits no freshness lines.
- [ ] audit.ts 2.70.0 → 2.71.0; `scripts/lib/snapshot-freshness.ts` 1.0.0 registered; rows updated in `docs/VERSION_MANIFEST.md`, `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md`.
- [ ] No change to `prompts.manifest.json`, the runner prompt, or the snapshot schema.

Item C (O-2):
- [ ] `templates/common/scripts/SCRIPTS.md:340` usage line carries `[--html <path>] [--no-html]`, matching the root entry's flag sequence (:448).

Global:
- [ ] Byte parity root↔templates holds for all three touched pairs (`diff -q` clean; audit mirror-parity arm zero failures).
- [ ] All existing gates stay green; full suite `bun run test:unit` — 0 fail.
