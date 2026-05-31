# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Lifecycle Management gap for CLAUDE.md and GEMINI.md
**Participants**: architect, lifecycle-manager, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]** (Round 1)

The current §6 lifecycle rule table in GEMINI.md defines follow-up actions for `scripts/*.ts`, `agents/*.md`, `skills/*/SKILL.md`, and `templates/common/scripts/*.ts` — but modifications to `CLAUDE.md` and `GEMINI.md` themselves are entirely absent.

The core concern: these files are MERGE-tier. Per CONSTITUTION.md §10, only content between `WORKSPACE-MANAGED` markers is auto-replaced by upgrade scripts. New sections added outside those markers (like the Skill Resolution Priority we just added) are never propagated by upgrades.

Two specific problems:
1. No procedure to propagate workspace root changes to `templates/*/GEMINI.md` and `templates/*/CLAUDE.md`.
2. Already-created projects retain stale versions permanently.

Question to lifecycle-manager: How does the current `upgrade-project` script handle non-WORKSPACE-MANAGED section changes?

---

**[lifecycle-manager]** (Round 1)

Architect is correct. `upgrade-project.sh/.ps1` operates on three tiers only: LOCKED (always overwrite), MERGE (replace WORKSPACE-MANAGED sections only), PRESERVE (never touch). GEMINI.md and CLAUDE.md are MERGE-tier, so the `### Skill Resolution Priority` section added outside WORKSPACE-MANAGED markers is invisible to the upgrade script.

Current state:
- New projects: templates updated, rule inherited ✅
- Existing projects: upgrade does not propagate this section ❌
- Propagation procedure: undocumented ❌

Two candidate solutions:
- **Option A**: Move section inside WORKSPACE-MANAGED markers → auto-propagated on upgrade, but removes per-project customization capability.
- **Option B**: Create a new follow-up script (`propagate-platform-config.ts`) and register it in the lifecycle table.

Question to docs-writer: Is adding a row to §6 sufficient, or is a separate ADR required?

---

**[docs-writer]** (Round 1)

Both options are valid, but discoverability is the key concern. If a developer modifies GEMINI.md without checking §6 first, the rule is useless.

Three parallel actions are needed:
1. **§6 table addition** — explicit follow-up action for CLAUDE.md/GEMINI.md modifications.
2. **Inline notice** — add a warning comment at the top of CLAUDE.md and GEMINI.md: "modifying this file requires following §6 propagation procedure."
3. **ADR** — Skill Resolution Priority is a new architectural decision and should be recorded as `docs/decisions/NNNN-skill-resolution-priority.md`.

Question to auditor: Can `audit.ts` automatically detect this gap? For example, by comparing section presence between workspace root GEMINI.md and `templates/*/GEMINI.md`?

---

**[architect]** (Round 2)

Focusing on Option B (new script). Option A is problematic: placing Skill Resolution Priority inside WORKSPACE-MANAGED markers would prevent per-project customization, which is undesirable since projects may need to override this behavior.

Recommendation: **Option B + docs-writer's three parallel actions**, but using `validate-templates.ts` extension instead of a new script:

- Add a `CLAUDE.md / GEMINI.md` row to §6 → follow-up: "manually propagate to templates/ + run `bun scripts/validate-templates.ts`"
- Add warning notice at the top of GEMINI.md
- Extend `validate-templates.ts` to compare section presence between root and template files (no new script needed)

---

**[lifecycle-manager]** (Round 2)

Agrees with architect's compromise. Extending existing `validate-templates.ts` reduces maintenance burden compared to a new script.

Additional point: CLAUDE.md and GEMINI.md are subject to the **Platform Documentation Parity** principle (CONSTITUTION.md §10). Any section added to GEMINI.md must have an equivalent entry in CLAUDE.md. Currently Skill Resolution Priority is missing from CLAUDE.md — this parity violation must also be included in the fix scope. `validate-templates.ts` should verify cross-platform parity as well.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | docs-writer | Medium | Add `CLAUDE.md`/`GEMINI.md` row to `GEMINI.md §6` lifecycle table with propagation follow-up actions | Now |
| A-02 | docs-writer | Medium | Add Skill Resolution Priority to `CLAUDE.md` to satisfy Platform Documentation Parity | Now |
| A-03 | automation-engineer | Medium | Extend `validate-templates.ts` to compare section presence between workspace root and template GEMINI.md/CLAUDE.md files | Next |
| A-04 | architect | Low | Write ADR in `docs/decisions/` for Skill Resolution Priority policy | Next |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------| 
| AC-01 | §6 table contains a row for CLAUDE.md/GEMINI.md modifications | `grep "CLAUDE.md" GEMINI.md` finds §6 entry |
| AC-02 | CLAUDE.md contains Skill Resolution Priority section | `grep "Skill Resolution Priority" CLAUDE.md` |
| AC-03 | `validate-templates.ts` detects missing sections across root and templates | `bun scripts/validate-templates.ts` fails when section is missing from a template |
| AC-04 | ADR exists in `docs/decisions/` | File present and linked from CONSTITUTION.md or AGENTS.md |
