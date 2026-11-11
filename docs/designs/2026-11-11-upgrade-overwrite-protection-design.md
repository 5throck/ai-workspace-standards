# Upgrade Overwrite Protection — Design (Row 0)

- **Spec ID**: `2026-11-11-upgrade-overwrite-protection-design`
- **Date**: 2026-11-11
- **Status**: approved. The user made the four scope decisions on 2026-11-11 (recorded in [DEC-20261111-01](../decisions/DEC-20261111-01.md)). The implementation tickets in §10 are proposals; the PM creates them.
- **Author**: architect (PM-dispatched, Design Gate Row 0, design only)
- **Input**: [`docs/reports/2026-11-11-template-overwrite-fleet-audit.md`](../reports/2026-11-11-template-overwrite-fleet-audit.md) (root causes RC1–RC7, remedies R1–R10, priorities P0–P3)
- **Amends**: [`2026-11-10-delivery-gating-hardening-design.md`](2026-11-10-delivery-gating-hardening-design.md) and [DEC-20261110-04](../decisions/DEC-20261110-04.md). The non-goal "no change to the disposition matrix for `PROJECT_EVOLVED`" (§3 there) is reversed. Its open question Q4 is answered by §4.2 here. Its Q1 (A1 severity for unmarked divergence) is answered by §4.4 and §4.6.
- **Related**: U-20261110-001, U-20261111-004, U-20261105-004, T-20261110-009 / -010 / -011 / -012, `2026-10-27-sync-overwrite-policy-design` (D1–D3, adjudicated-port procedure §6), `2026-10-28-delivery-tombstone-ownership` (D4 agents/ row)
- **Engine under design**: the working tree, including uncommitted T-009/T-012 work: `scripts/upgrade-project.ts` v1.100.0, `scripts/lib/upgrade-policy.ts` v1.40.0, `scripts/validate-templates.ts` v1.77.0, `scripts/audit.ts` v2.66.0. Line numbers below refer to that working tree. They will shift when PR1/PR3/PR4 land (§9).
- **Scope**: design only. This document changes no script, template, project, or skill file.
- **Boundary note (CLAUDE.md §9)**: every engine change is a workspace-root (L0) change. The L1 copies of `scripts/lib/upgrade-policy.ts`, `scripts/dev-sync.ts`, and `scripts/validate-templates.ts` under `templates/common/scripts/` are refreshed by the `/sync` L0→L1 publish step (dev-sync step 4.5), not by hand. No `templates/<variant>/` content changes. Project-side ack files are project PRs that each project PM runs.

## 0. User decisions (final, 2026-11-11)

| # | Decision | Where it lands |
|---|---|---|
| D1 | Reverse the DEC-20261110-04 non-goal. The engine delivers a template copy over project evolution only when the template changed since the baseline. A project-only change gets the new verdict `EVOLVED_PRESERVE`. | §4.2 (E1) |
| D2 | The backport gate blocks. Rollout is off → shadow → enforce. In enforce, an apply with project-ahead or `pendingBackport` files requires `--backport-ack`. The gate covers off-cycle runs too. | §4.6 (G1), §5 |
| D3 | Freeze apply runs for co-deck, co-abap, co-hr, co-safety, and co-newbiz until the engine change lands. Dry runs stay allowed. | §5 Phase 0, §8 |
| D4 | Every `LOCAL-PATCH` form counts as protective: `upstream-request:`, `design:`, `project-local`, and the bare `LOCAL-PATCH U-…` form. A marker-loss guard compares marker counts on every delivery path. | §4.3 (E2) |

## 1. Problem statement

The fleet audit confirmed content-losing deliveries in 7 of 16 fleet projects. Four more projects carried pending regressions in the next apply. The audit ranked seven root causes. This design closes them in the engine, so every invocation path inherits the protection. That includes off-cycle targeted deliveries such as workspace PR #1952.

| Root cause (audit §3) | Closed by |
|---|---|
| RC1: the `EVOLVED` row delivers template-unchanged content over project evolution | E1 `EVOLVED_PRESERVE` |
| RC2: first delivery over committed divergence; the A1 marker regex misses field forms; non-guard arms bypass A1 | E2 marker-loss guard on every path; E3 template-vintage provenance |
| RC3: content-losing WARN rows never gate landing | L1 destructive-row acknowledgement at dev-sync 3.9 |
| RC4: version numbers used as content identity | E3 baseline-aware equal-version arm, `PROJECT_AHEAD`; V1 validate-templates CV-02 |
| RC5: no ordering or gate between backport and delivery | G1 engine backport gate; skill changes §4.10 |
| RC6: ownership zones in merged files are too coarse | E2 on MERGE / DOCS_MERGE / ci.yml; E3 `MERGE_DROP` detection; P3 three-way merge |
| RC7: broad `--disposition adopt-template` grants | G1: in enforce, a glob grant does not cover a gate-set path without a per-path ack |

## 2. Evidence that shapes the design

All references are to the working tree.

- **The EVOLVED row is the single deliver-over-evolution cell.** `resolveDisposition` returns `deliver: true` with `EVOLVED` (WARN) when `PROJECT_EVOLVED && !templateChanged` (`scripts/lib/upgrade-policy.ts:1654-1662`). For hash-gated passes, a project-side change alone satisfies the candidate reason: TEMPLATE TREE SYNC `reason = "(content changed)"` (`scripts/upgrade-project.ts:6263-6265`), the VARIANT ASSET DIRS hash gate (`:5632`), and DOCS_OVERWRITE, which runs every upgrade (`:3690-3763`, plus `security.md` at `:7063-7120`). One cell change therefore fixes RC1 for every caller of `evolvedDeliveryGuard` (`:2819-2896`).
- **The agents/ equal-version arm is already baseline-aware.** It restores only baseline-clean files and records CONFLICT (ERROR) for `PROJECT_EVOLVED` (`:4938-4991`). The scripts arm has no such check: equal version with different bytes restores unconditionally (`:4196-4222`). The agents/ arm is the model for E3.
- **Core-locked restore runs in both directions with no guard** (`:4223-4247`). Project-ahead files elsewhere fall into a silent `OK` with no decision row: scripts `:4248-4251`, variant scripts `:4347-4350`, overlay scripts `:4521`, agents `:5034`, skills `:5194-5208` and variant skills `:5446`. The skills `else` branch also runs the additive catch-up when the project is ahead (`:5194-5205`).
- **The A1 marker test misses field forms.** `LOCAL_PATCH_MARKER_RE = /LOCAL-PATCH\(upstream-request:/` (`upgrade-policy.ts:1683`). It does not match `LOCAL-PATCH (design: …)` (co-deck `classic/style.css`), `LOCAL-PATCH(project-local)` (co-work `ci.yml`), or `LOCAL-PATCH U-20261108-002` (co-newbiz). A1 also lives only inside `evolvedDeliveryGuard` (`upgrade-project.ts:2830-2845`).
- **Merged deliveries expose different seams.** `applyCiWorkflowMerge` returns the merged text in `CiMergeResult.content`, in dry-run as well (`scripts/lib/ci-workflow-merge.ts:38-45`, `:517-532`). `mergeWorkspaceManaged` returns only `{ merged, snapshotCount, skeletonLog }` and writes internally (`upgrade-project.ts:2481-2486`, `:2673`). It must expose its result before the write for a guard to run.
- **`templateSha` does not identify the delivered bytes.** The manifest records workspace `HEAD` (`:7966-7968`). PR #1952 delivered from a dirty working tree, so `git show <templateSha>:<path>` can differ from what was written. Base reconstruction for a three-way merge must verify the bytes (§4.9).
- **Template history is a provenance source.** A project file whose bytes equal any historical revision of its template counterpart is untouched template vintage. It carries no project content. The about 162 `DRIFT_RESTORED` rows per project come from the unbumped Biome reformat `cdf316143`. Those project copies are byte-identical to the pre-reformat template blobs.
- **The landing gate reads ERROR only.** dev-sync step 3.9 refuses auto-E5 attribution through `manifestHasUnresolvedErrors` (`scripts/dev-sync.ts:1196-1215`, `upgrade-policy.ts:1758-1763`). co-deck `a736430` landed with 365 WARN and 0 ERROR.
- **The pre-delivery LOCAL-PATCH report suppresses re-application on a "fixed" upstream status** (`upgrade-project.ts:2990-3002`). U-20261105-004 was a false "fixed" record.
- **The manifest writer already carries baselines forward** for paths that were not delivered (`:7873-7890`) and adds A2 parity baselines without touching `files[]` (`:7891-7900`). New baseline sources can reuse that seam.

