# Skill Lifecycle Record Delivery — Design (Row 0)

- **Spec ID**: `2026-11-12-skill-lifecycle-record-delivery-design`
- **Date**: 2026-11-12
- **Status**: approved (implementation complete in PR-3; set to implemented after that PR merges). The user made scope decisions D1-D3 and, in a second round, D4-D9, then D10-D12 on 2026-11-12 (Decisions section). No question is open. Implementation tickets T1..T6 in §9 are proposals for the PM to create.
- **Author**: architect (PM-dispatched, Design Gate Row 0, design only)
- **Input**: upstream ticket U-20261112-005 (from co-develop, `tickets/governance/U-20261112-005.yaml`): "delivered skills arrive record-less at L3 and skill-lifecycle-audit warns for every delivered active skill (observed: 31 warnings in Projects/co-develop)".
- **Related**: U-20261028-011 (Check LC moved out of the L0-only gate), [`2026-11-11-upgrade-overwrite-protection-design.md`](2026-11-11-upgrade-overwrite-protection-design.md) and DEC-20261111-01, ADR-0069 (L1 `docs/` is independently maintained; the `docs` propagation domain is disabled), `docs/self-managed-surfaces.json`.
- **Scope**: design only. This document changes no script, template, project, or skill file. Counts below were measured on `origin/main` @ `6541f4f91` (re-verified 2026-11-12; the earlier `1a537b682` figures did not change) and, for the fleet gap, on the 16 fleet checkouts under `Projects/`.
- **Boundary note (CLAUDE.md §9)**: the generator, validators, and docs are workspace-root (L0) changes. The generated records under `templates/` land through the `/sync` publish step, never by hand and never in the same PR as hand-edited root files.

## Decisions (2026-11-12)

The user answered three questions on 2026-11-12. They are binding for this design.

| # | Question | Decision | Effect on this design |
|---|---|---|---|
| D1 | Form of a delivered record | **Refined projection.** Delivered records are a sanitized, version-free projection, not raw L0 copies. The sanitization rules in §4.2 stay as designed. | `--verbatim` is dropped from scope (§4.2). The 19 L0 records with internal references are not edited. |
| D2 | Variant-own skills | **Deliver together with the common ones.** The 42 common records and the 153 derived variant-own records ship in the same rollout (same template release, same upgrade wave). Not "common first, variants later". | T3 carries both batches; T5 rolls both out in one wave (§5, §9). |
| D3 | Leftover project-side records | **Allowed.** Stale or leftover records in projects are tolerated; no prune requirement. | Explicit non-goal (§3). Risk 3 is accepted, not mitigated. |
| D4 | co-newbiz (49 active project-local skills, no variant template) | **Give them records.** Derived records are generated for all of co-newbiz's non-common skills. Scope grows beyond the 153 (§4.1). co-newbiz is a frozen project: delivery happens at its freeze-lift apply. | New total of 218 derived records; co-newbiz is delivered by a project-side batch because it has no template (§4.1, D12). |
| D5 | Default Owner when frontmatter has no owner | **Map by skill name** through an explicit, checked mapping table; no silent guessing. | Rule in §4.2. Maintenance cost and error risk accepted by the user. |
| D6 | SLR (new `validate-templates` check) | **Blocking together with the records.** Amended by D10: SLR becomes blocking in the same template release window as the records, never before them. | §4.6, §9. |
| D7 | Template PR shape | ~~One template PR.~~ **Superseded by D10.** The records are still one templates-only PR; they are no longer combined with root files. | §9. |
| D8 | `explain-me` (experimental common skill) | **Deliver its record.** | Included in the 42 common records. Experimental co-newbiz skills (16) follow the same rule for uniformity. |
| D9 | Frozen projects (co-deck, co-abap, co-hr, co-safety, co-newbiz) | **Receive the records in ONE batch at their freeze-lift apply.** | §5, T5/T6. |
| D10 | Root and template boundary (CLAUDE.md §9) | **Split root and templates into separate PRs.** Supersedes D7 and amends D6. Three sequential PRs: root, templates, root (§9). SLR runs report-only between merges only, inside one template release window. | §9 PR sequence. |
| D11 | Enforcement mechanism | An explicit enforcement flag in a config file (`scripts/skill-record-enforcement.json`, `{ "enforce": false }`), read by SLR; PR-3 flips it to `true`. | §4.6, §9. |
| D12 | co-newbiz delivery | **Project PR** on the co-newbiz repository through a generator `--project <path>` mode. No `templates/co-newbiz`. Lands at its freeze-lift apply on that project's own PM merge path; not part of any root or templates PR. | §4.1, §9 T6. |

## Implementation outcome (2026-11-12, PR-3)

Actual PR sequence: PR-1 #1976 (generator, report-only SLR), PR-1b #1985 (generator Korean handling; found that `new-project` already delivers the common records through its docs copy, so the scaffold copy planned in T4 is not needed and the reviewed-gap entries became one prefix rule), PR-2 #1986 (the 188 generated records; SLR clean at 225 skills), PR-3 (this PR). T4 therefore shrank to the `enforce: true` flip plus the dev-sync hook. The hook is step 4.505 (right after the 4.5 publish) and runs `generate-skill-lifecycle-records.ts --write`; the decision is the pure `recordHookVerdict` (fatal in L0 context on failure). The flag file is root-only (not propagated to templates). Negative checks (deleted record, unknown owner, missing owner) fail SLR with a named file and fix text.

## 1. Problem statement

Template delivery ships `skills/<name>/SKILL.md` to projects, but the governance record for that skill (`docs/lifecycle/skills/<name>.md`) stays behind. Project audits then warn once per delivered active skill.

Evidence:

