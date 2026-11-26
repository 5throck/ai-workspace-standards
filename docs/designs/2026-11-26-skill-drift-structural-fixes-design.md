# Design: Skill-drift structural fixes (four systemic causes, the legacy-stub conversion gap, and the pair program)

- **Spec ID**: `2026-11-26-skill-drift-structural-fixes-design`
- **Date**: 2026-11-26
- **Author**: Template Architect (Design Gate Row 0)
- **Status**: approved (owner standing instruction 2026-11-26: proceed on the recommended defaults; DEC-20261125-01 precedent)
- **Tickets**: T-20261123-005 (skill-graph divergence, closed by the adjudication), T-20261126-003 (legacy full-body stub conversion)
- **Related**: `docs/reports/2026-11-26-skill-drift-adjudication.md` (the 22-pair adjudication — the SSOT for every per-pair disposition); `docs/designs/2026-11-26-stub-version-backfill-and-registry-row-floor-design.md` (STUB_VERSION_BACKFILL — the sibling this design extends); `docs/designs/2026-11-25-upgrade-runner-machinery-batch-design.md` (house form and the §4.8 content-identity precedent); ADR-0085 D3 (same-version drift preserve), ADR-0097 (LOCAL-PATCH markers), ADR-0033 (extends-stub shape)

## 0. Conclusion

The 2026-11-26 adjudication proved the 22 skill-fleet divergences are machinery, not authoring: two template commits landed without version bumps and the version gate stranded them (S1), scaffold-time placeholder rendering forks delivered skills from their template source forever (S2), intent is not representable in the convergence classification (S3), and the weekly snapshot silently omits mid-PR fleet members (S4). One engine gap completed the picture: legacy full-body agent stubs never convert to the stub shape (T-20261126-003).

This design closes all five with narrow changes and rules every open question on the recommended default under the owner's standing instruction. S1 gets the content-aware equal-version gate (option a) — the code holds every input the attribution needs, and the process-only alternative re-arms the exact failure `d82a73649` proves recurs. S2 is a two-parameter hash normalization that reverse-substitutes the rendered variant token. S3 is a new L0-only `docs/skill-intent.json` in the `fleet-membership.json` house shape, consumed by `classifyConvergence`. S4 adds an additive `transient[]` block to the durable snapshot JSON — the report's "without a trace" claim was already half-fixed on main (stderr + history page annotate since v2.5.0); the durable artifact the weekly analysis reads was the silent one. The pair program lands 8 template-side ports and 2 ADOPTs; the 10 KEEP_PROJECT pairs are dissolved by S2/S3 plus registrations and are explicitly NOT copied.

## 1. Problem

- Two template edits landed without version bumps — `bdb72db58` (2026-10-08, evidence-ledger overlay paragraph) and `d82a73649` (2026-11-08, last_reviewed refresh x20, finishing-a-development-branch frontmatter restructure, accessibility-audit blank-line removal). The `SYNC_IF_NEWER` version gate compares versions only: equal version + differing content means the edit is unreachable forever (DRIFT_PRESERVE), and every later wave re-reports it.
- The scaffold's whole-tree placeholder sweep rendered `` `scripts/<variant>/` `` to `` `scripts/co-<slug>/` `` inside delivered SKILL.md doc text; `normalizeForHash` strips stamp lines but not the token, so the five `script-lifecycle-manager` project copies each sit in their own permanent hash group.
- `classifyConvergence` hashes normalized file content only. Variant-override specializations, registered LOCAL-PATCHes, deliberate path adaptations and hub promotions are indistinguishable from drift, so adjudicated-converged pairs re-surface in every weekly report (the i18n-audit@co-price exclusion was a hand ruling in a ticket, not a mechanism).
- The snapshot JSON omits transient `pr/*` checkouts without a record. The 2026-11-26 snapshot covers 14 projects; co-price and co-architect are absent and nothing in the file says why — the weekly analysis undercounted the fleet and could not see 6 of the 22 pairs.
- The MERGE pass refreshes the managed body but `STUB_VERSION_BACKFILL` fires only for stub-shaped project files. A legacy FULL-BODY stub never converts, so the 2026-11-26 wave 2 needed hand frontmatter advances in co-design, co-hr, co-learning, co-news and co-work (`agents/pm.md`, bodies byte-identical).
- Twenty-two adjudicated pairs await their dispositions: 8 ports, 2 adoptions, 10 intentional keeps — none executable by a delivery wave alone.

## 2. Goals and Non-goals

**Goals**

1. A template edit that landed without a version bump is deliverable at the next wave when the project copy has not moved since its last delivery (S1).
2. A scaffold-rendered skill hashes equal to its template source (S2); the five cosmetic hash groups dissolve with zero content change.
3. An adjudicated intentional difference is reported `converged-intent`, not divergence (S3), and a registry row naming an unknown pair fails loudly.
4. A transient `pr/*` checkout is visible in the durable snapshot with id, branch, head and reason (S4).
5. A legacy full-body agent stub converts to the stub shape on a clean managed-body merge, never on a dirty one (T-20261126-003).
6. All 22 adjudicated pairs close: 8 ports land template-side, 2 pairs adopt, 10 stay by registration or normalization.

