# Project Review Remediation — L1 Import Gap & ADR-0073 Reversal (A1/A2)

- **Spec ID**: 2026-10-26-project-review-remediation-design
- **Date**: 2026-10-26
- **Source**: 2026-10-26 full project review findings A1 (Critical) and A2 (High); ticket **T-20261026-001** (urgent); decision record **DEC-20261026-01**
- **Status**: proposed — awaiting user approval (Design Gate Row 0, DEC-20261026-01)
- **Owners**: pm (orchestration), automation-engineer (scripts/registry/ratchet), docs-writer (ADR/constitution/SKILL wording), lifecycle-manager (records + finalization)

## 0. Conclusion First

The next template release ships two mutually-inconsistent L1 script files whose static
import cannot resolve, killing every project's audit gate fleet-wide; and the L1 engine
mirror that created the exposure is an undocumented reversal of ADR-0073 Amendment 3.
**Recommendation — Option (b) refined:** deliver the pure lib
`lib/platform-skeleton-merge.ts` as `L0+L1` (the `lib/upgrade-policy.ts` precedent — the
delivered `validate-templates.ts` needs it under either option), put the engine
(`upgrade-project.ts`) back to `L0`-only per Amendment 3, retire the 16 inert project
copies via the standing prune path, and record ADR-0073 **Amendment 4** as a correction
of record. Land with the T-20261026-011 ratchet (an `l1-import-closure` arm in
`validate-templates.ts`) so the class cannot return, and hold the nightly auto-release
until merged.

## 1. Problem Statement (verified evidence)

### A1 [Critical, script-gap] — L1-delivered scripts statically import a lib that is not delivered

- `templates/common/scripts/upgrade-project.ts:675` (v1.73.0):
  `import { mergeSkeletonSections } from './lib/platform-skeleton-merge.ts';`
- `templates/common/scripts/validate-templates.ts:360` (v1.58.0):
  `import { MANAGED_SKELETON_SECTIONS, validateSkeletonRegistry } from './lib/platform-skeleton-merge.ts';`
- `templates/common/scripts/lib/` contains **no** `platform-skeleton-merge.ts` (directory
  listing re-run 2026-10-26; the module exists only at `scripts/lib/platform-skeleton-merge.ts`, 20.9 KB).