- L0 holds 58 records in `docs/lifecycle/skills/` (109,734 bytes in total). `templates/common/docs/lifecycle/skills/` holds 7 (6,899 bytes): `decision-record`, `evidence-ledger`, `handbook`, `i18n-audit`, `i18n-formatting`, `i18n-layout`, `i18n-locale-config`. Those 7 are L1-authored records of L1-only skills. None of the 58 L0 records describes them.
- Check LC (`scripts/skill-lifecycle-audit.ts:922-945`) warns when an active, non-self-managed skill has no `docs/lifecycle/skills/<name>.md`. Since v1.9.0 (U-20261028-011) it runs in projects.
- Measured fleet gap (active skills with no record, 2026-11-12): co-develop 31, co-abap 42, co-architect 37, co-deck 16, co-design 26, co-export 46, co-game 33, co-hr 46, co-learning 28, co-news 40, co-price 44, co-safety 87, co-security 32, co-work 32, co-newbiz 83, co-consult 0.
- The co-develop number matches the ticket: 28 common-skill records plus 3 variant-own skills equals 31.

Why the records never arrive: the L0→L1 `skills` propagation domain copies only `*/SKILL.md` (`scripts/propagation-map.json`, domain `skills`). The `docs` domain that could carry `docs/lifecycle/` is disabled since 2026-07-08 (ADR-0069). The scaffold step (`new-project`) does not copy `docs/lifecycle/skills` either; `scripts/helpers/scaffold-markers.ts:438-470` lists the 7 L1 records as "reviewed gaps".

## 2. Evidence that shapes the design

- **A delivery path for L1 records already exists and works.** `resolveClaim` classifies every `docs/lifecycle/**` path as policy `WORKSPACE` (`scripts/lib/upgrade-policy.ts:446-455` lists `lifecycle` in `WORKSPACE_DOC_DIRS`; `:790-793` returns the claim). The TEMPLATE TREE SYNC pass handles `WORKSPACE` at `scripts/upgrade-project.ts:6708-6741`: a present file is `SEED_SKIP` (INFO, never overwritten, never pruned); an absent file is copied and recorded `NEW`, after the tombstone guard. Evidence it works: `Projects/co-hr` and `Projects/co-safety` each carry exactly the 7 L1 records.
- **Common skills reach every variant.** Every variant receives all 42 `templates/common/skills/*` plus its own `templates/<variant>/skills/*`. Verified: for co-develop, 28 + 3 missing records equal 31 warnings. So the per-variant skill set is `common (42) + variant-own`, and the records for the common part are identical for all 15 variants.
- **WORKSPACE seeds sit outside the overwrite-protection verdicts.** The seed branch never calls `classifyCandidate`, `resolveDisposition`, the baseline, or the A1/E2 marker guard. DRIFT_RESTORED, EVOLVED_PRESERVE, PROJECT_AHEAD, UNBASELINED_OVERWRITE, and MARKER_LOSS cannot occur for a record. The only decision rows are `NEW` (INFO) and `SEED_SKIP` (INFO).
- **Check MV is the only project-side consistency check on a record.** `lifecycleRecordVersions` (`skill-lifecycle-audit.ts:386-394`) needs two `## Metadata` blocks, each with a `**Version**` line, and returns null otherwise. Of the 35 L0 records for common skills, only `ci-triage` has that shape. Check E (record Version/Owner vs frontmatter, `lifecycle-sync-audit.ts:515-570`) returns early when not at the workspace root (`:517`), so it never runs in a project. `validate-skills.ts` requires only `## Phase History` and `## Acceptance Criteria` (`:54`).
- **L0 records carry L0-internal history.** Of the 35 L0 records that describe common skills, 19 contain at least one reference that does not resolve in a project, 59 references in total. Pattern counts per record: `ADR-\d+` in 9, `docs/designs/` in 7, ticket ids `[TU]-\d{8}-\d+` in 11, `docs/decisions` or `DEC-` in 4, `tickets/` in 1, `docs/reports/` in 1, `CONSTITUTION.md` in 1.
  - `gateguard.md` ends with "Specified in CONSTITUTION.md section 11.2". That is the one hit the audit leak scan would block: `L0_REF_PATTERN` in `scripts/helpers/l0-ref-policy.ts:42` is `CONSTITUTION\.md|docs[/\\]constitution[/\\]`, and `audit.ts:3328-3360` scans every `.md` under `templates/`.
  - `delegate-to-hub.md:13,33-34` cites `docs/designs/2026-11-01-hub-consolidation-design.md` and `docs/adr/0103-hub-delegation-channel-n2-exception.md`. Neither path exists in a project.
  - `sync.md:16-21,40-41` cites ADR-0074, ADR-0078, ADR-0079, T-20261106-010 and three `docs/designs/` specs.
  - `agent-lifecycle-manager.md:38-44` cites DEC-20261106-03 and ADR-0102.
  - `meeting-facilitation.md:18,49-51` cites ADR-0196, DEC-20261109-01 and U-20261109-001.
  - `ci-triage.md:14,40` cites `docs/designs/2026-09-08-ci-triage-skill-design.md` twice.
- **The scrub does not cover these.** `scripts/lib/constitution-scrub.ts` rewrites `CONSTITUTION.md` and `docs/constitution/` forms and the `docs/adr/` link targets (rule A-9). It has no rule for bare `ADR-NNNN`, ticket ids, `DEC-` ids, or `docs/designs/` paths, and the `l0-ref-policy` test pins only the CONSTITUTION pattern (`tests/unit/l0-ref-policy.test.ts`). Scrubbing would therefore clear the audit block but leave 18 records with dangling citations.
- **Records churn.** 27 commits touched `docs/lifecycle/skills/` since 2026-10-01 (`project-resync.md` 6, `skill-graph-analytics.md` 4, `upgrade-project.md` 3, `sync.md` 3). Verbatim copies delivered by a seed-only claim are stale within weeks. There is no automatic staleness failure in projects, but the content would be wrong.
- **The L0 record set is not the delivered skill set.** 23 of the 58 L0 records are for skills that never ship: 11 L0-only skills (for example `new-project`, `project-resync`, `upgrade-project`, `trail`) and 12 records whose skill is gone or renamed (`audit-workspace`, `k-dart`, `k-ecos`, `k-kosis`, `k-krx`, `k-law`, `k-opendata`, `meeting`, `handbook-sync-audit`, `simulate-l3-to-variant-promotion`, `simulate-project-creation`, `validate-docs-links`).
- **Variant-own skills have no L0 record at all.** 183 skills live only under `templates/<variant>/skills/`. 15 records for them exist in variant templates (co-price 10, co-security 3, co-consult 1, co-deck 1). The rest are authored, if at all, by the project (co-consult has 61 project records).

