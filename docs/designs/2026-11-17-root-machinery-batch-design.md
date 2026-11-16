# Root machinery batch: external-deps seed-id adoption, dev-sync re-run hygiene, memory-archival index integrity — Design (Row 0)

- **Spec ID**: `2026-11-17-root-machinery-batch-design`
- **Date**: 2026-11-17
- **Status**: implemented (spec-registry flip at Machinery PR-1 landing; PR-2/PR-3 pending in the same batch — the registry marks the whole batch implemented, §7 carries the 3-PR rollout). Owner defaults O-4..O-6 (§8) apply unless the owner objects.
- **Author**: architect (PM-dispatched, Design Gate Row 0, ADR-0074; design only — this document changes no script, template, hook, or skill file)
- **Input tickets**: T-20261117-001 (backlog), U-20261116-012 (backlog, co-architect upstream, untrusted — verified independently), U-20261116-013 (waiting, co-architect upstream, untrusted — verified independently).
- **Decision record**: `docs/decisions/DEC-20261117-03.md`
- **Related specs** (extended, not duplicated): [`2026-11-07-external-deps-standard-design.md`](2026-11-07-external-deps-standard-design.md) + [`2026-11-07-external-deps-machinery-design.md`](2026-11-07-external-deps-machinery-design.md) (Ticket 1 builds inside their pass), [`2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md`](2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md) (PR-1 of that batch landed the S0 empty-index guard and body preservation this design builds on), [`2026-11-13-memory-index-link-validator-design.md`](2026-11-13-memory-index-link-validator-design.md) (Check 3c is the WARN backstop Ticket 3 feeds), memory-union-verify v1.2.0 archive fallback header (`scripts/helpers/memory-union-verify.ts:2-25`).
- **File:line currency**: all references measured on the workspace root working tree at 2026-11-17 (`scripts/dev-sync.ts` @ 1.49.0, `scripts/upgrade-project.ts` @ 1.109.0, `scripts/lib/upgrade-policy.ts` @ 1.46.0, `scripts/archive-memory.ts` @ 1.1.0, `scripts/verify-memory.ts`, `scripts/helpers/external-deps-reconcile.ts` @ 1.1.0).

## 0. Summary

Three tickets, three root PRs, one shared constraint: every script touched except the two L0-only upgrade-engine files is an L1-owned core script whose `templates/common/scripts/` mirror must stay byte-identical (modulo the documented `CONSTITUTION.md` → `context.md` comment substitution) and is refreshed only by the `/sync` publish step.

| PR | Ticket(s) | Main file(s) | Change in one line | Mirror publishing |
|----|-----------|--------------|--------------------|-------------------|
| PR-1 | U-20261116-013 | `scripts/archive-memory.ts` | Generalize tombstoning from date-session rows to every MEMORY.md link the archiver breaks, using the index's existing `*(archived — local only)*` convention | L1 mirror via /sync |
| PR-2 | U-20261116-012 | `scripts/dev-sync.ts` | Stage tracked-but-ignored sweep paths with `-f` instead of dying; replace the same-branch session block instead of appending a near-duplicate | L1 mirror via /sync (self-hosting: §7) |
| PR-3 | T-20261117-001 | `scripts/upgrade-project.ts`, `scripts/helpers/external-deps-reconcile.ts` | New EXTERNAL DEPS pass channel adopts template-seed ids add-if-missing into a valid project manifest, then D5 gitignore coverage runs on the adopted dirs | None — upgrade engine + reconcile core are L0-only (verified: no mirror exists) |

