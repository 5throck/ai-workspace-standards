---
status: Accepted
date: 2026-09-12
author: PM
---

# ADR-0074: Universal Design Gate — Spec Enforcement at Every Tier (L0–L3)

## Context

The sync-time spec gate (`scripts/audit.ts` spec-check, wired FATAL into `dev-sync.ts` step 3.9, ADR-0055 Stage 2) is a standardized core script present at every tier, but its coverage is not:

- `templates/common/` ships no spec infrastructure — no `docs/specs/registry.json` seed and no `spec-register.ts` mirror — so new scaffolds start with the gate **silently skipped** (step 3.9's existsSync guard).
- 5 of 11 existing projects (co-develop, co-export, co-game, co-newbiz, co-security) have no `docs/specs/registry.json` and therefore no gate; the other 6 acquired one ad-hoc during real work.
- ADR-0073's scaffold-parity zones classify `docs/specs` as `TEMPLATE_ONLY` (`TEMPLATE_ONLY_DIRS`, mirrored between `scripts/new-project.ts` and `scripts/lib/upgrade-policy.ts`): the scaffold deletes the zone post-overlay and the upgrade engine never delivers it — so the coverage holes are structural, not accidental.
- AGENTS.md §5.1.1 explicitly exempts L2/L3 variant projects from the Design Gate.

The operator decided on 2026-09-12 that the Design Gate applies to L3 as a **hard gate with no grace period**, so that every change remains traceable to a reviewed design/spec record.

## Decision

1. **The Design Gate is universal (L0–L3).** One machine gate — the spec-check — enforced identically at every tier; ceremony differs (full Row 0 execution-plan ceremony stays L0/L1 presentation; projects use the one-design-doc + `spec-register.ts` convention). AGENTS.md §5.1/§5.1.1 are amended accordingly. The E1–E5 exemption vocabulary is the relief valve at all tiers and does not change.
2. **ADR-0073 Amendment 2 — `docs/specs` becomes a delivered project area.** `docs/specs` is removed from `TEMPLATE_ONLY_DIRS` in both mirrors (`scripts/new-project.ts`, `scripts/lib/upgrade-policy.ts`); `docs/specs/registry.json` is claimed as an **add-if-missing seed** with WORKSPACE semantics (existing project registries are never overwritten or pruned). `docs/adr` remains template-only — project decision records live in `docs/designs/` (already a WORKSPACE seed).
3. **`spec-register.ts` is reclassified `L0+L1`** (SCRIPTS.md scope column drives the mirror) so scaffolded projects can register specs locally.
4. **Gate absence becomes visible.** `dev-sync.ts` step 3.9 turns the registry-absent silent skip into a prominent WARN for the bounded window before fleet backfill completes.
5. **Relevance mapping is the follow-up**, not part of acceptance: `covers:` path globs on registry entries/design docs, replacing the 7-day recency heuristic, introduced WARN-first per ADR-0055.

## Consequences

- New scaffolds gate from their **first code change**: empty registry + code diff + no docs activity = Fail. This is intended (operator decision); the scaffold quickstart and the Fail message's remedy text are the guidance path.
- Existing projects receive the seed and `spec-register.ts` through the normal `upgrade-project` path (no new delivery mechanism); the 5 uncovered projects run WARN until backfill lands, then enforce.
- The gate still enforces *spec activity*, not spec correctness — an accepted, documented limitation that Phase D (`covers:`) narrows to file-level relevance.
- Governance surfaces must move with enforcement in the same PRs: AGENTS.md §5.1/§5.1.1, the `/sync` pipeline table, the project-facing `COMMON-AGENTS` marker zone, and the coverage/parity gates (`check-upgrade-coverage --strict`, `verify-scripts` drift, `validate-templates`) all see a consistent tree only when the policy rows and the template seed land together.

Design detail: `docs/designs/2026-09-12-universal-design-gate-design.md` (verified state matrix, phased rollout, edge cases, gates).