## 3. Goals and non-goals

**Goals**

1. No delivery replaces project-authored content unless the template changed or a recorded per-path decision allows it.
2. No delivery path lowers the `LOCAL-PATCH` marker count of a file without a recorded grant.
3. Version numbers classify files. Content hashes and provenance decide delivery.
4. Every project-ahead or project-evolved path has a recorded backport verdict before an apply in enforce mode. This holds for off-cycle runs.
5. Every destructive WARN row is acknowledged before an upgrade PR lands.
6. Same-version template content changes fail validation before they reach the fleet.

**Non-goals**

- No change to the tombstone guard (`tombstoneGuard`, D3b semantics stay).
- No change to the agents/ D4 row (`agentsOwnership`); E1 already matches its intent.
- No change to C-A behavior verification or C-E `UNVERSIONED_SKIP`.
- No three-way merge for code (`*.ts`, `*.mjs`). P3 covers docs, yaml, and css only.
- No automatic promotion. The engine records and gates; a human ports content template-side.
- P0 data recovery from audit §6 (DG-DECK-06, the Pretendard block, the co-work CI leg, and others) is a separate work stream. This design depends on it only for the freeze lift (§8).

## 4. Design

### 4.1 Vocabulary

- **Baseline**: the recorded hash of the bytes delivered last time (`DecisionBaseline`, design D1 of the sync-overwrite-policy).
- **Vintage**: the project bytes equal some historical blob of the template counterpart in workspace git history. Vintage is proof that the project did not author the content.
- **Provenance** of a project file: `baseline` (UNTOUCHED against the baseline), `vintage`, or `none`.
- **Gate set**: the paths that need a backport verdict before apply (§4.6).
- **Ack**: one per-path decision entry in the project's `.claude/backport-decisions.json` (§4.5).

### 4.2 E1 — `EVOLVED_PRESERVE` (decision D1, remedy R1)

`resolveDisposition` (`upgrade-policy.ts:1646-1680`) gets the new matrix below. `PROJECT_EVOLVED && !templateChanged` no longer delivers.

| State | templateChanged | Grant (adopt glob or ack) | Verdict | Severity | Delivery |
|---|---|---|---|---|---|
| UNTOUCHED / IN_SYNC | any | — | `UPDATE` (caller row) | INFO | deliver |
| PROJECT_EVOLVED | false | none | **`EVOLVED_PRESERVE`** (new) | WARN | **SKIP**, baseline kept |
| PROJECT_EVOLVED | false | ack `stays-project` | `EVOLVED_PRESERVE` | INFO | SKIP |
| PROJECT_EVOLVED | false | adopt, or ack `adopt` | `ADOPT` | INFO | deliver, re-baseline |
| PROJECT_EVOLVED | false | ack `promoted` | `ADOPT` if the superset check passes, else `CONFLICT` | INFO / ERROR | deliver / SKIP |
| PROJECT_EVOLVED | true | none | `CONFLICT` | ERROR | SKIP (unchanged) |
| PROJECT_EVOLVED | true | ack `stays-project` | `EVOLVED_PRESERVE` ("template change withheld") | WARN | SKIP |
| PROJECT_EVOLVED | true | adopt, or ack `adopt` / `promoted` | as the `false` rows | — | — |

Rules:

- `EVOLVED_PRESERVE` joins `DecisionVerdict` and `DECISION_SEVERITY_CONTRACT` at WARN. The engine overrides it to INFO when a valid `stays-project` ack covers the path.
- The baseline is not refreshed on a preserve. The carry-forward rule at `upgrade-project.ts:7873-7890` already keeps it.
- Every preserved path enters `pendingBackport[]` with kind `EVOLVED_PRESERVE` (§4.5).
- `evolvedDeliveryGuard` prints `PRESERVE (project-evolved, template unchanged)` and returns `false` without calling `onConflictSkip`. The CONFLICT wording does not apply.
- The `agentsOwnership` escalation at `:2850-2880` stays. agents/ keeps CONFLICT (ERROR) for both cells.
- **Superset check** (used by ack `promoted`): every line the project authored must appear in the deliverable. Project-authored lines are the project lines absent from the baseline bytes or, without a baseline, absent from every vintage blob. The check reuses the line-set approach of `spanCarriesProjectAuthoredLines` (`upgrade-policy.ts:2199`). A failed check is a `CONFLICT` whose detail says "promoted claimed, template lacks N project line(s)". This is the automated half of remedy R8. It would have caught the U-20261105-004 false record.

Effect on the audit cases: co-deck #1 (`decisions/gates.yaml`) and #2 (`docs/phase-definitions.md`) are preserved. The four AT-RISK rows (co-abap #20, co-hr #21, co-safety #22, co-newbiz #24) are preserved. The T-20261110-011 re-stale loop ends.

### 4.3 E2 — marker-loss guard on every delivery path (decision D4, remedy R2)

**Pure layer** (`scripts/lib/upgrade-policy.ts`):

- `LOCAL_PATCH_MARKER_RE` becomes `/LOCAL-PATCH\b/`. The A1 resolver keeps its signature. Every form now counts as a marker.
- New `countLocalPatchMarkers(text: string): number` counts `/LOCAL-PATCH\b/g` matches.
- New `markerLoss(projectText: string, afterText: string): { lost: number; before: number; after: number } | null`. It returns non-null when `after < before`.
- New verdict `MARKER_LOSS` at ERROR. It joins the D3.1 ERROR set. The exit summary (`upgrade-project.ts:8345-8421`) lists it under DELIVERY CONFLICTS (preserved).

