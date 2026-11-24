# Design: Upgrade and runner machinery batch (nine changes to workspace-root machinery)

- **Spec ID**: `2026-11-25-upgrade-runner-machinery-batch`
- **Date**: 2026-11-25
- **Author**: Template Architect (Design Gate Row 0)
- **Status**: proposed (awaiting owner approval)
- **Tickets**: T-20261124-001, -007, -008, -011, -012, -013, T-20261123-008, U-20261123-003, U-20261123-004, plus two findings raised by the PM on 2026-11-25 (sections 4.8 and 4.9)
- **Related**: `docs/designs/2026-11-24-fleet-test-baseline-design.md` (T-20261124-017, proposed) is referenced, not re-designed.

## 0. Conclusion

Eight of the nine changes close one of three holes: a gate that passes without looking at the evidence (verifier, ledger verify, decision validator), an engine step that skips work without saying so (script lane, baseline-only conflict test, dependency location), or a rule that cannot be met (fleet secret-scan config). One decision is a choice between two designs: cited decision records are resolved by a validator fallback to the workspace-root registry, not by delivering records into projects (section 4.5).

Seven changes touch protected paths and are human-merge. The runner prompt is revised once, at the end, in one governance change set.

## 1. Problem

- The post-delivery verifier reports engine-preserved conflicts as plain `STALE` and does not sweep common-sourced scripts or agents. On 2026-11-24 the runner then copied template files over nine project-evolved files (T-20261124-011).
- `run-manifest verify` passed with zero `gateChecks` rows while 8 projects entered STEP I, and the dry-run ran for the canary only (T-20261124-008).
- Battery components can be skipped without a ledger row, and a night without a run leaves nothing to detect it (T-20261123-008).
- The root backfill is keyed to a graph commit that dev-sync moves again during landing (T-20261124-001).
- Delivered documents cite decision records the engine does not deliver, so the delivered validator blocks dev-sync in every upgraded project (T-20261124-012, U-20261123-004).
- The engine never visits variant scripts outside `scripts/<variant>/`, leaves registry rows behind file versions, delivered an L0-only script into a variant, and emitted a row with a raw pipe (T-20261124-013, U-20261123-003).
- Merge predicate 4 names a full-scan gitleaks config that no fleet repository carries, so no fleet PR can merge (T-20261124-007).
- The engine's conflict test compares against a recorded baseline, never against the template copy, so a template-side port cannot clear a conflict (PM finding, section 4.8).
- `contained-run.ts` looks for dependencies only at `<project>/node_modules`; a scripts-scoped manifest project can be neither audited nor reviewed (PM finding, section 4.9).

## 2. Goals and Non-goals

**Goals**

1. A preserved conflict is reported as a conflict, everywhere the verifier looks, and an overwritten conflict is detected.
2. A ledger that passes `verify` proves the STEP I gate ran per project and that every battery component ran or is recorded as skipped.
3. Backfill freshness does not depend on the order of two commits.
4. A citation of a workspace-level decision record passes the project validator without copying records.
5. Every file a template ships under `scripts/` is delivered or named in the decision log.
6. A project copy that equals the template copy apart from its version line stops being a conflict.
7. A scripts-scoped manifest project can be audited and reviewed.

**Non-goals**

- How the battery chooses its commands. That is `2026-11-24-fleet-test-baseline-design.md` (sections 4.1 and 4.5); this design does not edit that selection.
- Hand-merging the six STEP F pull requests. Predicate 6 (`memory/**`) holds them for human merge whatever is decided here.
- Replacing the baseline mechanism. The baseline stays the primary signal; section 4.8 adds one narrow fast path.
- Delivering decision records into projects (rejected, section 6).

## 3. Current state

All facts below were read in the file named. "U" marks a statement I could not confirm.

