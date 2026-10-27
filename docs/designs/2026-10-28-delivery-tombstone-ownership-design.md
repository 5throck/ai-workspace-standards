# Design: Delivery Tombstones and agents/*.md Project-Ownership Semantics (U-20261028-001)

- **Spec ID**: `2026-10-28-delivery-tombstone-ownership-design`
- **Date**: 2026-10-28
- **Author**: Template Architect (Design Gate Row 0)
- **Ticket**: U-20261028-001 (upstream request, co-design, `waiting`; suspected layer L1/L2) + T-20261028-004 + T-20261028-006 (remediation-wave riders)
- **Status**: draft — design-only for user review. No engine, template, or ticket content is changed by this design ticket. Implementation is pending user approval and PM dispatch (§8).

## 0. Conclusion

Template delivery waves revert committed project state through two distinct
vectors, and the v0.22.0 sync-overwrite-policy engine (spec
`2026-10-27-sync-overwrite-policy-design`) covers only one of them partially.
The co-design wave forensics (§1.2) prove both vectors on the current engine:

1. **Deletion resurrection** — a project-side deletion of a delivered file is
   invisible to every delivery pass. The absent-project-copy branches deliver
   as `NEW (INFO)`. Wave #65 re-delivered `docs/governance/agents/workflows.md`
   with the verdict `NEW | INFO | "delivered — project copy absent"` while the
   same manifest proves the engine knew the file had been delivered before.
   This design adds a **tombstone**: an extension of the delivery provenance
   baselines that records intended project deletions and turns a wave that
   violates one into an ERROR-grade delivery conflict (skip + non-zero exit),
   reusing the existing D3.1 blocking machinery unchanged.
2. **agents/\*.md body reversion** — the equal-version drift arm ran
   `DRIFT_RESTORED (WARN)` instead of `CONFLICT (ERROR)` at wave #65 because
   the `agents/` files had no prior baselines (`NO_BASELINE` migration
   degrade). Independently, the L2 co-design template carries the stale
   content itself (Model A "Can Lead Phases" echo lines, missing i18n
   `phases` field), so even a fully armed engine re-delivers the wrong bytes
   on the next version bump. This design (a) defines the managed vs
   project-owned region taxonomy for `agents/*.md` and routes every conflict
   into the existing unified decision log, (b) escalates the one remaining
   silent-overwrite channel (version-gated delivery over template-unchanged
   project-evolved bodies, currently `EVOLVED (WARN)` + deliver), and
   (c) terminates the loop at the source by bundling the L2 content fixes
   (the D5 adjudicated port) plus T-20261028-004/-006 into one remediation
   wave.

The design rejects a per-project exclusion manifest authored by hand (same
reasoning as D4 of the overwrite policy): tombstone state lives in the
delivery manifest the engine already writes, is confirmed by an explicit
operator flag, and rides the pipeline that already consumes it.

## 1. Context

### 1.1 Incident timeline (co-design, ~30 hours, four cycles)

Per `Projects/co-design/memory/2026-10-28.md` and git history:

| Time (KST) | Commit / PR | Event |
|---|---|---|
| 00:23 | `5557c1d`, PR #63 | v0.21.0 wave "#1659 wave" (design-system suite promotion healing) — the cycle's trigger wave |
| 01:22 | `eed9957`, PR #64 | Project restore #1: deletes `docs/governance/agents/workflows.md` (Ruling 3: un-adapted L0 copy, zero inbound references — merged PR #59), re-aligns six agents' Can-Lead body lines to frontmatter, re-adds i18n `phases: [4]` |
| 03:52 | `2d06b5d`, PR #65 | Wave revert: PR titled `chore: workspace sync (0 files)` carries 17 files; reverts `docs/governance/agents/workflows.md` (+ the workflows.md body corrections, +226 lines class) and the six agents' bodies to template wording |
| 06:18 | `477f4a3`, PR #66 | Project restore #2 (byte-identical re-application from `eed9957`) |