## 3. Goals and non-goals

**Goals**

1. A project that receives a template skill also receives a lifecycle record for it, so Check LC stays silent for every template-delivered skill.
2. A record that a project authored is never overwritten or deleted by delivery.
3. Delivered content contains no reference that does not resolve in a project.
4. Template-side coverage is machine-checked, so a new or promoted skill cannot ship record-less again.

**Non-goals**

- No change to Check LC severity, and no `self-managed-surfaces.json` entry for delivered skills (the ticket reporter and the user both reject that path).
- No change to the overwrite-protection engine work (E1-E4, G1). The delivery uses the existing seed path, which those changes do not touch.
- No record for project-local skills. They are project-owned; Check LC keeps warning for them, which is the correct signal.
- No re-enabling of the `docs` propagation domain, and no new ADR superseding ADR-0069.
- **No pruning of stale or leftover project-side records (D3).** A record whose skill the project deleted, renamed, or never kept stays in `docs/lifecycle/skills/`; nothing deletes it and no check flags it. Reason: the `WORKSPACE` seed contract is "never overwritten, never pruned" (`upgrade-project.ts:6713`), Check LC does not inspect orphan records, a stray 1 KB markdown file is inert, and a prune would need engine work in the surface the overwrite-protection stream (PR-A/B/C) is rewriting, with a real risk of deleting a record the project authored itself. No tombstone or skill-aware seed condition is added.
- No bulk delivery of records for skills that do not ship (the 23 L0-only and orphan L0 records, §4.1).

## 4. Design

### 4.1 Decision (a): what ships

**Ship exactly the records of delivered skills, and only per delivered skill set.** Not all 58.

| Source | Records | Goes to | Form |
|---|---|---|---|
| Common skills with an L0 record | 35 | `templates/common/docs/lifecycle/skills/` | projection of the L0 record (§4.2) |
| Common skills authored at L1 (existing) | 7 | same directory | unchanged, hand-authored |
| Variant-own skills | **153** still missing (of 183 own skills; 30 already have a variant record or share a common name) | `templates/<variant>/docs/lifecycle/skills/` | generated from `SKILL.md` frontmatter (§4.2) |
| L0-only skills and orphan records | 23 | not shipped | excluded by construction |

Recount 2026-11-12 against `origin/main` @ `6541f4f91` (file counts: for each `templates/<variant>/skills/<name>/`, skipped when `templates/common/skills/<name>/` exists or a record is already in the variant or common `docs/lifecycle/skills/`): the total is 153 and every per-variant figure in the table matches the earlier estimate (13, 5, 17, 9, 1, 3, 11, 4, 12, 0, 6, 12, 53, 4, 3). Of the 183 own skills, 13 share a name with a common skill (co-design 5, co-safety 7, co-price 1) and 17 already have a record (co-price 9, co-security 3, co-consult 1, co-deck 1, co-develop 1, co-game 1, co-learning 1). Under D2 all 153 ship with the 42 common records. Note that the 42 common skills include `explain-me`, whose status is `experimental`; Check LC only warns for `active` skills, so 41 of the 42 are warning-relevant, and the record is delivered anyway so the set stays uniform.