PRs merge strictly in order (one-open-PR rule, CONSTITUTION §3.3). Rationale for the order: PR-1 is the smallest and stops new dead index rows from accumulating on every subsequent sync; PR-2 fixes the two defects that fleet syncs hit live on 2026-11-16 (co-architect PR #399) and 2026-11-17 (co-deck PR-1/PR-3 runs), and its landed behavior makes PR-3's landing sync safer; PR-3's adoption channel is needed only at the next variant upgrade pass and touches the L0-only engine.

---

## 1. Work item A — U-20261116-013: archive-memory.ts leaves dangling MEMORY.md index rows (PR-1)

### 1.1 Verification verdict: PARTIALLY confirmed — narrower than filed, but the reported failure is real

The ticket claims "archive-memory.ts archives old memory files out of memory/ but leaves the MEMORY.md index rows (and any session-block links) pointing at the now-missing file". The claim is **true for non-date-named files and false for date-named session logs**:

- **Tombstoning already exists** — archive-memory.ts v1.1.0 (T-20260917-review) tombstones MEMORY.md session rows: `scripts/archive-memory.ts:56-73` rewrites `[date](date.md)` to plain-text date.
- **The coverage hole**: only date-named files enter the tombstone list. `archivedSessions.push` is gated on `dateMatch` (`:38`, `:49-53` — the regex `^(\d{4}-\d{2}-\d{2})\.md$`), and the tombstone regex only matches the `[date](date.md)` shape (`:63`). A file like `meeting-2026-09-25-adr019-step3b.md` (the exact reported case) is archived by `renameSync` (`:50`) but never tombstoned: its MEMORY.md row links keep pointing at a file that no longer exists in `memory/`.
- **Check 3c only WARNs** — confirmed: `scripts/verify-memory.ts:251-266` emits the "Missing MEMORY.md index link target … repoint or tombstone the row" warning (and a count line) and nothing escalates it; Check 3b (`:240-250`) ERRORs cover only the Sessions section, so a dangling Meetings row (the reported class) is WARN-only forever. Confirmed exactly as filed.
- **Ticket line refs**: the ticket cites no line numbers; the code matches the described behavior.

**Claim excluded from scope**: "session-block links" inside *other* memory logs pointing at the archived file. Verified that neither archive-memory.ts nor verify-memory.ts scans cross-log links, and no defect instance was reported — the index (MEMORY.md) is the documented navigation surface. Cross-log links stay out of scope; Check 3c's WARN remains the detection backstop if one dangles.

### 1.2 Proposed change — archive-memory.ts v1.1.0 → 1.2.0

1. **Track every archived file.** Replace the date-gated `archivedSessions` bookkeeping with two lists: `archivedSessions` (date-named, unchanged) and `archivedOthers` (everything else archived at `:50`).
2. **Generalize the tombstone rewrite** (`:56-73`) to run over both lists, with shape-aware replacement:
   - `[date](date.md)` for a date-named session log → plain-text date. **Unchanged** — this is the convention documented at the top of `memory/MEMORY.md` (link-free rows are tombstones).
   - Any other `[text](<archived-file>.md)` link anywhere in the index whose target is a file archived **in this run** → `*(archived — local only)*`. This token is the index's existing manual tombstone convention for Meetings/ADR rows (measured in `memory/MEMORY.md` Meetings table: rows ending `| *(archived — local only)* |`; ADR-0001 row same shape), so the rewrite makes script output indistinguishable from the established hand-fix.
   - Replacement operates on the link token only; table pipes, labels, and surrounding cells are untouched (a Meetings row keeps its date and title columns).
   - No link rewriting for targets outside `memory/` (e.g. `../docs/adr/...` ADR rows) — archive-memory only ever moves flat `memory/*.md` files, so those links are never broken by this script. Check 3c likewise scopes flat links (`verify-memory.ts` filters `href.includes("/")`).
3. **Reporting**: one console line per shape (`Tombstoned N session row(s)` / `Tombstoned N index link(s)`), so the sync log shows what was rewritten.
4. **No repointing logic.** The co-architect manual fix repointed a dead Meetings row to the ADR recording the same decision — that is a human editorial judgment about content equivalence. The script tombstones; repointing stays manual. Check 3c (WARN) remains the backstop for hand-edited indexes.
5. **verify-memory.ts: no change.** Check 3c stays WARN. Once archive-memory tombstones its own breakage, routine syncs stop *creating* new WARNs; a WARN after a sync now means a link the script did not create, which is the correct residual signal.
6. **Docs row (same PR)**: extend the tombstone-convention note at the top of `memory/MEMORY.md` (and `docs/constitution/02-memory-system.md` §2.3 if it restates the convention) with one sentence: non-date index rows broken by archival are rewritten to `*(archived — local only)*` by archive-memory.ts.

### 1.3 Test plan

- Unit (`tests/unit/archive-memory-tombstone.test.ts`, scratch fixture dir under `tests/.temp/`):
  - **A-T1** date-named file with a `[date](date.md)` row → plain date (v1.1.0 behavior preserved).
  - **A-T2** `meeting-2026-09-25-x.md` archived with a Meetings row `[label](meeting-2026-09-25-x.md)` → link becomes `*(archived — local only)*`, table pipes intact.
  - **A-T3** a link whose target is *not* archived in this run → untouched.
  - **A-T4** an `../docs/adr/…` link → untouched.
  - **A-T5** absent MEMORY.md → archive runs, no crash (current behavior preserved).
  - **A-T6** two archived files, one with a row one without → count lines correct.
- **Check-3c green assertion**: run `verify-memory.ts` against the A-T2 fixture — no "Missing MEMORY.md index link target" warning.
- Regression: existing memory tests (`tests/unit/memory-union-verify.test.ts`) stay green; the marker/tombstone fixtures do not trip `wellFormedScan`.

### 1.4 Risks

- **R-A1** — MEMORY.md churn on every sync: the rewrite happens inside step 3.8, so MEMORY.md becomes pipeline output in that run and is swept by step 6.5 as today (v1.1.0 already does this). No new classification risk.
- **R-A2** — a Meetings row's label may be the only remaining name of the content; the tombstone keeps the label text, so the row stays informative (this is the existing convention's proven shape).
- **R-A3** — unrelated content edits to MEMORY.md between S0 and S1 are classified by the existing content-overlap rule; the rewrite is deterministic per content, so the S0/S1 comparison stays exact.

