# memory-union-verify: archival tier satisfies archived block-drop findings — Design (Row 0)

- **Spec ID**: `2026-11-18-memory-union-archival-tier-design`
- **Date**: 2026-11-18
- **Status**: implemented
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074)
- **Input tickets**: T-20261117-008 (backlog — filed 2026-11-17 after three live /sync FATALs on co-deck PR-2/PR-4/PR-5)
- **Decision record**: none — non-gate design work; per house precedent a DEC is not required where no gate ruling is made, and the ticket itself is the decision record
- **Related specs** (extended, not duplicated): [`2026-11-05-merge-integrity-design.md`](2026-11-05-merge-integrity-design.md) §5.1 (the gate's origin), [`2026-11-17-root-machinery-batch-design.md`](2026-11-17-root-machinery-batch-design.md) §6 (folded this same observation as a follow-up candidate; its id guess `T-20261117-006` was consumed by the pitch defect — T-20261117-008 is the actual filing)
- **File:line currency**: all references measured on the workspace root at origin/main `d25ea54a4` (`scripts/helpers/memory-union-verify.ts` @ 1.3.0, `scripts/dev-sync.ts` @ 1.50.0).

## 0. Summary

One file, one tier arm: `scripts/helpers/memory-union-verify.ts` v1.3.0 → v1.4.0 extends the repaired-at-head archival tier so a block-drop finding on a merge whose touched log was **later archived** can be tiered non-blocking from tracked evidence alone. The shipped v1.2.0 archive fallback only satisfies the finding when the local gitignored `memory/archive/<basename>` copy exists **and** carries the parent-owed blocks; on a fresh worktree the archive copy does not exist, so the finding stays FATAL until the merge ages out of the 7-day window. The fix consults the MEMORY.md tombstone row — tracked, and already the accepted positive-evidence token in this gate's v1.1.1 arm — when neither the worktree file nor the archive copy is readable.

## 1. Problem (verification verdict: CONFIRMED)

The archival tier in `unionScan`'s findings branch (`scripts/helpers/memory-union-verify.ts:495-515`) fires **only** through two evidence paths:

1. worktree file readable and `repairedAtHead` against it (v1.1.0 arm), or
2. worktree file absent → `memory/archive/<basename>` readable and `repairedAtHead` against it (v1.2.0 arm, T-20261106-007).

The T-20261117-008 shape escapes both. Merge `59ad0495695f` (PR #2040, 2026-11-15, post-gate-activation) dropped two Session Summary blocks from the ours side of `memory/2026-11-08.md` and `memory/2026-11-09.md` — the files **existed at the merge**, so the v1.1.1 `merged === null` tombstone arm never runs. Housekeeping `c5c57d10b` later archived both whole files with MEMORY.md tombstone rows, so the worktree files are gone and the only repair surface is the local, gitignored `memory/archive/` (`.gitignore` line 190). Consequences:

- **Blocking forever on fresh worktrees** — the archive copy is local-only, so a pristine worktree (reproduced at origin/main `282b91e54` with zero working-tree changes) re-FATALs with the same 2 blocking groups via the exact pipeline `unionScan`, until the merge ages out (~2026-11-22).
- **The gate's repair guidance fights step 3.8** — "restore the named block(s) in the working tree and re-commit" re-creates a 9-day-old file that archive-memory immediately re-archives; this is the T-20261106-007 deadlock re-appearing one level up (the archive holds the repair, but only where a human placed it).
- **Three manual repairs on 2026-11-17** (co-deck PR-2 first run, PR-4, PR-5): each required hand-placing repaired blobs into gitignored `memory/archive/` — a repair that cannot propagate.

## 2. Proposed change — helpers/memory-union-verify.ts v1.3.0 → 1.4.0

Extend the archival tier inside `unionScan`'s findings branch only. The evidence ladder becomes:

| Evidence available at scan time | Tier | Since |
|---|---|---|
| Worktree file readable and carries every parent-owed block (`repairedAtHead`) | `repaired-at-head` (INFO) | v1.1.0 — unchanged |
| Worktree absent; archive copy readable and carries the union of both parents' blocks (or at least every named dropped block — `repairedAtHead` is exactly that predicate) | `repaired-at-head` (INFO) | v1.2.0 — unchanged |
| **Worktree absent; archive copy absent (fresh clone); MEMORY.md tombstone row present for the file** (`^\| <base> \|`, the same regex as the v1.1.1 `merged === null` arm) | **`historical` (WARN)** | **v1.4.0 — new** |
| Worktree/archive readable but do **not** carry the parent-union | `blocking` | unchanged — fail-closed; locally actionable (place a repaired blob in `memory/archive/` or restore in the worktree) |
| No tombstone, no archive, no worktree repair | `blocking` | unchanged — fail-closed |

Design notes:

- **Keyed on the existing machinery, not duplicated.** The new arm reuses the v1.1.1 tombstone-detection regex (`new RegExp('^\\| ' + base + ' \\|', 'm')` against `memory/MEMORY.md`) and the existing fail-closed catch structure. No new lookup, no new state.
- **Why `historical` (WARN) and not `repaired-at-head` (INFO):** the tombstone proves *sanctioned archival* — the same positive-evidence-only posture as v1.1.1 — but it does not prove the parent-owed blocks survived anywhere readable. WARN is the honest severity: immutable history cannot be repaired from a fresh clone, the finding ages out with the 7-day window, and the drop content stays recoverable from git (`git show <merge>^N:<file>`). Where the archive copy exists and carries the blocks, the stricter INFO arm already fires first.
- **`memory/MEMORY.md` unreadable → keep the original tier** (fail-closed, same catch posture as the v1.1.1 arm).

## 3. Test plan

Unit additions to `tests/unit/memory-union-verify.test.ts` (scratch git fixture dir, same `mkdtempSync` pattern as the existing suites):

- **T2 (the T-20261117-008 fixture)**: dropping merge — file exists at the merge with a block dropped; a later housekeeping commit removes the file and adds the MEMORY.md tombstone row; no `memory/archive/` → `unionScan` reports the group at tier `historical`. This is the fresh-worktree simulation.
- **T3**: same fixture without the tombstone row → stays `blocking` (fail-closed; the existing "absent from both" test covers the no-tombstone shape, this pins it alongside archival).
- **T4**: tombstone row present + archive copy present but **without** the parent-union (the damaged-archive shape) → stays `blocking` (readable evidence outranks provenance).
- **T5**: tombstone row present + archive copy carrying the parent-union → `repaired-at-head` (pins the v1.2.0 arm in the archival-provenance context).
- Regression: the full existing suite stays green, including the v1.3.0 comment-relaxation pin (tests/unit/dev-sync-rerun-hygiene.test.ts B-T8) and the v1.1.0/v1.1.1/v1.2.0 fixtures.

## 4. Risks

- **R1 — WARN masks an unrepaired drop on fresh clones for ≤ 7 days.** Accepted degradation (ticket + machinery design §6 both call for it): the finding is unactionable on the clone (archive is local-only, blob immutable), the evidence is tracked, and it ages out with the window. The severity is WARN, not silence.
- **R2 — gate reads gitignored working-tree state.** Already the accepted v1.2.0 pattern (`memory/archive/` read from the working tree); no new surface, no tracked-path change.
- **R3 — tombstone false positive** (a MEMORY.md row for a file never archived). Same regex and same shipped posture as the v1.1.1 arm; the row exists only because archive-memory tombstoned it or an editor followed the documented convention.
- **R4 — dev-sync step-3.88 wording**: an archival-tiered post-activation group prints under the historical line, which says "pre-activation merge finding group(s)". Severity (WARN), non-blockingness, and aging are all correct; only the label is imprecise. Fixing the label means a second L1 mirror (dev-sync.ts) — deliberately out of scope here; recorded as a wording-only follow-up.

## 5. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no Claude-specific surface; behavior change is inside the shared dev-sync pipeline | N/A |
| Antigravity (GEMINI.md) | None — GEMINI.md does not restate memory union-verify behavior; skill mirrors refresh through /sync | N/A |
| templates/common | L1 mirror: `templates/common/scripts/helpers/memory-union-verify.ts` refreshed byte-identical by the /sync publish step (`propagate:apply` generator) | `templates/common/scripts/helpers/memory-union-verify.ts` |

## 6. Acceptance criteria

- [ ] A post-activation block-drop finding on a merge whose log was later archived (tombstone row present), with no worktree file and no archive copy, scans tier `historical` — the T-20261117-008 fresh-worktree shape passes non-blocking (T2).
- [ ] Without the tombstone row the same shape stays `blocking` (T3).
- [ ] With the archive copy readable but damaged, the finding stays `blocking` (T4).
- [ ] With the archive copy carrying the parent-union, the finding re-tiers `repaired-at-head` (T5).
- [ ] `bun run test:unit`, `bun scripts/verify-scripts.ts`, and `bun scripts/audit.ts` pass; L1 mirror byte-identical after publish.

## 7. Explicitly out of scope

- Changing **what counts as a drop** — detection rules (design §5.1 rule 4, `droppedBlocks`) are untouched.
- The **stop-file semantics ruling** (the runner's open issue) — separate decision, no change here.
- The dev-sync step-3.88 historical-line wording (R4) — wording-only follow-up.
- The machinery §6 alternative (a tracked archive index of block hashes) — heavier provenance machinery; unnecessary for the filed failure since the tombstone row is already tracked evidence.
