# dev-sync.ts Script Lifecycle

## Metadata

- **Current Phase**: production
- **Version**: 1.43.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-11-08
- **Last Reviewer**: pm
- **Note**: per-script records are optional (SCRIPTS.md is the script lifecycle SSOT per docs/constitution/06.5-script-lifecycle.md); this record is maintained best-effort.

## Created

2026-10-28 (record seeded at v1.33.0; the script itself predates the record — per-script records are opt-in and this is its first record)

## Phase History

| Date | From | To | Reason | Approver |
|------|------|-----|---------|----------|
| 2026-11-08 | production | production | v1.43.0 (U-20261107-003): scoped-staging CONTENT comparison — a dirty-at-S0 file whose bytes changed by S1 (the regenerated docs/VERSION_MANIFEST.md leftover) is re-classified as pipeline output; the S0 snapshot gains a per-path content map (utf-8, absent-on-throw) and step 6.5 re-reads at S1, re-classifying the S0∩S1 overlap by byte difference. Byte-identical overlap files stay residual; deletions keep the existing path. Closes the stale-manifest class (stale bytes committed, fresh regen omitted, main CI VERSION_MANIFEST-drift failure on every push). | automation-engineer |
| 2026-11-05 | production | production | v1.41.0 (T-20261105-002): step 3.88 gains the repaired-at-head tier — memory-union-verify v1.1.0 re-tiers a post-activation drop finding group as INFO when the working tree accounts for every parent-owed block (repairedAtHead, un-headed-block absorption tolerance); unrepaired drops stay FATAL, repaired groups print an INFO line. Completes design §5.3 "a repaired file passes" — the v1 blob-comparison made forward repairs impossible (live-blocked since c8aba5d61). | automation-engineer |
| 2026-11-05 | production | production | v1.40.0 (T-20261104-001, spec docs/designs/2026-11-05-merge-integrity-design.md §5.1): new step 3.88 — memory session-block union-verify, BLOCKING (two-tier rollout user-approved same day): Arm A sweeps bounded recent merge commits (7 days AND 20 merges) touching flat memory logs via helpers/memory-union-verify.ts v1.0.0 (pure core, unit-pinned, byte-identical L1 mirror) requiring every parent block to survive into the merged result plus structural well-formedness; Arm B enforces the same structure on every flat memory log at HEAD (block count === separator count + 1, '## '-headed blocks, no block with >= 2 '## Session Summary' headings — the #1842/#1845 fused-separator signature). Post-activation merges and all worktree findings FATAL with repair guidance; pre-activation merge findings WARN (the design's "expected pass on first run" premise was false — the window holds real immutable-history drops, e.g. merge 3db832974 / PR #1850) and age out with the 7-day window; the five pre-existing malformed logs (2026-10-29/-30/-31, 11-02, 11-03) structurally repaired in the landing commit. Absent memory/ = documented no-op. |
| 2026-11-04 | production | production | v1.38.0 (U-20261104-003): new step 4.87 — agent frontmatter last_updated bump: sync passes that mechanically rewrite an agent file's frontmatter (tier collapse, model-registry delivery, stub merges) left the top-level last_updated stale, so agent-lifecycle-audit emitted identical staleness warnings for every touched file on every later run (co-newbiz: 34 warnings off the single 2026-10-28 commit 0b1a406c). The pass re-stamps the top-level last_updated to the run date for sync-modified agent .md files whose HEAD-to-worktree diff is confined to the frontmatter block, via the shared bumpFrontmatterLastUpdated primitive; body edits and no-ops are never touched; pure decision core helpers/agent-mechanical-date-bump.ts v1.0.0, unit-pinned | automation-engineer |
| 2026-10-31 | production | production | v1.37.0 (U-20261029-004, spec docs/designs/2026-10-31-variant-generators-design.md §4-§5): new step 3.86 — declared generator pre-convergence (regeneration step family, before the audit gate): runs every project-authored `scripts/<variant>/generators.json` manifest via lib/generator-manifest.ts v1.0.0 (array-form Bun.spawnSync, argv[0] must be `bun`, cwd pinned, no env fabrication, ≤ 16 generators / ≤ 8 outputs, containment + duplicate-name rejection), verifies declared outputs on exit 0, stages them; absent/empty manifest = zero-behavior-change no-op; generator failure = loud `[generator:<name>]` FAIL with secret-scrubbed output, no partial staging; the generator's --check form remains the audit's drift gate | automation-engineer |
|------|------|-----|---------|----------|
| 2026-10-31 | production | production | v1.36.0 (T-20261031-003, spec docs/designs/2026-10-31-changelog-normalize-design.md §4): step 3b fail-then-heal — detector findings trigger scripts/changelog-normalize.ts (write mode), re-stage, and re-run the detector, asserting zero findings before the gate verdict; unrepairable structures stay a hard FAIL; zero findings never touch the file. Migration path for the 2026-10-31 wave halt (6 of 11 projects blocked on the v1.35.0 fail-only gate) | automation-engineer |
| 2026-10-29 | production | production | v1.35.0 (U-20261028-013, spec docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md §3.A4): new step 3b — CHANGELOG structural-duplicate gate (blocking): duplicate `### <Category>` headings within one release section, or more than one `[Unreleased]` section, FAIL with a merge-action fix message; detection in helpers/changelog-duplicates.ts v1.0.0, unit-pinned | automation-engineer |
| 2026-10-28 | - | production | Record seeded at v1.33.0 (T-20261028-012, spec docs/designs/2026-10-28-dev-sync-staged-count-design.md): step 6.9 re-derives the commit-time message from the FINAL staged set after step 6.5 staging, fixing the "(0 files)" subject/PR-title class (root PR #1669: 12 files; co-design PR #65: 17 files); memory summary header + MEMORY.md index re-converge when the message changes | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Full sync pipeline: gates (language, main-drift, branch, sensitive-file, merge-in-progress), staging (scoped default / WARN opt-out), commit, push, PR creation
- [x] Step 1 early commit-message composition from the staged set (U-20261008-001) — authoritative for the language gate, memory summary, and branch slug
- [x] Step 6.9 final message composition from the final staged set (T-20261028-012) — commit subject and PR title reflect the set the commit actually contains
- [x] Memory-log session summary + MEMORY.md index stay in sync with the final message (D3 re-convergence)
- [x] Scoped staging with S0/S1 snapshot classification (docs/designs/2026-09-12-dev-sync-scoped-staging-design.md)

## Dependencies

- Bun runtime; git; gh CLI (PR creation; REST fallback per T-20261013-006)
- Consumed by: the `sync` skill (skills/sync/SKILL.md), agents landing work via `/sync`
- Helpers: `scripts/helpers/commit-message.ts`, `scripts/helpers/merge-state.ts`, `scripts/helpers/version-bump.ts`, `scripts/lib/language-guard.ts`

## Domain

**Sync Pipeline** — the workspace root's single landing path (PM Gateway closeout): validate, stage, commit, push, and open the PR for a delivery.

**Key Responsibilities**:
- Enforce the gate battery before any git mutation (fail-closed)
- Derive an honest commit subject and PR title from the change surface (steps 1 + 6.9)
- Keep governance records (memory log, MEMORY.md index, VERSION_MANIFEST, SCRIPTS.md mirrors) converged with the delivered content