**Non-goals**

- Scanning PR working trees. S4 records absence with the checkout's head sha; it never reads PR tree contents.
- Re-litigating per-pair dispositions. The adjudication report is the SSOT; this design executes it.
- Changing the disposition matrix, `--disposition adopt-template` mechanics, or ADR-0085 D3's protective default for unattributable drift. S1 rides inside the existing equal-version arm.
- Converting resolved (non-stub) agent bodies outside the `agents/*` MERGE_MANAGED lane, or any content under `.claude/`, `.gemini/` platform mirrors.
- Changing any of the 13 skill contents to dissolve the cosmetic groups — S2 does that without touching a file.

## 3. Current state

All facts were re-verified on `main` (22cfae23a) on 2026-11-26. "U" marks a statement of the adjudication report I could not confirm as written; the correction is stated.

| Fact | Where I checked |
|---|---|
| The `SYNC_IF_NEWER` gate is version-only: `semverGt(tplVer, projVer)` delivers the whole skill directory; the equal-version arm runs additive catch-up and records `DRIFT_PRESERVE` for same-version content drift (ADR-0085 D3); the project-ahead arm records `PROJECT_AHEAD`. | `scripts/upgrade-project.ts:7238`, `:7302-7330`, `:7334-7343` |
| The same gate shape exists in the VARIANT SKILLS lane, which runs after and shadows the common lane. | `scripts/upgrade-project.ts:7481-7560` |
| Policy mapping: `skills/**` → `SYNC` / `SYNC_IF_NEWER: skills/`. | `scripts/lib/upgrade-policy.ts:895-897` |
| `normalizeForHash` strips the frontmatter stamp lines `version/last_updated/last_reviewed/scope/variant` and trailing whitespace; body text (including a rendered variant token) is untouched. `contentHash` = sha256[:16] of it. | `scripts/lib/skill-graph-compat.ts:100-121` |
| Node hashes are computed at graph generation: `readCopy` calls `contentHash(content)`. | `scripts/generate-skill-graph.ts:606-616`; ROOT at `:160` |
| The scaffold substitutes `` `…<variant>…` `` backtick-path spans to the variant name; CLI default `variantName = args[4] || projectName`; the CLI sweeps every text file (`.md`, `.json`, `.sh`, `.ps1`, `.toml`, `.yaml`, `.yml`, `.sample`). | `scripts/helpers/substitute-placeholders.ts:53`, `:94`, `:88-139`; invoked whole-tree from `scripts/new-project.ts:1612-1620` |
| `create-l3-scaffold` deliberately scopes substitution to `docs/context.md` only, citing `scripts/SCRIPTS.md` doc-text corruption. | `scripts/create-l3-scaffold.ts:800-810` |
| `classifyConvergence` groups capabilities by hash with no intent input (the report cited `:327-362`; the actual span is `:328-366`). | `scripts/skill-graph-fleet-report.ts:328-366` |
| `filterTransientCheckouts` returns skipped rows `{name, branch}`; `defaultProjects()` warns on stderr and feeds `fleetInfo.transientAbsent`; the HISTORY PAGE annotates `absent: transient PR checkout`. **Correction to the adjudication's S4**: the run is not fully silent — the durable snapshot JSON is. Verified: `snapshot-2026-11-26.json` top keys are `date/projects/fleetPresence/missingFromProjects/jaccard/convergence/fanIn2/rootOrphans`; `projects` holds 14 entries; no transient record exists anywhere in the file. | `scripts/lib/git-aware-scan.ts:86-101`; `scripts/skill-graph-fleet-report.ts:1091-1100`, `:3072-3077`, `:1946-1950`, `:2216`; `memory/skill-graph-metrics/snapshot-2026-11-26.json` (read 2026-11-26) |
| The snapshot object is assembled from per-scanned-project rows only. | `scripts/skill-graph-fleet-report.ts:3167-3184` |
| `STUB_VERSION_BACKFILL` fires only when `isExtendsStub(projContent)` and the managed-body merge is clean (no census escalation on either channel, no marker loss, frontmatter byte-identical). | `scripts/upgrade-project.ts:3741-3784`; `scripts/lib/upgrade-policy.ts:1448-1494` |
| `isExtendsStub` = a column-0 `extends:` in the frontmatter. | `scripts/lib/upgrade-policy.ts:1303-1314` |
| `gemini-parity` consumers read only the value `skip` (`gemini-parity:\s*skip`); no consumer reads `sync`. **Resolves the adjudication's Not-verified #2**: the `gemini-parity: sync` line on the co-architect copy (verified present, line 8, `version: 1.1.0`) is dead vocabulary. | `scripts/render-commands.ts:92`, `scripts/audit.ts:1412`, `scripts/generate-version-manifest.ts:489`, `scripts/validate-templates.ts:514` |
| The two un-bumped template commits exist as described. | `git show bdb72db58`, `git show d82a73649` |
| Template versions at design time: ci-triage 0.2.0, evidence-ledger 1.1.0, skill-lifecycle-manager 1.5.0 (co-safety override 1.5.1), script-lifecycle-manager 1.2.2, decision-record 1.1.0, accessibility-audit 1.1.0, finishing-a-development-branch 1.0.2; co-design ui-ux-design-intelligence override 1.0.1 (stale placeholder), co-design design-foundation 1.3.0, co-design token-usage-lint 1.1.1, co-safety project-review 1.3.4; `templates/co-work/skills/project-review/` absent. | grep over `templates/`, 2026-11-26 |
| `docs/fleet-membership.json` is the house pattern for an L0-only registry: `version` + `_comment` + rows with `id/reason/decided/decision_ref`, consumed through `lib/fleet.ts` with fail-closed malformed handling. | `docs/fleet-membership.json`; `scripts/lib/fleet.ts:44-80` |
| Delivery twins: `lib/skill-graph-compat.ts`, `lib/git-aware-scan.ts`, `lib/upgrade-policy.ts` and `generate-skill-graph.ts` have byte-identical L1 twins; `upgrade-project.ts` and `skill-graph-fleet-report.ts` are L0-only. | `templates/common/scripts/...` listing; `scripts/SCRIPTS.md:101`, `:127`, `:243` |
| Protected paths: `upgrade-project.ts`, `dev-sync.ts`, `audit.ts`, `docs/governance/**`, `memory/**` are protected; `skill-graph-fleet-report.ts`, `lib/upgrade-policy.ts`, `lib/skill-graph-compat.ts`, `lib/git-aware-scan.ts`, `generate-skill-graph.ts` and `templates/**` are not. | `docs/protected-paths.json` |

