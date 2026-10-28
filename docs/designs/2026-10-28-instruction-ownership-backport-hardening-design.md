# Design: Instruction-File Ownership Regions and Backport-Pipeline Hardening (T-20261028-001, T-20261028-013)

- **Spec ID**: `2026-10-28-instruction-ownership-backport-hardening-design`
- **Date**: 2026-10-28
- **Author**: Template Architect (Design Gate Row 0)
- **Tickets**: two user directives issued 2026-10-28, folded with T-20261028-001 (validator-hardening, high) and T-20261028-013 (stub-composed delivery at upgrade time, normal)
- **Status**: implemented (registry SSOT; retro-marked from draft per T-20261029-002 — the hardening landed with the instruction-ownership backport).

## 0. Conclusion

Two gaps let the co-design incident class survive the tombstone-ownership
engine (spec `2026-10-28-delivery-tombstone-ownership-design`, implemented —
upgrade-project 1.79.0): the delivery engine owns **regions inside
`agents/*.md` but has no ownership model for the instruction files
themselves** (AGENTS.md, CLAUDE.md, GEMINI.md, CODEX.md, HERMES.md), and the
backport loop that should drain project adaptations is **manual judgment over
a direction-only diff**. The forensic record shows both gaps live: project
AGENTS.md diverges per-project with no recorded boundary (co-design 510 lines
vs its 305-line template; 0 refs to `docs/governance/agents/workflows.md` vs
the template's 5), and the nightly Step 2 report records co-design's re-applied
corrections as "recorded, not promoted" — by hand, again.

This design makes one structural move per gap, extending machinery that
already exists rather than adding passes or stores:

1. **Instruction-file region model (D1–D4).** The five instruction files get
   the same treatment the tombstone design gave `agents/*.md` bodies: region
   taxonomy (engine zones / project-state marker sections / free-form
   template-echo regions), a merge-time region census that classifies
   divergence as `EVOLVED_REGION` (WARN) or `CONFLICT` (ERROR) instead of
   merging back silently, the ADR-0101 skeleton registry widened to AGENTS.md
   as the guarded delivery channel for template-authoritative sections, and
   the adjudicated-port procedure (overwrite-policy §6) declared the
   sanctioned promotion path so projects stop carrying permanent local
   patches.
2. **Backport-pipeline hardening (D5–D7).** `backport-diff.ts` gains a
   region-aware verdict column (PORT_CANDIDATE / REDELIVER / ADJUDICATE /
   NO_ACTION) derived mechanically from surface + direction + ownership;
   `upgrade-project --dry-run --port-candidates` prints exactly which project
   deltas the next wave would revert (conflict-bound paths, tombstone
   candidates, stub-composed mismatches) as JSON; and the nightly Step 2
   report consumes both mechanically instead of re-deriving them by hand.
3. **Two folded tickets ride the same delivery (D8–D9).** T-20261028-001
   lands as a review-baseline check (`scripts/design-gate-coverage.ts`):
   template-touching commits in a review window must resolve to a registered
   spec or a design doc, reconciling the F-1 list against the 289-spec
   registry. T-20261028-013 lands as an engine row: the upgrade-time
   agents/ compare composes the extends-stub over its target (the exact bytes
   scaffold/adopt wrote via `composeResolvedAgentContent`), so the co-design
   `phases: [4]` / co-develop `phases: [5]` frontmatter converges instead of
   surfacing as a permanent `CONFLICT (ERROR)` — the live manifest already
   carries that exact ERROR entry today.

## 1. Context

### 1.1 Directive 1 — instruction-file divergence forensics (verified 2026-10-28)

References to `docs/governance/agents/workflows.md` in the instruction file
per layer, and file sizes:

| Layer | File | workflows.md refs | Lines |
|---|---|---|---|
| L0 workspace root | `AGENTS.md` | 4 | 326 |
| L1 common | `templates/common/AGENTS.md` | 4 | 332 |
| L2 co-design template | `templates/co-design/AGENTS.md` | 5 (lines 208, 265, 291, 295, 299) | 305 |
| Project co-design | `Projects/co-design/AGENTS.md` | **0** | **510** |
| Project co-safety | `Projects/co-safety/AGENTS.md` | 0 | 458 |
| Project co-price | `Projects/co-price/AGENTS.md` | 1 | 355 |

The co-design project copy is 205 lines larger than its own template (line diff
404), carries project-authored dispatch tables (e.g. the §4 task-mapping rows
for `[design specialist]` / `[implementation specialist]`), and carries
scaffold-rendered marker sections (`VARIANT-AGENTS`, `VARIANT-AGENT-DETAILS`,
`VARIANT-PHASE-GATE`, `VARIANT-SUBAGENT-ROSTER`, `VARIANT-ROLE-BOUNDARY`) that
are **not** engine zones (not in `MANAGED_PATTERNS`,
`scripts/lib/managed-block-merge.ts:89-99`). No governance record defines who
owns any of this. The tombstone design's D4 region model covers `agents/*.md`
frontmatter and bodies only; the instruction files are outside it.

Today's delivery contract for these files is the MERGE pass plus managed
blocks plus the ADR-0101 skeleton: `MERGE_FILES` delivers CLAUDE.md /
GEMINI.md / CODEX.md / HERMES.md per selected platform profile plus
`.gitignore`, `agents/pm.md`, ci.yml
(`scripts/upgrade-project.ts:2000-2008`); AGENTS.md delivers through
DOCS_MERGE (`:2088-2090`). Both route through `mergeWorkspaceManaged`
(`:1570-1653`), which runs `mergeManagedBlocks`
(`lib/managed-block-merge.ts` v1.4.0) and — for CLAUDE.md/GEMINI.md only —
the skeleton step (`lib/platform-skeleton-merge.ts` v1.1.0, ADR-0101).
Consequences of the missing model:

- **Project adaptations are invisible.** Out-of-zone project content is
  preserved forever with no verdict — the 102 pending LOCAL-PATCH markers
  across the fleet (nightly report, `docs/reports/2026-10-28-project-resync-daily.md:35`) have no mechanical path to template-side promotion.
- **Silent merge-back channels exist.** The unlabeled-block count-mismatch
  reconcile (`managed-block-merge.ts` v1.0.0 defect class; snapshot-protected
  since v1.1.0) and the skeleton section replace (G1/G2-guarded,
  `platform-skeleton-merge.ts:1-15`) can rewrite out-of-zone project spans
  without consulting any ownership record.
- **Template-side out-of-zone evolution has no delivery channel to existing
  projects.** Content outside zones reaches only fresh scaffolds; the L2
  template's 5 workflows.md refs will never reach the co-design copy that has
  0 unless the lines enter a zone or a registry section.

The engine already holds one in-MERGE divergence precedent to extend: the
agents/pm.md TIER CONFLICT arm records deliberate scalar divergence as
`EVOLVED (WARN)` and leaves it untouched (`upgrade-project.ts:2043-2058`).

### 1.2 Directive 2 — the backport loop is manual (verified 2026-10-28)

`scripts/backport-diff.ts` (v1.0.2) produces a 5-surface, 5-direction table:
`surfaceFor` (`:176-189`) and `directionFor` (`:230-241`) classify whole-file
deltas; rows carry no verdict, and the tool is deliberately report-only
(header `:10-15`). Two blind spots:

- Only `CLAUDE.md`, `docs/context.md`, and `docs/<variant>.context.md` map to
  the context surface (`:185`); AGENTS.md / GEMINI.md / CODEX.md / HERMES.md
  fall to `other` (stays-project by convention) — the instruction files are
  backport-invisible.
- A `project-ahead` row says nothing about *what* moved: a project-authored
  dispatch table (promotable) and a stale engine zone (no action) look
  identical.

The consumer is manual judgment: project-resync skill Step 2
(`.agents/skills/project-resync/SKILL.md:91-125`) runs the differ as "an
aid", then a human produces promote / stays-project / discarded-stale
verdicts. The nightly report shows the cost: co-design's re-applied
AGENTS.md/CLAUDE.md corrections are "recorded, not promoted" by hand, with
the note that they are "the live subject of U-20261028-001"
(`docs/reports/2026-10-28-project-resync-daily.md:20`). The tombstone design
gave deletions persistence (tombstones) and bodies an owner (D4), but gave
the review loop nothing mechanical: the project fix → wave revert → manual
re-fix cycle still ends in a human re-reading a diff.

### 1.3 What the engine already provides (integration surface, verified)

- Delivery manifest v2 with per-file baselines and the unified decision log
  (writer `upgrade-project.ts`; `noteDelivered` fires for merged instruction
  files at `:1650`, so baselines exist for them).
- The D4 agents/ escalation is live: `evolvedDeliveryGuard` (`:1763+`)
  reclassifies version-gated delivery over evolved agent bodies to
  `CONFLICT (ERROR)` via `agentsOwnership` (`:2924-2938`), and the
  equal-version arm does the same (`:2970-2982`).
- `tombstoneSkip` (`:1836`) guards absent-copy delivery branches.
- `classifyCandidate` / `resolveDisposition` live in
  `scripts/lib/upgrade-policy.ts` (v1.27.0).
- The skeleton registry is a working out-of-zone delivery channel with
  guards and collision WARNs (`recordSkeletonCollisions`, `:1659-1665`), but
  its `SkeletonSectionEntry.rel` union admits only `'CLAUDE.md' |
  'GEMINI.md'` values (`platform-skeleton-merge.ts:53-60`).
- `--dry-run` already exercises every pass without writing.

### 1.4 T-20261028-013 evidence (verified)

`composeResolvedAgentContent` (`scripts/helpers/resolve-pm-stub.ts:119-183`)
is the pure stub-over-target composer (stub frontmatter wins, L1 fills
gaps, `extends:` dropped, `variant_overrides`/`remove_sections` rendered); it
is consumed only by the scaffold path (new-project §2.3b) and the adopt
settling pass (header `:26-37`). The upgrade-time agents/ pass instead
compares against the raw extends **target** bytes:
`upgrade-project.ts:2879-2890` sets `tplSource = resolvedTarget` whenever the
stub's target exists and the file is not MERGE_MANAGED. The stub's own
variant-scoped fields never enter the compare. Live proof in the current
co-design manifest (`.claude/last-upgrade-delivery.json`):

```jsonc
{ "path": "agents/i18n-specialist.md", "pass": "SYNC_IF_NEWER: agents/",
  "verdict": "CONFLICT", "severity": "ERROR",
  "detail": "equal-version drift on project-evolved content — CONFLICT disposition: restore-to-canonical SKIPPED, project copy preserved",
  "baseline": { "hash": "5f06f176…", "templateVersion": "0.22.0" } }
```

The project copy carries `phases: [4]` (composed at scaffold, re-landed by
the 0.22.1 port in the stub `templates/co-design/agents/i18n-specialist.md`);
the compare content (`templates/common/agents/i18n-specialist.md`, version
1.3.0) has no `phases` key — so the composed project copy reads as
PROJECT_EVOLVED on every wave. co-develop carries the same shape with
`phases: [5]`. The port (tombstone D5) fixed the template content but not the
compare: T-013 is the residue.

### 1.5 T-20261028-001 evidence (verified)

The 2026-10-28 FULL project review found F-1 (Major): 8 template-touching
window commits covering 9 tickets landed without a design doc or spec entry,
contra ADR-0074
(`docs/reports/2026-10-28-project-review-daily.md:72`). The same review's
routing note and the root memory log both record that the list needs
reconciliation — several of the 9 already have registered specs
(`memory/2026-10-28.md:386`; verified examples: T-20261027-005 is covered by
the sync-overwrite-policy design, U-20261026-005 by two registered designs,
while T-20261027-009/-010 and U-20261027-004 have no design-doc mention).
The coverage audit that produced F-1 was ad hoc; no validator reproduces it.

## 2. Problem statement

1. The five instruction files have no ownership boundary: managed zones
   deliver, everything else is undefined — project adaptations are invisible,
   two merge channels can revert them, and template-side section evolution
   cannot reach existing projects.
2. Project adaptations that should become template content rot in place:
   backport-diff cannot see instruction files, cannot say what a project-ahead
   delta means, and the nightly Step 2 judgment is manual end to end.
3. The upgrade engine compares stub-derived agent files against the wrong
   bytes, so variant-scoped stub fields surface as a permanent ERROR-grade
   conflict (T-013).
4. Design-Gate coverage is unaudited between reviews: nothing mechanically
   reconciles a review window's template-touching commits against the spec
   registry (T-001).

## 3. Decision record

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Instruction-file region taxonomy (I1–I3), extending the tombstone D4 model from agents/\*.md to AGENTS.md, CLAUDE.md, GEMINI.md, CODEX.md, HERMES.md.** (I1) Engine zones — every `MANAGED_PATTERNS` zone (managed-block-merge.ts:89-99) plus every ADR-0101 skeleton-registry section: template-authoritative, delivered by the MERGE/DOCS_MERGE passes exactly as today. (I2) Project-state marker sections — scaffold-rendered `VARIANT-*` marker sections not in `MANAGED_PATTERNS` (AGENTS.md's roster/gate/roster-boundary sections): project state, preserved, census-only. (I3) Free-form template-echo regions — all remaining out-of-zone content: template-canonical by default, with project adaptation as a first-class, classified disposition (D2) and promotion via D4. | One taxonomy, three owners — the same shape that worked for agents/ R1–R3. No per-project claim manifest (D4 of the overwrite policy stands) and no new marker syntax: zone membership is structural, read off the template's own markers and the existing registry. |
| D2 | **Merge-time instruction-region census; no silent merge-back.** `mergeWorkspaceManaged` (extended, not redesigned) computes an out-of-zone delta between the project copy and the merged template result: project-added lines (adaptations), template lines absent from the project (deletions/adaptations of template content), byte-equal regions. Census rows are recorded as decisions: `REGION_IN_SYNC` (INFO), `EVOLVED_REGION` (WARN — project adaptation preserved; port candidate), `TEMPLATE_AHEAD_REGION` (WARN — template evolved content the project never received; channel gap), `CONFLICT` (ERROR) **only** when a write channel is about to replace an adapted span: the unlabeled reconcile and the skeleton replace now consult the census, and an adapted-span replace requires `--disposition adopt-template[=glob]` (deliver + re-baseline) exactly like the agents/ escalation. | The directive's "EVOLVED/CONFLICT instead of silent merge-back" lands on the only two channels that can merge back. WARN (not ERROR) for pure divergence keeps the nightly readable — instruction files are legitimately adapted (the co-design §4 tables) and are parsed by every tool every session; ERROR is reserved for imminent loss, matching the overwrite-policy cost model (friction paid once, per divergence). |
| D3 | **ADR-0101 skeleton registry widened to AGENTS.md — the delivery channel for template-authoritative instruction sections.** `SkeletonSectionEntry.rel` admits the five instruction files; registry entries are added per adjudication (D4), never big-bang. Guards ride along unchanged: G1 (no project-local heading/comment in the replaced span), G2 span cap, heading-collision WARN, `pre-skeleton.bak` snapshot. | The registry is the only sanctioned out-of-zone delivery mechanism that exists (inserts delete nothing; replaces are guarded and snapshotted); widening its rel union is a one-type change. This closes the channel gap that makes the L2 template's workflows.md refs unreachable for the co-design copy. |
| D4 | **Promotion path = the adjudicated-port procedure (overwrite-policy §6), declared normative for instruction adaptations.** The census (D2) and the backport verdicts (D5) feed a port backlog; each accepted port lands content template-side **inside a managed zone or a registry section** (with a version bump) so the next wave re-delivers it fleet-wide and the project copy stops being a permanent local patch. Rejected adaptations get a one-line reason in the port PR. | Ports into free-form space would recreate the channel gap; ports into zones/registry sections are the only ones that converge. This is the PR #1640 / tombstone-D5 pattern applied to instruction files. |
| D5 | **backport-diff verdict column (v1.1.0): region-aware, mechanical, still report-only.** Each row gains `verdict`: `PORT_CANDIDATE` (project-ahead/project-only in a promotable surface — project-owned regions, agents/ R3 evolution, skills/scripts/helpers, evidence plane), `REDELIVER` (delta sits in I1 engine zones or agents/ R1 — the next wave owns it; row names the expected disposition), `ADJUDICATE` (I3/I2 divergence needing the port-or-keep decision; links to the D4 backlog), `NO_ACTION` (in-sync, engagement content). `surfaceFor` sends the five instruction files to the context surface (currently only CLAUDE.md, `:185`). | Direction alone cannot route the Step 2 judgment; ownership can, and the engine already computes ownership. The instruction-file blind spot is a one-line surface fix. Report-only (ADR-0031 Principle 5) is unchanged — verdicts inform the human, never write. |
| D6 | **`upgrade-project --dry-run --port-candidates`: the would-revert list.** In dry-run mode the flag suppresses normal pass output and prints a machine-readable (JSON + markdown) inventory of exactly which project deltas the next wave would revert or escalate: conflict-bound paths (agents/ version-gt and equal-version ERRORs), unconfirmed tombstone candidates, stub-composed compare mismatches (D9), adapted-span replace candidates (D2), plus per-path disposition text ("will be re-delivered — needs --disposition X / port"). | The co-design loop needs "what will the next wave do to my fixes?" answered mechanically before it runs, not after. Every input is data the dry-run already computes; the flag is a filter + serializer over existing classification. |
| D7 | **Nightly Step 2 consumes both mechanically.** Step 2 of the project-resync skill runs `backport-diff --json` and, per project, `upgrade-project --dry-run --port-candidates --json`; the Step 2 report section standardizes three tables (verdict table, would-revert table, port-backlog deltas) and carries the promote/stays-project/discarded-stale judgment **on top of** the mechanical verdicts instead of re-deriving them. Skill text updated (Step 2 + report contract). | The 2026-10-28 report shows the manual shape ("recorded, not promoted" re-derived by hand). Mechanical feeds shrink the human step to adjudication of what the machines cannot decide — which is the Step 2 judgment's actual job. |
| D8 | **T-20261028-001 folded: `scripts/design-gate-coverage.ts` (L0-only, report-only) — the windowed review-baseline check.** Inputs: a review window (`--since <rev|date> --until <rev>`, default = the review window). Mechanics: (1) list commits in the window touching the template-path set (templates/, scripts/, .agents/, docs/governance/, docs/standards/, the six root instruction files); (2) extract ticket ids (T-/U- regex) from commit subjects/bodies and merge-commit PR titles; (3) coverage test per ticket — a registry entry in `docs/specs/registry.json` whose design doc (or any registered design doc) mentions the ticket id, else flag. Output: a coverage table (covered-by-spec / uncovered / exemption-candidate) for the review to adjudicate E1–E5; nothing auto-closes. Runs as a Step 0 evidence row of the FULL project review — a validator row in the existing review, not a new pipeline. | F-1 was produced ad hoc and is not reproducible; the reconciliation need ("several already have registered specs") is exactly a registry-join. Keeping exemption adjudication human preserves ADR-0074's gate semantics; making the join mechanical removes the audit-drift class. |
| D9 | **T-20261028-013 folded: stub-composed compare and delivery at upgrade time.** In the agents/ pass, when `tplSource` came from an extends stub, build the compare/deliver content with `composeResolvedAgentContent(stub, resolvedTarget, variant)` — the exact bytes the scaffold wrote — and run the existing version-gate, drift, and disposition arms against that content; delivery goes through `writeAgentWithLifecycle` (lifecycle block preserved) as today. MERGE_MANAGED files stay excluded (pm.md — MERGE pass owns the body). Rule: a template-side change to a stub-owned field bumps the stub's `version` in the same port PR, so the composed expectation re-delivers. | Comparing composed bytes makes the R1-additions row of the D4 model converge: `phases: [4]` exists on both sides of the compare (stub → composed expectation; project copy → scaffold-composed), so the permanent CONFLICT becomes IN_SYNC, and future stub-field changes arrive as normal version-gated ADOPT. The composer is pure, parity-tested, and already the scaffold/adopt contract — reusing it closes the third-copy-of-merge-logic risk instead of adding one. |

## 4. Mechanism — instruction regions (D1–D4)

### 4.1 Region resolution (per file, at merge time)

1. Parse the template side: zone spans (`MANAGED_PATTERNS`), registry
   sections (per rel), remaining lines = I3 template-echo content, marker
   sections not in the registry = I2.
2. Parse the project side with the same scanner (markers are stable — the
   engine delivered them).
3. Diff I3 spans bidirectionally → census rows (D2). I2 spans are never
   diffed for content beyond existence (project state).
4. Classify each census row: project-added line-block with no template
   counterpart → `EVOLVED_REGION` (port candidate); template line-block
   absent from the project → `TEMPLATE_AHEAD_REGION`; both-sides-diverged
   section → `EVOLVED_REGION` with direction note; identical → no row.

### 4.2 Write-channel escalation

Before the unlabeled reconcile replaces a span, and before a skeleton
section replace proceeds, the span is tested against the census: if the
project span carries `EVOLVED_REGION` rows, the replace is recorded as
`CONFLICT (ERROR)` and skipped unless `--disposition adopt-template` covers
the path — identical grammar and semantics to the agents/ escalation at
`upgrade-project.ts:1777-1792`. Snapshot machinery (`pre-reconcile.bak`,
`pre-skeleton.bak`) is unchanged and remains the recovery artifact.

### 4.3 Where the state lives

Nowhere new. The census is computed per run from the two file copies plus
the registry (template-side, fleet-shared); decisions land in the existing
manifest decision log; baselines already exist for merged instruction files
(`noteDelivered`, `:1650`). No per-project region manifest — the D4
rationale of the overwrite policy applies unchanged.

### 4.4 Port backlog → port PR

The census rows and `ADJUDICATE`/`PORT_CANDIDATE` verdicts accumulate in the
Step 2 report; the port PR (adjudicated-port procedure, overwrite-policy §6
steps 1–6) lands accepted content into a zone or registry section with a
version bump; acceptance is the existing four gates (bidirectional superset,
dry-run no-op on ported paths, hash table, post-wave verification ticket) —
the dry-run no-op check now runs through `--port-candidates` (D6), which
reports the ported paths as converged.

## 5. Mechanism — backport hardening (D5–D7)

### 5.1 Verdict derivation (backport-diff v1.1.0)

```
for each changed file:
  surface   = surfaceFor(rel)            # instruction files → context (D5)
  direction = directionFor(base, head, counterpart)
  ownership = regionOwner(rel, counterpart)   # I1/I2/I3 or agents/ R1–R3 or project-asset
  verdict =
    direction in {in-sync}                          → NO_ACTION
    ownership in {I1, agents-R1}                    → REDELIVER (next wave owns; note the expected disposition)
    direction in {project-ahead, project-only}
      and ownership in {project-asset, agents-R3}   → PORT_CANDIDATE (evidence: +added/−removed, counterpart)
    ownership in {I2, I3, agents-R2}                → ADJUDICATE (port-or-keep; D4 backlog)
    else                                            → ADJUDICATE
```

The table stays read-only; the JSON shape gains `verdict` and `ownership`
(additive — the markdown table gains two columns).

### 5.2 `--port-candidates` (upgrade-project)

Dry-run-only modifier. Output sections, each item `{path, surface, trigger,
disposition}`: conflict-bound (existing ERROR arms), tombstone candidates
(`tombstoneSkip` fire conditions), stub-composed mismatches (D9 compare),
adapted-span replace candidates (D2 census). `--json` prints one document
per project for the nightly to ingest; the markdown form is the operator
view. Apply mode ignores the flag (it is a report, not a mode).

### 5.3 Nightly Step 2 wiring

Step 2 gains two commands and three report tables (verdict, would-revert,
backlog delta); the judgment vocabulary (promote / stays-project /
discarded-stale) is unchanged and now cites mechanical rows. Skill version
bump + SKILLS.md/contract row per the standard change set.

## 6. Fleet rollout

| Layer | Change | Notes |
|---|---|---|
| Engine (L0) | `scripts/upgrade-project.ts` 1.79.0 → 1.80.0 (region census wiring, write-channel escalation, `--port-candidates`, stub-composed compare); `scripts/lib/upgrade-policy.ts` 1.27.0 → 1.28.0 (census row types + verdict contract rows, data only); `scripts/lib/platform-skeleton-merge.ts` 1.1.0 → 1.2.0 (rel union widened, no behavior change without registry entries); `scripts/lib/managed-block-merge.ts` unchanged. | Dry-run parity: a fleet with no I3 divergence reports zero census rows. |
| Tooling (L0-only) | `scripts/backport-diff.ts` 1.0.2 → 1.1.0 (verdict + ownership columns, instruction surface); `scripts/design-gate-coverage.ts` 1.0.0 (new); skill `project-resync` Step 2 text + version. | backport-diff and the new check are L0-only today (not in `templates/common/scripts/`) — no L1 twin for them; the engine twins publish as usual. |
| L1 mirror | `templates/common/scripts/` engine twins republished via the L0→L1 publish step; `verify-scripts --check-drift` green; SCRIPTS.md rows in both mirrors. | Standard publish path. |
| Template (L2) | No mandatory content change. Registry entries for AGENTS.md sections and stub version bumps land per adjudicated-port decisions (D3/D4/D9), riding the next co-design wave (the tombstone design's 0.23.0 remediation wave or its successor). | The engine changes are protective-by-default: zero census rows on an in-sync fleet. |
| Canary | **co-design** — carries the live T-013 CONFLICT (§1.4) and the reference instruction-file divergence (§1.1). Acceptance: the i18n-specialist ERROR converges (D9); the AGENTS.md census produces the expected EVOLVED_REGION rows and zero unexpected ERRORs. | The owner's hold-and-escalate decision (U-20261028-001) is on record; this design is the ownership half of that request. |
| Sequencing | PR-1 engine (D2/D6/D9 + tests) → PR-2 tooling (D5/D8 + skill text) → L0→L1 publish → co-design canary wave → fleet waves → census review ticket. | Same shape as the tombstone rollout (§6 of that design). |

## 7. Implementation plan (proposal — pending PM dispatch; this ticket lands design only)

| # | Task | Agent | Tier |
|---|------|-------|------|
| 0 | Design Gate Row 0: this design + spec registration | architect | High |
| 1 | PR-1a: region census + write-channel escalation in `upgrade-project.ts` / `upgrade-policy.ts` / `platform-skeleton-merge.ts`; unit tests (census classification, adapted-span CONFLICT, disposition grant, registry rel widening) | automation-engineer | Low |
| 2 | PR-1b: stub-composed compare/delivery (D9) + `--port-candidates` (D6); unit + integration tests (co-design fixture: i18n-specialist converges; port-candidates JSON shape) | automation-engineer | Low |
| 3 | PR-2a: backport-diff verdict column + instruction surface (D5); unit tests | automation-engineer | Low |
| 4 | PR-2b: `design-gate-coverage.ts` (D8) + F-1 reconciliation run + retro backfill for the truly-uncovered F-1 tickets (registry entries / retro design docs) | automation-engineer + docs-writer | Low / Medium |
| 5 | PR-2c: project-resync Step 2 wiring (D7) + skill version row | docs-writer | Medium |
| 6 | L0→L1 publish; canary wave on co-design; post-wave verification ticket; fleet rollout | lifecycle-manager + pm (dispatch) | Medium |

## 8. Acceptance criteria

- [ ] A project-adapted I3 span is never replaced silently: the census logs
  `EVOLVED_REGION` (WARN); an adapted-span replace produces `CONFLICT`
  (ERROR) + skip; `--disposition adopt-template` delivers and re-baselines.
- [ ] Template-side instruction-section evolution placed in a registry
  section reaches an existing project as a guarded insert/replace with
  collision WARNs and a `.pre-skeleton.bak` snapshot (AGENTS.md registry
  entry rehearsal on co-design).
- [ ] `backport-diff.ts` classifies AGENTS.md/CLAUDE.md/GEMINI.md/CODEX.md/
  HERMES.md onto the context surface and emits region-aware verdicts; a
  fixture pins PORT_CANDIDATE vs REDELIVER vs ADJUDICATE for the co-design
  divergence set.
- [ ] `upgrade-project --dry-run --port-candidates --json` lists exactly the
  would-revert set for a fixture project, and an empty set for a converged
  project.
- [ ] On co-design after PR-1: the `agents/i18n-specialist.md` decision is
  no longer CONFLICT (ERROR) — the composed compare reports in-sync or a
  version-gated ADOPT; co-develop dry-run shows the same convergence for
  `phases: [5]`.
- [ ] `design-gate-coverage.ts` over the 2026-10-28 review window reproduces
  the F-1 commit set and resolves the already-registered tickets as covered;
  the remaining uncovered rows match the reconciliation list filed with the
  retro backfill.
- [ ] The nightly Step 2 report carries the three mechanical tables and the
  skill text names both commands.
- [ ] `validate-templates.ts`, `verify-scripts --verify --check-drift`, and
  the root unit battery pass; SCRIPTS.md rows identical in both mirrors for
  every bumped script; manifest v1/v2 compat fixtures stay green.

## 9. Accessibility

Non-UI infrastructure change — no accessibility impact (per ADR-0065).

## 10. Open questions (for user approval)

1. **Q1 — census severity for project deletions of template instruction
   lines** (the 5→0 workflows.md-refs shape): `EVOLVED_REGION` (WARN, this
   design's default — the deletion is usually a deliberate adaptation) or
   ERROR-grade confirmation like whole-file tombstones (`--tombstone` for
   regions)? Default: WARN; ERROR only when a write channel targets the span.
2. **Q2 — I2 marker sections** (`VARIANT-AGENTS` etc.): stay project-state
   (this design's default) or join `MANAGED_PATTERNS` so template-side roster
   updates flow to existing projects? Joining changes ownership of
   project-visible roster content and needs its own adjudication; the census
   makes the current state visible either way.
3. **Q3 — `--port-candidates` runtime**: dry-run-only flag (default) vs a
   fleet batch mode in the nightly (runs the dry-run per project in one
   command; extra nightly minutes). Default: dry-run-only; the Step 2 loop
   invokes it per project it reviews.
4. **Q4 — coverage semantics for D8**: a registered spec counts as coverage
   even when its design doc never names the ticket id (this design's default
   — the registry is the SSOT), or must the design doc mention the ticket id
   to count? Default: registry-join with design-doc mention as the search
   path; a stricter rule re-flags entries like the sync-overwrite-policy spec
   that cover tickets only in prose.
5. **Q5 — stub version-bump enforcement (D9)**: advisory (port-procedure
   step, this design's default) or a validate-templates check that fails when
   a stub's owned fields change without a version bump? Default: advisory
   first; the check is a small follow-up if drift appears.

## 11. References

- Directive context — instruction files: `AGENTS.md` (4 refs, 326 lines),
  `templates/common/AGENTS.md` (4, 332), `templates/co-design/AGENTS.md`
  (5 at :208/:265/:291/:295/:299, 305), `Projects/co-design/AGENTS.md`
  (0 refs, 510 lines), `Projects/co-safety/AGENTS.md` (0, 458),
  `Projects/co-price/AGENTS.md` (1, 355) — counts verified 2026-10-28
- Incident record: `docs/designs/2026-10-28-delivery-tombstone-ownership-design.md`
  (§1.1 cycle log; its D4 region model this design extends; implemented —
  upgrade-project 1.79.0 / upgrade-policy 1.27.0)
- Engine integration surface: `scripts/upgrade-project.ts:2000-2008`
  (MERGE_FILES), `:2088-2090` (DOCS_MERGE_FILES), `:1570-1653`
  (mergeWorkspaceManaged), `:1659-1665` (skeleton collision decisions),
  `:1763+` (evolvedDeliveryGuard), `:2043-2058` (TIER CONFLICT EVOLVED
  precedent), `:2879-2890` (stub → extends-target compare), `:2924-2938` /
  `:2970-2982` (agents/ CONFLICT escalations), `:1836` (tombstoneSkip)
- Merge libraries: `scripts/lib/managed-block-merge.ts:89-99`
  (MANAGED_PATTERNS; v1.4.0), `scripts/lib/platform-skeleton-merge.ts:1-15`
  (guards; v1.1.0), `:53-60` (rel union — CLAUDE.md/GEMINI.md only)
- Stub composer: `scripts/helpers/resolve-pm-stub.ts:119-183`
  (composeResolvedAgentContent), `:26-37` (scaffold/adopt-only consumers)
- T-013 live evidence: `Projects/co-design/.claude/last-upgrade-delivery.json`
  (agents/i18n-specialist.md CONFLICT ERROR, baseline 0.22.0);
  `templates/co-design/agents/i18n-specialist.md` (`phases: [4]`),
  `templates/co-develop/agents/i18n-specialist.md` (`phases: [5]`),
  `templates/common/agents/i18n-specialist.md` (no phases key),
  `Projects/co-design/agents/i18n-specialist.md:24` (`phases: [4]`)
- Backport surface: `scripts/backport-diff.ts:176-189` (surfaceFor),
  `:230-241` (directionFor), `:185` (CLAUDE.md-only context surface), v1.0.2;
  consumer `.agents/skills/project-resync/SKILL.md:91-125` (Step 2); nightly
  report `docs/reports/2026-10-28-project-resync-daily.md:13-22` (co-design
  "recorded, not promoted" row at :20; LOCAL-PATCH census at :35)
- T-001 evidence: `docs/reports/2026-10-28-project-review-daily.md:72` (F-1);
  `memory/2026-10-28.md:386` (reconciliation note); registry
  `docs/specs/registry.json` (289 specs) + `docs/specs/entries/`
- Ticket files: `tickets/governance/T-20261028-001.yaml`,
  `tickets/governance/T-20261028-013.yaml`
- Precedent designs: `docs/designs/2026-10-27-sync-overwrite-policy-design.md`
  (D2 matrix, §6 adjudicated-port procedure, D4 no-claim-manifest stance),
  `docs/designs/2026-10-25-managed-platform-skeleton-design.md` (ADR-0101
  registry — the D3 channel)