The count-delta rule handles template prose that mentions the term. A template file that names `LOCAL-PATCH` three times, delivered over a project copy with the same three mentions, loses nothing. A project copy with one extra marker loses one.

**Override**: an adopt grant for the path (glob or ack `adopt`), or an ack `promoted` that passes the superset check. In enforce mode (§4.6) the glob grant alone does not override.

**Engine call sites** (`scripts/upgrade-project.ts`). The guard runs before every write that replaces an existing project file:

| Path | Function / location | "After" text the guard compares |
|---|---|---|
| Version- and hash-gated whole-file deliveries | `evolvedDeliveryGuard` (`:2819`): one check after classification, for every state. This covers all 14 guard call sites. | `deliverableContent` |
| Equal-version restore, scripts | scripts arm (`:4196-4222`) | template bytes |
| Core-locked restore | core-locked arm (`:4223-4247`) | template bytes |
| agents/ equal-version restore | agents/ drift arm (`:4938-5033`) | rendered deliverable |
| Whole skill directory copy | skills arms (`:5149-5190`, variant skills near `:5387`): every file the copy overwrites, not only `SKILL.md` | each template file |
| ci.yml MERGE | `mergeCiWorkflowFile` (`:2698-2727`) | `CiMergeResult.content` |
| DOCS_MERGE and the instruction-file MERGE | `mergeWorkspaceManaged` (`:2481-2673`), refactored to compute the merged text, run the guard, then write | merged text |
| `docs/context.md` region splice | CONTEXT PRESERVE splice (`spliceCommonContextBlock`, `:6306`) and the forced overwrite | spliced or rendered text |
| JSON_MERGE / SCHEMA_MERGE | merge arms (`:6002`, `:6090` regions) | merged JSON text |
| Prune | PRUNE REMOVED (`:7184` onward): deleting a marked file | empty string (all markers lost) |
| Platform skill mirrors | before the post-upgrade `sync-skills.ts` invoke (`:6773`, `:7394`): compare each mirror file with its SSOT source | SSOT source text |

On loss, the engine records `MARKER_LOSS` (ERROR), skips the write, and keeps the project copy. For a merge, the whole merged write is skipped. For the mirror case, the engine passes the affected paths to `sync-skills.ts` as an exclude list. If `sync-skills.ts` has no exclude option, the engine skips the invoke for that run and records one `MARKER_LOSS` row per affected mirror.

**LOCAL-PATCH report** (`:2990-3002`): the advice "re-apply only if the upstream status does not report it fixed" is removed. The report now prints, per marked file, whether the engine will protect it this run (`protected`, `granted`, or `no delivery`). The report tells the operator to confirm that the template contains the patch hunk before granting adopt.

### 4.4 E3 — version is a classifier, not an identity (remedy R3, part of R10)

**New library** `scripts/lib/template-vintage.ts`:

- `loadTemplateBlobHistory(workspaceRoot, roots: string[], since: string): Map<string, Set<string>>` maps a template path to the set of git blob ids it ever held. It uses one spawn per root: `git log --format= --raw --no-abbrev --no-renames --since=<since> -- <root>`. It collects the post-image blob column. `since` defaults to the policy horizon `2026-06-01`. All git spawns go through the `spawnSync` shim (v1.98.1, `gitCleanEnv`).
- `blobIdOf(content: string): string` computes `sha1("blob " + byteLength + "\0" + content)` in-process. It also computes the LF-normalized id, so CRLF checkouts still match.
- `vintageMatch(rel, projectContent, candidateTemplatePaths): boolean` checks both ids against the history of every candidate path. Candidates are `templates/<variant>/<rel>`, then `templates/common/<rel>`, plus the existing skill-mirror and `scripts/` source-root mappings.
- Vintage applies only to raw-bytes passes. Rendered or merged deliverables (`docs/context.md`, MERGE, JSON_MERGE) are excluded, the same bound as A2.

**Classification** (`classifyCandidate`, `upgrade-project.ts:2795`): when the state is `NO_BASELINE` and the copy differs from the deliverable, the engine runs `vintageMatch`. A match is reported as provenance `vintage` and treated like `UNTOUCHED`.

**Equal-version arm, scripts and variant scripts** (`:4196-4222`): the arm gets the agents/ logic through a new pure resolver `resolveEqualVersionDisposition(cls, provenance, grant)` in `upgrade-policy.ts`.

| Provenance | Grant | Verdict | Severity | Delivery |
|---|---|---|---|---|
| `baseline` (UNTOUCHED) or `vintage` | — | `DRIFT_RESTORED` | **INFO** (override) | restore |
| `none`, PROJECT_EVOLVED | none | `CONFLICT` | ERROR | SKIP |
| `none`, NO_BASELINE, no vintage match | none | `CONFLICT` | ERROR | SKIP |
| `none` | adopt, or ack `adopt` / `promoted` | `ADOPT` | INFO | restore |

The INFO override is the suppress rule for the `cdf316143` noise. A provenance-proven restore destroys no project content, so it is not worth a WARN. co-work #11 (an equal-version fork of `skill-lifecycle-audit.ts`) becomes a CONFLICT. The VARIANT SCRIPTS walk (`:4347`) gets the same arm for versioned `.ts` and `.mjs`. That answers Q3 of the T-009 design: variant content restores only on proven provenance.

**Core-locked arm** (`:4223-4247`): the restore stays in both directions, per AGENTS.md. E2 marker loss still applies. A marked core-locked fork becomes `MARKER_LOSS` (ERROR), which surfaces co-design-style project gates instead of erasing them.

**`PROJECT_AHEAD`** (new verdict, WARN): when the project version is greater than the template version, the engine records `PROJECT_AHEAD`, never delivers, and adds the path to `pendingBackport[]`. Sites: the six silent `OK` arms listed in §2, and TEMPLATE TREE SYNC when the inline version of the project is greater (`:6258-6262`, today a silent `reason === ""`). In the skills arms, the additive catch-up still runs. The catch-up row is followed by the `PROJECT_AHEAD` row. Core-locked scripts are excluded; they keep the restore. An ack `stays-project` lowers the row to INFO.

**`UNBASELINED_OVERWRITE`** (A1, unchanged severity): a vintage match turns the row into a plain `ADOPT` (INFO). A non-vintage, unmarked divergence keeps the WARN row and enters `pendingBackport[]` with kind `UNBASELINED`. In enforce mode the gate then requires an ack. This answers Q1 of the T-009 design without escalating every legacy file to ERROR.

**Vintage baselines**: at manifest write in apply mode, every path observed with provenance `vintage` gets a baseline with `provenance: "vintage"`. It uses the A2 seam (`:7891-7900`) and never enters `files[]`. The first apply after Phase 1 therefore re-baselines the fleet by itself (§8).

**`MERGE_DROP` detection** (ci.yml and DOCS_MERGE): after the merge, the engine counts project-authored lines that the merged text drops. A line counts when it is present in the project copy, absent from the merged text, absent from the current template, and absent from every vintage blob of the path. A positive count overrides the `MERGE` row to WARN with detail "N project-authored line(s) dropped outside the project region". It is a destructive row for L1 (§4.7). It is not an ERROR, because legitimate template restructuring drops lines too. Marked lines are already covered by E2. co-work #10 is caught by E2 (its leg carried `LOCAL-PATCH(project-local)`). An unmarked equivalent is caught here.

