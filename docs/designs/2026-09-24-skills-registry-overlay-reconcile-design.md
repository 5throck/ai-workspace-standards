# Design: Skills Registry Overlay Reconcile at Scaffold Time (T-20260924-008)

- **Spec id**: `2026-09-24-skills-registry-overlay-reconcile`
- **Date**: 2026-09-24
- **Author**: Template Architect (Design Gate, ADR-0074)
- **Ticket**: `tickets/governance/T-20260924-008.yaml` (kind: manual, priority: normal)
- **Status**: Implemented (2026-09-24 — delivered with the scaffold-side §10 remedy as two extra reconcile passes: fold variant-exclusive rows into the audit-visible `### Workspace Skills` section, and align surviving rows' status/owner from delivered frontmatter; `reconcileSkillRegistry` stays frozen so upgrade output is byte-identical)
- **Related specs**: 2026-09-24-scaffold-identity-overview-design (§13 scaffold/upgrade divergence lesson), T-20260922-001 skills-registry reconcile origin; sibling contract-inventory tickets T-20260924-002 / T-20260924-004 / T-20260924-007

---

## 1. Background

A fresh variant scaffold ships a broken `skills/SKILLS.md` registry. The defect was verified twice on 2026-09-24: first by automation-engineer during the scaffold-identity implementation's fresh-scaffold simulation (ticket provenance), then live by a real user scaffold, and reproduced identically at HEAD `7101a0cf` by lifecycle-manager via a scratch scaffold (`tests/.temp/lc-repro-t008-scratch`, deleted after capture).

### 1.1 Verified mechanism (file:line at f943a3e0)

1. **Step 1 — common delivery**: `scripts/new-project.ts:596` runs `copyDir(commonDir, projectDir)`. The common `skills/` tree lands with its registry `templates/common/skills/SKILLS.md` (63 registry rows over 42 skill dirs; 6 of the dirs are country-scoped `k-*`).
2. **Step 2 — variant overlay**: `scripts/new-project.ts:711-735` walks every variant template file and copies it over the project with `copyFileSync` (:734) — last copy wins. The only skip is `SCAFFOLD_COMMON_OWNED_FILES` (:728), and that set contains exactly one entry, `docs/context.md` (`scripts/lib/upgrade-policy.ts:188`). `skills/SKILLS.md` is not protected, so the variant's own `skills/SKILLS.md` clobbers the 63-row registry.
3. **Step 2.4 — region prune**: `scripts/new-project.ts:764-782` runs `prune-country-scoped-assets.ts`; in region-neutral mode it deletes the 6 `k-*` skill dirs (k-dart, k-ecos, k-kosis, k-krx, k-law, k-opendata) from `skills/` and the four platform mirrors.
4. **§6 — late skill-tree sweeps**: legacy L0 skill removal (:1167-1178) and the `l2_propagate: false` sweep over all five skill bases (:1184-1198). These are the **last mutations** of the delivered `skills/` tree.
5. **§7.6-§8**: skill-graph generation (:1339), VERSION_MANIFEST generation with skills↔manifest parity (:1402-1445), then the post-scaffold audit (:1477-1488) which runs the project's own `scripts/audit.ts` → `skill-lifecycle-audit.ts`.

For co-design the delivered tree holds 34 common skill dirs (post-prune) plus the variant-exclusive `service-design` — against a 4-row variant overlay registry. The project's own audit then reports **35 skills scanned, 32 errors**: 31 `Missing skills/SKILLS.md registry row` (:540) plus 1 `Registry last_reviewed drift for accessibility-audit: SKILL.md=2026-09-06, SKILLS.md=2026-09-12` (:572). `audit.ts` Skill audit FAILs on every fresh co-design scaffold.

### 1.2 The audit contract (the acceptance test)

`scripts/skill-lifecycle-audit.ts` enforces a bijection between the delivered `skills/` tree and `skills/SKILLS.md`:

- Missing row for a delivered skill → error (:534-542); version/status/owner/last_reviewed drift between row and SKILL.md frontmatter → errors (:544-575).
- Registry row with no delivered runtime skill → error (:660-669); expired removal-date on a still-present skill → error (:670-679).
- Both directions are guarded by `registryRows.size > 0` (:534, :660). A delivered registry with zero parseable rows silently disables all registry checks (observed: `co-abap`'s overlay uses a `Skill | Directory | Purpose` table that the shape-based parser cannot read — such variants pass weakly, not correctly).

### 1.3 The fix machinery already exists on the upgrade path

`scripts/upgrade-project.ts:2636-2690` (SKILLS_REGISTRY_RECONCILE, born from T-20260922-001) scans the project's `skills/*/SKILL.md` frontmatter with the private helper `extractFrontmatterVersionAndReviewed` (:828-846) and calls `reconcileSkillRegistry` from `scripts/helpers/skills-registry.ts` to update stale rows in place and append rows for newly delivered skills. Only the fresh-scaffold path lacks the equivalent. One gap matters: the existing reconcile **never removes rows** for skills that were not delivered (documented at `skills-registry.ts:118`), while the 63-row common seed registry carries ~29 rows for skills a scaffold never receives (workspace-root skills, pruned `k-*` have no rows but root-only skills do). Without row pruning, the delivered registry would trade 32 errors for ~29 orphan-row errors (:666).

### 1.4 Variant census (decision-relevant)

All 13 variants carry `templates/co-*/skills/SKILLS.md` today. Formats differ: co-design ships a 4-row registry-format overlay that defers to the common index ("All other skills are inherited from `templates/common/skills/`"); co-abap ships a non-registry `Skill | Directory | Purpose` table; co-consult similar category-sectioned shapes. The 3 co-design overlay rows that shadow common skills (accessibility-audit, token-usage-lint, ui-ux-design-intelligence) all exist in the common registry (`templates/common/skills/SKILLS.md:47-49`) with `last_reviewed 2026-09-06` — matching the delivered SKILL.md frontmatter; the overlay's `2026-09-12` is the stale value. The defect class therefore applies to **every variant**, with visibility depending on the overlay's file format.

---

## 2. Goals

- G1. Every fresh scaffold delivers a `skills/SKILLS.md` whose row set equals the delivered `skills/` tree — the project's own `skill-lifecycle-audit` passes with 0 registry errors.
- G2. Reuse the existing reconcile machinery (`scripts/helpers/skills-registry.ts`) so scaffold and upgrade share one render/reconcile path (§13 lesson: the two paths must not diverge).
- G3. Work for all variants and any prune configuration, with no per-variant branching.
- G4. Leave templates, the variant overlay files, and the upgrade path's behavior unchanged.

## 3. Non-goals

- N1. Contract/platform-mirror inventory decisions (T-20260924-002, T-20260924-004, T-20260924-007).
- N2. Upgrade-path behavior changes (SKILLS_REGISTRY_RECONCILE already heals the upgrade case). A follow-up may let upgrade adopt row pruning; this spec does not.
- N3. Changing variant `SKILLS.md` overlay content (co-design maintainers' call). The merge semantics below resolve the shadow drift mechanically; the stale overlay row stays in the template as non-delivery documentation.
- N4. The `k-*` region model and `prune-country-scoped-assets.ts` internals.
- N5. The workspace-root registry (`skills/SKILLS.md` at root) — untouched.

---

## 4. Requirements (ASD-STE100, ADR-0079)

- R1. new-project shall skip `skills/SKILLS.md` in the variant overlay walk. The common registry remains the delivered seed.
- R2. new-project shall reconcile `skills/SKILLS.md` after the last skill-tree mutation and before skill-graph generation.
- R3. The reconcile shall remove registry rows for skills absent from the delivered `skills/` tree.
- R4. The reconcile shall update surviving rows' `version` and `last_reviewed` from the delivered SKILL.md frontmatter.
- R5. The reconcile shall append rows for delivered skills without rows, using SKILL.md frontmatter values.
- R6. Frontmatter collection for the reconcile shall live in `scripts/helpers/skills-registry.ts`. `upgrade-project.ts` shall import the moved parser verbatim (no behavior change).
- R7. The reconcile step shall log added, updated, and pruned rows.
- R8. The reconcile step shall skip with an INFO line when `skills/SKILLS.md` is absent. It shall be non-fatal; the post-scaffold audit is the gate.
- R9. The step shall be idempotent. A second run shall produce no changes.
- R10. `test-new-project.ts` shall assert registry↔tree parity on a real scaffold and a clean project skill audit.

---

## 5. Design decisions

### D1 — Merge semantics: seed-and-reconcile, not reconcile-the-clobbered-file

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Let the overlay clobber, then reconcile the variant file against the delivered tree | No overlay change | Outcome depends on each variant's file format: co-design's 4-row table becomes the insertion anchor and grows mid-file under stale variant prose; co-abap's non-registry shape yields 0 parseable rows, and `reconcileSkillRegistry`'s `lastSkillRowIdx >= 0` guard (`skills-registry.ts:154`) then appends nothing — those variants ship an empty registry and silently disabled audit checks | Rejected |
| (b) Add `skills/SKILLS.md` to `SCAFFOLD_COMMON_OWNED_FILES` | One-set skip, WS-07 enforcement | WS-07 (`validate-templates.ts:3795-3807`) then hard-fails all 13 variants until every variant `SKILLS.md` is deleted; variant-exclusive row provenance lost; large template churn (N3 territory) | Rejected |
| (c) Skip `skills/SKILLS.md` in the overlay walk (local, not via the shared set); the common 63-row registry stays as seed; a post-settle reconcile prunes non-delivered rows, updates drifted rows, and appends missing rows from delivered SKILL.md frontmatter | Uniform output for every variant; the delivered registry is a pure function of the delivered tree; reuses `reconcileSkillRegistry` unchanged; variant SKILLS.md files survive in templates untouched (WS-07 unaffected) | Variant overlay rows no longer reach the delivered registry (their curated `notes` text for variant-exclusive skills is replaced by `—`; audit does not check notes) | **Picked** |

**Shadow resolution (accessibility-audit case).** The delivered row's `version`/`last_reviewed` always come from the delivered SKILL.md frontmatter — exactly the values the audit compares (`skill-lifecycle-audit.ts:544-575`). The overlay's stale `2026-09-12` never enters delivery; the seed row `2026-09-06` matches frontmatter and survives unchanged. Frontmatter wins; the audit is the acceptance test. Remaining columns (`status`, `owner`, `removal-date`, `notes`) for surviving rows keep the seed's values — the same preserve-existing behavior the upgrade path has run since T-20260922-001.

### D2 — Placement: post-settle step in new-project, shared helper, verbatim parser move

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Reconcile immediately after the overlay walk (:735) | Close to the clobber point | Wrong: the tree still changes afterwards — prune (:764) deletes `k-*` dirs, §6 sweeps (:1167-1198) delete L0-only and `l2_propagate: false` skills. The reconcile must see the final tree or it reintroduces orphan rows | Rejected |
| (b) scaffold-markers / `SCAFFOLD_COMMON_OWNED_FILES` contract entry | Reuses an existing SSOT set | That set drives WS-07 (variants must not carry the file at all) — wrong policy for `skills/SKILLS.md`, which variants legitimately carry as template docs. Also cannot express merge semantics | Rejected |
| (c) New post-settle step in new-project (after :1198, before §7.6) calling new helper functions in `scripts/helpers/skills-registry.ts`; move `extractFrontmatterVersionAndReviewed` from `upgrade-project.ts:828-846` into the helper verbatim and import it back | One parse/reconcile/render path shared by scaffold and upgrade; step ordering matches the settle point of the delivered tree; mechanical parser move is behavior-neutral | Touches upgrade-project.ts (import swap only — no semantic change, N2 respected) | **Picked** |

**Exact integration points** (both in `scripts/new-project.ts`):
1. Overlay skip: inside the walk loop at :726-735, alongside the existing `SCAFFOLD_COMMON_OWNED_FILES` skip — `if (relPath === 'skills/SKILLS.md')` → log and `continue`. Local to new-project; the shared policy set is not extended (D1/D2 rationale).
2. Reconcile step: new section immediately after the `l2_propagate: false` skill sweep ends at :1198 and before the workspace-script sweep at :1200 — the first point where the delivered `skills/` tree is final, and upstream of skill-graph (:1339), VERSION_MANIFEST parity (:1402), and the post-scaffold audit (:1477), all of which consume the registry or the tree.

Step body: guard `existsSync(skills/SKILLS.md)` (INFO skip, R7/R8) → `collectDeliveredSkills(projectDir/skills)` → `pruneSkillRegistryRows(content, deliveredNames)` → `reconcileSkillRegistry(content, delivered)` → write back when changed; log `PRUNED`/`UPDATED`/`ADDED` rows.

### D3 — Prune interaction: reconcile sees the final tree and prunes to it

Ordering is fixed by D2(c): overlay skip → prune (:764) → §6 sweeps (:1198) → reconcile. The keep-set is the delivered dir set (dirs containing a `SKILL.md`), so rows disappear for every undelivered skill regardless of reason: region-pruned `k-*`, `l2_propagate: false`, legacy L0, and the ~23 seed rows for workspace-root-only skills that never ship. This satisfies the audit's inverse check (:660-669), which the existing `reconcileSkillRegistry` deliberately does not (it leaves orphan rows, `skills-registry.ts:118`). Edge: a delivered SKILL.md without a parseable `version` keeps its seed row (the keep-set is dir-based, not collect-based) and reconcile skips it — matching upgrade's `if (!fm.version) continue` (:2656).

### D4 — Generalization: driven by the delivered tree, not by any variant

All 13 variants carry `skills/SKILLS.md` today, so all 13 hit this defect (visibility varies by file format — §1.2). The step has no variant knowledge: any variant overlay (registry-format, prose-format, or absent in a future variant) produces the same reconciled registry. `--all-variants` in the E2E harness is the regression net.

### D5 — Regrowth prevention: the detector exists; fix the producer

| Question | Decision |
|---|---|
| New validator? | None required. The post-scaffold audit (`new-project.ts:1477-1488` → project `audit.ts` → `skill-lifecycle-audit.ts`) is the detector that surfaced this defect and stays the permanent gate on every scaffold. The E2E additions (R10) pin the fix. |
| Shared entry point with upgrade? | Yes at the helper level: `collectDeliveredSkills` + the moved frontmatter parser + `reconcileSkillRegistry` give both paths one implementation. Upgrade keeps its current call shape (no prune) — adopting `pruneSkillRegistryRows` on the upgrade path is an explicit follow-up, out of scope (N2). |
| Optional follow-up (not in this scope) | A validate-templates warning when a variant `skills/SKILLS.md` row disagrees with the same-named common SKILL.md frontmatter (staleness signal for variant maintainers). File separately if wanted. |

### D6 — Verification: real scaffolds, audit-clean, all-variants

See §7. The acceptance test is the project's own audit inside a real fresh scaffold — the same instrument that caught the defect.

---

## 6. Platform Impact (MANDATORY)

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None | N/A — no `.claude/` config, hook, or command change; delivery parity verified by E2E `--platform all` |
| Antigravity (GEMINI.md) | None | N/A — justification: the change is inside scaffold tooling and the delivered `skills/SKILLS.md` content; no platform config file, skill registration, or GEMINI.md surface is touched; `.gemini/skills` is only affected by the pre-existing prune sweep, unchanged |
| templates/common | None (propagation) | N/A — no template content changes; `templates/common/skills/SKILLS.md` remains the seed; variant `SKILLS.md` files remain in place (WS-07 unaffected) |

---

## 7. Acceptance criteria

- AC1. A real fresh co-design scaffold's project-local `bun scripts/skill-lifecycle-audit.ts` reports 0 errors (baseline: 32 errors, 35 scanned).
- AC2. In the delivered scaffold, the set of `skills/SKILLS.md` rows equals the set of delivered `skills/*/` dirs (bijection; both audit directions clean).
- AC3. Shadowed skills carry frontmatter values: the delivered `accessibility-audit` row shows the delivered SKILL.md's `last_reviewed` (2026-09-06 lineage), not the overlay's 2026-09-12.
- AC4. The variant-exclusive `service-design` has a registry row built from its SKILL.md frontmatter.
- AC5. No delivered row references an undelivered skill (no `k-*` rows, no workspace-root-only rows) and no expired removal-date rows remain.
- AC6. `bun scripts/test-new-project.ts <name> --variant co-design --platform all` passes the new tests (Test 29 registry↔tree parity; Test 30 project skill-audit clean) and all existing tests 0-28.
- AC7. `bun scripts/test-new-project.ts <name> --all-variants` passes for every variant (no regression; covers co-abap's non-registry overlay shape).
- AC8. Upgrade-path behavior is unchanged: `SKILLS_REGISTRY_RECONCILE` output on an existing project is identical before/after (parser move is verbatim; reconcile call unchanged).
- AC9. Idempotency: running the new reconcile step twice over the same tree produces no second-run changes.
- AC10. Unrelated scaffold flows are unchanged: `blankL0Refs` context handling and Tests 13/19 (gitattributes merge=ours, AGENTS.md Skills injection) still pass.

---

## 8. Implementation plan (for automation-engineer)

### Files to change

| File | Action | Description |
|------|--------|-------------|
| `scripts/helpers/skills-registry.ts` | modify | Add `collectDeliveredSkills(skillsDir)` (scan `<dir>/*/SKILL.md` frontmatter → `{skill, version, status?, owner?, lastReviewed?}`) and `pruneSkillRegistryRows(content, keepNames)` (drop rows whose skill ∉ keep, using `parseSkillRegistryRows` line data; return `{content, pruned}`). Move `extractFrontmatterVersionAndReviewed` here verbatim from upgrade-project.ts, exported. Bump `@version` 1.0.0 → 1.1.0 with a change note. |
| `scripts/new-project.ts` | modify | (1) Overlay skip for `skills/SKILLS.md` in the walk at :726-735. (2) New post-settle reconcile section after :1198 (before the script sweep at :1200): guard, collect, prune, reconcile, write, log (R7-R9). Bump version 1.26.0 → 1.27.0 with a change note referencing this spec. |
| `scripts/upgrade-project.ts` | modify (mechanical only) | Import `extractFrontmatterVersionAndReviewed` from the helper; delete the local copy (:828-846). No other change. Bump version 1.46.0 → 1.46.1 with a "verbatim move" note. |
| `scripts/test-new-project.ts` | modify | Add Test 29 (registry↔tree bijection: parse delivered SKILLS.md rows — shape-based helper or local parse — compare against `skills/` dirs; assert frontmatter values on shadowed names; assert service-design row) and Test 30 (spawn the project's `skill-lifecycle-audit.ts`; assert 0 registry errors). Update the coverage list in the header. Bump version 1.4.0 → 1.5.0. |
| `tests/unit/skills-registry-overlay-reconcile.test.ts` | create | Unit tests for `pruneSkillRegistryRows` (prunes non-kept rows, keeps kept rows with columns intact, handles category-sectioned and empty tables) and `collectDeliveredSkills` (frontmatter extraction, version-less skip) on temp fixtures. |
| `scripts/SCRIPTS.md` | modify | Cascade version rows: `helpers/skills-registry.ts` (row 85, 1.0.0 → 1.1.0), `new-project.ts` (row 204, 1.26.0 → 1.27.0), `upgrade-project.ts` (1.46.0 → 1.46.1), `test-new-project.ts` (row 230, 1.4.0 → 1.5.0) with one-line notes citing this spec. |

### Execution order

Sequential: helper → new-project → upgrade-project import swap → E2E + unit tests → SCRIPTS.md → `/sync "fix(scaffold): reconcile delivered skills registry after variant overlay (T-20260924-008)"`.

### Verification protocol (execute before hand-off)

1. `bun scripts/test-new-project.ts T008-design --variant co-design --platform all` → all tests pass (AC1, AC6).
2. `bun scripts/test-new-project.ts T008-all --all-variants` → every variant passes (AC7).
3. In one scratch scaffold: run the project's `bun scripts/skill-lifecycle-audit.ts` directly → 0 errors (AC1); re-run new-project's reconcile logic path or re-scaffold → idempotent (AC9).
4. Existing project (any real project dir): run upgrade-project in dry-run before and after the change → identical SKILLS_REGISTRY_RECONCILE output (AC8).
5. `bun test tests/unit/skills-registry-overlay-reconcile.test.ts` → green.

---

## 9. Exemptions

- **Accessibility (ADR-0065): EXEMPT.** This change is backend scaffold tooling and a machine-parsed markdown registry. No user-facing web/app/CLI/document UI is produced; no interaction areas are affected.
- **Preview verification (ADR-0070): EXEMPT.** Nothing here renders in a browser or GUI. Verification evidence is command output from the §8 protocol, attached to the implementation PR.

---

## 10. Residual risks

- A surviving seed row's `status`/`owner` can drift from the delivered SKILL.md frontmatter (`reconcileSkillRegistry` preserves existing-row `status`/`owner`, `skills-registry.ts:146-147`). This is inherited upgrade-path behavior, unchanged by this spec; the workspace root's own audit governs seed quality. If it bites, extend reconcile's existing-row update to cover `status`/`owner` — one change, both paths benefit.
- Variant overlay `notes` prose for variant-exclusive skills is not carried into the delivered registry (reconcile emits `—` for missing notes). Accepted: notes are template-side curation; SKILL.md descriptions remain the project-side documentation.

## References

- `tickets/governance/T-20260924-008.yaml` (verified mechanism, live reproduction)
- `scripts/new-project.ts` (:596, :711-735, :764-782, :1167-1198, :1339, :1402-1445, :1477-1488)
- `scripts/skill-lifecycle-audit.ts` (:534-577, :660-681)
- `scripts/helpers/skills-registry.ts` (:59-89, :96-110, :123-168)
- `scripts/upgrade-project.ts` (:828-846, :2636-2690)
- `scripts/lib/upgrade-policy.ts` (:180-188); `scripts/validate-templates.ts` (:3795-3807)
- ADR-0055/ADR-0074 (spec gate), ADR-0065/ADR-0070 (exemptions), ADR-0079 (STE)
