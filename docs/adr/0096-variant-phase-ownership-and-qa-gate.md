---
status: Accepted
date: 2026-10-01
author: PM
owner: architect
---

# ADR-0096: Phase numbering is variant-specific; PM duties are fixed; no auditor agent in projects

## Context

`templates/common/agents/pm.md` hardcoded the workspace-root phase schema ("PM owns phases 0, 1-2, and 5; phases 3, 4, 6 do not require PM involvement"). Every variant `extends` that body, but a comparison of the 13 variant `docs/phase-definitions.md` files (2026-10-01) showed that only part of the fleet follows the default skeleton (0 initiation, 1-2 analysis and approval gate, 3-4 specialist work, 5 PM finalization, 6 PM-run QA and `/sync`). co-news, co-deck, co-abap, co-game, and co-price renumber or rename phases (for example co-news Phase 5 = Visualization, co-deck adds 1.5 and 3.5). The claimed source of variant phase names, `variant.json` `phases` / `phase3_name`, does not exist as a phase list (`phases` there is a per-skill participation array; `phase3_name` appears only in a design document).

Related inconsistencies found in the same review: CONSTITUTION §5.4 placed "PM runs /sync → PR opened" inside Phase 6 while `pm_owned` excludes Phase 6; `agents/auditor.md` disclaimed QA-gate execution that `qa-gate.ts` and CONSTITUTION assign to it; `AGENTS.md` PM rows hardcoded Phase numbers that contradict variant tables.

## Decision

1. **Workspace root keeps its canonical schema.** `docs/workspace-schema.json` (`pm_owned` = 0, 1-2, 5; `autonomous` = 3, 4, 6) stays the L0 SSOT and is validated by `validate-templates.ts`. "Autonomous" means specialist-autonomous: specialists work without per-step PM approval; PM still dispatches and receives results.
2. **PR creation is a PM close-out, not a phase.** After the Phase 6 gate passes, PM runs `/sync`, opens the PR, and hands off. This matches the real `/sync` order (audit before commit and PR) without changing `pm_owned`.
3. **Projects and common template do not hardcode phase numbers.** `templates/common/agents/pm.md` states PM duties by role (initiation, every approval gate, finalization). The authoritative phase list for a project is the variant's `docs/phase-definitions.md` and `docs/<variant>.context.md` workflow table plus each agent's `phases` frontmatter. `templates/common/docs/phase-definitions.md` is the default skeleton; the variant document wins on conflict. Variants that remap must keep the three PM duties.
4. **No auditor agent in `templates/common`.** The auditor's checks are workspace-specific (cross-document consistency, L0↔L1 parity in `qa-gate.ts`). In projects, the Phase 6 QA gate is a contract: PM runs `bun scripts/audit.ts` and the `project-review` skill, collects sign-off from the variant's own domain reviewers, allows at most 2 fix iterations, then escalates to the user. `agents/auditor.md` is clarified: it runs `qa-gate.ts` at the workspace-root Phase 6; `audit.ts` is PM's.
5. **`AGENTS.md` PM roster rows are phase-neutral** in `templates/common`, all variants, and the `propagate-to-templates.ts` generator. co-news carries a variant-specific row (Phase 0 scoping, Phase 6 publish gate).

## Consequences

- **Positive**: a variant with a different pipeline no longer inherits a false statement about PM ownership; docs agree on where PR creation sits; the QA-gate contract is explicit without a 12th generic agent.
- **Cost**: the L0 documents and the project documents now state the model differently on purpose; readers must follow the pointer to the variant document for exact numbers.
- **Follow-ups**: re-evaluate a shared `qa-reviewer` role if three or more variants build their own generic reviewer. `workspace-schema.json` `_notes.variant_specific` still describes the unimplemented `phase3_name` mechanism and should be reworded or the mechanism implemented.

## References

- Design: `docs/designs/2026-10-01-variant-phase-ownership-design.md`
- CONSTITUTION §5.3 / §5.4, `docs/governance/agents/workflows.md`, `agents/pm.md`, `agents/auditor.md`
- ADR-0090 (thin AGENTS.md dispatcher), ADR-0095 (L3 extends pointers)
