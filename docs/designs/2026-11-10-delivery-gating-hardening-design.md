# Delivery Gating Hardening (T-009 / T-010 / T-012) — Design (Row 0)

- **Spec ID**: `2026-11-10-delivery-gating-hardening-design`
- **Date**: 2026-11-10
- **Status**: implemented (spec registered via spec-register at implementation; Design Gate ruling DEC-20261110-04)
- **Author**: architect (PM-dispatched, Design Gate Row 0 — design only)
- **Tracking tickets**: T-20261110-009 (Scope A), T-20261110-010 (Scope B), T-20261110-012 (Scope C — premises corrected by adjudication 2026-11-10, see §1)
- **Related**: U-20261110-001 (the observed silent overwrite), T-20261027-004 / T-20261028-014 (baseline carry-forward lineage), `2026-11-07-fleet-membership-ssot-design` (membership SSOT, DEC-20261107-01), `2026-11-10-co-deck-vr-baselines-recapture-design` (Scope A consumer), co-deck commits `302217b` (v1.3.0 landing) and `f77ee67`, workspace commits `b54e697e4` (test removed upstream), `c2296cc9c` (promoted L0-only to `tests/unit/`)

## 1. Problem statement

The three tickets are one class: **a file's gating basis is absent or unreliable, and the engine stays silent.** Scope C's premises were corrected by the T-20261110-012 adjudication (2026-11-10, execution-verified); this design records the corrected facts and designs from the evidence, not the ticket text.

- **T-009** — `classifyProjectState` returns `NO_BASELINE` when the manifest has no prior baseline (`scripts/lib/upgrade-policy.ts:1584-1586`); the evolved guard passes every non-`PROJECT_EVOLVED` state through (`scripts/upgrade-project.ts:2784`); the committed-divergence delivery then logs `UPDATE` and records plain `ADOPT` (INFO) (`upgrade-project.ts:6270-6278`). A first-time delivery over committed project divergence strips local patches with no disposition — U-20261110-001. The pre-delivery LOCAL-PATCH report even tells the operator *not* to re-apply a patch whose upstream status says "fixed" (`upgrade-project.ts:2936-2937`) — and in U-001 that record was false.
- **T-010** — `fleet-script-parity.ts` canonicalizes only `templates/common/scripts/` (`scripts/fleet-script-parity.ts:113`). Same-version/divergent-content pairs between a variant template and its project copy are invisible between upgrade runs. Live census (co-deck, 2026-11-10): all three divergent pairs, one per row class — `extract_slidedata.mjs` (@1.3.0 == @1.3.0, divergent, 1 LOCAL-PATCH marker — the fork class; `.mjs` is outside the `SYNC_IF_NEWER` `.ts` walk entirely), `gen-slides-pdf.ts` (@1.10.0 vs @1.14.4, project-ahead, 27 markers), `theme-visual-regression.browser.mjs` (@0.1.0 vs @0.2.0, project-ahead, unmarked).
- **T-012 (adjudicated: the ticket premises were wrong)** — PR #217 did **not** deliver `security-validator.ts` v1.3.0; it landed 2026-11-08 in co-deck `302217b` (the 0.30.0 delivery). "Passes at main" was not reproducible — the test fails at main too in the nested `Projects/` layout. There is **no template test file**: `templates/common` ships no `security-validator.test.ts` (removed upstream in `b54e697e4`, 2026-08-06; promoted L0-only to `tests/unit/` in `c2296cc9c`). Nothing was version-gated. What actually happened: the project test copy is an **orphan** — registered project-owned at `Projects/co-deck/scripts/SCRIPTS.md:112` (`L3 | 1.0.2`) — left frozen at 1.0.2 while the delivered script moved 1.1.0 → 1.3.0, and the orphan test then failed against v1.3.0. Verdict: the test is **stale** — v1.2.0+ `detectWorkspaceRoot` resolves the workspace boundary to the enclosing workspace in the nested `Projects/` layout; the single failing case (project test `:443-449`) is the only one of 41 using the un-pinned default validator; v1.3.0 actually fixes the project's only real extends contract. Fix = pin `workspace_root` in that test case; script unchanged.

## 2. Evidence that shapes the design

