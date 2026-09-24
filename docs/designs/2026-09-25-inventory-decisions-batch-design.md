# Design: Inventory Decisions Batch (PR D — T-20260924-002 / -003 / -009)

- **Spec ID**: 2026-09-25-inventory-decisions-batch
- **Date**: 2026-09-25
- **Author**: Template Architect (PM-dispatched, Design Gate per ADR-0074)
- **Tickets**: T-20260924-002, T-20260924-003, T-20260924-009 (governance backlog, PM rulings attached)
- **Status**: implemented (2026-09-25, automation-engineer; registry flipped via spec-register)

---

## 1. Background

Three sibling tickets in the contract-inventory family (delivered inventory vs its registry/index) reached PM rulings on 2026-09-24. All three are declaration/inventory truth work. None changes what gets delivered.

### T-20260924-002 — common_platform_skills inventory scope

- **PM ruling: full-inventory.** The contract's platform-skill inventory must explicitly list ALL delivered platform skills. Every skill dir under the `templates/common/.{claude,gemini,agents,codex}/skills/` mirrors gets a contract entry or a documented exclusion. Silent omission is not allowed.
- **Warning source (verified today)**: `validate-templates.ts` Check C-CM-04 reverse-coverage, platform-skills sweep (spec site 3d, `2026-09-25-verifier-platform-expansion-design`; code at `scripts/validate-templates.ts:3419-3440`). It sweeps all four mirror trees and emits one aggregated WARN per tree. Current output: **15 (.claude) / 14 (.gemini) / 14 (.agents) / 14 (.codex) unlisted dirs**. The ticket title's "C-CM-05/WS-02" is the check family label; the ERROR-level C-CM-05 arm (`.claude`-only, with exclusion classes) already passes via its `graft` exception and mirrored/country/variant classes. The C-CM-04 sweep is stricter: it exempts only country-scoped keys plus `variant_scoped_skills` **keys** (variant names, not skill names — a latent inconsistency with C-CM-05, which uses values).
- **Unlisted sets (fresh audit 2026-09-25, after removing the 6 k-\* country-scoped exemptions)**:
  - `.claude` (15): adopt-project, context-commonization-review, create-variant, graft, migrate-project, project-resync, project-to-variant, promote-variant, release-template, simulate-pipeline, skill-graph-analytics, sound-synth, ticket-run, upgrade-project, variant-feature
  - `.gemini` / `.agents` / `.codex` (14 each): same list minus `graft`
- **Classification (verified)**: 10 are mirrored workspace skills with a root `skills/<name>/` SSOT and copies in all four trees; 3 are L0-only-by-design operator skills (create-variant, promote-variant, simulate-pipeline — root SSOT, never delivered to L2 scaffolds per AGENTS.md §6); 1 is claude-only (graft — root `.claude/skills/` only, no frontmatter version); 1 is variant-scoped (sound-synth — co-game, listed in `variant_scoped_skills` values, no root SSOT).

### T-20260924-003 — i18n-specialist common-agent inheritance