### 4.5 E4 — data model

All changes are additive. `schemaVersion` stays `2`. Older readers ignore the new keys.

**`DeliveryManifestV2`** (`upgrade-policy.ts:1545-1558`) gains:

```ts
pendingBackport?: PendingBackportEntry[];
templateDirty?: boolean;          // workspace templates/ had uncommitted changes at delivery
engineVersion?: string;           // upgrade-project.ts @version
backportGate?: { mode: "off" | "shadow" | "enforce"; ackFile?: string; ackDigest?: string; override?: string };

interface PendingBackportEntry {
  path: string;
  kind: "PROJECT_AHEAD" | "EVOLVED_PRESERVE" | "UNBASELINED" | "MARKER_LOSS" | "CONFLICT";
  projectHash: string;            // baselineKeyFor(rel, projectBytes)
  deliverableHash?: string;       // baselineKeyFor(rel, deliverable), when a deliverable exists
  projectVersion?: string;
  templateVersion?: string;
  firstSeen: string;              // ISO date, carried forward while the path stays pending
  firstSeenTemplateVersion: string;
  ack?: { verdict: AckVerdict; ref?: string };
}
```

Writer rule: the engine recomputes `pendingBackport` on every apply. `firstSeen` carries forward from the prior manifest when the path is still pending. A path leaves the list when it is no longer in the gate set. Dry runs print the list and persist nothing. The exit summary prints a `PENDING BACKPORT` block.

**`DecisionBaseline`** (`:1520-1523`) gains optional `provenance?: "delivered" | "parity" | "vintage"` and optional `blob?: string` (git blob id of the delivered bytes, used by P3). Missing `provenance` means `delivered`.

**`DeliveryDecision`** (`:1507-1516`) gains optional `grant?: "adopt-template" | "backport-ack"`. L1 and audits can then find granted overwrites without parsing `detail`.

**New verdicts**: `EVOLVED_PRESERVE` (WARN), `PROJECT_AHEAD` (WARN), `MARKER_LOSS` (ERROR), `BACKPORT_UNACKED` (WARN in shadow, ERROR in enforce, set by override), `GATE_OVERRIDE` (WARN). P3 later adds `MERGED_3WAY` (WARN).

**Ack file**: `.claude/backport-decisions.json` in the project. It is committed, because it is evidence.

```ts
type AckVerdict = "promoted" | "stays-project" | "adopt";
interface BackportAckFile {
  schemaVersion: 1;
  decisions: Record<string, {
    verdict: AckVerdict;
    reason: string;            // at least 20 characters, not a placeholder
    ref?: string;              // required for "promoted": U-id, PR number/URL, or template commit
    projectHash: string;       // must equal the current baselineKeyFor(rel, projectBytes)
    deliverableHash?: string;  // required for kind CONFLICT: must equal today's deliverable key
    recordedAt: string;        // ISO date
    recordedBy: string;        // operator or agent label
  }>;
}
```

The hash binding is the propose-then-confirm pattern of the `decision-write-integrity` skill. An ack goes stale when the project file changes. For kind CONFLICT it also goes stale when the template deliverable changes. A stale ack does not count. `--backport-ack <path>` names a different file. The default is `.claude/backport-decisions.json`.

### 4.6 G1 — backport gate (decision D2, remedy R4)

**Mode selection**, in precedence order: CLI `--backport-gate=off|shadow|enforce`, then env `UPGRADE_BACKPORT_GATE`, then the compiled default for the current phase (§5).

**Gate set**: every path whose classification this run yields one of:
`PROJECT_AHEAD`, `EVOLVED_PRESERVE`, non-vintage `UNBASELINED`, `MARKER_LOSS`, or a `PROJECT_EVOLVED` `CONFLICT`. Paths in the prior manifest's `pendingBackport[]` stay in the gate set while their `projectHash` is unchanged.

A path is **satisfied** when the ack file holds a fresh entry for it (§4.5 binding) with a valid verdict, reason, and (for `promoted`) `ref`.

**Pre-flight** (apply mode, mode ≠ off). The pre-flight runs after the fleet-membership and tenant guards and **before** the pre-upgrade stash (`:2193`). Nothing is written before it.

1. The engine spawns itself: `bun scripts/upgrade-project.ts <project> --dry-run --gate-preflight-out <tmp.json>`, with env `UPGRADE_GATE_PREFLIGHT=1`. That env value prevents recursion and suppresses child output and post-run invokes.
2. The child writes the gate set and each path's hashes to `<tmp.json>`.
3. The parent validates the ack file against the gate set.
4. **enforce**: any unsatisfied path refuses the run. The engine prints a `BACKPORT GATE` table (path, kind, versions, reason for refusal) and exits with code **3**. It writes nothing. `--emit-backport-ack-template <path>` writes a fill-in file with the hashes pre-populated and empty verdicts.
5. **shadow**: the run proceeds. Each unsatisfied path records `BACKPORT_UNACKED` (WARN). The summary prints "the gate would have refused N path(s)".

An optional optimization: a dry run may write `.claude/upgrade-gate-set.json`, bound to the template tree digest, project `HEAD`, and the working-tree diff hash. Apply may reuse it when all three still match. Otherwise apply runs the pre-flight child. Reuse never replaces validation.

**In-pass enforcement** (belt and braces). In enforce mode, a pass that meets an unsatisfied gate-set path preserves the project copy and records `BACKPORT_UNACKED` at ERROR. This covers a file that changed between the pre-flight and the pass.

**Ack effects in the passes**:

| Ack verdict | Effect |
|---|---|
| `adopt` | Per-path adopt grant. It overrides CONFLICT, `EVOLVED_PRESERVE`, `MARKER_LOSS`, and equal-version CONFLICT. For `PROJECT_AHEAD` it permits a version-lowering delivery and records the regression in the detail. Rows carry `grant: "backport-ack"`. |
| `stays-project` | Preserve. The row severity drops to INFO, except a withheld template change (CONFLICT kind), which stays WARN. |
| `promoted` | Deliver as ADOPT only when the superset check (§4.2) passes. Otherwise `CONFLICT` (ERROR). For `PROJECT_AHEAD` with a lower template version, nothing is delivered; the ack keeps the path satisfied until the template catches up. |

**Glob grants in enforce** (RC7): `--disposition adopt-template[=glob]` does not grant a gate-set path that lacks an ack. The engine prints which glob matches were ignored. Paths outside the gate set keep today's glob semantics.

**Off-cycle coverage**: the gate lives in the engine entry point. The `upgrade-project` skill, `project-resync` Step 4, a targeted delivery like PR #1952, the tenant gateway, and a hand-typed CLI run all pass through it.

**Override**: `--backport-gate=off` given on the CLI while the phase default is enforce requires `--backport-gate-override-reason "<text>"` (at least 20 characters). The run records one `GATE_OVERRIDE` (WARN) row and the reason in `manifest.backportGate.override`. L1 treats that row as destructive, so the override needs an acknowledgement before landing.

