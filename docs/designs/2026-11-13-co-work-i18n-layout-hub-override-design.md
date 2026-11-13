---
schemaVersion: 1.0.0
spec-id: 2026-11-13-co-work-i18n-layout-hub-override-design
---

# Design: co-work hub override of the common `i18n-layout` skill

- **Spec ID**: 2026-11-13-co-work-i18n-layout-hub-override-design
- **Date**: 2026-11-13
- **Status**: Implemented. Approved by the user and PM (option A, line 92 verbatim).
- **Owner**: architect (dispatched by PM)
- **Tier**: L2 (`templates/co-work`). Root files are limited to this design document, its spec-registry entry, and `/sync` pipeline outputs.
- **Blast radius**: one project. `Projects/co-work` is the only fleet project on the co-work variant.

## 1. Problem

`templates/common/skills/i18n-layout/SKILL.md` (v1.1.1, owner `i18n-specialist`) line 92 tells every project to delegate HWP document work to the co-work hub. That wording is correct for spoke projects. It is wrong for the hub itself.

The hub project copy `Projects/co-work/skills/i18n-layout/SKILL.md` (v1.1.0, owner `pm`, `last_reviewed: 2026-11-07`) evolved locally. Its line 92 says that the co-work `hwp-document-processing` skill provides HWP authoring and conversion through the `scripts/hwp/` adapter. The co-work project decision `Projects/co-work/docs/decisions/DEC-20261107-01.md` adopted that capability as L3 project-local and deferred template promotion.

The project copy differs from common in 4 lines: `version`, `owner`, `last_reviewed`, and line 92.

`upgrade-project` classifies the file as project-evolved since the last delivery, with the template also changed. The result is a CONFLICT (ERROR). Delivery is skipped and the run exits 1.

Measured baseline (`bun scripts/upgrade-project.ts Projects/co-work --dry-run`, shared checkout at `2ca0336b5`, read-only):

```
⏭️  CONFLICT DISPOSITION (SKIP): skills/i18n-layout/  1.1.0 → 1.1.1  (pass: SYNC_IF_NEWER: skills/)
baseline: 1ee0e5afd044… (template 0.28.0)
Decision log: 519 entries (INFO 339 / WARN 179 / ERROR 1)   exit=1
```

## 2. Decision

**User decision (given)**: resolve the conflict with a **hub override**. This is a variant-own copy at `templates/co-work/skills/i18n-layout/` that shadows the common skill for co-work.

**Architect finding (needs a user ruling, §10 Q1)**: a templates-only override **cannot** clear the CONFLICT on a plain upgrade run. The co-work project needs exactly **one** explicit grant, `--disposition adopt-template=skills/i18n-layout/**`, on the first upgrade after the override ships. After that, upgrades run clean. §4 shows the mechanism and §7 shows the simulation evidence.

**Proposed design (Option A, recommended within the templates-only scope)**:

1. Create `templates/co-work/skills/i18n-layout/SKILL.md` as a byte copy of common v1.1.1, with exactly four changed lines:
   - `version: 1.1.2`: strictly ahead of common. This is required by the engine (§4.3) and matches every precedent override that works (§3).
   - `last_reviewed: 2026-11-13`.
   - `scope: co-work`: required frontmatter. All 13 precedent overrides use `scope: <variant>`.
   - Line 92: the hub project's line 92, verbatim. **This is the only intentional content diff.**
2. Keep `owner: i18n-specialist`, aligned with common. The lifecycle-record generator's owner rule allows it (§3.3).
3. Mirror the override into the five platform skill mirrors with `sync-skills`, and register it in `variant.json` `skills[]` and the curated `skills/SKILLS.md`, as the precedents do.
4. Run the co-work upgrade wave once with the adopt grant. The grant is a recorded decision, and it is the engine's own resolution route ("How to proceed" option 1). It loses nothing: the override contains the project's line 92 verbatim, and the only other project-only lines are frontmatter values (`version: 1.1.0`, `owner: pm`, `last_reviewed: 2026-11-07`). This design rejects those values with a reason (superseded metadata).

## 3. Precedent analysis

### 3.1 Inventory of existing variant overrides of common skills

