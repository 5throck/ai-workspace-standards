# Design: Promotion Hold Gate (variant promotion requires explicit user approval)

- **Date**: 2026-08-29
- **Status**: Implemented
- **Related**: docs/designs/2026-08-29-upgrade-asset-allowlist-gate-design.md, skills/promote-variant (v1.3.0)

## Problem

Variant promotion readiness was purely technical: `audit.ts`, `agent-verify`,
`validate-skills.ts`, and `validate-variant-readiness.ts` can all be green
without anyone deciding that a project *should* become a reusable template.
The user directed (2026-08-29) that `Projects/co-newbiz` and
`Projects/co-architect` must not be promoted to variant templates without
explicit permission. Nothing in the machinery recorded or enforced that.

A secondary defect: `l3-to-variant-pipeline.ts` runs the Variant Readiness
Gate only in Phase 8 — on the **generated** template copy, after the workspace
tree has already been modified. A governance block discovered there is too
late and could be missed entirely if the generated `variant.json` drops the
source's hold field.

## Decision

Three layers, declarative at the source:

1. **Declarative hold (source of truth)** — a project's `variant.json` carries:
   ```json
   "promotionHold": {
     "hold": true,
     "reason": "Variant promotion requires explicit user permission ...",
     "recordedIn": "PROMOTION_CHECKLIST.md"
   }
   ```
   Seeded into `Projects/co-newbiz` and `Projects/co-architect`. Both
   `PROMOTION_CHECKLIST.md` files carry a matching "⛔ PROMOTION HOLD" banner.

2. **Mechanical pre-flight block** —
   - `l3-to-variant-pipeline.ts` 1.13.0 → **1.14.0**: new Phase 0.5 reads the
     *source* project's `variant.json` before any write and aborts on
     `promotionHold.hold === true`. No `--force` bypass: the owner removes the
     hold from `variant.json` only after the user approves.
   - `project-to-variant.ts` 1.2.1 → **1.3.0**: identical pre-flight check
     before any copy.
   - `validate-variant-readiness.ts` 1.0.0 → **1.1.0**: surfaces the hold as a
     blocking `promotion-hold` error so readiness output states *why* a
     project must not be promoted.

3. **Process documentation** — `skills/promote-variant` 1.2.1 → 1.3.0 adds the
   hold to its Prerequisites ("green readiness checks are not an approval").

## Verification

- `bun scripts/l3-to-variant-pipeline.ts --l3-path=Projects/co-newbiz ...` →
  exits 1 with `❌ PROMOTION HOLD ...` before Phase 1; zero artifacts created.
- `bun scripts/validate-variant-readiness.ts --dir Projects/co-newbiz` →
  NOT READY with `promotion-hold` error; same for co-architect.
- `bun scripts/audit.ts` (L0) and `Projects/co-architect` audits pass.

## Consequences

- Promotion is now an explicit two-key action: technical readiness **and**
  removal of the hold by the owner after user approval.
- Removing the hold is a deliberate, reviewable edit to `variant.json` — it
  will appear in the project's git history and PR, never a silent default.
- The hold shape is generic: any future project can adopt the same block.