**Tenant targets**: a registered tenant (v1.97.0 guard) defaults to shadow even in Phase 3, until the gateway offers an ack flow. This is listed under risks (§12).

### 4.7 L1 — destructive-row acknowledgement at landing (remedy R5, dev-sync 3.9)

**Pure layer** (`upgrade-policy.ts`): new `destructiveDecisions(decisions)` returns the rows that can destroy project content and were not already acknowledged by a backport ack:

- `UNBASELINED_OVERWRITE` (WARN)
- `DRIFT_RESTORED` at WARN (after E3 only the agents/ NO_BASELINE migration-window row remains)
- `MERGE` at WARN (snapshot replace or `MERGE_DROP`)
- `DELETE`
- `CONFLICT` at WARN (uncommitted local edits overwritten)
- `ADOPT` with `grant: "adopt-template"` and no backport ack
- `BACKPORT_UNACKED` (shadow) and `GATE_OVERRIDE`

New `manifestDestructiveUnacked(manifest, ack)` returns the rows that the landing ack does not cover.

**Landing ack file**: `.claude/upgrade-landing-ack.json` in the project:

```ts
interface UpgradeLandingAck {
  schemaVersion: 1;
  manifestDigest: string;   // sha256 of the manifest's canonical decisions array
  acks: Array<{ path: string; verdict: string; reason: string }>;
}
```

**Engine side**: the PR body composer (`upgrade-project.ts:7975` onward) adds a `### Destructive dispositions` section. It lists every destructive row as a checklist item. `--emit-landing-ack-template <path>` writes a pre-filled file with the digest.

**dev-sync side** (`scripts/dev-sync.ts` step 3.9, `:1196-1215`): when `isDeliveredDiff` holds, the step now checks two things. The existing check refuses unresolved ERROR rows. The new check refuses unacknowledged destructive rows. Mode comes from env `SYNC_DESTRUCTIVE_ACK=off|shadow|enforce`; shadow prints the list and proceeds. The refusal uses the same path as the ERROR refusal (auto-E5 is refused, so the spec check fails).

dev-sync is a core-locked delivered script. The new step reaches a project only after an upgrade delivers the new dev-sync. The first upgrade that delivers it still lands under the old step. This is accepted (§12).

### 4.8 V1 — validate-templates CV-02 `same-version-content-change` (remedy R10)

New blocking check in `scripts/validate-templates.ts` (next to CV-01 at `:3049`):

- **Universe**: changed files under `templates/**` that carry a version: `.ts` and `.mjs` with `@version`, `SKILL.md` and `agents/*.md` with frontmatter `version`, and docs with an inline version footer (the `extractInlineVersion` form used by TEMPLATE TREE SYNC).
- **Base**: env `CV02_BASE` when set, else `git merge-base HEAD origin/main`, else `HEAD`.
- **Rule**: the bytes differ from the base AND the version string is equal → ERROR naming the file and both versions.
- **No exemption.** Format sweeps bump the patch version. `cdf316143` already landed. CV-02 prevents a recurrence; E3 handles the existing noise.
- Untracked new files and deleted files are out of scope.

### 4.9 P3 — three-way merge for docs, yaml, and css (remedy R6, later phase)

Scope: the hash-gated passes (TEMPLATE TREE SYNC, VARIANT ASSET DIRS, DOCS_OVERWRITE) for `docs/**/*.md`, `decisions/**/*.yaml`, `*.yaml`, `*.yml` outside `.github/workflows/`, and `*.css`. Trigger: `PROJECT_EVOLVED && templateChanged` without a grant, which is a CONFLICT today.

1. **Base**: from Phase 1 on, every delivered baseline records `blob`. P3 reads the base with `git cat-file -p <blob>` in the workspace repo. The blob exists when the delivered bytes were committed at some point in template history. When `templateDirty` was true or the blob is missing, no base exists and the row stays CONFLICT.
2. **Merge**: `git merge-file -p <project> <base> <template>` in a temp directory, through the `spawnSync` shim.
3. **Clean merge**: E2 runs on the merged text. A pass records `MERGED_3WAY` (WARN, destructive for L1) and writes the merged bytes. The baseline becomes the template deliverable key, not the merged key, so the next run classifies the project as PROJECT_EVOLVED against the new template. The project content stays protected.
4. **Conflicted merge**: CONFLICT (ERROR), unchanged.
5. **Flag**: env `UPGRADE_THREE_WAY=off|on`, default `off` until the co-deck canary passes.

### 4.10 Skill changes

**`skills/upgrade-project/SKILL.md` 1.6.2 → 1.7.0**

- Step 2 (dry run): read the decision summary and every `CONFLICT`, `EVOLVED_PRESERVE`, `MARKER_LOSS`, `UNBASELINED_OVERWRITE`, `DRIFT_RESTORED` (WARN), `PROJECT_AHEAD`, and `BACKPORT_UNACKED` row. Read the `PENDING BACKPORT` block.
- New step before apply: record a backport verdict for every gate-set path in `.claude/backport-decisions.json`. Use `--emit-backport-ack-template`. Port content template-side first when the verdict is `promoted`.
- Document `--disposition adopt-template[=glob]` as a reviewed per-path grant. Never grant it on a path with `MARKER_LOSS` unless the template carries the patch hunk.
- Document exit code 3 (gate refusal, nothing written) and the override flag.
- Step 5 (review): review the manifest decisions and fill `.claude/upgrade-landing-ack.json`. Do not rely on `git diff` alone.

**`skills/project-resync/SKILL.md` 1.8.0 → 1.9.0**

- Step 2: mandatory inputs per project are `upgrade-project --dry-run`, `fleet-script-parity`, and `backport-diff`. Every gate-set path gets a verdict: promoted, stays-project, or adopt.
- Step 2d: before acting on a "fixed" upstream record, confirm the template contains the patch hunk. The `promoted` superset check automates this at apply time.
- Step 4: apply only after the project's ack file covers the gate set. The engine enforces this in Phase 3.
- New rule: an off-cycle targeted delivery runs Step 2 for the affected project first. The engine gate is the backstop.
- Step 5: the upgrade PR includes the landing ack.

Both skills are root-only. Their platform mirrors (`.claude/`, `.gemini/`, `.codex/`, `.agents/`, `.hermes/` skill directories) are regenerated by `sync-skills.ts`.

## 5. Rollout phases and feature flags

| Phase | Trigger to enter | Engine defaults | Fleet effect |
|---|---|---|---|
| 0 — Freeze (now) | DEC-20261111-01 | unchanged | No apply on co-deck, co-abap, co-hr, co-safety, co-newbiz. Dry runs allowed. Other projects apply only with per-path `--disposition` review of `EVOLVED` rows. |
| 1 — Protection | PR-A and PR-B merged; fleet dry-run sweep reviewed | E1, E2, E3, E4 always on. `UPGRADE_BACKPORT_GATE=off`. `pendingBackport` recorded. | Freeze lifts after the co-deck canary (§8). Vintage baselines accrue on each apply. |
| 2 — Shadow | PR-C, PR-F, PR-E merged | `UPGRADE_BACKPORT_GATE=shadow`, `SYNC_DESTRUCTIVE_ACK=shadow` | `BACKPORT_UNACKED` rows show what enforce would refuse. Projects commit ack files. |
| 3 — Enforce | Shadow exit criteria met; PR-G merged | `UPGRADE_BACKPORT_GATE=enforce`, `SYNC_DESTRUCTIVE_ACK=enforce` (tenants stay shadow) | Apply refuses unsatisfied gate sets with exit 3. Landing refuses unacknowledged destructive rows. |
| 4 — Three-way | PR-H merged; co-deck canary passes | `UPGRADE_THREE_WAY=on` | Docs/yaml/css CONFLICTs merge automatically when clean. |