| Fact | Where I checked |
|---|---|
| The verifier's candidate set is `files[]` from the manifest plus `templates/<variant>/scripts/**`. Common scripts and agents are not swept. | `scripts/verify-delivered-versions.ts:98`, `:137-152` |
| The verifier reads only `files` and `templateVersion` from the manifest. It never reads `decisions[]` or `pendingBackport[]`. | `scripts/verify-delivered-versions.ts:56` |
| Its only finding kinds are `absent` and `stale`. | `scripts/verify-delivered-versions.ts:30`, `:133` |
| On co-deck it prints 10 `[stale]` rows and omits both common-sourced conflicts. On co-architect it prints clean while six agents are `CONFLICT`. | Run on 2026-11-25 (both projects) |
| `verify` checks that the seven arrays exist and `run`/`started`/`prerunHeads` are present. It has no rule that compares `gateChecks` with the work done. | `scripts/run-manifest.ts:349-372` |
| `gate-step-i` writes one row per submitted project before any dry-run, and one row when zero projects are submitted. The rule that it runs first is prompt text only. | `scripts/run-manifest.ts:17-23`, `:255-345` |
| `skip` appends to `skippedBudget[]`. Nothing requires a component to appear in `steps[]` or `skippedBudget[]`. | `scripts/run-manifest.ts:211-219` |
| Backfill freshness is "recorded `graphHeadSha` equals the last commit that changed the graph path". | `scripts/skill-graph-fleet-report.ts:858-870`, `:3166-3173` |
| dev-sync stages `docs/skill-graph.json` during landing (step 4.65 regenerates it). | `scripts/dev-sync.ts:8`, `:1586` |
| Check V collects ids from `ROOT/docs/decisions` only and fails every id not found there. | `scripts/validate-decisions.ts:317-348` |
| dev-sync step 3.96b exits 1 when the validator fails. | `scripts/dev-sync.ts:1805-1812` |
| The script lane enumerates `templates/<variant>/scripts` and `templates/common/scripts`; `collectScriptFiles` decides which files count. | `scripts/upgrade-project.ts:5749-5760`, `:5763` |
| A separate VARIANT SCRIPTS pass copies only `.ts`, `.mjs` and `.json` files. | `scripts/upgrade-project.ts:5987-6010` |
| `reconcileScriptRegistry` runs at seven copy sites; the row lookup tries the L0 registry first. | `scripts/upgrade-project.ts:3014`, `:5822` to `:6092` |
| An appended row whose layer is `L0` or `L0-only` is rewritten to `L3`. | `scripts/upgrade-project.ts:3218-3228` |
| U: whether `collectScriptFiles` filters by extension (the likely cause of the `.py` gap). | `scripts/upgrade-project.ts:5763` (body not read) |
| U: which code path copied `skill-graph-fleet-report.ts` into co-security. | not found |
| `classifyProjectState` returns `IN_SYNC` only on an exact key match; otherwise `PROJECT_EVOLVED`. | `scripts/lib/upgrade-policy.ts:1790-1806` |
| The baseline key for `agents/` strips the lifecycle block only; the version line stays in the key. | `scripts/lib/upgrade-policy.ts:1779-1782` |
| `evolvedDeliveryGuard` sends every `PROJECT_EVOLVED` candidate to the disposition matrix; agents are `CONFLICT` regardless of `templateChanged`. | `scripts/upgrade-project.ts:3971-3975`, `:4036-4041` |
| On co-architect all six conflicted agents equal the template except the `version:` line. | Companion report `docs/reports/2026-11-25-conflict-adjudication-analysis.md` |
| `contained-run.ts` reads `<project>/package.json` for the lifecycle-script refusal and requires `<project>/node_modules`. | `scripts/contained-run.ts:60`, `:86` |
| Predicate 4 runs `gitleaks detect --config .github/gitleaks-full.toml` and fails when the file is absent. | `docs/governance/automation-prompts/runner-v5.snapshot.txt:31` |
| `templates/common/.github/` holds `CODEOWNERS`, `pull_request_template.md` and `workflows` only. | directory listing |
| The prompt manifest carries one entry with a snapshot and a sha256. | `prompts.manifest.json:6-10` |
| `run-manifest.ts`, `verify-delivered-versions.ts`, `contained-run.ts` and `skill-graph-fleet-report.ts` have no `templates/common/scripts/` twin; `validate-decisions.ts` has one. | directory listing |