Owner decision recorded in the same memory log: **hold manual re-fixing;
escalate U-20261028-001** — repeated manual cycles add churn without durably
landing state. The root memory (`memory/2026-10-28.md`, daily-resync block,
Open Issues) adds the systemic note: "Delivery transform strips KO-twin
`lang:` declarations project-side (template carries them) — systemic,
next-window ticket with the U-20261028-001 ownership work."

### 1.2 Wave #65 manifest forensics (the smoking gun)

`Projects/co-design/.claude/last-upgrade-delivery.json` at the #65 wave
(schemaVersion 2, templateVersion 0.22.0, timestamp
`2026-10-27T18:52:40.041Z`, baseSha `5be562b` = the #64 restore merge):

- `agents/design-lead.md` … `agents/i18n-specialist.md` (7 files):
  `DRIFT_RESTORED | WARN | SYNC_IF_NEWER: agents/ | "<ver> equal-version
  content drift — restored to canonical (ADR-0085 D3)"` — **not** the
  `CONFLICT (ERROR)` disposition. Cause: wave #63's manifest baselines cover
  docs/hooks/pm.md only, not the seven specialists, so
  `classifyProjectState` (`scripts/lib/upgrade-policy.ts:886-908`) returned
  `NO_BASELINE`, and the equal-version drift arm
  (`scripts/upgrade-project.ts:2766-2799`) only escalates to CONFLICT when
  `cls.state === 'PROJECT_EVOLVED'`. This is the documented §8 migration
  degrade of the overwrite-policy design — observed here doing exactly what
  it says: one baseline-less wave restores "canonical" over committed project
  corrections at WARN.
- `docs/governance/agents/workflows.md`:
  `NEW | INFO | TEMPLATE TREE SYNC | "delivered — project copy absent"` —
  the absent-copy branch (`scripts/upgrade-project.ts:3448-3456`) never
  consults delivery provenance. The prior manifest carried the file in its
  `files[]`/`baselines`, so the engine held proof that the project had
  received (and then deliberately deleted) the file, and re-delivered it
  anyway, at INFO.
- Decisions census: 73 entries, **0 ERROR** — gates green while committed
  project state reverted. This is the U-005 genus (observability) surviving
  in two unclassified shapes.

### 1.3 L2 content defects feeding the loop (verified in the template tree)

The template side is not merely re-delivering; it is re-delivering **wrong
content**. Porting the project state template-side (the D5 adjudicated-port
procedure of the overwrite-policy design) is what makes the conflict loop
terminate:

| Path (template side) | Defect | Project-side canonical state |
|---|---|---|
| `templates/co-design/agents/design-lead.md:67` | body echo `Can Lead Phases: [1, 2]` vs own frontmatter `phases: [2, 3]` | body `[2, 3]` |
| `templates/co-design/agents/prototype-engineer.md:68` | echo `[3, 4]` vs frontmatter `[4]` | body `[4]` |
| `templates/co-design/agents/ux-researcher.md:68` | echo `[1, 2, 5]` vs frontmatter `[1]` | body `[1]` |
| `templates/co-design/agents/service-designer.md:73` | echo `[1, 2]` vs frontmatter `[3]` | body `[3]` |
| `templates/co-design/agents/typography-expert.md:74` | echo `[2, 3]` vs frontmatter `[3]` | body `[3]` |
| `templates/co-design/agents/visual-designer.md:68` | echo `[3, 4]` vs frontmatter `[3]` | body `[3]` |
| `templates/co-design/agents/i18n-specialist.md` (extends stub) + `templates/common/agents/i18n-specialist.md` | no `phases:` frontmatter key anywhere in the chain; common body says `Can Lead Phases: []  # supporting agent` | project frontmatter `phases: [4]` (i18n-specialist leads Phase 4 per the normative `docs/phase-definitions.md` model) |
| `templates/common/docs/governance/agents/workflows.md` | the resurrection SOURCE — the co-design L2 tree has no such file; the delivered copy comes from the L1 common tree and is a dead, un-adapted L0 copy in co-design (Ruling 3, merged PR #59) | deleted in co-design (project-scoped ruling) |

### 1.4 What the overwrite-policy engine already provides (integration surface)

- Delivery manifest v2 (`.claude/last-upgrade-delivery.json`): `files[]`,
  per-file `baselines {hash, templateVersion}` (D1), unified `decisions[]`
  with severity contract (D3) — writer `scripts/upgrade-project.ts:4458-4568`,
  types `scripts/lib/upgrade-policy.ts:788-857`.
- ERROR handling is already end-to-end: non-zero exit + resolution menu
  (`upgrade-project.ts:4711-4738`), PR-body Decisions section listing ERROR
  items (`:4536-4543`), dev-sync step 3.9 auto-E5 refusal
  (`scripts/dev-sync.ts:674-689` via `manifestHasUnresolvedErrors`).
- Disposition flag `--disposition adopt-template[=glob]`
  (`resolveDisposition`, `upgrade-policy.ts:910+`).
- Project-deletion provenance already exists in the fleet tooling:
  `scripts/resync-audit.ts` Step 0 reports "deleted in working tree" rows —
  the tombstone consumer alignment point.

This design adds **no new gate consumer and no new state store**. Everything
hooks the manifest and the decision log.

## 2. Problem statement

1. A project-side deletion of a previously delivered file is delivered again
   as `NEW (INFO)` by every absent-copy delivery branch. Committed deletion
   intent cannot persist across waves.
2. An `agents/*.md` file the project evolved after delivery is reverted by
   two engine paths without an ERROR: the `NO_BASELINE` equal-version drift
   restore (migration window), and the version-gated delivery over
   template-unchanged evolved content (`EVOLVED (WARN)`, deliver = true).
3. The L2 co-design template re-delivers stale body content and a file the
   project has ruled dead, so even correct conflict surfacing would produce a
   permanent CONFLICT loop instead of convergence.
4. Two template-hygiene tickets (T-20261028-004, T-20261028-006) target the
   same next co-design delivery; running them as a separate later wave would
   pay the wave cost twice and re-open the same conflict surface.

## 3. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Tombstone state lives in the delivery manifest.** Manifest v2 gains an optional `tombstones` key: `{ [rel]: { hash, templateVersion, recordedAt, reason } }`. `hash` is the last delivered baseline (`baselineKeyFor` form) at detection time; `schemaVersion` stays 2 (additive optional key — the same grace pattern as the v1→v2 migration). Writer rule at manifest time: `tombstones = (prior tombstones ∪ newly recorded) − paths delivered this run`. | The manifest is the one artifact the delivery pipeline already carries per project; a second store would rot (D4 rationale of the overwrite policy). Delivering a path is the natural "clear" event, so no separate cleanup pass is needed. |
| D2 | **Tombstone detection runs in every absent-copy delivery branch, before the copy.** A shared guard `tombstoneGuard(rel, prior)` in `upgrade-project.ts` (pure predicate + report in `lib/upgrade-policy.ts`, same split as `classifyProjectState`/`resolveDisposition`) is consulted by: TEMPLATE TREE SYNC `SYNC` absent branch (`:3448`), `WORKSPACE` seed branch (`:3414`), `ADD_IF_MISSING` seed branch (`:3429`), `JSON_MERGE` seed branch (`:3388`), `DOCS_OVERWRITE`, `COMMANDS_SYNC`, agents/ `NEW`, skills/ whole-directory `NEW`, VARIANT ASSET DIRS, ENV_SAMPLE — every branch that writes a file the project lacks. Fire condition: `absent(project, rel) && (prior.tombstones[rel] \|\| prior.baselines[rel])`. | One predicate, N call sites — the same shape as `evolvedDeliveryGuard`. Firing only when the template still ships the path makes template-side renames false-positive-free (a renamed-away path is no longer a candidate, so nothing fires). |
| D3 | **Two verdicts, one new flag pair.** (a) `absent && prior.baselines[rel] && !tombstone` → first observation: verdict `TOMBSTONED`, severity **ERROR** — delivery skipped for that path, decision recorded, run exits non-zero (existing ERROR block). Resolution: `--tombstone <glob>` (repeatable; records the deletion as intended, persists the entry with `reason`) or restore the file project-side and re-run (baseline matches; no entry written). (b) `absent && tombstones[rel]` → honored deletion: verdict `TOMBSTONED_SKIP`, severity INFO, delivery skipped silently-but-visibly. `--clear-tombstone <glob>` drops entries so the next run delivers the path as NEW. `--disposition adopt-template` does **not** override a tombstone; taking template content back onto a tombstoned path requires `--clear-tombstone` (explicit, auditable). | Mirrors the `--disposition` grammar. Auto-honoring every deletion silently would also honor accidental losses silently (the U-005 lesson); auto-blocking every deletion without a confirm path would wedge the nightly. ERROR-until-confirmed keeps the nightly loud and resumable. |
| D4 | **agents/\*.md ownership regions are codified; every conflict lands in the decision log.** Region taxonomy: (R1) frontmatter scalar keys the template defines (`name`, `description`, `extends`, `variant`, `version`, `status`, `tier`, `model`) — template-authoritative; project additions reach the template via the D5 port, never via per-project union (D4 of the overwrite policy stands). (R2) the `lifecycle:` block — project state, preserved by `writeAgentWithLifecycle` (existing). (R3) the body — default template-canonical, but project evolution is a first-class disposition: the version-gated arm's `EVOLVED (WARN)` + deliver row is reclassified for `agents/` to the CONFLICT (ERROR) row **regardless of `templateChanged`**, matching the equal-version arm's existing rationale ("restoring canonical over evolved content is not self-evidently right", `upgrade-project.ts:2760-2766`). The `NO_BASELINE` equal-version restore keeps its WARN-degrade but its decision detail must name the migration window ("baseline absent — verify this restore against project intent"). | The EVOLVED-WARN-delivers channel is the remaining silent overwrite of exactly the content U-001 names. Equal-version and version-gated arms then behave identically for `agents/`, which is the invariant the region model promises. With the L2 port (D5) landed, template and project converge, so the ERROR friction is paid once, per divergence — the overwrite-policy design's stated cost model. |
| D5 | **The co-design remediation wave bundles the L2 content port + both template-hygiene tickets.** One delivery (template 0.23.0, canary co-design) carries: (i) the six Can-Lead body echoes corrected to their own frontmatter `phases` (the D5 port — project side canonical, evidenced in §1.3); (ii) `phases: [4]` + a matching Can-Lead body line through the i18n-specialist chain (L2 stub and/or L1 common body — exact layer placement adjudicated in the port PR per port-procedure step 3); (iii) T-20261028-004 — re-stamp `components.registry.yaml:4-5` / `patterns.registry.yaml:3-4` provenance headers to template-side spec references; (iv) T-20261028-006 — `patterns.registry.yaml:42` composes_from / `screen-patterns.md:34` row 7 composition mismatch (+ optional CD-3/CD-4 annotations the ticket marks optional). The dead L1 `workflows.md` is **not** deleted fleet-wide; co-design's deletion is project-scoped and is exactly what D1–D3 tombstones. | Fixes the loop at the source (after the port, dry-run reports zero conflicts on the affected paths — port-procedure acceptance), and pays the wave cost once. The port-side acceptance uses the existing procedure: bidirectional superset, dry-run no-op proof, protected-file hash table, post-wave verification ticket. |
| D6 | **No classification-resolver changes.** The deny-list resolver (`resolveClaim`), the baseline classifier, and the severity contract keep their shapes; the change set adds the `tombstones` key, two verdicts (`TOMBSTONED`, `TOMBSTONED_SKIP`) + contract rows in `DECISION_SEVERITY_CONTRACT`, the guard predicate, flag parsing, and the D4 escalation of one matrix row. | The overwrite-policy design explicitly kept the resolver untouched; this design inherits that boundary. |

## 4. D1–D3 — Tombstone mechanism in detail

### 4.1 State location and format

```jsonc
// .claude/last-upgrade-delivery.json — additive under schemaVersion 2
{
  "schemaVersion": 2,
  "files": [ … ],
  "baselines": { … },
  "decisions": [ … ],
  "tombstones": {
    "docs/governance/agents/workflows.md": {
      "hash": "00b2137ca57a2e7a…",           // last delivered baseline (baselineKeyFor form)
      "templateVersion": "0.22.0",
      "recordedAt": "2026-10-29",
      "reason": "co-design merged PR #59 / Ruling 3 — un-adapted L0 copy, zero inbound references"
    }
  }
}
```

Carry-forward at manifest write (`upgrade-project.ts` manifest block, after
`baselines` assembly): union prior + newly recorded, minus paths this run
delivered. Bound: tombstones whose path leaves the template tree stop firing
(the path is no longer a candidate) and may be pruned opportunistically.

### 4.2 Who writes it

- **Detection**: every upgrade run, dry-run and apply, in the
  absent-copy branches (D2 fire condition). Dry-run reports candidates and
  persists nothing (the manifest is apply-mode-only, as today).
- **Recording**: apply mode only, under an explicit `--tombstone <glob>`
  grant (the operator confirms deletion intent), or implicitly NONE — there
  is no auto-record path. The nightly fleet wave therefore stops at the
  ERROR and the resolution lands in the next window, which is the co-design
  owner's recorded preference (hold auto-fixing; make the wave ask).

### 4.3 Who consumes it

| Consumer | Use |
|---|---|
| `upgrade-project.ts` passes | Guard at every absent-copy branch (skip + verdict). |
| Wave ERROR block (`:4711-4738`) | Lists `TOMBSTONED` entries with the two resolution paths; non-zero exit. |
| dev-sync step 3.9 (`:674-689`) | `manifestHasUnresolvedErrors` already refuses auto-E5 while ERROR entries are unresolved — a wave carrying an unconfirmed tombstone cannot land behind a green gate. No code change needed. |
| Upgrade PR body (`:4536-4543`) | Decisions section lists the ERROR items verbatim. Already generic over `decisions[]`. |
| Fleet resync (`resync-audit.ts` Step 0 + daily report) | Reports tombstoned paths as "deletion honored" rows and unconfirmed candidates as violations — aligns with the existing "deleted in working tree" row type. |

### 4.4 Wave violation surfacing (the acceptance shape)

Running a wave against a project with an unconfirmed deletion produces:

```
  ⏭️  TOMBSTONE (SKIP): docs/governance/agents/workflows.md — project deleted a
      previously delivered file; delivery refused (severity ERROR)
      confirm with --tombstone docs/governance/agents/workflows.md, or restore
      the project copy and re-run
```

…plus the end-of-run ERROR block, non-zero exit, PR-body listing, and the
dev-sync 3.9 auto-E5 refusal. Delivery of the *other* files in the wave
stands (the overwrite policy's escalation semantics: ERROR does not abort
earlier passes' deliveries).

### 4.5 False-positive analysis

- **Template renames a file**: old path stops being a template candidate →
  guard never fires. No tombstone needed.
- **Project loses a file accidentally**: fires as `TOMBSTONED (ERROR)` — the
  accidental loss becomes a loud decision instead of a silent resurrection
  or a silent absence. Resolution is one flag or one restore.
- **Scaffold-time absent files** (never delivered): no baseline → no fire.
- **REGENERATED / PROJECT_STATE classes**: never in baselines → no fire.

## 5. D4 — agents/*.md ownership regions

| Region | Owner | Disposition on divergence | Surfacing |
|---|---|---|---|
| R1 frontmatter (template-defined keys) | template | version-gated delivery; equal-version template-authoritative heals per ADR-0085 D3 as today | existing verdicts |
| R1 additions (project-added keys the template lacks, e.g. `phases`) | adjudicated port target | port into the template (this design's D5 does it for `phases: [4]`); until ported, project-evolved frontmatter reads as PROJECT_EVOLVED | CONFLICT (ERROR) per existing matrix |
| R2 `lifecycle:` block | project state | preserved through every delivery (`writeAgentWithLifecycle`) | n/a (existing) |
| R3 body | template-canonical default; project evolution is a disposition | version-gt over evolved body: **CONFLICT (ERROR)** (changed by this design from EVOLVED WARN + deliver); equal-version drift: CONFLICT (ERROR) (existing); `--disposition adopt-template[=glob]` grants delivery + re-baseline | unified decision log (existing) |

There is deliberately no marker syntax introduced into agent bodies and no
per-project region manifest: both would recreate the stale-claim class D4 of
the overwrite policy removed. The body is one region with one rule, and the
sanctioned channel for "the project's body is right" is the adjudicated
port (D5), which this design exercises immediately.

## 6. Fleet rollout

| Layer | Change | Notes |
|---|---|---|
| Engine (L0) | `scripts/lib/upgrade-policy.ts` 1.25.0 → 1.26.0: `tombstones` type, `TOMBSTONED`/`TOMBSTONED_SKIP` verdicts + contract rows, guard predicate. `scripts/upgrade-project.ts` 1.76.0 → 1.77.0: guard wiring in the absent-copy branches, `--tombstone` / `--clear-tombstone` flags, manifest carry-forward, agents/ version-gt EVOLVED→CONFLICT escalation. | Dry-run reports candidates without persisting; apply-mode semantics only per D3. |
| L1 mirror | `templates/common/scripts/` twins republished via the L0→L1 publish step; `verify-scripts --check-drift` green. | Standard publish path. |
| Template (L2) | co-design 0.22.0 → 0.23.0 carries the D5 content port (+ ticket riders). | One wave, canary co-design. |
| Canary | **co-design** — the affected project; the owner decision to hold manual re-fixing and escalate is on record. | Post-canary, the remaining 15 projects get the engine on their next scheduled wave; expected census: 0 tombstone violations (fleet audit 0-conflict state, overwrite-policy §1.2). |
| Validation gates | (1) `bun scripts/upgrade-project.ts Projects/co-design --dry-run` reports the `workflows.md` TOMBSTONED candidate (ERROR) and zero other new ERRORs; (2) after `--tombstone` recording, dry-run is a no-op on that path (`TOMBSTONED_SKIP` INFO); (3) `bun scripts/validate-templates.ts` covers the L2 content port; (4) `tests/unit/upgrade-decision-log.test.ts` extended: absent+baseline → TOMBSTONED ERROR skip; tombstone honored → INFO skip; carry-forward minus delivered; agents/ version-gt escalation; (5) port acceptance per §D5 (bidirectional superset, dry-run no-op on ported paths, hash table, post-wave verification ticket). | Gates are the existing ones plus unit coverage; no new gate consumers. |
| Sequencing | PR-1 engine + tests → L0→L1 publish → co-design canary wave (0.23.0 with the port) → fleet waves → census review ticket. | Same shape as the overwrite-policy rollout (§8 of that design). |

## 7. Implementation plan (proposal — pending PM dispatch; this ticket lands design only)

| # | Task | Agent | Tier |
|---|------|-------|------|
| 0 | Design Gate Row 0: this design + spec registration | architect | High |
| 1 | PR-1a: `lib/upgrade-policy.ts` tombstone types/verdicts/predicate + `upgrade-project.ts` guard wiring + flags + carry-forward; unit tests | automation-engineer | Low |
| 2 | PR-1b: agents/ version-gt CONFLICT escalation + NO_BASELINE detail wording + tests | automation-engineer | Low |
| 3 | PR-2: L2 co-design port (six echo lines, i18n chain `phases`) + T-20261028-004/-006 riders + L0→L1 publish of any L1-touched files | automation-engineer + docs-writer | Low / Medium |
| 4 | Canary wave + post-wave verification ticket; fleet rollout | pm (dispatch) + project sessions | — |

## 8. Consequences

- **Positive**: deletion intent persists across waves with zero new state
  stores; the last silent-overwrite channel for agent bodies closes; the
  co-design loop terminates at the template source; the two hygiene tickets
  stop paying separate wave costs; every divergence lands in one decision
  log the fleet already reads.
- **Costs**: one more confirmation interaction per genuine project deletion
  (`--tombstone`), paid once per path; manifest grows by one bounded key;
  agents/ version bumps over legitimately-evolved bodies now require an
  explicit disposition — the friction is the feature (overwrite-policy §10
  cost model).
- **Risks & mitigations**: (i) tombstone confirms a mistake — restore the
  file and `--clear-tombstone`; the ERROR listing names both paths;
  (ii) nightly waves stall on unconfirmed tombstones — by design (owner
  directive); the ERROR menu makes the unblock mechanical; (iii) escalation
  noise during the agents/ transition — the co-design port removes the only
  known live divergence before the engine change ships (PR-2 can precede or
  ride the same wave as PR-1).
- **Explicitly out of scope**: KO-twin `lang:` declaration stripping (root
  memory 2026-10-28 systemic note — separate next-window ticket, same
  ownership family); L1-wide retirement of
  `templates/common/docs/governance/agents/workflows.md` (open question Q2);
  any project-owned claim manifest (D4 of the overwrite policy).

## 9. Acceptance criteria

- [ ] A project-side deletion of a previously delivered file is never
  re-delivered silently: dry-run reports `TOMBSTONED (ERROR)`; apply skips
  the path and exits non-zero; `--tombstone` records the entry; later waves
  log `TOMBSTONED_SKIP (INFO)` and skip.
- [ ] A tombstoned path delivered again after `--clear-tombstone` lands as a
  normal `NEW` and its tombstone entry is gone from the next manifest.
- [ ] `--disposition adopt-template` cannot deliver a tombstoned path.
- [ ] Manifest v2 documents and tolerates manifests without `tombstones`;
  v1-shaped manifests still parse (existing fixtures stay green).
- [ ] An `agents/` body evolved after delivery + version-gt delivery
  produces `CONFLICT (ERROR)` with default skip; `--disposition
  adopt-template` delivers and re-baselines.
- [ ] Post-port dry-run on co-design reports zero conflicts on the seven
  agent paths and the tombstoned workflows.md path is the only ERROR.
- [ ] `validate-templates.ts`, `verify-scripts.ts --verify`, and the root
  unit battery pass on the engine PR; L1 mirror drift check green.
- [ ] The daily fleet report shows the tombstone census row for every project.

## 10. Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## 11. Open questions (for user approval)

1. **Q1 — confirmation default**: should a first-observation deletion
   (`TOMBSTONED`, ERROR) block only the wave's landing (this design) or also
   block the nightly's auto-merge for that project outright? This design
   blocks the landing (non-zero exit + dev-sync 3.9 refusal), which already
   prevents a silent merge; a harder nightly pause is possible but adds a
   new control.
2. **Q2 — L1 workflows.md disposition**: co-design ruled the file dead
   project-side. Whether `templates/common/docs/governance/agents/workflows.md`
   should be retired fleet-wide (it exists at L1 for all variants) is a
   separate classification decision; this design only tombstones the
   co-design copy.
3. **Q3 — i18n `phases` layer placement**: `phases: [4]` in the L2 stub
   frontmatter only (co-design-specific ruling) vs also updating the L1
   common body line (`Can Lead Phases: []` → `[4]`) for all variants.
   Default per D5: adjudicate in the port PR; the stub-frontmatter placement
   is the conservative default.

## 12. References

- Upstream request: `tickets/governance/U-20261028-001.yaml` (symptom, repro,
  L1/L2 layer, per-path triage)
- Cycle log: `Projects/co-design/memory/2026-10-28.md` (four blocks, 00:23 →
  06:18; owner hold-and-escalate decision)
- Root memory: `memory/2026-10-28.md` daily-resync block (KO-declaration
  systemic note; U-001 adoption as residue)
- Wave forensics: `Projects/co-design/.claude/last-upgrade-delivery.json`
  (#65 manifest — NEW INFO + DRIFT_RESTORED WARN evidence);
  `Projects/co-design/.claude/last-upgrade-delivery.json` at `5557c1d`
  (#63 manifest — agents/ baselines absent)
- Engine integration surface: `scripts/lib/upgrade-policy.ts` (v1.25.0),
  `scripts/upgrade-project.ts` (v1.76.0), `scripts/dev-sync.ts` 1.32.0 step 3.9
- Precedent design: `docs/designs/2026-10-27-sync-overwrite-policy-design.md`
  (D1/D2/D3/D5 machinery this design extends; D4 stance inherited)
- Riders: `tickets/governance/T-20261028-004.yaml`, `tickets/governance/T-20261028-006.yaml`
- Fleet tooling alignment: `scripts/resync-audit.ts` (Step 0 deletion rows);
  daily report `docs/reports/2026-10-28-project-resync-daily.md`