---

## 2. Work item B — U-20261116-012: two dev-sync re-run hygiene defects (PR-2)

### 2.1 Verification verdicts

**Defect 1 — tracked-but-ignored path crashes step 6 fatally: CONFIRMED, mechanism verified empirically.**

- The promotion sweep stages `committable` with a batched plain `git add -- ${present}` (`scripts/dev-sync.ts:2446-2447`), throws on non-zero exit, and the catch block exits 1 (`:2462-2466`). There is no `git check-ignore` usage anywhere in dev-sync.ts.
- Empirical probe (scratch repo, git 2.56.1, 2026-11-17): for a file tracked since before the test, ignored via `.zcode/`, and dirty in the worktree, **`git add .zcode/config.json` exits 1** with "The following paths are ignored by one of your .gitignore files: .zcode". `git add .zcode` (directory) fails identically. The tracked status does NOT exempt an explicitly named ignored pathspec on this git version.
- The **template-layer alternative named in the ticket (`.gitignore` negation) cannot work**: a negation cannot re-include a file whose parent directory is excluded (gitignore documented rule), and the probe confirmed `git add .zcode` still fails with `!.zcode/config.json` present — matching the co-architect workaround note ("negation was tried and reverted"). The design therefore treats the negation path as closed, not as an alternative.
- How the path enters `committable`: `git add -u` stages the tracked-but-ignored modification (ignore rules do not block `-u` on tracked entries), so the path lands in `taskStaged` and is re-added by the promotion sweep; the S0∩S1 content-overlap classifier (v1.43.0) can also route it into `pipelineOutputs` when the pipeline touches it. Both channels die at the same add.
- Ticket claim refinement: the ticket says "the S0/S1 snapshot sweep re-adds dirty paths" — correct in effect; the precise staging site is the scoped-staging promotion block at `:2446`, not a separate snapshot step.

**Defect 2 — step 2 appends a duplicate memory session-summary block on re-run: CONFIRMED with one refinement.**

- The idempotency check keys on the **exact commit subject**: `scripts/dev-sync.ts:885-891` builds `duplicatePattern` from `msg` and skips the append only on a match; the append is unconditional otherwise (`:919-932`).
- Refinement: the ticket's "on every re-run" is an overstatement — a re-run with the *identical* subject is skipped. The observed accumulation (three blocks, subjects "79-file / 82-file / 82-file") happened because each run's composed subject differed (file count, derived message), which is the normal case for this pipeline: step 6.9 derives the final subject from the staged set (`:2385+`), so two attempts on the same branch rarely share a subject.
- Corroboration at the root: `memory/MEMORY.md` rows 10-11 are two same-day 2026-11-16 rows pointing at one file — the duplicate shape already landed here.
- The step-6.9 corrected-message header rewrite (`:2511-2529`) fixes only the *current* run's block; previous attempts' blocks remain.

### 2.2 Proposed change — dev-sync.ts v1.49.0 → 1.50.0

**Change B1 — ignore-aware staging in the promotion sweep (fixes defect 1).**

In the scoped-staging promotion block (`:2408-2467`), before the batch add:

1. Classify the present paths with two batched queries: `git ls-files -z -- <paths>` (tracked set) and `git check-ignore -z -- <paths>` (ignored set; note `check-ignore` exits 0 when some paths are ignored, 1 when none, 128 on error — handle all three).
2. Partition:
   - **tracked ∩ ignored** → stage with `git add -f`, each path logged on one DIM line (`tracked-but-ignored: staged with -f (<path>)`). Rationale: the path is already tracked; restaging its tracked state is safe and preserves the operator's intent, and `-f` is the only way git will accept the pathspec (verified).
   - **untracked ∩ ignored** → WARN and skip (`ignored path not staged: <path> — gitignored and untracked; never force-added`). Today no legitimate pipeline output lands in an ignored directory; if one ever does, this WARN makes it observable instead of silently force-adding scratch.
   - everything else → the existing batch add, unchanged.
3. The per-path absent branch (`:2449-2459`) applies the same rule: an absent path that is tracked ∩ ignored is staged with `-f` (this covers a worktree-deleted tracked-but-ignored file, whose plain pathspec would also be refused); an absent ignored-untracked path gets the existing ghost-path failure.
4. **Skill text row**: `skills/sync/SKILL.md` step-6 notes gain one line describing the tracked-but-ignored handling.

**Change B2 — branch-keyed session-block replace (fixes defect 2).**

Owner default O-4: one session block per branch per day, carried by an explicit marker comment.

1. dev-sync already resolves the branch (`currentBranch`, `:2133-2145`). The appended block gains a leading marker line: `<!-- dev-sync:session branch=<currentBranch> -->` placed immediately before `## Session Summary` inside the appended segment (after the `---` separator). HTML comments already occur inside session blocks (the `## Skills Used` template comment), so this introduces no new construct class.
2. Before appending (`:885-891`), replace the exact-subject skip with: if `memory/<date>.md` contains a marker with the same branch value, **replace** that marker-plus-block segment (through the next `\n---\n` boundary or EOF) with the new marker + template. Same branch + same day → one block, always reflecting the latest run. Different branch → separate block, untouched. No marker (legacy blocks, other tools) → plain append as today.
3. The step-6.9 corrected-message rewrite (`:2511-2529`) keeps working; with the marker present it may additionally scope the rewrite to this run's marker (optional implementation detail, not required for correctness).
4. Compat gate: `verify-memory.ts` structural scan and `wellFormedScan` (memory-union-verify) must accept a comment line preceding the `## Session Summary` heading — covered by the regression test below before the version bump (the script-version test gate runs `bun run test:unit` before the audit, `dev-sync.ts:307`).
5. **Skill text row**: document the one-block-per-branch-per-day rule in `skills/sync/SKILL.md` step 2 notes.

Options rejected:

| Option | Why rejected |
|---|---|
| Normalize the subject (e.g. collapse `(N files)`) for the dedup regex | Fragile against every derived-subject shape; silently merges genuinely distinct runs |
| No-marker branch detection | Impossible — blocks carry no branch identity today |
| Wipe-and-rewrite all of the day's blocks | Destroys other branches'/flows' blocks (conclude-merge "merge: …" entries) |

### 2.3 Test plan

Block-slice tests on the real blocks, scratch repo under `tests/.temp/` (house pattern `tests/unit/dev-sync-scoped-staging-deletion.test.ts`):

- **B-T1** tracked-but-ignored dirty path in the sweep → staged via `-f`, sync completes, DIM log line printed.
- **B-T2** untracked-but-ignored path (hand-planted scratch in an ignored dir) → WARN + skip, not committed.
- **B-T3** clean path set → batch add path unchanged (no `-f`, no extra git calls on the happy path beyond the two classification queries).
- **B-T4** tracked-but-ignored worktree-deleted path in the absent branch → `-f` stage succeeds (deletion staged).
- **B-T5** first run appends marker + block; second run same branch, different subject → block replaced, exactly one `## Session Summary` for that branch.
- **B-T6** second run same day, different branch → both blocks present.
- **B-T7** legacy block without marker → plain append (no replacement).
- **B-T8** marker + replaced block passes `verify-memory.ts` structural checks and `wellFormedScan`.
- Regression: `dev-sync-scoped-staging-*.test.ts`, `dev-sync-pipeline-order.test.ts`, `memory-union-verify.test.ts` stay green.

### 2.4 Risks