Protected paths (from `docs/protected-paths.json`): `scripts/upgrade-project.ts`, `scripts/ticket.ts`, `scripts/run-manifest.ts`, `scripts/stop-gate.ts`, `scripts/battery.ts`, `scripts/verify-delivered-versions.ts`, `scripts/contained-run.ts`, `scripts/dev-sync.ts`, `scripts/audit.ts`, `docs/adr/**`, `docs/governance/**`, `memory/**`, `prompts.manifest.json` and the protected-paths file itself. `scripts/validate-decisions.ts`, `scripts/lib/upgrade-policy.ts` and `scripts/skill-graph-fleet-report.ts` are not listed.

## 4. Proposed design

### 4.1 T-20261124-001: key backfill freshness on graph content

- **Change**: record `graphContentSha256` (SHA-256 of `docs/skill-graph.json` at the graph commit) beside `graphHeadSha`. `backfillIsFresh` returns true when the content hash equals; the commit sha stays as information. Fix (b) of the ticket.
- **Files**: `scripts/skill-graph-fleet-report.ts` (not protected, L0-only); `memory/skill-graph-metrics/root-backfill.json` (regenerated, under `memory/**`, protected); section 3 of `docs/designs/2026-11-24-backfill-invalidation-key-design.md` (rule replaced).
- **dev-sync**: unchanged. This is why (b) is chosen over (a): (a) adds a post-step to a protected 3,400-line script.
- **Test**: unit test of `backfillIsFresh`: same content hash and a different graph commit returns true; a different content hash returns false; a legacy file without the field is stale once.

### 4.2 T-20261124-008: verify must see one gate row per reviewed project

- **Change**: in `verify`, compute the reviewed projects from `projectReviews[]` and the STEP I skips from `skippedBudget[]` rows whose step is `STEP_I`. Expected gate rows = reviewed minus STEP I-skipped. When the count of `gateChecks[]` rows with gate `STEP_I_PRE_REVIEW` is below that number, `verify` exits 4. It fails; it does not warn, because a warning is the 2026-11-24 outcome.
- **Files**: `scripts/run-manifest.ts` (protected). Prompt text: see section 4.10.
- **Test**: fixtures: 8 review rows and 0 gate rows exits 4; 8 and 8 exits 0; 8 review rows, 1 STEP I skip and 7 gate rows exits 0.

### 4.3 T-20261123-008: loud, ledgered skips and missed nights

- **Change 1 (component coverage)**: `verify --profile full|fast` checks a fixed component table for that profile. A component is covered when `steps[]` holds a row for it (any status, including `failed`) or `skippedBudget[]` holds a row whose step is the component name. An uncovered component makes `verify` exit 5.
- **Change 2 (missed nights)**: `verify --nights N` looks for a run manifest for each scheduled night in the window. A scheduled night without a manifest makes `verify` exit 6. The schedule is a table in the script (open question 2).
- **Files**: `scripts/run-manifest.ts` (protected). No change to `battery.ts`: the component names are ledger labels, and the commands behind them stay where the fleet-test-baseline design puts them.
- **Test**: table-driven unit tests: a missing component exits 5; a component with only a skip row exits 0; a night without a manifest exits 6.

### 4.4 T-20261124-011: the verifier names conflicts and detects overwrites

- **Change 1 (sweep)**: the candidate set becomes `files[]`, the keys of `baselines`, every `pendingBackport[].path`, and `templates/<variant>/scripts/**`. The baseline keys are the set the engine has delivered, so common scripts and agents are included.
- **Change 2 (label)**: a path whose `pendingBackport[]` entry has kind `CONFLICT`, or whose `decisions[]` entry is `CONFLICT`, is reported as kind `conflict` with the text "engine-preserved: adjudicate; never copy the template file over it".
- **Change 3 (overwrite detection)**: for such a path, when the SHA-256 of the project copy differs from `pendingBackport[].projectHash`, the finding is kind `conflict-overwritten`. This is the 2026-11-24 incident as a mechanical check.
- **Exit**: 1 for any finding, as today. The success line names the number of conflict-preserved paths when it is zero and fails otherwise.
- **Files**: `scripts/verify-delivered-versions.ts` (protected). Prompt text: section 4.10.
- **Test**: fixture project with a v2 manifest: one `CONFLICT` path with a matching hash gives `conflict`; one with a changed hash gives `conflict-overwritten`; a common script present only in `baselines` is probed; a template path under `scripts/**` that the manifest does not list is probed.

