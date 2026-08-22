# Design: co-hr Variant Promotion (Phase B — Row 0 Design Gate)

- **Date**: 2026-08-23
- **Author**: Architect
- **Status**: **Implemented** — landed via PR #606 (merged 2026-08-23); follow-up pipeline fixes in PR #607. See Outcome.
- **Source project**: `Projects/co-hr/` (L3, scaffolded 2026-08-22 by `create-l3-scaffold.ts`, single commit `223bee7`, clean tree, separate git repo)
- **Target**: `templates/co-hr/` (does not yet exist; 10 sibling variants exist)

## Summary

Promote the proven L3 project `Projects/co-hr` (HR/labor consulting: Korean labor-law compliance + HRM/HRD + org design + change management, 12-agent roster, 11 domain skills) into the official variant template `templates/co-hr/` via the **Full L2 Pipeline** (`scripts/l3-to-variant-pipeline.ts`). The lightweight `project-to-variant.ts --force` path is rejected because the routing check tripped (91 variant-unique files > 40 threshold). The high-risk file-count rule (~91 new files) applies, but the workspace owner has already explicitly approved the promotion itself.

## Checklist Verification Verdict (PROMOTION_CHECKLIST.md, 7 conditions)

| # | Condition | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | All agents 3-Section structure | **PASS** | `bun run agent:verify`: 12/12 agent files verified, 0 orphans |
| 2 | All domain SKILL.md complete, k-law owned by labor-compliance-analyst | **PASS** | `bun scripts/validate-skills.ts`: 34 files, 0 errors, 1 warning (`docs/lifecycle/skills/` missing — non-blocking; pipeline generates governance records at L1). `skills/k-law/SKILL.md` frontmatter `owner: labor-compliance-analyst` with documented co-users labor-relations-specialist / safety-health-officer |
| 3 | All 12 agent files complete with required 8 sections | **PASS** (with nuance) | All 11 specialist files grep-verified for Role / Meeting Participation / Dispatch Protocol / PM-ONLY INVOCATION / Responsibilities / Output Format / Output Destination / Constraints. `pm.md` intentionally uses the sibling-standard `extends` + additive VARIANT-SECTION override pattern (same as `templates/co-deck/agents/pm.md`) rather than duplicating all 8 sections — covered by the agent:verify PASS |
| 4 | Domain audit passes with 0 errors | **PASS** | `bun scripts/audit.ts`: all checks passed (language, parity, nul-redirect, drift, injection, workflow hygiene) |
| 5 | AGENTS.md full 12-agent roster | **PASS** | `AGENTS.md` roster table rows 18–29 list pm (high) + all 11 specialists with phases and tier |
| 6 | CLAUDE.md ↔ GEMINI.md platform parity | **PASS** | `## Co-Hr Context` sections (CLAUDE.md:332 / GEMINI.md:316) diff only by two trailing blank lines — substantively identical. L0 parity script runs post-promotion as part of the pipeline |
| 7 | _ORIGIN.md Phase B manual steps reviewed | **PASS** | All reconcile-survival items satisfied: CLAUDE.md/GEMINI.md context sections exist, AGENTS.md roster exists, variant.json has no remaining `TODO:` fields |

## Routing Decision

**Decision: Full L2 Pipeline** — `bun scripts/l3-to-variant-pipeline.ts --l3-path=Projects/co-hr --name=co-hr --type=consulting --description="HR/labor Multi AI Team - Korean labor law compliance + HRM/HRD + org design + change management consulting"`

### Trade-offs

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Full L2 Pipeline (`l3-to-variant-pipeline.ts`) | Handles 91 unique files correctly; rewrites extends paths; generates governance records (fixes the validate-skills warning); runs reconcile/prune of 221 common-inherited files; runs parity + audit gates | Slower; more moving parts | **Selected** |
| Lightweight `project-to-variant.ts --force` | Fast, single step | Bypasses the routing check designed for exactly this case (>40 unique files); risks copying stale common files verbatim and breaking reconcile; no governance-record generation | Rejected |
| Manual copy per _ORIGIN.md Phase B steps | Full human control | Error-prone at 314 source files; duplicates what the pipeline automates; no audit gate | Rejected |

## pm.md Override Review

**Verdict: APPROVED.**

- `variant.json → agent_overrides.pm` is declared `type: additive` with reason, since (2026-08-22), and reviewed_by: architect.
- `agents/pm.md` removes exactly three sections (Governance Workflow, Agent Roster, Dispatch Protocol) and replaces each with a variant VARIANT-SECTION equivalent — the established sibling-template pattern. Core L0/L1 governance (Role, PM-ONLY invocation rule, meeting participation, output/constraint discipline) is inherited via `extends`, not removed.
- Tier raise to `claude=high` is justified: the PM sequences a 12-agent roster across legal-compliance, HRM, HRD, and org-design domains where mis-sequenced handoffs create compliance-review gaps (statutory outputs require legal-disclaimer + licensed-reviewer flags, which the PM enforces). This is a genuine domain-complexity escalation, not cost-tier creep.

## Files to Change (promotion scope)

