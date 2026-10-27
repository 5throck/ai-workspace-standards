# Design: dev-sync Commit-Message Composition from the Final Staged Set

- **Spec ID**: `2026-10-28-dev-sync-staged-count-design`
- **Date**: 2026-10-28
- **Author**: Template Architect (Design Gate Row 0)
- **Tickets**: new (root PR #1669 and co-design PR #65 evidence; follows T-20261012-011's partial fix)
- **Status**: draft — design-only for user review. No script content is changed by this design ticket. Implementation is pending user approval and PM dispatch (§7).
- **NEW vs UPDATE**: this is a **new spec**. No existing spec covers T-20261012-011: the commit-message composition mechanism's origin spec is `2026-10-11-backlog-batch-2-design` (implemented; covers commit-message 1.0.0 / U-20261008-001), and T-20261012-011 (commit-message 1.1.0 + dev-sync 1.27.0) shipped without a design doc of its own (verified: no doc in `docs/designs/` mentions T-20261012-011). This design amends one invariant of the 2026-10-11 design — see §1.3.

## 0. Conclusion

`scripts/dev-sync.ts` composes the commit message — including the
`(N files)` count — from `git diff --cached --name-only` at pipeline START
(dev-sync.ts:340-347). Callers that rely on dev-sync's own later staging
(the upgrade-project delivery flow; the multi-commit closeout flows) present
an empty index at that moment, so the count is 0 while the commit and PR
carry N files. The wrong wording then propagates into three artifacts: the
commit subject, the PR title, and the branch slug. Root PR #1669 (12 files,
`pr/20261028-035645-chore-workspace-sync-0-files`, title "(0 files)") and
co-design PR #65 (17 files, title "(0 files)") are both instances.

This design keeps the early composition (the language gate, the memory-log
summary, the main-drift pre-flight, and the S0 ordering depend on it) and
adds a **re-composition step after the pipeline's staging completes** —
before the commit and PR title are written. The final message derives from
the final staged set, which by construction equals the commit contents.
The no-op early exit and the weak-message replacement semantics are
preserved byte-for-byte in behavior.

## 1. Context

### 1.1 Current mechanism (verified against code)