### 4.5 T-20261124-012 and U-20261123-004: resolve citations by validator fallback

- **Decision**: the validator falls back to the workspace-root registry. The engine does not deliver decision records.
- **Change**: `knownDecIds` is the set of ids in `ROOT/docs/decisions` plus the ids in `<workspace-root>/docs/decisions`. The root is `ROOT/../../` and is used only when it holds `AGENTS.md`. A local id wins on collision. An id that resolves only at the root is reported in an INFO line naming the root record. An id that resolves nowhere stays fatal.
- **Why not deliver the records**: section 6, alternative B.
- **Files**: `scripts/validate-decisions.ts` (not protected), then the L0-to-L1 publish of `templates/common/scripts/validate-decisions.ts`. The version bump rides the next wave.
- **Limit**: the fallback needs the nested layout. U: whether any fleet project runs dev-sync outside `ai_workspace/Projects/` (a detached clone would still fail as today).
- **Test**: unit tests with a temporary tree: id only at root passes with INFO; id at both levels resolves locally; id nowhere fails; `ROOT/../../` without `AGENTS.md` is ignored.

### 4.6 T-20261124-013 and U-20261123-003: four engine gaps

- **(a) Unvisited scripts**: the script lane enumerates every file under `templates/<variant>/scripts` and `templates/common/scripts`. A file the lane cannot place (no version header, no hash lane) gets a `UNCLASSIFIED` decision row at WARN. Implementation must start by reading `collectScriptFiles` (`scripts/upgrade-project.ts:5763`) and confirm whether the extension filter causes the gap.
- **(b) Registry rows**: after the last script pass, one loop compares the `@version` of each file copied in this run with its row in the project `scripts/SCRIPTS.md`. A mismatch calls `reconcileScriptRegistry`; a mismatch that remains is a `REGISTRY_DRIFT` decision row at ERROR and a non-zero exit. This replaces reliance on seven call sites.
- **(c) L0-only scripts**: a script whose only row source is the L0 registry, with layer `L0` or `L0-only`, is never copied to a variant target. It gets an `L0_ONLY_SKIP` row at INFO. The layer rewrite to `L3` at `:3224-3228` is removed for those rows.
- **(d) Raw pipe in a cell**: the row emitter escapes `|` inside a cell as `\|` before it appends or synthesizes a row.
- **Files**: `scripts/upgrade-project.ts` (protected), `scripts/lib/upgrade-policy.ts` (three new verdicts), the `templates/common/` twins, the L0 row for `skill-graph-fleet-report.ts` in `scripts/SCRIPTS.md` if it still holds a raw pipe.
- **Test**: integration test on a temporary variant project: a `.py` file under `scripts/deck/` is delivered; an unversioned file gets `UNCLASSIFIED`; a delivered file whose row is not updated fails; an L0-only row is skipped; a row containing `` `a|b` `` parses to 8 columns.

### 4.7 T-20261124-007: deliver the full-scan config to fleet repositories

- **Decision**: option (a). `templates/common/.github/gitleaks-full.toml` is a byte copy of the root file. The engine delivers it to every fleet repository.
- **Why (a)**: the fail-closed rule and the predicate text stay as they are, there is one scanning configuration, and the runner prompt does not change for this ticket.
- **Files**: `templates/common/.github/gitleaks-full.toml` (new); `docs/protected-paths.json` (`fleetParityCarveOut.paths` gains the path; protected, human-merge); ADR-0105 amendment (protected).
- **Test**: a drift test asserts the template file and the root file are byte-identical; `check-upgrade-coverage.ts --strict` classifies the new path.

### 4.8 PM finding 1: content-identity fast path in the engine

