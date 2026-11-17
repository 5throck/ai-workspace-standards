# dev-sync hunk-adjudicated staging (honor-staged opt-in) + spec-registry dangling-reference gate — Design (Row 0)

- **Spec ID**: `2026-11-18-dev-sync-hunk-staging-design`
- **Date**: 2026-11-18
- **Status**: implemented (spec-registry flip at this design's own landing PR; the implementation is strictly additive to `scripts/dev-sync.ts` v1.50.0 → v1.51.0 plus one new pure lib)
- **Author**: architect + automation-engineer (PM-dispatched hybrid, Design Gate Row 0, ADR-0074; ticket T-20261117-015 carries the decision record — no separate DEC file)
- **Input tickets**: T-20261117-015 (backlog).
- **Decision record**: `tickets/governance/T-20261117-015.yaml` (ticket IS the decision record per PM brief).
- **Related specs** (extended, not duplicated): [`2026-09-12-dev-sync-scoped-staging-design.md`](2026-09-12-dev-sync-scoped-staging-design.md) (this design generalizes the step-6.5 promotion sweep's index-authoritative skip), [`2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md`](2026-11-16-ticket-batch-dev-sync-upgrade-drift-design.md) (v1.49.0 `--stage` flag is the argv-surface precedent), [`2026-10-05-spec-registry-entries-projection-design.md`](2026-10-05-spec-registry-entries-projection-design.md) (one-file-per-spec SSOT that the dangling gate validates against).
- **File:line currency**: all references measured on the workspace root tree at 2026-11-18, origin/main `233ac25c4` (`scripts/dev-sync.ts` @ 1.50.0, `scripts/spec-register.ts` @ 1.6.0, `scripts/lib/workspace-hygiene.ts` @ 1.0.0).

## 0. Summary

dev-sync's scoped staging decides WHAT MAY JOIN A COMMIT at **path** granularity. PM/auditor adjudications repeatedly need **hunk** granularity: a partial `docs/specs/registry.json` (one batch's spec entry in, sibling-batch entries out) staged hunk-wise via `git apply --cached`. Step 6.5's promotion sweep then re-adds the whole path from the worktree and **silently clobbers the adjudicated index state** — the 2026-11-17 audit-fix landing shipped the forbidden sync-auto-detection entry as a dangling registry reference (its entry JSON not in the commit), caught only at push-time review and repaired via a pipeline re-run with the parallel entry JSON temporarily shelved (commit b1c7c6a37's predecessor). Cost of one day: three manual hunk-edit stagings, one landing incident, one shelved-unshelved dance.

This design makes the pre-staged-index worktree pattern **first-class**: an explicit `--honor-staged <path>` opt-in (repeatable, plus `SYNC_HONOR_STAGED` env) under which the step-6.5 sweep treats the staged blob as authoritative for designated paths and does NOT path-level re-add them — instead of the worktree-reconstruction gymnastics PR-1/PR-3 and the audit-fix used to route around the gap. It also closes the verification gap with a cheap commit-time gate (step 6.55): every entry in a staged `docs/specs/registry.json` must have its entry JSON (`docs/specs/entries/<id>.json`) and its design `file` target present in the resulting commit (index ∪ HEAD); any dangling reference is FATAL before `git commit` — the incident's actual bite.

## 1. Problem — the evidence chain (T-20261117-015)