**Shadow exit criteria** (all required):

1. One full `project-resync` cycle over all 16 fleet members has run in shadow, or two weeks have passed, whichever is later.
2. Every fleet project has a committed `.claude/backport-decisions.json` that satisfies its current gate set.
3. Every `BACKPORT_UNACKED` row seen in shadow is explained: a real pending port, or a classifier defect with a fix ticket.
4. No unexplained `MARKER_LOSS` or `PROJECT_AHEAD` false positive remains open.

E1–E4 have no feature flag. Decision D1 is final, and a flag would be a silent bypass. Rollback is `git revert` of the PR (§11).

## 6. Engine touchpoints

| File | Function / location | Change | PR |
|---|---|---|---|
| `scripts/lib/upgrade-policy.ts` | `DecisionVerdict`, `DECISION_SEVERITY_CONTRACT` (`:1439-1504`) | add `EVOLVED_PRESERVE`, `MARKER_LOSS` (A); `PROJECT_AHEAD` (B); `BACKPORT_UNACKED`, `GATE_OVERRIDE` (C); `MERGED_3WAY` (H) | A/B/C/H |
| same | `resolveDisposition` (`:1646-1680`) | E1 matrix; optional ack input | A, C |
| same | `LOCAL_PATCH_MARKER_RE` (`:1683`); new `countLocalPatchMarkers`, `markerLoss` | E2 | A |
| same | new `supersetCheck(projectText, baseTexts, deliverable)` | E1 `promoted` | A |
| same | new `resolveEqualVersionDisposition` | E3 | B |
| same | `DeliveryManifestV2`, `DecisionBaseline`, `DeliveryDecision` (`:1507-1558`); new `PendingBackportEntry`, `BackportAckFile`, `UpgradeLandingAck` | E4 | B, C, E |
| same | new `validateBackportAcks(gateSet, ackFile, currentHashes)` | G1 | C |
| same | new `destructiveDecisions`, `manifestDestructiveUnacked` | L1 | E |
| `scripts/lib/template-vintage.ts` (new) | `loadTemplateBlobHistory`, `blobIdOf`, `vintageMatch` | E3 | B |
| `scripts/upgrade-project.ts` | `evolvedDeliveryGuard` (`:2819-2896`) | E1 preserve branch; E2 check for every state; G1 in-pass enforcement | A, C |
| same | `classifyCandidate` (`:2795`) | vintage provenance | B |
| same | scripts arm (`:4196-4251`), variant scripts (`:4285-4350`), overlay (`:4443-4521`) | E3 equal-version resolver; E2 at core-locked; `PROJECT_AHEAD` in `OK` arms | A (E2), B |
| same | agents arm (`:4883-5035`); skills arms (`:5149-5215`, `:5387-5450`) | E2 on drift restore and every overwritten skill file; `PROJECT_AHEAD` | A, B |
| same | `mergeCiWorkflowFile` (`:2698-2727`); `mergeWorkspaceManaged` (`:2481-2673`) | compute → guard → write refactor; E2; `MERGE_DROP` | A (E2), B (`MERGE_DROP`) |
| same | TEMPLATE TREE SYNC (`:6258-6400`), VARIANT ASSET DIRS (`:5632-5680`), DOCS_OVERWRITE (`:3690-3763`, `:7063-7120`), JSON/SCHEMA merges | E1 via the guard; E2; inline-version `PROJECT_AHEAD`; P3 hook | A, B, H |
| same | PRUNE REMOVED (`:7184` onward); `sync-skills.ts` invoke (`:6773`, `:7394`) | E2 | A |
| same | LOCAL-PATCH report (`:2990-3002`) | §4.3 wording | A |
| same | entry point, before the stash (`:2193`) | G1 pre-flight child, ack validation, exit 3, template emitter, override | C |
| same | manifest writer (`:7873-7973`) | vintage baselines, `pendingBackport`, `templateDirty`, `engineVersion`, `backportGate`, `blob` | B, C |
| same | PR body composer (`:7975` onward); exit summary (`:8345-8421`) | `PENDING BACKPORT`, `BACKPORT GATE`, destructive section, landing-ack emitter | B, C, E |
| `scripts/dev-sync.ts` | step 3.9 (`:1196-1215`) | L1 destructive-row check | E |
| `scripts/validate-templates.ts` | new CV-02 near CV-01 (`:3049`) | V1 | D |
| `scripts/sync-skills.ts` | exclude-list option, only if absent | E2 mirror case | A |
| `skills/upgrade-project/SKILL.md`, `skills/project-resync/SKILL.md` | §4.10 | skill procedure | F |

Version bumps follow the script-lifecycle rules. The expected sequence after PR1/PR3/PR4 is `upgrade-project.ts` 1.101.0 (A), 1.102.0 (B), 1.103.0 (C), 1.104.0 (E), 1.105.0 (G), 1.106.0 (H); `upgrade-policy.ts` 1.41.0 onward in step; `validate-templates.ts` 1.78.0; `dev-sync.ts` 1.47.0. The implementer takes the next free numbers at landing time.

## 7. Test plan

**Unit, pure layer** (`tests/unit/upgrade-policy-decisions.test.ts`, `tests/unit/upgrade-policy.test.ts`):

- Every cell of the E1 matrix (§4.2), including all three ack verdicts and the superset pass/fail cases.
- `countLocalPatchMarkers` on the four field forms; `markerLoss` count-delta, including template prose mentions.
- `resolveEqualVersionDisposition`: every cell of the E3 table.
- `validateBackportAcks`: fresh, stale project hash, stale deliverable hash (CONFLICT kind), short reason, missing `ref` on `promoted`, unknown verdict.
- `destructiveDecisions` and `manifestDestructiveUnacked`, including digest mismatch.
- New `tests/unit/template-vintage.test.ts`: blob id parity with `git hash-object`, CRLF-normalized match, multi-root lookup, a horizon bound.

**Engine replay fixtures** (`tests/unit/upgrade-decision-log.test.ts` and a new `tests/unit/upgrade-overwrite-protection.test.ts`), each a temp project plus a temp template history:

1. co-deck `decisions/gates.yaml`: project adds a gate, template unchanged → `EVOLVED_PRESERVE`, bytes unchanged, baseline kept, path in `pendingBackport`.
2. co-deck `docs/phase-definitions.md` via DOCS_OVERWRITE → same as 1.
3. co-deck `styles/classic/style.css`, NO_BASELINE, marker `LOCAL-PATCH (design: …)` → `CONFLICT` (A1 with the broadened regex), no write.
4. co-work `ci.yml`: a `LOCAL-PATCH(project-local)` step inside a template-owned job → `MARKER_LOSS`, merged write skipped. The unmarked variant → `MERGE` at WARN with `MERGE_DROP` detail.
5. co-work equal-version fork of a script (no vintage match) → `CONFLICT`. Same file at a vintage blob → `DRIFT_RESTORED` at INFO plus a vintage baseline after apply.
6. A `cdf316143`-like reformat across 20 scripts at an unchanged version → 20 INFO rows, 0 WARN.
7. co-newbiz `delete-merged-branches.yml` re-stale loop → `EVOLVED_PRESERVE`; a second run → same verdict, no delivery.
8. co-game agents/ project-ahead → `PROJECT_AHEAD` row and `pendingBackport` entry. Skills project-ahead → catch-up row plus `PROJECT_AHEAD` row.
9. Core-locked fork with a marker → `MARKER_LOSS`; without a marker → `DRIFT_RESTORED`, as today.
10. Prune of a marked file → `MARKER_LOSS`, file kept.
11. Gate modes: off (no pre-flight spawn); shadow (`BACKPORT_UNACKED` WARN, delivery proceeds); enforce (exit 3, no stash, no write, project tree byte-identical); enforce with a fresh ack (proceeds); enforce with a stale ack (exit 3); glob grant ignored on an unacked gate-set path.
12. Off-cycle path: a direct CLI apply with no skill wrapper in enforce → exit 3. This is the PR #1952 replay.
13. `promoted` ack with a template that lacks a project line → `CONFLICT`; with the line present → `ADOPT`.
14. Override flag: `GATE_OVERRIDE` row and the reason in the manifest.
15. The manifest round trip: an older engine parses a manifest with the new keys (additive tolerance).

**dev-sync**: a new `tests/unit/dev-sync-destructive-ack.test.ts` covers the step 3.9 check in off, shadow, and enforce, plus a digest mismatch.

**validate-templates**: a new `tests/unit/validate-templates-same-version-change.test.ts` covers a seeded same-version byte change (fail), a bumped version (pass), an untracked file (ignored), and the current tree (pass).

**Regression suites to keep green**: `upgrade-versions`, `upgrade-tree-sync`, `upgrade-restamp`, `upgrade-prune-order`, `upgrade-prune-removed`, `upgrade-delivered-diff`, `upgrade-skill-subfile-sync`, `upgrade-stub-composed`, `upgrade-instruction-census`, `upgrade-post-delivery-verify`, `upgrade-project-tenant-guard`, `ci-workflow-merge`, `managed-block-merge`, `scaffold-delivery-parity`, `fleet-script-parity`. Run `bun run test:unit` before `/sync` (version bumps).

**Fleet dry-run sweep** (before and after each of PR-A, PR-B, PR-C), with git state recorded before and after per project, as in audit §0(e). Permitted deltas:

- PR-A: `EVOLVED` rows become `EVOLVED_PRESERVE` (delivered set shrinks by exactly those paths); new `MARKER_LOSS` rows only on marked files; no other change to the delivered set.
- PR-B: `DRIFT_RESTORED` WARN rows become INFO where vintage-proven; unproven equal-version forks become `CONFLICT`; new `PROJECT_AHEAD` rows match the audit §1.2 list (plus anything new since).
- PR-C: in shadow, new `BACKPORT_UNACKED` rows only.

**E2E**: `simulate-pipeline` smoke after PR-A and PR-C; the co-deck canary apply after PR-B (§8).

## 8. Fleet migration

1. **P0 recovery first.** The audit §6 P0 restorations and template-side ports land before any frozen project applies. Otherwise E1 preserves the current (already damaged) project state as "project-evolved" and the lost content stays lost.
2. **Sweep.** After PR-A and PR-B, run the dry-run sweep. Classify every `CONFLICT`, `MARKER_LOSS`, `PROJECT_AHEAD`, and `EVOLVED_PRESERVE` row per project.
3. **Re-baselining.** No manual baseline reset. The first apply records vintage baselines for every vintage-proven file (§4.4). It also delivers the `cdf316143` reformat once, at INFO. A one-time blind reset was rejected: it could launder genuine forks such as co-work #11 into baselines.
4. **Stale markers.** The U-20261006-006 / -007 markers in co-develop, co-learning, and co-security will raise `MARKER_LOSS` once the template changes those files. Each project removes the stale marker or records ack `adopt`.
5. **Canary.** co-deck applies first. It has the largest marker population (62 markers) and the live NO_BASELINE set. The run needs zero unexplained rows and a clean C-A verification.
6. **Freeze lift.** co-abap, co-hr, co-safety, and co-newbiz apply after the canary, each with its sweep rows reviewed. The PM records the lift in the memory log.
7. **Ack seeding (Phase 2).** Each project commits `.claude/backport-decisions.json` covering its gate set. The audit §1.2 project-ahead list is the starting inventory. These are project PRs run by each project PM.
8. **Enforce (Phase 3).** PR-G flips the defaults after the shadow exit criteria (§5).

## 9. Interplay with the open PRs

PR1, PR3, and PR4, as numbered in the PM's landing plan, carry the T-009/T-012 engine work: `upgrade-project.ts` v1.99.0 / v1.100.0, `upgrade-policy.ts` v1.39.0 / v1.40.0, `validate-templates.ts` v1.77.0 (CV-01), `audit.ts` v2.66.0, `scripts/lib/post-delivery-verify.ts`, and `scripts/lib/hermetic-test-roots.ts`.

- All new work lands **after** those three merge, on a branch cut from the updated `main`.
- E2 extends A1 (`resolveUnbaselinedDisposition`) and E3 extends A2 (`noteParity`, the parity baseline seam). Both depend on the A-scope code.
- C-A post-delivery verification compares pre- and post-delivery bytes. E1 shrinks the delivered set, so C-A runs fewer tests. No interface change is needed.
- CV-02 sits next to CV-01 and reuses its file walk.
- The fleet sweep that PR4 needs (§5.4 of the T-009 design) becomes the "before" baseline for PR-A's sweep.
- The CLAUDE.md sequential-branch rule applies: one open PR at a time from this stream.

## 10. Ticket breakdown (proposed; the PM creates the tickets)

All PRs are workspace-root PRs. No `templates/` PR is needed. L1 script copies refresh through the `/sync` publish step. Project-side work (ack files, stale markers) is a separate project PR per project.