| Target | Action | Notes |
|--------|--------|-------|
| `templates/co-hr/` (new) | Create | ~91 variant-unique files: 13 agent files, 11 domain skills, variant CLAUDE.md/GEMINI.md/AGENTS.md/README*, variant.json, domain docs |
| `templates/co-hr/agents/pm.md` | Create with rewrite | **`extends: ../../../agents/pm.md` must be rewritten to `../../common/agents/pm.md`** (L3 path is invalid inside templates/; matches co-deck pattern). Confirm pipeline handles this — see Open Questions |
| `templates/co-hr/variant.json` | Create | `displayName: "Co Hr"` should become `"Co HR"`; `phaseAComplete: false` should be set to `true` at promotion |
| `templates/co-hr/skills/k-law/` | Create (variant-owned copy) | k-law has `l2_propagate: true` and `scope: common`; pipeline must classify it as variant-specific per skill_manifest, not a stale common copy |
| 221 common-inherited files | Prune / do not copy | Reconcile step drops files identical to `templates/common/` |
| Workspace governance (VERSION_MANIFEST, schema, docs index) | Updated by Row 2 | Out of scope for Row 1 |

## Acceptance Criteria (Row 1 pipeline run)

1. `templates/co-hr/` exists with the variant-unique files; no `nul` artifacts (`find templates/co-hr -iname nul` empty).
2. `templates/co-hr/agents/pm.md` extends resolves to `../../common/agents/pm.md`.
3. Workspace-root `bun scripts/validate-skills.ts` and `bun scripts/audit.ts` pass with 0 errors (new variant included).
4. Template parity check (L0) passes for co-hr CLAUDE.md ↔ GEMINI.md.
5. `Projects/co-hr/` source project untouched (pipeline must not mutate the L3 repo).
6. `bun scripts/simulate-l3-to-variant-promotion.ts` (or equivalent smoke check) shows no classification regression.

## Platform Impact

- **Claude Code (CLAUDE.md)**: New variant contributes CLAUDE.md with `## Co-Hr Context`; pm override dispatch protocol applies identically. No hook or settings changes required at L0.
- **Antigravity (GEMINI.md)**: `## Co-Hr Context` section is parity-identical to CLAUDE.md (verified). Agent Teams / hook caveats for Antigravity are unchanged (not supported; per existing GEMINI.md guidance). Not "None" — parity content ships in both files.
- **templates/common**: No common files modified by this promotion. Interaction only: 221 common-inherited source files are pruned as redundant during reconcile; k-law's `l2_propagate` contract with templates/common/skills must be respected (common copy remains authoritative for other variants).

## Risk Register

- **High file count (~91)**: mitigated by explicit user approval + Full L2 Pipeline gates + Row 3 PM verification before /sync.
- **extends-path rewrite**: if the pipeline does not rewrite it, Row 1 must include a one-line fix post-pipeline (automation-engineer).
- **Korean content in official files**: audit.ts language check already passes on the source; k-law SKILL.md Korean terms are proper-noun/legal triggers (permitted).

## Open Questions

1. **Resolved during gate review:** `l3-to-variant-pipeline.ts` only *checks* that `extends:` is present (line ~274) — it does **not** rewrite the path value. Therefore `templates/co-hr/agents/pm.md` will land with the L3-relative `extends: ../../../agents/pm.md`, which is invalid inside `templates/`. **Required Row 1 step:** after the pipeline completes, rewrite to `extends: ../../common/agents/pm.md` (one-line fix by automation-engineer; matches the co-deck pattern). This is now acceptance criterion 2's enforcement action, not an open question.
2. **Non-blocking:** Confirm `displayName: "Co Hr"` → `"Co HR"` and `phaseAComplete: true` as part of Row 1/2.

## Gate Verdict

**GO** for Row 1 (Full L2 Pipeline). All 7 checklist conditions PASS; pm override APPROVED; no blocking ambiguities.

## Outcome (2026-08-23)

Promotion completed: `templates/co-hr/` landed via PR #606 (92 files, +6539/−2044). All acceptance criteria verified green before merge — including criterion 2: the `extends` rewrite was applied post-pipeline exactly as Open Question 1 prescribed (the pipeline only checks `extends:` presence; it does not rewrite the path). Open Question 2 resolved in the same PR (`displayName: "Co HR"`). The run surfaced 4 pipeline defects — Windows backslash path handling in skill-dir creation, `lifecycle` frontmatter stripping, VARIANT-INJECT marker loss when the L3 context.md overwrites the generated skeleton, and auto-fix flags unreachable from the CLI — all fixed in PR #607 (`generate-variant.ts` 1.12.0, `l3-to-variant-pipeline.ts` 1.11.0, `regenerate-agents-md.ts` 1.1.0) with unit coverage in `tests/unit/generate-variant-pipeline-fixes.test.ts`; future promotions should not need the manual post-run fixes this run required. The L3 source was subsequently reconciled (pm.md lifecycle restore, Korean-trigger backticks in `AGENTS.md`) and committed via its own pipeline (Projects/co-hr PR #1, 709b306).