All evidence from `tickets/governance/T-20261117-015.yaml` and `memory/2026-11-17.md` (landed via PR #2073), independently verified against the source on 2026-11-18:

1. **Three manual hunk-edit workarounds in one day (2026-11-17).** Machinery PR-1, co-deck PR-4, and the audit-external-scan fix each needed an auditor-adjudicated PARTIAL `docs/specs/registry.json` — one spec entry in, sibling-batch entries out. The only mechanism available was hunk-level `git apply --cached` hand-edited into the index before dev-sync ran.
2. **The silent clobber (the incident).** The audit-fix landing staged `docs/specs/registry.json` hunk-1-only (verified mechanism: `scripts/dev-sync.ts` step 6.5 promotion sweep computes `committable = taskStaged ∪ pipelineOutputs` and then runs a **path-level** `git add -- ${normalPresent}` over it, `dev-sync.ts:2530-2634`). Because the path was in `taskStaged`, the sweep re-staged the whole worktree file — which contained the sibling batch's sync-auto-detection entry — destroying the hunk-level index state. The commit (4e9e6d767) initially carried the forbidden entry **whose entry JSON was not in the commit** (a dangling registry reference).
3. **Detection gap.** All pre-commit gates (spec-check Check 5/5b, audit, language gate, step 6.9) passed. The dangling reference was caught only at push-time human review. Repair: `git apply --cached --reverse` of the committed hunk-2 patch + surgical follow-up commit — no force-push — plus a full pipeline re-run that required the parallel entry JSON to be **temporarily shelved and unshelved** around untracked parallel files (the shelved-unshelved dance).
4. **Channel gap.** The upstream_request channel could not carry this defect (v1 limited to co-* projects; workspace root rejected), so the ticket is the sole decision record.

**Root cause, precisely**: scoped staging classifies paths but never *contents* of task-staged paths. The one place it does respect index state — the staged-deletion skip (`indexRemoved`, "the index already holds the desired state", `dev-sync.ts:2532-2546`) — proves the promotion sweep already has the right shape for index-authoritative paths; it just never lets an operator designate one.

## 2. Mechanism ruling — option evaluation

| Option | Surface | Determinism | Silent-fallback risk | Verdict |
|--------|---------|-------------|----------------------|---------|
| (a) Honor a pre-staged index for an explicit opt-in path list | Repeatable `--honor-staged <path>` flag + `SYNC_HONOR_STAGED` env; step 6.5 excludes listed paths from every re-add batch | High — the staged blob IS the adjudicated content; no re-derivation | Controllable: a listed path with NO staged delta is a fail-closed ghost (pre-staging lost → abort) | **RULED IN** |
| (b) Adjudicated-hunks manifest file (path→hunk-selector entries) | New file in `.git/` or env-listed path; parser + validator + stale-file lifecycle | Low — a manifest survives across runs and worktrees; stale manifests silently re-apply old adjudications | High: malformed naming must fail closed, and the file's lifecycle (cleanup, discovery, concurrent-run races) duplicates the `.sync_context.*.tmp` machinery dev-sync already needs to sweep | Rejected — more surface, no added determinism |
| (c) `--stage-hunks <path>=<hunk-spec>` CLI flag | dev-sync re-expresses hunk selections itself | Low — hunk specs are a second source of truth for an edit the invoking agent already made with `git apply --cached` | High: hunk-spec semantics drift from git's patch application (context matching, offsets) — two adjudication dialects | Rejected — duplicates machinery the agents already operate correctly |

**Ruling: option (a), refined.** The agents ALREADY adjudicate hunks correctly at the index level (`git apply --cached`). The pipeline's only defect is that step 6.5 then overrides that index state at path granularity. The minimal, deterministic fix is to let the invoking agent designate paths whose staged blob is authoritative — the same contract the existing `indexRemoved` skip applies ("the index already holds the desired state"), generalized from deletions to explicit opt-ins.

### 2.1 The ruled semantics (precise)

- `--honor-staged <path>` (repeatable) and `SYNC_HONOR_STAGED` (comma-separated) union into the honor set.
- At step 6.5, for each honored path: the **staged blob** is authoritative for the commit. The promotion sweep excludes honored paths from every `git add` batch (forced, normal, and absent-path). The index blob lands verbatim; the worktree file keeps whatever content it carries (the sibling batch's entries stay in the worktree for a later sync — exactly the adjudication intent).
- **Fail-closed rules** (no silent fallback — the pre-commit-hook precedent):
  - **Ghost opt-in**: an honored path that is NOT in the cached diff at step 6.5 (nothing staged for it) is FATAL. Honoring a path whose index equals HEAD means the pre-staged adjudication was lost (re-run, wrong worktree, wrong order); silently proceeding would replay the clobber in reverse. The fatal message names the paths and the repair (`git apply --cached`, then re-sync).
  - **Soak contradiction**: an honor set under `--warn-staging` (the `git add -A` soak) is FATAL — the soak cannot honor anything by construction.
  - **Worktree divergence is a WARN, not an error**: if the honored path's worktree bytes differ from its staged blob, log a WARN line. That divergence is the normal adjudication shape (worktree carries the parallel batch), but it must be observable.
- **Interaction with the worktree-landing pattern**: PR-1/PR-3 and the audit-fix reconstructed worktrees (or shelved files) precisely to keep sibling-batch content out of a landing. With honor-staged, the pattern becomes: apply adjudicated hunks to the index (`git apply --cached` or `--stage` + blob correction), list the path on `--honor-staged`, run dev-sync — no reconstruction, no shelving.

## 3. The dangling-reference gate (step 6.55) — the incident's actual bite

New step **6.55** (between the 6.5 staging sweep and step 6.9's final message composition; nothing stages after 6.5, so the index at 6.55 is the commit):

1. Cheap activation check: is `docs/specs/registry.json` in the cached diff (`git diff --cached --name-status`)? If not — pass (nothing landing moves the registry).
2. Read the **staged blob** (`git show :docs/specs/registry.json`), parse it with the pure lib (`scripts/lib/spec-landing.ts` `parseRegistryEntries`). A malformed staged registry is FATAL (fail-closed — a registry the commit would carry but no gate can validate must not ship).
3. For each entry `{id, file}`: the entry JSON `docs/specs/entries/<id>.json` and the design `file` target must exist **in the resulting commit** — i.e. present in the index, or present in HEAD and not removed by this landing (staged deletion / rename source, reusing the existing `parseCachedNameStatus` classifier).
4. Any dangling path → FATAL, listing each dangling entry with its id and expected path, plus the repair guidance (register the entry file into the commit, or strip the entry from the staged registry hunk).

Baseline safety: verified 2026-11-18 against origin/main — all 389 current registry entries have both their entry JSON and `file` target present, so the gate only fires on a landing that itself introduces a dangling reference. Cost: one `git show` + one blob parse when the registry is not landing; one batched existence probe per entry otherwise (entries are ≤ a few hundred; the probe is a `git show :<path>` / `git cat-file -e HEAD:<path>` per candidate, run only for paths not obviously staged).

## 4. Files to change

| File | Action | Description |
|------|--------|-------------|
| `scripts/dev-sync.ts` | modify (1.50.0 → 1.51.0) | (1) `--honor-staged` / `SYNC_HONOR_STAGED` parsing at the argv block; (2) honor-set validation (ghost opt-in, soak contradiction) + WARN on worktree divergence at step 6.5; (3) honor paths excluded from all promotion-sweep add batches; (4) new step 6.55 dangling-reference gate. Strictly additive — no existing step reordered or removed. |
| `scripts/lib/spec-landing.ts` | create (v1.0.0) | Pure helpers: `SPEC_REGISTRY_PATH`, `specEntryPath(id)`, `parseRegistryEntries(json)` (throws on malformed), `danglingSpecRefs(entries, existsInCommit)`. No I/O — testable without git. |
| `tests/unit/spec-landing.test.ts` | create | Pure lib unit tests (parse, dangling detection, malformed fail-closed). |
| `tests/unit/dev-sync-hunk-staging.test.ts` | create | Textual contract tests on dev-sync.ts (the established convention — dev-sync is a monolithic top-level-await script, not import-safe). |
| `tests/unit/spec-landing-incident-sim.test.ts` | create | Live-git incident simulation (temp repo): pre-staged partial registry.json + untracked parallel entry file → honor-staged keeps the adjudicated blob; the dangling gate catches the bad shape pre-commit. |

L1 mirror publishing happens at `/sync` (no hand-copy).

## 5. Test plan

- **Pure lib** (`tests/unit/spec-landing.test.ts`): registry parse round-trip; entry-path derivation; dangling detection with a predicate over (staged ∪ HEAD) sets — entry-JSON dangling, `file`-target dangling, clean set; malformed JSON → throw; non-array `specs` → throw.
- **Textual contract** (`tests/unit/dev-sync-hunk-staging.test.ts`, reading the real source like the existing scoped-staging tests): T1 `--honor-staged` parsed in both argv forms; T2 `SYNC_HONOR_STAGED` read and unioned; T3 ghost opt-in fail-closed fatal present; T4 soak-contradiction fatal present; T5 honor paths excluded from the promotion sweep's add batches; T6 step 6.55 reads the staged registry blob and fails closed on dangling refs and parse errors; T7 version header 1.51.0 + spec reference.
- **Incident simulation** (`tests/unit/spec-landing-incident-sim.test.ts`, temp git repo via `mkdtemp`, hermetic root derived from `import.meta.dir` per the C-C contract):
  - **S1 (the incident shape)**: base commit with registry.json (2 entries) + 2 entry files; worktree registry.json gains a third entry whose entry JSON stays untracked (the parallel batch); staged blob rewritten to the adjudicated 2-entry content (`git hash-object -w` + `git update-index --cacheinfo`). The dangling gate over the staged blob + index/HEAD existence flags the third entry → FATAL, exactly the shape that passed all 2026-11-17 pre-commit gates.
  - **S2 (repaired + honored)**: entry JSON staged (the unshelve), honor-staged on registry.json → dangling gate passes; the honor semantics (honored path excluded from the add sweep) preserve the staged 2-entry blob — assert `git show :docs/specs/registry.json` still lacks the third entry while the worktree file still has it (the worktree keeps the parallel batch for a later sync).
  - **S3 (ghost opt-in)**: honor a path with no staged delta → the validation reports the ghost (asserted via the same classifier logic the lib/scripts export).
- **Battery**: `bun run test:unit`, `bun run verify-scripts`, `bun scripts/audit.ts`, and the dev-sync suite files (`dev-sync-scoped-staging-*.test.ts`, `dev-sync-empty-index-guard.test.ts`, `dev-sync-pipeline-order.test.ts`, `dev-sync-rerun-hygiene.test.ts`) stay green.

## 6. Platform Impact (mandatory)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — dev-sync behavior change is platform-neutral (invoked via the `sync` skill) | N/A |
| Antigravity (GEMINI.md) | None — same script, same skill; no Gemini-specific surface references the changed steps | N/A — dev-sync.ts is the single cross-platform implementation (ADR-0036: no .sh/.ps1 counterparts exist to update) |
| templates/common | Propagation required — `scripts/dev-sync.ts` is L1-owned core-standardized; the L1 mirror refreshes at this landing's `/sync` publish step (never hand-copied) | `templates/common/scripts/dev-sync.ts` (via propagate-to-templates), `templates/common/scripts/lib/spec-landing.ts` |

## 7. Risks

- **R1 — self-hosting**: landing a dev-sync change runs the OLD dev-sync (the landing sync itself cannot use the new honor-staged path). The implementation is strictly additive, so today's machinery lands it; the new feature is exercised by the NEXT sync. Acceptable and documented in the ticket.
- **R2 — honored path also mutated by the pipeline** (S0∩S1 content-overlap classifies it as pipeline output): the honor exclusion still wins — the staged blob is what lands. The WARN on worktree divergence makes any surprise visible. No silent path.
- **R3 — the dangling gate vs. registry regeneration mid-run**: nothing stages between 6.5 and 6.9 (the step-6.9 invariant), and the gate reads the index at 6.55 — the same state the commit below carries. A generator that stages after 6.55 would violate an existing invariant; no new window is opened.
- **R4 — false positives from archive/renames**: verified all 389 entries resolve on origin/main; a future registry edit that legitimately moves a design file must stage the move (rename → source removed, target added), which the gate resolves via the existing name-status classifier (rename source = removed, but the target exists in the index). The gate keys on entry-file existence, not history.
- **R5 — honor-staged misuse** (honoring a path whose real intent was full staging): the ghost/soak fatais and the WARN cover the observable failure modes; the DIM per-path log line keeps the honor decision in the sync output as the audit trail.

## 8. Acceptance criteria

- [ ] `--honor-staged <path>` (repeatable) and `SYNC_HONOR_STAGED` populate the honor set; a staged blob for an honored path survives step 6.5 verbatim (no path-level re-add).
- [ ] Ghost opt-in (honored path with no staged delta) and honor-under-soak are FATAL with repair guidance; worktree-vs-index divergence on an honored path is a visible WARN.
- [ ] Step 6.55 fails closed on a staged registry entry whose entry JSON or `file` target is absent from the resulting commit, and on a malformed staged registry.
- [ ] The 2026-11-17 incident shape (pre-staged partial registry.json + untracked parallel entry JSON) is reproduced and caught pre-commit in the test suite.
- [ ] All existing dev-sync suites, `test:unit`, `verify-scripts`, and `audit.ts` stay green; version header bumped per convention; spec registered.