- **Decision**: add the fast path. Until it lands, the two-step procedure (port, then one explicit adopt grant) stays manual.
- **Change**: in `classifyProjectState`, a `PROJECT_EVOLVED` candidate becomes `CONTENT_EQUIVALENT` when project and template are byte-equal after removing only: the YAML frontmatter keys `version` and `last_updated`, the `lifecycle` block, and a `@version` value. The guard then delivers the template copy with verdict `CONTENT_EQUIVALENT` at INFO and the baseline resets at manifest write. Every changelog line in the body stays in the comparison, so a real difference still conflicts.
- **Guard kept**: `markerLossBlocks` still runs. A project marker the template lacks blocks the delivery.
- **Files**: `scripts/lib/upgrade-policy.ts` (new verdict), `scripts/upgrade-project.ts:4036` (protected), section 4 of `docs/designs/2026-10-27-sync-overwrite-policy-design.md` (one matrix row added).
- **Effect on open conflicts**: clears the six co-architect agents without a sign-off step. It does not clear the co-deck files, whose header lines differ; they keep the adopt-with-sign-off path in the companion report.
- **Test**: unit tests: frontmatter-only difference gives `CONTENT_EQUIVALENT`; `@version`-only difference gives it; one changed body line gives `PROJECT_EVOLVED`; a marker absent from the template blocks.

### 4.9 PM finding 2: dependency location for a scripts-scoped manifest

- **Decision**: `contained-run.ts` accepts `<project>/scripts/node_modules` when `<project>/package.json` is absent and `<project>/scripts/package.json` exists.
- **Change**: compute `manifestDir` by that rule. The `node_modules` check (line 86) and the lifecycle-script refusal (line 60) both read from `manifestDir`. The refusal must follow the manifest: today a lifecycle script in `scripts/package.json` is not checked.
- **Unchanged**: no install, exit 3 on absence, every other refusal, the dirty-tree assertion.
- **Files**: `scripts/contained-run.ts` (protected).
- **Test**: unit tests on temporary trees: scripts-scoped layout passes the dependency check; the same layout with a `postinstall` script in `scripts/package.json` exits 3; a root `package.json` keeps the root location; both absent exits 3.

### 4.10 Runner prompt revision (one governance change set)

One revision covers four tickets. It ships as prompt text, `runner-v6.snapshot.txt` and the new sha256 in `prompts.manifest.json`, in one protected change set.

1. STEP I (0) becomes a numbered call: run `gate-step-i` and confirm its exit code before the first dry-run (T-20261124-008).
2. STEP I (1) states that the dry-run runs for every admitted project; the canary limits only the first real run (T-20261124-008).
3. STEP I (5) states that a `[conflict]` or `[conflict-overwritten]` row is never fixed by copying a template file; the delivery is recorded INCOMPLETE and a ticket is filed (T-20261124-011).
4. STEP 0 runs `verify --profile <p> --nights 1` for the previous night (T-20261123-008).

### 4.11 Platform Impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | None | N/A: no CLAUDE.md, agent or skill text changes |
| Antigravity | None | N/A: no GEMINI.md, agent or skill text changes. Justification: every change is a script, a template file or runner governance text |
| templates/common | Required | `scripts/validate-decisions.ts`, `scripts/upgrade-project.ts`, `scripts/lib/upgrade-policy.ts`, `.github/gitleaks-full.toml` |

## 5. Order of implementation

Smallest safe first. Each row is one PR, merged before the next row starts (dev-sync rewrites shared files on every commit).

| # | Section | Path class | Canary |
|---|---|---|---|
| 1 | 4.4 verifier | Protected, human-merge | Read-only run on co-deck (expect 10 `conflict` rows, 0 `conflict-overwritten`) and co-architect (expect 6 `conflict` rows) |
| 2 | 4.2 and 4.3 ledger verify | Protected, human-merge | `verify` replayed on the 2026-11-24 manifest (expect exit 4) and the 2026-11-25 manifest (expect exit 0) |
| 3 | 4.1 backfill key | Script not protected; artifact under `memory/**` is human-merge | The next graph-touching landing; the following fleet-report run reports the backfill fresh |
| 4 | 4.5 validator fallback | Not protected; L1 publish | co-security: step 3.96b exits 0 without pointer records |
| 5 | 4.8 fast path | `upgrade-project.ts` protected, human-merge | `--dry-run` on co-architect: 6 `CONTENT_EQUIVALENT`, 0 `CONFLICT` |
| 6 | 4.9 dependency location | Protected, human-merge | co-safety: `contained-run.ts --project Projects/co-safety -- bun scripts/audit.ts` exits 0 |
| 7 | 4.6 engine gaps | Protected, human-merge | co-work: `--dry-run` lists `scripts/deck/**`; co-security: `L0_ONLY_SKIP` for the fleet-report script |
| 8 | 4.7 scan config | Protected list, human-merge | co-abap: wave PR carries the file; predicate 4 runs and passes |
| 9 | 4.10 prompt revision | Protected (`docs/governance/**`, `prompts.manifest.json`) | Prompt-integrity verifier reports 1/1 match on the next 06:00 run |