- **PM ruling: option 2 — pm-style extends-stub pattern.** The 13 byte-identical `agents/i18n-specialist.md` copies in variant templates become extends-stubs resolving against `templates/common/agents/i18n-specialist.md`, with the coordinated 3-layer fix (file, variant.json agents entry, AGENTS.md roster row stays).
- **Warning source**: C-AG-01 (`scripts/validate-templates.ts:3091-3111`) — fires when a variant agent file is byte-identical (after newline/BOM normalization) to the common body, and the contract entry lacks `expected_override_all_variants`. 13 WARNs today (co-abap, co-consult, co-deck, co-design, co-develop, co-export, co-game, co-hr, co-news, co-price, co-safety, co-security, co-work). co-safety carries the file too and is in the set; 14 variants exist in total.
- **Common body exists**: `templates/common/agents/i18n-specialist.md` (147 lines); contract `common_agents.i18n-specialist` (version 1.0.0, no `expected_override_all_variants` flag — correct for option 2, since variants will stop carrying full copies).
- **Precedent mechanics (verified)**:
  - Stub shape: variant `agents/pm.md` files are 8-line frontmatter-only stubs (`extends: ../../common/agents/pm.md`, name, description, variant, version, last_updated; empty body).
  - Resolver: `scripts/helpers/resolve-pm-stub.ts` — `resolvePmExtendsStub(pmPath, commonPmMdPath, variant)` is path-parameterized. The PM-specific parts (`variant_overrides` section keys, `isCanonicalPmStubBody` prose check) activate only for prose stubs or override keys; an empty-body stub with no overrides resolves fully generically. Call sites: `new-project.ts:833` (§2.3b) and `adopt-project.ts:475` — both hardcode `pm.md`.
  - `validate-agents.ts` already understands extends-stubs: skips the full roster schema for `fm.extends` files and fails on dangling `extends:` targets (`validate-agents.ts:313-314, 326-367`). Works for a second stub agent with no change.
  - **Latent bug found (dry-run evidence, `bun scripts/upgrade-project.ts Projects/co-work --dry-run`)**: the `SYNC_IF_NEWER: agents/` pass (`upgrade-project.ts:1802-1861`) v1.35.0 equal-version drift reconciliation compares the variant template stub against the project's resolved full body and reports `⚠️ DRIFT (restored to canonical) agents/pm.md 1.1.0` — an apply-mode upgrade would overwrite the project's 349-line resolved PM agent with the 8-line stub. This bug exists today for pm.md and would extend to i18n-specialist stubs if unfixed. The design fixes it for both.
- **Delivery safety (verified)**: `REVIEWED_DELIVERY_EXCLUSIONS` (`scripts/helpers/scaffold-markers.ts:330-334`) documents that fleet agents reach projects via the common copy at instantiation; the variant overlay then copies the variant file over it — which is why §2.3b-style resolution must run for i18n-specialist too. `agents/i18n-specialist.md` is NOT in `SCAFFOLD_COMMON_OWNED_FILES` (that set drives WS-07 "variants must not carry" — adding it would forbid the stub), so overlay-skip is not an option; resolution at scaffold/adopt time is the correct seam.
- **No template-side regeneration risk**: no script propagates common agent bodies into variant templates (variant copies have been static since the 2026-09-15 codex-tier update). Stubs, once authored, stay stubs.
- **variant.json**: all 13 variants list `{"name": "i18n-specialist", "file": "agents/i18n-specialist.md"}` in `agents[]` — entries stay (the file still exists as a stub; the upgrade asset gate (`upgrade-project.ts:1734`) keys off `agents[].file`, not content).

### T-20260924-009 — variant-exclusive skill registry loss

