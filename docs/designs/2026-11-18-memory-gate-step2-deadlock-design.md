# memory union-verify × dev-sync step 2: spare gate-owed blocks in the same-branch session replace — Design (Row 0)

- **Spec ID**: `2026-11-18-memory-gate-step2-deadlock-design`
- **Date**: 2026-11-18
- **Status**: implemented (design ratified and registered; implementation lands in T-20261118-003's follow-up PR — the registry marks the design activity per the Row 0 house pattern)
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074)
- **Input ticket**: T-20261118-003 (backlog — filed 2026-11-18 after the #2069 pin-move landing; evidence: merges 41d725f9 / 71e87cc9 fused the `_bgpool` session block into the trail-learnings block; the first two /sync attempts FATALed; the landing only succeeded via the PR-branch workaround)
- **Decision record**: none — the ticket is the decision record; no governance-gate ruling emerged (the ruling here is an intra-pipeline design decision, not an ADR-level policy change)
- **Related specs** (extended, not duplicated): [`2026-11-05-merge-integrity-design.md`](2026-11-05-merge-integrity-design.md) §5.1 (the gate's origin), [`2026-11-17-root-machinery-batch-design.md`](2026-11-17-root-machinery-batch-design.md) §2 change B2 / owner default O-4 (the replace semantics' origin), [`2026-11-18-memory-union-archival-tier-design.md`](2026-11-18-memory-union-archival-tier-design.md) (the v1.4.0 evidence ladder this design sits beside)
- **File:line currency**: all references measured on the workspace root working tree, 2026-11-18; `scripts/dev-sync.ts` @ 1.50.0, `scripts/helpers/memory-union-verify.ts` @ 1.4.0.

## 0. Summary

Two shipped mechanisms collide on direct-to-`main` sync landings: dev-sync step 2's branch-keyed session-block replace (B2, v1.50.0) destroys any working-tree block whose `<!-- dev-sync:session branch=… -->` marker matches the session branch, while step 3.88's union-verify gate demands exactly such a block be restored and kept. The result is a FATAL loop: every restore is re-collapsed before the gate reads it. Fix ruling: **step 2's replace path gains a scoped exception — a same-branch segment that the union gate currently owes (a parent-owed block per `droppedBlocks`) is spared from replacement and collapse**; the gate's printed repair guidance is sharpened to name the merge-touched file and prescribe an action that survives the next run. Normal-path behavior is bit-identical; the O-4 dedupe invariant is untouched.

## 1. Problem (verification verdict: CONFIRMED)

### 1.1 The two mechanisms

**Step 2 — branch-keyed session-block replace** (`scripts/dev-sync.ts:999-1113`). B2 (v1.50.0, owner default O-4: one session block per branch per day, carried by an explicit marker comment) resolves the session branch (`:1005-1017`), then:

- `:1029-1039` — if today's log (`memory/<date>.md`, `:976` — **today's file only**) contains the marker line for THIS branch, `hasMarkerForBranch = true`;
- `:1041-1086` — the replace path: a global regex (`:1077-1080`) matches every marker-plus-block segment for this branch (marker through the next `\n---\n` boundary or EOF); `:1082` gives the fresh block template to the **first** match in file order and replaces every further match with `""` — the collapse. The write lands at `:1083`.

Step 2 keys the decision on the **marker line alone** — it cannot distinguish "this session's stale draft from a previous failed run" (the block the replace path exists to clean up) from "a historical block restored into the working tree" (content the gate owes).

**Step 3.88 — memory union-verify** (`scripts/dev-sync.ts:1364-1440`). Arm A sweeps bounded recent merges (7 days AND 20 merges, `:1390`) via `unionScan` (`scripts/helpers/memory-union-verify.ts:469-569`). A post-activation merge finding whose parent-owed blocks are not accounted for in the **current working-tree content** tiers `blocking` (helper `:519-531` reads the worktree file and consults `repairedAtHead`, `:304-313`; not repaired → original tier stands) and FATALs (`dev-sync.ts:1394-1405`) with the printed guidance:

> `Fix: compare git show <merge>:<file> against git show <merge>^1:<file> and git show <merge>^2:<file>; restore the named block(s) in the working tree and re-commit (history is immutable — the repair lands forward).` (`dev-sync.ts:1401-1403`)

The parent-owed set is computed by `droppedBlocks` (helper `:271-291`): strict trimmed-text fingerprint, heading+firstLine fallback for headed blocks — the same rules `repairedAtHead` re-checks against the worktree.

### 1.2 The deadlock chain (file:line)

For a session whose branch is the branch the owed blocks carry (in practice `main`, the root-sync landing branch):

1. Merge M (post-activation) drops or fuses a `branch=main`-marked session block in the merge-touched log → `unionScan` reports a `blocking` group (helper `:513-531`, tier `:576-581`).
2. Step 3.88 FATALs (`dev-sync.ts:1394-1405`) and prints the restore guidance (`:1401-1403`). The run exits before any commit.
3. The user follows the guidance: restores the owed block verbatim into the named file — the block carries `<!-- dev-sync:session branch=main -->`.
4. Next /sync run, **step 2 runs first**: `hasMarkerForBranch` is true (`:1031` — the marker line exists, regardless of which segment carries it); the global regex (`:1077-1080`) matches **both** the previous run's draft segment and the restored owed segment; `:1082` collapses one of them and overwrites the other with the fresh template. **The restored gate-owed block is destroyed.**
5. Step 3.88 then re-reads the working tree (helper `:528`): the owed block is gone again → `repairedAtHead` false (`:304-313`) → tier stays `blocking` → **FATAL again** (`dev-sync.ts:1394`).

Every attempt re-enters at step 3. The loop is structural, not incidental: the guidance-prescribed action is exactly the action step 2 undoes.

**Non-`main` branches are immune**: a restored block carrying a different branch's marker is never matched by step 2's regex (marker keyed on `sessionBranch`, `:1017`, `:1050`, `:1078`) — it survives, `repairedAtHead` credits it, the group tiers `repaired-at-head` (INFO, helper `:526-531`), and the run commits the repair forward. That is precisely why the #2069 workaround (run the sync on a PR branch) functioned — and why it is a workaround, not a fix: it is unavailable when a landing must hit `main` directly, and it silently depends on HEAD already carrying the owed blocks.

### 1.3 Scope condition

The collision requires a **same-branch marker segment to exist in the file step 2 rewrites** — today's log (`:976`). Restorations into older merge-touched logs are already durable (step 2 never touches those files; `repairedAtHead` reads the merge-touched path, helper `:528`). The fix below is scoped to same-branch segments of the rewritten file but keys the owed set window-wide, which also fail-safely covers the misplaced-restore shape.

### 1.4 The guidance defect (related deadlock, ticket task 3)

The printed Fix line (`dev-sync.ts:1401-1403`) has two defects independent of the mechanical fix:

1. **It names no file.** `repairedAtHead` credits a restoration only in the merge-touched path (helper `:528`); restoring the block into the wrong log (e.g. today's file when the merge touched an older one) satisfies nothing. The guidance must name `<file>`.
2. **It prescribes an action the next run undoes on `main`** (§1.2). With the mechanical fix adopted this becomes false on every branch — but the wording should also say *re-run /sync* rather than "re-commit": at FATAL time there is no staged commit to amend; the repair lands via the next successful run's commit.

## 2. Options considered and ruling

| Option | Mechanism | Preserves O-4 dedupe? | Preserves repair durability? | Change surface | Verdict |
|---|---|---|---|---|---|
| **(a) Step-2 sparing** — the replace path consults the gate's owed set; owed same-branch segments are never replaced or collapsed | conditional exception in the composition layer | **yes** — stale drafts (the dedupe target) still replaced; only gate-owed segments spared | **yes** — restored content survives to the commit; `repairedAtHead` credits it; finding ages out | `dev-sync.ts` step 2 + one new exported helper function | **ADOPTED** |
| (b) Gate-side tier extension — treat working-tree restored state as satisfying `repaired-at-head` when session branch is `main` | tier logic only | n/a | **no** — by the time 3.88 evaluates, step 2 has already destroyed the restore; any variant that credits *collapsed* content is fail-open (silences a real drop as INFO); the reorder variant (evaluate the tier before step 2) passes the gate while the same run's commit re-destroys the repair — a slower deadlock | `memory-union-verify.ts` + pipeline order | **REJECTED** |
| (c) Routing fix — replace/collapse only applies to PR-branch sessions; root (`main`) sessions append-only | semantics change keyed on landing context | **no** — every failed attempt on `main` appends a near-duplicate block; that is exactly the duplicate-block-per-re-run noise B2 (v1.50.0, yesterday) shipped to remove (machinery design defect U-012 (2)) | yes (trivially — nothing is ever collapsed) | `dev-sync.ts` step 2 | **REJECTED** |
| (d1) Reorder step 2 after 3.88 | pipeline order | n/a | **no** — the gate passes, then step 2 collapses the restored block, and the run commits the collapse (§1.2 analysis) | pipeline order | **REJECTED** (documented alternative) |
| (d2) Run-identity markers (`branch=<b> id=<uuid>`) | marker format | **no** — every run appends (ids differ), defeating per-branch-per-day dedupe entirely | yes | marker format + all consumers | **REJECTED** |
| (d3) Guidance-only — route `main` sessions to the PR-branch recipe in the printed text | text only | yes | partial — the trap remains for any deviation from the printed recipe; the guidance/pipeline "fights at the seams" class (T-20261106-007, T-20261117-008) keeps recurring exactly where mechanics and text disagree | `dev-sync.ts` string | **ADOPTED as a component** (mandatory regardless; not sufficient alone) |

**Ruling: (a) + (d3).** Reasons:

1. **The O-4 invariant's original purpose is preserved, not amended.** The one-block-per-branch-per-day rule exists to dedupe repeated same-day runs (machinery design §2: "duplicate session block on every re-run"). A gate-owed restored block is not a repeated run's draft — it is historical parent content that collides with the marker namespace the invariant did not anticipate. Sparing it corrects the collision without touching the dedupe behavior for its actual target.
2. **The change is conditional and fail-safe.** The normal path (exactly one same-branch segment, not owed) is bit-identical. The exception fires only in the deadlock condition itself. The failure direction of a misclassification is "content preserved" — never content loss.
3. **Blast radius is the smallest that actually fixes the mechanism.** No pipeline reordering (d1), no tier-logic semantics change (b), no per-branch behavior fork (c). Two files, both already L0↔L1 mirrored and unit-pinned.
4. **The guidance becomes honest.** After (a), "restore and re-run /sync" is true on every branch; (d3) sharpens it to name the file and the block shape.

## 3. Exact change spec

### 3.1 `scripts/helpers/memory-union-verify.ts` v1.4.0 → 1.5.0

New exported aggregate (pure composition of existing functions; no new git plumbing):

```ts
export interface OwedBlock {
  commit: string;                       // owning merge commit (full hash)
  file: string;                         // merge-touched flat memory log, repo-relative
  parent: "ours" | "theirs";            // which parent owes the block
  block: MemoryBlock;                   // the owed block (text / heading / firstLine)
}
export function owedBlocks(opts: {
  sinceDays: number;
  maxCommits: number;
  cwd?: string;
  // deliberately NO activationIso — see note
}): OwedBlock[]
```

Semantics: run `listMemoryMerges` (same bounded window as `unionScan`); for each merge-touched file, read the **current worktree content** (`readFileSync`; absent file → contribute nothing — the tier arms at `:484-563` already own that shape); compute `droppedBlocks(ours, theirs, head)`; emit each dropped block parent- and commit-labeled. No tier logic — the caller needs only the debt inventory.

**No `activationIso` parameter, deliberately**: sparing is tier-agnostic (a WARN-tier owed block spared is harmless, and fail-safe), and this keeps step 2 free of `GATE_3_88_ACTIVATED_AT` — which is declared at `dev-sync.ts:1388`, *after* step 2 in this top-level-await script, and would TDZ if referenced earlier.

### 3.2 `scripts/dev-sync.ts` v1.50.0 → 1.51.0 — step 2 replace path

1. **Import** (`:554`): extend with `owedBlocks` (and `parseBlocks` for segment classification).
2. **Trigger**: inside `hasMarkerForBranch` only (`:1041`) — the append path never destroys content, so it needs no owed set. Compute once: `const owed = owedBlocks({ sinceDays: 7, maxCommits: 20 })`.
3. **Classification**: parse each same-branch segment with `parseBlocks` (a segment parses to exactly one `MemoryBlock`; the leading marker line is not a `## ` line). Segment is **owed** iff ∃ `o ∈ owed`: `o.block.text === segment.text`, or `o.block.heading !== "" && o.block.heading === segment.heading && o.block.firstLine === segment.firstLine` — the same match rules as `droppedBlocks.matchesHead` (helper `:277-279`).
4. **Replace-loop rewrite** (`:1077-1082`): iterate matches; owed → return the match verbatim (spared, one DIM log line naming the spared branch-day block); non-owed → the **first non-owed** match gets `blockTemplate`, further non-owed matches collapse to `""` (stray-draft dedupe unchanged). Log line reports replaced / collapsed / spared counts.
5. **Skills carry-forward** (`:1048-1058`): key the old-segment extraction on the segment actually being replaced — the first **non-owed** segment. If every same-branch segment is owed (no replacement target), fall through to the append path (fresh block appended; append-path `## Skills Used` rule applies).
6. **Guidance rewrite** (`:1401-1403`) — exact replacement:

   ```
   Fix: compare git show <merge>:<file> against git show <merge>^1:<file> and git show <merge>^2:<file>; restore the named block(s) INTO <file> in the working tree as separate '---'-delimited block(s), verbatim, then re-run /sync — the repair is committed forward (the session-block replace spares union-owed blocks).
   ```

   Arm B's guidance (`:1432-1434`) is unchanged: structural repairs carry no parent debt, so step 2's replace cannot re-break them.

### 3.3 Mirrors and delivery

Both files are L0↔L1 byte-identical mirrors (`templates/common/scripts/dev-sync.ts`, `templates/common/scripts/helpers/memory-union-verify.ts`; step 3.7 drift check enforces identity at sync time; the L0→L1 publish steps deliver during /sync — self-hosting per the machinery design §7). The current L1 dev-sync drift (two COMMON-CONTEXT comment rewrites at `:424` / `:797`) is the pre-existing step-4.55 rewrite zone, not a defect; implementation edits land on L0 only.

## 4. Test plan

### 4.1 Helper unit tests (`tests/unit/memory-union-verify.test.ts`, `owedBlocks`)

- **OW-T1**: dropping-merge fixture (file exists at the merge, block dropped) + worktree lacking the block → `owedBlocks` returns the block, parent- and commit-labeled.
- **OW-T2**: same fixture with the worktree carrying the union → `[]` (nothing owed).
- **OW-T3**: merge-touched file absent from the worktree → contributes nothing (tier arms own that shape).
- **OW-T4**: no in-window merges → `[]`.

### 4.2 The deadlock-reproduction fixture (`tests/unit/dev-sync-rerun-hygiene.test.ts`, harness-B pattern)

The suite slices verbatim production blocks out of `dev-sync.ts` at run time (`MEMORY_BLOCK_START` at `:178` → `MEMORY_BLOCK_END` at `:179` spans the whole step-2 region — the anchors survive this change) and executes them against scratch git repos under `tests/.temp/`. New tests:

- **DL-T1 (the T-20261118-003 reproduction — red on pre-fix code, green post-fix)**:
  1. Scratch repo on `main`; commit today's log with a `branch=main`-marked block B_owed plus a second block; branch `fix/x`; delete B_owed; `--no-ff` merge back to `main` (post-activation merge touching memory).
  2. Worktree = post-merge content **plus B_owed restored verbatim** as a separate `---`-delimited block.
  3. Execute the sliced step-2 replace block with `sessionBranch = "main"` (post-fix: with the owed set wired in).
  4. Assert: B_owed still present verbatim in the rewritten file; exactly one fresh `main` block written; `repairedAtHead({ ours, theirs, head: rewritten }) === true`; and end-to-end, `unionScan` tiers the group `repaired-at-head` — the full no-deadlock chain pinned.
- **DL-T2 (invariant pin)**: two same-branch **non-owed** segments still collapse to one fresh block (O-4 dedupe intact).
- **DL-T3 (mixed)**: owed segment + stale draft → draft replaced, owed spared, skills carry-forward taken from the replaced draft.
- **DL-T4 (all-owed)**: every same-branch segment owed → fall-through to append; fresh block appended; nothing destroyed.

### 4.3 Regression

Full existing suite green: the B1/B2 rerun-hygiene fixtures, the v1.3.0 comment-relaxation pin (B-T8), the v1.1.0/v1.1.1/v1.2.0/v1.4.0 union-verify fixtures, and the dev-sync pipeline-order/scoped-staging suites (slice anchors unchanged).

## 5. Risks

- **R1 — doubled git-plumbing cost in step 2.** `owedBlocks` re-runs the bounded sweep (`git log -n 20` + `diff-tree` per parent per merge) that 3.88 also runs. Bounded, read-only, git-cached; negligible against the pipeline's test/audit bands. Memoization is deferred until it ever shows in a profile (no speculative abstraction).
- **R2 — non-verbatim restoration escapes sparing.** A hand-reflowed restore fails the strict/heading+firstLine match, so it is not spared → the pre-fix behavior (FATAL loop) persists for that attempt. Failure mode is "no worse than today", and the sharpened guidance says *verbatim, separate blocks*.
- **R3 — consistency of the two owed-set computations.** Step 2 computes the debt against the pre-write worktree; 3.88 recomputes post-write. They agree because spared segments survive the write verbatim and the fresh template is new content that is never owed.
- **R4 — over-sparing.** A window-wide owed set can spare a same-branch segment that matches an owed block from a *different* merge-touched file. Consequence: one extra historical block in today's log for ≤ 7 days (the segment becomes replaceable again once the merge ages out — self-healing). No correctness risk.
- **R5 — L1 propagation.** Standard: byte-identical mirrors enforced by step 3.7 at sync time; no variant-local patching permitted (pluggable-hook rule).

## 6. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None beyond running the updated dev-sync (platform-independent bun + git; no hook/config change) | N/A (scripts only) |
| Antigravity (GEMINI.md) | None — dev-sync is invoked via the shared `sync` skill; no GEMINI.md text changes required | N/A |
| templates/common | Propagation required — byte-identical L1 mirrors of both scripts via the L0→L1 publish steps; `SCRIPTS.md` registry unchanged (no new script) | `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/helpers/memory-union-verify.ts` |

## 7. PR sequence and acceptance criteria

**One PR** (standalone, T-20261118-003; not batched — dev-sync is L1 core and the diff is small enough to review atomically):

1. Commit 1 (docs): this design doc + `spec-register` entry (satisfies the spec-check gate for the PR's code diff).
2. Commit 2 (impl): helper v1.5.0 (`owedBlocks` + unit tests) → dev-sync v1.51.0 (step-2 sparing + guidance rewrite) → deadlock-reproduction and invariant-pin tests → version-history header entries in both files.

**Acceptance criteria**:

- [ ] A restored gate-owed same-branch block survives a re-run's step-2 replace; step 3.88 tiers the group `repaired-at-head`; the run completes and commits the repair forward (DL-T1).
- [ ] Same-branch same-day re-run still replaces its stale draft; strays still collapse (DL-T2, DL-T3).
- [ ] All-owed fall-through appends without destroying content (DL-T4).
- [ ] Step 3.88 guidance names the merge-touched file, specifies the block shape, and prescribes re-run /sync.
- [ ] Full unit suite green; step 3.7 L0/L1 drift check passes.