Rows 1 and 2 come first because they stop the 2026-11-24 failure from recurring. Row 5 precedes row 7 because it unblocks one blocked project on its own.

## 6. Alternatives considered

| A. Backfill key | Pro | Con | Decision |
|---|---|---|---|
| (a) dev-sync post-step regenerates the backfill | Pair is consistent in one commit | Edits protected `dev-sync.ts`; adds runtime to every landing | Rejected |
| (b) content-hash key | Order-independent; no dev-sync change | A squash that leaves content equal reads fresh (correct) | Chosen |

| B. Cited decision records | Pro | Con | Decision |
|---|---|---|---|
| Deliver the cited record into the project | Project is self-contained offline | Ids collide across repositories; the ticket itself requires a refusal on collision, so the seven projects stay blocked. U: imported records may fail the project's chain checks. Protected engine change. The project then owns a foreign record. | Rejected |
| Validator falls back to the workspace-root registry | No copy, no collision problem, one file, matches the fact that template documents cite workspace decisions | Needs the nested layout | Chosen |

| C. Merge predicate 4 | Pro | Con | Decision |
|---|---|---|---|
| (a) Deliver the full config to fleet repositories | Rule and prompt unchanged; one configuration | One more delivered path; the file is unused by fleet CI | Chosen |
| (b) Predicate names `.gitleaks.toml` | No new file | U: whether the per-PR config covers what the full config covers; weakens a fail-closed rule on an unverified equivalence | Rejected |
| (c) Ratify the per-PR scan as the full scan | No change to files | Same unverified equivalence; needs a carve-out clause and a prompt change | Rejected |

| D. Content-identity fast path | Pro | Con | Decision |
|---|---|---|---|
| Engine fast path | Conflicts with identical bodies clear without sign-off | One more branch in a protected engine | Chosen |
| Keep the two-step procedure manual | No engine change | Every such conflict costs a port plus a signed adopt; six signed adoptions for co-architect alone | Rejected |

| E. Component coverage | Pro | Con | Decision |
|---|---|---|---|
| `verify` coverage rule | Uses rows that already exist | True only for components in the table | Chosen |
| Battery writes its own ledger rows | Exact per command | Edits `battery.ts` and overlaps the fleet-test-baseline design | Rejected |

## 7. Risks

- **Verifier sweep noise**: the larger candidate set may report project-only paths under `scripts/**` as `absent`. Mitigation: the sweep probes only paths the template ships, as today (`verify-delivered-versions.ts:123`).
- **Verify exit 4 on a legitimate short night**: a battery-only night has zero review rows, so expected is zero and the rule does not fire. A night with reviews and a skipped STEP I is covered by the STEP I-skip subtraction.
- **Component table wrong**: a renamed component fails every night until the table is updated. That failure is loud and is the purpose of the change.
- **Fast path hides a real difference**: limited to the version line, `last_updated` and the lifecycle block. Any body difference still conflicts.
- **Fast path clears the baseline**: after it fires, the baseline is the template copy. That is the same effect as an adopt grant.
- **Scoped manifest and lifecycle scripts**: the lifecycle refusal now applies to `scripts/package.json`; a project with such a script becomes refused (exit 3) instead of silently unchecked.
- **(a) config delivery**: the fleet copy can drift from the root copy. The drift test fails CI on drift.
- **Protected-path load**: seven human merges. Stated per row in section 5.

## 8. Acceptance criteria