- **R-B1** — `git add -f` on a tracked-but-ignored path the operator was *about to* untrack. Force-add restages what the index already holds unless the worktree changed; the DIM log line names every such path, so the audit trail is explicit.
- **R-B2** — `check-ignore`/`ls-files` add two subprocess calls per sync. Negligible; both are batched single calls.
- **R-B3** — branch names with marker-hostile characters. The marker embeds the raw branch token; regex extraction uses a non-greedy capture between fixed delimiters. Branches with `-->` in the name are pathological and unsupported (same as the existing branch-slug handling).
- **R-B4** — self-hosting bootstrap (see §7): the fix lands via a sync that runs the OLD dev-sync; a fatal at step 6 on the root tree would stall the landing PR. Mitigated: the root tree has no tracked-but-ignored dirty paths today (`memory/archive/` and `tickets/archive/` are untracked local-only); if the old dev-sync dies mid-run, the operator completes the commit manually per the documented recovery, and the *next* run's B2 replace collapses the duplicated block.

---

## 3. Work item C — T-20261117-001: EXTERNAL DEPS pass cannot adopt variant-seed ids into valid v2 manifests (PR-3)

### 3.1 Verification verdict: CONFIRMED

Every claim in the ticket verified against the current tree:

- **Three write channels, none fires for a valid v2 manifest with empty deps** — `runExternalDepsPass` (`scripts/upgrade-project.ts:3678`): (1) absent-file seed copy requires `!existsSync(manifestPath)` (`:3694-3704`; the ticket's `:3698` is inside this block — ±5 line drift, behavior claim exact); (2) parse-failure reconcile fires only in the `catch` of the manifest parse (`:3706-3796`); (3) v1→v2 migration fires only on `manifest.schema_version === 1` (`:3798-3852`, ticket's `:3798` exact). A valid schema-v2 manifest falls through all three: no comparison against the seed's id set exists anywhere in the pass.
- **ensureGitignoreCoverage keyed on parsed deps** — `:3854-3860` calls `ensureGitignoreCoverage(projectDir, manifest!.dependencies.map(d => d.install_dir))` (helper at `scripts/lib/external-deps.ts:985`). Empty deps → no coverage appended, even when the project carries stale `external/` entries from a pre-seed install. Confirmed.
- **resolveClaim pin** — `scripts/lib/upgrade-policy.ts:714` returns `{ policy: "PROJECT_STATE", pass: "EXTERNAL DEPS" }` for `external-deps.json` (ticket's `:708-714` exact, comment block included), so TEMPLATE TREE SYNC never delivers seed updates to the project manifest.
- **No CLI reconcile subcommand** — `scripts/external-deps.ts` `run()` dispatches exactly `list | install | verify | check-updates` (`:237-243`). Confirmed.
- **Fleet impact path** — first observed co-deck/quickdl (template 0.30.0 seed never reached the project manifest; one-off fixed by co-deck PR #248). The pass structure confirms any project scaffolded before its variant seed gained deps has no adoption path.

### 3.2 Proposed change — upgrade-project.ts v1.109.0 → 1.110.0, external-deps-reconcile.ts v1.1.0 → 1.2.0

**Where the fix lives**: the reconcile core (`scripts/helpers/external-deps-reconcile.ts`) is pure, L0-only, and unit-pinned — the right home for the new logic. The CLI gets **no** new subcommand (owner default O-5): the upgrade pass is the documented delivery channel and produces decision rows; a CLI reconcile would bypass decision-row attribution, dry-run semantics, and compat-gate framing.

1. **New pure function** `adoptSeedEntries(projectRaw: string, seedManifest: ExternalDepsManifest): AdoptResult` in external-deps-reconcile.ts v1.2.0:
   - Revalidates `projectRaw` via `parseExternalDepsManifest` (unreachable-invalid → `ok: false`, caller skip path).
   - For each seed dependency (seed order) whose id is absent from the project dependencies: append the seed entry **verbatim** — license/usage/adapter/excluded_components/license_decision plus the seed's pin/commit. This inherits the seed's *declaration* (the template's attestation is a declared fact, not an invented one — the "never invent an attestation" rule is untouched).
   - Existing project entries (including project-only and invalid-kept-verbatim ones) are never modified, reordered, or dropped — add-if-missing only, per id. A project's operative pin for an id it already has is the project's fact; adoption never touches it.
   - Written `schema_version` is the project document's own schema_version; adopted ids appended at the end.
   - Returns `{ ok, adopted: string[], document }`; empty seed → `adopted: []`, no write.
2. **New pass channel 2c** in `runExternalDepsPass`, inserted after the v1→v2 migration (2b) and before gitignore coverage (3), firing when the manifest parsed successfully (post-migration, `manifest !== null`) and a valid seed exists: read the current project file, call `adoptSeedEntries`, and if `adopted.length > 0` write the document, `changed++`, and record **one decision row per adopted id** — `UPDATE`, "seed-id adoption: dep `<id>` adopted from the template seed verbatim (no project entry existed)". Under `--dry-run` rows print with the `[DRY RUN]` tag and nothing is written (existing `dryTag` machinery). Zero adoptions → no row, no write, pass output unchanged for the 16-dep-free majority of the fleet.
3. **Ordering guarantee**: channel 2c runs *before* `ensureGitignoreCoverage`, so the adopted entries' `install_dir`s receive D5 gitignore coverage in the same pass — the second half of the co-deck one-off (external/ gitignore) closes automatically, and every future adoption is covered on arrival.
4. **Standard addendum (docs row in the same PR)**: append an addendum section to `docs/designs/2026-11-07-external-deps-standard-design.md` (A.4 "Seed-id adoption") documenting: the gap (no write channel for valid manifests), the adoption contract (add-if-missing per seed id, verbatim entry, one decision row per id, never overwrites an existing id), the delivery rule (the upgrade pass is the only adoption vehicle; `check-updates` stays report-only), and the D5-after-adoption ordering. The addendum is authored in the implementation PR (docs-writer or automation-engineer row), not in this design dispatch.
5. **Lifecycle note**: upgrade-project.ts and the reconcile helper have **no L1 mirrors** (verified: neither file exists under `templates/common/scripts/`), consistent with the L0-only upgrade engine completion (design 2026-09-23). `scripts/lib/external-deps.ts` is mirrored but is not modified by this change.

### 3.3 Test plan

- Unit (`tests/unit/external-deps-reconcile-adoption.test.ts`, extending the existing reconcile suite):
  - **C-T1** empty project deps + seed with one entry → adopted verbatim, one id, schema_version unchanged.
  - **C-T2** project already has the id (different pin) → **no** adoption for that id, pin untouched; other seed ids still adopted.
  - **C-T3** project-only entries (valid and invalid-verbatim) preserved in place; adopted ids appended after.
  - **C-T4** empty seed → `adopted: []`.
  - **C-T5** invalid project JSON → `ok: false` (unreachable via the pass, pinned for the pure contract).
  - **C-T6** multi-seed ordering: adopted in seed order.
- Block-slice test on the pass (`runExternalDepsPass` fixture harness):
  - **C-T7** valid v2 empty-deps project + variant seed with one entry → manifest gains the entry, gitignore gains `external/<install_dir>/` coverage, two decision rows (adoption UPDATE + gitignore UPDATE).
  - **C-T8** `--dry-run` → rows printed, files untouched.
  - **C-T9** project manifest with all seed ids → byte-identical output (today's no-op preserved for the fleet majority).
- Regression: `external-deps-reconcile` suite, `upgrade-project-*.test.ts`, and the drift-workflow E2E (`templates/co-deck` seed [OK] scan) stay green.

### 3.4 Risks

- **R-C1** — adoption delivers seed pins that are older than upstream; the per-dep channel immediately checks upstream and may move the pin through the compat gate in the same pass. This is identical to fresh-scaffold semantics and is the desired end state; a failed compat test holds the seed pin and WARNs (existing behavior).
- **R-C2** — a project that *deliberately* omitted a seed id now receives it. The filing's evidence (co-deck/quickdl) establishes that omission is drift, not intent — seed ids are the declared dependency set for the variant. Decision rows make every adoption auditable and revertible.
- **R-C3** — seed and project entry field-shape drift (a seed entry invalid under the current schema). `seedManifest` is already parsed-validated before 2c fires; an invalid seed falls back to the existing SKIP path — adoption cannot write an invalid entry.

---

## 4. Ticket claims checked (summary)

| Ticket | Claim | Finding |
|---|---|---|
| T-001 | Three write channels, none fires for valid v2 empty deps | **Confirmed** (channel sites :3694-3704, :3706-3796, :3798-3852; the ticket's :3698/:3710-3738 drift ≤ 10 lines, behavior exact) |
| T-001 | ensureGitignoreCoverage keyed on parsed deps | **Confirmed** (:3854-3860, helper lib/external-deps.ts:985) |
| T-001 | resolveClaim pins manifest to PROJECT_STATE/EXTERNAL DEPS | **Confirmed** (upgrade-policy.ts:714, exact) |
| T-001 | No CLI reconcile subcommand | **Confirmed** (external-deps.ts:237-243: list/install/verify/check-updates only) |
| U-012 (1) | Sweep `git add` fatal on tracked-but-ignored path | **Confirmed** — mechanism verified empirically on git 2.56.1; staging site dev-sync.ts:2446-2447, exit at :2462-2466; no check-ignore usage exists |
| U-012 (1) | Alternative: .gitignore negations | **Excluded as non-viable** — negations cannot re-include under an excluded parent (documented gitignore rule + probe); matches the co-architect revert note |
| U-012 (2) | Duplicate session block on every re-run | **Confirmed with refinement** — dedup keys on exact subject (:885-891); duplicates accumulate when the derived subject differs (the normal case), identical subjects are skipped |
| U-013 | archive-memory leaves index rows dangling | **Partially confirmed** — true for non-date-named files (tombstone gated on dateMatch, :38/:49-53/:63); date-session rows are already tombstoned (v1.1.0, :56-73) |
| U-013 | Check 3c only WARNs | **Confirmed** (verify-memory.ts:251-266) |
| U-013 | Session-block links dangle | **Excluded from scope** — no handling exists and no instance reported; cross-log links stay out, Check 3c WARN is the backstop |

## 5. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | `/sync` behavior changes (PR-2); skill text rows in `skills/sync/SKILL.md` (PR-1 docs note, PR-2 step-2/step-6 notes). No `.claude/` command change. | `scripts/dev-sync.ts`, `skills/sync/SKILL.md` |
| Antigravity (GEMINI.md) | No GEMINI.md text change — it does not restate dev-sync or archive-memory behavior. The skill mirrors refresh through /sync. | Mirrors only |
| Codex / Hermes / ZCode | Same as Antigravity — platform skill mirrors refresh through /sync; no platform config change. | Mirrors only |
| templates/common | Pipeline-propagated mirrors only: `scripts/archive-memory.ts` (PR-1), `scripts/dev-sync.ts` (PR-2). No hand edits; upgrade-project.ts, external-deps-reconcile.ts and the 2026-11-07 standard addendum have no common mirror (L0-only). | As listed |

Cross-platform: all new git invocations use argv arrays (Bun `$`), `-z` porcelain where parsing is needed; no shell strings; no `> nul` redirections. The marker and tombstone writes are UTF-8 text with LF endings (existing appendFileSync/writeFileSync behavior).

**Accessibility statement**: backend and tooling changes only (CLI scripts and one skill-text row). No UI, rendered page, or style change. Exempt from ADR-0065 by this explicit statement.

**Preview Verification statement**: non-UI change; nothing to preview in a browser. Exempt. Verification is by unit tests and fixture runs (§1.3, §2.3, §3.3).

## 6. Folded observation from today's co-deck sync (no PR in this batch)

The PM relayed a live-session note: the PR-1/PR-3 sync runs repaired `memory-2026-11-08` union-verify FATALs by hand, and "the archival tier only recognizes deletions made *in* the scanned merge, not drops in logs archived by a *later* merge". Verified context: memory-union-verify v1.2.0's repaired-at-head tier falls back to `memory/archive/<basename>` when the worktree file is absent (`scripts/helpers/memory-union-verify.ts:2-25`), but `memory/archive/` is deliberately gitignored (`/.gitignore:190`, local-only per `memory/MEMORY.md` header and CONSTITUTION §2.3), so on a fresh clone the fallback finds nothing and a historical drop in a scanned merge whose log was archived by a later merge cannot be tiered. This is a real gap but it lives in the union-verify core and the archive-provenance policy, not in archive-memory's index hygiene — **follow-up ticket** (candidate id T-20261117-006): "union-verify archival tier cannot confirm repaired-at-head on fresh clones (archive is local-only); needs archive-provenance policy (e.g. tracked archive index of block hashes) — separate design". Recorded here so the observation survives the session; no change in this batch.

## 7. Shared rollout plan (sequential PRs, publishing, bootstrap order)

**PR-1 (U-013)**: `scripts/archive-memory.ts` @1.1.0 → 1.2.0, `tests/unit/archive-memory-tombstone.test.ts`, the MEMORY.md convention note, and the `/sync`-published `templates/common/scripts/archive-memory.ts` mirror. Landing sync runs the old archive-memory (harmless — old behavior is a strict subset).

**PR-2 (U-012)**: `scripts/dev-sync.ts` @1.49.0 → 1.50.0, `tests/unit/dev-sync-rerun-hygiene.test.ts` (B-T1..B-T8), `skills/sync/SKILL.md` rows, published mirror `templates/common/scripts/dev-sync.ts`. Run `bun run test:unit` before `/sync` (the script-version gate requires it, `dev-sync.ts:307`).

**PR-3 (T-001)**: `scripts/upgrade-project.ts` @1.109.0 → 1.110.0, `scripts/helpers/external-deps-reconcile.ts` @1.1.0 → 1.2.0, `tests/unit/external-deps-reconcile-adoption.test.ts` + pass slice test, the external-deps-standard addendum (docs row). No mirror churn.

**Bootstrap order (self-hosting dev-sync)**: dev-sync edits are committed, mirrored, and PR'd by a `/sync` run that itself executes the OLD dev-sync 1.49.0. Consequences and mitigations:
1. The landing run's step-6 promotion uses the OLD ignore-blind add. The root tree currently has no tracked-but-ignored dirty paths (`memory/archive/`, `tickets/archive/` are untracked local-only; verified against `/.gitignore:177-190`), so the fatal cannot fire today; if the tree state changes, the operator stages the offending path with `-f` manually before re-running.
2. The landing run appends its own session block with the OLD append logic (one block; acceptable). After the PR merges, every subsequent same-branch same-day run replaces instead of appends.
3. Each PR's L1 mirror refresh is pipeline output of its own landing sync (lifecycle-manager flow) — never hand-edited; the byte-identity guarantee is re-checked by the sync's platform-mirror-freshness check.
4. After merge, the next sync run executes the NEW dev-sync; its first same-branch rerun exercises B2 against real state (observed in the run log, not tested in prod).

**Fleet rollout note**: PR-1 and PR-2 reach variants through the normal template upgrade pass; PR-3's adoption channel activates for any variant project the next time its upgrade pass runs — no per-project manual step, which is the point of the ticket.

## 8. Owner decisions (open; defaults apply unless the owner objects)

- **O-4 (PR-2, defect 2)**: session-block identity = one block per branch per day, carried by the `<!-- dev-sync:session branch=<branch> -->` marker. Alternative: replace-by-subject-class normalization (rejected, fragile). Default: marker.
- **O-5 (PR-3)**: no CLI reconcile subcommand; the upgrade pass is the only adoption vehicle. Alternative: add `external-deps.ts reconcile` (rejected — bypasses decision rows and dry-run framing). Default: pass-only.
- **O-6 (PR-1)**: descriptive-row tombstone token `*(archived — local only)*` (matches the index's existing manual convention). Alternative: `*(archived — memory/archive, local only)*` (more explicit, longer rows). Default: the established token.

## 9. Acceptance criteria

PR-1:
- [ ] Archiving a non-date-named file referenced from any MEMORY.md section rewrites its link to `*(archived — local only)*`; date-session rows keep the plain-date tombstone.
- [ ] After a routine sync that archives referenced files, `bun scripts/verify-memory.ts` reports zero new Check 3c warnings.
- [ ] Links to targets outside `memory/` and to files not archived in the run are untouched.
- [ ] L1 mirror byte-identical after publish.

PR-2:
- [ ] A tracked-but-ignored dirty path in the sweep is staged with `-f` and logged; the sync completes.
- [ ] An untracked-but-ignored path is WARNed and skipped, never committed.
- [ ] Same-branch same-day re-run replaces its session block (one `## Session Summary` per branch per day); different branch appends; legacy marker-less blocks append.
- [ ] verify-memory and memory-union-verify structural checks accept marker-bearing blocks.
- [ ] Existing scoped-staging, pipeline-order, and memory tests stay green; L1 mirror byte-identical after publish.

PR-3:
- [ ] A valid v2 project manifest with empty deps + a variant seed with N entries adopts all N (one decision row per id), and the adopted install_dirs get gitignore coverage in the same pass.
- [ ] Existing ids (including project-only and invalid-verbatim entries) are never modified or dropped.
- [ ] `--dry-run` writes nothing and prints adoption rows.
- [ ] A project whose ids already cover the seed set is untouched (byte-identical pass).
- [ ] The 2026-11-07 external-deps standard carries the A.4 adoption addendum; L0-only scope holds (no mirror churn).
