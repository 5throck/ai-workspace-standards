# Design: Delivery Bookkeeping Engine — Stamp Honesty, Tombstone Mechanics, Retirement Tooling, Engine Polish (U-20261028-005/006/013/019, T-20261028-016, T-20261029-003/007)

- **Spec id**: `2026-10-29-delivery-bookkeeping-engine`
- **Date**: 2026-10-29
- **Status**: PENDING USER APPROVAL — this document ends at a user-approval gate. Nothing is registered, nothing is implemented.
- **Author**: architect (L0)
- **Decision record**: DEC-20261029-01 (`docs/decisions/DEC-20261029-01.md`) — adopt pending user approval
- **Vocabulary**: reuses the sync-overwrite-policy design (D1 baselines, D2 disposition matrix, D3 decision log, D4 template-side classification) and the tombstone-ownership design (D1–D3 tombstone state) — `docs/designs/2026-10-27-sync-overwrite-policy-design.md`, `docs/designs/2026-10-28-delivery-tombstone-ownership-design.md`

## 0. Conclusion

One joint design covering four verified engine-defect groups in the delivery bookkeeping layer:

- **A — Stamp honesty**: the delivery engine advances an agent's `version` (version-gated delivery, upgrade-project.ts:3144–3283) and re-stamps only the TOP-LEVEL `last_updated` (upgrade-project.ts:4916–4980 via `bumpFrontmatterLastUpdated`, which explicitly skips nested `lifecycle:` blocks and never touches `last_reviewed`), while the lifecycle audits compare dates against git content commits that skip only three sync-only subject patterns — none of which matches the project-side wave-landing subjects actually used (`chore: upgrade template to X`, `chore: workspace sync (n)`). Every wave therefore re-adds ~29 staleness warnings fleet-wide (co-abap 21/21 agents; co-safety 8 agents + 21 skills). Decided: **split by date semantics** — engine auto-stamps *change* dates (nested `lifecycle.last_updated` joins the existing top-level re-stamp, new sibling primitive in the shared L0+L1 helper), and the *review* date (`last_reviewed`) is never auto-stamped; instead both lifecycle audits gain a **baseline-hash-equality tolerance** keyed to the delivery manifest (option (b) refined), which self-expires the moment the project genuinely evolves the file.
- **B — Tombstone/clear mechanics**: the `--clear-tombstone` catch-22 core (tombstone dropped, delivered baseline retained → `tombstoneGuard` re-fires TOMBSTONED (ERROR) next run) is already fixed in the current tree (T-20261028-014, commit `94a390945`, upgrade-project.ts:5079–5084 resets carried-forward baselines on the clear grant) — what remains is to pin it with regression tests, add an explicit `TOMBSTONE_CLEARED` decision row so the retraction is auditable, prune tombstones whose template counterpart left the tree (closing the asymmetry with the baselines carry-forward), and harden the nightly tombstone guard (`-m --diff-filter=D` in the runner procedure SSOT + a deterministic reappearance check in resync-audit.ts).
- **C — Removal-script commit pathway**: `scripts/remove-retired-governance-docs.ts` (L0, one-shot) cannot pass the delivered pre-commit hooks from outside dev-sync (hooks demand `SYNC_ACTIVE=1` + `DEV_SYNC_CONTEXT`/`_FILE`, set only by dev-sync.ts:1579–1609); all 16 landings were completed manually via per-project dev-sync PRs. Verified: no other retirement is queued. Decided: **delete the one-shot script** (option (a)) — script file, SCRIPTS.md row, VERSION_MANIFEST row, propagation-map.json note touch-up — with the operator lesson recorded: any future mass-retirement routes per-repo commits through per-project dev-sync PRs from day one.
- **D — Engine polish**: surface stub version divergence as an INFO decision row (`STUB_VERSION_DIVERGENCE`) when the stub's existing version differs from the template counterpart's during the STUB skip branch (`backfillStubFrontmatter` fills only absent keys and never reports, lib/upgrade-policy.ts:843–902); and fix the census hunk-merge comment that says "fewer than 3 common lines" while the code merges same-kind hunks on distance < 6 (lib/upgrade-policy.ts:1577–1586) — comment-only, the tested behavior stays.

Five-PR sequencing; engine changes stay L0-only per ADR-0073 Amendment 4 (`upgrade-project.ts`, `resync-audit.ts` never publish); the L0+L1 set (`helpers/upgrade-versions.ts`, `lib/upgrade-policy.ts`, `dev-sync.ts`, both lifecycle audits) publishes through the standing L0→L1→variant paths. E2E on Projects/co-safety (exhibits both the agent and skill staleness classes).

## 1. Problem statement (per group, verified)

### Group A — delivery bookkeeping stamp honesty