- **Baselines at first delivery already exist.** The manifest writer hashes delivered bytes from disk for every delivered rel (`upgrade-project.ts:7686`) and carries prior baselines forward (`:7740-7743`). The NO_BASELINE population is therefore only: files never delivered since the policy landed, plus files that were byte-identical at delivery time (no candidate → no baseline). Verified live in `Projects/co-deck`: 11 such rels (README + 10 PNGs).
- **A version is not a content identity.** The 2026-11-10 co-deck run recorded **171 `DRIFT_RESTORED` (WARN)** rows — equal-version, divergent-content restores across `scripts/` (`upgrade-project.ts:4104-4130`; since v1.95.0 it also covers variant-preferred `.ts`, proven by the `scripts/co-deck/snapshot.ts` DRIFT_RESTORED row in the manifest). Any gating design must treat hash as primary and `@version` as a classifier only.
- **`@version`-on-tests does not suffice; hash-parity is the wrong basis for tests.** Demonstrated twice on this very pair: the root test's content changed 2026-10-04 under an unchanged `@version 1.0.2`, and the script was reformatted under an unchanged `@version 1.3.0`. And root/project test copies **legitimately diverge** (import paths, fixture forms, perf thresholds), while identical content still fails environment-sensitively — so neither version equality nor content equality is a meaningful test-comparison invariant.
- **The landmine is `cwd`-derived workspace roots in tests.** Both copies pin `const workspaceRoot = process.cwd()` at module level (`Projects/co-deck/scripts/helpers/security-validator.test.ts:29`; `tests/unit/security-validator.test.ts:29`), and the single failing integration case passes that unpinned root into `validateExtendsSecurity` (project `:443-449`, root `:445`). The root copy carries the identical landmine: it passes at the root cwd and fails with a project as cwd.
- **The `SKIP (no version)` mechanism is real but was not the T-012 cause.** Template `.ts` without `@version` still cannot deliver, silently (`upgrade-project.ts:4034-4038`, overlay arm `:4355`). Census: 0 of 183 `.ts` under `templates/common/scripts/` are unversioned today. The visibility item survives on its own evidence (§4 C-E).
- **CI does not run these suites.** co-deck's `unit-tests` job gates on a `test:unit` script in `package.json` and otherwise posts a skip notice (`Projects/co-deck/.github/workflows/ci.yml:140-149`); co-deck has no `test:unit`. Combined with the billing wall, local execution is the only enforcement point today — which is why the engine, not CI, must carry behavior verification.
- **Today's `EVOLVED` convention is guard-row + caller-row.** An EVOLVED delivery records both rows (`EVOLVED+ADOPT` on the same path: 39 occurrences in co-deck's manifest). New verdicts can follow the same convention without touching the 14 guard call sites.
- **A fourth hole adjacent to these tickets** (out of scope, Open question Q4): `resolveDisposition`'s EVOLVED row delivers template-**unchanged** content over project-evolved content (`upgrade-policy.ts:1630-1637`), and for hash-gated files the candidate reason is satisfied by project-side change alone (`upgrade-project.ts:6157-6159`). This is the engine-side root cause of the T-20261110-011 re-stale loop.

## 3. Goals / Non-goals

**Goals**: no content-losing delivery without a decision row at WARN or worse; no disposition row that depends on the accuracy of upstream resolution records; the same-version/divergent-content fork class visible fleet-wide; a delivered script that breaks a project's own suite is caught by the delivery run itself, not discovered later; orphaned project tests are surfaced for explicit adoption or deletion instead of silently frozen.

**Non-goals**: no change to the disposition matrix for `PROJECT_EVOLVED` (T-006/ADR-0085 semantics stay); no rewrite of `classifyProjectState`'s state set (a new verdict is additive); no resurrection of a common-tree test for `security-validator` (it is L0-only by `c2296cc9c`; the orphan's disposition is adjudicated — pin and keep, registered L3); no change to the re-stale EVOLVED row itself (Q4); no attempt to make co-deck CI run unit tests (billing wall — Q5).

## 4. Design

### Scope A — T-009: NO_BASELINE must not be silent

**A1 — Pure resolver.** Add `resolveUnbaselinedDisposition(cls, hasLocalPatchMarker, disposition)` to `scripts/lib/upgrade-policy.ts`, consulted by `evolvedDeliveryGuard` when `state === "NO_BASELINE" && !matchesDeliverable` (the signal already exists — `matchesDeliverable` is computed at `:1583`; no classifier change). Matrix:

