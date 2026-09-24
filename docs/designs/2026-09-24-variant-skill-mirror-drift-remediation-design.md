# Design: Variant Template Skill-Mirror Drift Remediation

- **Spec ID**: 2026-09-24-variant-skill-mirror-drift-remediation
- **Date**: 2026-09-24
- **Status**: implemented
- **Source**: User-requested audit follow-up — "are the PM Gateway / ADR-0080 principles reflected in templates?" surfaced skill-delivery inconsistencies; full investigation revised the initial diagnosis twice during execution. This document records the corrected diagnosis, the applied fix, and the retracted items with their reasons.
- **Ownership note**: investigation and remediation executed by the interactive agent in the PM Gateway role (triage → design → execution → QA → /sync).

## 1. Context and Corrected Diagnosis

The initial hypothesis — "12 of 13 variant templates are missing contract `common_skills` referenced by their AGENTS.md/pm.md" — was **wrong**. Investigation against the actual delivery architecture shows:

1. **Fork Model (propagation-map.json)**: L2 variant templates keep only variant-specific skills in `skills/`; contract common skills are delivered to scaffolded projects at scaffold time because `new-project.ts` runs `copyDir(commonDir, projectDir)` (the full `templates/common` tree, including its skills and four platform mirrors). All 12 non-co-safety variants declare **zero** governance skills in `variant.json` and carry none in-tree — this is the canonical state, not drift. No change is made to them.
2. **co-safety** is the sole exception by explicit decision (commit `85b54c56`, "declare variant skill scope (L0+L1+L2)"): it declares 8 governance skills in `variant.json → skills` and carries **customized forks** of them (verified: `agent-lifecycle-manager` diverges from common). Its declaration and file tree are mutually consistent.
3. The uniform baseline every variant legitimately carries in `.claude`/`.gemini` platform mirrors without an SSOT copy: `platform-command-lifecycle-manager`, `platform-skill-lifecycle-manager`, `finishing-a-development-branch` (plus co-consult-specific extras — see D2). Not drift by itself.
4. co-safety's 52 variant-specific safety skills are absent from its platform mirrors **by declaration**: their SKILL.md frontmatter carries `mirror: false` (honored by sync-skills since v1.6.0 — skills/ SSOT only). Not drift.

### Findings

| # | Finding | Disposition |
|---|---------|-------------|
| D1 | co-hr carries orphan `agent-lifecycle-manager` platform mirrors (`.claude` + `.gemini` only) at **v1.0.0 (2026-05-30)** vs common **v1.3.0**; not in `skills/`, not declared in `variant.json`; no peer carries it | **Fixed** — removed both mirror dirs (left over from co-hr promotion `dcd1785b`) |
| D2 | co-consult carries stale `research-analysis` (v1.0.0 vs common v1.0.2) and `documentation-writing` (v1.0.0 vs v1.0.3) platform mirrors; not in `skills/`, not declared; no peer carries them | **Fixed** — removed all 4 mirror dirs |
| D3 | All 13 variants carry `agents/i18n-specialist.md` copies byte-identical to common; validate-templates C-AG-01 warns on all 13 | **Retracted** — see §2; filed as design-decision ticket |
| D4 | "co-safety mirrors missing 52 skills" | **Retracted** — `mirror: false` by declaration (scan artifact) |
| D5 | co-safety lacks the `decision-record` skill its inherited pm.md references | **Retracted** — validator prohibits the fix shape; see §2 |

## 2. Retracted Items — Why the Obvious Fix Is Wrong

### D3 (i18n-specialist duplicates) — a design decision, not a mechanical cleanup

Removing the files alone breaks VRG ("agent file does not resolve: agents/i18n-specialist.md" ×13): each variant's `variant.json → agents` manifest references the file, and each variant AGENTS.md roster table links it. A complete fix touches three coordinated layers (file, manifest entry, roster row) across 13 variants and requires choosing an inheritance model. Candidate resolutions (for the ticket):

1. Remove file + manifest entry; keep the AGENTS.md roster row (dangles only in-template; resolves in scaffolded projects via common delivery).
2. Adopt the pm.md extends-stub pattern for common agents carried in variant rosters.
3. Declare the uniform practice intentional: add `expected_override_all_variants: true` for i18n-specialist in `common-contract.json` (the same exception C-AG-01 already applies to pm), silencing the warning honestly.

Until the model is chosen, the copies stay: they are byte-identical (zero divergence risk) and warning-only.

### D5 (decision-record for co-safety) — validator-prohibited shape

Copying the common `decision-record` into co-safety (declared or not) triggers **C-SK-01** ("Duplicate common skill … remove variant copy to inherit from common" — byte-identical copies are flagged) and **WS-06** (variant skills must be L0+L2-scoped; a `scope: common` skill in a variant dir is warned). co-safety's existing 8 governance skills pass only because they are customized forks. Provisioning decision-record would require authoring a co-safety-specific fork of a governance skill — a variant-owner decision (ADR-0080 skill-request path), not a sync fix. Until then, co-safety's in-template pm.md reference to `decision-record` dangles exactly like it does in the other 12 fork-model variants; scaffolded projects resolve it from common.

## 3. Applied Change Set

1. Remove `templates/co-hr/{.claude,.gemini}/skills/agent-lifecycle-manager/` (D1).
2. Remove `templates/co-consult/{.claude,.gemini}/skills/{research-analysis,documentation-writing}/` (D2).
3. Verification run of `bun scripts/sync-skills.ts --all-variants` (idempotent, no further changes after D1/D2 removals — confirms mirror consistency under the fork model).

Explicit non-changes: no contract `common_skills` bulk-copied into fork-model variants; `skills/SKILLS.md` indexes stay variant-specific-only (observed convention in all variants); no AGENTS.md/pm.md modified; co-safety untouched.

## 4. Acceptance Criteria

- `bun scripts/validate-templates.ts`: 0 errors; warnings return to the pre-existing baseline of 15 (13× C-AG-01 i18n-specialist + 2× common_platform_skills inventory scope — both ticketed, none introduced by this change).
- No `agent-lifecycle-manager` mirror remains under `templates/co-hr/`; no `research-analysis`/`documentation-writing` mirrors remain under `templates/co-consult/`.
- `bun scripts/sync-skills.ts --all-variants` reports zero copies on a second run.
- `bun scripts/audit.ts` passes.

## 5. Accessibility

Not applicable — repository infrastructure and template file hygiene; no user-facing UI is produced. (Explicit statement per ADR-0074 design-doc policy.)

## 6. Preview Verification

Not applicable — no rendered UI artifact. Verification is programmatic (validate-templates, audit, sync-skills output).

## 7. Follow-ups (ticketed, not in this change)

- **T-a**: `common_platform_skills` inventory scope (2 remaining validator WARNs): decide whether `templates/common/.{claude,gemini}/skills/` inventory lists the full platform set or an override record.
- **T-b**: i18n-specialist common-agent inheritance model (D3) — choose among the three candidate resolutions in §2 and apply the coordinated 3-layer fix (or the contract exception).
- **T-c**: a future validate-templates check could flag variant platform mirrors that are stale copies of common skills without SSOT/declaration (the D1/D2 class) so the drift cannot regrow.

## 8. Rollback

All changes are mechanical directory removals — fully reversible via `git revert` of the PR squashed commit.