| Override | Variant version | Common version | Variant owner | Variant scope | Effective in project? |
|---|---|---|---|---|---|
| co-design/accessibility-audit | 1.1.0 | 1.1.0 | pm | co-design | equal version: DRIFT_PRESERVE |
| co-design/design-foundation | 1.3.0 | 1.1.1 | architect | co-design | yes (ahead) |
| co-design/service-design | 1.1.0 | 1.1.0 | pm | co-design | equal version |
| co-design/token-usage-lint | 1.1.1 | 1.1.0 | pm | co-design | yes (ahead) |
| co-design/ui-ux-design-intelligence | 1.0.2 | 1.0.1 | pm | co-design | yes (ahead) |
| co-price/i18n-audit | 2.1.0 | 1.0.1 | l10n-auditor | co-price | yes (ahead); the project carries 2.1.0, `scope: co-price` |
| co-safety/project-review | 1.3.4 | 1.3.2 | pm | co-safety | yes (ahead); the project carries 1.3.4 |
| co-safety/skill-lifecycle-manager | 1.5.1 | 1.5.0 | pm | co-safety | yes (ahead) |
| co-safety/meeting-facilitation | 1.5.0 | 1.5.0 | pm | co-safety | equal version |
| co-safety/sync | 1.6.0 | 1.9.1 | pm | co-safety | **no**: the project carries common 1.9.0, `scope: common` |
| co-safety/script-lifecycle-manager | 1.2.0 | 1.2.2 | pm | co-safety | **no**: the project carries common 1.2.2 |
| co-safety/team-builder | 1.1.1 | 1.2.0 | pm | co-safety | **no**: the project carries common 1.2.0 |
| co-safety/translate | 1.0.2 | 1.0.3 | pm | co-safety | **no**: the project carries common 1.0.3 |

Conventions taken from the precedents:
- `scope: <variant>` in every override.
- An entry in `variant.json` `skills[]` for every override.
- A row in the curated `skills/SKILLS.md` for every override.
- Byte mirrors in all five platform mirror directories (`.claude/.gemini/.agents/.codex/.hermes/skills/`).
- An override is effective only while its version is **at or above** common. Overrides that lag common are silently replaced in the project by the common copy. That is the co-safety failure mode in §8.

### 3.2 How upgrade-project resolves variant-over-common precedence

- **Scaffold and tree passes**: `iterEffectiveTemplateFiles` (`scripts/lib/upgrade-policy.ts:860`) overlays the variant on common, and the variant wins. This applies to `new-project`, `adopt-plan`, `check-upgrade-coverage`, and the TEMPLATE TREE SYNC pass.
- **Skills are not handled there.** Two dedicated passes deliver them, in this order:
  1. `SYNC_IF_NEWER: skills/` (`scripts/upgrade-project.ts:5600`) iterates `templates/common/skills/`. **It has no variant-shadow skip.** It compares the common version with the project version.
  2. `VARIANT SKILLS` (`scripts/upgrade-project.ts:5918`) iterates `templates/<variant>/skills/` with the same version-gated and baseline-classified logic.
- Both passes route a version-gated delivery through `evolvedDeliveryGuard` (`scripts/upgrade-project.ts:3050`). That guard calls `classifyProjectState` (`upgrade-policy.ts:1721`) and `resolveDisposition` (`upgrade-policy.ts:1770`). PROJECT_EVOLVED combined with templateChanged gives CONFLICT (ERROR), SKIP. An adopt grant gives ADOPT (INFO).
- **Baselines** refresh only for paths delivered in apply mode (`scripts/upgrade-project.ts:8503-8587`). An OK or equal-version path keeps its prior baseline. Parity baselines apply only to NO_BASELINE paths (`noteParity`, line 3020).

### 3.3 Markers, frontmatter, and lifecycle records

- **Required frontmatter**: validate-templates `skill-lifecycle` requires `name`, `description`, and `scope` for every variant skill (`scripts/validate-templates.ts:3029`). `version` must be X.Y.Z. No LOCAL-PATCH or other marker is needed or wanted. LOCAL-PATCH markers belong to project copies, not to templates.
- **Lifecycle record**: `generate-skill-lifecycle-records.ts` `planTemplateRecords` skips a variant skill whose name exists in common (line 599, "covered by the common record"). SLR coverage accepts the common record (line 743). **No record file is generated for the override.** `scripts/data/skill-owner-map.json` is `{}`, and frontmatter `owner:` resolves first.
- **Owner rule**: a variant skill's owner must be in the variant, common, or workspace roster (line 737). `i18n-specialist` exists in `templates/common/agents/` and `templates/co-work/agents/`, so the owner `i18n-specialist` is allowed. `skill-record-enforcement.json` is `enforce: true`, so this rule is a hard error, and the proposed owner satisfies it.
- **Mirror parity**: `variant-mirror-parity` (`validate-templates.ts:3601`) WARNs when a mirrorable variant skill is missing from a mirror. It FAILs when a mirror copy is older than the variant SSOT. The registry-row check (around line 6093) FAILs when a mirror version differs from the `SKILLS.md` row version.
- **Version tracking**: no validator requires an override to track the common version. Nothing detects an override that is behind common, so co-safety's four dead overrides pass every gate today.