**Verified mechanics.**

- The delivered agents pass is version-gated: when the template counterpart's frontmatter `version` is greater than the project copy's, the template content delivers wholesale and the project `version` advances (scripts/upgrade-project.ts:3144–3283; extends-stub composition merges the stub's own frontmatter, :3140–3155). `writeAgentContentWithLifecycle` preserves the project's `lifecycle:` block verbatim, so a delivery that moves `version` 1.0.0 → 1.1.0 leaves `lifecycle.last_updated` (e.g. co-abap `agents/read-only-analyst.md` nested `2026-10-10` vs `version: 1.1.0`) untouched.
- The post-delivery re-stamp (upgrade-project.ts:4916–4980, U-20261026-009, narrowed by T-20261028-002 to files THIS run delivered ∩ git-dirty) calls `bumpFrontmatterLastUpdated` (scripts/helpers/upgrade-versions.ts:96–123), whose contract is explicit: only the column-0 `last_updated:` key moves; nested keys inside a `lifecycle:` block are NEVER touched; no key is never injected; `last_reviewed` is never read.
- Zero `last_updated`/`last_reviewed` handling exists in scripts/dev-sync.ts (verified by grep — dev-sync detects version bumps for the step-4.85 test gate but performs no frontmatter date writes). U-20261028-006's phrasing "dev-sync.ts bumps version" traces to delivery waves landed *through* the project's `/sync` (dev-sync is the commit ferry, not the editor); no dev-sync wiring is required for the fix (§3.A1).
- The lifecycle audits' staleness checks: agent-lifecycle-audit.ts Check 11 (:672–687) and skill-lifecycle-audit.ts Check SD (:805–821) share `lastContentCommitDate` (:504–538), which skips only (a) sync-only subjects — `^chore\(upgrade\): template sync`, `^chore\(templates\): auto-release`, `\bpropagate sync\b` (:360–366) — and (b) metadata-only commits changing only `last_updated:` lines (:378–420). The observed project-side wave-landing subjects match none of these: Projects/co-work history shows `chore: upgrade template to 0.16.0` and dev-sync's weak-message fallback `chore: workspace sync (n files)` (helpers/commit-message.ts:24, 79). U-006 itself rules out blanket workspace-sync exemption ("those commits demonstrably carry content edits").
- Consequence (U-20261028-006, U-20261028-019): after every upgrade wave the audits re-flag the same staleness class — co-abap 21/21 agent WARNs, co-safety 8 agent + 21 skill WARNs — and nothing in the delivery path repairs it.
- Skills are structurally uncovered by the re-stamp: delivered SKILL.md files carry `last_reviewed:` (no `last_updated:`), so `bumpFrontmatterLastUpdated` never matches them.

**KEY DESIGN TENSION (named explicitly).** Auto-bumping `last_reviewed` would misrepresent review history: `last_reviewed` asserts a review of the content happened, and an engine write is not a review. The alternative — pure audit-side tolerance ("dates ≤ the recorded delivery date are fine") — leaves the nested `last_updated` honestly wrong (it claims the content last changed 2026-10-10 when the engine changed it 2026-10-27) and needs a tolerance rule that cannot be gamed by genuine project edits. The design resolves the tension by **splitting the two date semantics**: `last_updated` (top-level and nested) means "when the content last changed" — the engine owns it and stamps it honestly; `last_reviewed` means "a review happened" — the engine never touches it, and the audits tolerate its staleness only while the file's bytes are exactly what the engine delivered (baseline-hash equality), restoring review pressure the moment the project evolves the file.

### Group B — tombstone/clear mechanics

- **The clear catch-22 (T-20261028-016 item 2) — already fixed, needs pinning.** `tombstoneGuard` fires on `absent && (tombstones[rel] || baselines[rel])` (lib/upgrade-policy.ts:1265–1293): with only the tombstone entry dropped, a retained delivered baseline re-fires `TOMBSTONED` (ERROR) on the next run — the observed co-design runs 2–3 during the DEC-20261028-05 phase 2 (which also produced the T-20261029-007 reappearance). The current tree already resets carried-forward baselines on the clear grant (upgrade-project.ts:5079–5084, T-20261028-014, commit `94a390945`, v1.79.0, merged 2026-10-28 10:07): "the clear grant also resets carried-forward baselines — the D2 fire condition is `absent && (tombstones[rel] || baselines[rel])`, so a retained baseline would re-fire TOMBSTONED (ERROR) next run". No unit test pins the full clear → next-run-NEW sequence, and the retraction itself is silent (the manifest writer rewrites `tombstones`/`baselines` with no decision row).
- **Prune asymmetry (T-20261029-003 item 1).** The baselines carry-forward prunes entries whose template counterpart left the tree (upgrade-project.ts:5054–5057: `if (!existsSync(join(templatesDir, rel)) && !existsSync(join(commonDir, rel))) continue; // template-departed — pruned`). The tombstones carry-forward immediately below (:5066–5068) copies entries verbatim and its comment says opportunistic pruning is "deliberately not attempted here" (:5062–5065). A tombstone whose template counterpart is gone can never fire (the guard is consulted only from absent-copy branches of passes walking template-side files, tombstone-ownership design §4.5) — the entry is inert state that pollutes the manifest and the fleet census.
- **Nightly guard gap (T-20261029-007 guard-infra note).** The 01:30 runner's tombstone guard scans deletion history with plain `git log --diff-filter=D -- <path>`, which does not show deletions carried by merge commits — PR #59's co-design `workflows.md` delete rode a merge, and the 2026-10-29 run missed it until manual correction to `log -m --diff-filter=D` (docs/reports/2026-10-29-project-resync-daily.md:135). The guard lives in the runner procedure (SSOT: docs/designs/2026-09-25-daily-fleet-review-resync-design.md + the live cron prompt), not in repo code. Separately, resync-audit.ts's tombstone census (:393–404) classifies tombstoned paths only when they are *absent* from the working tree; a tombstoned path that *reappears* on disk falls through to the ordinary modified/stale classification and is never flagged as a tombstone violation.

### Group C — removal-script commit pathway (T-20261028-016 item 1)

- scripts/remove-retired-governance-docs.ts commits per repo with raw `git commit -m <msg> -- <target>` (:278–283). The delivered pre-commit hook contract requires `SYNC_ACTIVE=1` plus `DEV_SYNC_CONTEXT`/`DEV_SYNC_CONTEXT_FILE` — environment that only dev-sync.ts:1579–1609 legitimately establishes. All 16 repos refused the script's commits; the 16 landings were completed manually via per-project dev-sync PRs (ticket history, memory/2026-10-28.md:1100–1146).
- Fabricating the env vars outside dev-sync would forge the very contract the hooks enforce (a hook bypass by another name) — option (c)'s "hook-aware env contract" is a governance violation in a wrapper.
- Future-use check (per the design brief): every retirement ticket is done (U-20261028-003, U-20261028-004, U-20261029-007, the DEC-20261028-05 sweep); the only open item touching retirement mechanics is T-20261028-016 itself. No mass-retirement is queued.

### Group D — small engine polish (T-20261029-003 items 2–3)

- `backfillStubFrontmatter` (lib/upgrade-policy.ts:843–902) fills `tier`/`version`/`last_updated` only when the project stub's frontmatter lacks the key; existing values are "NEVER overwritten (deliberate project divergence — a pinned older version — stays)" — but the divergence is never *reported*: an operator reading the decision log sees the STUB skip and nothing else. T-20261029-003 item 2 asks for an INFO/WARN decision row when the stub's existing `version` differs from the template counterpart's.
- The census hunk-merge comment (lib/upgrade-policy.ts:1581–1583) says "Merge hunks separated by fewer than 3 common lines" while the code merges same-kind hunks on `h.at - last.at < 6` (:1584–1586). Comment-only defect; the tested behavior is the distance-< 6 rule.

## 2. Goals / Non-goals

**Goals**

1. After any upgrade wave, the lifecycle audits re-flag no file whose content is exactly what the engine delivered (stamp honesty restored, no dishonest review stamps).
2. `--clear-tombstone` is provably a full retraction: next run delivers the path as NEW, the retraction is visible in the decision log, and a regression test pins it.
3. Tombstone state cannot outlive its firing condition (template-departed entries prune) and the nightly guard cannot miss merge-carried deletions.
4. No one-shot retirement tooling lingers past its purpose; the mass-retirement operator pathway is documented as per-project dev-sync PRs.
5. Stub version divergence and the census merge rule are visible/correct at the decision-log and source-comment level.

**Non-goals**

- No change to the version-gated delivery matrix (D2), the tombstone fire condition, or `baselineKeyFor` hashing.
- No auto-stamp of `last_reviewed` anywhere, no new audit severity levels, no re-scoring of historical warnings.
- No redesign of the pre-commit hook contract (SYNC_ACTIVE/DEV_SYNC_CONTEXT stays dev-sync-only).
- No fleet-wide CHANGELOG backfill automation beyond the co-abap remedy already executed under U-20261028-005 (project sessions own their CHANGELOGs).
- No change to upgrade-policy census behavior (comment-only fix; the distance-< 6 merge is tested behavior).

## 3. Detailed design (decided defaults per group)

### A1 — Nested `lifecycle.last_updated` joins the delivery re-stamp (option (a), change-dates only)

**Decided**: extend the shared stamping helper; wire only into the upgrade-project re-stamp. Rejected: (b) audit-side tolerance for `last_updated` too — it would leave dates honestly wrong forever and duplicating tolerance logic across two audits for a date the engine itself moved is the weaker contract.

- New exported sibling in scripts/helpers/upgrade-versions.ts (L0+L1): `bumpNestedLifecycleLastUpdated(text, date): { text, bumped }` — pure, idempotent, mirrors `bumpFrontmatterLastUpdated`'s contract with inverted scope: finds the `lifecycle:` block inside the frontmatter, advances its nested `last_updated:` key to `date`; never touches the top-level key, `last_reviewed`, `phase`, `created`, `governance`; no-op when the block or key is absent (never injects); CRLF-safe; invalid date → unchanged. (A single combined primitive with scope options was considered and rejected: two narrow functions keep each contract independently unit-testable and leave `bumpFrontmatterLastUpdated`'s published contract untouched for its existing importers.)
- Wiring: upgrade-project.ts post-delivery re-stamp loop (:4957–4970) applies BOTH primitives to each delivered ∩ git-dirty file. The existing T-20261028-002 restriction (deliveredRels ∩ git status) is the honesty guard — a version-touch-only write leaves the tree clean and is not re-stamped.
- No dev-sync wiring (verified: dev-sync performs no agent-frontmatter content edits; U-006's observation is the delivery ferry). The helper's L0+L1 placement keeps it available to any future dev-sync editing path without a layer change.
- Effect on Check 11: `extractFrontmatterDate`'s regex (`^\s*last_updated:`, :483–493) can resolve to the nested value for files lacking a top-level key; after A1 both carry the delivery date, so either resolution is honest. The remaining landing-skew (delivery date D, wave lands via `/sync` PR on D+1) is covered by A2's tolerance.

### A2 — Baseline-hash-equality tolerance for `last_reviewed` in both lifecycle audits (option (b), review-dates only)

**Decided**: refined (b). The engine never writes `last_reviewed`; the audits suppress the staleness warning only while the file's current content hashes to the manifest's recorded baseline. Rejected: (a) auto-stamping `last_reviewed` on delivery — misrepresents review history (the named tension); plain date-≤-delivery-date tolerance — does not self-expire when the project later evolves the file, and requires date anchoring that breaks across multi-day delivery→landing windows.

- Mechanism: in agent-lifecycle-audit.ts Check 11 and skill-lifecycle-audit.ts Check SD, when the stale condition holds (`fmDate < commitDate`), consult `.claude/last-upgrade-delivery.json` (in-project; absent at L0 root → tolerance inert, current behavior): if the manifest records `baselines[path]` and `baselineKeyFor(path, currentContent) === baselines[path].hash`, suppress the warning and emit an INFO line instead ("staleness explained by delivery <templateVersion> — file equals the recorded delivered baseline; review stamp intentionally not engine-managed"). `baselineKeyFor` is already exported from lib/upgrade-policy.ts:1083 (L0+L1, importable by the delivered audits).
- Self-expiring property: any genuine project edit changes the bytes → hash mismatch → the warning returns with full history. This directly answers U-006's objection to subject-based exemptions ("those commits demonstrably carry content edits"): engine-carried edits are exactly the case where content equals the baseline, and the content's provenance is the template-side review.
- Cost: one manifest read + one hash per flagged file, only on the warning path. Both audits are L0+L1 delivered (physical mirrors exist in templates/common/scripts/ and Projects/co-work/scripts/) — changes publish through the standing path.
- Check 11's `isMetadataOnlyChange`/sync-only subject logic stays untouched (still useful at L0 where no manifest exists).

### A3 — Opt-in CHANGELOG entry scaffolding per delivery (U-20261028-005 standing half)

**Decided**: opt-in flag `--changelog-entry` (apply-mode only), default OFF at the engine; the daily resync runner and operator upgrade sessions pass it by convention. Rejected: always-on — CHANGELOG.md is project-owned (PIPELINE_ARTIFACT_PATHS member, lib/upgrade-policy.ts:905–911), and an unconditional engine write into a file the project session actively edits (co-work's [Unreleased] carries long-form curated entries) would churn every wave, trip project-evolved classifications against un-committed [Unreleased] state, and fight per-project entry conventions.

- Behavior when set: upgrade-project inserts one entry at the top of the project CHANGELOG.md's first `## [Unreleased]` section (create the section if absent), in the fleet's established shape: `- **[<delivery-date>]**: chore(upgrade): template sync v<templateVersion> (<n> file(s) delivered; engine-scaffolded — edit or merge before commit; see templates/CHANGELOG.md v<templateVersion>)`. Idempotent: skipped when an identical `template sync v<templateVersion>` line already exists in that section. Runs BEFORE the manifest write so the CHANGELOG change rides the recorded delivery (`files[]` attribution); CHANGELOG.md's PIPELINE_ARTIFACT_PATHS membership means dev-sync step 3.9 attribution tolerates it.
- The U-005 remedy already executed (co-abap backfill of the 0.20.1/0.22.0 rows) stands; this flag makes the convention cheap going forward.
- Documented in skills/upgrade-project/SKILL.md (L0+L1 delivered skill).

### A4 — Duplicate-category-heading check in the dev-sync CHANGELOG gate (U-20261028-013)

**Decided**: extend dev-sync step 3 (the existing `[Unreleased]`-has-entries check, dev-sync.ts:588–604) with a second hard gate; blocking (exit 1), matching the step's precedent.

- Within each release section (`## [Unreleased]` … up to the next `## `), collect `### <Category>` headings; duplicates within one section → block, fix text: "merge the duplicate `### <X>` blocks into one per category, chronological within the block (U-20261028-013)".
- Also flag duplicate `[Unreleased]` sections (`^## \[Unreleased\]` prefix match — observed live in Projects/co-work, which carries both `## [Unreleased]` and `## [Unreleased] 2026-09-01`): more than one → block with a merge-into-one-section fix.
- Scoped to [Unreleased] plus historical release sections alike? **Default: all `## [...]` sections** — the scan is section-local and trivially generalizing costs nothing; released sections with genuine duplicate categories are defects by the same rule.
- Publishes with dev-sync (core script, identical across L1 and all 16 variants by the core-script standardization rule) — the gate therefore covers root and every project on their next engine delivery.

### B1 — Pin the clear-grant baseline drop; add the `TOMBSTONE_CLEARED` decision row

**Decided**: keep the shipped semantics (clear grant drops matching `tombstones` AND carried-forward `baselines` entries, upgrade-project.ts:5069–5084). Rejected: an `intentCleared` baseline marker — it would touch every D2 consumer (`tombstoneGuard`, classification arms, resync-audit census) to preserve provenance that the decision log records more cheaply.

- New decision row: for each clear grant that deletes ≥ 1 entry, record `TOMBSTONE_CLEARED` (severity INFO, new verdict in the lib's union — additive, schemaVersion stays 2) naming the glob and the dropped paths. The retraction becomes auditable in the unified decision log (D3) instead of a silent manifest rewrite.
- Regression tests pin: (i) clear grant with retained baseline → next run classifies absent path as NEW (no tombstoneGuard fire); (ii) clear grant drop scope is glob-exact (non-matching entries survive); (iii) `tombstoneGuard` never fires for a path whose entries were cleared. The existing tests/unit/upgrade-decision-log.test.ts is the home for (ii)/(iii); (i) is a writer-level test constructing a prior manifest + clear grant through the manifest-writer path.
- Known, accepted consequence (documented in the ticket): after a clear, direct placement of the file lands in the §8 NO_BASELINE migration window (WARN-classified) on the next run — provenance reset is the grant's documented semantics ("the operator retracts the deletion and the next delivery is a clean NEW", :5080–5084).

### B2 — Tombstone prune symmetry in the carry-forward

**Decided**: mirror the baselines rule in the tombstones carry-forward (upgrade-project.ts:5066–5068): skip entries whose template counterpart no longer exists (`!existsSync(templatesDir/rel) && !existsSync(commonDir/rel)`); replace the "deliberately not attempted" comment (:5062–5065) with the prune rationale. Rationale: the entry's only consumer (`tombstoneGuard`) is reachable exclusively from template-walking passes; a template-departed tombstone is provably inert, and the deletion-intent history lives in past decision logs and ticket records. The nightly guard's per-repo deletion scan (B3) is unaffected — it reads git history, not manifests.

### B3 — Nightly tombstone guard: merge-carried deletions + reappearance detection

**Decided**: two-layer fix.

1. **Runner procedure fix (docs + live prompt)**: update the guard invocation in the 01:30 runner procedure SSOT (docs/designs/2026-09-25-daily-fleet-review-resync-design.md, the procedure the cron prompt executes) from `git log --diff-filter=D -- <path>` to `git log -m --diff-filter=D -- <path>` (merge commits are shown with per-parent diffs, so merge-carried deletions appear — validated manually on the 2026-10-29 run, docs/reports/2026-10-29-project-resync-daily.md:135). The live cron prompt is updated in the same wave (owner-level action, §9).
2. **Deterministic reappearance check (resync-audit.ts, L0-only)**: in the per-file audit loop, when `delivery.tombstones[relFile]` exists AND the file exists on disk, emit a `TOMBSTONE-VIOLATION` row (non-KEEP) — "tombstoned path is present on disk (recorded <date>) — wave re-delivery or project re-application; adjudicate intent". This is manifest-based, needs no git-log semantics, and catches exactly the T-20261029-007 class deterministically every daily run. The `log -m` fix remains for retired paths with no manifest tombstone (template-departed retirements).

### C — Delete the one-shot retirement script (option (a))

**Decided**: delete. Verified: purpose fully served (16/16 landings completed manually via per-project dev-sync PRs), no queued mass-retirement (all retirement tickets done; the only open retirement-mechanics item is T-20261028-016 itself), and a re-run would no-op against the root-PR guard + already-absent targets. Rejected: (b) redesign to route each repo's commit through that project's dev-sync — building a cross-16-repo PR orchestrator for a non-recurring need is a speculative abstraction, and the manual pathway is already proven; (c) hook-aware env contract — setting `SYNC_ACTIVE=1`/`DEV_SYNC_CONTEXT` outside dev-sync forges the hook contract (the hooks exist to force the sync pipeline's gates; a wrapper that satisfies them without the pipeline is a bypass).

- Deletion set: `scripts/remove-retired-governance-docs.ts`; its SCRIPTS.md row (:241) and VERSION_MANIFEST.md row (:166) dropped; scripts/propagation-map.json:303 note updated to point the "phase-2 pass" reference at the ticket history (T-20261028-016 + memory/2026-10-28.md) instead of the deleted script; design/spec references in docs/designs/2026-10-28-l0-only-governance-doc-cleanup-design.md §5.5 remain as history (no rewrite of a landed spec — add a one-line "script deleted 2026-10-29, see DEC-20261029-01" pointer only if the doc carries an active-usage claim; otherwise untouched).
- Operator lesson recorded here and in the DEC: **any future mass-retirement routes per-repo commits through each project's dev-sync PR pathway from day one**; one-shot cross-repo commit tooling cannot pass delivered hooks by construction.

### D1 — Surface stub version divergence (INFO decision row)

**Decided**: INFO, not WARN. The backfill contract explicitly blesses a pinned older version as deliberate project divergence (lib/upgrade-policy.ts:852–854); WARN would fire on every legitimate pin. Rejected: WARN (noise on sanctioned pins), overwrite (violates the never-overwrite contract).

- In the agents/ STUB skip branch (upgrade-project.ts, the arm that calls `backfillStubFrontmatter` and skips), when the stub's existing `version` is present AND differs from the template counterpart's version, record a `STUB_VERSION_DIVERGENCE` decision row (severity INFO, detail: `stub version X pinned vs counterpart Y — backfill never overwrites; bump the stub version to re-arm version-gated delivery, or adopt via --disposition adopt-template`). Row placed after the primary skip row, same placement rule as `STUB_VERSION_BUMP_ADVICE` (:3262–3268). Repeat-per-run is accepted (same as the existing advisory; consumers read a path's first row for the verdict).
- Mechanically: the counterpart version is already in hand at the comparison site (`tplContentVersion`); the stub's existing version is `extractFrontmatterVersion(projFile)`.

### D2 — Census hunk-merge comment fix (comment-only)

lib/upgrade-policy.ts:1581–1583 comment corrected to state the actual tested rule: "Merge same-kind hunks that start fewer than 6 lines apart (`h.at - last.at < 6`; opposite kinds stay adjacent rows) so a one-word edit does not shrapnel into per-line rows." No code change; existing census unit tests pin the distance-< 6 behavior.

## 4. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | Engine + audit changes are platform-neutral scripts; no platform-dir artifacts change | N/A (no .claude/ artifact changes beyond existing manifest writes) |
| Antigravity (GEMINI.md) | None — no GEMINI.md, platform mirror, or skill-frontmatter surface changes; A4's CHANGELOG gate and A1's stamps are platform-neutral | N/A — justified: no touched file is platform-mirrored (verified against templates/common/scripts and skills listings) |
| templates/common | Propagation required for the L0+L1 set | templates/common/scripts/helpers/upgrade-versions.ts (A1), templates/common/scripts/lib/upgrade-policy.ts (D2 comment; baselineKeyFor already shared), templates/common/scripts/dev-sync.ts (A4), templates/common/scripts/agent-lifecycle-audit.ts + skill-lifecycle-audit.ts (A2), templates/common/skills/upgrade-project/SKILL.md (A3 doc); NOT propagated: upgrade-project.ts, resync-audit.ts (L0-only engine per ADR-0073 Amendment 4) |

## 5. Sequencing & PR split (publishing per ADR-0073 Amendment 4)

Layer facts (verified): engine = `upgrade-project.ts`, `check-upgrade-coverage.ts`, `resync-audit.ts` → **L0-only, never published**. Leaf/shared = `lib/upgrade-policy.ts`, `helpers/upgrade-versions.ts` → **L0+L1** (Amendments 1/3/4). `dev-sync.ts`, `audit.ts` core scripts and the two lifecycle audits exist physically at L1 → publish via core-script standardization and TEMPLATE TREE SYNC; variants receive them at their next delivery.

| PR | Content | Publishes to L1? |
|----|---------|------------------|
| PR1 | A1 (helper + re-stamp wiring) + B1 (TOMBSTONE_CLEARED row + tests) + B2 (prune symmetry) + A3 (`--changelog-entry`) + D1 (divergence row) — all in upgrade-project.ts / helpers/upgrade-versions.ts | Yes: helpers/upgrade-versions.ts (+ skills/upgrade-project/SKILL.md doc) |
| PR2 | A2 (baseline-hash tolerance in both audits) | Yes: agent-lifecycle-audit.ts, skill-lifecycle-audit.ts |
| PR3 | A4 (duplicate-category gate in dev-sync step 3) | Yes: dev-sync.ts (→ all 16 variants at next delivery) |
| PR4 | B3 (resync-audit TOMBSTONE-VIOLATION row; runner-SSOT invocation fix; live cron prompt update) | No (resync-audit L0-only; docs L0) |
| PR5 | C (delete removal script + registry rows + propagation-map note touch-up) | No (L0-only script) |

Order: PR1 → PR2 (A2 consumes the baseline hashes PR1's stamps make meaningful for last_updated; independent otherwise) → PR3/PR4/PR5 (independent; PR5 last so the propagation-map note edit references the landed DEC). Each PR: spec registered via `bun scripts/spec-register.ts --file docs/designs/2026-10-29-delivery-bookkeeping-engine-design.md --source manual --status implemented` against this one design doc (single-spec, per-PR attribution via commit messages), ADR-0074 Design Gate satisfied by this document.

## 6. Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| A1 stamps a file whose delivery was version-touch-only (body unchanged) — stamp overstates change | Existing T-20261028-002 re-stamp restriction (deliveredRels ∩ git-dirty) — a version-touch-only write leaves the tree clean and is skipped; covered by a unit test |
| A2 tolerance masks genuine staleness when the template source itself is stale | Baseline equality proves "project bytes == engine-delivered bytes"; template-side staleness is L0's own audits (root has no manifest → tolerance inert). The INFO line names the templateVersion so drift is visible |
| A2 reads the manifest on every flagged file — audit slowdown | Read once per audit run (lazy, cached); only on the warning path |
| A3 scaffolding fights an un-committed project [Unreleased] state | Opt-in default OFF; idempotency check; entry lands as an editable bullet the session merges before its /sync commit |
| A4 blocks previously-tolerated dirty CHANGELOGs on first run (co-work's double [Unreleased]) | Intended one-time remediation; the fix text names the merge action; the gate is content-local and trivially satisfied |
| B1's baseline drop creates a NO_BASELINE window for direct placement | Documented (§3.B1); §8 migration-window semantics already degrade this to WARN-classify, and the decision row makes the retraction visible |
| B2 prune erases a tombstone for a path that later returns to the template tree | If the template re-adds the path, delivery is a plain NEW (no deletion intent can be stale-contradicted — the intent's subject no longer exists); history lives in decision logs |
| B3 `-m` scan cost on large histories | Per-path scan, 14-day window, unchanged cost class; the deterministic resync check needs no git log at all |
| D1 row repeats every run for pinned stubs | Accepted (same as STUB_VERSION_BUMP_ADVICE); INFO severity keeps it out of gate math |

## 7. Validation plan

**Unit tests (per group)**

- A1: `bumpNestedLifecycleLastUpdated` — advances nested key; preserves top-level/last_reviewed/created/phase/governance; no-op when block/key absent (no injection); CRLF preserved; idempotent; invalid date no-op. Re-stamp integration: version-gated delivery produces both stamps; version-touch-only write produces neither.
- A2: tolerance — hash-match suppresses to INFO; post-edit bytes re-flag; manifest absent → no suppression; v1-shaped manifest (no baselines key) → no suppression.
- A3: entry inserted at top of first [Unreleased]; creates section when absent; idempotent on repeated version; flag absent → no write; dry-run → no write.
- A4: duplicate `### Added` in one section → block; duplicate `[Unreleased]` sections → block; clean single-section file passes; historical sections scanned.
- B1: clear grant drops tombstone + baseline (glob-scoped); next-run classification NEW; `tombstoneGuard` unit: no fire for cleared paths; TOMBSTONE_CLEARED row present.
- B2: carry-forward prunes tombstones whose template counterpart is gone; keeps firing-capable ones.
- B3: resync-audit — tombstoned path present on disk → TOMBSTONE-VIOLATION row; absent path → existing KEEP census row (regression).
- D1: stub with pinned older version → STUB_VERSION_DIVERGENCE INFO row; equal versions → no row.
- D2: existing census tests pin distance-< 6 merge (no new tests).

**E2E (one project: Projects/co-safety — exhibits both staleness classes)**

1. Dry-run `upgrade-project` against current templates: plan shows expected ADOPT/SKIP rows, no ERRORs.
2. Apply with `--changelog-entry`: verify nested `lifecycle.last_updated` + top-level `last_updated` = delivery date on delivered agents; SKILL.md `last_reviewed` untouched; CHANGELOG entry scaffolded; manifest carries baselines + decisions (including any TOMBSTONE_CLEARED/STUB_VERSION_DIVERGENCE rows).
3. Land via the project's `/sync`; re-run `agent-lifecycle-audit` and `skill-lifecycle-audit`: zero staleness WARNs for delivered paths (INFO lines where tolerance applied); genuine-edit re-flag proven by one manual byte change.
4. `resync-audit.ts` daily run: census row formats correct; co-design `workflows.md` (post-T-20261029-007 adjudication) shows no violation.
5. `bun run test:unit` green (step-4.85 gate: PR1 carries version bumps + tests).

## 8. Out of scope

- Changing the D2 disposition matrix, tombstone fire condition, or baseline hashing.
- Backfilling historical nested dates beyond what the next delivery naturally re-stamps.
- Fleet-wide CHANGELOG normalization (co-work's double-[Unreleased] remediation is that project session's commit, gated by A4).
- A generic "mass-retirement framework" (the lesson is documentation, not machinery).
- Any change to hook env contracts or dev-sync's step-3.9 attribution.
- Skill-graph, registry, or variant.json changes.

## 9. Accessibility statement (ADR-0065)

Non-UI change set: engine scripts, audits, one skill doc, and runner-procedure text. No user-interface surfaces, no color/contrast/keyboard/ATR implications. **ADR-0065 exemption applies** (non-UI). The only human-facing output changes are decision-log rows and audit lines, which follow the existing plain-text severity conventions (verdict + detail + resolution path).

## 10. Open questions (owner-level only; defaults stated)

1. **A4 gate severity** — default: hard block (matches the step-3 precedent). If the owner prefers a one-wave WARN soak before blocking, say so at approval; the default ships blocking.
2. **Live cron prompt update for B3** — the prompt lives outside the repo; the design updates the SSOT doc and the owner (or the 01:30 session) applies the prompt edit. Default: flagged at approval, applied by the next runner session.
3. None further — all other questions were resolved with defaults in §3 by design.

## 11. References

- Tickets: U-20261028-005, U-20261028-006, U-20261028-013, U-20261028-019, T-20261028-016, T-20261029-003, T-20261029-007
- Designs: 2026-10-27-sync-overwrite-policy-design.md (D1–D6), 2026-10-28-delivery-tombstone-ownership-design.md (D1–D3, §4.3/§4.5), 2026-10-28-l0-only-governance-doc-cleanup-design.md (§5.5/§6/§7), 2026-09-25-daily-fleet-review-resync-design.md (runner procedure SSOT)
- Code: scripts/upgrade-project.ts:3140–3283 (agents version-gated pass), :4916–4980 (re-stamp), :5008–5095 (manifest writer: baselines/tombstones carry-forward, clear grants, prune), :3262–3268 (STUB_VERSION_BUMP_ADVICE placement); scripts/helpers/upgrade-versions.ts:96–123 (bumpFrontmatterLastUpdated); scripts/lib/upgrade-policy.ts:843–902 (backfillStubFrontmatter), :1083 (baselineKeyFor), :1265–1293 (tombstoneGuard), :1577–1586 (census hunk merge); scripts/agent-lifecycle-audit.ts:360–420, :483–538, :672–687; scripts/skill-lifecycle-audit.ts:805–821; scripts/dev-sync.ts:588–604 (step 3), :1579–1609 (hook env); scripts/resync-audit.ts:393–404; scripts/remove-retired-governance-docs.ts:278–283 (commit step); scripts/propagation-map.json:303
- DEC: DEC-20261028-05 (phase-2 context), DEC-20260930-01 (ruling 2, sync-only subjects), DEC-20261028-01 (workflows.md precedent); ADR-0073 Amendments 1/3/4 (layer model), ADR-0074 (Design Gate), ADR-0065 (accessibility)
- Evidence: Projects/co-work/.claude/last-upgrade-delivery.json (manifest v2 shape); Projects/co-work/CHANGELOG.md (double-[Unreleased], entry convention); docs/reports/2026-10-29-project-resync-daily.md:135 (guard correction); memory/2026-10-28.md:1100–1146 (manual landings)
