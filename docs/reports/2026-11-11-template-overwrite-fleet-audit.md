# Template-Overwrite Fleet Audit — 2026-11-11

- **Question 1**: Did the co-deck failure mode happen in other fleet projects? The failure mode: project changes were not promoted to the template, and a later `upgrade-project` delivery overwrote them.
- **Question 2**: What are the systemic root causes, and which remedies fix them?
- **Scope**: the 16 fleet members from `docs/fleet-membership.json` (`Projects/co-*` minus `co-abap-plugin`).
- **Engine under test**: the working-tree engine. This is `scripts/upgrade-project.ts` v1.100.0 and `scripts/lib/upgrade-policy.ts` v1.40.0. Both include the uncommitted T-20261110-009 (PR-2) and T-20261110-012 (PR-3) work.
- **Mode**: read-only. No project or template file was edited. The only file created is this report.
- **Author**: auditor/architect (PM-dispatched)

## 0. Method and evidence sources

| Source | How it was used |
|---|---|
| (a) Project git history | A read-only script walked every upgrade or template-sync commit since 2026-08-15 in each project. That is 560 commits fleet-wide, matched by subject: `upgrade template`, `template delivery`, `sync template`, `resync`, and similar. For each modified file, it blamed the lines the upgrade removed. A removed line counts as **lost project content** only if all three hold: (1) it came from a non-upgrade commit; (2) it is absent from the post-upgrade file; (3) it never appeared in any revision of the template counterpart (`templates/<variant>/…`, `templates/common/…`, L0 path, plus skill-mirror mappings). Each hit was then checked against the project's current `HEAD`. The script also flagged removed `LOCAL-PATCH` lines and `@version`/`version:` regressions. Separately, all project commit logs were searched for restore-after-overwrite commits. |
| (b) Delivery manifests | Read `.claude/last-upgrade-delivery.json` (schema v2 decision log) at the relevant project commits. |
| (c) Current drift | Compared each project file against its template counterpart (`templates/<variant>` first, then `templates/common`, working tree). Listed files whose project version is higher than the template version (project-ahead), and files with `LOCAL-PATCH` markers that the template copy does not carry. |
| (d) Tickets | `tickets/governance/**`: U-20261110-001, U-20261111-004, U-20261105-004, U-20261031-001..003, U-20261002-002, U-20261108-002, T-20261110-009/-010/-011/-012, T-20261101-001. Also design `2026-11-10-delivery-gating-hardening-design` (DEC-20261110-04). |
| (e) Dry-run sweep | `bun scripts/upgrade-project.ts Projects/<p> --dry-run --prune-removed` for all 16 projects, with each project's git state (porcelain status, HEAD, diff hash) recorded before and after. Results are in §2. |
| Skills | `skills/project-resync/SKILL.md` v1.8.0 and `skills/upgrade-project/SKILL.md` v1.6.2. |

**Limitations.**
- The forensic filter is a heuristic. A removed project line that the template later re-expressed in different words reads as "lost". Every row below marked **OPEN** was re-verified by hand at project `HEAD`.
- Dry-run does not persist the decision log. Dry-run counts come from the console summary line and the per-file console markers.
- `Projects/co-newbiz` was being edited by another session during the sweep: the app files under `app/web-next/**` and `docs/designs/**` changed mtimes at 13:03–13:12. Its porcelain file list and `HEAD` did not change, only the content hash of the working-tree diff. A first sweep earlier the same day showed all 16 projects byte-unchanged. Dry-run writes nothing (every write is `dryRun`-guarded; sync-skills prints only `[DRY RUN] Would run`).

## 1. Answer to Question 1 — yes, the class recurs fleet-wide

Content-losing deliveries are confirmed in **co-deck, co-work, co-design, co-learning, co-develop, co-abap and co-newbiz**. Each has either a verified loss at `HEAD` or a restore-after-overwrite commit by the project.

Four projects have pending regressions that the next apply would execute:
- co-abap, co-hr, co-safety: one `EVOLVED` (deliver) row each.
- co-newbiz: an `EVOLVED` row over a `LOCAL-PATCH`-marked file.

The other projects show no verified post-policy (2026-10-27 onward) content loss beyond subsumed patches. These are co-architect, co-consult, co-export, co-game, co-hr, co-news, co-price and co-security.

### 1.1 Incident table

Status values:
- **OPEN**: lost at project `HEAD` and absent from the template, so the next delivery cannot restore it either.
- **RESOLVED**: restored and/or carried by the template now.
- **SUBSUMED**: the upstream fix landed and the delivered template replaced the local patch on purpose.
- **AT RISK**: a pending regression in the next apply (from the dry-run).