### 3.4 Effect on CONFLICT and baseline logic after the override ships

| Scenario (simulated, §7) | Common pass | Variant pass | Result |
|---|---|---|---|
| No override (baseline) | CONFLICT 1.1.0→1.1.1 | — | exit 1, ERROR 1 |
| Override v1.1.1 (aligned with common) | CONFLICT | CONFLICT 1.1.0→1.1.1 | exit 1, ERROR 2 |
| Override byte-identical to the project copy (v1.1.0) | CONFLICT | OK | exit 1, ERROR 1 |
| **Override v1.1.2 (proposed), no grant** | CONFLICT | CONFLICT 1.1.0→1.1.2 | exit 1, ERROR 2 |
| **Override v1.1.2 + `adopt-template=skills/i18n-layout/**`** | ADOPT (1.1.1) | ADOPT (1.1.2) | **exit 0, ERROR 0**; the final project copy is byte-equal to the override |
| **Steady state after that apply** | DRIFT_PRESERVE (WARN) + PROJECT_AHEAD (WARN) | OK 1.1.2 | **exit 0, ERROR 0** |

The CONFLICT persists without a grant for two reasons:
1. The common pass always evaluates common v1.1.1 against project v1.1.0, and it has no shadow skip.
2. The variant pass sees a project copy that differs from both its baseline and the new deliverable.

No byte content of the override can make both passes clean on the first run.

## 4. Mechanism detail (why exactly one grant is needed)

1. **Common pass**: `semverGt("1.1.1", "1.1.0")` holds, so the pass enters the guard. The project hash differs from baseline `1ee0e5…`, so the state is PROJECT_EVOLVED. The deliverable also differs from the baseline, so templateChanged is true. The result is CONFLICT. Only an adopt grant or a common-pass shadow skip (Option B) changes this.
2. **Variant pass**: the same classification applies against the same baseline. Only an override byte-identical to the project copy avoids CONFLICT (IN_SYNC or equal version). That override would keep `version 1.1.0`, `owner pm`, and `scope: common`, which contradicts alignment and precedent. It would also keep the stale baseline, so its next content bump would CONFLICT again (§3.2, baselines).
3. **Version 1.1.2 (strictly greater than common)** is needed for three reasons:
   - (a) In apply mode the common pass writes 1.1.1 first. The variant pass then delivers only if its version is strictly greater, so an override at 1.1.1 would leave the **common** wording in place.
   - (b) In steady state the common pass sees `project 1.1.2 > template 1.1.1` and preserves the copy (PROJECT_AHEAD, WARN) instead of overwriting it.
   - (c) It matches every precedent override that is effective.
4. **The glob** `skills/i18n-layout/**` matches the rel `skills/i18n-layout/SKILL.md` in both passes, so both passes adopt. In the order of apply mode, the common copy is written first and is then superseded by the override in the same run. Baselines refresh to the override bytes at manifest write.

## 5. Exact file list

### 5.1 Hand-authored implementation files (Row 1, `templates/co-work` only)

> **Implementation note**: the variant validator requires a `prerequisites` frontmatter field and the sections Context, When to Use, Execution Steps, Output Format and Related Skills. The override is therefore common v1.1.1 + the 4 intended edits + `prerequisites: none` + the five appended generic sections. The line-92 wording remains the only intentional change to the common body. This root edit (a scoped `docs/lifecycle/reference-allowlist.json` entry for `hwp-document-processing`) is validator-forced atomicity with the template change (CLAUDE.md section 9 exception): the reference-integrity audit rejects line 92 without it.