- [ ] 4.1: `backfillIsFresh` returns true for equal content and a different graph commit (unit test).
- [ ] 4.2: `verify` exits 4 on the 2026-11-24 manifest and 0 on the 2026-11-25 manifest.
- [ ] 4.3: `verify --profile <p>` exits 5 when a table component has no `steps` row and no `skippedBudget` row.
- [ ] 4.3: `verify --nights N` exits 6 when a scheduled night has no manifest.
- [ ] 4.4: on co-deck the verifier prints 10 `conflict` rows and 0 `conflict-overwritten` rows, exit 1.
- [ ] 4.4: on co-architect the verifier prints 6 `conflict` rows, exit 1.
- [ ] 4.4: a changed hash on a `CONFLICT` path prints `conflict-overwritten`.
- [ ] 4.5: an id present only in the workspace-root registry passes Check V with an INFO line.
- [ ] 4.5: an id present nowhere still fails Check V.
- [ ] 4.6: a versioned `.py` file under `templates/<variant>/scripts/deck/` is delivered to a temporary project.
- [ ] 4.6: after delivery, every copied script's `@version` equals its `scripts/SCRIPTS.md` row version, or the run exits non-zero.
- [ ] 4.6: a script whose only row has layer `L0-only` is not copied to a variant target.
- [ ] 4.6: a registry cell containing a pipe inside backticks parses to 8 columns.
- [ ] 4.7: `templates/common/.github/gitleaks-full.toml` and `.github/gitleaks-full.toml` are byte-identical.
- [ ] 4.8: a `PROJECT_EVOLVED` candidate that differs only in the version line delivers as `CONTENT_EQUIVALENT` and resets the baseline.
- [ ] 4.8: a candidate that differs in one body line stays `CONFLICT`.
- [ ] 4.8: a `LOCAL-PATCH` marker absent from the template still blocks delivery.
- [ ] 4.9: with no root `package.json` and a present `scripts/package.json`, `contained-run.ts` accepts `<project>/scripts/node_modules` and every other refusal is unchanged.
- [ ] 4.10: `verify-prompt-integrity.ts` reports 1/1 match for the revised prompt.

## 9. Test plan

- **Unit**: each change ships with the unit test named in its subsection, under `tests/`.
- **Integration**: 4.4 and 4.6 use temporary project trees with a v2 manifest fixture. 4.8 uses the existing upgrade fixtures.
- **Replay**: 4.2 and 4.3 run `verify` against the stored 2026-11-24 and 2026-11-25 manifests (read-only).
- **Fleet dry-run**: after row 7, `bun scripts/upgrade-project.ts Projects/<p> --dry-run` on every fleet project shows zero new `ERROR` rows.
- **Nightly**: the first three nights after row 9 are checked for exit 4, 5 or 6 from `verify` and for `[conflict-overwritten]` rows (expected: none).

## 10. Accessibility

Not applicable: non-UI change.

## 11. Preview verification

Not applicable.

## 12. Document impact

- **Design docs**: this document; one row added to section 4 of `2026-10-27-sync-overwrite-policy-design.md`; section 3 of `2026-11-24-backfill-invalidation-key-design.md` replaced by the content-hash rule.
- **ADR**: one amendment to ADR-0105 (fleet delivery of the full-scan config and the carve-out entry). No new ADR (open question 5).
- **SCRIPTS.md**: version rows for `verify-delivered-versions.ts`, `run-manifest.ts`, `contained-run.ts`, `validate-decisions.ts`, `upgrade-project.ts`, `skill-graph-fleet-report.ts`, plus the L1 rows for the twins.
- **README**: none expected. U: whether `scripts/README.md` documents verifier exit codes.
- **Runner prompt**: prompt text, `runner-v6.snapshot.txt`, `prompts.manifest.json` sha256, in one change set (section 4.10).
- **Tickets**: each ticket closes on its row's acceptance criteria; U-20261123-003 and U-20261123-004 are answered through the upstream channel.

## 13. Open questions for the owner

1. **T-20261124-007**: confirm option (a). Default: (a).
2. **T-20261123-008 schedule**: which nights are scheduled (are weekends excluded)? Default: Monday to Friday, 03:00 KST.
3. **4.8 fast path scope**: frontmatter keys and `@version` only, or also changelog header comments? Default: the narrow scope.
4. **4.2 verify result**: fail with exit 4, or warn? Default: fail.
5. **ADR**: one amendment to ADR-0105, or a new ADR for the batch? Default: amendment only.