| Condition | Verdict | Delivery |
|---|---|---|
| file carries a `LOCAL-PATCH(upstream-request: …)` marker | `CONFLICT` (ERROR) | SKIP; `--disposition adopt-template[=glob]` grants `ADOPT` |
| no marker | new verdict `UNBASELINED_OVERWRITE` (WARN) | proceeds |

Rationale: a marker is positive proof of intentional local content — that row must require disposition, independent of any resolution record (this is the U-001 suppression fixed structurally). Unmarked divergence is usually pre-policy template vintage, not a patch; a blanket ERROR would hard-fail the first post-change upgrade of every legacy project, so it degrades to a mandatory WARN row (guard records it; the caller keeps its `ADOPT` row, matching today's EVOLVED convention). Add `UNBASELINED_OVERWRITE` to the `DecisionVerdict` union and `DECISION_SEVERITY_CONTRACT` (`upgrade-policy.ts:1429,1455`).

**A2 — Parity baselining** (the ticket's second candidate, made precise): when a raw-bytes pass observes `NO_BASELINE && matchesDeliverable` or "hash equal" at its OK branch, record a baseline at manifest write (provenance is provable: project bytes == template bytes). New `noteParity(rel)` set hashed from disk alongside `deliveredRels` (`upgrade-project.ts:7691`). **Invariant: parity rels must NOT enter the manifest `files[]` array** (it drives `isDeliveredDiff` / E5 attribution at dev-sync 3.9). Applies to TEMPLATE TREE SYNC `SYNC` (raw copies only, not the rendered `docs/context.md`), `SYNC_IF_NEWER: scripts/`, and VARIANT SCRIPTS. This shrinks NO_BASELINE monotonically, so later divergence classifies `PROJECT_EVOLVED` (CONFLICT-capable) instead of WARN-only.

### Scope B — T-010: variant script parity

Extend `scripts/fleet-script-parity.ts` with a per-variant section next to the existing common section: for each fleet project (`listFleetProjects`, unchanged SSOT) resolve its variant from `template-version.txt` (`variant=` line, same parse as `upgrade-project.ts:1767`) and compare `templates/<v>/scripts/<v>/**` against `Projects/<p>/scripts/<v>/**` (`.ts`/`.mjs`/`.json`; universe today: co-abap 14, co-consult 7, co-deck 54, co-game 2, co-safety 21 files). Row classes, decided per the evidence:

- **hash primary, `@version` as classifier** (§2): `match` / `mismatch-equal-version` (both @version equal, bytes differ → the fork class, WARN) / `version-ahead` (project newer → pending port, INFO, **not drift**) / `version-behind` (template newer → pending delivery, INFO) / `missing`.
- **LOCAL-PATCH exception**: a project file with markers is labeled `local-patch (ticket id)`, not drift.
- **Orphan tests**: a project-only `X.test.ts` beside a tracked/delivered `X.ts` is labeled `orphan-test` (WARN) — detection vehicle shared with Scope C (see C-B).
- **Gate location**: stay a WARN-level fleet scan (exits 0), extended in place — do **not** add a blocking pre-flight in `upgrade-project`: project-ahead divergence is legitimate pending port, and the in-run heal for `.ts` already exists (`upgrade-project.ts:4104`). The detector covers the between-runs window that the heal cannot.

### Scope C — T-012: behavior verification, orphan surfacing, authoring contract

The adjudication voids the original candidates (`@version`-on-tests; hash-parity for tests — §2). The evidence supports three mechanisms instead; the first is the engine change, the second extends Scope B's scanner, the third is a contract plus a narrow check. The `SKIP (no version)` visibility idea is retained as a standalone item (C-E).

**C-A — Post-delivery behavior verification** (`upgrade-project.ts`, apply mode only). After all delivery passes, when `deliveredRels` is non-empty **and** at least one delivered file's content hash differs from its pre-delivery bytes (this catches the equal-version drift-restore class too, `:4104`), the run executes the consuming project's own colocated test suite **in the project checkout**:

- v1 test selection: sibling-suffix match — every `X.test.ts` under the project's `scripts/` tree whose subject `X.ts` is in `deliveredRels`. (Colocated-only is the documented v1 bound; transitively-importing tests are a follow-up.)
- Baseline of failures: the same files are run **before** the first delivery write and **after** the passes, same cwd (`projectDir`). Only test cases failing post-delivery that passed pre-delivery count.
- New failures record `BEHAVIOR_REGRESSION` (ERROR) decisions naming the test and the delivered subject; ERROR severity joins `unresolvedErrorDecisions` → non-zero exit and D3.1 landing refusal (dev-sync 3.9). This is the 2026-11-08 catch: the 0.30.0 apply would have failed here.
- Runner unavailable (`bun` missing) → `VERIFY_SKIPPED` (INFO) row, never a failure. Dry-run: no verification, documented limitation (no writes to verify).
- Note the deliberate role split with A1: A1 guards *content provenance*; C-A guards *behavior*. Neither substitutes for the other.

**C-B — Orphan-test detection** (shared scanner with B). In **both** `fleet-script-parity.ts` sections (common and per-variant), a project-only `X.test.ts` beside a tracked `X.ts` emits the `orphan-test` (WARN) label with a disposition hint: adopt explicitly (register L3, as `SCRIPTS.md:112` already did — retroactively legitimate) or delete. First expected hit: `Projects/co-deck/scripts/helpers/security-validator.test.ts` in the common section. Surfacing only — adoption/deletion stays the project's call; the T-012 adjudication already made this one's call.

**C-C — Test-authoring contract** (normative here; enforcement narrow). Delivered and L0 tests must not depend on `detectWorkspaceRoot()`/cwd semantics through un-pinned module-level validators: derive the workspace root from the test file's own location (walk up to the directory containing `AGENTS.md`) or assert the detected root explicitly. Enforcement in this design: a WARN check in `scripts/audit.ts` (root arm) flagging `const <name> = process.cwd()` assignments inside `tests/unit/**/*.test.ts` and `templates/**/tests/**/*.test.ts` (`hermetic-test-roots`). Generalization (fixture forms, perf thresholds, other helpers) is a follow-up ticket.

**C-D — The two adjudicated fixes** (implementation items, outside this design's write scope):

- **(a) Project-side** (co-deck PR): pin `workspace_root` in `Projects/co-deck/scripts/helpers/security-validator.test.ts:443-449` — derive the root from the test file location instead of `process.cwd()` — script unchanged; `@version` 1.0.2 → 1.1.0; update the `SCRIPTS.md:112` row to `L3 | 1.1.0`.
- **(b) Root-side** (workspace PR): the same hermetic fix in `tests/unit/security-validator.test.ts` (module-level `:29`, failing case `:445`) — it passes at the root cwd today and fails with a project as cwd; `@version` 1.0.2 → 1.1.0.

**C-E — UNVERSIONED_SKIP visibility** (retained on its own evidence, decoupled from T-012). Template `.ts` without `@version` still cannot deliver, silently (`upgrade-project.ts:4034-4038`, overlay `:4355`); census 0/183 today. The silent skip becomes an `UNVERSIONED_SKIP` (WARN) decision row + summary line. C2 (from the prior draft) survives unchanged: `scripts/validate-templates.ts` gains the Check B-10 rule for the **common** set — every `.ts` under `templates/common/scripts/` carries `@version` (tests included; the 3 existing test files already comply). Blocking from day one.

## 5. PR split, verification battery, rollout

| PR | Contents | Risk |
|---|---|---|
| 1 | B + C-B (one scanner file) + C-D(b) root hermetic fix + C-D(a) as the parallel co-deck PR | zero delivery-semantics change — land first, freely |
| 2 | A | changes delivery semantics for **every variant** — own PR only |
| 3 | C-A + C-E + C-C audit check + C2 validate-templates rule | engine gains an apply-mode verification step |

The old hard sequencing rule ("C lands after A because C creates new delivery candidates") is **void** — the adjudicated C creates no new delivery candidates; C-A verifies after delivery regardless of classification. No PR-2 → PR-3 dependency remains. Keep A unbundled (attribution), but PR-3 may be reordered ahead of PR-2 if another script-heavy delivery wave is imminent — C-A is the mechanism that would have caught the 2026-11-08 breakage, so it has independent urgency. PR-1's census output remains the sizing input for PR-2 (expect co-deck fork-class rows; unknown for the other four variants).

**Verification battery (mandatory for PRs 2 and 3; adapted for 1)**:
1. Unit: `bun test tests/unit/upgrade-policy-decisions.test.ts` (A: `classifyProjectState` + `resolveUnbaselinedDisposition` cases), `tests/unit/upgrade-decision-log.test.ts` (A rows, parity-baseline `files[]` invariant), a new `tests/unit/upgrade-post-delivery-verify.test.ts` (C-A: trigger condition, sibling selection, baseline-of-failures diff, `BEHAVIOR_REGRESSION` ERROR row, `VERIFY_SKIPPED`, dry-run no-op), `tests/unit/upgrade-versions.test.ts` (C-E rows), `tests/unit/upgrade-tree-sync.test.ts`, `tests/unit/upgrade-restamp.test.ts`, `tests/unit/upgrade-prune-order.test.ts`, `tests/unit/upgrade-delivered-diff.test.ts`, `tests/unit/scaffold-delivery-parity.test.ts`, `tests/unit/fleet-script-parity.test.ts` (B row classes + orphan-test labels).
2. U-001 replay fixture: a temp project with a committed diverged file and no baseline — asserted: unmarked → WARN + delivered + baseline recorded; marked → CONFLICT (ERROR) + SKIP; second run of both → no row (A2 baseline).
3. C-A replay fixture: a temp project holding a delivered script plus a colocated test that passes before and fails after the delivered content changes — asserted ERROR row + non-zero exit; a test failing both before and after produces no row.
4. Fleet dry-run sweep before/after: `bun scripts/upgrade-project.ts Projects/<p> --dry-run` for every member; the permitted delta is exactly new WARN/ERROR rows — zero change to the delivered file set, except marked files newly CONFLICT-skipped.
5. Hermeticity check for C-D: `tests/unit/security-validator.test.ts` green when invoked from a non-root cwd; the co-deck suite green from the project cwd after C-D(a).
6. E2E: `simulate-pipeline` smoke; canary apply on `Projects/co-deck` (live NO_BASELINE + marker population), then the fleet.

**Rollout**: PR 2 merges with the sweep green; first apply window is the co-deck canary; fleet applies follow the normal upgrade cadence. **Rollback**: `git revert` per PR. No migration state: manifests stay `schemaVersion: 2`, additive only (new verdict strings, baselines for parity rels — both tolerated by old readers). A reverted PR 2 leaves A-class events as plain ADOPT (the pre-change behavior) — degraded visibility, not corruption.

## 6. Affected surfaces

| File | Action |
|---|---|
| `scripts/lib/upgrade-policy.ts` | A1 resolver + `UNBASELINED_OVERWRITE` verdict/severity |
| `scripts/upgrade-project.ts` | A1 guard hook, A2 `noteParity` + manifest writer, C-A verification step, C-E rows |
| `scripts/fleet-script-parity.ts` | B row classes + C-B orphan-test labels (both sections) |
| `scripts/validate-templates.ts` | C2: common-set `@version` check |
| `scripts/audit.ts` | C-C: `hermetic-test-roots` WARN check |
| `tests/unit/*` (10 files above) | new/updated cases |
| `tests/unit/security-validator.test.ts` | C-D(b): hermetic workspace-root pin + `@version` 1.1.0 |
| `Projects/co-deck/scripts/helpers/security-validator.test.ts` + `scripts/SCRIPTS.md` | C-D(a): project-side pin + `@version`/registry bump (co-deck PR, external to this repo) |

**Platform impact**: Claude Code — none (no agent/skill/hook/command content changes). Antigravity — none; justification: all changes are engine scripts, scanners, validators, and tests; no platform instruction surface references them. `templates/common` — no content change; C2 and C-C only validate/audit it.

## 7. Acceptance criteria

- [ ] A1: `resolveUnbaselinedDisposition` unit-tested for all four cells (marker × adopt-grant); U-001 replay fixture passes as specified in §5.2.
- [ ] A2: parity-baselined rels appear in `manifest.baselines` but **not** in `manifest.files` (asserted in `tests/unit/upgrade-decision-log.test.ts`); a second dry-run of the same project shows no NO_BASELINE rows for previously parity-observed paths; co-deck dry-run post-merge classifies the 11 live parity rels as baselined.
- [ ] B/C-B: `bun scripts/fleet-script-parity.ts` emits per-variant sections; co-deck shows `mismatch-equal-version` for `extract_slidedata.mjs`, `version-ahead` for `gen-slides-pdf.ts` and `theme-visual-regression.browser.mjs`, `local-patch` labels for marker files, and `orphan-test` for `scripts/helpers/security-validator.test.ts` in the common section; exit code 0; excluded projects produce no rows.
- [ ] C-A: the §5.3 replay fixture asserts a `BEHAVIOR_REGRESSION` (ERROR) row + non-zero exit for a new post-delivery failure, no row for a pre-existing failure, `VERIFY_SKIPPED` when `bun` is absent, and zero verification rows in dry-run.
- [ ] C-D(b): `tests/unit/security-validator.test.ts` green when invoked from a non-root cwd, at `@version 1.1.0`.
- [ ] C-D(a): the co-deck project suite green from the project cwd; `SCRIPTS.md` row reads `L3 | 1.1.0` (verified in the co-deck PR, referenced here).
- [ ] C-C: `bun scripts/audit.ts` flags a seeded `const workspaceRoot = process.cwd()` in a test file (WARN) and is clean on the current tree after C-D(b) lands.
- [ ] C-E/C2: an unversioned template `.ts` under `scripts/` records `UNVERSIONED_SKIP` (WARN) and does not deliver; `bun scripts/validate-templates.ts` fails on a seeded unversioned non-test `.ts` under `templates/common/scripts/` and passes on the current tree (183 files).
- [ ] §5.4 sweep diff reviewed and attached to PR 2.

## 8. Rollback

Per-PR `git revert` (§5). No data migration; manifests remain readable by older engines. C-A adds no persistent state beyond decision rows; its verification step degrades to a no-op when reverted. The only persistent artifact of PR 2 is additional baselines entries, which the carry-forward prune rules already age out when a path leaves the template tree (`upgrade-project.ts:7742`).

## 9. Open questions (Design Gate)

- **Q1** — A1 severity for unmarked divergence: WARN + deliver is the recommendation. Should specific path classes (e.g. `docs/html-themes/styles/**`) escalate to CONFLICT even unmarked? Data from the PR-1 census should decide.
- **Q2** — Should A2's parity baselining also cover MERGE/JSON_MERGE passes (deliverable ≠ raw bytes, needs post-merge hash capture), or stay raw-bytes only? Recommendation: raw-bytes only in PR 2.
- **Q3** — B's `mismatch-equal-version` is report-only. Should VARIANT SCRIPTS gain the common set's unconditional DRIFT_RESTORED arm? The snapshot.ts restore suggests the engine already heals variant `.ts` in-run (v1.95.0), but `.mjs`/`.json` have no such arm. If wanted, it is a separate ticket — restore semantics for variant content are not self-evident (the project may be the fixed side).
- **Q4 (recommended new ticket)** — the EVOLVED (WARN) + deliver row reverts project evolution whenever the candidate reason is satisfied without template content change (hash-gated files: project-side change alone; versioned files: version-bump-only). This is the engine root cause of the T-20261110-011 re-stale loop. Proposed rule: deliver requires `templateChanged` OR a version gate that also implies content change.
- **Q5** — C-A test scope: sibling-suffix only in v1. Should the step optionally run the project's full suite behind a flag (`--verify-suite=all`), and should nondeterministic new failures get a retry-once (the VR suite's jitter precedent) before the ERROR lands?
- **Q6** — Orphan-test disposition ownership: after C-B surfaces an orphan, who owns the adopt-vs-delete call and on what cadence? The T-012 adjudication resolved its instance (pin, keep, L3); a default SLA (e.g. next quarterly skill/roster review) needs a home.
- **Q7** — Should the authoring contract (C-C) be promoted from this design into `docs/standards/` as its own SSOT with the generalized lint, and should co-deck add a `test:unit` package script so its CI job (currently a skip notice, `ci.yml:140-149`) runs the suite whenever billing allows? Both are one-line enablers; neither is required by this design.

## 10. Accessibility exemption note

Engine semantics, fleet scanners, a template validator, hermetic test fixes, and unit tests. No UI, no rendered content, no style changes. No accessibility review required.