| # | File | Action | Content |
|---|---|---|---|
| 1 | `templates/co-work/skills/i18n-layout/SKILL.md` | create | Byte copy of `templates/common/skills/i18n-layout/SKILL.md` (sha256 `3e6f984d…93b1`) with exactly four changed lines: `version: 1.1.2`, `last_reviewed: 2026-11-13`, `scope: co-work`, and line 92 replaced by line 92 of `Projects/co-work/skills/i18n-layout/SKILL.md` (sha256 `1a6e0955…cf92`), verbatim. `owner: i18n-specialist`, `status: active`, and all other lines stay byte-identical to common. |
| 2 | `templates/co-work/skills/SKILLS.md` | modify | Add one registry row: `` `i18n-layout` `` \| 1.1.2 \| active \| i18n-specialist \| 2026-11-13 \| — \| hub override of common `i18n-layout` (line 92 HWP routing to the hub's project-local `hwp-document-processing`); keep version > common; re-sync on every common bump (spec 2026-11-13-co-work-i18n-layout-hub-override-design). |
| 3 | `templates/co-work/variant.json` | modify | Append `{ "name": "i18n-layout", "file": "skills/i18n-layout/SKILL.md" }` to `skills[]`. Do not add it to `skill_manifest.variant_specific` (§10 Q4). |

The required `diff templates/common/skills/i18n-layout/SKILL.md templates/co-work/skills/i18n-layout/SKILL.md` output is exactly 4 changed lines: 9 (version), 12 (last_reviewed), 13 (scope), and 92.

### 5.2 Script-generated outputs (named per CLAUDE.md §9)

| File(s) | Generator |
|---|---|
| `templates/co-work/.claude/skills/i18n-layout/SKILL.md`, `.gemini/…`, `.agents/…`, `.codex/…`, `.hermes/…` (5 byte mirrors of file 1) | `bun scripts/sync-skills.ts --dir templates/co-work` |
| `templates/co-work/docs/skill-graph.json` (may change) | `/sync` step 4.65: `generate-skill-graph.ts --scope co-work` |
| `docs/specs/registry.json`, `docs/specs/entries/2026-11-13-co-work-i18n-layout-hub-override-design.json` (root) | `bun scripts/spec-register.ts` (this Row 0) |
| `CHANGELOG.md`, `memory/YYYY-MM-DD.md`, and other `/sync` pipeline files (root) | `/sync` (`dev-sync.ts`) |

No lifecycle record is generated (§3.3), and `generate-skill-lifecycle-records.ts --check` must stay at exit 0. No other root files are touched. `templates/common/` is not touched.

### 5.3 Not changed

- `templates/common/skills/i18n-layout/` stays the spoke-facing SSOT.
- `scripts/upgrade-project.ts` and `scripts/lib/upgrade-policy.ts` are unchanged. Option B in §10 Q1 is a separate decision.
- `Projects/co-work` is not edited by this change. It receives the override through the upgrade wave (§7, V4).

## 6. Acceptance criteria

- [ ] AC1: `templates/co-work/skills/i18n-layout/SKILL.md` exists. Its diff against the common copy is exactly the 4 edits named in §5.1 plus the `prerequisites: none` frontmatter field and the five appended generic sections (see the Implementation note in §5.1); the line-92 wording is the only change to the common body.
- [ ] AC2: Line 92 of the override is byte-identical to line 92 of `Projects/co-work/skills/i18n-layout/SKILL.md`.
- [ ] AC3: The override frontmatter carries `version: 1.1.2`, `owner: i18n-specialist`, and `scope: co-work`.
- [ ] AC4: All five platform mirrors exist and are byte-identical to the override.
- [ ] AC5: `skills/SKILLS.md` has an `i18n-layout` row with version 1.1.2. `variant.json` `skills[]` lists the override.
- [ ] AC6: `bun scripts/validate-templates.ts` reports no new FAIL or WARN for co-work. The checks in scope are skill-lifecycle, variant-mirror-parity, the SKILLS.md row version check, and SLR.
- [ ] AC7: `bun scripts/generate-skill-lifecycle-records.ts --check` exits 0. `bun scripts/validate-variant-readiness.ts templates/co-work` reports no new error.
- [ ] AC8: `bun scripts/audit.ts` passes. `/sync` skill-graph scope verification for co-work passes.
- [ ] AC9: The co-work dry-run with the adopt grant exits 0 with ERROR 0 (§7, V3).
- [ ] AC10: After the co-work wave applies, the project copy sha256 equals the template override sha256. A plain dry-run then shows no ERROR row for `skills/i18n-layout/` (§7, V5).

## 7. Verification plan (dry-run expectations for co-work)

Simulation method: the proposed override and its five mirrors were placed temporarily in an isolated worktree off `origin/main` (`2ca0336b5`). The worktree's `upgrade-project.ts` ran against a scratch copy of `Projects/co-work` (`/tmp/sim-hub/co-work`, with `--yes` for the outside-Projects target). The temporary files were then removed. A control run without the override reproduced the real baseline exactly (ERROR 1, same row).

| Step | Command (run from the shared checkout after the PR merges) | Expected |
|---|---|---|
| V1 (done) | `bun scripts/upgrade-project.ts Projects/co-work --dry-run` | Before the change: exit 1, ERROR 1, CONFLICT in `SYNC_IF_NEWER: skills/`. |
| V2 | the same command, after the override lands | **exit 1, ERROR 2**: CONFLICT in both `SYNC_IF_NEWER: skills/` (1.1.0→1.1.1) and `VARIANT SKILLS` (1.1.0→1.1.2). This result is expected. It confirms the one-time grant is still pending, and it is not a defect of the change. |
| V3 | `bun scripts/upgrade-project.ts Projects/co-work --dry-run "--disposition=adopt-template=skills/i18n-layout/**"` | **exit 0, ERROR 0**. Two `✅ DISPOSITION (adopt-template)` rows (UPDATE 1.1.0→1.1.1, then 1.1.0→1.1.2). Simulated decision log: INFO 343 / WARN 179 / ERROR 0. No other row changes compared with V1. |
| V4 | the co-work upgrade wave in apply mode with the same grant (PM dispatches it; the user merges the project PR) | The project copy is byte-equal to the override (simulated). The decision log records two ADOPT rows with `adopt-template`. The baseline refreshes to the override bytes. |
| V5 | plain dry-run after V4 has landed | No ERROR row for `skills/i18n-layout/`. Expected rows: `DRIFT (preserved)` (WARN) and `🔼 PROJECT_AHEAD … project 1.1.2 > template 1.1.1` (WARN) in the common pass, and `OK skills/i18n-layout/SKILL.md 1.1.2` in the variant pass. The PENDING BACKPORT list keeps one `[PROJECT_AHEAD]` entry for this path, which is the same steady state as co-price `i18n-audit`. |

## 8. Risks and drift

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| **R1 Silent overwrite when common catches up.** If common `i18n-layout` reaches version 1.1.2 or higher, the common pass sees an UNTOUCHED project copy and delivers common over the hub copy with exit 0. Simulated with common at 1.2.0: the common pass reported `COPIED`. The variant pass then reports the template as behind. This is exactly how co-safety's `sync`, `script-lifecycle-manager`, `team-builder`, and `translate` overrides died. | Certain on the next common bump; medium impact (the hub wording regresses to "delegate to the hub") | (a) In scope: the SKILLS.md row notes the rule "keep version > common; re-sync on every common bump". (b) Process: any PR that bumps common `i18n-layout` must port the change into the override and set the override to `<new common> + patch`. (c) Follow-up (§10 Q3): a validator arm that FAILs or WARNs when a variant override's version is not strictly above its common counterpart. That arm would also surface co-safety's four dead overrides. |
| **R2 Content drift.** Common improvements to lines other than 92 do not reach co-work until someone re-syncs the override by hand. | Medium | The R1 (b) process covers this. The diff contract (exactly 4 lines, §5.1) makes a re-sync mechanical: copy common, then re-apply the 4 lines. |
| **R3 Dangling reference in fresh scaffolds.** The verbatim line 92 names `hwp-document-processing` and `scripts/hwp/`. Both are project-local to `Projects/co-work`, because template promotion was deferred by the co-work DEC-20261107-01 and templates ship no HWP tooling under DEC-20261106-02. A new project scaffolded from `templates/co-work` would read a reference to assets it lacks. No validator resolves inline skill names in SKILL.md bodies, so no gate fails. | Low today (one co-work project), but real | User decision (§10 Q2). |
| **R4 Permanent WARN noise.** Each co-work upgrade logs 2 WARN rows and 1 PENDING BACKPORT entry for this path. | Certain; low impact | This is accepted precedent (co-price `i18n-audit`). Option B (§10 Q1) would remove it. |
| **R5 Adopt grant scope.** A glob broader than `skills/i18n-layout/**` would adopt template copies over other project-evolved files. | Low | Use exactly the stated glob. Before applying, confirm in the V3 output that only the two `i18n-layout` rows changed. |

## 9. Platform impact

| Platform | Impact | Files affected |
|---|---|---|
| Claude Code | One mirror copy, script-generated | `templates/co-work/.claude/skills/i18n-layout/SKILL.md` |
| Antigravity (GEMINI.md) | One mirror copy, script-generated. No GEMINI.md change is needed because skill content is platform-neutral. | `templates/co-work/.gemini/skills/i18n-layout/SKILL.md` |
| Codex / Hermes / Agents | One mirror copy each, script-generated | `templates/co-work/{.codex,.hermes,.agents}/skills/i18n-layout/SKILL.md` |
| templates/common | None. Common stays the spoke-facing SSOT. | N/A |

**Accessibility statement**: non-UI change (a skill guidance document and template registration only). Exempt from ADR-0065 by explicit statement.

**Preview verification**: non-UI change; no rendered surface exists. Exempt from ADR-0070 by explicit statement.

## 10. Open questions (user decisions; the architect does not decide these)

**Q1. "No manual step beyond the normal upgrade" cannot be met with templates-only scope.** Choose one option:
- **A (recommended within the stated scope)**: ship the override as designed. Run the co-work wave once with `--disposition adopt-template=skills/i18n-layout/**`. The steady state is clean (exit 0) after that.
- **B**: also add a variant-shadow skip to the common `SYNC_IF_NEWER: skills/` pass in `scripts/upgrade-project.ts`. This is L0-only with no template mirror, so it is a separate root PR under CLAUDE.md §9. It aligns skill delivery with the scaffold overlay rule ("variant wins") and removes R1 and R4. It does **not** remove the one-time grant for co-work, because the variant pass still CONFLICTs on the first run. It changes behavior for all 13 existing overrides. For example, co-safety projects would stop receiving common bumps for `sync`, `translate`, `team-builder`, and `script-lifecycle-manager`. It therefore needs its own design.
- **C**: a co-work project PR replaces its copy with the override bytes before the wave. This is also a manual step, and it is project-side.

**Q2. Line-92 wording.**
- (a) Keep the project wording verbatim (recommended). It preserves the hub project's text exactly and accepts R3.
- (b) Use the verbatim wording plus a short qualifier stating that `hwp-document-processing` and `scripts/hwp/` are project-local to the co-work hub and that the template does not deliver them. The adopt grant would then change the hub project's line 92 by that qualifier, so this is not lossless with respect to the project's wording.

**Q3. Drift guard (R1).** Approve a follow-up ticket for a validator arm, `variant-override-version-lead`, that compares every `templates/<variant>/skills/<name>` that shadows `templates/common/skills/<name>`. The arm would start at WARN, per the ADR-0055 soak. It would immediately report co-safety's four lagging overrides, and those would need their own ruling (refresh or delete).

**Q4. `variant_specific` registration.** Precedent is mixed: co-design and co-price list some overrides in `skill_manifest.variant_specific`, and co-safety lists none. The design adds the override to `skills[]` only. Confirm, or ask for `variant_specific` too. Listing it there also asserts a `.claude/skills/` mirror, which the design provides anyway.

## 11. References

- `scripts/upgrade-project.ts`: lines 3050 (`evolvedDeliveryGuard`), 5600 (common skills pass), 5918 (variant skills pass), 8503-8587 (baseline write and carry-forward)
- `scripts/lib/upgrade-policy.ts`: lines 860 (`iterEffectiveTemplateFiles`), 1721 (`classifyProjectState`), 1770 (`resolveDisposition`)
- `scripts/generate-skill-lifecycle-records.ts`: lines 599 and 717-783 (SLR rules)
- `scripts/validate-templates.ts`: lines 3029 (scope required), 3601 (variant-mirror-parity), around 6093 (SKILLS.md row version)
- `docs/designs/2026-10-27-sync-overwrite-policy-design.md` §6 (adjudicated port procedure)
- `docs/designs/2026-11-06-co-work-hwpx-consolidation-design.md`, `docs/decisions/DEC-20261106-02.md` (HWP removed from templates)
- `Projects/co-work/docs/decisions/DEC-20261107-01.md` (kordoc/rhwp adoption, L3 project-local, template promotion deferred)
