# Design: Variant phase ownership and the project QA gate

Status: Implemented 2026-10-01 · Decision record: [ADR-0096](../adr/0096-variant-phase-ownership-and-qa-gate.md)

## 1. Problem

`templates/common/agents/pm.md` (inherited by every variant via `extends`) hardcoded the L0 phase schema. Variants differ, and several documents disagreed on who owns what at the end of a run.

## 2. Evidence (2026-10-01)

| Finding | Source |
|---|---|
| 7 variants follow the default skeleton (0 / 1-2 / 3-4 / 5 PM / 6 PM) | co-consult, co-design, co-develop, co-export, co-hr, co-work, co-safety `docs/phase-definitions.md` |
| 5 variants remap | co-news (5 Visualization, 6 Publish Gate), co-deck (1.5, 3.5, 5 Retrospective), co-abap (own 1–6), co-game (no 6), co-price (cycle stages) |
| No variant declares a phase list in `variant.json` | `phases` there is per-skill; `phase3_name` exists only in `docs/designs/l2-to-variant-conversion-pipeline.md` |
| `/sync` order is audit → commit → PR | `.claude/commands/sync.md` |
| `qa-gate.ts` is an L0↔L1 parity gate | `scripts/qa-gate.ts` header and Step 4 |

## 3. Options for the project QA gate

| Option | Result |
|---|---|
| A. Add `auditor` to `templates/common` | Rejected: checks are workspace-specific; duplicates variant domain reviewers; 13-variant propagation cost |
| B. Move PR creation to Phase 6, add 6 to `pm_owned` | Rejected: schema, validator, and constitution ripple |
| **C. Contract: PM-run gate + variant domain reviewers; PR as PM close-out** | Chosen |

## 4. Changes

| Layer | Change |
|---|---|
| Root | `agents/pm.md` Governance Workflow; `agents/auditor.md` responsibilities; CONSTITUTION §5.4; `docs/governance/agents/workflows.md` |
| Template common | `agents/pm.md` (role-based duties, `Can Lead Phases` pointer); `docs/phase-definitions.md` (default skeleton, QA contract); `AGENTS.md` PM row |
| Variants | PM row neutral in 12 `AGENTS.md`; co-news row variant-specific |
| Generator | `scripts/propagate-to-templates.ts` PM row |

## 5. Verification

`validate-templates.ts` (WS-01 `Can Lead Phases` = `pm_owned`, canonical phases present), `validate-pm-extends.ts` (29/29), unit tests for managed-block parity, agent lifecycle, PM stub resolution, upgrade policy.

## 6. Open items

- Reword or implement `workspace-schema.json` `_notes.variant_specific` (`phase3_name`).
- Per-variant review of co-abap, co-deck, co-game, co-price PM roles against their own tables.
- Revisit a shared `qa-reviewer` role at 3+ variant-local copies.