- **PM ruling: author variant registries** in the parseable format, starting with co-consult's 18-dir index, plus co-deck / co-security / co-develop if their dirs lack registry rows.
- **Provenance**: the common seed's `### Variant-Exclusive Skills` section (28 variant-exclusive rows + 9 L0-only operator rows; 37 rows total) was dropped from `templates/common/skills/SKILLS.md` in commit 151b40ef (scaffold-hygiene-bundle, T-009 provenance). For 27 of the 28 variant-exclusive skills, those rows were the only structured registry record.
- **Parseable row shape** (`parseSkillRegistryRows` / `buildSkillRegistryRow`, `scripts/helpers/skills-registry.ts`): a table row whose second cell is a backticked name and third cell is version-like: `` | `skill` | version | status | owner | last_reviewed | removal-date | notes | ``, under a `## Registry` heading. co-game carries 5 such rows (the ticket's one exception); co-design has 4/4 coverage. The four target variants parse to 0 rows.
- **Fresh audit (2026-09-25, dirs with SKILL.md vs own `skills/SKILLS.md` rows)**:

  | Variant | Skill dirs | Parseable rows | Missing | In this PR |
  |---|---|---|---|---|
  | co-consult | 18 | 0 | 18 | YES |
  | co-deck | 10 | 0 | 10 | YES |
  | co-security | 6 | 0 | 6 | YES |
  | co-develop | 4 | 0 | 4 | YES |
  | co-design | 4 | 4 | 0 | — (clean) |
  | co-game | 5 | 5 | 0 | — (clean) |
  | co-abap | 13 | 0 | 13 | backlog |
  | co-export | 11 | 0 | 11 | backlog |
  | co-hr | 12 | 0 | 12 | backlog |
  | co-news | 6 | 0 | 6 | backlog |
  | co-price | 22 | 0 | 22 | backlog |
  | co-safety | 60 | 0 | 60 | backlog (see note) |
  | co-work | 1 | 0 | 1 | backlog |

  co-safety note: its 60 dirs include 11 fleet/common-delivered skills (sync, translate, team-builder, meeting-facilitation, project-review, the lifecycle managers, etc.) that resolve from `templates/common/skills/`; a future co-safety registry must separate inherited from variant-exclusive rows. Deferred with the rest of the backlog.
- **Scope control (dropped 28 vs today)**: the dropped section's L0-only operator rows (create-variant, promote-variant, project-to-variant, upgrade-project, variant-feature, ticket-run, project-resync, release-template, context-commonization-review) regain a structured record through T-002's contract entries — sibling-ticket synergy, no re-authoring. The k-\* region rows were never lost (still in the current common seed, lines 54-59). One dropped skill no longer exists: `measure` (co-deck) — not re-authored; its removal is already reflected in the delivered tree. New dirs with no historical row (e.g. co-deck prep-pdf/presenter-mode/slide-layout-gate, co-consult company-intelligence/financial-statement-analysis/hwp-document-processing) get fresh rows.
- **Row sourcing**: per skill `SKILL.md` frontmatter — verified fields exist on variant skills (e.g. `templates/co-consult/skills/financial-modeling/SKILL.md`: name, scope, description, version 1.0.1, last_reviewed 2026-08-26, status active, owner strategy-analyst). The dropped git rows serve as cross-check only, never as source.
- **Generator interaction (verified)**: `verify-skills.ts:141-151` regenerates a `skills/SKILLS.md` only while it starts with `# Skills Index` (co-consult's current auto-generated stub). Converting it to a curated registry opts that variant out of regeneration — intended.
- **Scaffold safety (verified)**: `new-project.ts` skips variant `skills/SKILLS.md` during overlay (T-20260924-008: the common seed wins, then §6.4 reconcile adapts it to the delivered tree). Variant SKILLS.md files are template-side documentation; authoring rows does not change any scaffold output.

---

## 2. Goals

1. G1 (T-002): `validate-templates` runs with zero platform-inventory warnings. The 15/14/14/14 aggregated C-CM-04 WARNs drop to 0. C-CM-05 stays green.
2. G2 (T-003): the 13 C-AG-01 i18n-specialist warnings drop to 0, with stub resolution proven at scaffold, adopt, and upgrade time.
3. G3 (T-009): co-consult, co-deck, co-security, and co-develop carry parseable, frontmatter-sourced registry rows for 100% of their variant-exclusive skill dirs (38 rows).
4. G4: declaration truth only — no change to which skills or agents are delivered to projects.

## 3. Non-goals

1. New platform surfaces (no fifth mirror tree, no new platform directory).
2. Delivery-machinery changes (T-010/T-011/T-006/T-001 already landed; scaffold delivery logic stays).
3. Prune-removed operations and `Projects/**` content.
4. Authoring registries for co-abap, co-export, co-hr, co-news, co-price, co-safety, co-work (filed as backlog follow-ups).
5. A JSON Schema file for `common-contract.json` (see D1 trade-off).

---

## 4. Requirements (ASD-STE100)

### R1 — T-002: contract full inventory

- R1.1. Add 10 entries to `common_platform_skills`, one per mirrored common platform skill: adopt-project (1.1.0), context-commonization-review (1.1.0), migrate-project (1.0.0), project-resync (1.5.1), project-to-variant (1.3.0), release-template (1.0.0), skill-graph-analytics (1.1.0), ticket-run (1.0.0), upgrade-project (1.5.1), variant-feature (1.0.0). Entry shape follows the existing `finishing-a-development-branch` entry: `claude_source`, `gemini_source`, `agents_source`, `codex_source` (new key, see R1.4), `version` (equal to the mirror SKILL.md frontmatter), `description`, `propagated_to_common: true`.
- R1.2. Add a `common_platform_skill_exclusions` section to the contract. Record exactly five exclusions with a reason string and a `since` date: create-variant, promote-variant, simulate-pipeline (L0-only operator skills — root SSOT, never delivered to L2 scaffolds), graft (claude-only tool skill — C-CM-05 anti-drift ownership), sound-synth (variant-scoped co-game skill — excluded from the common contract by its own description).
- R1.3. Extend the C-CM-04 platform-skills sweep to honor `common_platform_skill_exclusions`. An exclusion naming a non-existent dir is a failure. Keep the existing anti-drift stale-exclusion rule.
- R1.4. Add `codex_source: '.codex'` to `PLATFORM_SOURCE_KEYS` (`validate-templates.ts:2777`). C-CM-03b then verifies version parity for `.codex` mirror copies too. All 22 listed skills have `.codex` copies (verified). Update the Ruling-K comment to cover skills as well as commands.
- R1.5. Fix the sweep's `exemptSkills` build to use `variant_scoped_skills` values (skill names), matching C-CM-05 semantics.
- R1.6. Bump the contract `version` to 1.7.0.
- R1.7. Do not change delivery behavior. The contract is consumed by validators only (`verify-platform-lifecycle.ts` Check H, `validate-templates.ts`); delivery stays filesystem-driven.

### R2 — T-003: i18n-specialist extends-stubs

- R2.1. Replace the 13 variant `agents/i18n-specialist.md` full copies with 8-line extends-stubs. Shape equals the pm stub: `extends: ../../common/agents/i18n-specialist.md`, `name`, `description` (same text as the common frontmatter), `variant`, `version: "1.0.0"`, `last_updated: "2026-09-25"`; empty body.
- R2.2. Generalize the stub resolver in `scripts/helpers/resolve-pm-stub.ts` (v1.0.0 → 1.1.0): export a generic `resolveAgentExtendsStub(agentPath, commonAgentPath, variant, opts)` that delegates to the existing logic; keep `resolvePmExtendsStub` as a thin back-compat wrapper. Move the canonical-prose check behind an option (pm passes `isCanonicalPmStubBody`; i18n-specialist stubs are empty-body and skip it).
- R2.3. Generalize the call sites: `new-project.ts` §2.3b and `adopt-project.ts` settle pass loop over `agents/*.md` files that carry `extends:` frontmatter and resolve each against `templates/common/agents/<name>.md`. Log one line per resolved stub.
- R2.4. Fix the `upgrade-project.ts` agents/ SYNC pass: skip template files whose frontmatter carries `extends:` (log `STUB (resolved at scaffold)`). This removes the confirmed pm.md DRIFT clobber and protects i18n-specialist stubs. Extract a pure `isExtendsStub(content)` helper for tests.
- R2.5. Keep the 13 `variant.json` `agents[]` entries unchanged. Keep the AGENTS.md roster rows unchanged. Do not add `agents/i18n-specialist.md` to `SCAFFOLD_COMMON_OWNED_FILES` or `MERGE_MANAGED_FILES`.
- R2.6. Do not add `expected_override_all_variants` to the contract's i18n-specialist entry.

### R3 — T-009: variant skill registries

- R3.1. Author `## Registry` sections in the four target variants' `skills/SKILLS.md`, with one parseable row per variant-exclusive skill dir: co-consult 18, co-deck 10, co-security 6, co-develop 4. Use the `buildSkillRegistryRow` shape.
- R3.2. Source each row from that skill's SKILL.md frontmatter: `version`, `status`, `owner`, `last_reviewed`. Set `removal-date` to `—`. Write the notes cell as `<variant> only` plus an optional one-line purpose taken from the frontmatter description.
- R3.3. Replace co-consult's auto-generated `# Skills Index` stub with the curated registry (header `# SKILLS.md — Skill Lifecycle Registry`). Replace the co-deck / co-security / co-develop `Skill | Directory | Purpose` tables with Registry tables; keep their prose Usage sections.
- R3.4. Do not re-author rows for skills that no longer exist (`measure`). Do not copy values from the dropped git rows except as a cross-check.
- R3.5. Add a parseability check that runs `parseSkillRegistryRows` over the four files and requires row count equal to skill-dir count (38/38).

---

## 5. Acceptance criteria

### AC-1 (T-002)

- [ ] `bun scripts/validate-templates.ts` emits no `platform skill dir(s) ... are not in common_platform_skills or common_skills` warnings for any of the four mirror trees; the `C-CM-04: all platform skill dirs are covered` pass line prints `4/4 tree(s)`.
- [ ] C-CM-05 prints its `graft` exception pass and the `all templates/common platform skills declared or explicitly excluded` pass.
- [ ] C-CM-03b passes for all entries including the 10 new ones, with `.codex` parity verified (no missing-copy or mismatch findings).
- [ ] An exclusion entry whose directory is deleted produces a C-CM-04 failure (anti-drift proven by test).

### AC-2 (T-003)

- [ ] `bun scripts/validate-templates.ts` emits zero C-AG-01 warnings for i18n-specialist (13 → 0) and no new C-AG-01/C-AG-02 findings.
- [ ] Each of the 13 variant stubs passes `bun scripts/validate-agents.ts` (roster-schema skip applies; `extends:` resolves).
- [ ] `bun scripts/new-project.ts` (dry-run or fixture) resolves the i18n-specialist stub: the project receives the full common body with stub frontmatter merged, no dangling `extends:`.
- [ ] `bun scripts/adopt-project.ts` settle pass resolves the stub the same way.
- [ ] `bun scripts/upgrade-project.ts Projects/co-work --dry-run` shows no `DRIFT (restored to canonical)` line for `agents/pm.md` or `agents/i18n-specialist.md`.
- [ ] C-CM-03a stays green (contract i18n-specialist version 1.0.0 equals the common body frontmatter).

### AC-3 (T-009)

- [ ] `parseSkillRegistryRows` returns 18 rows for co-consult, 10 for co-deck, 6 for co-security, 4 for co-develop; every row's version and last_reviewed equal the skill's SKILL.md frontmatter.
- [ ] Every variant-exclusive skill dir in the four variants has exactly one row; no row names a non-existent dir.
- [ ] `bun scripts/verify-skills.ts` does not regenerate co-consult's SKILLS.md (header check proves the legacy-index path is off).
- [ ] `bun scripts/test-new-project.ts` stays green (variant SKILLS.md remains overlay-skipped; the §6.4 reconcile output is unchanged).

### AC-4 (battery)

- [ ] Full battery green: `bun scripts/audit.ts` and `bun scripts/validate-templates.ts` with no new FAIL/WARN versus the pre-change baseline (except the removed findings above).
- [ ] Fleet dry-run evidence attached to the PR: validate-templates tail (before/after), one new-project fixture run, one upgrade-project dry-run.

---

## 6. Design decisions and trade-offs

### D1 — T-002 exclusion recording: contract section, not validator allowlist

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) `common_platform_skill_exclusions` in the contract | Declaration truth lives beside the inventory; one SSOT; reason strings travel with the contract; both check arms can consume it | Validator code change to consume | **Chosen** |
| (b) Extend `SINGLE_PLATFORM_EXCEPTIONS` + a second list in the sweep | Code-only change | Two allowlists drift; exclusions invisible to contract readers; ticket explicitly rejects silent omission | Rejected |
| (c) List everything in `common_platform_skills`, including L0-only and sound-synth | Single mechanism | Semantically wrong: L0-only skills are not common-delivered; sound-synth is variant-scoped, which the contract description excludes; C-CM-03b would demand a version on graft's version-less SKILL.md | Rejected |

C-CM-05 keeps its in-code `graft` exception: its value is the anti-drift byte-identity mechanism, not the declaration. The contract exclusion records graft for visibility; the code exception stays the enforcement point.

### D2 — T-002 codex parity: extend PLATFORM_SOURCE_KEYS with `codex_source`

`.agents` parity already exists (`agents_source`). `.codex` mirror copies are invisible to C-CM-03b today — a version bump on a `.codex` copy drifts silently. Adding `codex_source: '.codex'` closes the gap for all 22 entries at the cost of one tightening risk: any of the 12 existing entries lacking a `.codex` copy would newly fail. Verified: all 22 have `.codex` copies, so the risk is zero today. The Ruling-K coupling caveat (codex surface derives from the sync-skills mapping) is already documented at C-CM-04 and moves with any ADR-0077 D4 change.

### D3 — T-003 stub resolution seam: scaffold-time resolution, not overlay-skip

| Option | Pro | Con | Decision |
|---|---|---|---|
| (a) Generalize §2.3b to loop all extends-stub agents | Exactly the pm precedent; projects receive self-contained files; stub stays legal in the template tree | Touches new-project + adopt-project + upgrade | **Chosen** |
| (b) Add `agents/i18n-specialist.md` to SCAFFOLD_COMMON_OWNED_FILES | One-line change | The same set drives WS-07 "variants must not carry the file" — would forbid the stub; changes delivery classification | Rejected |
| (c) Leave the stub unresolved in projects | No code change | Projects ship a dangling `extends:` pointer and a platform that cannot resolve it | Rejected |

The upgrade-project agents-pass stub-skip (R2.4) is mandatory in all worlds: the v1.35.0 drift reconciliation currently clobbers the project's resolved pm.md on every apply-mode upgrade (verified by dry-run). The fix repairs an existing latent bug and future-proofs the pattern.

### D4 — T-003 resolver generality: generic wrapper, not a rename

`resolvePmExtendsStub` is already path-parameterized; only the canonical-prose check is pm-flavored. A generic `resolveAgentExtendsStub` wrapper with an injected body-check keeps the public API stable (SCRIPTS.md consumers, `resolve-pm-stub.test.ts` keep working) and avoids re-verifying the H12 prose-warning behavior.

### D5 — T-009 no JSON Schema for the contract

No local schema validates `common-contract.json` (its `$schema` points at the generic draft-2020 meta-schema; `docs/templates/variant.schema.json` covers variant.json only). The validator pure helpers are the de-facto schema. Authoring a contract JSON Schema would duplicate the validator's checks and add a maintenance surface; this design extends the pure helpers instead (D1, R1.3-R1.5).

### D6 — T-009 scope: four variants now, seven as backlog

The ruling names co-consult plus co-deck/co-security/co-develop. The audit shows 65 more row-gaps across seven variants (co-safety's 60 includes 11 common-resolved skills needing an inherited/exclusive split — a schema nuance the four in-scope variants do not have). Bundling all 13 variants would exceed a reviewable PR; the batch is filed as backlog tickets at /sync.

---

## 7. Accessibility (ADR-0065) and preview verification (ADR-0070) exemptions

- **Accessibility**: exempt. This change set touches JSON contract data, agent-file stubs, markdown registries, and validator scripts. It ships no user-facing web, app, CLI, or document UI, so there is no interaction surface to verify. Baseline WCAG 2.1 AA obligations are untouched.
- **Preview verification**: exempt. No rendered UI artifact is produced. The rendered-output equivalent for this change set is the validator/dry-run evidence listed in AC-4, which is captured in full.

---

## 8. Platform Impact

| Platform | Impact | Files Affected |
|----------|--------|----------------|
| Claude Code | None — no root `.claude/` or `skills/` content changes; validators only read | N/A |
| Antigravity (GEMINI.md) | None — no `.gemini/` content changes; the `.gemini` mirror tree is covered by the same contract entries | N/A (justification: contract and validators are platform-neutral; mirror trees are already byte-consistent) |
| templates/common | Propagation required — contract entries cover `templates/common/.{claude,gemini,agents,codex}/skills/`; the common agent body is the resolution target for 13 stubs | docs/templates/common-contract.json, templates/common/agents/i18n-specialist.md (unchanged, referenced) |
| Variant templates | 13 agents stubs; 4 skills/SKILLS.md registries | templates/co-*/agents/i18n-specialist.md, templates/{co-consult,co-deck,co-security,co-develop}/skills/SKILLS.md |

---

## 9. Files to change

| File | Action | Description |
|------|--------|-------------|
| docs/templates/common-contract.json | modify | +10 `common_platform_skills` entries (R1.1); +`common_platform_skill_exclusions` (R1.2); version 1.6.0 → 1.7.0 (R1.6) |
| scripts/validate-templates.ts | modify | Sweep reads exclusions (R1.3); `codex_source` in PLATFORM_SOURCE_KEYS (R1.4); exemptSkills values fix (R1.5); @version bump + SCRIPTS.md row |
| templates/co-*/agents/i18n-specialist.md (13 files) | modify | Full copy → 8-line extends-stub (R2.1) |
| scripts/helpers/resolve-pm-stub.ts | modify | v1.1.0 — generic `resolveAgentExtendsStub` wrapper + injectable body check (R2.2) |
| scripts/new-project.ts | modify | §2.3b loops all extends-stub agents (R2.3) |
| scripts/adopt-project.ts | modify | Settle pass loops all extends-stub agents (R2.3) |
| scripts/upgrade-project.ts | modify | Agents pass skips extends-stub templates via pure `isExtendsStub` (R2.4) |
| templates/co-consult/skills/SKILLS.md | modify | Auto-index → curated Registry, 18 rows (R3.1-R3.3) |
| templates/co-deck/skills/SKILLS.md | modify | Registry table, 10 rows (R3.1) |
| templates/co-security/skills/SKILLS.md | modify | Registry table, 6 rows (R3.1) |
| templates/co-develop/skills/SKILLS.md | modify | Registry table, 4 rows (R3.1) |
| tests/unit/validate-templates-reconcile.test.ts | modify | Exclusion-sweep helper tests (R1.3, R1.5), codex_source mapping (R1.4) |
| tests/unit/resolve-pm-stub.test.ts | modify | Generic resolver tests (R2.2) |
| tests/unit/skills-registry.test.ts (or new variant-registry test) | modify/add | Four-variant parseability counts (R3.5) |
| scripts/SCRIPTS.md | modify | Rows for changed scripts (cascade §10) |

Execution order: Sequential — T-002 contract+validator first (its entries feed the full battery), then T-003 (stubs + resolver + upgrade fix), then T-009 (registries), then battery + dry-runs.

---

## 10. Cascade table

| Artifact | Trigger | Action |
|---|---|---|
| scripts/SCRIPTS.md | validate-templates.ts, resolve-pm-stub.ts, new-project.ts, adopt-project.ts, upgrade-project.ts changed | Bump each `@version` header; update each Registry row's version + description; regenerate the scripts mirror (`generate-scripts-mirror`) |
| docs/VERSION_MANIFEST.md | No skill/agent lifecycle changes (no files under skills/ or agents/ at root) | None — verify at /sync (no-drift confirmation expected) |
| docs/templates/common-contract.json | +10 entries, +exclusions | version 1.6.0 → 1.7.0 (in-file); no VERSION_REGISTRY.json bump (template version untouched) |
| docs/lifecycle/* | No agent/skill status changes | None |
| memory/2026-09-25.md | Session log | PM records rulings execution at /sync (E1) |
| Tickets | T-002/-003/-009 | Move to done at /sync; file backlog ticket for the 7 remaining variant registries (D6) |

---

## 11. Verification plan

1. **T-002 before/after**: capture `bun scripts/validate-templates.ts` output before the change (4 aggregated WARNs, counts 15/14/14/14) and after (0 WARNs, `4/4 tree(s)` pass line, C-CM-03b green across claude/gemini/agents/codex for all 22 entries). Prove anti-drift: temporarily rename an excluded dir in a scratch check or unit test and assert the C-CM-04 failure.
2. **T-003 before/after**: before — 13 C-AG-01 WARNs and the upgrade dry-run `DRIFT agents/pm.md` line. After — 0 C-AG-01 WARNs; `bun scripts/validate-agents.ts` green; `new-project.ts` fixture (co-consult) shows the i18n-specialist resolution log and a self-contained project file; `upgrade-project.ts Projects/co-work --dry-run` shows `STUB (resolved at scaffold)` and no DRIFT lines for pm.md / i18n-specialist.md.
3. **T-009**: unit check via `parseSkillRegistryRows` (18/10/6/4 rows; versions equal frontmatter); spot-check three rows per variant against frontmatter; confirm `verify-skills.ts` leaves co-consult's file untouched.
4. **Full battery**: `bun scripts/audit.ts` + `bun scripts/validate-templates.ts` — no new findings versus baseline. `bun test` for the unit suite.
5. **Fleet dry-run evidence**: attach validator tails (before/after), the co-consult new-project fixture log, and the co-work upgrade dry-run log to the PR description.

---

## 12. Implementation brief for automation-engineer (ordered)

1. Contract + validator (T-002): edit `docs/templates/common-contract.json` (10 entries with frontmatter-sourced versions, 5 exclusions, version 1.7.0); edit `scripts/validate-templates.ts` (exclusion consumption, `codex_source`, exemptSkills values fix). Run validate-templates; expect AC-1 green.
2. Stub mechanics (T-003): extend `scripts/helpers/resolve-pm-stub.ts` v1.1.0 (generic wrapper + injectable body check); generalize `new-project.ts` §2.3b and `adopt-project.ts` settle pass; add `isExtendsStub` + agents-pass skip in `upgrade-project.ts`. Convert the 13 variant files to stubs (identical frontmatter except `variant:`; description text copied from the common body).
3. Registries (T-009): author the four `skills/SKILLS.md` Registry sections from frontmatter (18/10/6/4 rows).
4. Tests: extend `tests/unit/validate-templates-reconcile.test.ts` (exclusion acceptance, stale-exclusion failure, codex_source mapping, variant-scoped values exemption), `tests/unit/resolve-pm-stub.test.ts` (generic wrapper: empty stub, prose stub, missing L1, non-pm agent), and a registry parseability test (R3.5).
5. Cascades: bump `@version` headers + SCRIPTS.md rows for the five changed scripts; regenerate the scripts mirror.
6. Verification: run the §11 plan; attach evidence; hand to PM for QA gate and /sync.

### Test list

- validate-templates pure helpers: exclusion sweep (accept/reject/stale-exclusion), `declaredPlatformTrees` with codex_source, exemptSkills values-based variant-scoped exemption.
- resolve-pm-stub: `resolveAgentExtendsStub` generic name resolution (i18n-specialist), back-compat `resolvePmExtendsStub`, missing-L1 branch, empty vs prose shape.
- upgrade-policy/upgrade: `isExtendsStub` true on the 13 new stubs + pm stubs, false on full bodies.
- skills-registry: parseSkillRegistryRows counts 18/10/6/4; buildSkillRegistryRow round-trip on authored rows; frontmatter version equality.

## 13. Open questions

None. The three PM rulings fully determine the direction; all mechanics were verified against the live tree on 2026-09-25 at c85cf620.