- Root registry `scripts/SCRIPTS.md:209` row `lib/platform-skeleton-merge.ts` has delivery
  layer **`L0`** — deliberately not delivered (ADR-0101: "the engine is L0-only
  (ADR-0073)", `docs/adr/0101-managed-platform-skeleton-delivery.md:41`).
- Landing commit `3cbf1a761` (2026-10-25 08:29 +0900, PR #1606, ADR-0101) updated both L1
  mirrors in lockstep with L0 but not the L0-only lib.
- **Timing (release exposure)**: `templates/VERSION` 0.20.1 was auto-cut by `01b87cce3`
  at 2026-10-25 01:42 +0900 — `git merge-base --is-ancestor 01b87cce3 3cbf1a761` confirms
  the cut precedes the landing. The broken 1.73.0/1.58.0 pair is therefore **unreleased**;
  the next release (v0.20.2) plus the `SYNC_IF_NEWER` project-resync wave would deliver a
  `validate-templates.ts` that dies at module load in every project (project audit gates
  run `bun scripts/validate-templates.ts`).
- **Fleet is currently clean of the broken pair** (verified): all 16
  `Projects/co-*/scripts/validate-templates.ts` are still 1.57.0.
- **Blast radius is exactly two imports** (exhaustive sweep of every static relative
  import in every `.ts` under `templates/common/scripts/`, Bun-style `.ts` resolution —
  re-run 2026-10-26): only the two lines above fail to resolve. All other relative
  imports in the delivered tree resolve.

### A2 [High, systemic] — Undocumented reversal of ADR-0073 Amendment 3

- ADR-0073 Amendment 3 (`docs/adr/0073-upgrade-coverage-policy.md:42`, 2026-09-23):
  `upgrade-project.ts` and `helpers/skills-registry.ts` were "**Physically removed from
  L1**" with rows moved to `L0`, because TEMPLATE TREE SYNC "shipped a fresh inert
  165 KB engine copy into all 11 `Projects/co-*` on every upgrade".
- **Corrected attribution (re-verified)**: the L1 engine mirror was re-created by commit
  **`3f9aba630`** (2026-10-11, automated "workspace sync" landing of T-20261011-014),
  which simultaneously flipped the `scripts/SCRIPTS.md` row from
  `| upgrade-project.ts | L0 | 1.69.0 |` to `| upgrade-project.ts | L0+L1 | 1.70.0 |`
  and added the 3,799-line `templates/common/scripts/upgrade-project.ts`. Commit
  `9b6dcf361` (2026-10-12, citing T-20261011-003 — a spec-hygiene ticket with no decision
  authority, verified from `tickets/governance/T-20261011-003.yaml`) then continued
  updating the mirror (+57/−1) and `dev-sync.ts`'s mirror. The review attributed the
  restoration to `9b6dcf361`; the re-creation itself is `3f9aba630`.
- Today: `scripts/SCRIPTS.md:274` reads `upgrade-project.ts | L0+L1 | 1.73.0` (delivery
  layer column `L0+L1`), `templates/common/scripts/helpers/skills-registry.ts` exists at
  L1 again (re-delivered legitimately 2026-09-25 by `71f04acfd` — see §3), and **all 16
  projects carry an inert engine copy** (co-abap 1.71.0; the other 15 at 1.72.0,
  verified 2026-10-26) — Amendment 3's exact failure mode, re-materialized.
- No ADR-0073 Amendment 4 exists (grep of the ADR file; last amendment in it is
  Amendment 3); no memory rationale found (`memory/2026-10-11.md` in `3f9aba630` records
  "Decisions: None").
- Contradicting artifacts that were never updated:
  - `skills/upgrade-project/SKILL.md:43` — "Workspace root only (`L0` per ADR-0073
    Amendment 1 — projects do not carry a copy …)" — factually false for the current fleet.
  - `docs/constitution/06.5-script-lifecycle.md:127` — "The upgrade engine is `L0`-only
    by design (ADR-0073 Amendments 1 and 3) …" and lists `helpers/skills-registry.ts` as
    an L0-only "companion" (also stale: that helper is `L0+L1` since 2026-09-25).
  - ADR-0101 point 4 — "The engine is L0-only (ADR-0073)".

## 2. Root-Cause Analysis

### Why the mirror came back (2026-10-11)

The design doc that landed with `3f9aba630` —
`docs/designs/2026-10-11-upgrade-stash-tooling-warning-design.md`, for T-20261011-014 —
lists under **Affected**: "`scripts/upgrade-project.ts` 1.69.0 → 1.70.0 (**+ scrub-canonical
L1 mirror**)". The phrase assumes the pre-Amendment-3 status quo: "a root script changed,
so its L1 mirror changes too." No section of that design engages ADR-0073 Amendment 3
(18 days old at that point); nothing asked why an L1 mirror should exist for a script
that resolves `templates/` relative to its own location. Once the row was flipped to
`L0+L1`, the machinery did the rest mechanically: `propagate-to-templates.ts` copies
`scripts/**` → `templates/common/scripts/` for every row whose delivery layer includes
L1 (`includeScriptInL1`), and `generate-scripts-mirror.ts` (dev-sync Step 2.6) mirrored
the row into the L1 registry. **KNOWN**: the flip and the copy happened inside the
automated landing commit; **INFERRED**: the row flip was author intent ("+L1 mirror"),
not a tooling accident — the tooling never flips rows.