## 4. Proposed design

### 4.1 S1 — content-aware equal-version gate (verdict `SYNC_TEMPLATE_ADVANCE`)

- **Decision**: option (a), the content-aware gate. No blocker found in code: the equal-version arm already holds `priorBaselines`, the file-hash helper and per-file delivery; the only new input is attribution, and the baseline records it.
- **Change**: in the equal-version arm of BOTH skills lanes (common `SYNC_IF_NEWER: skills/` and VARIANT SKILLS), before a drifted file is recorded `DRIFT_PRESERVE`, attribute the difference against the delivery baseline:
  - project file hash **equals** `priorBaselines[rel].hash` → the project has not moved since its last delivery; the difference is template-side. Deliver the template copy of that file, record **`SYNC_TEMPLATE_ADVANCE`** (INFO, new verdict in `lib/upgrade-policy.ts`), and let the existing manifest flow refresh the baseline row. The delivered file is the template copy verbatim — equal versions mean the version line already matches, so the "re-stamp" is the baseline row, which is what future attribution reads.
  - hashes differ, or **no baseline row exists** → `DRIFT_PRESERVE` (unchanged; a project-side difference wins, and unknown attribution keeps ADR-0085 D3's protective default).
- **Guards, in order**: (1) `markerLossBlocks` / `dirMarkerLossBlocks` run first as today — a project LOCAL-PATCH marker the template lacks blocks delivery regardless of attribution (UR-2 stays protected); (2) the arm exists only in the skills lanes — `agents/*` and every MERGE_MANAGED path never enters it; managed-block merges continue through the MERGE pass; (3) `isLocallyModified` (uncommitted) files keep the existing CONFLICT warn path — an uncommitted edit is by definition project-side.
- **Process rule** (adopted from adjudication §5): a template-side skill edit without a version bump must be either bump-first or provably stamp-only; S1 makes a violation recoverable instead of permanently stranding it.
- **Files**: `scripts/upgrade-project.ts` (protected, human-merge), `scripts/lib/upgrade-policy.ts` (new verdict + severity) and its L1 twin; SCRIPTS.md rows ride the row.
- **Test**: unit/engine tests on temporary project trees — attributed template-side advance delivers with `SYNC_TEMPLATE_ADVANCE`; unattributable and project-moved cases stay `DRIFT_PRESERVE`; marker absence blocks; uncommitted file conflicts.

### 4.2 S2 — variant-token hash normalization

- **Change**: `normalizeForHash(content, variantName?)` gains an optional second parameter; `contentHash(content, variantName?)` forwards it. When set, the backtick-span reverse of `applySubstitutions` runs first: every `` `…<variantName>…` `` span is rewritten to the `` `<variant>` `` token form before the existing stamp stripping. Nothing else changes.
- **Substitution map source**: the generator run's ROOT. Project graphs are generated with ROOT = the project checkout, so the variant name is `basename(ROOT)` when ROOT is a fleet project path (`lib/fleet.ts` `isFleetProjectPath`); root and template scope graphs pass `undefined` (they hash unrendered sources — the parameter is never set, a no-op).
- **Collision avoidance**: (i) backtick-span shape only — prose outside backticks is never rewritten; (ii) exact full slug inside the span, no substring matching (`scripts/co-news/` matches; `co-newsletter` does not); (iii) fleet slug vocabulary `^co-[a-z0-9-]+$` cannot contain the literal `<variant>` token; (iv) symmetric — only a project's own slug is ever applied to that project's files, and template-side hashes carry no parameter, so a hub override legitimately naming a variant inside backticks is unaffected.
- **Effect**: the five `script-lifecycle-manager` pairs (adjudication rows 13-17) collapse into the template hash group mechanically — each rendered `` `scripts/co-<slug>/` `` normalizes back to the template's token text. No skill text changes.
- **Files**: `scripts/lib/skill-graph-compat.ts` + L1 twin, `scripts/generate-skill-graph.ts` + L1 twin (readCopy forwards the derived name). Graphs regenerate through the existing dev-sync step.
- **Test**: unit tests on the real pair — template copy and rendered copy hash equal under the same variantName; non-backtick text untouched; unrelated slugs untouched.

### 4.3 S3 — the skill-intent registry

- **Decision**: a new L0-only `docs/skill-intent.json` in the `fleet-membership.json` house shape (`version` + `_comment` + rows with `reason`/`decided`/`decision_ref`), never propagated, no delivery-map entry. Fleet-membership rows were rejected: membership and intent are different domains with different consumers, and overloading `docs/fleet-membership.json` would make `lib/fleet.ts` — the sole membership code path — parse intent it must not act on.
- **Schema**:

```json
{
  "version": 1,
  "_comment": "Adjudicated skill-intent registry...",
  "entries": [
    {
      "capability": "i18n-audit",
      "project": "co-price",
      "kind": "variant-override | hub-promoted | local-patch | path-adaptation | adjudicated-keep",
      "reason": "one non-empty paragraph",
      "decided": "YYYY-MM-DD",
      "decision_ref": "DEC-YYYYMMDD-NN | T-... | UR-..."
    }
  ]
}
```

- **Consumer**: `skill-graph-fleet-report.ts` loads it beside the snapshot dir and passes an intent map (`capability@project` → row) into `classifyConvergence` (the function stays pure; the map is optional). Pairs covered by the map leave the divergence computation. A capability whose every minority-hash-group member is covered is reported in a new `convergedIntent` bucket (capability + covered pairs); a capability with covered AND uncovered minority members stays in `convergenceWithDivergence` with the covered projects annotated in the row.
- **Validation** (fail-closed, the `lib/fleet.ts` precedent): malformed JSON, an unknown `kind`, a `decision_ref` that is not a DEC/T/UR id form, a project that is not a fleet member (`lib/fleet.ts`), or a capability that does not exist in that project's graph this run — each is a hard error naming the row; the run exits non-zero. A row whose pair later re-converges is inert (harmless, kept as documentation).
- **Marker rule** (explicit): LOCAL-PATCH marker presence in a file is NOT intent. Markers record "do not overwrite" (`markerLossBlocks`); the registry records "adjudicated intentional". Without a registry row the pair keeps surfacing weekly — exactly the UR-2 co-abap story. Both mechanisms stack; a registry row never weakens `markerLossBlocks`.
- **Seed rows (7)**: `i18n-audit@co-price` (adjudicated-keep — the T-20261123-005 scoping hand ruling, entry #1); `design-foundation@co-design` (hub-promoted, `b90c28e50`); `token-usage-lint@co-design` (hub-promoted); `project-review@co-safety` (variant-override, 1.3.4); `skill-lifecycle-manager@co-safety` (variant-override, 1.5.1); `project-review@co-abap` (local-patch, UR-2 / ADR-0097); `project-review@co-work` (path-adaptation — lands together with pair-program row P4; valid on registration because the capability exists in co-work's graph, inert once the override converges the pair). Rows 13-17 need NO registry rows — S2 dissolves them.
- **Files**: `docs/skill-intent.json` (new, L0-only), `scripts/skill-graph-fleet-report.ts` (L0-only, not protected), `tests/unit/` fixtures.
- **Test**: unit tests with fixture registries — unknown project/kind/capability each fail the run; a fully-covered capability reports `convergedIntent`; a partially covered one stays divergent with annotations; a marker-only pair without a row still surfaces.

### 4.4 S4 — the snapshot records transient checkouts

- **Change**: an additive `transient` array on the Snapshot object (top level, beside `projects`), written whenever `filterTransientCheckouts` skipped anything: one entry per skip — `{ id, branch, head, reason }`. `id` = member basename; `branch` from the existing skipped row; `head` from a new pure `checkoutHead(dir)` in `lib/git-aware-scan.ts` (`git -C <dir> rev-parse --short HEAD` under `gitCleanEnv()`, fail-open `null`); `reason` = the fixed exclusion rationale naming T-20261103-004. Legacy snapshots without the field parse unchanged (additive-only — the `agentGraph` AC2 pattern).
- **Corrected framing**: the run already warns on stderr and the history page annotates absentees (v2.5.0); what was silent is the durable artifact the weekly analysis reads. This change makes absence visible where the analysis happens.
- **Explicitly out of scope**: scanning PR working trees — the head sha comes from `rev-parse` only; the checkout stays excluded from discovery, classification and every per-project block.
- **Files**: `scripts/lib/git-aware-scan.ts` + L1 twin (`checkoutHead`), `scripts/skill-graph-fleet-report.ts` (L0-only, not protected; fleet-info wiring already in scope at `:3072-3077`).
- **Test**: unit tests on a fixture repo — one `pr/*` checkout produces exactly one entry with all four fields; main-branch and detached checkouts produce none; a legacy snapshot without `transient` parses.

### 4.5 T-20261126-003 — legacy full-body stub conversion (`STUB_SHAPE_CONVERSION`)

- **Change**: a sibling arm beside the `STUB_VERSION_BACKFILL` block (`upgrade-project.ts:3741-3784`). It fires when, after a clean managed-body merge — the same preconditions: `pass === "MERGE"`, `rel` under `agents/`, no census escalation on either channel, `markerLossBlocks` already passed, frontmatter byte-identical through the merge — the PROJECT content is **not** stub-shaped (`!isExtendsStub(projContent)`) **and** the template counterpart **is** stub-shaped (`isExtendsStub(tplContent)`).
- **Conversion**: new pure helper `convertLegacyStubShape(projectContent, templateContent, deliveryDate)` in `lib/upgrade-policy.ts` returns the template stub content with the top-level `last_updated` re-stamped to the delivery date (existing top-level line only, never injected) and the version taken from the template counterpart (already carried by the stub). Byte-identical no-op when the counterpart is not stub-shaped or unparsable.
- **Guard — frontmatter-superset**: the conversion proceeds only when every top-level key in the project frontmatter exists in the template counterpart's frontmatter; any project-only key blocks the conversion (row at INFO, project copy preserved). Rationale: the shape swap is wholesale, so it inherits `STUB_VERSION_BACKFILL`'s philosophy of never destroying frontmatter state it does not understand.
- **Why clean-merge is the line**: a clean census means no project-owned adapted content exists — the full body is template-owned text, so the stub shape carries the same information and nothing is lost. Wave-2 evidence is this exact shape ×5 (co-design, co-hr, co-learning, co-news, co-work `agents/pm.md`, bodies byte-identical). A dirty merge never converts: the pin stands and the existing CONFLICT rows report.
- **Verdict**: `STUB_SHAPE_CONVERSION` (INFO), message naming the conversion, the clean-merge precondition and the frontmatter guard. A stub-shaped project never enters this arm — the backfill owns that path; a resolved (non-stub) template counterpart never triggers it.
- **Files**: `scripts/upgrade-project.ts` (protected, human-merge), `scripts/lib/upgrade-policy.ts` (helper, verdict) + L1 twin.
- **Test**: engine tests on temporary project trees — the five-observation shape converts with `STUB_SHAPE_CONVERSION`; a census-dirty merge does not; a stub-shaped project takes the backfill path unchanged; a project-only frontmatter key blocks; a resolved-body counterpart never converts.

### 4.6 Pair program (the 22 adjudicated pairs)

The 10 KEEP_PROJECT pairs are handled by S2/S3 plus registrations, **not by copying**: rows 13-17 dissolve via S2 (five rendered-token hash groups collapse into the template group), rows 5, 11, 20, 21 close via S3 `variant-override`/`hub-promoted` seed rows, row 10 closes via the S3 `local-patch` seed row. The NO-OP pairs need nothing beyond what the ports already deliver (row 1 is healed by P8's bump; row 9 is already resolved). What follows lands template-side and in the project checkout only.

| Row | Pairs | Change | Acceptance criterion |
|---|---|---|---|
| P1 | 2 (ci-triage@co-develop), 3 (ci-triage@co-security) | Port the 2-line `> Note:` after the ticket-create line into `templates/common/skills/ci-triage/SKILL.md` — adopt co-develop's wording as canonical (ticket.ts is L0-only; record hardening in session memory); bump 0.2.0 → 0.2.1 | Next-wave dry-run converges both pairs; no other project loses content |
| P2 | 4 (decision-record@co-architect) | Port the frontmatter `relates_to:` block (`evidence-ledger` composes_with, `documentation-writing`) + empty `## Related Skills` stub into `templates/common/skills/decision-record/SKILL.md`; bump 1.1.0 → 1.1.1 | Graph gains the edges fleet-wide on next regeneration; pair converges |
| P3 | 6 (evidence-ledger@co-architect) | Port P's `relates_to:` block (`documentation-writing`, `research-analysis`) into `templates/common/skills/evidence-ledger/SKILL.md`; bump 1.1.0 → 1.1.1 — the bump also makes `bdb72db58`'s overlay paragraph deliverable fleet-wide (S1 strand #1 heals via this bump, belt and braces with 4.1) | Overlay paragraph reaches all carriers; pair converges; reviewers skim the new text on landing |
| P4 | 12 (project-review@co-work) | Create `templates/co-work/skills/project-review/SKILL.md` (co-safety override precedent) carrying the 3-line deliverables/ redirect (`docs/reports/` → `deliverables/reports/`, commit a8f7482) | Pair converges with delivery intact; S3 seed row documents the adaptation |
| P5 | 18 (script-lifecycle-manager@co-architect) | Port the `## Related Skills` stub + `prerequisites: none` into `templates/common/skills/script-lifecycle-manager/SKILL.md`; bump 1.2.2 → 1.2.3 | Pair converges on next wave |
| P6 | 19 (skill-lifecycle-manager@co-architect) | Port the one-line `prerequisites: none` into `templates/common/skills/skill-lifecycle-manager/SKILL.md`; bump 1.5.0 → 1.5.1 (common 1.5.1 and the co-safety override 1.5.1 coexist — separate lanes) | Pair converges on next wave |
| P7 | 22 (ui-ux-design-intelligence@co-design) | Replace the stale placeholder override `templates/co-design/skills/ui-ux-design-intelligence/SKILL.md` (1.0.1, byte-identical to common) with the project copy (`scope: co-design`, relates_to `service-design`, 1.0.2) | P == T immediately; pair converges with zero delivery |
| P8 | 1 (accessibility-audit, 15-carrier lag), 8 (finishing-a-development-branch@co-design) | Version bumps only: accessibility-audit 1.1.0 → 1.1.1 and finishing-a-development-branch 1.0.2 → 1.0.3 — the `d82a73649` stamp/restructure edits become deliverable | Next wave heals the 15-carrier accessibility group and the co-design pair |
| A1 | 7 (finishing-a-development-branch@co-architect) | ADOPT via explicit `--disposition adopt-template` grant, **gated on the gemini-parity check — now resolved green**: only the value `skip` is consumed (render-commands.ts:92, audit.ts:1412, generate-version-manifest.ts:489, validate-templates.ts:514); the copy's `gemini-parity: sync` is dead vocabulary, so the grant loses nothing. 1.1.0 is a promotion-era zombie no template history contains; the template restructure (P8's bump path) is canonical | Grant applied after P8; verifier reports the pair converged; no parity consumer breaks |

## 5. Order of implementation

Smallest safe first. Each row is one commit in one PR (the DEC-20261125-01 landing shape); protected rows are human-merge.

| # | Section | Path class | Canary |
|---|---|---|---|
| 1 | 4.4 S4 snapshot transient | Not protected (`git-aware-scan` + L1 twin, `skill-graph-fleet-report`) | Read-only run with a synthetic fixture checkout: `transient[]` written; real `Projects/` untouched |
| 2 | 4.2 S2 hash normalization | Not protected (`skill-graph-compat` + L1 twin, `generate-skill-graph` + L1 twin) | Graph regeneration: `script-lifecycle-manager` collapses to 1 hash group; zero SKILL.md diffs |
| 3 | 4.3 S3 intent registry | Not protected; new L0-only `docs/skill-intent.json` | Report run: rows 5/10/11/20/21 report `converged-intent`; a deliberately bad fixture row exits non-zero |
| 4 | 4.1 S1 gate | `upgrade-project.ts` protected, human-merge + `upgrade-policy` twin | `--dry-run` on a temporary fixture tree: attributed case delivers, unattributable preserves |
| 5 | 4.5 T-3 stub conversion | Protected, human-merge + `upgrade-policy` twin | `--dry-run` on a converted fixture: `STUB_SHAPE_CONVERSION` INFO row; dirty fixture untouched |
| 6 | 4.6 P1, P2, P3, P5, P6, P8 (common-skill ports + bumps) | Template content, not protected | `validate-templates.ts` PASS; version rows in skill frontmatter only |
| 7 | 4.6 P4, P7 (variant overrides) | Template content (`templates/co-work/`, `templates/co-design/`) | `validate-templates.ts` PASS; co-work override present with deliverables/ paths |
| 8 | 4.6 A1 gated adopt | `Projects/co-architect` write via the explicit grant | Grant command exit 0; the pair's verifier row converges |

Rows 1-3 unblock report trust before any engine row changes delivery behaviour. Rows 4-5 share the engine file and land as separate commits in table order. Rows 6-7 make the next scheduled wave converge 10 pairs without further engine work.

## 6. Alternatives considered

| A. S1 same-version strand | Pro | Con | Decision |
|---|---|---|---|
| (a) Content-aware gate, baseline-attributed | Self-healing; uses recorded provenance; protects project work; no new process | One more branch in a protected engine; attribution needs baseline rows | Chosen |
| (b) Process-only (bumps required + one-shot backfill of the two strands) | No engine change | `d82a73649` proves the discipline fails; the backfill is wave chore repeated per strand; the 20 baseline-less pairs stay unrecoverable | Rejected |

| B. S2 rendered-token fork | Pro | Con | Decision |
|---|---|---|---|
| Reverse-substitute at hash time (optional parameter) | One function; heals all rendered pairs; no content change | Hash values shift once fleet-wide | Chosen |
| Hash the un-substituted template form (persist pre-render copies) | Perfect fidelity | New artifact class; scaffold surgery; collision with the adoption-path scoped substitution | Rejected |
| Strip the token from template text (stop using `<variant>` in skills) | Simplest | Loses the doc-token's meaning; does not heal existing projects | Rejected |

| C. S3 intent representation | Pro | Con | Decision |
|---|---|---|---|
| New `docs/skill-intent.json` (fleet-membership house shape) | Right domain; fail-closed validation precedent exists; L0-only like the report | One more registry file | Chosen |
| Rows inside `docs/fleet-membership.json` | No new file | Wrong domain; `lib/fleet.ts` is the sole membership path and would have to parse intent | Rejected |
| Status quo (hand rulings in tickets) | Zero machinery | The adjudication showed this does not scale: 6 pairs re-surfaced weekly | Rejected |

| D. S4 absent-member visibility | Pro | Con | Decision |
|---|---|---|---|
| Additive `transient[]` block (id, branch, head, reason) | Durable, machine-readable, answers "why absent" | Snapshot grows by one small array on PR-heavy days | Chosen |
| Boolean `transientAbsent` per member only | Smaller | No branch/head; cannot distinguish stale checkout states | Rejected |
| HTML annotation only | Already exists | The weekly analysis reads the JSON, not the page — the 2026-11-26 undercount is the proof | Rejected |

| E. T-3 stub conversion | Pro | Con | Decision |
|---|---|---|---|
| Engine sibling arm on clean merge | Automatic; eliminates the hand-advance class | One more MERGE-pass branch (protected) | Chosen |
| One-shot hand-run script for the 5 projects | No engine change | Recurs for every future stub-shape change; the wave already paid this cost once | Rejected |
| Do nothing (verifier rows forever) | Nothing | Permanent [stale] noise per project | Rejected |

| F. Pair-program execution | Pro | Con | Decision |
|---|---|---|---|
| One batch, template-side (rows 6-7) + one grant (row 8) | One wave converges 20 of 22 pairs; reviewable diff | Large-but-mechanical diff | Chosen |
| Per-pair PRs | Smallest diffs | 10 PRs of frontmatter edits; merge ordering risk | Rejected |

## 7. Risks

- **S1 attribution error**: a stale or wrong baseline row could deliver over a project edit. Mitigation: the no-baseline case conservatively preserves; marker-loss still blocks first; uncommitted files conflict; the INFO verdict names the attribution basis.
- **S1 over-delivery**: the arm delivers only the drifted file(s) at the catch-up arm's per-file granularity — project-only files are never touched; whole-directory semantics stay with the version-gated arms.
- **S2 hash shift**: every rendered file's hash changes once, reshuffling snapshot hash groups. Convergence keys on capabilities and NEW/VANISHED detection keys on ids, not hashes; the history page renders both old and new groups without corruption (opaque comparisons).
- **S2 reverse-collision**: mitigated by backtick-span shape, exact-slug matching, slug vocabulary, and per-project symmetry (section 4.2).
- **S3 registry staleness**: a row outliving its divergence is inert by design; validation is existence-based, not divergence-based, so a converged pair does not fail the run.
- **S3 false silence**: a row could silence a pair that later genuinely diverges again. Mitigation: rows carry `reason` + `decision_ref`; the weekly report lists `converged-intent` capabilities explicitly, so silences are visible, not hidden.
- **S4 head sha**: `rev-parse` on a transient checkout is read-only and fail-open (`null` on any git error); no PR tree is read.
- **T-3 conversion loss**: guarded three ways — clean-merge precondition (no project-owned adapted content), frontmatter-superset guard, marker-loss first. Wave-2 evidence shows the shape is loss-free in practice.
- **P3 overlay text**: the evidence-ledger overlay paragraph is new text for ~14 projects; reviewers should skim it on landing (adjudication risk note carried forward).
- **Protected-path load**: rows 4-5 are human-merge on `upgrade-project.ts`. Stated per row in section 5.

## 8. Acceptance criteria

- [ ] 4.1: equal version + project hash == baseline hash + differing content → the template file is delivered with a `SYNC_TEMPLATE_ADVANCE` (INFO) decision row and the baseline row refreshes (engine test, temporary tree).
- [ ] 4.1: equal version + project hash != baseline hash → `DRIFT_PRESERVE`, content untouched.
- [ ] 4.1: equal version + no baseline row → `DRIFT_PRESERVE`, content untouched.
- [ ] 4.1: a project LOCAL-PATCH marker absent from the template blocks delivery even under positive attribution.
- [ ] 4.1: an uncommitted local modification keeps the CONFLICT warn path.
- [ ] 4.1: no `agents/*` or other MERGE_MANAGED path enters the new arm.
- [ ] 4.2: `normalizeForHash(content, "co-news")` rewrites a `` `scripts/co-news/` `` span to the `` `<variant>` `` form; text outside backticks is untouched; the slug `co-newsletter` does not match.
- [ ] 4.2: the real template copy of `script-lifecycle-manager/SKILL.md` and the rendered co-news copy hash equal under the same variantName.
- [ ] 4.2: after regeneration, the fleet snapshot reports one `script-lifecycle-manager` hash group (was six).
- [ ] 4.3: a fixture registry row naming a non-member project, an unknown capability, an unknown kind, or a malformed `decision_ref` makes the fleet report exit non-zero naming the row.
- [ ] 4.3: a capability whose every minority-group member is registry-covered reports `converged-intent`.
- [ ] 4.3: a capability with a covered and an uncovered minority member stays in `convergenceWithDivergence`, annotated.
- [ ] 4.3: a marker-bearing pair without a registry row still surfaces in the divergence report.
- [ ] 4.4: a fixture `pr/*` checkout yields exactly one `transient[]` entry with `id`, `branch`, `head`, `reason`.
- [ ] 4.4: main-branch and detached-HEAD checkouts produce no `transient[]` entries.
- [ ] 4.4: a legacy snapshot without `transient` parses and renders unchanged.
- [ ] 4.4: no PR working tree file is read (assertion on the scan path).
- [ ] 4.5: legacy full-body `agents/pm.md` + stub-shaped counterpart + clean merge → project file is the stub shape with `STUB_SHAPE_CONVERSION` (INFO).
- [ ] 4.5: a census-dirty merge never converts; existing rows unchanged.
- [ ] 4.5: a stub-shaped project takes the `STUB_VERSION_BACKFILL` path; the conversion arm never fires.
- [ ] 4.5: a project-only frontmatter key blocks the conversion (row at INFO, copy preserved).
- [ ] 4.5: a resolved (non-stub) template counterpart never converts.
- [ ] 4.6: rows P1-P8 land template-side; `validate-templates.ts` passes; the next-wave `--dry-run` shows zero ERROR rows for the affected pairs.
- [ ] 4.6: A1's adopt grant runs only after P8 and the gemini-parity check is recorded green; the pair's verifier row converges.

## 9. Test plan

- **Unit**: 4.2 normalizer tests (`tests/unit/`, real skill text fixtures); 4.3 classifier tests with fixture registries and fixture graphs; 4.4 `filterTransientCheckouts`/`checkoutHead` and snapshot-shape tests on a synthetic fixture repo (never the real `Projects/`).
- **Engine**: 4.1 and 4.5 on temporary project trees (mkdtemp fixtures, the existing upgrade-fixture pattern): attribution matrix, marker/marker-loss interplay, stub-shape conversion matrix, dry-run parity.
- **Replay**: after rows 1-3, regenerate the fleet report read-only and assert: one `script-lifecycle-manager` group; `converged-intent` covers rows 5/10/11/20/21; `transient[]` appears for any live `pr/*` checkout (synthetic fixture in a temp dir, not `Projects/`).
- **Fleet dry-run**: after rows 4-6, `bun scripts/upgrade-project.ts Projects/<p> --dry-run` on every fleet project shows zero new ERROR rows.
- **Nightly**: the first weekly report after the pair program lands is checked for: zero of the 22 pairs in `convergenceWithDivergence` except any newly authored drift.

## 10. Accessibility

Not applicable: non-UI change.

## 11. Preview verification

Not applicable.

## 12. Document impact

- **Design docs**: this document. The adjudication report and the STUB_VERSION_BACKFILL design are referenced, not amended.
- **Registry**: one row in `docs/specs/registry.json` (this spec, status `approved`).
- **New artifact**: `docs/skill-intent.json` is created at implementation row 3, not with this design.
- **SCRIPTS.md**: version rows for `skill-graph-fleet-report.ts`, `lib/skill-graph-compat.ts`, `lib/git-aware-scan.ts`, `lib/upgrade-policy.ts`, `generate-skill-graph.ts`, `upgrade-project.ts` ride their implementation rows; L1 twins regenerate through `generate-scripts-mirror.ts`.
- **Skill content**: only the pair-program rows touch SKILL.md files (frontmatter ports, one stub, two bumps); no skill text changes from S1-S4.
- **History page**: the `script-lifecycle-manager` hash-group collapse and the `transient[]` block render through the existing page logic; no page code change is designed here beyond the report-side wiring already named.

## 13. Open questions for the owner

1. **S1 gate choice**: content-aware gate (a) or process-only (b)? Default: (a).
   - 2026-11-26: ruled on the recommended default, (a) — no blocker in code; (b) re-arms the `d82a73649` failure class.
2. **S1 unattributable drift** (no baseline row): deliver anyway or preserve? Default: preserve (ADR-0085 D3 stands).
   - 2026-11-26: ruled on the recommended default, preserve.
3. **S2 normalization location**: hash-time reverse substitution vs persisted un-substituted copies. Default: hash-time.
   - 2026-11-26: ruled on the recommended default, hash-time reverse substitution in `normalizeForHash(content, variantName?)`.
4. **S3 registry location**: new `docs/skill-intent.json` vs rows in `docs/fleet-membership.json`. Default: new file.
   - 2026-11-26: ruled on the recommended default, new L0-only `docs/skill-intent.json`.
5. **S3 marker rule**: does a LOCAL-PATCH marker alone silence the weekly report? Default: no — registry row required; mechanisms stack.
   - 2026-11-26: ruled on the recommended default, marker != intent.
6. **S4 entry shape**: full `{id, branch, head, reason}` vs boolean-only. Default: full entry.
   - 2026-11-26: ruled on the recommended default, full entry, additive.
7. **T-3 conversion precondition**: bodies byte-identical (wave-2 shape) or census-clean (the general rule)? Default: census-clean — it subsumes byte-identical and matches the clean-merge vocabulary already used by STUB_VERSION_BACKFILL.
   - 2026-11-26: ruled on the recommended default, census-clean with the frontmatter-superset guard.
8. **Pair-program timing**: land all template rows in one batch before the next scheduled wave, or trickle? Default: one batch (rows 6-7), grant after (row 8).
   - 2026-11-26: ruled on the recommended default, one batch plus the gated grant.