| # | Project | File | Evidence (commit / verdict) | What was lost or is at risk | Status |
|---|---|---|---|---|---|
| 1 | co-deck | `decisions/gates.yaml` | `a736430` 2026-11-10, a 0.30.0→0.30.0 re-delivery through workspace PR #1952 (off-cycle, not a project-resync run). Verdict: VARIANT ASSET DIRS `EVOLVED` (WARN) "template content unchanged — delivery proceeds", plus `ADOPT` (INFO). | Gate `DG-DECK-06` (font parity, DEC-20261110-02). The project added it hours earlier in `3142276` (PR #216). | **OPEN**: absent at `HEAD` `c04d4a3`, absent from the template working tree, and not named in any U- ticket |
| 2 | co-deck | `docs/phase-definitions.md` | `a736430`, DOCS_OVERWRITE `EVOLVED` (WARN) + `ADOPT`. The same row also fired in `302217b` (2026-11-08). | `302217b` removed the Gate 2 content-hygiene checklist (5 lines). `a736430` reverted "DG-DECK-01..06" to "01..05". | **OPEN** |
| 3 | co-deck | `docs/html-themes/styles/classic/style.css` | `a736430`, TEMPLATE TREE SYNC plain `ADOPT` (INFO), with no guard row because the file had no baseline (`NO_BASELINE`). | The Pretendard font-parity block: `@font-face` and the `--font-family` stack. It carried the marker form `LOCAL-PATCH (design: 2026-11-10-pretendard-font-parity)`. The U-20261110-001 fix in PR #1952 carried the block into `white-bubble/style.css` only. | **OPEN**. Under the new engine A1 still **delivers**, because the marker regex `LOCAL-PATCH\(upstream-request:` does not match this marker form. The row becomes `UNBASELINED_OVERWRITE` (WARN). |
| 4 | co-deck | `docs/html-themes/styles/white-bubble/style.css` | `302217b` 0.30.0, plain `ADOPT` (no baseline). The upstream record U-20261105-004 said "fixed", but PR #1864 never committed the CSS. | The U-20261105-004 zen/white-bubble fix (9 marker lines, 32 lines). | RESOLVED: restored in `4edaa8b`; the template has carried it since PR #1952 (U-20261110-001) |
| 5 | co-deck | `docs/co-deck.context.md` | `a736430` DOCS_MERGE (template-authoritative block restamp). Earlier, `58104ca` (2026-10-31) removed 9 Structural-Slide-Rules lines. | Rule 9 (font parity). | In progress: U-20261111-004 is in review, and the template working tree now carries rule 9 (uncommitted) |
| 6 | co-deck | `agents/html-build.md` | `a736430` (`--disposition adopt-template` grant) | The variant-correct `phases: [5, 6, 7, 8]` was re-clobbered to `[4]`. | AT RISK, but the dry-run now shows CONFLICT (ERROR, protected). Tracked in U-20261111-004. |
| 7 | co-deck | `scripts/co-deck/estimate-layout.ts` | `a736430` explicit `--disposition adopt-template` | LOCAL-PATCH 1.4.1 (3 marker lines) replaced by template 1.5.0. | SUBSUMED (likely): template 1.5.0 implements U-20261105-001 |
| 8 | co-deck | `scripts/co-deck/SCRIPTS.md` | `302217b` | Registry rows for `gen-slides-pdf.ts` 1.14.4 and `estimate-layout.ts` 1.4.1 regressed. At `HEAD` the registry says `gen-slides-pdf.ts` is 1.10.0, but the file is 1.14.5. | **OPEN** (registry drift) |
| 9 | co-deck | `scripts/co-deck/gen-slides-pdf.ts` (1.14.5 vs template 1.10.1, 36 markers), `skills/storyline` (1.3.0 vs 1.2.0), `scripts/co-deck/extract_slidedata.mjs` (equal-version fork, `.mjs` is outside the delivery walk) | Drift census + `fleet-script-parity` (T-010) | Project-ahead work that was never promoted. The engine prints a silent `OK` on every run. | AT RISK: protected only while the template version stays lower; invisible to every gate |
| 10 | co-work | `.github/workflows/ci.yml` | `5ff7f5a` 2026-11-08 (0.28→0.30), `MERGE` (INFO): "template-owned jobs authoritative, PROJECT-JOBS region preserved" | The deck-openability CI leg (15 lines, marked `LOCAL-PATCH(project-local)`). It sat inside a template-owned job, not in `PROJECT-JOBS`, so it was erased. | **OPEN**: `scripts/deck/check_openability.py` and its expectations file still exist, but no CI step runs them |
| 11 | co-work | `scripts/skill-lifecycle-audit.ts` | `5ff7f5a`, `DRIFT_RESTORED` (WARN). The project's local v1.11.0 collided with the template's v1.11.0. | The project-local skip for vendored external-dep skills. | SUBSUMED after the fact: the template now carries an equivalent skip. The engine path that erased it (equal-version restore) is unchanged. |
| 12 | co-work | `scripts/lib/external-deps.ts` | `5ff7f5a` adopt-template | LOCAL-PATCH U-20261107-002 | SUBSUMED (upstream v1.2.0) |
| 13 | co-design | `docs/security.md` | `5e53c4c` 2026-10-27 (overwrite-policy engine wave), DOCS_OVERWRITE `ADOPT` | The project's "Dependency Overrides" section (hono/esbuild security floors). The delivered text was also corrupted ("dmin", em-dashes lost); that corruption was fixed later. | **OPEN**: the section is absent at `HEAD` |
| 14 | co-design | `docs/design-foundation.md`, `docs/component-primitives.md`, `docs/design/*.registry.yaml`, `agents/*` | `5e53c4c` / `5557c1d` (2026-10-27/28), plain `ADOPT` | Standalone-checkout notes, a11y binding notes, agent governance state | RESOLVED manually by the project: `4b9667e` "re-land restoration re-clobbered by overnight workspace sync"; `eed9957` and `477f4a3` "re-apply … reverted by the 2026-10-27 template delivery". Residual 5-line differences remain. |
| 15 | co-design | `scripts/audit.ts` | `5361921` 2026-10-05 (core-locked restore) | The project's CI bun-pin gate arm | By policy (core-locked script). The project keeps `scripts/validate-ci-bun-pins.ts` as a project-only LOCAL-PATCH. |
| 16 | co-learning | `docs/governance/agents/workflows.md` | `31d3c99` 2026-10-07 (0.13.1) | "Stream Boundaries (education operations, DEC-20261007-01)", 20 lines | **OPEN**: not present anywhere in the project at `HEAD` (needs the user's confirmation that it was not retired on purpose) |
| 17 | co-develop | `docs/handoff-spec.md`, `docs/handoff-spec_ko.md` | `3ba93fb` 2026-10-07 (0.13.1) | The `requirements_analysis` handoff block, 21 lines each | **OPEN** (needs confirmation of intent) |
| 18 | co-develop | 3 project-adopted skills | 0.26.0 visit (prune); restored in `96edd39` | `mece-logic-auditor`, `sarif-exporter`, `stride-threat-matrix` | RESOLVED (T-20261101-001) |
| 19 | co-abap | 20 `agents/*.md`; `CLAUDE.md` / `CODEX.md` / `GEMINI.md` / `HERMES.md`; `docs/co-abap.context.md` | `78adacd` 2026-10-13 (0.18.0, before baselines existed) | Agent versions went backwards (1.1.x→1.0.0); `LOCAL-PATCH(upstream-request: pending)` parity blocks were removed; 119 context lines were lost | Historical. The agents have re-converged (the template is now at 1.1.x). The LP blocks are not at `HEAD`. |
| 20 | co-abap | `docs/clean-abap-checklist.md` | Dry-run `EVOLVED` → deliver | 1 project line | AT RISK |
| 21 | co-hr | `docs/iso-30414-metrics-mapping.md` | Dry-run `EVOLVED` → deliver | 1 project line | AT RISK |
| 22 | co-safety | `docs/_shared/tutorial_ko.md` | Dry-run `EVOLVED` → deliver | 1 project line | AT RISK |
| 23 | co-safety | `evidence-models/_shared/hot-work-permit-record.json` | `03815c4` 2026-11-01, plain `ADOPT` (no baseline) | Korean legal-term annotations, replaced by the English template text | Low; content equivalent in English |
| 24 | co-newbiz | `.github/workflows/delete-merged-branches.yml` (marked `LOCAL-PATCH U-20261108-002`) | Dry-run `EVOLVED` → deliver. `4594d870` "re-pin checkout v7 and ubuntu-24.04 after template upgrade overwrite" already restored it once. | The project's runner pin (2 lines). The `EVOLVED` row ignores markers, so this is a **re-stale loop**. | AT RISK |
| 25 | co-newbiz | Historical | Restore commits: `5c51b58b` (pm.md, 09-10), `7dd396d7` (custom CI verify job, 09-12), `4f3c22a0` (roster/skills, 09-12), `249a06bf` (deploy-web.ts "lost in resync wave", 09-23) | — | RESOLVED manually |
| 26 | co-security | `scripts/lib/ssrf.ts`, `scripts/skill-session-review.ts`, `.githooks/pre-rebase` | `383245f` 2026-11-01, plain `ADOPT` | LOCAL-PATCH U-20261031-001/002/003 | SUBSUMED (template hardening PR #1776) |
| 27 | Fleet (co-design, co-develop, co-export, co-game, co-security, co-work) | `.github/workflows/ci.yml` | 0.8.3 delivery (2026-10-03) | LOCAL-PATCH U-20261002-002 (bun pin) | SUBSUMED (PR #1338 pinned 1.4.x) |
| 28 | Fleet (about 12 projects) | `agents/i18n-specialist.md` | 2026-10-28 wave | `version` went from 1.3.0 back to 1.1.0, with no content lost | Cosmetic, but it shows versions can move backwards through delivery |

### 1.2 Current drift: project-ahead, never promoted (silent `OK` today)

| Project | Project-ahead files (project version > template version) |
|---|---|
| co-abap | `scripts/dispatch-parallel.ts` 2.4.1>1.1.1; `scripts/dispatch.ts` 1.2.0>1.1.1; `scripts/co-abap/vsp-audit.ts` 1.2.0>1.1.0; `agents/pm.md` 1.3.0>1.1.2; 7 skills: abap-dev, abap-code-review, post-write-chain, project-review, dump-monitor, performance-tuning, desktop-app-fallback |
| co-architect | 3 skills: finishing-a-development-branch, platform-command-lifecycle-manager, platform-skill-lifecycle-manager |
| co-deck | `gen-slides-pdf.ts` 1.14.5>1.10.1; `skills/storyline` 1.3.0>1.2.0 |
| co-design | `docs/co-design.context.md` 1.5>1.2; finishing-a-development-branch |
| co-game | `agents/architect.md`, `agents/test-runner.md` 1.2.0>1.1.1. The dry-run shows CONFLICT (ERROR), which is protected but blocks the upgrade. |
| co-learning | `skills/exam-bank-operations` 1.2.0>1.1.0 |
| co-newbiz | `scripts/lib/ssrf.ts`, the decision-record / evidence-ledger / k-law skills, `procedures/_template/schema.yaml` |
| co-safety | `scripts/archive-memory.ts`, `scripts/co-safety/safety-audit.ts` 4.10.2, the sync skill (1.9.0>1.6.0), team-builder, script-lifecycle-manager, translate |

Genuine unmirrored LOCAL-PATCH markers (excluding template-shipped mentions of the term):
- co-deck: `gen-slides-pdf.ts` (36), `extract_slidedata.mjs`, `CODEX.md` (U-20261111-002)
- co-newbiz: `ci.yml` (14), `delete-merged-branches.yml`, `dev-sync.ts` (U-20261107-003), `check-authoring.ts` and `ticket-drift.ts` (U-20261108-001)
- co-develop, co-learning, co-security: `CLAUDE.md` U-20261006-006 and `README_ko.md` U-20261006-007 (stale markers; U-20261006-006 is mentioned upstream)
- co-security: `read-skill-triggers.ts` (U-20261031-001)
- co-design, co-develop: `scripts/validate-ci-bun-pins.ts`

## 2. Dry-run sweep (working-tree engine, `--dry-run --prune-removed`)

| Project | Exit | INFO | WARN | ERROR | CONFLICT rows | EVOLVED (deliver) | DRIFT_RESTORED | Notes |
|---|---|---|---|---|---|---|---|---|
| co-abap | 0 | 108 | 352 | 0 | 0 | 1 | 163 | EVOLVED `docs/clean-abap-checklist.md` |
| co-architect | 0 | 237 | 249 | 0 | 0 | 3 | 162 | EVOLVED rows are generated files only |
| co-consult | 0 | 98 | 329 | 0 | 0 | 0 | 180 | |
| co-deck | **1** | 119 | 169 | **7** | 7 | 0 | 2 | CONFLICT: 5 agents (equal-version drift on evolved content) + 2 zen/white-bubble VR PNGs; 62 LP markers |
| co-design | 0 | 84 | 349 | 0 | 0 | 0 | 162 | |
| co-develop | 0 | 97 | 310 | 0 | 0 | 0 | 162 | |
| co-export | 0 | 88 | 293 | 0 | 0 | 0 | 162 | |
| co-game | **1** | 100 | 290 | **2** | 2 | 0 | 162 | `agents/architect.md`, `agents/test-runner.md` |
| co-hr | 0 | 89 | 284 | 0 | 0 | 1 | 162 | EVOLVED `docs/iso-30414-metrics-mapping.md` |
| co-learning | 0 | 88 | 286 | 0 | 0 | 0 | 162 | |
| co-newbiz | **1** | 161 | 315 | **8** | 8 | 1 | 155 | CONFLICT: audit.ts, dev-sync.ts, evidence-backport-scan.ts, hooks/pre-push.ts, lib/fleet.ts, lib/git-aware-scan.ts, test-runner.ts, validate-templates.ts. EVOLVED `delete-merged-branches.yml` (LP-marked). |
| co-news | 0 | 78 | 283 | 0 | 0 | 0 | 162 | |
| co-price | 0 | 119 | 306 | 0 | 0 | 0 | 162 | |
| co-safety | **1** | 155 | 383 | **1** | 1 | 1 | 166 | CONFLICT `scripts/dev-sync.ts`; EVOLVED `docs/_shared/tutorial_ko.md` |
| co-security | 0 | 93 | 294 | 0 | 0 | 0 | 162 | |
| co-work | 0 | 89 | 326 | 0 | 0 | 0 | 162 | |

Reading the sweep:
- **Zero A1 rows fleet-wide.** No `UNBASELINED_OVERWRITE` and no marker-CONFLICT appears, which matches the PR-2 sweep note in the design §7.1. The A2 parity baselines and the `302217b`/`a736430` baselines now cover the population that caused U-20261110-001.
- **About 162 `DRIFT_RESTORED` per project** (WARN, delivering). This is the template's Biome strict-profile reformat, `cdf316143` (2026-11-10), shipped under unchanged `@version` headers. Example: `agent-create.ts` differs only in quote style and trailing commas. This noise buries real equal-version forks like co-work #11.
- Every ERROR row is a pre-existing PROJECT_EVOLVED CONFLICT. These are protected, and correctly so.

## 3. Answer to Question 2 — root causes, ranked

### RC1 (highest): the `EVOLVED` matrix row delivers template-unchanged content over project evolution

`resolveDisposition` returns `deliver: true` with `EVOLVED` (WARN) when the project evolved and the template did **not** change (`scripts/lib/upgrade-policy.ts:1654-1662`). Only "template also changed" yields CONFLICT.

For **hash-gated** passes, the candidate reason is met by a project-side change alone:
- TEMPLATE TREE SYNC hash fallback: `reason = "(content changed)"`, `upgrade-project.ts:6263-6265`
- VARIANT ASSET DIRS: the `fileHash(src) !== fileHash(dst)` gate
- DOCS_OVERWRITE: runs on every upgrade, `upgrade-project.ts:3663,3690-3757`

So any project edit to a template-tracked hash-gated file is reverted at the next delivery, logged at WARN only. Examples: co-deck #1 and #2, and the dry-run AT-RISK rows #20–#22 and #24.

The design names this hole as Q4 and explicitly excludes it from T-009 (DEC-20261110-04 non-goal: "no change to the disposition matrix for `PROJECT_EVOLVED`"). It is also the engine cause of the T-20261110-011 re-stale loop.

### RC2: first-time delivery over committed divergence (`NO_BASELINE`), silent until T-009

Before PR-2, the `NO_BASELINE` state passed the guard and logged plain `ADOPT` (INFO). This caused co-deck #3 and #4, co-design #13 and #14, co-safety #23 and co-security #26.

The working-tree A1 (`resolveUnbaselinedDisposition`, `upgrade-policy.ts:1699-1730`; `evolvedDeliveryGuard` `upgrade-project.ts:2830-2845`) closes part of this. Gaps remain:
- (a) `LOCAL_PATCH_MARKER_RE = /LOCAL-PATCH\(upstream-request:/` (`:1683`) misses the forms used in the field: `LOCAL-PATCH (design: …)` (co-deck classic.css) and `LOCAL-PATCH(project-local)` (co-work ci.yml).
- (b) Unmarked divergence still **delivers** (WARN).
- (c) A1 lives only inside `evolvedDeliveryGuard`. It does not cover the arms that bypass the guard: the equal-version `DRIFT_RESTORED` arm (`:4196-4222`), the core-locked arm (`:4223`), ci.yml `MERGE`, DOCS_MERGE template-authoritative restamps, sync-skills mirrors, and prune.

### RC3: content-losing WARN rows never gate landing

The D3.1 landing refusal (dev-sync 3.9, `manifestHasUnresolvedErrors`) blocks ERROR only. co-deck `a736430` landed with **365 WARN / 0 ERROR**: 171 DRIFT_RESTORED, 40 EVOLVED and 5 adopt-template grants.

The `upgrade-project` skill (v1.6.2, last updated 2026-10-26) never mentions the decision log, dispositions, `--disposition adopt-template`, or LOCAL-PATCH. Its review step is `git status && git diff --cached`. Signal-to-noise is poor: about 162 formatter `DRIFT_RESTORED` rows per project (RC4) hide the few real losses.

### RC4: a version number is used as a content identity

- **Equal version, different content.** For non-agents scripts, this is restored unconditionally (`upgrade-project.ts:4196-4222`). The arm does not check the baseline, so a project-evolved fork at a colliding version is erased (co-work #11). Format-only template edits under an unchanged `@version` create mass churn (`cdf316143`).
- **Project ahead** (project version > template version). The engine prints a silent `OK` (`:4248-4251`) with no decision row and no backport surface. The exception is core-locked scripts, which are restored in either direction. Agents behave differently again: there the arm escalates to CONFLICT (co-game). Visibility therefore exists only in the WARN-only scanner `fleet-script-parity.ts` (T-010, committed `262b02b01`, exits 0). The scanner covers scripts only, not skills, agents or docs.

### RC5: no ordering or gate between backport and delivery

- project-resync Step 2 (selective backport) is a judgment step. `backport-diff.ts` is advisory and "never promotes anything itself".
- Step 4 runs upgrades after the root PR. No machine check confirms that every project-evolved or project-ahead path has a recorded verdict (promoted / stays-project / adopt).
- Off-cycle targeted deliveries bypass Step 2 entirely. co-deck `a736430` (workspace PR #1952) ran about 6 hours after project PRs #215/#216 had landed DG-DECK-06 and the Pretendard block.
- The upstream ledger can be false. U-20261105-004 was closed "fixed" while PR #1864 had dropped the CSS. The pre-delivery LOCAL-PATCH report tells the operator not to re-apply patches that are reported fixed (`upgrade-project.ts:2990-3000`).

### RC6: ownership zones in merged files are too coarse

- ci.yml `MERGE` makes template-owned jobs authoritative. Project steps added inside a template job are erased with an INFO row (co-work #10). Only the `PROJECT-JOBS` region survives.
- DOCS_MERGE restamps template-authoritative blocks (co-deck #5).

U-20261111-004 itself notes that inline LOCAL-PATCH markers are ineffective for whole-file or template-authoritative-zone deliveries.

### RC7: broad `--disposition adopt-template` grants

co-deck `a736430` granted adopt on 5 paths, co-work `5ff7f5a` and co-safety `03815c4` on more. The grant overrides CONFLICT. Nothing records a per-path diff review or confirms that the template copy is a superset of the project copy.

## 4. What already exists (working tree / landed) vs. the gaps

| Mechanism | State | Covers | Does not cover |
|---|---|---|---|
| D2 CONFLICT row (PROJECT_EVOLVED + template changed → SKIP) | landed (T-20261027-004) | both-sides-changed files with a baseline | RC1 (`EVOLVED` delivers) |
| A1 `UNBASELINED_OVERWRITE` / marker CONFLICT | uncommitted PR-2 | `NO_BASELINE` + `upstream-request` marker form | other marker forms; unmarked delivers; non-guard arms |
| A2 parity baselines | uncommitted PR-2 | shrinks `NO_BASELINE` monotonically | — |
| C-A behavior verification (`BEHAVIOR_REGRESSION`) | uncommitted PR-3 | delivered scripts that break sibling tests (apply only) | docs/css/yaml content loss |
| C-E `UNVERSIONED_SKIP` | uncommitted PR-3 | silent unversioned skips | — |
| `fleet-script-parity` B / C-B | landed `262b02b01` (WARN, exit 0) | `version-ahead`, `mismatch-equal-version`, `local-patch`, `orphan-test` for scripts | skills/agents/docs; no gate |
| agents/ equal-version drift → CONFLICT (D4) | landed | agents/ bodies | scripts/ equal-version arm still restores |

## 5. Remedy options and trade-offs

| ID | Remedy | Benefit | Trade-off / cost |
|---|---|---|---|
| R1 | **Never deliver over project evolution when the template is unchanged.** `resolveDisposition`: `PROJECT_EVOLVED && !templateChanged` returns `deliver: false` with a new verdict `EVOLVED_PRESERVE` (WARN). The baseline is not refreshed. The design Q4 rule: deliver requires `templateChanged` or an adopt grant. | Kills RC1 and the re-stale loop; would have saved co-deck #1 and #2 and the 4 AT-RISK rows | The template's "restore canonical" behaviour for hash-gated files needs an explicit `--disposition adopt-template`. It reverses the DEC-20261110-04 non-goal, so it needs a Design Gate ruling. |
| R2 | **Marker-loss guard.** Broaden detection to any `LOCAL-PATCH` form and compare marker counts, project vs deliverable. Any delivery that would reduce the count becomes CONFLICT (ERROR) unless the path is adopt-granted. Apply it in every delivering arm: guard, DRIFT_RESTORED, core-locked, MERGE/DOCS_MERGE post-merge check. | Closes the A1 regex gap and the non-guard arms; honours the pm.md marker contract | Template-shipped prose that mentions "LOCAL-PATCH" must not count; the count-delta rule handles that. Expect a few new ERROR rows on stale markers (U-20261006-006). |
| R3 | **Baseline-aware DRIFT_RESTORED + PROJECT_AHEAD row.** Equal version with different content: restore only if the project equals its baseline (an untouched older vintage). If it evolved, CONFLICT. Project version > template version records `PROJECT_AHEAD` (WARN) and adds the path to a new manifest `pendingBackport[]`. Never restore when ahead (except core-locked, which stays as is). | Keeps the formatter heal; removes the version-collision class; makes project-ahead work visible to backport | Small engine change in the scripts / variant-scripts arms; `pendingBackport` is an additive manifest key |
| R4 | **Pre-delivery project-ahead gate in the engine** (not only the skill, so off-cycle runs are covered). Apply mode refuses to write when a set is non-empty and lacks a disposition record. The set: `PROJECT_EVOLVED`, `PROJECT_AHEAD`, marker-loss, or prior-run `pendingBackport`. The record could be `--backport-ack <file>` or `.claude/backport-decisions.json`, with per-path verdict promoted / stays-project / adopt. Roll out off → shadow → enforce. | Enforces backport-before-upgrade; would have stopped co-deck `a736430` | Friction on every upgrade. Mitigated: once R1 and R3 preserve by default, the gate fires mostly on genuine pending ports. |
| R5 | **Destructive-WARN acknowledgement at landing.** dev-sync 3.9 requires a PR-body "Destructive dispositions" section that lists each `EVOLVED` (if R1 is rejected), `UNBASELINED_OVERWRITE`, non-vintage `DRIFT_RESTORED`, snapshot `MERGE`, and adopt grant. | Makes WARN readable and auditable | Noise until R3 and R10 cut the formatter churn |
| R6 | **Three-way merge from content baselines.** The manifest already records `templateSha`. Reconstruct base content with `git show <templateSha>:templates/<…>` and use `git merge-file` for text docs/yaml/css. A conflict becomes CONFLICT. | Preserves both sides automatically (DG-DECK-06 + template edits) | Larger engine change; risky for code. Start with `docs/**`, `decisions/**`, CSS. |
| R7 | **project-resync ordering.** Step 4 must run `backport-diff`, `fleet-script-parity` and the dry-run, and refuse apply while `PROJECT_EVOLVED` / `PROJECT_AHEAD` / marker-loss rows lack a Step-2 verdict. Off-cycle deliveries (targeted fixes like PR #1952) run the same pre-flight. | Procedural belt to R4 | The procedure alone failed (RC5). It only helps backed by R4. |
| R8 | **Upstream-request automation.** CONFLICT / PROJECT_AHEAD rows emit backport-candidate drafts. Closing a U- ticket as "fixed" requires a content check that the template contains the patch hunk. | Prevents U-20261105-004-style false records | Ticket volume; needs a hunk-matching heuristic |
| R9 | **Project-side check.** A pre-commit/CI check fails when a template-tracked file is edited without a LOCAL-PATCH marker or an upstream request. | Forces filing at authoring time | The CI billing wall (T-20261110-008) means it must be a local hook first. Adds authoring friction. |
| R10 | **Template version discipline.** validate-templates fails when a template script's or skill's bytes change versus `HEAD` under the same `@version`/`version`. Alternatively, normalize with the formatter before the drift compare. | Removes the about-162-row noise floor | Version-bump churn on format sweeps |

## 6. Recommended remedy set (mapped to concrete changes)

**P0 — recover data, then hold risky applies (no engine change)**
1. Restore and **port template-side** (otherwise the next delivery re-clobbers):
   - co-deck: DG-DECK-06 in `decisions/gates.yaml`; "DG-DECK-01..06" and the Gate 2 hygiene checklist in `docs/phase-definitions.md`; the Pretendard block in `styles/classic/style.css` (template `templates/co-deck/...`); the `scripts/co-deck/SCRIPTS.md` row for `gen-slides-pdf` 1.14.5.
   - co-work: the openability CI leg, moved into the `PROJECT-JOBS` region.
   - co-design: the `docs/security.md` "Dependency Overrides" section (as variant content).
   - co-learning: "Stream Boundaries", and co-develop: the `requirements_analysis` block — only after the user confirms they were not retired on purpose.
   - File one U- ticket per project. U-20261111-004 already covers rule 9 and html-build phases.
2. Until R1 and R2 land, do not run apply on co-abap, co-hr, co-safety or co-newbiz without `--disposition` review of their `EVOLVED` rows (dry-run §2). Keep the co-deck canary apply (design §5) behind R1 too.

**P1 — engine PR (after PR-2 and PR-3 land; own PR for attribution)**
- `scripts/lib/upgrade-policy.ts`:
  - R1: `resolveDisposition` (`:1646-1680`) returns `deliver: false` for `PROJECT_EVOLVED && !templateChanged`, with new verdict `EVOLVED_PRESERVE` (WARN). Add it to `DecisionVerdict` and `DECISION_SEVERITY_CONTRACT`.
  - R2: export a `countLocalPatchMarkers(text)` (regex `/LOCAL-PATCH\b/`) and a `markerLoss(project, deliverable)` predicate. Keep `LOCAL_PATCH_MARKER_RE` for A1 but broaden it to `/LOCAL-PATCH\b/`.
  - R3: new verdict `PROJECT_AHEAD` (WARN) and manifest type `pendingBackport?: string[]`.
- `scripts/upgrade-project.ts`:
  - `evolvedDeliveryGuard` (`:2819-2896`): honour `EVOLVED_PRESERVE` and print a preserve line; run `markerLoss` before every deliver → CONFLICT.
  - Scripts arm (`:4196-4222`) and variant-scripts arm: classify against `priorBaselines`; restore only when UNTOUCHED, otherwise CONFLICT. Apply `markerLoss`.
  - `else OK` arm (`:4248`): when `semverGt(projVer, tplVer)`, record `PROJECT_AHEAD` and push to `pendingBackport`. Mirror this in the skills/agents/variant-skills arms (`:4883`, `:5144`, `:5384`).
  - ci.yml MERGE and DOCS_MERGE: after merging, run `markerLoss` plus a "project-authored lines outside the project region would be dropped" check → CONFLICT.
  - Exit summary: list `pendingBackport`.
- Tests: extend `tests/unit/upgrade-policy-decisions.test.ts` (R1/R2 matrix cells) and `tests/unit/upgrade-decision-log.test.ts` (fixtures: a co-deck gates.yaml replay; a co-work ci.yml in-job project step; an equal-version scripts fork).

**P2 — gating and procedure**
- R4 in `scripts/upgrade-project.ts`: apply-mode pre-flight. The flag is `--backport-ack <path>` or `.claude/backport-decisions.json`. Staged `off|shadow|enforce` via an env/flag default (decision-write-integrity rollout). Every invocation path inherits it, including off-cycle ones.
- R5 in dev-sync 3.9: require acknowledgement of destructive WARN rows. R10 in `scripts/validate-templates.ts`: a same-version content-change check (proposed CV-02).
- `skills/upgrade-project/SKILL.md` (bump 1.6.2 → 1.7.0):
  - Step 2: read the decision summary and every CONFLICT / EVOLVED(_PRESERVE) / UNBASELINED_OVERWRITE / DRIFT_RESTORED / PROJECT_AHEAD row.
  - New step: before apply, record a backport verdict for every `pendingBackport` and `PROJECT_EVOLVED` path, or port it first.
  - Document `--disposition adopt-template[=glob]` as a per-path, reviewed grant. Never grant it on a path whose dry-run shows marker loss without confirming the template carries the patch.
  - Step 5: review the manifest decisions, not only `git diff`.
- `skills/project-resync/SKILL.md` (bump 1.8.0 → 1.9.0):
  - Step 2: add mandatory inputs — `upgrade-project --dry-run` per project and `fleet-script-parity`. Every `PROJECT_EVOLVED` / `PROJECT_AHEAD` / marker row gets promoted / stays-project / adopt.
  - Step 4: gate apply on that verdict file (R4 `--backport-ack`).
  - New rule: targeted off-cycle deliveries must run Step 2 for the affected project first.
  - Step 2d: before acting on a "fixed" upstream record, verify that the template contains the patch (R8, manual until automated).

**P3 — structural**
R6 (three-way merge for `docs/**`, `decisions/**`, `*.css`), R8 automation, R9 local hook.

## 7. Decisions needed from the user

1. **R1 semantics.** Approve reversing the DEC-20261110-04 non-goal (the design's Q4): template-unchanged deliveries no longer revert project evolution, and explicit adopt becomes the only restore path.
2. **R4 strictness.** Choose between a blocking pre-delivery backport gate (enforce, the recommendation) and WARN-plus-acknowledgement only.
3. **Apply freeze.** Hold apply on co-deck (canary), co-abap, co-hr, co-safety and co-newbiz until P1 lands? The alternative is applying now with per-path `--disposition` review.
4. **Intent confirmation.** Were co-learning "Stream Boundaries" (#16) and co-develop `requirements_analysis` (#17) retired on purpose, or should they be restored?
5. **Marker policy.** Should every `LOCAL-PATCH` form, including `(design: …)` and `(project-local)`, count as protective (R2)? Or should the field be normalized to the `upstream-request:` form?
