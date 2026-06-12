# Meeting Transcript
**Date**: 2026-06-12
**Topic**: variant.context.template.md common/specialized section separation strategy — Coding Guidelines migration, variant-specific area management design
**Participants**: architect, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**Architect**: (Round 1)

The core issue is that `variant.context.template.md` currently conflates two things: (1) structural skeleton that all variants share, and (2) content examples that are co-develop specific. The `## Coding Guidelines` section is firmly in category 2 — it references "Plan Mode," "Subagent Pattern," and "Phase 4 execution loop," which are co-develop-specific concepts. Removing it from the template and replacing it with a `VARIANT-INJECT: guidelines` marker is the right move. But we need more than just a marker — we need guidance on what goes in that slot. I propose declaring an inject taxonomy with REQUIRED and OPTIONAL classifications directly in the template's marker comments, so variant creators know exactly what to implement. The `variant.json` file could also declare which sections a variant implements, enabling structural validation independent of content parsing.

---

**Docs-writer**: (Round 1)

I agree with architect on removing Coding Guidelines from the template. But I want to raise a practical concern: all 5 variants already have different section names for that slot — co-develop has "Coding Guidelines," co-consult has "Consulting Guidelines," co-security likely has "Security Guidelines," co-design has "Design Guidelines," co-work has "Writing Guidelines." The inject marker should be named `guidelines` and each variant fills it with their domain-appropriate heading name. The key maintenance risk is drift — if one variant updates their Guidelines section, there's no automatic check that the structure is still conformant. I'd suggest audit.ts add a check: "every variant context.md must have exactly one `## * Guidelines` section positioned between Development Workflow and Git/PR Workflow."

---

**Auditor**: (Round 1)

Both architect and docs-writer are identifying the right problem but from different angles. Architect wants a structural solution (variant.json declaration), docs-writer wants a naming convention plus audit check. We need both, but I want to add a third dimension: the distinction between "COMMON-STRUCTURAL" and "VARIANT-CONTENT" needs to be explicit in the template itself. Currently the template mixes them without labeling. My proposal: add a REQUIRED vs OPTIONAL taxonomy to the inject markers directly. `<!-- VARIANT-INJECT: guidelines [REQUIRED] -->` signals that audit.ts must flag any variant missing this block. `<!-- VARIANT-INJECT: team-config [OPTIONAL] -->` is co-consult's "Team Configuration Scenarios" — valid but not required everywhere. This makes governance self-documenting.

---

### Round 2

**Architect**: (Round 2)

Auditor's REQUIRED/OPTIONAL taxonomy is the key insight I was missing. Building on that with a concrete schema — the template should have exactly these inject categories:

**REQUIRED inject blocks** (every variant must implement):
- `tech-stack` / `tool-stack`: variant's technology or tool inventory
- `agents`: variant's agent roster
- `environment-setup`: how to set up the environment
- `development-workflow`: the workflow loop
- `guidelines [REQUIRED, named freely]`: variant's domain rules (Coding / Consulting / Security / Design / Writing)
- `file-organization`: folder structure
- `domain-rules`: variant-specific constraints

**OPTIONAL inject blocks** (variant may include between sections 6 and 9):
- `team-config`: team sizing scenarios (co-consult pattern)
- `session-checklist`: session start checklist (co-security pattern)
- `engagement-workflow`: alternative workflow for consulting/non-dev variants

This is an L0-only structural change — no impact on CLAUDE.md or GEMINI.md platform files.

---

**Docs-writer**: (Round 2)

Building on what architect defined, let me address the co-develop Coding Guidelines migration specifically. The concrete steps are: (1) remove `## Coding Guidelines` from `variant.context.template.md` and replace with `<!-- VARIANT-INJECT: guidelines [REQUIRED] -->` with a placeholder heading `## [Domain] Guidelines`; (2) keep co-develop.context.md's Coding Guidelines as-is but wrap with VARIANT-INJECT markers; (3) ensure co-consult's Consulting Guidelines gets the same marker wrapping; (4) for co-design, co-work, co-security — create their domain-specific Guidelines sections. The template placeholder should include a hint comment: `<!-- rename to: Coding Guidelines / Consulting Guidelines / Security Guidelines / Design Guidelines / Writing Guidelines -->`. This makes the intent discoverable without needing external documentation.

---

**Auditor**: (Synthesis)

Both rounds converged on a clear, actionable design.

**Points of Agreement**:
1. `## Coding Guidelines` is co-develop specific — must be removed from template, kept in co-develop
2. REQUIRED/OPTIONAL inject marker taxonomy is the correct governance mechanism
3. audit.ts needs a new structural check for REQUIRED inject blocks presence
4. Each variant needs exactly one `## * Guidelines` section in the canonical position

**Open Disagreement**: architect wants variant.json to declare section presence; docs-writer wants audit.ts pattern matching. Consensus: audit.ts pattern matching is simpler and sufficient now. variant.json schema extension deferred to when complexity grows.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | docs-writer | Medium | Remove `## Coding Guidelines` from `variant.context.template.md`; add `<!-- VARIANT-INJECT: guidelines [REQUIRED] -->` placeholder | L0-only | Immediate |
| A-02 | docs-writer | Medium | Wrap `co-develop.context.md` `## Coding Guidelines` with VARIANT-INJECT markers | L0-only | Immediate |
| A-03 | docs-writer | Medium | `co-consult.context.md`: add VARIANT-INJECT markers to Consulting Guidelines + add HTML comments to Agents/Scripts + add `## Environment Setup` section | L0-only | Immediate |
| A-04 | docs-writer | Medium | co-design / co-work / co-security: create domain-specific `## * Guidelines` section with VARIANT-INJECT markers | L0-only | Immediate |
| A-05 | automation-engineer | Low | `audit.ts`: add check that every variant context.md has exactly one VARIANT-INJECT: guidelines [REQUIRED] block | L0-only | After A-01~A-04 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `variant.context.template.md` has no co-develop-specific content | grep for "Plan Mode", "Subagent Pattern", "Phase 4 execution loop" returns no results |
| C-02 | All 5 variant context.md files have `<!-- VARIANT-INJECT: guidelines [REQUIRED] -->` markers | grep over templates/co-*/docs/*.context.md |
| C-03 | audit.ts passes after all changes | `bun scripts/audit.ts` exits 0 |
| C-04 | co-consult.context.md has `## Environment Setup` and HTML comments in Agents/Scripts | file read verification |