| Order | PR | Ticket scope | Size | Depends on |
|---|---|---|---|---|
| 0 | — | Land PR1, PR3, PR4 (existing T-009/T-012 tickets) | — | — |
| 1 | PR-D | V1: CV-02 `same-version-content-change` in `validate-templates.ts` + test | S | 0 |
| 2 | PR-A | E1 `EVOLVED_PRESERVE` + superset check; E2 marker-loss guard on every path (incl. the `mergeWorkspaceManaged` refactor, prune, mirrors); LOCAL-PATCH report wording; unit + replay fixtures 1–4, 7, 9, 10 | M | 0 |
| 3 | PR-B | E3 `template-vintage.ts`, equal-version resolver, `PROJECT_AHEAD`, `MERGE_DROP`; E4 manifest fields (`pendingBackport`, `templateDirty`, `engineVersion`, `provenance`, `blob`, `grant`); replay fixtures 5, 6, 8, 15 | L | PR-A |
| 4 | — | Migration I: sweep, P0 dependency check, co-deck canary, freeze lift for the other four (runbook, no code) | M | PR-B, P0 recovery |
| 5 | PR-C | G1 gate: modes, pre-flight child, ack validation, exit 3, template emitter, in-pass enforcement, glob restriction, override; default shadow; fixtures 11–14 | L | PR-B |
| 6 | PR-F | `upgrade-project` skill 1.7.0 and `project-resync` skill 1.9.0 (§4.10) + lifecycle docs | S | PR-C |
| 7 | PR-E | L1: `destructiveDecisions`, PR-body section, landing-ack emitter, dev-sync 3.9 check (shadow) + test | M | PR-C |
| 8 | — | Migration II: ack seeding across 16 projects (project PRs), shadow window | M | PR-F, PR-E |
| 9 | PR-G | Flip `UPGRADE_BACKPORT_GATE` and `SYNC_DESTRUCTIVE_ACK` defaults to enforce (tenants stay shadow) | S | shadow exit criteria |
| 10 | PR-H | P3 three-way merge behind `UPGRADE_THREE_WAY` + canary | L | PR-G |

PR-D has no dependency on PR-A and may land first or in any gap. PR-A and PR-B together end the Phase 0 freeze. PR-A alone does not: the equal-version restore still runs unguarded until PR-B.

## 11. Platform impact and rollback

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | Skill procedure changes (`upgrade-project` 1.7.0, `project-resync` 1.9.0). No hook, command, or agent change. | `skills/upgrade-project/SKILL.md`, `skills/project-resync/SKILL.md`, their `.claude/skills/` mirrors (regenerated) |
| Antigravity (GEMINI.md) | Same skill changes through the `.gemini/skills/` mirrors. No GEMINI.md change: the engine flags are documented in the skills, which every surface reads. | `.gemini/skills/upgrade-project/`, `.gemini/skills/project-resync/` (regenerated) |
| Codex, Hermes, `.agents` surfaces | Same as Antigravity, through their mirrors. | regenerated mirrors only |
| templates/common | L1 copies of `upgrade-policy.ts`, `dev-sync.ts`, `validate-templates.ts` refresh through the `/sync` publish. No template content change. | `templates/common/scripts/lib/upgrade-policy.ts`, `templates/common/scripts/dev-sync.ts`, `templates/common/scripts/validate-templates.ts` |

**Rollback**: `git revert` per PR. Manifests stay `schemaVersion: 2`; the new keys are optional, so a reverted engine reads them and ignores them. A reverted PR-A restores the pre-change EVOLVED delivery. That is less protection, not corruption. Ack files and landing-ack files are inert for a reverted engine. Vintage baselines stay valid baselines for any engine version.

## 12. Open risks

1. **Gate friction.** Every project-evolved file gates every apply until it has an ack. The hash binding means any project edit re-opens the gate. Mitigation: E1 and E3 make preserve the default, so unacked paths are protected even in enforce; the gate only blocks the run, not the data. The template emitter keeps acking mechanical.
2. **Preserve hides template fixes.** `EVOLVED_PRESERVE` means a security or correctness fix in a template file never reaches a project that edited that file, unless someone acts. Mitigation: `pendingBackport` keeps `firstSeen` and the exit summary prints the age. A follow-up could escalate entries older than one release to ERROR.
3. **Vintage false negatives.** CRLF conversion, BOMs, or history before the horizon can hide a true vintage match. The result is a CONFLICT instead of an INFO restore, which errs on the safe side. The lookup does not follow renames. A renamed template path loses its older blobs. Rename following is added only if the sweep shows misses.
4. **Vintage cost.** One `git log --raw` per template root per run. The sweep measures it; caching per `templateSha` is a fallback.
5. **Pre-flight doubles runtime.** The child dry run walks every pass. The gate-set reuse optimization (§4.6) reduces it when the operator ran a dry run first, which the skill requires anyway.
6. **dev-sync bootstrap.** The new step 3.9 check reaches a project only after an upgrade delivers it. The first such upgrade lands under the old check.
7. **Tenant targets.** The gateway has no ack flow. Tenants stay in shadow. Gateway-driven tenant upgrades therefore keep the weaker landing guarantee until the gateway gains an ack flow (a separate ticket).
8. **Marker count is coarse.** Moving a marker inside a file, or replacing one marker with another, keeps the count equal and passes. Counting per marker id would close this. It is deferred until the sweep shows a case.
9. **`MERGE_DROP` noise.** Template restructurings of ci.yml or instruction files will produce WARN rows that need landing acks. Volume is unknown until the PR-B sweep.
10. **Concurrent sessions.** The audit saw co-newbiz edited during the sweep. Hash-bound acks make this safe (stale acks fail), but the operator may see repeated refusals while another session edits the project.

## 13. Acceptance criteria

- [ ] E1: a project-only change to a template-tracked file is preserved by every hash-gated and version-gated pass, with an `EVOLVED_PRESERVE` row and a `pendingBackport` entry. Replay fixtures 1, 2, and 7 pass.
- [ ] E2: no delivery path lowers the marker count of a file without a grant. Replay fixtures 3, 4, 9, and 10 pass. The four marker forms are counted.
- [ ] E3: an equal-version restore happens only for UNTOUCHED or vintage-proven files, at INFO. Unproven forks are `CONFLICT`. Project-ahead files record `PROJECT_AHEAD`. Replay fixtures 5, 6, and 8 pass.
- [ ] E4: manifests written by the new engine carry the new keys. An older engine reads them. `files[]` is unchanged by vintage baselines.
- [ ] G1: in enforce, an apply with an unsatisfied gate set exits 3 and leaves the project tree byte-identical. This holds for a direct CLI run without the skill. Replay fixtures 11–14 pass.
- [ ] L1: dev-sync 3.9 in enforce refuses an upgrade diff with an unacknowledged destructive row.
- [ ] V1: `bun scripts/validate-templates.ts` fails on a seeded same-version byte change and passes on the current tree.
- [ ] Skills: `upgrade-project` 1.7.0 and `project-resync` 1.9.0 document the dry-run review, the ack step, exit code 3, and the off-cycle rule.
- [ ] Sweeps: the before/after diffs for PR-A, PR-B, and PR-C show only the permitted deltas (§7). The diffs are attached to each PR.
- [ ] Migration: the co-deck canary passes; the four other frozen projects apply after it; all 16 projects have ack files before PR-G.

## 14. Open questions

None blocks this design. The audit's §7 question 4 (were co-learning "Stream Boundaries" and co-develop `requirements_analysis` retired on purpose?) stays open for the user. It belongs to the P0 recovery stream, not to this design.

## 15. Accessibility exemption note

Engine semantics, a validator check, a landing gate, skill procedures, and unit tests. No UI, no rendered content, no style changes. No accessibility review is required.
