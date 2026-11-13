---
schemaVersion: 1.0.0
spec-id: 2026-11-13-skill-audit-self-managed-registry-design
---

# Design: skill-lifecycle-audit registry check vs self-managed skills

- **Spec ID**: 2026-11-13-skill-audit-self-managed-registry-design
- **Date**: 2026-11-13
- **Status**: Implemented. Approved by the user and PM with option A + U + D3; D4 is tracked as T-20261113-003.
- **Owner**: architect (dispatched by PM)
- **Ticket**: T-20261113-002 (`tickets/governance/T-20261113-002.yaml`)
- **Tier**: L0 + generated L1 mirror (`templates/common/scripts/`). The change reaches projects through `upgrade-project`.
- **Found by**: the co-work upgrade on 2026-11-13 (ai-workspace-standards#2002, co-work#49).

## 1. Problem

A project can track a self-managed skill directory and also carry a `skills/SKILLS.md` row for that skill. An example is `skills/graft/SKILL.md` plus a `graft` row. In that case `scripts/skill-lifecycle-audit.ts` v1.13.0 fails with this error and exits 1:

```
✖ ERROR: Registry row has no matching runtime skill: graft
   Fix: Remove the graft row from skills/SKILLS.md or restore skills/graft/SKILL.md
```

The fix hint contradicts itself: `skills/graft/SKILL.md` is present. The audit runs in `/sync` and in pre-commit, so the error blocks commits. `scripts/audit.ts:1036-1042` also runs it with `--json` and passes only when the output has `"errors": []`, so the project's full audit fails too.

**Reproduction (2026-11-13)**: I exported co-work `origin/main` (c12377f) with `git archive` to `/tmp/cowork-repro.11Y6KH`. The delivered audit there is byte-identical to the current L1 copy.

| State | Exit | Output |
|---|---|---|
| No `graft` row (current co-work) | 0 | `Skills found: 42`, `All 42 skills healthy` |
| Original row re-inserted (`` | `graft` | 1.0.0 | active | pm | 2026-10-01 | — | — | ``, from co-work a9c1d79) | 1 | `Registry row has no matching runtime skill: graft` |

The workaround deletes the row. That workaround does not last, because `upgrade-project` re-adds the row on every upgrade (section 2.3).

## 2. Root cause (file:line evidence)

All line numbers refer to origin/main f2fc399b2.

### 2.1 The audit skip comes before the runtime-name collection

`scripts/skill-lifecycle-audit.ts` (v1.13.0; the L1 mirror `templates/common/scripts/skill-lifecycle-audit.ts` is byte-identical):

- Line 605: `const runtimeSkillNames = new Set<string>();`
- Line 629: `if (isSelfManagedPath(relPath)) continue;` is the loop-top skip.
- Line 643: `if (frontmatter.name && !isPlatformSkill) runtimeSkillNames.add(frontmatter.name);`. Self-managed skills never reach this line.
- Lines 977-986: the inverse registry check loops over every row of `skills/SKILLS.md`. It raises `Registry row has no matching runtime skill: <name>` for any name that is not in `runtimeSkillNames`.

`runtimeSkillNames` has no other consumer: it appears only at lines 605, 643 and 979.

**Regression origin**: commit 7b4e1a21c (v1.11.0, T-20261108-004, 2026-11-08) added the loop-top skip at line 629. Its purpose was to exempt vendored external-deps clones (`external/<id>/`) from every authoring check. Before v1.11.0, graft skills reached line 643 and were added to `runtimeSkillNames`. The owner and registry checks exempted them individually. So the inverse check accepted a `graft` row before v1.11.0.

### 2.2 Side effects of the same skip

- **Dead code**: the later `isSelfManagedPath` arms at lines 670, 720, 865, 942 and 951 can no longer be reached. One result is that the self-managed lifecycle INFO line at lines 951-955 never prints. The `scripts/SCRIPTS.md` v1.5.2 history still says that it prints.
- **Count over-claim**: line 617 prints `Skills found: ${skillFiles.length}`, and line 1039 passes the same number to `generateSummary`. `findSkillFiles` (lines 283-316) has no self-managed filter. The count therefore *includes* the skipped skills, and the summary says "All 42 skills healthy" although only 41 were audited. The brief said that the count *excludes* them. The code shows the reverse: the count includes them, but they are never audited.

### 2.3 Sibling arm: upgrade-project re-synthesizes the row

`scripts/upgrade-project.ts` v1.104.0 (L0-only, no L1 mirror), step `SKILLS_REGISTRY_RECONCILE`, lines 7609-7671:

- Lines 7624-7637 collect every `skills/<name>/SKILL.md` that has a `version:`. There is no self-managed filter.
- Line 7644 calls `reconcileSkillRegistry` (`scripts/helpers/skills-registry.ts:163`, layer L0+L1). That function appends a row for each collected skill that has no row (lines 199-208).

A probe of `reconcileSkillRegistry` against co-work's current registry returned `{"added":["graft"],"updated":[]}`. Every upgrade therefore re-adds the `graft` row, and the project's next audit fails.

This explains the co-work#49 record. Its PR body says that it removed the `graft` row. Its merged diff leaves the graft-row count at 0 on both sides (9402d9a and c12377f). The upgrade added the row during the session, the audit failed, and the row was removed before commit.

### 2.4 Other checks reviewed

| Check | Location | Affected? | Reason |
|---|---|---|---|
| Inverse registry check (row has no runtime skill) | `skill-lifecycle-audit.ts:977-986` | **Yes, primary** | See 2.1 |
| Check RD (expired removal-date) | `skill-lifecycle-audit.ts:987-996` | No failure today | It runs per row, in the same loop, with no dependency on runtime names. A self-managed row with an expired removal date still raises RD. That is correct: the row is project-authored data. |
| Version/status/owner/last_reviewed drift | `skill-lifecycle-audit.ts:720-763` | No | Unreachable for self-managed skills (dead arm). Drift is never checked for them. That is intended, because the tool owns the frontmatter. |
| Missing-row check (skill has no row) | `skill-lifecycle-audit.ts:722-728` | No | Unreachable for self-managed skills, so a row is not required. That is intended. |
| `upgrade-project` registry reconcile | `upgrade-project.ts:7609-7671` | **Yes, sibling** | See 2.3 |
| `sync-skill-registries.ts` (L0-only) | `planRootRegistry`, lines 79-100, via `listSkillDirs`/`collectDeliveredSkills` | Latent only | It scans root `skills/` with no self-managed filter. L0 has no `skills/graft/` (the L0 skill is `skills/trail/`, which is not self-managed), so nothing fires today. If a contributor ran a graft-era init at L0, this tool would require a row that the audit tolerates (option A) or forbids (option C). This design records the risk and makes no change. |
| `validate-templates.ts` SKILLS.md checks | lines 5980-6093 | No | They read `templates/<variant>/skills/` only. No template ships graft: commit cb5ac4728 withdrew it. |
| Skill graph (`generate-skill-graph.ts`, `verify-skill-graph.ts`, `skill-graph-fleet-report.ts`) | n/a | No | No registry-row gate. A project graft dir can show up as a graph node. That is informational, not a failure. |
| `new-project.ts` scaffold prune (`pruneRegistryRows`) | `helpers/skills-registry.ts` | No | Templates do not deliver `skills/graft/`, so fresh scaffolds have neither the dir nor the row. |

### 2.5 Affected scope (fleet, 2026-11-13)

Five projects track `skills/graft/SKILL.md` with a `version:`: co-develop (1.1.0), co-export, co-game, co-price and co-work (1.0.0 each). None of them has a `graft` row today.

- On 2026-11-08, the day v1.11.0 landed, the graft row was removed in the upgrade commits of co-export (fa07242), co-game (97378f4), co-price (005c55f) and co-work (5ff7f5a, co-work PR #40). None of the four commit messages mentions the removal.
- co-work#49 (2026-11-13) hit the same failure again, as described in 2.3.
- co-develop removed its row on 2026-10-03 (graft withdrawal). Its graft dir came back on 2026-10-31, and the project has had no upgrade since then. Its next upgrade would hit this failure.

**Correction to the brief**: the bug is not "co-work only". Four projects hit it and worked around it silently on 2026-11-08. The brief also says that co-work#49 removed the row. The row was first removed in co-work PR #40. #49 removed only a transient row that its own upgrade had re-added.

**Not affected**:

- `skills/trail/` is the tracked SSOT and is deliberately not in the self-managed set (`scripts/lib/self-managed-tools.ts:65-68`).
- No project has a registry row for an external-deps vendored skill today.

## 3. Background: what "self-managed" means for skills

The self-managed path set comes from `scripts/lib/self-managed-tools.ts` (L0+L1, v1.3.1). It is the union of three sources:

1. The built-in `DEFAULT_SELF_MANAGED_PATHS` (lines 70-85). It includes `skills/graft/` and applies even when no registry file exists.
2. `docs/self-managed-surfaces.json`, which exists at L0 only.
3. In project mode, the `install_dirs` from the project's `external-deps.json` (lines 156-173).

The registry doctrine says: "validators skip them, and templates do not ship them". The v1.11.0 comment at `skill-lifecycle-audit.ts:717-719` says: "no project SKILLS.md registry row exists for upstream skills". The doctrine therefore treats rows for self-managed skills as *not required*. Before v1.11.0, rows were *tolerated*. Nothing documents a decision that forbids them.

## 4. Options

### Option A: skip self-managed names in the inverse registry check (tolerate rows)

At the loop-top skip, record the skill name in a new set `selfManagedSkillNames`. Use the frontmatter `name` when it parses, and the directory basename otherwise (vendored SKILL.md files can lack valid frontmatter). In the inverse check, skip a row when its name is in `selfManagedSkillNames`. Print one INFO line: the row belongs to a self-managed skill and is not validated. Check RD keeps running for every row.

- **Blast radius**: one L0+L1 pair (`skill-lifecycle-audit.ts`). About 10 lines.
- **trail**: no change. `skills/trail/` is not self-managed and stays fully audited.
- **external-deps**: every v1.11.0 exemption stays. A row for a vendored skill becomes tolerated instead of an ERROR. No such row exists today.
- **co-work workaround**: stays valid. The row can stay deleted, and restoring it no longer fails.
- **Gap**: `upgrade-project` still re-adds rows for self-managed dirs. Under A they no longer fail, but the registry gains unvalidated rows with an empty owner cell on each upgrade.

### Option B: add self-managed skills to `runtimeSkillNames` and keep their other exemptions

Parse the frontmatter before the loop-top skip and add the name to `runtimeSkillNames`, then `continue`.

- **Blast radius**: the same pair. The diff is smaller than A.
- **Behaviour**: the same as A for the inverse check. It restores the exact pre-v1.11.0 semantics.
- **Cost**: the set changes meaning from "audited runtime skills" to "present skills". Without a second set the INFO line is not possible, and section 2.2's honest count needs a separate counter anyway.
- **trail / external-deps / co-work workaround**: the same as A. The `upgrade-project` gap is also the same.

### Option C: make the policy explicit, with every tool consistent

- **C-forbid**: self-managed skills must not have registry rows.
  - The inverse check raises a targeted message: "self-managed skill `<name>` must not have a registry row (tool-owned)".
  - `upgrade-project` stops synthesizing the rows.
  - `sync-skill-registries.ts` skips self-managed dirs.
  - The co-work workaround (row deleted) becomes the canonical state. It is already the state in all five projects.
  - Blast radius: the audit pair, `upgrade-project.ts`, and optionally `sync-skill-registries.ts`.
  - Risk: a data-only condition becomes a fleet ERROR again. The fail-safe direction of `self-managed-tools` is "config can only add exclusions"; C-forbid reverses it.
- **C-require**: every self-managed skill must have a row. **Rejected.** It contradicts DEC-20261106-04 (vendored upstream skills are "consumed as-is", with no workspace rows). It also contradicts the self-managed doctrine (validators do not police tool-owned frontmatter). Rows for upstream skills would have no owner and no reviewed date.

### Comparison

| Criterion | A | B | C-forbid |
|---|---|---|---|
| Fixes the failing audit | Yes | Yes | Yes (clearer error, still an error if a row exists) |
| Stops re-synthesis on upgrade | No (needs U) | No (needs U) | Yes (includes U) |
| Files (L0) | 1 (+L1 mirror) | 1 (+L1 mirror) | 2-3 (+L1 mirror) |
| trail | Unaffected | Unaffected | Unaffected |
| external-deps exemptions | Kept | Kept | Kept; rows become errors |
| co-work workaround | Optional | Optional | Mandatory and canonical |
| Fail-safe direction | Yes | Yes | No |

**U** is the `upgrade-project` arm: skip self-managed skill dirs in `SKILLS_REGISTRY_RECONCILE`. It is independent of the audit choice and is L0-only.

## 5. Recommendation

**Option A + U.**

1. **Audit (A)**: tolerate rows for self-managed skills. They are not required, not validated, and not an error. Print one INFO line per tolerated row.
2. **Upgrade (U)**: `upgrade-project` stops synthesizing rows for self-managed skill dirs. Fix it in `upgrade-project.ts` and not in the shared `reconcileSkillRegistry` helper. That keeps the blast radius to one L0-only file and leaves the other helper callers unchanged (new-project, sync-skill-registries, generate-skill-lifecycle-records, validate-templates, verify-platform-lifecycle).
3. **Honest count (optional, decision D3)**: print `Skills found: N (M self-managed, not audited)` and pass `N - M` to `generateSummary`. This is the same over-claim class that U-20261028-011 fixed.

The canonical state after the fix is "no row". That matches the doctrine and the current state of all five projects. A row that is present is still harmless. **Why A over B**: A keeps `runtimeSkillNames` meaning "audited", and it makes the INFO line and the count fix possible without a second mechanism. **Why not C-forbid**: it adds a new fleet ERROR for a harmless data condition, and no recorded decision forbids these rows.

**Non-goals**:

- Removing the dead `isSelfManagedPath` arms (2.2). They are harmless and defensive.
- Changing `sync-skill-registries.ts` (latent at L0 only).
- Changing `reconcileSkillRegistry` semantics.

A follow-up ticket can cover the dead arms and the stale v1.5.2 history claim (decision D4).

## 6. Exact file list

### 6.1 Hand-edited (L0, root PR)

| File | Action | Change |
|---|---|---|
| `scripts/skill-lifecycle-audit.ts` | modify | v1.13.0 → v1.14.0. Add `selfManagedSkillNames`, filled at the line-629 skip. Inverse check at lines 977-986 skips those names and prints INFO. RD unchanged. (D3) Report the self-managed count and the audited count. Add a header history entry citing T-20261113-002 and this spec. |
| `scripts/upgrade-project.ts` | modify | v1.104.0 → v1.105.0. Import `isSelfManagedPath` from `./lib/self-managed-tools.ts`. In the lines 7624-7637 loop, add `continue` when `isSelfManagedPath(\`skills/${skillName}/SKILL.md\`, projectDir)` is true. **`rootDir` must be `projectDir`**, because upgrade runs with cwd = workspace root. Print one INFO line per skipped dir. Add a header history entry. |
| `tests/unit/skill-lifecycle-audit-self-managed-registry.test.ts` | create | Regression test, see 6.3 |
| `tests/unit/upgrade-project-self-managed-registry.test.ts` | create | See 6.3 |
| `scripts/SCRIPTS.md` | modify | Version and history cells for both rows (`skill-lifecycle-audit.ts` 1.14.0, `upgrade-project.ts` 1.105.0) |
| `docs/lifecycle/scripts/upgrade-project.md` | modify | Version entry (the record exists; `skill-lifecycle-audit.ts` has no script lifecycle record) |
| `docs/designs/2026-11-13-skill-audit-self-managed-registry-design.md` + `docs/specs/registry.json` | this doc | Status update to `implemented` at landing |
| `tickets/governance/T-20261113-002.yaml` | this ticket | Moves through the board |

### 6.2 Script-generated (never hand-edited)

| File | Generator |
|---|---|
| `templates/common/scripts/skill-lifecycle-audit.ts` | `bun scripts/propagate-to-templates.ts --apply` (byte-identical L1 mirror; layer `L0+L1` in SCRIPTS.md) |
| `templates/common/scripts/SCRIPTS.md` | `generate-scripts-mirror.ts` (dev-sync step 2.6) |
| `docs/VERSION_MANIFEST.md`, `CHANGELOG.md`, `memory/2026-11-13.md` | `/sync` pipeline |

`upgrade-project.ts` has no L1 mirror (it runs from the workspace root), so U has no template footprint. `scripts/lib/self-managed-tools.ts` (L0+L1) does not change.

### 6.3 Tests

**`tests/unit/skill-lifecycle-audit-self-managed-registry.test.ts`** builds `mkdtemp` fixture projects: no `CONSTITUTION.md` (project mode), and not inside a git repo. Each case spawns `bun <abs>/scripts/skill-lifecycle-audit.ts --json` with `cwd` set to the fixture. The fixture has a `skills/SKILLS.md` `## Registry` table and one normal skill (`skills/demo/SKILL.md` with name, owner, status, version, last_reviewed and scope) plus its row.

| # | Fixture | Expectation | Today |
|---|---|---|---|
| T1 | + `skills/graft/SKILL.md` (graft-era frontmatter, no owner) + `graft` row | exit 0; no "Registry row has no matching runtime skill" | **Fails (exit 1)**. This is the regression test. |
| T2 | + `skills/graft/SKILL.md`, no row | exit 0 | passes |
| T3 | `ghost` row with no `skills/ghost/` dir | exit 1 with "no matching runtime skill: ghost" | passes (guards against over-masking) |
| T4 | `external-deps.json` (`install_dir: external/vend`) + `external/vend/skills/vend/SKILL.md` without owner, no row | exit 0 | passes (v1.11.0 guard) |
| T5 | T4 + `vend` row | exit 0 | fails today |
| T6 | (D3 only) T2 output | `Skills found: 2 (1 self-managed, not audited)`; summary counts 1 | fails today |

**`tests/unit/upgrade-project-self-managed-registry.test.ts`**:

- **(a)** Behavioural check: `isSelfManagedPath("skills/graft/SKILL.md", fixtureDir)` is true when `process.cwd()` is a different directory. Also true for `external/vend/skills/vend/SKILL.md` with the fixture's `external-deps.json`. This pins the `rootDir` contract that U relies on.
- **(b)** Source-structure pin: the `SKILLS_REGISTRY_RECONCILE` block calls `isSelfManagedPath(` with `projectDir`.

A full upgrade-project spawn runs the whole delivery engine, as `upgrade-project-tenant-guard.test.ts` notes. That belongs to the real-run verification in section 8, not to the unit suite.

## 7. PR split plan (CLAUDE.md section 9)

**One root PR.** Section 9 forbids hand edits to workspace-root files and template files in one task. The only template file here is the L1 mirror `templates/common/scripts/skill-lifecycle-audit.ts`. That mirror is **script-generated output** from `propagate-to-templates.ts --apply`. The "script-generated outputs" exception therefore applies. The "validator-forced atomicity" exception does **not** apply, because nothing under `templates/` is hand-edited.

Precedents for this exact pattern (L0 edit plus generated L1 mirror in one root commit):

- 7b4e1a21c: the T-20261108-004 fix that introduced this bug. It changed `scripts/skill-lifecycle-audit.ts`, `templates/common/scripts/skill-lifecycle-audit.ts` and the lib pair together.
- f11827a0f: dev-sync v1.47.0, U-005 PR-3. It changed `scripts/dev-sync.ts` and `templates/common/scripts/dev-sync.ts`.
- Design `2026-10-03-validator-warning-fixes-design.md`: "single root PR (L0 change + generated L1 mirror copies)", with mirrors "never hand-edited (CLAUDE.md §9)".

**Parity enforcement and ordering**: dev-sync step 3.7 runs `bun scripts/verify-scripts.ts --check-drift`. It is BLOCKING and runs **before** the step 4.5 publish (`propagate-to-templates.ts --apply`). An L0-only edit therefore fails step 3.7. The implementer must use this order:

1. Edit L0.
2. Run `bun scripts/propagate-to-templates.ts --apply`.
3. Confirm with `bun scripts/verify-scripts.ts --check-drift` that the output says "No unintentional drift (N L0/L1 pairs in sync)". On origin/main today it reports 143 pairs.
4. Run `/sync`.

`lifecycle-sync-audit` Check B separately pins the SCRIPTS.md version cells between L0 and L1.

**Sequencing**: the CONSTITUTION §3.3 sequential-branch rule applies. Merge any open PR from the same session before this branch runs `/sync`.

## 8. Acceptance criteria

1. T1-T5 pass. T6 passes if D3 is accepted. T1 fails on origin/main f2fc399b2.
2. A fixture with `skills/graft/SKILL.md` and a `graft` row passes `skill-lifecycle-audit.ts` with exit 0.
3. A registry row whose skill dir is missing, and is not self-managed, still raises ERROR.
4. External-deps vendored skills keep every v1.11.0 exemption: frontmatter, owner, registry, model literals and lifecycle.
5. `upgrade-project` does not add a registry row for a self-managed skill dir. It adds rows for normal skills as before.
6. `templates/common/scripts/skill-lifecycle-audit.ts` is byte-identical to `scripts/skill-lifecycle-audit.ts`, and `verify-scripts.ts --check-drift` exits 0.
7. `bun run test:unit` passes. `bun scripts/audit.ts` passes. `bun scripts/skill-lifecycle-audit.ts` at L0 reports no new ERROR.
8. `scripts/SCRIPTS.md` rows and both script headers carry the new versions and cite T-20261113-002.

## 9. Verification plan

1. **Unit**: run `bun run test:unit` (required before `/sync` whenever a script version is bumped) and the two new test files.
2. **Real run, audit**:
   - Export co-work `origin/main` with `git archive` into a fresh `mktemp -d` directory (read-only for the project).
   - Re-insert the pre-#40 row from co-work a9c1d79: `` | `graft` | 1.0.0 | active | pm | 2026-10-01 | — | — | ``.
   - Copy the fixed `scripts/skill-lifecycle-audit.ts` into the export.
   - Expect exit 0 and one INFO line for `graft`.
   - Today's code exits 1 (section 1, reproduced in `/tmp/cowork-repro.11Y6KH`).
   - Repeat without the row: expect exit 0.
3. **Real run, upgrade**:
   - Run `bun scripts/upgrade-project.ts <export-dir> --dry-run` against the same export, with the row removed.
   - Expect no `ADDED ROW: graft` line, plus the new INFO skip line.
   - Today the reconcile probe returns `added: ["graft"]`.
   - If the target-path guards (tenant guard, fleet path checks) refuse a `/tmp` target, run the same dry-run against `Projects/co-work` itself. A dry run writes nothing; confirm that `git -C Projects/co-work status` is unchanged afterwards.
4. **Fleet dry-run expectation**:
   - Run a dry-run upgrade across the fleet member projects (`docs/fleet-membership.json`).
   - Expect `ADDED ROW: graft` for none of co-develop, co-export, co-game, co-price and co-work. Expect no new audit ERROR.
   - No other project has a self-managed skill dir, so their reconcile output must be unchanged.
   - No project needs a manual registry edit.
5. **Mirror**:
   - Run `bun scripts/verify-scripts.ts --check-drift`: exit 0.
   - Run `cmp scripts/skill-lifecycle-audit.ts templates/common/scripts/skill-lifecycle-audit.ts`: identical.

## 10. Delivery to projects

- **U (`upgrade-project.ts`)** is L0-only. It runs from the workspace root against each project. It takes effect for every upgrade after merge, with no delivery step.
- **A (`skill-lifecycle-audit.ts`)** reaches projects through `upgrade-project`'s scripts delivery. That delivery copies `templates/common/scripts/*.ts` into the project `scripts/`, protected by the E3 template-vintage provenance (v1.102.0). co-work's delivered copy is byte-identical to the current L1 copy, so the next upgrade overwrites it cleanly.
- A project with a locally patched copy surfaces as CONFLICT or `PROJECT_AHEAD`, as usual. None is known.
- One upgrade run delivers the fixed audit and also stops re-synthesis, so the order is safe in either direction.
- **No project-side step is needed.** Projects should not restore the deleted `graft` rows: "no row" is the canonical state. A restored row would be tolerated.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Over-masking: a self-managed name equals the name of a deleted project skill, so a stale row is hidden | Low likelihood (the names are `graft` or upstream ids). The INFO line still names the row. T3 guards the general case. |
| `isSelfManagedPath` cache is single-slot per `rootDir` (`self-managed-tools.ts:103`); U calls it with `projectDir` inside an L0-cwd process | The cache rebuilds when `rootDir` changes. Pass `projectDir` explicitly every time. Test (a) pins this. |
| Wrong `rootDir` (cwd = L0) in U would miss the project's `external-deps.json` | Test (a) and the real dry-run (section 9 step 3) |
| D3 changes summary text that someone may grep | `test-new-project` Test 30 asserts error count only. `audit.ts:1038` matches `"errors": []` in the JSON, not the summary text. No test greps "skills healthy" (checked 2026-11-13). |
| An INFO line printed in `--json` mode would corrupt the JSON that `audit.ts:1037` parses | Print INFO lines only when `!jsonMode`, as the existing LC INFO line does (lines 951-955). T1 runs with `--json` and parses the output. |
| Step-3.7 ordering trap (drift check before publish) | Section 7 ordering, put in the implementer brief |
| `sync-skill-registries` asymmetry stays latent at L0 | Recorded in 2.4. It fires only if a graft-era dir appears at L0. |

## 12. Decisions for the user (not decided here)

- **D1. Policy for rows of self-managed skills.** Tolerate (option A, recommended) or forbid (option C-forbid). This sets whether a present row is INFO or ERROR.
- **D2. Scope of the PR.** Include the `upgrade-project` arm U in the same PR (recommended: both are L0, and A alone leaves the upgrade re-synthesis loop), or land A first and U separately.
- **D3. Honest count.** Include the "Skills found: N (M self-managed, not audited)" and summary fix (recommended, about 3 lines), or defer it.
- **D4. Follow-up.** Open a separate ticket to remove the dead `isSelfManagedPath` arms and correct the stale SCRIPTS.md v1.5.2 claim, or leave it.

## 13. Platform Impact

| Platform | Impact | Files Affected |
|---|---|---|
| Claude Code | None. The audit runs through `bun` in `/sync` and pre-commit on every platform. | N/A |
| Antigravity (GEMINI.md) | None. The same scripts run through the same hooks. No instruction-file or command change. | N/A |
| templates/common | Propagation required (script-generated L1 mirror only) | `templates/common/scripts/skill-lifecycle-audit.ts`, `templates/common/scripts/SCRIPTS.md` |

Cross-platform: pure TypeScript path logic. `isSelfManagedPath` normalizes backslashes, so Windows paths behave the same.

## 14. Accessibility

Exempt. This is a non-UI validator and upgrade-tool change, with no user-facing interface (ADR-0065 explicit-statement exemption).

## 15. Preview verification

Exempt. There is no rendered web or app UI (ADR-0070 explicit-statement exemption).