All 42 common records go to every variant, because every variant receives all 42 common skills. Per-variant totals after delivery (common 42 plus the variant's own skills not already covered):

| Variant | own skills | own records still needed | records after delivery | active skills missing today | residual (project-local) |
|---|---:|---:|---:|---:|---:|
| co-abap | 13 | 13 | 55 | 42 | 1 |
| co-architect | 5 | 5 | 47 | 37 | 0 |
| co-consult | 18 | 17 | 60 | 0 | 0 |
| co-deck | 10 | 9 | 52 | 16 | 0 |
| co-design | 6 | 1 | 44 | 26 | 0 |
| co-develop | 4 | 3 | 46 | 31 | 0 |
| co-export | 11 | 11 | 53 | 46 | 1 |
| co-game | 5 | 4 | 47 | 33 | 1 |
| co-hr | 12 | 12 | 54 | 46 | 0 |
| co-learning | 1 | 0 | 43 | 28 | 0 |
| co-news | 6 | 6 | 48 | 40 | 0 |
| co-price | 22 | 12 | 64 | 44 | 1 |
| co-safety | 60 | 53 | 95 | 87 | 0 |
| co-security | 7 | 4 | 49 | 32 | 0 |
| co-work | 3 | 3 | 45 | 32 | 1 |
| **Total** | 183 | **153** | | | |

**co-newbiz (D4, D12)**: no variant template exists, so it receives the 42 common records through the template and needs its own derived records for 65 non-common skills (66 skills outside the common set, minus `value-chain-linkage-analysis`, which already has a record): 49 `active` plus 16 `experimental`. Check LC only warns for the 49 active ones; the 16 experimental ones get a record for uniformity (D8). All 65 carry an `owner` in frontmatter and every owner exists as an agent in the project.

**New totals under D1-D9** (measured on `origin/main` @ `732364334` and the `Projects/co-newbiz` checkout):

| Group | Records | Where it is delivered |
|---|---:|---|
| Common, projected from L0 | 35 | `templates/common/docs/lifecycle/skills/` |
| Variant-own, derived (14 variants, per-variant table above) | 153 | `templates/<variant>/docs/lifecycle/skills/` |
| co-newbiz own, derived | 65 | project PR on co-newbiz's own repo (D12) |
| **Generated total** | **253** | 188 template files plus 65 project-side files |
| Hand-authored (unchanged) | 7 common, 10 co-price | not touched |

After delivery co-newbiz's residual drops from 49 to 0. The template PR carries 188 generated files (about 190 KB); co-newbiz's 65 files are not in it.

The "residual" column was computed against the actual project trees: active skills that are in neither the common set nor the variant template. Five projects have exactly 1; co-newbiz had 49, which D4 now removes.

### 4.2 Decision (b): mechanism and record form

**Recommended: a generator plus the existing WORKSPACE seed.** Three mechanisms were weighed.

| Option | How | Verdict |
|---|---|---|
| M1: propagation-map entry | New domain copying `docs/lifecycle/skills/*.md` L0 → `templates/common/docs/lifecycle/skills/` verbatim, following the `agents-governance-docs` precedent | Rejected. `propagate-to-templates.ts` has only `copy` and `marker-inject` modes (`:702`, `:1136`), so a transform needs engine work. The domain cannot express "only the 35 delivered skills" except through a 23-entry exclude list that rots on every new L0-only skill. Verbatim copy carries the 59 unresolvable references (§2) and needs a bounded exception to ADR-0069. |
| M2: new upgrade-project pass | The engine renders a record from each delivered `SKILL.md` | Rejected for now. It changes the engine that the overwrite-protection stream (PR-A/B/C) is rewriting, and the output would be un-reviewable at template level. |
| **M3: generator + L1 template files + existing seed** | A new script writes the records into the template tree; upgrade delivers them through the existing WORKSPACE seed claim | **Recommended.** No engine change. Same shape as the 7 records already delivered and observed in the fleet. |

**Generator**: `scripts/generate-skill-lifecycle-records.ts` (new, L0). Two input modes:

1. **Projection** (35 common skills with an L0 record). Output is the L0 record reduced to the project-facing core:
   - keep: title, `Skill`, `Status`, `Owner`, `Created`, `Description`, `Dependencies` (after the path check below), `Phase History` reduced to the creation row, `Acceptance Criteria`.
   - drop: `Version`, `Last Updated`, `Changelog`, `Notes`, and every sentence that contains a pattern from the L0-internal list.
   - The L0-internal list is `ADR-\d+`, `DEC-\d{8}`, `[TU]-\d{8}-\d+`, `docs/(designs|decisions|adr|reports)/`, `tickets/`, `memory/\d`, plus the existing `L0_REF_PATTERN`. A shared `L0_INTERNAL_REF_PATTERN` is added to `scripts/helpers/l0-ref-policy.ts` so the generator, the validator, and the audit use one definition.
   - Dependencies naming a path are kept only when the path exists under `templates/common/` (for example `scripts/hooks/gateguard-fact-force.ts`).
2. **Derivation** (variant-own skills). The record is built from the `SKILL.md` frontmatter: name, status, scope, owner, description, creation date from `last_reviewed` or the first git commit date. Same section layout as the 7 existing L1 records (`templates/common/docs/lifecycle/skills/handbook.md`).

Every generated file begins with a one-line generated marker comment, `<!-- generated by scripts/generate-skill-lifecycle-records.ts — hand edits are overwritten at the next publish -->`, so reviewers and the validator can tell generated records from the 7 hand-authored ones. The generator never touches a file that lacks the marker (the 7 existing records and `co-price`'s 10 stay hand-authored).

**Owner resolution (D5)**: deterministic, three steps, no guessing.

1. The SKILL.md frontmatter `owner:` wins. Measured 2026-11-12: all 183 variant-own skills, all 42 common skills and all 66 co-newbiz non-common skills carry `owner:`, so step 2 is unused today (zero unmapped skills).
2. Otherwise look up the skill name in an explicit mapping table, `scripts/data/skill-owner-map.json` (generator-owned, `{ "<variant>/<skill>": "<agent>" }`, with `"*/<skill>"` for a name valid everywhere). The table is hand-maintained and reviewed in the PR that adds the skill. Name-based inference is the human's judgement recorded in the table, never run-time pattern matching.
3. Otherwise the generator exits non-zero naming the skill, and the SLR validator fails the same way. There is no default owner and no `pm` fallback: an unmapped skill blocks the PR, which is what prevents a silent wrong owner.

The validator also checks that the resolved owner exists as an agent (a recursive search of the variant's `agents/` and the common and L0 rosters; `co-safety` keeps 50 domain agents under `agents/domains/`).

Accepted cost and risk (user, 2026-11-12): the table is a second place to maintain; a mapped owner can be wrong without any check able to tell (the validator proves existence, not fit); and it can drift when agents are renamed. Mitigation: the table is empty today, so the risk applies only to future skills that omit `owner:`.

**Why the version fields are dropped.** The seed claim never refreshes a record in a project. A record that carries `Version: 1.4.0` is wrong at the next bump, and for `ci-triage` it would turn into an ERROR through Check MV. The 7 existing L1 records already use the version-free form (`Version at record creation`, creation date only) and have run in the fleet since 2026-09-21 with no audit signal. A delivered record is therefore a birth certificate: what the skill is, who owns it, what "production" meant for it. Version history stays at L0 where it is authored.

**Verbatim copy is out of scope (D1).** No `--verbatim` flag is built. For the record: verbatim would fail for 19 of 35 records today (§2), so it would have required editing those L0 records first.

### 4.3 Interaction with delivery, drift, and overwrite protection

| Mechanism | Interaction | Evidence |
|---|---|---|
| Upgrade-policy verdicts (`DRIFT_RESTORED`, `EVOLVED`, `EVOLVED_PRESERVE`, `PROJECT_AHEAD`, `UNBASELINED_OVERWRITE`, `MARKER_LOSS`) | None. `WORKSPACE` seeds are decided before classification: present → `SEED_SKIP`, absent → `NEW`. The template-vintage baselines (DEC-20261111-01, E3) and the marker guard (E2) are never consulted. | `upgrade-project.ts:6708-6741` |
| Project-authored records | Always win. A project record at the same path is `SEED_SKIP` (INFO). Nothing in the engine compares it with the template record, so a project can rewrite its records freely. | `:6709-6717` |
| Deleted records | The tombstone guard (U-20261028-001) stops re-delivery of a previously delivered seed the project deleted. A record the project never had is delivered normally. | `:6720-6722` |
| `l2_drift_eligible` | Not applicable. The generator output is not a propagation domain, so L1→L2 drift detection does not see it. If M1 were chosen the domain would have to set `l2_drift_eligible: false`, like `agents-governance-docs`. | `scripts/propagation-map.json` |
| Pruning | Records are never pruned (`WORKSPACE`: "never overwritten, never pruned"). A record for a skill a project later deletes stays; this is accepted by D3 and is a documented non-goal (§3). Check LC does not flag orphan records. | `:6713` |
| Scrub / L0 leakage | Satisfied by construction. The audit leak scan (`audit.ts:3328-3360`) still runs on the generated files and is the backstop. The projection also removes the non-CONSTITUTION references the scan cannot see. | §2 |
| Overwrite-protection rollout | Independent in code, ordered in operations (§8). | §8 |

### 4.4 Decision (c): project-authored records and project-local skills

- **Project-authored record for a template skill** (co-consult 61, co-deck 28, co-price 16, co-develop 21, and so on): untouched. Seed-only is the contract.
- **Project record that drifts from the L1 record**: no signal and none wanted. The parity validator (§4.6) compares L0 with L1 only, never L1 with projects.
- **Project-local skill** (a skill in neither `templates/common/skills` nor the variant): the project writes the record. Check LC continues to warn, and its `fix` text gains one sentence: "Template-delivered skills receive their record through `upgrade-project`; if this skill is project-local, create the record." No severity change.
- **Self-managed skills** (`docs/self-managed-surfaces.json`, for example `trail`): unchanged, exempt.

### 4.5 Decision (d): volume and run time

- **Templates**: 35 projected records at about 1 KB each (the 7 existing average 986 bytes) plus 153 derived records, about 190 KB across `templates/`, against 48,772 KB of `templates/` today (0.4%). A verbatim copy of the 35 would be 61,424 bytes, but 61 KB of it carries the L0 history the projection drops.
- **Per project**: at most 42 common records (about 45 KB) plus up to 53 variant-own records (co-safety) in the worst case. Across the 16 projects the seeded markdown totals under 1 MB.
- **Upgrade run time**: no new pass. Records join the file walk that TEMPLATE TREE SYNC already performs (`iterEffectiveTemplateFiles`). The added work is at most 95 `existsSync` checks plus up to 95 copies in the first delivery, and 95 `SEED_SKIP` rows (INFO) on later runs. This was not benchmarked. A before/after dry run on co-safety, the largest case, is a PR acceptance item (§9, T3). Under D2 the first delivery is the full set: up to 95 records for co-safety.
- **Decision-log noise**: up to 95 extra INFO rows (`NEW` once, then `SEED_SKIP`) per project. INFO rows do not gate landing (`dev-sync.ts:1196-1215` reads ERROR only).

### 4.6 Decision (e): audit and validator changes

**Check LC after delivery.** Behavior is unchanged. For a delivered project the warning count drops to the "residual" column in §4.1. One optional improvement: when the skill exists in the delivered template set but its record is absent, the fix text says "run `bun scripts/upgrade-project.ts`" instead of "create the record".

**New validator, `validate-templates.ts` check `SLR` (skill lifecycle record coverage and parity)**, blocking per D6, amended by D10 and D11: it ships wired but report-only (reads `enforce: false`) and is flipped to blocking after the records land, so it is never blocking without the records and the report-only window ends within one template release window. A fourth rule is added: **owner**, every record's owner resolves per §4.2 and an unmapped skill fails.

1. **Coverage**: every active, non-self-managed skill under `templates/common/skills/` has `templates/common/docs/lifecycle/skills/<name>.md`; every skill under `templates/<variant>/skills/` has a record in `templates/<variant>/docs/lifecycle/skills/` or the common directory. This is what keeps U-20261112-005 from recurring when a skill is promoted.
2. **Parity**: for each generated record (marker present), regenerate in memory and compare bytes (`generate-skill-lifecycle-records.ts --check`). A hand edit of a generated file, or an L0 record change that was not republished, fails with the file name.
3. **Leak**: no file in a `docs/lifecycle/skills/` template directory matches `L0_INTERNAL_REF_PATTERN`. The existing audit leak scan covers only `CONSTITUTION`; this adds the ADR, ticket, DEC, and design forms for this directory only, so no other template doc changes behavior.

**Publish wiring**: `dev-sync.ts` step 4.5 (L0→L1 publish) runs the generator in write mode, the same way step 4.65 regenerates the skill graph. `validate-templates.ts` runs it in `--check` mode. Neither needs a `propagation-map.json` change.

**Unit tests**: `l0-ref-policy.test.ts` gains cases for `L0_INTERNAL_REF_PATTERN`; a new `generate-skill-lifecycle-records.test.ts` pins the projection of five real records (`gateguard`, `sync`, `delegate-to-hub`, `ci-triage`, `meeting-facilitation`) and one derived record.

### 4.7 Scaffold parity

`new-project` does not copy `docs/lifecycle/skills` (`scaffold-markers.ts:438-470`, the "reviewed gap" entries). A freshly scaffolded project therefore warns on its first audit and heals on its first upgrade. T4 removes the 7 reviewed-gap entries and makes the docs copy include `docs/lifecycle/skills/`, so new projects start clean. `scripts/test-scaffold-delivery-parity.ts` already compares the scaffold against the delivery and pins the result.

## 5. Fleet rollout and migration (decision f)

The records ride the next upgrade wave. They are not delivered by a targeted run. Targeted off-cycle runs are exactly the class that caused the content-losing deliveries in the overwrite-protection audit (PR #1952), and a targeted run would still carry whatever else the wave contains.

Ordering relative to the overwrite-protection rollout (DEC-20261111-01):

1. **Template side first, no engine dependency.** T1, T2 and T3 (§9) land at L0/L1 on their own, and T3 delivers common and variant-own records together (D2), so one `release-template` cut carries the full record set. They do not touch `upgrade-project.ts` or `upgrade-policy.ts` and are independent of PR-A/PR-B/PR-C.
2. **The five frozen projects wait.** co-deck, co-abap, co-hr, co-safety, and co-newbiz are under the Phase 0 apply freeze until PR-A and PR-B land (D3 of that design). Their records arrive in one batch with the freeze-lift apply, not before (D9). For co-newbiz the batch includes the 65 project-side derived records (T6). The records add only `NEW` rows, so they do not change the sweep's permitted deltas (PR-A: EVOLVED rows; PR-B: DRIFT_RESTORED rows; PR-C: shadow rows).
3. **The other eleven projects** take the full record set (common and variant-own, D2) in their next scheduled `project-resync` wave. The wave's dry run shows `NEW docs/lifecycle/skills/*.md (workspace seed)` rows only for records, as INFO.
4. **Gate interaction.** In shadow or enforce the backport gate's gate set contains only `PROJECT_AHEAD`, `EVOLVED_PRESERVE`, `UNBASELINED`, `MARKER_LOSS`, and `CONFLICT` paths. A seeded record is none of those, so no ack is needed and the delivered diff lands with no `### Destructive dispositions` entry (L1 destructive-ack covers WARN/ERROR rows; `NEW` and `SEED_SKIP` are INFO).
5. **Verification per project** after each wave: `bun run skill-lifecycle-audit` shows 0 LC warnings for template skills. Remaining LC warnings must equal the "residual" column. A larger count means a record was tombstoned or a skill is outside the template set.
6. **No manifest or schema change.** `schemaVersion` stays `2`. Seeded records enter `files[]` as ordinary delivered paths.

Migration of existing project records: none, and no cleanup of leftover records (D3). The 7 L1 records already delivered stay as they are. A project that already holds a record keeps it.

## 6. Test plan

- **Generator unit tests** (`tests/unit/generate-skill-lifecycle-records.test.ts`): projection of `gateguard` (CONSTITUTION line removed), `sync` (ADR/ticket/design references removed, `Dependencies` kept), `delegate-to-hub` (`docs/adr/` path line removed), `ci-triage` (two `Metadata` blocks reduced to one, no `Version`, so `lifecycleRecordVersions` returns null), `meeting-facilitation`; one derived record from frontmatter; the generated marker; idempotence (`--check` passes on its own output); a hand-edited file without the marker is left alone.
- **Validator tests** (`tests/unit/validate-templates-skill-records.test.ts`): coverage failure for an added common skill without a record; parity failure for an edited generated file; leak failure for a seeded `ADR-0103`.
- **Seed delivery replay**: a fixture project with 3 records present and 3 absent: absent ones are `NEW`, present ones `SEED_SKIP`, project text byte-identical afterward. A tombstoned record is not re-delivered.
- **Regression suites to keep green**: `l0-ref-policy`, `scrub-constitution-refs`, `skill-lifecycle-record-versions`, `upgrade-tree-sync`, the scaffold delivery parity script, `validate-templates`.
- **Fleet dry-run sweep** (before and after the first wave): permitted delta is `NEW` rows under `docs/lifecycle/skills/` only, and the LC warning counts drop to the §4.1 residual column.

## 7. Platform impact and rollback

| Platform | Impact | Files |
|---|---|---|
| Claude Code, Antigravity, Codex, Hermes, `.agents` surfaces | None. No skill body, command, hook, or mirror changes. Records are plain markdown under `docs/`. | none |
| templates/common | Adds 35 generated records next to the 7 existing ones. | `templates/common/docs/lifecycle/skills/` |
| templates/<variant> | Adds up to 153 generated records across 14 variants (co-learning needs none). | `templates/<variant>/docs/lifecycle/skills/` |
| L0 | New script, new validator check, shared pattern, dev-sync publish hook. | `scripts/generate-skill-lifecycle-records.ts`, `scripts/validate-templates.ts`, `scripts/helpers/l0-ref-policy.ts`, `scripts/dev-sync.ts`, `scripts/SCRIPTS.md`, registry rows |

Rollback is `git revert` of the template PR. Delivered records in projects are inert files that no code reads for an enforcement decision, so a revert leaves them behind harmlessly. A reverted validator check removes the guard only.

## 8. Risks

1. **Projection loses L0 history.** Settled by D1: delivered records are birth certificates, not mirrors of L0. The L0 text stays at L0.
2. **Seed-only staleness.** A delivered record never updates. The version-free projection makes that harmless for the audit, but the Phase History and Acceptance Criteria text can still age. Accepted: the record states the creation facts.
3. **Records for skills a project deleted, and stale leftovers.** Accepted by D3 (non-goal). A project that dropped a common skill still receives its record, and old records persist. The effect is a stray file; no check reads it.
4. **Derived records are thin.** For variant-own skills the generator knows only the frontmatter. The records satisfy Check LC and `validate-skills` but carry little history. A variant PM may enrich them by hand: removing the generated marker makes the file hand-owned and the generator skips it.
5. **Variant templates are a fork-model surface.** Under D2 the 153 derived records ship in the same rollout as the common ones. They are an L2 content change delivered by a template PR (about 153 new files across 14 variant templates) and need the next `release-template` cut (`templates/VERSION` is 0.30.0). CV-02 does not fire for new files and the records carry no version line, but the review surface is large.
6. **Pattern list drift.** `L0_INTERNAL_REF_PATTERN` will miss a new internal citation style. The validator's leak check fails closed on the listed forms only. Mitigation: it lives in one shared helper with a test.
7. **New-project timing.** Until T4 lands, a new project warns on its first audit. This is the same state as today.
8. **docs/lifecycle/ WORKSPACE policy.** Delivery relies on the existing add-if-missing seed. A project that later edits its record owns it; a project that deletes one gets it re-seeded only until the tombstone guard records the deletion. Any future change of `WORKSPACE_DOC_DIRS` or the tombstone rules (the overwrite-protection stream touches `upgrade-policy.ts`) would silently change this delivery. T5 therefore re-checks the seed rows in the wave dry run.
9. **New blocking check.** `validate-templates.ts` check `SLR` blocks every future template PR that adds or promotes a skill without a record, and blocks on parity. It adds a recurring cost for variant owners and runs over about 280 template skill directories, so its runtime and a clear fix message matter (§9, T2).
10. **Large single template PR (D2).** About 190 generated files in one PR; review is by sampling plus the `--check` parity gate.
11. **co-newbiz has no template (D4).** Its 65 derived records cannot ride the template PR. They are a project PR generated by the same generator (`--project <path>` mode) and are delivered only at the freeze-lift apply (D9). Until then co-newbiz keeps 49 Check LC warnings.
12. **PR size and CI (D10).** The templates PR (PR-2) is one PR with about 188 generated files and nothing else. Review is by sampling plus the `--check` parity gate; Windows CI is the exposure, because `validate-templates.ts` and `generate --check` both walk the template tree. The PR must stay inside the existing per-job time budget; if the first run is slow, the fix is to speed the check, not to split the PR.
13. **Owner mapping (D5).** Wrong or stale mapping entries are undetectable beyond existence; accepted (§4.2).

## 9. Ticket breakdown (re-estimated for D1-D12; not created)

Sizes: S = 1-3 h, M = 3-6 h, L = 6-12 h of implementation and verification, excluding review wait. Tickets are not created: `ticket.ts create` takes a `<service-id>` and cannot express plain tickets with dependencies, so the PM files them by hand from this table.

### PR sequence (D10; one open PR at a time, each merged before the next opens)

| PR | Layer | Tickets | Content | Merged state is green because |
|---|---|---|---|---|
| **PR-1** | root | T1 + T2 | `generate-skill-lifecycle-records.ts` (projection, derivation, `--check`, `--project`), `scripts/data/skill-owner-map.json` (empty), shared `L0_INTERNAL_REF_PATTERN`, SLR in `validate-templates.ts` reading `scripts/skill-record-enforcement.json` with `enforce: false`, tests, Check LC fix text, registry and lifecycle rows. **No dev-sync hook and no template files.** | SLR in report-only mode emits WARN for missing records and never fails; no template changes, so CV-02 and the leak scan are untouched. |
| **PR-2** | templates only | T3 | The 188 records (35 common projected, 153 variant-own derived), written by the PR-1 generator (no hand-written records), plus `templates/CHANGELOG.md` and the version bumps CV-02 requires. | `generate --check` reproduces every file byte for byte; the existing leak scan and `validate-templates.ts` pass; SLR (still report-only) now reports zero missing records. |
| **PR-3** | root | T4 + flip | `enforce` set to `true` (SLR blocking), dev-sync step 4.5 write-mode hook, scaffold copy of `docs/lifecycle/skills/` and removal of the 7 reviewed-gap entries, scaffold parity pin. Then one `release-template` cut. | SLR blocking passes because PR-2 delivered the records; scaffold parity script passes. |

**Report-only window**: SLR is report-only only between the merge of PR-1 and the merge of PR-3, and no `release-template` cut happens inside that window. A released template therefore never carries SLR enforcement without the records, and never carries records without enforcement. If PR-3 slips, the cut slips with it.

**CI evidence that each step is green** (the PR's own checks plus these named runs): PR-1: `bun run test:unit`, `bun scripts/validate-templates.ts` (SLR WARN lines present, exit 0), `bun scripts/audit.ts`. PR-2: `bun scripts/generate-skill-lifecycle-records.ts --check` exit 0, `bun scripts/validate-templates.ts` with SLR reporting 0 missing, CV-02 pass, audit leak scan pass, the three-OS `test` matrix. PR-3: `validate-templates.ts` with `enforce: true` exits 0 on `main`+PR, `scripts/test-scaffold-delivery-parity.ts`, `bun run test:unit`, then a deliberate negative check run locally (remove one record, expect SLR failure) recorded in the PR body.

**T5 and T6** are not root or templates PRs. After PR-3 and the release cut, the eleven non-frozen projects take the records in their next `project-resync` wave; the five frozen projects take them in one batch each at their freeze-lift apply (D9).

CV-02: new files are out of scope and the records carry no version line. A modified versioned mirrored file needs a bump (`l0-ref-policy.ts`, `scaffold-markers.ts`, `skill-lifecycle-audit.ts` copies under `templates/common/scripts/`; these publish with the next template sync), plus root `@version` bumps and `docs/lifecycle/scripts/*.md` and `scripts/SCRIPTS.md` rows for `validate-templates.ts`, `dev-sync.ts`, `skill-lifecycle-audit.ts`. Run `bun run test:unit` before each `/sync` that bumps a script version.

### Tickets

| Ticket | PR | Scope | Files | Test plan | Size | Depends on |
|---|---|---|---|---|---|---|
| **T1** generator, owner table, shared pattern | PR-1 | Projection (35), derivation (153 template records, 65 co-newbiz via `--project`), generated marker, `--check`, owner resolution per §4.2 (table file, fail on unmapped), `L0_INTERNAL_REF_PATTERN`. | `scripts/generate-skill-lifecycle-records.ts` (new), `scripts/data/skill-owner-map.json` (new, empty), `scripts/helpers/l0-ref-policy.ts`, `scripts/SCRIPTS.md`, new lifecycle record, registry rows | `tests/unit/generate-skill-lifecycle-records.test.ts` (five projections, one derived record, owner precedence and unmapped failure, marker, idempotence, unmarked files untouched, `--project` writes only under the given path); extend `l0-ref-policy.test.ts` | **L, 7-11 h** | none |
| **T2** SLR validator, flag-gated | PR-1 | `validate-templates.ts` check `SLR` (coverage, parity, leak, owner) honoring `enforce`; `scripts/skill-record-enforcement.json`; Check LC fix-text sentence. | `scripts/validate-templates.ts`, `scripts/skill-record-enforcement.json` (new), `scripts/skill-lifecycle-audit.ts`, matching records, `SCRIPTS.md` | `tests/unit/validate-templates-skill-records.test.ts` with in-memory fixtures: WARN when `enforce:false`, FAIL when `true` | **M, 4-6 h** | T1 |
| **T3** publish records | PR-2 | Run the generator to write 35 + 153 records; `templates/CHANGELOG.md`; CV-02 bumps; co-safety dry-run timing (95 records). | `templates/common/docs/lifecycle/skills/` (+35), `templates/co-*/docs/lifecycle/skills/` (+153), `templates/CHANGELOG.md` | `generate --check`; sampled read of 10 records; 2-project dry-run delta | **M, 5-8 h** | PR-1 merged |
| **T4** flip, hook, scaffold | PR-3 | `enforce: true`; dev-sync step 4.5 hook; `new-project` copies `docs/lifecycle/skills/`, remove the 7 reviewed-gap entries; scaffold parity pin; release cut. | `scripts/skill-record-enforcement.json`, `scripts/dev-sync.ts`, `scripts/helpers/scaffold-markers.ts`, `scripts/new-project.ts` if needed, `scripts/test-scaffold-delivery-parity.ts` | scaffold parity script; unit test for the hook decision function; negative SLR check | **M, 4-6 h** | PR-2 merged |
| **T5** fleet wave | none | Eleven non-frozen projects in their next wave; five frozen projects in one batch each at freeze-lift. Per project: dry run, LC count equals residual, `NEW` rows only for records. | operational | per-project `skill-lifecycle-audit` and dry-run diff | **M, 5-9 h spread over the wave** | PR-3 and the release cut; freeze lift |
| **T6** co-newbiz records | project repo | `--project` run produces 65 records; a PR on the co-newbiz repository, merged by that project's PM through its own path, landing at its freeze-lift apply together with its common records. Not part of any root or templates PR. | co-newbiz `docs/lifecycle/skills/` (+65) | project `skill-lifecycle-audit` shows 0 LC warnings | **M, 3-5 h** | T1 (PR-1 merged); freeze lift |

Totals: PR-1 11-17 h, PR-2 5-8 h, PR-3 4-6 h, T5 5-9 h, T6 3-5 h, about 28-45 h.

### Per-test budget notes (Windows CI is slow)

- **Spawn-heavy**: the scaffold parity script (T4) scaffolds a project per variant by spawning `new-project`; reuse it and add no second scaffold. A seed-replay test that spawns `upgrade-project` is spawn-heavy too; use the in-process path of `upgrade-tree-sync.test.ts` with a 6-record fixture.
- **Pure and in-process**: generator and SLR tests call functions on in-memory strings and file maps; they must not run `validate-templates.ts` or walk the real tree (about 48 MB, 280 skill directories). `validate-templates-cv02.test.ts` is the model. The SLR enforce-flag test passes the flag value as an argument, not through the file.
- **Real-tree checks live in scripts**: `generate --check` and SLR run via `validate-templates.ts` and the audit. PR-2 adds one more full-tree pass on a 188-file change; that is the Windows exposure, and if slow the fix is to speed the check. If a unit test must list `templates/*/skills`, read directory names only and set its per-test budget explicitly, as PR #1957 did.
- Do not spawn `dev-sync.ts` in tests. Watch the three Windows-sensitive suites whose budgets PR #1957 raised.

## 10. Acceptance criteria

- [ ] `bun scripts/generate-skill-lifecycle-records.ts --check` passes on the published templates and fails on a hand-edited generated file.
- [ ] `templates/common/docs/lifecycle/skills/` holds 42 records (35 generated, 7 hand-authored); each variant template holds a record for every own skill (153 derived across 14 variants, matching the §4.1 table), delivered in the same templates-only PR as the common records (D2, D10).
- [ ] No file in any `templates/**/docs/lifecycle/skills/` matches `L0_INTERNAL_REF_PATTERN` or `L0_REF_PATTERN`.
- [ ] `validate-templates.ts` check `SLR` blocks a common skill without a record, a stale generated record, and a leaking record.
- [ ] A fleet dry run shows only `NEW` rows for records; a present project record is `SEED_SKIP` and byte-identical after apply.
- [ ] After the first wave, each project's LC warning count equals the residual column in §4.1.
- [ ] co-newbiz holds 65 derived records after its freeze-lift apply and its LC warning count is 0 (D4, D9).
- [ ] An unmapped skill (no `owner:`, no table entry) makes both the generator and SLR fail (D5).
- [ ] Scaffolded projects (`new-project`) audit with no LC warning for template skills.

## 11. Open items

None. D10-D12 settled the root/template boundary and the co-newbiz vehicle. Unmappable skills (D5): none today; every one of the 183 variant-own, 42 common and 66 co-newbiz skills carries `owner:`. A future skill without `owner:` fails the generator and SLR by design and is raised in its own PR.

## 12. Accessibility exemption note

Governance records, a generator, a validator check, and unit tests. No UI, no rendered content, no style changes. No accessibility review is required.
