# Upgrade engine: VARIANT-SCRIPTS walk-abort fix + truthful ADOPT decision rows — design

- **Spec ID**: 2026-11-20-upgrade-adopt-row-truthfulness-design
- **Status**: Implemented (2026-11-20)
- **Ticket**: T-20261120-003
- **Date**: 2026-11-20
- **Scope**: L0 (`scripts/upgrade-project.ts` v1.113.0 → v1.114.0, `tests/unit/upgrade-variant-scripts-walk.test.ts` new, `tests/unit/upgrade-core-locked-fork.test.ts` assertion-format update, `tests/unit/fixture-git-identity.test.ts` registry addition) · L1 (fleet-membership exclusions are L0-only per the file's own contract; no L1 payload beyond the dev-sync 4.5 propagation of the touched scripts)

## 1. Problem and evidence

The 2026-11-19 co-deck 0.30.0 wave upgrade (T-20261119-004 adjudication) under-delivered the
variant-scripts surface while its report read clean: `.claude/last-upgrade-delivery.json`
listed 208 delivered paths but only 12 `scripts/co-deck/*`; 20 script-family paths
(19 CONFLICT/ERROR + 1 PROJECT_AHEAD + the SCRIPTS.md registry) were swallowed and had to be
hand-delivered afterwards (co-deck#257, "deliver 20 variant scripts missed by the wave").
The adjudication recorded "45 rows ADOPT-TEMPLATE … scripts 17", yet the persisted decision
log of the run that produced the delivery carries ZERO rows with a `grant` field and still
records those same script paths as CONFLICT — the report claimed resolution the manifest
disproves (the ticket's "ADOPT-grant row reads 'resolved' while the copy never happens").

Forensics on the engine (version at the wave: 1.111.0; verified at 1.113.0) plus a sandbox
replay locate two independent causes:

1. **Engine — the VARIANT SCRIPTS walk aborts on the first conflict-skip**
   (`syncVariantScripts`, both the versioned and the unversioned arm):
   `if (!proceeded) return;` returned out of the *recursive walk function*, killing the
   whole directory frame instead of skipping one file. Every `scripts/<variant>/` file the
   walk would have visited after the first guard-skip got NO decision row, NO
   CONFLICT/SKIP line, and NO copy from the variant channel. Wave-manifest proof: only
   `auto-calibrate.ts` (alphabetically first, the abort point) and the post-walk
   SCRIPTS.md registry sync carry `VARIANT SCRIPTS` rows; the other ~31 walked files carry
   none from that channel. The common scripts pass (`continue` at its guard, correct)
   masks the swallow for `.ts` files — but `collectScriptFiles` collects `.ts` only, so the
   `.mjs`/`.json`/unversioned surfaces lost BOTH channels at once. An `adopt-template`
   grant is parsed and honored right up to the abort, so granted paths after the first
   skip were silently dropped on the variant channel — the grant accepted, the row (via
   the common channel or a dry run) reading resolved, the copy never happening.
2. **Invocation-side (reported, not engine-fixable)** — the wave's resumed apply was
   invoked without the adjudication's `--disposition` flags: the engine cannot lose parsed
   grants (arg loop + `dispositionAdopts` audited; sandbox replay honors per-file globs),
   and the final manifest's zero `grant` rows are only producible grant-less. The
   row-vs-copy divergence the ticket describes is therefore real but compound: a grant-less
   apply re-ran over an adjudication that had (understandably, given cause 1) stopped
   trusting the variant channel.

Row-vs-copy audit of every delivery arm (no change needed, verified truthful as-is):
`evolvedDeliveryGuard`'s PROJECT_EVOLVED arm and `equalVersionRestore` both run
`markerLossBlocks` BEFORE `recordDecision`; the NO_BASELINE arm's every `deliver=true`
outcome reaches its copy (a granted marker loss records the override ADOPT row and
proceeds); PROJECT_AHEAD under a grant stays PROJECT_AHEAD (adoption would downgrade the
project copy — the WARN row already states it, and D3b keeps grants unable to override
tombstones, which record their own ERROR row).

## 2. Decisions

1. **Walk-abort fix (the copy-skip was a bug, fixed as such)**: both arms use the overlay
   arm's existing `if (proceeded) { … }` shape — a guard-skip skips ONE file; the walk
   continues; every owned path gets exactly one truthful row (CONFLICT/EVOLVED_PRESERVE/
   MARKER_LOSS on skip; NEW/ADOPT + copy on proceed). Decision-row severity contract
   unchanged (2026-11-18 audit 2.69.0 sole-increment precedent: never double-count — a
   skipped path still lands exactly one row per channel, asserted in the test).
2. **Bookkeeping truthfulness in the same family**: the VARIANT OVERLAY arm's
   `syncChanged++` moved inside `if (proceeded)` (a conflict-skipped overlay script never
   changed anything); the common pass's equal-version and CORE-LOCKED arms print the
   delivered project path (`scripts/…`) instead of the bare variant-root-relative `rel`
   key in their DRIFT/FORK/COPIED lines and pass `relPath` to `reconcileScriptRegistry`
   (same registry resolution — `reconcileScriptRegistry` strips the `scripts/` prefix —
   so this is report-only; `upgrade-core-locked-fork.test.ts` assertions updated to the
   corrected path format).
3. **Deliberately NOT done**: no post-hoc "granted-but-not-copied" ERROR synthesizer —
   with the walk fixed every owned path is processed and rowed by construction, so the
   synthesizer would be dead code; no decision-enrichment rewrite (the ticket's constraint
   "do NOT key the fix on decisions[]" respected); no wiring of
   `scripts/verify-delivered-versions.ts` into STEP I (5) — tracked as its own follow-up.
4. **Fleet-membership hygiene (T-20261119-007, mechanical — no design doc required per
   DEC-20261118-01)**: `co-deck-worktrees` and `co-newbiz-worktrees` join
   `docs/fleet-membership.json` `excluded[]` (root-repo worktree husks, not variant
   projects; `co-deck-worktrees` was recreated empty 2026-11-20 00:05 KST by tooling,
   proving the defensive value). `decision_ref` stays the authoritative
   `DEC-20261107-01` derivation; the ticket id rides the reason text (the file's schema
   validates `DEC-YYYYMMDD-NN` only). Verified with the real Projects tree: both ids
   excluded, member list contains only real variant projects (17 — the ticket-era 16 plus
   `co-utility`, which joined the fleet on 2026-11-19 after the ticket's census).

## 3. Verification

- New `tests/unit/upgrade-variant-scripts-walk.test.ts` (engine replay, real co-deck
  templates): conflicted `.ts` preserved with exactly one CONFLICT row per channel; the
  `.mjs` probe reached and delivered past the conflict-skip (UPDATE + ADOPT row); every
  walked variant file row-or-parity (order-independent no-silent-swallow invariant);
  non-zero exit on the unresolved ERROR; dry-run parity. **Negative control**: 3 of 5
  assertions fail against the pre-fix engine (git-stash swap verified).
- `tests/unit/` full battery: 4813 pass / 0 fail / 4 skip (includes the 5 new tests and
  the fixture-git registry census).
- `bun scripts/typecheck.ts`: 0 errors (baseline 0).
- `bun scripts/validate-templates.ts`: 0 errors (36 pre-existing warnings).
- `bun scripts/fleet-list.ts --json` with the new exclusions over the live Projects tree:
  `co-deck-worktrees` / `co-newbiz-worktrees` excluded; count 17 real members.

## 4. Risks and limits

- The fix changes WHICH files the variant channel touches on conflicted trees: runs that
  previously aborted mid-walk will now deliver/row the remainder. Expected effect is
  strictly "more truthful rows and previously-swallowed deliveries land"; conflict-skip
  dispositions and exit codes are unchanged (same guard, same severities).
- Projects whose last run silently swallowed rows will see a larger decision log on the
  next upgrade — that is the contract (the log owns what actually happened), not a
  regression.
- The invocation-side half (grants lost between adjudication and apply) is a process gap,
  not an engine gap: the wave runner should carry the adjudicated grant list on the
  resumed command line. No engine change can enforce that; noted for the runner owners
  (v4 runner hardening landed the same day).
- `extract_slidedata.mjs` turned out to be versioned (JSDoc `@version` fallback) — the
  test seeds it version-behind instead of unversioned; the unversioned hash arm remains
  covered by the identical `if (proceeded)` shape.