- **Composition** (dev-sync.ts:331-348): step 1 reads
  `git diff --cached --name-only -z` and calls
  `composeCommitMessage(msg, stagedPaths)`. The comment states the invariant
  "nothing stages between this point and the step 6.5 snapshot, so this IS
  the task-staged set". That invariant is false for the caller classes this
  design covers: the delivery content sits in the working tree (or is staged
  by the pipeline's own step 6.5) when dev-sync starts.
- **Weak-message contract** (helpers/commit-message.ts:117-120): a weak
  caller message (`isWeakCommitMessage`, lines 18-25 — empty, `chore:
  update`, `chore: (upgrade|resync|sync) template…`) is replaced by
  `deriveCommitMessage(paths)`; descriptive caller messages are kept
  verbatim. The fallback subject carries the count
  (`chore: workspace sync (<n> files)`, lines 96-110, always-present since
  commit-message 1.1.0 / T-20261012-011).
- **Downstream consumers of the early `msg`**: language gate
  (dev-sync.ts:355), memory-log session summary + idempotency key
  (`:469-523`), sync-md index (`:527`), branch slug (`:1245`),
  commit subject (`:1509`), PR title (`:1692`, with the T-20261012-011
  full-diff re-derivation at `:1694-1703`).
- **Staging** (step 6.5, dev-sync.ts:1357-1466): scoped staging (default)
  stages `taskStaged ∪ pipelineOutputs`; WARN-soak opt-out runs
  `git add -A`. Either way, immediately after step 6.5 the index holds
  exactly what the commit at `:1509` will contain.
- **Why the PR title cannot self-heal today**: the full-diff title
  re-derivation (`:1695`) fires only when `isWeakCommitMessage(prTitle)` is
  true. `chore: workspace sync (0 files)` does not match
  `WEAK_MESSAGE_RE` (commit-message.ts:18), so the wrong count reaches the
  PR title unchallenged.

### 1.2 Evidence

- Root PR #1669: branch
  `pr/20261028-035645-chore-workspace-sync-0-files`, 12 files in the PR,
  title "(0 files)". The branch slug proves the wrong count existed at
  step-5 time — i.e., at composition, not merely at PR creation.
- co-design PR #65: commit `2d06b5d` "chore: workspace sync (0 files)", 17
  files; the project memory log for the wave carries the same "(0 files)"
  session-summary header.
- Prior partial fix: commit-message 1.1.0 (T-20261012-011, PR #1523) made
  the count always present but still computed it from the early snapshot.

### 1.3 Amended invariant of the 2026-10-11 design

`docs/designs/2026-10-11-backlog-batch-2-design.md` (U-20261008-001 row)
records: "the early `git diff --cached` snapshot equals the later step-6.5
task-staged snapshot (nothing stages in between)". The first half held for
the in-dev-sync staging it described; the caller classes above stage *after*
dev-sync starts (or rely on dev-sync's step 6.5 to stage at all), so the
invariant does not hold at pipeline level. The early snapshot remains
authoritative for step 1's purposes; the commit-time message must come from
the final index. That replacement is recorded here; the 2026-10-11 doc is a
historical record and is not edited.

### 1.4 Adjacent observed drift (bundled item)

The freshly-merged conflict resolutions for root PRs #1672/#1673
(commits `44532c325`, `44d801b5f`) hit duplicated `**Generated**:` header
lines in `docs/VERSION_MANIFEST.md` — both sides of the merge carried their
own generated timestamp line. The generator normalizes the header line it
writes (generate-version-manifest.ts:644-649, `GENERATED_LINE_RE`), but a
merged input carrying two header lines is only collapsed if the generator
dedupes on read. The design bundles that one-line hardening (D6).

## 2. Problem statement

1. The commit subject and PR title under-report the change surface
   ("(0 files)" on an N-file PR) for the delivery and closeout caller
   classes.
2. The wrong wording also lands in the branch slug, the project memory-log
   summary header, and the MEMORY.md index — governance records that triage
   reads.
3. The full-diff PR-title re-derivation cannot repair the wording because
   the composed fallback is not classified as weak.

## 3. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Re-derive at commit time; keep the early composition.** dev-sync keeps `originalMsg` (the caller argument after flag parsing) and the early-composed `msg` exactly as today through step 1 → gates → memory append → branch creation. A new **step 6.9** runs after step 6.5's staging completes and before the `git commit` at `:1509`: re-read `git diff --cached --name-only -z` and set `msg = composeCommitMessage(originalMsg, finalStagedPaths)`. | Moving composition wholly post-staging would break the language-gate ordering, the main-drift pre-flight, and the memory-summary-before-pipeline contract (a crashed run still logs its summary), and would force the S0 snapshot to move. Re-derivation keeps every existing invariant and touches one insertion point. `composeCommitMessage` is already pure and already implements the right semantics for any path set — no helper change is required for correctness. |
| D2 | **Weak-message replacement semantics preserved.** The re-derivation consumes `originalMsg`, not the early-composed msg: descriptive caller messages stay verbatim at commit time (they never carried a count); weak caller messages get a derivation from the **final** set. When the final set is empty at step 6.9 (possible only if staging produced nothing, since the no-op exit already handled the fully-clean tree), the fallback remains the honest `(0 files)` shape. | Exact preservation of the U-20261008-001 contract, now computed against the set the commit actually contains. |
| D3 | **Memory-log and index re-convergence.** If step 6.9 changes `msg`, dev-sync (a) rewrites the appended session-summary header line for today (anchored exactly like the existing idempotency pattern at `:476-481`: the `## Session Summary` block whose first line equals the early msg), (b) re-runs `bun run scripts/sync-md.ts <date> "<final msg>"` to refresh the MEMORY.md index, (c) re-`git add`s `memory/<date>.md` and `memory/MEMORY.md` (they were staged by step 6.5 as pipeline outputs; the index must carry the corrected bytes), and (d) re-runs the English gate on the final msg (derived messages are English by construction; the re-check is fail-closed and cheap). | The wave flows' memory logs are governance records; the co-design triage was misled by the "(0 files)" summary header. Without (c) the commit would carry the stale header while the worktree shows the corrected one. |
| D4 | **No-op early exit and pipeline order untouched.** The `git status --porcelain` no-op exit (dev-sync.ts:316-329) stays first and unchanged. Step 6.9 is a pure insertion between the step-6.5 staging block and the sync-context tmp-file write / commit. The branch slug continues to derive from the early msg (§6 limitation). | Branch creation must precede staging (checkout-before-add); re-deriving the slug would require renaming a pushed branch or reordering five gated steps. |
| D5 | **L0/L1 mirror and lifecycle records.** The L1 twin `templates/common/scripts/dev-sync.ts` is republished through the standard L0→L1 publish (scrub-canonical: the constitution-scrub transform rewrites `CONSTITUTION.md` comment references to `context.md`; `verify-scripts --check-drift` is the gate — this is the established "byte-identical modulo sanctioned scrub" contract). `scripts/helpers/commit-message.ts` 1.1.0 → 1.1.1 (comment-only: header note documenting the two-phase caller contract); `scripts/dev-sync.ts` 1.32.0 → 1.33.0. SCRIPTS.md registry rows updated in BOTH mirrors (root + `templates/common/scripts/SCRIPTS.md`). Lifecycle: `docs/lifecycle/scripts/` currently has no records for either script (per-script records are optional per `docs/lifecycle/README.md`; SCRIPTS.md is the SSOT) — this batch seeds minimal records `docs/lifecycle/scripts/dev-sync.md` and `docs/lifecycle/scripts/commit-message.md` with the bump rows, which also activates Check H version agreement for both. | The mirror and registry steps are the standard change set for any L0+L1 script pair; seeding the two records turns the brief's lifecycle requirement into durable Check H coverage. |
| D6 | **VERSION_MANIFEST Generated-header dedupe on read.** `generate-version-manifest.ts` collapses any number of pre-existing `**Generated**:` lines in the input to one normalized line (extend the `:644-649` normalization from write-shaping to input-collapsing), so a conflict resolution that lands two headers self-heals at the next sync. Unit test: input with two headers → output with exactly one. | One-line hardening for the drift the #1672/#1673 merge class produced; no consumer depends on duplicate headers. |
| D7 | **Unit test for the empty-index-then-staged case.** Extend `tests/unit/commit-message.test.ts`: (1) `composeCommitMessage('chore: upgrade template to 0.22.0', [])` returns `chore: workspace sync (0 files)` — pins the trap; (2) the same original composed against a 17-path delivery-shaped set (agents/, docs/, scripts/ mix) returns a subject carrying `(17 files)` with the primary group's `type(scope)`; (3) a descriptive original composed against the same set is returned verbatim; (4) the empty-final-set re-derivation still yields the honest `(0 files)` fallback. | The helper is the unit boundary; dev-sync's step-6.9 wiring is covered by the pipeline-order integration check plus manual wave verification. |

## 4. Mechanism (step 6.9 specification)

Placement: immediately after the step-6.5 staging block
(dev-sync.ts:1397-1466) and before the sync-context tmp-file write
(`:1468-1506`) and the commit (`:1508-1518`).

```text
Step 6.9 — final message composition (T-… this design)
1. finalStaged ← git diff --cached --name-only -z        (exit-code checked)
2. finalMsg   ← composeCommitMessage(originalMsg, finalStaged)
3. if finalMsg ≠ msg:
     a. hasNonEnglish(finalMsg) → abort (fail-closed, same gate wording)
     b. rewrite today's memory summary header: the appended
        "## Session Summary\n<early msg>" block's message line → finalMsg
        (anchor + escape pattern identical to the idempotency check, :476-481)
     c. bun run scripts/sync-md.ts <date> "<finalMsg>"    (index refresh)
     d. git add -- memory/<date>.md memory/MEMORY.md      (re-stage corrected bytes)
     e. msg ← finalMsg
4. commit proceeds with msg (existing step)
```

Behavior matrix:

| Caller message | Index at step 1 | Final staged set | Commit subject / PR title |
|---|---|---|---|
| weak (`chore: upgrade template to X`) | empty (delivery flow) | N delivery paths | `type(scope): workspace sync (N files)` — the fix |
| weak | populated | same set | unchanged from today (early derivation already correct; step 6.9 is a no-op) |
| descriptive | any | any | verbatim caller message (unchanged) |
| any | any | empty at 6.9 | `(0 files)` fallback — honest, and unreachable for real syncs (no-op exit) |
| `--conclude-merge` descriptive | any | any | verbatim merge subject (unchanged) |

PR title: `prTitle = msg` is now the final message; the T-20261012-011
full-diff re-derivation stays as the second line of defense for the
multi-commit branch case (it fires only on weak titles, which after this fix
means a genuinely empty derivation).

Known limitation (accepted, D4): the branch slug is fixed at step 5 from the
early composition and may still read `…-chore-workspace-sync-0-files` in the
observed caller class. The slug is not a review surface; the commit, PR
title, and memory records — the surfaces humans and tooling triage — carry
the corrected wording.

## 5. Rollout and validation

| Layer | Change |
|---|---|
| L0 code | `scripts/dev-sync.ts` 1.33.0 (step 6.9 + `originalMsg` retention); `scripts/helpers/commit-message.ts` 1.1.1 (contract note); `scripts/generate-version-manifest.ts` +0.0.1 patch (D6 dedupe) |
| Tests | `tests/unit/commit-message.test.ts` +4 cases (D7); `tests/unit/` +1 case for the manifest header dedupe (D6) |
| L1 mirror | `templates/common/scripts/dev-sync.ts` + `templates/common/scripts/helpers/commit-message.ts` republished; SCRIPTS.md rows in both mirrors (dev-sync 1.33.0, commit-message 1.1.1) |
| Lifecycle | Seed `docs/lifecycle/scripts/dev-sync.md` + `docs/lifecycle/scripts/commit-message.md` (first records; Check H then gates their versions) |
| Manual verification | Re-run a delivery-shaped landing on a scratch clone (weak message + unstaged delivery content): commit subject and PR title carry the final count; memory summary header matches the commit subject; `verify-scripts --check-drift` green; `bun run test:unit` green |

## 6. Implementation plan (proposal — pending PM dispatch)

| # | Task | Agent | Tier |
|---|------|-------|------|
| 0 | Design Gate Row 0: this design + spec registration | architect | High |
| 1 | dev-sync step 6.9 + `originalMsg` retention + D3 memory re-convergence; commit-message 1.1.1 note; unit tests (D7) | automation-engineer | Low |
| 2 | generate-version-manifest header dedupe + unit test (D6) | automation-engineer | Low |
| 3 | L0→L1 publish; SCRIPTS.md rows (both mirrors); lifecycle record seeds | lifecycle-manager | Medium |

## 7. Consequences

- **Positive**: the commit subject, PR title, memory-log header, and index
  reflect the true change surface for every caller class; the T-20261012-011
  "count always present" promise becomes "count always correct"; the
  VERSION_MANIFEST merge-drift class self-heals.
- **Costs**: one extra `git diff --cached` read and one conditional
  header rewrite per sync — negligible; one more dev-sync step to document
  in the pipeline table (`docs/lifecycle/skills/sync.md` step list).
- **Risks & mitigations**: (i) header rewrite anchors on the early msg —
  escaped exactly like the existing idempotency regex, and the block was
  appended by this same run, so the anchor is unique by construction;
  (ii) sync-md re-run races — none: single-process, pre-commit;
  (iii) a future step that stages after 6.9 would re-open the gap — the
  step-6.9 comment states the invariant ("no staging after this point"),
  mirroring the step-1 comment it corrects.
- **Explicitly out of scope**: branch-slug re-derivation (D4 limitation);
  restructuring the pipeline to stage before step 1; changes to the
  weak-message vocabulary.

## 8. Acceptance criteria

- [ ] With an empty index at pipeline start and N files staged by step 6.5,
  the commit subject and PR title carry `(N files)` with the primary group's
  `type(scope)`.
- [ ] Descriptive caller messages reach the commit and PR title verbatim in
  all caller classes.
- [ ] The no-op early exit still exits 0 with its existing message before
  the pipeline runs (existing behavior pinned by a re-run on a clean tree).
- [ ] The memory summary header and MEMORY.md index match the final commit
  subject whenever step 6.9 re-derived the message.
- [ ] `--conclude-merge` closeouts with descriptive subjects are byte-for-byte
  unchanged.
- [ ] Unit battery green including the four new commit-message cases and the
  manifest header-dedupe case; `bun run test:unit` green (step 4.85 gate —
  both bumps trigger it).
- [ ] L1 mirror drift check green; SCRIPTS.md rows identical in both mirrors
  (modulo the generated-span projection); lifecycle records present for both
  scripts with versions matching the headers.

## 9. Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## 10. Open questions

1. **Q1 — branch slug**: accept the slug limitation (this design's D4), or
   also re-derive the slug by renaming the branch between staging and push
   (extra moving part on every sync)? Default: accept.

## 11. References

- Mechanism: `scripts/dev-sync.ts:331-348` (early composition), `:316-329`
  (no-op exit), `:1357-1466` (step 6.5 staging), `:1508-1518` (commit),
  `:1243-1253` (branch slug), `:1692-1706` (PR title re-derivation)
- Helper: `scripts/helpers/commit-message.ts:18` (WEAK_MESSAGE_RE),
  `:96-110` (count-bearing fallback), `:117-120` (composition contract);
  tests `tests/unit/commit-message.test.ts`
- Evidence: root PR #1669 (branch `pr/20261028-035645-chore-workspace-sync-0-files`,
  12 files); co-design PR #65 / commit `2d06b5d` (17 files); project memory
  `Projects/co-design/memory/2026-10-28.md` wave block
- Prior partial fix: T-20261012-011 (commit-message 1.1.0, PR #1523;
  dev-sync 1.27.0 title re-derivation) — count present, computed early
- Origin spec of the composition mechanism:
  `docs/designs/2026-10-11-backlog-batch-2-design.md` (U-20261008-001 row;
  invariant amended per §1.3)
- Adjacent drift: `scripts/generate-version-manifest.ts:644-649`;
  merge commits `44532c325` / `44d801b5f` (docs/VERSION_MANIFEST.md
  Generated-header conflicts)
- Registries: `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md`
  (dev-sync row at :98 / :77 respectively); lifecycle convention
  `docs/lifecycle/README.md` (per-script records optional; SCRIPTS.md SSOT);
  record gate `scripts/lifecycle-sync-audit.ts` Check H