There was **no real consumer need**: the L1 `dev-sync.ts` import surface (re-checked)
does not import `upgrade-project.ts`; an in-project copy of the engine cannot source
templates (Amendment 1's voided rationale); the only delivery effect of the L1 mirror is
re-shipping the inert fossil into projects. Contrast `dev-sync.ts` and
`validate-templates.ts`, whose L1 mirrors are legitimate — delivered scripts projects run.

A second, earlier undocumented reversal compounds the confusion: `helpers/skills-registry.ts`
was re-delivered to L1 on 2026-09-25 (`71f04acfd`, "deliver skills-registry helper to L1")
because the delivered `validate-templates.ts` gained a static import of it the same day
(`a369a1511`, line 344 today: `parseSkillRegistryRows`, `collectWorkspaceRegistryFindings`).
That re-delivery was necessary — but it was also never recorded in an ADR-0073 amendment,
so by 2026-10-11 the "engine set is L0-only" rule had already been eroded once without a
paper trail. Amendment 3's own scope adjustment set the precedent that makes both cases
decidable: **leaf pure modules imported by delivered project scripts stay `L0+L1`
(`lib/upgrade-policy.ts`); the L0-only rule is engine-only**.

### Why no validator caught the unresolvable L1 import (A1)

Every standing gate evaluates the L0 copy, where the import resolves:

| Gate | What it checks | Why A1 is invisible |
|------|----------------|---------------------|
| `audit.ts` → `validate-templates.ts` | template/variant integrity, run at workspace root | import resolves at L0 (`scripts/lib/` has the module) |
| `verify-scripts.ts --verify` | SCRIPTS.md registry sync (versions, row shape) | never resolves imports |
| `review-baseline.ts` battery | 7 validators, all L0-side | same blind spot |
| `nightly-scaffold-e2e.yml:40` | `bun scripts/validate-templates.ts` after scaffolding | runs the **workspace** copy, not the scaffolded project's copy |

Nothing executes or statically resolves the import closure of the delivered L1 tree
itself. That is precisely the gap ticket **T-20261026-011** (backlog, verified) exists to
close, and this design lands it with the fix (§6).

## 3. Options Considered

| Option | What it does | Pro | Con |
|--------|--------------|-----|-----|
| **(a)** Keep engine `L0+L1`; register `lib/platform-skeleton-merge.ts` `L0+L1`; Amd 4 legitimizes the L1 engine mirror | Deliver the 21 KB pure lib; keep shipping the engine to projects | Smallest diff; one registry row | Re-institutionalizes Amendment 3's exact failure mode (inert 165 KB fossils in 16 projects, staling); contradicts ADR-0101 point 4, SKILL.md:43, constitution 06.5:127 — all would need rewriting to bless a pattern with no consumer; **still requires delivering the lib** (validate-templates needs it), so it ships strictly more with zero additional function |
| **(b) RECOMMENDED (refined)** Engine back to `L0` (Amendment 3 re-executed); `lib/platform-skeleton-merge.ts` `L0+L1` as a leaf pure module (the `lib/upgrade-policy.ts` precedent); `helpers/skills-registry.ts` stays `L0+L1` (legitimized); prune L3 engine copies via the standing path; Amd 4 = correction of record | Two row edits, one file delete, one file add, prune wave | Fixes A1 **and** A2; restores ADR-0101's stated intent ("engine L0-only; normalization rides the nightly wave from the workspace"); governance texts return to true with one amendment instead of three rewrites; projects stop accumulating fossil engines | Touches the delivered tree (one delete, one add) → next release is minor-classified by `lib/template-release-classify.ts` (D/R/A = MINOR); requires a prune wave over 16 projects (standing `--prune-removed` path, non-manual) |
| **(c)** Thin L1 shim or dynamic-import guard for the skeleton-merge import | Keep engine `L0+L1`; make the import lazy at L1 | No registry layer change | Two code paths for one import; a dynamic-import-guarded `skeleton-registry` arm would **silently skip** exactly where it matters most (the delivered copies that run in projects) — a validator arm that quietly disables itself is worse than the gap; the lib is pure and small, so guarding buys nothing |

**Recommendation reasoning**: ADR-0073's stated failure mode is "an inert engine copy in
every project, staling" — option (a) re-legitimizes it; option (b) removes it. ADR-0101's
intent is "the engine is L0-only; the registry reads section content from
`templates/common/` at merge time" — only (b) keeps that sentence true. And the hard
constraint neither (a) nor its critics noticed: the delivered `validate-templates.ts`
statically imports the skeleton lib **under every option**, so the lib goes to `L0+L1`
regardless — Amendment 3's own scope-adjustment precedent (`lib/upgrade-policy.ts`)
already defines that class. The engine mirror itself has no consumer; it is pure
liability.

## 4. Design Decisions

### D1 — Deliver `lib/platform-skeleton-merge.ts` as `L0+L1` (fixes A1)

- `scripts/SCRIPTS.md:209` row: source stays `L0`, delivery layer `L0` → `L0+L1`;
  annotation notes the class ("leaf pure module imported by the delivered
  `validate-templates.ts` — same class as `lib/upgrade-policy.ts`, ADR-0073 Amendment 4").
- The propagate step then copies it to `templates/common/scripts/lib/` mechanically
  (`includeScriptInL1`), and `generate-scripts-mirror.ts` regenerates the L1 registry row.
- Safety verified: module header declares "Import-safe: no I/O at import time; pure
  string/line processing only"; its sole import is `MANAGED_PATTERNS` from
  `./managed-block-merge.ts` (grep of the file: one import line), which already exists at
  L1 **byte-identical** to L0 (`cmp` verified). The delivered closure resolves after D1
  (re-run of the §1 sweep is an acceptance criterion).

### D2 — Engine back to `L0`-only (re-executes Amendment 3)

- `scripts/SCRIPTS.md:274` row: source `L0+L1` → `L0`, delivery layer `L0+L1` → `L0`.
- Delete `templates/common/scripts/upgrade-project.ts` (3,799 lines). The next
  `propagate-to-templates.ts` run drops the L1 registry row automatically (generator
  R2-rule: no L0-layer row in the mirror span) — verify with `--check-drift`.
- `helpers/skills-registry.ts` **stays `L0+L1`** (delivered `validate-templates.ts:344`
  imports it — re-verified; deleting it would re-break the same gate A1 breaks).
- Retire the 16 inert `Projects/co-*/scripts/upgrade-project.ts` copies (1.71.0/1.72.0)
  through the standing prune path: the engine's own `--prune-removed` (a script absent
  from the template is pruned; `reconcileScriptRegistry` drops the stale project
  registry row). No direct project edits (ADR-0031) — the prune rides the ordinary
  project-resync wave; a one-project canary (co-develop) runs first.
- `propagation-map.json` needs **no domain change** (no new source tree; `lib/` is
  already the `scripts-lib` domain; layer columns drive both copy and prune).

### D3 — ADR-0073 Amendment 4 (correction of record) — draft text

> **Amendment 4 (2026-10-26): correction of record — engine L0-only restated; leaf-module
> class widened; the 2026-10-11 mirror restoration reversed**
>
> The 2026-10-11 landing of T-20261011-014 (commit `3f9aba630`, continued by `9b6dcf361`)
> re-created the L1 mirror of `upgrade-project.ts` and flipped its registry row to
> `L0+L1` without a decision record — its design doc planned "+ scrub-canonical L1
> mirror" as routine, unaware of Amendment 3. By 2026-10-26 all 16 projects again carried
> inert engine copies (1.71.0/1.72.0), the exact failure mode Amendment 3 removed. This
> amendment re-executes Amendment 3 (engine row `L0`; mirror deleted; project copies
> retired via `--prune-removed`) and records two scope facts the registry had already
> drifted into: (1) `helpers/skills-registry.ts` is `L0+L1` — re-delivered 2026-09-25
> (`71f04acfd`) because the delivered `validate-templates.ts` statically imports it; (2)
> `lib/platform-skeleton-merge.ts` (ADR-0101) joins `lib/upgrade-policy.ts` in the
> leaf-pure-module class `L0+L1` — imported by the delivered `validate-templates.ts`.
> The L0-only rule remains **engine-only**: `upgrade-project.ts`,
> `check-upgrade-coverage.ts`. Going forward, any change to the layer of a row in the
> engine set or the leaf-module class requires an amendment-level decision recorded
> before the row flips (enforced structurally by the `l1-import-closure` ratchet for the
> import half; registry-layer drift remains review-surface).

### D4 — Ratchet: T-20261026-011 lands here

New Error arm **`l1-import-closure` (IC-01)** in `scripts/validate-templates.ts`
(v1.59.0, mirrored to L1 as usual): workspace-root-only (existsSync self-skip outside
the root, the `check-upgrade-coverage` convention) — for every `.ts` file under
`templates/common/scripts/` (recursive, `_`-prefixed fixtures excluded per the registry
convention), every static relative import (`from './…'` / `from '../…'`) must resolve,
Bun-style (exact path, then `+.ts`), to an existing file **within that tree**. Failure
message names the importing file, the specifier, and the fix hint "deliver the module or
drop the import — see ADR-0073 Amendment 4 (engine vs leaf-module classes)".
- **Host choice rationale**: `validate-templates.ts` already owns delivered-tree
  integrity, sits in the audit gate and `review-baseline.ts` battery #2, and the check
  is a property of the L1 tree alone. `verify-scripts.ts`' `classifyL0L1Pair` is the
  wrong shape — it checks L0↔L1 copy parity, and a file may legitimately exist only at
  L1 (variant helpers), so parity would both miss and over-fire.
- Unit test: `tests/unit/` fixture tree with one resolving and one dangling import
  (mirrors the §1 sweep, which is this check's prototype).

## 5. Implementation Plan

| # | Task | Owner (agent) | Tier | Files |
|---|------|---------------|------|-------|
| 1 | Flip `lib/platform-skeleton-merge.ts` row to `L0+L1`; flip `upgrade-project.ts` row to `L0`; delete `templates/common/scripts/upgrade-project.ts`; run `propagate-to-templates.ts --apply` (delivers the lib, regenerates the L1 registry span); run `generate-scripts-mirror.ts`; `verify-scripts.ts --verify` green | automation-engineer | medium | `scripts/SCRIPTS.md`, `templates/common/scripts/SCRIPTS.md` (generated), `templates/common/scripts/upgrade-project.ts` (delete), `templates/common/scripts/lib/platform-skeleton-merge.ts` (generated copy) |
| 2 | Add `l1-import-closure` arm (IC-01) + unit fixture test; bump `validate-templates.ts` 1.58.0 → 1.59.0 (L0 + L1 mirror in lockstep) | automation-engineer | medium | `scripts/validate-templates.ts`, `templates/common/scripts/validate-templates.ts`, `tests/unit/` |
| 3 | Canary prune: upgrade co-develop with `--prune-removed` (dry-run then live); confirm engine copy retires, registry row drops, `bun scripts/validate-templates.ts` inside the project exits 0; then let the nightly wave prune the remaining 15 | automation-engineer | medium | `Projects/co-develop/scripts/upgrade-project.ts` (pruned), project `scripts/SCRIPTS.md` |
| 4 | Write ADR-0073 Amendment 4 (§4 D3 draft); fix `docs/constitution/06.5-script-lifecycle.md:127` (drop `helpers/skills-registry.ts` from the L0-only companions clause; cite Amendment 4); `skills/upgrade-project/SKILL.md:43` citation "Amendment 1" → "Amendments 1, 3 and 4" (wording itself stays true after the prune); SCRIPTS.md row annotations | docs-writer | medium | `docs/adr/0073-upgrade-coverage-policy.md`, `docs/constitution/06.5-script-lifecycle.md`, `skills/upgrade-project/SKILL.md` |
| 5 | Lifecycle records (upgrade-project, validate-templates phase-history rows), skill frontmatter bump, `/sync` finalization | lifecycle-manager | low | `docs/lifecycle/scripts/*`, skill frontmatter |

No "pm (direct)" rows — PM orchestrates only (DEC-20261026-01).

## 6. Acceptance Criteria

1. Re-run of the import-closure sweep over `templates/common/scripts/` (the §1 command)
   reports **zero** unresolved imports; the new `l1-import-closure` arm passes and is
   exercised by its unit fixture (red on a dangling import).
2. `bun scripts/verify-scripts.ts --verify` green (registry rows, mirror span, versions
   consistent post-flip).
3. `bun scripts/propagate-to-templates.ts --check-drift` clean (no L1↔L2 drift beyond the
   tolerated gemini-settings class).
4. **Fleet-safety check**: in the canary project after step 5.3,
   `cd Projects/co-develop && bun scripts/validate-templates.ts` exits 0 (module loads —
   this is the exact failure A1 would have shipped); `Projects/co-develop/scripts/upgrade-project.ts`
   no longer exists; project `scripts/SCRIPTS.md` carries no `upgrade-project.ts` row.
5. `bun scripts/review-baseline.ts` battery green (all validators; known-tolerated noise
   unchanged).
6. `bun scripts/audit.ts` green (spec registered, language policy, links — including the
   reworded constitution 06.5 and SKILL.md).
7. Fresh-scaffold E2E (`bun scripts/test-new-project.ts nightly-all-variants --all-variants --yes`
   or the nightly workflow) green: a new project receives `validate-templates.ts` 1.59.0
   + `lib/platform-skeleton-merge.ts` and **no** engine copy.
8. ADR-0073 shows Amendment 4; `skills/upgrade-project/SKILL.md` and constitution 06.5
   statements are true against the tree (grep-verifiable).

## 7. Release Safety

This must land **before the next template release is cut**. The release path is:
`bun scripts/auto-release-template.ts --release` (nightly automatic step, ADR-0089 runner
host — classifies the delivered diff via `lib/template-release-classify.ts`, D/R/A ⇒
MINOR) → `bun scripts/release-template.ts --bump <level> --notes "…" --no-tag` →
`bun scripts/tag-template.ts --fail-on-push-error`. `templates/VERSION` is 0.20.1
(cut 2026-10-25 01:42 +0900, before the 08:29 broken landing), so **any** release cut
from the current tree ships the broken pair and triggers the fleet-wide
`SYNC_IF_NEWER` delivery. PM action: hold the nightly auto-release step (do not run
`auto-release-template.ts --release`, `release-template.ts`, or `tag-template.ts`)
until this design is implemented and the §6 battery is green; the D2 delete + D1 add
will then classify the next cut as a MINOR (0.21.0) carrying the fix, not the break.

## 8. Accessibility & Preview Verification

**Not applicable — scripts/governance change, no UI.** No user-facing web or app surface
is modified; ADR-0065 (accessibility) and ADR-0070 (rendered-preview verification) are
explicitly exempt for this change set.

## 9. Facts Basis

- **KNOWN (verified 2026-10-26, this design)**: every quoted file:line; the L1 lib
  listing; the two unresolved imports (exhaustive sweep); the `3f9aba630` / `9b6dcf361`
  split (re-creation vs continuation) with row-flip diffs; T-20261011-003's scope
  (spec hygiene) and T-20261011-014's design doc ("+ scrub-canonical L1 mirror"); the
  16 project engine copies at 1.71.0/1.72.0 and all-16 validate-templates at 1.57.0;
  `templates/VERSION` 0.20.1 cut before `3cbf1a761` (ancestor check); module purity
  header + single already-L1 dependency (byte-identical); `71f04acfd`/`a369a1511`
  (2026-09-25) for the skills-registry re-delivery and its import; L1 `dev-sync.ts`
  import surface excludes the engine; release script chain; T-20261026-011 in backlog.
- **INFERRED**: the row flip in `3f9aba630` was author intent (the design doc says
  "+L1 mirror") rather than tooling-generated — no tool flips registry layers.
- **ASSUMED**: the remaining 15 projects prune cleanly via the ordinary nightly wave
  after the canary (established `--prune-removed` behavior; canary exists to falsify
  this cheaply).
- **UNKNOWN**: whether any project has locally modified its inert engine copy (a
  LOCAL-PATCH would surface during the prune wave; the prune is preserve-by-default for
  project-owned modifications per v1.64.0+ semantics, so a local fork would be retained
  and reported rather than destroyed).

## 10. Open Questions

None blocking — Option (b) is recommended and self-contained. The user may prefer
Option (a) (accept the L1 engine mirror permanently) to avoid the prune wave; the design
records why that is not recommended (ADR-0073's failure mode, ADR-0101's intent, no
consumer for the mirror).
